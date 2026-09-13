import type { WorkspaceId } from '@folio/domain';

/** A review rollback is safe only while the captured workspace and exact post-attempt partition
 * are still current. This is deliberately a small guard over the store's serialized revision;
 * persistence itself remains owned by persistCurrentStateNow. */
export function canRestoreReviewSnapshot(input: {
  currentWorkspaceId: WorkspaceId | string;
  expectedWorkspaceId: WorkspaceId | string;
  currentBlob: string;
  expectedAttemptBlob: string;
}): boolean {
  return (
    String(input.currentWorkspaceId) === String(input.expectedWorkspaceId) &&
    input.currentBlob === input.expectedAttemptBlob
  );
}
