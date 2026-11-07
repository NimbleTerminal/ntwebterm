import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Ghostty } from './ghostty';
import { createIsolatedTerminal } from './test-helpers';

/** The version the pinned headers declare (GHOSTTY_VT_VERSION_* in version.h). */
function headerVersion(): { major: number; minor: number; patch: number } {
  const source = readFileSync(
    new URL('../ghostty/include/ghostty/vt/version.h', import.meta.url),
    'utf8'
  );
  const macro = (name: string) =>
    Number(source.match(new RegExp(`#define GHOSTTY_VT_VERSION_${name} (\\d+)`))![1]);
  return { major: macro('MAJOR'), minor: macro('MINOR'), patch: macro('PATCH') };
}

describe('libghostty-vt version and build info', () => {
  test('Ghostty.version reports the version of the loaded library', async () => {
    const ghostty = await Ghostty.load();
    const { major, minor, patch } = headerVersion();
    expect(ghostty.version.startsWith(`${major}.${minor}.${patch}`)).toBe(true);
  });

  test('Ghostty.buildInfo decodes every ghostty_build_info() field', async () => {
    const ghostty = await Ghostty.load();
    const info = ghostty.buildInfo;
    expect(info.version).toBe(ghostty.version);
    expect({ major: info.major, minor: info.minor, patch: info.patch }).toEqual(headerVersion());
    // A release has no pre-release or build suffix; a dev build carries both in the string.
    const suffix = (info.pre ? `-${info.pre}` : '') + (info.build ? `+${info.build}` : '');
    expect(info.version).toBe(`${info.major}.${info.minor}.${info.patch}${suffix}`);
    expect(['debug', 'release_safe', 'release_small', 'release_fast']).toContain(info.optimize);
    expect(typeof info.simd).toBe('boolean');
    // Features this binding relies on must be compiled in.
    expect(info.features).toMatchObject({
      renderState: true,
      inputEncode: true,
      gridIntrospection: true,
      kittyGraphics: true, // enabled on wasm32 by patches/ghostty-wasm-api.patch
    });
    for (const value of Object.values(info.features)) expect(typeof value).toBe('boolean');
  });

  test('buildInfo is read once and reused', async () => {
    const ghostty = await Ghostty.load();
    expect(ghostty.buildInfo).toBeDefined();
    expect(ghostty.buildInfo).toBe(ghostty.buildInfo);
  });

  test('Terminal surfaces the library version before and after open()', async () => {
    const term = await createIsolatedTerminal({ cols: 20, rows: 5 });
    const { major, minor, patch } = headerVersion();
    expect(term.ghosttyVersion.startsWith(`${major}.${minor}.${patch}`)).toBe(true);
    expect(term.ghosttyBuildInfo.features.renderState).toBe(true);
    await term.open(document.createElement('div'));
    expect(term.ghosttyVersion).toBe(term.ghosttyBuildInfo.version);
    term.dispose();
  });
});
