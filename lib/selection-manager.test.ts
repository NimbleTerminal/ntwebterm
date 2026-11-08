/**
 * Selection Manager Tests
 *
 * The selection lives in libghostty-vt: the terminal owns and tracks it,
 * the gesture state machine interprets clicks and drags, and the formatter
 * produces the copied text. TypeScript keeps only browser plumbing and the
 * visual-span path for drags over mixed-direction (BiDi) rows.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { SelectionManager } from './selection-manager';
import type { Terminal } from './terminal';
import { createIsolatedTerminal } from './test-helpers';

const manager = (term: Terminal) => (term as any).selectionManager as SelectionManager;

/** Absolute row (scrollback + screen) of a viewport row. */
function viewportToAbsolute(term: Terminal, viewportRow: number): number {
  const scrollbackLength = term.wasmTerm?.getScrollbackLength() ?? 0;
  return scrollbackLength + viewportRow - Math.floor(term.getViewportY());
}

/** Dispatch a mouse event inside a viewport cell, `frac` of the way across it. */
function mouse(
  term: Terminal,
  type: 'mousedown' | 'mousemove' | 'mouseup',
  col: number,
  row: number,
  init: MouseEventInit = {},
  frac = 0.5
): void {
  const renderer = (term as any).renderer;
  const canvas = renderer.canvas as HTMLCanvasElement;
  const m = renderer.getMetrics() as { width: number; height: number };
  const rect = canvas.getBoundingClientRect();
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: rect.left + (col + frac) * m.width,
    clientY: rect.top + (row + 0.5) * m.height,
    ...init,
  });
  (type === 'mousedown' ? canvas : document).dispatchEvent(event);
}

/**
 * Drag from one cell to another the way a pointer would when it means to
 * include both: upstream's half-cell rule includes the anchor cell only if the
 * press was on its near side, and the end cell only if the pointer passed its
 * midpoint.
 */
function drag(term: Terminal, from: [number, number], to: [number, number]): void {
  const forward = to[1] > from[1] || (to[1] === from[1] && to[0] >= from[0]);
  mouse(term, 'mousedown', from[0], from[1], {}, forward ? 0.25 : 0.75);
  mouse(term, 'mousemove', to[0], to[1], {}, forward ? 0.75 : 0.25);
  mouse(term, 'mouseup', to[0], to[1], {}, forward ? 0.75 : 0.25);
}

function clicks(term: Terminal, col: number, row: number, count: number): void {
  for (let i = 0; i < count; i++) {
    mouse(term, 'mousedown', col, row, { detail: i + 1 });
    mouse(term, 'mouseup', col, row, { detail: i + 1 });
  }
}

