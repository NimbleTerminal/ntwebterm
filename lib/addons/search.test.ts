/**
 * Search comes from libghostty-vt (ghostty_search_*): it covers scrollback and
 * both screens, keeps results in sync with live output, and matches ASCII
 * letters case-insensitively. TerminalSearch is the binding; SearchAddon is
 * the xterm.js-shaped find bar API on top with highlight decorations.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { Ghostty, type GhosttyTerminal } from '../ghostty';
import type { Terminal } from '../terminal';
import { createIsolatedTerminal } from '../test-helpers';
import { SearchStatus } from '../types';
import { type ISearchResult, SearchAddon } from './search';

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

async function wasmTerminal(cols = 40, rows = 5): Promise<GhosttyTerminal> {
  const ghostty = await Ghostty.load();
  const term = ghostty.createTerminal(cols, rows);
  cleanup.push(() => term.free());
  return term;
}

describe('TerminalSearch', () => {
  test('finds matches across the screen, newest first, ignoring ASCII case', async () => {
    const term = await wasmTerminal();
    term.write('Foo one\r\nbar\r\nfoo two\r\nFOO three');
    const search = term.createSearch();
    cleanup.push(() => search.free());
    expect(search.status).toBe(SearchStatus.COMPLETE);
    expect(search.totalMatches).toBe(0);

    search.setNeedle('foo');
    expect(search.needle).toBe('foo');
    expect(search.status).toBe(SearchStatus.FEED_REQUIRED);
    search.run();
    expect(search.status).toBe(SearchStatus.COMPLETE);
    expect(search.totalMatches).toBe(3);

    const texts = search.matches().map((m) => term.formatSelection(m));
    expect(texts).toEqual(['FOO', 'foo', 'Foo']); // bottom of the screen first
    expect(search.selectedIndex).toBeNull();
  });

  test('selectNext walks toward older content and wraps; selectPrev goes back', async () => {
    const term = await wasmTerminal();
    term.write('a1\r\na2\r\na3');
    const search = term.createSearch();
    cleanup.push(() => search.free());
    search.setNeedle('a');
    search.run();
    const selected = () => term.formatSelection(search.selectedMatch!) + search.selectedIndex;
    expect(search.selectNext()).toBe(true);
    expect(selected()).toBe('a0'); // newest match is "a3"'s a, index 0
    expect(term.formatSelection(search.selectedMatch!, { trim: false })).toBe('a');
    search.selectNext();
    expect(search.selectedIndex).toBe(1);
    search.selectNext();
    expect(search.selectedIndex).toBe(2);
    search.selectNext();
    expect(search.selectedIndex).toBe(0); // wrapped
    search.selectPrev();
    expect(search.selectedIndex).toBe(2);
  });

  test('a needle with no matches selects nothing; clearing the needle goes idle', async () => {
    const term = await wasmTerminal();
    term.write('hello');
    const search = term.createSearch();
    cleanup.push(() => search.free());
    search.setNeedle('zzz');
    search.run();
    expect(search.totalMatches).toBe(0);
    expect(search.selectNext()).toBe(false);
    search.setNeedle(null);
    expect(search.needle).toBeNull();
    expect(search.status).toBe(SearchStatus.COMPLETE);
  });

  test('feeding picks up new output and scrollback', async () => {
    const term = await wasmTerminal(40, 3);
    term.write('needle 1\r\nx\r\nx');
    const search = term.createSearch();
    cleanup.push(() => search.free());
    search.setNeedle('needle');
    search.run();
    expect(search.totalMatches).toBe(1);
    term.write('\r\nneedle 2\r\nneedle 3');
    expect(term.getScrollbackLength()).toBeGreaterThan(0);
    search.run();
    expect(search.totalMatches).toBe(3);
    const texts = search.matches().map((m) => term.formatSelection(m));
    expect(texts).toEqual(['needle', 'needle', 'needle']);
  });

  test('tick and feed can drive the search in steps', async () => {
    const term = await wasmTerminal();
    term.write('step one\r\nstep two');
    const search = term.createSearch();
    cleanup.push(() => search.free());
    search.setNeedle('step');
    let guard = 0;
    while (search.status !== SearchStatus.COMPLETE && guard++ < 1000) {
      if (search.status === SearchStatus.FEED_REQUIRED) search.feed();
      else search.tick();
    }
    expect(search.totalMatches).toBe(2);
  });
});

describe('SearchAddon', () => {
  let container: HTMLElement;
  async function open(options: Parameters<typeof createIsolatedTerminal>[0] = {}) {
    container = document.createElement('div');
    document.body.appendChild(container);
    const term = await createIsolatedTerminal({ cols: 40, rows: 5, ...options });
    await term.open(container);
    const addon = new SearchAddon();
    term.loadAddon(addon);
    cleanup.push(() => {
      term.dispose();
      container.remove();
    });
    return { term, addon };
  }

  test('findNext selects matches and reports top-to-bottom result indices', async () => {
    const { term, addon } = await open();
    term.write('alpha\r\nbeta\r\nalpha again\r\ngamma');
    const results: ISearchResult[] = [];
    addon.onDidChangeResults((r) => results.push(r));

    expect(addon.findNext('alpha')).toBe(true);
    // Nearest to the prompt first: the second "alpha" is result 1 of 2 top-to-bottom.
    expect(results.at(-1)).toEqual({ resultIndex: 1, resultCount: 2 });
    expect(term.wasmTerm!.formatSelection(addon.activeMatch!)).toBe('alpha');

    expect(addon.findNext('alpha')).toBe(true);
    expect(results.at(-1)).toEqual({ resultIndex: 0, resultCount: 2 });

    expect(addon.findPrevious('alpha')).toBe(true);
    expect(results.at(-1)).toEqual({ resultIndex: 1, resultCount: 2 });
  });

  test('no match returns false with an empty result set', async () => {
    const { term, addon } = await open();
    term.write('alpha');
    const results: ISearchResult[] = [];
    addon.onDidChangeResults((r) => results.push(r));
    expect(addon.findNext('omega')).toBe(false);
    expect(results.at(-1)).toEqual({ resultIndex: -1, resultCount: 0 });
  });

  test('scrolls the viewport to a match in scrollback', async () => {
    const { term, addon } = await open({ scrollback: 100 });
    term.write('target line\r\n');
    for (let i = 0; i < 20; i++) term.write(`filler ${i}\r\n`);
    expect(term.getViewportY()).toBe(0);
    expect(addon.findNext('target')).toBe(true);
    expect(term.getViewportY()).toBeGreaterThan(0);
    const coords = addon.highlights();
    expect(coords.some((h) => h.active)).toBe(true);
    expect(coords.find((h) => h.active)).toMatchObject({ startCol: 0, endCol: 5 });
  });

  test('highlights cover every visible match and follow the viewport', async () => {
    const { term, addon } = await open();
    term.write('aa bb aa\r\ncc aa');
    addon.findNext('aa');
    const rows = addon
      .highlights()
      .map((h) => `${h.row}:${h.startCol}-${h.endCol}${h.active ? '*' : ''}`);
    expect(rows.sort()).toEqual(['0:0-1', '0:6-7', '1:3-4*']);
  });

  test('clearDecorations drops the needle and highlights', async () => {
    const { term, addon } = await open();
    term.write('alpha');
    addon.findNext('alpha');
    expect(addon.highlights().length).toBe(1);
    addon.clearDecorations();
    expect(addon.highlights()).toEqual([]);
    expect(addon.activeMatch).toBeNull();
  });

  test('new output is picked up when the terminal renders', async () => {
    const { term, addon } = await open();
    term.write('alpha');
    const results: ISearchResult[] = [];
    addon.onDidChangeResults((r) => results.push(r));
    addon.findNext('alpha');
    term.write('\r\nalpha');
    (term as any).renderTick();
    expect(results.at(-1)!.resultCount).toBe(2);
  });

  test('onRender fires after a frame is rendered', async () => {
    const { term } = await open();
    let fired = 0;
    term.onRender(() => fired++);
    term.write('x');
    (term as any).renderTick();
    expect(fired).toBe(1);
  });
});
