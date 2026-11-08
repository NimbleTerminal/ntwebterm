/**
 * Selection Manager - browser plumbing around libghostty-vt's selection.
 *
 * The terminal owns the selection and tracks it across writes, scrolling and
 * resizes (GhosttyTerminal.setSelection/getSelection). Upstream's gesture
 * state machine turns presses and drags into selections, deciding click
 * counts, word and line behavior, the within-cell drag threshold and when to
 * autoscroll. The formatter produces the copied text.
 *
 * TypeScript keeps what is browser- or renderer-specific: pointer events to
 * cells (fractional CSS cell metrics, BiDi visual-to-logical mapping), the
 * autoscroll timer, copy-on-select, the context-menu textarea, and one
 * selection shape upstream cannot express: a drag over a mixed-direction row
 * selects the visually swept cells, which may be several logical ranges.
 */

import type { RowBidiMapper } from './bidi';
import { writeTextToClipboard } from './clipboard';
import { EventEmitter } from './event-emitter';
import type { GhosttyTerminal } from './ghostty';
import type { IEvent } from './interfaces';
import type { Renderer } from './renderer-types';
import type { Terminal } from './terminal';
import {
  type GhosttyCell,
  PointTag,
  SelectionGestureAutoscroll,
  SelectionGestureBehavior,
  type TerminalSelection,
} from './types';

// ============================================================================
// Type Definitions
// ============================================================================

/** Viewport-space selection bounds for the renderers, inclusive. */
export interface SelectionCoordinates {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

/**
 * Which columns SelectionCoordinates name. 'logical' is the terminal's
 * selection; 'visual' is a drag over a BiDi row, in displayed columns.
 */
export type SelectionColumnSpace = 'visual' | 'logical';

/** A cell addressed by absolute row (scrollback + screen) and a column. */
interface AbsoluteCell {
  col: number;
  absRow: number;
}

interface PointerCell {
  row: number;
  absRow: number;
  visualCol: number;
  logicalCol: number;
  /** Surface-space position in the integer geometry handed to the gesture. */
  x: number;
  y: number;
}

// ============================================================================
// SelectionManager Class
// ============================================================================

export class SelectionManager {
  private terminal: Terminal;
  private renderer: Renderer;
  private wasmTerm: GhosttyTerminal;
  private textarea: HTMLTextAreaElement;
  private bidiMapper: RowBidiMapper;

  /**
   * A visual-span selection over BiDi rows, in displayed columns. While set,
   * the terminal's own selection is cleared and this is what is shown and
   * copied. Null means the terminal owns the selection.
   */
  private visual: { anchor: AbsoluteCell; head: AbsoluteCell } | null = null;

  // Active left-button gesture
  private isSelecting = false;
  private press: AbsoluteCell | null = null; // anchor in visual columns
  private dragSelected = false;
  private lastPointer: { clientX: number; clientY: number } | null = null;

  /** Viewport rows whose selection highlight changed since the renderer last asked. */
  private dirtySelectionRows: Set<number> = new Set();

  private selectionChangedEmitter = new EventEmitter<void>();

  private boundMouseDownHandler: ((e: MouseEvent) => void) | null = null;
  private boundMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private boundMouseUpHandler: ((e: MouseEvent) => void) | null = null;
  private boundContextMenuHandler: ((e: MouseEvent) => void) | null = null;
  private boundClickHandler: ((e: MouseEvent) => void) | null = null;
  private boundDocumentMouseDownHandler: ((e: MouseEvent) => void) | null = null;
  private mouseDownTarget: EventTarget | null = null;
  private contextMenuTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private boundResetTextarea: (() => void) | null = null;

  private autoScrollInterval: ReturnType<typeof setInterval> | null = null;
  private autoScrollDirection = 0; // -1 = up, 0 = none, 1 = down
  private static readonly AUTO_SCROLL_SPEED = 3; // rows per tick
  private static readonly AUTO_SCROLL_INTERVAL = 50; // ms between ticks
  /** Presses closer together than this count as double and triple clicks. */
  private static readonly REPEAT_INTERVAL_NS = 500_000_000n;

