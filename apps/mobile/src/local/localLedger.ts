import {
  buildImportReviewPacket,
  parseImportFile,
  type ImportParseIssue,
  type ImportReviewPacket,
  type ImportReviewRowSummary,
} from '@folio/import-engine';
import { buildForecast } from '@folio/finance-engine';
import { expandBoundedRecurrence } from '@folio/calendar-engine';
import {
  createCycleRecordId,
  createInstantString,
  createMoney,
  createPotId,
  createSubscriptionId,
  createWorkspaceId,
  createEntityVersion,
  type CycleRecord,
  type Money,
  type Pot,
  type Subscription,
} from '@folio/domain';
import type { MeloLocalFinancialSnapshot } from '@folio/ai-contracts';

export type LocalTransactionSource = 'seed' | 'manual' | 'melo' | 'import' | 'open_banking';
export type LocalTransactionStatus = 'confirmed' | 'needs_review';
export type LocalImportAuthorityState =
  | 'imported-claim'
  | 'estimated'
  | 'inferred'
  | 'user-confirmed';
export type LocalImportReviewState = 'ready-for-user-confirmation' | 'needs-review';
export type LocalImportUserConfirmationState = 'not-requested' | 'requested' | 'confirmed';
export type LocalImportRejectionReason =
  | 'duplicate'
  | 'wrong-workspace'
  | 'transfer-internal'
  | 'irrelevant-document'
  | 'parser-error'
  | 'not-mine'
  | 'other';

export type LocalLedgerTransaction = Readonly<{
  id: string;
  /** Optional source-account identity. The canonical adapter resolves this through the explicit
   *  account projection when one is supplied; legacy local-ledger callers still use its single
   *  workspace cash account. */
  accountId?: string;
  title: string;
  amountMinor: number;
  date: string;
  bookedAt?: string;
  categoryId?: string;
  source: LocalTransactionSource;
  status: LocalTransactionStatus;
  /** Financial lifecycle is separate from review status; absent legacy rows are posted. */
  lifecycleStatus?: 'pending' | 'posted' | 'reversed' | 'void';
  lifecycleReason?: 'declined' | 'duplicate' | 'user-voided' | 'provider-expired' | 'other';
  lifecycleChangedAt?: string;
  moneyMovementKind?: 'ordinary' | 'transfer' | 'refund';
  transferLinkId?: string;
  refundOfId?: string;
  reversalOfId?: string;
  duplicateOfId?: string;
  replacesId?: string;
  replacedById?: string;
  manuallyCorrectedAt?: string;
  providerUpdatedAt?: string;
  protected: boolean;
  original?: string;
  provenanceHash?: string;
  commitmentStatus?: LocalCommitmentStatus;
  commitmentPressure?: LocalCommitmentPressure;
  repeats?: LocalCommitmentRepeat;
  certainty?: 'confirmed' | 'expected';
  sourceDocumentId?: string;
  sourceLabel?: string;
  sourceTransactionId?: string;
  sourceEvidenceId?: string;
  externalId?: string;
  connectionId?: string;
  sourceOrdinal?: number;
}>;

export function localTransactionLifecycleStatusOf(
  transaction: Pick<LocalLedgerTransaction, 'lifecycleStatus'>,
): NonNullable<LocalLedgerTransaction['lifecycleStatus']> {
  return transaction.lifecycleStatus ?? 'posted';
}

export function isLocalCashEffectiveTransaction(
  transaction: Pick<LocalLedgerTransaction, 'lifecycleStatus'>,
): boolean {
  return localTransactionLifecycleStatusOf(transaction) === 'posted';
}

/**
 * Posted rows for realised local calculations. Own-account transfers disappear; linked refunds and
 * reversals adjust the original row on its original date. Unlinked refunds remain visible in the
 * audit trail but cannot be inferred as income or silently reduce a later month's spend.
 */
export function localAnalyticsTransactions<T extends LocalLedgerTransaction>(
  transactions: readonly T[],
): T[] {
  const posted = transactions.filter(isLocalCashEffectiveTransaction);
  const byId = new Map(posted.map((transaction) => [transaction.id, transaction]));
  const offsets = new Map<string, number>();
  const linkedRowIds = new Set<string>();

  for (const transaction of posted) {
    if (transaction.moneyMovementKind === 'transfer' && transaction.transferLinkId) continue;
    const targetId = transaction.refundOfId ?? transaction.reversalOfId;
    if (targetId === undefined || !byId.has(targetId)) continue;
    offsets.set(targetId, (offsets.get(targetId) ?? 0) + transaction.amountMinor);
    linkedRowIds.add(transaction.id);
  }

  return posted.flatMap((transaction) => {
    if (
      (transaction.moneyMovementKind === 'transfer' && transaction.transferLinkId) ||
      linkedRowIds.has(transaction.id) ||
      (transaction.moneyMovementKind === 'refund' && transaction.refundOfId === undefined)
    ) {
      return [];
    }
    const offset = offsets.get(transaction.id) ?? 0;
    if (offset === 0) return [transaction];
    const adjusted = transaction.amountMinor + offset;
    const bounded =
      transaction.amountMinor < 0
        ? Math.min(0, adjusted)
        : transaction.amountMinor > 0
          ? Math.max(0, adjusted)
          : 0;
    return bounded === 0 ? [] : [{ ...transaction, amountMinor: bounded }];
  });
}

function localLifecycleDetail(transaction: LocalLedgerTransaction): string {
  const lifecycle = localTransactionLifecycleStatusOf(transaction);
  if (lifecycle === 'pending') return 'Pending provider record - not counted yet';
  if (lifecycle === 'reversed') return 'Reversed record - not counted';
  if (lifecycle === 'void') return 'Voided record - not counted';
  if (transaction.moneyMovementKind === 'transfer' && transaction.transferLinkId) {
    return 'Linked own-account transfer - excluded from income and spend';
  }
  if (transaction.moneyMovementKind === 'refund') {
    return transaction.refundOfId
      ? 'Linked refund - netted against the original payment'
      : 'Unlinked refund - excluded from inferred income';
  }
  if (transaction.reversalOfId) return 'Reversal - netted against the original payment';
  return transaction.protected ? 'Protected in the route' : 'Confirmed local record';
}

export type LocalImportDraft = Readonly<{
  rowId: string;
  transactionId: string;
  original: string;
  interpretation: string;
  amountMinor: number;
  date: string;
  authorityState: LocalImportAuthorityState;
  reviewState: LocalImportReviewState;
  userConfirmationState: LocalImportUserConfirmationState;
  parserIssues: readonly string[];
  status: 'Ready to confirm' | 'Needs review';
  provenanceHash: string;
  searchText: string;
  reasons: readonly string[];
}>;

export type LocalRejectedImportEvidence = Readonly<{
  rowId: string;
  transactionId: string;
  original: string;
  interpretation: string;
  amountMinor: number;
  date: string;
  authorityState: LocalImportAuthorityState;
  reviewState: 'dismissed';
  userConfirmationState: 'rejected';
  parserIssues: readonly string[];
  status: 'Rejected' | 'Excluded';
  provenanceHash: string;
  searchText: string;
  reasons: readonly string[];
  rejectedAt: string;
  rejectionReason: LocalImportRejectionReason;
  restoreCount: number;
}>;

export type LocalDocumentSourceType =
  | 'csv'
  | 'txt'
  | 'pdf'
  | 'image'
  | 'camera'
  | 'paste'
  | 'other';

export type LocalDocumentExtractionStatus =
  | 'not-attempted'
  | 'text-extracted'
  | 'ocr-extracted'
  | 'unreadable'
  | 'failed';

export type LocalDocumentStage = Readonly<{
  id: string;
  filename: string;
  mediaType: string;
  byteSize: number;
  stagedAt: string;
  storageState: 'copied_to_app_cache' | 'pasted_text';
  textDigest: string;
  sourceType?: LocalDocumentSourceType;
  extractionStatus?: LocalDocumentExtractionStatus;
  linkedTransactionIds?: readonly string[];
  // The on-device file location of the saved original (when one exists), so the user can open it in
  // a viewer. Local only — never sent anywhere. Absent for pasted text (there is no file).
  uri?: string;
  // Free-text notes the user attached to this saved file. Reference only — notes never affect Today.
  notes?: readonly string[];
}>;

export type DocumentItemInput = Readonly<{
  documentId: string;
  kind: 'money' | 'income' | 'bill' | 'debt';
  amountText: string;
  title: string;
  date?: string;
}>;

// The single source of truth for every history-entry kind. The persistence allowlist
// (nativeLedgerStore.isHistoryKind) is derived from this same const, so the two can never drift —
// previously the store accepted only ~half of these and silently dropped pot/subscription/cycle
// history on every reload (a data-loss bug). Add new kinds here ONCE.
export const LOCAL_HISTORY_KINDS = [
  'manual_added',
  'recovery_recorded',
  'planner_added',
  'import_staged',
  'import_confirmed',
  'import_dismissed',
  'import_edited',
  'import_restored',
  'import_suggested',
  'document_staged',
  'pot_created',
  'pot_funded',
  'pot_reallocated',
  'subscription_created',
  'subscription_paused',
  'subscription_resumed',
  'subscription_used',
  'subscription_cancelled',
  'subscription_bulk_paused',
  'cycle_closed',
  'tight_point_goal_set',
  'cash_on_hand_set',
  'sub_nudged',
  'calendar_event_added',
  'calendar_event_removed',
  'calendar_event_updated',
] as const;

export type LocalHistoryKind = (typeof LOCAL_HISTORY_KINDS)[number];

// A user-ADDED calendar event. Derived events (payday, bills, sub renewals, deadlines, review
// drafts) are computed on read by deriveCalendarEvents() in calendarEvents.ts and are NEVER stored
// here. This array only holds events the user typed into the Calendar themselves.
//
// Named UserCalendarEvent (not LocalCalendarEvent) deliberately: localCalendarAdapter.ts already
// exports a `LocalCalendarEvent` for the agenda READ surface (a fully-laid-out row). Reusing that
// name on the ledger would collide. This is the durable input shape; that one is the derived output
// shape.
export type UserCalendarEventKind = 'in' | 'out' | 'review' | 'deadline' | 'manual';

export type UserCalendarEvent = Readonly<{
  id: string;
  // ISO date (YYYY-MM-DD).
  dateIso: string;
  title: string;
  kind: UserCalendarEventKind;
  // Signed integer minor units (pence). Positive = money in, negative = money out, absent =
  // informational. Stored exactly as given, never re-derived from text.
  amountMinor?: number;
  note?: string;
  // When set, this event repeats; the read engine expands it over the window.
  recurring?: 'monthly' | 'yearly';
}>;

export type AddUserCalendarEventInput = Readonly<{
  id?: string;
  dateIso: string;
  title: string;
  kind: UserCalendarEventKind;
  amountMinor?: number;
  note?: string;
  recurring?: 'monthly' | 'yearly';
}>;

// The most user-added calendar events Folio keeps. Newest first; older ones fall off the end. A cap
// keeps the durable snapshot bounded — the Calendar is a planner, not an unbounded event log.
export const MAX_USER_CALENDAR_EVENTS = 100;

// The widest day-delta a single sub renewal can be nudged in either direction. A renewal is a real
// recurring charge; the user can slide it a few days to dodge a tight day, but not relocate it
// arbitrarily. Clamped to keep the derived picture honest.
export const MAX_SUB_OVERRIDE_DAYS = 7;

export type LocalHistoryEntry = Readonly<{
  id: string;
  label: string;
  createdAt: string;
  kind: LocalHistoryKind;
}>;

export type LocalLedgerState = Readonly<{
  asOfDate: string;
  cashOnHandMinor: number;
  currency: 'GBP';
  // The user's own "tight-point goal" — the floor they want their tightest balance to stay above.
  // A scalar on the canonical metadata (NOT a durable-container blob): null means the user has not
  // set one yet. Money in integer minor units, like everything else here.
  tightPointGoalMinor: number | null;
  transactions: readonly LocalLedgerTransaction[];
  importDrafts: readonly LocalImportDraft[];
  rejectedImports: readonly LocalRejectedImportEvidence[];
  documentStages: readonly LocalDocumentStage[];
  importIssueCount: number;
  history: readonly LocalHistoryEntry[];
  // Durable containers/history that are NOT single money events, so they live as first-class arrays
  // rather than being encoded onto transactions[]. The canonical financial snapshot ignores these;
  // they are projected into the Pots/Subscriptions/Insights screens by their read-adapters.
  pots: readonly Pot[];
  subscriptions: readonly Subscription[];
  cycles: readonly CycleRecord[];
  // Per-subscription day-delta nudge keyed by sub NAME (e.g. { "Netflix": 3 } slides Netflix's next
  // renewal 3 days later when deriving calendar events). Clamped to ±MAX_SUB_OVERRIDE_DAYS. A name
  // with delta 0 is removed (the default is "no nudge"). Durable: round-trips through the snapshot
  // blob like pots/subscriptions/cycles, not the normalized relational tables.
  subOverrides: Readonly<Record<string, number>>;
  // User-ADDED calendar events only. Derived events are computed on read, never stored. Newest
  // first, capped at MAX_USER_CALENDAR_EVENTS. Durable: same snapshot-blob round-trip as above.
  calendarEvents: readonly UserCalendarEvent[];
  lastImportSummary?: LocalImportSummary;
}>;

export type LocalImportSummary = Readonly<{
  parsedRows: number;
  readyForAcceptance: number;
  needsUserReview: number;
  parseIssues: number;
  parserName: string;
  skippedRows: number;
}>;

export type LocalRouteEvent = Readonly<{
  day: string;
  title: string;
  detail: string;
  amountMinor: number;
  tone: 'confirmed' | 'estimated' | 'attention';
}>;

export type LocalRoutePointKind =
  | 'confirmed'
  | 'expected'
  | 'commitment'
  | 'plan'
  | 'preview'
  | 'shortfall';

export type LocalRoutePointObjectState =
  | 'accepted'
  | 'already real'
  | 'disabled'
  | 'needs source'
  | 'needs user confirmation'
  | 'preview only'
  | 'rejected'
  | 'requires review';

