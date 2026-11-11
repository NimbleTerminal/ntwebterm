/**
 * Application callbacks that answer from inside ghostty_terminal_vt_write()
 * (clipboard policy and read, color scheme, render hold) must not be able to
 * re-enter the terminal or unwind through it.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { Ghostty, type GhosttyTerminal } from './ghostty';

const OSC52_WRITE = '\x1b]52;c;SGVsbG8=\x07';

function lineText(term: GhosttyTerminal, y: number): string {
  return (term.getLine(y) ?? [])
    .map((cell) => (cell.codepoint ? String.fromCodePoint(cell.codepoint) : ' '))
    .join('')
    .trimEnd();
}

describe('calls made from inside a terminal callback', () => {
  let ghostty: Ghostty;
  let term: GhosttyTerminal;

  beforeEach(async () => {
    ghostty = await Ghostty.load(new URL('../ghostty-vt.wasm', import.meta.url).pathname);
    term = ghostty.createTerminal(20, 4);
  });
  afterEach(() => term.free());

  test('write() is queued until the current write returns', () => {
    term.setClipboardWritePolicy(() => {
      term.write('B');
      return 'success';
    });
    const copied: (string | null)[] = [];
    term.setClipboardWriteHandler((event) => copied.push(event.text));
    term.write(`A${OSC52_WRITE}C`);
    term.update();
    // 'B' lands after the chunk that was being parsed, not inside the OSC.
    expect(lineText(term, 0)).toBe('ACB');
    expect(copied).toEqual(['Hello']);
  });

  test('a queued write keeps its own copy of the bytes', () => {
    const bytes = new TextEncoder().encode('xy');
    term.setClipboardWritePolicy(() => {
      term.write(bytes);
      bytes.fill(0x21);
      return 'denied';
    });
    term.write(OSC52_WRITE);
    term.update();
    expect(lineText(term, 0)).toBe('xy');
  });

  test('resize() and reset() are applied after the write', () => {
    term.setClipboardWritePolicy(() => {
      term.resize(30, 6);
      expect(term.cols).toBe(20);
      return 'denied';
    });
    term.write(`A${OSC52_WRITE}C`);
    expect(term.cols).toBe(30);
    expect(term.rows).toBe(6);

    term.setClipboardWritePolicy(() => {
      term.reset();
      return 'denied';
    });
    term.write(`${OSC52_WRITE}tail`);
    term.update();
    expect(lineText(term, 0)).toBe('');
  });

  test('free() waits for the write and later calls are ignored', () => {
    const other = ghostty.createTerminal(20, 4);
    other.setClipboardWritePolicy(() => {
      other.free();
      other.write('queued after free');
      return 'success';
    });
    let copies = 0;
    other.setClipboardWriteHandler(() => copies++);
    expect(() => other.write(`A${OSC52_WRITE}C`)).not.toThrow();
    expect(copies).toBe(0);
    expect(() => other.write('ignored')).not.toThrow();
    expect(() => other.free()).not.toThrow();
  });

  test('a throwing policy denies the write and does not unwind the parser', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {});
    try {
      term.setClipboardWritePolicy(() => {
        throw new Error('boom');
      });
      let copies = 0;
      term.setClipboardWriteHandler(() => copies++);
      expect(() => term.write(`A${OSC52_WRITE}C`)).not.toThrow();
      term.update();
      expect(lineText(term, 0)).toBe('AC');
      expect(copies).toBe(0);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      error.mockRestore();
    }
  });

  test('a throwing read handler and color scheme provider answer as if absent', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {});
    try {
      term.setClipboardReadHandler(() => {
        throw new Error('boom');
      });
      term.setColorSchemeProvider(() => {
        throw new Error('boom');
      });
      expect(() => term.write('\x1b]52;c;?\x07\x1b[?996nok')).not.toThrow();
      term.update();
      expect(lineText(term, 0)).toBe('ok');
      expect(error).toHaveBeenCalledTimes(2);
    } finally {
      error.mockRestore();
    }
  });

  test('paste() refuses to run from inside a callback', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {});
    try {
      term.setClipboardWritePolicy(() => {
        term.paste('nope');
        return 'success';
      });
      term.write(`${OSC52_WRITE}C`);
      term.update();
      expect(lineText(term, 0)).toBe('C');
      expect(String(error.mock.calls[0]?.[1])).toContain('paste() cannot be called');
    } finally {
      error.mockRestore();
    }
  });
});
