/**
 * Selection primitives from libghostty-vt: grid references, the terminal-owned
 * tracked selection, word/line/all/output selection rules, ordering, and text
 * extraction through the formatter. The selection manager builds on these.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { Ghostty, type GhosttyTerminal } from './ghostty';
import { PointTag, SelectionOrder } from './types';

const terminals: GhosttyTerminal[] = [];
afterEach(() => {
  for (const t of terminals.splice(0)) t.free();
});

async function terminal(cols = 40, rows = 5, content = 'hello world\r\nsecond line') {
  const ghostty = await Ghostty.load();
  const term = ghostty.createTerminal(cols, rows);
  terminals.push(term);
  term.write(content);
  return term;
}

describe('grid references', () => {
  test('round-trip through every coordinate space', async () => {
    const term = await terminal();
    const ref = term.gridRef(PointTag.VIEWPORT, 6, 1)!;
    expect(ref).toBeTruthy();
    expect(term.pointFromGridRef(ref, PointTag.VIEWPORT)).toEqual({ x: 6, y: 1 });
    expect(term.pointFromGridRef(ref, PointTag.ACTIVE)).toEqual({ x: 6, y: 1 });
    expect(term.pointFromGridRef(ref, PointTag.SCREEN)).toEqual({ x: 6, y: 1 });
  });

  test('a cell that scrolled into history is not in the viewport or active area', async () => {
    const term = await terminal(40, 3);
    const ref = term.gridRef(PointTag.ACTIVE, 0, 0)!;
    term.write('\r\n\r\n\r\n\r\n'); // push "hello world" into scrollback
    expect(term.getScrollbackLength()).toBeGreaterThan(0);
    expect(term.pointFromGridRef(ref, PointTag.VIEWPORT)).toBeNull();
    expect(term.pointFromGridRef(ref, PointTag.ACTIVE)).toBeNull();
    expect(term.pointFromGridRef(ref, PointTag.HISTORY)).toEqual({ x: 0, y: 0 });
  });

  test('out-of-range points have no reference', async () => {
    const term = await terminal();
    expect(term.gridRef(PointTag.ACTIVE, 0, 99)).toBeNull();
  });
});

describe('terminal-owned selection', () => {
  test('starts empty, round-trips, and clears', async () => {
    const term = await terminal();
    expect(term.getSelection()).toBeNull();
    const sel = {
      start: term.gridRef(PointTag.ACTIVE, 0, 0)!,
      end: term.gridRef(PointTag.ACTIVE, 4, 0)!,
      rectangle: false,
    };
    term.setSelection(sel);
    const back = term.getSelection()!;
    expect(term.pointFromGridRef(back.start, PointTag.ACTIVE)).toEqual({ x: 0, y: 0 });
    expect(term.pointFromGridRef(back.end, PointTag.ACTIVE)).toEqual({ x: 4, y: 0 });
    expect(back.rectangle).toBe(false);
    term.setSelection(null);
    expect(term.getSelection()).toBeNull();
  });

  test('follows its content into scrollback', async () => {
    const term = await terminal(40, 3);
    term.setSelection({
      start: term.gridRef(PointTag.ACTIVE, 0, 0)!,
      end: term.gridRef(PointTag.ACTIVE, 4, 0)!,
      rectangle: false,
    });
    term.write('\r\n\r\n\r\n\r\nmore');
    const sel = term.getSelection()!;
    expect(term.pointFromGridRef(sel.start, PointTag.HISTORY)).toEqual({ x: 0, y: 0 });
    expect(term.formatSelection(sel)).toBe('hello');
  });

  test('render state reports the selected range of each viewport row', async () => {
    const term = await terminal();
    term.setSelection({
      start: term.gridRef(PointTag.ACTIVE, 6, 0)!,
      end: term.gridRef(PointTag.ACTIVE, 5, 1)!,
      rectangle: false,
    });
    term.update();
    expect(term.getRowSelection(0)).toEqual({ startCol: 6, endCol: 39 });
    expect(term.getRowSelection(1)).toEqual({ startCol: 0, endCol: 5 });
    expect(term.getRowSelection(2)).toBeNull();
  });

  test('changing the selection dirties the affected rows', async () => {
    const term = await terminal();
    term.update();
    term.markClean();
    term.setSelection({
      start: term.gridRef(PointTag.ACTIVE, 0, 1)!,
      end: term.gridRef(PointTag.ACTIVE, 5, 1)!,
      rectangle: false,
    });
    term.update();
    expect(term.isRowDirty(1)).toBe(true);
  });
});

describe('selection rules', () => {
  test('selectWord uses upstream word boundaries', async () => {
    const term = await terminal();
    const sel = term.selectWord(term.gridRef(PointTag.ACTIVE, 7, 0)!)!;
    expect(term.formatSelection(sel)).toBe('world');
    expect(term.selectWord(term.gridRef(PointTag.ACTIVE, 30, 0)!)).toBeNull(); // blank
  });

  test('selectWordBetween finds the nearest word toward the end', async () => {
    const term = await terminal();
    // From the blank area past the text back toward the start: "world" comes first.
    const sel = term.selectWordBetween(
      term.gridRef(PointTag.ACTIVE, 30, 0)!,
      term.gridRef(PointTag.ACTIVE, 0, 0)!
    )!;
    expect(term.formatSelection(sel)).toBe('world');
    // A run of whitespace is a word of its own in Ghostty's rules.
    const space = term.selectWordBetween(
      term.gridRef(PointTag.ACTIVE, 5, 0)!,
      term.gridRef(PointTag.ACTIVE, 39, 0)!
    )!;
    expect(term.formatSelection(space, { trim: false })).toBe(' ');
  });

  test('selectLine trims and selectAll covers everything', async () => {
    const term = await terminal();
    expect(term.formatSelection(term.selectLine(term.gridRef(PointTag.ACTIVE, 20, 1)!)!)).toBe(
      'second line'
    );
    expect(term.formatSelection(term.selectAll()!)).toBe('hello world\nsecond line');
  });

  test('selectOutput needs OSC 133 markers', async () => {
    const term = await terminal();
    expect(term.selectOutput(term.gridRef(PointTag.ACTIVE, 0, 0)!)).toBeNull();
    const marked = await terminal(
      40,
      5,
      '\x1b]133;A\x07$ ls\r\n\x1b]133;C\x07a.txt\r\nb.txt\r\n\x1b]133;D\x07'
    );
    const out = marked.selectOutput(marked.gridRef(PointTag.ACTIVE, 0, 1)!)!;
    expect(marked.formatSelection(out)).toBe('a.txt\nb.txt');
  });

  test('ordering and containment', async () => {
    const term = await terminal();
    const backward = {
      start: term.gridRef(PointTag.ACTIVE, 5, 1)!,
      end: term.gridRef(PointTag.ACTIVE, 6, 0)!,
      rectangle: false,
    };
    expect(term.selectionOrder(backward)).toBe(SelectionOrder.REVERSE);
    const forward = term.selectionOrdered(backward);
    expect(term.pointFromGridRef(forward.start, PointTag.ACTIVE)).toEqual({ x: 6, y: 0 });
    expect(term.pointFromGridRef(forward.end, PointTag.ACTIVE)).toEqual({ x: 5, y: 1 });
    expect(term.selectionContains(backward, PointTag.ACTIVE, 20, 0)).toBe(true);
    expect(term.selectionContains(backward, PointTag.ACTIVE, 2, 0)).toBe(false);
    expect(term.formatSelection(backward)).toBe('world\nsecond');
  });
});

describe('formatSelection', () => {
  test('unwraps soft-wrapped rows and keeps hard newlines', async () => {
    const term = await terminal(10, 5, 'abcdefghijklmno\r\nxyz');
    const all = term.selectAll()!;
    expect(term.formatSelection(all)).toBe('abcdefghijklmno\nxyz');
    expect(term.formatSelection(all, { unwrap: false })).toBe('abcdefghij\nklmno\nxyz');
  });

  test('skips wide-character spacers and keeps grapheme clusters', async () => {
    const term = await terminal(40, 5, '漢字 é');
    expect(term.formatSelection(term.selectAll()!)).toBe('漢字 é');
  });
});