export type LocalRoutePoint = Readonly<{
  accessibleLabel: string;
  actionLabel: string;
  authorityLabel: string;
  date: string;
  dependsOn: readonly string[];
  label: string;
  linkedSourceId?: string;
  pointKind: LocalRoutePointKind;
  provenanceLabel: string;
  protectedMinor?: number;
  reviewState: LocalRoutePointObjectState;
  sourceLabel: string;
  title: string;
  balanceMinor: number;
  deltaMinor: number;
  explanation: string;
  tone: 'confirmed' | 'estimated' | 'attention';
}>;

export type LocalRouteSummary = Readonly<{
  availableNowMinor: number;
  tightestDay: string;
  tightestBalanceMinor: number;
  pendingReviewCount: number;
  protectedItems: readonly string[];
  nextPaydayLabel: string;
  timeline: readonly LocalRouteEvent[];
  points: readonly LocalRoutePoint[];
  confirmedTransactionCount: number;
  lastActionLabel: string;
}>;

export type LocalSearchRecord = Readonly<{
  id: string;
  title: string;
  detail: string;
  meta: string;
  amountMinor?: number;
  tone: 'confirmed' | 'estimated' | 'attention';
}>;

export type MeloLocalRecordLookup = Readonly<{
  answer: string;
  financialConclusion: string;
  dataUsed: readonly string[];
  guardrails: readonly string[];
  records: readonly LocalSearchRecord[];
}>;

export type LocalLedgerExportPayload = Readonly<{
  schema: 'folio-local-export-v1';
  exportedAt: string;
  asOfDate: string;
  currency: LocalLedgerState['currency'];
  summary: Readonly<{
    availableNowMinor: number;
    tightestBalanceMinor: number;
    tightestDay: string;
    pendingReviewCount: number;
    confirmedTransactionCount: number;
  }>;
  transactions: readonly Readonly<{
    id: string;
    title: string;
    amountMinor: number;
    date: string;
    source: LocalTransactionSource;
    status: LocalTransactionStatus;
    protected: boolean;
    original?: string;
  }>[];
  importDrafts: readonly Readonly<{
    rowId: string;
    interpretation: string;
    original: string;
    amountMinor: number;
    date: string;
    authorityState: LocalImportDraft['authorityState'];
    reviewState: LocalImportDraft['reviewState'];
    userConfirmationState: LocalImportDraft['userConfirmationState'];
    parserIssues: readonly string[];
    status: LocalImportDraft['status'];
    reasons: readonly string[];
  }>[];
  rejectedImports: readonly Readonly<{
    rowId: string;
    interpretation: string;
    original: string;
    amountMinor: number;
    date: string;
    rejectionReason: LocalImportRejectionReason;
    rejectedAt: string;
    status: LocalRejectedImportEvidence['status'];
    reasons: readonly string[];
  }>[];
  documentStages: readonly Readonly<{
    id: string;
    filename: string;
    mediaType: string;
    byteSize: number;
    stagedAt: string;
    storageState: LocalDocumentStage['storageState'];
  }>[];
  history: readonly LocalHistoryEntry[];
}>;

export type ManualTransactionInput = Readonly<{
  title: string;
  amountText: string;
  kind: 'spend' | 'income';
  protected?: boolean;
}>;

export type LocalCommitmentStatus = 'current' | 'behind' | 'arrangement' | 'unknown';
export type LocalCommitmentPressure = 'high' | 'medium' | 'unknown';
export type LocalCommitmentRepeat = 'none' | 'weekly' | 'monthly';

export type LocalPlannedCommitmentInput = Readonly<{
  title: string;
  amountText: string;
  date: string;
  protected?: boolean;
  status?: LocalCommitmentStatus;
  pressure?: LocalCommitmentPressure;
  repeats?: LocalCommitmentRepeat;
  paid?: boolean;
}>;

export type CreatePotInput = Readonly<{
  name: string;
  goalMinor: number;
  perWeekMinor: number;
  accent?: boolean;
}>;

// How often a subscription charges. The user picks this in plain language ("every month") and the
// engine turns it into the number of days until the next charge, so the Subscriptions screen and the
// "next charge" tile read a real renewal day.
export type SubscriptionCadence = 'weekly' | 'monthly' | 'yearly';

export type CreateSubscriptionInput = Readonly<{
  name: string;
  costMinor: number;
  cadence: SubscriptionCadence;
  // Whole days until the next charge. When omitted, defaults to a full cadence period from today
  // (a week / month / year), so a freshly added subscription has an honest upcoming renewal.
  nextChargeInDays?: number;
}>;

export type CreateCycleRecordInput = Readonly<{
  label: string;
  spareMinor: number;
  tightPointMinor: number;
  setAsideMinor: number;
  note?: string;
  closedAt?: string;
}>;

export type QuickEstimateInput = Readonly<{
  billAmountText: string;
  billDate: string;
  billTitle: string;
  cashNowText: string;
  incomeAmountText: string;
  incomeDate: string;
  incomeTitle: string;
  incomeRepeats?: LocalCommitmentRepeat;
  incomeCertainty?: 'confirmed' | 'expected';
}>;

export type StageStatementImportResult = Readonly<{
  state: LocalLedgerState;
  packet: ImportReviewPacket;
  issues: readonly ImportParseIssue[];
  message: string;
  documentStage?: LocalDocumentStage;
}>;

// One clean transaction read off a statement by the AI reader (see statementExtraction.ts). amount is
// in INTEGER minor units (pence) and always positive; the sign lives in `direction`. This is the
// structured shape that goes STRAIGHT into a review draft — no re-parsing of free text — so the
// amount and date the reader gave us are never lossily re-derived.
export type StagedStatementTransaction = Readonly<{
  dateIso: string;
  merchant: string;
  amountMinor: number;
  direction: 'spend' | 'income';
}>;

export type StageStatementTransactionsResult = Readonly<{
  state: LocalLedgerState;
  message: string;
  // How many waiting rows this actually added (after de-duplication against existing drafts/records).
  addedDraftCount: number;
  documentStage?: LocalDocumentStage;
}>;

export type StageDocumentForManualReviewResult = Readonly<{
  state: LocalLedgerState;
  message: string;
  documentStage: LocalDocumentStage;
}>;

export type LocalImportDismissInput = Readonly<{
  reason?: LocalImportRejectionReason;
  status?: LocalRejectedImportEvidence['status'];
}>;

export type LocalImportSuggestion = Readonly<{
  interpretation: string;
  reviewState: LocalImportReviewState;
  protected: boolean;
  reason: string;
}>;

export type LocalImportDraftEditInput = Readonly<{
  interpretation: string;
  amountText: string;
  date: string;
}>;

export type LocalDocumentStageInput = Readonly<{
  filename: string;
  mediaType: string;
  byteSize: number;
  storageState: LocalDocumentStage['storageState'];
  // Optional on-device file location (from the picker / camera), persisted so the file can be opened
  // in a viewer later. Never leaves the device.
  uri?: string;
}>;

const seedAsOfDate = '2026-06-21';
const millisecondsPerDay = 86_400_000;

export function createInitialLocalLedgerState(asOfDate = seedAsOfDate): LocalLedgerState {
  const dayOffset = isoDayDistance(seedAsOfDate, asOfDate);
  const date = (value: string) => addIsoDays(value, dayOffset);
  const parsedAt = parsedAtForDate(asOfDate);

  return {
    asOfDate,
    cashOnHandMinor: 119_047,
    currency: 'GBP',
    tightPointGoalMinor: null,
    importIssueCount: 0,
    documentStages: [],
    rejectedImports: [],
    transactions: [
      {
        id: 'seed_insurance_paid_2026_06_21',
        title: 'Insurance paid',
        amountMinor: -13_347,
        date: date('2026-06-21'),
        source: 'seed',
        status: 'confirmed',
        protected: true,
        original: 'AVIVA INSURANCE DD 133.47',
      },
      {
        id: 'seed_rent_protected_2026_07_01',
        title: 'Rent protected',
        amountMinor: -87_500,
        date: date('2026-07-01'),
        source: 'seed',
        status: 'confirmed',
        protected: true,
        original: 'STANDING ORDER LANDLORD 875.00',
      },
      {
        id: 'seed_food_allowance_2026_06_24',
        title: 'Food allowance protected',
        amountMinor: -4_000,
        date: date('2026-06-24'),
        source: 'seed',
        status: 'confirmed',
        protected: true,
      },
      {
        id: 'seed_payroll_2026_06_26',
        title: 'Payday',
        amountMinor: 184_000,
        date: date('2026-06-26'),
        source: 'seed',
        status: 'confirmed',
        protected: false,
        original: 'WABTEC PAYROLL 1840.00',
      },
    ],
    importDrafts: [
      {
        rowId: 'seed_draft_abound',
        transactionId: 'seed_import_abound_2026_06_25',
        original: 'DD ABOUND 162.95',
        interpretation: 'Possible debt repayment',
        amountMinor: -16_295,
        date: date('2026-06-25'),
        authorityState: 'estimated',
        reviewState: 'needs-review',
        userConfirmationState: 'requested',
        parserIssues: ['uncertain counterparty'],
        status: 'Needs review',
        provenanceHash: 'seed-abound-review',
        searchText: 'DD ABOUND 162.95 possible debt repayment',
        reasons: ['uncertain counterparty'],
      },
      {
        rowId: 'seed_draft_rent_fee',
        transactionId: 'seed_import_rent_fee_2026_07_01',
        original: 'STANDING ORDER LANDLORD 878.00',
        interpretation: 'Rent amount changed by \u00a33',
        amountMinor: -300,
        date: date('2026-07-01'),
        authorityState: 'estimated',
        reviewState: 'needs-review',
        userConfirmationState: 'requested',
        parserIssues: ['amount changed'],
        status: 'Needs review',
        provenanceHash: 'seed-rent-fee-review',
        searchText: 'STANDING ORDER LANDLORD 878.00 rent variance',
        reasons: ['amount changed'],
      },
    ],
    history: [
      {
        id: 'history_seed',
        kind: 'import_staged',
        createdAt: parsedAt,
        label: 'Private example loaded locally.',
      },
    ],
    lastImportSummary: {
      parsedRows: 6,
      readyForAcceptance: 4,
      needsUserReview: 2,
      parseIssues: 0,
      parserName: 'local example parser',
      skippedRows: 0,
    },
    pots: [],
    subscriptions: [],
    cycles: [],
    subOverrides: {},
    calendarEvents: [],
  };
}

export function createEmptyLocalLedgerState(asOfDate = seedAsOfDate): LocalLedgerState {
  return {
    asOfDate,
    cashOnHandMinor: 0,
    currency: 'GBP',
    tightPointGoalMinor: null,
    documentStages: [],
    history: [],
    importDrafts: [],
    importIssueCount: 0,
    rejectedImports: [],
    transactions: [],
    pots: [],
    subscriptions: [],
    cycles: [],
    subOverrides: {},
    calendarEvents: [],
  };
}

export function createQuickEstimateLocalLedgerState(
  asOfDate: string,
  input: QuickEstimateInput,
): LocalLedgerState {
  const cashOnHandMinor = Math.abs(parseSterlingAmount(input.cashNowText));
  const incomeAmountMinor = Math.abs(parseSterlingAmount(input.incomeAmountText));
  const billAmountMinor = Math.abs(parseSterlingAmount(input.billAmountText));
  const incomeDate = parseIsoDateInput(input.incomeDate, addIsoDays(asOfDate, 7));
  const billDate = parseIsoDateInput(input.billDate, addIsoDays(asOfDate, 1));
  const incomeTitle = cleanTitle(input.incomeTitle, 'Next income');
  const billTitle = cleanTitle(input.billTitle, 'Next obligation');

  return {
    asOfDate,
    cashOnHandMinor,
    currency: 'GBP',
    tightPointGoalMinor: null,
    documentStages: [],
    rejectedImports: [],
    history: [
      {
        id: 'history_quick_estimate',
        kind: 'manual_added',
        createdAt: parsedAtForDate(asOfDate),
        label: 'Quick estimate saved locally. Route rebuilt.',
      },
    ],
    importDrafts: [],
    importIssueCount: 0,
    transactions: [
      {
        id: 'quick_estimate_income_1',
        title: incomeTitle,
        amountMinor: incomeAmountMinor,
        date: incomeDate,
        source: 'manual',
        status: 'confirmed',
        protected: false,
        original: `${incomeTitle} ${formatMinorAmount(incomeAmountMinor)}`,
        certainty: input.incomeCertainty ?? (incomeDate > asOfDate ? 'expected' : 'confirmed'),
        ...(input.incomeRepeats === undefined || input.incomeRepeats === 'none'
          ? {}
          : { repeats: input.incomeRepeats }),
      },
      {
        id: 'quick_estimate_bill_1',
        title: billTitle,
        amountMinor: -billAmountMinor,
        date: billDate,
        source: 'manual',
        status: 'confirmed',
        protected: true,
        original: `${billTitle} ${formatMinorAmount(-billAmountMinor)}`,
      },
    ],
    pots: [],
    subscriptions: [],
    cycles: [],
    subOverrides: {},
    calendarEvents: [],
  };
}

export function refreshLocalLedgerAsOfDate(
  state: LocalLedgerState,
  asOfDate: string,
): LocalLedgerState {
  if (state.asOfDate === asOfDate) return state;
  if (isUnmodifiedSeedExample(state)) return createInitialLocalLedgerState(asOfDate);
  return syncImportSummaryWithQueue({
    ...state,
    asOfDate,
  });
}

// A recorded fact is something that has already happened, so it can never be dated after today.
// Saved transactions — and import drafts, which the canonical snapshot projects into transactions —
// can drift past `asOfDate` once the device clock advances. Drop those rows. Without this, the
// strict canonical validation treats them as a "future fact" and throws while rendering, which
// would crash the app on launch.
export function dropFutureDatedRecords(
  state: LocalLedgerState,
  asOfDate: string,
): LocalLedgerState {
  const transactions = state.transactions.filter((transaction) => transaction.date <= asOfDate);
  const importDrafts = state.importDrafts.filter((draft) => draft.date <= asOfDate);
  if (
    transactions.length === state.transactions.length &&
    importDrafts.length === state.importDrafts.length
  ) {
    return state;
  }
  return { ...state, importDrafts, transactions };
}

