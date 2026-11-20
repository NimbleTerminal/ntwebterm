/** Transport-independent automation. Load with terminal.loadAddon(). */
export declare class AutomationAddon implements ITerminalAddon {
    private terminal?;
    private pending;
    private traces;
    activate(terminal: Terminal): void;
    private getTerminal;
    snapshot(): TerminalSnapshot;
    /** Encode each physical key using the terminal's current protocol modes. */
    sendKeys(events: readonly KeyEvent[]): void;
    /** Send literal input bytes represented as a string to the host's onData sink. */
    input(data: string): void;
    paste(text: string): void;
    /** Matches current active-screen text immediately, then after each parsed write. */
    waitForText(text: string, options?: AutomationWaitOptions): Promise<TerminalSnapshot>;
    /** Wait for the next primary OSC 133 input-start (prompt ready for input).
     * Subscribe before sending a command. Requires shell integration.
     */
    waitForPrompt(options?: AutomationWaitOptions): Promise<SemanticPromptEvent>;
    private wait;
    /** Opt-in streaming trace; nothing is retained by the addon.
     * Input includes terminal replies as well as user/programmatic input.
     */
    trace(listener: (event: TerminalTraceEvent) => void): IDisposable;
    dispose(): void;
}

export declare interface AutomationWaitOptions {
    /** Finite timeout in milliseconds. Default: 5000. */
    timeoutMs?: number;
    signal?: AbortSignal;
}

/**
 * Top-level buffer API namespace
 * Provides access to active, normal, and alternate screen buffers
 */
declare class BufferNamespace implements IBufferNamespace {
    private terminal;
    private bufferChangeEmitter;
    private _normalBuffer?;
    private _alternateBuffer?;
    constructor(terminal: Terminal);
    get active(): IBuffer;
    get normal(): IBuffer;
    get alternate(): IBuffer;
    get onBufferChange(): IEvent<IBuffer>;
    /**
     * Internal: Fire buffer change event when screen switches
     * Should be called by Terminal when detecting screen change
     */
    _fireBufferChange(buffer: IBuffer): void;
}

export declare class CanvasRenderer implements Renderer {
    readonly backend: "canvas2d";
    private imageFrame?;
    private previousImageFrame?;
    private canvasEl;
    private ctx;
    private fontSize;
    private fontFamily;
    private cursorStyle;
    private cursorBlink;
    private theme;
    private devicePixelRatio;
    private metrics;
    private palette;
    private cursorBlink_;
    private lastCursorPosition;
    private onRequestRender;
    private lastViewportY;
    private currentBuffer;
    /**
     * Decoded kitty graphics images, keyed by image id. Each entry caches
     * a canvas painted from the WASM-side RGBA bytes so per-frame compositing
     * is just a drawImage call.
     *
     * Staleness key combines revision/width/height/format/dataPtr/dataLen — the
     * kitty protocol allows reusing an id with new bytes, and dataLen alone
     * is too weak (transposed dims or format change can keep byte count
     * identical). dataPtr is the WASM byteOffset; revision catches retransmits that
     * reuse that address.
     */
    private kittyImageCache;
    /**
     * Per-frame index of virtual placements keyed by image id. Populated
     * once at the start of each render() pass (cheap — typically zero or
     * a handful of entries). Looked up by U+10EEEE placeholder cells in
     * renderPlaceholderCell to find the placement's grid dimensions.
     */
    private frameKittyPixels;
    private kittyVirtualPlacements;
    /**
     * Direct (non-virtual) placements that need compositing this frame.
     * Built once per render() in precomputeKittyState so renderKittyImages
     * doesn't re-walk the iterator. Empty when no kitty graphics are active.
     */
    private currentDirectPlacements;
    /**
     * Last frame's direct-placement signatures, keyed by image id. Used to
     * detect placement add/remove/move/redecode so we can mark the affected
     * rows for repaint (clearing stale image pixels) and skip the composite
     * pass entirely when nothing has changed. dataLen is the same staleness
     * discriminator used by kittyImageCache.
     */
    private lastKittyDirectSigs;
    /**
     * Last frame's virtual-placement image-byte signatures, keyed by image
     * id. Virtual placements aren't composited by renderKittyImages — they
     * paint via per-cell renderPlaceholderCell substitution — so cells only
     * repaint when the row is otherwise dirty (cursor, selection, text
     * change). When the application transmits new bytes for the same
     * image_id, the placeholder cells themselves stay clean and Canvas2D
     * would skip them. Tracking these signatures lets us flag the whole
     * viewport as damaged on bytes-change so the per-cell substitution
     * runs and picks up the new (already re-decoded by getOrDecodeKittyImage)
     * bitmap. WebGPU/WebGL don't need this because they re-encode the cell
     * grid and re-sample the kitty atlas every frame.
     */
    private lastKittyVirtualSigs;
    /**
     * Rows whose image footprint changed since last frame (placement added,
     * removed, moved, resized, or re-decoded under the same id). Added to
     * rowsToRender so the underlying text repaints — which clears stale
     * image pixels — before we composite the current placements on top.
     */
    private kittyDamagedRows;
    /**
     * Cached IRenderable on the current render() call so renderCellText
     * can call into it (e.g. getGrapheme) without us threading the buffer
     * through every helper. Set at the top of render(), cleared at the end.
     */
    private currentRenderBuffer;
    private shapedRunCache;
    /* Excluded from this release type: _testGetKittyDamagedRows */
    /* Excluded from this release type: _testPrecomputeKittyState */
    private lastCursorVisible;
    private lastCursorBlinkVisible;
    private lastSelectionSig;
    private lastKittyPlacementSig;
    private currentKittyGraphics;
    private selectionManager?;
    private bidiMapper;
    private currentSelectionCoords;
    private currentSelectionColumnSpace;
    private hoveredHyperlinkId;
    private previousHoveredHyperlinkId;
    private hoveredLinkRange;
    private previousHoveredLinkRange;
    constructor(canvas: HTMLCanvasElement, options?: RendererOptions);
    private measureFont;
    /**
     * Remeasure font metrics (call after font loads or changes)
     */
    remeasureFont(): void;
    private getShapedRunCanvas;
    private rgbToCSS;
    /**
     * Resize canvas to fit terminal dimensions
     */
    resize(cols: number, rows: number): void;
    private invalidateNext;
    invalidate(): void;
    /**
     * Render the terminal buffer to canvas
     */
    /** See WebGPURenderer.bufferAnyDirty. */
    private bufferAnyDirty;
    /** See WebGPURenderer.computeSelectionSig. */
    private computeSelectionSig;
    /** See WebGPURenderer.computeKittyPlacementSig. */
    private computeKittyPlacementSig;
    render(buffer: IRenderable, viewportY?: number, scrollbackProvider?: IScrollbackProvider): void;
    /**
     * Render a single line using two-pass approach:
     * 1. First pass: Draw all cell backgrounds
     * 2. Second pass: Draw all cell text and decorations
     *
     * This two-pass approach is necessary for proper rendering of complex scripts
     * like Devanagari where diacritics (like vowel sign ि) can extend LEFT of the
     * base character into the previous cell's visual area. If we draw backgrounds
     * and text in a single pass (cell by cell), the background of cell N would
     * cover any left-extending portions of graphemes from cell N-1.
     */
    private renderLine;
    /**
     * Render a cell's background only (Pass 1 of two-pass rendering)
     * Selection highlighting is integrated here to avoid z-order issues with
     * complex glyphs (like Devanagari) that extend outside their cell bounds.
     */
    private renderCellBackground;
    /**
     * Render a cell's text and decorations (Pass 2 of two-pass rendering)
     * Selection foreground color is applied here to match the selection background.
     */
    private renderCellText;
    /**
     * Composite all visible kitty graphics placements onto the canvas.
     * Cheap when no graphics are active (one method check, one terminal_get).
     * Decode work is amortized across frames via kittyImageCache.
     */
    /**
     * Walk the placement iterator once at frame start, partitioning the
     * results: virtual placements go into kittyVirtualPlacements (keyed
     * by image id) for placeholder-cell lookup; direct visible placements
     * stay implicit and get re-iterated by renderKittyImages later.
     *
     * Also caches the storage handle for renderPlaceholderCell so the
     * per-cell hot path doesn't have to re-resolve it.
     */
    private precomputeKittyState;
    /**
     * Get (or decode + cache) the canvas-ready bitmap for a kitty image.
     * Returns null if the image isn't stored or decode fails. Shared by
     * renderKittyImages (direct placements) and renderPlaceholderCell
     * (unicode-placeholder cells).
     */
    private getFrameKittyPixels;
    private getOrDecodeKittyImage;
    /**
     * Render a Block Elements codepoint (U+2580..U+259F) as fillRect(s) in
     * the current fillStyle. Returns true if the codepoint is a handled
     * block element; false to fall through to fillText.
     *
     * Drawing block elements through the font produces ~1-device-px gaps
     * at cell edges at integer dpr because the rasterized glyph doesn't
     * exactly fill the cell box. In half-block image renderings (ansimage,
     * pixterm) those gaps line up into a visible cell grid. Native
     * terminals draw block elements programmatically for the same reason.
     *
     * The eighths blocks (U+2581..U+2587 lower; U+2589..U+258F left) and
     * full block (U+2588) are stripes of n/8 of the cell. Shading blocks
     * (U+2591..U+2593) modulate globalAlpha for 25/50/75% fill. Quadrant
     * blocks (U+2596..U+259F) split the cell into a 2x2 grid and fill
     * some subset.
     */
    private renderBlockElement;
    /**
     * Substitute a cell's text rendering with a slice of a kitty graphics
     * image. Called from renderCellText when the cell's codepoint is
     * U+10EEEE.
     *
     * Decodes the image_id from cell.fg_*  (low 24 bits; high byte from
     * an optional third combining diacritic) and the row/col-of-image
     * from the first two combining diacritics on the cell. Looks up the
     * virtual placement (from precomputeKittyState) for grid dims, then
     * draws the matching slice scaled to one terminal cell.
     *
     * Returns true if the cell was handled as a placeholder; false to
     * fall through to normal text rendering for malformed diacritics.
     * A valid placeholder without its image/placement paints background only.
     */
    private renderPlaceholderCell;
    private renderImageLayer;
    private renderKittyImages;
    /**
     * Decode a kitty graphics image into a canvas suitable for drawImage.
     * Expands non-RGBA formats into RGBA via putImageData; PNG payloads
     * (which require a JS-side decoder set up via ghostty_sys_set) are
     * not supported in this MVP and return null.
     */
    private decodeKittyImageToCanvas;
    /**
     * Render cursor
     */
    private renderCursor;
    /**
     * Set a callback the renderer invokes when its internal state changes
     * outside the normal render-driven path (today: cursor-blink toggles).
     * Lets an event-driven Terminal wake its render scheduler instead of
     * polling every frame to catch the blink flip.
     */
    setOnRequestRender(fn: (() => void) | null): void;
    /**
     * Update theme colors
     */
    setTheme(theme: ITheme): void;
    /**
     * Update font size
     */
    setFontSize(size: number): void;
    /**
     * Update font family
     */
    setFontFamily(family: string): void;
    /**
     * Update cursor style
     */
    setCursorStyle(style: 'block' | 'underline' | 'bar'): void;
    /**
     * Enable/disable cursor blinking
     */
    setCursorBlink(enabled: boolean): void;
    /**
     * Get current font metrics
     */
    getMetrics(): FontMetrics;
    get canvas(): HTMLCanvasElement;
    /**
     * Set selection manager (for rendering selection)
     */
    setSelectionManager(manager: SelectionManager): void;
    setBidiMapper(mapper: RowBidiMapper): void;
    /**
     * Check if a cell at (x, y) is within the current selection.
     * Uses cached selection coordinates for performance.
     */
    private isInSelection;
    /**
     * Set the currently hovered hyperlink ID for rendering underlines
     */
    setHoveredHyperlinkId(hyperlinkId: number): void;
    /**
     * Set the currently hovered link range for rendering underlines (for regex-detected URLs)
     * Pass null to clear the hover state
     */
    setHoveredLinkRange(range: {
        startX: number;
        startY: number;
        endX: number;
        endY: number;
    } | null): void;
    /**
     * Get character cell width (for coordinate conversion)
     */
    get charWidth(): number;
    /**
     * Get character cell height (for coordinate conversion)
     */
    get charHeight(): number;
    /**
     * Clear entire canvas
     */
    clear(): void;
    /**
     * Cleanup resources
     */
    destroy(): void;
    /** @deprecated Use destroy() */
    dispose(): void;
}

/**
 * Cell style flags (bitfield)
 */
export declare enum CellFlags {
    BOLD = 1,
    ITALIC = 2,
    UNDERLINE = 4,
    STRIKETHROUGH = 8,
    INVERSE = 16,
    INVISIBLE = 32,
    BLINK = 64,
    FAINT = 128
}

/** One MIME representation of a clipboard value. `data` is a copy. */
export declare interface ClipboardContent {
    mime: string;
    data: Uint8Array;
}

/** OSC 7501 report. Each report replaces the record for its id.
 * `clear` removes that id and descendants; an empty id clears all records.
 * Embedders own record lifetimes, including cleanup when the process exits.
 */
/** Clipboard a program addressed. Mirrors GhosttyClipboardLocation. */
export declare type ClipboardLocation = 'standard' | 'selection' | 'primary';

/**
 * Answers a clipboard read synchronously. Return the text to hand to the
 * program, or null to deny. The VT stream is paused until this returns.
 */
export declare type ClipboardReadHandler = (request: ClipboardReadRequest) => string | null;

/** An OSC 52 "?" / OSC 5522 clipboard read a program requested. */
export declare interface ClipboardReadRequest {
    location: ClipboardLocation;
    /** MIME types wanted, in preference order. OSC 52 asks for "text/plain". */
    mimes: string[];
    /** True if the program also wants the list of available MIME types. */
    list: boolean;
    program: string;
    granted: boolean;
}

/** An OSC 52 / OSC 5522 clipboard write a program requested. */
export declare interface ClipboardWriteEvent {
    location: ClipboardLocation;
    /** The first text/* representation decoded as UTF-8, or null if there is none. */
    text: string | null;
    /** Every representation the program supplied; empty means "clear the clipboard". */
    contents: ClipboardContent[];
    /** Name of the writing program when the protocol carries one. */
    program: string;
    /** True when the terminal already holds a session grant for this program. */
    granted: boolean;
}

/** Outcome reported back to the program for a clipboard write. Mirrors GhosttyClipboardWriteResult. */
declare type ClipboardWriteResult = 'success' | 'denied' | 'unsupported';

/** Answer to a CSI ? 996 n color scheme query. Mirrors GhosttyColorScheme. */
export declare type ColorScheme = 'light' | 'dark';

/**
 * Cursor position and visibility
 */
export declare interface Cursor {
    x: number;
    y: number;
    visible: boolean;
}

/**
 * Cursor blink timer.
 *
 * Owns the periodic "blink toggle" that flips cursor visibility on and off.
 * The renderer queries isVisible() at draw time; the timer wakes the
 * scheduler via onRequestRender so an event-driven Terminal still repaints
 * when blink fires.
 *
 * Carved out of CanvasRenderer in commit history — keeps both Canvas2D and
 * WebGPU backends from re-implementing the same setInterval dance.
 */
export declare class CursorBlink {
    private enabled;
    private visible;
    private intervalId?;
    private onRequestRender;
    setEnabled(enabled: boolean): void;
    isVisible(): boolean;
    setOnRequestRender(fn: (() => void) | null): void;
    destroy(): void;
}

/** OSC 9 / OSC 777 desktop notification. OSC 9 has no title. */
export declare interface DesktopNotification {
    title: string;
    body: string;
}

/** Mirrors the C enum GhosttyRenderStateDirty (GHOSTTY_RENDER_STATE_DIRTY_*), i32. */
export declare enum DirtyState {
    /** @deprecated ntwebterm alias for {@link GhosttyRenderStateDirty.FALSE}. */
    NONE = 0,
    FALSE = 0,
    PARTIAL = 1,
    FULL = 2
}

export declare class EventEmitter<T> {
    private listeners;
    /** Whether anyone is subscribed; lets callers skip preparing an argument nobody reads. */
    get hasListeners(): boolean;
    fire(arg: T): void;
    event: IEvent<T>;
    dispose(): void;
}

export declare class FitAddon implements ITerminalAddon {
    private _terminal?;
    private _resizeObserver?;
    private _resizeDebounceTimer?;
    private _lastCols?;
    private _lastRows?;
    private _isResizing;
    /**
     * Activate the addon (called by Terminal.loadAddon)
     */
    activate(terminal: ITerminalCore): void;
    /**
     * Dispose the addon and clean up resources
     */
    dispose(): void;
    /**
     * Fit the terminal to its container
     *
     * Calculates optimal dimensions and resizes the terminal.
     * Does nothing if dimensions cannot be calculated or haven't changed.
     */
    fit(): void;
    /**
     * Propose dimensions to fit the terminal to its container
     *
     * Calculates cols and rows based on:
     * - Terminal container element dimensions (clientWidth/Height)
     * - Terminal element padding
     * - Font metrics (character cell size)
     * - Scrollbar width reservation
     *
     * @returns Proposed dimensions or undefined if cannot calculate
     */
    proposeDimensions(): ITerminalDimensions | undefined;
    /**
     * Observe the terminal's container for resize events
     *
     * Sets up a ResizeObserver to automatically call fit() when the
     * container size changes. Resize events are debounced to avoid
     * excessive calls during window drag operations.
     *
     * Call dispose() to stop observing.
     */
    observeResize(): void;
}

