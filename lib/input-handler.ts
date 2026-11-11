/**
 * InputHandler - Converts browser keyboard events to terminal input
 *
 * Handles:
 * - Keyboard event listening on a container element
 * - Mapping KeyboardEvent.code to USB HID Key codes
 * - Extracting modifier keys (Ctrl, Alt, Shift, Meta)
 * - Encoding keys using Ghostty's KeyEncoder
 * - Emitting data for Terminal to send to PTY
 *
 * Limitations:
 * - Does not handle IME/composition events (CJK input) - to be added later
 * - Captures all keyboard input (preventDefault on everything)
 */

import type { Ghostty, GhosttyTerminal, KeyEncoder } from './ghostty';
import type { IKeyEvent } from './interfaces';
import { Key, KeyAction, KeyEncoderOption, Mods, MouseAction, MouseButton } from './types';

/**
 * Map KeyboardEvent.code values to USB HID Key enum values
 * Based on: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
 */
const KEY_MAP: Record<string, Key> = {
  // Letters
  KeyA: Key.A,
  KeyB: Key.B,
  KeyC: Key.C,
  KeyD: Key.D,
  KeyE: Key.E,
  KeyF: Key.F,
  KeyG: Key.G,
  KeyH: Key.H,
  KeyI: Key.I,
  KeyJ: Key.J,
  KeyK: Key.K,
  KeyL: Key.L,
  KeyM: Key.M,
  KeyN: Key.N,
  KeyO: Key.O,
  KeyP: Key.P,
  KeyQ: Key.Q,
  KeyR: Key.R,
  KeyS: Key.S,
  KeyT: Key.T,
  KeyU: Key.U,
  KeyV: Key.V,
  KeyW: Key.W,
  KeyX: Key.X,
  KeyY: Key.Y,
  KeyZ: Key.Z,

  // Numbers
  Digit1: Key.DIGIT_1,
  Digit2: Key.DIGIT_2,
  Digit3: Key.DIGIT_3,
  Digit4: Key.DIGIT_4,
  Digit5: Key.DIGIT_5,
  Digit6: Key.DIGIT_6,
  Digit7: Key.DIGIT_7,
  Digit8: Key.DIGIT_8,
  Digit9: Key.DIGIT_9,
  Digit0: Key.DIGIT_0,

  // Special keys
  Enter: Key.ENTER,
  Escape: Key.ESCAPE,
  Backspace: Key.BACKSPACE,
  Tab: Key.TAB,
  Space: Key.SPACE,

  // Punctuation
  Minus: Key.MINUS,
  Equal: Key.EQUAL,
  BracketLeft: Key.BRACKET_LEFT,
  BracketRight: Key.BRACKET_RIGHT,
  Backslash: Key.BACKSLASH,
  Semicolon: Key.SEMICOLON,
  Quote: Key.QUOTE,
  Backquote: Key.BACKQUOTE,
  Comma: Key.COMMA,
  Period: Key.PERIOD,
  Slash: Key.SLASH,

  // Function keys
  CapsLock: Key.CAPS_LOCK,
  F1: Key.F1,
  F2: Key.F2,
  F3: Key.F3,
  F4: Key.F4,
  F5: Key.F5,
  F6: Key.F6,
  F7: Key.F7,
  F8: Key.F8,
  F9: Key.F9,
  F10: Key.F10,
  F11: Key.F11,
  F12: Key.F12,

  // Special function keys
  PrintScreen: Key.PRINT_SCREEN,
  ScrollLock: Key.SCROLL_LOCK,
  Pause: Key.PAUSE,
  Insert: Key.INSERT,
  Home: Key.HOME,
  PageUp: Key.PAGE_UP,
  Delete: Key.DELETE,
  End: Key.END,
  PageDown: Key.PAGE_DOWN,

  // Arrow keys
  ArrowRight: Key.ARROW_RIGHT,
  ArrowLeft: Key.ARROW_LEFT,
  ArrowDown: Key.ARROW_DOWN,
  ArrowUp: Key.ARROW_UP,

  // Keypad
  NumLock: Key.NUM_LOCK,
  NumpadDivide: Key.NUMPAD_DIVIDE,
  NumpadMultiply: Key.NUMPAD_MULTIPLY,
  NumpadSubtract: Key.NUMPAD_SUBTRACT,
  NumpadAdd: Key.NUMPAD_ADD,
  NumpadEnter: Key.NUMPAD_ENTER,
  Numpad1: Key.NUMPAD_1,
  Numpad2: Key.NUMPAD_2,
  Numpad3: Key.NUMPAD_3,
  Numpad4: Key.NUMPAD_4,
  Numpad5: Key.NUMPAD_5,
  Numpad6: Key.NUMPAD_6,
  Numpad7: Key.NUMPAD_7,
  Numpad8: Key.NUMPAD_8,
  Numpad9: Key.NUMPAD_9,
  Numpad0: Key.NUMPAD_0,
  NumpadDecimal: Key.NUMPAD_DECIMAL,

  // International
  IntlBackslash: Key.INTL_BACKSLASH,
  ContextMenu: Key.CONTEXT_MENU,

  // Additional function keys
  F13: Key.F13,
  F14: Key.F14,
  F15: Key.F15,
  F16: Key.F16,
  F17: Key.F17,
  F18: Key.F18,
  F19: Key.F19,
  F20: Key.F20,
  F21: Key.F21,
  F22: Key.F22,
  F23: Key.F23,
  F24: Key.F24,
};

