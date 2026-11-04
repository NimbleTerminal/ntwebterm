// Run with Vite on port 8000. Set PLAYWRIGHT_MODULE to an existing Playwright install if needed.
import { mkdir, writeFile } from 'node:fs/promises';
import { MULTILINGUAL_ROWS, TEST_FONT_FACES } from '../demo/multilingual-corpus.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const update = process.argv.includes('--update');
const output = new URL(
  update ? '../bench/results/multilingual/' : '../.vite/multilingual/',
  import.meta.url
);
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const dpr of [1, 1.25, 2]) {
    const context = await browser.newContext({
      deviceScaleFactor: dpr,
      viewport: { width: 1100, height: 900 },
    });
    for (const fontSize of [14, 20]) {
      for (const renderer of ['canvas2d', 'webgl', 'webgpu']) {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(
          `http://localhost:8000/demo/multilingual-renderer-check.html?renderer=${renderer}&size=${fontSize}`
        );
        await page.waitForFunction(() => window.result, undefined, { timeout: 15000 });
        const result = await page.evaluate(() => window.result);
        if (errors.length > 0) throw new Error(errors.join('\n'));
        if (result.error) throw new Error(result.error);
        if (!result.passed) {
          throw new Error(
            JSON.stringify(
              result.checks.filter(({ passed }) => !passed),
              null,
              2
            )
          );
        }
        const expectedBackend = {
          canvas2d: 'CanvasRenderer',
          webgl: 'WebGL2Renderer',
          webgpu: 'WebGPURenderer',
        }[renderer];
        if (result.backend !== expectedBackend) {
          throw new Error(`${renderer}: initialized ${result.backend}`);
        }
        const unloaded = result.fonts.filter(({ loaded }) => !loaded);
        if (unloaded.length > 0) {
          throw new Error(`Fonts not loaded: ${unloaded.map(({ family }) => family).join(', ')}`);
        }

        const cdp = await context.newCDPSession(page);
        await cdp.send('DOM.enable');
        await cdp.send('CSS.enable');
        const { root } = await cdp.send('DOM.getDocument');
        result.platformFonts = {};
        for (const { id } of MULTILINGUAL_ROWS) {
          const { nodeId } = await cdp.send('DOM.querySelector', {
            nodeId: root.nodeId,
            selector: `#probe-${id}`,
          });
          if (!nodeId) throw new Error(`Missing font probe: ${id}`);
          const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
          result.platformFonts[id] = fonts;
          const unexpected = fonts.filter(
            ({ familyName, isCustomFont }) =>
              !isCustomFont || !TEST_FONT_FACES.some(({ family }) => family === familyName)
          );
          if (unexpected.length > 0) {
            throw new Error(`${id}: system font fallback: ${JSON.stringify(unexpected)}`);
          }
        }
        await cdp.detach();

        result.renderer = renderer;
        await page
          .locator('#terminal canvas')
          .first()
          .screenshot({ path: new URL(`${renderer}-${fontSize}-${dpr}.png`, output).pathname });
        results.push(result);
        console.log(`${renderer} ${fontSize}px dpr=${dpr}: ${result.backend}`);
        await page.close();
      }
    }
    await context.close();
  }
  await writeFile(
    new URL('results.json', output),
    JSON.stringify(
      {
        browser: `Chrome ${browser.version()}`,
        platform: process.platform,
        arch: process.arch,
        results,
      },
      null,
      2
    ) + '\n'
  );
} finally {
  await browser.close();
}

if (!update) await import('./multilingual-assert.mjs');
