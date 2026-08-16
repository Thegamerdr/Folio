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
//   • No runtime dependency on the live store. The pure workspace guard receives the supplied
//     state and refuses a mismatched partition before any export strings are built.
//   • CSV is RFC-4180-ish: header row per file, EVERY field quoted, embedded
//     quotes doubled, embedded commas/newlines survive inside the quotes.
//   • Free, never paywalled. There is no gate in this module by design.

import type {
  AppState,
  CalendarEvent,
  CycleRecord,
  DriftCooldownEntry,
  IncomeSource,
  Pot,
  PotLedgerEntry,
  ReviewItem,
  Sub,
  Transaction,
} from '../store';
import type { MerchantCategoryMap } from './merchantMemory';
import { requireWorkspaceData } from './workspaceRoot';
import { requireWorkspaceRows } from './workspaceRows';
import type {
  CorrectionImpactRecord,
  CriticalJourneyContinuityRecord,
  DecisionLedgerEntry,
  MaterialFinancialChange,
  ProvisionalAnswerRecord,
  WorkspaceId,
} from '@folio/domain';

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
  'workspace.csv',
  'accounts.csv',
  'transactions.csv',
  'statement-imports.csv',
  'evidence-documents.csv',
  'accountant-records.csv',
  'export-manifest.csv',
  'subs.csv',
  'pots.csv',
  'cycles.csv',
  'ledger.csv',
  'calendarEvents.csv',
  'reviewQueue.csv',
  'ignored-review.csv',
  'onboarding.csv',
  'balance.csv',
  'settings.csv',
  'incomeSources.csv',
  'merchant-categories.csv',
  'dismissed-signals.csv',
  'review-spillover.csv',
  'decision-ledger.csv',
  'provisional-answers.csv',
  'material-changes.csv',
  'correction-impacts.csv',
  'critical-journey-continuity.csv',
] as const;

// ---------------------------------------------------------------------------
// CSV primitives
// ---------------------------------------------------------------------------

const CSV_NEWLINE = '\n';

/** Quote a single cell: stringify, double any embedded quotes, wrap in quotes.
 *  Every field is quoted unconditionally so the format is uniform and a reader
 *  never has to guess whether a value was quoted. `null`/`undefined` -> "". */
function csvCell(value: unknown): string {
  const rawValue =
    value === null || value === undefined
      ? ''
      : typeof value === 'string'
        ? value
        : typeof value === 'boolean' || typeof value === 'number'
          ? String(value)
          : JSON.stringify(value);
  // Quoting alone does not neutralize spreadsheet formulas. Preserve exact values in the JSON
  // export, but prefix dangerous string cells in CSV so Excel/Sheets treats imported merchant,
  // filename and note text as inert text. Numeric values stay numeric strings and are never altered.
  const raw =
    typeof value === 'string' && /^\s*[=+\-@\t\r]/u.test(rawValue) ? `'${rawValue}` : rawValue;
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
    [
      'id',
      'workspaceId',
      'accountId',
      'when',
      'merchant',
      'amount',
      'category',
      'source',
      'sourceEvidenceId',
    ],
    transactions.map((t) => [
      t.id,
      t.workspaceId ?? '',
      t.accountId ?? 'acct-main',
      t.when,
      t.merchant,
      t.amount,
      t.category,
      t.source,
      t.sourceEvidenceId ?? '',
    ]),
  );
}

function workspaceCsv(state: AppState): string {
  const workspace = state.workspaces.find((candidate) => candidate.id === state.activeWorkspaceId);
  return toCsv(
    ['workspaceId', 'label', 'kind', 'currency', 'jurisdiction', 'timeZone', 'dataVersion'],
    workspace
      ? [
          [
            workspace.id,
            workspace.name,
            workspace.kind,
            workspace.baseCurrency,
            workspace.jurisdiction,
            workspace.timeZone,
            workspace.version.dataVersion,
          ],
        ]
      : [],
  );
}

function accountsCsv(state: AppState): string {
  return toCsv(
    [
      'id',
      'workspaceId',
      'name',
      'kind',
      'isLiability',
      'balance',
      'currency',
      'balanceAsOfISO',
      'closed',
    ],
    (state.accounts ?? []).map((account) => [
      account.id,
      account.workspaceId ?? '',
      account.name,
      account.kind,
      account.isLiability,
      account.balanceMinor,
      account.currency ?? 'GBP',
      account.balanceAsOfISO,
      account.closed === true,
    ]),
  );
}

