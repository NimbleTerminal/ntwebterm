/**
 * TypeScript type definitions for libghostty-vt WASM API
 * Based on include/ghostty/vt/*.h from Ghostty repository
 */

// ============================================================================
// libghostty-vt ABI (generated)
// ============================================================================
// Enum values come from upstream's frozen ABI manifest via
// scripts/gen-ghostty-abi.ts -> lib/ghostty-abi.ts; nothing below is mirrored
// by hand. These are ntwebterm's historical names for the upstream enums; the
// Ghostty* originals and the struct layouts are importable from './ghostty-abi'.
import {
  GhosttyCellData as CellData,
  GhosttyCellWide as CellWide,
  GhosttyCursorStyle as CursorVisualStyle,
  GhosttyRenderStateDirty as DirtyState,
  GhosttyKey as Key,
  GhosttyKeyAction as KeyAction,
  GhosttyKeyEncoderOption as KeyEncoderOption,
  GhosttyKittyGraphicsData as KittyGraphicsData,
  GhosttyKittyGraphicsImageData as KittyGraphicsImageData,
  GhosttyImageLayer as KittyGraphicsImageLayer,
  GhosttyKittyGraphicsPlacementData as KittyGraphicsPlacementData,
  GhosttyKittyGraphicsPlacementIteratorOption as KittyGraphicsPlacementIteratorOption,
  GhosttyKittyImageCompression as KittyImageCompression,
  GhosttyKittyImageFormat as KittyImageFormat,
  GhosttyPointTag as PointTag,
  GhosttyRenderStateData as RenderStateData,
  GhosttyRenderStateOption as RenderStateOption,
  GhosttyRenderStateRowData as RenderStateRowData,
  GhosttyRenderStateRowOption as RenderStateRowOption,
  GhosttyRenderStateRowCellsData as RowCellsData,
  GhosttyRowData as RowData,
  GhosttyStyleFlagsBit as StyleFlag,
  GhosttySysOption as SysOption,
  GhosttyTerminalData as TerminalData,
  GhosttyTerminalOption as TerminalOption,
  GhosttyTerminalScreen as TerminalScreen,
} from './ghostty-abi';

export {
  CellData,
  CellWide,
  CursorVisualStyle,
  DirtyState,
  Key,
  KeyAction,
  KeyEncoderOption,
  KittyGraphicsData,
  KittyGraphicsImageData,
  KittyGraphicsImageLayer,
  KittyGraphicsPlacementData,
  KittyGraphicsPlacementIteratorOption,
  KittyImageCompression,
  KittyImageFormat,
  PointTag,
  RenderStateData,
  RenderStateOption,
  RenderStateRowData,
  RenderStateRowOption,
  RowCellsData,
  RowData,
  StyleFlag,
  SysOption,
  TerminalData,
  TerminalOption,
  TerminalScreen,
};

// ============================================================================
// Key Encoder Types
// ============================================================================

/**
 * Kitty keyboard protocol flags
 * From include/ghostty/vt/key/encoder.h
 */
export enum KittyKeyFlags {
  DISABLED = 0,
  DISAMBIGUATE = 1 << 0, // Disambiguate escape codes
  REPORT_EVENTS = 1 << 1, // Report press and release
  REPORT_ALTERNATES = 1 << 2, // Report alternate key codes
  REPORT_ALL = 1 << 3, // Report all events
  REPORT_ASSOCIATED = 1 << 4, // Report associated text
  ALL = 0x1f, // All flags enabled
}

/**
 * Modifier keys
 */
export enum Mods {
  NONE = 0,
  SHIFT = 1 << 0,
  CTRL = 1 << 1,
  ALT = 1 << 2,
  SUPER = 1 << 3, // Windows/Command key
  CAPSLOCK = 1 << 4,
  NUMLOCK = 1 << 5,
}

/**
 * Key event structure
 */
export interface KeyEvent {
  action: KeyAction;
  key: Key;
  mods: Mods;
  consumedMods?: Mods;
  composing?: boolean;
  utf8?: string;
  unshiftedCodepoint?: number;
}

// ============================================================================
// WASM Exports Interface
// ============================================================================

/**
 * Interface for libghostty-vt WASM exports
 */