export declare interface FontMetrics {
    advanceWidth?: number;
    ascent?: number;
    descent?: number;
    width: number;
    height: number;
    baseline: number;
}

/** Options for GhosttyTerminal.formatSelection(). */
export declare interface FormatOptions {
    /** 'plain' text (default), 'vt' escape sequences, or 'html'. */
    emit?: 'plain' | 'vt' | 'html';
    /** Join soft-wrapped rows the way the program wrote them. Default true. */
    unwrap?: boolean;
    /** Remove trailing spaces from each line. Default true. */
    trim?: boolean;
}

export declare interface ForwardNotificationsOptions {
    /**
     * Ask for permission on the first notification while it is still
     * 'default'. That notification is dropped; later ones show once granted.
     * Default: false, so the page never prompts on its own.
     */
    requestPermission?: boolean;
    /** Title used when the program sent none (OSC 9). Default: document.title. */
    defaultTitle?: string;
}

export declare function forwardNotificationsToBrowser(term: Terminal, options?: ForwardNotificationsOptions): IDisposable;

/* Excluded from this release type: getGhostty */

export declare class Ghostty {
    private exports;
    private memory;
    private cachedBuildInfo?;
    constructor(wasmInstance: WebAssembly.Instance);
    /**
     * Encode a focus report (CSI I when gained, CSI O when lost) for mode 1004.
     * Needs no terminal; GhosttyTerminal.encodeFocus() adds the mode check.
     */
    encodeFocus(gained: boolean): Uint8Array;
    /** Version of the loaded libghostty-vt (`ghostty_version()`), e.g. "1.0.0". */
    get version(): string;
    /** Compile-time configuration of the loaded library (`ghostty_build_info()`). */
    get buildInfo(): LibghosttyBuildInfo;
    private readBuildInfo;
    createKeyEncoder(): KeyEncoder;
    createTerminal(cols?: number, rows?: number, config?: GhosttyTerminalConfig): GhosttyTerminal;
    static load(wasmPath?: string): Promise<Ghostty>;
    private static loadFromPath;
}

/**
 * Cell structure matching ghostty_cell_t in C (16 bytes)
 */
export declare interface GhosttyCell {
    codepoint: number;
    fg_r: number;
    fg_g: number;
    fg_b: number;
    bg_r: number;
    bg_g: number;
    bg_b: number;
    fgIsDefault: boolean;
    bgIsDefault: boolean;
    flags: number;
    width: number;
    hyperlink_id: number;
    grapheme_len: number;
    /**
     * Combining codepoints beyond the first (length === grapheme_len). Null
     * when grapheme_len is 0. Populated by GhosttyTerminal.getViewport during
     * the existing cell walk so renderers don't need to call getGrapheme(y, x)
     * — that path re-walks the row iterator from row 0 and is O(row) per call,
     * which dominated the per-frame budget for kitty unicode placeholders.
     *
     * Holds extras only (matching grapheme_len semantics): for a kitty
     * placeholder the array is [rowDiacritic, colDiacritic, imgIdMsbDiacritic?].
     */
    grapheme: number[] | null;
}

/** Mirrors the C enum GhosttyKittyImageFormat (GHOSTTY_KITTY_IMAGE_FORMAT_*), i32. */
declare enum GhosttyKittyImageFormat {
    RGB = 0,
    RGBA = 1,
    PNG = 2,
    GRAY_ALPHA = 3,
    GRAY = 4
}

export declare class GhosttyTerminal {
    private imageRevisions;
    private imageEpoch;
    private renderImages?;
    private lastImageFrameRevision;
    private images;
    getImageFrame(viewportY?: number): ImageFrame;
    tickImageAnimations(now: number): number | null;
    private exports;
    private memory;
    private handle;
    private renderHandle;
    private rowIter;
    private rowCells;
    private _cols;
    private _rows;
    /** Cell pool for zero-allocation rendering */
    private cellPool;
    /**
     * Cell pixel dimensions last pushed to the WASM terminal via
     * ghostty_terminal_resize. Zero means "unknown / disabled" — kitty
     * graphics image sizing and CSI 14/16/18 t in-band size reports will
     * return zero/no-op until setCellPixelSize() is called with real values.
     */
    private cellWidthPx;
    private cellHeightPx;
    /**
     * Per-row dirty state for the current render-state snapshot. Cleared on
     * update() and populated lazily by isRowDirty() (or as a side effect of
     * getViewport, which iterates rows anyway).
     */
    private rowDirtyCache;
    /**
     * Per-row soft-wrap state for the current render-state snapshot. Same
     * lifecycle as rowDirtyCache; the two caches are filled in lockstep.
     */
    private rowWrapCache;
    /** Per-row selected range from the render state; same lifecycle as rowDirtyCache. */
    private rowSelectionCache;
    /** Lazily created GhosttyFormatter for formatSelection(). */
    private formatter;
    /** Lazily created GhosttySelectionGesture and one reusable event per type. */
    private gesture;
    private gestureEvents;
    /**
     * Bytes the terminal would have written back to a real PTY in response
     * to query sequences (DSR, XTVERSION, in-band size reports, ...).
     * Captured by the WRITE_PTY callback installed in the constructor and
     * drained by readResponse(). Each slot is one callback invocation, so
     * a single response sequence may span multiple slots.
     */
    private pendingResponses;
    private pendingProgramStatus;
    private programStatusHandler?;
    private pendingBells;
    private pendingTitleChanges;
    private bellHandler?;
    private titleChangeHandler?;
    private renderHoldHandler?;
    /** Decides a clipboard write synchronously, inside the WASM callback. */
    private clipboardWritePolicy?;
    private clipboardWriteHandler?;
    private pendingClipboardWrites;
    /** Answers clipboard reads synchronously, inside the WASM callback. */
    private clipboardReadHandler?;
    /** Text handed to the GhosttyMimeReader during paste(); null otherwise. */
    private pendingPasteBytes;
    private mouseEncoder?;
    private mouseModeSignature;
    private mouseSizeKey;
    private mouseAnyButtonPressed;
    private pwdChangeHandler?;
    private pendingPwdChanges;
    private notificationHandler?;
    private pendingNotifications;
    private progressHandler?;
    private pendingProgress;
    private semanticPromptHandler?;
    private pendingSemanticPrompts;
    private resizeRequestHandler?;
    private pendingResizeRequests;
    /** Answers CSI ? 996 n synchronously; undefined ignores the query. */
    private colorSchemeProvider?;
    private renderHeld;
    private hasCapturedHoldFrame;
    private hyperlinkIdsByUri;
    /**
     * True while ghostty_terminal_vt_write() is on the stack. The terminal is
     * not reentrant, and a few application callbacks (clipboard policy and
     * read, color scheme, render hold) have to answer synchronously from
     * inside it. Mutating calls made meanwhile wait in deferredOps.
     */
    private imageStorageLimit;
    private inVtWrite;
    private deferredOps;
    private freed;
    private nextHyperlinkId;
    /** Return the raw WASM terminal handle. */
    getHandle(): TerminalHandle;
    /** Enable OSC 7501 reports and capability replies only while a consumer is installed. */
    setProgramStatusHandler(handler?: (report: ProgramStatusReport) => void): void;
    setBellHandler(handler?: () => void): void;
    setTitleChangeHandler(handler?: (title: string) => void): void;
    setRenderHoldHandler(handler?: (held: boolean) => void): void;
    /**
     * Decide OSC 52 / OSC 5522 clipboard writes. Runs inside the WASM callback,
     * so it must not write to or dispose the terminal. Without a policy every
     * write is denied. Events for accepted writes are delivered to the handler
     * set with setClipboardWriteHandler() after the current write() returns.
     */
    setClipboardWritePolicy(policy?: (event: ClipboardWriteEvent) => ClipboardWriteResult): void;
    setClipboardWriteHandler(handler?: (event: ClipboardWriteEvent) => void): void;
    /**
     * Answer OSC 52 "?" / OSC 5522 clipboard reads. The callback is only
     * installed while a handler is set; without one upstream answers reads
     * with an empty clipboard. Installing it also enables Kitty paste events
     * (mode 5522) for programs that opt in.
     */
    setClipboardReadHandler(handler?: ClipboardReadHandler): void;
    setPwdChangeHandler(handler?: (pwd: string) => void): void;
    setNotificationHandler(handler?: (notification: DesktopNotification) => void): void;
    setProgressHandler(handler?: (report: ProgressReport) => void): void;
    setSemanticPromptHandler(handler?: (event: SemanticPromptEvent) => void): void;
    setResizeRequestHandler(handler?: (request: ResizeRequest) => void): void;
    /** Answer CSI ? 996 n color scheme queries. Runs inside the WASM callback. */
    setColorSchemeProvider(provider?: () => ColorScheme): void;
    isRenderHeld(): boolean;
    hasPendingHoldSnapshot(): boolean;
    releaseRenderHold(): void;
    getTitle(): string;
    /**
     * The working directory the shell last reported (OSC 7, OSC 9;9 or
     * OSC 1337 CurrentDir), as raw bytes: a file:// URI for OSC 7, usually a
     * bare path otherwise. Empty when none was reported or it was cleared.
     */
    getPwd(): string;
    /** Read a GhosttyString-valued terminal_get key, copying it out of WASM memory. */
    private getStringData;
    private handleRenderHold;
    private internHyperlinkUri;
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
    private static callbackRegistries;
    /**
     * Cached pointer to this terminal's registry. We only need it to
     * deregister cleanly in free() / cleanupOnConstructorFailure().
     */
    private callbackRegistry?;
    constructor(exports: GhosttyWasmExports, memory: WebAssembly.Memory, cols?: number, rows?: number, config?: GhosttyTerminalConfig);
    /**
     * Allocate an opaque handle through one of the new(allocator, *outHandle)
     * factory functions. Wraps the boilerplate of: alloc out-pointer, call
     * factory, check Result, read the handle, free out-pointer.
     *
     * If the factory call fails, frees any already-acquired terminal/render
     * resources so the caller-throwing flow doesn't leak across the partially
     * constructed object.
     */
    private allocOpaqueOrFail;
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
    private applyConfig;
    private setColorOption;
    /**
     * Release any resources that have been allocated by the constructor up to
     * this point. Called when a subsequent step fails so we don't leak handles
     * before the throw propagates.
     */
    private cleanupOnConstructorFailure;
    private rsGetU8;
    private rsGetU16;
    private rsGetU32;
    private rsGetRgb;
    private tGetU8;
    private tGetU32;
    get cols(): number;
    get rows(): number;
    /**
     * Queue a mutating call made from inside a terminal callback. Returns true
     * when it was queued; it then runs as soon as the current write returns.
     */
    deferWhileWriting(op: () => void): boolean;
    private runDeferredOps;
    /**
     * Run application code that has to answer from inside a terminal callback.
     * An exception must not unwind through the WASM frames below us (that
     * skips libghostty-vt's cleanup and leaves the parser mid-sequence), so it
     * is reported and the callback answers as if no handler were installed.
     */
    private callFromWasm;
    /**
     * Feed VT data to the terminal.
     *
     * Called from inside a terminal callback (a clipboard policy or read
     * handler, the color scheme provider, the render hold handler), the data
     * is queued and written when the current write returns; reset(), resize()
     * and free() are queued the same way.
     */
    write(data: string | Uint8Array, onParsed?: () => void): void;
    /** Drop every deferred effect event (reset, free). */
    private clearPendingEffects;
    /**
     * Reset terminal state in-place without changing the underlying WASM handle.
     */
    reset(): void;
    resize(cols: number, rows: number): void;
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
    setKittyImageStorageLimit(bytes: number): void;
    /**
     * Get the kitty graphics storage handle for the active screen, or null
     * if storage is disabled or no images are stored. Cheap to call; returns
     * a borrowed pointer.
     */
    getKittyGraphics(): number | null;
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
    iterPlacements(graphics: number, onlyVisible?: boolean): Generator<KittyPlacementInfo>;
    /**
     * Get the pixel data + metadata for an image by id. Returns null if the
     * image isn't stored or isn't in a format we can hand the renderer
     * directly (RGB / RGBA / GRAY / GRAY_ALPHA).
     *
     * The returned `data` is a borrowed view into WASM memory — copy before
     * the next vt_write if you need to retain. Most callers will turn this
     * into an ImageData / canvas immediately and discard the view.
     */
    getKittyImagePixels(graphics: number, imageId: number): KittyImagePixels | null;
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
    setCellPixelSize(cellWidthPx: number, cellHeightPx: number): void;
    free(): void;
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
    update(): DirtyState;
    /**
     * Get cursor state from render state.
     * Calls update() first; safe to call repeatedly within a frame.
     */
    getCursor(): RenderStateCursor;
    /**
     * Get the active screen's logical cursor position directly from the terminal
     * (independent of whether the viewport is scrolled).
     */
    getLogicalCursor(): {
        x: number;
        y: number;
    };
    private rGetCursorU16;
    /**
     * Get default fg/bg/cursor colors from render state.
     */
    getColors(): RenderStateColors;
    /**
     * Check if a specific row is dirty.
     *
     * Backed by a per-row cache populated lazily — first call after update()
     * walks the iterator once and reads the dirty flag for each row, then
     * subsequent calls are O(1). getViewport() also populates the cache as a
     * side effect so a typical "update → for-each-row isRowDirty → getViewport"
     * render loop only iterates rows once.
     */
    isRowDirty(y: number): boolean;
    /**
     * Check if a row is soft-wrapped (continues onto the next row).
     *
     * Same cache discipline as isRowDirty: lazy-populated on first call after
     * update(), or as a side effect of getViewport.
     */
    isRowWrapped(y: number): boolean;
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
    private refreshRowMetaCache;
    /** Read GHOSTTY_RENDER_STATE_ROW_DATA_SELECTION for the iterator's current row. */
    private readRowSelection;
    /**
     * The selected column range of a viewport row from the render state, or
     * null when the row does not intersect the terminal's selection.
     */
    getRowSelection(y: number): RowSelection | null;
    /**
     * Mark render state as clean — clears both global and per-row dirty.
     *
     * Per the upstream contract, "setting one dirty state doesn't unset the
     * other." Global dirty is cleared via _set(OPTION_DIRTY, FALSE); per-row
     * dirty is cleared by walking the row iterator and calling _row_set on
     * each. Without the per-row pass, the next update() would still report
     * the old per-row flags as dirty even though the terminal hasn't changed.
     */
    markClean(): void;
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
    getViewport(): GhosttyCell[];
    /**
     * Helper for the in/out pointer pattern used by ROW_ITERATOR / ROW_DATA_CELLS:
     * write a handle into a 4-byte slot, hand the slot to a populator, then
     * free the slot. The handle value itself is unchanged; the populator uses
     * it to find and rebind the iterator's internal data.
     */
    private populateHandle;
    /**
     * Reset every cell in the pool to "empty" so cells we don't visit during
     * iteration (e.g. iterator stopped early, or grid resized down) don't
     * carry stale values from a previous frame.
     */
    private zeroCellPool;
    /**
     * Get line - for compatibility, extracts from viewport.
     * Ensures render state is fresh by calling update().
     * Returns a COPY of the cells to avoid pool reference issues.
     */
    getLine(y: number): GhosttyCell[] | null;
    /** For compatibility with old API */
    isDirty(): boolean;
    /**
     * Check if a full redraw is needed (screen change, resize, etc.)
     * Note: This calls update() to ensure fresh state. Safe to call multiple times.
     */
    needsFullRedraw(): boolean;
    /** Mark render state as clean after rendering */
    clearDirty(): void;
    isAlternateScreen(): boolean;
    hasBracketedPaste(): boolean;
    /**
     * Paste text the way libghostty-vt would for a real PTY: a Kitty paste
     * event when mode 5522 is on and a clipboard read handler is installed,
     * otherwise the text framed per mode 2004 with unsafe control bytes
     * replaced by spaces and, unbracketed, newlines turned into carriage
     * returns. The output lands in the WRITE_PTY queue; drain it with
     * readResponse().
     *
     * Text that could inject commands (a line terminator outside bracketed
     * paste, or the bracketed paste end marker) is 'rejected' unless
     * `allowUnsafe` is set. Nothing is written on rejection.
     */
    paste(text: string, options?: PasteOptions): PasteResult;
    /**
     * Encode a mouse report the way the program asked for it. libghostty-vt
     * reads the tracking mode (X10, normal, button, any) and format (X10,
     * UTF-8, SGR, urxvt, SGR-pixels) from this terminal, drops events the mode
     * does not report, and deduplicates motion within a cell. Returns the bytes
     * to send to the PTY, empty when there is nothing to report.
     *
     * The cell comes from the caller because hit-testing with fractional CSS
     * cell metrics and BiDi column mapping is the renderer's business; the
     * encoder sees a pixel position inside that cell built from the integer
     * cell size it was given.
     */
    encodeMouse(report: MouseReport): Uint8Array;
    hasFocusEvents(): boolean;
    /**
     * Bytes to send when the terminal gained or lost focus: CSI I / CSI O from
     * ghostty_focus_encode() if the program turned on mode 1004, else empty.
     */
    encodeFocus(gained: boolean): Uint8Array;
    hasMouseTracking(): boolean;
    /** Get dimensions - for compatibility */
    getDimensions(): {
        cols: number;
        rows: number;
    };
    /** Get number of scrollback lines (history, not including active screen) */
    getScrollbackLength(): number;
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
    getScrollbackLine(offset: number): GhosttyCell[] | null;
    /**
     * Check whether a scrollback row is a soft-wrap continuation of the
     * preceding row (matching isRowWrapped(y) on the active screen).
     */
    isScrollbackRowWrapped(offset: number): boolean;
    /**
     * Get the hyperlink URI for a cell at the given position in the active
     * viewport. Returns null when no hyperlink is attached.
     */
    getHyperlinkUri(row: number, col: number): string | null;
    /**
     * Get the hyperlink URI for a cell in the scrollback buffer.
     */
    getScrollbackHyperlinkUri(offset: number, col: number): string | null;
    private writeGridRef;
    private readGridRef;
    private writeSelection;
    private readSelection;
    /**
     * Run `fn` with a scratch GhosttySelection output; null on GHOSTTY_NO_VALUE
     * (nothing to select there), a thrown error on any other failure.
     */
    private outSelection;
    /** Run `fn` with `sel` written to scratch memory. */
    private withSelection;
    private withGridRef;
    /**
     * Reference to the cell at (x, y) in the given coordinate space, or null
     * when there is no such cell. The result is a snapshot; see GridRef.
     */
    gridRef(tag: PointTag, x: number, y: number): GridRef | null;
    /**
     * The (x, y) of a grid reference in the given coordinate space, or null
     * when it cannot be expressed there (a history cell in ACTIVE coordinates,
     * a cell scrolled out of the VIEWPORT, ...).
     */
    pointFromGridRef(ref: GridRef, tag: PointTag): {
        x: number;
        y: number;
    } | null;
    /**
     * The active screen's selection as an untracked snapshot, or null. The
     * terminal tracks its own selection across writes, scrolling and resizes.
     */
    getSelection(): TerminalSelection | null;
    /** Install `sel` as the terminal's tracked selection, or clear it with null. */
    setSelection(sel: TerminalSelection | null): void;
    /** The word under `ref` by Ghostty's word boundaries, or null on a blank cell. */
    selectWord(ref: GridRef): TerminalSelection | null;
    /** The nearest word searching from `start` toward `end` (inclusive), or null. */
    selectWordBetween(start: GridRef, end: GridRef): TerminalSelection | null;
    /**
     * The line under `ref` with Ghostty's whitespace trimmed, or null when it is
     * blank. With `semanticPromptBoundary` the line stops at OSC 133 prompt
     * changes, so a prompt line selects the input without the prompt.
     */
    selectLine(ref: GridRef, options?: {
        semanticPromptBoundary?: boolean;
    }): TerminalSelection | null;
    /** All selectable content (scrollback included), or null when there is none. */
    selectAll(): TerminalSelection | null;
    /** The command output around `ref`, from OSC 133 markers, or null. */
    selectOutput(ref: GridRef): TerminalSelection | null;
    /** Which way the ends of `sel` are ordered in the terminal. */
    selectionOrder(sel: TerminalSelection): SelectionOrder;
    /** A copy of `sel` with its ends in the requested order (top-left first by default). */
    selectionOrdered(sel: TerminalSelection, desired?: SelectionOrder): TerminalSelection;
    /** Move the logical end of `sel` as keyboard selection does; returns the adjusted copy. */
    selectionAdjust(sel: TerminalSelection, adjust: SelectionAdjust): TerminalSelection;
    /** Whether the cell at (x, y) in the given coordinate space is inside `sel`. */
    selectionContains(sel: TerminalSelection, tag: PointTag, x: number, y: number): boolean;
    /**
     * The text of `sel` (or of the whole screen when null) through libghostty's
     * formatter. Defaults match what Ghostty copies to the clipboard: plain
     * text, soft-wrapped rows joined, trailing spaces trimmed.
     */
    formatSelection(sel: TerminalSelection | null, options?: FormatOptions): string;
    /**
     * A search over this terminal's scrollback and screens. The search borrows
     * the terminal; free it with TerminalSearch.free() in either order.
     */
    createSearch(): TerminalSearch;
    private gestureHandle;
    private gestureEvent;
    /** Set an event option from scratch memory `write` fills, or clear it with size 0. */
    private gestureSet;
    private gestureSetRef;
    private gestureSetPosition;
    private gestureApply;
    /**
     * Record a left press at `ref` with the pointer at surface pixel (x, y).
     * Presses within `repeatIntervalNs` and `repeatDistance` pixels of the
     * previous one count as double and triple clicks, which select a word and
     * a line; the first click selects nothing and returns null.
     */
    gesturePress(ref: GridRef, options: {
        x: number;
        y: number;
        timeNs?: bigint;
        repeatDistance?: number;
        repeatIntervalNs?: bigint;
        behaviors?: [SelectionGestureBehavior, SelectionGestureBehavior, SelectionGestureBehavior];
    }): TerminalSelection | null;
    /**
     * Continue the active gesture with the pointer over `ref` at surface pixel
     * (x, y). Returns the selection to show, or null when nothing changed yet
     * (no press, or the drag has not crossed the within-cell threshold).
     * Read gestureState().autoscroll afterwards to drive edge scrolling.
     */
    gestureDrag(ref: GridRef, options: {
        x: number;
        y: number;
        geometry: SelectionGestureGeometry;
        rectangle?: boolean;
    }): TerminalSelection | null;
    /** End the active drag; `ref` is the cell under the pointer, or null if there was none. */
    gestureRelease(ref: GridRef | null): void;
    /** Select the word around the active press anchor (force touch, long press). */
    gestureDeepPress(): TerminalSelection | null;
    /** Cancel the click sequence without freeing the gesture. */
    gestureReset(): void;
    /** Click count, drag flag, autoscroll direction and behavior of the gesture. */
    gestureState(): SelectionGestureState;
    /** The cell of the active press, or null when no click sequence is active. */
    gestureAnchor(): GridRef | null;
    private readGridLine;
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
    private styleFlagsToCellFlags;
    private resolveStyleColor;
    private readHyperlinkUri;
    private readHyperlinkUriFromRef;
    private allocPoint;
    private makeEmptyCell;
    /**
     * Whether any terminal response bytes are queued for readResponse().
     *
     * Responses are delivered synchronously during vt_write() by the
     * WRITE_PTY callback (e.g. DSR replies, XTVERSION, in-band size reports).
     * They sit in pendingResponses until drained.
     */
    hasResponse(): boolean;
    /**
     * Drain queued response bytes, decode as UTF-8, return as a single
     * string. Multiple callback invocations are concatenated. Returns null
     * when nothing's pending so the demo's echo loop can short-circuit.
     */
    readResponse(): string | null;
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
    private installCallbacks;
    /**
     * Query arbitrary terminal mode by number.
     * @param mode Mode number (e.g., 25 for cursor visibility, 2004 for bracketed paste)
     * @param isAnsi True for ANSI modes, false for DEC modes (default: false)
     */
    getMode(mode: number, isAnsi?: boolean): boolean;
    /**
     * Query the active Kitty keyboard protocol flags bitmask (u8).
     */
    getKittyKeyboardFlags(): number;
    private initCellPool;
    /**
     * Get all codepoints for a grapheme cluster at the given position.
     * For most cells this returns a single codepoint, but for complex scripts
     * (Hindi, emoji with ZWJ, etc.) it returns multiple codepoints.
     * @returns Array of codepoints, or null on error
     */
    getGrapheme(row: number, col: number): number[] | null;
    /**
     * Get a string representation of the grapheme at the given position.
     * This properly handles complex scripts like Hindi, emoji with ZWJ, etc.
     */
    getGraphemeString(row: number, col: number): string;
    /**
     * Get all codepoints for a grapheme cluster in the scrollback buffer.
     * @param offset Scrollback line offset (0 = oldest)
     * @param col Column index
     * @returns Array of codepoints, or null on error
     */
    getScrollbackGrapheme(offset: number, col: number): number[] | null;
    /**
     * Get a string representation of a grapheme in the scrollback buffer.
     */
    getScrollbackGraphemeString(offset: number, col: number): string;
}

