import { readFile } from 'node:fs/promises';
import { decode } from 'fast-png';

const goldenRoot = new URL('../bench/results/multilingual/', import.meta.url);
const currentRoot = new URL('../.vite/multilingual/', import.meta.url);
const read = (root, name) => readFile(new URL(name, root));
const golden = JSON.parse(await read(goldenRoot, 'results.json'));
const current = JSON.parse(await read(currentRoot, 'results.json'));

if (golden.platform !== current.platform || golden.arch !== current.arch) {
  throw new Error(
    `Golden platform is ${golden.platform}/${golden.arch}; current platform is ${current.platform}/${current.arch}`
  );
}
if (golden.results.length !== current.results.length) {
  throw new Error('Multilingual result counts differ');
}

const channelThreshold = 32;
const maxChangedRatio = 0.001;
let cases = 0;
for (let i = 0; i < current.results.length; i++) {
  const after = current.results[i];
  const before = golden.results[i];
  const name = `${after.renderer}-${after.fontSize}-${after.dpr}`;
  if (`${before.renderer}-${before.fontSize}-${before.dpr}` !== name) {
    throw new Error(`Multilingual case order differs at ${name}`);
  }
  if (!after.passed) throw new Error(`${name}: semantic checks failed`);
  if (JSON.stringify(before.metrics) !== JSON.stringify(after.metrics)) {
    throw new Error(`${name}: cell metrics changed`);
  }

  const oldImage = decode(await read(goldenRoot, `${name}.png`));
  const newImage = decode(await read(currentRoot, `${name}.png`));
  if (
    oldImage.width !== newImage.width ||
    oldImage.height !== newImage.height ||
    oldImage.channels !== newImage.channels
  ) {
    throw new Error(`${name}: canvas dimensions or pixel format changed`);
  }
  let changed = 0;
  const pixels = oldImage.width * oldImage.height;
  for (let pixel = 0; pixel < pixels; pixel++) {
    const offset = pixel * oldImage.channels;
    let delta = 0;
    for (let channel = 0; channel < oldImage.channels; channel++) {
      delta = Math.max(
        delta,
        Math.abs(oldImage.data[offset + channel] - newImage.data[offset + channel])
      );
    }
    if (delta > channelThreshold) changed++;
  }
  const changedRatio = changed / pixels;
  if (changedRatio > maxChangedRatio) {
    throw new Error(
      `${name}: ${(changedRatio * 100).toFixed(3)}% of pixels changed (limit ${maxChangedRatio * 100}%)`
    );
  }
  cases++;
}
console.log(`${cases} multilingual renderer cases passed semantic, font, metric, and pixel checks`);