/**
 * The character each physical key produces on a US layout with no modifiers.
 * Browsers do not report a key's unshifted character, so this is the best
 * guess when a modifier has changed `event.key` (Shift+1 gives "!").
 */
const US_UNSHIFTED: Record<string, string> = {
  Digit0: '0',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Digit4: '4',
  Digit5: '5',
  Digit6: '6',
  Digit7: '7',
  Digit8: '8',
  Digit9: '9',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Space: ' ',
};
for (let i = 0; i < 26; i++) {
  US_UNSHIFTED[`Key${String.fromCharCode(65 + i)}`] = String.fromCharCode(97 + i);
}

/** True when `s` is exactly one Unicode scalar that is not a control character. */
function isSingleTextScalar(s: string): boolean {
  const cp = s.codePointAt(0);
  if (cp === undefined || s.length !== (cp > 0xffff ? 2 : 1)) return false;
  return cp >= 0x20 && cp !== 0x7f;
}

function detectMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    '';
  return /mac|iphone|ipad/i.test(platform);
}

/** Keyboard behavior that depends on the platform or on terminal options. */
export interface InputHandlerKeyboardOptions {
  /**
   * Whether the macOS Option key acts as Alt/Meta (ESC prefix) instead of
   * composing characters. Read on every key press. Default: false.
   */
  macOptionIsMeta?: () => boolean;
  /** Override macOS detection (for tests). */
  isMac?: boolean;
}

/**
 * InputHandler class
 * Attaches keyboard event listeners to a container and converts
 * keyboard events to terminal input data
 */
/**
 * Mouse tracking configuration
 */
export interface MouseTrackingConfig {
  /** Check if any mouse tracking mode is enabled */
  hasMouseTracking: () => boolean;
  /** Get cell dimensions for pixel to cell conversion */
  getCellDimensions: () => { width: number; height: number };
  /** Get canvas/container offset for accurate position calculation */
  getCanvasOffset: () => { left: number; top: number };
  /**
   * Map a visual (screen) column to the logical column on BiDi-reordered
   * rows. Both 0-based. Identity when absent. Mouse reports must carry the
   * LOGICAL column — the app knows nothing about visual reordering, and a
   * raw visual column makes clicks land on the wrong widget with nothing
   * looking wrong on screen.
   */
  visualToLogicalCol?: (col: number, row: number) => number;
}

export class InputHandler {
  private encoder: KeyEncoder;
  private container: HTMLElement;
  private inputElement?: HTMLElement;
  private onDataCallback: (data: string) => void;
  private onBellCallback: () => void;
  private onKeyCallback?: (keyEvent: IKeyEvent) => void;
  private customKeyEventHandler?: (event: KeyboardEvent) => boolean;
  private getModeCallback?: (mode: number) => boolean;
  private onCopyCallback?: () => boolean;
  private mouseConfig?: MouseTrackingConfig;
  private getTerminalCallback?: () => GhosttyTerminal | undefined;
  private onPasteCallback?: (text: string) => void;
  private isMac: boolean;
  private macOptionIsMeta: () => boolean;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private keyupListener: ((e: KeyboardEvent) => void) | null = null;
  private keypressListener: ((e: KeyboardEvent) => void) | null = null;
  private pasteListener: ((e: ClipboardEvent) => void) | null = null;
  private beforeInputListener: ((e: InputEvent) => void) | null = null;
  private compositionStartListener: ((e: CompositionEvent) => void) | null = null;
  private compositionUpdateListener: ((e: CompositionEvent) => void) | null = null;
  private compositionEndListener: ((e: CompositionEvent) => void) | null = null;
  private mousedownListener: ((e: MouseEvent) => void) | null = null;
  private mouseupListener: ((e: MouseEvent) => void) | null = null;
  private mousemoveListener: ((e: MouseEvent) => void) | null = null;
  private wheelListener: ((e: WheelEvent) => void) | null = null;
  private isComposing = false;
  private isDisposed = false;
  private mouseButtonsPressed = 0; // Bit per DOM button index, for drag motion reports
  private lastKeyDownData: string | null = null;
  private lastKeyDownTime = 0;
  private lastPasteData: string | null = null;
  private lastPasteTime = 0;
  private lastPasteSource: 'paste' | 'beforeinput' | null = null;
  private lastCompositionData: string | null = null;
  private lastCompositionTime = 0;
  private lastBeforeInputData: string | null = null;
  private lastBeforeInputTime = 0;
  private static readonly BEFORE_INPUT_IGNORE_MS = 100;