export function isPrivateExampleLedger(state: LocalLedgerState): boolean {
  return (
    state.documentStages.length === 0 &&
    state.rejectedImports.length === 0 &&
    state.transactions.length > 0 &&
    state.transactions.every((transaction) => transaction.id.startsWith('seed_')) &&
    state.importDrafts.every((draft) => draft.rowId.startsWith('seed_'))
  );
}

// How far past today the route projects recurring income and bills. A recurring transaction is
// stored once (its first occurrence), so without expansion the projected balance silently stops
// including a salary or rent after that single dated point — the tightest point past the first
// payday was wrong. 95 days covers three monthly cycles (and ~13 weekly cycles), i.e. more than one
// full cycle beyond the next payday, which is what the route needs to find the real tightest point.
// Exported so the Calendar engine (calendarEvents.ts) derives payday/bills over the SAME horizon and
// the SAME recurrence expansion the Route uses — the two pictures must agree to the day.
export const RECURRENCE_HORIZON_DAYS = 95;

const REPEAT_TO_RRULE: Readonly<Record<Exclude<LocalCommitmentRepeat, 'none'>, string>> = {
  weekly: 'FREQ=WEEKLY;INTERVAL=1',
  monthly: 'FREQ=MONTHLY;INTERVAL=1',
};

// Expand each recurring transaction into the future occurrences it implies, out to the route
// horizon. The transaction the user/onboarding stored carries only its FIRST dated occurrence plus a
// `repeats` cadence; the route is built purely from dated transactions, so the later occurrences have
// to be materialised here or they never reach the projected balance or the tightest-point search.
//
// The original transaction is left untouched (it is the first occurrence). For each later occurrence
// strictly after the original date and on/before the horizon, a synthetic confirmed transaction is
// produced with the same integer-minor amount, so no occurrence is double-counted. Synthetic
// occurrences are non-protected projections (an expected future event, not a reserved-today bill) so
// they move the running balance on their own date rather than being pulled forward to today.
export function expandRecurringTransactions(
  transactions: readonly LocalLedgerTransaction[],
  asOfDate: string,
): readonly LocalLedgerTransaction[] {
  const horizonDate = addIsoDays(asOfDate, RECURRENCE_HORIZON_DAYS);
  const expanded: LocalLedgerTransaction[] = [];

  for (const transaction of transactions) {
    expanded.push(transaction);
    const repeat = transaction.repeats;
    if (repeat === undefined || repeat === 'none') continue;
    if (transaction.date > horizonDate) continue;

    const occurrences = expandBoundedRecurrence({
      dtstart: `${transaction.date}T12:00:00`,
      timeZone: 'UTC',
      rrule: REPEAT_TO_RRULE[repeat],
      windowEnd: horizonDate,
    });

    let occurrenceIndex = 0;
    for (const occurrence of occurrences) {
      const occurrenceDate = occurrence.local.slice(0, 10);
      // Skip the first occurrence (the original transaction already represents it) and anything
      // past the horizon. expandBoundedRecurrence already bounds the window, but the date-only slice
      // is the authoritative comparison the rest of the route uses.
      if (occurrenceDate <= transaction.date) continue;
      if (occurrenceDate > horizonDate) break;
      occurrenceIndex += 1;
      expanded.push({
        ...transaction,
        id: `${transaction.id}__r${occurrenceIndex}`,
        date: occurrenceDate,
        // Later occurrences are projected expectations, not money reserved today. Keeping them
        // unprotected means each shows as a dated move on the route instead of collapsing into the
        // "set aside for bills" amount pulled to today.
        protected: false,
        certainty: transaction.amountMinor > 0 ? 'expected' : (transaction.certainty ?? 'expected'),
      });
    }
  }

  return expanded;
}

export function buildLocalRouteSummary(state: LocalLedgerState): LocalRouteSummary {
  const confirmedTransactions = expandRecurringTransactions(
    localAnalyticsTransactions(
      state.transactions.filter((transaction) => transaction.status === 'confirmed'),
    ),
    state.asOfDate,
  );
  const forecast = buildLocalFinanceForecast(state, confirmedTransactions);
  const openingBalanceMinor = latestForecastClosingOnOrBefore(
    forecast.points,
    state.asOfDate,
    state.cashOnHandMinor,
  );
  const dueThroughToday = openingBalanceMinor - state.cashOnHandMinor;
  const protectedFutureOutflows = confirmedTransactions
    .filter(
      (transaction) =>
        transaction.date > state.asOfDate && transaction.protected && transaction.amountMinor < 0,
    )
    .reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
  const availableNowMinor = state.cashOnHandMinor + dueThroughToday - protectedFutureOutflows;
  const timeline = buildTimeline(state);
  const points = buildRoutePoints({
    availableNowMinor,
    asOfDate: state.asOfDate,
    openingBalanceMinor,
    protectedFutureOutflows,
    transactions: confirmedTransactions,
  });
  const futureBalance = tightestPointFromRoute(points);
  const pendingReviewCount =
    state.importDrafts.length +
    state.transactions.filter((transaction) => transaction.status === 'needs_review').length;

  return {
    availableNowMinor,
    tightestDay: futureBalance.day,
    tightestBalanceMinor: futureBalance.balanceMinor,
    pendingReviewCount,
    protectedItems: protectedItemLabels(confirmedTransactions),
    nextPaydayLabel: nextPaydayLabel(confirmedTransactions, state.asOfDate),
    timeline,
    points,
    // Count the records the user actually stored, not the projected future occurrences expansion
    // adds — this is user-facing ("X added", "X confirmed records"), so it must stay honest about
    // what is really saved on the device.
    confirmedTransactionCount: state.transactions.filter(
      (transaction) =>
        transaction.status === 'confirmed' && isLocalCashEffectiveTransaction(transaction),
    ).length,
    lastActionLabel: state.history[0]?.label ?? 'Local route ready.',
  };
}

function buildLocalFinanceForecast(
  state: LocalLedgerState,
  transactions: readonly LocalLedgerTransaction[],
) {
  return buildForecast({
    asOf: state.asOfDate,
    mode: 'expected',
    accounts: {
      local: { minorUnits: state.cashOnHandMinor, currency: state.currency },
    },
    occurrences: transactions.map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      amountMinor: transaction.amountMinor,
      account: 'local',
      currency: state.currency,
      status: 'posted' as const,
      certainty: transaction.source === 'seed' ? 'confirmed' : 'user-confirmed',
      protected: transaction.protected,
      reference: transaction.original ?? transaction.title,
    })),
    baseCurrency: state.currency,
  });
}

function latestForecastClosingOnOrBefore(
  points: ReturnType<typeof buildForecast>['points'],
  asOfDate: string,
  fallbackMinor: number,
): number {
  const latest = [...points].filter((point) => point.date <= asOfDate).at(-1);
  return latest?.closingMinor ?? fallbackMinor;
}

export function buildMeloSnapshotFromLocalState(
  state: LocalLedgerState,
  route: LocalRouteSummary = buildLocalRouteSummary(state),
): MeloLocalFinancialSnapshot {
  const activeSubscriptions = state.subscriptions.filter((subscription) => !subscription.paused);
  const monthlySubscriptionMinor = (subscription: Subscription): number => {
    if (subscription.cadence === 'weekly') {
      return Math.round((subscription.cost.minorUnits * 52) / 12);
    }
    if (subscription.cadence === 'yearly') {
      return Math.round(subscription.cost.minorUnits / 12);
    }
    return subscription.cost.minorUnits;
  };
  return {
    currency: state.currency,
    availableNowMinor: route.availableNowMinor,
    tightestDay: route.tightestDay,
    tightestBalanceMinor: route.tightestBalanceMinor,
    protectedItems: route.protectedItems,
    pendingReviewCount: route.pendingReviewCount,
    nextPaydayLabel: route.nextPaydayLabel,
    hasMoneyPicture: true,
    subscriptionCount: activeSubscriptions.length,
    activeSubscriptionMonthlyMinor: activeSubscriptions.reduce(
      (total, subscription) => total + monthlySubscriptionMinor(subscription),
      0,
    ),
  };
}

export function searchLocalLedgerRecords(
  state: LocalLedgerState,
  route: LocalRouteSummary = buildLocalRouteSummary(state),
  query = '',
  limit = 12,
): readonly LocalSearchRecord[] {
  const normalizedQuery = normalizeSearchQuery(query);
  const records: LocalSearchRecord[] = [
    ...state.transactions.map<LocalSearchRecord>((transaction) => ({
      id: `transaction-${transaction.id}`,
      title: transaction.title,
      detail: `${transactionSourceLabel(transaction.source)} - ${transaction.status.replace(
        '_',
        ' ',
      )} - ${localLifecycleDetail(transaction)}`,
      meta: transaction.original ?? transaction.date,
      amountMinor: transaction.amountMinor,
      tone:
        transaction.status === 'needs_review' || !isLocalCashEffectiveTransaction(transaction)
          ? 'attention'
          : 'confirmed',
    })),
    ...route.points.map<LocalSearchRecord>((point, index) => ({
      id: `route-${index}-${point.date}-${point.title}`,
      title: point.title,
      detail: routePointSearchDetail(point),
      meta: `${point.label} - ${point.date} - ${point.sourceLabel} - ${point.reviewState}`,
      amountMinor: point.balanceMinor,
      tone: point.tone,
    })),
    ...state.importDrafts.map<LocalSearchRecord>((draft) => ({
      id: `draft-${draft.rowId}`,
      title: draft.interpretation,
      detail: `${draft.status} - ${draft.authorityState.replace(/-/g, ' ')}`,
      meta: draft.original,
      amountMinor: draft.amountMinor,
      tone: 'attention' as const,
    })),
    ...state.documentStages.map<LocalSearchRecord>((document) => ({
      id: `document-${document.id}`,
      title: document.filename,
      detail: `${document.mediaType} - ${document.byteSize} bytes`,
      meta:
        document.storageState === 'pasted_text' ? 'Pasted statement text' : 'Chosen statement file',
      tone: 'confirmed' as const,
    })),
    ...state.history.map<LocalSearchRecord>((entry) => ({
      id: `history-${entry.id}`,
      title: entry.label,
      detail: entry.kind.replace(/_/g, ' '),
      meta: entry.createdAt,
      tone: 'confirmed' as const,
    })),
  ];

  return records
    .filter((record) => searchRecordMatches(record, normalizedQuery))
    .slice(0, Math.max(1, limit));
}

export function searchLocalLedgerEvidenceRecords(
  state: LocalLedgerState,
  route: LocalRouteSummary = buildLocalRouteSummary(state),
  query = '',
  limit = 12,
): readonly LocalSearchRecord[] {
  const normalizedQuery = normalizeSearchQuery(query);
  const rejectedEvidence = state.rejectedImports.map<LocalSearchRecord>((rejected) => ({
    id: `rejected-import-${rejected.rowId}`,
    title: rejected.interpretation,
    detail: `${rejected.status} import evidence - ${rejected.rejectionReason.replace(/-/g, ' ')}`,
    meta: `${rejected.original} ${rejected.rejectedAt}`,
    amountMinor: rejected.amountMinor,
    tone: 'attention' as const,
  }));
  const history = state.history.map<LocalSearchRecord>((entry) => ({
    id: `evidence-history-${entry.id}`,
    title: entry.label,
    detail: entry.kind.replace(/_/g, ' '),
    meta: entry.createdAt,
    tone: 'confirmed' as const,
  }));

  return [...rejectedEvidence, ...history, ...searchLocalLedgerRecords(state, route, query, limit)]
    .filter((record) => searchRecordMatches(record, normalizedQuery))
    .slice(0, Math.max(1, limit));
}

export function buildMeloLocalEvidenceRecords(
  state: LocalLedgerState,
  route: LocalRouteSummary = buildLocalRouteSummary(state),
  prompt = '',
  limit = 4,
): readonly LocalSearchRecord[] {
  const directMatches = searchLocalLedgerRecords(state, route, prompt, limit);
  if (prompt.trim().length > 0 && directMatches.length > 0) return directMatches;

  const currentRouteRecords = route.points.slice(0, 2).map<LocalSearchRecord>((point, index) => ({
    id: `melo-route-${index}-${point.date}-${point.title}`,
    title: point.title,
    detail: routePointSearchDetail(point),
    meta: `${point.label} - ${point.date} - ${point.sourceLabel} - ${point.reviewState}`,
    amountMinor: point.balanceMinor,
    tone: point.tone,
  }));
  const reviewRecords = state.importDrafts.slice(0, 1).map<LocalSearchRecord>((draft) => ({
    id: `melo-draft-${draft.rowId}`,
    title: draft.interpretation,
    detail: `${draft.status} - original wording attached`,
    meta: draft.original,
    amountMinor: draft.amountMinor,
    tone: 'attention' as const,
  }));
  const transactionRecords = state.transactions
    .filter((transaction) => transaction.status === 'confirmed')
    .slice(0, Math.max(0, limit - currentRouteRecords.length - reviewRecords.length))
    .map<LocalSearchRecord>((transaction) => ({
      id: `melo-transaction-${transaction.id}`,
      title: transaction.title,
      detail: `${transactionSourceLabel(transaction.source)} - ${localLifecycleDetail(transaction)}`,
      meta: transaction.original ?? transaction.date,
      amountMinor: transaction.amountMinor,
      tone: isLocalCashEffectiveTransaction(transaction)
        ? ('confirmed' as const)
        : ('attention' as const),
    }));

  return [...currentRouteRecords, ...reviewRecords, ...transactionRecords].slice(
    0,
    Math.max(1, limit),
  );
}

