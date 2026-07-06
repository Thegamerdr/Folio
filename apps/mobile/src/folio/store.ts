// @rn-engine store-migration — wire @folio/storage + op-sqlite persistence later (see BUILD_PLAN §3)
//
// Folio data spine — RN port of the web design store
// (folio-melo/src/lib/store.ts), faithful 1:1.
//
// Single source of truth for things that should survive a refresh on the web:
// pots, sub-paused state, ritual cycle history, onboarding, current balance,
// the pot ledger, transactions and user calendar events.
//
// Differences from the web original — intentional and minimal:
//   • Persistence: the web store read/wrote `window.localStorage`. There are no
//     web storage APIs in RN, so the persistence layer is REPLACED with an
//     in-memory module-level blob (`persistedBlob`). The `migrate()` /
//     `MIGRATIONS` scaffold is kept intact and runs against that in-memory blob
//     so the upgrade pattern is preserved for when @folio/storage + op-sqlite
//     are wired (BUILD_PLAN §3).
//   • Reactivity is identical: a module-level `state` + a `Set` of listeners,
//     surfaced through React `useSyncExternalStore` (same pub/sub pattern).
//   • `applyMeloTool` tool-name matching is normalised (lowercase / trim /
//     strip punctuation) and returns candidates when ambiguous, per
//     ENGINES.md §6 "Melo — tool name matching". The four tools' BEHAVIOUR is
//     byte-for-byte the web original.

import { applyTxnEdit, type TxnEdit, type TxnEditPatch } from './lib/editTxn';
import type { CandidateMoneyItem } from './lib/importSheet';
import {
  applyMemoryToCandidates,
  MERCHANT_CATEGORY_CAP,
  type CandidateWithMemory,
  type MerchantCategoryMap,
  type MerchantCategoryMemory,
} from './lib/merchantMemory';
import { normaliseMerchant } from './lib/subSignals';
import { synthesizeHistoryCycles } from './lib/historyCycles';
import { makeWin, hasWin, type TinyWin, type TinyWinKind } from './lib/wins';

/** The element type of the persisted `AppState.edits` slot. It is the engine's
 *  full `TxnEdit` with `id` relaxed to optional: every record this store writes
 *  is produced by `applyTxnEdit` and so always carries an `id`, but the export
 *  engine + its tests read the slot tolerantly (older/loose shapes without an
 *  `id`), so the persisted contract must not require it. Runtime values are
 *  always full `TxnEdit`s; the relaxation is purely a structural-compat seam. */
export type StoredTxnEdit = Omit<TxnEdit, 'id'> & { id?: string };

/** Per-pot top-up cadence. Per ENGINES.md § 6 "Pot top-up cadence":
 *  default is `after-payday`. `weekly` is the legacy/prototype shape that
 *  the calendar engine still uses as a fallback for unmigrated pots. */
export type PotCadence =
  | { kind: 'after-payday' }
  | { kind: 'weekly'; weekday: number /* 0..6 */ }
  | { kind: 'monthly'; dayOfMonth: number /* 1..31 */ }
  | { kind: 'custom'; nextDate: string };

export type Pot = {
  id: string;
  name: string;
  saved: number;
  goal: number;
  perWeek: number;
  accent: boolean;
  /** Optional — unmigrated pots fall through to the legacy Friday cadence
   *  in `deriveCalendarEvents`. RN must default new pots to `after-payday`. */
  cadence?: PotCadence;
  /** ENGINES.md § 4 "Pot borrow hard-capped by default" — per-pot opt-in so a soft-landing buffer can
   *  go briefly negative when borrowed from. Undefined/false = hard-capped (the default). */
  allowNegative?: boolean;
};

export type Sub = {
  /** Canonical display name — also the key used in `subPaused`. */
  name: string;
  cost: number;
  /** Days until next renewal, relative to "now". Decremented by fastForwardMonth. */
  nextRenewalDaysAway: number;
  /** Last opened/used this many days ago. */
  lastUsedDaysAgo: number;
  /** Rough monthly usage count. 0 = quiet. */
  usesPerMonth: number;
  /** Free trial ends in N days. The single highest-regret category — every
   *  surface that mentions this sub should flag it. Undefined = no trial. */
  trialEndsInDays?: number;
};

/** A single outstanding debt line — loan, credit card, BNPL, or "other".
 *  Purely local; ports the Lovable design's Debt lens data shape 1:1
 *  (folio-melo `src/lib/store.ts` `Debt`). APR is annual %, min payment is
 *  monthly £, `dueDom` is day-of-month the payment falls. Balance is
 *  decremented by future debt-payment logging (not yet wired here). */
export type Debt = {
  id: string;
  name: string;
  kind: 'loan' | 'card' | 'bnpl' | 'other';
  /** Current outstanding £. Never negative. */
  balance: number;
  /** Annual %. 0-100. Set to 0 for interest-free BNPL. */
  apr: number;
  /** Monthly minimum payment £. */
  minPayment: number;
  /** Day of month the payment lands. 1-31. */
  dueDom: number;
  /** ISO date the debt was added — used only for sorting stability. */
  addedAt: string;
};

/** Household lens state — the shared-bills ledger. Ports the Lovable design's
 *  `Household` shape 1:1 (folio-melo `src/lib/store.ts`). Honest-minimal:
 *    - `partnerName` — who the user shares with (blank = not set yet)
 *    - `defaultShare` — user's share of any bill they haven't explicitly
 *      allocated (0..1). Default 0.5 = even split.
 *    - `subShareOverrides` — per-sub overrides keyed by `Sub.name`. Value
 *      is the user's share of that bill, 0..1. Absent = fall back to
 *      `defaultShare`. */
export type Household = {
  partnerName: string;
  defaultShare: number;
  subShareOverrides: Record<string, number>;
};

/** A single big-ticket target the user is saving toward — the Planning
 *  lens's first-class object. Ports the Lovable design's `Plan` shape 1:1
 *  (folio-melo `src/lib/store.ts`). Distinct from `Pot`: a Plan has a
 *  *deadline* (`byDate`) and the strategy compares required-per-week
 *  against current cadence to say "on pace" or "short". */
export type Plan = {
  id: string;
  name: string;
  /** £ target. Never negative. */
  target: number;
  /** £ already put aside toward the plan. Never negative. */
  saved: number;
  /** ISO YYYY-MM-DD — the "by" date. */
  byDate: string;
  /** Current weekly contribution cadence £/wk. 0 = not started. */
  perWeek: number;
  /** ISO timestamp added. Used only for sort stability. */
  addedAt: string;
};

/** The user's declared Money Mode / Lens (see `lib/modes/types.ts`).
 *  Every existing install migrates to `'survival'` so behaviour is
 *  byte-identical to the shipped default. */
export type MoneyMode =
  | 'survival'
  | 'stability'
  | 'growth'
  | 'debt'
  | 'irregular'
  | 'household'
  | 'planning'
  | 'optimizer'
  | 'reset'
  | 'lowVis';

/** Lens / Plus-Pro entitlement state. Ports the Lovable design's `lens`
 *  slice 1:1 (folio-melo `src/lib/store.ts`). `plusUnlocked` = paid Plus;
 *  `proUnlocked` = paid Pro (implies Plus — see `setLensProUnlocked`).
 *  `trialCycleId` marks the cycle the user activated a one-cycle free
 *  trial in (unlocks every paid lens together); cleared at cycle close.
 *  `trialEndedCycleId` captures the just-closed trial cycle so Today can
 *  surface a soft "trial ended" prompt exactly once; `trialEndAcknowledged`
 *  flips true after the user taps the prompt or dismisses it. */
export type LensState = {
  plusUnlocked: boolean;
  proUnlocked: boolean;
  trialCycleId: string | null;
  trialEndedCycleId: string | null;
  trialEndAcknowledged: boolean;
};

const DEFAULT_SUBS: Sub[] = [
  { name: 'Spotify', cost: 11.0, nextRenewalDaysAway: 2, lastUsedDaysAgo: 0, usesPerMonth: 28 },
  { name: 'Netflix', cost: 12.99, nextRenewalDaysAway: 9, lastUsedDaysAgo: 21, usesPerMonth: 2 },
  { name: 'Notion', cost: 8.0, nextRenewalDaysAway: 11, lastUsedDaysAgo: 0, usesPerMonth: 30 },
  {
    name: 'Disney+',
    cost: 8.99,
    nextRenewalDaysAway: 6,
    lastUsedDaysAgo: 42,
    usesPerMonth: 0,
    trialEndsInDays: 6,
  },
  { name: 'iCloud', cost: 2.99, nextRenewalDaysAway: 13, lastUsedDaysAgo: 0, usesPerMonth: 30 },
  { name: 'Strava', cost: 9.99, nextRenewalDaysAway: 17, lastUsedDaysAgo: 18, usesPerMonth: 1 },
];

export type CycleRecord = {
  /** ISO date the ritual was completed */
  closedAt: string;
  /** Free-text label like "June" */
  label: string;
  spare: number;
  tightPoint: number;
  setAside: number;
  note: string;
  /** Present and `true` only for a cycle synthesized from bulk-imported
   *  transaction history by `lib/historyCycles.ts` (DATA_INTELLIGENCE.md
   *  phase ④), never for a real, ritual-sealed cycle written by
   *  `addCycle`/`fastForwardMonth`. Back-compat optional field — absent on
   *  every pre-existing lived cycle. Screens that mean "the ritual the user
   *  actually walked through" (e.g. the Today ritual-offer gate) must treat a
   *  reconstructed cycle as if it doesn't exist — see `lib/historyCycles.ts`'s
   *  `latestLivedCycle`. */
  reconstructed?: true;
};

export type Onboarding = {
  done: boolean;
  name: string;
  payday: number; // day of month
  monthlyIncome: number;
};

/** Income-cadence model — Phase ① of the data-intelligence program (see
 *  `lib/income.ts`). Generalises the legacy single "day-of-month + monthly
 *  amount" (`onboarding.payday` / `onboarding.monthlyIncome`) into a list of
 *  named, independently-cadenced pay events, so weekly/fortnightly/four-weekly/
 *  last-working-day earners get correct math instead of the one-size-fits-all
 *  monthly lump every other screen assumed.
 *
 *  `dayOfMonth` is required (and meaningful) only for `cadence: 'monthly'`;
 *  `anchorISO` is required only for the three week-based cadences
 *  (`weekly`/`fortnightly`/`four-weekly`) — any known past or future payday
 *  date the cadence repeats from. `last-working-day` needs neither: it always
 *  resolves to the last non-weekend day of the month. `lib/income.ts` throws
 *  if the field its cadence needs is missing — that is an engine-boundary
 *  contract violation, not something to silently guess around. */
export type IncomeSource = {
  id: string;
  label: string;
  cadence: 'monthly' | 'weekly' | 'fortnightly' | 'four-weekly' | 'last-working-day';
  /** 1..31. Only meaningful for `cadence: 'monthly'`. */
  dayOfMonth?: number;
  /** ISO "YYYY-MM-DD" — any known occurrence of a week-based cadence, past or
   *  future. Only meaningful for `weekly`/`fortnightly`/`four-weekly`. */
  anchorISO?: string;
  amount: number;
  /** Where this source came from — user-entered at onboarding, inferred by a
   *  future statement-reading pass, or added later via a manual "Add income". */
  source: 'onboarding' | 'inferred' | 'manual';
};

/** ENGINES.md § 6 "Starting balance — source + confidence".
 *  Every balance on Today/Ritual reads `currentBalance.amount`; the literal
 *  720 fallback has been removed. `sample` is the only source allowed in
 *  demo/sample mode; user-entered always wins. */
export type BalanceSource =
  | 'user-entered'
  | 'statement'
  | 'pdf-derived'
  | 'ocr-derived'
  | 'corrected'
  | 'sample';
export type BalanceConfidence = 'rough' | 'statement-derived' | 'corrected' | 'sample';
export type CurrentBalance = {
  amount: number;
  source: BalanceSource;
  confidence: BalanceConfidence;
  /** ISO timestamp this balance was set. */
  setAt: string;
};

/** ENGINES.md § 4 "Pot rules — borrow/repay ledger" + § 6 "Ritual cycle
 *  close numbers". A row per real pot mutation, so the ritual's `setAside`
 *  is computed from honest deposit history instead of `perWeek × 4`. */
export type PotLedgerEntry = {
  id: string;
  potId: string;
  /** ISO timestamp */
  at: string;
  kind: 'deposit' | 'borrow' | 'repay' | 'withdraw';
  /** Always positive £. Sign is implied by `kind`. */
  amount: number;
  /** Free-text source — "ritual", "melo", "manual", "shortfall-borrow". */
  source: string;
};

export type Transaction = {
  id: string;
  /** ISO timestamp */
  when: string;
  merchant: string;
  /** Negative = spend, positive = inflow. £ with decimals OK. */
  amount: number;
  category: 'food' | 'transport' | 'fun' | 'bills' | 'shopping' | 'income' | 'other';
  /** Where it came from — manual entry, Melo-logged, or seed/demo. */
  source: 'manual' | 'melo' | 'seed';
};

/** @rn-engine timeline-verbs — the missing event log the web's ScreenTimeline demo stubbed with 8
 *  hardcoded rows. This is the REAL engine: an append-only log of the verb-state moments the web
 *  Timeline shows (subscription paused/resumed, a Review candidate ignored). "Added"/"Edited" rows
 *  don't need a log entry — they are derived straight from `transactions`/`edits` by the row builder
 *  (`lib/timelineEvents.ts`), so this log carries only the events that have NO other durable trace:
 *  a sub pause/resume (a map flip, not a row) and a Review "Ignore" (recorded elsewhere only as an
 *  opaque signature string, not a human-readable subject). Newest first, capped at 200 — mirrors the
 *  `transactions` cap so the timeline never grows unbounded. */
