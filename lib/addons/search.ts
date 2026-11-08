/**
 * SearchAddon - find text in the terminal, xterm.js SearchAddon style.
 *
 * The search itself is libghostty-vt's (ghostty_search_*): it covers the
 * scrollback and both screens, follows live output, survives alternate-screen
 * switches, resizes and reflow, and matches ASCII letters case-insensitively.
 * This addon drives it incrementally so large scrollbacks do not block, maps
 * matches onto ntwebterm's viewport, scrolls the selected match into view and
 * paints highlights on an overlay canvas above the renderer.
 *
 * Differences from xterm.js: `findNext` moves toward older content (up), the
 * way Ghostty's own find does, and `findPrevious` toward newer; `regex`,
 * `wholeWord` and `caseSensitive` are not supported by the library.
 *
 * Usage:
 * ```typescript
 * const search = new SearchAddon();
 * term.loadAddon(search);
 * search.findNext('error');
 * search.onDidChangeResults(({ resultIndex, resultCount }) => ...);
 * ```
 */
import { EventEmitter } from '../event-emitter';
import type { TerminalSearch } from '../ghostty';
import type { IDisposable, IEvent, ITerminalAddon } from '../interfaces';
import type { Terminal } from '../terminal';
import { PointTag, SearchStatus, type TerminalSelection } from '../types';

export interface ISearchDecorationOptions {
  /** Fill for matches other than the selected one. Default: translucent yellow. */
  matchBackground?: string;
  /** Fill for the selected match. Default: translucent orange. */
  activeMatchBackground?: string;
}

export interface ISearchOptions {
  /**
   * Accepted for xterm.js compatibility. The library keeps results when the
   * needle is resubmitted, so typing in a find bar is already incremental.
   */
  incremental?: boolean;
  decorations?: ISearchDecorationOptions;
}

/** xterm.js shape: `resultIndex` counts top to bottom, -1 when nothing is selected. */
export interface ISearchResult {
  resultIndex: number;
  resultCount: number;
}

/** One highlighted span on a viewport row. */
export interface SearchHighlight {
  row: number;
  startCol: number;
  endCol: number;
  active: boolean;
}

interface AbsoluteMatch {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

/** Matches converted for highlighting per feed; older ones beyond this are not drawn. */
const MAX_HIGHLIGHTED_MATCHES = 5000;
/** Milliseconds of search work per background slice. */
const SLICE_BUDGET_MS = 6;

export class SearchAddon implements ITerminalAddon {
  private terminal?: Terminal;
  private search?: TerminalSearch;
  private canvas?: HTMLCanvasElement;
  private listeners: IDisposable[] = [];
  private sliceTimer?: ReturnType<typeof setTimeout>;
  private resultsEmitter = new EventEmitter<ISearchResult>();
  private lastResult: ISearchResult = { resultIndex: -1, resultCount: 0 };
  private matchCache: AbsoluteMatch[] = [];
  private active: AbsoluteMatch | null = null;
  private hideActive = false;
  private decorations: Required<ISearchDecorationOptions> = {
    matchBackground: 'rgba(255, 215, 0, 0.35)',
    activeMatchBackground: 'rgba(255, 140, 0, 0.6)',
  };

  /** Fires whenever the match count or the selected match changes. */
  public readonly onDidChangeResults: IEvent<ISearchResult> = this.resultsEmitter.event;

  activate(terminal: Terminal): void {
    this.terminal = terminal;
    this.listeners.push(
      terminal.onRender(() => this.refresh()),
      terminal.onScroll(() => this.draw()),
      terminal.onResize(() => this.draw())
    );
  }

  dispose(): void {
    this.stopSlices();
    for (const l of this.listeners) l.dispose();
    this.listeners = [];
    this.search?.free();
    this.search = undefined;
    this.canvas?.remove();
    this.canvas = undefined;
    this.resultsEmitter.dispose();
    this.terminal = undefined;
  }