export function buildMeloLocalRecordLookup(
  state: LocalLedgerState,
  route: LocalRouteSummary = buildLocalRouteSummary(state),
  prompt = '',
  limit = 4,
): MeloLocalRecordLookup | null {
  const normalizedPrompt = normalizeSearchQuery(prompt);
  if (!shouldAnswerAsRecordLookup(normalizedPrompt)) return null;

  const directMatches = searchLocalLedgerRecords(
    state,
    route,
    normalizedPrompt,
    Math.max(limit * 2, 8),
  );
  const ledgerMatches = directMatches.filter(isConcreteLedgerRecord);
  const records = (ledgerMatches.length > 0 ? ledgerMatches : directMatches).slice(
    0,
    Math.max(1, limit),
  );
  if (records.length === 0) return null;

  const first = records[0];
  if (first === undefined) return null;
  const amountText =
    first.amountMinor === undefined ? '' : ` as ${formatMinorAmount(first.amountMinor)}`;
  const answer =
    records.length === 1
      ? `I found ${first.title} in the local records${amountText}. Source wording: ${first.meta}. State: ${first.detail}.`
      : `I found ${records.length} local records for "${prompt.trim()}": ${records
          .slice(0, 3)
          .map(recordLookupSummary)
          .join('; ')}.`;

  return {
    answer,
    financialConclusion: `${first.title} is already included locally${amountText}; the route remains ${formatMinorAmount(
      route.availableNowMinor,
    )} available now.`,
    dataUsed: [
      `${records.length} direct local record match${records.length === 1 ? '' : 'es'}`,
      `${formatMinorAmount(route.availableNowMinor)} available now`,
      `${route.tightestDay} tightest point at ${formatMinorAmount(route.tightestBalanceMinor)}`,
      'No cloud model or remote search used',
    ],
    guardrails: [
      'Melo answered from local records on this device.',
      'Nothing changes until you choose a review or save action.',
    ],
    records,
  };
}

export function buildLocalLedgerExportPayload(
  state: LocalLedgerState,
  route: LocalRouteSummary = buildLocalRouteSummary(state),
): LocalLedgerExportPayload {
  return {
    schema: 'folio-local-export-v1',
    exportedAt: parsedAtForDate(state.asOfDate),
    asOfDate: state.asOfDate,
    currency: state.currency,
    summary: {
      availableNowMinor: route.availableNowMinor,
      tightestBalanceMinor: route.tightestBalanceMinor,
      tightestDay: route.tightestDay,
      pendingReviewCount: route.pendingReviewCount,
      confirmedTransactionCount: route.confirmedTransactionCount,
    },
    transactions: state.transactions.map((transaction) => {
      const exported = {
        id: transaction.id,
        title: transaction.title,
        amountMinor: transaction.amountMinor,
        date: transaction.date,
        source: transaction.source,
        status: transaction.status,
        protected: transaction.protected,
      };
      return transaction.original === undefined
        ? exported
        : { ...exported, original: transaction.original };
    }),
    importDrafts: state.importDrafts.map((draft) => ({
      rowId: draft.rowId,
      interpretation: draft.interpretation,
      original: draft.original,
      amountMinor: draft.amountMinor,
      date: draft.date,
      authorityState: draft.authorityState,
      reviewState: draft.reviewState,
      userConfirmationState: draft.userConfirmationState,
      parserIssues: draft.parserIssues,
      status: draft.status,
      reasons: draft.reasons,
    })),
    rejectedImports: state.rejectedImports.map((rejected) => ({
      rowId: rejected.rowId,
      interpretation: rejected.interpretation,
      original: rejected.original,
      amountMinor: rejected.amountMinor,
      date: rejected.date,
      rejectionReason: rejected.rejectionReason,
      rejectedAt: rejected.rejectedAt,
      status: rejected.status,
      reasons: rejected.reasons,
    })),
    documentStages: state.documentStages.map((document) => ({
      id: document.id,
      filename: document.filename,
      mediaType: document.mediaType,
      byteSize: document.byteSize,
      stagedAt: document.stagedAt,
      storageState: document.storageState,
    })),
    history: state.history,
  };
}

export function addManualTransaction(
  state: LocalLedgerState,
  input: ManualTransactionInput,
): LocalLedgerState {
  const absoluteAmountMinor = Math.abs(parseSterlingAmount(input.amountText));
  const signedAmountMinor = input.kind === 'income' ? absoluteAmountMinor : -absoluteAmountMinor;
  const title = cleanTitle(input.title, input.kind === 'income' ? 'Manual income' : 'Manual spend');
  const transaction: LocalLedgerTransaction = {
    id: localId('manual', state.history.length + state.transactions.length),
    title,
    amountMinor: signedAmountMinor,
    date: state.asOfDate,
    source: 'manual',
    status: 'confirmed',
    protected: input.protected ?? false,
    original: `${title} ${formatMinorAmount(signedAmountMinor)}`,
  };

  return prependHistory(
    {
      ...state,
      transactions: [transaction, ...state.transactions],
    },
    'manual_added',
    `${title} added locally. Route rebuilt from confirmed records.`,
  );
}

export function addRecoverySpend(
  state: LocalLedgerState,
  input: ManualTransactionInput,
): LocalLedgerState {
  const absoluteAmountMinor = Math.abs(parseSterlingAmount(input.amountText));
  const title = cleanTitle(input.title, 'Recovery spend');
  const transaction: LocalLedgerTransaction = {
    id: localId('recovery', state.history.length + state.transactions.length),
    title,
    amountMinor: -absoluteAmountMinor,
    date: state.asOfDate,
    source: 'manual',
    status: 'confirmed',
    protected: input.protected ?? false,
    original: `${title} ${formatMinorAmount(-absoluteAmountMinor)}`,
  };

  return prependHistory(
    {
      ...state,
      transactions: [transaction, ...state.transactions],
    },
    'recovery_recorded',
    `${title} recorded from recovery preview. Route rebuilt from confirmed records.`,
  );
}

export function addPlannedCommitment(
  state: LocalLedgerState,
  input: LocalPlannedCommitmentInput,
): LocalLedgerState {
  const absoluteAmountMinor = Math.abs(parseSterlingAmount(input.amountText));
  if (absoluteAmountMinor <= 0) throw new Error('Amount must be more than zero.');
  const date = parseRequiredIsoDateInput(input.date);
  const title = cleanTitle(input.title, 'Planned commitment');
  const transaction: LocalLedgerTransaction = {
    id: localId('planned', state.history.length + state.transactions.length),
    title,
    amountMinor: -absoluteAmountMinor,
    date,
    source: 'manual',
    status: 'confirmed',
    protected: input.protected ?? true,
    original: `${title} ${formatMinorAmount(-absoluteAmountMinor)} due ${date}`,
    ...(input.status === undefined ? {} : { commitmentStatus: input.status }),
    ...(input.pressure === undefined ? {} : { commitmentPressure: input.pressure }),
    ...(input.repeats === undefined || input.repeats === 'none' ? {} : { repeats: input.repeats }),
  };

  return prependHistory(
    {
      ...state,
      transactions: [transaction, ...state.transactions],
    },
    'planner_added',
    `${title} planned for ${date}. Route rebuilt from confirmed records.`,
  );
}

// Remove a single confirmed transaction the user logged — the undo for a mis-logged spend. It is an
// immutable filter: the transaction with the matching id is dropped and the path is rebuilt from
// what is left. No-ops cleanly if the id isn't present (e.g. it was already removed).
export function removeTransaction(
  state: LocalLedgerState,
  transactionId: string,
): LocalLedgerState {
  const target = state.transactions.find((transaction) => transaction.id === transactionId);
  if (target === undefined) return state;
  return prependHistory(
    {
      ...state,
      transactions: state.transactions.filter((transaction) => transaction.id !== transactionId),
    },
    'manual_added',
    `${target.title} removed. Route rebuilt from what's left.`,
  );
}

// Set (or clear) the user's tight-point goal — the floor they want their tightest balance to stay
// above. A whole minor-unit amount of zero or more sets the floor; null clears it. Negative or
// non-integer inputs are rejected (a floor below zero is meaningless). It is a scalar on the
// canonical metadata, so this is a plain immutable field update — no containers touched.
export function setTightPointGoal(
  state: LocalLedgerState,
  minorOrNull: number | null,
): LocalLedgerState {
  if (minorOrNull === null) {
    if (state.tightPointGoalMinor === null) return state;
    return prependHistory(
      { ...state, tightPointGoalMinor: null },
      'tight_point_goal_set',
      'Tight-point goal cleared.',
    );
  }
  const goalMinor = assertNonNegativeSafeMinor(minorOrNull, 'Tight-point goal');
  if (state.tightPointGoalMinor === goalMinor) return state;
  return prependHistory(
    { ...state, tightPointGoalMinor: goalMinor },
    'tight_point_goal_set',
    `Tight-point goal set to ${formatMinorAmount(goalMinor)}.`,
  );
}

// Update the cash the user actually has on hand right now — the "what I have today" figure first
// captured in the quick estimate. Until now that figure could only be changed by re-running the
// whole estimate, leaving a dead end. This is the same plain scalar update as the tight-point goal
// (cashOnHandMinor lives on the canonical metadata, not a durable container), so it is a single
// immutable field replacement that REBUILDS the path without touching history: every logged spend,
// planned obligation and pot stays exactly as it was. A whole minor-unit amount of zero or more is
// accepted; negative or non-integer inputs are rejected (a cash figure below zero is meaningless).
export function setCashOnHand(state: LocalLedgerState, minor: number): LocalLedgerState {
  const cashMinor = assertNonNegativeSafeMinor(minor, 'Money you have now');
  if (state.cashOnHandMinor === cashMinor) return state;
  return prependHistory(
    { ...state, cashOnHandMinor: cashMinor },
    'cash_on_hand_set',
    `Money you have now updated to ${formatMinorAmount(cashMinor)}. Path rebuilt from your records.`,
  );
}

// Pots, Subscriptions and Cycles are durable containers/history that share the local workspace
// identity used by the canonical projection, so their entities reference the same workspace id.
const localWorkspaceId = createWorkspaceId('workspace_personal_local');

function localGbp(minorUnits: number): Money {
  return createMoney({ minorUnits, currency: 'GBP' });
}

function assertNonNegativeSafeMinor(minorUnits: number, label: string): number {
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
    throw new Error(`${label} must be a whole amount of zero or more.`);
  }
  return minorUnits;
}

// ---------------------------------------------------------------------------------------------
// Pots
// ---------------------------------------------------------------------------------------------

export function createPot(state: LocalLedgerState, input: CreatePotInput): LocalLedgerState {
  const name = cleanTitle(input.name, 'Pot');
  const goalMinor = assertNonNegativeSafeMinor(Math.abs(input.goalMinor), 'Pot goal');
  const perWeekMinor = assertNonNegativeSafeMinor(
    Math.abs(input.perWeekMinor),
    'Pot weekly amount',
  );
  const index = state.pots.length;
  const pot: Pot = {
    id: createPotId(localId('pot', index)),
    workspaceId: localWorkspaceId,
    name,
    goal: localGbp(goalMinor),
    saved: localGbp(0),
    perWeek: localGbp(perWeekMinor),
    accent: input.accent ?? false,
    version: createEntityVersion(),
  };

  return prependHistory(
    { ...state, pots: [pot, ...state.pots] },
    'pot_created',
    `${name} pot created. Goal ${formatMinorAmount(goalMinor)}.`,
  );
}

export function addToPot(
  state: LocalLedgerState,
  potId: string,
  amountMinor: number,
): LocalLedgerState {
  const moveMinor = assertNonNegativeSafeMinor(Math.abs(amountMinor), 'Pot top-up');
  if (moveMinor <= 0) throw new Error('Top-up must be more than zero.');
  const target = state.pots.find((pot) => String(pot.id) === potId);
  if (target === undefined) throw new Error('That pot does not exist.');

  const nextPots = state.pots.map((pot) =>
    String(pot.id) === potId ? { ...pot, saved: localGbp(pot.saved.minorUnits + moveMinor) } : pot,
  );

  return prependHistory(
    { ...state, pots: nextPots },
    'pot_funded',
    `${formatMinorAmount(moveMinor)} added to ${target.name}.`,
  );
}

export function reallocateBetweenPots(
  state: LocalLedgerState,
  fromPotId: string,
  toPotId: string,
  amountMinor: number,
): LocalLedgerState {
  if (fromPotId === toPotId) throw new Error('Choose two different pots to move money between.');
  const moveMinor = assertNonNegativeSafeMinor(Math.abs(amountMinor), 'Pot transfer');
  if (moveMinor <= 0) throw new Error('Transfer must be more than zero.');
  const fromPot = state.pots.find((pot) => String(pot.id) === fromPotId);
  const toPot = state.pots.find((pot) => String(pot.id) === toPotId);
  if (fromPot === undefined || toPot === undefined) throw new Error('Both pots must exist.');
  if (fromPot.saved.minorUnits < moveMinor) {
    throw new Error(`${fromPot.name} only holds ${formatMinorAmount(fromPot.saved.minorUnits)}.`);
  }

  const nextPots = state.pots.map((pot) => {
    if (String(pot.id) === fromPotId) {
      return { ...pot, saved: localGbp(pot.saved.minorUnits - moveMinor) };
    }
    if (String(pot.id) === toPotId) {
      return { ...pot, saved: localGbp(pot.saved.minorUnits + moveMinor) };
    }
    return pot;
  });

  return prependHistory(
    { ...state, pots: nextPots },
    'pot_reallocated',
    `${formatMinorAmount(moveMinor)} moved from ${fromPot.name} to ${toPot.name}.`,
  );
}

// ---------------------------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------------------------

function findSubscription(state: LocalLedgerState, subscriptionId: string): Subscription {
  const target = state.subscriptions.find((item) => String(item.id) === subscriptionId);
  if (target === undefined) throw new Error('That subscription does not exist.');
  return target;
}

function updateSubscription(
  state: LocalLedgerState,
  subscriptionId: string,
  change: (subscription: Subscription) => Subscription,
): readonly Subscription[] {
  return state.subscriptions.map((item) =>
    String(item.id) === subscriptionId ? change(item) : item,
  );
}

// Days in one cadence period — used to default the next-charge day when the user doesn't set one.
const CADENCE_PERIOD_DAYS: Readonly<Record<SubscriptionCadence, number>> = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