export type TimelineEventKind = 'sub-paused' | 'sub-resumed' | 'review-ignored';

export type TimelineEvent = {
  id: string;
  /** ISO timestamp. */
  at: string;
  kind: TimelineEventKind;
  /** The human-facing subject — a sub name ('Disney+') or a Review candidate's merchant. */
  subject: string;
  /** Optional short note the row builder can show verbatim (e.g. the paused-for-how-long line). */
  note?: string;
};

/** A user-added calendar event. Derived events (paydays, bills, sub renewals,
 *  deadlines) come from `deriveCalendarEvents()` and are NOT stored. */
export type CalendarEvent = {
  id: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  kind: 'in' | 'out' | 'review' | 'deadline';
  title: string;
  note?: string;
  /** Signed pounds — positive = in, negative = out, undefined for review/deadline. */
  amount?: number;
};

export type AppState = {
  /** Bumped on every breaking shape change. Read by `migrate()` on load
   *  so the prototype stops silently falling back to defaults for missing
   *  fields. RN must keep the same scheme (per RN_PORT.md "Store migration"). */
  schemaVersion: number;
  pots: Pot[];
  subs: Sub[];
  subPaused: Record<string, boolean>;
  /** Day-delta nudge per sub renewal. +3 = "I'd rather this hit 3 days later".
   *  The Calendar engine adds this to `nextRenewalDaysAway` when deriving the
   *  next charge, so a flexible bill can be slid around the tight day.
   *  Cleared automatically once a renewal passes. */
  subOverrides: Record<string, number>;
  cycles: CycleRecord[];
  onboarding: Onboarding;
  /** Single source of truth for "what's roughly in your account today".
   *  Replaces the literal £720 the prototype used to anchor Today/Ritual. */
  currentBalance: CurrentBalance;
  /** Per-pot deposit/borrow/repay ledger. Ritual `setAside` sums deposits
   *  inside the cycle window; replaces the old `perWeek × 4` stand-in. */
  potLedger: PotLedgerEntry[];
  /** The "one line for next-you" written at cycle close. Persisted so the
   *  next ritual can show what past-you actually wrote, not a hardcoded
   *  example. Cleared by `addCycle` once it's written into the new cycle. */
  nextYouNote: string;
  /** Floor £ to hold at the tightest point of the month. Set via Melo. */
  tightPointGoal: number | null;
  /** Newest first. Capped at `TRANSACTION_CAP` (2000) — see that constant's
   *  doc for the retention policy and why it's higher than the old 200. */
  transactions: Transaction[];
  /** Retention-policy honesty counter (DATA_INTELLIGENCE.md phase ④(A)): how
   *  many transactions have ever been silently evicted by the
   *  `TRANSACTION_CAP` eviction in `addTransaction`/`addTransactionsBatch`.
   *  Eviction itself is never blocked or surfaced as an error — it's a normal
   *  part of keeping persisted state bounded — but it must never be SILENT:
   *  this counter is the durable record a future UI can read to tell the user
   *  honestly "N older rows have rolled off" rather than pretending nothing
   *  was ever dropped. Monotonically increasing, never reset by ordinary use
   *  (only `resetAll`/`resetToEmpty` zero it, same as every other counter).
   *  Optional for shape back-compat with hand-built `AppState` fixtures
   *  predating this field; `DEFAULTS`/`load()`/`resetToEmpty()` always
   *  populate it (0). */
  droppedTransactionCount?: number;
  /** Immutable correction history — one record per changed field per edit
   *  (ENGINES.md §6 "Editing existing transactions — required, never
   *  destructive"). The original value of any edited field always survives
   *  inside the oldest `before` here, so an edit is recoverable and never
   *  overwrites the row out of existence. Appended to, never rewritten.
   *  Optional only for shape back-compat with hand-built `AppState` fixtures
   *  predating this field; `DEFAULTS`/`load()` always populate it ([]). The
   *  element is `StoredTxnEdit` (engine `TxnEdit` with `id` relaxed) so the
   *  tolerant export reader's loose shapes still satisfy this slot. */
  edits?: StoredTxnEdit[];
  /** User-added calendar events. Derived events are computed on read. */
  calendarEvents: CalendarEvent[];
  /** Ephemeral — bridge from Route detail to Calendar. ISO YYYY-MM-DD.
   *  Read once by ScreenCalendar to jump to a day, then cleared. */
  calendarFocusDate: string | null;
  /** Ephemeral — bridge from Calendar back to the Route on Today.
   *  Read once by ScreenToday to scrub the path to that date and pulse
   *  the matching point, then cleared. */
  routeFocusDate: string | null;
  /** Transient review queue — candidates the statement reader extracted from a
   *  PDF/image, staged for the Review screen. Review-before-truth: these are
   *  NEVER posted facts and are NEVER auto-counted; the user confirms each one
   *  before it becomes a transaction. Excluded from `getPersistBlob` and reset
   *  by `load()` — it must NOT survive a restart, exactly like the ephemeral
   *  `calendarFocusDate` / `routeFocusDate` bridges. */
  readerCandidates: CandidateMoneyItem[];
  /** ENGINES.md §6 "Ignored review items: suppressed in main flow, visible in
   *  Hidden list." A Review candidate the user tapped "Ignore" on is recorded
   *  here by signature (`merchant|amountCents|date`, matching the design
   *  source's dedupe key shape) so a future intake with the EXACT same
   *  merchant/amount/date is suppressed rather than nagging again. Un-hiding
   *  (HiddenReviewSheet) removes the signature so it can surface again.
   *  Persisted — this is a durable user choice, not an ephemeral bridge.
   *  Optional for shape back-compat with hand-built `AppState` fixtures
   *  predating this field (mirrors `edits?` above); `DEFAULTS`/`load()`/
   *  `resetToEmpty()` always populate it ([]). */
  ignoredReviewSigs?: string[];
  /** The user's declared Money Mode / Lens (`lib/modes/types.ts`). Every
   *  existing install migrates to `'survival'` so behaviour is
   *  byte-identical to the shipped default. Onboarding sets this on first
   *  run (not yet wired — defaults hold until the onboarding flow is built).
   *  Optional for shape back-compat with hand-built `AppState` fixtures
   *  predating this field; `DEFAULTS`/`load()` always populate it. */
  moneyMode?: MoneyMode;
  /** User-declared safety buffer (£). Stability + several other lenses read
   *  this; £100 default per the Lovable design's MONEY_MODES.md § 2.2.
   *  Optional for shape back-compat; `DEFAULTS`/`load()` always populate it. */
  bufferAmount?: number;
  /** User-declared outstanding debts. Read by the Debt lens strategy +
   *  amortisation engine (`lib/modes/debtEngine.ts`) to produce payoff
   *  month, weighted APR, and next-due callouts. Empty when the user has
   *  no debts declared. Optional for shape back-compat. */
  debts?: Debt[];
  /** Household lens state — shared-bills ledger. Read by the Household
   *  strategy to compute the user's share of upcoming bills honestly.
   *  Optional for shape back-compat. */
  household?: Household;
  /** User-declared big-ticket plans. Read by the Planning lens strategy +
   *  plan engine (`lib/modes/planEngine.ts`) to produce pace, weeks-
   *  available, required-per-week. Empty when the user hasn't declared any.
   *  Optional for shape back-compat. */
  plans?: Plan[];
  /** Lens / Plus-Pro entitlement state (`lib/lens.ts`). See `LensState`.
   *  Optional for shape back-compat; `DEFAULTS`/`load()` always populate it. */
  lens?: LensState;
  /** Melo companion settings — quiet mode + equipped wardrobe touches. Ports
   *  the Lovable design's `melo` slice 1:1 (folio-melo `src/lib/store.ts`).
   *  Optional for shape back-compat; `DEFAULTS`/`load()` always populate it. */
  melo?: MeloState;
  /** Earned, quiet celebrations (`lib/wins.ts`). Newest first, capped at 40. Surfaced by Insights'
   *  "Tiny wins" section when non-empty. Optional for shape back-compat; `DEFAULTS`/`load()` always
   *  populate it ([]). */
  tinyWins?: TinyWin[];
  /** @rn-engine timeline-verbs — append-only log of sub pause/resume + Review-ignore moments (see
   *  `TimelineEvent`). Newest first, capped at 200. Optional for shape back-compat; `DEFAULTS`/
   *  `load()`/`resetToEmpty()` always populate it ([]). */
  timelineEvents?: TimelineEvent[];
  /** Unreviewed candidates from the intake pipeline (PDF / paste / image / CSV
   *  / TXT) — the PERSISTED review queue, ported 1:1 from the design source
   *  (folio-melo store.ts `reviewQueue`, its v7→v8 seam). Each entry is one row
   *  the user has NOT yet accepted or dismissed. Surfaced on Today as "N
   *  waiting to be checked" and drained one at a time via `resolveReviewItem`.
   *  Unlike the transient `readerCandidates` staging slot above, this queue
   *  survives a restart (the web persists it) — review-before-truth still
   *  holds: queued items are never posted facts and never auto-counted.
   *  Optional for shape back-compat with hand-built `AppState` fixtures
   *  (mirrors `timelineEvents?` above); `DEFAULTS`/`load()`/`resetToEmpty()`
   *  always populate it ([]). */
  reviewQueue?: ReviewItem[];
  /** Income-cadence model (`lib/income.ts`) — see `IncomeSource`. Additive:
   *  when empty/absent, every caller (calendarEvents, storeRoute) falls back
   *  BYTE-IDENTICAL to the legacy single-payday derivation off
   *  `onboarding.payday` / `onboarding.monthlyIncome`, so a monthly-only user's
   *  numbers never change. Optional for shape back-compat with hand-built
   *  `AppState` fixtures predating this field; `DEFAULTS`/`load()`/
   *  `resetToEmpty()` always populate it ([]). */
  incomeSources?: IncomeSource[];
  /** Income-signal (`lib/incomeSignals.ts`) merchants the user tapped "Not this
   *  one" on in `IncomeCaughtSheet` — recorded by normalised merchant key so a
   *  future detection pass on the same merchant is suppressed rather than
   *  nagging again, mirroring `ignoredReviewSigs`'s "dismissed once, quiet
   *  after that" contract. Optional for shape back-compat with hand-built
   *  `AppState` fixtures predating this field; `DEFAULTS`/`load()`/
   *  `resetToEmpty()` always populate it ([]). */
  dismissedIncomeSignals?: string[];
  /** Bill-signal (`lib/caughtBills.ts`) merchants the user tapped "Not this one"
   *  on in `BillCaughtSheet` — DATA_INTELLIGENCE.md phase ⑤(B). Recorded by
   *  normalised merchant key so a future detection pass on the same merchant is
   *  suppressed rather than nagging again, mirroring `dismissedIncomeSignals`'s
   *  "dismissed once, quiet after that" contract exactly. Optional for shape
   *  back-compat with hand-built `AppState` fixtures predating this field;
   *  `DEFAULTS`/`load()`/`resetToEmpty()` always populate it ([]). */
  dismissedBillSignals?: string[];
  /** Merchant→category memory (`lib/merchantMemory.ts`) — DATA_INTELLIGENCE.md
   *  phase ③. Keyed by normalised merchant (`normaliseMerchant`,
   *  `lib/subSignals.ts`); each entry is the user's most-recently-confirmed
   *  category correction for that merchant, so a future statement re-import
   *  can pre-fill the remembered category instead of re-asking the model's
   *  low-confidence guess forever. Capped at `MERCHANT_CATEGORY_CAP` (500),
   *  least-recently-corrected evicted first. Optional for shape back-compat
   *  with hand-built `AppState` fixtures predating this field; `DEFAULTS`/
   *  `load()`/`resetToEmpty()` always populate it ({}). */
  merchantCategories?: MerchantCategoryMap;
};

/** A single unreviewed intake candidate (design source `ReviewItem`, verbatim
 *  shape). Signed pounds — negative = out, positive = in — matches
 *  `Transaction`. */
export type ReviewItem = {
  id: string;
  /** Which intake path produced it. Used only for captions, never logic. */
  source: 'paste' | 'pdf' | 'image' | 'csv' | 'txt' | 'manual';
  merchant: string;
  amount: number;
  /** ISO YYYY-MM-DD if the reader pinned a date. */
  date?: string;
  /** Human hint the reader wrote ("looks like a bill"). */
  hint?: string;
  /** When Folio queued it. Used for sort + 14-day age-out. */
  addedAt: string;
  /** The reader's suggested category (model guess, or a merchant-memory recall —
   *  see `rememberedCategory` below) for the Review screen's category chips to
   *  pre-select. Absent when the reader gave no category guess at all. */
  category?: string;
  /** Present and `true` only when `category` came from remembered merchant
   *  memory (`lib/merchantMemory.ts` `applyMemoryToCandidates`), not a fresh
   *  model/parse guess — lets Review show honest provenance ("remembered from
   *  a past correction") rather than passing memory off as a confident guess. */
  rememberedCategory?: true;
};

/** Melo companion settings (`MeloScreen`). `quietMode` hides the character
 *  (numbers stay); `wardrobe` is up to 3 equipped companion-touch ids. */
export type MeloState = {
  quietMode: boolean;
  wardrobe: string[];
};
/** Persistence key prefix, used only for the parked-future-blob slot name
 *  below (`${KEY}.future.${v}`) — mirrors the web original's localStorage
 *  key. Pre-existing reference that had no backing declaration; added here
 *  rather than left dangling, since it sits in a file this round already owns. */
