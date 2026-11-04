import { mkdir, writeFile } from 'node:fs/promises';
import { MULTILINGUAL_ROWS, TEST_FONT_FACES } from '../demo/multilingual-corpus.js';

const output = new URL('../demo/fonts/', import.meta.url);
const userAgent =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const corpus = [...new Set(MULTILINGUAL_ROWS.flatMap(({ text }) => Array.from(text)))].join('');

await mkdir(output, { recursive: true });

for (const face of TEST_FONT_FACES) {
  const cssUrl = new URL('https://fonts.googleapis.com/css2');
  cssUrl.searchParams.set('family', face.googleFamily);
  cssUrl.searchParams.set('display', 'swap');
  cssUrl.searchParams.set('text', corpus);
  const cssResponse = await fetch(cssUrl, { headers: { 'User-Agent': userAgent } });
  if (!cssResponse.ok) throw new Error(`${face.family}: CSS HTTP ${cssResponse.status}`);
  const css = await cssResponse.text();
  const source = css.match(/src: url\((https:[^)]+)\) format\('woff2'\)/)?.[1];
  if (!source) throw new Error(`${face.family}: no WOFF2 source in ${css}`);

  const [fontResponse, licenseResponse] = await Promise.all([
    fetch(source),
    fetch(`https://raw.githubusercontent.com/google/fonts/main/${face.licensePath}`),
  ]);
  if (!fontResponse.ok) throw new Error(`${face.family}: font HTTP ${fontResponse.status}`);
  if (!licenseResponse.ok) {
    throw new Error(`${face.family}: license HTTP ${licenseResponse.status}`);
  }
  await writeFile(
    new URL(`${face.id}.woff2`, output),
    Buffer.from(await fontResponse.arrayBuffer())
  );
  await writeFile(new URL(`${face.id}-OFL.txt`, output), await licenseResponse.text());
  console.log(`${face.family}: ${face.id}.woff2`);
}
