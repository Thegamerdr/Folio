import {
  addCycle,
  addManualTransaction,
  addPlannedCommitment,
  addRecoverySpend,
  addToPot,
  addTransactionFromDocument,
  applyMeloImportSuggestion,
  bulkPauseQuiet,
  cancelSubscription,
  confirmImportDraft,
  createPot,
  createSubscription,
  createQuickEstimateLocalLedgerState,
  dismissImportDraft,
  editImportDraft,
  pauseSubscription,
  reallocateBetweenPots,
  recordSubscriptionUse,
  removeDocumentStage,
  removeTransaction,
  restoreRejectedImportForReview,
  resumeSubscription,
  setCashOnHand,
  setTightPointGoal,
  stageDocumentForManualReview,
  stageStatementImport,
  stageStatementTransactions,
  type CreateCycleRecordInput,
  type CreatePotInput,
  type CreateSubscriptionInput,
  type DocumentItemInput,
  type StageDocumentForManualReviewResult,
  type StageStatementTransactionsResult,
  type StagedStatementTransaction,
  type LocalDocumentStageInput,
  type LocalImportDismissInput,
  type LocalImportDraftEditInput,
  type LocalLedgerState,
  type LocalPlannedCommitmentInput,
  type ManualTransactionInput,
  type QuickEstimateInput,
  type StageStatementImportResult,
} from './localLedger.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';

export function recordManualTransactionThroughCanonicalRepository(
  state: LocalLedgerState,
  input: ManualTransactionInput,
): LocalLedgerState {
  return assertCanonicalRepositoryState(addManualTransaction(state, input));
}

export function recordRecoverySpendThroughCanonicalRepository(
  state: LocalLedgerState,
  input: ManualTransactionInput,
): LocalLedgerState {
  return assertCanonicalRepositoryState(addRecoverySpend(state, input));
}

export function removeTransactionThroughCanonicalRepository(
  state: LocalLedgerState,
  transactionId: string,
): LocalLedgerState {
  return assertCanonicalRepositoryState(removeTransaction(state, transactionId));
}

export function setTightPointGoalThroughCanonicalRepository(
  state: LocalLedgerState,
  minorOrNull: number | null,
): LocalLedgerState {
  return assertCanonicalRepositoryState(setTightPointGoal(state, minorOrNull));
}

export function setCashOnHandThroughCanonicalRepository(
  state: LocalLedgerState,
  minor: number,
): LocalLedgerState {
  return assertCanonicalRepositoryState(setCashOnHand(state, minor));
}

export function createPlannedCommitmentThroughCanonicalRepository(
  state: LocalLedgerState,
  input: LocalPlannedCommitmentInput,
): LocalLedgerState {
  return assertCanonicalRepositoryState(addPlannedCommitment(state, input));
}

export function createQuickEstimateThroughCanonicalRepository(
  asOfDate: string,
  input: QuickEstimateInput,
): LocalLedgerState {
  return assertCanonicalRepositoryState(createQuickEstimateLocalLedgerState(asOfDate, input));
}

export function stageStatementImportThroughCanonicalRepository(
  state: LocalLedgerState,
  text: string,
  source?: LocalDocumentStageInput,
): StageStatementImportResult {
  const result = stageStatementImport(state, text, source);
  assertCanonicalRepositoryState(result.state);
  return result;
}

export function stageStatementTransactionsThroughCanonicalRepository(
  state: LocalLedgerState,
  transactions: readonly StagedStatementTransaction[],
  source?: LocalDocumentStageInput,
): StageStatementTransactionsResult {
  const result = stageStatementTransactions(state, transactions, source);
  assertCanonicalRepositoryState(result.state);
  return result;
}

export function stageDocumentForManualReviewThroughCanonicalRepository(
  state: LocalLedgerState,
  source: LocalDocumentStageInput,
): StageDocumentForManualReviewResult {
  const result = stageDocumentForManualReview(state, source);
  assertCanonicalRepositoryState(result.state);
  return result;
}

export function acceptImportDraftThroughCanonicalRepository(
  state: LocalLedgerState,
  rowId: string,
): LocalLedgerState {
  return assertCanonicalRepositoryState(confirmImportDraft(state, rowId));
}

export function rejectImportDraftThroughCanonicalRepository(
  state: LocalLedgerState,
  rowId: string,
  input?: LocalImportDismissInput,
): LocalLedgerState {
  return assertCanonicalRepositoryState(dismissImportDraft(state, rowId, input));
}

