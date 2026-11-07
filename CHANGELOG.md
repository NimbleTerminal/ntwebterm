# Changelog

## Unreleased

### Added

- Wire the libghostty-vt effect callbacks: OSC 52/5522 clipboard writes go to the browser clipboard by default (`clipboardWrite` option, `onClipboardWrite`), clipboard reads are refused unless a synchronous `clipboardRead` handler is supplied, and `onPwdChange`/`term.pwd`, `onNotification`, `onProgress`, `onSemanticPrompt` and `onResizeRequest` expose OSC 7, OSC 9/777, OSC 9;4, OSC 133 and CSI 8 t. CSI ? 996 n is answered from the theme (`colorScheme` option).
- Add `forwardNotificationsToBrowser()`, a reference implementation that shows OSC 9/777 notifications through the browser Notification API without prompting unless asked.
- Export `writeTextToClipboard()`, the clipboard strategy shared by selection copy and OSC 52.
- Generate the libghostty-vt ABI bindings (`lib/ghostty-abi.ts`) from upstream's frozen manifest with `bun run gen:abi`, and add drift tests that compare the generated file, the built WASM's `ghostty_type_json()` and upstream's `symbols.txt`.
- Paste through libghostty-vt's `ghostty_terminal_paste()`: `term.paste()` and clipboard paste events now get upstream's bracketed paste framing, unsafe-byte replacement and Kitty paste events (mode 5522, when a `clipboardRead` handler is installed). New `allowUnsafePaste` option (`true` by default; `false` or a confirmation callback) applies upstream's unsafe-paste rule, and `GhosttyTerminal.paste()` exposes the call directly. `GHOSTTY_SYS_OPT_RANDOM_SECURE` is wired to `crypto.getRandomValues`.
- Encode mouse reports with libghostty-vt's mouse encoder (`ghostty_mouse_encoder_*`): tracking mode and format are read from the terminal, so UTF-8 (1005), urxvt (1015) and SGR-pixels (1016) reports work alongside X10 and SGR, horizontal wheel reports buttons 66/67, and back/forward buttons report 128/129. `GhosttyTerminal.encodeMouse()` and the `MouseEncoder` binding are exported with `MouseAction`, `MouseButton` and `MouseReport`.
- Report focus changes to programs that enable mode 1004: CSI I / CSI O are encoded by libghostty-vt's `ghostty_focus_encode()` and sent as the terminal gains or loses focus. `Ghostty.encodeFocus()` and `GhosttyTerminal.encodeFocus()` expose the binding.
- Expose the loaded library's version and compile-time configuration: `term.ghosttyVersion` / `ghostty.version` bind `ghostty_version()`, and `term.ghosttyBuildInfo` / `ghostty.buildInfo` decode every `ghostty_build_info()` field into a `LibghosttyBuildInfo` (version parts, optimize mode, SIMD, feature flags).

### Changed

- Update the Ghostty submodule to libghostty-vt 1.0.0 (`vt-1.0.0`), the first release with a frozen C ABI, and rebase the WASM API patch onto it.
- Follow the 1.0 ABI in the TypeScript bindings: renumbered option enums (`_INVALID = 0` sentinels), `ghostty_key_encoder_set*` renames, `GhosttyString`-by-value key text, the 16-byte `GhosttyStyle`, size-less callback payloads and grid references, `GhosttyCodepointBuffer` grapheme reads, and the `PIXELS`/`EXPECTED_LEN` Kitty image keys.
- Lift the upstream scrollback byte budget with `SIZE_MAX`; a NULL value now restores the 10,000-byte default instead of removing it.
- Drop the recycled-row clearing hunk from the patch, since upstream now zeroes recycled rows itself.
- Mouse modifier bits follow xterm and upstream: Alt/Option sets the 8 bit (previously the Meta/Command key did). The hand-written SGR and X10 encoders, the mode polling and the motion deduplication were removed from the input handler, and `MouseTrackingConfig` lost `hasSgrMouseMode`.
- Pasted text follows upstream's encoding: newlines become carriage returns when bracketed paste is off (as in xterm.js), and control bytes such as ESC are replaced with spaces rather than the `\x1b[20x~` markers being stripped. The hand-written sanitizers in `Terminal.paste()` and the input handler are gone; `InputHandler` takes an `onPaste` callback and sends raw text to `onData` without one.
- `Key`, `KeyEncoderOption` and `DirtyState` now use upstream's member names (`DIGIT_0`, `ARROW_UP`, `NUMPAD_ADD`, `BACKQUOTE`, `KITTY_FLAGS`, `FALSE`); the previous names remain as deprecated aliases. Struct offsets in the WASM bridge come from the generated `*Layout` constants instead of literals.

## 0.4.2

### Added

- Shape cursive-joining scripts (such as Arabic) as contextual runs across Canvas2D, WebGL, and WebGPU while preserving terminal-cell selection, cursor, color, and BiDi behavior.
- Add a bundled-font multilingual browser corpus with semantic checks and renderer/DPR screenshot goldens.
- Add a GitHub Pages browser showcase (`web/`) with interactive multilingual/BiDi, truecolor/SGR, box-drawing/block-element, Kitty graphics, and scrollback/input demos.
- Add `Taskfile.yml` with `task ci` pre-flight and Pages build/serve targets.

## 0.4.1

### Fixed

