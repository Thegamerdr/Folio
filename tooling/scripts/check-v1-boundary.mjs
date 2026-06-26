import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const manifestPath = join(root, 'docs/v1-donor-audit/freeze-manifest.csv');

const runtimeRoots = [
  join(root, 'apps/mobile/app'),
  join(root, 'apps/mobile/src'),
  join(root, 'packages'),
  join(root, 'services'),
];

const rootFiles = [
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'tsconfig.packages.json',
  'turbo.json',
  'vitest.config.ts',
];

const allowedExtensions = new Set([
  '.cjs',
  '.css',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const ignoredDirectories = new Set([
  '.expo',
  '.git',
  'android',
  'coverage',
  'dist',
  'ios',
  'node_modules',
]);

const forbiddenPatterns = [
  /close-ledger/i,
  /closeledger/i,
  /folio-v1/i,
  /folio-v1-freezes/i,
  /folio-frontend/i,
  /C:\\dev\\apps\\close-ledger-frontend/i,
  /C:\/dev\/apps\/close-ledger-frontend/i,
  /C:\\dev\\folio-v1-freezes/i,
  /C:\/dev\/folio-v1-freezes/i,
  /"electron"/i,
  /'electron'/i,
  /electron-builder/i,
  /electron-updater/i,
  /"vite"/i,
  /'vite'/i,
  /@vitejs\//i,
];

function extension(path) {
  const dotIndex = path.lastIndexOf('.');
  return dotIndex === -1 ? '' : path.slice(dotIndex);
}

function parseManifestHashes(csv) {
  const hashes = new Map();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const cells = line.match(/"([^"]*)"/g)?.map((cell) => cell.slice(1, -1)) ?? [];
    const [relativePath, , , sha256] = cells;
    if (relativePath && sha256) hashes.set(sha256.toLowerCase(), relativePath);
  }
  return hashes;
}

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      files.push(...(await walk(path)));
    } else if (entry.isFile() && allowedExtensions.has(extension(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

async function collectRuntimeFiles() {
  const files = [];
  for (const runtimeRoot of runtimeRoots) {
    files.push(...(await walk(runtimeRoot)));
  }
  for (const rootFile of rootFiles) {
    const path = join(root, rootFile);
    if (await fileExists(path)) files.push(path);
  }
  return files;
}

const manifest = parseManifestHashes(await readFile(manifestPath, 'utf8'));
const runtimeFiles = await collectRuntimeFiles();
const violations = [];

for (const file of runtimeFiles) {
  const source = await readFile(file, 'utf8');
  const displayPath = relative(root, file);
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) {
      violations.push(`${displayPath} contains V1/runtime donor marker ${pattern}`);
    }
  }

  const hash = createHash('sha256').update(source).digest('hex');
  const donorPath = manifest.get(hash);
  if (donorPath) {
    violations.push(`${displayPath} has same SHA-256 as V1 freeze file ${donorPath}`);
  }
}

if (violations.length > 0) {
  console.error('V1 boundary violations found:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `V1 boundary proof passed: ${runtimeFiles.length} V2 runtime/package files checked against ${manifest.size} V1 hashes.`,
);
