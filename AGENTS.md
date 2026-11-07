# Agent Guide - Ghostty WASM Terminal

**For AI coding agents working on this repository.**

## Quick Start

```bash
bun install                          # Install dependencies
bun run build:wasm                   # Build ghostty-vt.wasm (requires Zig 0.17.0)
bun test                             # Run test suite
bun run dev                          # Start Vite dev server (http://localhost:8000)
```

**Before committing, always run:**

```bash
bun run fmt && bun run lint && bun run typecheck && bun test && bun run build
```

**Run interactive terminal demo:**

```bash
cd demo && bun install && cd ..      # Install demo server dependencies (once)
bun run demo:dev                     # Vite dev server + WebSocket PTY on http://localhost:8000/demo/
# Or serve the production bundle on http://localhost:8080:
bun run build && bun run demo
```

## Project State

This is a **fully functional terminal emulator** (MVP complete) that uses Ghostty's battle-tested VT100 parser compiled to WebAssembly.

**What works:**

- ✅ Full VT100/ANSI terminal emulation (vim, htop, colors, etc.)
- ✅ Canvas-based renderer with 60 FPS
- ✅ Keyboard input handling (Kitty keyboard protocol)
- ✅ Text selection and clipboard
- ✅ WebSocket PTY integration (real shell sessions)
- ✅ xterm.js-compatible API
- ✅ FitAddon for responsive sizing
- ✅ Comprehensive test suite (terminal, renderer, input, selection)

**Tech stack:**

- TypeScript + Bun runtime for tests
- Vite for dev server and bundling
- Ghostty WASM (built via `bun run build:wasm` with Zig 0.17.0; prebuilt on the `built` branch) for VT100 parsing
- Canvas2D, WebGL2, and WebGPU renderers

## Architecture

```
┌─────────────────────────────────────────┐
│  Terminal (lib/terminal.ts)             │  xterm.js-compatible API
│  - Public API, event handling           │
└───────────┬─────────────────────────────┘
            │
            ├─► GhosttyTerminal (WASM)
            │   └─ VT100 state machine, screen buffer
            │
            ├─► CanvasRenderer (lib/renderer-canvas2d.ts)
            │   └─ 60 FPS rendering, all colors/styles
            │
            ├─► InputHandler (lib/input-handler.ts)
            │   └─ Keyboard events → escape sequences
            │
            └─► SelectionManager (lib/selection-manager.ts)
                └─ Text selection + clipboard

Ghostty WASM Bridge (lib/ghostty.ts)
├─ Ghostty - WASM loader
├─ GhosttyTerminal - Terminal instance wrapper
└─ KeyEncoder - Keyboard event encoding
```

### Key Files

| File                         | Lines | Purpose                                            |
| ---------------------------- | ----- | -------------------------------------------------- |
| `lib/terminal.ts`            | 427   | Main Terminal class, xterm.js API                  |
| `lib/ghostty.ts`             | 552   | WASM bridge, memory management                     |
| `lib/renderer-canvas2d.ts`   | ~1700 | Canvas2D renderer (CanvasRenderer)                 |
| `lib/input-handler.ts`       | 438   | Keyboard → escape sequences                        |
| `lib/selection-manager.ts`   | 442   | Text selection + clipboard                         |
| `lib/types.ts`               | 454   | TypeScript definitions for WASM ABI                |
| `lib/ghostty-abi.ts`         | ~2000 | GENERATED enums/struct layouts (`bun run gen:abi`) |
| `scripts/gen-ghostty-abi.ts` | 300   | Generator reading upstream's frozen ABI manifest   |
| `lib/addons/fit.ts`          | 240   | Responsive terminal sizing                         |
| `demo/bin/demo.js`           | ~710  | HTTP + WebSocket PTY demo server                   |

### WASM Integration Pattern

**What's in Ghostty WASM:**

- VT100/ANSI state machine (the hard part)
- Screen buffer (2D cell grid)
- Cursor tracking
- Scrollback buffer
- SGR parsing (colors/styles)
- Key encoding

**What's in TypeScript:**

- Terminal API (xterm.js compatibility)
- Canvas rendering
- Input event handling
- Selection/clipboard
- Addons (FitAddon)
- WebSocket/PTY integration

**Memory Management:**

- WASM exports linear memory
- TypeScript reads cell data via typed arrays
- No manual malloc/free needed (Ghostty manages internally)
- Get cell pointer: `wasmTerm.getScreenCells()`
- Read cells: `new Uint8Array(memory.buffer, ptr, size)`

## Development Workflows

### Before Committing

**⚠️ Always run all CI checks before committing:**

```bash
bun run fmt                           # Check formatting (Prettier)
bun run lint                          # Run linter (Biome)
bun run typecheck                     # Type check (TypeScript)
bun test                              # Run tests (95 tests)
bun run build                         # Build library
```

