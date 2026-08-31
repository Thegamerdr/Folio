import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const activation = process.argv.includes('--activation');
const pnpmScript = process.env.npm_execpath;
const checks = activation
  ? [
      ['Google Play billing activation', 'billing:readiness'],
      ['TrueLayer Open Banking activation', 'open-banking:readiness'],
    ]
  : [
      ['Google Play billing preflight', 'billing:preflight'],
      ['TrueLayer Open Banking preflight', 'open-banking:preflight'],
    ];

let failed = false;

for (const [label, script] of checks) {
  console.log(`\n=== ${label} ===`);
  const result = pnpmScript
    ? spawnSync(process.execPath, [pnpmScript, script], {
        cwd: repositoryRoot,
        env: process.env,
        stdio: 'inherit',
      })
    : spawnSync('pnpm', [script], {
        cwd: repositoryRoot,
        env: process.env,
        stdio: 'inherit',
      });

  if (result.error) {
    failed = true;
    console.error(`FAIL ${label}: ${result.error.message}`);
    continue;
  }

  if (result.status !== 0) {
    failed = true;
    console.error(`WAIT ${label}: activation requirements are incomplete`);
  } else {
    console.log(`PASS ${label}`);
  }
}

console.log(
  failed
    ? '\nProvider readiness is incomplete. Add only the named owner-issued secrets or console inputs, then rerun this command.'
    : `\nProvider ${activation ? 'activation readiness' : 'preflight'} passed.`,
);

if (failed) process.exitCode = 1;
