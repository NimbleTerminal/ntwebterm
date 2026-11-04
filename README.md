# ntwebterm

Ghostty’s terminal emulator in the browser, with an xterm.js-compatible API, WebGPU, WebGL and Canvas2D renderers, and Kitty graphics.

Part of the NimbleTerminal family; formerly NimbleMarkets’ ghostty-web fork.
The browser layer originated in [Coder’s ghostty-web](https://github.com/coder/ghostty-web).

## Comparison with xterm.js

xterm.js is everywhere—VS Code, Hyper, countless web terminals. But it has fundamental issues:

| Issue                                    | xterm.js                                                         | ntwebterm                  |
| ---------------------------------------- | ---------------------------------------------------------------- | -------------------------- |
| **Complex scripts** (Devanagari, Arabic) | Rendering issues                                                 | ✓ Proper grapheme handling |
| **XTPUSHSGR/XTPOPSGR**                   | [Not supported](https://github.com/xtermjs/xterm.js/issues/2570) | ✓ Full support             |

xterm.js reimplements terminal emulation in JavaScript. Every escape sequence, every edge case, every Unicode quirk—all hand-coded. Ghostty's emulator is the same battle-tested code that runs the native Ghostty app.

## Installation

```bash
git clone --branch built https://github.com/NimbleTerminal/ntwebterm.git
```

The `built` branch carries `dist/ntwebterm.js`, `dist/ntwebterm.d.ts`,
and `ghostty-vt.wasm`. Serve the runtime files together. npm publishing is
disabled until the new package is configured; the examples use its future package name.

## Usage

ntwebterm aims to be API-compatible with the xterm.js API.

```javascript
import { init, Terminal } from 'ntwebterm';

await init();

const term = new Terminal({
  fontSize: 14,
  theme: {
    background: '#1a1b26',
    foreground: '#a9b1d6',
  },
});

await term.open(document.getElementById('terminal'));
term.onData((data) => websocket.send(data));
websocket.onmessage = (e) => term.write(e.data);
```

For a comprehensive client <-> server example, refer to the [demo](./demo/index.html#L141).

### Renderers

Three GPU/CPU rendering backends are supported. Pass
`{ renderer: 'webgpu' | 'webgl' | 'canvas2d' | 'auto' }` (default `'auto'`) to the
`Terminal` constructor.

- **WebGPU** — preferred GPU backend with cached image textures
- **WebGL2** — fallback for browsers without WebGPU (notably Safari < 26 and
  Firefox without the flag); uses the same resolved image draw list
- **Canvas2D** — universal fallback; supports kitty graphics via 2D context

`'auto'` tries WebGPU → WebGL2 → Canvas2D in order, transparently falling
through to the next on init failure. At runtime, GPU device-loss (WebGPU) or
context-loss (WebGL) automatically demotes to the next available backend on
a fresh canvas.

All three backends use Ghostty's resolved Kitty image placements, including
fixed, relative and Unicode-placeholder images, source cropping and pixel offsets.
Images compose below cell backgrounds, below text or above text according to their
layer and z-index. Contiguous placeholder strips are merged when their geometry
allows it; they no longer use a 256-image shader lookup table.

Image generations control pixel uploads independently of placement changes.
Animation wakes the renderer at Ghostty's next frame deadline, respects synchronized
output and stops scheduling when playback stops or the terminal is disposed.
Off-screen decoded images/textures are evicted; each decoded-image cache is capped
at 64 MiB. Images exceeding that budget may be omitted until resources are available.
Legacy custom render buffers without `getImageFrame()` retain the older graphics path.

Run `bun run dev` and open [the renderer checks](./demo/kitty-renderer-check.html)
for real-browser layer and animation checks across all three backends.

### Unicode and bidirectional text

`Terminal.unicode.activeVersion` reports Unicode 15.1 for Ghostty's terminal,
grapheme, and width behavior. Implicit right-to-left ordering currently uses
[`bidi-js` 1.0.3](https://github.com/lojjic/bidi-js), whose generated tables
implement Unicode Bidirectional Algorithm 13.0. Characters assigned after
Unicode 13 may therefore have outdated BiDi classifications. Matching Unicode
15.1 requires those tables to be updated upstream in `bidi-js`.

A real-browser multilingual check covers representative Latin, Greek, Cyrillic,
CJK, Indic, Southeast Asian, RTL, combining-mark and emoji text across all three
renderers. Arabic words use contextual run shaping while preserving terminal
cell geometry. The check also covers Kitty image compositing. Open
`demo/multilingual-renderer-check.html` through
the Vite server, or see [the browser-test instructions](./bench/results/multilingual/README.md).

## Extensions

- **OSC 7501:** structured program status, exposed through `onProgramStatus`.
- **Cell-anchored overlay addon / OSC 7502:** planned, not included in 0.4.0.

### Program status (OSC 7501)

Subscribe to structured program-status reports from applications:

```typescript
const subscription = term.onProgramStatus((report) => {
  console.log(report.state, report.app, report.message, report.progress);
});
// Later, stop receiving reports:
subscription.dispose();
```

`ProgramStatusReport` is exported from `ntwebterm`. Its `state` is `idle`,
`working`, `done`, `blocked`, `error`, or `clear`; `kind` is `permission`,
`question`, `auth`, or `null`. Progress is a percentage or `null`. The `id`,
`app`, `title`, and `message` fields are strings; title and message are already
decoded from base64 to UTF-8.

Subscriptions may be created before `open()`. The terminal answers OSC 7501
support queries only while at least one listener is subscribed. Reports arrive
synchronously during `write()`, after WASM parsing finishes. Support replies list
the accepted states and kinds (OSC 7501 revision 0.4). The host application
owns the status records: inherit an omitted `app` from the nearest ancestor,
replace each record by `id`, remove a cleared id and its
descendants, and clear everything for a `clear` report with an empty id. Both RIS
and `term.reset()` emit that full clear. The host must also apply the protocol's
process-exit lifetime rules; the browser terminal cannot detect PTY process exits.

The Ghostty submodule is pinned to **v1.4.0**,
`83fb95624b0439ee660c2679b43b38c8b63769cd` (October 27, 2026).
Rebuilding requires Zig **0.17.0**; use
`ZIG=/absolute/path/to/zig bun run build` if your system compiler differs.

### Upstream v1.4.0 sync

Compared with our previous October 6 pin (`a4aacd918`), this release brings:

| Change                                                                                           | Availability in ntwebterm                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OSC 7501 revision 0.4: capability lists in support replies, stricter record IDs                  | Active through `onProgramStatus`; the host owns ancestor `app` inheritance.                                                                                                                       |
| CSI 19 t screen-size reports and DECXCPR extended cursor reports                                 | Handled by WASM through existing response routing. CSI 19 t uses the text-area dimensions.                                                                                                        |
| DECSTR soft reset, tab-stop clearing, pending-wrap, grapheme reflow, selection and history fixes | Included in the updated terminal core.                                                                                                                                                            |
| Unified render-state image iterator                                                              | New upstream API resolves fixed, relative and Unicode-placeholder Kitty placements, with geometry, layers and placement generations. All three renderers consume this list, including scrollback. |
| Kitty animation tick                                                                             | New upstream API advances frames and returns the next redraw deadline; deadline-driven browser animation scheduling is enabled.                                                                   |
| Kitty graphics in snapshots                                                                      | Upstream snapshots now preserve images, placements and animation state, with progressive pixel loading. No public TypeScript snapshot wrapper yet.                                                |
| Prompt-based viewport navigation                                                                 | Upstream adds a prompt-delta scroll mode; no public TypeScript method yet.                                                                                                                        |
| CSI 8 t window-resize callback                                                                   | Upstream exposes resize requests to the embedder; no browser callback is installed.                                                                                                               |
| Bounded VT parsing                                                                               | `ghostty_terminal_vt_write_until` replaces `ghostty_terminal_vt_write_until_ground`, adding APC, DCS and OSC boundaries. Our normal write path is unchanged.                                      |

The existing browser graphics/shared-memory and recycled-row patch applies
unchanged. The build now uses Zig 0.17.0 and `-Doptimize=small`; CI and the Nix
compiler pin follow that version. `ghostty-vt.wasm` and `dist/` are generated,
git-ignored outputs, rebuilt locally and in CI.

See the [upstream comparison](https://github.com/ghostty-org/ghostty/compare/a4aacd918ba9e79929ff608034c60a4341773ef0...v1.4.0)
and [v1.4.0 C API headers](https://github.com/ghostty-org/ghostty/tree/v1.4.0/include/ghostty/vt)
for the complete API changes. The upstream OSC command enum also renames
`CONTEXT_SIGNAL` to `HIERARCHICAL_CONTEXT` without changing its numeric value;
our TypeScript bindings do not use that enum member.

### Renderer HUD

A small corner badge that shows the active renderer backend and live FPS,
with click-to-cycle and `Alt+Shift+R` cycling between renderers. Useful for
demos and during development; opt-in.

```javascript
import { init, Terminal, installRendererHud, parseRendererFromURL } from 'ntwebterm';

await init();
const term = new Terminal({ renderer: parseRendererFromURL() });
await term.open(document.getElementById('terminal'));

const uninstall = installRendererHud(term, {
  parent: document.getElementById('terminal'),
  position: 'absolute',
});
// later: uninstall();
```

`parseRendererFromURL()` reads `?renderer=webgpu|webgl|canvas2d|auto` from
the current URL and falls back to `window.__ghosttyDefaultRenderer` if a
server has injected one, then `'auto'`.

`installRendererHud(terminal, opts?)` options:

| Option             | Default                         | Description                                                |
| ------------------ | ------------------------------- | ---------------------------------------------------------- |
| `parent`           | `document.body`                 | Where to mount the badge.                                  |
| `position`         | `'fixed'`                       | `'fixed'` (viewport) or `'absolute'` (relative to parent). |
| `className`        | —                               | CSS class applied to the badge for custom styling.         |
| `clickToToggle`    | `true`                          | Click the badge to cycle the renderer.                     |
| `bindToggleHotkey` | `true`                          | Bind `Alt+Shift+R` on `window` to cycle the renderer.      |
| `cycle`            | `['webgpu','webgl','canvas2d']` | Cycle order; pass a subset to skip backends.               |

The toggle navigates `window.location.href` with the new `?renderer=` value,
so the page reloads with the chosen backend.

## Browser Kitty shared memory

After a terminal is constructed, `globalThis.ghosttyKittySharedMemory` is a
`Map<string, Uint8Array>`. Its presence signals support for browser `t=s`
transmissions. Put tightly packed, straight-alpha RGBA bytes in the map under a
unique name, then send a Kitty command containing the base64-encoded name:

```js
const name = '/ntc-example-frame'; // use a unique name for every pending frame
const pixels = new Uint8Array([255, 0, 0, 255]); // one red pixel
const registry = globalThis.ghosttyKittySharedMemory;
if (registry) {
  registry.set(name, pixels);
  term.write(`\x1b_Ga=T,t=s,f=32,s=1,v=1,S=4,i=7,c=1,r=1,q=2;${btoa(name)}\x1b\\`);
}
```

The terminal copies and deletes the entry while processing the command. Missing
names and invalid sizes fail without a response when `q=2`. Buffers must match
`S` exactly, or the format-derived size when `S` is absent; this browser hook
reads whole objects and rejects non-zero `O` offsets. Normal Kitty pixel-format
and dimension validation still applies. Producers must remove entries for frames
they discard before writing the command.

Ship the matching JavaScript bundle and `ghostty-vt.wasm` together. This registry
is a browser convention; it does not create operating-system shared memory.
The global name is preserved for compatibility. Moving it behind an option or
addon is future work.

## Development

ntwebterm builds from Ghostty's source with a [patch](./patches/ghostty-wasm-api.patch) to expose additional
functionality.

> Requires Zig and Bun.

```bash
bun run build
```

Mitchell Hashimoto (author of Ghostty) has [been working](https://mitchellh.com/writing/libghostty-is-coming) on `libghostty` which makes this all possible. The patches are very minimal thanks to the work the Ghostty team has done, and we expect them to get smaller.

This library will eventually consume a native Ghostty WASM distribution once available, and will continue to provide an xterm.js compatible API.

Credit to [Ghostty](https://github.com/ghostty-org/ghostty) and its contributors for
the emulator, and [Coder](https://github.com/coder/ghostty-web) for the original
browser wrapper. NimbleTerminal develops this browser layer independently.

## Repository and releases

The full source history from `NimbleMarkets/ghostty-web` is preserved here,
including Coder’s commits. We pushed to the already-created empty repository
instead of transferring the fork: issues and the fork relationship remain at
[the original repository](https://github.com/NimbleMarkets/ghostty-web).
`main` continues `nm-kitty-meow` at `547ae5c`. Merged development branches are
preserved as `archive/*` tags; `built` is the only artifact branch. The
`build-artifacts` workflow rebuilds it on main pushes, daily, or on demand.
Consumers pin its commit, and must ship JavaScript and WASM from the same build.
Coder’s existing `v0.4.0` tag is preserved as `archive/coder-v0.4.0`; ntwebterm’s
`v0.4.0` identifies this rename. npm publishing is disabled until configured.

Booba’s next minor release serves `static/ntwebterm/ntwebterm.js` and keeps
`static/ghostty-web/ghostty-web.js` as a re-export for that minor release.
Consumers should update imports with their booba dependency bump; the alias is
scheduled for removal in the following release. This includes gloss,
ntfilepicker, nt3d, ntmaps, and thinkt. The overlay addon is subsequent work.

### Ghostty naming

Ghostty’s [project documentation](https://ghostty.org/docs/about) encourages
other terminals built on libghostty. A review of its README, CONTRIBUTING,
PACKAGING, and website documentation on 2026-10-31 did not locate a specific
published derivative-name policy. We do not claim naming approval: ntwebterm
uses its own product name and credits Ghostty as its emulator, with no implied
affiliation. Ghostty core identifiers and `ghostty-vt.wasm` retain their names.

## License

[MIT](./LICENSE)

### Fonts and display scaling

The default size is 15 CSS pixels. The default family is
`"JetBrains Mono", "Cascadia Code", "Iosevka", "Source Code Pro", "ui-monospace", "SF Mono", Menlo, Consolas, monospace`.
Installed fonts determine which face is selected; no font is downloaded by default.
Existing `fontFamily` and `fontSize` overrides continue to work.

For predictable selection, serve an OFL JetBrains Mono WOFF2 asset with your app:

```typescript
const term = new Terminal({
  fontFamily: '"JetBrains Mono", monospace',
  fontFaces: [
    {
      family: 'JetBrains Mono',
      src: '/fonts/JetBrainsMono-Regular.woff2',
      weight: 400,
      style: 'normal',
      display: 'swap',
    },
  ],
});
await term.open(container);
```

Copy the font and its OFL license into your public assets first.
`fontFaces` accepts URL strings, CSS `url(...)` or `local(...)` sources, or an
array of sources in fallback order. Configure it before `open()`. Initial
measurement and paint wait for loading, up to three seconds. Failed or timed-out
faces fall back to the family stack; timed-out loads are not registered later.
Remote assets must permit cross-origin font loading.

Cell width and height round up to integer CSS pixels. Fractional DPR still
produces fractional device-pixel cell boundaries: renderers scale the backing
canvas while retaining the CSS grid. Font size, family, and display DPR changes
refresh metrics. `term.getFontMetrics()` returns cell width, height, baseline,
unrounded `advanceWidth`, `ascent`, and `descent` after opening.