/**
 * Terminal configuration applied by the TypeScript bridge
 * All color values use 0xRRGGBB format. A value of 0 means "use default".
 */
declare interface GhosttyTerminalConfig {
    scrollbackLimit?: number;
    fgColor?: number;
    bgColor?: number;
    cursorColor?: number;
    palette?: (number | undefined)[];
}

/**
 * Interface for libghostty-vt WASM exports
 */
declare interface GhosttyWasmExports extends WebAssembly.Exports {
    memory: WebAssembly.Memory;
    ghostty_version(): number;
    ghostty_build_info(data: number, out: number): number;
    ghostty_mouse_encoder_new(allocator: number, encoderPtrPtr: number): number;
    ghostty_mouse_encoder_free(encoder: number): void;
    ghostty_mouse_encoder_set(encoder: number, option: number, valuePtr: number): number;
    ghostty_mouse_encoder_set_from_terminal(encoder: number, terminal: TerminalHandle): number;
    ghostty_mouse_encoder_reset(encoder: number): number;
    ghostty_mouse_encoder_encode(encoder: number, eventPtr: number, bufPtr: number, bufLen: number, writtenPtr: number): number;
    ghostty_mouse_event_new(allocator: number, eventPtrPtr: number): number;
    ghostty_mouse_event_free(event: number): void;
    ghostty_mouse_event_set_action(event: number, action: number): number;
    ghostty_mouse_event_set_button(event: number, button: number): number;
    ghostty_mouse_event_clear_button(event: number): number;
    ghostty_mouse_event_set_mods(event: number, mods: number): number;
    /** `position` is a GhosttyMousePosition passed by value: wasm32 passes a pointer to { x: f32, y: f32 }. */
    ghostty_mouse_event_set_position(event: number, positionPtr: number): number;
    ghostty_terminal_point_from_grid_ref(terminal: TerminalHandle, refPtr: number, tag: number, outCoordinatePtr: number): number;
    ghostty_terminal_select_word(terminal: TerminalHandle, optionsPtr: number, outSelPtr: number): number;
    ghostty_terminal_select_word_between(terminal: TerminalHandle, optionsPtr: number, outSelPtr: number): number;
    ghostty_terminal_select_line(terminal: TerminalHandle, optionsPtr: number, outSelPtr: number): number;
    ghostty_terminal_select_all(terminal: TerminalHandle, outSelPtr: number): number;
    ghostty_terminal_select_output(terminal: TerminalHandle, refPtr: number, outSelPtr: number): number;
    ghostty_terminal_selection_adjust(terminal: TerminalHandle, selPtr: number, adjust: number): number;
    ghostty_terminal_selection_order(terminal: TerminalHandle, selPtr: number, outOrderPtr: number): number;
    ghostty_terminal_selection_ordered(terminal: TerminalHandle, selPtr: number, desired: number, outSelPtr: number): number;
    /** `point` is a GhosttyPoint passed by value: wasm32 passes a pointer to it. */
    ghostty_terminal_selection_contains(terminal: TerminalHandle, selPtr: number, pointPtr: number, outBoolPtr: number): number;
    ghostty_terminal_selection_equal(terminal: TerminalHandle, aPtr: number, bPtr: number, outBoolPtr: number): number;
    ghostty_selection_gesture_new(allocator: number, gesturePtrPtr: number): number;
    ghostty_selection_gesture_free(gesture: number, terminal: TerminalHandle): void;
    ghostty_selection_gesture_reset(gesture: number, terminal: TerminalHandle): void;
    ghostty_selection_gesture_get(gesture: number, terminal: TerminalHandle, data: number, valuePtr: number): number;
    ghostty_selection_gesture_event_new(allocator: number, eventPtrPtr: number, type: number): number;
    ghostty_selection_gesture_event_free(event: number): void;
    ghostty_selection_gesture_event_set(event: number, option: number, valuePtr: number): number;
    ghostty_selection_gesture_event(gesture: number, terminal: TerminalHandle, event: number, outSelPtr: number): number;
    ghostty_search_new(allocator: number, searchPtrPtr: number, terminal: TerminalHandle): number;
    ghostty_search_free(search: number): void;
    ghostty_search_tick(search: number, outStatusPtr: number): number;
    ghostty_search_feed(search: number): number;
    ghostty_search_run(search: number): number;
    ghostty_search_select_next(search: number): number;
    ghostty_search_select_prev(search: number): number;
    ghostty_search_set(search: number, option: number, valuePtr: number): number;
    ghostty_search_get(search: number, data: number, valuePtr: number): number;
    ghostty_formatter_terminal_new(allocator: number, formatterPtrPtr: number, terminal: TerminalHandle): number;
    ghostty_formatter_free(formatter: number): void;
    ghostty_formatter_set(formatter: number, option: number, valuePtr: number): number;
    ghostty_formatter_format_alloc(formatter: number, allocator: number, outPtrPtr: number, outLenPtr: number): number;
    ghostty_focus_encode(event: number, bufPtr: number, bufLen: number, writtenPtr: number): number;
    ghostty_terminal_paste(terminal: number, paste: number, outPasted: number): number;
    ghostty_wasm_alloc_opaque(): number;
    ghostty_wasm_free_opaque(ptr: number): void;
    ghostty_wasm_alloc(len: number): number;
    ghostty_wasm_free(ptr: number, len: number): void;
    ghostty_sgr_new(allocator: number, parserPtrPtr: number): number;
    ghostty_sgr_free(parser: number): void;
    ghostty_sgr_reset(parser: number): void;
    ghostty_sgr_set_params(parser: number, paramsPtr: number, subsPtr: number, paramsLen: number): number;
    ghostty_sgr_next(parser: number, attrPtr: number): boolean;
    ghostty_sgr_attribute_tag(attrPtr: number): number;
    /** Returns a pointer to the GhosttySgrAttributeValue union inside `attrPtr`. */
    ghostty_sgr_attribute_value(attrPtr: number): number;
    ghostty_key_encoder_new(allocator: number, encoderPtrPtr: number): number;
    ghostty_key_encoder_free(encoder: number): void;
    ghostty_key_encoder_set(encoder: number, option: number, valuePtr: number): number;
    ghostty_key_encoder_set_from_terminal(encoder: number, terminal: TerminalHandle): number;
    ghostty_key_encoder_encode(encoder: number, eventPtr: number, bufPtr: number, bufLen: number, writtenPtr: number): number;
    ghostty_key_event_new(allocator: number, eventPtrPtr: number): number;
    ghostty_key_event_free(event: number): void;
    ghostty_key_event_set_action(event: number, action: number): void;
    ghostty_key_event_set_key(event: number, key: number): void;
    ghostty_key_event_set_mods(event: number, mods: number): void;
    /** `utf8` is a GhosttyString passed by value: wasm32 passes it as a pointer to { ptr: u32, len: u32 }. */
    ghostty_key_event_set_utf8(event: number, stringPtr: number): number;
    ghostty_key_event_set_unshifted_codepoint(event: number, codepoint: number): void;
    ghostty_key_event_set_consumed_mods(event: number, mods: number): void;
    ghostty_key_event_set_composing(event: number, composing: boolean): void;
    ghostty_terminal_new(allocatorPtr: number, terminalPtrPtr: number, cols: number, rows: number): number;
    ghostty_terminal_free(terminal: TerminalHandle): void;
    ghostty_terminal_reset(terminal: TerminalHandle): void;
    ghostty_terminal_resize(terminal: TerminalHandle, cols: number, rows: number, cellWidthPx: number, cellHeightPx: number): number;
    ghostty_terminal_vt_write(terminal: TerminalHandle, dataPtr: number, dataLen: number): void;
    ghostty_render_state_new(allocatorPtr: number, statePtrPtr: number): number;
    ghostty_render_state_free(state: number): void;
    ghostty_render_state_update(state: number, terminal: TerminalHandle): number;
    ghostty_render_state_get(state: number, key: number, outPtr: number): number;
    ghostty_render_state_get_multi(state: number, count: number, keysPtr: number, valuesPtr: number, outWrittenPtr: number): number;
    ghostty_render_state_set(state: number, option: number, valuePtr: number): number;
    ghostty_render_state_row_iterator_new(allocatorPtr: number, outIterPtrPtr: number): number;
    ghostty_render_state_row_iterator_free(iter: number): void;
    ghostty_render_state_row_iterator_next(iter: number): boolean;
    ghostty_render_state_row_get(iter: number, key: number, outPtr: number): number;
    ghostty_render_state_row_set(iter: number, option: number, valuePtr: number): number;
    ghostty_render_state_row_cells_new(allocatorPtr: number, outCellsPtrPtr: number): number;
    ghostty_render_state_row_cells_free(cells: number): void;
    ghostty_render_state_row_cells_next(cells: number): boolean;
    ghostty_render_state_row_cells_select(cells: number, col: number): number;
    ghostty_render_state_row_cells_get(cells: number, key: number, outPtr: number): number;
    ghostty_render_state_row_cells_get_multi(cells: number, count: number, keysPtr: number, valuesPtr: number, outWrittenPtr: number): number;
    ghostty_cell_get(cell: bigint, key: number, outPtr: number): number;
    ghostty_row_get(row: bigint, key: number, outPtr: number): number;
    ghostty_terminal_grid_ref(terminal: TerminalHandle, pointPtr: number, outRefPtr: number): number;
    ghostty_grid_ref_cell(refPtr: number, outCellPtr: number): number;
    ghostty_grid_ref_row(refPtr: number, outRowPtr: number): number;
    ghostty_grid_ref_graphemes(refPtr: number, bufPtr: number, bufLen: number, outLenPtr: number): number;
    ghostty_grid_ref_hyperlink_uri(refPtr: number, bufPtr: number, bufLen: number, outLenPtr: number): number;
    ghostty_grid_ref_style(refPtr: number, outStylePtr: number): number;
    ghostty_render_state_image_iterator_new(allocator: number, out: number): number;
    ghostty_render_state_image_iterator_free(iterator: number): void;
    ghostty_render_state_image_iterator_next(iterator: number): boolean;
    ghostty_render_state_image_get_multi(iterator: number, count: number, keys: number, values: number, written: number): number;
    ghostty_terminal_scroll_viewport(terminal: number, viewport: number): void;
    ghostty_kitty_graphics_animation_tick(graphics: number, now: bigint, next: number): number;
    ghostty_kitty_graphics_get(graphics: number, key: number, outPtr: number): number;
    ghostty_kitty_graphics_image(graphics: number, imageId: number): number;
    ghostty_kitty_graphics_image_get(image: number, key: number, outPtr: number): number;
    ghostty_kitty_graphics_image_get_multi(image: number, count: number, keysPtr: number, valuesPtr: number, outWrittenPtr: number): number;
    ghostty_kitty_graphics_placement_iterator_new(allocatorPtr: number, outIterPtrPtr: number): number;
    ghostty_kitty_graphics_placement_iterator_free(iter: number): void;
    ghostty_kitty_graphics_placement_iterator_set(iter: number, option: number, valuePtr: number): number;
    ghostty_kitty_graphics_placement_next(iter: number): boolean;
    ghostty_kitty_graphics_placement_get(iter: number, key: number, outPtr: number): number;
    ghostty_kitty_graphics_placement_get_multi(iter: number, count: number, keysPtr: number, valuesPtr: number, outWrittenPtr: number): number;
    ghostty_kitty_graphics_placement_rect(iter: number, image: number, terminal: TerminalHandle, outSelectionPtr: number): number;
    ghostty_kitty_graphics_placement_pixel_size(iter: number, image: number, terminal: TerminalHandle, outWidthPtr: number, outHeightPtr: number): number;
    ghostty_kitty_graphics_placement_grid_size(iter: number, image: number, terminal: TerminalHandle, outColsPtr: number, outRowsPtr: number): number;
    ghostty_kitty_graphics_placement_viewport_pos(iter: number, image: number, terminal: TerminalHandle, outColPtr: number, outRowPtr: number): number;
    ghostty_kitty_graphics_placement_source_rect(iter: number, image: number, outX: number, outY: number, outW: number, outH: number): number;
    ghostty_kitty_graphics_placement_render_info(iter: number, image: number, terminal: TerminalHandle, outInfoPtr: number): number;
    ghostty_terminal_get(terminal: TerminalHandle, key: number, outPtr: number): number;
    ghostty_terminal_get_multi(terminal: TerminalHandle, count: number, keysPtr: number, valuesPtr: number, outWrittenPtr: number): number;
    ghostty_terminal_set(terminal: TerminalHandle, option: number, valuePtr: number): number;
    ghostty_sys_set(option: number, valuePtr: number): number;
    ghostty_alloc(allocatorPtr: number, len: number): number;
    ghostty_free(allocatorPtr: number, ptr: number, len: number): void;
}