const KEY = 'folio.state.v1';
/** Current schema version. Bump on every breaking shape change and add
 *  a new entry to `MIGRATIONS` below. Never silently re-key existing data. */
const CURRENT_SCHEMA_VERSION = 8;

/** Non-optional fallback for `AppState.timelineEvents` — same widening issue as `DEFAULT_LENS`. */
const DEFAULT_TIMELINE_EVENTS: TimelineEvent[] = [];

/** Non-optional fallback for `AppState.moneyMode` — same widening issue as
 *  `DEFAULT_LENS` below (the field is optional on `AppState` for shape
 *  back-compat, so `DEFAULTS.moneyMode` reads as `MoneyMode | undefined`). */
const DEFAULT_MONEY_MODE: MoneyMode = 'survival';

/** Non-optional fallback for `AppState.bufferAmount` — same widening issue. */
const DEFAULT_BUFFER_AMOUNT = 100;

/** Retention policy for `transactions` (DATA_INTELLIGENCE.md phase ④(A)).
 *  Raised from the old 200 — 6 months of a moderately active account
 *  (15-20 txns/week) is 400-500 rows, and a bulk statement import can easily
 *  push several times that; 200 silently discarded the majority of any real
 *  backfill with no warning. 2000 gives real headroom for both ordinary daily
 *  use and a multi-year bulk import while still keeping persisted state
 *  bounded. Eviction is always oldest-first (`slice(0, TRANSACTION_CAP)` after
 *  newest-first insertion) and is NEVER silent — see `droppedTransactionCount`
 *  on `AppState`, incremented by exactly how many rows an eviction drops.
 *  Both `addTransaction` and `addTransactionsBatch` funnel through the same
 *  `applyTransactionRetention` helper, so there is one policy with two
 *  entrances, never two competing cap implementations. */
const TRANSACTION_CAP = 2000;

/** Non-optional fallback for `AppState.debts` — same widening issue. Empty,
 *  not the DEFAULTS seed data, since this is used by `load()`/`migrate()`
 *  for a genuinely-missing slot on an existing install, not a fresh install
 *  (a fresh install goes through `DEFAULTS` directly, which does carry the
 *  seed debts). */
const DEFAULT_DEBTS: Debt[] = [];

/** Non-optional fallback for `AppState.plans` — see `DEFAULT_DEBTS`. */
const DEFAULT_PLANS: Plan[] = [];

/** Non-optional fallback for `AppState.incomeSources` — see `DEFAULT_DEBTS`.
 *  Empty means "no income sources declared yet"; every caller falls back to
 *  the legacy single-payday derivation in that case (see `lib/income.ts`). */
const DEFAULT_INCOME_SOURCES: IncomeSource[] = [];

/** Non-optional fallback for `AppState.merchantCategories` — see
 *  `DEFAULT_DEBTS`. Empty means "no corrections remembered yet"; every reader
 *  (`lib/merchantMemory.ts` `recallCategory`/`applyMemoryToCandidates`) treats
 *  a missing/empty map as "nothing to recall", falling back to the model's own
 *  guess. */
const DEFAULT_MERCHANT_CATEGORIES: MerchantCategoryMap = {};

/** Non-optional fallback for `AppState.lens` — `DEFAULTS.lens` widens to
 *  `LensState | undefined` through the `AppState` annotation (the field is
 *  optional for shape back-compat), so callers that need a guaranteed
 *  `LensState` read this constant instead. */
const DEFAULT_LENS: LensState = {
  plusUnlocked: false,
  proUnlocked: false,
  trialCycleId: null,
  trialEndedCycleId: null,
  trialEndAcknowledged: true,
};

/** Non-optional fallback for `AppState.household` — see `DEFAULT_LENS` for
 *  why `DEFAULTS.household` can't be used directly here. */
const DEFAULT_HOUSEHOLD: Household = { partnerName: '', defaultShare: 0.5, subShareOverrides: {} };

/** Non-optional fallback for `AppState.melo` — see `DEFAULT_LENS` for why
 *  `DEFAULTS.melo` can't be used directly here (the field is optional on
 *  `AppState` for shape back-compat). */
const DEFAULT_MELO: MeloState = { quietMode: false, wardrobe: [] };

const SAMPLE_BALANCE: CurrentBalance = {
  amount: 720,
  source: 'sample',
  confidence: 'sample',
  setAt: '2026-06-27T00:00:00.000Z',
};

/** A genuinely empty, honest starting balance for a CLEAN-EMPTY reset. £0 with a
 *  `user-entered` source + `rough` confidence — NOT `sample` (sample implies demo
 *  data the user never entered). A returning clean user has chosen to start from
 *  nothing, so the source label tells the truth: this is their own zero, not a
 *  seeded placeholder. `setAt` is stamped at reset time by `resetToEmpty`. */
const EMPTY_BALANCE: Omit<CurrentBalance, 'setAt'> = {
  amount: 0,
  source: 'user-entered',
  confidence: 'rough',
};

const DEFAULTS: AppState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  pots: [
    {
      id: 'holiday',
      name: 'Holiday · September',
      saved: 420,
      goal: 1200,
      perWeek: 35,
      accent: true,
    },
    { id: 'buffer', name: 'Buffer', saved: 140, goal: 500, perWeek: 20, accent: false },
    { id: 'christmas', name: 'Christmas', saved: 60, goal: 300, perWeek: 15, accent: false },
  ],
  subs: DEFAULT_SUBS,
  subPaused: {},
  subOverrides: {},
  cycles: [
    // Seed two prior cycles so Insights has something to show on first run.
    {
      closedAt: '2026-05-25',
      label: 'May',
      spare: 142,
      tightPoint: 38,
      setAside: 60,
      note: 'Held the line on takeaway.',
    },
    {
      closedAt: '2026-04-25',
      label: 'April',
      spare: 88,
      tightPoint: 24,
      setAside: 50,
      note: 'Tight one — buffer saved it.',
    },
  ],
  onboarding: { done: false, name: '', payday: 25, monthlyIncome: 2180 },
  currentBalance: SAMPLE_BALANCE,
  potLedger: [],
  nextYouNote: '',
  tightPointGoal: null,
  transactions: [],
  droppedTransactionCount: 0,
  edits: [],
  calendarEvents: [],
  calendarFocusDate: null,
  routeFocusDate: null,
  readerCandidates: [],
  ignoredReviewSigs: [],
  reviewQueue: [],
  moneyMode: 'survival',
  bufferAmount: 100,
  // Two seed debts so the Debt lens has honest numbers on first run, mirroring
  // the Lovable design's DEFAULTS. Klarna is interest-free; the loan is a
  // mid-APR personal loan. Balances are rough — the user replaces via a
  // future SheetAddDebt (not yet wired on RN).
  debts: [
    {
      id: 'seed-loan',
      name: 'Personal loan',
      kind: 'loan',
      balance: 2400,
      apr: 12.9,
      minPayment: 120,
      dueDom: 5,
      addedAt: '2026-03-01T00:00:00.000Z',
    },
    {
      id: 'seed-klarna',
      name: 'Klarna sofa',
      kind: 'bnpl',
      balance: 320,
      apr: 0,
      minPayment: 80,
      dueDom: 15,
      addedAt: '2026-05-01T00:00:00.000Z',
    },
  ],
  household: { partnerName: '', defaultShare: 0.5, subShareOverrides: {} },
  // One seed plan so the Planning lens has an honest number on first run,
  // mirroring the Lovable design's DEFAULTS. Illustrative — the user
  // replaces via a future SheetAddPlan (not yet wired on RN).
  plans: [
    {
      id: 'seed-macbook',
      name: 'New MacBook',
      target: 1600,
      saved: 240,
      byDate: '2026-12-15',
      perWeek: 40,
      addedAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  lens: {
    plusUnlocked: false,
    proUnlocked: false,
    trialCycleId: null,
    trialEndedCycleId: null,
    trialEndAcknowledged: true,
  },
  melo: { quietMode: false, wardrobe: [] },
  tinyWins: [],
  timelineEvents: [],
  // Empty by default — a fresh install has NOT declared income sources yet, so
  // every caller falls back to the legacy `onboarding.payday`/`monthlyIncome`
  // single-lump derivation until the user (or the v7→v8 migration, for an
  // existing install) populates this list.
  incomeSources: [],
  dismissedIncomeSignals: [],
  dismissedBillSignals: [],
  merchantCategories: DEFAULT_MERCHANT_CATEGORIES,
};

/** Seed ~10 days of recent activity so Today/Insights have something honest to render.
 *  Called only when there is no persisted blob (uses Date.now). */
function seedTransactions(): Transaction[] {
  const now = Date.now();
  const day = 86_400_000;
  const t = (
    d: number,
    merchant: string,
    amount: number,
    category: Transaction['category'],
  ): Transaction => ({
    id: `seed-${merchant}-${d}`.toLowerCase().replace(/\s+/g, '-'),
    when: new Date(now - d * day).toISOString(),
    merchant,
    amount,
    category,
    source: 'seed',
  });
  return [
    t(0, 'Pret', -4.2, 'food'),
    t(0, 'Tube', -2.8, 'transport'),
    t(1, 'Tesco', -42.1, 'food'),
    t(2, 'Pub', -18.5, 'fun'),
    t(3, 'Coffee', -3.2, 'food'),
    t(4, 'Amazon', -27.99, 'shopping'),
    t(5, 'Spotify', -11.0, 'bills'),
    t(6, 'Uber', -14.3, 'transport'),
    t(7, 'Tesco', -36.4, 'food'),
    t(8, 'Cinema', -16.0, 'fun'),
    t(11, 'Salary', 1840.0, 'income'),
  ];
}

/** Per-version migration steps. Each function receives the previously-
 *  migrated blob and returns the next-version blob. Never mutate in place.
 *  Add a new entry for every `CURRENT_SCHEMA_VERSION` bump. */
const MIGRATIONS: Record<number, (prev: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 → v2: introduce currentBalance, potLedger, nextYouNote, schemaVersion.
  // Pre-existing installs become "sample"-source balance so the user sees the
  // honest source label and can correct it from onboarding/More.
  // Backfill potLedger from existing pot.saved as a single synthetic deposit
  // per pot dated 30 days ago, so the first ritual after upgrade reads honest
  // recent savings instead of £0 for a month. Source labelled "backfill" so
  // it's traceable in the ledger.
  2: (prev) => {
    const prior = prev as Partial<AppState>;
    const existingLedger = prior.potLedger ?? [];
    const seedAt = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const backfill: PotLedgerEntry[] =
      existingLedger.length === 0 && Array.isArray(prior.pots)
        ? prior.pots
            .filter((p) => p && p.saved > 0)
            .map((p) => ({
              id: `pl-backfill-${p.id}`,
              potId: p.id,
              at: seedAt,
              kind: 'deposit' as const,
              amount: p.saved,
              source: 'backfill',
            }))
        : [];
    return {
      ...prev,
      schemaVersion: 2,
      currentBalance: prior.currentBalance ?? SAMPLE_BALANCE,
      potLedger: existingLedger.length > 0 ? existingLedger : backfill,
      nextYouNote: prior.nextYouNote ?? '',
    };
  },
  // v2 → v3: introduce the transaction correction history (`edits`). Pre-v3
  // installs have no edits, so default to an empty array. Existing edits (none
  // before v3) are preserved if somehow present. See ENGINES.md §6 "Editing
  // existing transactions" — the edit chain is what makes a correction
  // recoverable rather than destructive.
  3: (prev) => {
    const prior = prev as Partial<AppState>;
    return {
      ...prev,
      schemaVersion: 3,
      edits: prior.edits ?? [],
    };
  },
  // v3 → v4: introduce the lens/mode-engine slots ported from the Lovable
  // design (moneyMode, bufferAmount, debts, household, plans, lens). Every
  // pre-v4 install migrates to the shipped-default Survival lens with no
  // paid entitlement, so behaviour is byte-identical until the user opts
  // into a different lens. Debts/plans default to the same honest seed data
  // DEFAULTS uses (not the user's own — this is a migration of a state
  // *shape*, not user data, so falling back to the documented seed is
  // consistent with a fresh-install experience for a slot that didn't exist).
  4: (prev) => {
    const prior = prev as Partial<AppState>;
    return {
      ...prev,
      schemaVersion: 4,
      moneyMode: prior.moneyMode ?? 'survival',
      bufferAmount: prior.bufferAmount ?? 100,
      debts: prior.debts ?? DEFAULTS.debts,
      household: prior.household ?? DEFAULT_HOUSEHOLD,
      plans: prior.plans ?? DEFAULTS.plans,
      lens: prior.lens ?? DEFAULT_LENS,
    };
  },
  // v4 → v5: introduce the Melo companion settings slot (quietMode, wardrobe)
  // ported from the Lovable design's `melo` slice. Pre-v5 installs default to
  // quiet mode off and an empty wardrobe — byte-identical behaviour until the
  // user opens MeloScreen and changes something.
  5: (prev) => {
    const prior = prev as Partial<AppState>;
    return {
      ...prev,
      schemaVersion: 5,
      melo: prior.melo ?? DEFAULT_MELO,
    };
  },
  // v5 → v6: introduce the timeline event log (`timelineEvents`), the missing engine behind the
  // Timeline screen's verb-state rows (sub paused/resumed, Review-ignored). Pre-v6 installs have no
  // log, so default to empty — byte-identical behaviour (an empty log renders no verb-state rows)
  // until the user pauses a sub or ignores a Review candidate for the first time post-upgrade.
  6: (prev) => {
    const prior = prev as Partial<AppState>;
    return {
      ...prev,
      schemaVersion: 6,
      timelineEvents: prior.timelineEvents ?? DEFAULT_TIMELINE_EVENTS,
    };
  },
  // v6 → v7: introduce the persisted `reviewQueue` for unreviewed intake
  // candidates (the design source's v7→v8 seam, ported 1:1). Empty on
  // upgrade — reader paths populate it going forward.
  7: (prev) => {
    const prior = prev as Partial<AppState>;
    return {
      ...prev,
      schemaVersion: 7,
      reviewQueue: Array.isArray(prior.reviewQueue) ? prior.reviewQueue : [],
    };
  },
  // v7 → v8: introduce the income-cadence model (`incomeSources`, see
  // `lib/income.ts`). Every pre-v8 install synthesizes exactly ONE monthly
  // source ("Pay") from its existing `onboarding.payday` + `.monthlyIncome`, so
  // the legacy single-lump behaviour survives as this user's honest starting
  // data rather than being silently discarded. If `incomeSources` already
  // exists (a blob that somehow pre-dates this schema bump but already carries
  // the field), it is preserved untouched rather than re-synthesized.
  8: (prev) => {
    const prior = prev as Partial<AppState>;
    if (Array.isArray(prior.incomeSources)) {
      return { ...prev, schemaVersion: 8, incomeSources: prior.incomeSources };
    }
    const onboarding = prior.onboarding;
    const payday = onboarding?.payday ?? DEFAULTS.onboarding.payday;
    const monthlyIncome = onboarding?.monthlyIncome ?? DEFAULTS.onboarding.monthlyIncome;
    const synthesized: IncomeSource[] = [
      {
        id: 'income-migrated-pay',
        label: 'Pay',
        cadence: 'monthly',
        dayOfMonth: payday,
        amount: monthlyIncome,
        source: 'onboarding',
      },
    ];
    return {
      ...prev,
      schemaVersion: 8,
      incomeSources: synthesized,
    };
  },
};

function migrate(parsed: Record<string, unknown>): Record<string, unknown> {
  const startVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;
  if (startVersion > CURRENT_SCHEMA_VERSION) {
    // Safe failure mode: persisted state is newer than this binary. Warn,
    // keep the raw blob in a parking slot, and load defaults rather than
    // silently dropping fields. In-memory port: park into `futureBlobs`
    // instead of window.localStorage (web original parked under a
    // `${KEY}.future.${v}` storage key).
    try {
      futureBlobs[`${KEY}.future.${startVersion}`] = parsed;
      // eslint-disable-next-line no-console
      console.warn(
        `[folio] persisted schema v${startVersion} is newer than code v${CURRENT_SCHEMA_VERSION}; parked and ignored.`,
      );
    } catch {
      /* ignore */
    }
    return { ...DEFAULTS };
  }
  let current = parsed;
  for (let v = startVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) continue;
    current = step(current);
  }
  return current;
}