- Sanitize bracketed paste payloads and avoid sending an extra Ctrl+V byte before browser paste. Restrict clickable links to safe URL schemes.
- Fix terminal open/dispose races, reset-time selection handling, and leaked DOM listeners.
- Preserve scrollback position during writes, clamp it on resize, and correctly expose scrollback graphemes, wrapped lines, and normal/alternate buffers.
- Wire Ghostty callbacks for synchronized output, bells, and title changes; preserve pure black palette colors and distinct OSC 8 link IDs.
- Correct keyboard modifier, repeat, and key-release encoding, mouse hover/motion reporting, and alternate-screen wheel handling.
- Fix offscreen cursors, smooth scrolling, HiDPI glyph atlases, atlas growth, blinking text, block elements, and wide-character cursor rendering across the renderers.
- Release failed WebGPU devices and report actual rendered frame rates in the HUD.
- Bind the demo server to loopback by default, validate WebSocket origins, block distribution path traversal, and repair the scrollbar demo.
- Harden Zig downloads with checksum verification, use frozen dependency installs in CI, and support Nix source builds.

## 0.4.0: renamed from the ghostty-web fork

- Rename the browser package and bundles to ntwebterm, preserving the xterm.js-compatible API and Ghostty core names.
- WebGPU and WebGL renderers alongside Canvas2D; Kitty graphics layers, placeholders, animation, and browser shared memory.
- Bidirectional and RTL text, OSC 7501 program status, continuous box drawing, and the input fixes from coder/ghostty-web#145.
- Preserve Coder history and MIT attribution. Source lives on main; built contains generated distribution files. npm publishing is disabled pending ntwebterm setup.

### Included changes

### Fixed

- Honor Ghostty-resolved Kitty image layers, source crops, pixel offsets, and
  scrollback placement across Canvas2D, WebGL, and WebGPU.
- Keep WebGL text-only frames in a single opaque pass even when the image API
  returns an empty frame, and cache the text-pass shader uniform location.

- Include descenders, primary font line bounds, and emoji fallback ink in cell
  height and baseline measurements, while keeping column width based on the
  monospace advance. Measuring only the ink in M clipped the top of joined
  emoji in WebGPU and WebGL atlas slots and let Canvas2D paint into the row
  above. Rows may become taller with fonts that need the additional space.

- Draw color emoji in their own colors with the WebGPU and WebGL renderers.
  Both treated every glyph as a coverage mask in the foreground color, so
  emoji came out as silhouettes in the text color. The atlas now marks glyphs
  rasterized in color and stores them premultiplied; the shaders composite
  those over the background, honoring faint. Canvas2D already drew them.

- Report wheel events as SGR mouse buttons 64/65 when the application has
  mouse tracking on, instead of arrow keys, so vim with `set mouse=a` and
  TUIs with mouse reporting scroll their own content. Arrow keys remain the
  fallback on the alternate screen without tracking (coder/ghostty-web#145).

- Forward Ctrl+V and Cmd+V to the application as 0x16 before the browser's
  paste event, so a program that reads the clipboard itself, for an image
  paste, sees the key; text paste is unchanged (coder/ghostty-web#145).
  Superseded in 0.4.1: browser paste no longer emits the extra 0x16 byte.

- Follow DECSCUSR cursor shape changes from the application at runtime. The
  configured `cursorStyle` stays until the program asks for a bar, block or
  underline (coder/ghostty-web#145).

- Repaint Canvas2D image revisions even when terminal cells are unchanged.
  Read each viewport and image once per frame, and avoid repeated canvas
  clears at fractional display scaling.

- Keep valid image placeholders out of the font fallback while their image
  placement is unavailable, preventing grids of missing-glyph boxes.

- Honor synchronized output (DEC mode 2026) across split writes and input
  echoes, so partial screen updates are never painted. A one-second timeout
  releases an interrupted hold; disposal cancels the timer.

- Redraw retransmitted Kitty images when WASM reuses a pixel allocation.
  Graphics revisions invalidate Canvas2D, WebGL and WebGPU caches; ordinary
  text writes retain cached images. Same-size atlas updates reuse their slot.

### Added

- Play Kitty image animations using Ghostty animation deadlines, respecting
  synchronized output and cancelling scheduled work when the terminal is disposed.
- Export `ImageFrame` and `RenderImage`, with `GhosttyTerminal.getImageFrame()`
  and `tickImageAnimations()` for resolved image snapshots and animation updates.
- Add a browser compositing and animation check in `demo/kitty-renderer-check.html`
  and a paired renderer benchmark harness in `bench/renderers.ts`, including
  isolated workload profiling and saved Safari measurements.

- `installRendererHud(terminal, opts?)` and `parseRendererFromURL()` — lift
  the demo's renderer-info HUD (active backend + live FPS, click-to-cycle,
  `Alt+Shift+R` cycling) into the public API. The default cycle covers all
  three concrete backends (`webgpu` → `webgl` → `canvas2d`); pass `cycle` to
  customize.

### Changed

- Update the Ghostty submodule to v1.4.0 and the build toolchain to Zig 0.17.0.
- Use per-image generations to refresh only changed Kitty image data, reuse
  same-size GPU textures, coalesce compatible image strips, and evict offscreen
  images with 64 MiB cache budgets. Resolved placements remove the legacy GPU
  path's 256-image limit; custom render buffers retain the legacy fallback.
- Replace JavaScript APC revision scanning with Ghostty render-state image data.

- The HUD's badge id changed from `booba-renderer-hud` to
  `ghostty-renderer-hud`. Consumers that targeted the old id by selector
  must update. (booba's HUD did not expose this id externally.)
- `demo/index.html` migrated to the new public API; the inline
  `installFpsOverlay` helper and inline keydown handler were removed.
- The new `Alt+Shift+R` hotkey binds on `e.code === 'KeyR'` rather than
  `e.key === 'R'`, fixing a silent failure on macOS where `Option` transforms
  `R` into a dead-key character before keydown fires.
