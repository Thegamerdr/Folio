import type { LocalLedgerState } from './localLedger.js';
import type { PersistedWorkspace } from '../folio/lib/workspaceRoot.js';
import { loadLocalLedgerState, saveLocalLedgerState } from './nativeLedgerStore.js';
import type { CanonicalRepositorySnapshot } from '@folio/storage';
import {
  createCanonicalMobileLedgerSnapshot,
  type CanonicalMobileLedgerSnapshot,
} from './canonicalLedgerAdapter.js';
import {
  createCanonicalRepositoryForLocalLedgerState,
  createCanonicalRepositoryForMobileSnapshot,
} from './canonicalLedgerRepository.js';

export type CanonicalLedgerSaveResult = Readonly<{
  snapshot: CanonicalMobileLedgerSnapshot;
  repositorySnapshot: CanonicalRepositorySnapshot;
}>;

export async function loadCanonicalLocalLedgerState(
  workspace: PersistedWorkspace,
): Promise<LocalLedgerState | null> {
  const state = await loadLocalLedgerState(workspace);
  if (state === null) return null;

  try {
    createCanonicalRepositoryForLocalLedgerState(state, workspace);
  } catch {
    return null;
  }

  return state;
}

export async function saveCanonicalLocalLedgerState(
  workspace: PersistedWorkspace,
  state: LocalLedgerState,
): Promise<CanonicalLedgerSaveResult> {
  const repository = createCanonicalRepositoryForLocalLedgerState(state, workspace);
  const snapshot = createCanonicalMobileLedgerSnapshot(state, workspace);
  const repositorySnapshot = repository.snapshot();

  await saveLocalLedgerState(workspace, state);
  return { snapshot, repositorySnapshot };
}

export {
  createCanonicalRepositoryForLocalLedgerState,
  createCanonicalRepositoryForMobileSnapshot,
} from './canonicalLedgerRepository.js';
export { clearLocalLedgerStorage } from './nativeLedgerStore.js';