// ---------- In-memory persistence (replaces window.localStorage) ----------
// `persistedBlob` is the single in-memory record the web original kept in
// localStorage under `KEY`. `null` = nothing persisted yet (first run).
// `futureBlobs` mirrors the web original's `${KEY}.future.${v}` parking slots.
// Wire @folio/storage + op-sqlite over these two later (BUILD_PLAN §3).
let persistedBlob: Record<string, unknown> | null = null;
const futureBlobs: Record<string, Record<string, unknown>> = {};

function load(): AppState {
  try {
    if (!persistedBlob) {
      // First run on this device — seed transactions now.
      return { ...DEFAULTS, transactions: seedTransactions() };
    }
    // Deep-clone the persisted blob so migrate/load never mutate the stored copy.
    const parsedRaw = JSON.parse(JSON.stringify(persistedBlob)) as Record<string, unknown>;
    const migrated = migrate(parsedRaw) as Partial<AppState>;
    const loaded: AppState = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      pots: migrated.pots ?? DEFAULTS.pots,
      subs: migrated.subs ?? DEFAULTS.subs,
      subPaused: migrated.subPaused ?? {},
      subOverrides: migrated.subOverrides ?? {},
      cycles: migrated.cycles ?? DEFAULTS.cycles,
      onboarding: { ...DEFAULTS.onboarding, ...(migrated.onboarding ?? {}) },
      currentBalance: migrated.currentBalance ?? SAMPLE_BALANCE,
      potLedger: migrated.potLedger ?? [],
      nextYouNote: migrated.nextYouNote ?? '',
      tightPointGoal: migrated.tightPointGoal ?? null,
      transactions: migrated.transactions ?? seedTransactions(),
      droppedTransactionCount:
        typeof migrated.droppedTransactionCount === 'number' ? migrated.droppedTransactionCount : 0,
      edits: migrated.edits ?? [],
      calendarEvents: migrated.calendarEvents ?? [],
      calendarFocusDate: null,
      routeFocusDate: null,
      // Transient review queue — never restored from a persisted blob (it is
      // excluded from getPersistBlob), so a load always starts it empty.
      readerCandidates: [],
      ignoredReviewSigs: migrated.ignoredReviewSigs ?? [],
      reviewQueue: Array.isArray(migrated.reviewQueue) ? migrated.reviewQueue : [],
      moneyMode: migrated.moneyMode ?? DEFAULT_MONEY_MODE,
      bufferAmount: migrated.bufferAmount ?? DEFAULT_BUFFER_AMOUNT,
      debts: migrated.debts ?? DEFAULT_DEBTS,
      household: migrated.household ?? DEFAULT_HOUSEHOLD,
      plans: migrated.plans ?? DEFAULT_PLANS,
      lens: migrated.lens ?? DEFAULT_LENS,
      melo: migrated.melo ?? DEFAULT_MELO,
      tinyWins: migrated.tinyWins ?? [],
      timelineEvents: migrated.timelineEvents ?? DEFAULT_TIMELINE_EVENTS,
      incomeSources: migrated.incomeSources ?? DEFAULT_INCOME_SOURCES,
      dismissedIncomeSignals: migrated.dismissedIncomeSignals ?? [],
      dismissedBillSignals: migrated.dismissedBillSignals ?? [],
      merchantCategories: migrated.merchantCategories ?? DEFAULT_MERCHANT_CATEGORIES,
    };
    // Sweep stale sub-nudges on load — an override whose nudged renewal
    // date has already passed is consumed and deleted. Matches ENGINES.md
    // § 6 "sub-nudge clears the day after nudgedDate".
    return { ...loaded, subOverrides: sweepStaleOverrides(loaded.subs, loaded.subOverrides) };
  } catch {
    return DEFAULTS;
  }
}

/** Drop overrides whose effective renewal has already passed
 *  (`nextRenewalDaysAway + delta < 0`), or whose sub no longer exists.
 *  Pure — call from load and from the Today mount sweep. */
function sweepStaleOverrides(
  subs: Sub[],
  overrides: Record<string, number>,
): Record<string, number> {
  const byName = new Map(subs.map((s) => [s.name, s] as const));
  const next: Record<string, number> = {};
  for (const [name, delta] of Object.entries(overrides)) {
    const sub = byName.get(name);
    if (!sub) continue;
    if (sub.nextRenewalDaysAway + delta < 0) continue;
    next[name] = delta;
  }
  return next;
}

/** Public sweep — Today calls this on mount so an override that aged
 *  out between sessions is dropped before any reads. */
export function sweepSubOverrides() {
  const next = sweepStaleOverrides(state.subs, state.subOverrides);
  const changed =
    Object.keys(next).length !== Object.keys(state.subOverrides).length ||
    Object.entries(next).some(([k, v]) => state.subOverrides[k] !== v);
  if (changed) setPartial({ subOverrides: next });
}

let state: AppState = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  // In-memory port: snapshot the current state into the persisted blob.
  // Web original wrote JSON to window.localStorage; here we keep a structural
  // copy so a later migrate() never aliases live state.
  try {
    persistedBlob = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  } catch {
    /* serialization failure — ignore, matches web quota/private-mode swallow */
  }
}

export function getState(): AppState {
  return state;
}

/** Serialize the current state to a JSON string for native persistence.
 *  Pure + Node-safe — the native adapter (lib/persist.ts) writes the returned
 *  string to disk. Excludes the ephemeral cross-screen bridges
 *  (`calendarFocusDate` / `routeFocusDate`) and the transient statement-reader
 *  review queue (`readerCandidates`): they are read-once / review-before-truth
 *  hand-offs that `load()` already resets, so persisting them would be noise
 *  and — for `readerCandidates` — would let unreviewed candidates survive a
 *  restart, which the review-before-truth rule forbids.
 *  Per ENGINES §7 store-migration / RN_PORT "Store migration". */
export function getPersistBlob(): string {
  const {
    calendarFocusDate: _f,
    routeFocusDate: _r,
    readerCandidates: _rc,
    ...persistable
  } = state;
  return JSON.stringify(persistable);
}

/** Hydrate the store from a persisted JSON blob (read off disk by the native
 *  adapter). Runs the SAME path as `load()`: park the raw blob into
 *  `persistedBlob`, then `setPartial` the loaded+migrated state so listeners
 *  fire and the round-trip is identical to a first-run load. A malformed blob
 *  is a safe no-op (matches `load()`'s catch). Pure + Node-safe. */
export function hydrateFromBlob(raw: string): void {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return; // malformed blob — leave current state untouched.
  }
  if (parsed === null || typeof parsed !== 'object') return;
  // Route through the persisted-blob slot so load() applies migrate() + the
  // same field defaulting as a cold start, then publish via setPartial.
  persistedBlob = parsed;
  setPartial(load());
}

export function setPartial(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  persist();
  emit();
}

export function setPots(pots: Pot[] | ((prev: Pot[]) => Pot[])) {
  const next = typeof pots === 'function' ? pots(state.pots) : pots;
  setPartial({ pots: next });
}

export function setSubs(subs: Sub[] | ((prev: Sub[]) => Sub[])) {
  const next = typeof subs === 'function' ? subs(state.subs) : subs;
  setPartial({ subs: next });
}

export function removeSub(name: string) {
  const { [name]: _gone, ...restPaused } = state.subPaused;
  const { [name]: _gone2, ...restOverrides } = state.subOverrides;
  setPartial({
    subs: state.subs.filter((s) => s.name !== name),
    subPaused: restPaused,
    subOverrides: restOverrides,
  });
}

export function addToPot(id: string, amount: number, source: string = 'manual') {
  if (!(amount > 0)) return;
  const before = state.pots.find((p) => p.id === id);
  const entry: PotLedgerEntry = {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    potId: id,
    at: new Date().toISOString(),
    kind: 'deposit',
    amount,
    source,
  };
  const nextPots = state.pots.map((p) => (p.id === id ? { ...p, saved: p.saved + amount } : p));
  setPartial({
    pots: nextPots,
    potLedger: [entry, ...state.potLedger].slice(0, 500),
  });

  // Emit a Melo reaction if this deposit tips the pot over the goal line (or over the halfway
  // threshold on the way up). RN port of folio-melo lib/store.ts `addToPot` (byte-faithful
  // thresholds/copy/durations). Reactions are the visual language of MELO_EMOTIONAL_ENGINE.md § 3 —
  // no cooldown/dedupe/queue here; that is the separate `meloReactions` engine (ENGINES.md § 9.4).
  if (before && before.goal > 0) {
    const after = nextPots.find((p) => p.id === id);
    if (after) {
      const beforeRatio = before.saved / before.goal;
      const afterRatio = after.saved / after.goal;
      void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
        if (beforeRatio < 1 && afterRatio >= 1) {
          emitMeloReaction('pots-inline', {
            mood: 'cheer',
            pose: 'safe',
            line: `${after.name.split(' · ')[0] ?? after.name} is full. Small yes.`,
            durationMs: 4200,
            key: id,
          });
        } else if (beforeRatio < 0.5 && afterRatio >= 0.5) {
          emitMeloReaction('pots-inline', {
            mood: 'curious',
            pose: 'none',
            line: 'Halfway. Quietly working.',
            durationMs: 3400,
            key: id,
          });
        }
      });
    }
  }
}

/** ENGINES.md § 4 "Pot rules — borrow/repay ledger" + § 6 "Shortfall can borrow from a pot to lift
 *  the path back up" (RN port of folio-melo lib/store.ts `borrowFromPot`, byte-faithful). Reduces the
 *  pot's `saved` amount and writes a `borrow` ledger entry. Refuses to go negative unless the pot has
 *  explicitly opted in via `allowNegative`. Returns true if the borrow was applied, false on a no-op
 *  (non-positive amount, unknown pot, or a hard-capped pot that can't cover the draw). This is the
 *  correct write for "pull money OUT of a pot" — unlike `addToPot`, whose `amount > 0` guard makes a
 *  negative-amount call silently no-op. */
export function borrowFromPot(
  id: string,
  amount: number,
  source: string = 'shortfall-borrow',
): boolean {
  if (!(amount > 0)) return false;
  const pot = state.pots.find((p) => p.id === id);
  if (!pot) return false;
  if (!pot.allowNegative && pot.saved < amount) return false;
  const entry: PotLedgerEntry = {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    potId: id,
    at: new Date().toISOString(),
    kind: 'borrow',
    amount,
    source,
  };
  setPartial({
    pots: state.pots.map((p) => (p.id === id ? { ...p, saved: p.saved - amount } : p)),
    potLedger: [entry, ...state.potLedger].slice(0, 500),
  });
  // Whisper on Today so the borrow feels acknowledged, not silent.
  void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
    emitMeloReaction('today-header', {
      mood: 'calm',
      pose: 'safe',
      line: `Borrowed £${amount} from ${pot.name.split(' · ')[0] ?? pot.name}. Ritual will remind you to repay.`,
      durationMs: 4200,
      key: `borrow-${id}`,
    });
  });
  return true;
}

