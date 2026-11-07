/**
 * TypeScript wrapper for libghostty-vt WASM API
 *
 * High-performance terminal emulation using Ghostty's battle-tested VT100 parser.
 * The key optimization is the RenderState API which provides a pre-computed
 * snapshot of all render data in a single update call.
 */

import { RenderImages } from './render-images';

import { decode as decodePng } from 'fast-png';
import {
  GhosttyBuildInfo,
  GhosttyClipboardContentLayout,
  GhosttyClipboardReadLayout,
  GhosttyClipboardReadReplyLayout,
  GhosttyClipboardReadResult,
  GhosttyClipboardWriteLayout,
  GhosttyClipboardWriteReplyLayout,
  GhosttyClipboardWriteResult,
  GhosttyCodepointBufferLayout,
  GhosttyColorRgbLayout,
  GhosttyColorScheme,
  GhosttyGridRefLayout,
  GhosttyKittyGraphicsPlacementRenderInfoLayout,
  GhosttyOptimizeMode,
  GhosttyPointCoordinateLayout,
  GhosttyPointLayout,
  GhosttyPointValueLayout,
  GhosttyResult,
  GhosttySizeReportSizeLayout,
  GhosttyStringLayout,
  GhosttyStyleColorLayout,
  GhosttyStyleColorTag,
  GhosttyStyleLayout,
  GhosttySysImageLayout,
  GhosttyTerminalDesktopNotificationLayout,
  GhosttyTerminalModeConfigLayout,
  GhosttyTerminalProgramStatusLayout,
  GhosttyTerminalProgressReportLayout,
  GhosttyTerminalResizeWindowGridLayout,
  GhosttyTerminalResizeWindowLayout,
  GhosttyTerminalResizeWindowTag,
  GhosttyTerminalResizeWindowValueLayout,
  GhosttyTerminalSemanticPromptLayout,
} from './ghostty-abi';
import {
  CellData,
  CellFlags,
  CellWide,
  type ClipboardContent,
  type ClipboardReadHandler,
  type ClipboardWriteEvent,
  type ClipboardWriteResult,
  type ColorScheme,
  type Cursor,
  CursorVisualStyle,
  type DesktopNotification,
  DirtyState,
  type GhosttyCell,
  type GhosttyTerminalConfig,
  type GhosttyWasmExports,
  KeyEncoderOption,
  type KeyEvent,
  KittyGraphicsData,
  KittyGraphicsImageData,
  KittyGraphicsPlacementData,
  type KittyImageFormat,
  type KittyImagePixels,
  type KittyKeyFlags,
  type KittyPlacementInfo,
  type LibghosttyBuildInfo,
  PointTag,
  type ProgramStatusReport,
  type ProgressReport,
  type RGB,
  type RenderStateColors,
  type RenderStateCursor,
  RenderStateData,
  RenderStateOption,
  RenderStateRowData,
  RenderStateRowOption,
  type ResizeRequest,
  RowCellsData,
  RowData,
  type SemanticPromptEvent,
  StyleFlag,
  SysOption,
  TerminalData,
  type TerminalHandle,
  TerminalOption,
  TerminalScreen,
  packMode,
} from './types';
import {
  type ColorSchemeCallback,
  type DecodePngCallback,
  type NotifyCallback,
  type PayloadCallback,
  type ProgramStatusCallback,
  type ReadSharedMemoryCallback,
  type RenderHoldCallback,
  type SizeCallback,
  type WritePtyCallback,
  makeCallbackTrampolines,
} from './write_pty_trampoline';

// Re-export types for convenience
export {
  CellFlags,
  type Cursor,
  DirtyState,
  type GhosttyCell,
  type GhosttyTerminalConfig,
  KeyEncoderOption,
  type RGB,
  type RenderStateColors,
  type RenderStateCursor,
};

/**
 * Main Ghostty WASM wrapper class
 */
export class Ghostty {
  private exports: GhosttyWasmExports;
  private memory: WebAssembly.Memory;
  private cachedBuildInfo?: LibghosttyBuildInfo;

  constructor(wasmInstance: WebAssembly.Instance) {
    this.exports = wasmInstance.exports as GhosttyWasmExports;
    this.memory = this.exports.memory;
  }

  /** Version of the loaded libghostty-vt (`ghostty_version()`), e.g. "1.0.0". */
  get version(): string {
    const ptr = this.exports.ghostty_version();
    const bytes = new Uint8Array(this.memory.buffer);
    let end = ptr;
    while (bytes[end] !== 0) end++;
    return new TextDecoder().decode(bytes.subarray(ptr, end));
  }

  /** Compile-time configuration of the loaded library (`ghostty_build_info()`). */
  get buildInfo(): LibghosttyBuildInfo {
    this.cachedBuildInfo ??= this.readBuildInfo();
    return this.cachedBuildInfo;
  }

  private readBuildInfo(): LibghosttyBuildInfo {
    // Every output type fits in a GhosttyString (the largest, 8 bytes).
    const out = this.exports.ghostty_wasm_alloc(GhosttyStringLayout.size);
    const query = (key: GhosttyBuildInfo): DataView => {
      const view = new DataView(this.memory.buffer);
      view.setUint32(out, 0, true);
      view.setUint32(out + 4, 0, true);
      const r = this.exports.ghostty_build_info(key, out);
      if (r !== GhosttyResult.SUCCESS) {
        throw new Error(`ghostty_build_info(${GhosttyBuildInfo[key]}) failed: ${GhosttyResult[r]}`);
      }
      return new DataView(this.memory.buffer);
    };
    const flag = (key: GhosttyBuildInfo) => query(key).getUint8(out) !== 0;
    const size = (key: GhosttyBuildInfo) => query(key).getUint32(out, true);
    const string = (key: GhosttyBuildInfo) => {
      const view = query(key);
      const ptr = view.getUint32(out + GhosttyStringLayout.offset.ptr, true);
      const len = view.getUint32(out + GhosttyStringLayout.offset.len, true);
      return len === 0
        ? ''
        : new TextDecoder().decode(new Uint8Array(this.memory.buffer, ptr, len));
    };
    const optimizeNames = {
      [GhosttyOptimizeMode.DEBUG]: 'debug',
      [GhosttyOptimizeMode.RELEASE_SAFE]: 'release_safe',
      [GhosttyOptimizeMode.RELEASE_SMALL]: 'release_small',
      [GhosttyOptimizeMode.RELEASE_FAST]: 'release_fast',
    } as const;
    try {
      const optimize = query(GhosttyBuildInfo.OPTIMIZE).getInt32(out, true) as GhosttyOptimizeMode;
      return {
        version: string(GhosttyBuildInfo.VERSION_STRING),
        major: size(GhosttyBuildInfo.VERSION_MAJOR),
        minor: size(GhosttyBuildInfo.VERSION_MINOR),
        patch: size(GhosttyBuildInfo.VERSION_PATCH),
        pre: string(GhosttyBuildInfo.VERSION_PRE),
        build: string(GhosttyBuildInfo.VERSION_BUILD),
        optimize: optimizeNames[optimize],
        simd: flag(GhosttyBuildInfo.SIMD),
        features: {
          kittyGraphics: flag(GhosttyBuildInfo.KITTY_GRAPHICS),
          tmuxControlMode: flag(GhosttyBuildInfo.TMUX_CONTROL_MODE),
          snapshot: flag(GhosttyBuildInfo.FEATURE_SNAPSHOT),
          formatter: flag(GhosttyBuildInfo.FEATURE_FORMATTER),
          selection: flag(GhosttyBuildInfo.FEATURE_SELECTION),
          search: flag(GhosttyBuildInfo.FEATURE_SEARCH),
          renderState: flag(GhosttyBuildInfo.FEATURE_RENDER_STATE),
          inputEncode: flag(GhosttyBuildInfo.FEATURE_INPUT_ENCODE),
          color: flag(GhosttyBuildInfo.FEATURE_COLOR),
          gridIntrospection: flag(GhosttyBuildInfo.FEATURE_GRID_INTROSPECTION),
          glyphProtocol: flag(GhosttyBuildInfo.FEATURE_GLYPH_PROTOCOL),
        },
      };
    } finally {
      this.exports.ghostty_wasm_free(out, GhosttyStringLayout.size);
    }
  }

  createKeyEncoder(): KeyEncoder {
    return new KeyEncoder(this.exports);
  }

  createTerminal(
    cols: number = 80,
    rows: number = 24,
    config?: GhosttyTerminalConfig
  ): GhosttyTerminal {
    return new GhosttyTerminal(this.exports, this.memory, cols, rows, config);
  }

