#!/usr/bin/env node

/**
 * Capture a deterministic, data-matched surface from the immutable Lovable source checkout.
 *
 * The source repository is never edited. Its Vite modules are loaded in the browser, then the
 * canonical native-owned fixture manifest is applied through the source store's reversible
 * preview authority. The web prototype's four built-in bills remain implicit; fixtures.json
 * records the equivalent capture-only manual events supplied to native, including the pinned
 * prototype's UTC-slice date behavior.
 */
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const NATIVE_ROOT = path.resolve(import.meta.dirname, '../../..');
const DESIGN_ROOT = process.env.MELO_PINNED_DESIGN_ROOT ?? 'C:/dev/melo-design-source-ad90b4';
const PINNED_DESIGN_SHA = 'ad90b4fee36c58be156e145e8663d8c6be1bf0eb';
const PLAYWRIGHT_ROOT =
  process.env.MELO_PLAYWRIGHT_ROOT ??
  'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const CHROMIUM_EXECUTABLE =
  process.env.MELO_CHROMIUM_EXECUTABLE ??
  'C:/Users/User/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const FIXTURE_PATH = path.join(NATIVE_ROOT, 'apps/mobile/src/folio/parity/fixtures.json');
const PORT = Number.parseInt(process.env.MELO_SOURCE_CAPTURE_PORT ?? '4179', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REUSE_SERVER = process.env.MELO_SOURCE_CAPTURE_REUSE_SERVER === 'true';
// HeroPhone treats the query as an outer device, then subtracts 2x36 and adds a 4px iOS bezel.
// 370x756 therefore yields a 360x712 inner glass. Removing its 44px source status area leaves the
// exact 360x668 logical S9 product viewport, without any resampling.
const OUTER_FRAME = Object.freeze({ width: 368, height: 720 });
const INNER_GLASS = Object.freeze({ inset: 4, width: 360, height: 712 });
const PRODUCT = Object.freeze({ top: 44, width: 360, height: 668 });

function readArg(name, fallback) {
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  return inline === undefined ? fallback : inline.slice(name.length + 3);
}

const fixtureId = readArg('fixture', 'confirmed-safe');
const theme = readArg('theme', 'light');
const screen = readArg('screen', 'today');
const sheet = readArg('sheet', '');
const surface = readArg('surface', sheet || screen);
const renderedScreen = screen === 'today-mode' || screen === 'today-stability' ? 'today' : screen;
if (theme !== 'light' && theme !== 'dark') throw new Error(`Unsupported theme: ${theme}`);

const fixtureManifest = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
const fixture = fixtureManifest.fixtures[fixtureId];
if (fixture === undefined) throw new Error(`Unknown fixture: ${fixtureId}`);
if (
  fixture.kind !== 'personal' &&
  fixture.kind !== 'empty' &&
  fixture.kind !== 'first-run' &&
  fixture.kind !== 'business-empty' &&
  fixture.kind !== 'business-sole-trader' &&
  fixture.kind !== 'business-ltd'
) {
  throw new Error(`Source capture currently supports personal fixtures, not ${fixture.kind}.`);
}

const isBusinessFixture = fixture.kind.startsWith('business-');
const isPersonalFixture = fixture.kind === 'personal';
const businessState = fixtureManifest.designAdapter.businessStates?.[fixtureId] ?? null;
if (isBusinessFixture && fixture.kind !== 'business-empty' && businessState === null) {
  throw new Error(`No pinned-source Business adapter exists for fixture: ${fixtureId}`);
}

const actualSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: DESIGN_ROOT,
  encoding: 'utf8',
}).trim();
if (actualSha !== PINNED_DESIGN_SHA) {
  throw new Error(`Pinned source SHA mismatch: expected ${PINNED_DESIGN_SHA}, got ${actualSha}.`);
}

await access(path.join(DESIGN_ROOT, 'node_modules/vite/bin/vite.js'));
await access(path.join(PLAYWRIGHT_ROOT, 'index.mjs'));
await access(CHROMIUM_EXECUTABLE);
const { chromium } = await import(pathToFileURL(path.join(PLAYWRIGHT_ROOT, 'index.mjs')).href);

