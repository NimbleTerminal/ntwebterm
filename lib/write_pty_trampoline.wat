;; Tiny trampolines so we can install JS callbacks into the main wasm
;; module's __indirect_function_table without WebAssembly.Function support
;; (Bun and Node lack it; only modern browsers ship the Type Reflection
;; proposal).
;;
;; Each trampoline imports a JS function from `env` and re-exports a
;; wrapper with the matching libghostty-vt callback signature. The
;; wrapper's exported funcref can be added to the main module's table,
;; where ghostty_terminal_set(OPT_*, idx) wires it up.
;;
;; Callbacks currently bridged:
;;   WRITE_PTY:   (terminal: i32, userdata: i32, data: i32, len: i32) -> nil
;;     Used for DSR replies, in-band size reports, etc.
;;   SIZE:        (terminal: i32, userdata: i32, out_size: i32) -> i32 (bool)
;;     Used for CSI 14/16/18 t responses; embedder fills out_size.
;;   DECODE_PNG:  (userdata: i32, allocator: i32, data: i32, data_len: i32,
;;                 out_image: i32) -> i32 (bool)
;;     Used for kitty graphics PNG payloads. Decoder allocates RGBA via
;;     ghostty_alloc(allocator, len) and fills out_image (16-byte struct
;;     of u32 width, u32 height, u32 data_ptr, u32 data_len).
;;
;;   PROGRAM_STATUS: (terminal: i32, userdata: i32, report: i32) -> nil
;;
;;   READ_SHM: same signature as DECODE_PNG, but input is an object name;
;;     only data_ptr and data_len are used in the output struct.
;;
;; Rebuild after edits (wasm-tools strips the names section so the bytes stay small):
;;   wasm-tools parse lib/write_pty_trampoline.wat | wasm-tools strip -o /tmp/trampoline.wasm
;; Then update the byte literal in lib/write_pty_trampoline.ts.
(module
  (type $program_status_sig (func (param i32 i32 i32)))
  (type $write_pty_sig (func (param i32 i32 i32 i32)))
  (type $size_sig (func (param i32 i32 i32) (result i32)))
  (type $decode_png_sig (func (param i32 i32 i32 i32 i32) (result i32)))
  (type $notify_sig (func (param i32 i32)))

  (import "env" "write_pty_cb" (func $write_pty_cb (type $write_pty_sig)))
  (import "env" "size_cb" (func $size_cb (type $size_sig)))
  (import "env" "decode_png_cb" (func $decode_png_cb (type $decode_png_sig)))

  (import "env" "read_shm_cb" (func $read_shm_cb (type $decode_png_sig)))

  (import "env" "program_status_cb" (func $program_status_cb (type $program_status_sig)))
  (import "env" "bell_cb" (func $bell_cb (type $notify_sig)))
  (import "env" "title_changed_cb" (func $title_changed_cb (type $notify_sig)))
  (import "env" "render_hold_cb" (func $render_hold_cb (type $program_status_sig)))

  ;; libghostty-vt 1.0 effect callbacks (see ghostty/include/ghostty/vt/terminal.h).
  ;; Payload callbacks share the (terminal, userdata, ptr) -> nil shape;
  ;; PWD_CHANGED has no payload; COLOR_SCHEME fills *out_scheme and returns bool.
  (import "env" "clipboard_write_cb" (func $clipboard_write_cb (type $program_status_sig)))
  (import "env" "clipboard_read_cb" (func $clipboard_read_cb (type $program_status_sig)))
  (import "env" "pwd_changed_cb" (func $pwd_changed_cb (type $notify_sig)))
  (import "env" "desktop_notification_cb" (func $desktop_notification_cb (type $program_status_sig)))
  (import "env" "progress_report_cb" (func $progress_report_cb (type $program_status_sig)))
  (import "env" "semantic_prompt_cb" (func $semantic_prompt_cb (type $program_status_sig)))
  (import "env" "resize_window_cb" (func $resize_window_cb (type $program_status_sig)))
  (import "env" "color_scheme_cb" (func $color_scheme_cb (type $size_sig)))

  (func $program_status_fwd (export "program_status_fwd") (type $program_status_sig)
    local.get 0 local.get 1 local.get 2
    call $program_status_cb)

  (func $write_pty_fwd (export "write_pty_fwd") (type $write_pty_sig)
    local.get 0  local.get 1  local.get 2  local.get 3
    call $write_pty_cb)

  (func $size_fwd (export "size_fwd") (type $size_sig)
    local.get 0  local.get 1  local.get 2
    call $size_cb)

  (func $decode_png_fwd (export "decode_png_fwd") (type $decode_png_sig)
    local.get 0  local.get 1  local.get 2  local.get 3  local.get 4
    call $decode_png_cb)

  (func $read_shm_fwd (export "read_shm_fwd") (type $decode_png_sig)
    local.get 0  local.get 1  local.get 2  local.get 3  local.get 4
    call $read_shm_cb)

  (func $bell_fwd (export "bell_fwd") (type $notify_sig)
    local.get 0  local.get 1
    call $bell_cb)

  (func $title_changed_fwd (export "title_changed_fwd") (type $notify_sig)
    local.get 0  local.get 1
    call $title_changed_cb)

  (func $render_hold_fwd (export "render_hold_fwd") (type $program_status_sig)
    local.get 0  local.get 1  local.get 2
    call $render_hold_cb)

  (func $clipboard_write_fwd (export "clipboard_write_fwd") (type $program_status_sig)
    local.get 0  local.get 1  local.get 2
    call $clipboard_write_cb)

  (func $clipboard_read_fwd (export "clipboard_read_fwd") (type $program_status_sig)
    local.get 0  local.get 1  local.get 2
    call $clipboard_read_cb)

  (func $pwd_changed_fwd (export "pwd_changed_fwd") (type $notify_sig)
    local.get 0  local.get 1
    call $pwd_changed_cb)

  (func $desktop_notification_fwd (export "desktop_notification_fwd") (type $program_status_sig)
    local.get 0  local.get 1  local.get 2
    call $desktop_notification_cb)

  (func $progress_report_fwd (export "progress_report_fwd") (type $program_status_sig)
    local.get 0  local.get 1  local.get 2
    call $progress_report_cb)

  (func $semantic_prompt_fwd (export "semantic_prompt_fwd") (type $program_status_sig)
    local.get 0  local.get 1  local.get 2
    call $semantic_prompt_cb)

  (func $resize_window_fwd (export "resize_window_fwd") (type $program_status_sig)
    local.get 0  local.get 1  local.get 2
    call $resize_window_cb)

  (func $color_scheme_fwd (export "color_scheme_fwd") (type $size_sig)
    local.get 0  local.get 1  local.get 2
    call $color_scheme_cb))
