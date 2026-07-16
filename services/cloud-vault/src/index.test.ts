import { describe, expect, it } from 'vitest';

import { backupObjectKeys, handleAuthenticatedRequest, type BackupStore } from './index';

type Stored = {
  bytes: Uint8Array;
  etag: string;
  uploaded: Date;
  customMetadata: Record<string, string>;
};

function memoryStore(): { store: BackupStore; objects: Map<string, Stored> } {
  const objects = new Map<string, Stored>();
  const store: BackupStore = {
    get: async (key) => {
      const found = objects.get(key);
      if (found === undefined) return null;
      return {
        body: new Blob([found.bytes]).stream(),
        size: found.bytes.byteLength,
        etag: found.etag,
        uploaded: found.uploaded,
        customMetadata: found.customMetadata,
      };
    },
    head: async (key) => {
      const found = objects.get(key);
      if (found === undefined) return null;
      return {
        size: found.bytes.byteLength,
        etag: found.etag,
        uploaded: found.uploaded,
        customMetadata: found.customMetadata,
      };
    },
    put: async (key, value, options) => {
      const bytes =
        value instanceof Uint8Array
          ? value
          : new Uint8Array(await new Response(value).arrayBuffer());
      objects.set(key, {
        bytes,
        etag: `\"${key}-${bytes.byteLength}\"`,
        uploaded: new Date('2026-07-14T12:00:00.000Z'),
        customMetadata: options.customMetadata,
      });
    },
    delete: async (keys) => {
      for (const key of keys) objects.delete(key);
    },
    list: async (prefix) => [...objects.keys()].filter((key) => key.startsWith(prefix)),
  };
  return { store, objects };
}

