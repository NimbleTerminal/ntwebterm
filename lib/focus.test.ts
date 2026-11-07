/**
 * Focus reporting (mode 1004): CSI I / CSI O come from libghostty-vt's
 * ghostty_focus_encode(). TypeScript only decides when the terminal gained or
 * lost focus and whether the program asked for reports.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { Ghostty, type GhosttyTerminal } from './ghostty';
import { createIsolatedTerminal } from './test-helpers';

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);

async function wasmTerminal(): Promise<GhosttyTerminal> {
  const ghostty = await Ghostty.load();
  const term = ghostty.createTerminal(40, 10);
  cleanup.push(() => term.free());
  return term;
}

async function openTerminal(options: Parameters<typeof createIsolatedTerminal>[0] = {}) {
  const term = await createIsolatedTerminal({ cols: 40, rows: 10, ...options });
  const container = document.createElement('div');
  document.body.appendChild(container);
  await term.open(container);
  cleanup.push(() => {
    term.dispose();
    container.remove();
  });
  const data: string[] = [];
  term.onData((d) => data.push(d));
  const textarea = container.querySelector('textarea')!;
  const focusEvent = (type: 'focusin' | 'focusout', relatedTarget: EventTarget | null = null) =>
    textarea.dispatchEvent(new FocusEvent(type, { bubbles: true, relatedTarget }));
  return { term, data, container, textarea, focusEvent };
}

describe('focus reporting', () => {
  test('Ghostty.encodeFocus() needs no terminal', async () => {
    const ghostty = await Ghostty.load();
    expect(text(ghostty.encodeFocus(true))).toBe('\x1b[I');
    expect(text(ghostty.encodeFocus(false))).toBe('\x1b[O');
  });

  test('GhosttyTerminal.encodeFocus() reports only when mode 1004 is on', async () => {
    const term = await wasmTerminal();
    expect(term.encodeFocus(true).length).toBe(0);
    term.write('\x1b[?1004h');
    expect(text(term.encodeFocus(true))).toBe('\x1b[I');
    expect(text(term.encodeFocus(false))).toBe('\x1b[O');
    term.write('\x1b[?1004l');
    expect(term.encodeFocus(false).length).toBe(0);
  });

  test('Terminal sends CSI O and CSI I as focus leaves and returns', async () => {
    const { term, data, focusEvent } = await openTerminal();
    focusEvent('focusout');
    focusEvent('focusin');
    expect(data).toEqual([]); // program did not ask
    term.write('\x1b[?1004h');
    focusEvent('focusout');
    focusEvent('focusin');
    expect(data).toEqual(['\x1b[O', '\x1b[I']);
  });

  test('focus moving between the terminal element and its textarea is not a change', async () => {
    const { term, data, container, textarea, focusEvent } = await openTerminal();
    term.write('\x1b[?1004h');
    focusEvent('focusout', container);
    focusEvent('focusin', container);
    container.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: textarea }));
    expect(data).toEqual([]);
  });

  test('disableStdin suppresses focus reports', async () => {
    const { term, data, focusEvent } = await openTerminal({ disableStdin: true });
    term.write('\x1b[?1004h');
    focusEvent('focusout');
    expect(data).toEqual([]);
  });
});
