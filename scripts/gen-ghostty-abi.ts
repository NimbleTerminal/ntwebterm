#!/usr/bin/env bun
/**
 * Generates lib/ghostty-abi.ts from libghostty-vt's frozen wasm32 ABI manifest.
 *
 * Upstream publishes every enum value, struct layout and packed bit field in
 * ghostty/src/terminal/c/abi/wasm32-freestanding.json and gates changes to it
 * in CI. This script turns that manifest into TypeScript so nothing about the
 * C ABI is hand-mirrored here; a sync to a new upstream tag is "bump the
 * submodule, run `bun run gen:abi`, run the tests".
 *
 * Local additions from patches/ghostty-wasm-api.patch are described in
 * patches/ghostty-wasm-api.abi.json and merged on top. lib/ghostty-abi.test.ts
 * checks that the generated file is current and that the built WASM's own
 * ghostty_type_json() agrees with manifest + extensions.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

export const MANIFEST_PATH = 'ghostty/src/terminal/c/abi/wasm32-freestanding.json';
export const SYMBOLS_PATH = 'ghostty/src/terminal/c/abi/symbols.txt';
export const EXTENSIONS_PATH = 'patches/ghostty-wasm-api.abi.json';
export const OUTPUT_PATH = 'lib/ghostty-abi.ts';

const root = new URL('../', import.meta.url);

interface FieldInfo {
  offset: number;
  size: number;
  type: string;
}

interface BitInfo {
  lsb: number;
  width: number;
  type?: string;
  kind?: string;
}

export interface EnumType {
  kind: 'enum';
  size: number;
  align: number;
  underlying: string;
  prefix: string;
  values: Record<string, number>;
  keys?: Record<string, unknown>;
}

export interface StructType {
  kind: 'struct' | 'union';
  size: number;
  align: number;
  fields: Record<string, FieldInfo>;
}

export interface PackedType {
  kind: 'packed';
  size: number;
  align: number;
  underlying: string;
  bits: Record<string, BitInfo>;
}

export interface OtherType {
  kind: 'opaque' | 'alias' | 'callback';
  size: number;
  align: number;
  [extra: string]: unknown;
}

export type AbiType = EnumType | StructType | PackedType | OtherType;

export interface Manifest {
  schema: number;
  abi: {
    target: string;
    os: string;
    environment: string;
    pointer_size: number;
    usize_size: number;
    max_alignment: number;
    endian: string;
  };
  types: Record<string, AbiType>;
}

/**
 * Member names ntwebterm exposed before the bindings were generated. They are
 * emitted as deprecated duplicates so existing callers keep compiling; the
 * reverse mapping (GhosttyKey[1]) still resolves to the upstream name.
 */
