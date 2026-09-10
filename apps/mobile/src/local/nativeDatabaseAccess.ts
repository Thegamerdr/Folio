/** A busy native connection is not evidence of corrupt or missing saved money. */
export function isTransientDatabaseLock(reason: unknown): boolean {
  const record =
    typeof reason === 'object' && reason !== null
      ? (reason as { code?: unknown; message?: unknown })
      : undefined;
  const code = record?.code;
  if (typeof code === 'number' && ((code & 0xff) === 5 || (code & 0xff) === 6)) return true;
  const message = typeof record?.message === 'string' ? record.message : String(reason);
  return /SQLITE_(?:BUSY|LOCKED)|database (?:table |schema )?is locked|database is busy/iu.test(
    `${String(code ?? '')} ${message}`,
  );
}

const workspaceTails = new Map<string, Promise<void>>();
const RETRY_DELAYS_MS = [25, 75, 150, 300, 600] as const;

/** OP-SQLite handles for one vault must finish and close before another operation opens it.
 * The queue spans readers and writers, including an Activity recreation's new hydration. */
export function withNativeDatabaseAccess<T>(
  workspaceId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = workspaceTails.get(workspaceId) ?? Promise.resolve();
  const result = previous.then(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await operation();
      } catch (reason: unknown) {
        const delay = RETRY_DELAYS_MS[attempt];
        if (!isTransientDatabaseLock(reason) || delay === undefined) throw reason;
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  });
  const settled = result.then(
    () => undefined,
    () => undefined,
  );
  workspaceTails.set(workspaceId, settled);
  void settled.then(() => {
    if (workspaceTails.get(workspaceId) === settled) workspaceTails.delete(workspaceId);
  });
  return result;
}