export interface GhosttyWasmExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;

  // Memory helpers
  ghostty_wasm_alloc_opaque(): number;
  ghostty_wasm_free_opaque(ptr: number): void;
  ghostty_wasm_alloc(len: number): number;
  ghostty_wasm_free(ptr: number, len: number): void;

  // SGR parser
  ghostty_sgr_new(allocator: number, parserPtrPtr: number): number;
  ghostty_sgr_free(parser: number): void;
  ghostty_sgr_reset(parser: number): void;
  ghostty_sgr_set_params(
    parser: number,
    paramsPtr: number,
    subsPtr: number,
    paramsLen: number
  ): number;
  ghostty_sgr_next(parser: number, attrPtr: number): boolean;
  ghostty_sgr_attribute_tag(attrPtr: number): number;
  /** Returns a pointer to the GhosttySgrAttributeValue union inside `attrPtr`. */
  ghostty_sgr_attribute_value(attrPtr: number): number;

  // Key encoder
  ghostty_key_encoder_new(allocator: number, encoderPtrPtr: number): number;
  ghostty_key_encoder_free(encoder: number): void;
  ghostty_key_encoder_set(encoder: number, option: number, valuePtr: number): number;
  ghostty_key_encoder_set_from_terminal(encoder: number, terminal: TerminalHandle): number;
  ghostty_key_encoder_encode(
    encoder: number,
    eventPtr: number,
    bufPtr: number,
    bufLen: number,
    writtenPtr: number
  ): number;

  // Key event
  ghostty_key_event_new(allocator: number, eventPtrPtr: number): number;
  ghostty_key_event_free(event: number): void;
  ghostty_key_event_set_action(event: number, action: number): void;
  ghostty_key_event_set_key(event: number, key: number): void;
  ghostty_key_event_set_mods(event: number, mods: number): void;
  /** `utf8` is a GhosttyString passed by value: wasm32 passes it as a pointer to { ptr: u32, len: u32 }. */
  ghostty_key_event_set_utf8(event: number, stringPtr: number): number;
  ghostty_key_event_set_unshifted_codepoint(event: number, codepoint: number): void;

  // Terminal lifecycle
  ghostty_terminal_new(
    allocatorPtr: number,
    terminalPtrPtr: number,
    cols: number,
    rows: number
  ): number; // GhosttyResult (0 = success)
  ghostty_terminal_free(terminal: TerminalHandle): void;
  ghostty_terminal_reset(terminal: TerminalHandle): void;
  ghostty_terminal_resize(
    terminal: TerminalHandle,
    cols: number,
    rows: number,
    cellWidthPx: number,
    cellHeightPx: number
  ): number;
  ghostty_terminal_vt_write(terminal: TerminalHandle, dataPtr: number, dataLen: number): void;

  // RenderState API — render state is a separate object created from a terminal.
  // Read fields via the generic _get(state, key, *out) interface keyed by
  // GhosttyRenderStateData; see RenderStateData enum.
  ghostty_render_state_new(allocatorPtr: number, statePtrPtr: number): number;
  ghostty_render_state_free(state: number): void;
  ghostty_render_state_update(state: number, terminal: TerminalHandle): number;
  ghostty_render_state_get(state: number, key: number, outPtr: number): number;
  ghostty_render_state_get_multi(
    state: number,
    count: number,
    keysPtr: number,
    valuesPtr: number,
    outWrittenPtr: number
  ): number;
  ghostty_render_state_set(state: number, option: number, valuePtr: number): number;
  // Row iterator: pre-allocated once, repopulated from the render state via
  // ghostty_render_state_get(state, ROW_ITERATOR, &iter).
  ghostty_render_state_row_iterator_new(allocatorPtr: number, outIterPtrPtr: number): number;
  ghostty_render_state_row_iterator_free(iter: number): void;
  ghostty_render_state_row_iterator_next(iter: number): boolean;
  ghostty_render_state_row_get(iter: number, key: number, outPtr: number): number;
  ghostty_render_state_row_set(iter: number, option: number, valuePtr: number): number;
  // Row cells iterator: per-row, populated from a row via
  // ghostty_render_state_row_get(iter, ROW_DATA_CELLS, &cells).
  ghostty_render_state_row_cells_new(allocatorPtr: number, outCellsPtrPtr: number): number;
  ghostty_render_state_row_cells_free(cells: number): void;
  ghostty_render_state_row_cells_next(cells: number): boolean;
  ghostty_render_state_row_cells_select(cells: number, col: number): number;
  ghostty_render_state_row_cells_get(cells: number, key: number, outPtr: number): number;
  ghostty_render_state_row_cells_get_multi(
    cells: number,
    count: number,
    keysPtr: number,
    valuesPtr: number,
    outWrittenPtr: number
  ): number;
  // Per-cell direct access. GhosttyCell is a u64 — passed as bigint in JS.
  ghostty_cell_get(cell: bigint, key: number, outPtr: number): number;
  // Per-row direct access. GhosttyRow is a u64 — passed as bigint in JS.
  ghostty_row_get(row: bigint, key: number, outPtr: number): number;
  // Grid references: read cells / rows / graphemes / hyperlinks at a
  // specific GhosttyPoint. Useful for off-viewport (scrollback / history)
  // access where the render-state row iterator doesn't reach.
  // Note: refs are invalidated by ANY terminal mutation — read and copy out
  // before the next vt_write.
  ghostty_terminal_grid_ref(terminal: TerminalHandle, pointPtr: number, outRefPtr: number): number;
  ghostty_grid_ref_cell(refPtr: number, outCellPtr: number): number;
  ghostty_grid_ref_row(refPtr: number, outRowPtr: number): number;
  ghostty_grid_ref_graphemes(
    refPtr: number,
    bufPtr: number,
    bufLen: number,
    outLenPtr: number
  ): number;
  ghostty_grid_ref_hyperlink_uri(
    refPtr: number,
    bufPtr: number,
    bufLen: number,
    outLenPtr: number
  ): number;
  ghostty_grid_ref_style(refPtr: number, outStylePtr: number): number;

  ghostty_render_state_image_iterator_new(allocator: number, out: number): number;
  ghostty_render_state_image_iterator_free(iterator: number): void;
  ghostty_render_state_image_iterator_next(iterator: number): boolean;
  ghostty_render_state_image_get_multi(
    iterator: number,
    count: number,
    keys: number,
    values: number,
    written: number
  ): number;
  ghostty_terminal_scroll_viewport(terminal: number, viewport: number): void;
  ghostty_kitty_graphics_animation_tick(graphics: number, now: bigint, next: number): number;

  // Kitty graphics — placement iteration + image lookup. The graphics
  // handle comes from ghostty_terminal_get(terminal, KITTY_GRAPHICS, *out)
  // and is borrowed: invalidated by ANY mutating terminal call.
  ghostty_kitty_graphics_get(graphics: number, key: number, outPtr: number): number;
  ghostty_kitty_graphics_image(graphics: number, imageId: number): number; // returns image handle (0 if missing)
  ghostty_kitty_graphics_image_get(image: number, key: number, outPtr: number): number;
  ghostty_kitty_graphics_image_get_multi(
    image: number,
    count: number,
    keysPtr: number,
    valuesPtr: number,
    outWrittenPtr: number
  ): number;
  ghostty_kitty_graphics_placement_iterator_new(
    allocatorPtr: number,
    outIterPtrPtr: number
  ): number;
  ghostty_kitty_graphics_placement_iterator_free(iter: number): void;
  ghostty_kitty_graphics_placement_iterator_set(
    iter: number,
    option: number,
    valuePtr: number
  ): number;
  ghostty_kitty_graphics_placement_next(iter: number): boolean;
  ghostty_kitty_graphics_placement_get(iter: number, key: number, outPtr: number): number;
  ghostty_kitty_graphics_placement_get_multi(
    iter: number,
    count: number,
    keysPtr: number,
    valuesPtr: number,
    outWrittenPtr: number
  ): number;
  ghostty_kitty_graphics_placement_rect(
    iter: number,
    image: number,
    terminal: TerminalHandle,
    outSelectionPtr: number
  ): number;
  ghostty_kitty_graphics_placement_pixel_size(
    iter: number,
    image: number,
    terminal: TerminalHandle,
    outWidthPtr: number,
    outHeightPtr: number
  ): number;
  ghostty_kitty_graphics_placement_grid_size(
    iter: number,
    image: number,
    terminal: TerminalHandle,
    outColsPtr: number,
    outRowsPtr: number
  ): number;
  ghostty_kitty_graphics_placement_viewport_pos(
    iter: number,
    image: number,
    terminal: TerminalHandle,
    outColPtr: number,
    outRowPtr: number
  ): number;
  ghostty_kitty_graphics_placement_source_rect(
    iter: number,
    image: number,
    outX: number,
    outY: number,
    outW: number,
    outH: number
  ): number;
  // The all-in-one render path: fills a 44-byte PlacementRenderInfo
  // sized struct in a single call. Use this in the hot render loop
  // instead of stringing together pixel_size + grid_size + viewport_pos
  // + source_rect.
  ghostty_kitty_graphics_placement_render_info(
    iter: number,
    image: number,
    terminal: TerminalHandle,
    outInfoPtr: number
  ): number;

  // Generic terminal property API. Mirrors render_state_get/set: a single
  // entry point keyed by GhosttyTerminalData (see TerminalData enum).
  ghostty_terminal_get(terminal: TerminalHandle, key: number, outPtr: number): number;
  ghostty_terminal_get_multi(
    terminal: TerminalHandle,
    count: number,
    keysPtr: number,
    valuesPtr: number,
    outWrittenPtr: number
  ): number;
  ghostty_terminal_set(terminal: TerminalHandle, option: number, valuePtr: number): number;
  // System-wide options (process-global / per-WASM-instance). Used to
  // install the PNG decoder callback for kitty graphics PNG payloads.
  ghostty_sys_set(option: number, valuePtr: number): number;
  // Allocate / free memory through the library's allocator. Used by
  // callbacks (e.g. the PNG decoder) that need to hand WASM-allocated
  // buffers back to the library.
  ghostty_alloc(allocatorPtr: number, len: number): number;
  ghostty_free(allocatorPtr: number, ptr: number, len: number): void;
  // grid_ref / point_from_grid_ref: row/cell-level access. Not yet wired
  // up on the TS side (used to implement isRowWrapped / getHyperlinkUri /
  // scrollback iteration).
  // Response handling moved to a callback model: install via
  // ghostty_terminal_set(GHOSTTY_TERMINAL_OPT_WRITE_PTY, callback). Old
  // has_response / read_response polling API is gone.
}