/**
 * Untracked reference to one cell (GhosttyGridRef). It is a snapshot: valid
 * until the next call that changes the terminal (write, resize, reset,
 * setSelection...). Obtain one with GhosttyTerminal.gridRef().
 */
export declare interface GridRef {
    node: number;
    x: number;
    y: number;
}

/**
 * A terminal buffer (normal or alternate screen)
 */
declare interface IBuffer {
    /** Buffer type: 'normal' or 'alternate' */
    readonly type: 'normal' | 'alternate';
    /** Cursor X position (0-indexed) */
    readonly cursorX: number;
    /** Cursor Y position (0-indexed, relative to viewport) */
    readonly cursorY: number;
    /** Viewport Y position (scroll offset, 0 = bottom of scrollback) */
    readonly viewportY: number;
    /** Base Y position (always 0 for normal buffer, may vary for alternate) */
    readonly baseY: number;
    /** Total buffer length (rows + scrollback for normal, just rows for alternate) */
    readonly length: number;
    /**
     * Get a line from the buffer
     * @param y Line index (0 = top of scrollback for normal buffer)
     * @returns Line object or undefined if out of bounds
     */
    getLine(y: number): IBufferLine | undefined;
    /**
     * Get the null cell (used for empty/uninitialized cells)
     */
    getNullCell(): IBufferCell;
}

/**
 * A single cell in the buffer
 */
declare interface IBufferCell {
    /** Character(s) in this cell (may be empty, single char, or emoji) */
    getChars(): string;
    /** Unicode codepoint (0 for null cell) */
    getCode(): number;
    /** Character width (1 = normal, 2 = wide/emoji, 0 = combining) */
    getWidth(): number;
    /** Foreground color index (for palette colors) or -1 for RGB */
    getFgColorMode(): number;
    /** Background color index (for palette colors) or -1 for RGB */
    getBgColorMode(): number;
    /** Foreground RGB color (or 0 for default) */
    getFgColor(): number;
    /** Background RGB color (or 0 for default) */
    getBgColor(): number;
    /** Whether cell has bold style */
    isBold(): number;
    /** Whether cell has italic style */
    isItalic(): number;
    /** Whether cell has underline style */
    isUnderline(): number;
    /** Whether cell has strikethrough style */
    isStrikethrough(): number;
    /** Whether cell has blink style */
    isBlink(): number;
    /** Whether cell has inverse video style */
    isInverse(): number;
    /** Whether cell has invisible style */
    isInvisible(): number;
    /** Whether cell has faint/dim style */
    isFaint(): number;
    /** Get hyperlink ID for this cell (0 = no link) */
    getHyperlinkId(): number;
    /** Get the Unicode codepoint for this cell */
    getCodepoint(): number;
    /** Whether cell has dim/faint attribute (boolean version) */
    isDim(): boolean;
}

/**
 * Represents a coordinate in the terminal buffer
 */
export declare interface IBufferCellPosition {
    x: number;
    y: number;
}

/**
 * A single line in the buffer
 */
declare interface IBufferLine {
    /** Length of the line (in columns) */
    readonly length: number;
    /** Whether this line wraps to the next line */
    readonly isWrapped: boolean;
    /**
     * Get a cell from this line
     * @param x Column index (0-indexed)
     * @returns Cell object or undefined if out of bounds
     */
    getCell(x: number): IBufferCell | undefined;
    /**
     * Translate the line to a string
     * @param trimRight Whether to trim trailing whitespace (default: false)
     * @param startColumn Start column (default: 0)
     * @param endColumn End column (default: length)
     * @returns String representation of the line
     */
    translateToString(trimRight?: boolean, startColumn?: number, endColumn?: number): string;
}

/**
 * Minimal buffer line interface for URL detection
 */
declare interface IBufferLineForUrlProvider {
    length: number;
    getCell(x: number): {
        getCodepoint(): number;
    } | undefined;
}

/**
 * Top-level buffer API namespace
 * Provides access to active, normal, and alternate screen buffers
 */
declare interface IBufferNamespace {
    /** The currently active buffer (normal or alternate) */
    readonly active: IBuffer;
    /** The normal buffer (primary screen) */
    readonly normal: IBuffer;
    /** The alternate buffer (used by full-screen apps like vim) */
    readonly alternate: IBuffer;
    /** Event fired when buffer changes (normal ↔ alternate) */
    readonly onBufferChange: IEvent<IBuffer>;
}

/**
 * Buffer range for selection coordinates
 */
export declare interface IBufferRange {
    start: {
        x: number;
        y: number;
    };
    end: {
        x: number;
        y: number;
    };
}

/**
 * Represents a range in the terminal buffer
 * Can span multiple lines for wrapped links
 */
declare interface IBufferRange_2 {
    start: IBufferCellPosition;
    end: IBufferCellPosition;
}

export declare interface IDisposable {
    dispose(): void;
}

export declare type IEvent<T> = (listener: (arg: T) => void) => IDisposable;

/**
 * Keyboard event with key and DOM event
 */
export declare interface IKeyEvent {
    key: string;
    domEvent: KeyboardEvent;
}

/**
 * Represents a detected link in the terminal
 */
export declare interface ILink {
    /** The URL or text of the link */
    text: string;
    /** The range of the link in the buffer (may span multiple lines) */
    range: IBufferRange_2;
    /** Called when the link is activated (clicked with modifier) */
    activate(event: MouseEvent): void;
    /** Optional: called when mouse enters/leaves the link */
    hover?(isHovered: boolean): void;
    /** Optional: called to clean up resources */
    dispose?(): void;
}

/**
 * Provides link detection for a specific type of link
 * Examples: OSC 8 hyperlinks, URL regex detection
 */
export declare interface ILinkProvider {
    /**
     * Provide links for a given row
     * @param y Absolute row in buffer (0-based)
     * @param callback Called with detected links (or undefined if none)
     */
    provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void;
    /** Optional: called when terminal is disposed */
    dispose?(): void;
}

/** A synchronous render snapshot; consume pixels before the next terminal mutation. */
export declare interface ImageFrame {
    /** Changes when geometry, image contents, pixel availability or terminal changes. */
    revision: number;
    placements: readonly RenderImage[];
    pixels(imageId: number): KittyImagePixels | null;
}

/**
 * Initialize the ntwebterm library by loading the WASM module.
 * Must be called before creating any Terminal instances.
 *
 * This creates a shared WASM instance that all Terminal instances will use.
 * For test isolation, pass a Ghostty instance directly to Terminal constructor.
 *
 * @example
 * ```typescript
 * import { init, Terminal } from 'ntwebterm';
 *
 * await init();
 * const term = new Terminal();
 * term.open(document.getElementById('terminal'));
 * ```
 */
export declare function init(): Promise<void>;

export declare class InputHandler {
    private encoder;
    private container;
    private inputElement?;
    private onDataCallback;
    private onBellCallback;
    private onKeyCallback?;
    private customKeyEventHandler?;
    private getModeCallback?;
    private onCopyCallback?;
    private mouseConfig?;
    private getTerminalCallback?;
    private onPasteCallback?;
    private isMac;
    private macOptionIsMeta;
    private keydownListener;
    private keyupListener;
    private keypressListener;
    private pasteListener;
    private beforeInputListener;
    private compositionStartListener;
    private compositionUpdateListener;
    private compositionEndListener;
    private mousedownListener;
    private mouseupListener;
    private mousemoveListener;
    private wheelListener;
    private isComposing;
    private isDisposed;
    private mouseButtonsPressed;
    private lastKeyDownData;
    private lastKeyDownTime;
    private lastPasteData;
    private lastPasteTime;
    private lastPasteSource;
    private lastCompositionData;
    private lastCompositionTime;
    private lastBeforeInputData;
    private lastBeforeInputTime;
    private static readonly BEFORE_INPUT_IGNORE_MS;
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
    constructor(ghostty: Ghostty, container: HTMLElement, onData: (data: string) => void, onBell: () => void, onKey?: (keyEvent: IKeyEvent) => void, customKeyEventHandler?: (event: KeyboardEvent) => boolean, getMode?: (mode: number) => boolean, onCopy?: () => boolean, inputElement?: HTMLElement, mouseConfig?: MouseTrackingConfig, getTerminal?: () => GhosttyTerminal | undefined, onPaste?: (text: string) => void, keyboardOptions?: InputHandlerKeyboardOptions);
    /**
     * Set custom key event handler (for runtime updates)
     */
    setCustomKeyEventHandler(handler: (event: KeyboardEvent) => boolean): void;
    /**
     * Attach keyboard event listeners to container
     */
    private attach;
    /**
     * Map KeyboardEvent.code to USB HID Key enum value
     * @param code - KeyboardEvent.code value
     * @returns Key enum value or null if unmapped
     */
    private mapKeyCode;
    /**
     * Extract modifier flags from KeyboardEvent
     * @param event - KeyboardEvent
     * @returns Mods flags
     */
    private extractModifiers;
    /** AltGr is held: the key composes a character and is not a Ctrl/Alt chord. */
    private isAltGraph;
    /** The macOS Option key is held and composes a character (the system default). */
    private isComposingOption;
    /**
     * Check if this key press is plain text: a single character that no
     * modifier turns into a chord.
     * @param event - KeyboardEvent
     * @returns true if printable character
     */
    private isPrintableCharacter;
    /**
     * Describe the text side of a key event for the encoder: the text the key
     * produced, the character it would produce unmodified, and which modifiers
     * went into producing the text rather than forming a chord.
     */
    private describeKeyText;
    /**
     * Handle keydown event
     * @param event - KeyboardEvent
     */
    private handleKeyDown;
    /**
     * Synchronize KeyEncoder options with the live terminal state
     */
    private syncEncoderOptions;
    /**
     * Handle keyup event (for Kitty keyboard protocol event reporting)
     */
    private handleKeyUp;
    /**
     * Handle paste event from clipboard
     * @param event - ClipboardEvent
     */
    private handlePaste;
    /**
     * Handle beforeinput event (mobile/IME input)
     * @param event - InputEvent
     */
    private handleBeforeInput;
    /**
     * Handle compositionstart event
     */
    private handleCompositionStart;
    /**
     * Handle compositionupdate event
     */
    private handleCompositionUpdate;
    /**
     * Handle compositionend event
     */
    private handleCompositionEnd;
    /**
     * Cleanup text nodes in container after composition
     */
    private cleanupCompositionTextNodes;
    /**
     * Convert a pointer position to the terminal cell under it (1-based) and
     * the pointer's offset inside that cell in pixels. Uses the renderer's
     * fractional cell metrics so wide terminals do not drift by a column, and
     * maps visual to logical columns on BiDi rows.
     */
    private pixelToCell;
    /** GhosttyMods for a mouse event; upstream turns these into the report's modifier bits. */
    private mouseMods;
    /** DOM button index to the upstream button; back/forward are xterm buttons 8 and 9. */
    private static readonly DOM_BUTTONS;
    /** The button to report with drag motion: left, then middle, then right; null when none is held. */
    private heldButton;
    /**
     * Encode a mouse report through libghostty-vt and send it. The encoder reads
     * the tracking mode and format from the terminal, drops events the mode does
     * not report, and deduplicates motion within a cell. Returns false when the
     * event could not be mapped to a cell.
     */
    private reportMouse;
    /**
     * Handle mousedown event
     */
    private handleMouseDown;
    /**
     * Handle mouseup event
     */
    private handleMouseUp;
    /**
     * Handle mousemove event. Whether motion is reported at all (modes 1002 and
     * 1003) and same-cell deduplication are decided by the encoder.
     */
    private handleMouseMove;
    /**
     * Handle wheel event (scroll): buttons 4/5 vertically, 6/7 horizontally.
     */
    private handleWheel;
    /**
     * Route pasted text. The terminal pastes through libghostty-vt (bracketed
     * paste framing, Kitty paste events, unsafe-byte replacement); without an
     * onPaste callback the raw text is sent as typed input.
     */
    private emitPasteData;
    /**
     * Record keydown data for beforeinput de-duplication
     */
    private recordKeyDownData;
    /**
     * Record paste data for beforeinput de-duplication
     */
    private recordPasteData;
    /**
     * Check if beforeinput should be ignored due to a recent keydown
     */
    private shouldIgnoreBeforeInput;
    /**
     * Check if beforeinput text should be ignored due to a recent composition end
     */
    private shouldIgnoreBeforeInputFromComposition;
    /**
     * Check if composition end should be ignored due to a recent beforeinput text
     */
    private shouldIgnoreCompositionEnd;
    /**
     * Record beforeinput text for composition de-duplication
     */
    private recordBeforeInputData;
    /**
     * Record composition end data for beforeinput de-duplication
     */
    private recordCompositionData;
    /**
     * Check if paste should be ignored due to a recent paste event from another source
     */
    private shouldIgnorePasteEvent;
    /**
     * Get current time in milliseconds
     */
    private getNow;
    /**
     * Dispose the InputHandler and remove event listeners
     */
    dispose(): void;
    /**
     * Check if handler is disposed
     */
    isActive(): boolean;
}

/** Keyboard behavior that depends on the platform or on terminal options. */
declare interface InputHandlerKeyboardOptions {
    /**
     * Whether the macOS Option key acts as Alt/Meta (ESC prefix) instead of
     * composing characters. Read on every key press. Default: false.
     */
    macOptionIsMeta?: () => boolean;
    /** Override macOS detection (for tests). */
    isMac?: boolean;
}

/**
 * Install a corner HUD showing the active renderer backend and live FPS.
 * Returns an uninstall function that removes the badge, the injected style
 * block, the rAF loop, and any listeners.
 */
export declare function installRendererHud(terminal: Terminal, opts?: RendererHudOptions): () => void;

/**
 * Buffer adapter consumed by renderers. CanvasRenderer and WebGPURenderer
 * both read cells through this surface; the GhosttyTerminal implements it.
 */
export declare interface IRenderable {
    getLine(y: number): GhosttyCell[] | null;
    getViewport(): GhosttyCell[];
    getCursor(): {
        x: number;
        y: number;
        visible: boolean;
    };
    getDimensions(): {
        cols: number;
        rows: number;
    };
    isRowDirty(y: number): boolean;
    needsFullRedraw?(): boolean;
    clearDirty(): void;
    getGraphemeString?(row: number, col: number): string;
    getImageFrame?(viewportY?: number): ImageFrame;
    getKittyGraphics?(): number | null;
    iterPlacements?(graphics: number, onlyVisible?: boolean): Iterable<KittyPlacementInfo>;
    getKittyImagePixels?(graphics: number, imageId: number): KittyImagePixels | null;
    getGrapheme?(row: number, col: number): number[] | null;
}

export declare interface IScrollbackProvider {
    getScrollbackLine(offset: number): GhosttyCell[] | null;
    getScrollbackLength(): number;
}