export function createSubscription(
  state: LocalLedgerState,
  input: CreateSubscriptionInput,
): LocalLedgerState {
  const name = cleanTitle(input.name, 'Subscription');
  const costMinor = assertNonNegativeSafeMinor(Math.abs(input.costMinor), 'Subscription cost');
  if (costMinor <= 0) throw new Error('A subscription needs a cost of more than zero.');
  const periodDays = CADENCE_PERIOD_DAYS[input.cadence];
  const nextRenewalDaysAway = Math.max(0, Math.round(input.nextChargeInDays ?? periodDays));
  const index = state.subscriptions.length;
  const subscription: Subscription = {
    id: createSubscriptionId(localId('subscription', index)),
    workspaceId: localWorkspaceId,
    name,
    cost: localGbp(costMinor),
    cadence: input.cadence,
    nextRenewalDaysAway,
    // A brand-new subscription has no usage history yet: treat it as just added (used today, no uses
    // counted this month). It starts active.
    lastUsedDaysAgo: 0,
    usesPerMonth: 0,
    paused: false,
    version: createEntityVersion(),
  };

  return prependHistory(
    { ...state, subscriptions: [subscription, ...state.subscriptions] },
    'subscription_created',
    `${name} added. ${formatMinorAmount(costMinor)} every ${input.cadence === 'weekly' ? 'week' : input.cadence === 'yearly' ? 'year' : 'month'}.`,
  );
}

export function pauseSubscription(
  state: LocalLedgerState,
  subscriptionId: string,
): LocalLedgerState {
  const target = findSubscription(state, subscriptionId);
  const nextSubscriptions = updateSubscription(state, subscriptionId, (item) => ({
    ...item,
    paused: true,
  }));

  return prependHistory(
    { ...state, subscriptions: nextSubscriptions },
    'subscription_paused',
    `${target.name} paused.`,
  );
}

export function resumeSubscription(
  state: LocalLedgerState,
  subscriptionId: string,
): LocalLedgerState {
  const target = findSubscription(state, subscriptionId);
  const nextSubscriptions = updateSubscription(state, subscriptionId, (item) => ({
    ...item,
    paused: false,
  }));

  return prependHistory(
    { ...state, subscriptions: nextSubscriptions },
    'subscription_resumed',
    `${target.name} resumed.`,
  );
}

export function recordSubscriptionUse(
  state: LocalLedgerState,
  subscriptionId: string,
): LocalLedgerState {
  const target = findSubscription(state, subscriptionId);
  const nextSubscriptions = updateSubscription(state, subscriptionId, (item) => ({
    ...item,
    lastUsedDaysAgo: 0,
    usesPerMonth: item.usesPerMonth + 1,
  }));

  return prependHistory(
    { ...state, subscriptions: nextSubscriptions },
    'subscription_used',
    `${target.name} marked as used.`,
  );
}

export function cancelSubscription(
  state: LocalLedgerState,
  subscriptionId: string,
): LocalLedgerState {
  const target = findSubscription(state, subscriptionId);
  const nextSubscriptions = state.subscriptions.filter(
    (item) => String(item.id) !== subscriptionId,
  );

  return prependHistory(
    { ...state, subscriptions: nextSubscriptions },
    'subscription_cancelled',
    `${target.name} cancelled.`,
  );
}

// A subscription is "quiet" when the user is getting little or no use from it: it has gone unused
// for a while AND is averaging under one use a month. bulkPauseQuiet pauses every quiet, still-active
// subscription in one move so the user can stop the silent drain without reviewing each one.
const QUIET_SUBSCRIPTION_UNUSED_DAYS = 30;
const QUIET_SUBSCRIPTION_MAX_USES_PER_MONTH = 1;

export function isQuietSubscription(subscription: Subscription): boolean {
  return (
    subscription.lastUsedDaysAgo >= QUIET_SUBSCRIPTION_UNUSED_DAYS &&
    subscription.usesPerMonth < QUIET_SUBSCRIPTION_MAX_USES_PER_MONTH
  );
}

export function bulkPauseQuiet(state: LocalLedgerState): LocalLedgerState {
  const quietActive = state.subscriptions.filter(
    (item) => !item.paused && isQuietSubscription(item),
  );
  if (quietActive.length === 0) {
    return prependHistory(state, 'subscription_bulk_paused', 'No quiet subscriptions to pause.');
  }

  const nextSubscriptions = state.subscriptions.map((item) =>
    !item.paused && isQuietSubscription(item) ? { ...item, paused: true } : item,
  );

  return prependHistory(
    { ...state, subscriptions: nextSubscriptions },
    'subscription_bulk_paused',
    `${quietActive.length} quiet subscription${quietActive.length === 1 ? '' : 's'} paused.`,
  );
}

// ---------------------------------------------------------------------------------------------
// Cycles (closed-cycle history)
// ---------------------------------------------------------------------------------------------

export function addCycle(state: LocalLedgerState, input: CreateCycleRecordInput): LocalLedgerState {
  const label = cleanTitle(input.label, 'Closed cycle');
  const spareMinor = assertNonNegativeSafeMinor(Math.abs(input.spareMinor), 'Cycle spare');
  const tightPointMinor = assertNonNegativeSafeMinor(
    Math.abs(input.tightPointMinor),
    'Cycle tight point',
  );
  const setAsideMinor = assertNonNegativeSafeMinor(
    Math.abs(input.setAsideMinor),
    'Cycle set aside',
  );
  const closedAt = createInstantString(input.closedAt ?? `${state.asOfDate}T10:00:00.000Z`);
  const index = state.cycles.length;
  const note = input.note?.trim();
  const record: CycleRecord = {
    id: createCycleRecordId(localId('cycle', index)),
    workspaceId: localWorkspaceId,
    closedAt,
    label,
    spare: localGbp(spareMinor),
    tightPoint: localGbp(tightPointMinor),
    setAside: localGbp(setAsideMinor),
    version: createEntityVersion(),
    ...(note === undefined || note.length === 0 ? {} : { note }),
  };

  return prependHistory(
    { ...state, cycles: [record, ...state.cycles] },
    'cycle_closed',
    `${label} closed with ${formatMinorAmount(spareMinor)} spare.`,
  );
}

// ---------------------------------------------------------------------------------------------
// Subscription renewal nudges + user-added calendar events
// ---------------------------------------------------------------------------------------------

function clampSubOverrideDays(deltaDays: number): number {
  if (!Number.isFinite(deltaDays)) return 0;
  const rounded = Math.round(deltaDays);
  if (rounded > MAX_SUB_OVERRIDE_DAYS) return MAX_SUB_OVERRIDE_DAYS;
  if (rounded < -MAX_SUB_OVERRIDE_DAYS) return -MAX_SUB_OVERRIDE_DAYS;
  return rounded;
}

// Slide a subscription's next renewal by a day delta, keyed by sub NAME (the Calendar offers
// −3d/−1d/+1d/+3d on a sub row). The delta is the ABSOLUTE override, clamped to ±MAX_SUB_OVERRIDE_DAYS
// — not additive — so repeated taps converge instead of drifting past the clamp. A delta that clamps
// to 0 removes the override entirely (back to "no nudge"). The override is applied in
// deriveCalendarEvents when computing the renewal day; the stored Subscription is never mutated.
export function nudgeSub(
  state: LocalLedgerState,
  subName: string,
  deltaDays: number,
): LocalLedgerState {
  const name = subName.trim();
  if (name.length === 0) return state;
  const clamped = clampSubOverrideDays(deltaDays);
  const current = state.subOverrides[name] ?? 0;
  if (clamped === current) return state;

  if (clamped === 0) {
    if (!(name in state.subOverrides)) return state;
    const nextOverrides: Record<string, number> = {};
    for (const key of Object.keys(state.subOverrides)) {
      if (key === name) continue;
      const value = state.subOverrides[key];
      if (value !== undefined) nextOverrides[key] = value;
    }
    return prependHistory(
      { ...state, subOverrides: nextOverrides },
      'sub_nudged',
      `${name} renewal moved back to its usual day.`,
    );
  }

  return prependHistory(
    { ...state, subOverrides: { ...state.subOverrides, [name]: clamped } },
    'sub_nudged',
    `${name} renewal nudged ${clamped > 0 ? '+' : ''}${clamped}d.`,
  );
}

function cleanOptionalNote(note: string | undefined): string | undefined {
  if (note === undefined) return undefined;
  const cleaned = note.trim().replace(/\s+/g, ' ');
  return cleaned.length === 0 ? undefined : cleaned;
}

function assertSafeIntegerMinorOrUndefined(
  amountMinor: number | undefined,
  label: string,
): number | undefined {
  if (amountMinor === undefined) return undefined;
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error(`${label} must be a whole amount in pence.`);
  }
  return amountMinor;
}

// Add one event the user typed into the Calendar. This is reference/planner data — it surfaces on
// the Calendar timeline but is NOT a posted transaction, so it never moves Today's available figure
// on its own. Kept newest-first and capped at MAX_USER_CALENDAR_EVENTS.
export function addCalendarEvent(
  state: LocalLedgerState,
  input: AddUserCalendarEventInput,
): LocalLedgerState {
  const dateIso = parseRequiredIsoDateInput(input.dateIso);
  const title = cleanTitle(input.title, 'Calendar note');
  const amountMinor = assertSafeIntegerMinorOrUndefined(input.amountMinor, 'Calendar amount');
  const note = cleanOptionalNote(input.note);
  const event: UserCalendarEvent = {
    id: input.id ?? localId('calendar_event', state.calendarEvents.length + state.history.length),
    dateIso,
    title,
    kind: input.kind,
    ...(amountMinor === undefined ? {} : { amountMinor }),
    ...(note === undefined ? {} : { note }),
    ...(input.recurring === undefined ? {} : { recurring: input.recurring }),
  };

  return prependHistory(
    {
      ...state,
      calendarEvents: [event, ...state.calendarEvents].slice(0, MAX_USER_CALENDAR_EVENTS),
    },
    'calendar_event_added',
    `${title} added to your calendar for ${dateIso}.`,
  );
}

export function removeCalendarEvent(state: LocalLedgerState, id: string): LocalLedgerState {
  const target = state.calendarEvents.find((event) => event.id === id);
  if (target === undefined) return state;
  return prependHistory(
    {
      ...state,
      calendarEvents: state.calendarEvents.filter((event) => event.id !== id),
    },
    'calendar_event_removed',
    `${target.title} removed from your calendar.`,
  );
}

export type UpdateUserCalendarEventPatch = Readonly<{
  dateIso?: string;
  title?: string;
  kind?: UserCalendarEventKind;
  amountMinor?: number | null;
  note?: string | null;
  recurring?: 'monthly' | 'yearly' | null;
}>;

// Patch a user-added event (a date nudge from the Calendar's −1d/+1d, or an edit). Only provided
// fields change. Passing null for amountMinor / note / recurring CLEARS that optional field; omitting
// it leaves it as-is. No-ops cleanly if the id is unknown.
export function updateCalendarEvent(
  state: LocalLedgerState,
  id: string,
  patch: UpdateUserCalendarEventPatch,
): LocalLedgerState {
  const target = state.calendarEvents.find((event) => event.id === id);
  if (target === undefined) return state;

  const nextDateIso =
    patch.dateIso === undefined ? target.dateIso : parseRequiredIsoDateInput(patch.dateIso);
  const nextTitle =
    patch.title === undefined ? target.title : cleanTitle(patch.title, target.title);
  const nextKind = patch.kind ?? target.kind;

  let nextAmountMinor: number | undefined;
  if (patch.amountMinor === undefined) {
    nextAmountMinor = target.amountMinor;
  } else if (patch.amountMinor === null) {
    nextAmountMinor = undefined;
  } else {
    nextAmountMinor = assertSafeIntegerMinorOrUndefined(patch.amountMinor, 'Calendar amount');
  }

  let nextNote: string | undefined;
  if (patch.note === undefined) {
    nextNote = target.note;
  } else if (patch.note === null) {
    nextNote = undefined;
  } else {
    nextNote = cleanOptionalNote(patch.note);
  }

  let nextRecurring: 'monthly' | 'yearly' | undefined;
  if (patch.recurring === undefined) {
    nextRecurring = target.recurring;
  } else if (patch.recurring === null) {
    nextRecurring = undefined;
  } else {
    nextRecurring = patch.recurring;
  }

  const updated: UserCalendarEvent = {
    id: target.id,
    dateIso: nextDateIso,
    title: nextTitle,
    kind: nextKind,
    ...(nextAmountMinor === undefined ? {} : { amountMinor: nextAmountMinor }),
    ...(nextNote === undefined ? {} : { note: nextNote }),
    ...(nextRecurring === undefined ? {} : { recurring: nextRecurring }),
  };

  return prependHistory(
    {
      ...state,
      calendarEvents: state.calendarEvents.map((event) => (event.id === id ? updated : event)),
    },
    'calendar_event_updated',
    `${updated.title} updated.`,
  );
}

