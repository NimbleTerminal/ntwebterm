# @ntwebterm/demo

Cross-platform demo server for [ntwebterm](https://github.com/NimbleTerminal/ntwebterm) terminal emulator.

## Quick Start

This demo is private and runs from a checkout. Build the parent project, then
run `cd demo && bun install` before starting it.

```bash
bun run start
```

This starts a local web server with a fully functional terminal connected to your shell.
Works on **Linux** and **macOS** (no Windows support yet).

## What it does

- Starts an HTTP server on port 8080 (configurable via `PORT` env var)
- Serves WebSocket PTY on the same port at `/ws` endpoint
- Opens a real shell session (bash, zsh, etc.)
- Provides full PTY support (colors, cursor positioning, resize, etc.)
- Requires a per-run token and checks `Host` and `Origin` on the WebSocket

## Usage

```bash
# Default (port 8080)
bun run start

# Custom port
PORT=3000 bun run start
```

Then open the URL the server prints (it includes the access token).

## Access control

The server hands out a real shell, so `/ws` only accepts a connection when all of these hold:

- The `Host` header names this server (`localhost`, `127.0.0.1`, `[::1]` or `$HOST`, on the configured port). This blocks DNS rebinding.
- The `Origin` header names this server too. This blocks other web pages.
- The request carries the per-run token. The server prints a URL containing `?token=...` at startup; open that URL. The token changes on every start.

The server listens on `127.0.0.1` unless you set `HOST`.

### Reverse proxies

Putting this behind a public proxy (ngrok, nginx) exposes a shell on your machine to anyone who learns the token. If you still need it, name the public host explicitly and make sure the proxy forwards the original `Host` header:

```bash
ALLOWED_HOSTS=example.ngrok.app bun run start
```

`X-Forwarded-Host` is ignored.

## Security Warning

⚠️ **This server provides full shell access.**

Only use for local development and demos. Do not expose to untrusted networks.

## Renderer backends

The demo selects a renderer via the `?renderer=` query string:

- `?renderer=auto` (default) — tries WebGPU first, then WebGL2, then Canvas2D.
- `?renderer=webgpu` — strict WebGPU; throws if unavailable.
- `?renderer=webgl` — strict WebGL2; throws if unavailable.
- `?renderer=canvas2d` — Canvas2D only.

Press **Alt+Shift+R** to cycle through all three backends (webgpu → webgl → canvas2d → webgpu), reloading the page with the new `?renderer=` query string.
The FPS overlay in the top-right of the terminal shows the active backend.

## Multilingual renderer check

With the Vite dev server running, open
`http://localhost:8000/demo/multilingual-renderer-check.html`. Use
`?renderer=canvas2d`, `?renderer=webgl`, or `?renderer=webgpu`, and optionally
`&size=20`, to inspect individual configurations. The page reports buffer,
width, grapheme and selection checks below the terminal. Arabic words are
shaped as contextual runs while retaining their terminal-cell geometry.

The Chromium screenshot matrix and bundled test-font instructions are in
`bench/results/multilingual/README.md`.
