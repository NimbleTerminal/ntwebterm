import { afterEach, beforeEach, expect, test } from 'bun:test';
import type { Terminal } from '../terminal';
import { createIsolatedTerminal } from '../test-helpers';
import { Key, KeyAction, Mods } from '../types';
import { AutomationAddon, type TerminalTraceEvent } from './automation';

let term: Terminal;
let automation: AutomationAddon;
beforeEach(async () => {
  term = await createIsolatedTerminal({ cols: 20, rows: 3, renderer: 'canvas2d' });
  await term.open(document.createElement('div'));
  automation = new AutomationAddon();
  term.loadAddon(automation);
});
afterEach(() => term.dispose());

test('snapshot follows active screen and is detached from later writes', () => {
  term.write('hello');
  const snapshot = automation.snapshot();
  expect(snapshot.lines[0]).toBe('hello');
  expect(snapshot.cursor).toEqual({ x: 5, y: 0 });
  term.write('\x1b[?1049hother');
  expect(automation.snapshot().screen).toBe('alternate');
  expect(automation.snapshot().text).toContain('other');
  expect(snapshot.lines[0]).toBe('hello');
});

test('text waits inspect current text and resolve across writes', async () => {
  const pending = automation.waitForText('hello');
  term.write('hel');
  term.write('lo');
  expect((await pending).text).toContain('hello');
  expect((await automation.waitForText('hello')).lines[0]).toBe('hello');
});

test('waits reject on timeout, abort and terminal disposal', async () => {
  await expect(automation.waitForText('missing', { timeoutMs: 1 })).rejects.toThrow('timed out');
  const controller = new AbortController();
  const aborted = automation.waitForText('missing', { signal: controller.signal });
  controller.abort();
  await expect(aborted).rejects.toThrow('aborted');
  const disposed = automation.waitForPrompt();
  term.dispose();
  await expect(disposed).rejects.toThrow('disposed');
});

test('prompt wait resolves on input-start, not prompt-start', async () => {
  const pending = automation.waitForPrompt();
  term.write('\x1b]133;A\x07$ \x1b]133;B\x07');
  expect((await pending).kind).toBe('input-start');
});

test('keys use application cursor mode and paste uses bracketed paste', () => {
  const input: string[] = [];
  term.onData((data) => input.push(data));
  term.write('\x1b[?1h\x1b[?2004h');
  automation.sendKeys([{ key: Key.ARROW_UP, action: KeyAction.PRESS, mods: Mods.NONE }]);
  automation.paste('hello');
  expect(input).toEqual(['\x1bOA', '\x1b[200~hello\x1b[201~']);
});

test('traces stream copied output and stop when disposed', () => {
  const events: TerminalTraceEvent[] = [];
  const trace = automation.trace((event) => events.push(event));
  const bytes = new TextEncoder().encode('hi');
  term.write(bytes);
  bytes.fill(0);
  automation.input('x');
  expect(events.map((event) => event.direction)).toEqual(['output', 'input']);
  expect(new TextDecoder().decode(events[0].data as Uint8Array)).toBe('hi');
  trace.dispose();
  term.write('ignored');
  expect(events).toHaveLength(2);
});