All at once: `bun run fmt && bun run lint && bun run typecheck && bun test && bun run build`

Auto-fix formatting: `bun run fmt:fix`

### Running Tests

```bash
bun test                              # Run all tests
bun test lib/terminal.test.ts         # Run specific file
bun test --watch                      # Watch mode (may hang - use Ctrl+C and restart)
bun test -t "test name pattern"       # Run matching tests
```

**Test files:** `*.test.ts` in `lib/` (terminal, renderer, input-handler, selection-manager, fit)

### Running Demos

**⚠️ CRITICAL: Use Vite dev server or `demo/bin/demo.js`!** Plain HTTP server won't handle TypeScript imports.

```bash
# ✅ CORRECT (interactive shell demo with PTY WebSocket on /ws)
cd demo && bun install && cd ..
bun run demo:dev                      # Vite + PTY server (http://localhost:8000/demo/)

# ✅ CORRECT (static demos only, no PTY server)
bun run dev                           # Vite with TS support (http://localhost:8000/demo/colors-demo.html)

# ❌ WRONG
python3 -m http.server                # Can't handle .ts imports
```

**Available demos:**

- `demo/index.html` - Interactive shell terminal (requires `bun run demo:dev` or `bun run demo` for `/ws` PTY)
- `demo/colors-demo.html` - ANSI color showcase (no PTY server needed)
- `demo/scrollbar-test.html` - Scrollback and scrollbar test (no PTY server needed)

### Type Checking

```bash
bun run typecheck                     # Check types without compiling
```

### Debugging

**Browser console (F12):**

```javascript
// Access terminal instance (if exposed in demo)
term.write('Hello!\r\n');
(term.cols, term.rows);
term.wasmTerm.getCursor(); // WASM cursor state

// Check WASM memory
const cells = term.wasmTerm.getLine(0);
console.log(cells);
```

**Common issues:**

- Rendering glitches → Check `renderer.ts` dirty tracking
- Input not working → Check `input-handler.ts` key mappings
- Selection broken → Check `selection-manager.ts` mouse handlers
- WASM crashes → Check memory buffer validity (may change when memory grows)

## Code Patterns

### Adding Terminal Features

**1. Extend Terminal class (`lib/terminal.ts`):**

```typescript
export class Terminal {
  // Add public method
  public myFeature(): void {
    if (!this.wasmTerm) throw new Error('Not open');
    // Use WASM terminal API
    this.wasmTerm.write('...');
  }

  // Add event
  private myEventEmitter = new EventEmitter<string>();
  public readonly onMyEvent = this.myEventEmitter.event;
}
```

**2. Create Addon (`lib/addons/`):**

```typescript
export class MyAddon implements ITerminalAddon {
  private terminal?: Terminal;

  activate(terminal: Terminal): void {
    this.terminal = terminal;
    // Initialize addon
  }

  dispose(): void {
    // Cleanup
  }
}
```

### Using Ghostty WASM API

```typescript
// Get terminal instance
const ghostty = await Ghostty.load('./ghostty-vt.wasm');
const wasmTerm = ghostty.createTerminal(80, 24);

// Write data (processes VT100 sequences)
wasmTerm.write('Hello\r\n\x1b[1;32mGreen\x1b[0m');

// Read screen state
const cursor = wasmTerm.getCursor(); // {x, y, visible, shape}
const cells = wasmTerm.getLine(0); // GhosttyCell[]
const cell = cells[0]; // {codepoint, fg, bg, flags}

// Check cell flags
const isBold = (cell.flags & CellFlags.BOLD) !== 0;
const isItalic = (cell.flags & CellFlags.ITALIC) !== 0;

// Color extraction
if (cell.fg.type === 'rgb') {
  const { r, g, b } = cell.fg.value;
} else if (cell.fg.type === 'palette') {
  const index = cell.fg.value; // 0-255
}

// Resize
wasmTerm.resize(100, 30);

// Clear screen
wasmTerm.write('\x1bc'); // RIS (Reset to Initial State)
```

### Event System

```typescript
// Terminal uses EventEmitter for xterm.js compatibility
private dataEmitter = new EventEmitter<string>();
public readonly onData = this.dataEmitter.event;

// Emit events
this.dataEmitter.fire('user input data');

// Subscribe (returns IDisposable)
const disposable = term.onData(data => {
  console.log(data);
});
disposable.dispose();  // Unsubscribe
```

### Testing Patterns

```typescript
import { describe, test, expect } from 'bun:test';

describe('MyFeature', () => {
  test('should do something', async () => {
    const term = new Terminal({ cols: 80, rows: 24 });
    const container = document.createElement('div');
    await term.open(container);

    term.write('test\r\n');

    // Check WASM state
    const cursor = term.wasmTerm!.getCursor();
    expect(cursor.y).toBe(1);

    term.dispose();
  });
});
```