export declare interface ISearchDecorationOptions {
    /** Fill for matches other than the selected one. Default: translucent yellow. */
    matchBackground?: string;
    /** Fill for the selected match. Default: translucent orange. */
    activeMatchBackground?: string;
}

export declare interface ISearchOptions {
    /**
     * Accepted for xterm.js compatibility. The library keeps results when the
     * needle is resubmitted, so typing in a find bar is already incremental.
     */
    incremental?: boolean;
    decorations?: ISearchDecorationOptions;
}

/** xterm.js shape: `resultIndex` counts top to bottom, -1 when nothing is selected. */
export declare interface ISearchResult {
    resultIndex: number;
    resultCount: number;
}

export declare interface ITerminalAddon {
    activate(terminal: ITerminalCore): void;
    dispose(): void;
}

export declare interface ITerminalCore {
    cols: number;
    rows: number;
    element?: HTMLElement;
    textarea?: HTMLTextAreaElement;
}

export declare interface ITerminalDimensions {
    cols: number;
    rows: number;
}

/**
 * Minimal terminal interface required by LinkDetector
 * Keeps coupling low and testing easy
 */
declare interface ITerminalForLinkDetector {
    buffer: {
        active: {
            getLine(y: number): {
                length: number;
                getCell(x: number): {
                    getHyperlinkId(): number;
                } | undefined;
            } | undefined;
        };
    };
}

/**
 * Minimal terminal interface required by OSC8LinkProvider
 */
declare interface ITerminalForOSC8Provider {
    buffer: {
        active: {
            length: number;
            getLine(y: number): {
                length: number;
                getCell(x: number): {
                    getHyperlinkId(): number;
                } | undefined;
            } | undefined;
        };
    };
    wasmTerm?: {
        getHyperlinkUri(row: number, col: number): string | null;
        getScrollbackHyperlinkUri(offset: number, col: number): string | null;
        getScrollbackLength(): number;
    };
}

/**
 * Minimal terminal interface required by UrlRegexProvider
 */
declare interface ITerminalForUrlProvider {
    buffer: {
        active: {
            getLine(y: number): IBufferLineForUrlProvider | undefined;
        };
    };
}

export declare interface ITerminalOptions {
    cols?: number;
    rows?: number;
    cursorBlink?: boolean;
    cursorStyle?: 'block' | 'underline' | 'bar';
    theme?: ITheme;
    scrollback?: number;
    fontSize?: number;
    /** Default: '"JetBrains Mono", "Cascadia Code", "Iosevka", "Source Code Pro", "ui-monospace", "SF Mono", Menlo, Consolas, monospace'. */
    fontFamily?: string;
    /** Faces loaded before initial measurement. After 3 seconds, use the fallback stack.
     * src accepts URLs or CSS url()/local() sources. Set before open().
     */
    fontFaces?: Array<{
        family: string;
        src: string | string[];
        weight?: string | number;
        style?: string;
        display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
    }>;
    allowTransparency?: boolean;
    convertEol?: boolean;
    disableStdin?: boolean;
    /**
     * Treat the macOS Option key as Alt/Meta (Option+b sends ESC b) instead of
     * letting it compose characters (Option+b types "∫"). Default: false, as in
     * xterm.js.
     */
    macOptionIsMeta?: boolean;
    smoothScrollDuration?: number;
    /** Renderer backend. 'auto' probes WebGPU, falls back to Canvas2D. Default: 'auto'. */
    renderer?: RendererBackend;
    /**
     * How OSC 52 / OSC 5522 clipboard writes from programs are handled.
     * 'browser' (default) copies to the browser clipboard and fires
     * onClipboardWrite; 'event' only fires the event; 'deny' refuses them.
     */
    clipboardWrite?: 'browser' | 'event' | 'deny';
    /**
     * Answers OSC 52 "?" / OSC 5522 clipboard reads synchronously. Reads are
     * refused when unset, so programs can never read the clipboard silently.
     */
    clipboardRead?: ClipboardReadHandler | null;
    /**
     * Pastes that could inject commands: a line terminator outside bracketed
     * paste, or the bracketed paste end marker. `true` (default) pastes them
     * as xterm.js does, `false` drops them, and a callback may confirm with
     * the person using the terminal and return true to paste.
     */
    allowUnsafePaste?: boolean | ((text: string) => boolean);
    /**
     * Answer to CSI ? 996 n color scheme queries. 'auto' (default) derives it
     * from the luminance of theme.background.
     */
    colorScheme?: 'auto' | ColorScheme;
    ghostty?: Ghostty;
}

export declare interface ITheme {
    foreground?: string;
    background?: string;
    cursor?: string;
    cursorAccent?: string;
    selectionBackground?: string;
    selectionForeground?: string;
    black?: string;
    red?: string;
    green?: string;
    yellow?: string;
    blue?: string;
    magenta?: string;
    cyan?: string;
    white?: string;
    brightBlack?: string;
    brightRed?: string;
    brightGreen?: string;
    brightYellow?: string;
    brightBlue?: string;
    brightMagenta?: string;
    brightCyan?: string;
    brightWhite?: string;
}

/**
 * Unicode version provider (xterm.js compatibility)
 */
export declare interface IUnicodeVersionProvider {
    readonly activeVersion: string;
}

/** Mirrors the C enum GhosttyKey (GHOSTTY_KEY_*), i32. */
export declare enum Key {
    /** @deprecated ntwebterm alias for {@link GhosttyKey.BACKQUOTE}. */
    GRAVE = 1,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.DIGIT_0}. */
    ZERO = 6,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.DIGIT_1}. */
    ONE = 7,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.DIGIT_2}. */
    TWO = 8,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.DIGIT_3}. */
    THREE = 9,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.DIGIT_4}. */
    FOUR = 10,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.DIGIT_5}. */
    FIVE = 11,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.DIGIT_6}. */
    SIX = 12,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.DIGIT_7}. */
    SEVEN = 13,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.DIGIT_8}. */
    EIGHT = 14,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.DIGIT_9}. */
    NINE = 15,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.ARROW_UP}. */
    UP = 78,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.ARROW_DOWN}. */
    DOWN = 75,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.ARROW_LEFT}. */
    LEFT = 76,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.ARROW_RIGHT}. */
    RIGHT = 77,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_0}. */
    KP_0 = 80,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_1}. */
    KP_1 = 81,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_2}. */
    KP_2 = 82,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_3}. */
    KP_3 = 83,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_4}. */
    KP_4 = 84,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_5}. */
    KP_5 = 85,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_6}. */
    KP_6 = 86,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_7}. */
    KP_7 = 87,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_8}. */
    KP_8 = 88,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_9}. */
    KP_9 = 89,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_ADD}. */
    KP_PLUS = 90,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_SUBTRACT}. */
    KP_MINUS = 107,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_MULTIPLY}. */
    KP_MULTIPLY = 104,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_DIVIDE}. */
    KP_DIVIDE = 96,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_DECIMAL}. */
    KP_PERIOD = 95,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_COMMA}. */
    KP_COMMA = 94,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_SEPARATOR}. */
    KP_SEPARATOR = 108,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_ENTER}. */
    KP_ENTER = 97,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_EQUAL}. */
    KP_EQUAL = 98,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_BACKSPACE}. */
    KP_BACKSPACE = 91,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_CLEAR}. */
    KP_CLEAR = 92,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_CLEAR_ENTRY}. */
    KP_CLEAR_ENTRY = 93,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_PAREN_LEFT}. */
    KP_PAREN_LEFT = 105,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_PAREN_RIGHT}. */
    KP_PAREN_RIGHT = 106,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_MEMORY_ADD}. */
    KP_MEMORY_ADD = 99,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_MEMORY_CLEAR}. */
    KP_MEMORY_CLEAR = 100,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_MEMORY_RECALL}. */
    KP_MEMORY_RECALL = 101,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_MEMORY_STORE}. */
    KP_MEMORY_STORE = 102,
    /** @deprecated ntwebterm alias for {@link GhosttyKey.NUMPAD_MEMORY_SUBTRACT}. */
    KP_MEMORY_SUBTRACT = 103,
    UNIDENTIFIED = 0,
    BACKQUOTE = 1,
    BACKSLASH = 2,
    BRACKET_LEFT = 3,
    BRACKET_RIGHT = 4,
    COMMA = 5,
    DIGIT_0 = 6,
    DIGIT_1 = 7,
    DIGIT_2 = 8,
    DIGIT_3 = 9,
    DIGIT_4 = 10,
    DIGIT_5 = 11,
    DIGIT_6 = 12,
    DIGIT_7 = 13,
    DIGIT_8 = 14,
    DIGIT_9 = 15,
    EQUAL = 16,
    INTL_BACKSLASH = 17,
    INTL_RO = 18,
    INTL_YEN = 19,
    A = 20,
    B = 21,
    C = 22,
    D = 23,
    E = 24,
    F = 25,
    G = 26,
    H = 27,
    I = 28,
    J = 29,
    K = 30,
    L = 31,
    M = 32,
    N = 33,
    O = 34,
    P = 35,
    Q = 36,
    R = 37,
    S = 38,
    T = 39,
    U = 40,
    V = 41,
    W = 42,
    X = 43,
    Y = 44,
    Z = 45,
    MINUS = 46,
    PERIOD = 47,
    QUOTE = 48,
    SEMICOLON = 49,
    SLASH = 50,
    ALT_LEFT = 51,
    ALT_RIGHT = 52,
    BACKSPACE = 53,
    CAPS_LOCK = 54,
    CONTEXT_MENU = 55,
    CONTROL_LEFT = 56,
    CONTROL_RIGHT = 57,
    ENTER = 58,
    META_LEFT = 59,
    META_RIGHT = 60,
    SHIFT_LEFT = 61,
    SHIFT_RIGHT = 62,
    SPACE = 63,
    TAB = 64,
    CONVERT = 65,
    KANA_MODE = 66,
    NON_CONVERT = 67,
    DELETE = 68,
    END = 69,
    HELP = 70,
    HOME = 71,
    INSERT = 72,
    PAGE_DOWN = 73,
    PAGE_UP = 74,
    ARROW_DOWN = 75,
    ARROW_LEFT = 76,
    ARROW_RIGHT = 77,
    ARROW_UP = 78,
    NUM_LOCK = 79,
    NUMPAD_0 = 80,
    NUMPAD_1 = 81,
    NUMPAD_2 = 82,
    NUMPAD_3 = 83,
    NUMPAD_4 = 84,
    NUMPAD_5 = 85,
    NUMPAD_6 = 86,
    NUMPAD_7 = 87,
    NUMPAD_8 = 88,
    NUMPAD_9 = 89,
    NUMPAD_ADD = 90,
    NUMPAD_BACKSPACE = 91,
    NUMPAD_CLEAR = 92,
    NUMPAD_CLEAR_ENTRY = 93,
    NUMPAD_COMMA = 94,
    NUMPAD_DECIMAL = 95,
    NUMPAD_DIVIDE = 96,
    NUMPAD_ENTER = 97,
    NUMPAD_EQUAL = 98,
    NUMPAD_MEMORY_ADD = 99,
    NUMPAD_MEMORY_CLEAR = 100,
    NUMPAD_MEMORY_RECALL = 101,
    NUMPAD_MEMORY_STORE = 102,
    NUMPAD_MEMORY_SUBTRACT = 103,
    NUMPAD_MULTIPLY = 104,
    NUMPAD_PAREN_LEFT = 105,
    NUMPAD_PAREN_RIGHT = 106,
    NUMPAD_SUBTRACT = 107,
    NUMPAD_SEPARATOR = 108,
    NUMPAD_UP = 109,
    NUMPAD_DOWN = 110,
    NUMPAD_RIGHT = 111,
    NUMPAD_LEFT = 112,
    NUMPAD_BEGIN = 113,
    NUMPAD_HOME = 114,
    NUMPAD_END = 115,
    NUMPAD_INSERT = 116,
    NUMPAD_DELETE = 117,
    NUMPAD_PAGE_UP = 118,
    NUMPAD_PAGE_DOWN = 119,
    ESCAPE = 120,
    F1 = 121,
    F2 = 122,
    F3 = 123,
    F4 = 124,
    F5 = 125,
    F6 = 126,
    F7 = 127,
    F8 = 128,
    F9 = 129,
    F10 = 130,
    F11 = 131,
    F12 = 132,
    F13 = 133,
    F14 = 134,
    F15 = 135,
    F16 = 136,
    F17 = 137,
    F18 = 138,
    F19 = 139,
    F20 = 140,
    F21 = 141,
    F22 = 142,
    F23 = 143,
    F24 = 144,
    F25 = 145,
    FN = 146,
    FN_LOCK = 147,
    PRINT_SCREEN = 148,
    SCROLL_LOCK = 149,
    PAUSE = 150,
    BROWSER_BACK = 151,
    BROWSER_FAVORITES = 152,
    BROWSER_FORWARD = 153,
    BROWSER_HOME = 154,
    BROWSER_REFRESH = 155,
    BROWSER_SEARCH = 156,
    BROWSER_STOP = 157,
    EJECT = 158,
    LAUNCH_APP_1 = 159,
    LAUNCH_APP_2 = 160,
    LAUNCH_MAIL = 161,
    MEDIA_PLAY_PAUSE = 162,
    MEDIA_SELECT = 163,
    MEDIA_STOP = 164,
    MEDIA_TRACK_NEXT = 165,
    MEDIA_TRACK_PREVIOUS = 166,
    POWER = 167,
    SLEEP = 168,
    AUDIO_VOLUME_DOWN = 169,
    AUDIO_VOLUME_MUTE = 170,
    AUDIO_VOLUME_UP = 171,
    WAKE_UP = 172,
    COPY = 173,
    CUT = 174,
    PASTE = 175
}

/** Mirrors the C enum GhosttyKeyAction (GHOSTTY_KEY_ACTION_*), i32. */
export declare enum KeyAction {
    RELEASE = 0,
    PRESS = 1,
    REPEAT = 2
}

/**
 * Key Encoder - converts keyboard events into terminal escape sequences
 */
export declare class KeyEncoder {
    private exports;
    private encoder;
    constructor(exports: GhosttyWasmExports);
    setOption(option: KeyEncoderOption, value: boolean | number): void;
    setKittyFlags(flags: KittyKeyFlags): void;
    setOptionsFromTerminal(terminalHandle: TerminalHandle): void;
    encode(event: KeyEvent): Uint8Array;
    dispose(): void;
}

/** Mirrors the C enum GhosttyKeyEncoderOption (GHOSTTY_KEY_ENCODER_OPT_*), i32. */
export declare enum KeyEncoderOption {
    /** @deprecated ntwebterm alias for {@link GhosttyKeyEncoderOption.KITTY_FLAGS}. */
    KITTY_KEYBOARD_FLAGS = 6,
    INVALID = 0,
    CURSOR_KEY_APPLICATION = 1,
    KEYPAD_KEY_APPLICATION = 2,
    IGNORE_KEYPAD_WITH_NUMLOCK = 3,
    ALT_ESC_PREFIX = 4,
    MODIFY_OTHER_KEYS_STATE_2 = 5,
    KITTY_FLAGS = 6,
    MACOS_OPTION_AS_ALT = 7,
    BACKARROW_KEY_MODE = 8
}

/**
 * Key event structure
 */
export declare interface KeyEvent {
    action: KeyAction;
    key: Key;
    mods: Mods;
    consumedMods?: Mods;
    composing?: boolean;
    utf8?: string;
    unshiftedCodepoint?: number;
}

/**
 * Image bytes + metadata returned by GhosttyTerminal.getKittyImageRgba.
 * `data` is a *view* into WASM memory and is invalidated by the next
 * mutating terminal call — copy out before vt_write if you need to retain.
 */
declare interface KittyImagePixels {
    /** Per-image content revision, including retransmission and animation frames. */
    revision?: number;
    width: number;
    height: number;
    format: GhosttyKittyImageFormat;
    /** Borrowed view into WASM memory; copy before vt_write to retain. */
    data: Uint8Array;
}

/**
 * Kitty keyboard protocol flags
 * From include/ghostty/vt/key/encoder.h
 */
declare enum KittyKeyFlags {
    DISABLED = 0,
    DISAMBIGUATE = 1,// Disambiguate escape codes
    REPORT_EVENTS = 2,// Report press and release
    REPORT_ALTERNATES = 4,// Report alternate key codes
    REPORT_ALL = 8,// Report all events
    REPORT_ASSOCIATED = 16,// Report associated text
    ALL = 31
}

/**
 * Parsed GhosttyKittyGraphicsPlacementRenderInfo — everything the renderer
 * needs about a single placement to composite it on the canvas.
 *
 * Wire layout on wasm32 (48 bytes, extern struct, 4-byte aligned):
 *   size:               u32 @ 0   (sized-struct discriminator; we just write 48)
 *   pixel_width:        u32 @ 4
 *   pixel_height:       u32 @ 8
 *   grid_cols:          u32 @ 12
 *   grid_rows:          u32 @ 16
 *   viewport_col:       i32 @ 20
 *   viewport_row:       i32 @ 24
 *   viewport_visible:   bool @ 28 (1 byte + 3 bytes padding to next u32)
 *   source_x:           u32 @ 32
 *   source_y:           u32 @ 36
 *   source_width:       u32 @ 40
 *   source_height:      u32 @ 44
 */
declare interface KittyPlacementInfo {
    imageId: number;
    /** Destination size on the canvas, in pixels. */
    pixelWidth: number;
    pixelHeight: number;
    /** Destination size on the grid, in cells. */
    gridCols: number;
    gridRows: number;
    /** Top-left in viewport-relative cells. Negative when scrolled partway off the top. */
    viewportCol: number;
    viewportRow: number;
    /** Whether any part of the placement intersects the visible viewport. */
    viewportVisible: boolean;
    /** Source rect within the image, in pixels (already clamped to image bounds). */
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
    /**
     * Virtual placements have no fixed viewport position; their image is
     * drawn into U+10EEEE placeholder cells written to the grid by the
     * application. The renderer picks them up by image_id rather than
     * iterating through them for direct compositing.
     */
    isVirtual: boolean;
}