export function stageStatementImport(
  state: LocalLedgerState,
  text: string,
  source?: LocalDocumentStageInput,
): StageStatementImportResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('Statement text is empty.');
  }

  const importNumber = state.history.length + 1;
  const parseResult = parseImportFile({
    importJobId: `local_import_${importNumber}`,
    sourceFileId: `local_statement_${importNumber}`,
    accountId: 'account_local_current',
    currency: state.currency,
    text: trimmed,
    filename: source?.filename ?? 'local-statement.csv',
    dateOrder: 'ymd',
    parsedAt: parsedAtForDate(state.asOfDate),
  });
  const packet = buildImportReviewPacket({ parseResult, maxQuestions: 3 });
  const canonicalRows = new Map(parseResult.rows.map((row) => [row.canonicalRowId, row]));
  const newDrafts = packet.rows.map((row) =>
    localDraftFromImportRow(row, originalTextForRow(canonicalRows.get(row.rowId))),
  );
  const reviewDrafts = newDrafts.map((draft) =>
    markPreviouslyRejectedDraft(draft, findMatchingRejectedImport(state.rejectedImports, draft)),
  );
  const existingRowIds = new Set(state.importDrafts.map((draft) => draft.rowId));
  const existingProvenanceHashes = new Set([
    ...state.importDrafts.map((draft) => draft.provenanceHash),
    ...state.transactions
      .map((transaction) => transaction.provenanceHash)
      .filter((hash): hash is string => hash !== undefined),
  ]);
  const acceptedDrafts = reviewDrafts.filter(
    (draft) =>
      !existingRowIds.has(draft.rowId) &&
      !existingProvenanceHashes.has(draft.provenanceHash) &&
      !state.importDrafts.some((candidate) => hasEquivalentDraft(candidate, draft)) &&
      !hasEquivalentTransaction(state.transactions, {
        id: draft.transactionId,
        title: draft.interpretation,
        amountMinor: draft.amountMinor,
        date: draft.date,
        source: 'import',
        status: 'confirmed',
        protected: isProtectedTitle(draft.interpretation),
        original: draft.original,
        provenanceHash: draft.provenanceHash,
      }),
  );
  const skippedRows = Math.max(0, reviewDrafts.length - acceptedDrafts.length);
  const mergedDrafts = [...acceptedDrafts, ...state.importDrafts];
  const documentStage =
    source === undefined
      ? undefined
      : createLocalDocumentStage({
          source,
          text: trimmed,
          index: state.documentStages.length,
          stagedAt: parsedAtForDate(state.asOfDate),
          extractionStatus: 'text-extracted',
        });
  const nextState = prependHistory(
    {
      ...state,
      importDrafts: mergedDrafts,
      documentStages:
        documentStage === undefined
          ? state.documentStages
          : [documentStage, ...state.documentStages],
      importIssueCount: parseResult.issues.length,
      lastImportSummary: queueAdjustedImportSummary(
        {
          parsedRows: (state.lastImportSummary?.parsedRows ?? 0) + packet.counts.parsedRows,
          readyForAcceptance: packet.counts.readyForAcceptance,
          needsUserReview: packet.counts.needsUserReview,
          parseIssues: (state.lastImportSummary?.parseIssues ?? 0) + packet.counts.parseIssues,
          parserName: packet.parser.name,
          skippedRows: (state.lastImportSummary?.skippedRows ?? 0) + skippedRows,
        },
        mergedDrafts,
        skippedRows,
      ),
    },
    documentStage === undefined ? 'import_staged' : 'document_staged',
    documentStage === undefined
      ? `${packet.counts.parsedRows} found to check. ${packet.counts.needsUserReview} need review.`
      : `${documentStage.filename} added for review. ${packet.counts.parsedRows} found to check.`,
  );

  return {
    state: nextState,
    packet,
    issues: parseResult.issues,
    message:
      documentStage === undefined
        ? `${packet.counts.parsedRows} found to check. Nothing has been added yet. Keep the ones you want.`
        : `${packet.counts.parsedRows} found to check. Nothing has been added yet. Keep the ones you want.`,
    ...(documentStage === undefined ? {} : { documentStage }),
  };
}

// Turn the AI reader's clean, already-structured transactions into waiting review drafts WITHOUT
// re-parsing any text. The reader gave us a date, a merchant, and an exact pence amount with a known
// direction, so we build each LocalImportDraft straight from those fields — the amount the user
// confirms is the amount the reader read, byte-for-byte. Drafts land in the SAME "check what Folio
// found" queue as text imports and are NEVER auto-committed; the user reviews and confirms each one
// through the existing confirmImportDraft path. De-duplicates against existing drafts, confirmed
// records, and previously-rejected evidence exactly like stageStatementImport does.
export function stageStatementTransactions(
  state: LocalLedgerState,
  transactions: readonly StagedStatementTransaction[],
  source?: LocalDocumentStageInput,
): StageStatementTransactionsResult {
  const baseIndex = state.history.length + state.importDrafts.length;
  const candidateDrafts = transactions
    .map((txn, offset) => buildDraftFromStatementTransaction(txn, baseIndex + offset))
    .filter((draft): draft is LocalImportDraft => draft !== null);

  const reviewDrafts = candidateDrafts.map((draft) =>
    markPreviouslyRejectedDraft(draft, findMatchingRejectedImport(state.rejectedImports, draft)),
  );

  const existingRowIds = new Set(state.importDrafts.map((draft) => draft.rowId));
  const existingProvenanceHashes = new Set([
    ...state.importDrafts.map((draft) => draft.provenanceHash),
    ...state.transactions
      .map((transaction) => transaction.provenanceHash)
      .filter((hash): hash is string => hash !== undefined),
  ]);
  const acceptedDrafts = reviewDrafts.filter(
    (draft) =>
      !existingRowIds.has(draft.rowId) &&
      !existingProvenanceHashes.has(draft.provenanceHash) &&
      !state.importDrafts.some((candidate) => hasEquivalentDraft(candidate, draft)) &&
      !hasEquivalentTransaction(state.transactions, {
        id: draft.transactionId,
        title: draft.interpretation,
        amountMinor: draft.amountMinor,
        date: draft.date,
        source: 'import',
        status: 'confirmed',
        protected: isProtectedTitle(draft.interpretation),
        original: draft.original,
        provenanceHash: draft.provenanceHash,
      }),
  );

  const mergedDrafts = [...acceptedDrafts, ...state.importDrafts];
  const documentStage =
    source === undefined
      ? undefined
      : createLocalDocumentStage({
          source,
          text: transactions
            .map((txn) => `${txn.dateIso} ${txn.merchant} ${txn.amountMinor} ${txn.direction}`)
            .join('\n'),
          index: state.documentStages.length,
          stagedAt: parsedAtForDate(state.asOfDate),
          // The reader saw the statement; treat it as OCR-extracted regardless of the on-device path.
          extractionStatus: 'ocr-extracted',
        });

  const message =
    acceptedDrafts.length > 0
      ? `${acceptedDrafts.length} found to check. Nothing has been added yet. Keep the ones you want.`
      : 'Nothing new to check — these were already waiting or saved.';

  const nextState = prependHistory(
    {
      ...state,
      importDrafts: mergedDrafts,
      documentStages:
        documentStage === undefined
          ? state.documentStages
          : [documentStage, ...state.documentStages],
    },
    documentStage === undefined ? 'import_staged' : 'document_staged',
    documentStage === undefined
      ? `${acceptedDrafts.length} found to check from your statement.`
      : `${documentStage.filename} read. ${acceptedDrafts.length} found to check.`,
  );

  return {
    state: nextState,
    message,
    addedDraftCount: acceptedDrafts.length,
    ...(documentStage === undefined ? {} : { documentStage }),
  };
}

// Build one waiting draft straight from a structured AI-read transaction. The amount is kept exactly
// (already integer pence); the sign is applied from `direction`. The draft is marked
// 'ready-for-user-confirmation' so the user's confirm is a one-tap glance, not data entry — but it is
// still a draft, so nothing reaches the money picture until they confirm. Returns null for a junk
// entry (empty merchant or non-positive amount) so it is silently dropped, never shown.
function buildDraftFromStatementTransaction(
  txn: StagedStatementTransaction,
  index: number,
): LocalImportDraft | null {
  const merchant = txn.merchant.trim();
  if (merchant.length === 0) return null;
  const absoluteMinor = Math.abs(Math.round(txn.amountMinor));
  if (!Number.isSafeInteger(absoluteMinor) || absoluteMinor <= 0) return null;
  const dateIso = parseIsoDateInput(txn.dateIso, '');
  if (dateIso.length === 0) return null;

  const amountMinor = txn.direction === 'spend' ? -absoluteMinor : absoluteMinor;
  const original = `${merchant} ${formatMinorAmount(amountMinor)}`;
  const provenanceHash = createLocalTextDigest(
    `ai:${dateIso}:${amountMinor}:${normalizeTitle(merchant)}`,
  );
  const rowId = localId('ai_statement_row', index);

  return {
    rowId,
    transactionId: localId('ai_statement_txn', index),
    original,
    interpretation: merchant,
    amountMinor,
    date: dateIso,
    authorityState: 'imported-claim',
    reviewState: 'ready-for-user-confirmation',
    userConfirmationState: 'requested',
    parserIssues: [],
    status: 'Ready to confirm',
    provenanceHash,
    searchText: `${original} ${merchant}`.toLowerCase(),
    reasons: [],
  };
}

export function stageDocumentForManualReview(
  state: LocalLedgerState,
  source: LocalDocumentStageInput,
): StageDocumentForManualReviewResult {
  const documentStage = createLocalDocumentStage({
    source,
    text: `${source.filename}:${source.mediaType}:${source.byteSize}`,
    index: state.documentStages.length,
    stagedAt: parsedAtForDate(state.asOfDate),
    extractionStatus: 'unreadable',
  });
  const nextState = prependHistory(
    {
      ...state,
      documentStages: [documentStage, ...state.documentStages],
    },
    'document_staged',
    `${documentStage.filename} added for manual review. Nothing was added.`,
  );

  return {
    documentStage,
    message:
      'File saved. I could not read this statement clearly enough to show things to check. You can add one thing yourself.',
    state: nextState,
  };
}

// Add one item the user typed from a saved file. The item is a real added transaction (it changes
// Today), linked back to its source file. Money in for 'money'/'income'; money out for 'bill'/'debt'.
export function addTransactionFromDocument(
  state: LocalLedgerState,
  input: DocumentItemInput,
): LocalLedgerState {
  const absolute = Math.abs(parseSterlingAmount(input.amountText));
  if (absolute <= 0) throw new Error('Add an amount above zero.');
  const moneyIn = input.kind === 'money' || input.kind === 'income';
  const signed = moneyIn ? absolute : -absolute;
  const fallbackTitle =
    input.kind === 'income'
      ? 'Money in'
      : input.kind === 'bill'
        ? 'Bill'
        : input.kind === 'debt'
          ? 'Debt payment'
          : 'Money';
  const title = cleanTitle(input.title, fallbackTitle);
  const doc = state.documentStages.find((candidate) => candidate.id === input.documentId);
  const date = input.date ? parseRequiredIsoDateInput(input.date) : state.asOfDate;
  const id = localId('fromfile', state.history.length + state.transactions.length);
  const transaction: LocalLedgerTransaction = {
    id,
    title,
    amountMinor: signed,
    date,
    source: 'manual',
    status: 'confirmed',
    protected: false,
    original: `${title} ${formatMinorAmount(signed)}`,
    ...(doc ? { sourceDocumentId: doc.id, sourceLabel: doc.filename } : {}),
  };
  const documentStages = doc
    ? state.documentStages.map((candidate) =>
        candidate.id === doc.id
          ? {
              ...candidate,
              linkedTransactionIds: [...(candidate.linkedTransactionIds ?? []), id],
            }
          : candidate,
      )
    : state.documentStages;
  return prependHistory(
    { ...state, transactions: [transaction, ...state.transactions], documentStages },
    'manual_added',
    `${title} added from ${doc ? doc.filename : 'a saved file'}. Route rebuilt from added items.`,
  );
}

// Remove a saved file. Anything the user already added from it stays in their picture; those items
// keep working, they just no longer point at a file the user removed.
export function removeDocumentStage(state: LocalLedgerState, documentId: string): LocalLedgerState {
  const doc = state.documentStages.find((candidate) => candidate.id === documentId);
  if (doc === undefined) return state;
  return prependHistory(
    {
      ...state,
      documentStages: state.documentStages.filter((candidate) => candidate.id !== documentId),
    },
    'document_staged',
    `${doc.filename} removed. Anything you already added stays.`,
  );
}

export function confirmImportDraft(state: LocalLedgerState, rowId: string): LocalLedgerState {
  const draft = state.importDrafts.find((candidate) => candidate.rowId === rowId);
  if (draft === undefined) return state;
  if (
    draft.reviewState !== 'ready-for-user-confirmation' ||
    draft.userConfirmationState !== 'requested'
  ) {
    return state;
  }

  const transaction: LocalLedgerTransaction = {
    id: draft.transactionId,
    title: draft.interpretation,
    amountMinor: draft.amountMinor,
    date: draft.date,
    source: 'import',
    status: 'confirmed',
    protected: isProtectedTitle(draft.interpretation),
    original: draft.original,
    provenanceHash: draft.provenanceHash,
  };
  const transactions = hasEquivalentTransaction(state.transactions, transaction)
    ? state.transactions
    : [transaction, ...state.transactions];

  return prependHistory(
    {
      ...state,
      transactions,
      importDrafts: state.importDrafts.filter((candidate) => candidate.rowId !== rowId),
    },
    'import_confirmed',
    `${draft.interpretation} confirmed. Local history keeps the source wording.`,
  );
}

export function dismissImportDraft(
  state: LocalLedgerState,
  rowId: string,
  input: LocalImportDismissInput = {},
): LocalLedgerState {
  const draft = state.importDrafts.find((candidate) => candidate.rowId === rowId);
  if (draft === undefined) return state;
  const rejected = rejectedEvidenceFromDraft(state, draft, input);
  const retainedRejectedImports = upsertRejectedImportEvidence(state.rejectedImports, rejected);

  return prependHistory(
    {
      ...state,
      importDrafts: state.importDrafts.filter((candidate) => candidate.rowId !== rowId),
      rejectedImports: retainedRejectedImports,
    },
    'import_dismissed',
    `${draft.original} ${rejected.status.toLowerCase()} as ${rejected.rejectionReason.replace(
      /-/g,
      ' ',
    )}. No saved record changed.`,
  );
}

export function restoreRejectedImportForReview(
  state: LocalLedgerState,
  rowId: string,
): LocalLedgerState {
  const rejected = state.rejectedImports.find((candidate) => candidate.rowId === rowId);
  if (rejected === undefined) return state;
  if (state.importDrafts.some((draft) => draft.provenanceHash === rejected.provenanceHash)) {
    return state;
  }

  const restoredDraft = draftFromRejectedImportEvidence(rejected);
  return prependHistory(
    {
      ...state,
      importDrafts: [restoredDraft, ...state.importDrafts],
      rejectedImports: state.rejectedImports.map((candidate) =>
        candidate.rowId === rowId
          ? { ...candidate, restoreCount: candidate.restoreCount + 1 }
          : candidate,
      ),
    },
    'import_restored',
    `${rejected.original} reopened for review. Confirm before saving.`,
  );
}