/** ENGINES.md § 4 "Pot rules — borrow/repay ledger". Records a `repay` entry against a pot the user
 *  previously borrowed from — the ONLY write the Payday Ritual's repay-a-pot step makes (RN port of
 *  folio-melo lib/store.ts `repayToPot`). A repay is a ledger record, not a balance change: it does
 *  not touch `saved` (the money already sits in the pot; repaying just clears the owed marker so
 *  `owedByPot` derivations stop flagging it). No-op on a non-positive amount. */
export function repayToPot(id: string, amount: number, source: string = 'manual') {
  if (!(amount > 0)) return;
  const entry: PotLedgerEntry = {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    potId: id,
    at: new Date().toISOString(),
    kind: 'repay',
    amount,
    source,
  };
  setPartial({ potLedger: [entry, ...state.potLedger].slice(0, 500) });
}

/** ENGINES.md § 4 "Pot borrow hard-capped by default" (RN port of folio-melo lib/store.ts
 *  `setPotAllowNegative`). Toggles the per-pot opt-in that lets a buffer pot go briefly negative when
 *  borrowed from, instead of the default hard cap at £0. */
export function setPotAllowNegative(id: string, value: boolean) {
  setPartial({
    pots: state.pots.map((p) => (p.id === id ? { ...p, allowNegative: value } : p)),
  });
}

/** Awards a Tiny Win the first (and only) time this kind fires (RN port of folio-melo lib/store.ts
 *  `awardTinyWin`, per `lib/wins.ts`'s one-shot-per-kind contract). No-op if already awarded. Newest
 *  first, capped at 40. Returns the new win, or null if this kind was already awarded. */
export function awardTinyWin(kind: TinyWinKind): TinyWin | null {
  const existing = state.tinyWins ?? [];
  if (hasWin(existing, kind)) return null;
  const win = makeWin(kind);
  setPartial({ tinyWins: [win, ...existing].slice(0, 40) });
  return win;
}

/** Mark a sub as "just used" — resets lastUsedDaysAgo to 0 and nudges
 *  the monthly count up by one, so the Subs screen pulse turns green. */
export function markSubUsed(name: string) {
  setSubs((prev) =>
    prev.map((s) =>
      s.name === name ? { ...s, lastUsedDaysAgo: 0, usesPerMonth: s.usesPerMonth + 1 } : s,
    ),
  );
}

export function togglePaused(name: string, value?: boolean) {
  const current = !!state.subPaused[name];
  const next = value ?? !current;
  setPartial({ subPaused: { ...state.subPaused, [name]: next } });

  // Sub toggled → whisper on the subs surface. RN port of folio-melo lib/store.ts `togglePaused`
  // (byte-faithful mood/pose/copy/durations). MELO_EMOTIONAL_ENGINE.md § 3 "sub paused" / "sub
  // resumed" reactions — cooldown/dedupe is the separate `meloReactions` engine (ENGINES.md § 9.4).
  if (current !== next) {
    // @rn-engine timeline-verbs — log the pause/resume so Timeline can render the moment as a
    // verb-state row. A no-op toggle (current === next) logs nothing, same guard as the reaction.
    logTimelineEvent(next ? 'sub-paused' : 'sub-resumed', name);
    void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
      emitMeloReaction('subs-inline', {
        mood: next ? 'calm' : 'curious',
        pose: next ? 'safe' : 'check',
        line: next
          ? `${name} paused for one cycle. I'll resume it after.`
          : `${name} back on. I'll watch the timing.`,
        durationMs: 4000,
        key: name,
      });
    });
  }
}

export function pauseMany(names: string[], value: boolean) {
  const next = { ...state.subPaused };
  for (const n of names) next[n] = value;
  setPartial({ subPaused: next });
}

export function addCycle(c: CycleRecord) {
  // The note the user just wrote at cycle close becomes "past-you's line"
  // for the next ritual. Clearing it here means the next cycle starts with
  // a blank input rather than echoing the same note forever.
  setPartial({ cycles: [c, ...state.cycles].slice(0, 24), nextYouNote: '' });
}

export function setOnboarding(o: Partial<Onboarding>) {
  setPartial({ onboarding: { ...state.onboarding, ...o } });
}

/** ENGINES.md § 6 "Starting balance — source + confidence". The single
 *  write path for the user's current account position. Always stamps
 *  `setAt` so the source label can show "you set this 2 days ago" later. */
export function setCurrentBalance(next: Omit<CurrentBalance, 'setAt'>) {
  setPartial({ currentBalance: { ...next, setAt: new Date().toISOString() } });
}

/** Written by ScreenPaydayRitual step 4 — the line for next-you. */
export function setNextYouNote(note: string) {
  setPartial({ nextYouNote: note });
}

export function setTightPointGoal(amount: number | null) {
  setPartial({ tightPointGoal: amount });
}

/* ---------- Income sources (`lib/income.ts`) ---------- */

/** Replace the whole income-source list. Accepts either a value or an updater
 *  over the previous list, mirroring `setPots`/`setSubs`. */
export function setIncomeSources(
  sources: IncomeSource[] | ((prev: IncomeSource[]) => IncomeSource[]),
) {
  const prev = state.incomeSources ?? DEFAULT_INCOME_SOURCES;
  const next = typeof sources === 'function' ? sources(prev) : sources;
  setPartial({ incomeSources: next });
}

/** Add a new source, or replace the existing one with the same `id`. Immutable
 *  — never mutates the previous list. */
export function upsertIncomeSource(sourceEntry: IncomeSource) {
  const prev = state.incomeSources ?? DEFAULT_INCOME_SOURCES;
  const exists = prev.some((s) => s.id === sourceEntry.id);
  const next = exists
    ? prev.map((s) => (s.id === sourceEntry.id ? sourceEntry : s))
    : [...prev, sourceEntry];
  setPartial({ incomeSources: next });
}

/** Remove a source by id. No-op if the id is not present. */
export function removeIncomeSource(id: string) {
  const prev = state.incomeSources ?? DEFAULT_INCOME_SOURCES;
  setPartial({ incomeSources: prev.filter((s) => s.id !== id) });
}

/** Normalise a merchant name into the `dismissedIncomeSignals` key — matches
 *  `lib/caughtIncome.ts`'s own normalisation so a dismissal always matches the
 *  signal it was raised against, case/whitespace-insensitively. */
function normaliseIncomeSignalKey(merchant: string): string {
  return merchant.trim().toLowerCase();
}

/** Record a detected income-signal merchant as dismissed (`IncomeCaughtSheet`'s
 *  "Not this one"). A future detection pass over the same merchant is
 *  suppressed rather than surfacing the sheet again — mirrors
 *  `addIgnoredReviewSig`'s "said no once, stays quiet" contract. Idempotent. */
export function dismissIncomeSignal(merchant: string) {
  const key = normaliseIncomeSignalKey(merchant);
  const current = state.dismissedIncomeSignals ?? [];
  if (current.includes(key)) return;
  setPartial({ dismissedIncomeSignals: [key, ...current] });
}

/* ---------- Bill signals (`lib/caughtBills.ts`) — DATA_INTELLIGENCE.md phase ⑤(B) ---------- */

/** Record a detected bill-signal merchant as dismissed (`BillCaughtSheet`'s
 *  "Not this one"). A future detection pass over the same merchant is
 *  suppressed rather than surfacing the sheet again — mirrors
 *  `dismissIncomeSignal`'s "said no once, stays quiet" contract exactly.
 *  Idempotent. */
export function dismissBillSignal(merchant: string) {
  const key = normaliseIncomeSignalKey(merchant);
  const current = state.dismissedBillSignals ?? [];
  if (current.includes(key)) return;
  setPartial({ dismissedBillSignals: [key, ...current] });
}

/* ---------- Merchant→category memory (`lib/merchantMemory.ts`) ---------- */

/** Record (or update) the user's category correction for a merchant —
 *  `ReviewScreen.tsx`'s category-chip pick / edit-transaction sheet is the
 *  intended caller. Upserts by normalised merchant key (`normaliseMerchant`,
 *  `lib/subSignals.ts`).
 *
 *  FLIP THRESHOLD (anti-thrash / anti one-tap-poisoning): a correction that
 *  agrees with the existing committed category is a plain confirmation —
 *  `hits` increments, `correctedAt` refreshes, no flip needed. A correction
 *  that DISAGREES does not overwrite the committed category on the spot;
 *  it is staged as `pendingCategory`/`pendingCount` and only promoted to the
 *  committed category once the SAME new category has been chosen twice in a
 *  row. A disagreeing correction that doesn't match the currently-pending
 *  category (including a correction back to the committed one) resets
 *  pending to just this one attempt — one mis-tap never flips, only two
 *  consecutive agreeing corrections do. `hits` still increments on every
 *  call, matching the pre-existing "confirms this merchant" contract.
 *  `correctedAt` is always stamped to now, which both records provenance and
 *  is the signal the eviction policy below reads. A brand new merchant
 *  writes immediately at `hits: 1` — first-ever corrections are never
 *  pending. Caps the map at `MERCHANT_CATEGORY_CAP` (500) distinct merchants
 *  — once full, a genuinely new merchant evicts the single
 *  least-recently-corrected entry (oldest `correctedAt`) to make room, so the
 *  map self-bounds instead of growing forever. */
export function rememberMerchantCategory(merchant: string, category: string) {
  const key = normaliseMerchant(merchant);
  const current = state.merchantCategories ?? DEFAULT_MERCHANT_CATEGORIES;
  const existing = current[key];
  const correctedAt = new Date().toISOString();

  if (existing) {
    const nextEntry = buildFlipEntry(existing, category, correctedAt);
    setPartial({ merchantCategories: { ...current, [key]: nextEntry } });
    return;
  }

  const nextEntry = { category, correctedAt, hits: 1 };
  const entries = Object.entries(current);
  if (entries.length < MERCHANT_CATEGORY_CAP) {
    setPartial({ merchantCategories: { ...current, [key]: nextEntry } });
    return;
  }

  // At capacity and this is a new merchant — evict the least-recently-
  // corrected entry first to make room.
  const oldest = entries.reduce((a, b) => (a[1].correctedAt <= b[1].correctedAt ? a : b));
  const rest = { ...current };
  delete rest[oldest[0]];
  setPartial({ merchantCategories: { ...rest, [key]: nextEntry } });
}

/** Pure helper for `rememberMerchantCategory`'s flip-threshold decision on an
 *  EXISTING entry — see that function's doc for the full contract. Kept
 *  separate so the three outcomes (agree / new pending / promote) are each a
 *  single, testable branch. */
function buildFlipEntry(
  existing: MerchantCategoryMemory,
  category: string,
  correctedAt: string,
): MerchantCategoryMemory {
  const hits = existing.hits + 1;

  // Agrees with the committed category — plain confirmation, clears any
  // stale pending state from an earlier abandoned disagreement.
  if (category === existing.category) {
    return { category, correctedAt, hits };
  }

  // Disagrees, and matches the currently-pending category — second time in a
  // row, so promote it to committed and clear pending.
  if (existing.pendingCategory === category) {
    return { category, correctedAt, hits };
  }

  // Disagrees, and doesn't match any pending category (first disagreement,
  // or a different disagreement than what was pending) — stage it as the
  // new pending candidate; the committed category is untouched.
  return {
    category: existing.category,
    correctedAt,
    hits,
    pendingCategory: category,
    pendingCount: 1,
  };
}

/** Remove a merchant's remembered category entirely. No-op if the merchant
 *  has no remembered correction. */
export function forgetMerchantCategory(merchant: string) {
  const key = normaliseMerchant(merchant);
  const current = state.merchantCategories ?? DEFAULT_MERCHANT_CATEGORIES;
  if (!(key in current)) return;
  const { [key]: _removed, ...rest } = current;
  setPartial({ merchantCategories: rest });
}

/* ---------- Lens / Money Mode engine (ports folio-melo `lib/store.ts` 1:1) ---------- */

/** The user's declared Money Mode / Lens. See `lib/modes/types.ts`. */
export function setMoneyMode(mode: MoneyMode) {
  setPartial({ moneyMode: mode });
}

/** User-declared safety buffer for Stability + other buffer-aware lenses. */
export function setBufferAmount(amount: number) {
  setPartial({ bufferAmount: Math.max(0, Math.round(amount)) });
}

/** Plus-tier entitlement setter. */
export function setLensPlusUnlocked(unlocked: boolean) {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  setPartial({ lens: { ...lens, plusUnlocked: unlocked } });
}

/** Pro-tier entitlement setter. Pro implies Plus — flipping `proUnlocked` on
 *  also lifts `plusUnlocked` so downstream `canAccess(plusLens)` stays true. */
export function setLensProUnlocked(unlocked: boolean) {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  setPartial({
    lens: {
      ...lens,
      proUnlocked: unlocked,
      plusUnlocked: unlocked ? true : lens.plusUnlocked,
    },
  });
}

/** Start a one-cycle free trial that unlocks every paid lens together.
 *  `cycleId` is the anchor date (see `lib/lens.ts` `useLens().startTrial`). */
export function startLensTrial(cycleId: string) {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  setPartial({
    lens: {
      ...lens,
      trialCycleId: cycleId,
      // A fresh trial supersedes any lingering ack state from the last one.
      trialEndedCycleId: null,
      trialEndAcknowledged: true,
    },
  });
}

/** End the active trial (called by the Payday Ritual at cycle close). */
export function endLensTrial() {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  setPartial({ lens: { ...lens, trialCycleId: null } });
}