  /**
   * Create a new InputHandler
   * @param ghostty - Ghostty instance (for creating KeyEncoder)
   * @param container - DOM element to attach listeners to
   * @param onData - Callback for terminal data (escape sequences to send to PTY)
   * @param onBell - Callback for bell/beep event
   * @param onKey - Optional callback for raw key events
   * @param customKeyEventHandler - Optional custom key event handler
   * @param getMode - Optional callback to query terminal mode state (for application cursor mode)
   * @param onCopy - Optional callback to handle copy (Cmd+C/Ctrl+C with selection)
   * @param inputElement - Optional input element for beforeinput events
   * @param mouseConfig - Optional mouse tracking configuration
   * @param getTerminal - Optional accessor for the WASM terminal (mouse mode queries)
   * @param onPaste - Optional sink for pasted text; the terminal routes it through
   *   libghostty-vt. Without it the raw text is sent to onData.
   * @param keyboardOptions - Optional platform and Option-key behavior
   */
  constructor(
    ghostty: Ghostty,
    container: HTMLElement,
    onData: (data: string) => void,
    onBell: () => void,
    onKey?: (keyEvent: IKeyEvent) => void,
    customKeyEventHandler?: (event: KeyboardEvent) => boolean,
    getMode?: (mode: number) => boolean,
    onCopy?: () => boolean,
    inputElement?: HTMLElement,
    mouseConfig?: MouseTrackingConfig,
    getTerminal?: () => GhosttyTerminal | undefined,
    onPaste?: (text: string) => void,
    keyboardOptions: InputHandlerKeyboardOptions = {}
  ) {
    this.encoder = ghostty.createKeyEncoder();
    // DEC mode 1036 (alt_esc_prefix) defaults to true in Ghostty
    this.encoder.setOption(KeyEncoderOption.ALT_ESC_PREFIX, true);
    this.container = container;
    this.inputElement = inputElement;
    this.onDataCallback = onData;
    this.onBellCallback = onBell;
    this.onKeyCallback = onKey;
    this.customKeyEventHandler = customKeyEventHandler;
    this.getModeCallback = getMode;
    this.onCopyCallback = onCopy;
    this.mouseConfig = mouseConfig;
    this.getTerminalCallback = getTerminal;
    this.onPasteCallback = onPaste;
    this.isMac = keyboardOptions.isMac ?? detectMac();
    this.macOptionIsMeta = keyboardOptions.macOptionIsMeta ?? (() => false);

    // Attach event listeners
    this.attach();
  }

  /**
   * Set custom key event handler (for runtime updates)
   */
  setCustomKeyEventHandler(handler: (event: KeyboardEvent) => boolean): void {
    this.customKeyEventHandler = handler;
  }

  /**
   * Attach keyboard event listeners to container
   */
  private attach(): void {
    // Make container focusable so it can receive keyboard events (browser only)
    if (
      typeof this.container.hasAttribute === 'function' &&
      typeof this.container.setAttribute === 'function'
    ) {
      if (!this.container.hasAttribute('tabindex')) {
        this.container.setAttribute('tabindex', '0');
      }

      // Add visual focus indication (only if style exists - for browser environments)
      if (this.container.style) {
        this.container.style.outline = 'none'; // Remove default outline
      }
    }

    this.keydownListener = this.handleKeyDown.bind(this);
    this.container.addEventListener('keydown', this.keydownListener);

    this.keyupListener = this.handleKeyUp.bind(this);
    this.container.addEventListener('keyup', this.keyupListener);

    this.pasteListener = this.handlePaste.bind(this);
    this.container.addEventListener('paste', this.pasteListener);
    if (this.inputElement && this.inputElement !== this.container) {
      this.inputElement.addEventListener('paste', this.pasteListener);
    }

    if (this.inputElement) {
      this.beforeInputListener = this.handleBeforeInput.bind(this);
      this.inputElement.addEventListener('beforeinput', this.beforeInputListener);
    }

    this.compositionStartListener = this.handleCompositionStart.bind(this);
    this.container.addEventListener('compositionstart', this.compositionStartListener);

    this.compositionUpdateListener = this.handleCompositionUpdate.bind(this);
    this.container.addEventListener('compositionupdate', this.compositionUpdateListener);

    this.compositionEndListener = this.handleCompositionEnd.bind(this);
    this.container.addEventListener('compositionend', this.compositionEndListener);

    // Mouse event listeners (for terminal mouse tracking)
    this.mousedownListener = this.handleMouseDown.bind(this);
    this.container.addEventListener('mousedown', this.mousedownListener);

    this.mouseupListener = this.handleMouseUp.bind(this);
    this.container.addEventListener('mouseup', this.mouseupListener);

    this.mousemoveListener = this.handleMouseMove.bind(this);
    this.container.addEventListener('mousemove', this.mousemoveListener);

    this.wheelListener = this.handleWheel.bind(this);
    this.container.addEventListener('wheel', this.wheelListener, { passive: false });
  }

  /**
   * Map KeyboardEvent.code to USB HID Key enum value
   * @param code - KeyboardEvent.code value
   * @returns Key enum value or null if unmapped
   */
  private mapKeyCode(code: string): Key | null {
    return KEY_MAP[code] ?? null;
  }

  /**
   * Extract modifier flags from KeyboardEvent
   * @param event - KeyboardEvent
   * @returns Mods flags
   */
  private extractModifiers(event: KeyboardEvent): Mods {
    let mods = Mods.NONE;

    if (event.shiftKey) mods |= Mods.SHIFT;
    if (event.ctrlKey) mods |= Mods.CTRL;
    if (event.altKey) mods |= Mods.ALT;
    if (event.metaKey) mods |= Mods.SUPER;

    // Note: CapsLock and NumLock are not in KeyboardEvent modifiers
    // They would need to be tracked separately if needed
    // For now, we don't set CAPSLOCK or NUMLOCK flags

    return mods;
  }

  /** AltGr is held: the key composes a character and is not a Ctrl/Alt chord. */
  private isAltGraph(event: KeyboardEvent): boolean {
    return event.getModifierState?.('AltGraph') === true;
  }