function statementImportsCsv(state: AppState): string {
  return toCsv(
    [
      'id',
      'workspaceId',
      'source',
      'accountId',
      'rowCount',
      'filename',
      'closingBalance',
      'addedAt',
      'sourceEvidenceId',
    ],
    (state.statementImports ?? []).map((entry) => [
      entry.id,
      entry.workspaceId ?? '',
      entry.source,
      entry.accountId ?? 'acct-main',
      entry.rowCount,
      entry.filename ?? '',
      entry.closingBalanceMinor ?? '',
      entry.atISO,
      entry.sourceEvidenceId ?? '',
    ]),
  );
}

function evidenceDocumentsCsv(state: AppState): string {
  return toCsv(
    [
      'id',
      'workspaceId',
      'filename',
      'mediaType',
      'byteSize',
      'addedAt',
      'sourceType',
      'extractionStatus',
      'storageState',
      'linkedTransactionIds',
    ],
    (state.evidenceDocuments ?? []).map((document) => [
      document.id,
      document.workspaceId ?? '',
      document.filename,
      document.mediaType,
      document.byteSize,
      document.addedAtISO,
      document.sourceType,
      document.extractionStatus,
      document.storageState,
      (document.linkedTransactionIds ?? []).join('|'),
    ]),
  );
}

function exportPeriod(transactions: readonly Transaction[]): Readonly<{
  start: string;
  end: string;
}> {
  const dates = transactions
    .map((transaction) => transaction.when.slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/u.test(date))
    .sort();
  return { start: dates[0] ?? '', end: dates.at(-1) ?? '' };
}

function accountantRecordsCsv(state: AppState): string {
  const workspace = state.workspaces.find((candidate) => candidate.id === state.activeWorkspaceId);
  const accountNames = new Map(
    (state.accounts ?? []).map((account) => [account.id, account.name] as const),
  );
  return toCsv(
    [
      'workspace',
      'workspaceKind',
      'transactionId',
      'date',
      'description',
      'amount',
      'currency',
      'category',
      'account',
      'recordSource',
      'sourceEvidenceId',
      'sourceFilename',
    ],
    state.transactions.map((transaction) => [
      workspace?.name ?? '',
      workspace?.kind ?? '',
      transaction.id,
      transaction.when.slice(0, 10),
      transaction.merchant,
      transaction.amount,
      'GBP',
      transaction.category,
      accountNames.get(transaction.accountId ?? 'acct-main') ?? 'Main',
      transaction.source,
      transaction.sourceEvidenceId ?? '',
      transaction.sourceEvidenceId
        ? ((state.evidenceDocuments ?? []).find(
            (document) => document.id === transaction.sourceEvidenceId,
          )?.filename ?? '')
        : '',
    ]),
  );
}

function exportManifestCsv(state: AppState, generatedAtISO: string): string {
  const workspace = state.workspaces.find((candidate) => candidate.id === state.activeWorkspaceId);
  const period = exportPeriod(state.transactions);
  const unresolved =
    state.readerCandidates.length +
    (state.reviewQueue?.length ?? 0) +
    (state.reviewQueueSpillover?.length ?? 0);
  return toCsv(
    [
      'workspace',
      'workspaceKind',
      'currency',
      'periodStart',
      'periodEnd',
      'generatedAt',
      'policyVersion',
      'unresolvedReviewItems',
    ],
    workspace
      ? [
          [
            workspace.name,
            workspace.kind,
            workspace.baseCurrency,
            period.start,
            period.end,
            generatedAtISO,
            workspace.kind === 'business' ? 'melo-business-alpha-v1' : 'melo-personal-v1',
            unresolved,
          ],
        ]
      : [],
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
    ['id', 'source', 'merchant', 'amount', 'date', 'hint', 'addedAt', 'sourceEvidenceId'],
    reviewQueue.map((r) => [
      r.id,
      r.source,
      r.merchant,
      r.amount,
      r.date ?? '',
      r.hint ?? '',
      r.addedAt,
      r.sourceEvidenceId ?? '',
    ]),
  );
}

/** Ignored review signatures — ENGINES §6 "Ignored review items: suppressed in
 *  main flow, visible in Hidden list." Mirrors the design source's
 *  `ignored-review-signatures.csv` shape verbatim (single `signature`
 *  column, one row per suppressed merchant|amountCents|date key); this
 *  bundle's file name follows its own hyphenated convention already used
 *  elsewhere (`calendarEvents.csv` is the camelCase outlier, kept as-is for
 *  back-compat). `ignoredReviewSigs` is optional on `AppState` for shape
 *  back-compat with hand-built fixtures predating the field (store.ts) —
 *  callers pass `state.ignoredReviewSigs ?? []`. */