**Test helpers:**

- Use `document.createElement()` for DOM elements
- Always `await term.open()` before testing
- Always `term.dispose()` in cleanup
- Use `term.wasmTerm` to access WASM API directly

## Critical Gotchas

### 1. **Must Use Vite Dev Server**

```bash
# ✅ Works - Vite transpiles TypeScript
bun run dev

# ❌ Fails - Browser can't load .ts files directly
python3 -m http.server
```

**Why:** Demos import TypeScript modules directly (`from './lib/terminal.ts'`). Need Vite to transpile.

### 2. **WASM Binary and `dist/` are Gitignored on `main`**

- `ghostty-vt.wasm` and `dist/` are generated build outputs and are gitignored on `main`
- Run `bun run build:wasm` (requires Zig 0.17.0) before running tests or demos on a fresh checkout, or `bun run build` to build both WASM and `dist/`
- Only the `built` branch carries prebuilt `ghostty-vt.wasm` and `dist/` artifacts

### 3. **Test Timeouts**

- `bun test` may hang on completion (known issue)
- Use `Ctrl+C` to exit
- Tests actually pass before hang
- Use `bun test lib/specific.test.ts` to limit scope

### 4. **WASM Memory Buffer Invalidation**

```typescript
// ❌ WRONG - buffer may become invalid
const buffer = this.memory.buffer;
// ... time passes, memory grows ...
const view = new Uint8Array(buffer);  // May be detached!

// ✅ CORRECT - get fresh buffer each time
private getBuffer(): ArrayBuffer {
  return this.memory.buffer;
}
const view = new Uint8Array(this.getBuffer(), ptr, size);
```

### 5. **PTY Server Required for Interactive Demos**

`bun run dev` alone only starts Vite and does not attach the PTY WebSocket server, so `demo/index.html` will stay disconnected. Use `demo/bin/demo.js`:

```bash
# Install demo dependencies once
cd demo && bun install && cd ..

# Dev mode: Vite + same-origin /ws PTY server on port 8000
bun run demo:dev
# Open: http://localhost:8000/demo/

# Production mode: serves built dist/ + /ws PTY server on port 8080
bun run build
bun run demo
# Open: http://localhost:8080/
```

**WebSocket connects to:** same-origin `/ws` (`ws://localhost:8000/ws` in `--dev` mode, or `ws://localhost:8080/ws` in production mode)

### 6. **Canvas Rendering Requires Container Resize**

```typescript
// After opening terminal, must call fit
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
await term.open(container);
fitAddon.fit(); // ⚠️ Required! Otherwise terminal may not render

// On window resize
window.addEventListener('resize', () => fitAddon.fit());
```

## Common Tasks

### Add New Escape Sequence Support

**Option 1: If Ghostty WASM already supports it**

- Just write data, WASM handles it
- Update renderer if new visual features needed

**Option 2: If not in WASM**

- Feature needs to be added to Ghostty upstream
- Then rebuild WASM binary

### Sync to a New libghostty-vt Release

1. Check out the new `vt-x.y.z` tag in the `ghostty/` submodule.
2. `bun run build:wasm` (re-applies `patches/ghostty-wasm-api.patch`; fix conflicts by hand).
3. `bun run gen:abi` to regenerate `lib/ghostty-abi.ts` from upstream's manifest. Never edit that file by hand; if the patch adds to the ABI, describe it in `patches/ghostty-wasm-api.abi.json`.
4. `bun test` — `lib/ghostty-abi.test.ts` reports stale bindings, manifest/binary mismatches, and exports missing from `symbols.txt`.

### Fix Rendering Issue

1. Check if cells are correct: `wasmTerm.getLine(y)`
2. Check if dirty tracking works: `renderer.render()`
3. Check font metrics: `renderer['fontMetrics']`
4. Check color conversion: `renderer['applyStyle']()`

### Add Keyboard Shortcut

```typescript
// In input-handler.ts
if (e.ctrlKey && e.key === 'c') {
  // Handle Ctrl+C
  return '\x03'; // ETX character
}
```

### Debug Selection

```typescript
// In selection-manager.ts
console.log('Selection:', this.start, this.end);
console.log('Selected text:', this.getSelectedText());
```

## Resources

- **Ghostty Source:** https://github.com/ghostty-org/ghostty
- **VT100 Reference:** https://vt100.net/docs/vt100-ug/
- **ANSI Escape Codes:** https://en.wikipedia.org/wiki/ANSI_escape_code
- **xterm.js API:** https://xtermjs.org/docs/api/terminal/

## Questions?

When stuck:

1. Read the test files - they show all API usage patterns
2. Look at demo code in `demo/*.html`
3. Read Ghostty source for WASM implementation details
4. Check xterm.js docs for API compatibility questions
