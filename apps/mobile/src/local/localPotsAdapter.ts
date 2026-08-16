import type { Pot } from '@folio/domain';

import { formatMinorAmount, type LocalLedgerState } from './localLedger.js';

// One pot, shaped for the Pots screen. Money is pre-formatted for display; the raw minor figures
// stay alongside so the screen can drive progress bars and totals without re-deriving them.
export type LocalPotRow = Readonly<{
  id: string;
  name: string;
  saved: string;
  savedMinor: number;
  goal: string;
  goalMinor: number;
  perWeek: string;
  perWeekMinor: number;
  accent: boolean;
  // 0..1 — how full the pot is against its goal. A goal of 0 reads as fully covered (1) so the
  // screen never shows an empty bar for a pot that has no target to chase.
  progress: number;
  progressLabel: string;
}>;

export type LocalPotsModel = Readonly<{
  sourceLabel: string;
  rows: readonly LocalPotRow[];
  // Total saved across every pot — the figure the Pots summary leads with.
  sumSavedMinor: number;
  sumSaved: string;
  potCount: number;
  accessibilitySummary: string;
}>;

export function buildLocalPotsModel(
  ledger: LocalLedgerState,
  options: Readonly<{ privateExampleMode?: boolean }> = {},
): LocalPotsModel {
  const rows = ledger.pots.map(createPotRow);
  const sumSavedMinor = rows.reduce((total, row) => total + row.savedMinor, 0);

  return {
    sourceLabel: options.privateExampleMode ? 'Private example' : 'Local personal workspace',
    rows,
    sumSavedMinor,
    sumSaved: formatMinorAmount(sumSavedMinor),
    potCount: rows.length,
    accessibilitySummary: `${rows.length} pot${rows.length === 1 ? '' : 's'}, ${formatMinorAmount(
      sumSavedMinor,
    )} saved in total.`,
  };
}

function createPotRow(pot: Pot): LocalPotRow {
  const savedMinor = pot.saved.minorUnits;
  const goalMinor = pot.goal.minorUnits;
  const perWeekMinor = pot.perWeek.minorUnits;
  const progress = goalMinor <= 0 ? 1 : Math.min(1, Math.max(0, savedMinor / goalMinor));

  return {
    id: String(pot.id),
    name: pot.name,
    saved: formatMinorAmount(savedMinor),
    savedMinor,
    goal: formatMinorAmount(goalMinor),
    goalMinor,
    perWeek: formatMinorAmount(perWeekMinor),
    perWeekMinor,
    accent: pot.accent,
    progress,
    progressLabel: `${formatMinorAmount(savedMinor)} saved of ${formatMinorAmount(goalMinor)}`,
  };
}
