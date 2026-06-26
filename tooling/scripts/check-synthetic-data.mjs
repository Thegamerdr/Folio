import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const requiredPolicy = 'docs/synthetic-data-policy.md';
const suspiciousPatterns = [
  /REAL_FINANCIAL_DATA/i,
  /BEGIN PRIVATE KEY/,
  /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}/i,
  /sort\s*code\s*[:=]\s*['"]?\d{2}-\d{2}-\d{2}/i,
  /account\s*number\s*[:=]\s*['"]?\d{8}/i,
];

const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', '.turbo']);
const ignoredPrefixes = ['docs/source-package/'];
const ignoredFiles = new Set(['tooling/scripts/check-synthetic-data.mjs']);
const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

try {
  await readFile(join(root, requiredPolicy), 'utf8');
} catch {
  violations.push(`${requiredPolicy} is missing`);
}

for (const file of await walk(root)) {
  const relativePath = relative(root, file).replaceAll('\\', '/');
  if (ignoredFiles.has(relativePath)) continue;
  if (ignoredPrefixes.some((prefix) => relativePath.startsWith(prefix))) continue;
  if (/\.(png|jpg|jpeg|gif|webp|zip|sqlite|db)$/i.test(relativePath)) continue;

  const source = await readFile(file, 'utf8');
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(source)) {
      violations.push(`${relativePath} matched ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Synthetic-data policy violations found:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Synthetic-data policy passed.');
