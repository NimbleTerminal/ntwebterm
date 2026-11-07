// GENERATED FILE - DO NOT EDIT.
// Source: ghostty/src/terminal/c/abi/wasm32-freestanding.json (libghostty-vt frozen C ABI, schema 1)
//         plus patches/ghostty-wasm-api.abi.json (additions from patches/ghostty-wasm-api.patch).
// Regenerate with `bun run gen:abi` (scripts/gen-ghostty-abi.ts); lib/ghostty-abi.test.ts
// fails when this file, the pinned submodule, or the built WASM disagree.

/** Target description from the manifest. */
export const GHOSTTY_ABI = {
  schema: 1,
  target: 'wasm32',
  os: 'freestanding',
  pointerSize: 4,
} as const;

// ---- Enums ----

/** Mirrors the C enum GhosttyBuildInfo (GHOSTTY_BUILD_INFO_*), i32. */
export enum GhosttyBuildInfo {
  INVALID = 0,
  SIMD = 1,
  KITTY_GRAPHICS = 2,
  TMUX_CONTROL_MODE = 3,
  OPTIMIZE = 4,
  VERSION_STRING = 5,
  VERSION_MAJOR = 6,
  VERSION_MINOR = 7,
  VERSION_PATCH = 8,
  VERSION_PRE = 9,
  VERSION_BUILD = 10,
  FEATURE_SNAPSHOT = 11,
  FEATURE_FORMATTER = 12,
  FEATURE_SELECTION = 13,
  FEATURE_SEARCH = 14,
  FEATURE_RENDER_STATE = 15,
  FEATURE_INPUT_ENCODE = 16,
  FEATURE_COLOR = 17,
  FEATURE_GRID_INTROSPECTION = 18,
  FEATURE_GLYPH_PROTOCOL = 19,
}

/** Mirrors the C enum GhosttyCellContentTag (GHOSTTY_CELL_CONTENT_*), i32. */
export enum GhosttyCellContentTag {
  CODEPOINT = 0,
  CODEPOINT_GRAPHEME = 1,
  BG_COLOR_PALETTE = 2,
  BG_COLOR_RGB = 3,
}

/** Mirrors the C enum GhosttyCellData (GHOSTTY_CELL_DATA_*), i32. */
export enum GhosttyCellData {
  INVALID = 0,
  CODEPOINT = 1,
  CONTENT_TAG = 2,
  WIDE = 3,
  HAS_TEXT = 4,
  HAS_STYLING = 5,
  STYLE_ID = 6,
  HAS_HYPERLINK = 7,
  PROTECTED = 8,
  SEMANTIC_CONTENT = 9,
  COLOR_PALETTE = 10,
  COLOR_RGB = 11,
}

/** Mirrors the C enum GhosttyCellSemanticContent (GHOSTTY_CELL_SEMANTIC_*), i32. */
export enum GhosttyCellSemanticContent {
  OUTPUT = 0,
  INPUT = 1,
  PROMPT = 2,
}

/** Mirrors the C enum GhosttyCellWide (GHOSTTY_CELL_WIDE_*), i32. */
export enum GhosttyCellWide {
  NARROW = 0,
  WIDE = 1,
  SPACER_TAIL = 2,
  SPACER_HEAD = 3,
}

/** Mirrors the C enum GhosttyClipboardLocation (GHOSTTY_CLIPBOARD_LOCATION_*), i32. */
export enum GhosttyClipboardLocation {
  STANDARD = 0,
  SELECTION = 1,
  PRIMARY = 2,
}

/** Mirrors the C enum GhosttyClipboardReadResult (GHOSTTY_CLIPBOARD_READ_RESULT_*), i32. */
export enum GhosttyClipboardReadResult {
  SUCCESS = 0,
  DENIED = 1,
  UNSUPPORTED = 2,
  BUSY = 3,
  IO_ERROR = 4,
}

/** Mirrors the C enum GhosttyClipboardWriteResult (GHOSTTY_CLIPBOARD_WRITE_RESULT_*), i32. */
export enum GhosttyClipboardWriteResult {
  SUCCESS = 0,
  DENIED = 1,
  UNSUPPORTED = 2,
  BUSY = 3,
  INVALID_DATA = 4,
  IO_ERROR = 5,
}

/** Mirrors the C enum GhosttyColorScheme (GHOSTTY_COLOR_SCHEME_*), i32. */
export enum GhosttyColorScheme {
  LIGHT = 0,
  DARK = 1,
}

/** Mirrors the C enum GhosttyCursorStyle (GHOSTTY_CURSOR_STYLE_*), i32. */
export enum GhosttyCursorStyle {
  BAR = 0,
  BLOCK = 1,
  UNDERLINE = 2,
  BLOCK_HOLLOW = 3,
}

/** Mirrors the C enum GhosttyFocusEvent (GHOSTTY_FOCUS_*), i32. */
export enum GhosttyFocusEvent {
  GAINED = 0,
  LOST = 1,
}

/** Mirrors the C enum GhosttyFormatterFormat (GHOSTTY_FORMATTER_FORMAT_*), i32. */
export enum GhosttyFormatterFormat {
  PLAIN = 0,
  VT = 1,
  HTML = 2,
}

/** Mirrors the C enum GhosttyFormatterOption (GHOSTTY_FORMATTER_OPT_*), i32. */
export enum GhosttyFormatterOption {
  INVALID = 0,
  EMIT = 1,
  UNWRAP = 2,
  TRIM = 3,
  SELECTION = 4,
  EXTRAS = 5,
}

/** Mirrors the C enum GhosttyImageLayer (GHOSTTY_IMAGE_LAYER_*), i32. */
export enum GhosttyImageLayer {
  BELOW_BACKGROUND = 0,
  BELOW_TEXT = 1,
  ABOVE_TEXT = 2,
}

/** Mirrors the C enum GhosttyImageProtocol (GHOSTTY_IMAGE_PROTOCOL_*), i32. */
export enum GhosttyImageProtocol {
  KITTY = 0,
}

/** Mirrors the C enum GhosttyKey (GHOSTTY_KEY_*), i32. */
export enum GhosttyKey {
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
  PASTE = 175,
}

/** Mirrors the C enum GhosttyKeyAction (GHOSTTY_KEY_ACTION_*), i32. */
export enum GhosttyKeyAction {
  RELEASE = 0,
  PRESS = 1,
  REPEAT = 2,
}

/** Mirrors the C enum GhosttyKeyEncoderOption (GHOSTTY_KEY_ENCODER_OPT_*), i32. */
export enum GhosttyKeyEncoderOption {
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
  BACKARROW_KEY_MODE = 8,
}

/** Mirrors the C enum GhosttyKittyGraphicsData (GHOSTTY_KITTY_GRAPHICS_DATA_*), i32. */
export enum GhosttyKittyGraphicsData {
  INVALID = 0,
  PLACEMENT_ITERATOR = 1,
  GENERATION = 2,
}

/** Mirrors the C enum GhosttyKittyGraphicsImageData (GHOSTTY_KITTY_GRAPHICS_IMAGE_DATA_*), i32. */
export enum GhosttyKittyGraphicsImageData {
  INVALID = 0,
  ID = 1,
  NUMBER = 2,
  WIDTH = 3,
  HEIGHT = 4,
  FORMAT = 5,
  COMPRESSION = 6,
  PIXELS = 7,
  EXPECTED_LEN = 8,
  GENERATION = 9,
}

/** Mirrors the C enum GhosttyKittyGraphicsPlacementData (GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_*), i32. */
export enum GhosttyKittyGraphicsPlacementData {
  INVALID = 0,
  IMAGE_ID = 1,
  PLACEMENT_ID = 2,
  IS_VIRTUAL = 3,
  X_OFFSET = 4,
  Y_OFFSET = 5,
  SOURCE_X = 6,
  SOURCE_Y = 7,
  SOURCE_WIDTH = 8,
  SOURCE_HEIGHT = 9,
  COLUMNS = 10,
  ROWS = 11,
  Z = 12,
}

/** Mirrors the C enum GhosttyKittyGraphicsPlacementIteratorOption (GHOSTTY_KITTY_GRAPHICS_PLACEMENT_ITERATOR_OPT_*), i32. */
export enum GhosttyKittyGraphicsPlacementIteratorOption {
  INVALID = 0,
  LAYER = 1,
}