/** User has seen the "trial ended" prompt on Today — don't show it again. */
export function acknowledgeTrialEnd() {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  setPartial({ lens: { ...lens, trialEndAcknowledged: true } });
}

/* ---------- Melo companion settings (`MeloScreen`) ---------- */

/** Patch the Melo companion settings (quiet mode / wardrobe). Immutable —
 *  merges onto the current `melo` slice (or the default if absent). */
export function setMelo(patch: Partial<MeloState>) {
  const melo: MeloState = state.melo ?? DEFAULT_MELO;
  setPartial({ melo: { ...melo, ...patch } });
}

/* ---------- Debts (Debt lens) ---------- */

export function addDebt(d: Omit<Debt, 'id' | 'addedAt'> & { id?: string; addedAt?: string }): Debt {
  const full: Debt = {
    id: d.id ?? `debt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: d.name,
    kind: d.kind,
    balance: Math.max(0, d.balance),
    apr: d.apr,
    minPayment: d.minPayment,
    dueDom: d.dueDom,
    addedAt: d.addedAt ?? new Date().toISOString(),
  };
  setPartial({ debts: [...(state.debts ?? []), full] });
  return full;
}

export function removeDebt(id: string) {
  setPartial({ debts: (state.debts ?? []).filter((d) => d.id !== id) });
}

/** Log a payment against a debt — decrements the balance, never below £0. */
export function logDebtPayment(id: string, amount: number) {
  if (!(amount > 0)) return;
  setPartial({
    debts: (state.debts ?? []).map((d) =>
      d.id === id ? { ...d, balance: Math.max(0, d.balance - amount) } : d,
    ),
  });
}

/** Reverses a logged payment — increments the balance back by `amount`. Used by LogPaymentSheet's
 *  Tier-1 undo window (useUndo/showUndo) so tapping Undo restores exactly what was paid, mirroring
 *  the pattern EditTxnSheet uses for its own undo snapshot-restore. */
export function undoDebtPayment(id: string, amount: number) {
  if (!(amount > 0)) return;
  setPartial({
    debts: (state.debts ?? []).map((d) =>
      d.id === id ? { ...d, balance: d.balance + amount } : d,
    ),
  });
}

/* ---------- Plans (Planning lens) ---------- */

export function addPlan(p: Omit<Plan, 'id' | 'addedAt'> & { id?: string; addedAt?: string }): Plan {
  const full: Plan = {
    id: p.id ?? `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: p.name,
    target: Math.max(0, p.target),
    saved: Math.max(0, p.saved),
    byDate: p.byDate,
    perWeek: Math.max(0, p.perWeek),
    addedAt: p.addedAt ?? new Date().toISOString(),
  };
  setPartial({ plans: [...(state.plans ?? []), full] });
  return full;
}

export function removePlan(id: string) {
  setPartial({ plans: (state.plans ?? []).filter((p) => p.id !== id) });
}

export function addToPlan(id: string, amount: number) {
  if (!(amount > 0)) return;
  setPartial({
    plans: (state.plans ?? []).map((p) => (p.id === id ? { ...p, saved: p.saved + amount } : p)),
  });
}

/* ---------- Household (Household lens) ---------- */

export function setHousehold(patch: Partial<Household>) {
  const household = state.household ?? DEFAULT_HOUSEHOLD;
  setPartial({ household: { ...household, ...patch } });
}

export function setSubShareOverride(subName: string, share: number) {
  const household = state.household ?? DEFAULT_HOUSEHOLD;
  setPartial({
    household: {
      ...household,
      subShareOverrides: {
        ...household.subShareOverrides,
        [subName]: Math.max(0, Math.min(1, share)),
      },
    },
  });
}

export function removeSubShareOverride(subName: string) {
  const household = state.household ?? DEFAULT_HOUSEHOLD;
  const { [subName]: _gone, ...rest } = household.subShareOverrides;
  setPartial({ household: { ...household, subShareOverrides: rest } });
}

/** Single retention policy for `transactions` — the ONE place that caps the
 *  list and honestly accounts for any eviction. `addTransaction` and
 *  `addTransactionsBatch` are the two entrances; both funnel through this
 *  helper rather than each rolling its own `.slice(0, N)`, so the cap and the
 *  drop-count accounting can never drift apart between the two call paths.
 *  Newest-first list in, oldest-evicted-first, honest count out. Pure. */
function applyTransactionRetention(
  merged: readonly Transaction[],
  priorDroppedCount: number,
): { transactions: Transaction[]; droppedTransactionCount: number } {
  if (merged.length <= TRANSACTION_CAP) {
    return { transactions: [...merged], droppedTransactionCount: priorDroppedCount };
  }
  const evicted = merged.length - TRANSACTION_CAP;
  return {
    transactions: merged.slice(0, TRANSACTION_CAP),
    droppedTransactionCount: priorDroppedCount + evicted,
  };
}

export function addTransaction(
  t: Omit<Transaction, 'id' | 'when'> & { id?: string; when?: string },
): Transaction {
  const full: Transaction = {
    id: t.id ?? `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    when: t.when ?? new Date().toISOString(),
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    source: t.source,
  };
  const { transactions, droppedTransactionCount } = applyTransactionRetention(
    [full, ...state.transactions],
    state.droppedTransactionCount ?? 0,
  );
  setPartial({ transactions, droppedTransactionCount });
  return full;
}

/** Batch import entrance to the same retention policy as `addTransaction` —
 *  one `setPartial` for the whole batch instead of one per row, so a bulk
 *  statement import (potentially hundreds of rows) doesn't force hundreds of
 *  individual full-state reserialize + persist + emit cycles the way a loop
 *  calling `addTransaction` per row would (DATA_INTELLIGENCE.md §5(A)).
 *
 *  Ordering matches what a `for (const row of rows) addTransaction(row)` loop
 *  would have produced (the exact pattern this replaces at its call sites —
 *  `VisualizerScreen.tsx`'s "Add all"): each successive `addTransaction` call
 *  prepends onto the front, so the LAST row in `rows` ends up newest/at the
 *  head and the FIRST row ends up deepest. This function reproduces that by
 *  reversing `fullRows` before prepending, so switching a call site from the
 *  loop to this batch call is a byte-identical ordering change, not just a
 *  perf one.
 *
 *  Returns the full rows actually added (with generated ids/whens), in the
 *  same order they were passed in (not the internal reversed prepend order). */
export function addTransactionsBatch(
  rows: readonly (Omit<Transaction, 'id' | 'when'> & { id?: string; when?: string })[],
): Transaction[] {
  if (rows.length === 0) return [];
  const fullRows: Transaction[] = rows.map((t, i) => ({
    id: t.id ?? `txn-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    when: t.when ?? new Date().toISOString(),
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    source: t.source,
  }));
  const { transactions, droppedTransactionCount } = applyTransactionRetention(
    [...fullRows].reverse().concat(state.transactions),
    state.droppedTransactionCount ?? 0,
  );
  setPartial({ transactions, droppedTransactionCount });
  return fullRows;
}

/** Run the pure history-cycle synthesizer (`lib/historyCycles.ts`) over the
 *  live ledger and merge the result into `cycles[]`, per that module's rules:
 *  a lived (ritual-sealed) cycle for a month is never touched; a
 *  reconstructed cycle for a month is upserted (never duplicated) as more
 *  history lands; the current calendar month is never synthesized. Call this
 *  after a bulk import lands (`addTransactionsBatch`) so Insights has
 *  something to show for backfilled history instead of staying in its empty
 *  state regardless of import volume (DATA_INTELLIGENCE.md §5(B)). Safe to
 *  call at any time — idempotent, and a no-op when there's no qualifying
 *  history. */
export function syncHistoryCycles(): void {
  const todayIso = new Date().toISOString().slice(0, 10);
  const nextCycles = synthesizeHistoryCycles(
    state.transactions,
    state.incomeSources ?? DEFAULT_INCOME_SOURCES,
    state.cycles,
    todayIso,
  );
  setPartial({ cycles: nextCycles });
}

export function removeTransaction(id: string) {
  setPartial({ transactions: state.transactions.filter((t) => t.id !== id) });
}

/** @rn-engine timeline-verbs — the single write path for the timeline event log (see
 *  `TimelineEvent`). Newest first, capped at 200 (mirrors the `transactions` cap). Internal writer —
 *  called from `togglePaused` (sub-paused/sub-resumed) and `addIgnoredReviewSig` (review-ignored);
 *  not exported, since every verb-state moment already has its own dedicated store action and a
 *  caller should never log an event without also making the underlying change. */
function logTimelineEvent(kind: TimelineEventKind, subject: string, note?: string): TimelineEvent {
  const entry: TimelineEvent = {
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    kind,
    subject,
    ...(note !== undefined ? { note } : {}),
  };
  const existing = state.timelineEvents ?? [];
  setPartial({ timelineEvents: [entry, ...existing].slice(0, 200) });
  return entry;
}

/** ENGINES.md §6 "Editing existing transactions — required, never destructive".
 *  Apply a correction to the transaction with `txnId`: run the pure `applyTxnEdit`
 *  engine (stamping `at = now`), REPLACE the matching row in place (same id, so
 *  the row is never duplicated and counts stay honest), and append the engine's
 *  immutable `TxnEdit` records to `edits`. The original values survive inside
 *  the edit chain, so an edit is fully recoverable — nothing is overwritten out
 *  of existence. A no-op patch (every field already at its current value)
 *  produces no records and leaves state untouched. */
export function editTransaction(txnId: string, patch: TxnEditPatch, by: 'user' | 'melo') {
  const target = state.transactions.find((t) => t.id === txnId);
  if (!target) return;
  const at = new Date().toISOString();
  const { txn: edited, edits } = applyTxnEdit(target, patch, { at, by });
  if (edits.length === 0) return; // no-op edit records nothing and writes nothing.
  setPartial({
    transactions: state.transactions.map((t) => (t.id === txnId ? edited : t)),
    edits: [...(state.edits ?? []), ...edits],
  });
}

export function addCalendarEvent(e: Omit<CalendarEvent, 'id'> & { id?: string }): CalendarEvent {
  const full: CalendarEvent = {
    id: e.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: e.date,
    kind: e.kind,
    title: e.title,
    // exactOptionalPropertyTypes: only set optional fields when present (never explicit undefined).
    ...(e.note !== undefined ? { note: e.note } : {}),
    ...(e.amount !== undefined ? { amount: e.amount } : {}),
  };
  setPartial({ calendarEvents: [full, ...state.calendarEvents].slice(0, 100) });
  return full;
}

export function removeCalendarEvent(id: string) {
  setPartial({ calendarEvents: state.calendarEvents.filter((e) => e.id !== id) });
}

/** Patch a manual calendar event (date nudge / edits). */
export function updateCalendarEvent(id: string, patch: Partial<Omit<CalendarEvent, 'id'>>) {
  setPartial({
    calendarEvents: state.calendarEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  });
}

/** Bridge from Route detail → Calendar. Calendar consumes and clears. */
export function setCalendarFocusDate(date: string | null) {
  setPartial({ calendarFocusDate: date });
}

/** Bridge from Calendar back to the Route (Today screen). Today consumes
 *  and clears, scrubbing its path to that date. */
export function setRouteFocusDate(date: string | null) {
  setPartial({ routeFocusDate: date });
}

/** Stage the candidates the statement reader extracted from a PDF/image for the
 *  Review screen. Review-before-truth: these are candidates only — NEVER posted
 *  facts, NEVER auto-counted. The Review screen confirms each one before it
 *  becomes a transaction. Excluded from `getPersistBlob`, so the queue does not
 *  survive a restart (an unreviewed candidate must never be silently kept).
 *
 *  RECALL (`lib/merchantMemory.ts`, DATA_INTELLIGENCE.md phase ③): before
 *  staging, each candidate's category is checked against the store's
 *  remembered merchant→category map (`applyMemoryToCandidates`) — a merchant
 *  the user has corrected before gets that category pre-filled + flagged
 *  `rememberedCategory: true`, instead of re-asking the model's low-confidence
 *  guess forever. This is the single choke point for both the LLM
 *  statement/photo reader and the on-device text/CSV parser (both routes
 *  through IntakeScreen call this one setter), so recall only needs wiring
 *  here, not at every producer. Category-only: amount/date/kind are untouched. */
export function setReaderCandidates(items: CandidateMoneyItem[]) {
  const withMemory = applyMemoryToCandidates(items, state.merchantCategories);
  setPartial({ readerCandidates: withMemory });
}

/** Clear the staged statement-reader review queue — call once Review has
 *  consumed the candidates (confirmed or discarded) so the staging slot is
 *  empty again. */
export function clearReaderCandidates() {
  setPartial({ readerCandidates: [] });
}

/** Read path for the staged statement-reader review queue. A thin selector over
 *  `useAppStore` (the store's one reactive seam) so the Review surface subscribes
 *  to just this slice. Defined down with the other `use*` hooks so it sits after
 *  `useAppStore` is declared. */
export function useReaderCandidates(): CandidateMoneyItem[] {
  return useAppStore((s) => s.readerCandidates);
}

/** Build the review-candidate signature used to suppress a repeat intake.
 *  Mirrors the design source's dedupe key shape: `merchant|amountCents|date`.
 *  Pure — callers (Review's Ignore action) compute this from a candidate. */
export function reviewCandidateSig(merchant: string, amount: number, date: string): string {
  return `${merchant}|${Math.round(amount * 100)}|${date}`;
}

