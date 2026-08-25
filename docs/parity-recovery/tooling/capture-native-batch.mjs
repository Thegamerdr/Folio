#!/usr/bin/env node

/**
 * Build one isolated parity APK per fixture, then drive every requested screen/theme through the
 * capture-only folio://parity deep link. This turns N screen/theme rebuilds into F fixture builds.
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const PACKAGE = 'com.folio.v2.greenfield';
const DEFAULT_JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr';
const DEFAULT_ANDROID_HOME = 'C:/Users/User/AppData/Local/Android/Sdk';

function readArg(name, fallback) {
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  return inline === undefined ? fallback : inline.slice(name.length + 3);
}

const BUILD_ROOT = path.resolve(readArg('build-root', ROOT));
const MOBILE_ROOT = path.join(BUILD_ROOT, 'apps/mobile');
const ANDROID_ROOT = path.join(MOBILE_ROOT, 'android');
const manifestPath = path.resolve(
  ROOT,
  readArg('manifest', 'docs/parity-recovery/registries/capture-batches.json'),
);
const deviceId = readArg('device', 'emulator-5554');
const batchFilter = readArg('batch', '');
const batchFilters = new Set(
  batchFilter
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const surfaceFilter = readArg('surface', '');
const startAt = readArg('start-at', '');
const reuseExistingApks = readArg('reuse-existing-apks', 'false') === 'true';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.batches)) {
  throw new Error(`Unsupported capture batch manifest: ${manifestPath}`);
}

const nativeSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
const buildSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: BUILD_ROOT,
  encoding: 'utf8',
}).trim();
if (buildSha !== nativeSha) {
  throw new Error(`Build worktree SHA mismatch: evidence=${nativeSha}, build=${buildSha}.`);
}
const nativeRef = nativeSha.slice(0, 7);
const androidHome =
  process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? DEFAULT_ANDROID_HOME;
const adb = path.join(androidHome, 'platform-tools/adb.exe');
const javaHome = process.env.JAVA_HOME ?? DEFAULT_JAVA_HOME;
const gradle = path.join(ANDROID_ROOT, 'gradlew.bat');
const builtApk = path.join(ANDROID_ROOT, 'app/build/outputs/apk/release/app-release.apk');
const artifactRoot = path.join(ROOT, 'release-artifacts');
const evidenceRoot = path.join(ROOT, `docs/parity-recovery/evidence/native/harness-${nativeRef}`);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    encoding: options.encoding === undefined ? 'utf8' : options.encoding,
    maxBuffer: 64 * 1024 * 1024,
    stdio: options.stdio,
  });
}

function runStreaming(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const windowsBatch = process.platform === 'win32' && command.toLowerCase().endsWith('.bat');
    const executable = windowsBatch
      ? (process.env.ComSpec ?? 'C:/Windows/System32/cmd.exe')
      : command;
    const executableArgs = windowsBatch
      ? ['/d', '/s', '/c', `.\\${path.basename(command)}`, ...args]
      : args;
    const child = spawn(executable, executableArgs, {
      cwd: options.cwd ?? ROOT,
      env: options.env ?? process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} exited with ${code}.`));
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function invalidateFixtureBundle() {
  // Expo's public capture variables are JS bundle inputs, but Gradle does not model environment
  // values as task inputs. Remove only the two generated React output directories so a fixture
  // change cannot silently reuse the previous fixture's bundle. Downstream asset/package tasks
  // then invalidate naturally without rerunning the other ~1,000 Android tasks.
  await rm(path.join(ANDROID_ROOT, 'app/build/generated/assets/react/release'), {
    recursive: true,
    force: true,
  });
  await rm(path.join(ANDROID_ROOT, 'app/build/intermediates/sourcemaps/react/release'), {
    recursive: true,
    force: true,
  });
}

function assertRuntimeControl(log, { screen, sheet, dialog, theme }) {
  const expectedSheet = sheet === 'none' ? 'null' : `"${sheet}"`;
  const expectedDialog = dialog === 'none' ? 'null' : `"${dialog}"`;
  const matched = log
    .split(/\r?\n/u)
    .some(
      (line) =>
        line.includes('[parity-shell]') &&
        line.includes(`"screen":"${screen}"`) &&
        line.includes(`"sheet":${expectedSheet}`) &&
        line.includes(`"dialog":${expectedDialog}`) &&
        line.includes(`"theme":"${theme}"`),
    );
  if (!matched) {
    throw new Error(
      `Runtime control was not acknowledged for screen=${screen} sheet=${sheet} dialog=${dialog} theme=${theme}.`,
    );
  }
}

async function waitForRuntimeControl(expected) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const runtimeLog = run(adb, ['-s', deviceId, 'logcat', '-d', '-s', 'ReactNativeJS:I', '*:S']);
    try {
      assertRuntimeControl(runtimeLog, expected);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await wait(350);
    }
  }
  throw lastError;
}

await mkdir(artifactRoot, { recursive: true });
await mkdir(evidenceRoot, { recursive: true });
run(adb, ['-s', deviceId, 'shell', 'wm', 'size', '1080x2220']);
run(adb, ['-s', deviceId, 'shell', 'wm', 'density', '480']);
run(adb, ['-s', deviceId, 'shell', 'settings', 'put', 'system', 'font_scale', '1.0']);

const fixtureRuns = [];
const fixtureApkCache = new Map();
let reachedStart = startAt === '';
let foundStart = startAt === '';
const selectedBatches = manifest.batches.filter(
  (batch) => batchFilters.size === 0 || batchFilters.has(batch.id),
);
for (const batch of selectedBatches) {
  const selectedSurfaces = batch.surfaces.filter((surface) => {
    const surfaceId = surface.id ?? surface.screen;
    if (surfaceFilter !== '' && surfaceId !== surfaceFilter) return false;
    if (!reachedStart) {
      if (surfaceId !== startAt) return false;
      reachedStart = true;
      foundStart = true;
    }
    return true;
  });
  if (selectedSurfaces.length === 0) continue;
  const firstScreen = selectedSurfaces[0]?.nativeScreen ?? selectedSurfaces[0]?.screen ?? 'today';
  const buildEnv = {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: androidHome,
    NODE_ENV: 'production',
    SENTRY_DISABLE_AUTO_UPLOAD: 'true',
    EXPO_PUBLIC_MELO_PARITY_CAPTURE: 'true',
    EXPO_PUBLIC_MELO_PARITY_FIXTURE: batch.fixture,
    EXPO_PUBLIC_MELO_PARITY_NOW: manifest.nowISO ?? '2026-08-18T08:00:00.000Z',
    EXPO_PUBLIC_MELO_PARITY_SCREEN: firstScreen,
    EXPO_PUBLIC_MELO_PARITY_SHEET: '',
    EXPO_PUBLIC_MELO_PARITY_THEME: 'light',
  };

  let artifactPath;
  let apkSha256;
  const cachedFixture = fixtureApkCache.get(batch.fixture);
  if (cachedFixture !== undefined) {
    ({ artifactPath, apkSha256 } = cachedFixture);
    process.stdout.write(`REUSE fixture ${batch.fixture} for ${batch.id}\n`);
  } else {
    artifactPath = path.join(artifactRoot, `capture-${nativeRef}-${batch.fixture}.apk`);
    let apkBytes;
    if (reuseExistingApks) {
      try {
        apkBytes = await readFile(artifactPath);
        process.stdout.write(`REUSE existing fixture ${batch.fixture} for ${batch.id}\n`);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    if (apkBytes === undefined) {
      process.stdout.write(`BUILD fixture ${batch.fixture}\n`);
      await invalidateFixtureBundle();
      await runStreaming(
        gradle,
        [
          ':app:assembleRelease',
          '--no-daemon',
          '-PreactNativeArchitectures=x86_64',
          '--console=plain',
        ],
        { cwd: ANDROID_ROOT, env: buildEnv },
      );
      apkBytes = await readFile(builtApk);
      await copyFile(builtApk, artifactPath);
    }
    apkSha256 = createHash('sha256').update(apkBytes).digest('hex').toUpperCase();
    fixtureApkCache.set(batch.fixture, { artifactPath, apkSha256 });
  }
  run(adb, ['-s', deviceId, 'install', '-r', artifactPath]);
  // A fixture APK is a disposable deterministic environment. Clearing only this emulator package
  // prevents persisted state from one fixture contaminating the next; the connected S9 is never
  // addressed by this driver.
  run(adb, ['-s', deviceId, 'shell', 'pm', 'clear', PACKAGE]);

  let captureCount = 0;
  let verifiedCaptureCount = 0;
  for (const surface of selectedSurfaces) {
    for (const theme of surface.themes ?? ['light', 'dark']) {
      const screen = surface.nativeScreen ?? surface.screen;
      const sheet = surface.nativeSheet ?? surface.sheet ?? 'none';
      const dialog = surface.nativeDialog ?? 'none';
      const surfaceId = surface.id ?? surface.screen;
      const deepLink = `folio:///?capture=1&screen=${encodeURIComponent(screen)}&sheet=${encodeURIComponent(sheet)}&dialog=${encodeURIComponent(dialog)}&theme=${theme}`;
      // Each dialog is deliberately non-cancelable so the screenshot cannot race an accidental
      // BACK dismissal. Restart the disposable capture process between jobs instead of depending
      // on button coordinates or localized Android chrome to close the preceding dialog.
      run(adb, ['-s', deviceId, 'shell', 'am', 'force-stop', PACKAGE]);
      run(adb, ['-s', deviceId, 'logcat', '-c']);
      run(adb, [
        '-s',
        deviceId,
        'shell',
        'am',
        'start',
        '-W',
        '-a',
        'android.intent.action.VIEW',
        // adb joins `shell` arguments for Android's remote shell. Quote the URI there so its `&`
        // query separators cannot become shell operators; the quotes are consumed remotely and do
        // not become part of the Intent data URI.
        '-d',
        `'${deepLink}'`,
        '-p',
        PACKAGE,
      ]);
      await wait(manifest.settleMs ?? 900);
      await waitForRuntimeControl({ screen, sheet, dialog, theme });
      // Runtime control is acknowledged when the target state is selected, which can precede the
      // final native frame while the release bundle leaves its launch placeholder or a sheet
      // finishes its opening layout. Give that owned frame one short, deterministic settle window.
      await wait(manifest.postAcknowledgeMs ?? 500);
      // Browser reference captures never include a software keyboard. Some Android TextInputs
      // autofocus and leave Gboard's floating toolbar over the sheet even with a hardware keyboard
      // attached. ESC dismisses only that input surface (and is inert when no IME is showing), so
      // every form/edit sheet is compared at the same resting state as its pinned source.
      run(adb, ['-s', deviceId, 'shell', 'input', 'keyevent', '111']);
      await wait(200);
      run(adb, ['-s', deviceId, 'shell', 'input', 'keyevent', '111']);
      await wait(500);
      const png = run(adb, ['-s', deviceId, 'exec-out', 'screencap', '-p'], { encoding: null });
      const outDir = path.join(evidenceRoot, batch.fixture, theme, surfaceId);
      await mkdir(outDir, { recursive: true });
      await writeFile(path.join(outDir, 'native-full-1080x2220.png'), png);
      captureCount += 1;
      verifiedCaptureCount += 1;
      process.stdout.write(`captured ${batch.fixture}/${theme}/${surfaceId}\n`);
    }
  }

  fixtureRuns.push({
    batchId: batch.id,
    fixture: batch.fixture,
    apkPath: path.relative(ROOT, artifactPath).replaceAll('\\', '/'),
    apkSha256,
    captureCount,
    verifiedCaptureCount,
  });
}

if (!foundStart) {
  throw new Error(`Requested --start-at surface was not found: ${startAt}`);
}

const captureRun = {
  schemaVersion: 1,
  nativeSha,
  nativeRef,
  deviceId,
  viewport: { widthPx: 1080, heightPx: 2220, densityDpi: 480, fontScale: 1 },
  fixtureRuns,
};
await writeFile(
  path.join(evidenceRoot, 'capture-run.json'),
  `${JSON.stringify(captureRun, null, 2)}\n`,
);
process.stdout.write(
  `Native batch complete: ${fixtureRuns.reduce((sum, row) => sum + row.captureCount, 0)} captures.\n`,
);