  /** Find the next match toward older content (up). True if a match is selected. */
  findNext(term: string, options?: ISearchOptions): boolean {
    return this.find(term, options, 'next');
  }

  /** Find the previous match toward newer content (down). True if a match is selected. */
  findPrevious(term: string, options?: ISearchOptions): boolean {
    return this.find(term, options, 'prev');
  }

  /** Stop searching and remove all highlights. */
  clearDecorations(): void {
    this.stopSlices();
    this.search?.setNeedle(null);
    this.matchCache = [];
    this.active = null;
    this.hideActive = false;
    this.emit({ resultIndex: -1, resultCount: 0 });
    this.draw();
  }

  /** Keep the match highlights but stop emphasizing the selected one. */
  clearActiveDecoration(): void {
    this.hideActive = true;
    this.draw();
  }

  /** The selected match as a selection snapshot, or null. */
  get activeMatch(): TerminalSelection | null {
    return this.search?.selectedMatch ?? null;
  }

  /** The last reported result. */
  get results(): ISearchResult {
    return this.lastResult;
  }

  /** Highlight spans on the current viewport, for custom renderers or tests. */
  highlights(): SearchHighlight[] {
    const term = this.terminal;
    if (!term?.wasmTerm || this.matchCache.length === 0) return [];
    const scrollback = term.getScrollbackLength();
    const top = scrollback - Math.max(0, Math.floor(term.getViewportY()));
    const rows = term.rows;
    const cols = term.cols;
    const out: SearchHighlight[] = [];
    for (const m of this.matchCache) {
      if (m.endRow < top || m.startRow >= top + rows) continue;
      const active = !this.hideActive && this.active !== null && SearchAddon.same(m, this.active);
      for (let row = Math.max(m.startRow, top); row <= Math.min(m.endRow, top + rows - 1); row++) {
        out.push({
          row: row - top,
          startCol: row === m.startRow ? m.startCol : 0,
          endCol: row === m.endRow ? m.endCol : cols - 1,
          active,
        });
      }
    }
    return out;
  }

  /** Re-read the terminal, update highlights and results. Called on every render. */
  refresh(): void {
    const search = this.search;
    if (!search || search.needle === null) return;
    search.feed();
    this.scheduleSlices();
    this.afterChange(false);
  }

  // ==========================================================================
  // Internals
  // ==========================================================================

  private ensureSearch(): TerminalSearch | null {
    if (this.search) return this.search;
    const wasmTerm = this.terminal?.wasmTerm;
    if (!wasmTerm) return null;
    this.search = wasmTerm.createSearch();
    return this.search;
  }

  private find(term: string, options: ISearchOptions | undefined, dir: 'next' | 'prev'): boolean {
    const search = this.ensureSearch();
    if (!search) return false;
    if (options?.decorations) this.decorations = { ...this.decorations, ...options.decorations };
    this.hideActive = false;
    // Resubmitting the same needle keeps the results; a new one restarts.
    search.setNeedle(term);
    const found = dir === 'next' ? search.selectNext() : search.selectPrev();
    this.scheduleSlices();
    this.afterChange(true, true);
    return found;
  }

  /** Drive the scrollback scan in short slices so the page stays responsive. */
  private scheduleSlices(): void {
    if (this.sliceTimer !== undefined) return;
    const search = this.search;
    if (!search || search.status === SearchStatus.COMPLETE) return;
    this.sliceTimer = setTimeout(() => {
      this.sliceTimer = undefined;
      if (!this.search || this.search.needle === null) return;
      const deadline = performance.now() + SLICE_BUDGET_MS;
      let status = this.search.status;
      while (status !== SearchStatus.COMPLETE && performance.now() < deadline) {
        if (status === SearchStatus.FEED_REQUIRED) {
          this.search.feed();
          status = this.search.status;
        } else {
          status = this.search.tick();
        }
      }
      this.afterChange(false);
      if (status !== SearchStatus.COMPLETE) this.scheduleSlices();
    }, 0);
  }

