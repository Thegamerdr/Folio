import type { ApplyRestoreResult } from './restoreNative';

export type RestoreFailureHandler = (message: string) => void;
export type RestoreSuccessHandler = (result: ApplyRestoreResult) => void | Promise<void>;

export function restoreFailureMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Restore could not finish on this device.';
}

/**
 * Keep the final confirmation callback attached to the restore promise. The picker flow has
 * already returned by the time this callback runs, so its rejection cannot reach the picker's
 * outer catch. This coordinator owns only the async boundary; the screen supplies its existing
 * success alert and failure status dialog.
 */
export async function runConfirmedRestore(
  apply: () => Promise<ApplyRestoreResult>,
  onSuccess: RestoreSuccessHandler,
  onFailure: RestoreFailureHandler,
): Promise<void> {
  let result: ApplyRestoreResult;
  try {
    result = await apply();
  } catch (reason: unknown) {
    onFailure(restoreFailureMessage(reason));
    return;
  }
  try {
    await onSuccess(result);
  } catch (reason: unknown) {
    onFailure(restoreFailureMessage(reason));
  }
}
