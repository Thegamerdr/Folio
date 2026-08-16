// Statement reconciliation — verify extracted rows against the statement's OWN arithmetic.
//
// PURE module (no react-native / expo / store imports) — Node-testable. This is the trust guardrail:
// a bank statement carries its own truth (opening balance, closing balance, and often stated total
// debits/credits), so we can prove the rows we extracted actually account for the whole balance
// movement — or honestly flag that they don't.
//
// HONESTY DISCIPLINE (review-before-truth): reconciliation is a CHECK, never a correction. It never
// inverts a sign, drops a row, or invents missing data to force a pass. When the statement doesn't
// give us enough to check (no opening balance and no stated totals), we say 'unverified' rather than
// pretend it verified. The result is surfaced to the user at Review; nothing is auto-applied.

import type { CandidateMoneyItem } from './importSheet';

export type ReconciliationStatus =
  | 'ok' // extracted rows reconcile the statement's own figures (within 1p)
  | 'mismatch' // they DON'T — some rows are likely missing, duplicated, or mis-signed
  | 'unverified'; // the statement didn't give us enough to check (no opening balance / stated totals)

/** The statement's own balance/total figures, as the reader captured them (all in POUNDS; stated
 *  totals are UNSIGNED — money-out and money-in magnitudes the statement itself prints). Any field
 *  may be absent when the statement didn't clearly show it — never fabricated. */
export type StatementTotals = {
  closingPounds: number;
  openingPounds?: number;
  statedTotalDebitsPounds?: number;
  statedTotalCreditsPounds?: number;
};

export type ReconciliationResult = {
  status: ReconciliationStatus;
  /** A short, honest line for the Review screen. */
  message: string;
  /** Number of checks that failed (0 when ok/unverified) — lets the UI say "N figures don't line up". */
  failedChecks: number;
  extractedInPence: number;
  extractedOutPence: number;
  statedInPence?: number;
  statedOutPence?: number;
  openingPence?: number;
  closingPence?: number;
};

/** Build `StatementTotals` from the reader's staged closing-balance object (the `ReaderClosingBalance`
 *  shape: `amount` + optional `openingAmount`/`statedTotalDebits`/`statedTotalCredits`, all pounds).
 *  Returns null when there's no closing balance to anchor a check. Shared by the store (import) and
 *  the landing preview so both reconcile against exactly the same figures. */
export function statementTotalsFrom(
  cb:
    | {
        amount: number;
        openingAmount?: number;
        statedTotalDebits?: number;
        statedTotalCredits?: number;
      }
    | null
    | undefined,
): StatementTotals | null {
  if (!cb || !Number.isFinite(cb.amount)) return null;
  const totals: StatementTotals = { closingPounds: cb.amount };
  if (typeof cb.openingAmount === 'number') totals.openingPounds = cb.openingAmount;
  if (typeof cb.statedTotalDebits === 'number')
    totals.statedTotalDebitsPounds = cb.statedTotalDebits;
  if (typeof cb.statedTotalCredits === 'number') {
    totals.statedTotalCreditsPounds = cb.statedTotalCredits;
  }
  return totals;
}

const TOLERANCE_PENCE = 1; // 1p — rounding slack only

const toPence = (pounds: number): number => Math.round(pounds * 100);
const fmt = (pence: number): string =>
  `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Reconcile the extracted candidate rows against the statement's own figures.
 *
 * Two independent checks, run when the data is present:
 *  1. BALANCE MOVEMENT — opening + Σcredits − Σdebits (from the EXTRACTED rows) == closing.
 *     Proves our rows account for the whole balance change. Needs opening + closing.
 *  2. STATED TOTALS — Σextracted-credits == stated total credits AND Σextracted-debits == stated
 *     total debits. Proves we extracted the same magnitudes the statement itself prints.
 *
 * 'ok' only when every available check passes; 'mismatch' when any present check fails; 'unverified'
 * when neither check has enough data (no opening balance and no stated totals). Tolerance ±1p.
 */
export function reconcileStatement(
  candidates: readonly CandidateMoneyItem[],
  totals: StatementTotals | null,
): ReconciliationResult {
  let extractedInPence = 0;
  let extractedOutPence = 0;
  for (const c of candidates) {
    const p = toPence(c.amount);
    if (p > 0) extractedInPence += p;
    else extractedOutPence += -p;
  }

  const base: Pick<ReconciliationResult, 'extractedInPence' | 'extractedOutPence'> = {
    extractedInPence,
    extractedOutPence,
  };

  if (!totals || !Number.isFinite(totals.closingPounds)) {
    return {
      status: 'unverified',
      message: "This statement didn't provide a balance to check against — review the rows below.",
      failedChecks: 0,
      ...base,
    };
  }

  const closingPence = toPence(totals.closingPounds);
  const hasOpening =
    typeof totals.openingPounds === 'number' && Number.isFinite(totals.openingPounds);
  const hasStated =
    typeof totals.statedTotalDebitsPounds === 'number' &&
    Number.isFinite(totals.statedTotalDebitsPounds) &&
    typeof totals.statedTotalCreditsPounds === 'number' &&
    Number.isFinite(totals.statedTotalCreditsPounds);

  if (!hasOpening && !hasStated) {
    return {
      status: 'unverified',
      message: 'Not enough on the statement to fully verify — review the rows below.',
      failedChecks: 0,
      closingPence,
      ...base,
    };
  }

  const problems: string[] = [];
  let failedChecks = 0;
  const detail: Partial<ReconciliationResult> = { closingPence };

  if (hasOpening) {
    const openingPence = toPence(totals.openingPounds as number);
    detail.openingPence = openingPence;
    const projected = openingPence + extractedInPence - extractedOutPence;
    if (Math.abs(projected - closingPence) > TOLERANCE_PENCE) {
      failedChecks++;
      problems.push(
        `the rows add up to ${fmt(projected)} but your closing balance is ${fmt(closingPence)}`,
      );
    }
  }

  if (hasStated) {
    const statedInPence = toPence(totals.statedTotalCreditsPounds as number);
    const statedOutPence = toPence(totals.statedTotalDebitsPounds as number);
    detail.statedInPence = statedInPence;
    detail.statedOutPence = statedOutPence;
    if (Math.abs(extractedInPence - statedInPence) > TOLERANCE_PENCE) {
      failedChecks++;
      problems.push(
        `money in reads ${fmt(extractedInPence)} but the statement says ${fmt(statedInPence)}`,
      );
    }
    if (Math.abs(extractedOutPence - statedOutPence) > TOLERANCE_PENCE) {
      failedChecks++;
      problems.push(
        `money out reads ${fmt(extractedOutPence)} but the statement says ${fmt(statedOutPence)}`,
      );
    }
  }

  if (failedChecks > 0) {
    return {
      status: 'mismatch',
      message: `A few figures don't line up: ${problems.join('; ')}. Some rows may be missing or misread — worth a closer look before you add them.`,
      failedChecks,
      ...base,
      ...detail,
    };
  }

  return {
    status: 'ok',
    message: 'These rows reconcile with the statement — every figure lines up.',
    failedChecks: 0,
    ...base,
    ...detail,
  };
}
