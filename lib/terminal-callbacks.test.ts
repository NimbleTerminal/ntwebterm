import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { Ghostty } from './ghostty';
import type { ITerminalOptions } from './interfaces';
import { Terminal } from './terminal';
import type {
  ClipboardReadRequest,
  ClipboardWriteEvent,
  DesktopNotification,
  ProgressReport,
  ResizeRequest,
  SemanticPromptEvent,
} from './types';

const terminals: Terminal[] = [];

async function open(options: Omit<ITerminalOptions, 'ghostty'> = {}) {
  const term = new Terminal({ ghostty: await Ghostty.load(), cols: 20, rows: 4, ...options });
  terminals.push(term);
  await term.open(document.createElement('div'));
  return term;
}

/** Force the plain writeText path so the spy sees the text synchronously. */
function withoutClipboardItem<T>(fn: () => T): T {
  const saved = (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
  (globalThis as { ClipboardItem?: unknown }).ClipboardItem = undefined;
  try {
    return fn();
  } finally {
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = saved;
  }
}

afterEach(() => {
  for (const term of terminals.splice(0)) term.dispose();
});

describe('OSC 52 clipboard write', () => {
  test('writes to the browser clipboard by default and fires onClipboardWrite', async () => {
    const term = await open();
    const events: ClipboardWriteEvent[] = [];
    term.onClipboardWrite((event) => events.push(event));
    const writeText = spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    try {
      withoutClipboardItem(() => term.write('\x1b]52;c;SGVsbG8=\x07'));
      expect(writeText).toHaveBeenCalledWith('Hello');
    } finally {
      writeText.mockRestore();
    }
    expect(events).toEqual([
      {
        location: 'standard',
        text: 'Hello',
        contents: [{ mime: 'text/plain', data: new TextEncoder().encode('Hello') }],
        program: '',
        granted: false,
      },
    ]);
  });

  test("clipboardWrite: 'event' fires the event without touching the browser clipboard", async () => {
    const term = await open({ clipboardWrite: 'event' });
    const events: ClipboardWriteEvent[] = [];
    term.onClipboardWrite((event) => events.push(event));
    const writeText = spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    try {
      withoutClipboardItem(() => term.write('\x1b]52;c;SGVsbG8=\x07'));
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      writeText.mockRestore();
    }
    expect(events.map((e) => e.text)).toEqual(['Hello']);
  });

  test("clipboardWrite: 'deny' drops the request entirely", async () => {
    const term = await open({ clipboardWrite: 'deny' });
    const events: ClipboardWriteEvent[] = [];
    term.onClipboardWrite((event) => events.push(event));
    const writeText = spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    try {
      withoutClipboardItem(() => term.write('\x1b]52;c;SGVsbG8=\x07'));
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      writeText.mockRestore();
    }
    expect(events).toEqual([]);
  });
});

describe('OSC 52 clipboard read', () => {
  test('is answered from the clipboardRead handler', async () => {
    const requests: ClipboardReadRequest[] = [];
    const term = await open({
      clipboardRead: (request) => {
        requests.push(request);
        return 'Hello';
      },
    });
    const replies: string[] = [];
    term.onData((data) => replies.push(data));
    term.write('\x1b]52;c;?\x07');
    expect(requests).toEqual([
      { location: 'standard', mimes: ['text/plain'], list: false, program: '', granted: false },
    ]);
    expect(replies.join('')).toContain('52;c;SGVsbG8=');
  });

  test('is refused when no handler is configured', async () => {
    const term = await open();
    const replies: string[] = [];
    term.onData((data) => replies.push(data));
    term.write('\x1b]52;c;?\x07');
    expect(replies.join('')).not.toContain('SGVsbG8=');
  });

  test('a handler returning null denies the read', async () => {
    const term = await open({ clipboardRead: () => null });
    const replies: string[] = [];
    term.onData((data) => replies.push(data));
    term.write('\x1b]52;c;?\x07');
    expect(replies.join('')).not.toContain('SGVsbG8=');
  });
});

describe('OSC 7 working directory', () => {
  test('fires onPwdChange and exposes pwd', async () => {
    const term = await open();
    const pwds: string[] = [];
    term.onPwdChange((pwd) => pwds.push(pwd));
    expect(term.pwd).toBe('');
    term.write('\x1b]7;file://host/tmp/project\x07');
    expect(pwds).toEqual(['file://host/tmp/project']);
    expect(term.pwd).toBe('file://host/tmp/project');
  });
});

describe('desktop notifications', () => {
  test('OSC 777 and OSC 9 fire onNotification', async () => {
    const term = await open();
    const notifications: DesktopNotification[] = [];
    term.onNotification((n) => notifications.push(n));
    term.write('\x1b]777;notify;Build done;All 12 tests passed\x07');
    term.write('\x1b]9;Hello from OSC 9\x07');
    expect(notifications).toEqual([
      { title: 'Build done', body: 'All 12 tests passed' },
      { title: '', body: 'Hello from OSC 9' },
    ]);
  });

  test('listeners may write to the terminal from inside the event', async () => {
    const term = await open();
    term.onNotification(() => term.write('ack'));
    expect(() => term.write('\x1b]9;ping\x07')).not.toThrow();
    expect(term.buffer.active.getLine(0)?.translateToString(true)).toBe('ack');
  });
});

describe('OSC 9;4 progress reports', () => {
  test('fires onProgress with state and percentage', async () => {
    const term = await open();
    const reports: ProgressReport[] = [];
    term.onProgress((r) => reports.push(r));
    term.write('\x1b]9;4;1;50\x07');
    term.write('\x1b]9;4;3\x07');
    term.write('\x1b]9;4;0\x07');
    expect(reports).toEqual([
      { state: 'set', progress: 50 },
      { state: 'indeterminate', progress: null },
      { state: 'remove', progress: null },
    ]);
  });
});

describe('OSC 133 semantic prompts', () => {
  test('fires onSemanticPrompt for each command step', async () => {
    const term = await open();
    const events: SemanticPromptEvent[] = [];
    term.onSemanticPrompt((e) => events.push(e));
    term.write('\x1b]133;A\x07');
    term.write('\x1b]133;B\x07');
    term.write('\x1b]133;C\x07');
    term.write('\x1b]133;D;3\x07');
    expect(events).toEqual([
      { kind: 'prompt-start', promptKind: 'primary', exitCode: null, command: '', error: '' },
      { kind: 'input-start', promptKind: 'primary', exitCode: null, command: '', error: '' },
      { kind: 'output-start', promptKind: 'primary', exitCode: null, command: '', error: '' },
      { kind: 'command-end', promptKind: 'primary', exitCode: 3, command: '', error: '' },
    ]);
  });
});

describe('CSI 8 t resize requests', () => {
  test('fires onResizeRequest without resizing the terminal', async () => {
    const term = await open();
    const requests: ResizeRequest[] = [];
    term.onResizeRequest((r) => requests.push(r));
    term.write('\x1b[8;30;100t');
    expect(requests).toEqual([{ rows: 30, cols: 100 }]);
    expect(term.rows).toBe(4);
    expect(term.cols).toBe(20);
  });
});

describe('CSI ? 996 n color scheme reports', () => {
  test('answers dark for a dark theme background', async () => {
    const term = await open({ theme: { background: '#101010' } });
    const replies: string[] = [];
    term.onData((data) => replies.push(data));
    term.write('\x1b[?996n');
    expect(replies.join('')).toBe('\x1b[?997;1n');
  });

  test('answers light for a light theme background', async () => {
    const term = await open({ theme: { background: '#fafafa' } });
    const replies: string[] = [];
    term.onData((data) => replies.push(data));
    term.write('\x1b[?996n');
    expect(replies.join('')).toBe('\x1b[?997;2n');
  });

  test('the colorScheme option overrides the theme heuristic', async () => {
    const term = await open({ theme: { background: '#fafafa' }, colorScheme: 'dark' });
    const replies: string[] = [];
    term.onData((data) => replies.push(data));
    term.write('\x1b[?996n');
    expect(replies.join('')).toBe('\x1b[?997;1n');
  });
});
