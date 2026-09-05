// One bounded smoke of the shipping coordinator using real workerd SQLite DO transactions.
// Synthetic keys/ciphertext only. Does not contact a deployed service or prove account JWT setup.
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

async function bundle(contents) {
  return (await build({
    stdin: { contents, resolveDir: process.cwd() }, bundle: true, write: false,
    format: 'esm', platform: 'neutral', target: 'es2022',
  })).outputFiles[0].text;
}
const contract = await bundle("export { canonicalSyncRequestMessage } from './packages/sync/src/signedRequest.ts';");
const { canonicalSyncRequestMessage } = await import(`data:text/javascript;base64,${Buffer.from(contract).toString('base64')}`);
const script = await bundle(`
export { SyncWorkspaceDurableObject } from './services/cloud-vault/src/sync-workspace.ts';
export default { fetch(request, env) {
  return env.SYNC_WORKSPACES.getByName(request.headers.get('x-melo-workspace-ref')).fetch(request);
} };
`);
const runtime = new Miniflare({
  modules: true, script, compatibilityDate: '2026-06-25',
  durableObjects: { SYNC_WORKSPACES: { className: 'SyncWorkspaceDurableObject', useSQLite: true } },
});
const hash = (value) => createHash('sha256').update(value).digest('hex');
const workspaceRef = 'a'.repeat(64);
const devices = ['b', 'c'].map((prefix) => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
  return { deviceId: prefix.repeat(32), privateKey, raw, sequence: 0 };
});
const registration = (device) => ({
  deviceId: device.deviceId, label: 'Synthetic runtime fixture',
  publicKey: device.raw.toString('base64url'), publicKeyFingerprint: `sha256:${hash(device.raw)}`,
  keyEpoch: 1, wrappedSyncKey: 'synthetic-opaque-key',
});
async function call(device, method, path, value) {
  const body = value === undefined ? undefined : JSON.stringify(value);
  const url = new URL(path, 'http://localhost');
  const bodySha256 = hash(body ?? '');
  const signedAt = new Date().toISOString();
  const nonce = randomUUID();
  const requestSequence = ++device.sequence;
  const message = canonicalSyncRequestMessage({
    method, path: url.pathname, query: url.search.slice(1), workspaceRef,
    deviceId: device.deviceId, bodySha256, signedAt, nonce, requestSequence,
  });
  return runtime.dispatchFetch(url, {
    method, body, headers: {
      'content-type': 'application/json', 'x-melo-workspace-ref': workspaceRef,
      'x-melo-device': device.deviceId, 'x-melo-signature-version': '1',
      'x-melo-signed-at': signedAt, 'x-melo-nonce': nonce,
      'x-melo-request-sequence': String(requestSequence), 'x-melo-body-sha256': bodySha256,
      'x-melo-signature': sign(null, Buffer.from(message), device.privateKey).toString('base64url'),
    },
  });
}
try {
  for (const device of devices) {
    const response = await call(devices[0], 'POST', '/v1/sync/devices', registration(device));
    assert.equal(response.status, 201, await response.text());
  }
  const responses = await Promise.all(devices.map((device, index) => {
    const bytes = Buffer.from(`synthetic-operation-${index}`);
    return call(device, 'POST', '/v1/sync/operations', {
      id: `operation-${index}`, deviceId: device.deviceId, deviceSequence: 1, keyEpoch: 1,
      idempotencyKey: `fixture-${index}`, createdAt: new Date().toISOString(),
      ciphertext: bytes.toString('base64'), ciphertextSha256: hash(bytes),
    });
  }));
  const cursors = [];
  for (const response of responses) {
    const body = await response.json();
    assert.equal(response.status, 201, JSON.stringify(body));
    cursors.push(body.cursor);
  }
  assert.deepEqual(cursors.sort(), [1, 2]);
  const replay = await call(devices[0], 'GET', '/v1/sync/operations?after=0');
  assert.equal(replay.status, 200);
  const page = await replay.json();
  assert.equal(page.operations.length, 2);
  assert.equal(page.nextCursor, 2);
  console.log('PASS: two real enrolled devices concurrently commit two operations/cursors in local SQLite Durable Object storage.');
} finally {
  await runtime.dispose();
}
