/**
 * Paste goes through libghostty-vt's ghostty_terminal_paste(): mode 2004
 * framing, unsafe-byte replacement, the unsafe-paste rule and Kitty paste
 * events (mode 5522) all come from upstream. TypeScript only supplies the
 * text and the policy for unsafe pastes.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { Ghostty, type GhosttyTerminal } from './ghostty';
import { InputHandler } from './input-handler';
import { createIsolatedTerminal } from './test-helpers';

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

async function wasmTerminal(): Promise<GhosttyTerminal> {
  const ghostty = await Ghostty.load();
  const term = ghostty.createTerminal(40, 10);
  cleanup.push(() => term.free());
  return term;
}

async function openTerminal(options: Parameters<typeof createIsolatedTerminal>[0] = {}) {
  const term = await createIsolatedTerminal({ cols: 40, rows: 10, ...options });
  await term.open(document.createElement('div'));
  cleanup.push(() => term.dispose());
  const data: string[] = [];
  term.onData((d) => data.push(d));
  return { term, data };
}

describe('GhosttyTerminal.paste()', () => {
  test('writes plain text to the PTY when bracketed paste is off', async () => {
    const term = await wasmTerminal();
    expect(term.paste('hello')).toBe('pasted');
    expect(term.readResponse()).toBe('hello');
  });

  test('frames the text with CSI 200~ / 201~ when mode 2004 is on', async () => {
    const term = await wasmTerminal();
    term.write('\x1b[?2004h');
    expect(term.paste('hello')).toBe('pasted');
    expect(term.readResponse()).toBe('\x1b[200~hello\x1b[201~');
  });

  test('reports an empty paste without writing anything', async () => {
    const term = await wasmTerminal();
    expect(term.paste('')).toBe('empty');
    expect(term.readResponse()).toBeNull();
  });

  test('rejects an unbracketed multi-line paste unless unsafe pastes are allowed', async () => {
    const term = await wasmTerminal();
    expect(term.paste('ls\nrm -rf /\n', { allowUnsafe: false })).toBe('rejected');
    expect(term.readResponse()).toBeNull();
    expect(term.paste('ls\nrm -rf /\n', { allowUnsafe: true })).toBe('pasted');
    expect(term.readResponse()).toBe('ls\rrm -rf /\r');
  });

  test('replaces control bytes with spaces instead of forwarding them', async () => {
    const term = await wasmTerminal();
    term.write('\x1b[?2004h');
    expect(term.paste('hel\x1blo\x00world')).toBe('pasted');
    expect(term.readResponse()).toBe('\x1b[200~hel lo world\x1b[201~');
  });

  test('a bracketed paste containing the end marker is unsafe', async () => {
    const term = await wasmTerminal();
    term.write('\x1b[?2004h');
    expect(term.paste('safe\x1b[201~evil', { allowUnsafe: false })).toBe('rejected');
    expect(term.paste('safe\x1b[201~evil', { allowUnsafe: true })).toBe('pasted');
    expect(term.readResponse()).toBe('\x1b[200~safe [201~evil\x1b[201~');
  });
});

describe('Terminal.paste()', () => {
  test('pastes multi-line text by default, converting newlines like xterm.js', async () => {
    const { term, data } = await openTerminal();
    term.paste('one\ntwo');
    expect(data).toEqual(['one\rtwo']);
  });

  test('allowUnsafePaste: false drops pastes that could inject commands', async () => {
    const { term, data } = await openTerminal({ allowUnsafePaste: false });
    term.paste('one\ntwo');
    expect(data).toEqual([]);
    term.paste('safe');
    expect(data).toEqual(['safe']);
  });

  test('allowUnsafePaste may be a confirmation callback that sees the text', async () => {
    const asked: string[] = [];
    let answer = false;
    const { term, data } = await openTerminal({
      allowUnsafePaste: (text) => {
        asked.push(text);
        return answer;
      },
    });
    term.paste('one\ntwo');
    expect(asked).toEqual(['one\ntwo']);
    expect(data).toEqual([]);
    answer = true;
    term.paste('three\nfour');
    expect(asked).toEqual(['one\ntwo', 'three\nfour']);
    expect(data).toEqual(['three\rfour']);
    // Safe text never asks.
    term.paste('five');
    expect(asked.length).toBe(2);
    expect(data).toEqual(['three\rfour', 'five']);
  });

  test('sends a Kitty paste event when mode 5522 is on and a clipboard reader is installed', async () => {
    const { term, data } = await openTerminal({ clipboardRead: () => 'ignored' });
    term.write('\x1b[?5522h');
    term.paste('hello');
    expect(data.length).toBe(1);
    // OK (with a one-time password), the MIME list, DONE; the text itself never hits the stream.
    expect(data[0]!.startsWith('\x1b]5522;type=read:status=OK:pw=')).toBe(true);
    expect(data[0]).toContain('\x1b]5522;type=read:status=DATA:');
    expect(data[0]).toContain('\x1b]5522;type=read:status=DONE:');
    expect(data[0]).not.toContain('hello');
  });
});

describe('InputHandler paste routing', () => {
  function makeHandler(onData: (d: string) => void, onPaste?: (text: string) => void) {
    const container = document.createElement('div');
    return Ghostty.load().then((ghostty) => {
      const handler = new InputHandler(
        ghostty,
        container,
        onData,
        () => {},
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        onPaste
      );
      cleanup.push(() => handler.dispose());
      return { handler, container };
    });
  }

  function pasteEvent(text: string): Event {
    const event = new Event('paste', { cancelable: true }) as Event & {
      clipboardData: { getData: (t: string) => string; types: string[] };
    };
    event.clipboardData = { getData: () => text, types: ['text/plain'] };
    return event;
  }

  test('hands clipboard text to onPaste instead of onData', async () => {
    const data: string[] = [];
    const pasted: string[] = [];
    const { container } = await makeHandler(
      (d) => data.push(d),
      (t) => pasted.push(t)
    );
    container.dispatchEvent(pasteEvent('one\ntwo'));
    expect(pasted).toEqual(['one\ntwo']);
    expect(data).toEqual([]);
  });

  test('without onPaste the raw text goes to onData', async () => {
    const data: string[] = [];
    const { container } = await makeHandler((d) => data.push(d));
    container.dispatchEvent(pasteEvent('plain'));
    expect(data).toEqual(['plain']);
  });
});