/** Mirrors the C enum GhosttyKittyImageCompression (GHOSTTY_KITTY_IMAGE_COMPRESSION_*), i32. */
export enum GhosttyKittyImageCompression {
  NONE = 0,
  ZLIB_DEFLATE = 1,
}

/** Mirrors the C enum GhosttyKittyImageFormat (GHOSTTY_KITTY_IMAGE_FORMAT_*), i32. */
export enum GhosttyKittyImageFormat {
  RGB = 0,
  RGBA = 1,
  PNG = 2,
  GRAY_ALPHA = 3,
  GRAY = 4,
}

/** Mirrors the C enum GhosttyModeReportState (GHOSTTY_MODE_REPORT_*), i32. */
export enum GhosttyModeReportState {
  NOT_RECOGNIZED = 0,
  SET = 1,
  RESET = 2,
  PERMANENTLY_SET = 3,
  PERMANENTLY_RESET = 4,
}

/** Mirrors the C enum GhosttyMouseAction (GHOSTTY_MOUSE_ACTION_*), i32. */
export enum GhosttyMouseAction {
  PRESS = 0,
  RELEASE = 1,
  MOTION = 2,
}

/** Mirrors the C enum GhosttyMouseButton (GHOSTTY_MOUSE_BUTTON_*), i32. */
export enum GhosttyMouseButton {
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
  ELEVEN = 11,
}

/** Mirrors the C enum GhosttyMouseEncoderOption (GHOSTTY_MOUSE_ENCODER_OPT_*), i32. */
export enum GhosttyMouseEncoderOption {
  INVALID = 0,
  EVENT = 1,
  FORMAT = 2,
  SIZE = 3,
  ANY_BUTTON_PRESSED = 4,
  TRACK_LAST_CELL = 5,
}

/** Mirrors the C enum GhosttyMouseFormat (GHOSTTY_MOUSE_FORMAT_*), i32. */
export enum GhosttyMouseFormat {
  X10 = 0,
  UTF8 = 1,
  SGR = 2,
  URXVT = 3,
  SGR_PIXELS = 4,
}

/** Mirrors the C enum GhosttyMouseShape (GHOSTTY_MOUSE_SHAPE_*), i32. */
export enum GhosttyMouseShape {
  DEFAULT = 0,
  CONTEXT_MENU = 1,
  HELP = 2,
  POINTER = 3,
  PROGRESS = 4,
  WAIT = 5,
  CELL = 6,
  CROSSHAIR = 7,
  TEXT = 8,
  VERTICAL_TEXT = 9,
  ALIAS = 10,
  COPY = 11,
  MOVE = 12,
  NO_DROP = 13,
  NOT_ALLOWED = 14,
  GRAB = 15,
  GRABBING = 16,
  ALL_SCROLL = 17,
  COL_RESIZE = 18,
  ROW_RESIZE = 19,
  N_RESIZE = 20,
  E_RESIZE = 21,
  S_RESIZE = 22,
  W_RESIZE = 23,
  NE_RESIZE = 24,
  NW_RESIZE = 25,
  SE_RESIZE = 26,
  SW_RESIZE = 27,
  EW_RESIZE = 28,
  NS_RESIZE = 29,
  NESW_RESIZE = 30,
  NWSE_RESIZE = 31,
  ZOOM_IN = 32,
  ZOOM_OUT = 33,
}

/** Mirrors the C enum GhosttyMouseTrackingMode (GHOSTTY_MOUSE_TRACKING_*), i32. */
export enum GhosttyMouseTrackingMode {
  NONE = 0,
  X10 = 1,
  NORMAL = 2,
  BUTTON = 3,
  ANY = 4,
}

/** Mirrors the C enum GhosttyOptimizeMode (GHOSTTY_OPTIMIZE_*), i32. */
export enum GhosttyOptimizeMode {
  DEBUG = 0,
  RELEASE_SAFE = 1,
  RELEASE_SMALL = 2,
  RELEASE_FAST = 3,
}

/** Mirrors the C enum GhosttyOptionAsAlt (GHOSTTY_OPTION_AS_ALT_*), i32. */
export enum GhosttyOptionAsAlt {
  FALSE = 0,
  TRUE = 1,
  LEFT = 2,
  RIGHT = 3,
}

/** Mirrors the C enum GhosttyOscCommandData (GHOSTTY_OSC_DATA_*), i32. */
export enum GhosttyOscCommandData {
  INVALID = 0,
  CHANGE_WINDOW_TITLE_STR = 1,
  UNKNOWN_CONTENT = 2,
  UNKNOWN_TRUNCATED = 3,
  UNKNOWN_TERMINATOR = 4,
}

/** Mirrors the C enum GhosttyOscCommandType (GHOSTTY_OSC_COMMAND_*), i32. */
export enum GhosttyOscCommandType {
  INVALID = 0,
  CHANGE_WINDOW_TITLE = 1,
  CHANGE_WINDOW_ICON = 2,
  SEMANTIC_PROMPT = 3,
  CLIPBOARD_CONTENTS = 4,
  REPORT_PWD = 5,
  MOUSE_SHAPE = 6,
  COLOR_OPERATION = 7,
  KITTY_COLOR_PROTOCOL = 8,
  SHOW_DESKTOP_NOTIFICATION = 9,
  HYPERLINK_START = 10,
  HYPERLINK_END = 11,
  CONEMU_SLEEP = 12,
  CONEMU_SHOW_MESSAGE_BOX = 13,
  CONEMU_CHANGE_TAB_TITLE = 14,
  CONEMU_PROGRESS_REPORT = 15,
  CONEMU_WAIT_INPUT = 16,
  CONEMU_GUIMACRO = 17,
  CONEMU_RUN_PROCESS = 18,
  CONEMU_OUTPUT_ENVIRONMENT_VARIABLE = 19,
  CONEMU_XTERM_EMULATION = 20,
  CONEMU_COMMENT = 21,
  KITTY_TEXT_SIZING = 22,
  KITTY_CLIPBOARD_PROTOCOL = 23,
  KITTY_DND_PROTOCOL = 24,
  HIERARCHICAL_CONTEXT = 25,
  KITTY_DESKTOP_NOTIFICATION = 26,
  UNKNOWN = 27,
  PROGRAM_STATUS = 28,
}

/** Mirrors the C enum GhosttyOscOption (GHOSTTY_OSC_OPT_*), i32. */
export enum GhosttyOscOption {
  INVALID = 0,
  UNKNOWN_MAX_BYTES = 1,
}

/** Mirrors the C enum GhosttyOscTerminator (GHOSTTY_OSC_TERMINATOR_*), i32. */
export enum GhosttyOscTerminator {
  ST = 0,
  BEL = 1,
}

/** Mirrors the C enum GhosttyPasteSource (GHOSTTY_PASTE_SOURCE_*), i32. */
export enum GhosttyPasteSource {
  CLIPBOARD = 0,
  TEXT = 1,
}

/** Mirrors the C enum GhosttyPointTag (GHOSTTY_POINT_TAG_*), i32. */
export enum GhosttyPointTag {
  ACTIVE = 0,
  VIEWPORT = 1,
  SCREEN = 2,
  HISTORY = 3,
}

/** Mirrors the C enum GhosttyProgramStatusKind (GHOSTTY_PROGRAM_STATUS_KIND_*), i32. */
export enum GhosttyProgramStatusKind {
  NONE = 0,
  PERMISSION = 1,
  QUESTION = 2,
  AUTH = 3,
}

/** Mirrors the C enum GhosttyProgramStatusState (GHOSTTY_PROGRAM_STATUS_STATE_*), i32. */
export enum GhosttyProgramStatusState {
  IDLE = 0,
  WORKING = 1,
  DONE = 2,
  BLOCKED = 3,
  ERROR = 4,
  CLEAR = 5,
}