function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) return resolve();
      } catch {
        // Vite is still starting.
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}.`));
        return;
      }
      setTimeout(probe, 150);
    };
    void probe();
  });
}

const vite = REUSE_SERVER
  ? null
  : spawn(
      process.execPath,
      [
        path.join(DESIGN_ROOT, 'node_modules/vite/bin/vite.js'),
        '--host',
        '127.0.0.1',
        '--port',
        String(PORT),
      ],
      { cwd: DESIGN_ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
let viteOutput = '';
vite?.stdout.on('data', (chunk) => {
  viteOutput += chunk.toString();
});
vite?.stderr.on('data', (chunk) => {
  viteOutput += chunk.toString();
});

let browser;
try {
  await waitForServer(BASE_URL);
  browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_EXECUTABLE,
    args: ['--disable-gpu', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1800 },
    deviceScaleFactor: 3,
    locale: fixtureManifest.locale,
    timezoneId: fixtureManifest.timeZone,
    colorScheme: theme,
    reducedMotion: 'reduce',
  });

  await context.addInitScript(
    ({ nowISO, captureTheme, captureIsBusinessFixture, captureBusinessState }) => {
      const NativeDate = Date;
      const fixedTime = NativeDate.parse(nowISO);
      const FixedDate = new Proxy(NativeDate, {
        construct(target, args, newTarget) {
          return Reflect.construct(target, args.length === 0 ? [fixedTime] : args, newTarget);
        },
        apply(target, thisArg, args) {
          if (args.length === 0) return new NativeDate(fixedTime).toString();
          return Reflect.apply(target, thisArg, args);
        },
      });
      Object.defineProperty(FixedDate, 'now', { configurable: true, value: () => fixedTime });
      window.Date = FixedDate;
      localStorage.setItem('folio-theme', captureTheme);
      localStorage.setItem('folio-sound-enabled', 'false');
      if (captureIsBusinessFixture) {
        if (captureBusinessState === null) {
          localStorage.removeItem('folio.business.entity.v1');
        } else {
          localStorage.setItem('folio.business.entity.v1', JSON.stringify(captureBusinessState));
        }
      }
      let seed = 0x6d656c6f;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x1_0000_0000;
      };
    },
    {
      nowISO: fixtureManifest.nowISO,
      captureTheme: theme,
      captureIsBusinessFixture: isBusinessFixture,
      captureBusinessState: businessState,
    },
  );

  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const resourceFailures = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      resourceFailures.push({ status: response.status(), url: response.url() });
    }
  });

  const route = new URL(BASE_URL);
  route.searchParams.set('s', screen);
  if (sheet !== '') route.searchParams.set('sheet', sheet);
  route.searchParams.set('p', fixture.designPressure ?? 'safe');
  route.searchParams.set('device', '370x756');
  await page.goto(route.href, { waitUntil: 'networkidle' });
  const locator = page.locator(`[data-folio-screen="${renderedScreen}"]`);
  await locator.waitFor({ state: 'visible' });

  const engine = isBusinessFixture
    ? await page.evaluate(() => {
        const persisted = localStorage.getItem('folio.business.entity.v1');
        return {
          state: {
            businessState: persisted === null ? 'empty' : 'populated',
            persistedBusinessState: persisted === null ? null : JSON.parse(persisted),
          },
          events: [],
          route: null,
        };
      })
    : isPersonalFixture
      ? await page.evaluate(
        async ({ canonicalFixture, defaults, nowISO }) => {
          const store = await import('/src/lib/store.ts');
          const calendar = await import('/src/lib/calendar-events.ts');
          const subscriptions = canonicalFixture.subscriptions.map((row) => ({
            name: row.name,
            cost: row.cost,
            nextRenewalDaysAway: row.daysAway,
            lastUsedDaysAgo: 0,
            usesPerMonth: 1,
          }));
          const patch = {
            pots: canonicalFixture.pots ?? [],
            subs: subscriptions,
            subPaused: {},
            subOverrides: [],
            cycles: [],
            onboarding: {
              done: true,
              name: defaults.name,
              payday: canonicalFixture.payday,
              monthlyIncome: canonicalFixture.income,
              weekendRule: 'previous',
              paydayCadence: 'monthly',
              primerSeen: true,
              incomeStreams: [],
              persona: 'personal',
              createdAt: nowISO,
            },
            currentBalance: {
              amount: canonicalFixture.balance,
              source: canonicalFixture.balanceSource,
              confidence: canonicalFixture.confidence,
              setAt: nowISO,
            },
            potLedger: [],
            transactions: defaults.transactions,
            calendarEvents: [],
            tightPointGoal: null,
            moneyMode: 'survival',
            bufferAmount: 100,
            debts: canonicalFixture.debts ?? [],
            plans: canonicalFixture.plans ?? [],
            spendHold: null,
            whatIfHolds: [],
          };
          store.applyPreviewOverlay(patch);
          const nativeRandom = Math.random;
          let seed = defaults.randomSeed >>> 0;
          Math.random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x1_0000_0000;
          };
          try {
            store.enqueueReviewItems(
              (canonicalFixture.reviewItems ?? []).map(({ category: _category, ...item }) => item),
            );
          } finally {
            Math.random = nativeRandom;
          }
          const state = store.getState();
          const events = calendar.deriveCalendarEvents({
            subs: state.subs,
            subPaused: state.subPaused,
            subOverrides: state.subOverrides,
            onboarding: state.onboarding,
            manualEvents: state.calendarEvents,
            pots: state.pots,
            spendHold: state.spendHold,
            whatIfHolds: state.whatIfHolds,
            windowDays: 35,
            now: new Date(nowISO),
          });
          const routeResult = calendar.computeSpareAndTightest(
            calendar.groupByDay(events),
            state.currentBalance.amount,
          );
          return {
            state: {
              balance: state.currentBalance,
              onboarding: state.onboarding,
              subscriptions: state.subs,
              pots: state.pots,
              debts: state.debts,
              plans: state.plans,
              reviewQueue: state.reviewQueue,
              transactionCount: state.transactions.length,
              manualEventCount: state.calendarEvents.length,
            },
            events: events.map(({ date, title, amount, source }) => ({
              date,
              title,
              amount,
              source,
            })),
            route: routeResult,
          };
        },
        {
          canonicalFixture: fixture,
          defaults: {
            ...fixtureManifest.personalDefaults,
            randomSeed: fixtureManifest.randomSeed,
          },
          nowISO: fixtureManifest.nowISO,
        },
        )
      : {
          state: { fixtureKind: fixture.kind, onboardingDone: fixture.kind !== 'first-run' },
          events: [],
          route: null,
        };

  await page.addStyleTag({
    content: [
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
      '.iphone-glass{border-radius:0!important;box-shadow:none!important}',
      '.iphone-glass::after{display:none!important}',
    ].join(''),
  });
  await page.waitForTimeout(900);
  await locator.evaluate((node) => {
    const scroller = node.querySelector('[data-folio-scroll]');
    if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
    const glass = node.querySelector('.iphone-glass');
    if (glass instanceof HTMLElement) {
      for (const child of glass.children) {
        if (
          child.getAttribute('aria-hidden') === 'true' ||
          child.classList.contains('bottom-1.5')
        ) {
          child.setAttribute('style', 'display:none!important');
        }
      }
    }
  });
  await page.waitForTimeout(100);

  const box = await locator.boundingBox();
  if (box === null) throw new Error('Pinned source phone has no bounding box.');
  const rounded = { width: Math.round(box.width), height: Math.round(box.height) };
  if (rounded.width !== OUTER_FRAME.width || rounded.height !== OUTER_FRAME.height) {
    throw new Error(
      `Unexpected source frame ${box.width}x${box.height}; expected ${OUTER_FRAME.width}x${OUTER_FRAME.height}.`,
    );
  }

  const semanticGeometry = await page.evaluate(
    ({ originX, originY, captureScreen }) => {
      const screenNode = document.querySelector(`[data-folio-screen="${captureScreen}"]`);
      const normalize = (value) => value?.replace(/\s+/g, ' ').trim();
      const findButton = (copy) =>
        [...(screenNode?.querySelectorAll('button') ?? [])].find((node) =>
          normalize(node.textContent)?.includes(copy),
        );
      const findExactText = (copy) =>
        [...(screenNode?.querySelectorAll('*') ?? [])].find(
          (node) => normalize(node.textContent) === copy,
        );
      const describe = (node) => {
        if (!(node instanceof HTMLElement || node instanceof SVGElement)) return null;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          rectCssPx: {
            left: Number((rect.left - originX).toFixed(3)),
            top: Number((rect.top - originY).toFixed(3)),
            width: Number(rect.width.toFixed(3)),
            height: Number(rect.height.toFixed(3)),
          },
          typography: {
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontStyle: style.fontStyle,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
          },
          decoration: {
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            borderRadius: style.borderRadius,
            borderWidth: style.borderWidth,
            color: style.color,
          },
        };
      };
      return {
        header: describe(screenNode?.querySelector('header')),
        editorialTitle: describe(screenNode?.querySelector('header h1, header h2')),
        editorialNarrative: describe(screenNode?.querySelector('header p')),
        dominantCard: describe(findExactText('16 things still to leave')?.closest('.hairline')),
        dominantMoney: describe(findExactText('£1,421')),
        hero: describe(screenNode?.querySelector('[data-melo-exclude="hero"]')),
        heroHeadline: describe(screenNode?.querySelector('[data-melo-exclude="hero.headline"]')),
        heroMoney: describe(screenNode?.querySelector('[data-melo-exclude="hero.money"]')),
        heroMeta: describe(screenNode?.querySelector('[data-melo-exclude="hero.meta"]')),
        primaryDecision: describe(
          findButton('Can I spend something?') ?? findButton("See what's coming"),
        ),
        secondaryDecision: describe(findButton('See the working') ?? findButton('Try a change')),
        chart: describe(screenNode?.querySelector('[data-melo-exclude="chart"]')),
        chartHeader: describe(screenNode?.querySelector('[data-melo-exclude="chart.header"]')),
        chartPlot: describe(screenNode?.querySelector('[data-melo-exclude="chart.plot"]')),
        chartScrub: describe(screenNode?.querySelector('[data-melo-exclude="chart.scrub"]')),
        chartSummary: describe(screenNode?.querySelector('[data-melo-exclude="chart.summary"]')),
      };
    },
    {
      originX: box.x + INNER_GLASS.inset,
      originY: box.y + INNER_GLASS.inset + PRODUCT.top,
      captureScreen: renderedScreen,
    },
  );

  const outDir = path.join(
    NATIVE_ROOT,
    'docs/parity-recovery/evidence/design/ad90b4-matched-v1',
    fixtureId,
    theme,
    surface,
  );
  await mkdir(outDir, { recursive: true });
  await page.screenshot({
    path: path.join(outDir, 'source-frame-1104x2160.png'),
    clip: { x: box.x, y: box.y, width: OUTER_FRAME.width, height: OUTER_FRAME.height },
  });
  await page.screenshot({
    path: path.join(outDir, 'source-product-1080x2004.png'),
    clip: {
      x: box.x + INNER_GLASS.inset,
      y: box.y + INNER_GLASS.inset + PRODUCT.top,
      width: PRODUCT.width,
      height: PRODUCT.height,
    },
  });

  const metadata = {
    evidenceKind: 'matched-source-fixture',
    acceptanceEligible: true,
    fixtureSchemaVersion: fixtureManifest.schemaVersion,
    fixtureId,
    theme,
    surface,
    screen,
    sheet: sheet || null,
    sourceSha: actualSha,
    route: route.href,
    clock: fixtureManifest.nowISO,
    locale: fixtureManifest.locale,
    timeZone: fixtureManifest.timeZone,
    deviceScaleFactor: 3,
    sourceOuterFrameCssPx: OUTER_FRAME,
    sourceInnerGlassCssPx: INNER_GLASS,
    productViewportCssPx: PRODUCT,
    sourceOuterFramePhysicalPx: { width: 1104, height: 2160 },
    productViewportPhysicalPx: { width: 1080, height: 2004 },
    fixtureAdapter: isBusinessFixture
      ? fixture.kind === 'business-empty'
        ? 'Fresh browser storage is paired with an active, empty native Business partition named Business.'
        : 'The pinned source receives the source-model projection of the native Business acceptance fixture before React hydration. Amounts are converted from native minor units to source major units; the native capture still builds its state through the real Business engines.'
      : isPersonalFixture
        ? fixtureManifest.designAdapter.note
        : 'Fresh source storage is paired with the equivalent empty native capture partition; no synthetic financial rows are injected.',
    engine,
    semanticGeometry,
    pageErrors,
    consoleErrors,
    resourceFailures,
  };
  await writeFile(path.join(outDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  if (pageErrors.length > 0) throw new Error(`Browser emitted errors:\n${pageErrors.join('\n')}`);
  process.stdout.write(`${JSON.stringify({ outDir, engine: engine.route }, null, 2)}\n`);
  await context.close();
} finally {
  if (browser !== undefined) await browser.close();
  vite?.kill();
  if (vite !== null && !vite.killed) vite.kill('SIGTERM');
  if (vite !== null && vite.exitCode !== null && vite.exitCode !== 0 && viteOutput.trim() !== '') {
    process.stderr.write(viteOutput);
  }
}