// ============================================================================
// Terminal Types
// ============================================================================

/**
 * Layer filter mask for KittyGraphicsPlacementIteratorOption.LAYER. Mirrors
 * the GHOSTTY_IMAGE_LAYER_MASK_* macros: one bit per KittyGraphicsImageLayer
 * value. A mask of 0 (ALL) turns the filter off.
 */
export enum KittyGraphicsPlacementLayer {
  ALL = 0,
  /** 1 << KittyGraphicsImageLayer.BELOW_BACKGROUND */
  BELOW_BG = 1 << 0,
  /** 1 << KittyGraphicsImageLayer.BELOW_TEXT */
  BELOW_TEXT = 1 << 1,
  /** 1 << KittyGraphicsImageLayer.ABOVE_TEXT */
  ABOVE_TEXT = 1 << 2,
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
export interface KittyPlacementInfo {
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
 * Image bytes + metadata returned by GhosttyTerminal.getKittyImageRgba.
 * `data` is a *view* into WASM memory and is invalidated by the next
 * mutating terminal call — copy out before vt_write if you need to retain.
 */
export interface KittyImagePixels {
  /** Per-image content revision, including retransmission and animation frames. */
  revision?: number;
  width: number;
  height: number;
  format: KittyImageFormat;
  /** Borrowed view into WASM memory; copy before vt_write to retain. */
  data: Uint8Array;
}

/**
 * Pack a terminal mode number + ANSI flag into the u16 wire format used by
 * GhosttyTerminalModeConfig. Bits 0–14 hold the value (u15), bit 15
 * is set for ANSI modes (cleared for DEC private modes).
 */
export function packMode(mode: number, isAnsi: boolean): number {
  return (mode & 0x7fff) | (isAnsi ? 0x8000 : 0);
}

/**
 * Cursor state from RenderState (8 bytes packed)
 * Layout: x(u16) + y(u16) + viewport_x(i16) + viewport_y(i16) + visible(bool) + blinking(bool) + style(u8) + _pad(u8)
 */
export interface RenderStateCursor {
  x: number;
  y: number;
  viewportX: number; // -1 if not in viewport
  viewportY: number;
  visible: boolean;
  blinking: boolean;
  style: 'block' | 'underline' | 'bar';
}

/**
 * Colors from RenderState (12 bytes packed)
 */
export interface RenderStateColors {
  background: RGB;
  foreground: RGB;
  cursor: RGB | null;
}

/**
 * Terminal configuration applied by the TypeScript bridge
 * All color values use 0xRRGGBB format. A value of 0 means "use default".
 */
export interface GhosttyTerminalConfig {
  scrollbackLimit?: number;
  fgColor?: number;
  bgColor?: number;
  cursorColor?: number;
  palette?: (number | undefined)[];
}

/**
 * Opaque terminal pointer (WASM memory address)
 */
export type TerminalHandle = number;

/**
 * Cell structure matching ghostty_cell_t in C (16 bytes)
 */
export interface GhosttyCell {
  codepoint: number; // u32 (Unicode codepoint - first codepoint of grapheme)
  fg_r: number; // u8 (foreground red, valid only when fgIsDefault is false)
  fg_g: number; // u8 (foreground green)
  fg_b: number; // u8 (foreground blue)
  bg_r: number; // u8 (background red, valid only when bgIsDefault is false)
  bg_g: number; // u8 (background green)
  bg_b: number; // u8 (background blue)
  // Whether the cell has an explicit fg/bg color or should use the
  // terminal's default. Mirrors the GhosttyStyleColor tag (NONE = default).
  // The renderer must consult these instead of treating RGB(0,0,0) as
  // "default" — explicit literal black is a valid color.
  fgIsDefault: boolean;
  bgIsDefault: boolean;
  flags: number; // u8 (style flags bitfield)
  width: number; // u8 (character width: 1=normal, 2=wide, etc.)
  hyperlink_id: number; // u16 (0 = no link, >0 = hyperlink ID in set)
  grapheme_len: number; // u8 (number of extra codepoints beyond first)
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

/**
 * RGB color
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Cell style flags (bitfield)
 */
export enum CellFlags {
  BOLD = 1 << 0,
  ITALIC = 1 << 1,
  UNDERLINE = 1 << 2,
  STRIKETHROUGH = 1 << 3,
  INVERSE = 1 << 4,
  INVISIBLE = 1 << 5,
  BLINK = 1 << 6,
  FAINT = 1 << 7,
}

/**
 * Cursor position and visibility
 */
export interface Cursor {
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Terminal configuration applied by the TypeScript bridge
 */
export interface TerminalConfig {
  scrollback_limit: number; // Number of scrollback lines (default: 10,000)
  fg_color: RGB; // Default foreground color
  bg_color: RGB; // Default background color
}

// ============================================================================
// Link Detection System
// ============================================================================

/**
 * Represents a coordinate in the terminal buffer
 */
export interface IBufferCellPosition {
  x: number; // Column (0-based)
  y: number; // Row (0-based, absolute buffer position)
}

/**
 * Represents a range in the terminal buffer
 * Can span multiple lines for wrapped links
 */
export interface IBufferRange {
  start: IBufferCellPosition;
  end: IBufferCellPosition; // Inclusive
}

/**
 * Represents a detected link in the terminal
 */
export interface ILink {
  /** The URL or text of the link */
  text: string;