/** Mirrors the C enum GhosttyRenderStateData (GHOSTTY_RENDER_STATE_DATA_*), i32. */
export enum GhosttyRenderStateData {
  INVALID = 0,
  COLS = 1,
  ROWS = 2,
  DIRTY = 3,
  ROW_ITERATOR = 4,
  COLOR_BACKGROUND = 5,
  COLOR_FOREGROUND = 6,
  COLOR_CURSOR = 7,
  COLOR_CURSOR_HAS_VALUE = 8,
  COLOR_PALETTE = 9,
  CURSOR_VISUAL_STYLE = 10,
  CURSOR_VISIBLE = 11,
  CURSOR_BLINKING = 12,
  CURSOR_PASSWORD_INPUT = 13,
  CURSOR_VIEWPORT_HAS_VALUE = 14,
  CURSOR_VIEWPORT_X = 15,
  CURSOR_VIEWPORT_Y = 16,
  CURSOR_VIEWPORT_WIDE_TAIL = 17,
  CURSOR = 18,
  COLORS = 19,
  OVERSCAN = 20,
  OVERSCAN_REQUEST = 21,
  IMAGE_ITERATOR = 22,
  IMAGE_PLACEMENTS_GENERATION = 23,
}

/** Mirrors the C enum GhosttyRenderStateDirty (GHOSTTY_RENDER_STATE_DIRTY_*), i32. */
export enum GhosttyRenderStateDirty {
  /** @deprecated ntwebterm alias for {@link GhosttyRenderStateDirty.FALSE}. */
  NONE = 0,
  FALSE = 0,
  PARTIAL = 1,
  FULL = 2,
}

/** Mirrors the C enum GhosttyRenderStateImageData (GHOSTTY_RENDER_STATE_IMAGE_DATA_*), i32. */
export enum GhosttyRenderStateImageData {
  INVALID = 0,
  PROTOCOL = 1,
  IMAGE_ID = 2,
  IMAGE_GENERATION = 3,
  LAYER = 4,
  Z = 5,
  VIEWPORT_COL = 6,
  VIEWPORT_ROW = 7,
  GRID_COLS = 8,
  GRID_ROWS = 9,
  CELL_OFFSET_X = 10,
  CELL_OFFSET_Y = 11,
  PIXEL_WIDTH = 12,
  PIXEL_HEIGHT = 13,
  SOURCE_X = 14,
  SOURCE_Y = 15,
  SOURCE_WIDTH = 16,
  SOURCE_HEIGHT = 17,
  KITTY_PLACEMENT_ID = 18,
  KITTY_KIND = 19,
}

/** Mirrors the C enum GhosttyRenderStateKittyPlacementKind (GHOSTTY_RENDER_STATE_KITTY_PLACEMENT_KIND_*), i32. */
export enum GhosttyRenderStateKittyPlacementKind {
  VIRTUAL = 0,
  RELATIVE = 1,
  FIXED = 2,
}

/** Mirrors the C enum GhosttyRenderStateOption (GHOSTTY_RENDER_STATE_OPT_*), i32. */
export enum GhosttyRenderStateOption {
  INVALID = 0,
  DIRTY = 1,
  OVERSCAN = 2,
}

/** Mirrors the C enum GhosttyRenderStateRowCellsData (GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_*), i32. */
export enum GhosttyRenderStateRowCellsData {
  INVALID = 0,
  RAW = 1,
  STYLE = 2,
  GRAPHEMES_LEN = 3,
  GRAPHEMES_BUF = 4,
  BG_COLOR = 5,
  FG_COLOR = 6,
  SELECTED = 7,
  HAS_STYLING = 8,
  GRAPHEMES_UTF8 = 9,
}

/** Mirrors the C enum GhosttyRenderStateRowData (GHOSTTY_RENDER_STATE_ROW_DATA_*), i32. */
export enum GhosttyRenderStateRowData {
  INVALID = 0,
  DIRTY = 1,
  RAW = 2,
  CELLS = 3,
  SELECTION = 4,
  CELLS_RAW = 5,
  VIEWPORT_Y = 6,
  ID = 7,
}

/** Mirrors the C enum GhosttyRenderStateRowOption (GHOSTTY_RENDER_STATE_ROW_OPT_*), i32. */
export enum GhosttyRenderStateRowOption {
  INVALID = 0,
  DIRTY = 1,
}

/** Mirrors the C enum GhosttyResult (GHOSTTY_*), i32. */
export enum GhosttyResult {
  UNSUPPORTED = -8,
  REJECTED = -7,
  LIMIT_EXCEEDED = -6,
  IO_ERROR = -5,
  NO_VALUE = -4,
  OUT_OF_SPACE = -3,
  INVALID_VALUE = -2,
  OUT_OF_MEMORY = -1,
  SUCCESS = 0,
}

/** Mirrors the C enum GhosttyRowData (GHOSTTY_ROW_DATA_*), i32. */
export enum GhosttyRowData {
  INVALID = 0,
  WRAP = 1,
  WRAP_CONTINUATION = 2,
  GRAPHEME = 3,
  STYLED = 4,
  HYPERLINK = 5,
  SEMANTIC_PROMPT = 6,
  KITTY_VIRTUAL_PLACEHOLDER = 7,
  DIRTY = 8,
}

/** Mirrors the C enum GhosttyRowSemanticPrompt (GHOSTTY_ROW_SEMANTIC_*), i32. */
export enum GhosttyRowSemanticPrompt {
  NONE = 0,
  PROMPT = 1,
  PROMPT_CONTINUATION = 2,
}

/** Mirrors the C enum GhosttySearchData (GHOSTTY_SEARCH_DATA_*), i32. */
export enum GhosttySearchData {
  INVALID = 0,
  STATUS = 1,
  NEEDLE = 2,
  TOTAL_MATCHES = 3,
  SELECTED_INDEX = 4,
  SELECTED_MATCH = 5,
  MATCHES = 6,
  VIEWPORT_MATCHES = 7,
  SELECT_SCROLL = 8,
}

/** Mirrors the C enum GhosttySearchOption (GHOSTTY_SEARCH_OPT_*), i32. */
export enum GhosttySearchOption {
  INVALID = 0,
  NEEDLE = 1,
  SELECT_SCROLL = 4,
}

/** Mirrors the C enum GhosttySearchScroll (GHOSTTY_SEARCH_SCROLL_*), i32. */
export enum GhosttySearchScroll {
  IF_NEEDED = 0,
  NONE = 1,
}

/** Mirrors the C enum GhosttySearchStatus (GHOSTTY_SEARCH_STATUS_*), i32. */
export enum GhosttySearchStatus {
  RUNNING = 0,
  FEED_REQUIRED = 1,
  COMPLETE = 2,
}

/** Mirrors the C enum GhosttySelectionAdjust (GHOSTTY_SELECTION_ADJUST_*), i32. */
export enum GhosttySelectionAdjust {
  LEFT = 0,
  RIGHT = 1,
  UP = 2,
  DOWN = 3,
  HOME = 4,
  END = 5,
  PAGE_UP = 6,
  PAGE_DOWN = 7,
  BEGINNING_OF_LINE = 8,
  END_OF_LINE = 9,
}

/** Mirrors the C enum GhosttySelectionGestureAutoscroll (GHOSTTY_SELECTION_GESTURE_AUTOSCROLL_*), i32. */
export enum GhosttySelectionGestureAutoscroll {
  NONE = 0,
  UP = 1,
  DOWN = 2,
}

/** Mirrors the C enum GhosttySelectionGestureBehavior (GHOSTTY_SELECTION_GESTURE_BEHAVIOR_*), i32. */
export enum GhosttySelectionGestureBehavior {
  CELL = 0,
  WORD = 1,
  LINE = 2,
  OUTPUT = 3,
}

/** Mirrors the C enum GhosttySelectionGestureData (GHOSTTY_SELECTION_GESTURE_DATA_*), i32. */
export enum GhosttySelectionGestureData {
  INVALID = 0,
  CLICK_COUNT = 1,
  DRAGGED = 2,
  AUTOSCROLL = 3,
  BEHAVIOR = 4,
  ANCHOR = 5,
}

/** Mirrors the C enum GhosttySelectionGestureEventOption (GHOSTTY_SELECTION_GESTURE_EVENT_OPT_*), i32. */
export enum GhosttySelectionGestureEventOption {
  INVALID = 0,
  REF = 1,
  POSITION = 2,
  REPEAT_DISTANCE = 3,
  TIME_NS = 4,
  REPEAT_INTERVAL_NS = 5,
  WORD_BOUNDARY_CODEPOINTS = 6,
  BEHAVIORS = 7,
  RECTANGLE = 8,
  GEOMETRY = 9,
  VIEWPORT = 10,
}