  private stopSlices(): void {
    if (this.sliceTimer !== undefined) clearTimeout(this.sliceTimer);
    this.sliceTimer = undefined;
  }

  /**
   * Recompute the highlight cache, report results (always after an explicit
   * find, otherwise only when they changed), optionally scroll to the selection.
   */
  private afterChange(scrollToActive: boolean, forceEmit = false): void {
    const term = this.terminal;
    const search = this.search;
    if (!term?.wasmTerm || !search) return;
    const wasmTerm = term.wasmTerm;
    const toAbsolute = (sel: TerminalSelection): AbsoluteMatch | null => {
      const ordered = wasmTerm.selectionOrdered(sel);
      const s = wasmTerm.pointFromGridRef(ordered.start, PointTag.SCREEN);
      const e = wasmTerm.pointFromGridRef(ordered.end, PointTag.SCREEN);
      return s && e ? { startCol: s.x, startRow: s.y, endCol: e.x, endRow: e.y } : null;
    };

    const matches = search.needle === null ? [] : search.matches();
    this.matchCache = [];
    for (const m of matches.slice(0, MAX_HIGHLIGHTED_MATCHES)) {
      const abs = toAbsolute(m);
      if (abs) this.matchCache.push(abs);
    }
    const selected = search.selectedMatch;
    this.active = selected ? toAbsolute(selected) : null;

    const total = search.totalMatches;
    const index = search.selectedIndex;
    // Upstream counts newest first; xterm.js counts top to bottom.
    this.emit(
      { resultIndex: index === null ? -1 : total - 1 - index, resultCount: total },
      forceEmit
    );

    if (scrollToActive && this.active) this.scrollIntoView(this.active);
    this.draw();
  }

  private emit(result: ISearchResult, force = false): void {
    if (
      !force &&
      result.resultIndex === this.lastResult.resultIndex &&
      result.resultCount === this.lastResult.resultCount
    ) {
      return;
    }
    this.lastResult = result;
    this.resultsEmitter.fire(result);
  }

  private scrollIntoView(match: AbsoluteMatch): void {
    const term = this.terminal!;
    const scrollback = term.getScrollbackLength();
    const viewportY = Math.max(0, Math.floor(term.getViewportY()));
    const top = scrollback - viewportY;
    if (match.startRow >= top && match.startRow < top + term.rows) return;
    // viewportY counts rows scrolled back from the bottom; centre the match.
    const target = scrollback - match.startRow + Math.floor(term.rows / 2);
    term.scrollToLine(Math.max(0, Math.min(scrollback, target)));
  }

  private static same(a: AbsoluteMatch, b: AbsoluteMatch): boolean {
    return (
      a.startCol === b.startCol &&
      a.startRow === b.startRow &&
      a.endCol === b.endCol &&
      a.endRow === b.endRow
    );
  }

  /** Paint the highlights on an overlay canvas stacked above the renderer. */
  private draw(): void {
    const term = this.terminal;
    if (!term?.element || !term.renderer) return;
    const highlights = this.highlights();
    if (!this.canvas) {
      if (highlights.length === 0) return;
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '1';
      canvas.setAttribute('aria-hidden', 'true');
      term.element.appendChild(canvas);
      this.canvas = canvas;
    }
    const metrics = term.renderer.getMetrics();
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cssW = term.cols * metrics.width;
    const cssH = term.rows * metrics.height;
    const canvas = this.canvas;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    for (const h of highlights) {
      ctx.fillStyle = h.active
        ? this.decorations.activeMatchBackground
        : this.decorations.matchBackground;
      ctx.fillRect(
        h.startCol * metrics.width,
        h.row * metrics.height,
        (h.endCol - h.startCol + 1) * metrics.width,
        metrics.height
      );
    }
  }
}
