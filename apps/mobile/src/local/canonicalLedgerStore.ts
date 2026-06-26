import type { LocalLedgerState } from './localLedger.js';
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

export async function loadCanonicalLocalLedgerState(): Promise<LocalLedgerState | null> {
  const state = await loadLocalLedgerState();
  if (state === null) return null;

  try {
    createCanonicalRepositoryForLocalLedgerState(state);
  } catch {
    return null;
  }

  return state;
}

export async function saveCanonicalLocalLedgerState(
  state: LocalLedgerState,
): Promise<CanonicalLedgerSaveResult> {
  const repository = createCanonicalRepositoryForLocalLedgerState(state);
  const snapshot = createCanonicalMobileLedgerSnapshot(state);
  const repositorySnapshot = repository.snapshot();

  await saveLocalLedgerState(state);
  return { snapshot, repositorySnapshot };
}

export {
  createCanonicalRepositoryForLocalLedgerState,
  createCanonicalRepositoryForMobileSnapshot,
} from './canonicalLedgerRepository.js';
export { clearLocalLedgerStorage } from './nativeLedgerStore.js';