/** Mirrors the C enum GhosttySelectionGestureEventType (GHOSTTY_SELECTION_GESTURE_EVENT_TYPE_*), i32. */
export enum GhosttySelectionGestureEventType {
  PRESS = 0,
  RELEASE = 1,
  DRAG = 2,
  AUTOSCROLL_TICK = 3,
  DEEP_PRESS = 4,
}

/** Mirrors the C enum GhosttySelectionOrder (GHOSTTY_SELECTION_ORDER_*), i32. */
export enum GhosttySelectionOrder {
  FORWARD = 0,
  REVERSE = 1,
  MIRRORED_FORWARD = 2,
  MIRRORED_REVERSE = 3,
}

/** Mirrors the C enum GhosttySemanticPromptKind (GHOSTTY_SEMANTIC_PROMPT_*), i32. */
export enum GhosttySemanticPromptKind {
  INVALID = 0,
  PROMPT_START = 1,
  INPUT_START = 2,
  OUTPUT_START = 3,
  COMMAND_END = 4,
}

/** Mirrors the C enum GhosttySemanticPromptPromptKind (GHOSTTY_SEMANTIC_PROMPT_PROMPT_*), i32. */
export enum GhosttySemanticPromptPromptKind {
  PRIMARY = 0,
  RIGHT = 1,
  CONTINUATION = 2,
  SECONDARY = 3,
}

/** Mirrors the C enum GhosttySgrAttributeTag (GHOSTTY_SGR_ATTR_*), i32. */
export enum GhosttySgrAttributeTag {
  UNSET = 0,
  UNKNOWN = 1,
  BOLD = 2,
  RESET_BOLD = 3,
  ITALIC = 4,
  RESET_ITALIC = 5,
  FAINT = 6,
  UNDERLINE = 7,
  UNDERLINE_COLOR = 8,
  UNDERLINE_COLOR_256 = 9,
  RESET_UNDERLINE_COLOR = 10,
  OVERLINE = 11,
  RESET_OVERLINE = 12,
  BLINK = 13,
  RESET_BLINK = 14,
  INVERSE = 15,
  RESET_INVERSE = 16,
  INVISIBLE = 17,
  RESET_INVISIBLE = 18,
  STRIKETHROUGH = 19,
  RESET_STRIKETHROUGH = 20,
  DIRECT_COLOR_FG = 21,
  DIRECT_COLOR_BG = 22,
  BG_8 = 23,
  FG_8 = 24,
  RESET_FG = 25,
  RESET_BG = 26,
  BRIGHT_BG_8 = 27,
  BRIGHT_FG_8 = 28,
  BG_256 = 29,
  FG_256 = 30,
}

/** Mirrors the C enum GhosttySgrUnderline (GHOSTTY_SGR_UNDERLINE_*), i32. */
export enum GhosttySgrUnderline {
  NONE = 0,
  SINGLE = 1,
  DOUBLE = 2,
  CURLY = 3,
  DOTTED = 4,
  DASHED = 5,
}

/** Mirrors the C enum GhosttySizeReportStyle (GHOSTTY_SIZE_REPORT_*), i32. */
export enum GhosttySizeReportStyle {
  MODE_2048 = 0,
  CSI_14_T = 1,
  CSI_16_T = 2,
  CSI_18_T = 3,
  CSI_19_T = 4,
}

/** Mirrors the C enum GhosttySnapshotDecoderData (GHOSTTY_SNAPSHOT_DECODER_DATA_*), i32. */
export enum GhosttySnapshotDecoderData {
  INVALID = 0,
  MAX_CONTINUATION_BYTES = 1,
  SOURCE_OFFSET = 2,
  HISTORY_ROWS_PRIMARY = 3,
  HISTORY_ROWS_ALTERNATE = 4,
  PROGRESS_SCREEN = 5,
  PROGRESS_ROWS = 6,
  PROGRESS_REMAINING = 7,
  RETAIN_CONTINUATION = 8,
  COMPRESS_HISTORY = 9,
  KITTY_IMAGE_STORAGE_LIMIT = 10,
  PROGRESS_KIND = 11,
  PROGRESS_IMAGE_ID = 12,
  PROGRESS_IMAGE_FRAME = 13,
  PROGRESS_IMAGE_BYTES = 14,
  KITTY_IMAGES_PRIMARY = 15,
  KITTY_IMAGES_ALTERNATE = 16,
  KITTY_PENDING_BYTES_PRIMARY = 17,
  KITTY_PENDING_BYTES_ALTERNATE = 18,
}

/** Mirrors the C enum GhosttySnapshotDecoderOption (GHOSTTY_SNAPSHOT_DECODER_OPT_*), i32. */
export enum GhosttySnapshotDecoderOption {
  INVALID = 0,
  MAX_CONTINUATION_BYTES = 1,
  RETAIN_CONTINUATION = 2,
  COMPRESS_HISTORY = 3,
  KITTY_IMAGE_STORAGE_LIMIT = 4,
}

/** Mirrors the C enum GhosttySnapshotDecoderProgressKind (GHOSTTY_SNAPSHOT_DECODER_PROGRESS_KIND_*), i32. */
export enum GhosttySnapshotDecoderProgressKind {
  PAGE = 0,
  IMAGE = 1,
}

/** Mirrors the C enum GhosttyStyleColorTag (GHOSTTY_STYLE_COLOR_*), i32. */
export enum GhosttyStyleColorTag {
  NONE = 0,
  PALETTE = 1,
  RGB = 2,
}

/** Mirrors the C enum GhosttySysLogLevel (GHOSTTY_SYS_LOG_LEVEL_*), i32. */
export enum GhosttySysLogLevel {
  ERROR = 0,
  WARNING = 1,
  INFO = 2,
  DEBUG = 3,
}

/** Mirrors the C enum GhosttySysOption (GHOSTTY_SYS_OPT_*), i32. */
export enum GhosttySysOption {
  INVALID = 0,
  USERDATA = 1,
  DECODE_PNG = 2,
  LOG = 3,
  RANDOM_SECURE = 4,
  READ_SHARED_MEMORY = 5,
}

/** Mirrors the C enum GhosttyTerminalBoundary (GHOSTTY_TERMINAL_BOUNDARY_*), i32. */
export enum GhosttyTerminalBoundary {
  GROUND = 1,
  APC_START = 2,
  APC_END = 4,
  DCS_START = 8,
  DCS_END = 16,
  OSC_START = 32,
  OSC_END = 64,
}

/** Mirrors the C enum GhosttyTerminalCompressionMode (GHOSTTY_TERMINAL_COMPRESSION_MODE_*), i32. */
export enum GhosttyTerminalCompressionMode {
  INCREMENTAL = 0,
  FULL = 1,
}

/** Mirrors the C enum GhosttyTerminalCompressionResult (GHOSTTY_TERMINAL_COMPRESSION_RESULT_*), i32. */
export enum GhosttyTerminalCompressionResult {
  UNSUPPORTED = 0,
  PENDING = 1,
  COMPLETE = 2,
}

/** Mirrors the C enum GhosttyTerminalData (GHOSTTY_TERMINAL_DATA_*), i32. */
export enum GhosttyTerminalData {
  INVALID = 0,
  COLS = 1,
  ROWS = 2,
  CURSOR_X = 3,
  CURSOR_Y = 4,
  CURSOR_PENDING_WRAP = 5,
  ACTIVE_SCREEN = 6,
  CURSOR_VISIBLE = 7,
  KITTY_KEYBOARD_FLAGS = 8,
  SCROLLBAR = 9,
  CURSOR_SGR_STYLE = 10,
  MOUSE_TRACKING = 11,
  TITLE = 12,
  PWD = 13,
  TOTAL_ROWS = 14,
  SCROLLBACK_ROWS = 15,
  WIDTH_PX = 16,
  HEIGHT_PX = 17,
  COLOR_FOREGROUND = 18,
  COLOR_BACKGROUND = 19,
  COLOR_CURSOR = 20,
  COLOR_PALETTE = 21,
  COLOR_FOREGROUND_DEFAULT = 22,
  COLOR_BACKGROUND_DEFAULT = 23,
  COLOR_CURSOR_DEFAULT = 24,
  COLOR_PALETTE_DEFAULT = 25,
  KITTY_IMAGE_STORAGE_LIMIT = 26,
  KITTY_IMAGE_MEDIUM_FILE = 27,
  KITTY_IMAGE_MEDIUM_TEMP_FILE = 28,
  KITTY_IMAGE_MEDIUM_SHARED_MEM = 29,
  KITTY_GRAPHICS = 30,
  SELECTION = 31,
  VIEWPORT_ACTIVE = 32,
  VT_PROCESSING_ERROR = 33,
  SCROLLBACK_MAX_BYTES = 34,
  SCROLLBACK_MAX_LINES = 35,
  CONTINUATION_MAX_BYTES = 36,
  MODE = 37,
  VT_GROUND = 38,
  CURSOR_AT_PROMPT = 39,
  CLIPBOARD_WRITE_MAX_BYTES = 40,
  MOUSE_SHAPE = 41,
  MEMORY_USAGE = 42,
}

