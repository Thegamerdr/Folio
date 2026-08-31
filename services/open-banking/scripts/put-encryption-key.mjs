import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serviceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wranglerBin = path.resolve(
  serviceRoot,
  '..',
  '..',
  'node_modules',
  'wrangler',
  'bin',
  'wrangler.js',
);
const existing = spawnSync(process.execPath, [wranglerBin, 'secret', 'list'], {
  cwd: serviceRoot,
  encoding: 'utf8',
  windowsHide: true,
});

if (existing.status !== 0) {
  console.error('Unable to read the Worker secret inventory; no key was generated or installed.');
  process.exit(1);
}

const names = new Set(
  JSON.parse(existing.stdout.trim())
    .map((entry) => entry?.name)
    .filter(Boolean),
);
if (names.has('CONNECTION_ENCRYPTION_KEY')) {
  console.error(
    'CONNECTION_ENCRYPTION_KEY already exists. Refusing to replace it because doing so could orphan active connections.',
  );
  process.exit(1);
}

const key = randomBytes(32).toString('base64');
const installed = spawnSync(
  process.execPath,
  [wranglerBin, 'secret', 'put', 'CONNECTION_ENCRYPTION_KEY'],
  {
    cwd: serviceRoot,
    input: `${key}\n`,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
    windowsHide: true,
  },
);

if (installed.status !== 0) {
  console.error(
    'The generated key was not installed. Run the command again to generate a new key.',
  );
  process.exit(installed.status ?? 1);
}
console.log('Installed a new 32-byte CONNECTION_ENCRYPTION_KEY without printing its value.');