/**
 * What the loaded libghostty-vt knows about how it was built, read from
 * `ghostty_version()` and `ghostty_build_info()`. Constant for the lifetime
 * of the module; include it in bug reports.
 */
export declare interface LibghosttyBuildInfo {
    /** Full version string, e.g. "1.0.0" or "1.1.0-dev+abc1234". */
    version: string;
    major: number;
    minor: number;
    patch: number;
    /** Pre-release label such as "dev"; empty for a release. */
    pre: string;
    /** Build metadata such as a commit hash; empty for a release. */
    build: string;
    /** Zig optimization mode the library was compiled with. */
    optimize: 'debug' | 'release_safe' | 'release_small' | 'release_fast';
    /** Whether SIMD-accelerated code paths are enabled. */
    simd: boolean;
    /** Compile-time features (see upstream's build options). */
    features: {
        kittyGraphics: boolean;
        tmuxControlMode: boolean;
        snapshot: boolean;
        formatter: boolean;
        selection: boolean;
        search: boolean;
        renderState: boolean;
        inputEncode: boolean;
        color: boolean;
        gridIntrospection: boolean;
        glyphProtocol: boolean;
    };
}

/**
 * Manages link detection across multiple providers with intelligent caching
 */
export declare class LinkDetector {
    private terminal;
    private providers;
    private linkCache;
    private scannedRows;
    constructor(terminal: ITerminalForLinkDetector);
    /**
     * Register a link provider
     */
    registerProvider(provider: ILinkProvider): void;
    /**
     * Get link at the specified buffer position
     * @param col Column (0-based)
     * @param row Absolute row in buffer (0-based)
     * @returns Link at position, or undefined if none
     */
    getLinkAt(col: number, row: number): Promise<ILink | undefined>;
    /**
     * Scan a row for links using all registered providers
     */
    private scanRow;
    /**
     * Cache a link for fast lookup
     *
     * Note: We cache by position range, not hyperlink_id, because the WASM
     * returns hyperlink_id as a boolean (0 or 1), not a unique identifier.
     * The actual unique identifier is the URI which is retrieved separately.
     */
    private cacheLink;
    /**
     * Check if a position is within a link's range
     */
    private isPositionInLink;
    /**
     * Invalidate cache when terminal content changes
     * Should be called on terminal write, resize, or clear
     */
    invalidateCache(): void;
    /**
     * Invalidate cache for specific rows
     * Used when only part of the terminal changed
     */
    invalidateRows(startRow: number, endRow: number): void;
    /**
     * Dispose and cleanup
     */
    dispose(): void;
}