  static async load(wasmPath?: string): Promise<Ghostty> {
    // If explicit path provided, use it
    if (wasmPath) {
      return Ghostty.loadFromPath(wasmPath);
    }

    // Resolve path relative to this module
    const moduleUrl = new URL('../ghostty-vt.wasm', import.meta.url);

    // Build paths to try, prioritizing file system paths for Node/Bun
    const defaultPaths: string[] = [];

    // For Node/Bun: try absolute file path first (strip file:// protocol)
    if (moduleUrl.protocol === 'file:') {
      let filePath = moduleUrl.pathname;
      // Remove leading slash on Windows paths (e.g., /C:/ -> C:/)
      if (filePath.match(/^\/[A-Za-z]:\//)) {
        filePath = filePath.slice(1);
      }
      defaultPaths.push(filePath);
    }

    // Also try other common paths
    defaultPaths.push(moduleUrl.href, './ghostty-vt.wasm', '/ghostty-vt.wasm');

    let lastError: Error | null = null;
    for (const path of defaultPaths) {
      try {
        return await Ghostty.loadFromPath(path);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastError || new Error('Failed to load Ghostty WASM');
  }

  private static async loadFromPath(path: string): Promise<Ghostty> {
    let wasmBytes: ArrayBuffer | undefined;

    // Try Bun.file first (for Bun environments)
    if (typeof Bun !== 'undefined' && typeof Bun.file === 'function') {
      try {
        const file = Bun.file(path);
        if (await file.exists()) {
          wasmBytes = await file.arrayBuffer();
        }
      } catch {
        // Bun.file failed, try next method
      }
    }

    // Try Node.js fs module if Bun.file didn't work
    if (!wasmBytes) {
      try {
        const fs = await import('fs/promises');
        const buffer = await fs.readFile(path);
        wasmBytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      } catch {
        // fs failed, try fetch
      }
    }

    // Fall back to fetch (for browser environments)
    if (!wasmBytes) {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
      }
      wasmBytes = await response.arrayBuffer();
      if (wasmBytes.byteLength === 0) {
        throw new Error(`WASM file is empty (0 bytes). Check path: ${path}`);
      }
    }

    if (!wasmBytes) {
      throw new Error(`Could not load WASM from path: ${path}`);
    }

    const wasmModule = await WebAssembly.compile(wasmBytes);
    const wasmInstance = await WebAssembly.instantiate(wasmModule, {
      env: {
        log: (ptr: number, len: number) => {
          const bytes = new Uint8Array(
            (wasmInstance.exports as GhosttyWasmExports).memory.buffer,
            ptr,
            len
          );
          console.log('[ghostty-vt]', new TextDecoder().decode(bytes));
        },
      },
    });
    return new Ghostty(wasmInstance);
  }
}

/**
 * Key Encoder - converts keyboard events into terminal escape sequences
 */
export class KeyEncoder {
  private exports: GhosttyWasmExports;
  private encoder: number = 0;

  constructor(exports: GhosttyWasmExports) {
    this.exports = exports;
    const encoderPtrPtr = this.exports.ghostty_wasm_alloc_opaque();
    const result = this.exports.ghostty_key_encoder_new(0, encoderPtrPtr);
    if (result !== 0) throw new Error(`Failed to create key encoder: ${result}`);
    const view = new DataView(this.exports.memory.buffer);
    this.encoder = view.getUint32(encoderPtrPtr, true);
    this.exports.ghostty_wasm_free_opaque(encoderPtrPtr);
  }

  setOption(option: KeyEncoderOption, value: boolean | number): void {
    const valuePtr = this.exports.ghostty_wasm_alloc(1);
    const view = new DataView(this.exports.memory.buffer);
    view.setUint8(valuePtr, typeof value === 'boolean' ? (value ? 1 : 0) : value);
    this.exports.ghostty_key_encoder_set(this.encoder, option, valuePtr);
    this.exports.ghostty_wasm_free(valuePtr, 1);
  }

  setKittyFlags(flags: KittyKeyFlags): void {
    this.setOption(KeyEncoderOption.KITTY_FLAGS, flags);
  }

  setOptionsFromTerminal(terminalHandle: TerminalHandle): void {
    this.exports.ghostty_key_encoder_set_from_terminal(this.encoder, terminalHandle);
  }

  encode(event: KeyEvent): Uint8Array {
    const eventPtrPtr = this.exports.ghostty_wasm_alloc_opaque();
    let eventPtr = 0;
    try {
      const createResult = this.exports.ghostty_key_event_new(0, eventPtrPtr);
      if (createResult !== 0) throw new Error(`Failed to create key event: ${createResult}`);
      eventPtr = new DataView(this.exports.memory.buffer).getUint32(eventPtrPtr, true);
    } finally {
      this.exports.ghostty_wasm_free_opaque(eventPtrPtr);
    }

    let utf8Ptr = 0;
    let utf8Len = 0;
    try {
      this.exports.ghostty_key_event_set_action(eventPtr, event.action);
      this.exports.ghostty_key_event_set_key(eventPtr, event.key);
      this.exports.ghostty_key_event_set_mods(eventPtr, event.mods);

      if (event.utf8) {
        const encoder = new TextEncoder();
        const utf8Bytes = encoder.encode(event.utf8);
        utf8Len = utf8Bytes.length;
        utf8Ptr = this.exports.ghostty_wasm_alloc(utf8Len);
        new Uint8Array(this.exports.memory.buffer).set(utf8Bytes, utf8Ptr);
        // GhosttyString is passed by value; on wasm32 that is a pointer to a copy.
        const strPtr = this.exports.ghostty_wasm_alloc(GhosttyStringLayout.size);
        try {
          const sv = new DataView(this.exports.memory.buffer);
          sv.setUint32(strPtr + GhosttyStringLayout.offset.ptr, utf8Ptr, true);
          sv.setUint32(strPtr + GhosttyStringLayout.offset.len, utf8Len, true);
          this.exports.ghostty_key_event_set_utf8(eventPtr, strPtr);
        } finally {
          this.exports.ghostty_wasm_free(strPtr, GhosttyStringLayout.size);
        }
        const cp = event.utf8.codePointAt(0);
        if (cp !== undefined) {
          this.exports.ghostty_key_event_set_unshifted_codepoint?.(eventPtr, cp);
        }
      }

      const bufferSize = 32;
      const bufPtr = this.exports.ghostty_wasm_alloc(bufferSize);
      const writtenPtr = this.exports.ghostty_wasm_alloc(4);
      try {
        const encodeResult = this.exports.ghostty_key_encoder_encode(
          this.encoder,
          eventPtr,
          bufPtr,
          bufferSize,
          writtenPtr
        );

        if (encodeResult !== 0) {
          throw new Error(`Failed to encode key: ${encodeResult}`);
        }

        const bytesWritten = new DataView(this.exports.memory.buffer).getUint32(writtenPtr, true);
        return new Uint8Array(this.exports.memory.buffer, bufPtr, bytesWritten).slice();
      } finally {
        this.exports.ghostty_wasm_free(bufPtr, bufferSize);
        this.exports.ghostty_wasm_free(writtenPtr, 4);
      }
    } finally {
      if (utf8Ptr !== 0) {
        this.exports.ghostty_wasm_free(utf8Ptr, utf8Len);
      }
      this.exports.ghostty_key_event_free(eventPtr);
    }
  }

  dispose(): void {
    if (this.encoder) {
      this.exports.ghostty_key_encoder_free(this.encoder);
      this.encoder = 0;
    }
  }
}

let nextImageRevision = 0;

/**
 * GhosttyTerminal - High-performance terminal emulator
 *
 * Uses Ghostty's native RenderState for optimal performance:
 * - ONE call to update all state (renderStateUpdate)
 * - ONE call to get all cells (getViewport)
 * - No per-row WASM boundary crossings!
 */
export class GhosttyTerminal {
  private imageRevisions = new Map<number, { generation: bigint; revision: number }>();
  private imageEpoch = 0;
  private renderImages?: RenderImages;
  private lastImageFrameRevision = -1;

  private images(): RenderImages {
    this.renderImages ??= new RenderImages(
      this.exports,
      this.handle,
      this.renderHandle,
      () => {
        this.update();
      },
      () => ({ width: this.cellWidthPx, height: this.cellHeightPx }),
      (g, id) => this.getKittyImagePixels(g, id)
    );
    return this.renderImages;
  }

  getImageFrame(viewportY = 0) {
    const frame = this.images().getFrame(this.imageEpoch, viewportY);
    if (frame.revision !== this.lastImageFrameRevision) {
      const ids = new Set(frame.placements.map((p) => p.imageId));
      for (const id of this.imageRevisions.keys()) if (!ids.has(id)) this.imageRevisions.delete(id);
      this.lastImageFrameRevision = frame.revision;
    }
    return frame;
  }

  tickImageAnimations(now: number): number | null {
    const result = this.images().tick(now);
    if (result.changed) this.imageEpoch++;
    return result.next;
  }

  private exports: GhosttyWasmExports;
  private memory: WebAssembly.Memory;
  private handle: TerminalHandle;
  private renderHandle: number = 0;
  private rowIter: number = 0;
  private rowCells: number = 0;
  private _cols: number;
  private _rows: number;

  /** Cell pool for zero-allocation rendering */
  private cellPool: GhosttyCell[] = [];

  /**
   * Cell pixel dimensions last pushed to the WASM terminal via
   * ghostty_terminal_resize. Zero means "unknown / disabled" — kitty
   * graphics image sizing and CSI 14/16/18 t in-band size reports will
   * return zero/no-op until setCellPixelSize() is called with real values.
   */
  private cellWidthPx = 0;
  private cellHeightPx = 0;

  /**
   * Per-row dirty state for the current render-state snapshot. Cleared on
   * update() and populated lazily by isRowDirty() (or as a side effect of
   * getViewport, which iterates rows anyway).
   */
  private rowDirtyCache: boolean[] | null = null;

  /**
   * Per-row soft-wrap state for the current render-state snapshot. Same
   * lifecycle as rowDirtyCache; the two caches are filled in lockstep.
   */
  private rowWrapCache: boolean[] | null = null;

  /**
   * Bytes the terminal would have written back to a real PTY in response
   * to query sequences (DSR, XTVERSION, in-band size reports, ...).
   * Captured by the WRITE_PTY callback installed in the constructor and
   * drained by readResponse(). Each slot is one callback invocation, so
   * a single response sequence may span multiple slots.
   */
  private pendingResponses: Uint8Array[] = [];
  private pendingProgramStatus: ProgramStatusReport[] = [];
  private programStatusHandler?: (report: ProgramStatusReport) => void;
  private pendingBells = 0;
  private pendingTitleChanges: string[] = [];
  private bellHandler?: () => void;
  private titleChangeHandler?: (title: string) => void;
  private renderHoldHandler?: (held: boolean) => void;

  // libghostty-vt 1.0 effect callbacks. Payload callbacks are copied out
  // inside the WASM callback and delivered after write() returns, like
  // bells and title changes, so listeners may write, reset or dispose.
  /** Decides a clipboard write synchronously, inside the WASM callback. */
  private clipboardWritePolicy?: (event: ClipboardWriteEvent) => ClipboardWriteResult;
  private clipboardWriteHandler?: (event: ClipboardWriteEvent) => void;
  private pendingClipboardWrites: ClipboardWriteEvent[] = [];
  /** Answers clipboard reads synchronously, inside the WASM callback. */
  private clipboardReadHandler?: ClipboardReadHandler;
  private pwdChangeHandler?: (pwd: string) => void;
  private pendingPwdChanges: string[] = [];
  private notificationHandler?: (notification: DesktopNotification) => void;
  private pendingNotifications: DesktopNotification[] = [];
  private progressHandler?: (report: ProgressReport) => void;
  private pendingProgress: ProgressReport[] = [];
  private semanticPromptHandler?: (event: SemanticPromptEvent) => void;
  private pendingSemanticPrompts: SemanticPromptEvent[] = [];
  private resizeRequestHandler?: (request: ResizeRequest) => void;
  private pendingResizeRequests: ResizeRequest[] = [];
  /** Answers CSI ? 996 n synchronously; undefined ignores the query. */
  private colorSchemeProvider?: () => ColorScheme;
  private renderHeld = false;
  private hasCapturedHoldFrame = false;
  private hyperlinkIdsByUri = new Map<string, number>();
  private nextHyperlinkId = 1;

  /** Return the raw WASM terminal handle. */
  getHandle(): TerminalHandle {
    return this.handle;
  }

  /** Enable OSC 7501 reports and capability replies only while a consumer is installed. */
  setProgramStatusHandler(handler?: (report: ProgramStatusReport) => void): void {
    const result = this.exports.ghostty_terminal_set(
      this.handle,
      TerminalOption.PROGRAM_STATUS,
      handler ? this.callbackRegistry!.programStatusIndex : 0
    );
    if (result !== 0) throw new Error(`Installing program status callback failed: ${result}`);
    this.programStatusHandler = handler;
  }

  setBellHandler(handler?: () => void): void {
    this.bellHandler = handler;
  }

  setTitleChangeHandler(handler?: (title: string) => void): void {
    this.titleChangeHandler = handler;
  }

  setRenderHoldHandler(handler?: (held: boolean) => void): void {
    this.renderHoldHandler = handler;
  }

  /**
   * Decide OSC 52 / OSC 5522 clipboard writes. Runs inside the WASM callback,
   * so it must not write to or dispose the terminal. Without a policy every
   * write is denied. Events for accepted writes are delivered to the handler
   * set with setClipboardWriteHandler() after the current write() returns.
   */
  setClipboardWritePolicy(policy?: (event: ClipboardWriteEvent) => ClipboardWriteResult): void {
    this.clipboardWritePolicy = policy;
  }

  setClipboardWriteHandler(handler?: (event: ClipboardWriteEvent) => void): void {
    this.clipboardWriteHandler = handler;
  }

  /**
   * Answer OSC 52 "?" / OSC 5522 clipboard reads. The callback is only
   * installed while a handler is set; without one upstream answers reads
   * with an empty clipboard. Installing it also enables Kitty paste events
   * (mode 5522) for programs that opt in.
   */
  setClipboardReadHandler(handler?: ClipboardReadHandler): void {
    this.clipboardReadHandler = handler;
    if (!this.callbackRegistry) return;
    this.exports.ghostty_terminal_set(
      this.handle,
      TerminalOption.CLIPBOARD_READ,
      handler ? this.callbackRegistry.clipboardReadIndex : 0
    );
  }

  setPwdChangeHandler(handler?: (pwd: string) => void): void {
    this.pwdChangeHandler = handler;
  }

  setNotificationHandler(handler?: (notification: DesktopNotification) => void): void {
    this.notificationHandler = handler;
  }

  setProgressHandler(handler?: (report: ProgressReport) => void): void {
    this.progressHandler = handler;
  }

  setSemanticPromptHandler(handler?: (event: SemanticPromptEvent) => void): void {
    this.semanticPromptHandler = handler;
  }

  setResizeRequestHandler(handler?: (request: ResizeRequest) => void): void {
    this.resizeRequestHandler = handler;
  }

  /** Answer CSI ? 996 n color scheme queries. Runs inside the WASM callback. */
  setColorSchemeProvider(provider?: () => ColorScheme): void {
    this.colorSchemeProvider = provider;
  }

  isRenderHeld(): boolean {
    return this.renderHeld;
  }

  hasPendingHoldSnapshot(): boolean {
    return this.hasCapturedHoldFrame;
  }

  releaseRenderHold(): void {
    this.renderHeld = false;
    this.hasCapturedHoldFrame = false;
  }

  getTitle(): string {
    return this.getStringData(TerminalData.TITLE);
  }

  /**
   * The working directory the shell last reported (OSC 7, OSC 9;9 or
   * OSC 1337 CurrentDir), as raw bytes: a file:// URI for OSC 7, usually a
   * bare path otherwise. Empty when none was reported or it was cleared.
   */
  getPwd(): string {
    return this.getStringData(TerminalData.PWD);
  }

  /** Read a GhosttyString-valued terminal_get key, copying it out of WASM memory. */
  private getStringData(key: TerminalData): string {
    const strPtr = this.exports.ghostty_wasm_alloc(GhosttyStringLayout.size);
    try {
      const r = this.exports.ghostty_terminal_get(this.handle, key, strPtr);
      if (r !== 0) return '';
      const view = new DataView(this.memory.buffer);
      const ptr = view.getUint32(strPtr + GhosttyStringLayout.offset.ptr, true);
      const len = view.getUint32(strPtr + GhosttyStringLayout.offset.len, true);
      if (ptr === 0 || len === 0) return '';
      return new TextDecoder().decode(new Uint8Array(this.memory.buffer, ptr, len).slice());
    } finally {
      this.exports.ghostty_wasm_free(strPtr, GhosttyStringLayout.size);
    }
  }

  private handleRenderHold(held: boolean): void {
    if (held) {
      // Snapshot the completed pre-hold screen state before any post-BSU
      // bytes mutate the terminal grid.
      const r = this.exports.ghostty_render_state_update(this.renderHandle, this.handle);
      if (r === 0) {
        this.rowDirtyCache = null;
        this.rowWrapCache = null;
        const dirty = this.rsGetU32(RenderStateData.DIRTY) as DirtyState;
        if (dirty !== DirtyState.FALSE) {
          this.hasCapturedHoldFrame = true;
        }
      }
      this.renderHeld = true;
    } else {
      this.renderHeld = false;
      this.hasCapturedHoldFrame = false;
    }
    this.renderHoldHandler?.(held);
  }

  private internHyperlinkUri(uri: string | null): number {
    if (!uri) return 0;
    let id = this.hyperlinkIdsByUri.get(uri);
    if (id === undefined) {
      id = this.nextHyperlinkId;
      this.nextHyperlinkId = this.nextHyperlinkId >= 0xffff ? 1 : this.nextHyperlinkId + 1;
      this.hyperlinkIdsByUri.set(uri, id);
    }
    return id;
  }

  /**
   * Per-table registry for callback trampolines. Keyed on the WASM
   * module's __indirect_function_table so that multiple Ghostty.load()
   * instances each get their own trampoline slots and routing map —
   * terminal handles are only unique within a single WASM instance, and
   * indices into one module's table are meaningless in another.
   *
   * One set of trampolines is installed per table; their slot indices live
   * here alongside the routing map. The dispatchers close over the same
   * instancesByHandle so any GhosttyTerminal coming from this WASM module
   * routes correctly.
   */
  private static callbackRegistries = new WeakMap<
    WebAssembly.Table,
    {
      writePtyIndex: number;
      sizeIndex: number;
      decodePngIndex: number;
      readShmIndex: number;
      programStatusIndex: number;
      bellIndex: number;
      titleChangedIndex: number;
      renderHoldIndex: number;
      clipboardWriteIndex: number;
      clipboardReadIndex: number;
      pwdChangedIndex: number;
      desktopNotificationIndex: number;
      progressReportIndex: number;
      semanticPromptIndex: number;
      resizeWindowIndex: number;
      colorSchemeIndex: number;
      instancesByHandle: Map<number, GhosttyTerminal>;
    }
  >();

  /**
   * Cached pointer to this terminal's registry. We only need it to
   * deregister cleanly in free() / cleanupOnConstructorFailure().
   */
  private callbackRegistry?: {
    writePtyIndex: number;
    sizeIndex: number;
    decodePngIndex: number;
    readShmIndex: number;
    programStatusIndex: number;
    bellIndex: number;
    titleChangedIndex: number;
    renderHoldIndex: number;
    clipboardWriteIndex: number;
    clipboardReadIndex: number;
    pwdChangedIndex: number;
    desktopNotificationIndex: number;
    progressReportIndex: number;
    semanticPromptIndex: number;
    resizeWindowIndex: number;
    colorSchemeIndex: number;
    instancesByHandle: Map<number, GhosttyTerminal>;
  };

  constructor(
    exports: GhosttyWasmExports,
    memory: WebAssembly.Memory,
    cols: number = 80,
    rows: number = 24,
    config?: GhosttyTerminalConfig
  ) {
    this.exports = exports;
    this.memory = memory;
    this._cols = cols;
    this._rows = rows;

    const termPtrPtr = this.exports.ghostty_wasm_alloc_opaque();
    if (termPtrPtr === 0) throw new Error('Failed to allocate terminal handle');
    try {
      const result = this.exports.ghostty_terminal_new(0, termPtrPtr, cols, rows);
      if (result !== 0) throw new Error(`ghostty_terminal_new failed: ${result}`);
      this.handle = new DataView(this.memory.buffer).getUint32(termPtrPtr, true);
    } finally {
      this.exports.ghostty_wasm_free_opaque(termPtrPtr);
    }

    if (!this.handle) throw new Error('Failed to create terminal');

    // Everything below could fail; if it does we need to undo the
    // post-terminal_new init (registry entry, callback wiring) in
    // addition to the WASM resource frees that cleanupOnConstructorFailure
    // already handles.
    try {
      // Install the trampoline callbacks so the terminal can deliver
      // response bytes (DSR, XTVERSION, etc.) back to JS via WRITE_PTY,
      // and so the embedder can answer XTWINOPS size queries (CSI 14/16/18 t)
      // via SIZE. Resolves / creates the per-table registry on first
      // use, registers `this` in it, then sets the options on the terminal.
      this.installCallbacks();

      // Apply theme colors + palette overrides. The constructor only
      // carries cols/rows, so colors land here via
      // ghostty_terminal_set(COLOR_*).
      if (config) this.applyConfig(config);
      // Upstream defaults to a 10,000-byte scrollback budget alongside the
      // line limit, and whichever limit is reached first wins. Lift the byte
      // budget (SIZE_MAX; since libghostty-vt 1.0 a NULL value restores the
      // default instead) so scrollbackLimit means lines, as it always has.
      const bytesPtr = this.exports.ghostty_wasm_alloc(4);
      if (!bytesPtr) throw new Error('Failed to allocate scrollback byte limit');
      let bytesResult: number;
      try {
        new DataView(this.memory.buffer).setUint32(bytesPtr, 0xffffffff, true);
        bytesResult = this.exports.ghostty_terminal_set(
          this.handle,
          TerminalOption.SCROLLBACK_MAX_BYTES,
          bytesPtr
        );
      } finally {
        this.exports.ghostty_wasm_free(bytesPtr, 4);
      }
      if (bytesResult !== 0)
        throw new Error(`Removing scrollback byte limit failed: ${bytesResult}`);
      const limitPtr = this.exports.ghostty_wasm_alloc(4);
      if (!limitPtr) throw new Error('Failed to allocate scrollback limit');
      try {
        new DataView(this.memory.buffer).setUint32(
          limitPtr,
          config?.scrollbackLimit ?? 10000,
          true
        );
        const linesResult = this.exports.ghostty_terminal_set(
          this.handle,
          TerminalOption.SCROLLBACK_MAX_LINES,
          limitPtr
        );
        if (linesResult !== 0) throw new Error(`Setting scrollback limit failed: ${linesResult}`);
      } finally {
        this.exports.ghostty_wasm_free(limitPtr, 4);
      }

      // Mode 2027 (grapheme clustering) is what lets the terminal treat
      // multi-codepoint clusters (flag emoji, ZWJ sequences, skin tones)
      // as a single cell. Coder's old C-side patch enabled it inside the
      // terminal_new() shim; the new public C ABI doesn't, so we enable
      // it here from JS to preserve coder's defaults. MODE_DEFAULT sets both
      // the current value and the value restored by RIS, so a program that
      // sends ESC c doesn't turn clustering off for the rest of the session.
      const modePtr = this.exports.ghostty_wasm_alloc(GhosttyTerminalModeConfigLayout.size);
      try {
        const view = new DataView(this.memory.buffer);
        const o = GhosttyTerminalModeConfigLayout.offset;
        view.setUint16(modePtr + o.mode, packMode(2027, false), true);
        view.setUint8(modePtr + o.value, 1);
        const modeResult = this.exports.ghostty_terminal_set(
          this.handle,
          TerminalOption.MODE_DEFAULT,
          modePtr
        );
        if (modeResult !== 0) throw new Error(`Enabling mode 2027 failed: ${modeResult}`);
      } finally {
        this.exports.ghostty_wasm_free(modePtr, GhosttyTerminalModeConfigLayout.size);
      }

      // Enable kitty graphics by giving the terminal a non-zero image
      // storage limit. The new C ABI ships kitty graphics disabled by
      // default — image transmission commands are silently dropped at
      // parse time until this limit is set. 64MB is enough for typical
      // TUI use and matches what coder's old WASM defaulted to.
      this.setKittyImageStorageLimit(64 * 1024 * 1024);
      const sharedMemPtr = this.exports.ghostty_wasm_alloc(1);
      if (sharedMemPtr === 0) throw new Error('Failed to allocate Kitty medium option');
      try {
        new Uint8Array(this.memory.buffer)[sharedMemPtr] = 1;
        const result = this.exports.ghostty_terminal_set(
          this.handle,
          TerminalOption.KITTY_IMAGE_MEDIUM_SHARED_MEM,
          sharedMemPtr
        );
        if (result !== 0) throw new Error(`Enabling Kitty shared memory failed: ${result}`);
      } finally {
        this.exports.ghostty_wasm_free(sharedMemPtr, 1);
      }
    } catch (e) {
      this.cleanupOnConstructorFailure();
      throw e;
    }

    // Create the render state that owns the per-frame snapshot read by
    // getCursor/getColors/getViewport. Render state is updated explicitly via
    // update() rather than implicitly per read, since it's relatively cheap
    // when the terminal hasn't changed but still costs a WASM crossing.
    this.renderHandle = this.allocOpaqueOrFail('ghostty_render_state_new', (out) =>
      this.exports.ghostty_render_state_new(0, out)
    );
    // Pre-allocate the row iterator and row-cells iterators once and reuse
    // them across frames. They're populated from the render state in
    // getViewport via _get(ROW_ITERATOR) and _row_get(ROW_DATA_CELLS); the
    // handles themselves stay live for the terminal's lifetime.
    this.rowIter = this.allocOpaqueOrFail('ghostty_render_state_row_iterator_new', (out) =>
      this.exports.ghostty_render_state_row_iterator_new(0, out)
    );
    this.rowCells = this.allocOpaqueOrFail('ghostty_render_state_row_cells_new', (out) =>
      this.exports.ghostty_render_state_row_cells_new(0, out)
    );

    this.initCellPool();
  }

  /**
   * Allocate an opaque handle through one of the new(allocator, *outHandle)
   * factory functions. Wraps the boilerplate of: alloc out-pointer, call
   * factory, check Result, read the handle, free out-pointer.
   *
   * If the factory call fails, frees any already-acquired terminal/render
   * resources so the caller-throwing flow doesn't leak across the partially
   * constructed object.
   */
  private allocOpaqueOrFail(name: string, factory: (outPtr: number) => number): number {
    const outPtr = this.exports.ghostty_wasm_alloc_opaque();
    if (outPtr === 0) {
      this.cleanupOnConstructorFailure();
      throw new Error(`Failed to allocate handle for ${name}`);
    }
    try {
      const r = factory(outPtr);
      if (r !== 0) {
        this.cleanupOnConstructorFailure();
        throw new Error(`${name} failed: ${r}`);
      }
      return new DataView(this.memory.buffer).getUint32(outPtr, true);
    } finally {
      this.exports.ghostty_wasm_free_opaque(outPtr);
    }
  }

  /**
   * Apply user-supplied colors + palette overrides to the freshly-created
   * terminal via ghostty_terminal_set(COLOR_*).
   *
   * For the palette: the new C ABI takes a full 256-entry array, but coder's
   * config carries only the legacy 16 ANSI entries (each as a 0xRRGGBB int,
   * 0 meaning "use default"). To preserve indices ≥16 we read the existing
   * default palette first, overlay the non-zero entries from config, and
   * write the merged 768-byte buffer back.
   */
  private applyConfig(config: GhosttyTerminalConfig): void {
    if (config.fgColor !== undefined) {
      this.setColorOption(TerminalOption.COLOR_FOREGROUND, config.fgColor);
    }
    if (config.bgColor !== undefined) {
      this.setColorOption(TerminalOption.COLOR_BACKGROUND, config.bgColor);
    }
    if (config.cursorColor !== undefined) {
      this.setColorOption(TerminalOption.COLOR_CURSOR, config.cursorColor);
    }

    if (config.palette && config.palette.some((v) => v !== undefined)) {
      const PALETTE_SIZE = 256 * 3;
      const ptr = this.exports.ghostty_wasm_alloc(PALETTE_SIZE);
      try {
        // Seed from the upstream default palette so untouched indices
        // keep their canonical ANSI colors.
        const seedRes = this.exports.ghostty_terminal_get(
          this.handle,
          TerminalData.COLOR_PALETTE_DEFAULT,
          ptr
        );
        if (seedRes !== 0) {
          // Couldn't read defaults — fall back to all-black so we don't
          // smear stale memory into the palette.
          new Uint8Array(this.memory.buffer, ptr, PALETTE_SIZE).fill(0);
        }
        const buf = new Uint8Array(this.memory.buffer, ptr, PALETTE_SIZE);
        const limit = Math.min(config.palette.length, 16);
        for (let i = 0; i < limit; i++) {
          const c = config.palette[i];
          if (c === undefined) continue; // undefined = "leave default in place"
          buf[i * 3 + 0] = (c >> 16) & 0xff;
          buf[i * 3 + 1] = (c >> 8) & 0xff;
          buf[i * 3 + 2] = c & 0xff;
        }
        this.exports.ghostty_terminal_set(this.handle, TerminalOption.COLOR_PALETTE, ptr);
      } finally {
        this.exports.ghostty_wasm_free(ptr, PALETTE_SIZE);
      }
    }
  }

  private setColorOption(opt: TerminalOption, rgb: number): void {
    const ptr = this.exports.ghostty_wasm_alloc(3);
    const buf = new Uint8Array(this.memory.buffer, ptr, 3);
    buf[0] = (rgb >> 16) & 0xff;
    buf[1] = (rgb >> 8) & 0xff;
    buf[2] = rgb & 0xff;
    this.exports.ghostty_terminal_set(this.handle, opt, ptr);
    this.exports.ghostty_wasm_free(ptr, 3);
  }

  /**
   * Release any resources that have been allocated by the constructor up to
   * this point. Called when a subsequent step fails so we don't leak handles
   * before the throw propagates.
   */
  private cleanupOnConstructorFailure(): void {
    if (this.callbackRegistry) {
      this.callbackRegistry.instancesByHandle.delete(this.handle);
      this.callbackRegistry = undefined;
    }
    if (this.rowCells) {
      this.exports.ghostty_render_state_row_cells_free(this.rowCells);
      this.rowCells = 0;
    }
    if (this.rowIter) {
      this.exports.ghostty_render_state_row_iterator_free(this.rowIter);
      this.rowIter = 0;
    }
    if (this.renderHandle) {
      this.exports.ghostty_render_state_free(this.renderHandle);
      this.renderHandle = 0;
    }
    if (this.handle) {
      this.renderImages?.dispose();
      this.renderImages = undefined;
      this.exports.ghostty_terminal_free(this.handle);
    }
  }

  // ==========================================================================
  // RenderState scratch helpers
  //
  // The new render-state API exposes a single ghostty_render_state_get(state,
  // key, *out) entry point keyed by GhosttyRenderStateData. Each helper
  // allocates a small scratch buffer of the right size, performs the read,
  // and frees. Per-call allocation is intentionally simple; if profiling
  // shows it's hot, we can replace these with a single reusable scratch
  // buffer carved up by offset.
  // ==========================================================================

  private rsGetU8(key: number): number {
    const p = this.exports.ghostty_wasm_alloc(1);
    this.exports.ghostty_render_state_get(this.renderHandle, key, p);
    const v = new DataView(this.memory.buffer).getUint8(p);
    this.exports.ghostty_wasm_free(p, 1);
    return v;
  }

  private rsGetU16(key: number): number {
    const p = this.exports.ghostty_wasm_alloc(2);
    this.exports.ghostty_render_state_get(this.renderHandle, key, p);
    const v = new DataView(this.memory.buffer).getUint16(p, true);
    this.exports.ghostty_wasm_free(p, 2);
    return v;
  }

  private rsGetU32(key: number): number {
    const p = this.exports.ghostty_wasm_alloc(4);
    this.exports.ghostty_render_state_get(this.renderHandle, key, p);
    const v = new DataView(this.memory.buffer).getUint32(p, true);
    this.exports.ghostty_wasm_free(p, 4);
    return v;
  }

  private rsGetRgb(key: number): RGB {
    const p = this.exports.ghostty_wasm_alloc(3);
    this.exports.ghostty_render_state_get(this.renderHandle, key, p);
    const buf = new Uint8Array(this.memory.buffer, p, 3);
    const rgb: RGB = { r: buf[0]!, g: buf[1]!, b: buf[2]! };
    this.exports.ghostty_wasm_free(p, 3);
    return rgb;
  }

  // ==========================================================================
  // Terminal property scratch helpers
  //
  // Same pattern as rsGet* but against ghostty_terminal_get(terminal, key,
  // *out). The TerminalData enum encodes the value type; pick the matching
  // helper by output size.
  // ==========================================================================

  private tGetU8(key: number): number {
    const p = this.exports.ghostty_wasm_alloc(1);
    this.exports.ghostty_terminal_get(this.handle, key, p);
    const v = new DataView(this.memory.buffer).getUint8(p);
    this.exports.ghostty_wasm_free(p, 1);
    return v;
  }

  private tGetU32(key: number): number {
    const p = this.exports.ghostty_wasm_alloc(4);
    this.exports.ghostty_terminal_get(this.handle, key, p);
    const v = new DataView(this.memory.buffer).getUint32(p, true);
    this.exports.ghostty_wasm_free(p, 4);
    return v;
  }

  get cols(): number {
    return this._cols;
  }
  get rows(): number {
    return this._rows;
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  write(data: string | Uint8Array): void {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const ptr = this.exports.ghostty_wasm_alloc(bytes.length);
    new Uint8Array(this.memory.buffer).set(bytes, ptr);
    try {
      this.exports.ghostty_terminal_vt_write(this.handle, ptr, bytes.length);
      this.imageEpoch++;
    } finally {
      this.exports.ghostty_wasm_free(ptr, bytes.length);
    }
    // Borrowed C strings were copied by the trampoline. Invoke application code
    // after leaving WASM so listeners may safely write, reset, or dispose.
    const bells = this.pendingBells;
    this.pendingBells = 0;
    for (let i = 0; i < bells; i++) this.bellHandler?.();

    const titles = this.pendingTitleChanges;
    this.pendingTitleChanges = [];
    for (const title of titles) this.titleChangeHandler?.(title);

    const reports = this.pendingProgramStatus;
    this.pendingProgramStatus = [];
    for (const report of reports) this.programStatusHandler?.(report);

    const clipboardWrites = this.pendingClipboardWrites;
    this.pendingClipboardWrites = [];
    for (const event of clipboardWrites) this.clipboardWriteHandler?.(event);

    const pwds = this.pendingPwdChanges;
    this.pendingPwdChanges = [];
    for (const pwd of pwds) this.pwdChangeHandler?.(pwd);

    const notifications = this.pendingNotifications;
    this.pendingNotifications = [];
    for (const notification of notifications) this.notificationHandler?.(notification);

    const progress = this.pendingProgress;
    this.pendingProgress = [];
    for (const report of progress) this.progressHandler?.(report);

    const prompts = this.pendingSemanticPrompts;
    this.pendingSemanticPrompts = [];
    for (const event of prompts) this.semanticPromptHandler?.(event);

    const resizes = this.pendingResizeRequests;
    this.pendingResizeRequests = [];
    for (const request of resizes) this.resizeRequestHandler?.(request);
  }

  /** Drop every deferred effect event (reset, free). */
  private clearPendingEffects(): void {
    this.pendingClipboardWrites = [];
    this.pendingPwdChanges = [];
    this.pendingNotifications = [];
    this.pendingProgress = [];
    this.pendingSemanticPrompts = [];
    this.pendingResizeRequests = [];
  }

  /**
   * Reset terminal state in-place without changing the underlying WASM handle.
   */
  reset(): void {
    this.exports.ghostty_terminal_reset(this.handle);
    this.renderHeld = false;
    this.hasCapturedHoldFrame = false;
    this.rowDirtyCache = null;
    this.rowWrapCache = null;
    this.pendingResponses = [];
    this.pendingProgramStatus = [];
    this.pendingBells = 0;
    this.pendingTitleChanges = [];
    this.clearPendingEffects();
    this.hyperlinkIdsByUri.clear();
    this.nextHyperlinkId = 1;
    this.imageEpoch++;
    if (this.cellWidthPx > 0 && this.cellHeightPx > 0) {
      this.exports.ghostty_terminal_resize(
        this.handle,
        this._cols,
        this._rows,
        this.cellWidthPx,
        this.cellHeightPx
      );
    }
  }

  resize(cols: number, rows: number): void {
    if (cols === this._cols && rows === this._rows) return;
    this._cols = cols;
    this._rows = rows;
    this.imageEpoch++;
    this.exports.ghostty_terminal_resize(
      this.handle,
      cols,
      rows,
      this.cellWidthPx,
      this.cellHeightPx
    );
    this.initCellPool();
  }

  /**
   * Set the maximum bytes of image data the terminal will retain across
   * all kitty graphics images. Zero disables kitty graphics entirely
   * (transmissions will be parsed and dropped). Set this BEFORE any
   * image-bearing data is written to the terminal — there's no
   * retroactive recovery of dropped images.
   *
   * Input is uint64_t* on the C side, so we use a u32-pair little-endian
   * write to keep the byte count exact even past 4GB (probably overkill
   * but free).
   */
  setKittyImageStorageLimit(bytes: number): void {
    const ptr = this.exports.ghostty_wasm_alloc(8);
    const view = new DataView(this.memory.buffer);
    const lo = bytes >>> 0;
    const hi = Math.floor(bytes / 0x100000000) >>> 0;
    view.setUint32(ptr + 0, lo, true);
    view.setUint32(ptr + 4, hi, true);
    this.exports.ghostty_terminal_set(this.handle, TerminalOption.KITTY_IMAGE_STORAGE_LIMIT, ptr);
    this.imageEpoch++;
    this.exports.ghostty_wasm_free(ptr, 8);
  }

  // ==========================================================================
  // Kitty graphics — placement iteration + image data lookup.
  //
  // The renderer calls these per frame: iterate visible placements, look up
  // pixel data for each, composite onto the canvas. All handles returned
  // here (storage, image) are borrowed from the terminal and invalidated by
  // ANY mutating terminal call (vt_write, resize, reset, ...).
  // Callers must finish any read/copy before the next mutation.
  // ==========================================================================

  /**
   * Get the kitty graphics storage handle for the active screen, or null
   * if storage is disabled or no images are stored. Cheap to call; returns
   * a borrowed pointer.
   */
  getKittyGraphics(): number | null {
    const out = this.exports.ghostty_wasm_alloc(4);
    try {
      const r = this.exports.ghostty_terminal_get(this.handle, TerminalData.KITTY_GRAPHICS, out);
      if (r !== 0) return null;
      const handle = new DataView(this.memory.buffer).getUint32(out, true);
      return handle === 0 ? null : handle;
    } finally {
      this.exports.ghostty_wasm_free(out, 4);
    }
  }

  /**
   * Iterate placements in the active screen, yielding render-ready info
   * for each. The optional `onlyVisible` flag (default true) drops
   * placements that don't intersect the viewport — most renderers want
   * this. Use `false` if you need to track invalidated regions for
   * partial damage.
   *
   * Internally this uses the upstream placement iterator + the one-shot
   * placement_render_info call (fills 12 fields in one WASM crossing
   * instead of 5 separate getters).
   */
  *iterPlacements(graphics: number, onlyVisible: boolean = true): Generator<KittyPlacementInfo> {
    // Allocate iterator + scratch buffers once for the whole walk.
    const iterPP = this.exports.ghostty_wasm_alloc_opaque();
    if (iterPP === 0) return;
    let iter = 0;
    try {
      const r = this.exports.ghostty_kitty_graphics_placement_iterator_new(0, iterPP);
      if (r !== 0) return;
      iter = new DataView(this.memory.buffer).getUint32(iterPP, true);
      if (iter === 0) return;

      // Bind the iterator to the current placements.
      const handlePtr = this.exports.ghostty_wasm_alloc(4);
      try {
        new DataView(this.memory.buffer).setUint32(handlePtr, iter, true);
        this.exports.ghostty_kitty_graphics_get(
          graphics,
          KittyGraphicsData.PLACEMENT_ITERATOR,
          handlePtr
        );
      } finally {
        this.exports.ghostty_wasm_free(handlePtr, 4);
      }

      const idPtr = this.exports.ghostty_wasm_alloc(4);
      const infoPtr = this.exports.ghostty_wasm_alloc(
        GhosttyKittyGraphicsPlacementRenderInfoLayout.size
      );
      // Sized struct: write the discriminator once, the populator
      // overwrites the rest each call.
      new DataView(this.memory.buffer).setUint32(
        infoPtr,
        GhosttyKittyGraphicsPlacementRenderInfoLayout.size,
        true
      );
      try {
        while (this.exports.ghostty_kitty_graphics_placement_next(iter)) {
          // Look up image_id for this placement so we can pair it with
          // pixel data in the caller.
          this.exports.ghostty_kitty_graphics_placement_get(
            iter,
            KittyGraphicsPlacementData.IMAGE_ID,
            idPtr
          );
          const imageId = new DataView(this.memory.buffer).getUint32(idPtr, true);

          // Resolve the image handle — placement_render_info needs it.
          const imageHandle = this.exports.ghostty_kitty_graphics_image(graphics, imageId);
          if (imageHandle === 0) continue;

          // Reset the size discriminator (the populator may have written
          // the actual struct size back, but we don't rely on that — be
          // explicit so the call always sees the buffer as fully owned).
          new DataView(this.memory.buffer).setUint32(
            infoPtr,
            GhosttyKittyGraphicsPlacementRenderInfoLayout.size,
            true
          );
          const r2 = this.exports.ghostty_kitty_graphics_placement_render_info(
            iter,
            imageHandle,
            this.handle,
            infoPtr
          );
          if (r2 !== 0) continue;

          // Fetch is_virtual via a separate placement_get — it isn't
          // in the PlacementRenderInfo struct (which assumes a real
          // viewport position).
          this.exports.ghostty_kitty_graphics_placement_get(
            iter,
            KittyGraphicsPlacementData.IS_VIRTUAL,
            idPtr // reuse the 4-byte slot; the value is a bool but written as u8
          );
          const isVirtual = new DataView(this.memory.buffer).getUint8(idPtr) !== 0;

          const v = new DataView(this.memory.buffer);
          const o = GhosttyKittyGraphicsPlacementRenderInfoLayout.offset;
          const info: KittyPlacementInfo = {
            imageId,
            pixelWidth: v.getUint32(infoPtr + o.pixel_width, true),
            pixelHeight: v.getUint32(infoPtr + o.pixel_height, true),
            gridCols: v.getUint32(infoPtr + o.grid_cols, true),
            gridRows: v.getUint32(infoPtr + o.grid_rows, true),
            viewportCol: v.getInt32(infoPtr + o.viewport_col, true),
            viewportRow: v.getInt32(infoPtr + o.viewport_row, true),
            viewportVisible: v.getUint8(infoPtr + o.viewport_visible) !== 0,
            sourceX: v.getUint32(infoPtr + o.source_x, true),
            sourceY: v.getUint32(infoPtr + o.source_y, true),
            sourceWidth: v.getUint32(infoPtr + o.source_width, true),
            sourceHeight: v.getUint32(infoPtr + o.source_height, true),
            isVirtual,
          };
          // onlyVisible filter: keep only visible direct placements. Virtual
          // placements don't have a viewport position so viewportVisible
          // is always false; callers walking unicode-placeholder grids
          // pass onlyVisible=false to receive them.
          if (onlyVisible && !info.viewportVisible) continue;
          yield info;
        }
      } finally {
        this.exports.ghostty_wasm_free(idPtr, 4);
        this.exports.ghostty_wasm_free(infoPtr, GhosttyKittyGraphicsPlacementRenderInfoLayout.size);
      }
    } finally {
      if (iter !== 0) {
        this.exports.ghostty_kitty_graphics_placement_iterator_free(iter);
      }
      this.exports.ghostty_wasm_free_opaque(iterPP);
    }
  }

  /**
   * Get the pixel data + metadata for an image by id. Returns null if the
   * image isn't stored or isn't in a format we can hand the renderer
   * directly (RGB / RGBA / GRAY / GRAY_ALPHA).
   *
   * The returned `data` is a borrowed view into WASM memory — copy before
   * the next vt_write if you need to retain. Most callers will turn this
   * into an ImageData / canvas immediately and discard the view.
   */
  getKittyImagePixels(graphics: number, imageId: number): KittyImagePixels | null {
    const image = this.exports.ghostty_kitty_graphics_image(graphics, imageId);
    if (image === 0) return null;

    const u32Ptr = this.exports.ghostty_wasm_alloc(8);
    try {
      const view = new DataView(this.memory.buffer);
      const read = (key: number): number => {
        if (this.exports.ghostty_kitty_graphics_image_get(image, key, u32Ptr) !== 0) {
          return 0;
        }
        return new DataView(this.memory.buffer).getUint32(u32Ptr, true);
      };

      const width = read(KittyGraphicsImageData.WIDTH);
      const height = read(KittyGraphicsImageData.HEIGHT);
      const format = read(KittyGraphicsImageData.FORMAT) as KittyImageFormat;
      // PIXELS writes a GhosttyString { ptr: u32, len: u32 } and returns
      // GHOSTTY_NO_VALUE while the pixels are still arriving.
      let dataPtr = 0;
      let dataLen = 0;
      if (
        this.exports.ghostty_kitty_graphics_image_get(
          image,
          KittyGraphicsImageData.PIXELS,
          u32Ptr
        ) === 0
      ) {
        const sv = new DataView(this.memory.buffer);
        dataPtr = sv.getUint32(u32Ptr + GhosttyStringLayout.offset.ptr, true);
        dataLen = sv.getUint32(u32Ptr + GhosttyStringLayout.offset.len, true);
      }
      void view;

      if (width === 0 || height === 0 || dataPtr === 0 || dataLen === 0) {
        return null;
      }

      this.exports.ghostty_kitty_graphics_image_get(
        image,
        KittyGraphicsImageData.GENERATION,
        u32Ptr
      );
      const generation = new DataView(this.memory.buffer).getBigUint64(u32Ptr, true);
      let stamp = this.imageRevisions.get(imageId);
      if (!stamp || stamp.generation !== generation) {
        stamp = { generation, revision: ++nextImageRevision };
        this.imageRevisions.set(imageId, stamp);
      }
      return {
        width,
        height,
        format,
        data: new Uint8Array(this.memory.buffer, dataPtr, dataLen),
        revision: stamp.revision,
      };
    } finally {
      this.exports.ghostty_wasm_free(u32Ptr, 8);
    }
  }

  /**
   * Push the renderer's per-cell pixel size into the WASM terminal.
   *
   * The new C ABI doesn't expose a separate "set pixel size" call —
   * dimensions only flow through ghostty_terminal_resize, which takes
   * (cols, rows, cell_width_px, cell_height_px). We cache the cell pixel
   * dims on the instance so subsequent resize() calls keep the values
   * stable, and short-circuit when nothing has changed.
   *
   * The width/height arguments are PER-CELL CSS pixels — matches what
   * the renderer reports via getMetrics(). Coder's old setPixelSize
   * took TOTAL screen pixels (cell_width * cols, cell_height * rows);
   * we renamed to avoid silent value mis-passing.
   *
   * Affects in-band size reports (CSI 14/16/18 t) and kitty graphics
   * placement sizing. Until called, those query paths return zero.
   */
  setCellPixelSize(cellWidthPx: number, cellHeightPx: number): void {
    const w = Math.max(1, Math.round(cellWidthPx));
    const h = Math.max(1, Math.round(cellHeightPx));
    if (w === this.cellWidthPx && h === this.cellHeightPx) return;
    this.cellWidthPx = w;
    this.cellHeightPx = h;
    this.imageEpoch++;
    this.exports.ghostty_terminal_resize(this.handle, this._cols, this._rows, w, h);
  }

  free(): void {
    this.programStatusHandler = undefined;
    this.bellHandler = undefined;
    this.titleChangeHandler = undefined;
    this.renderHoldHandler = undefined;
    this.pendingProgramStatus = [];
    this.pendingBells = 0;
    this.pendingTitleChanges = [];
    this.clearPendingEffects();
    this.renderHeld = false;
    this.hasCapturedHoldFrame = false;
    if (this.callbackRegistry) {
      this.callbackRegistry.instancesByHandle.delete(this.handle);
    }
    if (this.rowCells) {
      this.exports.ghostty_render_state_row_cells_free(this.rowCells);
      this.rowCells = 0;
    }
    if (this.rowIter) {
      this.exports.ghostty_render_state_row_iterator_free(this.rowIter);
      this.rowIter = 0;
    }
    if (this.renderHandle) {
      this.exports.ghostty_render_state_free(this.renderHandle);
      this.renderHandle = 0;
    }
    this.renderImages?.dispose();
    this.renderImages = undefined;
    this.exports.ghostty_terminal_free(this.handle);
  }

  // ==========================================================================
  // RenderState API - The key performance optimization
  // ==========================================================================

  /**
   * Update render state from terminal.
   *
   * This syncs the RenderState with the current Terminal state.
   * The dirty state (full/partial/none) is stored in the WASM RenderState
   * and can be queried via isRowDirty(). When dirty==full, isRowDirty()
   * returns true for ALL rows.
   *
   * The WASM layer automatically detects screen switches (normal <-> alternate)
   * and returns FULL dirty state when switching screens (e.g., vim exit).
   *
   * Safe to call multiple times - dirty state persists until markClean().
   */
  update(): DirtyState {
    if (this.renderHeld) {
      return this.rsGetU32(RenderStateData.DIRTY) as DirtyState;
    }
    const r = this.exports.ghostty_render_state_update(this.renderHandle, this.handle);
    if (r !== 0) throw new Error(`ghostty_render_state_update failed: ${r}`);
    // Per-row caches are tied to the previous snapshot.
    this.rowDirtyCache = null;
    this.rowWrapCache = null;
    // GhosttyRenderStateDirty is a 4-byte enum (FALSE=0, PARTIAL=1, FULL=2).
    return this.rsGetU32(RenderStateData.DIRTY) as DirtyState;
  }

  /**
   * Get cursor state from render state.
   * Calls update() first; safe to call repeatedly within a frame.
   */
  getCursor(): RenderStateCursor {
    this.update();

    const inViewport = this.rsGetU8(RenderStateData.CURSOR_VIEWPORT_HAS_VALUE) !== 0;
    const visible = this.rsGetU8(RenderStateData.CURSOR_VISIBLE) !== 0;
    const blinking = this.rsGetU8(RenderStateData.CURSOR_BLINKING) !== 0;
    const styleRaw = this.rsGetU32(RenderStateData.CURSOR_VISUAL_STYLE);

    const viewportX = inViewport ? this.rsGetU16(RenderStateData.CURSOR_VIEWPORT_X) : -1;
    const viewportY = inViewport ? this.rsGetU16(RenderStateData.CURSOR_VIEWPORT_Y) : -1;

    // Coder's interface only knows three styles; collapse BLOCK_HOLLOW into block.
    const style: RenderStateCursor['style'] =
      styleRaw === CursorVisualStyle.BAR
        ? 'bar'
        : styleRaw === CursorVisualStyle.UNDERLINE
          ? 'underline'
          : 'block';

    return {
      x: Math.max(0, viewportX),
      y: Math.max(0, viewportY),
      viewportX,
      viewportY,
      visible: visible && inViewport,
      blinking,
      style,
    };
  }

  /**
   * Get the active screen's logical cursor position directly from the terminal
   * (independent of whether the viewport is scrolled).
   */
  getLogicalCursor(): { x: number; y: number } {
    return {
      x: this.rGetCursorU16(TerminalData.CURSOR_X),
      y: this.rGetCursorU16(TerminalData.CURSOR_Y),
    };
  }

  private rGetCursorU16(key: number): number {
    const p = this.exports.ghostty_wasm_alloc(2);
    try {
      this.exports.ghostty_terminal_get(this.handle, key, p);
      return new DataView(this.memory.buffer).getUint16(p, true);
    } finally {
      this.exports.ghostty_wasm_free(p, 2);
    }
  }

  /**
   * Get default fg/bg/cursor colors from render state.
   */
  getColors(): RenderStateColors {
    this.update();
    const background = this.rsGetRgb(RenderStateData.COLOR_BACKGROUND);
    const foreground = this.rsGetRgb(RenderStateData.COLOR_FOREGROUND);
    const hasCursor = this.rsGetU8(RenderStateData.COLOR_CURSOR_HAS_VALUE) !== 0;
    const cursor = hasCursor ? this.rsGetRgb(RenderStateData.COLOR_CURSOR) : null;
    return { background, foreground, cursor };
  }

  /**
   * Check if a specific row is dirty.
   *
   * Backed by a per-row cache populated lazily — first call after update()
   * walks the iterator once and reads the dirty flag for each row, then
   * subsequent calls are O(1). getViewport() also populates the cache as a
   * side effect so a typical "update → for-each-row isRowDirty → getViewport"
   * render loop only iterates rows once.
   */
  isRowDirty(y: number): boolean {
    if (y < 0 || y >= this._rows) return false;
    if (this.rowDirtyCache === null) this.refreshRowMetaCache();
    return this.rowDirtyCache![y] ?? false;
  }

  /**
   * Check if a row is soft-wrapped (continues onto the next row).
   *
   * Same cache discipline as isRowDirty: lazy-populated on first call after
   * update(), or as a side effect of getViewport.
   */
  isRowWrapped(y: number): boolean {
    if (y < 0 || y >= this._rows) return false;
    if (this.rowWrapCache === null) this.refreshRowMetaCache();
    return this.rowWrapCache![y] ?? false;
  }

  /**
   * Walk the row iterator once and capture per-row dirty + wrap flags.
   *
   * Calls update() first since callers (isRowDirty / isRowWrapped) typically
   * query right after a terminal write, before any explicit render-state
   * refresh has happened. Same idempotency guarantee as getCursor/getColors:
   * if no terminal change occurred since the last update, this is cheap.
   *
   * Reads ROW_DATA_DIRTY directly from the iterator, then ROW_DATA_RAW to
   * obtain the GhosttyRow (u64) needed to call ghostty_row_get(WRAP_*). The
   * row value is only valid for the current iterator position; we read it
   * inline before advancing.
   */
  private refreshRowMetaCache(): void {
    this.update();
    const dirty = new Array<boolean>(this._rows).fill(false);
    const wrap = new Array<boolean>(this._rows).fill(false);
    this.populateHandle(
      (out) =>
        this.exports.ghostty_render_state_get(this.renderHandle, RenderStateData.ROW_ITERATOR, out),
      this.rowIter
    );
    const dirtyPtr = this.exports.ghostty_wasm_alloc(1);
    const rawPtr = this.exports.ghostty_wasm_alloc(8); // GhosttyRow = u64
    const wrapPtr = this.exports.ghostty_wasm_alloc(1);
    try {
      let row = 0;
      while (
        row < this._rows &&
        this.exports.ghostty_render_state_row_iterator_next(this.rowIter)
      ) {
        const view = new DataView(this.memory.buffer);

        this.exports.ghostty_render_state_row_get(this.rowIter, RenderStateRowData.DIRTY, dirtyPtr);
        dirty[row] = view.getUint8(dirtyPtr) !== 0;

        this.exports.ghostty_render_state_row_get(this.rowIter, RenderStateRowData.RAW, rawPtr);
        const rowU64 = new DataView(this.memory.buffer).getBigUint64(rawPtr, true);
        this.exports.ghostty_row_get(rowU64, RowData.WRAP_CONTINUATION, wrapPtr);
        wrap[row] = new DataView(this.memory.buffer).getUint8(wrapPtr) !== 0;

        row++;
      }
    } finally {
      this.exports.ghostty_wasm_free(dirtyPtr, 1);
      this.exports.ghostty_wasm_free(rawPtr, 8);
      this.exports.ghostty_wasm_free(wrapPtr, 1);
    }
    this.rowDirtyCache = dirty;
    this.rowWrapCache = wrap;
  }

  /**
   * Mark render state as clean — clears both global and per-row dirty.
   *
   * Per the upstream contract, "setting one dirty state doesn't unset the
   * other." Global dirty is cleared via _set(OPTION_DIRTY, FALSE); per-row
   * dirty is cleared by walking the row iterator and calling _row_set on
   * each. Without the per-row pass, the next update() would still report
   * the old per-row flags as dirty even though the terminal hasn't changed.
   */
  markClean(): void {
    const p = this.exports.ghostty_wasm_alloc(4);
    new DataView(this.memory.buffer).setUint32(p, DirtyState.FALSE, true);
    this.exports.ghostty_render_state_set(this.renderHandle, RenderStateOption.DIRTY, p);
    this.exports.ghostty_wasm_free(p, 4);

    // Re-bind the iterator to the current state and clear each row's dirty.
    this.populateHandle(
      (out) =>
        this.exports.ghostty_render_state_get(this.renderHandle, RenderStateData.ROW_ITERATOR, out),
      this.rowIter
    );
    const falsePtr = this.exports.ghostty_wasm_alloc(1);
    new DataView(this.memory.buffer).setUint8(falsePtr, 0);
    while (this.exports.ghostty_render_state_row_iterator_next(this.rowIter)) {
      this.exports.ghostty_render_state_row_set(this.rowIter, RenderStateRowOption.DIRTY, falsePtr);
    }
    this.exports.ghostty_wasm_free(falsePtr, 1);

    // Caches captured the now-stale "dirty" state.
    this.rowDirtyCache = null;
    this.hasCapturedHoldFrame = false;
  }

  /**
   * Populate the cellPool from the current render state and return it.
   *
   * The new C ABI replaces coder's single ghostty_render_state_get_viewport()
   * buffer-fill with a row iterator + per-row cells iterator. We allocate
   * both iterators once at construction time and re-populate them per call:
   *
   *   _get(state, ROW_ITERATOR, &rowIter)
   *   while (row_iterator_next(rowIter)) {
   *     _row_get(rowIter, ROW_DATA_CELLS, &rowCells)
   *     while (row_cells_next(rowCells)) {
   *       _row_cells_get(rowCells, GRAPHEMES_LEN, &len)
   *       _row_cells_get(rowCells, GRAPHEMES_BUF, &codepoint)  // if len > 0
   *       _row_cells_get(rowCells, FG_COLOR/BG_COLOR, &rgb)    // INVALID_VALUE if unset
   *     }
   *   }
   *
   * This is intentionally minimal: we capture codepoint + fg/bg only.
   * Style flags, cell width (double-width), and hyperlink IDs are deferred
   * — they require parsing the GhosttyStyle sized struct and the per-cell
   * ghostty_cell_get(WIDE)/HAS_HYPERLINK paths. The cellPool fields keep
   * placeholder defaults (flags=0, width=1, hyperlink_id=0).
   *
   * Performance: ~3-4 WASM crossings per visible cell. For an 80x24 viewport
   * that's ~6k crossings per frame. Profile before optimizing — likely
   * candidates are _row_cells_get_multi for batched reads, or RAW + a
   * cached layout map for direct memory access.
   */
  getViewport(): GhosttyCell[] {
    this.update();

    // Pre-zero the pool so cells we don't visit (iterator ends early, or
    // we exceed the configured cols/rows) read as empty.
    this.zeroCellPool();

    // Populate the row iterator from the render state.
    // _get(state, ROW_ITERATOR, &iter) reads `*ptr` to get our pre-allocated
    // iterator handle, then re-binds it to the current frame's row data.
    this.populateHandle(
      (out) =>
        this.exports.ghostty_render_state_get(this.renderHandle, RenderStateData.ROW_ITERATOR, out),
      this.rowIter
    );

    // Reusable scratch buffers — declared once outside the loops since cell
    // counts are dominant. 4 bytes covers u32 (grapheme len, codepoint).
    // 3 bytes covers GhosttyColorRgb. 1 byte covers per-row dirty bool.
    // Style is the 16-byte frozen GhosttyStyle struct (see GhosttyStyleLayout.size
    // in types.ts); the populator fills it on each call.
    const STYLE_SIZE = GhosttyStyleLayout.size;
    const u32Ptr = this.exports.ghostty_wasm_alloc(4);
    const rgbPtr = this.exports.ghostty_wasm_alloc(3);
    const dirtyPtr = this.exports.ghostty_wasm_alloc(1);
    const rawPtr = this.exports.ghostty_wasm_alloc(8);
    const wrapPtr = this.exports.ghostty_wasm_alloc(1);
    const stylePtr = this.exports.ghostty_wasm_alloc(STYLE_SIZE);
    // Per-cell RAW + WIDE scratch. Cells are 8 bytes (u64); the WIDE
    // enum is a 4-byte int.
    const cellRawPtr = this.exports.ghostty_wasm_alloc(8);
    const widePtr = this.exports.ghostty_wasm_alloc(4);
    // Scratch for GRAPHEMES_BUF — sized large enough that any realistic
    // cluster fits in this single allocation and we don't pay alloc/free
    // per multi-codepoint cell. 32 codepoints covers kitty placeholders
    // (3-4), the longest standard ZWJ family emoji (~7), and Indic
    // consonant clusters with comfortable headroom; cells beyond that
    // fall back to a dynamic alloc below.
    const GRAPHEME_SCRATCH_CODEPOINTS = 32;
    const GRAPHEME_SCRATCH_BYTES = GRAPHEME_SCRATCH_CODEPOINTS * 4;
    const graphemeBufPtr = this.exports.ghostty_wasm_alloc(GRAPHEME_SCRATCH_BYTES);
    // GRAPHEMES_BUF takes a GhosttyCodepointBuffer descriptor; its ptr/cap
    // are re-pointed per cell at whichever scratch buffer is in use.
    const cpBufPtr = this.exports.ghostty_wasm_alloc(GhosttyCodepointBufferLayout.size);
    // Populate the row meta caches as a side effect — saves a redundant
    // iterator walk if the renderer also calls isRowDirty() / isRowWrapped()
    // on this snapshot.
    const dirtyCache = new Array<boolean>(this._rows).fill(false);
    const wrapCache = new Array<boolean>(this._rows).fill(false);
    try {
      let row = 0;
      while (
        row < this._rows &&
        this.exports.ghostty_render_state_row_iterator_next(this.rowIter)
      ) {
        // Capture per-row dirty + wrap for the caches.
        this.exports.ghostty_render_state_row_get(this.rowIter, RenderStateRowData.DIRTY, dirtyPtr);
        dirtyCache[row] = new DataView(this.memory.buffer).getUint8(dirtyPtr) !== 0;

        this.exports.ghostty_render_state_row_get(this.rowIter, RenderStateRowData.RAW, rawPtr);
        const rowU64 = new DataView(this.memory.buffer).getBigUint64(rawPtr, true);
        this.exports.ghostty_row_get(rowU64, RowData.WRAP_CONTINUATION, wrapPtr);
        wrapCache[row] = new DataView(this.memory.buffer).getUint8(wrapPtr) !== 0;

        // Bind rowCells to this row.
        this.populateHandle(
          (out) =>
            this.exports.ghostty_render_state_row_get(this.rowIter, RenderStateRowData.CELLS, out),
          this.rowCells
        );

        let col = 0;
        while (
          col < this._cols &&
          this.exports.ghostty_render_state_row_cells_next(this.rowCells)
        ) {
          const cell = this.cellPool[row * this._cols + col]!;

          // Grapheme length. Upstream includes the base codepoint:
          //   empty cell        -> 0
          //   simple ASCII 'a'  -> 1 (just 'a')
          //   ZWJ family emoji  -> N (base + N-1 combining)
          // Coder's cell.grapheme_len counts only the "extras" beyond the
          // base, so we subtract one (clamped at 0). The full count is
          // available to callers that want it through getGrapheme().
          this.exports.ghostty_render_state_row_cells_get(
            this.rowCells,
            RowCellsData.GRAPHEMES_LEN,
            u32Ptr
          );
          const memView = new DataView(this.memory.buffer);
          const graphemeLen = memView.getUint32(u32Ptr, true);
          cell.grapheme_len = graphemeLen > 0 ? graphemeLen - 1 : 0;

          if (graphemeLen > 0) {
            // GRAPHEMES_BUF writes graphemeLen u32 codepoints. Read into the
            // shared scratch when the cluster fits; fall back to a dedicated
            // allocation for the rare jumbo cluster (graphemeLen > 32).
            // Capturing all codepoints here lets coreEncodeCells /
            // renderPlaceholderCell consume cell.grapheme directly instead of
            // calling getGrapheme(y, x) per cell — that path re-walks the row
            // iterator from row 0 and is O(row) per cell, which used to
            // dominate the per-frame budget for kitty unicode placeholders.
            let bufPtr = graphemeBufPtr;
            let usedDynamic = false;
            const wantBytes = graphemeLen * 4;
            if (graphemeLen > GRAPHEME_SCRATCH_CODEPOINTS) {
              bufPtr = this.exports.ghostty_wasm_alloc(wantBytes);
              usedDynamic = true;
            }
            try {
              const desc = new DataView(this.memory.buffer);
              desc.setUint32(cpBufPtr, bufPtr, true);
              desc.setUint32(cpBufPtr + GhosttyCodepointBufferLayout.offset.cap, graphemeLen, true);
              this.exports.ghostty_render_state_row_cells_get(
                this.rowCells,
                RowCellsData.GRAPHEMES_BUF,
                cpBufPtr
              );
              const view = new DataView(this.memory.buffer);
              cell.codepoint = view.getUint32(bufPtr, true);
              if (graphemeLen > 1) {
                const extras = new Array<number>(graphemeLen - 1);
                for (let g = 1; g < graphemeLen; g++) {
                  extras[g - 1] = view.getUint32(bufPtr + g * 4, true);
                }
                cell.grapheme = extras;
              } else {
                cell.grapheme = null;
              }
            } finally {
              if (usedDynamic) this.exports.ghostty_wasm_free(bufPtr, wantBytes);
            }
          } else {
            cell.codepoint = 0;
            cell.grapheme = null;
          }

          // Resolved fg/bg. Returns INVALID_VALUE (non-zero) when the cell
          // has no explicit color; mark fg/bgIsDefault so the renderer
          // applies the theme default rather than rendering literal black
          // (the rgb triple stays zeroed but is meaningless when isDefault).
          cell.fg_r = cell.fg_g = cell.fg_b = 0;
          cell.bg_r = cell.bg_g = cell.bg_b = 0;
          cell.fgIsDefault = true;
          cell.bgIsDefault = true;
          if (
            this.exports.ghostty_render_state_row_cells_get(
              this.rowCells,
              RowCellsData.FG_COLOR,
              rgbPtr
            ) === 0
          ) {
            const u8 = new Uint8Array(this.memory.buffer, rgbPtr, 3);
            cell.fg_r = u8[0]!;
            cell.fg_g = u8[1]!;
            cell.fg_b = u8[2]!;
            cell.fgIsDefault = false;
          }
          if (
            this.exports.ghostty_render_state_row_cells_get(
              this.rowCells,
              RowCellsData.BG_COLOR,
              rgbPtr
            ) === 0
          ) {
            const u8 = new Uint8Array(this.memory.buffer, rgbPtr, 3);
            cell.bg_r = u8[0]!;
            cell.bg_g = u8[1]!;
            cell.bg_b = u8[2]!;
            cell.bgIsDefault = false;
          }

          // Read the per-cell style and pack the booleans into the flags
          // bitmask coder's renderer / Buffer API consumes. The function
          // always returns a valid style (default for unstyled cells).
          this.exports.ghostty_render_state_row_cells_get(
            this.rowCells,
            RowCellsData.STYLE,
            stylePtr
          );
          cell.flags = this.styleFlagsToCellFlags(
            new DataView(this.memory.buffer).getUint16(
              stylePtr + GhosttyStyleLayout.offset.flags,
              true
            )
          );

          // Read the raw cell value once, then use it to query per-cell
          // properties not exposed at the row_cells level. Width matters
          // for CJK / wide emoji — without it the renderer skips the
          // spacer cells correctly only if the wide cell itself has
          // width=2, otherwise glyphs overlap or the spacer cell paints
          // an empty box.
          this.exports.ghostty_render_state_row_cells_get(
            this.rowCells,
            RowCellsData.RAW,
            cellRawPtr
          );
          const cellU64 = new DataView(this.memory.buffer).getBigUint64(cellRawPtr, true);
          this.exports.ghostty_cell_get(cellU64, CellData.WIDE, widePtr);
          const wide = new DataView(this.memory.buffer).getUint32(widePtr, true);
          cell.width =
            wide === CellWide.WIDE
              ? 2
              : wide === CellWide.SPACER_TAIL || wide === CellWide.SPACER_HEAD
                ? 0
                : 1;

          // OSC 8 hyperlink ID interned by URI so distinct hyperlinks get
          // distinct non-zero IDs (preventing hovering one link from
          // underlining unrelated links on the screen).
          this.exports.ghostty_cell_get(cellU64, CellData.HAS_HYPERLINK, widePtr);
          const hasHyperlink = new DataView(this.memory.buffer).getUint8(widePtr) !== 0;
          cell.hyperlink_id = hasHyperlink
            ? this.internHyperlinkUri(this.readHyperlinkUri(PointTag.ACTIVE, row, col))
            : 0;

          col++;
        }
        row++;
      }
    } finally {
      this.exports.ghostty_wasm_free(u32Ptr, 4);
      this.exports.ghostty_wasm_free(rgbPtr, 3);
      this.exports.ghostty_wasm_free(dirtyPtr, 1);
      this.exports.ghostty_wasm_free(rawPtr, 8);
      this.exports.ghostty_wasm_free(wrapPtr, 1);
      this.exports.ghostty_wasm_free(stylePtr, STYLE_SIZE);
      this.exports.ghostty_wasm_free(cellRawPtr, 8);
      this.exports.ghostty_wasm_free(widePtr, 4);
      this.exports.ghostty_wasm_free(graphemeBufPtr, GRAPHEME_SCRATCH_BYTES);
      this.exports.ghostty_wasm_free(cpBufPtr, GhosttyCodepointBufferLayout.size);
    }

    this.rowDirtyCache = dirtyCache;
    this.rowWrapCache = wrapCache;
    return this.cellPool;
  }

  /**
   * Helper for the in/out pointer pattern used by ROW_ITERATOR / ROW_DATA_CELLS:
   * write a handle into a 4-byte slot, hand the slot to a populator, then
   * free the slot. The handle value itself is unchanged; the populator uses
   * it to find and rebind the iterator's internal data.
   */
  private populateHandle(populator: (slotPtr: number) => number, handle: number): void {
    const slot = this.exports.ghostty_wasm_alloc(4);
    new DataView(this.memory.buffer).setUint32(slot, handle, true);
    populator(slot);
    this.exports.ghostty_wasm_free(slot, 4);
  }

  /**
   * Reset every cell in the pool to "empty" so cells we don't visit during
   * iteration (e.g. iterator stopped early, or grid resized down) don't
   * carry stale values from a previous frame.
   */
  private zeroCellPool(): void {
    for (let i = 0; i < this.cellPool.length; i++) {
      const cell = this.cellPool[i]!;
      cell.codepoint = 0;
      cell.fg_r = cell.fg_g = cell.fg_b = 0;
      cell.bg_r = cell.bg_g = cell.bg_b = 0;
      cell.fgIsDefault = true;
      cell.bgIsDefault = true;
      cell.flags = 0;
      cell.width = 1;
      cell.hyperlink_id = 0;
      cell.grapheme_len = 0;
      cell.grapheme = null;
    }
  }

  // ==========================================================================
  // Compatibility methods (delegate to render state)
  // ==========================================================================

  /**
   * Get line - for compatibility, extracts from viewport.
   * Ensures render state is fresh by calling update().
   * Returns a COPY of the cells to avoid pool reference issues.
   */
  getLine(y: number): GhosttyCell[] | null {
    if (y < 0 || y >= this._rows) return null;
    // Call update() to ensure render state is fresh.
    // This is safe to call multiple times - dirty state persists until markClean().
    this.update();
    const viewport = this.getViewport();
    const start = y * this._cols;
    // Return deep copies to avoid cell pool reference issues
    return viewport.slice(start, start + this._cols).map((cell) => ({ ...cell }));
  }

  /** For compatibility with old API */
  isDirty(): boolean {
    return this.update() !== DirtyState.FALSE;
  }

  /**
   * Check if a full redraw is needed (screen change, resize, etc.)
   * Note: This calls update() to ensure fresh state. Safe to call multiple times.
   */
  needsFullRedraw(): boolean {
    return this.update() === DirtyState.FULL;
  }

  /** Mark render state as clean after rendering */
  clearDirty(): void {
    this.markClean();
  }

  // ==========================================================================
  // Terminal modes
  // ==========================================================================

  isAlternateScreen(): boolean {
    // ACTIVE_SCREEN returns a GhosttyTerminalScreen enum (4-byte int).
    return this.tGetU32(TerminalData.ACTIVE_SCREEN) === TerminalScreen.ALTERNATE;
  }

  hasBracketedPaste(): boolean {
    // Mode 2004 = bracketed paste (DEC mode)
    return this.getMode(2004, false);
  }

  hasFocusEvents(): boolean {
    // Mode 1004 = focus events (DEC mode)
    return this.getMode(1004, false);
  }

  hasMouseTracking(): boolean {
    return this.tGetU8(TerminalData.MOUSE_TRACKING) !== 0;
  }

  // ==========================================================================
  // Extended API (scrollback, modes, etc.)
  // ==========================================================================

  /** Get dimensions - for compatibility */
  getDimensions(): { cols: number; rows: number } {
    return { cols: this._cols, rows: this._rows };
  }

  /** Get number of scrollback lines (history, not including active screen) */
  getScrollbackLength(): number {
    // SCROLLBACK_ROWS is size_t — 4 bytes on wasm32.
    return this.tGetU32(TerminalData.SCROLLBACK_ROWS);
  }

  /**
   * Get a line from the scrollback buffer.
   * @param offset 0 = oldest scrollback line, (scrollbackLength-1) = most
   *   recent scrollback line.
   *
   * Uses ghostty_terminal_grid_ref with POINT_TAG_HISTORY to address rows
   * outside the active viewport. The render-state row iterator only walks
   * the viewport, so scrollback access has to go through grid_ref.
   *
   * Cell content is currently codepoint-only; fg/bg colors, style flags,
   * and hyperlinks are deferred (defaults: 0 colors, flags=0, width=1).
   * The text-extraction tests that drove this commit only check codepoints.
   */
  getScrollbackLine(offset: number): GhosttyCell[] | null {
    return this.readGridLine(PointTag.HISTORY, offset);
  }

  /**
   * Check whether a scrollback row is a soft-wrap continuation of the
   * preceding row (matching isRowWrapped(y) on the active screen).
   */
  isScrollbackRowWrapped(offset: number): boolean {
    const pointPtr = this.allocPoint(PointTag.HISTORY, 0, offset);
    const refPtr = this.exports.ghostty_wasm_alloc(GhosttyGridRefLayout.size);
    const rowPtr = this.exports.ghostty_wasm_alloc(8);
    const wrapPtr = this.exports.ghostty_wasm_alloc(1);
    try {
      if (this.exports.ghostty_terminal_grid_ref(this.handle, pointPtr, refPtr) !== 0) {
        return false;
      }
      if (this.exports.ghostty_grid_ref_row(refPtr, rowPtr) !== 0) {
        return false;
      }
      const rowU64 = new DataView(this.memory.buffer).getBigUint64(rowPtr, true);
      if (this.exports.ghostty_row_get(rowU64, RowData.WRAP_CONTINUATION, wrapPtr) !== 0) {
        return false;
      }
      return new DataView(this.memory.buffer).getUint8(wrapPtr) !== 0;
    } finally {
      this.exports.ghostty_wasm_free(pointPtr, 24);
      this.exports.ghostty_wasm_free(refPtr, GhosttyGridRefLayout.size);
      this.exports.ghostty_wasm_free(rowPtr, 8);
      this.exports.ghostty_wasm_free(wrapPtr, 1);
    }
  }

  /**
   * Get the hyperlink URI for a cell at the given position in the active
   * viewport. Returns null when no hyperlink is attached.
   */
  getHyperlinkUri(row: number, col: number): string | null {
    if (row < 0 || row >= this._rows) return null;
    if (col < 0 || col >= this._cols) return null;
    return this.readHyperlinkUri(PointTag.ACTIVE, row, col);
  }

  /**
   * Get the hyperlink URI for a cell in the scrollback buffer.
   */
  getScrollbackHyperlinkUri(offset: number, col: number): string | null {
    if (col < 0 || col >= this._cols) return null;
    return this.readHyperlinkUri(PointTag.HISTORY, offset, col);
  }

  // ==========================================================================
  // grid_ref helpers
  //
  // Layouts come from GhosttyPointLayout / GhosttyGridRefLayout. GridRef's
  // x/y are public so we can step along a row by mutating ref.x in place
  // rather than re-resolving the point per cell.
  //
  // A grid ref is invalidated by ANY terminal mutation. The whole helper
  // body must run between vt_writes — read everything we need, copy out,
  // free.
  // ==========================================================================

  private readGridLine(tag: PointTag, y: number): GhosttyCell[] | null {
    const pointPtr = this.allocPoint(tag, 0, y);
    const refPtr = this.exports.ghostty_wasm_alloc(GhosttyGridRefLayout.size);
    try {
      if (this.exports.ghostty_terminal_grid_ref(this.handle, pointPtr, refPtr) !== 0) {
        return null;
      }

      // Pre-fetch the terminal's effective palette (256 RGB triples =
      // 768 bytes) so we can resolve PALETTE-tagged style colors per
      // cell without a round-trip per resolution. Cells with style
      // colors of tag NONE leave fg_r/g/b at 0; the renderer's
      // isDefaultFg path treats that as "use theme default."
      const PAL_SIZE = 768;
      const palettePtr = this.exports.ghostty_wasm_alloc(PAL_SIZE);
      const palOk =
        this.exports.ghostty_terminal_get(this.handle, TerminalData.COLOR_PALETTE, palettePtr) ===
        0;
      const palette = palOk
        ? new Uint8Array(this.memory.buffer, palettePtr, PAL_SIZE).slice()
        : null;

      const cells: GhosttyCell[] = new Array(this._cols);
      const cellPtr = this.exports.ghostty_wasm_alloc(8);
      const rowPtr = this.exports.ghostty_wasm_alloc(8);
      const rowGraphemePtr = this.exports.ghostty_wasm_alloc(1);
      const u32Ptr = this.exports.ghostty_wasm_alloc(4);
      const widePtr = this.exports.ghostty_wasm_alloc(4);
      const GRAPHEME_SCRATCH_CODEPOINTS = 32;
      const GRAPHEME_SCRATCH_BYTES = GRAPHEME_SCRATCH_CODEPOINTS * 4;
      const graphemeBufPtr = this.exports.ghostty_wasm_alloc(GRAPHEME_SCRATCH_BYTES);
      // Style is the 16-byte frozen GhosttyStyle struct (GhosttyStyleLayout.size).
      const STYLE_SIZE = GhosttyStyleLayout.size;
      const stylePtr = this.exports.ghostty_wasm_alloc(STYLE_SIZE);
      try {
        let rowHasGrapheme = false;
        if (this.exports.ghostty_grid_ref_row(refPtr, rowPtr) === 0) {
          const rowU64 = new DataView(this.memory.buffer).getBigUint64(rowPtr, true);
          if (this.exports.ghostty_row_get(rowU64, RowData.GRAPHEME, rowGraphemePtr) === 0) {
            rowHasGrapheme = new DataView(this.memory.buffer).getUint8(rowGraphemePtr) !== 0;
          }
        }

        for (let col = 0; col < this._cols; col++) {
          // Step along the row by mutating ref.x in place.
          new DataView(this.memory.buffer).setUint16(
            refPtr + GhosttyGridRefLayout.offset.x,
            col,
            true
          );
          if (this.exports.ghostty_grid_ref_cell(refPtr, cellPtr) !== 0) {
            cells[col] = this.makeEmptyCell();
            continue;
          }
          const memView = new DataView(this.memory.buffer);
          const cellU64 = memView.getBigUint64(cellPtr, true);

          // Codepoint.
          this.exports.ghostty_cell_get(cellU64, CellData.CODEPOINT, u32Ptr);
          const cp = new DataView(this.memory.buffer).getUint32(u32Ptr, true);

          // Width: same NARROW/WIDE/SPACER mapping as getViewport.
          this.exports.ghostty_cell_get(cellU64, CellData.WIDE, widePtr);
          const wide = new DataView(this.memory.buffer).getUint32(widePtr, true);
          const width =
            wide === CellWide.WIDE
              ? 2
              : wide === CellWide.SPACER_TAIL || wide === CellWide.SPACER_HEAD
                ? 0
                : 1;

          // Hyperlink ID interned by URI.
          this.exports.ghostty_cell_get(cellU64, CellData.HAS_HYPERLINK, widePtr);
          const hasHyperlink = new DataView(this.memory.buffer).getUint8(widePtr) !== 0;

          // Style: per-position via grid_ref_style (not via cell —
          // styles aren't stored in the cell value, they're attached
          // to the row's pin position).
          const styleOk = this.exports.ghostty_grid_ref_style(refPtr, stylePtr) === 0;

          const cell = this.makeEmptyCell();
          cell.codepoint = cp;
          cell.width = width;
          cell.hyperlink_id = hasHyperlink
            ? this.internHyperlinkUri(this.readHyperlinkUriFromRef(refPtr))
            : 0;

          if (rowHasGrapheme && cp !== 0) {
            this.exports.ghostty_grid_ref_graphemes(refPtr, 0, 0, u32Ptr);
            const needed = new DataView(this.memory.buffer).getUint32(u32Ptr, true);
            if (needed > 1) {
              let bufPtr = graphemeBufPtr;
              let usedDynamic = false;
              const wantBytes = needed * 4;
              if (needed > GRAPHEME_SCRATCH_CODEPOINTS) {
                bufPtr = this.exports.ghostty_wasm_alloc(wantBytes);
                usedDynamic = true;
              }
              try {
                if (this.exports.ghostty_grid_ref_graphemes(refPtr, bufPtr, needed, u32Ptr) === 0) {
                  const view = new DataView(this.memory.buffer);
                  const written = view.getUint32(u32Ptr, true);
                  if (written > 1) {
                    cell.codepoint = view.getUint32(bufPtr, true);
                    cell.grapheme_len = written - 1;
                    const extras = new Array<number>(written - 1);
                    for (let g = 1; g < written; g++) {
                      extras[g - 1] = view.getUint32(bufPtr + g * 4, true);
                    }
                    cell.grapheme = extras;
                  }
                }
              } finally {
                if (usedDynamic) this.exports.ghostty_wasm_free(bufPtr, wantBytes);
              }
            }
          }

          if (styleOk) {
            const v = new DataView(this.memory.buffer);
            cell.flags = this.styleFlagsToCellFlags(
              v.getUint16(stylePtr + GhosttyStyleLayout.offset.flags, true)
            );
            this.resolveStyleColor(
              stylePtr + GhosttyStyleLayout.offset.fg_color,
              palette,
              cell,
              /*isFg=*/ true
            );
            this.resolveStyleColor(
              stylePtr + GhosttyStyleLayout.offset.bg_color,
              palette,
              cell,
              /*isFg=*/ false
            );
          }

          cells[col] = cell;
        }
      } finally {
        this.exports.ghostty_wasm_free(cellPtr, 8);
        this.exports.ghostty_wasm_free(rowPtr, 8);
        this.exports.ghostty_wasm_free(rowGraphemePtr, 1);
        this.exports.ghostty_wasm_free(u32Ptr, 4);
        this.exports.ghostty_wasm_free(widePtr, 4);
        this.exports.ghostty_wasm_free(graphemeBufPtr, GRAPHEME_SCRATCH_BYTES);
        this.exports.ghostty_wasm_free(stylePtr, STYLE_SIZE);
        this.exports.ghostty_wasm_free(palettePtr, PAL_SIZE);
      }
      return cells;
    } finally {
      this.exports.ghostty_wasm_free(pointPtr, 24);
      this.exports.ghostty_wasm_free(refPtr, GhosttyGridRefLayout.size);
    }
  }

  /**
   * Decode a GhosttyStyleColor (4 bytes at colorPtr — tag@0:u8, then the
   * value: palette index@1, or rgb@1..3) and write the resolved RGB into
   * the cell's fg_* or bg_* triple. Tag values: NONE=0 (leaves zeros so the renderer's
   * theme fallback kicks in), PALETTE=1 (looks up the terminal's
   * effective palette), RGB=2 (direct read).
   */
  /**
   * Pack GhosttyStyleFlags (u16) into the CellFlags bitmask the renderer
   * consumes. Overline is not modelled; any non-NONE underline style
   * collapses to the single UNDERLINE flag.
   */
  private styleFlagsToCellFlags(flags: number): number {
    let f = 0;
    if (flags & StyleFlag.BOLD) f |= CellFlags.BOLD;
    if (flags & StyleFlag.ITALIC) f |= CellFlags.ITALIC;
    if (flags & StyleFlag.FAINT) f |= CellFlags.FAINT;
    if (flags & StyleFlag.BLINK) f |= CellFlags.BLINK;
    if (flags & StyleFlag.INVERSE) f |= CellFlags.INVERSE;
    if (flags & StyleFlag.INVISIBLE) f |= CellFlags.INVISIBLE;
    if (flags & StyleFlag.STRIKETHROUGH) f |= CellFlags.STRIKETHROUGH;
    if (flags & StyleFlag.UNDERLINE_MASK) f |= CellFlags.UNDERLINE;
    return f;
  }

  private resolveStyleColor(
    colorPtr: number,
    palette: Uint8Array | null,
    cell: GhosttyCell,
    isFg: boolean
  ): void {
    const view = new DataView(this.memory.buffer);
    const tag = view.getUint8(colorPtr + GhosttyStyleColorLayout.offset.tag);
    const valuePtr = colorPtr + GhosttyStyleColorLayout.offset.value;
    let r = 0;
    let g = 0;
    let b = 0;
    // NONE: no explicit color — the cell uses the terminal's default fg/bg.
    // PALETTE / RGB are explicit; record the resolved RGB.
    const isDefault = tag === GhosttyStyleColorTag.NONE;
    if (tag === GhosttyStyleColorTag.PALETTE && palette) {
      const idx = view.getUint8(valuePtr);
      r = palette[idx * 3 + 0]!;
      g = palette[idx * 3 + 1]!;
      b = palette[idx * 3 + 2]!;
    } else if (tag === GhosttyStyleColorTag.RGB) {
      r = view.getUint8(valuePtr + GhosttyColorRgbLayout.offset.r);
      g = view.getUint8(valuePtr + GhosttyColorRgbLayout.offset.g);
      b = view.getUint8(valuePtr + GhosttyColorRgbLayout.offset.b);
    }
    if (isFg) {
      cell.fg_r = r;
      cell.fg_g = g;
      cell.fg_b = b;
      cell.fgIsDefault = isDefault;
    } else {
      cell.bg_r = r;
      cell.bg_g = g;
      cell.bg_b = b;
      cell.bgIsDefault = isDefault;
    }
  }

  private readHyperlinkUri(tag: PointTag, y: number, col: number): string | null {
    const pointPtr = this.allocPoint(tag, col, y);
    const refPtr = this.exports.ghostty_wasm_alloc(GhosttyGridRefLayout.size);
    try {
      if (this.exports.ghostty_terminal_grid_ref(this.handle, pointPtr, refPtr) !== 0) {
        return null;
      }
      return this.readHyperlinkUriFromRef(refPtr);
    } finally {
      this.exports.ghostty_wasm_free(pointPtr, 24);
      this.exports.ghostty_wasm_free(refPtr, GhosttyGridRefLayout.size);
    }
  }

  private readHyperlinkUriFromRef(refPtr: number): string | null {
    // Two-pass read: first call with len=0 to get required size, then
    // allocate exactly. Most cells have no hyperlink — we get out_len=0
    // on the first call and skip the second alloc entirely.
    const outLenPtr = this.exports.ghostty_wasm_alloc(4);
    try {
      // First pass: pass NULL buf (0) and len=0; out_len gets populated.
      // ghostty_grid_ref_hyperlink_uri returns OUT_OF_SPACE when there
      // is data; SUCCESS with out_len=0 when there is none.
      this.exports.ghostty_grid_ref_hyperlink_uri(refPtr, 0, 0, outLenPtr);
      const needed = new DataView(this.memory.buffer).getUint32(outLenPtr, true);
      if (needed === 0) return null;

      const bufPtr = this.exports.ghostty_wasm_alloc(needed);
      try {
        const r = this.exports.ghostty_grid_ref_hyperlink_uri(refPtr, bufPtr, needed, outLenPtr);
        if (r !== 0) return null;
        const written = new DataView(this.memory.buffer).getUint32(outLenPtr, true);
        const bytes = new Uint8Array(this.memory.buffer, bufPtr, written);
        return new TextDecoder().decode(bytes.slice());
      } finally {
        this.exports.ghostty_wasm_free(bufPtr, needed);
      }
    } finally {
      this.exports.ghostty_wasm_free(outLenPtr, 4);
    }
  }

  private allocPoint(tag: PointTag, x: number, y: number): number {
    const ptr = this.exports.ghostty_wasm_alloc(GhosttyPointLayout.size);
    const view = new DataView(this.memory.buffer);
    // Zero the padding bytes too, since we don't want stale memory in the union.
    new Uint8Array(this.memory.buffer, ptr, GhosttyPointLayout.size).fill(0);
    const coord = ptr + GhosttyPointLayout.offset.value + GhosttyPointValueLayout.offset.coordinate;
    view.setUint32(ptr + GhosttyPointLayout.offset.tag, tag, true);
    view.setUint16(coord + GhosttyPointCoordinateLayout.offset.x, x, true);
    view.setUint32(coord + GhosttyPointCoordinateLayout.offset.y, y, true);
    return ptr;
  }

  private makeEmptyCell(): GhosttyCell {
    return {
      codepoint: 0,
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
    };
  }

  /**
   * Whether any terminal response bytes are queued for readResponse().
   *
   * Responses are delivered synchronously during vt_write() by the
   * WRITE_PTY callback (e.g. DSR replies, XTVERSION, in-band size reports).
   * They sit in pendingResponses until drained.
   */
  hasResponse(): boolean {
    return this.pendingResponses.length > 0;
  }

  /**
   * Drain queued response bytes, decode as UTF-8, return as a single
   * string. Multiple callback invocations are concatenated. Returns null
   * when nothing's pending so the demo's echo loop can short-circuit.
   */
  readResponse(): string | null {
    if (this.pendingResponses.length === 0) return null;
    let total = 0;
    for (const chunk of this.pendingResponses) total += chunk.length;
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.pendingResponses) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.pendingResponses.length = 0;
    return new TextDecoder().decode(merged);
  }

  /**
   * Install the terminal and image-loading trampoline callbacks.
   *
   * Trampolines are shared across all terminals that come from the
   * same WASM instance, but NOT across instances — terminal handles are
   * only unique within their parent module, and table indices in module
   * A are meaningless in module B's table. So we keep a per-table
   * registry (WeakMap keyed on the indirect function table) that owns
   * the slot indices plus the handle→instance routing map for that
   * table.
   *
   * On first use for a given table we instantiate the trampolines,
   * grow the table, and write the five callbacks into new slots. Subsequent
   * terminals from the same module reuse the registry and just
   * register their handle in instancesByHandle.
   */
  private installCallbacks(): void {
    const table = (
      this.exports as unknown as {
        __indirect_function_table: WebAssembly.Table;
      }
    ).__indirect_function_table;

    let registry = GhosttyTerminal.callbackRegistries.get(table);
    if (!registry) {
      const instancesByHandle = new Map<number, GhosttyTerminal>();
      const writePtyDispatch: WritePtyCallback = (handle, _userdata, dataPtr, dataLen) => {
        const term = instancesByHandle.get(handle);
        if (!term) return;
        // Copy out — the underlying WASM memory may be mutated or
        // detached by the next allocation, and the chunk lives until
        // readResponse drains it.
        term.pendingResponses.push(new Uint8Array(term.memory.buffer, dataPtr, dataLen).slice());
      };
      const programStatusDispatch: ProgramStatusCallback = (handle, _userdata, ptr) => {
        const term = instancesByHandle.get(handle);
        if (!term) return;
        // GhosttyTerminalProgramStatus; the strings are borrowed GhosttyStrings.
        const view = new DataView(term.memory.buffer);
        const o = GhosttyTerminalProgramStatusLayout.offset;
        const states = ['idle', 'working', 'done', 'blocked', 'error', 'clear'] as const;
        const kinds = [null, 'permission', 'question', 'auth'] as const;
        const state = states[view.getUint32(ptr + o.state, true)];
        const kind = kinds[view.getUint32(ptr + o.kind, true)];
        if (state === undefined || kind === undefined) return;
        const text = (offset: number) =>
          new TextDecoder().decode(
            new Uint8Array(
              term.memory.buffer,
              view.getUint32(ptr + offset + GhosttyStringLayout.offset.ptr, true),
              view.getUint32(ptr + offset + GhosttyStringLayout.offset.len, true)
            )
          );
        const progress = view.getInt8(ptr + o.progress);
        term.pendingProgramStatus.push({
          state,
          kind,
          progress: progress < 0 ? null : progress,
          id: text(o.id),
          app: text(o.app),
          title: text(o.title),
          message: text(o.message),
        });
      };
      const sizeDispatch: SizeCallback = (handle, _userdata, outSizePtr) => {
        const term = instancesByHandle.get(handle);
        if (!term) return 0;
        // Without real cell pixel dims the response would be nonsense;
        // returning false (0) tells the terminal to silently drop the
        // size query, matching coder's old behavior for unconfigured
        // pixel sizes.
        if (term.cellWidthPx === 0 || term.cellHeightPx === 0) return 0;
        const view = new DataView(term.memory.buffer);
        const o = GhosttySizeReportSizeLayout.offset;
        view.setUint16(outSizePtr + o.rows, term._rows, true);
        view.setUint16(outSizePtr + o.columns, term._cols, true);
        view.setUint32(outSizePtr + o.cell_width, term.cellWidthPx, true);
        view.setUint32(outSizePtr + o.cell_height, term.cellHeightPx, true);
        return 1;
      };
      // PNG decoder dispatcher. Called by ghostty when it needs to
      // decode a kitty graphics PNG payload (kitten icat sends these by
      // default — won't work without a decoder installed). Synchronous;
      // we lean on fast-png for sync decode since createImageBitmap is
      // async and unavailable from a sync C callback.
      //
      // Inputs: an allocator pointer (the library's, so the buffer we
      // hand back gets freed on the same heap), PNG bytes in WASM
      // memory, and a 16-byte out struct to fill.
      // Out layout (GhosttySysImage): u32 width @ 0, u32 height @ 4,
      // u32 data_ptr @ 8, u32 data_len @ 12.
      const exports = this.exports;
      const memory = this.memory;
      const decodePngDispatch: DecodePngCallback = (
        _userdata,
        allocator,
        dataPtr,
        dataLen,
        outImagePtr
      ) => {
        try {
          const pngBytes = new Uint8Array(memory.buffer, dataPtr, dataLen).slice();
          const img = decodePng(pngBytes);
          // fast-png returns 8/16-bit per channel data and various
          // channel counts (plus an optional palette for indexed PNGs).
          // The library expects RGBA u8. Normalize.
          const rgba = pngToRgba8(img);
          if (!rgba) return 0;
          const outBuf = exports.ghostty_alloc(allocator, rgba.length);
          if (outBuf === 0) return 0;
          new Uint8Array(memory.buffer, outBuf, rgba.length).set(rgba);
          const view = new DataView(memory.buffer);
          const o = GhosttySysImageLayout.offset;
          view.setUint32(outImagePtr + o.width, img.width, true);
          view.setUint32(outImagePtr + o.height, img.height, true);
          view.setUint32(outImagePtr + o.data, outBuf, true);
          view.setUint32(outImagePtr + o.data_len, rgba.length, true);
          return 1;
        } catch {
          return 0;
        }
      };

      const readSharedMemoryDispatch: ReadSharedMemoryCallback = (
        _userdata,
        allocator,
        namePtr,
        nameLen,
        outImagePtr
      ) => {
        const sharedMemory = globalThis.ghosttyKittySharedMemory;
        if (!(sharedMemory instanceof Map)) return 0;
        const name = new TextDecoder().decode(new Uint8Array(memory.buffer, namePtr, nameLen));
        if (!sharedMemory.has(name)) return 0;
        const bytes = sharedMemory.get(name);
        let outBuf = 0;
        let byteLength = 0;
        try {
          if (
            !(bytes instanceof Uint8Array) ||
            bytes.length === 0 ||
            bytes.length > 400 * 1024 * 1024
          )
            return 0;
          byteLength = bytes.length;
          outBuf = exports.ghostty_alloc(allocator, byteLength);
          if (outBuf === 0) return 0;
          // Allocation may grow the WASM memory: acquire fresh views afterwards.
          new Uint8Array(memory.buffer, outBuf, byteLength).set(bytes);
          const view = new DataView(memory.buffer);
          const o = GhosttySysImageLayout.offset;
          view.setUint32(outImagePtr + o.width, 0, true);
          view.setUint32(outImagePtr + o.height, 0, true);
          view.setUint32(outImagePtr + o.data, outBuf, true);
          view.setUint32(outImagePtr + o.data_len, byteLength, true);
          return 1;
        } catch {
          if (outBuf !== 0) exports.ghostty_free(allocator, outBuf, byteLength);
          return 0;
        } finally {
          // Like shm_unlink, consume even when validation/allocation fails.
          sharedMemory.delete(name);
        }
      };

      const bellDispatch: NotifyCallback = (handle, _userdata) => {
        const term = instancesByHandle.get(handle);
        if (!term) return;
        term.pendingBells++;
      };

      const titleChangedDispatch: NotifyCallback = (handle, _userdata) => {
        const term = instancesByHandle.get(handle);
        if (!term) return;
        term.pendingTitleChanges.push(term.getTitle());
      };

      const renderHoldDispatch: RenderHoldCallback = (handle, _userdata, held) => {
        const term = instancesByHandle.get(handle);
        if (!term) return;
        term.handleRenderHold(held !== 0);
      };

      // ---- libghostty-vt 1.0 effect callbacks ----
      // Shared decoders for borrowed payload structs. Strings are copied
      // before the callback returns.
      const utf8 = new TextDecoder();
      const str = GhosttyStringLayout.offset;
      const readString = (term: GhosttyTerminal, ptr: number): string => {
        const view = new DataView(term.memory.buffer);
        const dataPtr = view.getUint32(ptr + str.ptr, true);
        const len = view.getUint32(ptr + str.len, true);
        if (dataPtr === 0 || len === 0) return '';
        return utf8.decode(new Uint8Array(term.memory.buffer, dataPtr, len));
      };
      const readBytes = (term: GhosttyTerminal, ptr: number): Uint8Array => {
        const view = new DataView(term.memory.buffer);
        const dataPtr = view.getUint32(ptr + str.ptr, true);
        const len = view.getUint32(ptr + str.len, true);
        if (dataPtr === 0 || len === 0) return new Uint8Array(0);
        return new Uint8Array(term.memory.buffer, dataPtr, len).slice();
      };
      const locations = ['standard', 'selection', 'primary'] as const;
      // Reply function pointers are table indices; call_indirect from JS.
      const replyFn = (index: number): ((request: number, reply: number) => void) | null => {
        const fn = index !== 0 ? table.get(index) : null;
        return typeof fn === 'function' ? (fn as (request: number, reply: number) => void) : null;
      };

      const content = GhosttyClipboardContentLayout;
      const writeResults: Record<ClipboardWriteResult, GhosttyClipboardWriteResult> = {
        success: GhosttyClipboardWriteResult.SUCCESS,
        denied: GhosttyClipboardWriteResult.DENIED,
        unsupported: GhosttyClipboardWriteResult.UNSUPPORTED,
      };
      const clipboardWriteDispatch: PayloadCallback = (handle, _userdata, ptr) => {
        const term = instancesByHandle.get(handle);
        if (!term) return;
        const view = new DataView(term.memory.buffer);
        const o = GhosttyClipboardWriteLayout.offset;
        const contentsPtr = view.getUint32(ptr + o.contents, true);
        const contentsLen = view.getUint32(ptr + o.contents_len, true);
        const contents: ClipboardContent[] = [];
        for (let i = 0; i < contentsLen; i++) {
          const entry = contentsPtr + i * content.size;
          contents.push({
            mime: readString(term, entry + content.offset.mime),
            data: readBytes(term, entry + content.offset.data),
          });
        }
        const textEntry = contents.find((c) => c.mime.startsWith('text/'));
        const event: ClipboardWriteEvent = {
          location: locations[view.getUint32(ptr + o.location, true)] ?? 'standard',
          text: textEntry ? utf8.decode(textEntry.data) : null,
          contents,
          program: readString(term, ptr + o.name),
          granted: view.getUint8(ptr + o.granted) !== 0,
        };
        const decision = term.clipboardWritePolicy?.(event);
        if (decision === undefined) return; // no policy: returning denies the write
        const reply = replyFn(view.getUint32(ptr + o.reply, true));
        if (!reply) return;
        const replyLayout = GhosttyClipboardWriteReplyLayout;
        const replyPtr = term.exports.ghostty_wasm_alloc(replyLayout.size);
        try {
          const rv = new DataView(term.memory.buffer);
          rv.setUint32(replyPtr + replyLayout.offset.size, replyLayout.size, true);
          rv.setUint32(replyPtr + replyLayout.offset.result, writeResults[decision], true);
          rv.setUint8(replyPtr + replyLayout.offset.remember, 0);
          reply(ptr, replyPtr);
        } finally {
          term.exports.ghostty_wasm_free(replyPtr, replyLayout.size);
        }
        if (decision === 'success') term.pendingClipboardWrites.push(event);
      };

      const clipboardReadDispatch: PayloadCallback = (handle, _userdata, ptr) => {
        const term = instancesByHandle.get(handle);
        if (!term || !term.clipboardReadHandler) return; // no reply: empty clipboard
        const view = new DataView(term.memory.buffer);
        const o = GhosttyClipboardReadLayout.offset;
        const mimesPtr = view.getUint32(ptr + o.mimes, true);
        const mimesLen = view.getUint32(ptr + o.mimes_len, true);
        const mimes: string[] = [];
        for (let i = 0; i < mimesLen; i++) {
          mimes.push(readString(term, mimesPtr + i * GhosttyStringLayout.size));
        }
        const text = term.clipboardReadHandler({
          location: locations[view.getUint32(ptr + o.location, true)] ?? 'standard',
          mimes,
          list: view.getUint8(ptr + o.list) !== 0,
          program: readString(term, ptr + o.name),
          granted: view.getUint8(ptr + o.granted) !== 0,
        });
        const reply = replyFn(view.getUint32(ptr + o.reply, true));
        if (!reply) return;
        // Reply with one text/plain GhosttyClipboardContent on success; the
        // reply struct, content struct and bytes share one allocation.
        const replyLayout = GhosttyClipboardReadReplyLayout;
        const r = replyLayout.offset;
        const mime = new TextEncoder().encode('text/plain');
        const data = text === null ? new Uint8Array(0) : new TextEncoder().encode(text);
        const total = replyLayout.size + content.size + mime.length + data.length;
        const buf = term.exports.ghostty_wasm_alloc(total);
        try {
          const mem = new Uint8Array(term.memory.buffer);
          const rv = new DataView(term.memory.buffer);
          const contentPtr = buf + replyLayout.size;
          const mimePtr = contentPtr + content.size;
          const dataPtr = mimePtr + mime.length;
          mem.set(mime, mimePtr);
          mem.set(data, dataPtr);
          rv.setUint32(contentPtr + content.offset.mime + str.ptr, mimePtr, true);
          rv.setUint32(contentPtr + content.offset.mime + str.len, mime.length, true);
          rv.setUint32(contentPtr + content.offset.data + str.ptr, dataPtr, true);
          rv.setUint32(contentPtr + content.offset.data + str.len, data.length, true);
          const denied = text === null;
          rv.setUint32(buf + r.size, replyLayout.size, true);
          rv.setUint32(
            buf + r.result,
            denied ? GhosttyClipboardReadResult.DENIED : GhosttyClipboardReadResult.SUCCESS,
            true
          );
          rv.setUint32(buf + r.contents, denied ? 0 : contentPtr, true);
          rv.setUint32(buf + r.contents_len, denied ? 0 : 1, true);
          rv.setUint32(buf + r.available, 0, true);
          rv.setUint32(buf + r.available_len, 0, true);
          rv.setUint8(buf + r.remember, 0);
          reply(ptr, buf);
        } finally {
          term.exports.ghostty_wasm_free(buf, total);
        }
      };

      const pwdChangedDispatch: NotifyCallback = (handle, _userdata) => {
        const term = instancesByHandle.get(handle);
        if (!term) return;
        term.pendingPwdChanges.push(term.getPwd());
      };

      const desktopNotificationDispatch: PayloadCallback = (handle, _userdata, ptr) => {
        const term = instancesByHandle.get(handle);
        if (!term) return;
        const o = GhosttyTerminalDesktopNotificationLayout.offset;
        term.pendingNotifications.push({
          title: readString(term, ptr + o.title),
          body: readString(term, ptr + o.body),
        });
      };

      // progress is an i8; -1 means "no percentage".
      const progressStates = ['remove', 'set', 'error', 'indeterminate', 'pause'] as const;
      const progressReportDispatch: PayloadCallback = (handle, _userdata, ptr) => {
        const term = instancesByHandle.get(handle);
        if (!term) return;
        const view = new DataView(term.memory.buffer);
        const o = GhosttyTerminalProgressReportLayout.offset;
        const state = progressStates[view.getUint32(ptr + o.state, true)];
        if (!state) return;
        const progress = view.getInt8(ptr + o.progress);
        term.pendingProgress.push({ state, progress: progress < 0 ? null : progress });
      };

      const promptKinds = [
        undefined,
        'prompt-start',
        'input-start',
        'output-start',
        'command-end',
      ] as const;
      const promptPromptKinds = ['primary', 'right', 'continuation', 'secondary'] as const;
      const semanticPromptDispatch: PayloadCallback = (handle, _userdata, ptr) => {
        const term = instancesByHandle.get(handle);
        if (!term) return;
        const view = new DataView(term.memory.buffer);
        const o = GhosttyTerminalSemanticPromptLayout.offset;
        const kind = promptKinds[view.getUint32(ptr + o.kind, true)];
        const promptKind = promptPromptKinds[view.getUint32(ptr + o.prompt_kind, true)];
        if (!kind || !promptKind) return;
        term.pendingSemanticPrompts.push({
          kind,
          promptKind,
          exitCode:
            view.getUint8(ptr + o.has_exit_code) !== 0
              ? view.getInt32(ptr + o.exit_code, true)
              : null,
          command: readString(term, ptr + o.command),
          error: readString(term, ptr + o.error),
        });
      };

      // Unknown resize tags are ignored.
      const resizeWindowDispatch: PayloadCallback = (handle, _userdata, ptr) => {
        const term = instancesByHandle.get(handle);
        if (!term) return;
        const view = new DataView(term.memory.buffer);
        const o = GhosttyTerminalResizeWindowLayout.offset;
        if (view.getUint32(ptr + o.tag, true) !== GhosttyTerminalResizeWindowTag.GRID) return;
        const grid = ptr + o.value + GhosttyTerminalResizeWindowValueLayout.offset.grid;
        const g = GhosttyTerminalResizeWindowGridLayout.offset;
        term.pendingResizeRequests.push({
          rows: view.getUint16(grid + g.rows, true),
          cols: view.getUint16(grid + g.columns, true),
        });
      };

      // COLOR_SCHEME: write a GhosttyColorScheme and return true.
      const colorSchemeDispatch: ColorSchemeCallback = (handle, _userdata, outPtr) => {
        const term = instancesByHandle.get(handle);
        const scheme = term?.colorSchemeProvider?.();
        if (!scheme) return 0;
        new DataView(term!.memory.buffer).setUint32(
          outPtr,
          scheme === 'dark' ? GhosttyColorScheme.DARK : GhosttyColorScheme.LIGHT,
          true
        );
        return 1;
      };

      const fwd = makeCallbackTrampolines({
        writePty: writePtyDispatch,
        size: sizeDispatch,
        decodePng: decodePngDispatch,
        readShm: readSharedMemoryDispatch,
        programStatus: programStatusDispatch,
        bell: bellDispatch,
        titleChanged: titleChangedDispatch,
        renderHold: renderHoldDispatch,
        clipboardWrite: clipboardWriteDispatch,
        clipboardRead: clipboardReadDispatch,
        pwdChanged: pwdChangedDispatch,
        desktopNotification: desktopNotificationDispatch,
        progressReport: progressReportDispatch,
        semanticPrompt: semanticPromptDispatch,
        resizeWindow: resizeWindowDispatch,
        colorScheme: colorSchemeDispatch,
      });
      // Grow once per slot, write each.
      const slot = (fn: unknown): number => {
        const index = table.grow(1);
        // Funcrefs exported from the trampoline module are valid table values.
        table.set(index, fn as Parameters<WebAssembly.Table['set']>[1]);
        return index;
      };
      registry = {
        writePtyIndex: slot(fwd.writePty),
        sizeIndex: slot(fwd.size),
        decodePngIndex: slot(fwd.decodePng),
        readShmIndex: slot(fwd.readShm),
        programStatusIndex: slot(fwd.programStatus),
        bellIndex: slot(fwd.bell),
        titleChangedIndex: slot(fwd.titleChanged),
        renderHoldIndex: slot(fwd.renderHold),
        clipboardWriteIndex: slot(fwd.clipboardWrite),
        clipboardReadIndex: slot(fwd.clipboardRead),
        pwdChangedIndex: slot(fwd.pwdChanged),
        desktopNotificationIndex: slot(fwd.desktopNotification),
        progressReportIndex: slot(fwd.progressReport),
        semanticPromptIndex: slot(fwd.semanticPrompt),
        resizeWindowIndex: slot(fwd.resizeWindow),
        colorSchemeIndex: slot(fwd.colorScheme),
        instancesByHandle,
      };

      // Install PNG decoder system-wide for this WASM instance. sys_set
      // is process/instance-global (not per-terminal) so we do it
      // exactly once per __indirect_function_table — same lifetime as
      // the trampoline registry itself.
      this.exports.ghostty_sys_set(SysOption.DECODE_PNG, registry.decodePngIndex);
      const result = this.exports.ghostty_sys_set(
        SysOption.READ_SHARED_MEMORY,
        registry.readShmIndex
      );
      if (result !== 0) throw new Error(`Installing Kitty shared memory failed: ${result}`);
      // Publish the capability only after the hook is installed successfully.
      globalThis.ghosttyKittySharedMemory ??= new Map<string, Uint8Array>();
      GhosttyTerminal.callbackRegistries.set(table, registry);
    }

    // Register `this` so the dispatchers (both close over
    // instancesByHandle) can route to the right instance.
    registry.instancesByHandle.set(this.handle, this);
    this.callbackRegistry = registry;

    // The third arg to _set is the value — for callbacks ("pointer
    // types"), the value IS the function pointer, i.e. the table index
    // we just installed, passed directly.
    this.exports.ghostty_terminal_set(
      this.handle,
      TerminalOption.WRITE_PTY,
      registry.writePtyIndex
    );
    this.exports.ghostty_terminal_set(this.handle, TerminalOption.SIZE, registry.sizeIndex);
    this.exports.ghostty_terminal_set(this.handle, TerminalOption.BELL, registry.bellIndex);
    this.exports.ghostty_terminal_set(
      this.handle,
      TerminalOption.TITLE_CHANGED,
      registry.titleChangedIndex
    );
    this.exports.ghostty_terminal_set(
      this.handle,
      TerminalOption.RENDER_HOLD,
      registry.renderHoldIndex
    );
    // Effect callbacks that only observe (or, for clipboard writes, apply a
    // policy that defaults to deny). CLIPBOARD_READ is installed lazily by
    // setClipboardReadHandler() because its presence changes paste behavior.
    for (const [option, index] of [
      [TerminalOption.CLIPBOARD_WRITE, registry.clipboardWriteIndex],
      [TerminalOption.PWD_CHANGED, registry.pwdChangedIndex],
      [TerminalOption.DESKTOP_NOTIFICATION, registry.desktopNotificationIndex],
      [TerminalOption.PROGRESS_REPORT, registry.progressReportIndex],
      [TerminalOption.SEMANTIC_PROMPT, registry.semanticPromptIndex],
      [TerminalOption.RESIZE_WINDOW, registry.resizeWindowIndex],
      [TerminalOption.COLOR_SCHEME, registry.colorSchemeIndex],
    ] as const) {
      this.exports.ghostty_terminal_set(this.handle, option, index);
    }
    if (this.clipboardReadHandler) {
      this.exports.ghostty_terminal_set(
        this.handle,
        TerminalOption.CLIPBOARD_READ,
        registry.clipboardReadIndex
      );
    }
  }

  /**
   * Query arbitrary terminal mode by number.
   * @param mode Mode number (e.g., 25 for cursor visibility, 2004 for bracketed paste)
   * @param isAnsi True for ANSI modes, false for DEC modes (default: false)
   */
  getMode(mode: number, isAnsi: boolean = false): boolean {
    const o = GhosttyTerminalModeConfigLayout.offset;
    const out = this.exports.ghostty_wasm_alloc(GhosttyTerminalModeConfigLayout.size);
    try {
      new DataView(this.memory.buffer).setUint16(out + o.mode, packMode(mode, isAnsi), true);
      const result = this.exports.ghostty_terminal_get(this.handle, TerminalData.MODE, out);
      return result === 0 && new DataView(this.memory.buffer).getUint8(out + o.value) !== 0;
    } finally {
      this.exports.ghostty_wasm_free(out, GhosttyTerminalModeConfigLayout.size);
    }
  }

  /**
   * Query the active Kitty keyboard protocol flags bitmask (u8).
   */
  getKittyKeyboardFlags(): number {
    const out = this.exports.ghostty_wasm_alloc(4);
    try {
      const result = this.exports.ghostty_terminal_get(
        this.handle,
        TerminalData.KITTY_KEYBOARD_FLAGS,
        out
      );
      if (result !== 0) return 0;
      return new DataView(this.memory.buffer).getUint8(out);
    } finally {
      this.exports.ghostty_wasm_free(out, 4);
    }
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private initCellPool(): void {
    const total = this._cols * this._rows;
    if (this.cellPool.length < total) {
      for (let i = this.cellPool.length; i < total; i++) {
        this.cellPool.push({
          codepoint: 0,
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
        });
      }
    }
  }

  /**
   * Get all codepoints for a grapheme cluster at the given position.
   * For most cells this returns a single codepoint, but for complex scripts
   * (Hindi, emoji with ZWJ, etc.) it returns multiple codepoints.
   * @returns Array of codepoints, or null on error
   */
  getGrapheme(row: number, col: number): number[] | null {
    if (row < 0 || row >= this._rows) return null;
    if (col < 0 || col >= this._cols) return null;

    this.update();

    // Bind iterator to current state and walk forward to the target row.
    this.populateHandle(
      (out) =>
        this.exports.ghostty_render_state_get(this.renderHandle, RenderStateData.ROW_ITERATOR, out),
      this.rowIter
    );
    for (let r = 0; r <= row; r++) {
      if (!this.exports.ghostty_render_state_row_iterator_next(this.rowIter)) {
        return null;
      }
    }

    // Bind cells from this row, then position at the target column.
    this.populateHandle(
      (out) =>
        this.exports.ghostty_render_state_row_get(this.rowIter, RenderStateRowData.CELLS, out),
      this.rowCells
    );
    if (this.exports.ghostty_render_state_row_cells_select(this.rowCells, col) !== 0) {
      return null;
    }

    const lenPtr = this.exports.ghostty_wasm_alloc(4);
    let len = 0;
    try {
      this.exports.ghostty_render_state_row_cells_get(
        this.rowCells,
        RowCellsData.GRAPHEMES_LEN,
        lenPtr
      );
      len = new DataView(this.memory.buffer).getUint32(lenPtr, true);
    } finally {
      this.exports.ghostty_wasm_free(lenPtr, 4);
    }
    if (len === 0) return [];

    const bufBytes = len * 4;
    const bufPtr = this.exports.ghostty_wasm_alloc(bufBytes);
    const descPtr = this.exports.ghostty_wasm_alloc(GhosttyCodepointBufferLayout.size);
    try {
      // GhosttyCodepointBuffer { ptr, cap, len }: point it at bufPtr.
      const desc = new DataView(this.memory.buffer);
      desc.setUint32(descPtr, bufPtr, true);
      desc.setUint32(descPtr + GhosttyCodepointBufferLayout.offset.cap, len, true);
      if (
        this.exports.ghostty_render_state_row_cells_get(
          this.rowCells,
          RowCellsData.GRAPHEMES_BUF,
          descPtr
        ) !== 0
      ) {
        return null;
      }
      // Copy out before freeing — the array reference shares the WASM memory
      // buffer and a subsequent allocation could detach it.
      return Array.from(new Uint32Array(this.memory.buffer, bufPtr, len));
    } finally {
      this.exports.ghostty_wasm_free(descPtr, GhosttyCodepointBufferLayout.size);
      this.exports.ghostty_wasm_free(bufPtr, bufBytes);
    }
  }

  /**
   * Get a string representation of the grapheme at the given position.
   * This properly handles complex scripts like Hindi, emoji with ZWJ, etc.
   */
  getGraphemeString(row: number, col: number): string {
    const codepoints = this.getGrapheme(row, col);
    if (!codepoints || codepoints.length === 0) return ' ';
    return String.fromCodePoint(...codepoints);
  }

  /**
   * Get all codepoints for a grapheme cluster in the scrollback buffer.
   * @param offset Scrollback line offset (0 = oldest)
   * @param col Column index
   * @returns Array of codepoints, or null on error
   */
  getScrollbackGrapheme(offset: number, col: number): number[] | null {
    if (col < 0 || col >= this._cols) return null;

    const pointPtr = this.allocPoint(PointTag.HISTORY, col, offset);
    const refPtr = this.exports.ghostty_wasm_alloc(GhosttyGridRefLayout.size);
    try {
      if (this.exports.ghostty_terminal_grid_ref(this.handle, pointPtr, refPtr) !== 0) {
        return null;
      }
      // Same two-pass pattern as readHyperlinkUri: query length first, then
      // allocate the exact codepoint buffer.
      const outLenPtr = this.exports.ghostty_wasm_alloc(4);
      try {
        this.exports.ghostty_grid_ref_graphemes(refPtr, 0, 0, outLenPtr);
        const needed = new DataView(this.memory.buffer).getUint32(outLenPtr, true);
        if (needed === 0) return [];

        const bytes = needed * 4; // codepoints are u32
        const bufPtr = this.exports.ghostty_wasm_alloc(bytes);
        try {
          const r = this.exports.ghostty_grid_ref_graphemes(refPtr, bufPtr, needed, outLenPtr);
          if (r !== 0) return null;
          const written = new DataView(this.memory.buffer).getUint32(outLenPtr, true);
          return Array.from(new Uint32Array(this.memory.buffer, bufPtr, written));
        } finally {
          this.exports.ghostty_wasm_free(bufPtr, bytes);
        }
      } finally {
        this.exports.ghostty_wasm_free(outLenPtr, 4);
      }
    } finally {
      this.exports.ghostty_wasm_free(pointPtr, 24);
      this.exports.ghostty_wasm_free(refPtr, GhosttyGridRefLayout.size);
    }
  }

  /**
   * Get a string representation of a grapheme in the scrollback buffer.
   */
  getScrollbackGraphemeString(offset: number, col: number): string {
    const codepoints = this.getScrollbackGrapheme(offset, col);
    if (!codepoints || codepoints.length === 0) return ' ';
    return String.fromCodePoint(...codepoints);
  }
}

/**
 * Normalize a fast-png decode result into a tightly packed 8-bit RGBA
 * buffer (4 bytes/pixel). fast-png returns whichever channel count and
 * bit depth the source PNG used (1/8/16-bit; 1/2/3/4 channels);
 * libghostty wants u8 RGBA.
 *
 * Returns null on any unexpected shape.
 */
function pngToRgba8(img: {
  width: number;
  height: number;
  channels: number;
  depth: number;
  // fast-png types this as PngDataArray (Uint8Array | Uint8ClampedArray |
  // Uint16Array). All three index numerically — we just need to handle
  // depth 8 vs 16 since 1/2/4-bit PNGs come back already expanded to 8.
  data: ArrayLike<number>;
  /** For indexed (palette) PNGs: array of [r,g,b] triples; data values
   *  are 1-byte indices into this array. Absent for non-indexed PNGs. */
  palette?: number[][];
  /** Per-index alpha for tRNS in indexed PNGs (each value 0-255 in the
   *  low byte regardless of bit depth). Indices past this array's
   *  length are fully opaque. */
  transparency?: ArrayLike<number>;
}): Uint8Array | null {
  const { width, height, channels, depth, data, palette, transparency } = img;
  const px = width * height;
  const out = new Uint8Array(px * 4);

  // Indexed (palette) PNG. fast-png reports channels=1 with the palette
  // separate; if we just blitted `data` we'd get black-and-white because
  // palette indices look like dim grayscale values. Apply the palette
  // and per-index alpha here.
  //
  // Alpha source order — fast-png is inconsistent across PNG layouts:
  //   1. palette[idx][3]  — fast-png folds tRNS-derived alpha into the
  //      palette tuples themselves for many indexed-with-transparency
  //      PNGs (its `IndexedColors` type is documented as RGB triples
  //      but the runtime values are RGBA quadruples).
  //   2. transparency[idx] — when fast-png does surface tRNS as its
  //      own field instead of folding into palette entries.
  //   3. 255 fallback — fully opaque.
  if (palette && palette.length > 0) {
    for (let i = 0, o = 0; i < px; i++, o += 4) {
      const idx = data[i]! ?? 0;
      const rgb = palette[idx] ?? palette[0]!;
      out[o] = rgb[0]!;
      out[o + 1] = rgb[1]!;
      out[o + 2] = rgb[2]!;
      out[o + 3] =
        rgb.length >= 4
          ? rgb[3]!
          : transparency && idx < transparency.length
            ? transparency[idx]!
            : 255;
    }
    return out;
  }

  // Bring 16-bit channels down to 8 by dropping the low byte.
  const get = (i: number): number => {
    if (depth === 16) return data[i]! >> 8;
    return data[i]! ?? 0;
  };
  switch (channels) {
    case 4:
      for (let i = 0, o = 0; i < px * 4; i += 4, o += 4) {
        out[o] = get(i);
        out[o + 1] = get(i + 1);
        out[o + 2] = get(i + 2);
        out[o + 3] = get(i + 3);
      }
      return out;
    case 3:
      for (let i = 0, o = 0; i < px * 3; i += 3, o += 4) {
        out[o] = get(i);
        out[o + 1] = get(i + 1);
        out[o + 2] = get(i + 2);
        out[o + 3] = 255;
      }
      return out;
    case 2:
      for (let i = 0, o = 0; i < px * 2; i += 2, o += 4) {
        const v = get(i);
        out[o] = v;
        out[o + 1] = v;
        out[o + 2] = v;
        out[o + 3] = get(i + 1);
      }
      return out;
    case 1:
      for (let i = 0, o = 0; i < px; i++, o += 4) {
        const v = get(i);
        out[o] = v;
        out[o + 1] = v;
        out[o + 2] = v;
        out[o + 3] = 255;
      }
      return out;
    default:
      return null;
  }
}
