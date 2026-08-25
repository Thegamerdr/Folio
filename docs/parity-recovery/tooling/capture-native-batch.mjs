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
const manifestPath = path.resolve(ROOT, readArg('manifest', 'docs/parity-recovery/registries/capture-batches.json'));
const deviceId = readArg('device', 'emulator-5554');
const batchFilter = readArg('batch', '');
const surfaceFilter = readArg('surface', '');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.batches)) {
  throw new Error(`Unsupported capture batch manifest: ${manifestPath}`);
}

const nativeSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const buildSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: BUILD_ROOT, encoding: 'utf8' }).trim();
if (buildSha !== nativeSha) {
  throw new Error(`Build worktree SHA mismatch: evidence=${nativeSha}, build=${buildSha}.`);
}
const nativeRef = nativeSha.slice(0, 7);
const androidHome = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? DEFAULT_ANDROID_HOME;
const adb = path.join(androidHome, 'platform-tools/adb.exe');
const javaHome = process.env.JAVA_HOME ?? DEFAULT_JAVA_HOME;
const gradle = path.join(ANDROID_ROOT, 'gradlew.bat');
const builtApk = path.join(ANDROID_ROOT, 'app/build/outputs/apk/release/app-release.apk');
const artifactRoot = path.join(ROOT, 'release-artifacts');
const evidenceRoot = path.join(
  ROOT,
  `docs/parity-recovery/evidence/native/harness-${nativeRef}`,
);

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
    const executable = windowsBatch ? (process.env.ComSpec ?? 'C:/Windows/System32/cmd.exe') : command;
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

function assertRuntimeControl(log, { screen, sheet, theme }) {
  const expectedSheet = sheet === 'none' ? 'null' : `"${sheet}"`;
  const matched = log
    .split(/\r?\n/u)
    .some(
      (line) =>
        line.includes('[parity-shell]') &&
        line.includes(`"screen":"${screen}"`) &&
        line.includes(`"sheet":${expectedSheet}`) &&
        line.includes(`"theme":"${theme}"`),
    );
  if (!matched) {
    throw new Error(
      `Runtime control was not acknowledged for screen=${screen} sheet=${sheet} theme=${theme}.`,
    );
  }
}

await mkdir(artifactRoot, { recursive: true });
await mkdir(evidenceRoot, { recursive: true });
run(adb, ['-s', deviceId, 'shell', 'wm', 'size', '1080x2220']);
run(adb, ['-s', deviceId, 'shell', 'wm', 'density', '480']);
run(adb, ['-s', deviceId, 'shell', 'settings', 'put', 'system', 'font_scale', '1.0']);

const fixtureRuns = [];
const selectedBatches = manifest.batches.filter(
  (batch) => batchFilter === '' || batch.id === batchFilter,
);
for (const batch of selectedBatches) {
  const selectedSurfaces = batch.surfaces.filter(
    (surface) => surfaceFilter === '' || (surface.id ?? surface.screen) === surfaceFilter,
  );
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

  process.stdout.write(`BUILD fixture ${batch.fixture}\n`);
  await invalidateFixtureBundle();
  await runStreaming(
    gradle,
    [':app:assembleRelease', '--no-daemon', '-PreactNativeArchitectures=x86_64', '--console=plain'],
    { cwd: ANDROID_ROOT, env: buildEnv },
  );

  const apkBytes = await readFile(builtApk);
  const apkSha256 = createHash('sha256').update(apkBytes).digest('hex').toUpperCase();
  const artifactPath = path.join(artifactRoot, `capture-${nativeRef}-${batch.fixture}.apk`);
  await copyFile(builtApk, artifactPath);
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
      const surfaceId = surface.id ?? surface.screen;
      const deepLink = `folio:///?capture=1&screen=${encodeURIComponent(screen)}&sheet=${encodeURIComponent(sheet)}&theme=${theme}`;
      run(adb, ['-s', deviceId, 'logcat', '-c']);
      run(adb, [
        '-s', deviceId, 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
        // adb joins `shell` arguments for Android's remote shell. Quote the URI there so its `&`
        // query separators cannot become shell operators; the quotes are consumed remotely and do
        // not become part of the Intent data URI.
        '-d', `'${deepLink}'`, '-p', PACKAGE,
      ]);
      await wait(manifest.settleMs ?? 900);
      const runtimeLog = run(adb, ['-s', deviceId, 'logcat', '-d', '-s', 'ReactNativeJS:I', '*:S']);
      assertRuntimeControl(runtimeLog, { screen, sheet, theme });
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
    fixture: batch.fixture,
    apkPath: path.relative(ROOT, artifactPath).replaceAll('\\', '/'),
    apkSha256,
    captureCount,
    verifiedCaptureCount,
  });
}

const captureRun = {
  schemaVersion: 1,
  nativeSha,
  nativeRef,
  deviceId,
  viewport: { widthPx: 1080, heightPx: 2220, densityDpi: 480, fontScale: 1 },
  fixtureRuns,
};
await writeFile(path.join(evidenceRoot, 'capture-run.json'), `${JSON.stringify(captureRun, null, 2)}\n`);
process.stdout.write(`Native batch complete: ${fixtureRuns.reduce((sum, row) => sum + row.captureCount, 0)} captures.\n`);