const LEGACY_ALIASES: Record<string, Record<string, string>> = {
  GhosttyKey: {
    GRAVE: 'BACKQUOTE',
    ZERO: 'DIGIT_0',
    ONE: 'DIGIT_1',
    TWO: 'DIGIT_2',
    THREE: 'DIGIT_3',
    FOUR: 'DIGIT_4',
    FIVE: 'DIGIT_5',
    SIX: 'DIGIT_6',
    SEVEN: 'DIGIT_7',
    EIGHT: 'DIGIT_8',
    NINE: 'DIGIT_9',
    UP: 'ARROW_UP',
    DOWN: 'ARROW_DOWN',
    LEFT: 'ARROW_LEFT',
    RIGHT: 'ARROW_RIGHT',
    KP_0: 'NUMPAD_0',
    KP_1: 'NUMPAD_1',
    KP_2: 'NUMPAD_2',
    KP_3: 'NUMPAD_3',
    KP_4: 'NUMPAD_4',
    KP_5: 'NUMPAD_5',
    KP_6: 'NUMPAD_6',
    KP_7: 'NUMPAD_7',
    KP_8: 'NUMPAD_8',
    KP_9: 'NUMPAD_9',
    KP_PLUS: 'NUMPAD_ADD',
    KP_MINUS: 'NUMPAD_SUBTRACT',
    KP_MULTIPLY: 'NUMPAD_MULTIPLY',
    KP_DIVIDE: 'NUMPAD_DIVIDE',
    KP_PERIOD: 'NUMPAD_DECIMAL',
    KP_COMMA: 'NUMPAD_COMMA',
    KP_SEPARATOR: 'NUMPAD_SEPARATOR',
    KP_ENTER: 'NUMPAD_ENTER',
    KP_EQUAL: 'NUMPAD_EQUAL',
    KP_BACKSPACE: 'NUMPAD_BACKSPACE',
    KP_CLEAR: 'NUMPAD_CLEAR',
    KP_CLEAR_ENTRY: 'NUMPAD_CLEAR_ENTRY',
    KP_PAREN_LEFT: 'NUMPAD_PAREN_LEFT',
    KP_PAREN_RIGHT: 'NUMPAD_PAREN_RIGHT',
    KP_MEMORY_ADD: 'NUMPAD_MEMORY_ADD',
    KP_MEMORY_CLEAR: 'NUMPAD_MEMORY_CLEAR',
    KP_MEMORY_RECALL: 'NUMPAD_MEMORY_RECALL',
    KP_MEMORY_STORE: 'NUMPAD_MEMORY_STORE',
    KP_MEMORY_SUBTRACT: 'NUMPAD_MEMORY_SUBTRACT',
  },
  GhosttyKeyEncoderOption: { KITTY_KEYBOARD_FLAGS: 'KITTY_FLAGS' },
  GhosttyRenderStateDirty: { NONE: 'FALSE' },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursively merge `extension` into `base`; objects merge, everything else replaces. */
export function deepMerge<T>(base: T, extension: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(extension)) return extension as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(extension)) {
    out[key] = key in out ? deepMerge(out[key], value) : value;
  }
  return out as T;
}

/** The upstream manifest with the local patch extensions merged in. */
export function loadManifest(): Manifest {
  const manifest = JSON.parse(readFileSync(new URL(MANIFEST_PATH, root), 'utf8')) as Manifest;
  const extensions = JSON.parse(readFileSync(new URL(EXTENSIONS_PATH, root), 'utf8'));
  return { ...manifest, types: deepMerge(manifest.types, extensions) };
}

const isSentinel = (name: string) => name.endsWith('MAX_VALUE');

function emitEnum(name: string, type: EnumType): string {
  const members = Object.entries(type.values)
    .filter(([member]) => !isSentinel(member))
    .sort(([na, va], [nb, vb]) => va - vb || na.localeCompare(nb));
  const lines: string[] = [];
  const aliases = LEGACY_ALIASES[name] ?? {};
  for (const [alias, target] of Object.entries(aliases)) {
    if (!(target in type.values)) {
      throw new Error(`legacy alias ${name}.${alias} points at missing member ${target}`);
    }
    lines.push(`  /** @deprecated ntwebterm alias for {@link ${name}.${target}}. */`);
    lines.push(`  ${alias} = ${type.values[target]},`);
  }
  for (const [member, value] of members) lines.push(`  ${member} = ${value},`);
  return [
    `/** Mirrors the C enum ${name} (${type.prefix}*), ${type.underlying}. */`,
    `export enum ${name} {`,
    ...lines,
    '}',
  ].join('\n');
}

function emitLayout(name: string, type: StructType): string {
  const fields = Object.entries(type.fields);
  const offsets = fields.map(([field, info]) => `${field}: ${info.offset}`).join(', ');
  const sizes = fields.map(([field, info]) => `${field}: ${info.size}`).join(', ');
  return [
    `/** Layout of the C ${type.kind} ${name} on wasm32: ${type.size} bytes, ${type.align}-byte aligned. */`,
    `export const ${name}Layout = {`,
    `  size: ${type.size},`,
    `  align: ${type.align},`,
    `  offset: { ${offsets} },`,
    `  fieldSize: { ${sizes} },`,
    '} as const;',
  ].join('\n');
}

