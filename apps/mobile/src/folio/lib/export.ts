// Export engine — ENGINES.md §6 "Export everything — free, non-negotiable,
// day-one" (and §7 @rn-engine export).
//
// "Sheets-returner trust signal #1." A single tap takes the user's full data
// out: one JSON file of the complete `AppState`, plus per-surface CSV files.
// This engine builds those strings; it does NOT touch the filesystem, the
// network, the share-sheet, or react-native — a thin native wrapper zips and
// shares the result later (BUILD_PLAN). Keeping it pure means the whole export
// contract is unit-testable and free of platform flakiness.
//
// HARD CONSTRAINTS (see store.ts header + ENGINES §6):
//   • Pure + deterministic: no Date.now, no locale, no randomness. Same state
//     in -> byte-identical { json, csvs } out.
//   • Type-only import of the store shape (verbatimModuleSyntax). No runtime
//     dependency on the store, so an export never mutates live state.
//   • CSV is RFC-4180-ish: header row per file, EVERY field quoted, embedded
//     quotes doubled, embedded commas/newlines survive inside the quotes.
//   • Free, never paywalled. There is no gate in this module by design.

import type {
  AppState,
  CalendarEvent,
  CycleRecord,
  Pot,
  PotLedgerEntry,
  ReviewItem,
  Sub,
  Transaction,
} from '../store';

/**
 * A transaction correction record, per ENGINES §6 "Editing existing
 * transactions". The live `AppState` does not carry edits yet (the edit flow
 * lands later — see ENGINES §7 `SheetEditTxn`), so this engine reads them
 * tolerantly from an optional `edits` slot. When the store gains the field this
 * keeps working unchanged; until then `corrections.csv` is simply omitted.
 */
export type TxnEdit = {
  txnId: string;
  field: string;
  before: string;
  after: string;
  /** ISO timestamp of the edit. */
  at: string;
  by: string;
};

export type ExportBundle = {
  /** The complete `AppState`, pretty-printed (2-space) JSON. */
  json: string;
  /** Per-surface CSV strings, keyed by file name. */
  csvs: Record<string, string>;
};

/**
 * The CSV files this engine always emits, regardless of how empty the state is.
 * `corrections.csv` is intentionally NOT in this list — it appears only when
 * transaction edits exist (ENGINES §6). Order is stable for deterministic
 * iteration in callers and tests.
 */
export const EXPORT_CSV_FILES = [
  'transactions.csv',
  'subs.csv',
  'pots.csv',
  'cycles.csv',
  'ledger.csv',
  'calendarEvents.csv',
  'reviewQueue.csv',
  'onboarding.csv',
  'balance.csv',
  'settings.csv',
] as const;

// ---------------------------------------------------------------------------
// CSV primitives
// ---------------------------------------------------------------------------

const CSV_NEWLINE = '\n';

/** Quote a single cell: stringify, double any embedded quotes, wrap in quotes.
 *  Every field is quoted unconditionally so the format is uniform and a reader
 *  never has to guess whether a value was quoted. `null`/`undefined` -> "". */
