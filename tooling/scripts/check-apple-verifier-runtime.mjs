// Bounded compatibility smoke using Apple's public, synthetic signed fixture.
// This is not App Store account, production OCSP, or iOS device evidence.
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { readFile } from 'node:fs/promises';

const fixtureRoot =
  'https://raw.githubusercontent.com/apple/app-store-server-library-node/main/tests/resources';
async function fixture(path) {
  const response = await fetch(`${fixtureRoot}/${path}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Apple public fixture returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const [root, signed] = await Promise.all([
  fixture('certs/testCA.der'),
  fixture('mock_signed_data/transactionInfo'),
]);
const source = `
import service from './services/billing-entitlements/src/index.ts';
import appleFetch from './services/billing-entitlements/src/apple-fetch.ts';
export default { async fetch(request) {
  if (new URL(request.url).pathname === '/health') return service.fetch(request, { PACKAGE_NAME: 'com.folio.v2.greenfield' });
  if (new URL(request.url).pathname === '/transport') {
    const response = await appleFetch('https://ocsp.apple.com/synthetic-audit', { method: 'POST', body: new Uint8Array([4, 5]) });
    return Response.json({ bytes: [...await response.buffer()] });
  }
  const { SignedDataVerifier, Environment } = await import('@apple/app-store-server-library');
  const verifier = new SignedDataVerifier([Buffer.from(${JSON.stringify(root.toString('base64'))}, 'base64')], false, Environment.SANDBOX, 'com.example', 1234);
  const decoded = await verifier.verifyAndDecodeTransaction(${JSON.stringify(signed.toString('utf8').trim())});
  return Response.json({ bundleId: decoded.bundleId, environment: decoded.environment });
} };
`;
const bundled = await build({
  stdin: { contents: source, resolveDir: process.cwd(), sourcefile: 'apple-runtime-smoke.ts' },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  alias: { 'node-fetch': './services/billing-entitlements/src/apple-fetch.ts' },
  metafile: true,
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire('/apple-worker.js');",
  },
});
if (
  Object.keys(bundled.metafile.inputs).some((path) => /node_modules[\\/]node-fetch[\\/]/.test(path))
)
  throw new Error('SDK Worker transport alias is not active');
const runtime = new Miniflare({
  modules: true,
  script: bundled.outputFiles[0].text,
  compatibilityDate: '2026-06-25',
  compatibilityFlags: ['nodejs_compat'],
  outboundService: async () => new Response(new Uint8Array([1, 2, 3])),
});
try {
  const health = await runtime.dispatchFetch('http://localhost/health');
  if (!health.ok || (await health.json()).appleProviderConfigured !== false)
    throw new Error('Shipping billing Worker did not start safely');
  const transport = await runtime.dispatchFetch('http://localhost/transport');
  const transportBody = await transport.text();
  if (!transport.ok || JSON.stringify(JSON.parse(transportBody).bytes) !== '[1,2,3]')
    throw new Error(
      `Apple SDK Worker transport failed: ${transport.status} ${transportBody.slice(0, 1000)}`,
    );
  const response = await runtime.dispatchFetch('http://localhost/verify');
  const result = await response.text();
  if (!response.ok)
    throw new Error(`Worker verification failed: ${response.status}: ${result.slice(0, 1000)}`);
  const value = JSON.parse(result);
  if (value.bundleId !== 'com.example' || value.environment !== 'Sandbox')
    throw new Error('Unexpected verified fixture');
  console.log(
    'PASS: shipping billing Worker starts, SDK native transport alias works, official Apple certificate/JWS verification passes (synthetic Sandbox fixture; online certificate/account proof not asserted).',
  );
} finally {
  await runtime.dispose();
}

const appleSource = await readFile('services/billing-entitlements/src/apple.ts', 'utf8');
for (const generation of ['G2', 'G3']) {
  const pinned = new RegExp(`const APPLE_ROOT_CA_${generation} =\\s*'([^']+)'`).exec(
    appleSource,
  )?.[1];
  const response = await fetch(
    `https://www.apple.com/certificateauthority/AppleRootCA-${generation}.cer`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok || Buffer.from(await response.arrayBuffer()).toString('base64') !== pinned)
    throw new Error(`Apple ${generation} trust anchor mismatch`);
}
console.log('PASS: bundled Apple G2/G3 trust anchors exactly match Apple public PKI certificates.');
