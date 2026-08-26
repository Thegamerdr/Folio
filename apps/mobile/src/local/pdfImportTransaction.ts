/**
 * Transaction authority for a local PDF/document read.
 *
 * A picker/read is asynchronous, while the review queue is a single transient slot.  Without an
 * ownership token, a second invocation (or a late parser callback) can replace a successful read
 * with an empty/fallback result.  This small, React-free state machine gives one invocation the
 * right to publish one terminal result.  It deliberately owns no ledger or navigation state.
 */

export const PDF_IMPORT_TERMINAL_CLASSIFICATIONS = [
  'parsed-with-review-items',
  'parsed-no-review-needed',
  'unreadable/manual-fallback',
  'unsupported',
  'failed-recoverably',
  'cancelled',
] as const;

export type PdfImportTerminalClassification = (typeof PDF_IMPORT_TERMINAL_CLASSIFICATIONS)[number];

export type PdfImportObservation =
  | Readonly<{ kind: 'parsed'; reviewItemCount: number }>
  | Readonly<{ kind: 'unreadable/manual-fallback' }>
  | Readonly<{ kind: 'unsupported' }>
  | Readonly<{ kind: 'failed-recoverably' }>
  | Readonly<{ kind: 'cancelled' }>;

export type PdfImportTransactionState = Readonly<{
  phase: 'idle' | 'reading' | 'terminal';
  attemptId: number;
  terminalClassification?: PdfImportTerminalClassification;
  committed: boolean;
}>;

export type PdfImportAttempt = Readonly<{ attemptId: number }>;

export type PdfImportSettlement = Readonly<{
  accepted: boolean;
  classification: PdfImportTerminalClassification;
}>;

export function createInitialPdfImportTransaction(): PdfImportTransactionState {
  return { phase: 'idle', attemptId: 0, committed: false };
}

/** Classify parser/picker output once, before any result is published to the app. */
export function classifyPdfImportOutcome(
  observation: PdfImportObservation,
): PdfImportTerminalClassification {
  if (observation.kind !== 'parsed') return observation.kind;
  return observation.reviewItemCount > 0 ? 'parsed-with-review-items' : 'parsed-no-review-needed';
}

/** Begin exactly one read while this transaction is idle. Duplicate starts are rejected. */
export function beginPdfImportTransaction(state: PdfImportTransactionState): {
  state: PdfImportTransactionState;
  attempt: PdfImportAttempt | null;
} {
  if (state.phase !== 'idle') return { state, attempt: null };
  const attemptId = state.attemptId + 1;
  return {
    state: { phase: 'reading', attemptId, committed: false },
    attempt: { attemptId },
  };
}

/**
 * Publish one terminal result. A stale token, duplicate result, or result after success is ignored.
 * The accepted terminal classification is immutable for the lifetime of this transaction.
 */
export function settlePdfImportTransaction(
  state: PdfImportTransactionState,
  attempt: PdfImportAttempt,
  observation: PdfImportObservation,
): { state: PdfImportTransactionState; settlement: PdfImportSettlement } {
  const classification = classifyPdfImportOutcome(observation);
  if (state.phase !== 'reading' || state.attemptId !== attempt.attemptId) {
    return { state, settlement: { accepted: false, classification } };
  }
  return {
    state: { ...state, phase: 'terminal', terminalClassification: classification },
    settlement: { accepted: true, classification },
  };
}

/** Record the downstream review/commit handoff without changing the terminal read classification. */
export function markPdfImportCommitted(
  state: PdfImportTransactionState,
  attempt: PdfImportAttempt,
): PdfImportTransactionState {
  if (state.phase !== 'terminal' || state.attemptId !== attempt.attemptId) return state;
  return state.committed ? state : { ...state, committed: true };
}

/** Test/host seam for a fresh intake session. It cannot mutate a prior state in place. */
export function resetPdfImportTransaction(
  state: PdfImportTransactionState = createInitialPdfImportTransaction(),
): PdfImportTransactionState {
  return { phase: 'idle', attemptId: state.attemptId, committed: false };
}
