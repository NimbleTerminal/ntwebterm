/**
 * Mouse reports come from libghostty-vt's mouse encoder: tracking mode and
 * output format are read from the terminal, motion is deduplicated per cell,
 * and every format (X10, UTF-8, SGR, urxvt, SGR-pixels) is upstream's.
 * TypeScript only normalizes the DOM event into a cell, a button and mods.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { Ghostty, type GhosttyTerminal } from './ghostty';
import { Mods, MouseAction, MouseButton, type MouseReport } from './types';

const terminals: GhosttyTerminal[] = [];
afterEach(() => {
  for (const t of terminals.splice(0)) t.free();
});

async function terminal(modes: string, cols = 80, rows = 24): Promise<GhosttyTerminal> {
  const ghostty = await Ghostty.load();
  const term = ghostty.createTerminal(cols, rows);
  terminals.push(term);
  term.setCellPixelSize(10, 20);
  term.write(modes);
  return term;
}

const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);

function report(overrides: Partial<MouseReport> = {}): MouseReport {
  return {
    action: MouseAction.PRESS,
    button: MouseButton.LEFT,
    mods: Mods.NONE,
    col: 1,
    row: 1,
    anyButtonPressed: false,
    ...overrides,
  };
}

describe('GhosttyTerminal.encodeMouse()', () => {
  test('produces nothing when no mouse tracking mode is on', async () => {
    const term = await terminal('');
    expect(term.encodeMouse(report()).length).toBe(0);
  });

  test('SGR press and release keep the button identity and use 1-based cells', async () => {
    const term = await terminal('\x1b[?1000h\x1b[?1006h');
    expect(text(term.encodeMouse(report()))).toBe('\x1b[<0;2;2M');
    expect(text(term.encodeMouse(report({ action: MouseAction.RELEASE })))).toBe('\x1b[<0;2;2m');
    expect(text(term.encodeMouse(report({ button: MouseButton.RIGHT, col: 9, row: 3 })))).toBe(
      '\x1b[<2;10;4M'
    );
  });

  test('legacy X10 format encodes release as button 3 and ignores motion', async () => {
    const term = await terminal('\x1b[?1000h');
    expect(text(term.encodeMouse(report({ col: 0, row: 0 })))).toBe('\x1b[M !!');
    expect(text(term.encodeMouse(report({ action: MouseAction.RELEASE, col: 0, row: 0 })))).toBe(
      '\x1b[M#!!'
    );
    expect(term.encodeMouse(report({ action: MouseAction.MOTION })).length).toBe(0);
  });

  test('modifiers add 4 (shift), 8 (alt) and 16 (ctrl) outside X10 mode', async () => {
    const term = await terminal('\x1b[?1000h\x1b[?1006h');
    expect(text(term.encodeMouse(report({ mods: Mods.SHIFT })))).toBe('\x1b[<4;2;2M');
    expect(text(term.encodeMouse(report({ mods: Mods.ALT })))).toBe('\x1b[<8;2;2M');
    expect(text(term.encodeMouse(report({ mods: Mods.CTRL })))).toBe('\x1b[<16;2;2M');
  });

  test('wheel buttons map to 64..67', async () => {
    const term = await terminal('\x1b[?1000h\x1b[?1006h');
    expect(text(term.encodeMouse(report({ button: MouseButton.FOUR, col: 0, row: 0 })))).toBe(
      '\x1b[<64;1;1M'
    );
    expect(text(term.encodeMouse(report({ button: MouseButton.FIVE, col: 0, row: 0 })))).toBe(
      '\x1b[<65;1;1M'
    );
    expect(text(term.encodeMouse(report({ button: MouseButton.SEVEN, col: 0, row: 0 })))).toBe(
      '\x1b[<67;1;1M'
    );
  });

  test('any-event tracking reports hover motion as button 35 and dedups the same cell', async () => {
    const term = await terminal('\x1b[?1003h\x1b[?1006h');
    const hover = (col: number, row: number) =>
      text(term.encodeMouse(report({ action: MouseAction.MOTION, button: null, col, row })));
    expect(hover(1, 1)).toBe('\x1b[<35;2;2M');
    expect(hover(1, 1)).toBe('');
    expect(hover(2, 1)).toBe('\x1b[<35;3;2M');
  });

  test('button-event tracking reports motion only while a button is held', async () => {
    const term = await terminal('\x1b[?1002h\x1b[?1006h');
    const motion = (button: MouseButton | null, anyButtonPressed: boolean) =>
      text(term.encodeMouse(report({ action: MouseAction.MOTION, button, anyButtonPressed })));
    expect(motion(null, false)).toBe('');
    expect(motion(MouseButton.LEFT, true)).toBe('\x1b[<32;2;2M');
  });

  test('normal tracking never reports motion', async () => {
    const term = await terminal('\x1b[?1000h\x1b[?1006h');
    expect(
      term.encodeMouse(
        report({ action: MouseAction.MOTION, button: MouseButton.LEFT, anyButtonPressed: true })
      ).length
    ).toBe(0);
  });

  test('follows mode changes made by the program between reports', async () => {
    const term = await terminal('\x1b[?1003h\x1b[?1006h');
    const hover = (col: number) =>
      text(term.encodeMouse(report({ action: MouseAction.MOTION, button: null, col, row: 0 })));
    expect(hover(0)).toBe('\x1b[<35;1;1M');
    term.write('\x1b[?1006l'); // back to X10 bytes
    expect(hover(1)).toBe('\x1b[M' + String.fromCharCode(32 + 35, 34, 33));
    term.write('\x1b[?1003l'); // tracking off
    expect(hover(2)).toBe('');
  });

  test('UTF-8 (1005) and urxvt (1015) formats are available', async () => {
    const utf8 = await terminal('\x1b[?1000h\x1b[?1005h', 300, 24);
    // Column 200 is beyond X10's byte range; UTF-8 mode encodes 32 + 201 as a codepoint.
    const bytes = utf8.encodeMouse(report({ col: 200, row: 0 }));
    expect(new TextDecoder().decode(bytes)).toBe(`\x1b[M ${String.fromCodePoint(32 + 201)}!`);

    const urxvt = await terminal('\x1b[?1000h\x1b[?1015h');
    expect(text(urxvt.encodeMouse(report({ col: 4, row: 2 })))).toBe('\x1b[32;5;3M');
  });

  test('SGR-pixels (1016) reports pixel coordinates from the cell and the in-cell offset', async () => {
    const term = await terminal('\x1b[?1000h\x1b[?1016h');
    // Cell (1, 1) in 10x20 cells, pointer 3px right and 7px down inside it.
    expect(text(term.encodeMouse(report({ xInCell: 3, yInCell: 7 })))).toBe('\x1b[<0;13;27M');
    // Without an offset the cell centre is used.
    expect(text(term.encodeMouse(report({ col: 0, row: 0 })))).toBe('\x1b[<0;5;10M');
  });

  test('grows the output buffer when upstream reports GHOSTTY_OUT_OF_SPACE', async () => {
    const term = await terminal('\x1b[?1000h\x1b[?1006h');
    expect(text(term.encodeMouse(report()))).toBe('\x1b[<0;2;2M');
    // Shrink the (lazily created) encoder's buffer below the 9-byte report so
    // the first encode comes back OUT_OF_SPACE and the buffer must grow.
    const encoder = (term as unknown as { mouseEncoder: { bufLen: number } }).mouseEncoder;
    encoder.bufLen = 4;
    expect(text(term.encodeMouse(report({ action: MouseAction.RELEASE })))).toBe('\x1b[<0;2;2m');
    expect(encoder.bufLen).toBeGreaterThanOrEqual(9);
    // The grown size sticks, and a second report needs no retry.
    expect(text(term.encodeMouse(report({ col: 9, row: 3 })))).toBe('\x1b[<0;10;4M');
  });

  test('tracks resizes of the cell grid', async () => {
    const term = await terminal('\x1b[?1000h\x1b[?1006h');
    expect(text(term.encodeMouse(report({ col: 79, row: 23 })))).toBe('\x1b[<0;80;24M');
    term.resize(40, 12);
    expect(text(term.encodeMouse(report({ col: 39, row: 11 })))).toBe('\x1b[<0;40;12M');
    // A press outside the (now smaller) viewport is dropped by upstream.
    expect(text(term.encodeMouse(report({ col: 79, row: 23 })))).toBe('');
  });
});
