// Actual routed handler -> SQLite authority -> encrypted receipt -> acknowledgement.
// All identity, bank rows and provider calls are synthetic and confined to workerd.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const built = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import { handleRequest } from './services/open-banking/src/index.ts';
      import { ProviderError } from './services/open-banking/src/truelayer.ts';
      export { BankingWorkspaceDurableObject } from './services/open-banking/src/banking-workspace.ts';
      const values = new Map();
      const store = {
        get: async key => values.get(key) ?? null,
        put: async (key, value) => { values.set(key, value); },
        delete: async key => { values.delete(key); },
        list: async prefix => [...values.keys()].filter(key => key.startsWith(prefix)),
      };
      let callbackUrl, jobs = 0, reads = 0, entered = false, hold, failRead;
      const provider = {
        configured: true, configurationValid: true, environment: 'sandbox',
        createConnection: async input => {
          callbackUrl = input.returnUri;
          return { providerConnectionId: 'synthetic-provider', authorizationUrl: 'https://provider.example.test/auth' };
        },
        listAccounts: async () => [1, 2].map(id => ({ id: 'account-' + id, type: 'account', accountType: 'current', customerSegment: 'retail', currency: 'GBP' })),
        createTransactionsRequest: async () => ({ requestId: 'job-' + ++jobs }),
        getTransactionsRequest: async (_, account, requestId) => {
          reads++; entered = true; if (hold) await new Promise(resolve => setTimeout(resolve, 1000));
          if (failRead) { failRead = false; throw new ProviderError('provider_timeout', 504); }
          return { status: 'completed', requestId, nextCursor: null,
            items: Array.from({ length: account === 'account-1' ? 500 : 650 }, (_, i) => ({
              id: account + '-' + i, timestamp: '2026-09-04T12:00:00Z',
              description: 'Synthetic row', currency: 'GBP', amountInMinor: -123, status: 'settled',
            })),
          };
        },
      };
      export default { async fetch(request, bindings) {
        const path = new URL(request.url).pathname;
        if (path === '/__inspect') return Response.json({ callbackUrl, jobs, reads, entered });
        if (path === '/__hold') { entered = false; hold = true; return Response.json({ ok: true }); }
        if (path === '/__release') { hold = false; return Response.json({ ok: true }); }
        if (path === '/__failRead') { failRead = true; return Response.json({ ok: true }); }
        const env = { ...bindings, OPEN_BANKING_ENABLED: 'true',
          CLERK_ISSUER: 'https://identity.example.test', CLERK_JWKS_URL: 'https://identity.example.test/.well-known/jwks.json',
          PUBLIC_BASE_URL: 'https://bank.example.test', APP_RETURN_URI: 'folio://open-banking',
          TRUELAYER_ENVIRONMENT: 'sandbox', TRUELAYER_AUTH_BASE_URL: 'https://auth.example.test', TRUELAYER_API_BASE_URL: 'https://api.example.test',
          CONNECTION_ENCRYPTION_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(7))),
        };
        try { return await handleRequest(request, store, provider, env, async () => 'synthetic-account'); }
        catch (reason) { return Response.json({ error: reason.code ?? 'internal_error' }, { status: reason.status ?? 500 }); }
      } };
    `,
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
  durableObjects: {
    BANKING_WORKSPACE: { className: 'BankingWorkspaceDurableObject', useSQLite: true },
  },
});
const headers = { 'content-type': 'application/json', 'X-Melo-Workspace-Ref': '1'.repeat(64) };
const call = (path, method = 'GET', body) =>
  runtime.dispatchFetch(`http://localhost${path}`, {
    method,
    headers,
    signal: AbortSignal.timeout(15_000),
    redirect: 'manual',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const value = async (response, status = 200) => {
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  return body;
};
try {
  const created = await value(
    await call('/v1/connections', 'POST', {
      displayName: 'Synthetic Tester',
      email: 'test@example.test',
    }),
    201,
  );
  const base = '/v1/connections/' + created.connection.id;
  const inspect = () => call('/__inspect').then((response) => value(response));
  const callback = new URL((await inspect()).callbackUrl);
  assert.equal((await call(callback.pathname + callback.search)).status, 302);
  const first = await value(await call(base + '/sync', 'POST'));
  assert.equal(first.candidates.length, 500);
  const beforeReplay = await inspect();
  assert.deepEqual(await value(await call(base + '/sync', 'POST')), first);
  assert.deepEqual(
    await inspect(),
    beforeReplay,
    'Unacknowledged receipt must not trigger provider I/O',
  );
  const ack = (batch) =>
    call(base + '/ack', 'POST', {
      deliveryId: batch.deliveryId,
      revision: batch.connectionRevision,
    });
  await value(
    await call(base + '/ack', 'POST', {
      deliveryId: first.deliveryId,
      revision: first.connectionRevision + 1,
    }),
    409,
  );
  await value(await ack(first));
  const second = await value(await call(base + '/sync', 'POST'));
  assert.equal(second.candidates.length, 500);
  await value(await ack(second));
  const third = await value(await call(base + '/sync', 'POST'));
  assert.equal(third.candidates.length, 150);
  assert.equal(
    new Set(
      [...first.candidates, ...second.candidates, ...third.candidates].map((row) => row.externalId),
    ).size,
    1150,
  );
  assert.equal(
    (await inspect()).jobs,
    2,
    'Partial page must reuse the exact immutable provider job',
  );
  await value(await ack(third));
  await value(await call('/__failRead', 'POST'));
  const delayed = await value(await call(base + '/sync', 'POST'), 202);
  assert.equal(delayed.pending, true);
  const jobsAfterFailure = (await inspect()).jobs;
  const resumed = await value(await call(base + '/sync', 'POST'));
  assert.equal(resumed.candidates.length, 500);
  assert.equal(
    (await inspect()).jobs,
    jobsAfterFailure,
    'A failed first read must not discard the newly issued provider job',
  );
  await value(await ack(resumed));
  await value(await call('/__hold', 'POST'));
  const inFlight = call(base + '/sync', 'POST');
  for (let i = 0; i < 30 && !(await inspect()).entered; i++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal((await inspect()).entered, true);
  await value(await call(base, 'DELETE'));
  await value(await call('/__release', 'POST'));
  await value(await inFlight, 409);
  await value(await call(base + '/sync', 'POST'), 409);
  await value(await call('/v1/account', 'DELETE'));
  await value(
    await call('/v1/connections', 'POST', {
      displayName: 'Synthetic Tester',
      email: 'test@example.test',
    }),
    410,
  );
  console.log(
    'Bank routed delivery passed: immutable replay, revision ack, two-account pagination, failed-read resume, disconnect race, account deletion fence.',
  );
} finally {
  await runtime.dispose();
}