  /** The macOS Option key is held and composes a character (the system default). */
  private isComposingOption(event: KeyboardEvent): boolean {
    return this.isMac && event.altKey && !this.isAltGraph(event) && !this.macOptionIsMeta();
  }

  /**
   * Check if this key press is plain text: a single character that no
   * modifier turns into a chord.
   * @param event - KeyboardEvent
   * @returns true if printable character
   */
  private isPrintableCharacter(event: KeyboardEvent): boolean {
    if (event.metaKey) return false; // Cmd key on Mac
    if (!isSingleTextScalar(event.key)) return false;
    // AltGr composes text. Windows reports it as Ctrl+Alt plus the AltGraph state.
    if (this.isAltGraph(event)) return true;
    if (event.ctrlKey) return false;
    // Alt is a chord, except macOS Option, which composes (Option+b types "∫").
    if (event.altKey) return this.isComposingOption(event);
    return true;
  }

  /**
   * Describe the text side of a key event for the encoder: the text the key
   * produced, the character it would produce unmodified, and which modifiers
   * went into producing the text rather than forming a chord.
   */
  private describeKeyText(
    event: KeyboardEvent,
    eventMods: Mods
  ): { mods: Mods; utf8?: string; unshiftedCodepoint?: number; consumedMods: Mods } {
    let mods = eventMods;
    if (!isSingleTextScalar(event.key)) return { mods, consumedMods: Mods.NONE };

    let text = event.key;
    const us = US_UNSHIFTED[event.code];
    const altGraph = this.isAltGraph(event);
    const option = this.isMac && event.altKey && !altGraph;

    if (altGraph) {
      // The composed character is the input; Ctrl and Alt were spent on it.
      mods &= ~(Mods.CTRL | Mods.ALT);
    } else if (option) {
      if (this.macOptionIsMeta()) {
        // Undo the Option translation so Alt+b is ESC b, not ESC ∫.
        if (us) {
          const plain = "`1234567890-=[]\\;',./";
          const shifted = '~!@#$%^&*()_+{}|:"<>?';
          const index = plain.indexOf(us);
          text = event.shiftKey ? (index >= 0 ? shifted[index] : us.toUpperCase()) : us;
        }
      } else {
        mods &= ~Mods.ALT;
      }
    }

    // Browsers report Ctrl+Shift+A as "A". Control chords are keyed on the
    // base letter (Ctrl+A is 0x01 either way), so fold ASCII to lower case.
    if ((mods & Mods.CTRL) !== 0 && text.charCodeAt(0) < 128) text = text.toLowerCase();

    const lower = text.toLowerCase();
    let unshifted = text;
    if (lower !== text && isSingleTextScalar(lower)) {
      unshifted = lower;
    } else if ((event.shiftKey || altGraph || option) && us) {
      unshifted = us;
    }
    const consumedMods = event.shiftKey && text !== unshifted ? Mods.SHIFT : Mods.NONE;

    return { mods, utf8: text, unshiftedCodepoint: unshifted.codePointAt(0), consumedMods };
  }