/** Packed types with nested unions (GhosttyCell) are read through accessors upstream; skip them. */
function isFlatPacked(type: PackedType): boolean {
  return Object.values(type.bits).every((bit) => bit.kind === undefined);
}

function emitPackedBits(name: string, type: PackedType): string {
  const lines: string[] = [];
  for (const [field, bit] of Object.entries(type.bits)) {
    const upper = field.toUpperCase();
    if (bit.width === 1) {
      lines.push(`  /** Bit ${bit.lsb}. */`);
      lines.push(`  ${upper} = 1 << ${bit.lsb},`);
    } else {
      const mask = `0x${((1 << bit.width) - 1).toString(16)}`;
      lines.push(`  /** Bits ${bit.lsb}..${bit.lsb + bit.width - 1} (${bit.type ?? 'uint'}). */`);
      lines.push(`  ${upper}_SHIFT = ${bit.lsb},`);
      lines.push(`  ${upper}_MASK = ${mask} << ${bit.lsb},`);
    }
  }
  return [
    `/** Bit fields of the packed C type ${name} (${type.underlying}). */`,
    `export enum ${name}Bit {`,
    ...lines,
    '}',
  ].join('\n');
}

/** Render the manifest as TypeScript, formatted with the repo's Prettier config. */
export async function generateAbi(manifest: Manifest): Promise<string> {
  const names = Object.keys(manifest.types).sort();
  const pick = <T extends AbiType>(kinds: string[]) =>
    names.filter((n) => kinds.includes(manifest.types[n]!.kind)) as [string, T][] & string[];

  const chunks: string[] = [
    '// GENERATED FILE - DO NOT EDIT.',
    `// Source: ${MANIFEST_PATH} (libghostty-vt frozen C ABI, schema ${manifest.schema})`,
    `//         plus ${EXTENSIONS_PATH} (additions from patches/ghostty-wasm-api.patch).`,
    `// Regenerate with \`bun run gen:abi\` (${'scripts/gen-ghostty-abi.ts'}); lib/ghostty-abi.test.ts`,
    '// fails when this file, the pinned submodule, or the built WASM disagree.',
    '',
    '/** Target description from the manifest. */',
    'export const GHOSTTY_ABI = {',
    `  schema: ${manifest.schema},`,
    `  target: '${manifest.abi.target}',`,
    `  os: '${manifest.abi.os}',`,
    `  pointerSize: ${manifest.abi.pointer_size},`,
    '} as const;',
  ];

  chunks.push('', '// ---- Enums ----');
  for (const name of pick(['enum']))
    chunks.push('', emitEnum(name, manifest.types[name] as EnumType));

  chunks.push('', '// ---- Packed bit fields ----');
  for (const name of pick(['packed'])) {
    const type = manifest.types[name] as PackedType;
    if (isFlatPacked(type)) chunks.push('', emitPackedBits(name, type));
  }

  chunks.push('', '// ---- Struct and union layouts ----');
  for (const name of pick(['struct', 'union'])) {
    chunks.push('', emitLayout(name, manifest.types[name] as StructType));
  }

  const outputPath = fileURLToPath(new URL(OUTPUT_PATH, root));
  const config = (await prettier.resolveConfig(outputPath)) ?? {};
  return prettier.format(`${chunks.join('\n')}\n`, { ...config, filepath: outputPath });
}

if (import.meta.main) {
  const manifest = loadManifest();
  const source = await generateAbi(manifest);
  writeFileSync(new URL(OUTPUT_PATH, root), source);
  const kinds = Object.values(manifest.types).reduce<Record<string, number>>((acc, t) => {
    acc[t.kind] = (acc[t.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`wrote ${OUTPUT_PATH} from ${MANIFEST_PATH}:`, kinds);
}
