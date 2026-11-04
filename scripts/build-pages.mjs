import { cp, mkdir, readdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const outDir = new URL('../dist/pages/', import.meta.url);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const file of ['index.html', 'site.css', 'site.js']) {
  await cp(new URL(`web/${file}`, root), new URL(file, outDir));
}

await cp(new URL('LICENSE', root), new URL('LICENSE', outDir));
await cp(new URL('demo/multilingual-corpus.js', root), new URL('multilingual-corpus.js', outDir));
await cp(new URL('demo/fonts', root), new URL('fonts', outDir), { recursive: true });

const distEntries = await readdir(new URL('dist', root));
for (const entry of distEntries) {
  if (
    entry === 'ntwebterm.js' ||
    entry === 'ghostty-vt.wasm' ||
    (entry.startsWith('__vite-') && entry.endsWith('.js'))
  ) {
    await cp(new URL(`dist/${entry}`, root), new URL(entry, outDir));
  }
}

console.log('✅ Built GitHub Pages site in dist/pages/');