  /**
   * Handle keydown event
   * @param event - KeyboardEvent
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (this.isDisposed) return;

    // Ignore keydown events during composition
    // Note: Some browsers send keyCode 229 for all keys during composition
    if (this.isComposing || event.isComposing || event.keyCode === 229) {
      return;
    }

    // A dead key starts a composition. Leave it to the browser: encoding it
    // would send the bare key, and preventDefault would cancel the composition.
    if (event.key === 'Dead') return;

    // Emit onKey event first (before any processing)
    if (this.onKeyCallback) {
      this.onKeyCallback({ key: event.key, domEvent: event });
    }

    // Check custom key event handler
    if (this.customKeyEventHandler) {
      const handled = this.customKeyEventHandler(event);
      if (handled) {
        // Custom handler consumed the event
        event.preventDefault();
        return;
      }
    }

    // Ctrl+V and Cmd+V: let the browser's native paste event fire (no preventDefault).
    // Do not emit 0x16 here, because in a cooked shell 0x16 is quoted-insert and
    // eats the ESC of the bracketed paste wrapper (\x1b[200~) that follows in handlePaste.
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyV') {
      return;
    }

    // Handle Cmd+C for copy (on Mac, Cmd+C should copy, not send interrupt)
    // Note: Ctrl+C on all platforms sends interrupt signal (0x03)
    if (event.metaKey && event.code === 'KeyC') {
      // Try to copy selection via callback
      // If there's a selection and copy succeeds, prevent default
      // If no selection, let it fall through (browser may have other text selected)
      if (this.onCopyCallback && this.onCopyCallback()) {
        event.preventDefault();
      }
      return;
    }

    const { kittyFlags } = this.syncEncoderOptions();

    // For printable characters without modifiers (and when Kitty keyboard protocol is off),
    // send the character directly. This handles: a-z, A-Z (with shift), 0-9, punctuation, etc.
    if (kittyFlags === 0 && this.isPrintableCharacter(event)) {
      event.preventDefault();
      this.onDataCallback(event.key);
      this.recordKeyDownData(event.key);
      return;
    }

    // Map the physical key code
    const key = this.mapKeyCode(event.code);
    if (key === null) {
      // If unmapped key is a printable character (e.g. non-US layout), emit directly
      if (this.isPrintableCharacter(event)) {
        event.preventDefault();
        this.onDataCallback(event.key);
        this.recordKeyDownData(event.key);
      }
      return;
    }

    // Extract modifiers, then separate the ones that produced text from the
    // ones that form a chord.
    const keyText = this.describeKeyText(event, this.extractModifiers(event));
    const mods = keyText.mods;

    // Handle simple unmodified special keys (plus Shift+Tab) when Kitty protocol is inactive.
    // All other shifted keys (Shift+F1..F12, Shift+Home/End/Insert/Delete/PageUp/PageDown, etc.)
    // must go through KeyEncoder so modifier parameters are preserved.
    if (kittyFlags === 0 && (mods === Mods.NONE || (key === Key.TAB && mods === Mods.SHIFT))) {
      let simpleOutput: string | null = null;
      const appCursorMode =
        this.getModeCallback?.(1) ?? this.getTerminalCallback?.()?.getMode(1, false) ?? false;

      switch (key) {
        case Key.ENTER:
          simpleOutput = '\r'; // Carriage return
          break;
        case Key.TAB:
          if (mods === Mods.SHIFT) {
            simpleOutput = '\x1b[Z'; // Backtab
          } else {
            simpleOutput = '\t'; // Tab
          }
          break;
        case Key.BACKSPACE:
          simpleOutput = '\x7F'; // DEL (most terminals use 0x7F for backspace)
          break;
        case Key.ESCAPE:
          simpleOutput = '\x1B'; // ESC
          break;
        // Arrow keys are handled by the encoder (respects application cursor mode)
        // Navigation keys
        case Key.HOME:
          simpleOutput = appCursorMode ? '\x1BOH' : '\x1B[H';
          break;
        case Key.END:
          simpleOutput = appCursorMode ? '\x1BOF' : '\x1B[F';
          break;
        case Key.INSERT:
          simpleOutput = '\x1B[2~';
          break;
        case Key.DELETE:
          simpleOutput = '\x1B[3~';
          break;
        case Key.PAGE_UP:
          simpleOutput = '\x1B[5~';
          break;
        case Key.PAGE_DOWN:
          simpleOutput = '\x1B[6~';
          break;
        // Function keys
        case Key.F1:
          simpleOutput = '\x1BOP';
          break;
        case Key.F2:
          simpleOutput = '\x1BOQ';
          break;
        case Key.F3:
          simpleOutput = '\x1BOR';
          break;
        case Key.F4:
          simpleOutput = '\x1BOS';
          break;
        case Key.F5:
          simpleOutput = '\x1B[15~';
          break;
        case Key.F6:
          simpleOutput = '\x1B[17~';
          break;
        case Key.F7:
          simpleOutput = '\x1B[18~';
          break;
        case Key.F8:
          simpleOutput = '\x1B[19~';
          break;
        case Key.F9:
          simpleOutput = '\x1B[20~';
          break;
        case Key.F10:
          simpleOutput = '\x1B[21~';
          break;
        case Key.F11:
          simpleOutput = '\x1B[23~';
          break;
        case Key.F12:
          simpleOutput = '\x1B[24~';
          break;
      }

      if (simpleOutput !== null) {
        event.preventDefault();
        this.onDataCallback(simpleOutput);
        this.recordKeyDownData(simpleOutput);
        return;
      }
    }

    // Determine action (PRESS or REPEAT)
    const action = event.repeat ? KeyAction.REPEAT : KeyAction.PRESS;

    // For non-printable keys, keys with modifiers, or Kitty protocol keys, encode using Ghostty
    try {
      // Text keys carry their text (any script, not only ASCII) so the
      // encoder can send it or report it; special keys (Enter, arrows, ...)
      // have none.
      const encoded = this.encoder.encode({
        action,
        key,
        mods,
        utf8: keyText.utf8,
        unshiftedCodepoint: keyText.unshiftedCodepoint,
        consumedMods: keyText.consumedMods,
      });

      // Convert Uint8Array to string
      const decoder = new TextDecoder();
      const data = decoder.decode(encoded);

      // Prevent default browser behavior
      event.preventDefault();
      event.stopPropagation();

      // Emit the data
      if (data.length > 0) {
        this.onDataCallback(data);
        this.recordKeyDownData(data);
      }
    } catch (error) {
      // Encoding failed - log but don't crash
      console.warn('Failed to encode key:', event.code, error);
    }
  }

  /**
   * Synchronize KeyEncoder options with the live terminal state
   */
  private syncEncoderOptions(): { kittyFlags: number } {
    const term = this.getTerminalCallback?.();
    if (term) {
      this.encoder.setOptionsFromTerminal(term.getHandle());
      return { kittyFlags: term.getKittyKeyboardFlags() };
    }
    if (this.getModeCallback) {
      const appCursorMode = this.getModeCallback(1);
      this.encoder.setOption(KeyEncoderOption.CURSOR_KEY_APPLICATION, appCursorMode);
    }
    return { kittyFlags: 0 };
  }

