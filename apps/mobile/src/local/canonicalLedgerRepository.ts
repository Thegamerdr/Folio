import { createInMemoryCanonicalRepository, type CanonicalRepository } from '@folio/storage';

import type { LocalLedgerState } from './localLedger.js';
import {
  createCanonicalMobileLedgerSnapshot,
  type CanonicalMobileLedgerSnapshot,
} from './canonicalLedgerAdapter.js';

export function createCanonicalRepositoryForLocalLedgerState(
  state: LocalLedgerState,
): CanonicalRepository {
  return createCanonicalRepositoryForMobileSnapshot(createCanonicalMobileLedgerSnapshot(state));
}

export function createCanonicalRepositoryForMobileSnapshot(
  snapshot: CanonicalMobileLedgerSnapshot,
): CanonicalRepository {
  if (!snapshot.validation.valid) {
    throw new Error(
      `Canonical local ledger validation failed: ${snapshot.validation.issues.join(' ')}`,
    );
  }

  return createInMemoryCanonicalRepository(snapshot.workspace.id, {
    workspaces: [snapshot.workspace],
    accounts: snapshot.accounts,
    balanceObservations: snapshot.balanceObservations,
    currentBalances: snapshot.currentBalances,
    balanceAdjustments: snapshot.balanceAdjustments,
    availablePositionSnapshots: snapshot.availablePositionSnapshots,
    sourceRecords: snapshot.sourceRecords,
    provenance: snapshot.provenance,
    parsedRows: snapshot.parsedRows,
    importedClaims: snapshot.importedClaims,
    importDrafts: snapshot.importDrafts,
    userCorrections: snapshot.userCorrections,
    transactions: snapshot.transactions,
    events: snapshot.events,
    commitments: snapshot.commitments,
    expectations: snapshot.expectations,
    plannerItems: snapshot.plannerItems,
    plans: snapshot.plans,
    planRules: snapshot.planRules,
    scenarios: snapshot.scenarios,
    planImpacts: snapshot.planImpacts,
    forecastSnapshots: snapshot.forecastSnapshots,
    documents: snapshot.documents,
    documentAttachments: snapshot.documentAttachments,
    calendarItems: snapshot.calendarItems,
    timelineEntries: snapshot.timelineEntries,
    decisions: snapshot.decisionRecords,
    meloMemory: snapshot.meloMemories,
    meloProposals: snapshot.meloProposals,
    auditLog: snapshot.auditLog,
  });
}
