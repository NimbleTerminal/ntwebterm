import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  EXTENSIONS_PATH,
  MANIFEST_PATH,
  SYMBOLS_PATH,
  generateAbi,
  loadManifest,
} from '../scripts/gen-ghostty-abi';

const root = new URL('../', import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), 'utf8');

/** Instantiate the WASM with stub imports; enough to call pure exports. */
async function instantiateWasm(): Promise<WebAssembly.Exports> {
  const bytes = readFileSync(new URL('ghostty-vt.wasm', root));
  const stubs = new Proxy({}, { get: () => () => 0 });
  const { instance } = await WebAssembly.instantiate(bytes, new Proxy({}, { get: () => stubs }));
  return instance.exports;
}

/** Read the NUL-terminated JSON string returned by ghostty_type_json(). */
function readTypeJson(exports: WebAssembly.Exports): string {
  const typeJson = exports.ghostty_type_json as () => number;
  const memory = exports.memory as WebAssembly.Memory;
  const ptr = typeJson();
  const bytes = new Uint8Array(memory.buffer);
  let end = ptr;
  while (bytes[end] !== 0) end++;
  return new TextDecoder().decode(bytes.subarray(ptr, end));
}

describe('generated libghostty ABI bindings', () => {
  test('lib/ghostty-abi.ts is up to date with the pinned upstream manifest', async () => {
    const expected = await generateAbi(loadManifest());
    const actual = read('lib/ghostty-abi.ts');
    // On mismatch: bun run gen:abi
    expect(actual).toBe(expected);
  });

  test('the built WASM embeds the frozen manifest plus the local patch extensions', async () => {
    const embedded = JSON.parse(readTypeJson(await instantiateWasm()));
    const manifest = loadManifest();
    expect(embedded.schema).toBe(manifest.schema);
    expect(embedded.abi).toEqual(manifest.abi);
    // Compare type by type so a mismatch names the type instead of dumping 75 KB.
    const names = new Set([...Object.keys(embedded.types), ...Object.keys(manifest.types)]);
    for (const name of names) {
      expect(embedded.types[name], name).toEqual(manifest.types[name]);
    }
  });

  test('the patch extension file only adds to upstream types', () => {
    const upstream = JSON.parse(read(MANIFEST_PATH)).types;
    const extensions = JSON.parse(read(EXTENSIONS_PATH));
    for (const [name, ext] of Object.entries<Record<string, unknown>>(extensions)) {
      const base = upstream[name];
      if (base === undefined) continue; // brand-new type is fine
      for (const [field, value] of Object.entries(ext)) {
        if (field === 'values' || field === 'keys') {
          for (const member of Object.keys(value as object)) {
            expect(base[field]?.[member], `${name}.${field}.${member}`).toBeUndefined();
          }
        } else {
          expect(base[field], `${name}.${field}`).toEqual(value);
        }
      }
    }
  });

  test('every declared WASM export is a real symbol', async () => {
    // The names in GhosttyWasmExports (lib/types.ts) are the only link between
    // TypeScript and the binary, so check each one against upstream's frozen
    // symbol list (or the patch's ghostty_wasm_* helpers) and the built WASM.
    const source = read('lib/types.ts');
    const block = source.slice(source.indexOf('interface GhosttyWasmExports'));
    const declared = [...block.matchAll(/^\s+(ghostty_\w+)\??\s*[(:]/gm)].map((m) => m[1]!);
    expect(declared.length).toBeGreaterThan(50);

    const upstreamSymbols = new Set(read(SYMBOLS_PATH).split('\n').filter(Boolean));
    const binaryExports = new Set(Object.keys(await instantiateWasm()));

    const unknown = declared.filter(
      (name) => !upstreamSymbols.has(name) && !name.startsWith('ghostty_wasm_')
    );
    expect(unknown).toEqual([]);
    const missing = declared.filter((name) => !binaryExports.has(name));
    expect(missing).toEqual([]);
  });
});