/** Record a Review candidate signature as ignored (ENGINES.md §6 "Ignored
 *  review items"). A future intake with the exact same merchant/amount/date
 *  is suppressed rather than nagging again. Idempotent — adding the same
 *  signature twice does not duplicate it.
 *
 *  `subject` is optional and ONLY feeds the `// @rn-engine timeline-verbs` log below — the
 *  signature itself is opaque (`merchant|amountCents|date`), so callers that want the Ignore to
 *  surface as a human-readable Timeline row (ReviewScreen's onIgnore) pass the candidate's merchant
 *  name. Omitting it (e.g. a future caller with no readable subject) simply logs nothing, matching
 *  the byte-faithful ignore behaviour that predates this engine. */
export function addIgnoredReviewSig(sig: string, subject?: string) {
  const current = state.ignoredReviewSigs ?? [];
  if (current.includes(sig)) return;
  setPartial({ ignoredReviewSigs: [sig, ...current] });
  if (subject) logTimelineEvent('review-ignored', subject);
}

/** Un-hide a previously-ignored Review candidate signature (HiddenReviewSheet's
 *  "Un-hide" action) — future intakes matching it will surface again. */
export function unhideReviewSig(sig: string) {
  setPartial({ ignoredReviewSigs: (state.ignoredReviewSigs ?? []).filter((s) => s !== sig) });
}

/* ---------- reviewQueue — the persisted intake review queue ---------- */
// Ported 1:1 from the design source (folio-melo store.ts `enqueueReviewItems` /
// `resolveReviewItem` / `clearReviewQueue` / `sweepReviewQueue`). The web's
// combined `ignoreReviewItem` is intentionally NOT ported as one action: the RN
// Review surface composes `addIgnoredReviewSig` (which also feeds the
// timeline-verbs log) + `resolveReviewItem`, preserving its existing behaviour.

/** Queue TTL — items older than 14 days age out (design source REVIEW_TTL_MS). */
const REVIEW_TTL_MS = 14 * 24 * 3600 * 1000;
/** Queue cap — newest 60 kept (design source's `.slice(0, 60)`). */
const REVIEW_QUEUE_CAP = 60;

/** Enqueue candidates from an intake reader. Each candidate becomes one Review
 *  card. `id` and `addedAt` are stamped here so callers can pass minimal input.
 *  Duplicates already in the queue (same merchant + amount + date) are skipped
 *  so re-running a reader on the same file doesn't nag twice. Candidates whose
 *  signature is in `ignoredReviewSigs` are also skipped — the user already said
 *  "not this one" for that exact row (ENGINES.md § 6 "Future intakes skip exact
 *  re-matches"). The suppression signature is this store's `reviewCandidateSig`
 *  (the same key the Review surface's Ignore writes), so the skip and the
 *  writes always agree. */
export function enqueueReviewItems(
  candidates: Array<Omit<ReviewItem, 'id' | 'addedAt'>>,
): ReviewItem[] {
  if (candidates.length === 0) return [];
  const existing = state.reviewQueue ?? [];
  const ignored = new Set(state.ignoredReviewSigs ?? []);
  const now = Date.now();
  const fresh: ReviewItem[] = [];
  for (const c of candidates) {
    if (ignored.has(reviewCandidateSig(c.merchant, c.amount, c.date ?? ''))) continue;
    const dupe = existing.some(
      (it) =>
        it.merchant === c.merchant && it.amount === c.amount && (it.date ?? '') === (c.date ?? ''),
    );
    if (dupe) continue;
    fresh.push({
      ...c,
      id: `rv-${now}-${Math.random().toString(36).slice(2, 8)}`,
      addedAt: new Date(now).toISOString(),
    });
  }
  if (fresh.length === 0) return [];
  // Newest first, capped, age-out anything older than TTL.
  const combined = [...fresh, ...existing]
    .filter((it) => now - new Date(it.addedAt).getTime() < REVIEW_TTL_MS)
    .slice(0, REVIEW_QUEUE_CAP);
  setPartial({ reviewQueue: combined });
  return fresh;
}

/** Map reader candidates (the `readerCandidates` staging shape) into
 *  review-queue entries for `enqueueReviewItems` — the web success screens'
 *  exact per-screen mapping (ScreenPdfSuccess / ScreenImageSuccess /
 *  ScreenPasteSuccess: hardcoded per-screen `source`, merchant, signed amount,
 *  date + hint when present). Conditional spreads keep
 *  exactOptionalPropertyTypes honest (no explicit-undefined keys). Pure.
 *
 *  Also carries `category` + `rememberedCategory` through when present
 *  (`CandidateWithMemory`, `lib/merchantMemory.ts`) so a merchant-memory
 *  recall applied upstream (`setReaderCandidates`, or a direct
 *  `applyMemoryToCandidates` call in the paste path) survives into the
 *  persisted queue and reaches ReviewScreen's category chips. */
export function queueInputFromCandidates(
  candidates: readonly CandidateWithMemory[],
  source: ReviewItem['source'],
): Array<Omit<ReviewItem, 'id' | 'addedAt'>> {
  return candidates.map((c) => ({
    source,
    merchant: c.merchant,
    amount: c.amount,
    ...(c.date !== undefined ? { date: c.date } : {}),
    ...(c.note !== undefined ? { hint: c.note } : {}),
    ...(c.category !== undefined ? { category: c.category } : {}),
    ...(c.rememberedCategory !== undefined ? { rememberedCategory: c.rememberedCategory } : {}),
  }));
}

/** Resolve one candidate — user tapped Accept, or Ignored it (the Review
 *  surface records the suppression signature separately via
 *  `addIgnoredReviewSig`). Silent no-op if the id is gone. */
export function resolveReviewItem(id: string) {
  const queue = state.reviewQueue ?? [];
  const next = queue.filter((it) => it.id !== id);
  if (next.length !== queue.length) setPartial({ reviewQueue: next });
}

/** Drain the whole queue — used when the user explicitly says "clear all"
 *  or when a cycle closes and stale candidates should stop nagging. */
export function clearReviewQueue() {
  if ((state.reviewQueue ?? []).length > 0) setPartial({ reviewQueue: [] });
}

/** Public sweep — call on Today mount to age out expired items. */
export function sweepReviewQueue() {
  const queue = state.reviewQueue ?? [];
  const now = Date.now();
  const next = queue.filter((it) => now - new Date(it.addedAt).getTime() < REVIEW_TTL_MS);
  if (next.length !== queue.length) setPartial({ reviewQueue: next });
}

/** Nudge a flexible bill (subscription renewal) by `deltaDays`. This is
 *  the "what if I move this?" affordance — additive so repeated taps stack,
 *  clamped to ±7 days so we don't pretend bills are fully discretionary. */
export function nudgeSub(name: string, deltaDays: number) {
  const current = state.subOverrides[name] ?? 0;
  const next = Math.max(-7, Math.min(7, current + deltaDays));
  setPartial({ subOverrides: { ...state.subOverrides, [name]: next } });
}

/** Reset all "what if" nudges on flexible bills. */
export function resetSubOverrides(name?: string) {
  if (name) {
    const { [name]: _gone, ...rest } = state.subOverrides;
    setPartial({ subOverrides: rest });
  } else {
    setPartial({ subOverrides: {} });
  }
}

export function resetAll() {
  state = {
    ...DEFAULTS,
    transactions: seedTransactions(),
    calendarEvents: [],
    timelineEvents: [],
    incomeSources: [],
  };
  persist();
  emit();
}

/** CLEAN-EMPTY reset — wipe the user's data to a genuinely empty state, with NO
 *  sample/demo reseed (the opposite of `resetAll`, which reseeds the demo set).
 *  Every user-data slot is cleared: transactions, pots, subs, the sub
 *  paused/override maps, ritual cycles, the correction-edit history, calendar
 *  events, the pot ledger, and the staged statement-reader review queue. The
 *  balance becomes a neutral, honest empty (£0, `user-entered`/`rough` — NOT
 *  `sample`), and `onboarding.done` is forced true so a returning clean user is
 *  NOT re-onboarded. `schemaVersion` is preserved so the empty state still loads
 *  through the same migration contract. Pure + immutable — builds a brand-new
 *  state object, never mutates the previous one. */
export function resetToEmpty() {
  const empty: AppState = {
    schemaVersion: state.schemaVersion,
    pots: [],
    subs: [],
    subPaused: {},
    subOverrides: {},
    cycles: [],
    onboarding: { ...state.onboarding, done: true },
    currentBalance: { ...EMPTY_BALANCE, setAt: new Date().toISOString() },
    potLedger: [],
    nextYouNote: '',
    tightPointGoal: null,
    transactions: [],
    droppedTransactionCount: 0,
    edits: [],
    calendarEvents: [],
    calendarFocusDate: null,
    routeFocusDate: null,
    readerCandidates: [],
    ignoredReviewSigs: [],
    reviewQueue: [],
    moneyMode: 'survival',
    bufferAmount: 100,
    dismissedIncomeSignals: [],
    dismissedBillSignals: [],
    debts: [],
    household: { partnerName: '', defaultShare: 0.5, subShareOverrides: {} },
    plans: [],
    lens: {
      plusUnlocked: false,
      proUnlocked: false,
      trialCycleId: null,
      trialEndedCycleId: null,
      trialEndAcknowledged: true,
    },
    melo: { quietMode: false, wardrobe: [] },
    tinyWins: [],
    timelineEvents: [],
    incomeSources: [],
    merchantCategories: {},
  };
  state = empty;
  persist();
  emit();
}

/** Pure selector — true when the app holds any real user data (transactions,
 *  pots, subs, or ritual cycles). Lets a surface tell a genuinely-used app from
 *  a fresh/demo one (e.g. after `resetToEmpty`, this is false). No state read of
 *  its own — operates only on the snapshot it's given, so it's safe to call from
 *  selectors, `load()`, or tests. */
export function hasAnyUserData(s: AppState): boolean {
  return s.transactions.length > 0 || s.pots.length > 0 || s.subs.length > 0 || s.cycles.length > 0;
}

/* ---------- One-time melo → folio data-continuity migration ----------
 * The archived Melo surface (apps/mobile/src/melo, removed at commit eb34425)
 * persisted its own encrypted blob (`melo.state.v1.json`) with a setup the
 * user actually filled in — payday, income, bills, balance — that never had
 * anywhere to land once the surface was archived. This is a one-time,
 * additive-only import of that dogfood data into the folio store, so it
 * survives the archival instead of silently vanishing. See lib/persist.ts
 * `importMeloBlobIfPresent` for the file I/O (read/decrypt/rename) that
 * drives this pure mapper. */

/** The slice of the archived Melo store's shape this migration reads. Kept
 *  minimal + structurally-typed (not imported from the deleted module) since
 *  the source no longer exists in the tree; every field is read defensively. */
export type MeloImportBill = {
  name?: unknown;
  amountPence?: unknown;
  dueDay?: unknown;
  kind?: unknown;
};
export type MeloImportSetup = {
  paydayDay?: unknown;
  paydayLastWorkingDay?: unknown;
  incomePence?: unknown;
  balancePence?: unknown;
  bills?: unknown;
};
export type MeloImportBlob = {
  v?: unknown;
  state?: { setup?: MeloImportSetup };
};

/** True when the current folio state is "effectively empty" — i.e. nothing
 *  the melo import would clobber or duplicate. Deliberately narrower than
 *  `hasAnyUserData`: this gate exists ONLY to decide whether the one-time
 *  melo import should run, so it checks exactly the slots the import writes
 *  (transactions, debts, onboarding, balance) rather than every user-data
 *  slot in the app. A fresh install (DEFAULTS) is NOT "empty" by this check
 *  because DEFAULTS seeds sample transactions/debts/balance — which is
 *  correct: the import must not overwrite real seeded-vs-real ambiguity by
 *  guessing, it only fires when the user has neither. */
export function isEmptyForMeloImport(s: AppState): boolean {
  const noTransactions = s.transactions.length === 0;
  const noDebts = (s.debts ?? []).length === 0;
  const noOnboarding = !s.onboarding.done;
  const sampleBalance = s.currentBalance.source === 'sample';
  return noTransactions && noDebts && noOnboarding && sampleBalance;
}

/** Map an archived Melo blob's `setup` onto a folio state patch. Pure — no
 *  I/O, no Date.now() beyond stamping `setAt`/`addedAt` on the produced
 *  records via the caller's `now` param, so this stays deterministic and
 *  Node-testable. Returns `null` when the blob has no usable setup at all
 *  (e.g. the user never finished melo onboarding), so the caller can skip
 *  the import + still rename the blob out of the way.
 *
 *  Deliberate, documented gaps (additive-only — never invents a folio field):
 *   - `paydayLastWorkingDay` has no destination on folio's `Onboarding`
 *     (`payday` is a single day-of-month number); the flag is read but
 *     dropped rather than approximated.
 *   - Melo bills have no balance/APR — they are recurring flat costs, not
 *     debts. They still map onto folio's `Debt` (the closest first-class
 *     "amount + day-of-month + kind" object) with `balance: 0, apr: 0` so
 *     they surface honestly as zero-balance/zero-interest recurring items,
 *     never fabricated numbers. `kind: 'bill'` (a plain recurring bill) has
 *     no folio `Debt.kind` equivalent, so it maps to `'other'`; `'bnpl'` and
 *     `'debt'` map to `'bnpl'` and `'loan'` respectively. */