function csvCell(value: unknown): string {
  const raw =
    value === null || value === undefined
      ? ''
      : typeof value === 'string'
        ? value
        : typeof value === 'boolean' || typeof value === 'number'
          ? String(value)
          : JSON.stringify(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

/** Build a CSV string from a header and rows. Newlines between records are
 *  always `\n`; embedded newlines inside a cell are preserved by the quoting. */
function toCsv(header: readonly string[], rows: readonly unknown[][]): string {
  const lines: string[] = [];
  lines.push(header.map(csvCell).join(','));
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  return lines.join(CSV_NEWLINE);
}

// ---------------------------------------------------------------------------
// Tolerant readers for not-yet-in-the-store surfaces
// ---------------------------------------------------------------------------

/** Read the optional `edits` slot off state without widening the store type or
 *  using `any`. Returns [] unless a well-shaped, non-empty array is present. */
function readEdits(state: AppState): TxnEdit[] {
  const slot = (state as { edits?: unknown }).edits;
  if (!Array.isArray(slot)) return [];
  const out: TxnEdit[] = [];
  for (const e of slot) {
    if (e && typeof e === 'object') {
      const r = e as Record<string, unknown>;
      out.push({
        txnId: String(r.txnId ?? ''),
        field: String(r.field ?? ''),
        before: String(r.before ?? ''),
        after: String(r.after ?? ''),
        at: String(r.at ?? ''),
        by: String(r.by ?? ''),
      });
    }
  }
  return out;
}

/** Render a pot cadence to a short, stable string for the CSV column.
 *  Undefined cadence -> "" (unmigrated pots, per store.ts). */
function cadenceKind(cadence: Pot['cadence']): string {
  if (!cadence) return '';
  switch (cadence.kind) {
    case 'after-payday':
      return 'after-payday';
    case 'weekly':
      return `weekly:${cadence.weekday}`;
    case 'monthly':
      return `monthly:${cadence.dayOfMonth}`;
    case 'custom':
      return `custom:${cadence.nextDate}`;
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Per-surface CSV builders
// ---------------------------------------------------------------------------

function transactionsCsv(transactions: readonly Transaction[]): string {
  return toCsv(
    ['id', 'when', 'merchant', 'amount', 'category', 'source'],
    transactions.map((t) => [t.id, t.when, t.merchant, t.amount, t.category, t.source]),
  );
}

/** Subs CSV folds in paused (subPaused) + nudge (subOverrides) state so the
 *  "incl paused/cancelled history" requirement is met from the data that
 *  exists in the store today. */
function subsCsv(
  subs: readonly Sub[],
  subPaused: Record<string, boolean>,
  subOverrides: Record<string, number>,
): string {
  return toCsv(
    [
      'name',
      'cost',
      'nextRenewalDaysAway',
      'lastUsedDaysAgo',
      'usesPerMonth',
      'trialEndsInDays',
      'paused',
      'nudgeDays',
    ],
    subs.map((s) => [
      s.name,
      s.cost,
      s.nextRenewalDaysAway,
      s.lastUsedDaysAgo,
      s.usesPerMonth,
      s.trialEndsInDays ?? '',
      subPaused[s.name] === true,
      subOverrides[s.name] ?? 0,
    ]),
  );
}

function potsCsv(pots: readonly Pot[]): string {
  return toCsv(
    ['id', 'name', 'saved', 'goal', 'perWeek', 'accent', 'cadence'],
    pots.map((p) => [p.id, p.name, p.saved, p.goal, p.perWeek, p.accent, cadenceKind(p.cadence)]),
  );
}

function cyclesCsv(cycles: readonly CycleRecord[]): string {
  return toCsv(
    ['closedAt', 'label', 'spare', 'tightPoint', 'setAside', 'note'],
    cycles.map((c) => [c.closedAt, c.label, c.spare, c.tightPoint, c.setAside, c.note]),
  );
}

function ledgerCsv(potLedger: readonly PotLedgerEntry[]): string {
  return toCsv(
    ['id', 'potId', 'at', 'kind', 'amount', 'source'],
    potLedger.map((l) => [l.id, l.potId, l.at, l.kind, l.amount, l.source]),
  );
}

/** Calendar / expectations — user-added events. Derived events (paydays, bills,
 *  sub renewals) are recomputed on read and not stored, so they are not part of
 *  this CSV; the route assumptions that produce them live in settings/balance. */
function calendarEventsCsv(calendarEvents: readonly CalendarEvent[]): string {
  return toCsv(
    ['id', 'date', 'kind', 'title', 'amount', 'note'],
    calendarEvents.map((e) => [e.id, e.date, e.kind, e.title, e.amount ?? '', e.note ?? '']),
  );
}

/** Unreviewed intake candidates — the persisted review queue. Column set is
 *  the design source's review-queue export verbatim (web export.ts
 *  `review-queue.csv`: id · source · merchant · amount · date · hint ·
 *  addedAt); the file name follows this bundle's camelCase convention. */
function reviewQueueCsv(reviewQueue: readonly ReviewItem[]): string {
  return toCsv(
    ['id', 'source', 'merchant', 'amount', 'date', 'hint', 'addedAt'],
    reviewQueue.map((r) => [
      r.id,
      r.source,
      r.merchant,
      r.amount,
      r.date ?? '',
      r.hint ?? '',
      r.addedAt,
    ]),
  );
}

/** Onboarding / payday rule — a single-row CSV. */
function onboardingCsv(state: AppState): string {
  const o = state.onboarding;
  return toCsv(
    ['done', 'name', 'payday', 'monthlyIncome'],
    [[o.done, o.name, o.payday, o.monthlyIncome]],
  );
}

/** currentBalance source + confidence — a single-row CSV (route assumption). */
function balanceCsv(state: AppState): string {
  const b = state.currentBalance;
  return toCsv(
    ['amount', 'source', 'confidence', 'setAt'],
    [[b.amount, b.source, b.confidence, b.setAt]],
  );
}

/** Remaining scalar settings — a single-row CSV so every category is also in a
 *  CSV, not just the JSON (ENGINES §6 "settings"). */
function settingsCsv(state: AppState): string {
  return toCsv(
    ['schemaVersion', 'tightPointGoal', 'nextYouNote', 'calendarFocusDate', 'routeFocusDate'],
    [
      [
        state.schemaVersion,
        state.tightPointGoal ?? '',
        state.nextYouNote,
        state.calendarFocusDate ?? '',
        state.routeFocusDate ?? '',
      ],
    ],
  );
}

function correctionsCsv(edits: readonly TxnEdit[]): string {
  return toCsv(
    ['txnId', 'field', 'before', 'after', 'at', 'by'],
    edits.map((e) => [e.txnId, e.field, e.before, e.after, e.at, e.by]),
  );
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

/**
 * Build the full export bundle for a given app state.
 *
 * - `json` is the complete `AppState`, pretty-printed — the canonical,
 *   loss-free record; the CSVs are the human/spreadsheet-friendly slice.
 * - `csvs` always carries the {@link EXPORT_CSV_FILES} set (header row even when
 *   empty), plus `corrections.csv` when transaction edits exist.
 *
 * Pure and deterministic: no clock, no randomness, no I/O, and the input state
 * is never mutated.
 */
export function buildExport(state: AppState): ExportBundle {
  const json = JSON.stringify(state, null, 2);

  const csvs: Record<string, string> = {
    'transactions.csv': transactionsCsv(state.transactions),
    'subs.csv': subsCsv(state.subs, state.subPaused, state.subOverrides),
    'pots.csv': potsCsv(state.pots),
    'cycles.csv': cyclesCsv(state.cycles),
    'ledger.csv': ledgerCsv(state.potLedger),
    'calendarEvents.csv': calendarEventsCsv(state.calendarEvents),
    'reviewQueue.csv': reviewQueueCsv(state.reviewQueue ?? []),
    'onboarding.csv': onboardingCsv(state),
    'balance.csv': balanceCsv(state),
    'settings.csv': settingsCsv(state),
  };

  const edits = readEdits(state);
  if (edits.length > 0) {
    csvs['corrections.csv'] = correctionsCsv(edits);
  }

  return { json, csvs };
}