describe('SelectionManager', () => {
  let container: HTMLElement;
  const terminals: Terminal[] = [];

  async function open(options: Parameters<typeof createIsolatedTerminal>[0] = {}) {
    const term = await createIsolatedTerminal({ cols: 80, rows: 24, ...options });
    await term.open(container);
    terminals.push(term);
    // Copy-on-select must not reach the clipboard in tests.
    (manager(term) as any).copyToClipboard = () => {};
    return term;
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    for (const term of terminals.splice(0)) term.dispose();
    container.remove();
  });

  describe('programmatic selection', () => {
    test('starts without a selection', async () => {
      const term = await open();
      expect(manager(term).hasSelection()).toBe(false);
      expect(manager(term).getSelection()).toBe('');
      expect(manager(term).getSelectionCoords()).toBeNull();
    });

    test('selectAbsolute selects logical cells and reads back through the formatter', async () => {
      const term = await open();
      term.write('Hello World\r\n');
      const row = viewportToAbsolute(term, 0);
      manager(term).selectAbsolute(0, row, 4, row);
      expect(manager(term).hasSelection()).toBe(true);
      expect(manager(term).getSelection()).toBe('Hello');
      expect(manager(term).getSelectionColumnSpace()).toBe('logical');
    });

    test('a single-cell selection counts as a selection', async () => {
      const term = await open();
      term.write('Hello');
      manager(term).selectAbsolute(1, 0, 1, 0);
      expect(manager(term).hasSelection()).toBe(true);
      expect(manager(term).getSelection()).toBe('e');
    });

    test('multi-line text joins rows with newlines', async () => {
      const term = await open();
      term.write('Line 1\r\nLine 2\r\nLine 3\r\n');
      const row = viewportToAbsolute(term, 0);
      manager(term).selectAbsolute(0, row, 5, row + 2);
      expect(manager(term).getSelection()).toBe('Line 1\nLine 2\nLine 3');
    });

    test('backward selections read forward', async () => {
      const term = await open();
      term.write('Hello World\r\nLine 2\r\nLine 3');
      manager(term).selectAbsolute(10, 0, 0, 0);
      expect(manager(term).getSelection()).toBe('Hello World');
      manager(term).selectAbsolute(5, 2, 0, 0);
      expect(manager(term).getSelection()).toBe('Hello World\nLine 2\nLine 3');
    });

    test('select() uses viewport rows and logical columns, wrapping long lengths', async () => {
      const term = await open();
      term.write('Hello World\r\n');
      manager(term).select(0, 0, 5);
      expect(manager(term).getSelection()).toBe('Hello');
      expect(manager(term).getSelectionPosition()).toEqual({
        start: { x: 0, y: 0 },
        end: { x: 4, y: 0 },
      });
    });

    test('select() treats columns as logical buffer coordinates on a BiDi row', async () => {
      const term = await open();
      term.write('אבג'); // visual: ג ב א
      manager(term).select(0, 0, 1);
      expect(manager(term).getSelection()).toBe('א');
      expect(manager(term).getSelectionPosition()).toEqual({
        start: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
      });
      expect(manager(term).getSelectionColumnSpace()).toBe('logical');
    });

    test('selectLines() selects whole lines', async () => {
      const term = await open();
      term.write('Line 1\r\nLine 2\r\nLine 3\r\n');
      manager(term).selectLines(0, 1);
      expect(manager(term).getSelection()).toBe('Line 1\nLine 2');
    });

    test('selectAll() covers scrollback and screen', async () => {
      const term = await open({ cols: 20, rows: 3, scrollback: 50 });
      term.write('é-scroll\r\nRow2\r\nRow3\r\nRow4');
      term.selectAll();
      expect(term.getSelection()).toBe('é-scroll\nRow2\nRow3\nRow4');
      const coords = manager(term).getSelectionCoords()!;
      expect(coords.startRow).toBe(0); // clamped to the top of the viewport
      expect(coords.endRow).toBe(2);
    });

    test('clearSelection() marks the rows dirty and fires no change event', async () => {
      const term = await open();
      term.write('Line 1\r\nLine 2\r\nLine 3\r\n');
      const row = viewportToAbsolute(term, 0);
      manager(term).selectAbsolute(0, row, 5, row + 2);
      // Selecting marks the rows for repaint too; start from a clean slate.
      manager(term).clearDirtySelectionRows();
      manager(term).clearSelection();
      expect(manager(term).hasSelection()).toBe(false);
      expect([...manager(term).getDirtySelectionRows()].sort()).toEqual([0, 1, 2]);
      manager(term).clearDirtySelectionRows();
      expect(manager(term).getDirtySelectionRows().size).toBe(0);
    });
  });

  describe('selection follows content', () => {
    test('text and coordinates survive scrolling the viewport', async () => {
      const term = await open({ scrollback: 1000 });
      for (let i = 0; i < 50; i++) term.write(`Line ${i.toString().padStart(3, '0')}\r\n`);
      const base = term.wasmTerm!.getScrollbackLength();
      manager(term).selectAbsolute(0, base + 5, 10, base + 10);
      const before = manager(term).getSelectionCoords()!;
      const text = manager(term).getSelection();
      term.scrollLines(-10);
      expect(manager(term).getSelection()).toBe(text);
      const after = manager(term).getSelectionCoords()!;
      expect(after.startRow).toBe(before.startRow + 10);
      expect(after.endRow).toBe(before.endRow + 10);
    });

    test('a selection scrolled out of view has no coordinates but keeps its text', async () => {
      const term = await open({ scrollback: 1000 });
      for (let i = 0; i < 100; i++) term.write(`Line ${i.toString().padStart(3, '0')}\r\n`);
      const base = term.wasmTerm!.getScrollbackLength();
      manager(term).selectAbsolute(0, base + 10, 10, base + 15);
      const text = manager(term).getSelection();
      term.scrollToTop();
      expect(manager(term).getSelectionCoords()).toBeNull();
      expect(manager(term).getSelection()).toBe(text);
    });

    test('the terminal tracks the selection when new output scrolls the screen', async () => {
      const term = await open({ cols: 20, rows: 3, scrollback: 50 });
      term.write('first\r\nsecond\r\nthird');
      manager(term).selectAbsolute(0, 1, 5, 1);
      expect(manager(term).getSelection()).toBe('second');
      term.write('\r\nfourth\r\nfifth');
      // "second" is in scrollback now; the selection moved with it.
      expect(manager(term).getSelection()).toBe('second');
      expect(manager(term).getSelectionCoords()).toBeNull();
    });
  });

  describe('mouse gestures', () => {
    test('a plain click selects nothing', async () => {
      const term = await open();
      term.write('Hello World');
      clicks(term, 2, 0, 1);
      expect(manager(term).hasSelection()).toBe(false);
    });

    test('dragging selects the swept cells and fires onSelectionChange on release', async () => {
      const term = await open();
      term.write('Hello World');
      let changes = 0;
      term.onSelectionChange(() => changes++);
      drag(term, [0, 0], [4, 0]);
      expect(manager(term).getSelection()).toBe('Hello');
      expect(changes).toBe(1);
    });

    test('a click after a drag clears the selection', async () => {
      const term = await open();
      term.write('Hello World');
      drag(term, [0, 0], [4, 0]);
      expect(manager(term).hasSelection()).toBe(true);
      // Wait out the repeat interval so this does not count as a double click.
      await new Promise((r) => setTimeout(r, 600));
      clicks(term, 20, 5, 1);
      expect(manager(term).hasSelection()).toBe(false);
    });

    test('double click selects a word by upstream boundaries, triple click the line', async () => {
      const term = await open();
      term.write('foo bar:baz qux\r\n');
      clicks(term, 5, 0, 2);
      expect(manager(term).getSelection()).toBe('bar');
      await new Promise((r) => setTimeout(r, 600));
      clicks(term, 5, 0, 3);
      expect(manager(term).getSelection()).toBe('foo bar:baz qux');
    });

    test('double-click drag extends word by word', async () => {
      const term = await open();
      term.write('alpha beta gamma delta');
      mouse(term, 'mousedown', 1, 0, { detail: 1 });
      mouse(term, 'mouseup', 1, 0, { detail: 1 });
      mouse(term, 'mousedown', 1, 0, { detail: 2 });
      mouse(term, 'mousemove', 12, 0); // inside "gamma"
      mouse(term, 'mouseup', 12, 0);
      expect(manager(term).getSelection()).toBe('alpha beta gamma');
    });

    test('dragging upward reads forward', async () => {
      const term = await open();
      term.write('one\r\ntwo\r\nthree');
      drag(term, [2, 2], [0, 0]);
      expect(manager(term).getSelection()).toBe('one\ntwo\nthr');
    });
  });

  describe('BiDi', () => {
    test('full-row selection over Hebrew copies logical order', async () => {
      const term = await open();
      term.write('אבג');
      manager(term).selectAbsolute(0, 0, 2, 0);
      expect(manager(term).getSelection()).toBe('אבג');
    });

    test('a drag over a mixed-direction row selects the visually swept cells', async () => {
      const term = await open();
      term.write('ab אבג cd');
      // logical: a b ␠ א ב ג ␠ c d ; visual: a b ␠ ג ב א ␠ c d
      // visual cols 2..4 hold logical {2, 5, 4}; in logical order that is ' בג'.
      drag(term, [2, 0], [4, 0]);
      expect(manager(term).getSelectionColumnSpace()).toBe('visual');
      expect(manager(term).getSelection()).toBe(' בג');
      expect(manager(term).getSelectionCoords()).toMatchObject({ startCol: 2, endCol: 4 });
    });

    test('a partial drag over a pure RTL row maps to the right logical cells', async () => {
      const term = await open();
      term.write('אבג'); // visual: ג ב א
      drag(term, [0, 0], [1, 0]);
      expect(manager(term).getSelection()).toBe('בג');
    });

    test('a drag over plain rows stays logical even when a BiDi row exists elsewhere', async () => {
      const term = await open();
      term.write('אבג\r\nhello world');
      drag(term, [0, 1], [4, 1]);
      expect(manager(term).getSelectionColumnSpace()).toBe('logical');
      expect(manager(term).getSelection()).toBe('hello');
    });

    test('double-click word selection works on a Hebrew word', async () => {
      const term = await open();
      term.write('שלום עולם');
      // Visual cols 0..3 show the second word עולם (logical 5..8).
      clicks(term, 1, 0, 2);
      expect(manager(term).getSelection()).toBe('עולם');
      expect(manager(term).getSelectionColumnSpace()).toBe('logical');
    });

    test('double-click keeps a mixed-direction word as an exact logical range', async () => {
      const term = await open();
      term.write('א:אa');
      // The logical word אa occupies visual columns 3 and 0.
      clicks(term, 0, 0, 2);
      expect(manager(term).getSelection()).toBe('אa');
    });
  });

  describe('wide characters and wrapping', () => {
    test('wide CJK characters do not copy extra spaces for spacer cells', async () => {
      const term = await open({ cols: 20, rows: 5 });
      term.write('中文测试');
      term.select(0, 0, 8);
      expect(term.getSelection()).toBe('中文测试');
    });

    test('soft-wrapped lines join while hard-wrapped lines keep their newline', async () => {
      const term = await open({ cols: 10, rows: 3 });
      term.write('0123456789ABCDEF\r\nSecond');
      term.selectAll();
      expect(term.getSelection()).toBe('0123456789ABCDEF\nSecond');
    });
  });
});