  /**
   * Handle keyup event (for Kitty keyboard protocol event reporting)
   */
  private handleKeyUp(event: KeyboardEvent): void {
    if (this.isDisposed) return;
    if (this.isComposing || event.isComposing || event.keyCode === 229) {
      return;
    }

    const { kittyFlags } = this.syncEncoderOptions();
    // Kitty keyboard protocol bit 1 (value 2) = REPORT_EVENTS
    if ((kittyFlags & 2) === 0) {
      return;
    }

    const key = this.mapKeyCode(event.code);
    if (key === null) return;

    const keyText = this.describeKeyText(event, this.extractModifiers(event));

    try {
      const encoded = this.encoder.encode({
        action: KeyAction.RELEASE,
        key,
        mods: keyText.mods,
        utf8: keyText.utf8,
        unshiftedCodepoint: keyText.unshiftedCodepoint,
        consumedMods: keyText.consumedMods,
      });
      const data = new TextDecoder().decode(encoded);
      if (data.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        this.onDataCallback(data);
      }
    } catch (error) {
      console.warn('Failed to encode key release:', event.code, error);
    }
  }

  /**
   * Handle paste event from clipboard
   * @param event - ClipboardEvent
   */
  private handlePaste(event: ClipboardEvent): void {
    if (this.isDisposed) return;

    // Prevent default paste behavior
    event.preventDefault();
    event.stopPropagation();

    // Get clipboard data
    const clipboardData = event.clipboardData;
    if (!clipboardData) {
      console.warn('No clipboard data available');
      return;
    }

    // Get text from clipboard
    const text = clipboardData.getData('text/plain');
    if (!text) {
      // Emit 0x16 only when clipboard has non-text content (e.g. an image)
      // and an application is expected to read the clipboard itself.
      if (
        clipboardData.types &&
        clipboardData.types.length > 0 &&
        !clipboardData.types.includes('text/plain')
      ) {
        this.onDataCallback('\x16');
      } else {
        console.warn('No text in clipboard');
      }
      return;
    }

    if (this.shouldIgnorePasteEvent(text, 'paste')) {
      return;
    }

    this.emitPasteData(text);
    this.recordPasteData(text, 'paste');
  }

