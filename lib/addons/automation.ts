import type { IDisposable, IEvent, ITerminalAddon } from '../interfaces';
import type { Terminal } from '../terminal';
import type { KeyEvent, SemanticPromptEvent } from '../types';

export interface TerminalSnapshot {
  cols: number;
  rows: number;
  screen: 'normal' | 'alternate';
  /** Active screen only, independent of the user's scroll position. */
  lines: string[];
  text: string;
  cursor: { x: number; y: number };
  pwd: string;
  modes: { bracketedPaste: boolean; mouseTracking: boolean; kittyKeyboardFlags: number };
}

export interface AutomationWaitOptions {
  /** Finite timeout in milliseconds. Default: 5000. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface TerminalTraceEvent {
  direction: 'input' | 'output';
  timestamp: number;
  data: string | Uint8Array;
}

/** Transport-independent automation. Load with terminal.loadAddon(). */
export class AutomationAddon implements ITerminalAddon {
  private terminal?: Terminal;
  private pending = new Set<(error: Error) => void>();
  private traces = new Set<IDisposable>();

  activate(terminal: Terminal): void {
    if (this.terminal) throw new Error('Automation addon already activated');
    this.terminal = terminal;
  }

  private getTerminal(): Terminal {
    if (!this.terminal?.wasmTerm) throw new Error('Automation requires an open terminal');
    return this.terminal;
  }

  snapshot(): TerminalSnapshot {
    const term = this.getTerminal();
    const buffer = term.buffer.active;
    const lines = Array.from(
      { length: term.rows },
      (_, y) => buffer.getLine(buffer.baseY + y)?.translateToString(true) ?? ''
    );
    return {
      cols: term.cols,
      rows: term.rows,
      screen: buffer.type,
      lines,
      text: lines.join('\n'),
      cursor: { x: buffer.cursorX, y: buffer.cursorY },
      pwd: term.pwd,
      modes: {
        bracketedPaste: term.wasmTerm!.getMode(2004),
        mouseTracking: term.wasmTerm!.hasMouseTracking(),
        kittyKeyboardFlags: term.wasmTerm!.getKittyKeyboardFlags(),
      },
    };
  }

  /** Encode each physical key using the terminal's current protocol modes. */
  sendKeys(events: readonly KeyEvent[]): void {
    for (const event of events) this.getTerminal().sendKey(event);
  }

  /** Send literal input bytes represented as a string to the host's onData sink. */
  input(data: string): void {
    this.getTerminal().input(data, true);
  }

  paste(text: string): void {
    this.getTerminal().paste(text);
  }

  /** Matches current active-screen text immediately, then after each parsed write. */
  waitForText(text: string, options: AutomationWaitOptions = {}): Promise<TerminalSnapshot> {
    const term = this.getTerminal();
    return this.wait(
      term.onWriteParsed,
      () => {
        const snapshot = this.snapshot();
        return snapshot.text.includes(text) ? snapshot : undefined;
      },
      options,
      true
    );
  }

  /** Wait for the next primary OSC 133 input-start (prompt ready for input).
   * Subscribe before sending a command. Requires shell integration.
   */
  waitForPrompt(options: AutomationWaitOptions = {}): Promise<SemanticPromptEvent> {
    return this.wait(
      this.getTerminal().onSemanticPrompt,
      (event) =>
        event?.kind === 'input-start' && event.promptKind === 'primary' ? event : undefined,
      options
    );
  }

  private wait<E, T>(
    event: IEvent<E>,
    match: (event?: E) => T | undefined,
    options: AutomationWaitOptions,
    immediate = false
  ): Promise<T> {
    const timeout = options.timeoutMs ?? 5000;
    if (!Number.isFinite(timeout) || timeout < 0 || timeout > 2147483647) {
      return Promise.reject(new Error('timeoutMs must be finite and between 0 and 2147483647'));
    }
    if (options.signal?.aborted) return Promise.reject(new Error('Automation wait aborted'));
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        subscription?.dispose();
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        this.pending.delete(fail);
      };
      const fail = (error: Error) => {
        cleanup();
        reject(error);
      };
      const abort = () => fail(new Error('Automation wait aborted'));
      const check = (value?: E) => {
        try {
          const result = match(value);
          if (result !== undefined) {
            cleanup();
            resolve(result);
            return true;
          }
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
          return true;
        }
        return false;
      };
      this.pending.add(fail);
      options.signal?.addEventListener('abort', abort, { once: true });
      const subscription = event(check);
      const timer = setTimeout(() => fail(new Error('Automation wait timed out')), timeout);
      if (immediate) check();
    });
  }

  /** Opt-in streaming trace; nothing is retained by the addon.
   * Input includes terminal replies as well as user/programmatic input.
   */
  trace(listener: (event: TerminalTraceEvent) => void): IDisposable {
    const term = this.getTerminal();
    const input = term.onData((data) =>
      listener({ direction: 'input', timestamp: Date.now(), data })
    );
    const output = term.onWriteParsed((data) =>
      listener({
        direction: 'output',
        timestamp: Date.now(),
        data: typeof data === 'string' ? data : data.slice(),
      })
    );
    const subscription = {
      dispose: () => {
        input.dispose();
        output.dispose();
        this.traces.delete(subscription);
      },
    };
    this.traces.add(subscription);
    return subscription;
  }

  dispose(): void {
    for (const fail of this.pending) fail(new Error('Automation addon disposed'));
    for (const trace of this.traces) trace.dispose();
    this.terminal = undefined;
  }
}