export declare interface LinkRange {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

/**
 * Modifier keys
 */
export declare enum Mods {
    NONE = 0,
    SHIFT = 1,
    CTRL = 2,
    ALT = 4,
    SUPER = 8,// Windows/Command key
    CAPSLOCK = 16,
    NUMLOCK = 32
}

/** Mirrors the C enum GhosttyMouseAction (GHOSTTY_MOUSE_ACTION_*), i32. */
export declare enum MouseAction {
    PRESS = 0,
    RELEASE = 1,
    MOTION = 2
}

/** Mirrors the C enum GhosttyMouseButton (GHOSTTY_MOUSE_BUTTON_*), i32. */
export declare enum MouseButton {
    UNKNOWN = 0,
    LEFT = 1,
    RIGHT = 2,
    MIDDLE = 3,
    FOUR = 4,
    FIVE = 5,
    SIX = 6,
    SEVEN = 7,
    EIGHT = 8,
    NINE = 9,
    TEN = 10,
    ELEVEN = 11
}

/**
 * GhosttyTerminal - High-performance terminal emulator
 *
 * Uses Ghostty's native RenderState for optimal performance:
 * - ONE call to update all state (renderStateUpdate)
 * - ONE call to get all cells (getViewport)
 * - No per-row WASM boundary crossings!
 */
/**
 * Binding for libghostty-vt's mouse encoder (ghostty_mouse_encoder_*). It owns
 * one reusable GhosttyMouseEvent. GhosttyTerminal.encodeMouse() keeps the
 * encoder in sync with the terminal; use this directly only for custom input
 * pipelines.
 */
export declare class MouseEncoder {
    private exports;
    private encoder;
    private event;
    /** Output buffer size for encode(); kept once grown. */
    private bufLen;
    constructor(exports: GhosttyWasmExports);
    private newOpaque;
    private setOption;
    /** Deduplicate motion by last reported cell (GHOSTTY_MOUSE_ENCODER_OPT_TRACK_LAST_CELL). */
    setTrackLastCell(enabled: boolean): void;
    /** Whether any button is held, which button-event tracking needs for motion. */
    setAnyButtonPressed(pressed: boolean): void;
    /** Screen and cell geometry in pixels (GhosttyMouseEncoderSize). Cells must be non-zero. */
    setSize(size: {
        screenWidth: number;
        screenHeight: number;
        cellWidth: number;
        cellHeight: number;
        padding?: {
            top?: number;
            bottom?: number;
            left?: number;
            right?: number;
        };
    }): void;
    /** Read tracking mode and output format from the terminal. Also forgets the last reported cell. */
    setFromTerminal(terminal: TerminalHandle): void;
    /** Forget the last reported cell. */
    reset(): void;
    /**
     * Encode one event at a surface-space pixel position. Returns the bytes to
     * send to the PTY; empty when the tracking mode does not report this event.
     */
    encode(action: number, button: number | null, mods: number, x: number, y: number): Uint8Array;
    free(): void;
}

/** A normalized mouse event for GhosttyTerminal.encodeMouse(). */
export declare interface MouseReport {
    action: MouseAction;
    /** Button pressed or released, the button held during drag motion, or null for hover motion. */
    button: MouseButton | null;
    /** GhosttyMods bitmask (`Mods.SHIFT | Mods.ALT | ...`). */
    mods: number;
    /** Zero-based logical cell under the pointer. */
    col: number;
    row: number;
    /** Pointer offset inside the cell in pixels, reported by SGR-pixels (mode 1016). Defaults to the cell centre. */
    xInCell?: number;
    yInCell?: number;
    /** Whether any button is held; button-event tracking (mode 1002) reports motion only then. */
    anyButtonPressed: boolean;
}

/**
 * InputHandler class
 * Attaches keyboard event listeners to a container and converts
 * keyboard events to terminal input data
 */
/**
 * Mouse tracking configuration
 */
declare interface MouseTrackingConfig {
    /** Check if any mouse tracking mode is enabled */
    hasMouseTracking: () => boolean;
    /** Get cell dimensions for pixel to cell conversion */
    getCellDimensions: () => {
        width: number;
        height: number;
    };
    /** Get canvas/container offset for accurate position calculation */
    getCanvasOffset: () => {
        left: number;
        top: number;
    };
    /**
     * Map a visual (screen) column to the logical column on BiDi-reordered
     * rows. Both 0-based. Identity when absent. Mouse reports must carry the
     * LOGICAL column — the app knows nothing about visual reordering, and a
     * raw visual column makes clicks land on the wrong widget with nothing
     * looking wrong on screen.
     */
    visualToLogicalCol?: (col: number, row: number) => number;
}

/**
 * OSC 8 Hyperlink Provider
 *
 * Detects OSC 8 hyperlinks by scanning for hyperlink_id in cells.
 * Automatically handles multi-line links since Ghostty WASM preserves
 * hyperlink_id across wrapped lines.
 */
export declare class OSC8LinkProvider implements ILinkProvider {
    private terminal;
    constructor(terminal: ITerminalForOSC8Provider);
    /**
     * Provide all OSC 8 links on the given row
     * Note: This may return links that span multiple rows
     */
    provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void;
    /**
     * Find the full extent of a link by scanning for contiguous cells
     * with the same hyperlink_id. Handles multi-line links.
     */
    private findLinkRange;
    dispose(): void;
}

/**
 * Parse `?renderer=` from `window.location`, validating against
 * `RendererBackend`. Falls back to `window.__ghosttyDefaultRenderer`, then
 * `window.__boobaDefaultRenderer` (deprecated alias for backwards compat
 * with go-booba's existing servers), then `'auto'`.
 */
export declare function parseRendererFromURL(): RendererBackend;

/** Options for GhosttyTerminal.paste(), mirroring GhosttyPaste. */
export declare interface PasteOptions {
    /** Clipboard the text came from; reported in a Kitty paste event. Default 'standard'. */
    location?: ClipboardLocation;
    /**
     * 'clipboard' (default) becomes a Kitty paste event when the program asked
     * for them; 'text' (IME commit, drag and drop) is always written as text.
     */
    source?: 'clipboard' | 'text';
    /**
     * Write text that could inject commands: a line terminator outside
     * bracketed paste, or the bracketed paste end marker. Default false, which
     * makes such a paste return 'rejected'.
     */
    allowUnsafe?: boolean;
}

/** Outcome of a paste: written to the PTY, nothing to write, or refused as unsafe. */
export declare type PasteResult = 'pasted' | 'empty' | 'rejected';

export declare function pickRenderer(backend: RendererBackend, canvas: HTMLCanvasElement, opts: RendererOptions): Promise<Renderer>;

/** Mirrors the C enum GhosttyPointTag (GHOSTTY_POINT_TAG_*), i32. */
export declare enum PointTag {
    ACTIVE = 0,
    VIEWPORT = 1,
    SCREEN = 2,
    HISTORY = 3
}

export declare interface ProgramStatusReport {
    state: 'idle' | 'working' | 'done' | 'blocked' | 'error' | 'clear';
    kind: 'permission' | 'question' | 'auth' | null;
    /** Percentage (0–100), or null when absent. */
    progress: number | null;
    id: string;
    app: string;
    /** Decoded UTF-8 text; empty when absent. */
    title: string;
    message: string;
}

/** OSC 9;4 (ConEmu) progress report. Mirrors GhosttyTerminalProgressState. */
export declare interface ProgressReport {
    state: 'remove' | 'set' | 'error' | 'indeterminate' | 'pause';
    /** Percentage 0-100 when the report carries one, otherwise null. */
    progress: number | null;
}

/**
 * Pluggable terminal renderer. Implemented by CanvasRenderer and WebGPURenderer.
 */
export declare interface Renderer {
    readonly backend: 'webgpu' | 'webgl' | 'canvas2d';
    readonly canvas: HTMLCanvasElement;
    getMetrics(): FontMetrics;
    resize(cols: number, rows: number): void;
    /**
     * Render one frame. Cheap when nothing has changed (steady-state cost is
     * one walk + one buffer write).
     */
    render(buffer: IRenderable, viewportY?: number, scrollbackProvider?: IScrollbackProvider): void;
    setTheme(theme: ITheme): void;
    setFontSize(size: number): void;
    setFontFamily(family: string): void;
    setCursorStyle(style: 'block' | 'underline' | 'bar'): void;
    setCursorBlink(enabled: boolean): void;
    setOnRequestRender(fn: (() => void) | null): void;
    setSelectionManager(mgr: SelectionManager): void;
    /**
     * Provide the shared BiDi row mapper. Optional: renderers without it
     * paint logical order (pre-BiDi behavior).
     */
    setBidiMapper?(mapper: RowBidiMapper): void;
    setHoveredHyperlinkId(id: number): void;
    setHoveredLinkRange(range: LinkRange | null): void;
    /** Force a full repaint on next render() (e.g. after font change). */
    invalidate(): void;
    /** Best-effort remeasure when the font has loaded after construction. */
    remeasureFont(): void;
    destroy(): void;
}

export declare type RendererBackend = 'webgpu' | 'webgl' | 'canvas2d' | 'auto';

export declare interface RendererHudOptions {
    /** Where to mount the badge. Default: `document.body`. */
    parent?: HTMLElement;
    /** `'fixed'` (viewport, default) or `'absolute'` (relative to parent). */
    position?: 'fixed' | 'absolute';
    /** CSS class applied to the badge for custom styling. */
    className?: string;
    /** Default `true`. When `true`, clicking the badge cycles the renderer. */
    clickToToggle?: boolean;
    /** Default `true`. When `true`, Alt+Shift+R cycles the renderer. */
    bindToggleHotkey?: boolean;
    /** Override the cycle order. Default: `['webgpu', 'webgl', 'canvas2d']`. */
    cycle?: ReadonlyArray<Exclude<RendererBackend, 'auto'>>;
}

export declare interface RendererOptions {
    fontSize?: number;
    fontFamily?: string;
    cursorStyle?: 'block' | 'underline' | 'bar';
    cursorBlink?: boolean;
    theme?: ITheme;
    devicePixelRatio?: number;
}

/** A resolved, viewport-relative rectangle. All geometry is in CSS pixels/cells. */
export declare interface RenderImage {
    imageId: number;
    generation: bigint;
    layer: number;
    z: number;
    viewportCol: number;
    viewportRow: number;
    offsetX: number;
    offsetY: number;
    pixelWidth: number;
    pixelHeight: number;
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
}

/**
 * Colors from RenderState (12 bytes packed)
 */
declare interface RenderStateColors {
    background: RGB;
    foreground: RGB;
    cursor: RGB | null;
}

/**
 * Cursor state from RenderState (8 bytes packed)
 * Layout: x(u16) + y(u16) + viewport_x(i16) + viewport_y(i16) + visible(bool) + blinking(bool) + style(u8) + _pad(u8)
 */
declare interface RenderStateCursor {
    x: number;
    y: number;
    viewportX: number;
    viewportY: number;
    visible: boolean;
    blinking: boolean;
    style: 'block' | 'underline' | 'bar';
}

/** CSI 8 ; rows ; cols t. A zero dimension means "keep the current value". */
export declare interface ResizeRequest {
    rows: number;
    cols: number;
}

/**
 * RGB color
 */
export declare interface RGB {
    r: number;
    g: number;
    b: number;
}

declare interface RowBidiMap {
    /**
     * True when the row needs no bidi work at all: identity permutation and
     * nothing to mirror. Consumers may skip map lookups entirely.
     */
    isIdentity: boolean;
    /** Visual column → logical column. Length === row length. */
    visualToLogical: Uint16Array;
    /** Logical column → visual column. Inverse of visualToLogical. */
    logicalToVisual: Uint16Array;
    /**
     * Logical column → replacement codepoint for UBA rule L4 glyph mirroring
     * (e.g. "(" inside an RTL run paints as ")"). Null when nothing mirrors.
     * Applies to PAINTING only — copy reads the logical cell untouched.
     */
    mirror: Map<number, number> | null;
}

declare class RowBidiMapper {
    private bidi;
    private identityByLen;
    /** FNV-1a-hashed, content-verified LRU. ~512 entries ≈ several screens of
     *  distinct RTL rows; maps are cheap to recompute on miss. */
    private static readonly CACHE_MAX;
    private cache;
    constructor();
    getMap(line: GhosttyCell[]): RowBidiMap;
    private identity;
    private compute;
}

/** Row-local selected range from the render state, inclusive columns. */
export declare interface RowSelection {
    startCol: number;
    endCol: number;
}

export declare class ScrollbarOverlay {
    private canvas;
    private ctx;
    private dpr;
    constructor(canvas: HTMLCanvasElement, devicePixelRatio: number);
    /** CSS dimensions follow the underlying renderer canvas. */
    resize(cssWidth: number, cssHeight: number): void;
    setDevicePixelRatio(dpr: number): void;
    /** Draw the scrollbar. Clears the entire overlay each call. */
    render(input: ScrollbarRenderInput): void;
    /**
     * Test hook: returns what render() *would* draw without touching ctx state.
     * Used by unit tests since happy-dom's mock canvas can't readback fillRect.
     */
    _renderForTest(input: ScrollbarRenderInput): {
        thumb: {
            y: number;
            height: number;
        } | null;
    };
    /** Hit-test helper (Terminal's drag handler uses this). */
    hitTest(cssX: number, cssY: number, scrollbackLength: number): 'thumb' | null;
    destroy(): void;
}

/**
 * Scrollbar overlay drawn on a sibling <canvas> element stacked above the
 * renderer's canvas. Backend-agnostic: the same instance works for both
 * Canvas2D and WebGPU renderers because the scrollbar lives outside the
 * renderer's surface.
 *
 * Thumb size and position match the logic that lived in CanvasRenderer
 * before commit history (see git log lib/renderer-canvas2d.ts — formerly
 * lib/renderer.ts — for renderScrollbar).
 */
declare interface ScrollbarRenderInput {
    viewportY: number;
    scrollbackLength: number;
    visibleRows: number;
    opacity: number;
}

export declare class SearchAddon implements ITerminalAddon {
    private terminal?;
    private search?;
    private canvas?;
    private listeners;
    private sliceTimer?;
    private resultsEmitter;
    private lastResult;
    private matchCache;
    private active;
    private hideActive;
    private decorations;
    /** Fires whenever the match count or the selected match changes. */
    readonly onDidChangeResults: IEvent<ISearchResult>;
    activate(terminal: Terminal): void;
    dispose(): void;
    /** Find the next match toward older content (up). True if a match is selected. */
    findNext(term: string, options?: ISearchOptions): boolean;
    /** Find the previous match toward newer content (down). True if a match is selected. */
    findPrevious(term: string, options?: ISearchOptions): boolean;
    /** Stop searching and remove all highlights. */
    clearDecorations(): void;
    /** Keep the match highlights but stop emphasizing the selected one. */
    clearActiveDecoration(): void;
    /** The selected match as a selection snapshot, or null. */
    get activeMatch(): TerminalSelection | null;
    /** The last reported result. */
    get results(): ISearchResult;
    /** Highlight spans on the current viewport, for custom renderers or tests. */
    highlights(): SearchHighlight[];
    /** Re-read the terminal, update highlights and results. Called on every render. */
    refresh(): void;
    private ensureSearch;
    private find;
    /** Drive the scrollback scan in short slices so the page stays responsive. */
    private scheduleSlices;
    private stopSlices;
    /**
     * Recompute the highlight cache, report results (always after an explicit
     * find, otherwise only when they changed), optionally scroll to the selection.
     */
    private afterChange;
    private emit;
    private scrollIntoView;
    private static same;
    /** Paint the highlights on an overlay canvas stacked above the renderer. */
    private draw;
}

/** One highlighted span on a viewport row. */
export declare interface SearchHighlight {
    row: number;
    startCol: number;
    endCol: number;
    active: boolean;
}

/** Mirrors the C enum GhosttySearchStatus (GHOSTTY_SEARCH_STATUS_*), i32. */
export declare enum SearchStatus {
    RUNNING = 0,
    FEED_REQUIRED = 1,
    COMPLETE = 2
}

/** Mirrors the C enum GhosttySelectionAdjust (GHOSTTY_SELECTION_ADJUST_*), i32. */
export declare enum SelectionAdjust {
    LEFT = 0,
    RIGHT = 1,
    UP = 2,
    DOWN = 3,
    HOME = 4,
    END = 5,
    PAGE_UP = 6,
    PAGE_DOWN = 7,
    BEGINNING_OF_LINE = 8,
    END_OF_LINE = 9
}

/**
 * Which columns SelectionCoordinates name. 'logical' is the terminal's
 * selection; 'visual' is a drag over a BiDi row, in displayed columns.
 */
export declare type SelectionColumnSpace = 'visual' | 'logical';

/** Viewport-space selection bounds for the renderers, inclusive. */
export declare interface SelectionCoordinates {
    startCol: number;
    startRow: number;
    endCol: number;
    endRow: number;
}

/** Mirrors the C enum GhosttySelectionGestureAutoscroll (GHOSTTY_SELECTION_GESTURE_AUTOSCROLL_*), i32. */
export declare enum SelectionGestureAutoscroll {
    NONE = 0,
    UP = 1,
    DOWN = 2
}

/** Mirrors the C enum GhosttySelectionGestureBehavior (GHOSTTY_SELECTION_GESTURE_BEHAVIOR_*), i32. */
export declare enum SelectionGestureBehavior {
    CELL = 0,
    WORD = 1,
    LINE = 2,
    OUTPUT = 3
}

/** Display geometry the selection gesture needs to interpret drags (GhosttySelectionGestureGeometry). */
export declare interface SelectionGestureGeometry {
    columns: number;
    /** Width of one cell in surface pixels; must be non-zero. */
    cellWidth: number;
    paddingLeft?: number;
    /** Height of the rendered surface in pixels; must be non-zero. */
    screenHeight: number;
}

/** What the selection gesture currently knows (GhosttySelectionGestureData). */
export declare interface SelectionGestureState {
    /** 1, 2 or 3 while a click sequence is active, 0 when inactive. */
    clickCount: number;
    /** Whether the current or last left-click gesture dragged. */
    dragged: boolean;
    /** Direction the viewport should autoscroll while dragging past an edge. */
    autoscroll: SelectionGestureAutoscroll;
    /** What the current click count selects: cell, word, line or output. */
    behavior: SelectionGestureBehavior;
}

export declare class SelectionManager {
    private terminal;
    private renderer;
    private wasmTerm;
    private textarea;
    private bidiMapper;
    /**
     * A visual-span selection over BiDi rows, in displayed columns. While set,
     * the terminal's own selection is cleared and this is what is shown and
     * copied. Null means the terminal owns the selection.
     */
    private visual;
    private isSelecting;
    private press;
    private dragSelected;
    private lastPointer;
    /** Viewport rows whose selection highlight changed since the renderer last asked. */
    private dirtySelectionRows;
    private selectionChangedEmitter;
    private boundMouseDownHandler;
    private boundMouseMoveHandler;
    private boundMouseUpHandler;
    private boundContextMenuHandler;
    private boundClickHandler;
    private boundDocumentMouseDownHandler;
    private mouseDownTarget;
    private contextMenuTimeoutId;
    private boundResetTextarea;
    private autoScrollInterval;
    private autoScrollDirection;
    private static readonly AUTO_SCROLL_SPEED;
    private static readonly AUTO_SCROLL_INTERVAL;
    /** Presses closer together than this count as double and triple clicks. */
    private static readonly REPEAT_INTERVAL_NS;
    constructor(terminal: Terminal, renderer: Renderer, wasmTerm: GhosttyTerminal, textarea: HTMLTextAreaElement, bidiMapper: RowBidiMapper);
    private getViewportY;
    private viewportRowToAbsolute;
    private absoluteRowToViewport;
    private getLineAbs;
    private isWrappedAbs;
    private rowIsBidi;
    /** Displayed column to the PTY's logical column, landing on a wide cell's first half. */
    private visualToLogical;
    /** The selected text, as libghostty's formatter produces it for the clipboard. */
    getSelection(): string;
    hasSelection(): boolean;
    /** Copy the selection to the clipboard; true if there was text to copy. */
    copySelection(): boolean;
    /** Clear the selection and mark its rows for repaint. Does not fire onSelectionChange. */
    clearSelection(): void;
    /** Select all content, scrollback included. */
    selectAll(): void;
    /**
     * Select `length` logical cells from (column, row) on the viewport, wrapping
     * onto following rows like xterm.js.
     */
    select(column: number, row: number, length: number): void;
    /** Select whole viewport rows `start` through `end`. */
    selectLines(start: number, end: number): void;
    /**
     * Select the logical range between two absolute cells (scrollback + screen
     * rows, PTY columns), in either direction, and install it in the terminal.
     */
    selectAbsolute(startCol: number, startAbsRow: number, endCol: number, endAbsRow: number): void;
    getSelectionPosition(): {
        start: {
            x: number;
            y: number;
        };
        end: {
            x: number;
            y: number;
        };
    } | undefined;
    deselect(): void;
    focus(): void;
    /**
     * Selection bounds in viewport rows for the renderers, clamped to the
     * visible area; null when nothing selected is visible.
     */
    getSelectionCoords(): SelectionCoordinates | null;
    getSelectionColumnSpace(): SelectionColumnSpace;
    getDirtySelectionRows(): Set<number>;
    clearDirtySelectionRows(): void;
    get onSelectionChange(): IEvent<void>;
    dispose(): void;
    /** Install a logical selection (or clear with null), repaint, and notify. */
    private applySelection;
    /** Ordered absolute bounds of the current selection, or null. */
    private absoluteBounds;
    private static order;
    /**
     * Text of a visual-span selection. Each row's swept displayed columns map
     * to logical cells, possibly several runs; each run is formatted by
     * libghostty and the runs are joined in logical order.
     */
    private visualText;
    private markCurrentSelectionDirty;
    private copyAndNotify;
    /** Integer cell size the gesture geometry uses; renderer metrics may be fractional. */
    private cellPixels;
    /**
     * The cell under a pointer, clamped to the grid. Hit-testing uses the
     * renderer's fractional metrics so wide terminals do not drift; the surface
     * position handed to the gesture is rebuilt inside that cell from the
     * integer geometry, so its within-cell threshold and edge detection agree.
     */
    private pointerToCell;
    private geometry;
    private handleMouseDown;
    private handleMouseMove;
    /** Feed the pointer to the gesture and apply what it selects. */
    private updateDrag;
    private handleMouseUp;
    private setAutoScroll;
    private stopAutoScroll;
    private attachEventListeners;
    /** Copy text to the clipboard (shared browser strategy in clipboard.ts). */
    private copyToClipboard;
}

/** Mirrors the C enum GhosttySelectionOrder (GHOSTTY_SELECTION_ORDER_*), i32. */
export declare enum SelectionOrder {
    FORWARD = 0,
    REVERSE = 1,
    MIRRORED_FORWARD = 2,
    MIRRORED_REVERSE = 3
}

/** OSC 133 shell-integration event. Mirrors GhosttyTerminalSemanticPrompt. */
export declare interface SemanticPromptEvent {
    kind: 'prompt-start' | 'input-start' | 'output-start' | 'command-end';
    promptKind: 'primary' | 'right' | 'continuation' | 'secondary';
    /** Exit code for command-end when the shell reported one. */
    exitCode: number | null;
    /** Decoded command line for output-start when the shell sent one. */
    command: string;
    /** Error description for command-end when the shell sent one. */
    error: string;
}

export declare class Terminal implements ITerminalCore {
    cols: number;
    rows: number;
    element?: HTMLElement;
    textarea?: HTMLTextAreaElement;
    readonly buffer: BufferNamespace;
    readonly unicode: IUnicodeVersionProvider;
    readonly options: Required<ITerminalOptions>;
    private ghostty?;
    wasmTerm?: GhosttyTerminal;
    renderer?: Renderer;
    private previousHoveredHyperlinkId;
    private inputHandler?;
    private selectionManager?;
    private bidiMapper;
    private canvas?;
    private scrollbarCanvas?;
    private scrollbarOverlay?;
    private linkDetector?;
    private currentHoveredLink?;
    private mouseMoveThrottleTimeout?;
    private pendingMouseMove?;
    private writeParsedEmitter;
    /** Output after parsing; byte arrays are copied for observers. */
    readonly onWriteParsed: IEvent<string | Uint8Array<ArrayBufferLike>>;
    private dataEmitter;
    private resizeEmitter;
    private bellEmitter;
    private selectionChangeEmitter;
    private keyEmitter;
    private titleChangeEmitter;
    private scrollEmitter;
    private renderEmitter;
    private cursorMoveEmitter;
    readonly onData: IEvent<string>;
    readonly onResize: IEvent<{
        cols: number;
        rows: number;
    }>;
    readonly onBell: IEvent<void>;
    readonly onSelectionChange: IEvent<void>;
    readonly onKey: IEvent<IKeyEvent>;
    private programStatusEmitter;
    private programStatusListeners;
    /** OSC 7501 reports. Subscribe to enable capability replies; the host owns record lifetimes. */
    readonly onProgramStatus: IEvent<ProgramStatusReport>;
    private syncProgramStatusHandler;
    readonly onTitleChange: IEvent<string>;
    private clipboardWriteEmitter;
    /** OSC 52 / OSC 5522 clipboard writes that were not denied (see options.clipboardWrite). */
    readonly onClipboardWrite: IEvent<ClipboardWriteEvent>;
    private pwdChangeEmitter;
    /** OSC 7 / OSC 9;9 / OSC 1337 working-directory reports; see `pwd`. */
    readonly onPwdChange: IEvent<string>;
    private notificationEmitter;
    /** OSC 9 / OSC 777 desktop notifications. Nothing is shown unless the host acts. */
    readonly onNotification: IEvent<DesktopNotification>;
    private progressEmitter;
    /** OSC 9;4 progress reports. */
    readonly onProgress: IEvent<ProgressReport>;
    private semanticPromptEmitter;
    /** OSC 133 shell-integration prompt and command events. */
    readonly onSemanticPrompt: IEvent<SemanticPromptEvent>;
    private resizeRequestEmitter;
    /** CSI 8 t window resize requests. The terminal is not resized unless the host does so. */
    readonly onResizeRequest: IEvent<ResizeRequest>;
    /** Working directory the shell last reported, raw (a file:// URI for OSC 7). Empty if none. */
    get pwd(): string;
    /** Version of the libghostty-vt this terminal runs on, e.g. "1.0.0". Include it in bug reports. */
    get ghosttyVersion(): string;
    /** Compile-time configuration (version parts, optimize mode, features) of the loaded libghostty-vt. */
    get ghosttyBuildInfo(): LibghosttyBuildInfo;
    private requireGhostty;
    readonly onScroll: IEvent<number>;
    readonly onRender: IEvent<{
        start: number;
        end: number;
    }>;
    readonly onCursorMove: IEvent<void>;
    private isOpen;
    private isOpening;
    private isDisposed;
    private isSwapping;
    private animationFrameId?;
    private syncOutputDeadline?;
    private syncOutputTimer?;
    private writeQueue;
    private awaitingEcho;
    /** Whether mode 1004 was on after the last write; see reportFocusIfEnabled(). */
    private focusEventsOn;
    private addons;
    private customKeyEventHandler?;
    private currentTitle;
    viewportY: number;
    private targetViewportY;
    private scrollAnimationStartTime?;
    private scrollAnimationStartY?;
    private scrollAnimationFrame?;
    private customWheelEventHandler?;
    private lastCursorX;
    private lastCursorY;
    private lastCursorStyle?;
    private altWheelRemainder;
    private readonly handleParentBeforeInput;
    private isDraggingScrollbar;
    private scrollbarDragStart;
    private scrollbarDragStartViewportY;
    private scrollbarVisible;
    private scrollbarOpacity;
    private scrollbarHideTimeout?;
    private readonly SCROLLBAR_HIDE_DELAY_MS;
    private readonly SCROLLBAR_FADE_DURATION_MS;
    constructor(options?: ITerminalOptions);
    /**
     * Handle runtime option changes (called when options are modified after terminal is open)
     * This enables xterm.js compatibility where options can be changed at runtime
     */
    private handleOptionChange;
    /**
     * Handle font changes (fontSize or fontFamily)
     * Updates canvas size to match new font metrics and forces a full re-render
     */
    /** Final CSS cell metrics, including unrounded glyph advance and ink bounds. */
    getFontMetrics(): {
        advanceWidth?: number;
        ascent?: number;
        descent?: number;
        width: number;
        height: number;
        baseline: number;
    } | undefined;
    private dprQuery?;
    private readonly onDprChange;
    private watchDpr;
    private handleFontChange;
    /**
     * Parse a CSS color string to 0xRRGGBB format.
     * Returns undefined if the color is undefined or invalid so pure black (#000000 = 0)
     * is distinguished from "unset".
     */
    private parseColorToHex;
    /**
     * Convert terminal options to WASM terminal config.
     */
    private buildWasmConfig;
    private wireWasmCallbacks;
    /** The scheme reported for CSI ? 996 n: the option, or the theme background's luminance. */
    private resolveColorScheme;
    private onRenderHoldChanged;
    /**
     * Open terminal in a parent element
     *
     * Initializes all components and starts rendering.
     * Requires a pre-loaded Ghostty instance passed to the constructor.
     *
     * Returns a Promise<void> that resolves once the renderer (Canvas2D or
     * WebGPU) is fully wired. `isOpen` is only set to true after the
     * renderer is ready and `_finishOpen()` has run, so callers that hit
     * `assertOpen()` (e.g. via write()) before the await resolves will see
     * a clean "Terminal must be opened" error rather than a renderer NPE.
     *
     * Synchronous validation (already-open / disposed / missing parent) runs
     * before the first await and still throws synchronously.
     */
    open(parent?: HTMLElement): Promise<void>;
    /**
     * Complete terminal initialization after the renderer is ready.
     * Called from open() once `this.renderer` has been resolved.
     */
    private _finishOpen;
    /**
     * Write data to terminal
     */
    write(data: string | Uint8Array, callback?: () => void): void;
    /**
     * Internal write implementation (extracted from write())
     */
    private writeInternal;
    /**
     * Write data with newline
     */
    writeln(data: string | Uint8Array, callback?: () => void): void;
    /**
     * Paste text as if from the clipboard. libghostty-vt frames it for
     * bracketed paste (mode 2004) or sends a Kitty paste event (mode 5522),
     * replaces control bytes and applies the unsafe-paste rule; see the
     * `allowUnsafePaste` option. The result is emitted through onData.
     */
    paste(data: string): void;
    /** Encode a key using current terminal modes and emit it through onData. */
    sendKey(event: KeyEvent): void;
    /**
     * Input data into terminal (as if typed by user)
     *
     * @param data - Data to input
     * @param wasUserInput - If true, triggers onData event (default: false for compat with some apps)
     */
    input(data: string, wasUserInput?: boolean): void;
    /**
     * Resize terminal
     */
    resize(cols: number, rows: number): void;
    /**
     * Clear terminal screen
     */
    clear(): void;
    /**
     * Reset terminal state
     */
    reset(): void;
    /**
     * Focus terminal input
     */
    focus(): void;
    /**
     * Blur terminal (remove focus)
     */
    blur(): void;
    /**
     * Load an addon
     */
    loadAddon(addon: ITerminalAddon): void;
    /**
     * Get the selected text as a string
     */
    getSelection(): string;
    /**
     * Check if there's an active selection
     */
    hasSelection(): boolean;
    /**
     * Clear the current selection
     */
    clearSelection(): void;
    /**
     * Copy the current selection to clipboard
     * @returns true if there was text to copy, false otherwise
     */
    copySelection(): boolean;
    /**
     * Select all text in the terminal
     */
    selectAll(): void;
    /**
     * Select text at specific column and row with length
     */
    select(column: number, row: number, length: number): void;
    /**
     * Select entire lines from start to end
     */
    selectLines(start: number, end: number): void;
    /**
     * Get selection position as buffer range
     */
    /**
     * Get the current viewport Y position.
     *
     * This is the number of lines scrolled back from the bottom of the
     * scrollback buffer. It may be fractional during smooth scrolling.
     */
    getViewportY(): number;
    getSelectionPosition(): IBufferRange | undefined;
    /**
     * Attach a custom keyboard event handler
     * Returns true to prevent default handling
     */
    attachCustomKeyEventHandler(customKeyEventHandler: (event: KeyboardEvent) => boolean): void;
    /**
     * Attach a custom wheel event handler (Phase 2)
     * Returns true to prevent default handling
     */
    attachCustomWheelEventHandler(customWheelEventHandler?: (event: WheelEvent) => boolean): void;
    /**
     * Register a custom link provider
     * Multiple providers can be registered to detect different types of links
     *
     * @example
     * ```typescript
     * term.registerLinkProvider({
     *   provideLinks(y, callback) {
     *     // Detect URLs, file paths, etc.
     *     callback(detectedLinks);
     *   }
     * });
     * ```
     */
    registerLinkProvider(provider: ILinkProvider): void;
    /**
     * Scroll viewport by a number of lines
     * @param amount Number of lines to scroll (positive = down, negative = up)
     */
    scrollLines(amount: number): void;
    /**
     * Scroll viewport by a number of pages
     * @param amount Number of pages to scroll (positive = down, negative = up)
     */
    scrollPages(amount: number): void;
    /**
     * Scroll viewport to the top of the scrollback buffer
     */
    scrollToTop(): void;
    /**
     * Scroll viewport to the bottom (current output)
     */
    scrollToBottom(): void;
    /**
     * Scroll viewport to a specific line in the buffer
     * @param line Line number (0 = top of scrollback, scrollbackLength = bottom)
     */
    scrollToLine(line: number): void;
    /**
     * Smoothly scroll to a target viewport position
     * @param targetY Target viewport Y position (in lines, can be fractional)
     */
    private smoothScrollTo;
    /**
     * Animation loop for smooth scrolling
     * Uses asymptotic approach - moves a fraction of remaining distance each frame
     */
    private animateScroll;
    /**
     * Dispose terminal and clean up resources
     */
    dispose(): void;
    /**
     * Push the renderer's per-cell pixel size into the WASM terminal.
     *
     * Called from setup, open(), and resize() — everywhere the renderer
     * may have rebuilt its FontMetrics. Affects in-band size reports
     * (CSI 14/16/18 t) and kitty graphics placement sizing; without it
     * the terminal returns zeros for those queries.
     *
     * GhosttyTerminal.setCellPixelSize short-circuits when the values
     * haven't changed, so this is cheap to call from any of the above.
     */
    private updateWasmPixelSize;
    /**
     * Cancel the render loop
     */
    private cancelRenderLoop;
    /**
     * Flush any writes that were queued during resize
     */
    private flushWriteQueue;
    /**
     * Schedule a single render on the next animation frame. No-op if one
     * is already pending or the terminal is closed/disposed.
     *
     * Replaces the previous perpetual rAF chain, which kept a CPU core
     * hot at ~60Hz even on a static screen because every frame paid for a
     * render() entry/exit and a getCursor() round-trip into WASM. With
     * this design, the terminal goes idle (zero JS work, zero WASM calls)
     * once the last event-driven render is done, until the next event
     * wakes it via requestRender().
     *
     * Wake points are added on every event source that mutates renderable
     * state: writes from the PTY, scrolls, resizes, mouse motion (link
     * hover), selection changes, the cursor-blink interval (via the
     * renderer's onRequestRender callback), and each smooth-scroll tick.
     *
     * Alternative design we considered: leave the rAF chain in place but
     * have it short-circuit when no work is pending and self-cancel after
     * N idle frames, with the same wake points re-arming it. End-state
     * CPU is identical; the difference is purely code shape (a perpetual
     * loop with self-cancel logic vs. ad-hoc rAF scheduling). We picked
     * this shape for simplicity.
     */
    private requestRender;
    private holdSynchronizedOutput;
    private imageAnimationTimer?;
    private renderFrame;
    private renderTick;
    /**
     * Get a line from native WASM scrollback buffer
     * Implements IScrollbackProvider
     */
    getScrollbackLine(offset: number): GhosttyCell[] | null;
    /**
     * Get scrollback length from native WASM
     * Implements IScrollbackProvider
     */
    getScrollbackLength(): number;
    /**
     * Attach the click-to-focus-textarea listeners on a canvas. Extracted so
     * the renderer-swap path can re-attach them after canvas replacement.
     */
    private attachCanvasFocusListeners;
    /**
     * Detach the old canvas from its parent and put a fresh canvas in its
     * place with the same parent, CSS, and drawing-buffer dimensions. Used
     * by the renderer-swap path because once a `<canvas>` has been used to
     * acquire a context (webgpu / webgl2 / 2d), browsers refuse to give it
     * a different context type — so the cascade fallback needs a fresh
     * canvas to claim.
     */
    private replaceCanvas;
    /**
     * Clean up components (called on dispose or error)
     */
    private cleanupComponents;
    /**
     * Assert terminal is open (throw if not)
     */
    private assertOpen;
    /**
     * Convert a visual (screen-position) column to the logical column within
     * `line`, per BiDi reordering (see lib/bidi.ts). Callers must pass the
     * EXACT line object they already read for this row — never refetch by
     * row index, since scrollback vs. screen indexing differs and a mismatched
     * refetch could compute the map against the wrong row's content.
     */
    private visualColToLogical;
    /**
     * Resolve a viewport row to the exact scrollback or screen line currently
     * displayed there. Mouse reporting must use this rather than getLine(row):
     * when scrolled, viewport rows and screen-buffer rows are different.
     */
    private getViewportLine;
    /**
     * Handle mouse move for link hover detection and scrollbar dragging
     * Throttled to avoid blocking scroll events (except when dragging scrollbar)
     */
    private handleMouseMove;
    /**
     * Process mouse move for link detection (internal, called by throttled handler)
     */
    private processMouseMove;
    /**
     * Handle mouse leave to clear link hover
     */
    /**
     * Report focus changes to the program (CSI I / CSI O) when it asked for
     * them with mode 1004. Focus moving between the terminal element and its
     * own textarea is not a change.
     */
    private reportFocus;
    private sendFocusReport;
    /**
     * When a write turns mode 1004 on, report the current focus state at once,
     * as xterm and Ghostty do, so a program that enables focus reporting while
     * the user is already typing learns it has focus without a blur and refocus.
     * libghostty-vt has no mode-change callback, so the mode is read after each
     * write; its state is tracked to report only the off-to-on transition.
     */
    private reportFocusIfEnabled;
    private handleFocusIn;
    private handleFocusOut;
    private handleMouseLeave;
    /**
     * Handle mouse click for link activation
     */
    private handleClick;
    /**
     * Handle wheel events for scrolling (Phase 2)
     */
    private handleWheel;
    /**
     * Handle mouse down for scrollbar interaction
     */
    private handleMouseDown;
    /**
     * Handle mouse up for scrollbar drag
     */
    private handleMouseUp;
    /**
     * Process scrollbar drag movement
     */
    private processScrollbarDrag;
    /**
     * Show scrollbar with fade-in and schedule auto-hide
     */
    private showScrollbar;
    /**
     * Hide scrollbar with fade-out
     */
    private hideScrollbar;
    /**
     * Fade in scrollbar
     */
    private fadeInScrollbar;
    /**
     * Fade out scrollbar
     */
    private fadeOutScrollbar;
    /**
     * Process any pending terminal responses and emit them via onData.
     *
     * This handles escape sequences that require the terminal to send a response
     * back to the PTY, such as:
     * - DSR 6 (cursor position): Shell sends \x1b[6n, terminal responds with \x1b[row;colR
     * - DSR 5 (operating status): Shell sends \x1b[5n, terminal responds with \x1b[0n
     *
     * Without this, shells like nushell that rely on cursor position queries
     * will hang waiting for a response that never comes.
     *
     * Note: We loop to read all pending responses, not just one. This is important
     * when multiple queries are processed in a single write() call (e.g., when
     * buffered data is written all at once during terminal initialization).
     */
    private processTerminalResponses;
    /**
     * Query terminal mode state
     *
     * @param mode Mode number (e.g., 2004 for bracketed paste)
     * @param isAnsi True for ANSI modes, false for DEC modes (default: false)
     * @returns true if mode is enabled
     */
    getMode(mode: number, isAnsi?: boolean): boolean;
    /**
     * Check if bracketed paste mode is enabled
     */
    hasBracketedPaste(): boolean;
    /**
     * Check if focus event reporting is enabled
     */
    hasFocusEvents(): boolean;
    /**
     * Check if mouse tracking is enabled
     */
    hasMouseTracking(): boolean;
}

/**
 * Opaque terminal pointer (WASM memory address)
 */
export declare type TerminalHandle = number;

/**
 * A search over a terminal's scrollback and both screens (ghostty_search_*).
 * Results stay in sync with live output: feed() reads the terminal, tick()
 * makes bounded progress on copied data, run() does both until caught up.
 * Matches are selections (newest first) with the usual snapshot lifetime.
 * ASCII letters match case-insensitively; everything else is byte-exact.
 *
 * Create one with GhosttyTerminal.createSearch(). The search never scrolls
 * the WASM viewport, since ntwebterm displays its own.
 */
export declare class TerminalSearch {
    private exports;
    private memory;
    private search;
    constructor(exports: GhosttyWasmExports, memory: WebAssembly.Memory, terminal: TerminalHandle);
    private check;
    private withScratch;
    /** Read a 4-byte field; null on GHOSTTY_NO_VALUE. */
    private getU32;
    /**
     * Set what to look for. A new needle restarts the search; the same needle
     * keeps its results; null or '' clears it and the search goes idle.
     */
    setNeedle(needle: string | null): void;
    /** The current needle, or null when idle. */
    get needle(): string | null;
    get status(): SearchStatus;
    /** Matches found so far on the active screen. */
    get totalMatches(): number;
    /** Index of the selected match, 0 being the newest, or null. */
    get selectedIndex(): number | null;
    /** The selected match as a selection snapshot, or null. */
    get selectedMatch(): TerminalSelection | null;
    private readBuffer;
    /** Every match on the active screen, newest (bottom) first through scrollback. */
    matches(): TerminalSelection[];
    /** Matches on the pages covering the WASM viewport, as of the last feed. */
    viewportMatches(): TerminalSelection[];
    /** Make bounded progress on copied data; returns the status afterwards. */
    tick(): SearchStatus;
    /** Read the terminal: pick up changes and give the scrollback scan its next chunk. */
    feed(): void;
    /** Feed and tick until caught up with the terminal. Blocks; fine for bounded scrollback. */
    run(): void;
    /** Select the next match toward older content, wrapping; false when there are none. */
    selectNext(): boolean;
    /** Select the previous match toward newer content, wrapping; false when there are none. */
    selectPrev(): boolean;
    free(): void;
}

/**
 * A range of terminal content between two cells, both included
 * (GhosttySelection). Linear selections flow like text; rectangular ones use
 * start and end as opposite corners. The ends keep the direction the user
 * selected in; use GhosttyTerminal.selectionOrdered() for top-left first.
 * Same lifetime as GridRef unless installed with setSelection().
 */
export declare interface TerminalSelection {
    start: GridRef;
    end: GridRef;
    rectangle: boolean;
}

export declare interface TerminalSnapshot {
    cols: number;
    rows: number;
    screen: 'normal' | 'alternate';
    /** Active screen only, independent of the user's scroll position. */
    lines: string[];
    text: string;
    cursor: {
        x: number;
        y: number;
    };
    pwd: string;
    modes: {
        bracketedPaste: boolean;
        mouseTracking: boolean;
        kittyKeyboardFlags: number;
    };
}

export declare interface TerminalTraceEvent {
    direction: 'input' | 'output';
    timestamp: number;
    data: string | Uint8Array;
}

/**
 * URL Regex Provider
 *
 * Detects plain text URLs on a single line using regex.
 * Does not support multi-line URLs or file paths.
 *
 * Supported protocols:
 * - https://, http://
 * - mailto:
 * - ftp://, ssh://, git://
 * - tel:, magnet:
 * - gemini://, gopher://, news:
 */
export declare class UrlRegexProvider implements ILinkProvider {
    private terminal;
    /**
     * URL regex pattern
     * Matches common protocols followed by valid URL characters
     * Excludes file paths (no ./ or ../ or bare /)
     */
    private static readonly URL_REGEX;
    /**
     * Characters to strip from end of URLs
     * Common punctuation that's unlikely to be part of the URL
     */
    private static readonly TRAILING_PUNCTUATION;
    constructor(terminal: ITerminalForUrlProvider);
    /**
     * Provide all regex-detected URLs on the given row
     */
    provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void;
    /**
     * Convert a buffer line to plain text string
     */
    private lineToText;
    dispose(): void;
}

export declare class WebGPURenderer implements Renderer {
    readonly backend: "webgpu";
    readonly canvas: HTMLCanvasElement;
    private device;
    private context;
    private preferredFormat;
    private theme;
    private fontSize;
    private fontFamily;
    private cursorStyle;
    private dpr;
    private metrics;
    private cols;
    private rows;
    private cursorBlink_;
    private selectionManager?;
    private bidiMapper;
    private hoveredHyperlinkId;
    private hoveredLinkRange;
    private onRequestRender;
    private invalidateNext;
    private destroyed;
    private ownsDevice;
    private deviceLostListeners;
    private cellBuffer?;
    private cellBufferCapacity;
    private paletteUBO?;
    private gridUBO?;
    private cellArray;
    private atlas?;
    private atlasSampler?;
    private textPipeline?;
    private backgroundPipeline?;
    private glyphPipeline?;
    private blockCursorPipeline?;
    private textBindGroupLayout?;
    private cursorPipeline?;
    private cursorBindGroupLayout?;
    private cursorBindGroup?;
    private kittyTextures;
    private kittySampler?;
    private kittyPipeline?;
    private kittyBindGroupLayout?;
    private kittyParamsRing;
    private kittyAtlas?;
    private kittyAtlasUBO?;
    private kittyAtlasRects;
    private lastCursorX;
    private lastCursorY;
    private lastCursorVisible;
    private lastCursorBlinkVisible;
    private lastViewportYRendered;
    private lastSelectionSig;
    private lastKittyPlacementSig;
    private imageFrame?;
    /**
     * Create a WebGPURenderer.
     *
     * @param canvas - the canvas to render into
     * @param device - a GPUDevice the renderer will use
     * @param opts - renderer options
     * @param ownsDevice - if `true`, `destroy()` will call `device.destroy()`
     *   to release the GPU device + all resources tied to it. If `false`
     *   (default), `destroy()` releases only the renderer's own bookkeeping
     *   (kitty caches, etc.) and leaves the device alone for the caller to
     *   manage. The renderer factory (`pickRenderer`) creates the device
     *   internally and passes `true`; external callers sharing a device
     *   across renderers should pass `false` (the default).
     */
    static create(canvas: HTMLCanvasElement, device: GPUDevice, opts: RendererOptions, ownsDevice?: boolean): Promise<WebGPURenderer>;
    private constructor();
    private initialize;
    /** Internal hook used by Terminal's fallback path. */
    onDeviceLost(fn: (info: GPUDeviceLostInfo) => void): void;
    private measureFont;
    private uploadPaletteUBO;
    private uploadGridUBO;
    private rebuildBindGroup;
    private ensureKittyRingSize;
    private encodeCells;
    getMetrics(): FontMetrics;
    resize(cols: number, rows: number): void;
    /**
     * True when no buffer row reports dirty AND no full-redraw is pending.
     * Cheap (one needsFullRedraw call + one isRowDirty per row, both backed
     * by an O(1) cache after the first call per snapshot).
     */
    private bufferAnyDirty;
    private computeSelectionSig;
    /**
     * Fingerprint every visible kitty placement (direct + virtual). Detects
     * placement add/remove/move/resize and per-image bytes-change. Called
     * before encodeCells, which itself walks iterPlacements again — for the
     * common case (0-2 placements) the extra ~30 boundary crossings per
     * frame are negligible compared to the GPU work this gate avoids.
     * Returns null when no placements are visible.
     */
    private computeKittyPlacementSig;
    render(buffer: IRenderable, viewportY?: number, sb?: IScrollbackProvider): void;
    private parseHexColor;
    setTheme(theme: ITheme): void;
    setFontSize(size: number): void;
    setFontFamily(family: string): void;
    setCursorStyle(style: 'block' | 'underline' | 'bar'): void;
    setCursorBlink(enabled: boolean): void;
    setOnRequestRender(fn: (() => void) | null): void;
    setSelectionManager(mgr: SelectionManager): void;
    setBidiMapper(mapper: RowBidiMapper): void;
    setHoveredHyperlinkId(id: number): void;
    setHoveredLinkRange(range: LinkRange | null): void;
    invalidate(): void;
    remeasureFont(): void;
    destroy(): void;
}

/**
 * Browser clipboard helpers shared by selection copy and OSC 52 writes.
 *
 * Strategy (modern APIs first):
 * 1. ClipboardItem API (works in Safari and modern browsers; Safari needs
 *    the item created synchronously within the user gesture)
 * 2. navigator.clipboard.writeText (modern async API)
 * 3. execCommand('copy') through a textarea (legacy fallback)
 */
/**
 * Copy text to the clipboard. `textarea` is used for the execCommand
 * fallback; when omitted a temporary offscreen one is created.
 */
export declare function writeTextToClipboard(text: string, textarea?: HTMLTextAreaElement): void;

export { }

export {};

declare global {
  /** Whole, tightly packed Kitty pixel buffers, consumed by a t=s transmission. */
  var ghosttyKittySharedMemory: Map<string, Uint8Array> | undefined;
}
