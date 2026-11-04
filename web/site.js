const DEMOS = {
  multilingual: {
    title: 'Multilingual & BiDi',
    help: 'Select any LTR, RTL (Hebrew/Arabic), CJK, or combining-mark text to inspect its logical copy · Alt+Shift+R cycles renderers.',
  },
  colors: {
    title: 'Colors & Styles',
    help: '16-color ANSI, 256-color cube, 24-bit RGB gradients, SGR styles, and clickable URLs · Alt+Shift+R cycles renderers.',
  },
  boxes: {
    title: 'Box Drawing & Blocks',
    help: 'Procedural pixel-snapped box drawing and block elements at any DPI · Alt+Shift+R cycles renderers.',
  },
  kitty: {
    title: 'Kitty Graphics',
    help: 'Direct RGBA placements across z-layers (under-bg, under-text, over-text) and Unicode virtual placeholders · Alt+Shift+R cycles renderers.',
  },
  scrollback: {
    title: 'Scrollback & Input',
    help: 'Scroll with wheel/touchpad or scrollbar · Type commands (help, colors, bidi, boxes, clear) at the prompt.',
  },
};

const params = new URLSearchParams(location.search);
const requestedDemo = params.get('demo');
const activeDemo = Object.hasOwn(DEMOS, requestedDemo) ? requestedDemo : 'multilingual';
const requestedRenderer = params.get('renderer') || 'auto';

const statusEl = document.querySelector('#status');
const titleEl = document.querySelector('#title');
const helpEl = document.querySelector('#help');
const restartEl = document.querySelector('#restart');

titleEl.textContent = DEMOS[activeDemo].title;
helpEl.textContent = DEMOS[activeDemo].help;
document.title = `${DEMOS[activeDemo].title} · ntwebterm`;

for (const link of document.querySelectorAll('[data-demo]')) {
  const url = new URL(link.href, location.href);
  if (params.has('renderer')) url.searchParams.set('renderer', requestedRenderer);
  link.href = url.search;
  if (link.dataset.demo === activeDemo) {
    link.setAttribute('aria-current', 'page');
  }
}

for (const link of document.querySelectorAll('[data-renderer]')) {
  const r = link.dataset.renderer;
  const url = new URL(location.href);
  url.searchParams.set('demo', activeDemo);
  if (r === 'auto') {
    url.searchParams.delete('renderer');
  } else {
    url.searchParams.set('renderer', r);
  }
  link.href = url.search || `?demo=${activeDemo}`;
  if (r === requestedRenderer) {
    link.setAttribute('aria-current', 'true');
  }
}

const restartUrl = new URL(location.href);
restartUrl.searchParams.set('demo', activeDemo);
restartEl.href = restartUrl.search;

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function makeRgbaGradientBase64(w, h, variant = 0) {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const u = x / Math.max(1, w - 1);
      const v = y / Math.max(1, h - 1);
      if (variant === 0) {
        rgba[i + 0] = Math.round(230 * (1 - u) + 40 * v);
        rgba[i + 1] = Math.round(70 + 160 * u * (1 - v));
        rgba[i + 2] = Math.round(60 + 195 * v);
        rgba[i + 3] = 255;
      } else if (variant === 1) {
        const wave = 0.5 + 0.5 * Math.sin(u * Math.PI * 4 + v * Math.PI * 2);
        rgba[i + 0] = Math.round(30 + 110 * wave);
        rgba[i + 1] = Math.round(140 + 95 * (1 - v));
        rgba[i + 2] = Math.round(180 + 70 * u);
        rgba[i + 3] = 255;
      } else {
        const cx = u - 0.5;
        const cy = v - 0.5;
        const ring = 0.5 + 0.5 * Math.cos(Math.hypot(cx, cy) * Math.PI * 6);
        rgba[i + 0] = Math.round(220 * ring + 35);
        rgba[i + 1] = Math.round(120 * (1 - ring) + 50);
        rgba[i + 2] = Math.round(210 * u + 40);
        rgba[i + 3] = 230;
      }
    }
  }
  return toBase64(rgba);
}

async function loadRuntime() {
  const localBundle = new URL('./ntwebterm.js', import.meta.url);
  const hasLocalBundle = await fetch(localBundle, { method: 'HEAD' })
    .then((r) => r.ok)
    .catch(() => false);
  const api = hasLocalBundle
    ? await import('./ntwebterm.js')
    : await import(/* @vite-ignore */ '../lib/index.ts');
  const wasmPath = hasLocalBundle ? './ghostty-vt.wasm' : '../ghostty-vt.wasm';
  const ghostty = await api.Ghostty.load(new URL(wasmPath, import.meta.url).href);
  return { api, ghostty, hasLocalBundle };
}

