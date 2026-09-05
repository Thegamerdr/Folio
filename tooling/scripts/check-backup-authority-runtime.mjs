// One bounded real-SQLite DO exercise. Synthetic ciphertext only; no deployed data or credentials.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const built = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
    export { BackupWorkspaceDurableObject } from './services/cloud-vault/src/backup-workspace.ts';
    export default { fetch(request, env) {
      return env.BACKUPS.getByName(request.headers.get('x-audit-account') || 'synthetic-account').fetch(request);
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
  durableObjects: { BACKUPS: { className: 'BackupWorkspaceDurableObject', useSQLite: true } },
});
const workspaceRef = 'a'.repeat(64);
const hash = (body) => createHash('sha256').update(body).digest('hex');
const path = (suffix = '') =>
  `http://localhost/internal/backup${suffix}?workspaceRef=${workspaceRef}`;
const put = (body, conditional) =>
  runtime.dispatchFetch(path(), {
    method: 'PUT',
    body,
    headers: {
      'X-Melo-Checksum': hash(body),
      'X-Melo-Created-At': '2026-09-05T12:00:00.000Z',
      'X-Melo-Device': 'synthetic-device',
      ...conditional,
    },
  });
try {
  const first = Buffer.alloc(4 * 1024 * 1024, 42);
  assert.equal((await put(Buffer.from('missing-condition'), {})).status, 428);
  const created = await put(first, { 'If-None-Match': '*' });
  assert.equal(created.status, 201, await created.text());
  const candidates = [Buffer.from('synthetic-ciphertext-A'), Buffer.from('synthetic-ciphertext-B')];
  const writes = await Promise.all(candidates.map((body) => put(body, { 'If-Match': '1' })));
  assert.equal(writes.filter((response) => response.status === 201).length, 1);
  assert.equal(writes.filter((response) => [409, 412].includes(response.status)).length, 1);
  const winner = candidates[writes.findIndex((response) => response.status === 201)];
  const current = await (await runtime.dispatchFetch(path('/status'))).json();
  assert.equal(current.generation, 2);
  assert.equal(current.checksum, hash(winner));
  const previous = await runtime.dispatchFetch(`${path('/content')}&generation=previous`);
  assert.equal(hash(Buffer.from(await previous.arrayBuffer())), hash(first));
  assert.ok(
    [409, 412].includes((await put(first, { 'If-None-Match': '*' })).status),
    'old retained ciphertext cannot masquerade as the current retry',
  );
  assert.equal((await put(winner, { 'If-Match': '1' })).status, 200);
  const catalogue = await (
    await runtime.dispatchFetch('http://localhost/internal/backup/catalog')
  ).json();
  assert.equal(catalogue.workspaces.length, 1);
  assert.equal(catalogue.workspaces[0].workspaceRef, workspaceRef);
  const otherAccount = await (
    await runtime.dispatchFetch('http://localhost/internal/backup/catalog', {
      headers: { 'x-audit-account': 'different-account' },
    })
  ).json();
  assert.deepEqual(otherAccount.workspaces, []);
  const rotated = Buffer.from('rotated-key-ciphertext');
  assert.equal((await put(rotated, { 'If-Match': '2', 'X-Melo-Key-Rotation': '1' })).status, 201);
  assert.equal((await put(Buffer.from('ordinary-next'), { 'If-Match': '3' })).status, 201);
  assert.equal((await put(Buffer.from('ordinary-again'), { 'If-Match': '4' })).status, 201);
  const anchor = await runtime.dispatchFetch(`${path('/content')}&generation=anchor`);
  assert.equal(
    hash(Buffer.from(await anchor.arrayBuffer())),
    hash(winner),
    'ordinary writes must retain the original old-key anchor',
  );
  assert.equal((await runtime.dispatchFetch(`${path('/content')}&generation=invalid`)).status, 400);
  assert.equal((await runtime.dispatchFetch(path(), { method: 'DELETE' })).status, 200);
  assert.ok(
    [409, 412].includes((await put(winner, { 'If-Match': '2' })).status),
    'stale upload must not resurrect a deleted workspace',
  );
  assert.equal((await (await runtime.dispatchFetch(path('/status'))).json()).exists, false);
  assert.equal((await put(Buffer.from('late-first-create'), { 'If-None-Match': '*' })).status, 412);
  assert.equal(
    (
      await put(Buffer.from('intentional-recreate'), {
        'If-None-Match': '*',
        'X-Melo-Backup-Revision': '1',
      })
    ).status,
    201,
  );
  assert.equal((await (await runtime.dispatchFetch(path('/status'))).json()).generation, 6);
  const unseen = 'c'.repeat(64);
  assert.equal(
    (await runtime.dispatchFetch(path().replace(workspaceRef, unseen), { method: 'DELETE' }))
      .status,
    200,
  );
  const staleFirst = Buffer.from('in-flight-first-backup');
  assert.equal(
    (
      await runtime.dispatchFetch(path().replace(workspaceRef, unseen), {
        method: 'PUT',
        body: staleFirst,
        headers: {
          'If-None-Match': '*',
          'X-Melo-Checksum': hash(staleFirst),
          'X-Melo-Created-At': '2026-09-05T12:00:00.000Z',
          'X-Melo-Device': 'synthetic-device',
        },
      })
    ).status,
    412,
  );
  const migration = ['previous-encrypted-copy', 'latest-encrypted-copy'].map((body) => ({
    body,
    checksum: hash(body),
    createdAt: '2026-09-05T12:00:00.000Z',
    deviceId: 'legacy-device',
  }));
  const migrationPath = `http://localhost/internal/backup/adopt?workspaceRef=${'d'.repeat(64)}`;
  assert.equal(
    (
      await runtime.dispatchFetch(migrationPath, {
        method: 'POST',
        body: JSON.stringify(migration),
      })
    ).status,
    201,
  );
  const migratedPrior = await runtime.dispatchFetch(
    `http://localhost/internal/backup/content?workspaceRef=${'d'.repeat(64)}&generation=previous`,
  );
  assert.equal(await migratedPrior.text(), migration[0].body);
  assert.equal(
    (
      await runtime.dispatchFetch(migrationPath.replace('adopt', '').replace('/?', '?'), {
        method: 'DELETE',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await runtime.dispatchFetch(migrationPath, {
        method: 'POST',
        body: JSON.stringify(migration),
      })
    ).status,
    412,
  );
  assert.equal(
    (await runtime.dispatchFetch('http://localhost/internal/backup/account', { method: 'DELETE' }))
      .status,
    200,
  );
  assert.equal(
    (
      await runtime.dispatchFetch(migrationPath.replace('d'.repeat(64), 'e'.repeat(64)), {
        method: 'POST',
        body: JSON.stringify(migration),
      })
    ).status,
    410,
  );
  console.log(
    'PASS: real SQLite chunk/CAS/retry, lasting rotation anchor, two-generation migration, catalog isolation and workspace/account deletion fences.',
  );
} finally {
  await runtime.dispose();
}