  constructor(
    terminal: Terminal,
    renderer: Renderer,
    wasmTerm: GhosttyTerminal,
    textarea: HTMLTextAreaElement,
    bidiMapper: RowBidiMapper
  ) {
    this.terminal = terminal;
    this.renderer = renderer;
    this.wasmTerm = wasmTerm;
    this.textarea = textarea;
    this.bidiMapper = bidiMapper;
    this.attachEventListeners();
  }

  // ==========================================================================
  // Row helpers (the viewport lives in TypeScript; see Terminal.viewportY)
  // ==========================================================================

  private getViewportY(): number {
    return Math.max(0, Math.floor(this.terminal.getViewportY()));
  }

  private viewportRowToAbsolute(viewportRow: number): number {
    return this.wasmTerm.getScrollbackLength() - this.getViewportY() + viewportRow;
  }

  private absoluteRowToViewport(absoluteRow: number): number {
    return absoluteRow - this.wasmTerm.getScrollbackLength() + this.getViewportY();
  }

  private getLineAbs(absRow: number): GhosttyCell[] | null {
    const scrollback = this.wasmTerm.getScrollbackLength();
    return absRow < scrollback
      ? this.wasmTerm.getScrollbackLine(absRow)
      : this.wasmTerm.getLine(absRow - scrollback);
  }

  private isWrappedAbs(absRow: number): boolean {
    const scrollback = this.wasmTerm.getScrollbackLength();
    return absRow < scrollback
      ? this.wasmTerm.isScrollbackRowWrapped(absRow)
      : this.wasmTerm.isRowWrapped(absRow - scrollback);
  }

  private rowIsBidi(absRow: number): boolean {
    const line = this.getLineAbs(absRow);
    return line !== null && !this.bidiMapper.getMap(line).isIdentity;
  }

