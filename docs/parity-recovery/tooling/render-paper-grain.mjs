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

await mkdir(OUT, { recursive: true });
const { chromium } = await import(pathToFileURL(path.join(PLAYWRIGHT_ROOT, 'index.mjs')).href);
const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_EXECUTABLE });
try {
  for (const scale of [1, 3]) {
    const context = await browser.newContext({
      viewport: { width: 260, height: 260 },
      deviceScaleFactor: scale,
    });
    const page = await context.newPage();
    for (const variant of variants) {
      await page.setContent(`
        <style>
          * { box-sizing: border-box; }
          html, body { margin: 0; background: transparent; }
          #tile { position: relative; width: 240px; height: 240px; background: ${variant.background}; overflow: hidden; }
          #tile::before {
            content: "";
            position: absolute;
            inset: 0;
            opacity: ${variant.opacity};
            mix-blend-mode: ${variant.blend};
            background-image: ${GRAIN};
            background-position: 0 -44px;
            background-size: 240px 240px;
          }
        </style>
        <div id="tile"></div>
      `);
      const densitySuffix = scale === 1 ? '' : '@3x';
      await page.locator('#tile').screenshot({
        path: path.join(OUT, `paper-grain-${variant.name}${densitySuffix}.png`),
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

