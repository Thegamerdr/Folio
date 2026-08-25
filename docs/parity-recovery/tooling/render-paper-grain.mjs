#!/usr/bin/env node

/** Render the pinned source's paper-grain pseudo-element as native 1x/3x repeat tiles. */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const PLAYWRIGHT_ROOT =
  process.env.MELO_PLAYWRIGHT_ROOT ??
  'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const CHROMIUM_EXECUTABLE =
  process.env.MELO_CHROMIUM_EXECUTABLE ??
  'C:/Users/User/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const OUT = path.join(ROOT, 'apps/mobile/assets/material');
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.42  0 0 0 0 0.39  0 0 0 0 0.34  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const variants = [
  { name: 'light', background: '#EFEBE1', opacity: 0.5, blend: 'multiply' },
  { name: 'dark', background: '#14100D', opacity: 0.28, blend: 'screen' },
];

function materialMarkup(variant, width, height, backgroundPositionY) {
  return `
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; background: transparent; }
      #material { position: relative; width: ${width}px; height: ${height}px; background: ${variant.background}; overflow: hidden; }
      #material::before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: ${variant.opacity};
        mix-blend-mode: ${variant.blend};
        background-image: ${GRAIN};
        background-position: 0 ${backgroundPositionY}px;
        background-size: 240px 240px;
      }
    </style>
    <div id="material"></div>
  `;
}

await mkdir(OUT, { recursive: true });
const { chromium } = await import(pathToFileURL(path.join(PLAYWRIGHT_ROOT, 'index.mjs')).href);
const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_EXECUTABLE });
try {
  for (const scale of [1, 3]) {
    const context = await browser.newContext({
      viewport: { width: 400, height: 780 },
      deviceScaleFactor: scale,
    });
    const page = await context.newPage();
    for (const variant of variants) {
      const densitySuffix = scale === 1 ? '' : '@3x';
      await page.setContent(materialMarkup(variant, 240, 240, -44));
      await page.locator('#material').screenshot({
        path: path.join(OUT, `paper-grain-${variant.name}${densitySuffix}.png`),
      });
      // Native's edge-to-edge frame is 360x740dp on the S9 acceptance viewport. Its 24dp status
      // inset must meet the pinned source product at the source glass's 44dp status boundary, so
      // advance the deterministic texture by 20dp.
      await page.setContent(materialMarkup(variant, 360, 740, -20));
      await page.locator('#material').screenshot({
        path: path.join(OUT, `paper-canvas-${variant.name}${densitySuffix}.png`),
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