  /** Displayed column to the PTY's logical column, landing on a wide cell's first half. */
  private visualToLogical(line: GhosttyCell[] | null, col: number): number {
    if (!line) return col;
    const map = this.bidiMapper.getMap(line);
    let lcol =
      map.isIdentity || col >= map.visualToLogical.length ? col : map.visualToLogical[col]!;
    if (line[lcol]?.width === 0 && lcol > 0 && line[lcol - 1]?.width === 2) lcol--;
    return lcol;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /** The selected text, as libghostty's formatter produces it for the clipboard. */
  getSelection(): string {
    if (this.visual) return this.visualText();
    const sel = this.wasmTerm.getSelection();
    return sel ? this.wasmTerm.formatSelection(sel) : '';
  }

  hasSelection(): boolean {
    return this.visual !== null || this.wasmTerm.getSelection() !== null;
  }

  /** Copy the selection to the clipboard; true if there was text to copy. */
  copySelection(): boolean {
    if (!this.hasSelection()) return false;
    const text = this.getSelection();
    if (!text) return false;
    this.copyToClipboard(text);
    return true;
  }

  /** Clear the selection and mark its rows for repaint. Does not fire onSelectionChange. */
  clearSelection(): void {
    if (!this.hasSelection()) return;
    this.markCurrentSelectionDirty();
    this.visual = null;
    this.wasmTerm.setSelection(null);
    this.isSelecting = false;
  }

  /** Select all content, scrollback included. */
  selectAll(): void {
    this.applySelection(this.wasmTerm.selectAll());
  }

  /**
   * Select `length` logical cells from (column, row) on the viewport, wrapping
   * onto following rows like xterm.js.
   */
  select(column: number, row: number, length: number): void {
    const dims = this.wasmTerm.getDimensions();
    row = Math.max(0, Math.min(row, dims.rows - 1));
    column = Math.max(0, Math.min(column, dims.cols - 1));
    let endRow = row;
    let endCol = column + length - 1;
    while (endCol >= dims.cols) {
      endCol -= dims.cols;
      endRow++;
    }
    endRow = Math.min(endRow, dims.rows - 1);
    this.selectAbsolute(
      column,
      this.viewportRowToAbsolute(row),
      endCol,
      this.viewportRowToAbsolute(endRow)
    );
  }

  /** Select whole viewport rows `start` through `end`. */
  selectLines(start: number, end: number): void {
    const dims = this.wasmTerm.getDimensions();
    start = Math.max(0, Math.min(start, dims.rows - 1));
    end = Math.max(0, Math.min(end, dims.rows - 1));
    if (start > end) [start, end] = [end, start];
    this.selectAbsolute(
      0,
      this.viewportRowToAbsolute(start),
      dims.cols - 1,
      this.viewportRowToAbsolute(end)
    );
  }

  /**
   * Select the logical range between two absolute cells (scrollback + screen
   * rows, PTY columns), in either direction, and install it in the terminal.
   */
  selectAbsolute(startCol: number, startAbsRow: number, endCol: number, endAbsRow: number): void {
    const start = this.wasmTerm.gridRef(PointTag.SCREEN, startCol, startAbsRow);
    const end = this.wasmTerm.gridRef(PointTag.SCREEN, endCol, endAbsRow);
    if (!start || !end) return;
    this.applySelection({ start, end, rectangle: false });
  }

  getSelectionPosition():
    | { start: { x: number; y: number }; end: { x: number; y: number } }
    | undefined {
    const coords = this.getSelectionCoords();
    if (!coords) return undefined;
    return {
      start: { x: coords.startCol, y: coords.startRow },
      end: { x: coords.endCol, y: coords.endRow },
    };
  }

  deselect(): void {
    this.clearSelection();
    this.selectionChangedEmitter.fire();
  }

  focus(): void {
    this.renderer.canvas.parentElement?.focus();
  }

  /**
   * Selection bounds in viewport rows for the renderers, clamped to the
   * visible area; null when nothing selected is visible.
   */
  getSelectionCoords(): SelectionCoordinates | null {
    const bounds = this.absoluteBounds();
    if (!bounds) return null;
    const [a, b] = bounds;
    const dims = this.wasmTerm.getDimensions();
    let startRow = this.absoluteRowToViewport(a.absRow);
    let endRow = this.absoluteRowToViewport(b.absRow);
    let startCol = a.col;
    let endCol = b.col;
    if (endRow < 0 || startRow > dims.rows - 1) return null;
    if (startRow < 0) {
      startRow = 0;
      startCol = 0;
    }
    if (endRow > dims.rows - 1) {
      endRow = dims.rows - 1;
      endCol = dims.cols - 1;
    }
    return { startCol, startRow, endCol, endRow };
  }

  getSelectionColumnSpace(): SelectionColumnSpace {
    return this.visual ? 'visual' : 'logical';
  }

  getDirtySelectionRows(): Set<number> {
    return this.dirtySelectionRows;
  }

  clearDirtySelectionRows(): void {
    this.dirtySelectionRows.clear();
  }

  get onSelectionChange(): IEvent<void> {
    return this.selectionChangedEmitter.event;
  }

  dispose(): void {
    this.selectionChangedEmitter.dispose();
    this.stopAutoScroll();
    const canvas = this.renderer.canvas;
    if (this.boundMouseDownHandler) {
      canvas.removeEventListener('mousedown', this.boundMouseDownHandler);
      this.boundMouseDownHandler = null;
    }
    if (this.boundMouseMoveHandler) {
      document.removeEventListener('mousemove', this.boundMouseMoveHandler);
      this.boundMouseMoveHandler = null;
    }
    if (this.boundMouseUpHandler) {
      document.removeEventListener('mouseup', this.boundMouseUpHandler);
      this.boundMouseUpHandler = null;
    }
    if (this.boundDocumentMouseDownHandler) {
      document.removeEventListener('mousedown', this.boundDocumentMouseDownHandler);
      this.boundDocumentMouseDownHandler = null;
    }
    if (this.contextMenuTimeoutId !== null) {
      clearTimeout(this.contextMenuTimeoutId);
      this.contextMenuTimeoutId = null;
    }
    if (this.boundResetTextarea) {
      this.boundResetTextarea();
      this.boundResetTextarea = null;
    }
    if (this.boundContextMenuHandler) {
      canvas.removeEventListener('contextmenu', this.boundContextMenuHandler);
      this.boundContextMenuHandler = null;
    }
    if (this.boundClickHandler) {
      document.removeEventListener('click', this.boundClickHandler);
      this.boundClickHandler = null;
    }
  }

  // ==========================================================================
  // Selection state
  // ==========================================================================

  /** Install a logical selection (or clear with null), repaint, and notify. */
  private applySelection(sel: TerminalSelection | null): void {
    this.markCurrentSelectionDirty();
    this.visual = null;
    this.wasmTerm.setSelection(sel);
    this.markCurrentSelectionDirty();
    this.selectionChangedEmitter.fire();
  }

  /** Ordered absolute bounds of the current selection, or null. */
  private absoluteBounds(): [AbsoluteCell, AbsoluteCell] | null {
    if (this.visual) return SelectionManager.order(this.visual.anchor, this.visual.head);
    const sel = this.wasmTerm.getSelection();
    if (!sel) return null;
    const ordered = this.wasmTerm.selectionOrdered(sel);
    const start = this.wasmTerm.pointFromGridRef(ordered.start, PointTag.SCREEN);
    const end = this.wasmTerm.pointFromGridRef(ordered.end, PointTag.SCREEN);
    if (!start || !end) return null;
    return [
      { col: start.x, absRow: start.y },
      { col: end.x, absRow: end.y },
    ];
  }

  private static order(a: AbsoluteCell, b: AbsoluteCell): [AbsoluteCell, AbsoluteCell] {
    return a.absRow > b.absRow || (a.absRow === b.absRow && a.col > b.col) ? [b, a] : [a, b];
  }

  /**
   * Text of a visual-span selection. Each row's swept displayed columns map
   * to logical cells, possibly several runs; each run is formatted by
   * libghostty and the runs are joined in logical order.
   */
  private visualText(): string {
    const [a, b] = SelectionManager.order(this.visual!.anchor, this.visual!.head);
    let text = '';
    for (let absRow = a.absRow; absRow <= b.absRow; absRow++) {
      const line = this.getLineAbs(absRow);
      if (!line) continue;
      const colStart = absRow === a.absRow ? a.col : 0;
      const colEnd = Math.min(absRow === b.absRow ? b.col : line.length - 1, line.length - 1);
      const map = this.bidiMapper.getMap(line);
      const logical: number[] = [];
      for (let v = Math.max(0, colStart); v <= colEnd; v++) {
        logical.push(map.isIdentity ? v : map.visualToLogical[v]!);
      }
      logical.sort((x, y) => x - y);
      let rowText = '';
      for (let i = 0; i < logical.length; ) {
        let j = i;
        while (j + 1 < logical.length && logical[j + 1] === logical[j]! + 1) j++;
        const start = this.wasmTerm.gridRef(PointTag.SCREEN, logical[i]!, absRow);
        const end = this.wasmTerm.gridRef(PointTag.SCREEN, logical[j]!, absRow);
        if (start && end) {
          rowText += this.wasmTerm.formatSelection(
            { start, end, rectangle: false },
            { unwrap: false, trim: false }
          );
        }
        i = j + 1;
      }
      text += rowText.replace(/ +$/, '');
      if (absRow < b.absRow && !this.isWrappedAbs(absRow + 1)) text += '\n';
    }
    return text;
  }

  private markCurrentSelectionDirty(): void {
    const coords = this.getSelectionCoords();
    if (!coords) return;
    for (let row = coords.startRow; row <= coords.endRow; row++) this.dirtySelectionRows.add(row);
  }

  private copyAndNotify(): void {
    const text = this.getSelection();
    if (text) this.copyToClipboard(text);
    this.selectionChangedEmitter.fire();
  }

  // ==========================================================================
  // Pointer events
  // ==========================================================================

  /** Integer cell size the gesture geometry uses; renderer metrics may be fractional. */
  private cellPixels(): { cw: number; ch: number } {
    const m = this.renderer.getMetrics();
    return { cw: Math.max(1, Math.round(m.width)), ch: Math.max(1, Math.round(m.height)) };
  }

  /**
   * The cell under a pointer, clamped to the grid. Hit-testing uses the
   * renderer's fractional metrics so wide terminals do not drift; the surface
   * position handed to the gesture is rebuilt inside that cell from the
   * integer geometry, so its within-cell threshold and edge detection agree.
   */
  private pointerToCell(clientX: number, clientY: number): PointerCell {
    const m = this.renderer.getMetrics();
    const rect = this.renderer.canvas.getBoundingClientRect();
    const { cw, ch } = this.cellPixels();
    const cols = this.terminal.cols;
    const rows = this.terminal.rows;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const visualCol = Math.max(0, Math.min(Math.floor(px / m.width), cols - 1));
    const row = Math.max(0, Math.min(Math.floor(py / m.height), rows - 1));
    const inside = (offset: number, extent: number) => Math.min(Math.max(offset, 0), extent - 0.01);
    const absRow = this.viewportRowToAbsolute(row);
    const logicalCol = this.visualToLogical(this.getLineAbs(absRow), visualCol);
    const screenHeight = rows * ch;
    // Past the top or bottom edge the gesture expects y at the edge itself.
    const y =
      py < 0
        ? 0
        : py >= rows * m.height
          ? screenHeight
          : row * ch + inside(py - row * m.height, ch);
    return {
      row,
      absRow,
      visualCol,
      logicalCol,
      x: logicalCol * cw + inside(px - visualCol * m.width, cw),
      y,
    };
  }

  private geometry() {
    const { cw, ch } = this.cellPixels();
    return { columns: this.terminal.cols, cellWidth: cw, screenHeight: this.terminal.rows * ch };
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    // Focus the terminal so it keeps receiving keyboard input.
    this.focus();

    const cell = this.pointerToCell(e.clientX, e.clientY);
    const ref = this.wasmTerm.gridRef(PointTag.SCREEN, cell.logicalCol, cell.absRow);
    if (!ref) return;

    this.markCurrentSelectionDirty();
    const { cw } = this.cellPixels();
    const sel = this.wasmTerm.gesturePress(ref, {
      x: cell.x,
      y: cell.y,
      timeNs: BigInt(Math.round(performance.now() * 1e6)),
      repeatDistance: cw,
      repeatIntervalNs: SelectionManager.REPEAT_INTERVAL_NS,
    });
    this.visual = null;
    this.isSelecting = true;
    this.dragSelected = false;
    this.press = { col: cell.visualCol, absRow: cell.absRow };
    this.lastPointer = { clientX: e.clientX, clientY: e.clientY };
    if (sel) {
      // A double or triple click selected a word or line.
      this.wasmTerm.setSelection(sel);
      this.markCurrentSelectionDirty();
      this.copyAndNotify();
    } else {
      // A single click clears any previous selection; a drag may start one.
      this.wasmTerm.setSelection(null);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isSelecting) return;
    this.lastPointer = { clientX: e.clientX, clientY: e.clientY };
    this.updateDrag(e.clientX, e.clientY);
  }

  /** Feed the pointer to the gesture and apply what it selects. */
  private updateDrag(clientX: number, clientY: number): void {
    const cell = this.pointerToCell(clientX, clientY);
    const ref = this.wasmTerm.gridRef(PointTag.SCREEN, cell.logicalCol, cell.absRow);
    if (!ref) return;
    const sel = this.wasmTerm.gestureDrag(ref, { x: cell.x, y: cell.y, geometry: this.geometry() });
    const state = this.wasmTerm.gestureState();
    this.setAutoScroll(
      state.autoscroll === SelectionGestureAutoscroll.UP
        ? -1
        : state.autoscroll === SelectionGestureAutoscroll.DOWN
          ? 1
          : 0
    );
    const bidi =
      state.behavior === SelectionGestureBehavior.CELL &&
      this.press !== null &&
      (this.rowIsBidi(this.press.absRow) || this.rowIsBidi(cell.absRow));
    if (bidi) {
      // Upstream's selection is a logical range; a drag over a reordered row
      // must select what the pointer swept on screen. Its half-cell rule is
      // meaningless there, so any movement off the pressed cell selects.
      if (!state.dragged) return;
      this.markCurrentSelectionDirty();
      this.wasmTerm.setSelection(null);
      this.visual = { anchor: this.press!, head: { col: cell.visualCol, absRow: cell.absRow } };
    } else {
      if (!sel) return;
      this.markCurrentSelectionDirty();
      this.visual = null;
      this.wasmTerm.setSelection(sel);
    }
    this.dragSelected = true;
    this.markCurrentSelectionDirty();
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.isSelecting) return;
    this.isSelecting = false;
    this.stopAutoScroll();
    const cell = this.pointerToCell(e.clientX, e.clientY);
    this.wasmTerm.gestureRelease(
      this.wasmTerm.gridRef(PointTag.SCREEN, cell.logicalCol, cell.absRow)
    );
    if (this.dragSelected && this.hasSelection()) this.copyAndNotify();
  }

