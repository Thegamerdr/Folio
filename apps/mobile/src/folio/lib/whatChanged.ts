// What-Changed summary — pure LOGIC, Node-testable (no expo, no react-native).
//
// WHY THIS EXISTS. "'What changed' briefing" was sold on the paywall while the app had NO standing
// what-changed surface at all — only event-driven caught-sheets (the 2026-07-10 alignment audit's
// truth pass demoted the bullet to 'soon'). This module + ui/WhatChangedRow.tsx build the real
// thing, v1: a quiet standing row on every Today that answers "what changed since I last looked?"
// and opens the Timeline. Free for everyone — it's clarity/safety-layer, and the Free tier is
// never quality-degraded (MONEY_MODEL.md §2b). The paywall's Full bullet stays 'soon' and now
// means the richer future briefing (AI-written digest), not this row.
//
// WHAT COUNTS AS A CHANGE since the `seenISO` baseline:
//   • Every Timeline row (buildTimelineRows: transactions Added/Edited + the sub-paused/resumed/
//     review-ignored event log) whose timestamp is after the baseline.
//   • Every statement import (statementImports log) whose import moment is after the baseline —
//     counted as ONE change each, because its transactions carry HISTORICAL dates (last month's
//     statement) and would otherwise slip past a purely timestamp-based filter unnoticed.
// A `null` baseline means "no baseline yet" → null summary (the row stays hidden; the component
// stamps the first baseline silently on first mount, so the row only ever reports changes that
// happened after the user first had it).

import type { TimelineRow } from './timelineEvents';
import type { StatementImportRecord, Transaction, StoredTxnEdit, Debt } from '../store';
import { isDebtPayment } from './debtPaymentLedger';
import { formatMoney } from './financialPresentation';

export type WhatChangedSummary = {
  /** Total change moments since the baseline (rows + imports). Always >= 1 when non-null. */
  count: number;
  /** Calm one-liner for the row — the NEWEST change, plus a "· N more" tail when count > 1. */
  headline: string;
  /** Only live payment records expose their own detail target. */
  transactionId?: string;
};

/** The row's verb, lowercased for mid-sentence use ('Tesco added'). */
function lowerVerb(verb: TimelineRow['verb']): string {
  return verb.toLowerCase();
}

export function summarizeWhatChanged(args: {
  rows: readonly TimelineRow[];
  imports: readonly StatementImportRecord[];
  seenISO: string | null;
  transactions?: readonly Transaction[];
  edits?: readonly StoredTxnEdit[];
  debts?: readonly Debt[];
}): WhatChangedSummary | null {
  const { rows, imports, seenISO } = args;
  if (seenISO === null) return null;
  const seenTime = new Date(seenISO).getTime();
  if (Number.isNaN(seenTime)) return null; // corrupt baseline — stay quiet, never crash.

  type Moment = { at: number; label: string; transactionId?: string };
  const moments: Moment[] = [];

  for (const row of rows) {
    const payment = args.transactions?.find(
      (transaction) => transaction.id === row.id && isDebtPayment(transaction),
    );
    const paymentEdits = payment
      ? (args.edits ?? []).filter((edit) => edit.txnId === payment.id)
      : [];
    const editTimes = paymentEdits
      .map((edit) => new Date(edit.at).getTime())
      .filter(Number.isFinite);
    const at = Math.max(new Date(row.at).getTime(), ...editTimes);
    if (!Number.isNaN(at) && at > seenTime) {
      if (payment && isDebtPayment(payment)) {
        const debtName =
          args.debts?.find((debt) => debt.id === payment.financialAction.debtId)?.name ??
          payment.merchant.replace(/^Debt payment:\s*/u, '');
        const action = paymentEdits.length > 0 || row.verb === 'Edited' ? 'corrected' : 'recorded';
        moments.push({
          at,
          label: `Payment ${action} ${formatMoney(Math.abs(payment.amount))} · ${debtName}`,
          transactionId: payment.id,
        });
      } else moments.push({ at, label: `${row.what} ${lowerVerb(row.verb)}` });
    }
  }
  for (const imported of imports) {
    const at = new Date(imported.atISO).getTime();
    if (!Number.isNaN(at) && at > seenTime) {
      const rowsWord = imported.rowCount === 1 ? 'row' : 'rows';
      moments.push({ at, label: `Statement read · ${imported.rowCount} ${rowsWord}` });
    }
  }

  if (moments.length === 0) return null;

  moments.sort((a, b) => b.at - a.at);
  const newest = moments[0]!;
  const rest = moments.length - 1;
  const headline = rest === 0 ? newest.label : `${newest.label} · ${rest} more`;
  return {
    count: moments.length,
    headline,
    ...(newest.transactionId ? { transactionId: newest.transactionId } : {}),
  };
}