/** Mirrors the C enum GhosttyTerminalOption (GHOSTTY_TERMINAL_OPT_*), i32. */
export enum GhosttyTerminalOption {
  INVALID = 0,
  USERDATA = 1,
  WRITE_PTY = 2,
  BELL = 3,
  ENQUIRY = 4,
  XTVERSION = 5,
  TITLE_CHANGED = 6,
  SIZE = 7,
  COLOR_SCHEME = 8,
  DEVICE_ATTRIBUTES = 9,
  TITLE = 10,
  PWD = 11,
  COLOR_FOREGROUND = 12,
  COLOR_BACKGROUND = 13,
  COLOR_CURSOR = 14,
  COLOR_PALETTE = 15,
  KITTY_IMAGE_STORAGE_LIMIT = 16,
  KITTY_IMAGE_MEDIUM_FILE = 17,
  KITTY_IMAGE_MEDIUM_TEMP_FILE = 18,
  KITTY_IMAGE_MEDIUM_SHARED_MEM = 19,
  APC_MAX_BYTES = 20,
  APC_MAX_BYTES_KITTY = 21,
  SELECTION = 22,
  DEFAULT_CURSOR_STYLE = 23,
  DEFAULT_CURSOR_BLINK = 24,
  GLYPH_PROTOCOL = 25,
  PWD_CHANGED = 26,
  CLIPBOARD_WRITE = 27,
  SCROLLBACK_MAX_BYTES = 28,
  SCROLLBACK_MAX_LINES = 29,
  DESKTOP_NOTIFICATION = 30,
  PROGRESS_REPORT = 31,
  CONTINUATION_MAX_BYTES = 32,
  TITLE_REPORT = 33,
  MODE_DEFAULT = 34,
  MODE = 35,
  UNKNOWN_SEQUENCE = 36,
  UNKNOWN_MAX_BYTES = 37,
  TERMINFO_NAME = 38,
  CLIPBOARD_READ = 39,
  CLIPBOARD_WRITE_MAX_BYTES = 40,
  RESIZE_PULL_SCROLLBACK = 41,
  RENDER_HOLD = 42,
  SEMANTIC_PROMPT = 43,
  RESET = 44,
  XT_CHECKSUM_REPORT = 45,
  XT_CHECKSUM_EXTENSION = 46,
  PROGRAM_STATUS = 47,
  RESIZE_WINDOW = 48,
}

/** Mirrors the C enum GhosttyTerminalProgressState (GHOSTTY_TERMINAL_PROGRESS_STATE_*), i32. */
export enum GhosttyTerminalProgressState {
  REMOVE = 0,
  SET = 1,
  ERROR = 2,
  INDETERMINATE = 3,
  PAUSE = 4,
}

/** Mirrors the C enum GhosttyTerminalResizeWindowTag (GHOSTTY_TERMINAL_RESIZE_WINDOW_*), i32. */
export enum GhosttyTerminalResizeWindowTag {
  GRID = 0,
}

/** Mirrors the C enum GhosttyTerminalScreen (GHOSTTY_TERMINAL_SCREEN_*), i32. */
export enum GhosttyTerminalScreen {
  PRIMARY = 0,
  ALTERNATE = 1,
}

/** Mirrors the C enum GhosttyTerminalScrollViewportTag (GHOSTTY_TERMINAL_SCROLL_VIEWPORT_*), i32. */
export enum GhosttyTerminalScrollViewportTag {
  TOP = 0,
  BOTTOM = 1,
  DELTA = 2,
  ROW = 3,
  DELTA_PROMPT = 4,
}

/** Mirrors the C enum GhosttyTerminalStringEnd (GHOSTTY_TERMINAL_STRING_END_*), i32. */
export enum GhosttyTerminalStringEnd {
  ST_ESC = 0,
  ST_C1 = 1,
  CANCELLED = 2,
  ABORTED = 3,
  BEL = 4,
}

/** Mirrors the C enum GhosttyTerminalStringIntroducer (GHOSTTY_TERMINAL_STRING_INTRODUCER_*), i32. */
export enum GhosttyTerminalStringIntroducer {
  ESC = 0,
  C1 = 1,
}

/** Mirrors the C enum GhosttyTerminalStringKind (GHOSTTY_TERMINAL_STRING_KIND_*), i32. */
export enum GhosttyTerminalStringKind {
  APC = 0,
  DCS = 1,
  OSC = 2,
}

/** Mirrors the C enum GhosttyTerminalUnknownSequenceTag (GHOSTTY_TERMINAL_UNKNOWN_SEQUENCE_*), i32. */
export enum GhosttyTerminalUnknownSequenceTag {
  APC = 0,
  OSC = 1,
}

// ---- Packed bit fields ----

/** Bit fields of the packed C type GhosttyStyleFlags (u16). */
export enum GhosttyStyleFlagsBit {
  /** Bit 0. */
  BOLD = 1 << 0,
  /** Bit 1. */
  ITALIC = 1 << 1,
  /** Bit 2. */
  FAINT = 1 << 2,
  /** Bit 3. */
  BLINK = 1 << 3,
  /** Bit 4. */
  INVERSE = 1 << 4,
  /** Bit 5. */
  INVISIBLE = 1 << 5,
  /** Bit 6. */
  STRIKETHROUGH = 1 << 6,
  /** Bit 7. */
  OVERLINE = 1 << 7,
  /** Bits 8..10 (GhosttySgrUnderline). */
  UNDERLINE_SHIFT = 8,
  UNDERLINE_MASK = 0x7 << 8,
}

// ---- Struct and union layouts ----

/** Layout of the C struct GhosttyAllocator on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyAllocatorLayout = {
  size: 8,
  align: 4,
  offset: { ctx: 0, vtable: 4 },
  fieldSize: { ctx: 4, vtable: 4 },
} as const;

/** Layout of the C struct GhosttyAllocatorVtable on wasm32: 32 bytes, 4-byte aligned. */
export const GhosttyAllocatorVtableLayout = {
  size: 32,
  align: 4,
  offset: { alloc: 0, resize: 4, remap: 8, free: 12, reserved: 16 },
  fieldSize: { alloc: 4, resize: 4, remap: 4, free: 4, reserved: 16 },
} as const;

/** Layout of the C struct GhosttyBuffer on wasm32: 12 bytes, 4-byte aligned. */
export const GhosttyBufferLayout = {
  size: 12,
  align: 4,
  offset: { ptr: 0, cap: 4, len: 8 },
  fieldSize: { ptr: 4, cap: 4, len: 4 },
} as const;

/** Layout of the C struct GhosttyCellsView on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyCellsViewLayout = {
  size: 8,
  align: 4,
  offset: { ptr: 0, len: 4 },
  fieldSize: { ptr: 4, len: 4 },
} as const;

/** Layout of the C struct GhosttyClipboardContent on wasm32: 16 bytes, 4-byte aligned. */
export const GhosttyClipboardContentLayout = {
  size: 16,
  align: 4,
  offset: { mime: 0, data: 8 },
  fieldSize: { mime: 8, data: 8 },
} as const;

/** Layout of the C struct GhosttyClipboardRead on wasm32: 36 bytes, 4-byte aligned. */
export const GhosttyClipboardReadLayout = {
  size: 36,
  align: 4,
  offset: {
    location: 0,
    mimes: 4,
    mimes_len: 8,
    list: 12,
    name: 16,
    granted: 24,
    can_remember: 25,
    ctx: 28,
    reply: 32,
  },
  fieldSize: {
    location: 4,
    mimes: 4,
    mimes_len: 4,
    list: 1,
    name: 8,
    granted: 1,
    can_remember: 1,
    ctx: 4,
    reply: 4,
  },
} as const;

