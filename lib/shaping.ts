/**
 * Multi-cell contextual text shaping (shaped runs + visual cell slicing).
 *
 * A terminal grid stores text one grapheme cluster per cell. Rasterizing each
 * cell in isolation prevents the browser's text shaper (HarfBuzz) from seeing
 * neighboring characters, breaking cursive joining (`init`/`medi`/`fina`) and
 * cross-cell contextual ligatures (`rlig`/`calt`/`liga`, e.g. lam-alef `لا`).
 *
 * This module segments a row into contiguous `ShapedRun`s of 1-width cells
 * that share a cursive-joining script, compatible font styles (`BOLD`/`ITALIC`),
 * and monotonic visual adjacency (`logicalToVisual` stepping by ±1). Each run
 * is rasterized once as a whole string fitted to its N-cell span, and each
 * logical cell samples its 1-cell horizontal visual slice (`0 .. length - 1`),
 * preserving per-cell color, selection, cursor, underline, and hit-testing.
 */
import type { RowBidiMap } from './bidi';
import type { GhosttyCell } from './types';
import { CellFlags } from './types';

export type ShapingScript = 'arabic' | 'syriac' | 'nko' | 'mandaic' | 'rohingya' | 'adlam';

export interface ShapedRun {
  start: number;
  end: number;
  length: number;
  text: string;
  styleBits: number;
  visualStart: number;
}

export interface ShapedRunCell {
  run: ShapedRun;
  slice: number;
}

export interface ShapedRunLayout {
  runs: ShapedRun[];
  cells: Map<number, ShapedRunCell>;
}

function isArabicJoiningCodepoint(cp: number): boolean {
  if (cp >= 0x0600 && cp <= 0x06ff) {
    // Exclude non-joining number/footnote signs, punctuation (، ؛ ؟ ٪ ۔),
    // end-of-ayah markers, and decimal digits (٠-٩ 0660-0669, ۰-۹ 06F0-06F9).
    if (cp <= 0x060d) return false;
    if (cp === 0x061b || cp === 0x061e || cp === 0x061f) return false;
    if (cp >= 0x0660 && cp <= 0x066d) return false;
    if (cp === 0x06d4 || cp === 0x06dd || cp === 0x06de || cp === 0x06e9) return false;
    if (cp >= 0x06f0 && cp <= 0x06f9) return false;
    return true;
  }
  if (cp >= 0x0750 && cp <= 0x077f) return true;
  if (cp >= 0x0870 && cp <= 0x08ff) return cp !== 0x08e2;
  if (cp >= 0xfb50 && cp <= 0xfdff) {
    if (cp === 0xfd3e || cp === 0xfd3f) return false;
    if (cp >= 0xfdd0 && cp <= 0xfdef) return false;
    return true;
  }
  if (cp >= 0xfe70 && cp <= 0xfefe) return true;
  if (cp >= 0x10ec0 && cp <= 0x10eff) return true;
  if (cp >= 0x1ee00 && cp <= 0x1eeff) return true;
  return false;
}

export function getShapingScript(cp: number): ShapingScript | null {
  if (cp < 0x0600) return null;
  if (isArabicJoiningCodepoint(cp)) return 'arabic';
  if ((cp >= 0x0710 && cp <= 0x074f) || (cp >= 0x0860 && cp <= 0x086f)) return 'syriac';
  if ((cp >= 0x07ca && cp <= 0x07f5) || cp === 0x07fa) return 'nko';
  if (cp >= 0x0840 && cp <= 0x085b) return 'mandaic';
  if (cp >= 0x10d00 && cp <= 0x10d27) return 'rohingya';
  if (cp >= 0x1e900 && cp <= 0x1e94b) return 'adlam';
  return null;
}

export function isShapableCodepoint(cp: number): boolean {
  return getShapingScript(cp) !== null;
}

function cellText(cell: GhosttyCell): string {
  return cell.grapheme?.length
    ? String.fromCodePoint(cell.codepoint, ...cell.grapheme)
    : String.fromCodePoint(cell.codepoint);
}

export function createShapedRunLayout(line: GhosttyCell[], map: RowBidiMap): ShapedRunLayout {
  const runs: ShapedRun[] = [];
  const cells = new Map<number, ShapedRunCell>();
  let start = -1;
  let styleBits = 0;
  let script: ShapingScript | null = null;
  let visualStep = 0;

  const finish = (end: number): void => {
    if (start >= 0 && end - start >= 2) {
      const visualStart = Math.min(map.logicalToVisual[start]!, map.logicalToVisual[end - 1]!);
      const run: ShapedRun = {
        start,
        end,
        length: end - start,
        text: line.slice(start, end).map(cellText).join(''),
        styleBits,
        visualStart,
      };
      runs.push(run);
      for (let i = start; i < end; i++) {
        cells.set(i, { run, slice: map.logicalToVisual[i]! - visualStart });
      }
    }
    start = -1;
    script = null;
    visualStep = 0;
  };

  for (let i = 0; i < line.length; i++) {
    const cell = line[i]!;
    const nextScript = cell.width === 1 ? getShapingScript(cell.codepoint) : null;
    if (!nextScript) {
      finish(i);
      continue;
    }
    const nextStyle =
      (cell.flags & CellFlags.BOLD ? 1 : 0) | (cell.flags & CellFlags.ITALIC ? 2 : 0);
    if (start < 0) {
      start = i;
      styleBits = nextStyle;
      script = nextScript;
      visualStep = 0;
      continue;
    }
    const step = map.logicalToVisual[i]! - map.logicalToVisual[i - 1]!;
    const contiguous = (step === 1 || step === -1) && (visualStep === 0 || step === visualStep);
    if (nextScript !== script || nextStyle !== styleBits || !contiguous) {
      finish(i);
      start = i;
      styleBits = nextStyle;
      script = nextScript;
      visualStep = 0;
    } else {
      visualStep = step;
    }
  }
  finish(line.length);
  return { runs, cells };
}

export function rasterizeShapedRun(
  ctx: CanvasRenderingContext2D,
  run: ShapedRun,
  fontSize: number,
  fontFamily: string,
  baseline: number,
  cssWidth: number
): void {
  let style = '';
  if (run.styleBits & 1) style += 'bold ';
  if (run.styleBits & 2) style += 'italic ';
  ctx.font = `${style}${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.direction = 'ltr';
  ctx.fillStyle = '#ffffff';
  const naturalWidth = ctx.measureText(run.text).width;
  if (naturalWidth > 0) ctx.scale(cssWidth / naturalWidth, 1);
  ctx.fillText(run.text, 0, baseline);
}