  /** The range of the link in the buffer (may span multiple lines) */
  range: IBufferRange;

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
export interface ILinkProvider {
  /**
   * Provide links for a given row
   * @param y Absolute row in buffer (0-based)
   * @param callback Called with detected links (or undefined if none)
   */
  provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void;

  /** Optional: called when terminal is disposed */
  dispose?(): void;
}

/**
 * Simplified buffer line interface for link providers
 */
export interface IBufferLine {
  /** Number of cells in this line */
  length: number;

  /** Get cell at position */
  getCell(x: number): IBufferCell;

  /** Get text content of the line */
  translateToString(trimRight?: boolean, startColumn?: number, endColumn?: number): string;
}

/**
 * Simplified buffer cell interface for link providers
 */
export interface IBufferCell {
  /** Get the character codepoint */
  getCodepoint(): number;

  /** Get the hyperlink ID (0 = no link) */
  getHyperlinkId(): number;

  /** Get the width of the character (1 or 2 for wide chars) */
  getWidth(): number;

  /** Check if cell has specific flags */
  isBold(): boolean;
  isItalic(): boolean;
  isDim(): boolean;
}

/**
 * Simplified terminal buffer interface for link providers
 */
export interface IBuffer {
  /** Number of rows in the buffer (viewport + scrollback) */
  length: number;