/** Layout of the C struct GhosttyClipboardReadReply on wasm32: 28 bytes, 4-byte aligned. */
export const GhosttyClipboardReadReplyLayout = {
  size: 28,
  align: 4,
  offset: {
    size: 0,
    result: 4,
    contents: 8,
    contents_len: 12,
    available: 16,
    available_len: 20,
    remember: 24,
  },
  fieldSize: {
    size: 4,
    result: 4,
    contents: 4,
    contents_len: 4,
    available: 4,
    available_len: 4,
    remember: 1,
  },
} as const;

/** Layout of the C struct GhosttyClipboardWrite on wasm32: 32 bytes, 4-byte aligned. */
export const GhosttyClipboardWriteLayout = {
  size: 32,
  align: 4,
  offset: {
    location: 0,
    contents: 4,
    contents_len: 8,
    name: 12,
    granted: 20,
    can_remember: 21,
    ctx: 24,
    reply: 28,
  },
  fieldSize: {
    location: 4,
    contents: 4,
    contents_len: 4,
    name: 8,
    granted: 1,
    can_remember: 1,
    ctx: 4,
    reply: 4,
  },
} as const;

/** Layout of the C struct GhosttyClipboardWriteReply on wasm32: 12 bytes, 4-byte aligned. */
export const GhosttyClipboardWriteReplyLayout = {
  size: 12,
  align: 4,
  offset: { size: 0, result: 4, remember: 8 },
  fieldSize: { size: 4, result: 4, remember: 1 },
} as const;

/** Layout of the C struct GhosttyCodepointBuffer on wasm32: 12 bytes, 4-byte aligned. */
export const GhosttyCodepointBufferLayout = {
  size: 12,
  align: 4,
  offset: { ptr: 0, cap: 4, len: 8 },
  fieldSize: { ptr: 4, cap: 4, len: 4 },
} as const;

/** Layout of the C struct GhosttyCodepoints on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyCodepointsLayout = {
  size: 8,
  align: 4,
  offset: { ptr: 0, len: 4 },
  fieldSize: { ptr: 4, len: 4 },
} as const;

/** Layout of the C struct GhosttyColorPaletteMask on wasm32: 32 bytes, 8-byte aligned. */
export const GhosttyColorPaletteMaskLayout = {
  size: 32,
  align: 8,
  offset: { bits: 0 },
  fieldSize: { bits: 32 },
} as const;

/** Layout of the C struct GhosttyColorRgb on wasm32: 3 bytes, 1-byte aligned. */
export const GhosttyColorRgbLayout = {
  size: 3,
  align: 1,
  offset: { r: 0, g: 1, b: 2 },
  fieldSize: { r: 1, g: 1, b: 1 },
} as const;

/** Layout of the C struct GhosttyColorX11Entry on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyColorX11EntryLayout = {
  size: 8,
  align: 4,
  offset: { name: 0, color: 4 },
  fieldSize: { name: 4, color: 3 },
} as const;

/** Layout of the C struct GhosttyDeviceAttributes on wasm32: 148 bytes, 4-byte aligned. */
export const GhosttyDeviceAttributesLayout = {
  size: 148,
  align: 4,
  offset: { primary: 0, secondary: 136, tertiary: 144 },
  fieldSize: { primary: 136, secondary: 6, tertiary: 4 },
} as const;

/** Layout of the C struct GhosttyDeviceAttributesPrimary on wasm32: 136 bytes, 4-byte aligned. */
export const GhosttyDeviceAttributesPrimaryLayout = {
  size: 136,
  align: 4,
  offset: { conformance_level: 0, features: 2, num_features: 132 },
  fieldSize: { conformance_level: 2, features: 128, num_features: 4 },
} as const;

/** Layout of the C struct GhosttyDeviceAttributesSecondary on wasm32: 6 bytes, 2-byte aligned. */
export const GhosttyDeviceAttributesSecondaryLayout = {
  size: 6,
  align: 2,
  offset: { device_type: 0, firmware_version: 2, rom_cartridge: 4 },
  fieldSize: { device_type: 2, firmware_version: 2, rom_cartridge: 2 },
} as const;

/** Layout of the C struct GhosttyDeviceAttributesTertiary on wasm32: 4 bytes, 4-byte aligned. */
export const GhosttyDeviceAttributesTertiaryLayout = {
  size: 4,
  align: 4,
  offset: { unit_id: 0 },
  fieldSize: { unit_id: 4 },
} as const;

/** Layout of the C struct GhosttyGridRef on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyGridRefLayout = {
  size: 8,
  align: 4,
  offset: { node: 0, x: 4, y: 6 },
  fieldSize: { node: 4, x: 2, y: 2 },
} as const;

/** Layout of the C struct GhosttyKittyGraphicsPlacementRenderInfo on wasm32: 48 bytes, 4-byte aligned. */
export const GhosttyKittyGraphicsPlacementRenderInfoLayout = {
  size: 48,
  align: 4,
  offset: {
    size: 0,
    pixel_width: 4,
    pixel_height: 8,
    grid_cols: 12,
    grid_rows: 16,
    viewport_col: 20,
    viewport_row: 24,
    viewport_visible: 28,
    source_x: 32,
    source_y: 36,
    source_width: 40,
    source_height: 44,
  },
  fieldSize: {
    size: 4,
    pixel_width: 4,
    pixel_height: 4,
    grid_cols: 4,
    grid_rows: 4,
    viewport_col: 4,
    viewport_row: 4,
    viewport_visible: 1,
    source_x: 4,
    source_y: 4,
    source_width: 4,
    source_height: 4,
  },
} as const;

/** Layout of the C struct GhosttyMimeReader on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyMimeReaderLayout = {
  size: 8,
  align: 4,
  offset: { read: 0, userdata: 4 },
  fieldSize: { read: 4, userdata: 4 },
} as const;

/** Layout of the C struct GhosttyMouseEncoderSize on wasm32: 36 bytes, 4-byte aligned. */
export const GhosttyMouseEncoderSizeLayout = {
  size: 36,
  align: 4,
  offset: {
    size: 0,
    screen_width: 4,
    screen_height: 8,
    cell_width: 12,
    cell_height: 16,
    padding_top: 20,
    padding_bottom: 24,
    padding_right: 28,
    padding_left: 32,
  },
  fieldSize: {
    size: 4,
    screen_width: 4,
    screen_height: 4,
    cell_width: 4,
    cell_height: 4,
    padding_top: 4,
    padding_bottom: 4,
    padding_right: 4,
    padding_left: 4,
  },
} as const;

/** Layout of the C struct GhosttyMousePosition on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyMousePositionLayout = {
  size: 8,
  align: 4,
  offset: { x: 0, y: 4 },
  fieldSize: { x: 4, y: 4 },
} as const;

/** Layout of the C struct GhosttyPaste on wasm32: 32 bytes, 4-byte aligned. */
export const GhosttyPasteLayout = {
  size: 32,
  align: 4,
  offset: {
    size: 0,
    location: 4,
    source: 8,
    mimes: 12,
    mimes_len: 16,
    reader: 20,
    allow_unsafe: 28,
  },
  fieldSize: {
    size: 4,
    location: 4,
    source: 4,
    mimes: 4,
    mimes_len: 4,
    reader: 8,
    allow_unsafe: 1,
  },
} as const;

/** Layout of the C struct GhosttyPoint on wasm32: 24 bytes, 8-byte aligned. */
export const GhosttyPointLayout = {
  size: 24,
  align: 8,
  offset: { tag: 0, value: 8 },
  fieldSize: { tag: 4, value: 16 },
} as const;

/** Layout of the C struct GhosttyPointCoordinate on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyPointCoordinateLayout = {
  size: 8,
  align: 4,
  offset: { x: 0, y: 4 },
  fieldSize: { x: 2, y: 4 },
} as const;

/** Layout of the C union GhosttyPointValue on wasm32: 16 bytes, 8-byte aligned. */
export const GhosttyPointValueLayout = {
  size: 16,
  align: 8,
  offset: { coordinate: 0, _padding: 0 },
  fieldSize: { coordinate: 8, _padding: 16 },
} as const;

