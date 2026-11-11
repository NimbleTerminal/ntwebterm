import { expect, test } from 'bun:test';
import { deflateSync } from 'node:zlib';
import { encode as encodePng } from 'fast-png';
import { Ghostty, readPngHeader } from './ghostty';

const wasmPath = new URL('../ghostty-vt.wasm', import.meta.url).pathname;

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A valid 8-bit grayscale PNG of zeros: tiny on the wire, width*height when decoded. */
function blankPng(width: number, height: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth; color type 0 (grayscale) and the rest stay 0
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(new Uint8Array((width + 1) * height))),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function transmitPng(terminal: { write(data: string): void }, id: number, png: Uint8Array): void {
  const b64 = Buffer.from(png).toString('base64');
  const size = 4096;
  for (let i = 0; i < b64.length; i += size) {
    const more = i + size < b64.length ? 1 : 0;
    const control = i === 0 ? `a=t,f=100,i=${id},q=2,m=${more}` : `m=${more}`;
    terminal.write(`\x1b_G${control};${b64.slice(i, i + size)}\x1b\\`);
  }
}

test('readPngHeader reads IHDR dimensions and rejects non-PNG or out-of-range input', () => {
  expect(readPngHeader(blankPng(3, 2))).toEqual({ width: 3, height: 2 });
  expect(readPngHeader(new Uint8Array(64))).toBeNull();
  expect(readPngHeader(blankPng(3, 2).subarray(0, 20))).toBeNull();
  const huge = blankPng(1, 1);
  new DataView(huge.buffer).setUint32(16, 10001);
  expect(readPngHeader(huge)).toBeNull();
  const empty = blankPng(1, 1);
  new DataView(empty.buffer).setUint32(20, 0);
  expect(readPngHeader(empty)).toBeNull();
});

test('a PNG within the image storage limit is decoded and stored', async () => {
  const ghostty = await Ghostty.load(wasmPath);
  const terminal = ghostty.createTerminal(20, 8);
  try {
    const png = encodePng({
      width: 2,
      height: 1,
      data: new Uint8Array([9, 8, 7, 255, 1, 2, 3, 255]),
    });
    transmitPng(terminal, 7, png);
    const pixels = terminal.getKittyImagePixels(terminal.getKittyGraphics()!, 7)!;
    expect(pixels.width).toBe(2);
    expect(Array.from(pixels.data.subarray(0, 4))).toEqual([9, 8, 7, 255]);
  } finally {
    terminal.free();
  }
});

test('a PNG that declares more pixels than the storage limit is refused before decoding', async () => {
  const ghostty = await Ghostty.load(wasmPath);
  const terminal = ghostty.createTerminal(20, 8);
  try {
    // 5000 x 5000 is 100 MB of RGBA, over the 64 MB default, from ~25 KB of input.
    const bomb = blankPng(5000, 5000);
    expect(bomb.length).toBeLessThan(64 * 1024);
    const heap = () => ((ghostty as any).memory as WebAssembly.Memory).buffer.byteLength;
    const before = heap();
    transmitPng(terminal, 9, bomb);
    const graphics = terminal.getKittyGraphics();
    expect(graphics === null ? null : terminal.getKittyImagePixels(graphics, 9)).toBeNull();
    // Nothing the size of the decoded image was copied into the WASM heap.
    expect(heap() - before).toBeLessThan(8 * 1024 * 1024);
  } finally {
    terminal.free();
  }
});
