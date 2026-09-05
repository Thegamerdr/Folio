// Bounded real-SQLite Durable Object exercise. Synthetic records only; no provider or account data.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const built = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export { BankingWorkspaceDurableObject } from './services/open-banking/src/banking-workspace.ts';
      export default { fetch(request, env) { return env.BANKING.getByName('synthetic-account').fetch(request); } };`,
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
});
const runtime = new Miniflare({
  modules: true,
  script: built.outputFiles[0].text,
  compatibilityDate: '2026-06-25',
  durableObjects: { BANKING: { className: 'BankingWorkspaceDurableObject', useSQLite: true } },
});
const workspaceRef = 'a'.repeat(64);
const id = '12345678-1234-4234-8234-123456789abc';
const record = {
  v: 2,
  workspaceRef,
  id,
  provider: 'truelayer-data-v3',
  status: 'pending_redirect',
  scopes: ['accounts', 'transactions'],
  createdAt: '2026-09-05T12:00:00.000Z',
  callbackAt: null,
  grantedAt: null,
  expiresAt: null,
  disconnectedAt: null,
  lastSuccessfulRefreshAt: null,
  lastErrorCode: null,
  accounts: [],
  sealedProvider: {
    v: 2,
    alg: 'A256GCM',
    binding: 'melo-open-banking-connection',
    nonce: 'nonce',
    ciphertext: 'ciphertext',
  },
};
const endpoint = (path) => `http://localhost${path}`;
const call = (path, init = {}) => runtime.dispatchFetch(endpoint(path), init);
const post = (path, body) =>
  call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const json = async (response) => response.json();

assert.equal((await post('/internal/connection', { workspaceRef, id, record })).status, 201);
const claimed = await json(await post('/internal/connection/claim', { workspaceRef, id }));
assert.equal(typeof claimed.leaseToken, 'string');
const next = { ...record, status: 'active' };
assert.equal(
  (
    await post('/internal/connection/commit', {
      workspaceRef,
      id,
      expectedRevision: claimed.revision,
      leaseToken: claimed.leaseToken,
      deliveryId: 'delivery-1',
      record: next,
      sealedPayload: 'sealed-ciphertext',
    })
  ).status,
  200,
);
const replay = await json(await post('/internal/connection/claim', { workspaceRef, id }));
assert.equal(replay.receipt.payload, 'sealed-ciphertext');
assert.equal(
  (
    await post('/internal/connection/ack', {
      workspaceRef,
      id,
      deliveryId: 'delivery-1',
      revision: replay.receipt.revision,
    })
  ).status,
  200,
);
const [first, second] = await Promise.all([
  post('/internal/connection/claim', { workspaceRef, id }),
  post('/internal/connection/claim', { workspaceRef, id }),
]);
assert.equal([first.status, second.status].filter((status) => status === 200).length, 1);
assert.equal([first.status, second.status].filter((status) => status === 409).length, 1);
const accountDelete = await call('/internal/account', { method: 'DELETE' });
assert.equal(accountDelete.status, 200);
assert.equal(
  (
    await post('/internal/connection', {
      workspaceRef,
      id: '22345678-1234-4234-8234-123456789abc',
      record: { ...record, id: '22345678-1234-4234-8234-123456789abc' },
    })
  ).status,
  410,
);
console.log('open-banking authority runtime checks passed');
