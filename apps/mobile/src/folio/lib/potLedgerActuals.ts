import type { AppState } from '@/folio/store';

/** The Payday Ritual's retrospective window. Keep this explicit so its clock remains injectable. */
export const RITUAL_CYCLE_WINDOW_MS = 30 * 86_400_000;

export type RitualLedgerActuals = {
  spent: number;
  setAside: number;
};

/**
 * Read the ritual's two ledger figures from canonical relationships only.
 *
 * A transaction mentioning savings or a pot is still just a transaction; it is not evidence of a
 * pot movement. A deposit is eligible only when its potId resolves to a currently canonical pot.
 * This deliberately leaves unresolved legacy rows in AppState for evidence/export, but prevents
 * them from becoming user-facing pot claims.
 */
export function computeRitualLedgerActuals(
  state: Pick<AppState, 'transactions' | 'potLedger' | 'pots'>,
  now: Date,
): RitualLedgerActuals {
  const cutoff = now.getTime() - RITUAL_CYCLE_WINDOW_MS;
  const canonicalPotIds = new Set(state.pots.map((pot) => pot.id));

  const spent = state.transactions
    .filter((tx) => tx.amount < 0 && new Date(tx.when).getTime() >= cutoff)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const setAside = Math.round(
    state.potLedger
      .filter(
        (entry) =>
          entry.kind === 'deposit' &&
          canonicalPotIds.has(entry.potId) &&
          new Date(entry.at).getTime() >= cutoff,
      )
      .reduce((sum, entry) => sum + entry.amount, 0),
  );

  return { spent: Math.round(spent), setAside };
}
