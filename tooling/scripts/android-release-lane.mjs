import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MOBILE_ROOT = path.join(ROOT, 'apps', 'mobile');
const ANDROID_ROOT = path.join(MOBILE_ROOT, 'android');
const PACKAGE_NAME = 'com.melomoney.app';
const MAIN_ACTIVITY = `${PACKAGE_NAME}/.MainActivity`;
const EXPECTED_UPLOAD_CERT_SHA256 =
  '54:73:96:E1:FD:99:68:1C:2A:6D:76:8B:8B:7D:1B:44:84:B5:F4:2A:17:59:7C:AD:6C:49:52:21:26:7A:54:88';

export function normalizeFingerprint(value) {
  return String(value)
    .replace(/[^a-fA-F0-9]/g, '')
    .toUpperCase();
}

export function parseAdbDevices(output) {
  return String(output)
    .split(/\r?\n/u)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial = '', state = '', ...details] = line.split(/\s+/u);
      return { serial, state, details: details.join(' ') };
    })
    .filter((device) => device.serial.length > 0);
}

export function parseApkSignerFingerprint(output) {
  const match = String(output).match(/certificate SHA-256 digest:\s*([0-9a-f:]+)/iu);
  return match ? normalizeFingerprint(match[1]) : null;
}

export function parseKeytoolFingerprint(output) {
  const match = String(output).match(/SHA256:\s*([0-9A-F:]+)/iu);
  return match ? normalizeFingerprint(match[1]) : null;
}

export function archiveAbiInventory(entries) {
  const libraries = String(entries)
    .split(/\r?\n/u)
    .filter((entry) => /^(?:base\/)?lib\/[^/]+\/libreactnative\.so$/u.test(entry));
  return [
    ...new Set(
      libraries.map((entry) => {
        const segments = entry.split('/');
        return segments[0] === 'base' ? segments[2] : segments[1];
      }),
    ),
  ].sort();
}