async function checksum(body: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function storageRef(value: string): Promise<string> {
  return checksum(value);
}

const WORKSPACE_A = 'a'.repeat(64);
const WORKSPACE_B = 'b'.repeat(64);

function request(
  method: string,
  path: string,
  body?: string,
  sum?: string,
  workspaceRef: string | null = WORKSPACE_A,
): Request {
  const headers = new Headers();
  if (workspaceRef !== null) headers.set('X-Melo-Workspace-Ref', workspaceRef);
  if (body !== undefined) {
    headers.set('Content-Length', String(new TextEncoder().encode(body).byteLength));
    headers.set('X-Melo-Checksum', sum ?? '0'.repeat(64));
    headers.set('X-Melo-Created-At', '2026-07-14T10:00:00.000Z');
    headers.set('X-Melo-Device', 'device-test');
  }
  return new Request(`https://vault.test${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

describe('Melo cloud vault', () => {
  it('hashes user ids before forming object keys', async () => {
    const keys = await backupObjectKeys('user_private', WORKSPACE_A);
    expect(keys.latest).not.toContain('user_private');
    expect(keys.latest).toMatch(
      /^users\/[a-f0-9]{64}\/workspaces\/[a-f0-9]{64}\/latest\.melo-backup$/,
    );
    expect(keys.latest).toContain(`/workspaces/${WORKSPACE_A}/`);
    await expect(backupObjectKeys('user_private', 'not-a-ref')).rejects.toThrow();
  });

  it('stores only the submitted encrypted envelope and reports metadata', async () => {
    const { store, objects } = memoryStore();
    const body = '{"v":1,"ciphertext":"FVE1:opaque"}';
    const response = await handleAuthenticatedRequest(
      request('PUT', '/v1/backup', body, await checksum(body)),
      store,
      'user_1',
      4096,
    );
    expect(response.status).toBe(201);
    expect(objects.size).toBe(1);
    const status = await handleAuthenticatedRequest(
      request('GET', '/v1/backup'),
      store,
      'user_1',
      4096,
    );
    await expect(status.json()).resolves.toMatchObject({ exists: true, generations: 1 });
  });

  it('rotates one previous generation and deletes both', async () => {
    const { store, objects } = memoryStore();
    for (const body of ['{"ciphertext":"one"}', '{"ciphertext":"two"}']) {
      const response = await handleAuthenticatedRequest(
        request('PUT', '/v1/backup', body, await checksum(body)),
        store,
        'user_2',
        4096,
      );
      expect(response.status).toBe(201);
    }
    expect(objects.size).toBe(2);
    const status = await handleAuthenticatedRequest(
      request('GET', '/v1/backup'),
      store,
      'user_2',
      4096,
    );
    await expect(status.json()).resolves.toMatchObject({ generations: 2 });
    const deleted = await handleAuthenticatedRequest(
      request('DELETE', '/v1/backup'),
      store,
      'user_2',
      4096,
    );
    expect(deleted.status).toBe(200);
    expect(objects.size).toBe(0);
  });

  it('exposes an idempotent account-cloud-data purge route', async () => {
    const { store, objects } = memoryStore();
    const body = '{"ciphertext":"account-copy"}';
    await handleAuthenticatedRequest(
      request('PUT', '/v1/backup', body, await checksum(body)),
      store,
      'user_delete',
      4096,
    );
    const deleted = await handleAuthenticatedRequest(
      request('DELETE', '/v1/account'),
      store,
      'user_delete',
      4096,
    );
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toMatchObject({
      deleted: true,
      scope: 'account-cloud-data',
    });
    expect(objects.size).toBe(0);
  });

  it('isolates two workspaces for one account and purges both at account deletion', async () => {
    const { store, objects } = memoryStore();
    const bodyA = '{"ciphertext":"workspace-a"}';
    const bodyB = '{"ciphertext":"workspace-b"}';
    await handleAuthenticatedRequest(
      request('PUT', '/v1/backup', bodyA, await checksum(bodyA), WORKSPACE_A),
      store,
      'user_multi',
      4096,
    );
    await handleAuthenticatedRequest(
      request('PUT', '/v1/backup', bodyB, await checksum(bodyB), WORKSPACE_B),
      store,
      'user_multi',
      4096,
    );
    expect(objects.size).toBe(2);

    const contentA = await handleAuthenticatedRequest(
      request('GET', '/v1/backup/content', undefined, undefined, WORKSPACE_A),
      store,
      'user_multi',
      4096,
    );
    const contentB = await handleAuthenticatedRequest(
      request('GET', '/v1/backup/content', undefined, undefined, WORKSPACE_B),
      store,
      'user_multi',
      4096,
    );
    await expect(contentA.text()).resolves.toBe(bodyA);
    await expect(contentB.text()).resolves.toBe(bodyB);

    await handleAuthenticatedRequest(request('DELETE', '/v1/account'), store, 'user_multi', 4096);
    expect(objects.size).toBe(0);
  });

  it('maps a headerless legacy client to Personal and keeps both object paths in sync', async () => {
    const { store, objects } = memoryStore();
    const body = '{"ciphertext":"legacy-personal"}';
    const response = await handleAuthenticatedRequest(
      request('PUT', '/v1/backup', body, await checksum(body), null),
      store,
      'user_legacy',
      4096,
    );
    expect(response.status).toBe(201);
    expect(objects.size).toBe(2);
    const read = await handleAuthenticatedRequest(
      request('GET', '/v1/backup/content', undefined, undefined, null),
      store,
      'user_legacy',
      4096,
    );
    await expect(read.text()).resolves.toBe(body);
  });

  it('does not replace the legacy v1 object with a v2 envelope an old client cannot open', async () => {
    const { store } = memoryStore();
    const personalRef = await storageRef('workspace_personal_local');
    const legacyBody = '{"version":1,"ciphertext":"legacy"}';
    const currentBody = '{"version":2,"ciphertext":"current"}';
    await handleAuthenticatedRequest(
      request('PUT', '/v1/backup', legacyBody, await checksum(legacyBody), null),
      store,
      'user_compat',
      4096,
    );
    await handleAuthenticatedRequest(
      request('PUT', '/v1/backup', currentBody, await checksum(currentBody), personalRef),
      store,
      'user_compat',
      4096,
    );

    const oldClientRead = await handleAuthenticatedRequest(
      request('GET', '/v1/backup/content', undefined, undefined, null),
      store,
      'user_compat',
      4096,
    );
    const newClientRead = await handleAuthenticatedRequest(
      request('GET', '/v1/backup/content', undefined, undefined, personalRef),
      store,
      'user_compat',
      4096,
    );
    await expect(oldClientRead.text()).resolves.toBe(legacyBody);
    await expect(newClientRead.text()).resolves.toBe(currentBody);
  });

  it('rejects malformed workspace references before touching storage', async () => {
    const { store, objects } = memoryStore();
    const response = await handleAuthenticatedRequest(
      request('GET', '/v1/backup', undefined, undefined, 'workspace_personal_local'),
      store,
      'user_invalid',
      4096,
    );
    expect(response.status).toBe(400);
    expect(objects.size).toBe(0);
  });

  it('rejects oversized and checksum-mismatched uploads', async () => {
    const { store } = memoryStore();
    const body = 'opaque';
    const tooLarge = await handleAuthenticatedRequest(
      request('PUT', '/v1/backup', body, await checksum(body)),
      store,
      'user_3',
      3,
    );
    expect(tooLarge.status).toBe(413);
    const mismatch = await handleAuthenticatedRequest(
      request('PUT', '/v1/backup', body, '0'.repeat(64)),
      store,
      'user_3',
      4096,
    );
    expect(mismatch.status).toBe(400);
  });
});