  /** Get line at absolute buffer position */
  getLine(y: number): IBufferLine;
}

/**
 * Terminal buffer manager (active vs alternate screen)
 */
export interface IBufferManager {
  /** Currently active buffer */
  active: IBuffer;

  /** Normal screen buffer */
  normal: IBuffer;

  /** Alternate screen buffer (for fullscreen apps) */
  alternate: IBuffer;
}

/**
 * Event system interface (xterm.js compatible)
 */
export type IEvent<T> = (listener: (data: T) => void) => IDisposable;

export interface IDisposable {
  dispose(): void;
}

/**
 * Event emitter for custom events
 */
export class EventEmitter<T> {
  private listeners: Array<(data: T) => void> = [];

  /** Subscribe to events */
  public readonly event: IEvent<T> = (listener: (data: T) => void): IDisposable => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
          this.listeners.splice(index, 1);
        }
      },
    };
  };

  /** Emit an event to all listeners */
  public fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  /** Remove all listeners */
  public dispose(): void {
    this.listeners = [];
  }
}

/**
 * Terminal mode identifiers
 *
 * ANSI modes (use with is_ansi = true):
 * - INSERT = 4
 *
 * DEC modes (use with is_ansi = false):
 * - CURSOR_VISIBLE = 25
 * - MOUSE_TRACKING_NORMAL = 1000
 * - MOUSE_TRACKING_BUTTON = 1002
 * - MOUSE_TRACKING_ANY = 1003
 * - FOCUS_EVENTS = 1004
 * - ALT_SCREEN = 1047
 * - ALT_SCREEN_WITH_CURSOR = 1049
 * - BRACKETED_PASTE = 2004
 */
export enum TerminalMode {
  // ANSI modes
  INSERT = 4,