async function loadMultilingualCorpus(hasLocalBundle) {
  if (hasLocalBundle) {
    return import('./multilingual-corpus.js');
  }
  const mod = await import('../demo/multilingual-corpus.js');
  return {
    ...mod,
    TEST_FONT_FACES: mod.TEST_FONT_FACES.map((face) => ({
      ...face,
      src: new URL(face.src, new URL('../demo/', import.meta.url)).href,
    })),
  };
}

async function runMultilingualDemo(term, corpus) {
  const { MULTILINGUAL_ROWS } = corpus;
  const C = '\x1b[1;36m';
  const D = '\x1b[2m';
  const R = '\x1b[0m';

  for (const row of MULTILINGUAL_ROWS) {
    if (row.kitty) {
      term.write('\x1b_Ga=T,f=32,s=1,v=1,i=1,c=8,r=1,C=1,z=-1;/wAA/w==\x1b\\');
    }
    term.write(row.text + '\r\n');
  }
  term.write(
    `\r\n${D}─${R} ${C}Tip:${R} Drag-select any word above (including RTL Hebrew/Arabic or CJK) to inspect its logical text.`
  );

  await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  let passed = 0;
  let total = 0;
  for (let i = 0; i < MULTILINGUAL_ROWS.length; i++) {
    total++;
    const actual = term.buffer.active.getLine(i)?.translateToString(true) ?? '';
    if (actual === MULTILINGUAL_ROWS[i].text) passed++;
  }

  const widthRow = MULTILINGUAL_ROWS.findIndex(({ id }) => id === 'width');
  const cols = term.cols;
  const widthCells = term.wasmTerm.getViewport().slice(widthRow * cols, (widthRow + 1) * cols);
  const wideText = widthCells
    .filter(({ width }) => width === 2)
    .map(({ codepoint }) => String.fromCodePoint(codepoint))
    .join('');
  total++;
  if (wideText === '漢字絵한') passed++;

  term.select(7, widthRow, 4);
  total++;
  if (term.getSelection() === '漢字') passed++;
  term.clearSelection();

  const hebrewRow = MULTILINGUAL_ROWS.findIndex(({ id }) => id === 'hebrew');
  term.select(8, hebrewRow, 4);
  total++;
  if (term.getSelection() === 'שלום') passed++;
  term.clearSelection();
  term.renderer.invalidate();

  const baseStatus = `Running locally in your browser · ${term.renderer.constructor.name} · ${passed}/${total} multilingual & BiDi checks passed.`;
  statusEl.textContent = baseStatus;

  term.onSelectionChange(() => {
    const sel = term.getSelection();
    if (sel) {
      const cps = Array.from(sel)
        .slice(0, 12)
        .map((ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'))
        .join(' ');
      statusEl.textContent = `Selected (${Array.from(sel).length} codepoints): "${sel}" [${cps}]`;
    } else {
      statusEl.textContent = baseStatus;
    }
  });
}

function runColorsDemo(term) {
  const R = '\x1b[0m';
  const B = '\x1b[1m';
  const ln = (s = '') => term.write(s + '\r\n');

  ln(`${B}\x1b[38;2;141;227;182m━━━ 16-Color ANSI Palette ━━━${R}`);
  let fgLine = '  FG: ';
  let bgLine = '  BG: ';
  for (let i = 0; i < 8; i++) {
    fgLine += `\x1b[3${i}m ██ ${R}`;
    bgLine += `\x1b[4${i}m    ${R}`;
  }
  fgLine += '  Bright: ';
  bgLine += '  Bright: ';
  for (let i = 0; i < 8; i++) {
    fgLine += `\x1b[9${i}m ██ ${R}`;
    bgLine += `\x1b[10${i}m    ${R}`;
  }
  ln(fgLine);
  ln(bgLine);
  ln();

  ln(`${B}\x1b[38;2;141;227;182m━━━ 256-Color 6×6×6 Cube & Grayscale Ramp ━━━${R}`);
  for (let row = 0; row < 6; row++) {
    let s = '  ';
    for (let col = 0; col < 36; col++) {
      const idx = 16 + row * 36 + col;
      s += `\x1b[48;5;${idx}m  ${R}`;
    }
    ln(s);
  }
  let gray = '  Gray: ';
  for (let i = 232; i < 256; i++) {
    gray += `\x1b[48;5;${i}m   ${R}`;
  }
  ln(gray);
  ln();

  ln(`${B}\x1b[38;2;141;227;182m━━━ 24-Bit Truecolor RGB Gradients ━━━${R}`);
  const width = Math.min(72, Math.max(40, term.cols - 4));
  let rainbow = '  ';
  let ocean = '  ';
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const r1 = Math.round(127.5 * (1 + Math.cos(2 * Math.PI * t)));
    const g1 = Math.round(127.5 * (1 + Math.cos(2 * Math.PI * (t - 1 / 3))));
    const b1 = Math.round(127.5 * (1 + Math.cos(2 * Math.PI * (t - 2 / 3))));
    const r2 = Math.round(20 + 60 * t);
    const g2 = Math.round(100 + 140 * Math.sin(Math.PI * t));
    const b2 = Math.round(180 + 75 * (1 - t));
    rainbow += `\x1b[38;2;${r1};${g1};${b1}m\x1b[48;2;${r2};${g2};${b2}m▀${R}`;
    ocean += `\x1b[48;2;${r2};${g2};${b2}m ${R}`;
  }
  ln(rainbow);
  ln(ocean);
  ln();

  ln(`${B}\x1b[38;2;141;227;182m━━━ SGR Text Attributes & Hyperlinks ━━━${R}`);
  ln(
    `  \x1b[1mBold\x1b[0m · \x1b[3mItalic\x1b[0m · \x1b[1;3mBold+Italic\x1b[0m · \x1b[2mFaint (0.5 alpha)\x1b[0m · \x1b[4mUnderline\x1b[0m · \x1b[9mStrikethrough\x1b[0m · \x1b[7mInverse\x1b[0m · \x1b[5mBlink\x1b[0m`
  );
  ln(
    `  Links: https://github.com/NimbleTerminal/ntwebterm · \x1b]8;;https://github.com/NimbleTerminal/booba\x1b\\\x1b[38;2;141;227;182mOSC 8 Link: NimbleTerminal/booba ↗\x1b[0m\x1b]8;;\x1b\\`
  );

  statusEl.textContent = `Running locally in your browser · ${term.renderer.constructor.name} · Truecolor, 256-color, SGR attributes & links active.`;
}

function runBoxesDemo(term) {
  const R = '\x1b[0m';
  const C1 = '\x1b[38;2;141;227;182m';
  const C2 = '\x1b[38;2;120;180;255m';
  const C3 = '\x1b[38;2;255;180;120m';
  const C4 = '\x1b[38;2;210;150;255m';
  const lines = [
    `${C1}╭────────────────────╮${R}  ${C2}┌────────────────────┐${R}  ${C3}┏━━━━━━━━━━━━━━━━━━━━┓${R}  ${C4}╔════════════════════╗${R}`,
    `${C1}│ Rounded border     │${R}  ${C2}│ Light border       │${R}  ${C3}┃ Heavy border       ┃${R}  ${C4}║ Double border      ║${R}`,
    `${C1}├─────────┬──────────┤${R}  ${C2}├─────────┬──────────┤${R}  ${C3}┣━━━━━━━━━┳━━━━━━━━━━┫${R}  ${C4}╠═════════╦══════════╣${R}`,
    `${C1}│ Cell A  │ Cell B   │${R}  ${C2}│ Cell A  │ Cell B   │${R}  ${C3}┃ Cell A  ┃ Cell B   ┃${R}  ${C4}║ Cell A  ║ Cell B   ║${R}`,
    `${C1}├─────────┼──────────┤${R}  ${C2}├─────────┼──────────┤${R}  ${C3}┣━━━━━━━━━╋━━━━━━━━━━┫${R}  ${C4}╠═════════╬══════════╣${R}`,
    `${C1}│ ╭─────╮ │ ╱╲╱╲╱╲   │${R}  ${C2}│ ┌─────┐ │ ┼─┼─┼─   │${R}  ${C3}┃ ┏━━━━━┓ ┃ ╋━╋━╋━   ┃${R}  ${C4}║ ╔═════╗ ║ ╬═╬═╬═   ║${R}`,
    `${C1}│ ╰─────╯ │ ╲╱╲╱╲╱   │${R}  ${C2}│ └─────┘ │ ├─┴─┼─   │${R}  ${C3}┃ ┗━━━━━┛ ┃ ┣━┻━╋━   ┃${R}  ${C4}║ ╚═════╝ ║ ╠═╩═╬═   ║${R}`,
    `${C1}╰─────────┴──────────╯${R}  ${C2}└─────────┴──────────┘${R}  ${C3}┗━━━━━━━━━┻━━━━━━━━━━┛${R}  ${C4}╚═════════╩══════════╝${R}`,
    '',
    `\x1b[1;38;2;141;227;182mBlock Elements (U+2580..U+259F) & Shades (U+2591..U+2593)\x1b[0m`,
    `  Vertical eighths : ${C1}▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▁▂▃▄▅▆▇█▇▆▅▄▃▂▁${R}   Shades: ${C2}░░▒▒▓▓██▓▓▒▒░░${R}`,
    `  Horizontal 1/8ths: ${C3}▏▎▍▌▋▊▉█${R}   Quadrants: ${C4}▖ ▗ ▘ ▝ ▚ ▞ ▙ ▛ ▜ ▟${R}`,
    '',
    `\x1b[1;38;2;141;227;182mSeamless Half-Block (▀) Canvas & Shader Rendering\x1b[0m`,
  ];

  for (let row = 0; row < 4; row++) {
    let bar = '  ';
    for (let x = 0; x < 64; x++) {
      const yTop = row * 2;
      const yBot = row * 2 + 1;
      const waveTop = Math.sin(x * 0.18 + yTop * 0.4) * 0.5 + 0.5;
      const waveBot = Math.sin(x * 0.18 + yBot * 0.4) * 0.5 + 0.5;
      const rT = Math.round(40 + 180 * waveTop);
      const gT = Math.round(90 + 130 * (1 - waveTop));
      const bT = Math.round(160 + 80 * (x / 64));
      const rB = Math.round(40 + 180 * waveBot);
      const gB = Math.round(90 + 130 * (1 - waveBot));
      const bB = Math.round(160 + 80 * (x / 64));
      bar += `\x1b[38;2;${rT};${gT};${bT}m\x1b[48;2;${rB};${gB};${bB}m▀${R}`;
    }
    lines.push(bar);
  }

  term.write(lines.join('\r\n') + '\r\n');
  statusEl.textContent = `Running locally in your browser · ${term.renderer.constructor.name} · Procedural box-drawing & block-element rendering active.`;
}

function runKittyDemo(term) {
  const R = '\x1b[0m';
  const B = '\x1b[1;38;2;141;227;182m';
  term.write(
    `${B}Kitty Graphics Protocol — Z-Layer Compositing & Virtual Placeholders${R}\r\n` +
      `Three 24×24 RGBA images placed across 12×5 cells at different z-indices:\r\n\r\n`
  );

  const imgW = 24;
  const imgH = 24;
  const layers = [
    { id: 1, col: 3, z: -2147483648, label: 'z < -2³⁰ (Under BG)', variant: 0 },
    { id: 2, col: 25, z: -1, label: 'z = -1 (Under Text)', variant: 1 },
    { id: 3, col: 47, z: 1, label: 'z = +1 (Over Text)', variant: 2 },
  ];

  for (const layer of layers) {
    const b64 = makeRgbaGradientBase64(imgW, imgH, layer.variant);
    term.write(`\x1b[4;${layer.col}H\x1b[1m${layer.label}\x1b[0m`);
    term.write(
      `\x1b[5;${layer.col}H\x1b_Ga=T,f=32,s=${imgW},v=${imgH},i=${layer.id},c=18,r=6,C=1,z=${layer.z};${b64}\x1b\\`
    );
    term.write(
      `\x1b[7;${layer.col + 2}H\x1b[48;2;20;95;60m\x1b[38;2;255;255;255m\x1b[1m   CELL BG + FG   \x1b[0m`
    );
    term.write(`\x1b[8;${layer.col + 2}H\x1b[38;2;255;255;255m\x1b[1m   DEFAULT BG     \x1b[0m`);
  }

  // Unicode virtual placement (U+10EEEE + row/col diacritics)
  const vImg = makeRgbaGradientBase64(16, 16, 0);
  term.write(`\x1b_Ga=T,f=32,s=16,v=16,i=9,U=1,c=8,r=2,q=2;${vImg}\x1b\\`);
  const P = String.fromCodePoint(0x10eeee);
  const d0 = String.fromCodePoint(0x0305); // index 0
  const d1 = String.fromCodePoint(0x030d); // index 1
  const cols8 = [0x0305, 0x030d, 0x030e, 0x0310, 0x0312, 0x033d, 0x033e, 0x033f].map((cp) =>
    String.fromCodePoint(cp)
  );
  const row0 = cols8.map((c) => P + d0 + c).join('');
  const row1 = cols8.map((c) => P + d1 + c).join('');

  term.write(`\x1b[13;3H${B}Unicode Virtual Placement (U+10EEEE + row/col diacritics):${R}`);
  term.write(`\x1b[14;3H╭────────╮`);
  term.write(
    `\x1b[15;3H│\x1b[38;5;9m${row0}\x1b[0m│  ← Image slices live inside ordinary text cells`
  );
  term.write(`\x1b[16;3H│\x1b[38;5;9m${row1}\x1b[0m│    and reflow/scroll with the text grid.`);
  term.write(`\x1b[17;3H╰────────╯\r\n`);

  statusEl.textContent = `Running locally in your browser · ${term.renderer.constructor.name} · Kitty graphics z-layering & virtual placements active.`;
}

function runScrollbackDemo(term) {
  const R = '\x1b[0m';
  const C = '\x1b[38;2;141;227;182m';
  const D = '\x1b[2m';

  for (let i = 1; i <= 80; i++) {
    const pct = Math.min(100, Math.round((i / 80) * 100));
    const filled = Math.round((pct / 100) * 20);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    const tag = i % 3 === 0 ? '\x1b[33mWARN\x1b[0m' : '\x1b[32mINFO\x1b[0m';
    term.write(
      `${D}[${String(i).padStart(3, '0')}/080]${R} ${tag}  frame=${i * 16}ms  ${C}${bar}${R} ${String(pct).padStart(3, ' ')}%  · Scroll up to inspect history\r\n`
    );
  }

  term.write(
    `\r\n\x1b[1;38;2;141;227;182m╭──────────────────────────────────────────────────────────────────────╮\x1b[0m\r\n` +
      `\x1b[1;38;2;141;227;182m│\x1b[0m  \x1b[1mntwebterm Interactive Local Prompt\x1b[0m (80 lines of scrollback above)  \x1b[1;38;2;141;227;182m│\x1b[0m\r\n` +
      `\x1b[1;38;2;141;227;182m│\x1b[0m  Commands: \x1b[36mhelp\x1b[0m · \x1b[36mcolors\x1b[0m · \x1b[36mbidi\x1b[0m · \x1b[36mboxes\x1b[0m · \x1b[36mhistory\x1b[0m · \x1b[36mclear\x1b[0m             \x1b[1;38;2;141;227;182m│\x1b[0m\r\n` +
      `\x1b[1;38;2;141;227;182m╰──────────────────────────────────────────────────────────────────────╯\x1b[0m\r\n`
  );

  const prompt = `\x1b[1;38;2;141;227;182mntwebterm>\x1b[0m `;
  let line = '';
  const history = [];
  let histIdx = -1;

  const showPrompt = () => term.write(prompt);
  showPrompt();

  const replaceLine = (next) => {
    term.write('\r\x1b[2K' + prompt + next);
    line = next;
  };

  term.onData((data) => {
    const escaped = Array.from(data)
      .map((ch) => {
        const code = ch.charCodeAt(0);
        if (code === 0x1b) return '\\x1b';
        if (code < 0x20 || code === 0x7f) return `\\x${code.toString(16).padStart(2, '0')}`;
        return ch;
      })
      .join('');
    statusEl.textContent = `Key input encoded → "${escaped}" · Scrollback: ${term.buffer.scrollback.length} lines`;

    if (data === '\r') {
      term.write('\r\n');
      const cmd = line.trim();
      if (cmd) {
        history.push(cmd);
        histIdx = history.length;
      }
      line = '';
      if (cmd === 'help') {
        term.write(
          `  Available commands:\r\n` +
            `    \x1b[36mhelp\x1b[0m     Show this message\r\n` +
            `    \x1b[36mcolors\x1b[0m   Print a 24-bit RGB gradient bar\r\n` +
            `    \x1b[36mbidi\x1b[0m     Print mixed LTR + Hebrew + shaped Arabic text\r\n` +
            `    \x1b[36mboxes\x1b[0m    Print box-drawing and block elements\r\n` +
            `    \x1b[36mhistory\x1b[0m  Show entered commands\r\n` +
            `    \x1b[36mclear\x1b[0m    Clear the screen\r\n`
        );
      } else if (cmd === 'colors') {
        let bar = '  ';
        for (let i = 0; i < 48; i++) {
          const r = Math.round(255 * (1 - i / 47));
          const g = Math.round(255 * Math.sin((i / 47) * Math.PI));
          const b = Math.round(255 * (i / 47));
          bar += `\x1b[48;2;${r};${g};${b}m \x1b[0m`;
        }
        term.write(bar + '\r\n');
      } else if (cmd === 'bidi') {
        term.write('  Mixed BiDi & Shaping: abc שלום 123 مرحبا بالعالم (mirrored) xyz\r\n');
      } else if (cmd === 'boxes') {
        term.write(
          '  ╭──┬──╮  ┏━━┳━━┓  ╔══╦══╗  ▁▂▃▄▅▆▇█  ░░▒▒▓▓██\r\n  ╰──┴──╯  ┗━━┻━━┛  ╚══╩══╝\r\n'
        );
      } else if (cmd === 'history') {
        history.forEach((h, i) => term.write(`  ${i + 1}  ${h}\r\n`));
      } else if (cmd === 'clear') {
        term.write('\x1b[2J\x1b[H');
      } else if (cmd) {
        term.write(`  Echo: ${cmd}\r\n`);
      }
      showPrompt();
    } else if (data === '\x03') {
      term.write('^C\r\n');
      line = '';
      showPrompt();
    } else if (data === '\x0c') {
      term.write('\x1b[2J\x1b[H');
      replaceLine(line);
    } else if (data === '\x7f' || data === '\b') {
      if (line.length > 0) {
        line = Array.from(line).slice(0, -1).join('');
        replaceLine(line);
      }
    } else if (data === '\x1b[A') {
      if (history.length > 0 && histIdx > 0) {
        histIdx--;
        replaceLine(history[histIdx]);
      }
    } else if (data === '\x1b[B') {
      if (histIdx < history.length - 1) {
        histIdx++;
        replaceLine(history[histIdx]);
      } else {
        histIdx = history.length;
        replaceLine('');
      }
    } else if (!data.startsWith('\x1b')) {
      line += data;
      term.write(data);
    }
  });

  statusEl.textContent = `Running locally in your browser · ${term.renderer.constructor.name} · Type at the prompt or scroll up (${term.buffer.scrollback.length} scrollback lines).`;
}

async function main() {
  const { api, ghostty, hasLocalBundle } = await loadRuntime();
  const isMultilingual = activeDemo === 'multilingual';
  const corpus = isMultilingual ? await loadMultilingualCorpus(hasLocalBundle) : null;

  const container = document.querySelector('#terminal');
  const term = new api.Terminal({
    ghostty,
    cols: 88,
    rows: 24,
    fontSize: 15,
    fontFamily: corpus
      ? corpus.TEST_FONT_FAMILY
      : '"JetBrains Mono", "SF Mono", "Menlo", "Consolas", monospace',
    fontFaces: corpus ? corpus.TEST_FONT_FACES : undefined,
    renderer: api.parseRendererFromURL() ?? 'auto',
    cursorBlink: activeDemo === 'scrollback',
    scrollback: 2000,
    theme: {
      background: '#0d1117',
      foreground: '#e4e8ee',
      cursor: '#8de3b6',
      cursorAccent: '#0d1117',
      selectionBackground: '#264f78',
      selectionForeground: '#ffffff',
    },
  });

  const fitAddon = new api.FitAddon();
  term.loadAddon(fitAddon);
  await term.open(container);
  fitAddon.fit();
  fitAddon.observeResize();
  window.addEventListener('resize', () => fitAddon.fit());

  api.installRendererHud(term, {
    parent: document.querySelector('.terminal-frame'),
    position: 'absolute',
  });

  if (activeDemo !== 'scrollback') {
    term.write('\x1b[?25l');
  }

  if (activeDemo === 'multilingual') {
    await runMultilingualDemo(term, corpus);
  } else if (activeDemo === 'colors') {
    runColorsDemo(term);
  } else if (activeDemo === 'boxes') {
    runBoxesDemo(term);
  } else if (activeDemo === 'kitty') {
    runKittyDemo(term);
  } else if (activeDemo === 'scrollback') {
    runScrollbackDemo(term);
    term.focus();
  }
}

main().catch((error) => {
  statusEl.dataset.error = '';
  statusEl.textContent = `Could not initialize terminal: ${error.message}`;
  console.error(error);
});
