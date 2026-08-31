import { readFile } from 'node:fs/promises';
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
const requireSecrets = process.argv.includes('--require-secrets');
const requireEnabled = process.argv.includes('--require-enabled');
const remote = process.argv.includes('--remote');
const requiredSecrets = [
  'TRUELAYER_CLIENT_ID',
  'TRUELAYER_CLIENT_SECRET',
  'CONNECTION_ENCRYPTION_KEY',
];
const results = [];

const config = parseJsonc(await readFile(path.join(serviceRoot, 'wrangler.jsonc'), 'utf8'));
const vars = config.vars ?? {};

check(config.name === 'melo-open-banking', 'Worker name is melo-open-banking');
check(vars.APP_RETURN_URI === 'folio://open-banking', 'Mobile return URI is folio://open-banking');
check(
  validHttpsOrigin(vars.PUBLIC_BASE_URL),
  'Public Worker base URL is an HTTPS origin without embedded credentials',
);
check(
  validClerkPair(vars.CLERK_ISSUER, vars.CLERK_JWKS_URL),
  'Clerk issuer and JWKS URL share a valid HTTPS origin',
);
check(
  validTrueLayerPair(
    vars.TRUELAYER_ENVIRONMENT,
    vars.TRUELAYER_AUTH_BASE_URL,
    vars.TRUELAYER_API_BASE_URL,
  ),
  'TrueLayer environment is pinned to the documented host pair',
);
check(
  Array.isArray(config.kv_namespaces) &&
    config.kv_namespaces.some(
      (binding) => binding?.binding === 'OPEN_BANKING' && nonEmpty(binding?.id),
    ),
  'OPEN_BANKING KV binding is configured',
);
check(
  requireEnabled ? vars.OPEN_BANKING_ENABLED === 'true' : vars.OPEN_BANKING_ENABLED === 'false',
  requireEnabled
    ? 'Worker release gate is explicitly enabled'
    : 'Worker release gate remains explicitly disabled before approval',
);

if (remote) {
  const secretResult = wrangler(['secret', 'list']);
  if (secretResult.status !== 0) {
    check(false, 'Cloudflare secret inventory is readable');
  } else {
    check(true, 'Cloudflare secret inventory is readable');
    const names = parseSecretNames(secretResult.stdout);
    for (const name of requiredSecrets) {
      const present = names.has(name);
      if (requireSecrets) check(present, `${name} is installed`);
      else wait(present, `${name} is installed`, `${name} still needs to be installed`);
    }
  }

  try {
    const response = await fetch(`${String(vars.PUBLIC_BASE_URL).replace(/\/+$/u, '')}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    const health = await response.json();
    check(response.ok && health?.ok === true, 'Deployed Worker health endpoint is reachable');
    check(health?.configurationReady === true, 'Deployed non-secret configuration is valid');
    if (requireSecrets)
      check(health?.providerConfigured === true, 'Deployed provider is configured');
    else
      wait(
        health?.providerConfigured === true,
        'Deployed provider is configured',
        'Deployed provider is still waiting for secrets',
      );
    check(
      requireEnabled ? health?.featureEnabled === true : health?.featureEnabled === false,
      requireEnabled
        ? 'Deployed Worker feature gate is enabled'
        : 'Deployed Worker feature gate remains disabled',
    );
  } catch {
    check(false, 'Deployed Worker health endpoint is reachable');
  }
}

for (const result of results) console.log(`[${result.state}] ${result.message}`);
const failures = results.filter((result) => result.state === 'FAIL');
if (failures.length > 0) {
  console.error(`Open Banking readiness failed: ${failures.length} check(s) need attention.`);
  process.exitCode = 1;
} else {
  console.log(
    requireSecrets
      ? 'Open Banking is credential-configured and still governed by the explicit release gate.'
      : 'Open Banking is locally credential-ready; WAIT rows are the remaining owner/provider inputs.',
  );
}

function check(condition, message) {
  results.push({ state: condition ? 'PASS' : 'FAIL', message });
}

function wait(condition, passMessage, waitMessage) {
  results.push({
    state: condition ? 'PASS' : 'WAIT',
    message: condition ? passMessage : waitMessage,
  });
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validHttpsOrigin(value) {
  if (!nonEmpty(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function validClerkPair(issuerValue, jwksValue) {
  try {
    const issuer = new URL(issuerValue);
    const jwks = new URL(jwksValue);
    return (
      validHttpsOrigin(issuerValue) &&
      jwks.protocol === 'https:' &&
      !jwks.username &&
      !jwks.password &&
      jwks.origin === issuer.origin &&
      jwks.pathname === '/.well-known/jwks.json' &&
      !jwks.search &&
      !jwks.hash
    );
  } catch {
    return false;
  }
}

function validTrueLayerPair(environment, authValue, apiValue) {
  const expected =
    environment === 'sandbox'
      ? ['https://auth.truelayer-sandbox.com', 'https://api.truelayer-sandbox.com']
      : environment === 'live'
        ? ['https://auth.truelayer.com', 'https://api.truelayer.com']
        : null;
  if (expected === null) return false;
  try {
    const auth = new URL(authValue);
    const api = new URL(apiValue);
    return (
      auth.origin === expected[0] &&
      api.origin === expected[1] &&
      validHttpsOrigin(authValue) &&
      validHttpsOrigin(apiValue)
    );
  } catch {
    return false;
  }
}

function wrangler(args) {
  return spawnSync(process.execPath, [wranglerBin, ...args], {
    cwd: serviceRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function parseSecretNames(output) {
  try {
    const parsed = JSON.parse(output.trim());
    return new Set(
      Array.isArray(parsed)
        ? parsed.map((entry) => entry?.name).filter((name) => typeof name === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

function parseJsonc(source) {
  let cleaned = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (inString) {
      cleaned += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      cleaned += character;
      continue;
    }
    if (character === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      cleaned += '\n';
      continue;
    }
    if (character === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      index += 1;
      continue;
    }
    cleaned += character;
  }
  return JSON.parse(cleaned.replace(/,\s*([}\]])/gu, '$1'));
}
