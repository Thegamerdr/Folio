import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_URL = 'https://melo-billing-entitlements.tgdroppin.workers.dev';
const apple = process.argv.includes('--apple');
const REQUIRED_SECRETS = [
  ...(apple
    ? ['APPLE_ISSUER_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY']
    : ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY']),
  'ENTITLEMENT_SIGNING_PRIVATE_KEY',
];
const EXPECTED_PRODUCTS = ['folio.full', 'folio.live.monthly', 'folio.live.yearly'];
const strict = process.argv.includes('--activation');
const baseUrl = (process.env.EXPO_PUBLIC_MELO_BILLING_URL ?? DEFAULT_URL).replace(/\/+$/, '');

let failed = false;
const report = (label, status, detail) => {
  const marker = status === 'PASS' ? 'PASS' : status === 'WAIT' ? 'WAIT' : 'FAIL';
  if (marker === 'FAIL') failed = true;
  console.log(`${marker} ${label}${detail ? ` — ${detail}` : ''}`);
};

const secretNames = listSecretNames();
if (secretNames === null) {
  report('remote Worker secret inventory', 'WAIT', 'Wrangler could not list secret names');
} else {
  for (const name of REQUIRED_SECRETS) {
    report(
      `secret ${name}`,
      secretNames.has(name) ? 'PASS' : 'WAIT',
      secretNames.has(name) ? 'present' : 'not installed',
    );
  }
}

try {
  const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(15_000) });
  const body = await response.json();
  if (!response.ok || body?.ok !== true) {
    report('deployed billing health', 'FAIL', `HTTP ${response.status}`);
  } else {
    report('deployed billing health', 'PASS', baseUrl);
    report(
      apple ? 'Apple provider' : 'Google Play provider',
      (apple ? body.appleProviderConfigured : body.providerConfigured) === true ? 'PASS' : 'WAIT',
      (apple ? body.appleProviderConfigured : body.providerConfigured) === true
        ? 'configured'
        : 'credentials or app configuration missing',
    );
    report(
      'entitlement signer',
      body.signerConfigured === true ? 'PASS' : 'WAIT',
      body.signerConfigured === true ? 'configured' : 'key missing',
    );
    report(
      'entitlement token store',
      body.tokenStoreConfigured === true ? 'PASS' : 'FAIL',
      body.tokenStoreConfigured === true ? 'bound' : 'KV binding missing',
    );
    const products = Array.isArray(body.products)
      ? body.products.filter((value) => EXPECTED_PRODUCTS.includes(value))
      : [];
    report(
      'shipping product catalog',
      products.length === EXPECTED_PRODUCTS.length ? 'PASS' : 'FAIL',
      `${products.length}/${EXPECTED_PRODUCTS.length} current products advertised`,
    );
    if (apple) {
      report(
        'Apple production environment',
        body.appleEnvironment === 'Production' ? 'PASS' : 'WAIT',
        body.appleEnvironment === 'Sandbox'
          ? 'Sandbox proofs are not production activation'
          : body.appleEnvironment === 'Production'
            ? 'Production'
            : 'not configured',
      );
      if (strict && body.appleEnvironment !== 'Production') failed = true;
    }
    if (strict && (apple ? body.appleProviderConfigured : body.providerConfigured) !== true)
      failed = true;
    if (strict && body.signerConfigured !== true) failed = true;
  }
} catch (error) {
  report('deployed billing health', 'FAIL', error instanceof Error ? error.message : 'unreachable');
}

if (strict && (secretNames === null || REQUIRED_SECRETS.some((name) => !secretNames.has(name)))) {
  failed = true;
}
if (failed) process.exitCode = 1;

function listSecretNames() {
  const command = fileURLToPath(
    new URL(
      process.platform === 'win32'
        ? '../../../node_modules/.bin/wrangler.cmd'
        : '../../../node_modules/.bin/wrangler',
      import.meta.url,
    ),
  );
  const args = ['secret', 'list', '--config', 'wrangler.jsonc'];
  const result = spawnSync(
    process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : command,
    process.platform === 'win32' ? ['/d', '/c', [command, ...args].join(' ')] : args,
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  if (result.status !== 0 || typeof result.stdout !== 'string') return null;
  try {
    const parsed = JSON.parse(result.stdout);
    if (!Array.isArray(parsed)) return null;
    const names = new Set();
    for (const item of parsed) {
      if (item && typeof item.name === 'string') names.add(item.name);
    }
    return names;
  } catch {
    return null;
  }
}