  /**
   * Handle beforeinput event (mobile/IME input)
   * @param event - InputEvent
   */
  private handleBeforeInput(event: InputEvent): void {
    if (this.isDisposed) return;

    if (this.isComposing || event.isComposing) {
      return;
    }

    const inputType = event.inputType;
    const data = event.data ?? '';
    let output: string | null = null;

    switch (inputType) {
      case 'insertText':
      case 'insertReplacementText':
        output = data.length > 0 ? data.replace(/\n/g, '\r') : null;
        break;
      case 'insertLineBreak':
      case 'insertParagraph':
        output = '\r';
        break;
      case 'deleteContentBackward':
        output = '\x7F';
        break;
      case 'deleteContentForward':
        output = '\x1B[3~';
        break;
      case 'insertFromPaste':
        if (!data) {
          return;
        }
        if (this.shouldIgnorePasteEvent(data, 'beforeinput')) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.emitPasteData(data);
        this.recordPasteData(data, 'beforeinput');
        return;
      default:
        return;
    }

    if (!output) {
      return;
    }

    if (this.shouldIgnoreBeforeInput(output)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (data && this.shouldIgnoreBeforeInputFromComposition(data)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.onDataCallback(output);
    if (data) {
      this.recordBeforeInputData(data);
    }
  }

  /**
   * Handle compositionstart event
   */
  private handleCompositionStart(_event: CompositionEvent): void {
    if (this.isDisposed) return;
    this.isComposing = true;
  }

  /**
   * Handle compositionupdate event
   */
  private handleCompositionUpdate(_event: CompositionEvent): void {
    if (this.isDisposed) return;
    // We could track the current composition string here if we wanted to
    // display it in a custom way, but for now we rely on the browser's
    // input method editor UI.
  }

  /**
   * Handle compositionend event
   */
  private handleCompositionEnd(event: CompositionEvent): void {
    if (this.isDisposed) return;
    this.isComposing = false;

    const data = event.data;
    if (data && data.length > 0) {
      if (this.shouldIgnoreCompositionEnd(data)) {
        this.cleanupCompositionTextNodes();
        return;
      }
      this.onDataCallback(data);
      this.recordCompositionData(data);
    }

    this.cleanupCompositionTextNodes();
  }

  /**
   * Cleanup text nodes in container after composition
   */
  private cleanupCompositionTextNodes(): void {
    // Cleanup text nodes in container (fix for duplicate text display)
    // When the container is contenteditable, the browser might insert text nodes
    // upon composition end. We need to remove them to prevent duplicate display.
    if (this.container && this.container.childNodes) {
      for (let i = this.container.childNodes.length - 1; i >= 0; i--) {
        const node = this.container.childNodes[i];
        // Node.TEXT_NODE === 3
        if (node.nodeType === 3) {
          this.container.removeChild(node);
        }
      }
    }
  }

  // ==========================================================================
  // Mouse Event Handling (for terminal mouse tracking)
  // ==========================================================================

  /**
   * Convert a pointer position to the terminal cell under it (1-based) and
   * the pointer's offset inside that cell in pixels. Uses the renderer's
   * fractional cell metrics so wide terminals do not drift by a column, and
   * maps visual to logical columns on BiDi rows.
   */
  private pixelToCell(
    event: MouseEvent
  ): { col: number; row: number; xInCell: number; yInCell: number } | null {
    if (!this.mouseConfig) return null;

    const dims = this.mouseConfig.getCellDimensions();
    const offset = this.mouseConfig.getCanvasOffset();

    if (dims.width <= 0 || dims.height <= 0) return null;

    const x = event.clientX - offset.left;
    const y = event.clientY - offset.top;

    let col = Math.floor(x / dims.width);
    const row = Math.floor(y / dims.height);
    const xInCell = x - col * dims.width;
    const yInCell = y - row * dims.height;
    if (this.mouseConfig.visualToLogicalCol && col >= 0 && row >= 0) {
      col = this.mouseConfig.visualToLogicalCol(col, row);
    }

    // Convert to 1-based cell coordinates (terminal uses 1-based)
    return {
      col: Math.max(1, col + 1),
      row: Math.max(1, row + 1),
      xInCell,
      yInCell,
    };
  }

  /** GhosttyMods for a mouse event; upstream turns these into the report's modifier bits. */
  private mouseMods(event: MouseEvent): number {
    let mods = Mods.NONE;
    if (event.shiftKey) mods |= Mods.SHIFT;
    if (event.ctrlKey) mods |= Mods.CTRL;
    if (event.altKey) mods |= Mods.ALT;
    if (event.metaKey) mods |= Mods.SUPER;
    return mods;
  }

  /** DOM button index to the upstream button; back/forward are xterm buttons 8 and 9. */
  private static readonly DOM_BUTTONS: readonly MouseButton[] = [
    MouseButton.LEFT,
    MouseButton.MIDDLE,
    MouseButton.RIGHT,
    MouseButton.EIGHT,
    MouseButton.NINE,
  ];

  /** The button to report with drag motion: left, then middle, then right; null when none is held. */
  private heldButton(): MouseButton | null {
    if (this.mouseButtonsPressed & 1) return MouseButton.LEFT;
    if (this.mouseButtonsPressed & 2) return MouseButton.MIDDLE;
    if (this.mouseButtonsPressed & 4) return MouseButton.RIGHT;
    return null;
  }

  /**
   * Encode a mouse report through libghostty-vt and send it. The encoder reads
   * the tracking mode and format from the terminal, drops events the mode does
   * not report, and deduplicates motion within a cell. Returns false when the
   * event could not be mapped to a cell.
   */
  private reportMouse(action: MouseAction, button: MouseButton | null, event: MouseEvent): boolean {
    const term = this.getTerminalCallback?.();
    if (!term) return false;
    const cell = this.pixelToCell(event);
    if (!cell) return false;
    const bytes = term.encodeMouse({
      action,
      button,
      mods: this.mouseMods(event),
      col: cell.col - 1,
      row: cell.row - 1,
      xInCell: cell.xInCell,
      yInCell: cell.yInCell,
      anyButtonPressed: this.mouseButtonsPressed !== 0,
    });
    if (bytes.length > 0) this.onDataCallback(new TextDecoder().decode(bytes));
    return true;
  }

  /**
   * Handle mousedown event
   */
  private handleMouseDown(event: MouseEvent): void {
    if (this.isDisposed) return;
    if (!this.mouseConfig?.hasMouseTracking()) return;
    // Shift bypasses mouse reporting so the user can select text locally.
    if (event.shiftKey) return;

    this.mouseButtonsPressed |= 1 << event.button;
    const button = InputHandler.DOM_BUTTONS[event.button] ?? MouseButton.UNKNOWN;
    this.reportMouse(MouseAction.PRESS, button, event);
  }

  /**
   * Handle mouseup event
   */
  private handleMouseUp(event: MouseEvent): void {
    if (this.isDisposed) return;
    // Only a press we reported gets a release. Forget the button even if the
    // program stopped tracking mid-drag, so later motion is not seen as a drag.
    const bit = 1 << event.button;
    if ((this.mouseButtonsPressed & bit) === 0) return;
    this.mouseButtonsPressed &= ~bit;
    if (!this.mouseConfig?.hasMouseTracking()) return;

    const button = InputHandler.DOM_BUTTONS[event.button] ?? MouseButton.UNKNOWN;
    this.reportMouse(MouseAction.RELEASE, button, event);
  }

  /**
   * Handle mousemove event. Whether motion is reported at all (modes 1002 and
   * 1003) and same-cell deduplication are decided by the encoder.
   */
  private handleMouseMove(event: MouseEvent): void {
    if (this.isDisposed) return;
    if (!this.mouseConfig?.hasMouseTracking()) return;
    // A Shift-drag is a local selection, unless it continues a reported drag.
    if (event.shiftKey && this.mouseButtonsPressed === 0) return;

    this.reportMouse(MouseAction.MOTION, this.heldButton(), event);
  }

  /**
   * Handle wheel event (scroll): buttons 4/5 vertically, 6/7 horizontally.
   */
  private handleWheel(event: WheelEvent): void {
    if (this.isDisposed) return;
    if (!this.mouseConfig?.hasMouseTracking()) return;

    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const button = horizontal
      ? event.deltaX < 0
        ? MouseButton.SIX
        : MouseButton.SEVEN
      : event.deltaY < 0
        ? MouseButton.FOUR
        : MouseButton.FIVE;
    if (!this.reportMouse(MouseAction.PRESS, button, event)) return;

    // Prevent default scrolling when mouse tracking is active
    event.preventDefault();
  }

  /**
   * Route pasted text. The terminal pastes through libghostty-vt (bracketed
   * paste framing, Kitty paste events, unsafe-byte replacement); without an
   * onPaste callback the raw text is sent as typed input.
   */
  private emitPasteData(text: string): void {
    if (this.onPasteCallback) this.onPasteCallback(text);
    else this.onDataCallback(text);
  }

  /**
   * Record keydown data for beforeinput de-duplication
   */
  private recordKeyDownData(data: string): void {
    this.lastKeyDownData = data;
    this.lastKeyDownTime = this.getNow();
  }

  /**
   * Record paste data for beforeinput de-duplication
   */
  private recordPasteData(data: string, source: 'paste' | 'beforeinput'): void {
    this.lastPasteData = data;
    this.lastPasteTime = this.getNow();
    this.lastPasteSource = source;
  }

  /**
   * Check if beforeinput should be ignored due to a recent keydown
   */
  private shouldIgnoreBeforeInput(data: string): boolean {
    if (!this.lastKeyDownData) {
      return false;
    }
    const now = this.getNow();
    const isDuplicate =
      now - this.lastKeyDownTime < InputHandler.BEFORE_INPUT_IGNORE_MS &&
      this.lastKeyDownData === data;
    this.lastKeyDownData = null;
    return isDuplicate;
  }

  /**
   * Check if beforeinput text should be ignored due to a recent composition end
   */
  private shouldIgnoreBeforeInputFromComposition(data: string): boolean {
    if (!this.lastCompositionData) {
      return false;
    }
    const now = this.getNow();
    const isDuplicate =
      now - this.lastCompositionTime < InputHandler.BEFORE_INPUT_IGNORE_MS &&
      this.lastCompositionData === data;
    if (isDuplicate) {
      this.lastCompositionData = null;
    }
    return isDuplicate;
  }

  /**
   * Check if composition end should be ignored due to a recent beforeinput text
   */
  private shouldIgnoreCompositionEnd(data: string): boolean {
    if (!this.lastBeforeInputData) {
      return false;
    }
    const now = this.getNow();
    const isDuplicate =
      now - this.lastBeforeInputTime < InputHandler.BEFORE_INPUT_IGNORE_MS &&
      this.lastBeforeInputData === data;
    if (isDuplicate) {
      this.lastBeforeInputData = null;
    }
    return isDuplicate;
  }

  /**
   * Record beforeinput text for composition de-duplication
   */
  private recordBeforeInputData(data: string): void {
    this.lastBeforeInputData = data;
    this.lastBeforeInputTime = this.getNow();
  }

  /**
   * Record composition end data for beforeinput de-duplication
   */
  private recordCompositionData(data: string): void {
    this.lastCompositionData = data;
    this.lastCompositionTime = this.getNow();
  }

  /**
   * Check if paste should be ignored due to a recent paste event from another source
   */
  private shouldIgnorePasteEvent(data: string, source: 'paste' | 'beforeinput'): boolean {
    if (!this.lastPasteData) {
      return false;
    }
    if (this.lastPasteSource === source) {
      return false;
    }
    const now = this.getNow();
    const isDuplicate =
      now - this.lastPasteTime < InputHandler.BEFORE_INPUT_IGNORE_MS && this.lastPasteData === data;
    if (isDuplicate) {
      this.lastPasteData = null;
      this.lastPasteSource = null;
    }
    return isDuplicate;
  }

  /**
   * Get current time in milliseconds
   */
  private getNow(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  /**
   * Dispose the InputHandler and remove event listeners
   */
  dispose(): void {
    if (this.isDisposed) return;

    if (this.keydownListener) {
      this.container.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }

    if (this.keyupListener) {
      this.container.removeEventListener('keyup', this.keyupListener);
      this.keyupListener = null;
    }

    if (this.keypressListener) {
      this.container.removeEventListener('keypress', this.keypressListener);
      this.keypressListener = null;
    }

    if (this.pasteListener) {
      this.container.removeEventListener('paste', this.pasteListener);
      if (this.inputElement && this.inputElement !== this.container) {
        this.inputElement.removeEventListener('paste', this.pasteListener);
      }
      this.pasteListener = null;
    }

    if (this.beforeInputListener && this.inputElement) {
      this.inputElement.removeEventListener('beforeinput', this.beforeInputListener);
      this.beforeInputListener = null;
    }

    if (this.compositionStartListener) {
      this.container.removeEventListener('compositionstart', this.compositionStartListener);
      this.compositionStartListener = null;
    }

    if (this.compositionUpdateListener) {
      this.container.removeEventListener('compositionupdate', this.compositionUpdateListener);
      this.compositionUpdateListener = null;
    }

    if (this.compositionEndListener) {
      this.container.removeEventListener('compositionend', this.compositionEndListener);
      this.compositionEndListener = null;
    }

    if (this.mousedownListener) {
      this.container.removeEventListener('mousedown', this.mousedownListener);
      this.mousedownListener = null;
    }

    if (this.mouseupListener) {
      this.container.removeEventListener('mouseup', this.mouseupListener);
      this.mouseupListener = null;
    }

    if (this.mousemoveListener) {
      this.container.removeEventListener('mousemove', this.mousemoveListener);
      this.mousemoveListener = null;
    }

    if (this.wheelListener) {
      this.container.removeEventListener('wheel', this.wheelListener);
      this.wheelListener = null;
    }

    this.isDisposed = true;
  }

  /**
   * Check if handler is disposed
   */
  isActive(): boolean {
    return !this.isDisposed;
  }
}