  // DEC modes
  CURSOR_VISIBLE = 25,
  MOUSE_TRACKING_NORMAL = 1000,
  MOUSE_TRACKING_BUTTON = 1002,
  MOUSE_TRACKING_ANY = 1003,
  FOCUS_EVENTS = 1004,
  ALT_SCREEN = 1047,
  ALT_SCREEN_WITH_CURSOR = 1049,
  BRACKETED_PASTE = 2004,
}

/** OSC 7501 report. Each report replaces the record for its id.
 * `clear` removes that id and descendants; an empty id clears all records.
 * Embedders own record lifetimes, including cleanup when the process exits.
 */
/** Clipboard a program addressed. Mirrors GhosttyClipboardLocation. */
export type ClipboardLocation = 'standard' | 'selection' | 'primary';

/** One MIME representation of a clipboard value. `data` is a copy. */
export interface ClipboardContent {
  mime: string;
  data: Uint8Array;
}

/** An OSC 52 / OSC 5522 clipboard write a program requested. */
export interface ClipboardWriteEvent {
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
export type ClipboardWriteResult = 'success' | 'denied' | 'unsupported';

/** An OSC 52 "?" / OSC 5522 clipboard read a program requested. */
export interface ClipboardReadRequest {
  location: ClipboardLocation;
  /** MIME types wanted, in preference order. OSC 52 asks for "text/plain". */
  mimes: string[];
  /** True if the program also wants the list of available MIME types. */
  list: boolean;
  program: string;
  granted: boolean;
}

/**
 * Answers a clipboard read synchronously. Return the text to hand to the
 * program, or null to deny. The VT stream is paused until this returns.
 */
export type ClipboardReadHandler = (request: ClipboardReadRequest) => string | null;

/** OSC 9 / OSC 777 desktop notification. OSC 9 has no title. */
export interface DesktopNotification {
  title: string;
  body: string;
}

/** OSC 9;4 (ConEmu) progress report. Mirrors GhosttyTerminalProgressState. */
export interface ProgressReport {
  state: 'remove' | 'set' | 'error' | 'indeterminate' | 'pause';
  /** Percentage 0-100 when the report carries one, otherwise null. */
  progress: number | null;
}

/** OSC 133 shell-integration event. Mirrors GhosttyTerminalSemanticPrompt. */
export interface SemanticPromptEvent {
  kind: 'prompt-start' | 'input-start' | 'output-start' | 'command-end';
  promptKind: 'primary' | 'right' | 'continuation' | 'secondary';
  /** Exit code for command-end when the shell reported one. */
  exitCode: number | null;
  /** Decoded command line for output-start when the shell sent one. */
  command: string;
  /** Error description for command-end when the shell sent one. */
  error: string;
}

/** CSI 8 ; rows ; cols t. A zero dimension means "keep the current value". */
export interface ResizeRequest {
  rows: number;
  cols: number;
}

/** Answer to a CSI ? 996 n color scheme query. Mirrors GhosttyColorScheme. */
export type ColorScheme = 'light' | 'dark';

export interface ProgramStatusReport {
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