export function editImportDraft(
  state: LocalLedgerState,
  rowId: string,
  input: LocalImportDraftEditInput,
): LocalLedgerState {
  const draft = state.importDrafts.find((candidate) => candidate.rowId === rowId);
  if (draft === undefined) return state;
  const interpretation = cleanTitle(input.interpretation, draft.interpretation);
  const amountMinor = parseSterlingAmount(input.amountText);
  const date = parseIsoDateInput(input.date, draft.date);

  return prependHistory(
    {
      ...state,
      importDrafts: state.importDrafts.map((candidate) =>
        candidate.rowId === rowId
          ? {
              ...candidate,
              amountMinor,
              authorityState: 'imported-claim',
              reviewState: 'ready-for-user-confirmation',
              userConfirmationState: 'requested',
              date,
              interpretation,
              parserIssues: uniqueValues([...candidate.parserIssues, 'edited locally']),
              reasons: uniqueValues([...candidate.reasons, 'edited locally']),
              searchText: `${candidate.searchText} ${interpretation}`,
              status: 'Ready to confirm',
            }
          : candidate,
      ),
    },
    'import_edited',
    `${draft.original} edited locally. Confirm before saving.`,
  );
}

export function suggestImportDraftClassification(draft: LocalImportDraft): LocalImportSuggestion {
  const source = `${draft.original} ${draft.interpretation} ${draft.searchText}`.toLowerCase();

  if (/\b(abound|loan|credit|minimum|repayment|debt)\b/.test(source)) {
    return {
      interpretation: 'Debt repayment',
      reviewState: 'needs-review',
      protected: true,
      reason: 'Melo matched debt-repayment language, but debt labels still need your review.',
    };
  }

  if (/\b(rent|landlord|mortgage)\b/.test(source)) {
    return {
      interpretation: 'Rent',
      reviewState: 'ready-for-user-confirmation',
      protected: true,
      reason: 'Melo matched a recurring housing payment pattern.',
    };
  }

  if (/\b(payroll|salary|wage|pay)\b/.test(source)) {
    return {
      interpretation: 'Income',
      reviewState: 'ready-for-user-confirmation',
      protected: false,
      reason: 'Melo matched payroll/income wording.',
    };
  }

  if (/\b(food|grocery|groceries|supermarket|corner shop|shop)\b/.test(source)) {
    return {
      interpretation: 'Food or groceries',
      reviewState: 'needs-review',
      protected: true,
      reason: 'Melo matched everyday food wording; keep it reviewable if the merchant is vague.',
    };
  }

  if (draft.amountMinor < 0) {
    return {
      interpretation: 'Spending to review',
      reviewState: 'needs-review',
      protected: false,
      reason: 'Melo can see this is an outflow, but not enough to label it safely.',
    };
  }

  return {
    interpretation: 'Income to review',
    reviewState: 'needs-review',
    protected: false,
    reason: 'Melo can see this is an inflow, but not enough to label it safely.',
  };
}

export function applyMeloImportSuggestion(
  state: LocalLedgerState,
  rowId: string,
): LocalLedgerState {
  const draft = state.importDrafts.find((candidate) => candidate.rowId === rowId);
  if (draft === undefined) return state;

  const suggestion = suggestImportDraftClassification(draft);
  const nextDrafts: readonly LocalImportDraft[] = state.importDrafts.map((candidate) => {
    if (candidate.rowId !== rowId) return candidate;
    const reasons = new Set(candidate.reasons);
    reasons.add(suggestion.reason);
    const status: LocalImportDraft['status'] =
      suggestion.reviewState === 'ready-for-user-confirmation'
        ? 'Ready to confirm'
        : 'Needs review';

    return {
      ...candidate,
      interpretation: suggestion.interpretation,
      authorityState: 'inferred',
      reviewState: suggestion.reviewState,
      userConfirmationState: 'requested',
      parserIssues: uniqueValues([...candidate.parserIssues, suggestion.reason]),
      status,
      reasons: [...reasons],
      searchText: `${candidate.searchText} ${suggestion.interpretation}`,
    };
  });

  return prependHistory(
    {
      ...state,
      importDrafts: nextDrafts,
    },
    'import_suggested',
    `Melo suggested "${suggestion.interpretation}" for ${draft.original}. Confirm before saving.`,
  );
}

export function formatMinorAmount(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(minor);
  const pounds = Math.floor(absolute / 100);
  const pence = absolute % 100;
  const formattedPounds = pounds.toLocaleString('en-GB');
  const currency = '\u00a3';
  return pence === 0
    ? `${sign}${currency}${formattedPounds}`
    : `${sign}${currency}${formattedPounds}.${String(pence).padStart(2, '0')}`;
}

function buildTimeline(state: LocalLedgerState): readonly LocalRouteEvent[] {
  const confirmed = state.transactions
    .filter((transaction) => transaction.status === 'confirmed')
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((transaction) => ({
      day: dayLabel(transaction.date, state.asOfDate),
      title: transaction.title,
      detail:
        localTransactionLifecycleStatusOf(transaction) === 'posted' &&
        transaction.source === 'manual'
          ? 'Added on this device'
          : localLifecycleDetail(transaction),
      amountMinor: transaction.amountMinor,
      tone: isLocalCashEffectiveTransaction(transaction)
        ? ('confirmed' as const)
        : ('attention' as const),
    }));
  const reviewEvents = state.importDrafts
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((draft) => ({
      day: draft.date <= state.asOfDate ? 'Review' : dayLabel(draft.date, state.asOfDate),
      title: draft.interpretation,
      detail: `Original: ${draft.original}`,
      amountMinor: draft.amountMinor,
      tone: 'attention' as const,
    }));

  return [...confirmed, ...reviewEvents];
}

function buildRoutePoints(input: {
  availableNowMinor: number;
  asOfDate: string;
  openingBalanceMinor: number;
  protectedFutureOutflows: number;
  transactions: readonly LocalLedgerTransaction[];
}): readonly LocalRoutePoint[] {
  const isEmptyWorkspace =
    input.transactions.length === 0 &&
    input.openingBalanceMinor === 0 &&
    input.availableNowMinor === 0 &&
    input.protectedFutureOutflows === 0;
  const points: LocalRoutePoint[] = [
    createRoutePoint({
      actionLabel: isEmptyWorkspace ? 'Add a fact or import statement' : 'Reveal source trail',
      authorityLabel: isEmptyWorkspace ? 'No source yet' : 'Confirmed local calculation',
      date: input.asOfDate,
      dependsOn: input.transactions
        .filter((transaction) => transaction.date <= input.asOfDate)
        .map((transaction) => transaction.id),
      label: 'Today',
      title: 'Cash after today',
      balanceMinor: input.openingBalanceMinor,
      deltaMinor: 0,
      explanation: isEmptyWorkspace
        ? `${formatMinorAmount(0)} is an empty local baseline, not a confirmed bank balance.`
        : 'Balance after confirmed records dated today or earlier.',
      pointKind: input.openingBalanceMinor < 0 ? 'shortfall' : 'confirmed',
      provenanceLabel: isEmptyWorkspace
        ? 'No local records stored'
        : 'Local balance plus confirmed dated records',
      reviewState: isEmptyWorkspace ? 'needs source' : 'already real',
      sourceLabel: isEmptyWorkspace ? 'Empty workspace' : 'Local ledger',
      tone:
        input.openingBalanceMinor < 0 ? 'attention' : isEmptyWorkspace ? 'estimated' : 'confirmed',
    }),
  ];

  if (input.protectedFutureOutflows > 0) {
    const protectedTransactions = input.transactions.filter(
      (transaction) =>
        transaction.date > input.asOfDate && transaction.protected && transaction.amountMinor < 0,
    );
    points.push(
      createRoutePoint({
        actionLabel: 'Reveal protected commitments',
        authorityLabel: 'Confirmed local calculation',
        date: input.asOfDate,
        dependsOn: protectedTransactions.map((transaction) => transaction.id),
        label: 'Today',
        title: 'Set aside for bills',
        balanceMinor: input.availableNowMinor,
        deltaMinor: -input.protectedFutureOutflows,
        explanation: `${formatMinorAmount(
          input.protectedFutureOutflows,
        )} kept aside for bills before anything you can spend.`,
        pointKind: input.availableNowMinor < 0 ? 'shortfall' : 'commitment',
        provenanceLabel: `${protectedTransactions.length} future protected commitment${
          protectedTransactions.length === 1 ? '' : 's'
        }`,
        protectedMinor: input.protectedFutureOutflows,
        reviewState: 'already real',
        sourceLabel: 'Protected commitments',
        tone: input.availableNowMinor < 0 ? 'attention' : 'confirmed',
      }),
    );
  }

  let balance = input.availableNowMinor;
  const futureTransactions = input.transactions
    .filter((transaction) => transaction.date > input.asOfDate)
    .sort((left, right) => left.date.localeCompare(right.date));

  for (const transaction of futureTransactions) {
    const isProtectedFutureOutflow = transaction.protected && transaction.amountMinor < 0;
    const deltaMinor = isProtectedFutureOutflow ? 0 : transaction.amountMinor;
    balance += deltaMinor;
    const pointKind =
      balance < 0
        ? 'shortfall'
        : isProtectedFutureOutflow
          ? 'commitment'
          : transaction.amountMinor > 0
            ? 'expected'
            : 'expected';
    const protectedMinor = isProtectedFutureOutflow ? Math.abs(transaction.amountMinor) : undefined;
    points.push(
      createRoutePoint({
        actionLabel:
          pointKind === 'shortfall'
            ? 'Review pressure point'
            : isProtectedFutureOutflow
              ? 'Reveal protected commitment'
              : 'Reveal record',
        authorityLabel:
          transaction.source === 'manual' || transaction.source === 'melo'
            ? 'User-confirmed local record'
            : transaction.source === 'import'
              ? 'Confirmed imported record'
              : transaction.source === 'open_banking'
                ? 'Confirmed Open Banking record'
                : 'Private example record',
        date: transaction.date,
        dependsOn: [transaction.id],
        label: dayLabel(transaction.date, input.asOfDate),
        title: transaction.title,
        balanceMinor: balance,
        deltaMinor,
        explanation: isProtectedFutureOutflow
          ? `${formatMinorAmount(Math.abs(transaction.amountMinor))} was reserved today and remains visible on its due date.`
          : transaction.amountMinor > 0 && transaction.certainty === 'expected'
            ? `${formatMinorAmount(transaction.amountMinor)} is expected on this date. It is not money you have yet.`
            : `Picture changes by ${formatMinorAmount(transaction.amountMinor)} on this date.`,
        linkedSourceId: transaction.id,
        pointKind,
        provenanceLabel: transaction.original ?? transaction.date,
        ...(protectedMinor === undefined ? {} : { protectedMinor }),
        reviewState: pointKind === 'shortfall' ? 'requires review' : 'already real',
        sourceLabel: transactionSourceLabel(transaction.source),
        tone:
          balance < 0 ? 'attention' : transaction.date > input.asOfDate ? 'estimated' : 'confirmed',
      }),
    );
  }

  return points;
}

function createRoutePoint(
  input: Readonly<{
    actionLabel: string;
    authorityLabel: string;
    balanceMinor: number;
    date: string;
    deltaMinor: number;
    dependsOn?: readonly string[];
    explanation: string;
    label: string;
    linkedSourceId?: string;
    pointKind: LocalRoutePointKind;
    provenanceLabel: string;
    protectedMinor?: number;
    reviewState: LocalRoutePointObjectState;
    sourceLabel: string;
    title: string;
    tone: LocalRoutePoint['tone'];
  }>,
): LocalRoutePoint {
  const stateLabel = input.reviewState === 'needs source' ? 'needs source' : input.pointKind;

  return {
    accessibleLabel: [
      input.title,
      input.label,
      formatMinorAmount(input.balanceMinor),
      stateLabel,
      input.reviewState,
      input.sourceLabel,
      input.explanation,
    ].join('. '),
    actionLabel: input.actionLabel,
    authorityLabel: input.authorityLabel,
    balanceMinor: input.balanceMinor,
    date: input.date,
    deltaMinor: input.deltaMinor,
    dependsOn: input.dependsOn ?? [],
    explanation: input.explanation,
    label: input.label,
    ...(input.linkedSourceId === undefined ? {} : { linkedSourceId: input.linkedSourceId }),
    pointKind: input.pointKind,
    provenanceLabel: input.provenanceLabel,
    ...(input.protectedMinor === undefined ? {} : { protectedMinor: input.protectedMinor }),
    reviewState: input.reviewState,
    sourceLabel: input.sourceLabel,
    title: input.title,
    tone: input.tone,
  };
}

function tightestPointFromRoute(
  points: readonly LocalRoutePoint[],
): Readonly<{ day: string; balanceMinor: number }> {
  // The tightest point is the lowest balance anywhere on the route — including point0 (today's
  // opening balance). Dropping today (the old points.slice(1)) hid a current overdraft whenever a
  // later point existed: an overdrawn-today-then-paid-later picture reported a positive tightest
  // and a falsely reassuring "your money lasts" verdict. Reduce over the FULL points array.
  const tightest = points.reduce<LocalRoutePoint | undefined>(
    (current, point) =>
      current === undefined || point.balanceMinor < current.balanceMinor ? point : current,
    undefined,
  );

  return {
    day: tightest?.label ?? 'Today',
    balanceMinor: tightest?.balanceMinor ?? 0,
  };
}

function protectedItemLabels(transactions: readonly LocalLedgerTransaction[]): readonly string[] {
  const labels = new Set<string>();
  for (const transaction of transactions) {
    if (!transaction.protected) continue;
    const title = transaction.title.toLowerCase();
    if (title.includes('rent')) labels.add('rent');
    else if (title.includes('food')) labels.add('food allowance');
    else if (title.includes('debt') || title.includes('minimum')) labels.add('minimum payments');
    else labels.add(transaction.title.toLowerCase());
  }

  return [...labels];
}

function nextPaydayLabel(
  transactions: readonly LocalLedgerTransaction[],
  asOfDate: string,
): string {
  const payday = transactions
    .filter(
      (transaction) =>
        transaction.date >= asOfDate &&
        transaction.amountMinor > 0 &&
        /pay|wage|salary/i.test(transaction.title),
    )
    .sort((left, right) => left.date.localeCompare(right.date))[0];
  return payday === undefined ? 'next payday' : `${dayLabel(payday.date, asOfDate)} payday`;
}