export function mapMeloBlobToFolioPatch(
  blob: MeloImportBlob,
  now: string = new Date().toISOString(),
): Partial<AppState> | null {
  const setup = blob.state?.setup;
  if (setup === null || typeof setup !== 'object') return null;

  const patch: Partial<AppState> = {};

  const paydayDay =
    typeof setup.paydayDay === 'number' && Number.isFinite(setup.paydayDay)
      ? Math.round(setup.paydayDay)
      : null;
  const incomePence =
    typeof setup.incomePence === 'number' && Number.isFinite(setup.incomePence)
      ? setup.incomePence
      : null;
  if (paydayDay !== null || incomePence !== null) {
    patch.onboarding = {
      done: true,
      name: '',
      payday: paydayDay ?? DEFAULTS.onboarding.payday,
      monthlyIncome: incomePence !== null ? incomePence / 100 : DEFAULTS.onboarding.monthlyIncome,
    };
  }

  const balancePence = setup.balancePence;
  if (typeof balancePence === 'number' && Number.isFinite(balancePence)) {
    patch.currentBalance = {
      amount: balancePence / 100,
      source: 'user-entered',
      confidence: 'rough',
      setAt: now,
    };
  }

  const rawBills = Array.isArray(setup.bills) ? (setup.bills as MeloImportBill[]) : [];
  if (rawBills.length > 0) {
    const kindMap: Record<string, Debt['kind']> = { bill: 'other', bnpl: 'bnpl', debt: 'loan' };
    const debts: Debt[] = rawBills
      .map((b, i) => {
        const name = typeof b.name === 'string' ? b.name.trim() : '';
        const amountPence =
          typeof b.amountPence === 'number' && Number.isFinite(b.amountPence)
            ? b.amountPence
            : null;
        const dueDay =
          typeof b.dueDay === 'number' && Number.isFinite(b.dueDay)
            ? Math.min(31, Math.max(1, Math.round(b.dueDay)))
            : 1;
        const kind = typeof b.kind === 'string' ? (kindMap[b.kind] ?? 'other') : 'other';
        if (!name || amountPence === null) return null;
        const full: Debt = {
          id: `melo-import-${i}-${name.toLowerCase().replace(/\s+/g, '-')}`,
          name,
          kind,
          balance: 0,
          apr: 0,
          minPayment: amountPence / 100,
          dueDom: dueDay,
          addedAt: now,
        };
        return full;
      })
      .filter((d): d is Debt => d !== null);
    if (debts.length > 0) patch.debts = debts;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/** Apply the melo import patch to the live store, exactly once. Guarded by
 *  `isEmptyForMeloImport` so a returning user with real folio data is never
 *  clobbered. Called from `lib/persist.ts` after it has read + decrypted the
 *  archived melo blob and confirmed the folio store has already loaded. */
export function applyMeloImportIfEmpty(blob: MeloImportBlob): boolean {
  if (!isEmptyForMeloImport(state)) return false;
  const patch = mapMeloBlobToFolioPatch(blob);
  if (patch === null) return false;
  setPartial(patch);
  return true;
}

/** Debug: shift every dated thing backwards by ~30 days and add a synthetic
 *  closed cycle. Lets us demo Insights without waiting a month. */
export function fastForwardMonth() {
  const day = 86_400_000;
  const shift = 30 * day;
  const newCycle: CycleRecord = {
    closedAt: new Date().toISOString().slice(0, 10),
    label: new Date().toLocaleString('en-GB', { month: 'long' }),
    spare: 80 + Math.round(Math.random() * 120),
    tightPoint: 30 + Math.round(Math.random() * 60),
    setAside: 50 + Math.round(Math.random() * 40),
    note: 'Auto-closed via fast-forward.',
  };
  const agedCycles = state.cycles.map((c) => ({
    ...c,
    closedAt: new Date(new Date(c.closedAt).getTime() - shift).toISOString().slice(0, 10),
  }));
  const agedTxns = state.transactions.map((t) => ({
    ...t,
    when: new Date(new Date(t.when).getTime() - shift).toISOString(),
  }));
  // Roll every sub forward into its next cycle; bump lastUsed if it was recent.
  const agedSubs = state.subs.map((s) => ({
    ...s,
    nextRenewalDaysAway: s.nextRenewalDaysAway <= 0 ? 30 : s.nextRenewalDaysAway,
    lastUsedDaysAgo: s.lastUsedDaysAgo + 30,
  }));
  setPartial({
    cycles: [newCycle, ...agedCycles].slice(0, 24),
    transactions: agedTxns,
    subs: agedSubs,
  });
}

/* ---------- Melo tool bridge ----------
 * Melo's server-side tools return a friendly message; the actual app state
 * change happens here on the client when a tool part finishes streaming.
 * Each tool returns an `undo` closure so the chat can offer a one-tap revert.
 * The Melo tool set is the log_* family (record money as transactions). Pot
 * moves are NOT a Melo tool — addToPot / borrowFromPot are called directly.
 */
export type MeloToolName = 'log_spend' | 'log_income' | 'log_refund' | 'log_transfer';

const MELO_TOOL_NAMES: MeloToolName[] = ['log_spend', 'log_income', 'log_refund', 'log_transfer'];

export type MeloToolResult =
  | { applied: true; summary: string; undo: () => void }
  | { applied: false; reason: string }
  | { applied: false; reason: string; candidates: MeloToolName[] };

/** ENGINES.md § 6 "Melo — tool name matching". Normalise a tool name the
 *  model emitted (lowercase / trim / strip punctuation → single spaces) so a
 *  loosely-named tool still resolves. Used by both `matchMeloTool` and
 *  `applyMeloTool`. Pure. */
export function normaliseMeloToolName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Resolve a (possibly loosely-named) tool to a canonical `MeloToolName`.
 *  Returns `{ ok: true, name }` on an exact-normalised or unambiguous
 *  substring match; `{ ok: false, candidates }` when more than one canonical
 *  tool matches (ENGINES §6 "returning candidates when ambiguous"); and
 *  `{ ok: false, candidates: [] }` when nothing matches. Pure — no state. */
export function matchMeloTool(
  raw: string,
): { ok: true; name: MeloToolName } | { ok: false; candidates: MeloToolName[] } {
  const norm = normaliseMeloToolName(raw);
  if (!norm) return { ok: false, candidates: [] };
  // Canonical names compared in the same normalised space ('_' → ' ').
  const normalised = MELO_TOOL_NAMES.map((n) => [n, normaliseMeloToolName(n)] as const);
  // 1. Exact normalised match wins outright (unambiguous by construction).
  const exact = normalised.find(([, n]) => n === norm);
  if (exact) return { ok: true, name: exact[0] };
  // 2. Substring either direction — collect every canonical tool that matches.
  const hits = normalised
    .filter(([, n]) => n.includes(norm) || norm.includes(n))
    .map(([name]) => name);
  const [only] = hits;
  if (hits.length === 1 && only !== undefined) return { ok: true, name: only };
  // 0 or >1 → ambiguous / no match; hand back the candidate set.
  return { ok: false, candidates: hits };
}

/** The Transaction.category union, as a runtime list for validating a
 *  model-proposed category. Anything off this list falls back to 'other'. */
const TXN_CATEGORIES: Transaction['category'][] = [
  'food',
  'transport',
  'fun',
  'bills',
  'shopping',
  'income',
  'other',
];

/** Coerce a model-proposed category to a valid Transaction['category'], else
 *  the honest fallback `'other'`. Never invents a category that isn't real. */
function coerceCategory(raw: unknown): Transaction['category'] {
  const value = String(raw ?? 'other') as Transaction['category'];
  return TXN_CATEGORIES.includes(value) ? value : 'other';
}

/* ---------- Melo log_* tool family — chosen params + behaviour ----------
 * SPEC NOTE for Lovable / owner to confirm. The exact param shapes for
 * log_income / log_refund / log_transfer live in Lovable's project-knowledge,
 * NOT in the design code, so these are a reasonable, documented implementation
 * built ONLY on the existing Transaction model (no new fields, no new category
 * values). Every tool is candidate/honest: Melo proposes, the user confirms in
 * the chat, and each result carries an `undo` closure for the 30s revert.
 *
 *   log_spend({ merchant, amount>0, category? })
 *     → one NEGATIVE transaction (a spend). `category` is best-fit or 'other'.
 *       Source 'melo'. (Unchanged from the prior design — kept verbatim.)
 *
 *   log_income({ merchant/source, amount>0, category? })
 *     → one POSITIVE transaction (an inflow). The payer name is read from
 *       `merchant` OR `source` (the model may use either). `category` defaults
 *       to 'income' but any valid category the model gives is respected.
 *       Source 'melo'.
 *
 *   log_refund({ merchant, amount>0, original?, category? })
 *     → one POSITIVE transaction tagged as a refund and "linked" to the
 *       original spend WITHOUT auto-deciding a verdict. There is no free-text
 *       note field on Transaction, so the link is recorded honestly in the
 *       `merchant` string as "<merchant> · refund" (and "· re <original>" when
 *       the model passes the original merchant/txn it relates to). Category
 *       stays the honest, non-judgemental 'other' unless the model supplies a
 *       valid one — a refund is NOT income, so it is never silently filed as
 *       income. Source 'melo'.
 *
 *   log_transfer({ from, to, amount>0 })
 *     → a PAIRED move recorded as TWO neutral transactions on one timestamp:
 *       a negative "out" leg ("<from> → <to> · transfer") and a positive "in"
 *       leg ("<to> ← <from> · transfer"), both category 'other'. A transfer is
 *       money you still own moving between accounts, so the pair nets to £0 and
 *       never reads as a spend or an inflow. Undo removes BOTH legs. Source
 *       'melo'. (A single transfer-tagged record was the alternative; the
 *       paired shape is used so each side is visible where the money lands.)
 *
 * Pot moves are NO LONGER a Melo tool — addToPot / borrowFromPot are called
 * directly by the app, not through applyMeloTool.
 */
export function applyMeloTool(name: string, input: Record<string, unknown>): MeloToolResult {
  // Normalise the tool name first (ENGINES §6). An unknown / ambiguous name
  // returns candidates instead of silently no-op'ing on the exact-switch miss.
  const matched = matchMeloTool(name);
  if (!matched.ok) {
    return matched.candidates.length > 0
      ? { applied: false, reason: 'ambiguous tool', candidates: matched.candidates }
      : { applied: false, reason: 'unknown tool', candidates: [] };
  }
  switch (matched.name) {
    case 'log_spend': {
      const merchant = String(input.merchant ?? '').trim();
      const amount = Number(input.amount ?? 0);
      const category = coerceCategory(input.category);
      if (!merchant || !(amount > 0)) return { applied: false, reason: 'bad args' };
      const created = addTransaction({ merchant, amount: -amount, category, source: 'melo' });
      return {
        applied: true,
        summary: `Logged £${amount.toFixed(2)} at ${merchant}`,
        undo: () => removeTransaction(created.id),
      };
    }
    case 'log_income': {
      // The payer/source name may arrive as `merchant` or `source`.
      const merchant = String(input.merchant ?? input.source ?? '').trim();
      const amount = Number(input.amount ?? 0);
      // Default to the 'income' category; honour any valid category the model gives.
      const category = input.category === undefined ? 'income' : coerceCategory(input.category);
      if (!merchant || !(amount > 0)) return { applied: false, reason: 'bad args' };
      const created = addTransaction({ merchant, amount: amount, category, source: 'melo' });
      return {
        applied: true,
        summary: `Logged £${amount.toFixed(2)} in from ${merchant}`,
        undo: () => removeTransaction(created.id),
      };
    }
    case 'log_refund': {
      const merchant = String(input.merchant ?? '').trim();
      const amount = Number(input.amount ?? 0);
      if (!merchant || !(amount > 0)) return { applied: false, reason: 'bad args' };
      // Tag it as a refund and (optionally) "link" it to the original spend in the
      // merchant string — the only free-text field we have. Honest, not a verdict.
      const original = String(input.original ?? '').trim();
      const label = original ? `${merchant} · refund · re ${original}` : `${merchant} · refund`;
      // A refund is an inflow but NOT income; keep 'other' unless the model gives a real category.
      const category = input.category === undefined ? 'other' : coerceCategory(input.category);
      const created = addTransaction({ merchant: label, amount: amount, category, source: 'melo' });
      return {
        applied: true,
        summary: `Logged £${amount.toFixed(2)} refund from ${merchant}`,
        undo: () => removeTransaction(created.id),
      };
    }
    case 'log_transfer': {
      const from = String(input.from ?? '').trim();
      const to = String(input.to ?? '').trim();
      const amount = Number(input.amount ?? 0);
      if (!from || !to || !(amount > 0)) return { applied: false, reason: 'bad args' };
      // A neutral, paired move: one negative "out" leg + one positive "in" leg on a
      // shared timestamp, so it nets to £0 and never reads as a spend or an inflow.
      const when = new Date().toISOString();
      const outLeg = addTransaction({
        merchant: `${from} → ${to} · transfer`,
        amount: -amount,
        category: 'other',
        source: 'melo',
        when,
      });
      const inLeg = addTransaction({
        merchant: `${to} ← ${from} · transfer`,
        amount: amount,
        category: 'other',
        source: 'melo',
        when,
      });
      return {
        applied: true,
        summary: `Logged £${amount.toFixed(2)} transfer ${from} → ${to}`,
        undo: () => {
          removeTransaction(outLeg.id);
          removeTransaction(inLeg.id);
        },
      };
    }
    default:
      return { applied: false, reason: 'unknown tool' };
  }
}

import { useSyncExternalStore } from 'react';

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Public, non-React subscription to store changes — the same listener seam
 *  `useAppStore` drives through `useSyncExternalStore`, exposed so the native
 *  persistence adapter (lib/persist.ts) can debounce-write the blob on change
 *  without mounting a hook. Returns an unsubscribe. Node-safe (no RN/expo). */
export function subscribeStore(cb: () => void): () => void {
  return subscribe(cb);
}

export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(DEFAULTS),
  );
}
