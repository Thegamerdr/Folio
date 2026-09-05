/** Canonical authenticated transport contract shared by the platform-neutral API and native
 * bridge. The account bearer token authenticates the user; this proof authenticates one durable
 * device key and binds the exact request bytes, route and freshness fields. */
export type SyncRequestSignature = Readonly<{
  version: 1;
  signedAt: string;
  nonce: string;
  requestSequence: number;
  bodySha256: string;
  signature: string;
}>;

export type CloudSyncRequestSigner = Readonly<{
  sign: (input: {
    method: string;
    path: string;
    body: string | undefined;
  }) => Promise<SyncRequestSignature>;
}>;

export function canonicalSyncRequestMessage(input: {
  method: string;
  path: string;
  query: string;
  workspaceRef: string;
  deviceId: string;
  bodySha256: string;
  signedAt: string;
  nonce: string;
  requestSequence: number;
}): string {
  return [
    'melo.sync.v1',
    input.method.toUpperCase(),
    input.path,
    input.query,
    input.workspaceRef,
    input.deviceId,
    input.bodySha256,
    input.signedAt,
    input.nonce,
    String(input.requestSequence),
  ].join('\n');
}