function localDraftFromImportRow(row: ImportReviewRowSummary, original: string): LocalImportDraft {
  const needsReview = row.decisionState !== 'ready_for_user_confirmation' || row.reasons.length > 0;
  return {
    rowId: row.rowId,
    transactionId: row.stableTransactionId,
    original,
    interpretation: row.description,
    amountMinor: row.amountMinor,
    date: row.postedDate,
    authorityState: needsReview ? 'estimated' : 'imported-claim',
    reviewState: needsReview ? 'needs-review' : 'ready-for-user-confirmation',
    userConfirmationState: 'requested',
    parserIssues: row.reasons,
    status: needsReview ? 'Needs review' : 'Ready to confirm',
    provenanceHash: row.provenanceHash,
    searchText: row.searchText,
    reasons: row.reasons,
  };
}

function markPreviouslyRejectedDraft(
  draft: LocalImportDraft,
  rejected: LocalRejectedImportEvidence | undefined,
): LocalImportDraft {
  if (rejected === undefined) return draft;
  const reason = `previously ${rejected.status.toLowerCase()}`;
  const detail = `${reason}: ${rejected.rejectionReason.replace(/-/g, ' ')}`;
  return {
    ...draft,
    authorityState: 'estimated',
    reviewState: 'needs-review',
    userConfirmationState: 'requested',
    parserIssues: uniqueValues([...draft.parserIssues, detail]),
    reasons: uniqueValues([...draft.reasons, detail]),
    searchText: `${draft.searchText} ${detail}`,
    status: 'Needs review',
  };
}

function rejectedEvidenceFromDraft(
  state: LocalLedgerState,
  draft: LocalImportDraft,
  input: LocalImportDismissInput,
): LocalRejectedImportEvidence {
  const rejectionReason = input.reason ?? 'other';
  const status = input.status ?? 'Rejected';
  const reasonLabel = `${status.toLowerCase()}: ${rejectionReason.replace(/-/g, ' ')}`;
  return {
    rowId: draft.rowId,
    transactionId: draft.transactionId,
    original: draft.original,
    interpretation: draft.interpretation,
    amountMinor: draft.amountMinor,
    date: draft.date,
    authorityState: draft.authorityState,
    reviewState: 'dismissed',
    userConfirmationState: 'rejected',
    parserIssues: uniqueValues([...draft.parserIssues, reasonLabel]),
    status,
    provenanceHash: draft.provenanceHash,
    searchText: `${draft.searchText} ${reasonLabel}`,
    reasons: uniqueValues([...draft.reasons, reasonLabel]),
    rejectedAt: parsedAtForDate(state.asOfDate),
    rejectionReason,
    restoreCount: 0,
  };
}

function draftFromRejectedImportEvidence(rejected: LocalRejectedImportEvidence): LocalImportDraft {
  const reason = `restored from ${rejected.status.toLowerCase()} evidence`;
  return {
    rowId: rejected.rowId,
    transactionId: rejected.transactionId,
    original: rejected.original,
    interpretation: rejected.interpretation,
    amountMinor: rejected.amountMinor,
    date: rejected.date,
    authorityState: 'estimated',
    reviewState: 'needs-review',
    userConfirmationState: 'requested',
    parserIssues: uniqueValues([...rejected.parserIssues, reason]),
    status: 'Needs review',
    provenanceHash: rejected.provenanceHash,
    searchText: `${rejected.searchText} ${reason}`,
    reasons: uniqueValues([...rejected.reasons, reason]),
  };
}

function upsertRejectedImportEvidence(
  rejectedImports: readonly LocalRejectedImportEvidence[],
  rejected: LocalRejectedImportEvidence,
): readonly LocalRejectedImportEvidence[] {
  const existing = rejectedImports.findIndex(
    (candidate) =>
      candidate.rowId === rejected.rowId || candidate.provenanceHash === rejected.provenanceHash,
  );
  if (existing === -1) return [rejected, ...rejectedImports];
  return rejectedImports.map((candidate, index) =>
    index === existing
      ? { ...rejected, restoreCount: candidate.restoreCount, rejectedAt: candidate.rejectedAt }
      : candidate,
  );
}

function originalTextForRow(
  row:
    | Readonly<{
        raw: Readonly<Record<string, string | undefined>>;
        provenance: Readonly<{ original: Readonly<Record<string, string>> }>;
        normalized: Readonly<{ description: string; amount: Readonly<{ minorUnits: number }> }>;
      }>
    | undefined,
): string {
  if (row === undefined) return 'Imported payment';
  const sourceValues = Object.values(row.provenance.original).filter(
    (value) => value.trim().length > 0,
  );
  if (sourceValues.length > 0) return sourceValues.join(' / ');
  return `${row.normalized.description} ${formatMinorAmount(row.normalized.amount.minorUnits)}`;
}

function inferDocumentSourceType(
  mediaType: string,
  filename: string,
  storageState: LocalDocumentStage['storageState'],
): LocalDocumentSourceType {
  if (storageState === 'pasted_text') return 'paste';
  const m = mediaType.toLowerCase();
  const f = filename.toLowerCase();
  if (m.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/.test(f)) return 'image';
  if (m === 'application/pdf' || f.endsWith('.pdf')) return 'pdf';
  if (m.includes('csv') || f.endsWith('.csv')) return 'csv';
  if (m === 'text/plain' || f.endsWith('.txt') || f.endsWith('.tsv')) return 'txt';
  return 'other';
}

function createLocalDocumentStage({
  index,
  source,
  stagedAt,
  text,
  extractionStatus = 'not-attempted',
}: {
  index: number;
  source: LocalDocumentStageInput;
  stagedAt: string;
  text: string;
  extractionStatus?: LocalDocumentExtractionStatus;
}): LocalDocumentStage {
  const filename = cleanTitle(source.filename, 'local-statement.csv');
  const mediaType = cleanTitle(source.mediaType, 'text/csv');
  return {
    id: localId('document_stage', index),
    filename,
    mediaType,
    byteSize: Math.max(0, Math.round(source.byteSize)),
    stagedAt,
    storageState: source.storageState,
    textDigest: createLocalTextDigest(text),
    sourceType: inferDocumentSourceType(mediaType, filename, source.storageState),
    extractionStatus,
    linkedTransactionIds: [],
    ...(source.uri !== undefined ? { uri: source.uri } : {}),
    notes: [],
  };
}

/**
 * Attach a free-text note to a saved file. Reference only — a note never changes Today or the path,
 * it just helps the user remember what the file was. No-op if the document is gone.
 */
export function addDocumentNote(
  state: LocalLedgerState,
  documentId: string,
  note: string,
): LocalLedgerState {
  const trimmed = note.trim();
  if (trimmed.length === 0) return state;
  const target = state.documentStages.find((stage) => stage.id === documentId);
  if (target === undefined) return state;
  const withNote: LocalLedgerState = {
    ...state,
    documentStages: state.documentStages.map((stage) =>
      stage.id === documentId ? { ...stage, notes: [...(stage.notes ?? []), trimmed] } : stage,
    ),
  };
  return prependHistory(withNote, 'document_staged', `Note added to ${target.filename}.`);
}

function createLocalTextDigest(text: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `local-text:${hash.toString(16).padStart(8, '0')}`;
}

function parseSterlingAmount(value: string): number {
  const source = value.trim();
  if (source.length === 0) throw new Error('Amount is empty.');
  const negative = source.includes('-') || /^\(.*\)$/.test(source);
  const normalized = source
    .replace(/[A-Z]{3}/gi, '')
    .replace(/[\u00a3$,\s()]/g, '')
    .replace(/^\+|-+/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid amount: ${value}`);
  }
  const [major = '0', minor = ''] = normalized.split('.');
  const amountMinor = Number(major) * 100 + Number(minor.padEnd(2, '0'));
  if (!Number.isSafeInteger(amountMinor)) throw new Error(`Unsafe amount: ${value}`);
  return negative ? -amountMinor : amountMinor;
}

function cleanTitle(value: string, fallback: string): string {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned.length === 0 ? fallback : cleaned;
}

function prependHistory(
  state: LocalLedgerState,
  kind: LocalHistoryEntry['kind'],
  label: string,
): LocalLedgerState {
  return syncImportSummaryWithQueue({
    ...state,
    history: [
      {
        id: localId('history', state.history.length),
        kind,
        createdAt: parsedAtForDate(state.asOfDate),
        label,
      },
      ...state.history,
    ],
  });
}

function hasEquivalentTransaction(
  transactions: readonly LocalLedgerTransaction[],
  candidate: LocalLedgerTransaction,
): boolean {
  return transactions.some(
    (transaction) =>
      transaction.id === candidate.id ||
      (transaction.date === candidate.date &&
        transaction.amountMinor === candidate.amountMinor &&
        normalizeTitle(transaction.title) === normalizeTitle(candidate.title)),
  );
}

function hasEquivalentDraft(left: LocalImportDraft, right: LocalImportDraft): boolean {
  return (
    left.provenanceHash === right.provenanceHash ||
    (left.date === right.date &&
      left.amountMinor === right.amountMinor &&
      normalizeTitle(left.original) === normalizeTitle(right.original))
  );
}

function findMatchingRejectedImport(
  rejectedImports: readonly LocalRejectedImportEvidence[],
  draft: LocalImportDraft,
): LocalRejectedImportEvidence | undefined {
  return rejectedImports.find(
    (rejected) =>
      rejected.provenanceHash === draft.provenanceHash ||
      (rejected.date === draft.date &&
        rejected.amountMinor === draft.amountMinor &&
        normalizeTitle(rejected.original) === normalizeTitle(draft.original)),
  );
}

function queueAdjustedImportSummary(
  summary: LocalImportSummary,
  drafts: readonly LocalImportDraft[],
  skippedRowsInCurrentImport = 0,
): LocalImportSummary {
  const readyForAcceptance = drafts.filter((draft) => draft.status === 'Ready to confirm').length;
  const needsUserReview = drafts.filter((draft) => draft.status === 'Needs review').length;
  const visibleQueueRows = readyForAcceptance + needsUserReview;
  const duplicateAdjustedRows = Math.max(
    0,
    summary.parsedRows - Math.max(0, skippedRowsInCurrentImport),
  );

  return {
    ...summary,
    parsedRows: Math.max(duplicateAdjustedRows, visibleQueueRows),
    readyForAcceptance,
    needsUserReview,
    skippedRows: Math.max(0, summary.skippedRows),
  };
}

function syncImportSummaryWithQueue(state: LocalLedgerState): LocalLedgerState {
  if (state.lastImportSummary === undefined) return state;
  return {
    ...state,
    lastImportSummary: queueAdjustedImportSummary(state.lastImportSummary, state.importDrafts),
  };
}

function isProtectedTitle(title: string): boolean {
  return /\b(rent|mortgage|food|minimum|debt|loan|insurance)\b/i.test(title);
}

function transactionSourceLabel(source: LocalTransactionSource): string {
  if (source === 'manual') return 'Manual';
  if (source === 'melo') return 'Melo';
  if (source === 'import') return 'Statement';
  if (source === 'open_banking') return 'Open Banking';
  return 'Private example';
}

function routePointSearchDetail(point: LocalRoutePoint): string {
  const stateLabel = point.reviewState === 'needs source' ? 'needs source' : point.pointKind;
  const source = `${stateLabel} - ${point.sourceLabel} - ${point.authorityLabel}`;
  if (point.explanation.length > 0) return `${point.explanation} ${source}.`;
  if (point.title === 'Set aside for bills' && point.deltaMinor < 0) {
    return `${formatMinorAmount(Math.abs(point.deltaMinor))} held back after bills`;
  }
  if (point.deltaMinor === 0) return 'Route balance point';
  return `Route changes by ${formatMinorAmount(point.deltaMinor)}`;
}

function shouldAnswerAsRecordLookup(normalizedPrompt: string): boolean {
  if (normalizedPrompt.length === 0) return false;
  if (!/[a-z]/i.test(normalizedPrompt)) return false;
  return !/\b(can i|afford|buy|purchase|spend|before payday|left|why|available|balance|calculation|covered|import|csv|statement|review|bad month|emergency|recovery|short|what can you help|question types)\b/i.test(
    normalizedPrompt,
  );
}

function isConcreteLedgerRecord(record: LocalSearchRecord): boolean {
  return (
    record.id.startsWith('transaction-') ||
    record.id.startsWith('draft-') ||
    record.id.startsWith('document-')
  );
}

function recordLookupSummary(record: LocalSearchRecord): string {
  const amountText =
    record.amountMinor === undefined ? '' : ` ${formatMinorAmount(record.amountMinor)}`;
  return `${record.title}${amountText}`;
}

function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function searchRecordMatches(record: LocalSearchRecord, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) return true;
  const amountText =
    record.amountMinor === undefined ? '' : formatMinorAmount(record.amountMinor).toLowerCase();
  return [record.title, record.detail, record.meta, amountText].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueValues<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function localId(prefix: string, index: number): string {
  return `${prefix}_${String(index + 1).padStart(4, '0')}`;
}

function isUnmodifiedSeedExample(state: LocalLedgerState): boolean {
  return (
    state.history.length === 1 &&
    state.history[0]?.id === 'history_seed' &&
    state.transactions.length === 4 &&
    state.transactions.every((transaction) => transaction.id.startsWith('seed_')) &&
    state.importDrafts.length === 2 &&
    state.importDrafts.every((draft) => draft.rowId.startsWith('seed_')) &&
    state.rejectedImports.length === 0 &&
    state.documentStages.length === 0
  );
}

function parsedAtForDate(asOfDate: string): string {
  return `${asOfDate}T10:00:00.000Z`;
}

function parseIsoDateInput(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return fallback;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
}

function parseRequiredIsoDateInput(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error(`Invalid date: ${value}`);
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed.toISOString().slice(0, 10);
}

export function addIsoDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function isoDayDistance(fromDate: string, toDate: string): number {
  return Math.round(
    (Date.parse(`${toDate}T00:00:00.000Z`) - Date.parse(`${fromDate}T00:00:00.000Z`)) /
      millisecondsPerDay,
  );
}

function dayLabel(date: string, asOfDate: string): string {
  if (date <= asOfDate) return date === asOfDate ? 'Today' : 'Past';
  const dayDistance = Math.round(
    (Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${asOfDate}T00:00:00.000Z`)) /
      millisecondsPerDay,
  );
  if (dayDistance === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(
    new Date(`${date}T00:00:00.000Z`),
  );
}