function ignoredReviewCsv(ignoredReviewSigs: readonly string[]): string {
  return toCsv(
    ['signature'],
    ignoredReviewSigs.map((sig) => [sig]),
  );
}

/** Declared income sources (`lib/income.ts` `IncomeSource`, ENGINES §1 income-cadence model) — one row
 *  per source, in store order. `dayOfMonth` / `anchorISO` are the two cadence-specific fields (only one
 *  is meaningful per cadence); the unused one renders "" rather than being omitted, so every row has
 *  the same column set. */
function incomeSourcesCsv(incomeSources: readonly IncomeSource[]): string {
  return toCsv(
    ['id', 'label', 'cadence', 'dayOfMonth', 'anchorISO', 'amount', 'source'],
    incomeSources.map((s) => [
      s.id,
      s.label,
      s.cadence,
      s.dayOfMonth ?? '',
      s.anchorISO ?? '',
      s.amount,
      s.source,
    ]),
  );
}

/** Merchant→category memory (`lib/merchantMemory.ts` `MerchantCategoryMap`, DATA_INTELLIGENCE.md
 *  phase ③) — one row per remembered merchant, keyed by the normalised merchant string already used as
 *  the map's key. Pending-flip fields (`pendingCategory` / `pendingCount`) render "" / 0 when absent
 *  rather than being omitted, so every row has the same column set. */
function merchantCategoriesCsv(merchantCategories: MerchantCategoryMap): string {
  return toCsv(
    ['merchant', 'category', 'correctedAt', 'hits', 'pendingCategory', 'pendingCount'],
    Object.entries(merchantCategories).map(([merchant, entry]) => [
      merchant,
      entry.category,
      entry.correctedAt,
      entry.hits,
      entry.pendingCategory ?? '',
      entry.pendingCount ?? 0,
    ]),
  );
}

/** Dismissed / cooldown signals across every "caught" detector family, unified into ONE file (task:
 *  "one file, columns family/merchant/at") rather than four near-identical single-column files. Income,
 *  bill, and annual dismissals (`dismissedIncomeSignals` / `dismissedBillSignals` /
 *  `dismissedAnnualSignals`) are plain normalised-merchant string lists with no recorded timestamp, so
 *  their rows carry `at: ""` — honestly absent, never fabricated. Drift dismissals
 *  (`dismissedDriftSignals`) are the one family that already carries a timestamp
 *  (`DriftCooldownEntry`, the 45-day re-propose cooldown), so its rows carry the real `at`. Row order:
 *  income, then bill, then drift, then annual, each in store order — deterministic, no re-sorting. */
function dismissedSignalsCsv(state: AppState): string {
  const rows: Array<[string, string, string]> = [
    ...(state.dismissedIncomeSignals ?? []).map((merchant): [string, string, string] => [
      'income',
      merchant,
      '',
    ]),
    ...(state.dismissedBillSignals ?? []).map((merchant): [string, string, string] => [
      'bill',
      merchant,
      '',
    ]),
    ...(state.dismissedDriftSignals ?? []).map(
      (entry: DriftCooldownEntry): [string, string, string] => ['drift', entry.merchant, entry.at],
    ),
    ...(state.dismissedAnnualSignals ?? []).map((merchant): [string, string, string] => [
      'annual',
      merchant,
      '',
    ]),
  ];
  return toCsv(['family', 'merchant', 'at'], rows);
}

/** Overflow review candidates (`reviewQueueSpillover`, ENGINES §7 "silent queue truncation" fix) — the
 *  same column set as `reviewQueue.csv` (design-source shape) so the two files read as one logical
 *  list split only by whether a row currently fits the visible cap. */