/** Layout of the C struct GhosttyReader on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyReaderLayout = {
  size: 8,
  align: 4,
  offset: { read: 0, userdata: 4 },
  fieldSize: { read: 4, userdata: 4 },
} as const;

/** Layout of the C struct GhosttyRenderStateColors on wasm32: 784 bytes, 4-byte aligned. */
export const GhosttyRenderStateColorsLayout = {
  size: 784,
  align: 4,
  offset: { size: 0, background: 4, foreground: 7, cursor: 10, cursor_has_value: 13, palette: 14 },
  fieldSize: {
    size: 4,
    background: 3,
    foreground: 3,
    cursor: 3,
    cursor_has_value: 1,
    palette: 768,
  },
} as const;

/** Layout of the C struct GhosttyRenderStateCursor on wasm32: 20 bytes, 4-byte aligned. */
export const GhosttyRenderStateCursorLayout = {
  size: 20,
  align: 4,
  offset: {
    size: 0,
    viewport_has_value: 4,
    viewport_x: 6,
    viewport_y: 8,
    wide_tail: 10,
    visible: 11,
    blinking: 12,
    password_input: 13,
    visual_style: 16,
  },
  fieldSize: {
    size: 4,
    viewport_has_value: 1,
    viewport_x: 2,
    viewport_y: 2,
    wide_tail: 1,
    visible: 1,
    blinking: 1,
    password_input: 1,
    visual_style: 4,
  },
} as const;

/** Layout of the C struct GhosttyRenderStateOverscan on wasm32: 4 bytes, 2-byte aligned. */
export const GhosttyRenderStateOverscanLayout = {
  size: 4,
  align: 2,
  offset: { above: 0, below: 2 },
  fieldSize: { above: 2, below: 2 },
} as const;

/** Layout of the C struct GhosttyRenderStateRowId on wasm32: 16 bytes, 8-byte aligned. */
export const GhosttyRenderStateRowIdLayout = {
  size: 16,
  align: 8,
  offset: { bits: 0 },
  fieldSize: { bits: 16 },
} as const;

/** Layout of the C struct GhosttyRenderStateRowSelection on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyRenderStateRowSelectionLayout = {
  size: 8,
  align: 4,
  offset: { size: 0, start_x: 4, end_x: 6 },
  fieldSize: { size: 4, start_x: 2, end_x: 2 },
} as const;

/** Layout of the C struct GhosttySelection on wasm32: 20 bytes, 4-byte aligned. */
export const GhosttySelectionLayout = {
  size: 20,
  align: 4,
  offset: { start: 0, end: 8, rectangle: 16 },
  fieldSize: { start: 8, end: 8, rectangle: 1 },
} as const;

/** Layout of the C struct GhosttySelectionBuffer on wasm32: 12 bytes, 4-byte aligned. */
export const GhosttySelectionBufferLayout = {
  size: 12,
  align: 4,
  offset: { ptr: 0, cap: 4, len: 8 },
  fieldSize: { ptr: 4, cap: 4, len: 4 },
} as const;

/** Layout of the C struct GhosttySelectionGestureBehaviors on wasm32: 12 bytes, 4-byte aligned. */
export const GhosttySelectionGestureBehaviorsLayout = {
  size: 12,
  align: 4,
  offset: { single_click: 0, double_click: 4, triple_click: 8 },
  fieldSize: { single_click: 4, double_click: 4, triple_click: 4 },
} as const;

/** Layout of the C struct GhosttySelectionGestureGeometry on wasm32: 16 bytes, 4-byte aligned. */
export const GhosttySelectionGestureGeometryLayout = {
  size: 16,
  align: 4,
  offset: { columns: 0, cell_width: 4, padding_left: 8, screen_height: 12 },
  fieldSize: { columns: 4, cell_width: 4, padding_left: 4, screen_height: 4 },
} as const;

/** Layout of the C struct GhosttySgrAttribute on wasm32: 72 bytes, 8-byte aligned. */
export const GhosttySgrAttributeLayout = {
  size: 72,
  align: 8,
  offset: { tag: 0, value: 8 },
  fieldSize: { tag: 4, value: 64 },
} as const;

/** Layout of the C union GhosttySgrAttributeValue on wasm32: 64 bytes, 8-byte aligned. */
export const GhosttySgrAttributeValueLayout = {
  size: 64,
  align: 8,
  offset: {
    unknown: 0,
    underline: 0,
    underline_color: 0,
    underline_color_256: 0,
    direct_color_fg: 0,
    direct_color_bg: 0,
    bg_8: 0,
    fg_8: 0,
    bright_bg_8: 0,
    bright_fg_8: 0,
    bg_256: 0,
    fg_256: 0,
    _padding: 0,
  },
  fieldSize: {
    unknown: 16,
    underline: 4,
    underline_color: 3,
    underline_color_256: 1,
    direct_color_fg: 3,
    direct_color_bg: 3,
    bg_8: 1,
    fg_8: 1,
    bright_bg_8: 1,
    bright_fg_8: 1,
    bg_256: 1,
    fg_256: 1,
    _padding: 64,
  },
} as const;

/** Layout of the C struct GhosttySgrUnknown on wasm32: 16 bytes, 4-byte aligned. */
export const GhosttySgrUnknownLayout = {
  size: 16,
  align: 4,
  offset: { full_ptr: 0, full_len: 4, partial_ptr: 8, partial_len: 12 },
  fieldSize: { full_ptr: 4, full_len: 4, partial_ptr: 4, partial_len: 4 },
} as const;

/** Layout of the C struct GhosttySizeReportSize on wasm32: 12 bytes, 4-byte aligned. */
export const GhosttySizeReportSizeLayout = {
  size: 12,
  align: 4,
  offset: { rows: 0, columns: 2, cell_width: 4, cell_height: 8 },
  fieldSize: { rows: 2, columns: 2, cell_width: 4, cell_height: 4 },
} as const;

/** Layout of the C struct GhosttyString on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyStringLayout = {
  size: 8,
  align: 4,
  offset: { ptr: 0, len: 4 },
  fieldSize: { ptr: 4, len: 4 },
} as const;

/** Layout of the C struct GhosttyStyle on wasm32: 16 bytes, 2-byte aligned. */
export const GhosttyStyleLayout = {
  size: 16,
  align: 2,
  offset: { fg_color: 0, bg_color: 4, underline_color: 8, flags: 12, reserved: 14 },
  fieldSize: { fg_color: 4, bg_color: 4, underline_color: 4, flags: 2, reserved: 2 },
} as const;

/** Layout of the C struct GhosttyStyleColor on wasm32: 4 bytes, 1-byte aligned. */
export const GhosttyStyleColorLayout = {
  size: 4,
  align: 1,
  offset: { tag: 0, value: 1 },
  fieldSize: { tag: 1, value: 3 },
} as const;

/** Layout of the C union GhosttyStyleColorValue on wasm32: 3 bytes, 1-byte aligned. */
export const GhosttyStyleColorValueLayout = {
  size: 3,
  align: 1,
  offset: { palette: 0, rgb: 0 },
  fieldSize: { palette: 1, rgb: 3 },
} as const;

/** Layout of the C struct GhosttySurfacePosition on wasm32: 16 bytes, 8-byte aligned. */
export const GhosttySurfacePositionLayout = {
  size: 16,
  align: 8,
  offset: { x: 0, y: 8 },
  fieldSize: { x: 8, y: 8 },
} as const;

/** Layout of the C struct GhosttySysImage on wasm32: 16 bytes, 4-byte aligned. */
export const GhosttySysImageLayout = {
  size: 16,
  align: 4,
  offset: { width: 0, height: 4, data: 8, data_len: 12 },
  fieldSize: { width: 4, height: 4, data: 4, data_len: 4 },
} as const;

/** Layout of the C struct GhosttyTerminalDesktopNotification on wasm32: 16 bytes, 4-byte aligned. */
export const GhosttyTerminalDesktopNotificationLayout = {
  size: 16,
  align: 4,
  offset: { title: 0, body: 8 },
  fieldSize: { title: 8, body: 8 },
} as const;