export function fatalAndroidMarkers(log) {
  const patterns = [
    /FATAL EXCEPTION/iu,
    /UnsatisfiedLinkError/iu,
    /Process: com\.melomoney\.app.*has died/iu,
    /Unable to start activity.*com\.melomoney\.app/iu,
  ];
  return String(log)
    .split(/\r?\n/u)
    .filter((line) => patterns.some((pattern) => pattern.test(line)));
}

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function assertSafeGeneratedDirectory(rootPath, candidatePath) {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  if (candidate === root || !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Refusing to remove generated directory outside Android root: ${candidate}`);
  }
  return candidate;
}

function clearGeneratedAndroidState(report) {
  const started = Date.now();
  const directories = [
    path.join(ANDROID_ROOT, 'build'),
    path.join(ANDROID_ROOT, 'app', 'build'),
    path.join(ANDROID_ROOT, 'app', '.cxx'),
  ].map((candidate) => assertSafeGeneratedDirectory(ANDROID_ROOT, candidate));

  console.log('\n[android-release] Clear generated Android application state');
  for (const directory of directories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  report.commands.push({
    label: 'Clear generated Android application state',
    command: 'remove android/build android/app/build android/app/.cxx',
    durationMs: Date.now() - started,
    exitCode: 0,
  });
}

export function resolveAndroidToolchain(environment = process.env) {
  const localAppData = environment.LOCALAPPDATA;
  const home = environment.HOME ?? environment.USERPROFILE;
  const sdkCandidates = [
    environment.ANDROID_SDK_ROOT,
    environment.ANDROID_HOME,
    localAppData ? path.join(localAppData, 'Android', 'Sdk') : undefined,
    home ? path.join(home, 'Library', 'Android', 'sdk') : undefined,
  ].filter(Boolean);
  const javaCandidates = [
    environment.JAVA_HOME,
    process.platform === 'win32'
      ? path.join('C:', 'Program Files', 'Android', 'Android Studio', 'jbr')
      : undefined,
    process.platform === 'darwin'
      ? '/Applications/Android Studio.app/Contents/jbr/Contents/Home'
      : undefined,
  ].filter(Boolean);

  const sdkRoot = sdkCandidates.find((candidate) => fs.existsSync(candidate));
  const javaHome = javaCandidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'bin', executableName('java'))),
  );
  if (!sdkRoot) throw new Error('Android SDK not found. Set ANDROID_SDK_ROOT.');
  if (!javaHome) throw new Error('Android Studio JBR/JAVA_HOME not found.');

  const buildToolsRoot = path.join(sdkRoot, 'build-tools');
  const buildToolsVersions = fs.existsSync(buildToolsRoot)
    ? fs
        .readdirSync(buildToolsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(compareVersionStrings)
        .reverse()
    : [];
  const buildTools = buildToolsVersions
    .map((version) => path.join(buildToolsRoot, version))
    .find((candidate) => fs.existsSync(path.join(candidate, scriptName('apksigner'))));
  if (!buildTools) throw new Error('Android build-tools with apksigner were not found.');

  return {
    sdkRoot,
    javaHome,
    adb: path.join(sdkRoot, 'platform-tools', executableName('adb')),
    apksigner: path.join(buildTools, scriptName('apksigner')),
    jar: path.join(javaHome, 'bin', executableName('jar')),
    keytool: path.join(javaHome, 'bin', executableName('keytool')),
  };
}

function executableName(base) {
  return process.platform === 'win32' ? `${base}.exe` : base;
}

function scriptName(base) {
  return process.platform === 'win32' ? `${base}.bat` : base;
}

function compareVersionStrings(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function parseArgs(argv) {
  const flags = new Set(argv);
  const valueAfter = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    runCi: !flags.has('--skip-ci'),
    runDoctor: !flags.has('--skip-doctor'),
    runPrebuild: !flags.has('--skip-prebuild'),
    runEmulator: !flags.has('--skip-emulator'),
    device: valueAfter('--device'),
    reportPath:
      valueAfter('--report') ?? path.join(ROOT, 'tmp', 'local-release', 'android-report.json'),
  };
}

function commandName(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function runCommand(report, label, command, args, options = {}) {
  const started = Date.now();
  console.log(`\n[android-release] ${label}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: options.capture === false ? 'inherit' : 'pipe',
    shell: process.platform === 'win32' && /\.(?:bat|cmd)$/iu.test(command),
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  report.commands.push({
    label,
    command: [path.basename(command), ...args].join(' '),
    durationMs: Date.now() - started,
    exitCode: result.status,
  });
  if (options.capture !== false && options.logOutput !== false) {
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const diagnostic =
      options.logOutput === false
        ? `\n${`${stdout}${stderr}`.trim().split(/\r?\n/u).slice(-40).join('\n')}`
        : '';
    throw new Error(`${label} failed with exit code ${String(result.status)}.${diagnostic}`);
  }
  return `${stdout}${stderr}`;
}

function inspectArtifact(report, toolchain, filePath, expectedAbi, kind) {
  if (!fs.existsSync(filePath)) throw new Error(`Expected ${kind} not found: ${filePath}`);
  const entries = runCommand(report, `Inspect ${kind} archive`, toolchain.jar, ['tf', filePath], {
    logOutput: false,
  });
  const abis = archiveAbiInventory(entries);
  if (expectedAbi && !abis.includes(expectedAbi)) {
    throw new Error(
      `${kind} does not contain libreactnative.so for ${expectedAbi}. Found: ${abis}`,
    );
  }
  return {
    path: path.relative(ROOT, filePath).replaceAll('\\', '/'),
    sizeBytes: fs.statSync(filePath).size,
    sha256: sha256File(filePath),
    reactNativeAbis: abis,
  };
}

function verifyCertificate(report, toolchain, env, artifactPath, kind) {
  const expected = normalizeFingerprint(EXPECTED_UPLOAD_CERT_SHA256);
  const output =
    kind === 'APK'
      ? runCommand(
          report,
          'Verify APK signature',
          toolchain.apksigner,
          ['verify', '--verbose', '--print-certs', artifactPath],
          { env },
        )
      : runCommand(
          report,
          'Verify AAB signature',
          toolchain.keytool,
          ['-printcert', '-jarfile', artifactPath],
          { env },
        );
  const actual =
    kind === 'APK' ? parseApkSignerFingerprint(output) : parseKeytoolFingerprint(output);
  if (!actual) throw new Error(`${kind} signing certificate fingerprint could not be read.`);
  if (actual !== expected) {
    throw new Error(`${kind} signing certificate does not match the published Android identity.`);
  }
  return actual;
}

function selectEmulator(report, toolchain, requestedDevice, env) {
  const output = runCommand(report, 'List Android devices', toolchain.adb, ['devices', '-l'], {
    env,
  });
  const online = parseAdbDevices(output).filter((device) => device.state === 'device');
  if (requestedDevice) {
    const requested = online.find((device) => device.serial === requestedDevice);
    if (!requested) throw new Error(`Requested Android device is not online: ${requestedDevice}`);
    return requested;
  }
  return online.find((device) => device.serial.startsWith('emulator-')) ?? null;
}

function adb(report, toolchain, env, serial, label, args) {
  return runCommand(report, label, toolchain.adb, ['-s', serial, ...args], { env });
}

async function smokeEmulator(report, toolchain, env, serial, apkPath) {
  const abi = adb(report, toolchain, env, serial, 'Read emulator ABI', [
    'shell',
    'getprop',
    'ro.product.cpu.abi',
  ]).trim();
  if (abi !== 'x86_64') {
    throw new Error(`The automated emulator lane expects x86_64 but found ${abi}.`);
  }
  adb(report, toolchain, env, serial, 'Install emulator release APK', ['install', '-r', apkPath]);
  adb(report, toolchain, env, serial, 'Clear Android logs', ['logcat', '-c']);
  adb(report, toolchain, env, serial, 'Force-stop Melo', [
    'shell',
    'am',
    'force-stop',
    PACKAGE_NAME,
  ]);
  adb(report, toolchain, env, serial, 'Launch Melo release', [
    'shell',
    'am',
    'start',
    '-W',
    '-n',
    MAIN_ACTIVITY,
  ]);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const pid = adb(report, toolchain, env, serial, 'Confirm Melo process', [
    'shell',
    'pidof',
    PACKAGE_NAME,
  ]).trim();
  if (!/^\d+$/u.test(pid)) throw new Error('Melo did not remain alive after release launch.');
  const activity = adb(report, toolchain, env, serial, 'Confirm resumed Melo activity', [
    'shell',
    'dumpsys',
    'activity',
    'activities',
  ]);
  if (!activity.includes(PACKAGE_NAME)) {
    throw new Error('Melo was not present in Android activity state after launch.');
  }
  const log = adb(report, toolchain, env, serial, 'Inspect Melo process logs', [
    'logcat',
    '--pid',
    pid,
    '-d',
    '-v',
    'brief',
  ]);
  const fatalMarkers = fatalAndroidMarkers(log);
  if (fatalMarkers.length > 0) {
    throw new Error(`Fatal Android runtime markers found:\n${fatalMarkers.join('\n')}`);
  }
  return { serial, abi, pid: Number(pid), fatalMarkers: 0 };
}

function gitSha(report) {
  return runCommand(report, 'Read Git revision', 'git', ['rev-parse', 'HEAD']).trim();
}

export async function runAndroidReleaseLane(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const toolchain = resolveAndroidToolchain();
  const baseEnv = {
    ...process.env,
    ANDROID_HOME: toolchain.sdkRoot,
    ANDROID_SDK_ROOT: toolchain.sdkRoot,
    JAVA_HOME: toolchain.javaHome,
    SENTRY_DISABLE_AUTO_UPLOAD: 'true',
    PATH: [
      path.join(toolchain.javaHome, 'bin'),
      path.join(toolchain.sdkRoot, 'platform-tools'),
      process.env.PATH ?? '',
    ].join(path.delimiter),
  };
  const releaseEnv = { ...baseEnv, NODE_ENV: 'production' };
  const report = {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    completedAt: null,
    gitSha: null,
    host: { platform: process.platform, release: os.release(), arch: process.arch },
    laterChecks: [
      'physical Android device matrix when devices are available',
      'iOS archive and device smoke when macOS/Xcode are available',
      'store processing and external-provider checks at their relevant release stage',
    ],
    commands: [],
    emulator: { status: 'not-run' },
    artifacts: {},
    success: false,
  };

  try {
    report.gitSha = gitSha(report);
    if (options.runDoctor) {
      runCommand(
        report,
        'Verify Expo dependency alignment',
        commandName('pnpm'),
        ['mobile:install-check'],
        { env: baseEnv },
      );
      runCommand(report, 'Run Expo doctor', commandName('pnpm'), ['mobile:doctor'], {
        env: baseEnv,
      });
    }
    if (options.runCi) {
      runCommand(report, 'Run complete repository CI', commandName('pnpm'), ['run', 'ci'], {
        env: baseEnv,
        capture: false,
      });
    }
    if (options.runPrebuild) {
      runCommand(
        report,
        'Regenerate native Android project',
        commandName('pnpm'),
        ['mobile:prebuild'],
        { env: releaseEnv, capture: false },
      );
    }
    if (
      !fs.existsSync(
        path.join(ANDROID_ROOT, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'),
      )
    ) {
      throw new Error('Generated Android project is missing. Run without --skip-prebuild.');
    }

    const gradle = path.join(
      ANDROID_ROOT,
      process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
    );
    const apkPath = path.join(
      ANDROID_ROOT,
      'app',
      'build',
      'outputs',
      'apk',
      'release',
      'app-release.apk',
    );
    const aabPath = path.join(
      ANDROID_ROOT,
      'app',
      'build',
      'outputs',
      'bundle',
      'release',
      'app-release.aab',
    );

    // Windows/Android Studio can leave workers holding generated dependency jars after a previous
    // build. Stop those workers, then remove only application-generated output. `gradlew clean`
    // cannot be used reliably with React Native's new architecture: dependency clean tasks remove
    // codegen JNI folders before the app's stale CMake clean task reads them.
    runCommand(report, 'Stop stale Gradle daemons', gradle, ['--stop'], {
      cwd: ANDROID_ROOT,
      env: releaseEnv,
    });
    clearGeneratedAndroidState(report);

    if (options.runEmulator) {
      const device = selectEmulator(report, toolchain, options.device, releaseEnv);
      if (device) {
        runCommand(
          report,
          'Build x86_64 release APK for emulator',
          gradle,
          [':app:assembleRelease', '-PreactNativeArchitectures=x86_64', '--no-daemon'],
          { cwd: ANDROID_ROOT, env: releaseEnv, logOutput: false },
        );
        const emulatorArtifact = inspectArtifact(
          report,
          toolchain,
          apkPath,
          'x86_64',
          'emulator APK',
        );
        report.emulator = {
          status: 'passed',
          artifact: emulatorArtifact,
          ...(await smokeEmulator(report, toolchain, releaseEnv, device.serial, apkPath)),
        };
      } else {
        report.emulator = {
          status: 'not-run',
          reason: 'No online emulator was detected; release build verification continued.',
        };
      }
    }

    runCommand(
      report,
      'Build signed arm64 APK and Play AAB',
      gradle,
      [':app:assembleRelease', ':app:bundleRelease', '--no-daemon'],
      { cwd: ANDROID_ROOT, env: releaseEnv, logOutput: false },
    );
    report.artifacts.apk = inspectArtifact(report, toolchain, apkPath, 'arm64-v8a', 'APK');
    report.artifacts.apk.certificateSha256 = verifyCertificate(
      report,
      toolchain,
      releaseEnv,
      apkPath,
      'APK',
    );
    report.artifacts.aab = inspectArtifact(report, toolchain, aabPath, 'arm64-v8a', 'AAB');
    report.artifacts.aab.certificateSha256 = verifyCertificate(
      report,
      toolchain,
      releaseEnv,
      aabPath,
      'AAB',
    );
    report.completedAt = new Date().toISOString();
    report.success = true;
    return report;
  } finally {
    report.completedAt ??= new Date().toISOString();
    fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
    fs.writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\n[android-release] Report: ${options.reportPath}`);
  }
}

async function main() {
  try {
    const report = await runAndroidReleaseLane();
    console.log(
      `[android-release] PASS ${report.gitSha} — APK ${report.artifacts.apk.sha256.slice(0, 12)}…; AAB ${report.artifacts.aab.sha256.slice(0, 12)}…; emulator ${report.emulator.status}.`,
    );
  } catch (error) {
    console.error(
      `[android-release] FAIL: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