function reviewSpilloverCsv(reviewQueueSpillover: readonly ReviewItem[]): string {
  return toCsv(
    ['id', 'source', 'merchant', 'amount', 'date', 'hint', 'addedAt', 'sourceEvidenceId'],
    reviewQueueSpillover.map((r) => [
      r.id,
      r.source,
      r.merchant,
      r.amount,
      r.date ?? '',
      r.hint ?? '',
      r.addedAt,
      r.sourceEvidenceId ?? '',
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

function amountCell(value: { minorUnits: number } | null | undefined): string {
  return value === null || value === undefined ? '' : String(value.minorUnits);
}

function decisionLedgerCsv(entries: readonly DecisionLedgerEntry[]): string {
  return toCsv(
    [
      'id',
      'workspaceId',
      'createdAt',
      'status',
      'decisionType',
      'question',
      'priority',
      'contextRoute',
      'choice',
      'outcome',
      'cashEffectMinor',
      'bufferEffectMinor',
      'forecastVersionId',
      'learningPermitted',
      'factRefs',
    ],
    entries
      .filter((entry) => entry.status !== 'deleted')
      .map((entry) => [
        entry.id,
        entry.workspaceId,
        entry.createdAt,
        entry.status,
        entry.decisionType,
        entry.question.text,
        entry.question.priority,
        entry.contextRoute,
        entry.userChoice.state,
        entry.outcome.state,
        amountCell(entry.materiality.cashEffect),
        amountCell(entry.materiality.bufferEffect),
        entry.forecastVersionId ?? '',
        entry.learning.permitted,
        entry.factRefs.join('|'),
      ]),
  );
}

function provisionalAnswersCsv(records: readonly ProvisionalAnswerRecord[]): string {
  return toCsv(
    [
      'id',
      'workspaceId',
      'createdAt',
      'updatedAt',
      'question',
      'reliance',
      'nextBestInput',
      'savedToSetup',
      'decisionLedgerEntryId',
      'missingMaterialInfo',
      'assumptions',
    ],
    records.map((record) => [
      record.id,
      record.workspaceId,
      record.createdAt,
      record.updatedAt,
      record.question,
      record.reliance,
      record.nextBestInput ?? '',
      record.savedToSetup,
      record.decisionLedgerEntryId ?? '',
      record.missingMaterialInfo.join('|'),
      record.assumptions.join('|'),
    ]),
  );
}

function materialChangesCsv(records: readonly MaterialFinancialChange[]): string {
  return toCsv(
    [
      'id',
      'workspaceId',
      'occurredAt',
      'detectedAt',
      'type',
      'truth',
      'monetaryEffectMinor',
      'lowerDeltaMinor',
      'upperDeltaMinor',
      'conservativeBoundaryDeltaMinor',
      'affectedDecisionIds',
      'reviewRequired',
      'userActionRequired',
      'explanationCode',
    ],
    records.map((record) => [
      record.id,
      record.workspaceId,
      record.occurredAt,
      record.detectedAt,
      record.type,
      record.truth,
      amountCell(record.monetaryEffect),
      amountCell(record.rangeEffect?.lowerDelta),
      amountCell(record.rangeEffect?.upperDelta),
      amountCell(record.rangeEffect?.conservativeBoundaryDelta),
      record.affectedDecisionIds.join('|'),
      record.reviewRequired,
      record.userActionRequired,
      record.explanationCode,
    ]),
  );
}

function correctionImpactsCsv(records: readonly CorrectionImpactRecord[]): string {
  return toCsv(
    [
      'id',
      'workspaceId',
      'correctedAt',
      'correctedBy',
      'subjectKind',
      'subjectId',
      'field',
      'original',
      'corrected',
      'materialChangeId',
      'affectedDecisionIds',
      'contradictionState',
      'futureBehaviour',
      'reversedByCorrectionId',
    ],
    records.map((record) => [
      record.id,
      record.workspaceId,
      record.correctedAt,
      record.correctedBy,
      record.subject.kind,
      record.subject.id,
      record.field,
      record.original,
      record.corrected,
      record.materialChangeId ?? '',
      record.affectedDecisionIds.join('|'),
      record.contradictionState,
      record.futureBehaviour,
      record.reversedByCorrectionId ?? '',
    ]),
  );
}

function criticalJourneyContinuityCsv(records: readonly CriticalJourneyContinuityRecord[]): string {
  return toCsv(
    [
      'id',
      'workspaceId',
      'journeyId',
      'status',
      'startedAt',
      'updatedAt',
      'currentRoute',
      'pendingAction',
      'blockerCodes',
      'decisionLedgerEntryIds',
      'materialChangeIds',
      'correctionImpactIds',
    ],
    records.map((record) => [
      record.id,
      record.workspaceId,
      record.journeyId,
      record.status,
      record.startedAt,
      record.updatedAt,
      record.currentRoute,
      record.pendingAction ?? '',
      record.blockerCodes.join('|'),
      record.decisionLedgerEntryIds.join('|'),
      record.materialChangeIds.join('|'),
      record.correctionImpactIds.join('|'),
    ]),
  );
}

function requireEvidenceLinks(state: AppState): AppState {
  const ids = new Set<string>();
  for (const document of state.evidenceDocuments ?? []) {
    if (ids.has(document.id)) {
      throw new Error(`Evidence document ${document.id} is duplicated.`);
    }
    ids.add(document.id);
  }
  const references = [
    ...state.transactions,
    ...(state.statementImports ?? []),
    ...state.readerCandidates,
    ...(state.reviewQueue ?? []),
    ...(state.reviewQueueSpillover ?? []),
  ];
  for (const row of references) {
    if (row.sourceEvidenceId !== undefined && !ids.has(row.sourceEvidenceId)) {
      throw new Error(`Evidence document ${row.sourceEvidenceId} is unavailable for export.`);
    }
  }
  return state;
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

/**
 * Build the full export bundle for the active workspace data partition in a given app state.
 *
 * - `json` is the complete `AppState`, pretty-printed — the canonical,
 *   loss-free record; the CSVs are the human/spreadsheet-friendly slice.
 * - `csvs` always carries the {@link EXPORT_CSV_FILES} set (header row even when
 *   empty), plus `corrections.csv` when transaction edits exist.
 *
 * Pure and deterministic: no clock, no randomness, no I/O, and the input state
 * is never mutated.
 */
export function buildExport(
  state: AppState,
  workspaceId: WorkspaceId = state.activeWorkspaceId,
  generatedAtISO = '',
): ExportBundle {
  const partition = requireWorkspaceData(state, workspaceId);
  // Schema v11 is the first durable multi-workspace shape. Refuse a crafted or corrupt partition
  // before serialising any row; legacy hand-built/export fixtures are still accepted because real
  // persisted legacy data is normalised to the current schema during load.
  const localState = requireEvidenceLinks(
    partition.schemaVersion >= 11 ? requireWorkspaceRows(partition, workspaceId) : partition,
  );
  const json = JSON.stringify(localState, null, 2);

  const csvs: Record<string, string> = {
    'workspace.csv': workspaceCsv(localState),
    'accounts.csv': accountsCsv(localState),
    'transactions.csv': transactionsCsv(localState.transactions),
    'statement-imports.csv': statementImportsCsv(localState),
    'evidence-documents.csv': evidenceDocumentsCsv(localState),
    'accountant-records.csv': accountantRecordsCsv(localState),
    'export-manifest.csv': exportManifestCsv(localState, generatedAtISO),
    'subs.csv': subsCsv(localState.subs, localState.subPaused, localState.subOverrides),
    'pots.csv': potsCsv(localState.pots),
    'cycles.csv': cyclesCsv(localState.cycles),
    'ledger.csv': ledgerCsv(localState.potLedger),
    'calendarEvents.csv': calendarEventsCsv(localState.calendarEvents),
    'reviewQueue.csv': reviewQueueCsv(localState.reviewQueue ?? []),
    'ignored-review.csv': ignoredReviewCsv(localState.ignoredReviewSigs ?? []),
    'onboarding.csv': onboardingCsv(localState),
    'balance.csv': balanceCsv(localState),
    'settings.csv': settingsCsv(localState),
    'incomeSources.csv': incomeSourcesCsv(localState.incomeSources ?? []),
    'merchant-categories.csv': merchantCategoriesCsv(localState.merchantCategories ?? {}),
    'dismissed-signals.csv': dismissedSignalsCsv(localState),
    'review-spillover.csv': reviewSpilloverCsv(localState.reviewQueueSpillover ?? []),
    'decision-ledger.csv': decisionLedgerCsv(localState.decisionLedger ?? []),
    'provisional-answers.csv': provisionalAnswersCsv(localState.provisionalAnswers ?? []),
    'material-changes.csv': materialChangesCsv(localState.materialChanges ?? []),
    'correction-impacts.csv': correctionImpactsCsv(localState.correctionImpacts ?? []),
    'critical-journey-continuity.csv': criticalJourneyContinuityCsv(
      localState.criticalJourneyContinuity ?? [],
    ),
  };

  const edits = readEdits(localState);
  if (edits.length > 0) {
    csvs['corrections.csv'] = correctionsCsv(edits);
  }

  return { json, csvs };
}