  private setAutoScroll(direction: number): void {
    if (direction === this.autoScrollDirection) return;
    this.stopAutoScroll();
    if (direction === 0) return;
    this.autoScrollDirection = direction;
    this.autoScrollInterval = setInterval(() => {
      if (!this.isSelecting || !this.lastPointer) {
        this.stopAutoScroll();
        return;
      }
      this.terminal.scrollLines(SelectionManager.AUTO_SCROLL_SPEED * this.autoScrollDirection);
      this.updateDrag(this.lastPointer.clientX, this.lastPointer.clientY);
    }, SelectionManager.AUTO_SCROLL_INTERVAL);
  }

  private stopAutoScroll(): void {
    if (this.autoScrollInterval !== null) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
    this.autoScrollDirection = 0;
  }

  private attachEventListeners(): void {
    const canvas = this.renderer.canvas;

    this.boundMouseDownHandler = (e) => this.handleMouseDown(e);
    canvas.addEventListener('mousedown', this.boundMouseDownHandler);
    // Drags continue outside the canvas, so move and up are document-level.
    this.boundMouseMoveHandler = (e) => this.handleMouseMove(e);
    document.addEventListener('mousemove', this.boundMouseMoveHandler);
    this.boundMouseUpHandler = (e) => this.handleMouseUp(e);
    document.addEventListener('mouseup', this.boundMouseUpHandler);

    this.boundDocumentMouseDownHandler = (e) => {
      this.mouseDownTarget = e.target;
    };
    document.addEventListener('mousedown', this.boundDocumentMouseDownHandler);

    // Right click: park the hidden textarea under the pointer with the
    // selected text so the browser's context menu offers Copy.
    this.boundContextMenuHandler = (e: MouseEvent) => {
      this.textarea.style.position = 'fixed';
      this.textarea.style.left = `${e.clientX}px`;
      this.textarea.style.top = `${e.clientY}px`;
      this.textarea.style.width = '1px';
      this.textarea.style.height = '1px';
      this.textarea.style.zIndex = '1000';
      this.textarea.style.opacity = '0';
      this.textarea.style.pointerEvents = 'auto';

      if (this.hasSelection()) {
        const text = this.getSelection();
        this.textarea.value = text;
        this.textarea.select();
        this.textarea.setSelectionRange(0, text.length);
      } else {
        this.textarea.value = '';
      }
      this.textarea.focus();

      if (this.contextMenuTimeoutId !== null) clearTimeout(this.contextMenuTimeoutId);
      this.boundResetTextarea?.();
      this.contextMenuTimeoutId = setTimeout(() => {
        this.contextMenuTimeoutId = null;
        const resetTextarea = () => {
          this.textarea.style.pointerEvents = 'none';
          this.textarea.style.zIndex = '-10';
          this.textarea.style.width = '0';
          this.textarea.style.height = '0';
          this.textarea.style.left = '0';
          this.textarea.style.top = '0';
          this.textarea.value = '';
          document.removeEventListener('click', resetTextarea);
          document.removeEventListener('contextmenu', resetTextarea);
          this.textarea.removeEventListener('blur', resetTextarea);
          if (this.boundResetTextarea === resetTextarea) this.boundResetTextarea = null;
        };
        this.boundResetTextarea = resetTextarea;
        document.addEventListener('click', resetTextarea, { once: true });
        document.addEventListener('contextmenu', resetTextarea, { once: true });
        this.textarea.addEventListener('blur', resetTextarea, { once: true });
      }, 10);
    };
    canvas.addEventListener('contextmenu', this.boundContextMenuHandler);

    // Clicking outside the terminal clears the selection.
    this.boundClickHandler = (e: MouseEvent) => {
      if (this.isSelecting) return;
      if (this.mouseDownTarget && canvas.contains(this.mouseDownTarget as Node)) return;
      if (!canvas.contains(e.target as Node) && this.hasSelection()) this.clearSelection();
    };
    document.addEventListener('click', this.boundClickHandler);
  }

  /** Copy text to the clipboard (shared browser strategy in clipboard.ts). */
  private copyToClipboard(text: string): void {
    writeTextToClipboard(text, this.textarea);
  }
}