export function restoreRejectedImportThroughCanonicalRepository(
  state: LocalLedgerState,
  rowId: string,
): LocalLedgerState {
  return assertCanonicalRepositoryState(restoreRejectedImportForReview(state, rowId));
}

export function editImportDraftThroughCanonicalRepository(
  state: LocalLedgerState,
  rowId: string,
  input: LocalImportDraftEditInput,
): LocalLedgerState {
  return assertCanonicalRepositoryState(editImportDraft(state, rowId, input));
}

export function reviewMeloImportSuggestionThroughCanonicalRepository(
  state: LocalLedgerState,
  rowId: string,
): LocalLedgerState {
  const nextState = applyMeloImportSuggestion(state, rowId);
  const repository = createCanonicalRepositoryForLocalLedgerState(nextState);
  if (
    repository.transactions.count() !==
    createCanonicalRepositoryForLocalLedgerState(state).transactions.count()
  ) {
    throw new Error('Melo import suggestions must not directly write financial records.');
  }
  return nextState;
}

export function addTransactionFromDocumentThroughCanonicalRepository(
  state: LocalLedgerState,
  input: DocumentItemInput,
): LocalLedgerState {
  return assertCanonicalRepositoryState(addTransactionFromDocument(state, input));
}

export function removeDocumentStageThroughCanonicalRepository(
  state: LocalLedgerState,
  documentId: string,
): LocalLedgerState {
  return assertCanonicalRepositoryState(removeDocumentStage(state, documentId));
}

// Pots --------------------------------------------------------------------------------------

export function createPotThroughCanonicalRepository(
  state: LocalLedgerState,
  input: CreatePotInput,
): LocalLedgerState {
  return assertCanonicalRepositoryState(createPot(state, input));
}

export function addToPotThroughCanonicalRepository(
  state: LocalLedgerState,
  potId: string,
  amountMinor: number,
): LocalLedgerState {
  return assertCanonicalRepositoryState(addToPot(state, potId, amountMinor));
}

export function reallocateBetweenPotsThroughCanonicalRepository(
  state: LocalLedgerState,
  fromPotId: string,
  toPotId: string,
  amountMinor: number,
): LocalLedgerState {
  return assertCanonicalRepositoryState(
    reallocateBetweenPots(state, fromPotId, toPotId, amountMinor),
  );
}

// Subscriptions -----------------------------------------------------------------------------

export function createSubscriptionThroughCanonicalRepository(
  state: LocalLedgerState,
  input: CreateSubscriptionInput,
): LocalLedgerState {
  return assertCanonicalRepositoryState(createSubscription(state, input));
}

export function pauseSubscriptionThroughCanonicalRepository(
  state: LocalLedgerState,
  subscriptionId: string,
): LocalLedgerState {
  return assertCanonicalRepositoryState(pauseSubscription(state, subscriptionId));
}

export function resumeSubscriptionThroughCanonicalRepository(
  state: LocalLedgerState,
  subscriptionId: string,
): LocalLedgerState {
  return assertCanonicalRepositoryState(resumeSubscription(state, subscriptionId));
}

export function recordSubscriptionUseThroughCanonicalRepository(
  state: LocalLedgerState,
  subscriptionId: string,
): LocalLedgerState {
  return assertCanonicalRepositoryState(recordSubscriptionUse(state, subscriptionId));
}

export function cancelSubscriptionThroughCanonicalRepository(
  state: LocalLedgerState,
  subscriptionId: string,
): LocalLedgerState {
  return assertCanonicalRepositoryState(cancelSubscription(state, subscriptionId));
}

export function bulkPauseQuietThroughCanonicalRepository(
  state: LocalLedgerState,
): LocalLedgerState {
  return assertCanonicalRepositoryState(bulkPauseQuiet(state));
}

// Cycles ------------------------------------------------------------------------------------

export function addCycleThroughCanonicalRepository(
  state: LocalLedgerState,
  input: CreateCycleRecordInput,
): LocalLedgerState {
  return assertCanonicalRepositoryState(addCycle(state, input));
}

function assertCanonicalRepositoryState(state: LocalLedgerState): LocalLedgerState {
  createCanonicalRepositoryForLocalLedgerState(state);
  return state;
}
