import { describe, expect, test } from 'bun:test';
import { RowBidiMapper } from './bidi';
import {
  createShapedRunLayout,
  getShapingScript,
  isShapableCodepoint,
  rasterizeShapedRun,
} from './shaping';
import type { GhosttyCell } from './types';
import { CellFlags } from './types';

function cell(cp: number, overrides: Partial<GhosttyCell> = {}): GhosttyCell {
  return {
    codepoint: cp,
    fg_r: 0,
    fg_g: 0,
    fg_b: 0,
    bg_r: 0,
    bg_g: 0,
    bg_b: 0,
    fgIsDefault: true,
    bgIsDefault: true,
    flags: 0,
    width: 1,
    hyperlink_id: 0,
    grapheme_len: 0,
    grapheme: null,
    ...overrides,
  };
}

function cells(text: string): GhosttyCell[] {
  return Array.from(text, (char) => cell(char.codePointAt(0)!));
}

describe('Shaped run layout', () => {
  test('recognizes cursive joining scripts while excluding non-joining scripts, digits, and punctuation', () => {
    expect(getShapingScript('م'.codePointAt(0)!)).toBe('arabic');
    expect(getShapingScript('ࢠ'.codePointAt(0)!)).toBe('arabic');
    expect(getShapingScript('ﷺ'.codePointAt(0)!)).toBe('arabic');
    expect(getShapingScript('ܐ'.codePointAt(0)!)).toBe('syriac');
    expect(getShapingScript('ߊ'.codePointAt(0)!)).toBe('nko');
    expect(getShapingScript('𞤀'.codePointAt(0)!)).toBe('adlam');

    // Non-joining RTL or CJK scripts
    expect(isShapableCodepoint('ש'.codePointAt(0)!)).toBe(false);
    expect(isShapableCodepoint('漢'.codePointAt(0)!)).toBe(false);

    // Non-joining Arabic digits and punctuation
    expect(isShapableCodepoint('١'.codePointAt(0)!)).toBe(false);
    expect(isShapableCodepoint('۱'.codePointAt(0)!)).toBe(false);
    expect(isShapableCodepoint('،'.codePointAt(0)!)).toBe(false);
    expect(isShapableCodepoint('؟'.codePointAt(0)!)).toBe(false);
  });

  test('keeps a whole word together and maps logical cells to visual slices', () => {
    const line = cells('abc مرحبا xyz');
    const map = new RowBidiMapper().getMap(line);
    const layout = createShapedRunLayout(line, map);
    expect(layout.runs).toHaveLength(1);
    const run = layout.runs[0]!;
    expect(run).toMatchObject({ start: 4, end: 9, length: 5, text: 'مرحبا', visualStart: 4 });
    expect(layout.cells.get(4)?.slice).toBe(4);
    expect(layout.cells.get(8)?.slice).toBe(0);
  });

  test('separates words and does not shape an isolated character', () => {
    const line = cells('سلام م ع');
    const map = new RowBidiMapper().getMap(line);
    const layout = createShapedRunLayout(line, map);
    expect(layout.runs.map(({ text }) => text)).toEqual(['سلام']);
    expect(layout.cells.has(5)).toBe(false);
  });

  test('does not fuse Arabic digits or punctuation into a shaped word run', () => {
    const line = cells('مرحبا١٢٣،');
    const map = new RowBidiMapper().getMap(line);
    const layout = createShapedRunLayout(line, map);
    expect(
      layout.runs.map(({ text, start, end, visualStart }) => ({
        text,
        start,
        end,
        visualStart,
      }))
    ).toEqual([{ text: 'مرحبا', start: 0, end: 5, visualStart: 3 }]);
    expect([0, 1, 2, 3, 4].map((i) => layout.cells.get(i)?.slice)).toEqual([4, 3, 2, 1, 0]);
    expect(layout.cells.has(5)).toBe(false);
    expect(layout.cells.has(8)).toBe(false);
  });

  test('splits adjacent runs of different cursive scripts', () => {
    const line = cells('سلامܐܒ');
    const map = new RowBidiMapper().getMap(line);
    const layout = createShapedRunLayout(line, map);
    expect(layout.runs.map(({ text }) => text)).toEqual(['سلام', 'ܐܒ']);
  });

  test('includes combining marks in the shaped run text', () => {
    const line = cells('با');
    line[0] = cell('ب'.codePointAt(0)!, { grapheme_len: 1, grapheme: [0x064e] });
    const map = new RowBidiMapper().getMap(line);
    expect(createShapedRunLayout(line, map).runs[0]?.text).toBe('بَا');
  });

  test('splits runs at bold and italic style changes', () => {
    const line = cells('ابجد');
    line[2] = cell(line[2]!.codepoint, { flags: CellFlags.BOLD });
    line[3] = cell(line[3]!.codepoint, { flags: CellFlags.BOLD });
    const map = new RowBidiMapper().getMap(line);
    const layout = createShapedRunLayout(line, map);
    expect(layout.runs.map(({ text, styleBits }) => ({ text, styleBits }))).toEqual([
      { text: 'اب', styleBits: 0 },
      { text: 'جد', styleBits: 1 },
    ]);
  });
});

describe('Shaped run rasterization', () => {
  test('draws the whole logical string and fits it to the cell span', () => {
    const calls: { scale?: number[]; text?: string } = {};
    const ctx = {
      font: '',
      textBaseline: '',
      textAlign: '',
      direction: '',
      fillStyle: '',
      measureText: () => ({ width: 50 }),
      scale: (x: number, y: number) => {
        calls.scale = [x, y];
      },
      fillText: (text: string) => {
        calls.text = text;
      },
    } as unknown as CanvasRenderingContext2D;
    const line = cells('مرحبا');
    const map = new RowBidiMapper().getMap(line);
    const run = createShapedRunLayout(line, map).runs[0]!;
    rasterizeShapedRun(ctx, run, 16, 'monospace', 14, 100);
    expect(calls).toEqual({ scale: [2, 1], text: 'مرحبا' });
    expect(ctx.direction).toBe('ltr');
    expect(ctx.textAlign).toBe('left');
  });
});