/** Layout of the C struct GhosttyTerminalMemoryUsage on wasm32: 104 bytes, 8-byte aligned. */
export const GhosttyTerminalMemoryUsageLayout = {
  size: 104,
  align: 8,
  offset: {
    size: 0,
    compression_supported: 4,
    primary_pages: 8,
    primary_virtual_bytes: 16,
    primary_resident_bytes: 24,
    primary_compressed_pages: 32,
    primary_compressed_bytes: 40,
    primary_image_bytes: 48,
    alternate_pages: 56,
    alternate_virtual_bytes: 64,
    alternate_resident_bytes: 72,
    alternate_compressed_pages: 80,
    alternate_compressed_bytes: 88,
    alternate_image_bytes: 96,
  },
  fieldSize: {
    size: 4,
    compression_supported: 1,
    primary_pages: 8,
    primary_virtual_bytes: 8,
    primary_resident_bytes: 8,
    primary_compressed_pages: 8,
    primary_compressed_bytes: 8,
    primary_image_bytes: 8,
    alternate_pages: 8,
    alternate_virtual_bytes: 8,
    alternate_resident_bytes: 8,
    alternate_compressed_pages: 8,
    alternate_compressed_bytes: 8,
    alternate_image_bytes: 8,
  },
} as const;

/** Layout of the C struct GhosttyTerminalModeConfig on wasm32: 4 bytes, 2-byte aligned. */
export const GhosttyTerminalModeConfigLayout = {
  size: 4,
  align: 2,
  offset: { mode: 0, value: 2 },
  fieldSize: { mode: 2, value: 1 },
} as const;

/** Layout of the C struct GhosttyTerminalProgramStatus on wasm32: 44 bytes, 4-byte aligned. */
export const GhosttyTerminalProgramStatusLayout = {
  size: 44,
  align: 4,
  offset: { state: 0, kind: 4, progress: 8, id: 12, app: 20, title: 28, message: 36 },
  fieldSize: { state: 4, kind: 4, progress: 1, id: 8, app: 8, title: 8, message: 8 },
} as const;

/** Layout of the C struct GhosttyTerminalProgressReport on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyTerminalProgressReportLayout = {
  size: 8,
  align: 4,
  offset: { state: 0, progress: 4 },
  fieldSize: { state: 4, progress: 1 },
} as const;

/** Layout of the C struct GhosttyTerminalResizeWindow on wasm32: 24 bytes, 8-byte aligned. */
export const GhosttyTerminalResizeWindowLayout = {
  size: 24,
  align: 8,
  offset: { tag: 0, value: 8 },
  fieldSize: { tag: 4, value: 16 },
} as const;

/** Layout of the C struct GhosttyTerminalResizeWindowGrid on wasm32: 4 bytes, 2-byte aligned. */
export const GhosttyTerminalResizeWindowGridLayout = {
  size: 4,
  align: 2,
  offset: { rows: 0, columns: 2 },
  fieldSize: { rows: 2, columns: 2 },
} as const;

/** Layout of the C union GhosttyTerminalResizeWindowValue on wasm32: 16 bytes, 8-byte aligned. */
export const GhosttyTerminalResizeWindowValueLayout = {
  size: 16,
  align: 8,
  offset: { grid: 0, _padding: 0 },
  fieldSize: { grid: 4, _padding: 16 },
} as const;

/** Layout of the C struct GhosttyTerminalScrollViewport on wasm32: 24 bytes, 8-byte aligned. */
export const GhosttyTerminalScrollViewportLayout = {
  size: 24,
  align: 8,
  offset: { tag: 0, value: 8 },
  fieldSize: { tag: 4, value: 16 },
} as const;

/** Layout of the C union GhosttyTerminalScrollViewportValue on wasm32: 16 bytes, 8-byte aligned. */
export const GhosttyTerminalScrollViewportValueLayout = {
  size: 16,
  align: 8,
  offset: { delta: 0, row: 0, delta_prompt: 0, _padding: 0 },
  fieldSize: { delta: 4, row: 4, delta_prompt: 4, _padding: 16 },
} as const;

/** Layout of the C struct GhosttyTerminalScrollbar on wasm32: 24 bytes, 8-byte aligned. */
export const GhosttyTerminalScrollbarLayout = {
  size: 24,
  align: 8,
  offset: { total: 0, offset: 8, len: 16 },
  fieldSize: { total: 8, offset: 8, len: 8 },
} as const;

/** Layout of the C struct GhosttyTerminalSelectLineOptions on wasm32: 24 bytes, 4-byte aligned. */
export const GhosttyTerminalSelectLineOptionsLayout = {
  size: 24,
  align: 4,
  offset: { size: 0, ref: 4, whitespace: 12, whitespace_len: 16, semantic_prompt_boundary: 20 },
  fieldSize: { size: 4, ref: 8, whitespace: 4, whitespace_len: 4, semantic_prompt_boundary: 1 },
} as const;

/** Layout of the C struct GhosttyTerminalSelectWordBetweenOptions on wasm32: 28 bytes, 4-byte aligned. */
export const GhosttyTerminalSelectWordBetweenOptionsLayout = {
  size: 28,
  align: 4,
  offset: { size: 0, start: 4, end: 12, boundary_codepoints: 20, boundary_codepoints_len: 24 },
  fieldSize: { size: 4, start: 8, end: 8, boundary_codepoints: 4, boundary_codepoints_len: 4 },
} as const;

/** Layout of the C struct GhosttyTerminalSelectWordOptions on wasm32: 20 bytes, 4-byte aligned. */
export const GhosttyTerminalSelectWordOptionsLayout = {
  size: 20,
  align: 4,
  offset: { size: 0, ref: 4, boundary_codepoints: 12, boundary_codepoints_len: 16 },
  fieldSize: { size: 4, ref: 8, boundary_codepoints: 4, boundary_codepoints_len: 4 },
} as const;

/** Layout of the C struct GhosttyTerminalSemanticPrompt on wasm32: 32 bytes, 4-byte aligned. */
export const GhosttyTerminalSemanticPromptLayout = {
  size: 32,
  align: 4,
  offset: { kind: 0, prompt_kind: 4, has_exit_code: 8, exit_code: 12, command: 16, error: 24 },
  fieldSize: { kind: 4, prompt_kind: 4, has_exit_code: 1, exit_code: 4, command: 8, error: 8 },
} as const;

/** Layout of the C struct GhosttyTerminalUnknownOscSequence on wasm32: 16 bytes, 4-byte aligned. */
export const GhosttyTerminalUnknownOscSequenceLayout = {
  size: 16,
  align: 4,
  offset: { truncated: 0, content: 4, terminator: 12 },
  fieldSize: { truncated: 1, content: 8, terminator: 4 },
} as const;

/** Layout of the C struct GhosttyTerminalUnknownSequence on wasm32: 136 bytes, 8-byte aligned. */
export const GhosttyTerminalUnknownSequenceLayout = {
  size: 136,
  align: 8,
  offset: { tag: 0, value: 8 },
  fieldSize: { tag: 4, value: 128 },
} as const;

/** Layout of the C union GhosttyTerminalUnknownSequenceValue on wasm32: 128 bytes, 8-byte aligned. */
export const GhosttyTerminalUnknownSequenceValueLayout = {
  size: 128,
  align: 8,
  offset: { apc: 0, osc: 0, _padding: 0 },
  fieldSize: { apc: 12, osc: 16, _padding: 128 },
} as const;

/** Layout of the C struct GhosttyTerminalUnknownStringSequence on wasm32: 12 bytes, 4-byte aligned. */
export const GhosttyTerminalUnknownStringSequenceLayout = {
  size: 12,
  align: 4,
  offset: { truncated: 0, content: 4 },
  fieldSize: { truncated: 1, content: 8 },
} as const;

/** Layout of the C struct GhosttyTerminalWriteStop on wasm32: 28 bytes, 4-byte aligned. */
export const GhosttyTerminalWriteStopLayout = {
  size: 28,
  align: 4,
  offset: { size: 0, consumed: 4, reached: 8, kind: 12, introducer: 16, end: 20, byte: 24 },
  fieldSize: { size: 4, consumed: 4, reached: 4, kind: 4, introducer: 4, end: 4, byte: 1 },
} as const;

/** Layout of the C struct GhosttyWriter on wasm32: 8 bytes, 4-byte aligned. */
export const GhosttyWriterLayout = {
  size: 8,
  align: 4,
  offset: { write: 0, userdata: 4 },
  fieldSize: { write: 4, userdata: 4 },
} as const;
