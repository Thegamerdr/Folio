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

import { dedupeKey } from '../local/statementReaderDedup';
import { readCacheEvictions, READ_CACHE_MAX_CANDIDATES } from './lib/billing/readAllowance';
import { anchorIsoFor, reanchorRenewals } from './lib/renewalMath';
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
import {
  buildStatementSummary,
  candidateToTransactionDraft,
  type StatementSummary,
} from './lib/statementSummary';
import {
  reconcileStatement,
  statementTotalsFrom,
  type ReconciliationResult,
} from './lib/reconcileStatement';
import { findCaughtIncome, type IncomeCaughtCandidate } from './lib/caughtIncome';
import { findCaughtBills } from './lib/caughtBills';
import { findCaughtAnnual } from './lib/caughtAnnual';
import { isOverspentLanding } from './lib/storeRoute';

/** The element type of the persisted `AppState.edits` slot. It is the engine's
 *  full `TxnEdit` with `id` relaxed to optional: every record this store writes
 *  is produced by `applyTxnEdit` and so always carries an `id`, but the export
 *  engine + its tests read the slot tolerantly (older/loose shapes without an
 *  `id`), so the persisted contract must not require it. Runtime values are
 *  always full `TxnEdit`s; the relaxation is purely a structural-compat seam. */
export type StoredTxnEdit = Omit<TxnEdit, 'id'> & { id?: string };

/** One cooldown record on `AppState.dismissedDriftSignals` — see that field's doc for the full
 *  "drift thrash" fix. `merchant` is the normalised key (`normaliseIncomeSignalKey`); `at` is the ISO
 *  timestamp of the confirm-or-dismiss action that started the cooldown window. */
export type DriftCooldownEntry = { merchant: string; at: string };

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
  /** Days until next renewal, relative to "now". Since the 2026-07-11 date-anchor fix this is
   *  DERIVED — re-computed from `nextRenewalISO` at every hydration + app foreground
   *  (lib/renewalMath.ts `reanchorRenewals`), so it can no longer rot between sessions. It stays
   *  a stored field because ~30 readers consume it directly; the anchor is the truth. */
  nextRenewalDaysAway: number;
  /** ISO `YYYY-MM-DD` the next renewal actually falls on — the durable anchor the day count
   *  derives from. Optional for shape back-compat: a legacy sub gets one synthesized from its
   *  current day count on first re-anchor (freezing past rot, stopping future rot). */
  nextRenewalISO?: string;
  /** Fixed renewal period in days (7 weekly, 14 fortnightly, 365 yearly). Undefined = calendar
   *  monthly — the anchor rolls to the same day-of-month, clamped to short months. */
  renewalPeriodDays?: number;
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
  /** ACCOUNTS_MODEL.md §2.4 (P2) — present ONLY for a `Debt` row synced from a `kind: 'credit-card'`
   *  `Account` (see `syncCardDebt`/`addCardPayoffDetails`). Absent for every pure-`Debt` row (seed
   *  loans/BNPL — ACCOUNTS_MODEL.md §6 open question 4's asymmetry: loans/BNPL never get an `Account`,
   *  only real credit cards do). When present, this `Debt`'s `balance` is owned by the linked
   *  account's statement imports/manual balance edits, not by `logDebtPayment`/`addDebt` directly —
   *  callers should still route balance CHANGES through `setAccountBalance` on the linked account so
   *  the two stay in sync, rather than editing this `Debt` row's balance in isolation. */
  linkedAccountId?: string;
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

/** Lens entitlement state. Field NAMES are the legacy Plus/Pro shape (persisted blobs +
 *  entitlement records carry them — no migration needed); their MEANING since the 2026-07-10
 *  Free/Full/Live restructure (MONEY_MODEL.md §2b): EITHER `plusUnlocked` or `proUnlocked`
 *  true = the user owns FULL (the one-time tier) — legacy purchasers grandfather in. New writes
 *  go through `setLensFullUnlocked`. `trialCycleId` marks the cycle the user activated a
 *  one-cycle free trial in (unlocks every Full lens); cleared when its end date passes
 *  (`lib/lens.ts` `endLensTrialIfExpired`). `trialEndedCycleId` captures the ended trial so
 *  Today can surface a soft "trial ended" prompt once and the trial can never be re-armed;
 *  `trialEndAcknowledged` flips true after the user dismisses that prompt. */
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
  /** Which `Account` this transaction belongs to (see `Account` below and ACCOUNTS_MODEL.md §2.2).
   *  OPTIONAL and defaults to `'acct-main'` via `accountIdOf()` — this is a deliberate LOW-RISK
   *  choice: making this required would force a mass fixture migration across every existing test
   *  and seed-data call site. Every pre-existing transaction (and every fixture that never sets it)
   *  is treated as belonging to the single default bank account. New write paths should still stamp
   *  a real `accountId` where the caller knows one (multi-account UI, P3), but omitting it is always
   *  safe and never crashes a reader — always go through `accountIdOf()`, never read this field raw
   *  when you need "the effective account". */
  accountId?: string;
};

/** ACCOUNTS_MODEL.md §2.1 — a single named account (bank, credit card, savings, or cash). Phase 1
 *  (this pass) only ever creates the synthesized `'acct-main'` bank account via migration; the
 *  account picker/creator UI (multi-account, credit-card-as-liability wiring into the debt engine)
 *  is P2/P3 — see ACCOUNTS_MODEL.md. `balance` is a signed £ float (NOT minor units/pence) to match
 *  the rest of the store's existing convention (`Debt.balance`, `CurrentBalance.amount`) — see
 *  ACCOUNTS_MODEL.md §2.5's explicit "match existing convention" call for P1, rather than introducing
 *  a second minor-units convention alongside 30+ existing float-pound fields. */
export type AccountKind = 'bank' | 'credit-card' | 'savings' | 'cash';

export type Account = {
  id: string;
  /** User-facing label, e.g. "Monzo Current", "Amex Gold". */
  name: string;
  kind: AccountKind;
  /** True only for `kind: 'credit-card'` in this phase — a liability account's `balance` represents
   *  amount OWED, mirroring `Debt.balance`'s "never negative, always owed" convention. Non-liability
   *  kinds (`bank`/`savings`/`cash`) represent money the user actually holds. */
  isLiability: boolean;
  /** Current balance, signed £ float. For a liability account this is the amount owed (positive). */
  balanceMinor: number;
  /** ISO 4217 currency code. Optional — GBP-only assumption for the foreseeable future
   *  (ACCOUNTS_MODEL.md §6 open question 1); omit rather than half-build FX conversion nobody asked
   *  for. Absent means GBP. */
  currency?: string;
  /** ISO timestamp this account's balance was last set/confirmed by an import or manual entry. */
  balanceAsOfISO: string;
  /** ISO timestamp the account was created — sort stability / "added N days ago" copy only. */
  addedAt: string;
  /** Soft-delete flag. Closing/archiving an account is out of scope for this phase
   *  (ACCOUNTS_MODEL.md §6 open question 5) — the field exists so a later phase can add it cheaply
   *  without another shape change, but nothing sets or reads it yet. */
  closed?: boolean;
};

/** The id every pre-existing install's data is synthesized under (see `synthesizeDefaultAccount`
 *  below) — the implicit "whole ledger is one account" bank account this codebase always had before
 *  `AppState.accounts` existed. */
export const DEFAULT_ACCOUNT_ID = 'acct-main';

/** Effective account for a transaction — defaults to `DEFAULT_ACCOUNT_ID` when `accountId` is absent
 *  (every existing transaction, every fixture that predates this field). Always read a transaction's
 *  account through this helper rather than `t.accountId` directly, so "which account" logic never has
 *  to special-case the back-compat gap. */
export function accountIdOf(t: Pick<Transaction, 'accountId'>): string {
  return t.accountId ?? DEFAULT_ACCOUNT_ID;
}

/** ACCOUNTS_MODEL.md §2.4 — true when `txn` belongs to a NON-liability account (bank/savings/cash),
 *  i.e. its spend/income is real bank cashflow, not credit-card borrowing. Every reader that computes
 *  bank-side money movement (Safe Zone, the route curve, monthly spend/income baselines, the caught-*
 *  detectors) must filter through this (or `bankTransactions` below) instead of reading
 *  `state.transactions` raw, so a card statement's spend never double-counts against bank cashflow.
 *  Falls back to `true` when `accounts` is absent/empty OR the transaction's account isn't found
 *  (every pre-existing fixture/install, and `DEFAULT_ACCOUNT_ID` itself, are bank accounts by
 *  construction) — so this predicate is always safe to call and never silently drops a pre-accounts
 *  transaction. */
export function isBankTxn(
  state: { accounts?: Account[] | undefined },
  txn: Pick<Transaction, 'accountId'>,
): boolean {
  const accounts = state.accounts ?? [];
  if (accounts.length === 0) return true;
  const account = accounts.find((a) => a.id === accountIdOf(txn));
  if (account === undefined) return true;
  return !account.isLiability;
}

/** ACCOUNTS_MODEL.md §2.4 — `state.transactions` filtered to bank/savings/cash accounts only (excludes
 *  every credit-card account's rows). THE one filter point every bank-cashflow reader should call
 *  instead of re-implementing the `isBankTxn` filter locally (`historyStats.ts`'s monthly spend/income
 *  series, `income.ts`'s `selectMonthlySpend`, the `caught*` detectors, `storeRoute.ts`'s realized
 *  spend read). On a single-account (migrated) install this returns the SAME array reference-equal
 *  content as `state.transactions` (nothing is a liability account), so every existing fixture is
 *  unaffected. */
export function bankTransactions(state: {
  accounts?: Account[] | undefined;
  transactions: Transaction[];
}): Transaction[] {
  const accounts = state.accounts ?? [];
  if (accounts.length === 0) return state.transactions;
  return state.transactions.filter((t) => isBankTxn(state, t));
}

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
  /** Transient sibling to `readerCandidates` — the closing balance the statement
   *  reader reported alongside this read (see `StatementReadResult.closingBalance`
   *  in `statementReaderClient.ts`), staged so the success screens can offer it
   *  to `BulkStatementLanding` ("£X — use it?"). `null` when the reader didn't
   *  return one (or the read came from a source that never carries one, e.g.
   *  paste/CSV). Same review-before-truth lifecycle as `readerCandidates`:
   *  excluded from `getPersistBlob`, reset by `load()`/`resetToEmpty()`, and
   *  cleared alongside it by `clearReaderCandidates()` and the read-once wipe.
   *  Optional for shape back-compat with hand-built `AppState` fixtures
   *  predating this field; `DEFAULTS`/`load()`/`resetToEmpty()` always
   *  populate it (null). */
  readerClosingBalance?: ReaderClosingBalance | null;
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
  /** Onboarding mode-extra answers (£), keyed by mode. Survival/Stability's answer ALSO lands in
   *  `bufferAmount` (their engines read it); every other mode's declaration is preserved HERE so
   *  it survives restarts until that mode's engine grows a real input for it — the answers used to
   *  be captured on-screen and then silently dropped (2026-07-10 alignment-audit fix). Keyed per
   *  mode so re-running onboarding with a different intent never wipes another mode's answer.
   *  Optional for shape back-compat; `DEFAULTS`/`load()` always populate it. */
  modeExtras?: Partial<Record<MoneyMode, number>>;
  /** AI statement-read allowance counter (MONEY_MODEL.md §2b: tiers differ in read QUANTITY,
   *  never quality). Lazy monthly reset — a counter whose `monthKey` isn't the current month
   *  reads as 0 (see lib/billing/readAllowance.ts, which owns all the tier maths). Only reads
   *  that actually yielded candidates count; cached repeats never count. PERSISTED (a restart
   *  must not refill the allowance). Optional for shape back-compat; `DEFAULTS`/`load()` always
   *  populate it. */
  aiReads?: { monthKey: string; used: number };
  /** On-device cache of successful statement reads, keyed by file-content hash
   *  (lib/billing/readAllowance.ts `statementCacheKey`). Re-picking a file Folio has read before
   *  serves this instead of a gateway call — costs nothing, burns no allowance. Small by design
   *  (READ_CACHE_MAX_ENTRIES, oldest evicted) because entries carry full candidate lists inside
   *  the encrypted persist blob. PERSISTED. Optional for shape back-compat; `DEFAULTS`/`load()`
   *  always populate it. */
  aiReadCache?: Record<string, AiReadCacheEntry>;
  /** What-Changed baseline — the ISO moment the user last opened the standing What-Changed row
   *  (ui/WhatChangedRow.tsx; summary maths in lib/whatChanged.ts). `null` = no baseline yet (the
   *  row stamps its first baseline silently on first mount). PERSISTED — a restart must not
   *  re-announce changes the user has seen. Optional for shape back-compat; `DEFAULTS`/`load()`
   *  always populate it (null). */
  whatChangedSeenISO?: string | null;
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
  /** Overflow honesty net for `reviewQueue` (`enqueueReviewItems`'s "silent queue truncation" fix,
   *  phase ⑦). `reviewQueue` stays visually capped at `REVIEW_QUEUE_CAP` (60) so Review never renders
   *  a wall of cards, but a bulk import (a 17-chunk statement, say) can easily produce far more
   *  candidates than that. Rather than silently discarding whatever doesn't fit, the overflow is
   *  parked here — newest first, capped at `REVIEW_QUEUE_SPILLOVER_CAP` (500) — and
   *  `refillReviewQueueFromSpillover` drains it back into `reviewQueue` one-for-one as items there are
   *  resolved, so nothing is ever silently lost short of the outer 500 ceiling (which is itself a
   *  bound, not a silent drop — same shape as `droppedTransactionCount`'s honesty contract, just
   *  recoverable instead of merely counted). Same TTL as `reviewQueue` (`REVIEW_TTL_MS`) applies on
   *  the way in and is re-checked on drain, so a spillover item can still honestly age out before it
   *  ever surfaces. Optional for shape back-compat with hand-built `AppState` fixtures predating this
   *  field; `DEFAULTS`/`load()`/`resetToEmpty()` always populate it ([]). */
  reviewQueueSpillover?: ReviewItem[];
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
  /** Drift-signal (`lib/driftSignals.ts`) COOLDOWN log — DATA_INTELLIGENCE.md phase ⑥ (history-fed
   *  forecasts, income/bill drift), extended with a per-merchant re-propose cooldown (task: "drift
   *  thrash" fix). One shared list for BOTH drift flavours (income-amount/cadence drift and
   *  bill/price-rise drift) and for BOTH actions the sheet offers (confirm OR dismiss) — either action
   *  means the same thing for re-proposing: "I just dealt with this merchant's drift, don't ask again
   *  immediately." Each entry is `{ merchant, at }` (normalised merchant key + ISO timestamp of the
   *  action), NOT a bare merchant string — this is the back-compat-breaking shape change the cooldown
   *  needs (a plain dismissed-list has no notion of "how long ago"). Loaded tolerantly by `load()`
   *  (see its own migration note) since this store is uncommitted/in-memory-only right now, so there is
   *  no real persisted-blob back-compat burden — but the loader still degrades any stray legacy
   *  string-array shape to `[]` rather than crashing, in case a prior in-memory session's blob is still
   *  parked. `findDriftCandidates` (`lib/caughtDrift.ts`) is the sole reader: it suppresses a merchant
   *  for `DRIFT_COOLDOWN_DAYS` (45) after the most recent entry UNLESS the new deviation exceeds
   *  `DRIFT_COOLDOWN_BREAKTHROUGH_FRACTION` (30%) — a big real change still breaks through immediately.
   *  Optional for shape back-compat; `DEFAULTS`/`load()`/`resetToEmpty()` always populate it ([]). */
  dismissedDriftSignals?: DriftCooldownEntry[];
  /** Annual-candidate (`lib/historyStats.ts` `detectAnnualCandidates`) merchants
   *  the user tapped "Not this one" on in `AnnualCaughtSheet` — DATA_INTELLIGENCE.md
   *  phase ⑥ item 5 ("annual-bill radar"). Recorded by normalised merchant key,
   *  identical "dismissed once, quiet after that" contract to
   *  `dismissedBillSignals`. Optional for shape back-compat; `DEFAULTS`/
   *  `load()`/`resetToEmpty()` always populate it ([]). */
  dismissedAnnualSignals?: string[];
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
  /** Interim import-log — a stopgap ahead of the full accounts/sources model (task: coherence-fix).
   *  One entry per successful `addStatementAsHistory` call that actually landed at least one new
   *  transaction (a call whose candidates were all duplicates/empty logs nothing — mirrors
   *  `duplicatesSkipped`'s "nothing new" semantics). Lets AccountScreen's "Statements & receipts" row
   *  and footprint grid reflect a REAL import instead of the old `subsCount + potsCount > 0` proxy
   *  (which was seed-data-shaped and never moved after an actual statement landed). Newest first,
   *  capped at `STATEMENT_IMPORT_CAP` (200) — mirrors `timelineEvents`'s retention shape. Optional for
   *  shape back-compat with hand-built `AppState` fixtures predating this field; `DEFAULTS`/`load()`/
   *  `resetToEmpty()` always populate it ([]). */
  statementImports?: StatementImportRecord[];
  /** ACCOUNTS_MODEL.md §2 — named accounts (bank/credit-card/savings/cash), replacing the single
   *  implicit "the whole ledger is one account" model. OPTIONAL for shape back-compat: every existing
   *  install has this absent until `load()`'s `synthesizeDefaultAccount` backfills exactly one `'Main'`
   *  bank account mirroring the legacy `currentBalance` scalar (see that function's doc). `DEFAULTS`/
   *  `load()`/`resetToEmpty()` always populate it with at least the one synthesized/seed account — a
   *  reader should still treat an absent/empty array defensively (fall back to reading `currentBalance`
   *  directly), since hand-built `AppState` fixtures predating this field are still valid. */
  accounts?: Account[];
};

/** One row of `AppState.statementImports` — a single successful bulk statement/receipt landing.
 *  `source` mirrors `ReviewItem.source`/`Transaction.source` conventions (the intake path that
 *  produced the candidates); `rowCount` is how many NEW transactions this import actually added
 *  (post-dedup — never the raw candidate count, matching `addStatementAsHistory`'s own honest-summary
 *  convention). */
export type StatementImportRecord = {
  id: string;
  /** Which intake path produced it. Best-effort — 'unknown' when the caller doesn't have one handy
   *  (e.g. a call site that predates this field). */
  source: 'paste' | 'pdf' | 'image' | 'csv' | 'txt' | 'manual' | 'unknown';
  /** How many new transactions this import landed (after dedup). */
  rowCount: number;
  /** ISO timestamp. */
  atISO: string;
  /** ACCOUNTS_MODEL.md §2.3 — which `Account` this import landed into. OPTIONAL for shape back-compat
   *  with every pre-existing logged import (and any hand-built fixture); treat an absent value as
   *  `DEFAULT_ACCOUNT_ID` (mirrors `accountIdOf()`'s contract for `Transaction`). `logStatementImport`
   *  always stamps a real value going forward. */
  accountId?: string;
  /** Best-effort filename from the file picker, if the intake path had one. Optional — most intake
   *  paths (paste, manual) never have a filename. */
  filename?: string;
  /** The closing balance this import reported, if any (mirrors `StatementClosingBalanceOffer`).
   *  Optional — not every statement/reader supplies one. Signed £ float, matching `Account.balance`. */
  closingBalanceMinor?: number;
};

/** Retention cap for `statementImports` — mirrors `timelineEvents`'s 200-entry cap. */
export const STATEMENT_IMPORT_CAP = 200;

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

/** ACCOUNTS_MODEL.md §2.1 migration — synthesize the ONE default bank `Account` every existing
 *  install implicitly had (the whole ledger was always "one account" via `currentBalance`), so a
 *  user who never touches the new multi-account UI sees no behaviour change at all. Mirrors
 *  `currentBalance`'s `amount`/`setAt` exactly (`balance === currentBalance.amount`,
 *  `balanceAsOfISO === currentBalance.setAt`) — this is what makes `selectBankBalanceMinor` on a
 *  single-account (migrated) install byte-identical to the old scalar (pinned by
 *  store.test.ts). `addedAt` uses `currentBalance.setAt` too, since there's no better "when was this
 *  install's implicit account first known" timestamp available at migration time. Pure — never reads
 *  or writes the live store. */
function synthesizeDefaultAccount(currentBalance: CurrentBalance): Account {
  return {
    id: DEFAULT_ACCOUNT_ID,
    name: 'Main',
    kind: 'bank',
    isLiability: false,
    balanceMinor: currentBalance.amount,
    balanceAsOfISO: currentBalance.setAt,
    addedAt: currentBalance.setAt,
  };
}

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
  accounts: [synthesizeDefaultAccount(SAMPLE_BALANCE)],
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
  readerClosingBalance: null,
  ignoredReviewSigs: [],
  reviewQueue: [],
  reviewQueueSpillover: [],
  statementImports: [],
  moneyMode: 'survival',
  bufferAmount: 100,
  modeExtras: {},
  // Sentinel monthKey '' never matches a real month, so the counter reads as 0 used until the
  // first recorded read stamps the real month.
  aiReads: { monthKey: '', used: 0 },
  aiReadCache: {},
  whatChangedSeenISO: null,
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
  dismissedDriftSignals: [],
  dismissedAnnualSignals: [],
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

/** Tolerant loader for `AppState.dismissedDriftSignals` — see that field's doc for the shape change
 *  (`string[]` -> `DriftCooldownEntry[]`). This store is uncommitted/in-memory-only, so there is no
 *  real persisted-blob back-compat burden, but a stray legacy string-array shape (from a prior
 *  in-memory session's parked blob) degrades to `[]` rather than crashing or silently misreading a
 *  bare string as `{ merchant, at }`. Anything already shaped as entries passes through unfiltered. */
function normaliseDriftCooldownEntries(raw: unknown): DriftCooldownEntry[] {
  if (!Array.isArray(raw)) return [];
  const isEntry = (v: unknown): v is DriftCooldownEntry =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).merchant === 'string' &&
    typeof (v as Record<string, unknown>).at === 'string';
  return raw.every(isEntry) ? raw : [];
}

// ---------- In-memory persistence (replaces window.localStorage) ----------
// `persistedBlob` is the single in-memory record the web original kept in
// localStorage under `KEY`. `null` = nothing persisted yet (first run).
// `futureBlobs` mirrors the web original's `${KEY}.future.${v}` parking slots.
// Wire @folio/storage + op-sqlite over these two later (BUILD_PLAN §3).
let persistedBlob: Record<string, unknown> | null = null;
const futureBlobs: Record<string, Record<string, unknown>> = {};

// ---------- Demo/seed containment (owner rule 2026-07-06) ----------
// The app ships demo/seed data so a fresh DEV build has something to render.
// It must NEVER be shown as a real user's own money: a released build starts
// clean (real data required to use the app), and any demo data that already
// leaked onto a real user's device is stripped on load. These helpers are the
// single source of truth for WHAT counts as seed and HOW it is safely removed.

/** True when a flat record equals one of the SHIPPED seed records (`seeds`)
 *  FIELD-FOR-FIELD. Matching the whole object — not just an id — is what makes
 *  the strip safe against id collisions: onboarding legitimately reuses the seed
 *  pot ids ('holiday'/'buffer'/'christmas'), but a real onboarded pot has
 *  `saved: 0` and the user's own goal, so it never equals the seed pot
 *  (`saved: 420`, …) and is never stripped. A record is removed only if EVERY
 *  field matches a shipped seed exactly. All seed records are flat (primitive
 *  values only), so a key-count + strict-equal-per-key check is complete
 *  deep-equality here. */
function isShippedSeedRecord(rec: unknown, seeds: readonly unknown[]): boolean {
  if (rec === null || typeof rec !== 'object') return false;
  const r = rec as Record<string, unknown>;
  const rKeys = Object.keys(r);
  return seeds.some((seed) => {
    const sd = seed as Record<string, unknown>;
    const sKeys = Object.keys(sd);
    return rKeys.length === sKeys.length && rKeys.every((k) => r[k] === sd[k]);
  });
}

/** TRUE only in a dev/Metro build (`__DEV__`). A released app ALWAYS starts
 *  clean — no demo data (owner rule). `typeof` guard so it is safe under
 *  vitest/Node where `__DEV__` is undefined (→ treated as a release → clean). */
const SEED_ON_FIRST_RUN = typeof __DEV__ !== 'undefined' && __DEV__ === true;

/** True when the state shows ANY sign of real use, so demo data must never sit
 *  alongside it: onboarding done, a non-`sample` balance, any non-seed
 *  transaction, or any logged statement import. A state matching NONE of these
 *  is an untouched demo/preview (e.g. after the Privacy "Reset to the demo"),
 *  whose demo data is intentional and left.
 *
 *  NOTE: `incomeSources` is deliberately NOT a signal — the v7→v8 migration
 *  synthesizes one "Pay" source for EVERY install (including a demo one, from
 *  the seed onboarding.payday/monthlyIncome), so its presence would falsely
 *  flag a migrated demo/preview state as a real user and strip its demo data. */
export function isRealUser(s: AppState): boolean {
  return (
    s.onboarding.done === true ||
    s.currentBalance.source !== 'sample' ||
    s.transactions.some((t) => t.source !== 'seed') ||
    (s.statementImports?.length ?? 0) > 0
  );
}

/** Remove every shipped demo/seed record from a state. SAFE BY CONSTRUCTION:
 *  transactions and the balance are stripped by their unambiguous marker
 *  (`source:'seed'` / `source:'sample'`); pots, subs, debts, plans, and cycles
 *  are stripped ONLY when they equal a shipped seed record field-for-field
 *  (`isShippedSeedRecord`), so a record the user created or funded — even one
 *  that reuses a seed id or name (onboarding pots reuse 'holiday'/'buffer'/
 *  'christmas'; a real "Spotify") — is NEVER deleted. Pure + idempotent. */
export function stripSeedData(s: AppState): AppState {
  const now = new Date().toISOString();

  // Subs stripped by whole-record field-match; also drop their paused/override
  // map entries (keyed by sub name) for exactly the subs that were stripped.
  const strippedSubNames = new Set(
    s.subs.filter((sub) => isShippedSeedRecord(sub, DEFAULT_SUBS)).map((sub) => sub.name),
  );
  const dropStrippedSubs = <T>(m: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(m).filter(([name]) => !strippedSubNames.has(name)));

  const balanceIsSample = s.currentBalance.source === 'sample';
  const currentBalance: CurrentBalance = balanceIsSample
    ? { ...EMPTY_BALANCE, setAt: now }
    : s.currentBalance;

  // Only override `accounts` when we actually remap it (sample balance reset);
  // otherwise inherit it untouched from `...s` so its optional type is preserved
  // (an explicit `undefined` would break `exactOptionalPropertyTypes`).
  const remapAccounts = balanceIsSample && Array.isArray(s.accounts);
  return {
    ...s,
    transactions: s.transactions.filter((t) => t.source !== 'seed'),
    // Debts/plans strip by the unambiguous `seed-*` id marker (robust even if a
    // seed row was later modified — e.g. a field added by another engine — which
    // a field-for-field match would miss), OR a full shipped-seed match. SAFE:
    // a real debt/plan never carries a `seed-*` id (addDebt→`debt-*`, addPlan→
    // `plan-*`, card payoff→`debt-for-*`), so this only ever removes seed rows.
    debts: (s.debts ?? []).filter(
      (d) => !(d.id.startsWith('seed-') || isShippedSeedRecord(d, DEFAULTS.debts ?? [])),
    ),
    plans: (s.plans ?? []).filter(
      (p) => !(p.id.startsWith('seed-') || isShippedSeedRecord(p, DEFAULTS.plans ?? [])),
    ),
    pots: s.pots.filter((p) => !isShippedSeedRecord(p, DEFAULTS.pots)),
    subs: s.subs.filter((sub) => !strippedSubNames.has(sub.name)),
    subPaused: dropStrippedSubs(s.subPaused),
    subOverrides: dropStrippedSubs(s.subOverrides),
    cycles: s.cycles.filter((c) => !isShippedSeedRecord(c, DEFAULTS.cycles)),
    currentBalance,
    ...(remapAccounts
      ? {
          accounts: (s.accounts ?? []).map((a) =>
            a.id === DEFAULT_ACCOUNT_ID && !a.isLiability
              ? { ...a, balanceMinor: currentBalance.amount, balanceAsOfISO: now }
              : a,
          ),
        }
      : {}),
  };
}

/** OTA-safe cleanup: strip demo data IFF this is a real user's state. Idempotent
 *  and a no-op for genuine demo/preview states. This is what removes demo data
 *  that already leaked onto a real device — first-run seeding changes alone
 *  cannot, because the demo data is already persisted in the blob. */
export function purgeSeedIfReal(s: AppState): AppState {
  return isRealUser(s) ? stripSeedData(s) : s;
}

/** The state a FIRST run lands on. Dev/Metro seeds the demo set; a released
 *  build starts genuinely empty (onboarding still runs — `onboarding.done`
 *  stays false — and leads the user to add real data). */
function firstRunState(): AppState {
  if (SEED_ON_FIRST_RUN) {
    return { ...DEFAULTS, transactions: seedTransactions() };
  }
  const emptyBalance: CurrentBalance = { ...EMPTY_BALANCE, setAt: new Date().toISOString() };
  return {
    ...DEFAULTS,
    pots: [],
    subs: [],
    subPaused: {},
    subOverrides: {},
    cycles: [],
    debts: [],
    plans: [],
    currentBalance: emptyBalance,
    accounts: [synthesizeDefaultAccount(emptyBalance)],
    transactions: [],
    incomeSources: [],
  };
}

/** True when the LAST load()'s pipeline threw and the state degraded to defaults —
 *  persist.ts reads this (consumeLoadDegraded) to treat the source file as unreadable
 *  and run the designed park-and-recover path instead of trusting the degraded state. */
let loadDegraded = false;
export function consumeLoadDegraded(): boolean {
  const was = loadDegraded;
  loadDegraded = false;
  return was;
}

function load(): AppState {
  try {
    loadDegraded = false;
    if (!persistedBlob) {
      // First run on this device. A RELEASED build starts CLEAN (owner rule
      // 2026-07-06: real data required to use the app — no demo data shipped);
      // only a dev/Metro build seeds the demo set. See `firstRunState`.
      return firstRunState();
    }
    // Deep-clone the persisted blob so migrate/load never mutate the stored copy.
    const parsedRaw = JSON.parse(JSON.stringify(persistedBlob)) as Record<string, unknown>;
    const migrated = migrate(parsedRaw) as Partial<AppState>;
    // Resolved once so `accounts` (below) can synthesize the default account from the SAME balance
    // this load is about to publish — never a stale/different one.
    const resolvedCurrentBalance = migrated.currentBalance ?? SAMPLE_BALANCE;
    const loaded: AppState = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      pots: Array.isArray(migrated.pots) ? migrated.pots : DEFAULTS.pots,
      // Date-anchor re-derivation (lib/renewalMath.ts): every hydration recomputes each sub's
      // relative day count from its persisted date anchor (synthesizing anchors for legacy
      // subs), so `nextRenewalDaysAway` can never rot between sessions.
      subs: reanchorRenewals(
        Array.isArray(migrated.subs) ? migrated.subs : DEFAULTS.subs,
        new Date().toISOString().slice(0, 10),
      ).items,
      subPaused: migrated.subPaused ?? {},
      subOverrides: migrated.subOverrides ?? {},
      cycles: Array.isArray(migrated.cycles) ? migrated.cycles : DEFAULTS.cycles,
      onboarding: { ...DEFAULTS.onboarding, ...(migrated.onboarding ?? {}) },
      currentBalance: resolvedCurrentBalance,
      // ACCOUNTS_MODEL.md §2.1 migration: an install that already has `accounts` keeps them
      // untouched; one that doesn't (every pre-existing install) gets exactly one synthesized
      // `'Main'` bank account mirroring `resolvedCurrentBalance` — see `synthesizeDefaultAccount`.
      accounts:
        Array.isArray(migrated.accounts) && migrated.accounts.length > 0
          ? migrated.accounts
          : [synthesizeDefaultAccount(resolvedCurrentBalance)],
      potLedger: migrated.potLedger ?? [],
      nextYouNote: migrated.nextYouNote ?? '',
      tightPointGoal: migrated.tightPointGoal ?? null,
      // NEVER silently re-seed an existing install: a persisted blob that
      // somehow lacks its transactions list starts empty, not with demo rows
      // (a real user would otherwise see fake Pret/Tesco rows appear — the
      // exact contamination this whole change removes).
      transactions: Array.isArray(migrated.transactions) ? migrated.transactions : [],
      droppedTransactionCount:
        typeof migrated.droppedTransactionCount === 'number' ? migrated.droppedTransactionCount : 0,
      edits: Array.isArray(migrated.edits) ? migrated.edits : [],
      calendarEvents: Array.isArray(migrated.calendarEvents) ? migrated.calendarEvents : [],
      calendarFocusDate: null,
      routeFocusDate: null,
      // Transient review queue — never restored from a persisted blob (it is
      // excluded from getPersistBlob), so a load always starts it empty.
      readerCandidates: [],
      readerClosingBalance: null,
      ignoredReviewSigs: migrated.ignoredReviewSigs ?? [],
      reviewQueue: Array.isArray(migrated.reviewQueue) ? migrated.reviewQueue : [],
      reviewQueueSpillover: Array.isArray(migrated.reviewQueueSpillover)
        ? migrated.reviewQueueSpillover
        : [],
      statementImports: Array.isArray(migrated.statementImports) ? migrated.statementImports : [],
      moneyMode: migrated.moneyMode ?? DEFAULT_MONEY_MODE,
      bufferAmount: migrated.bufferAmount ?? DEFAULT_BUFFER_AMOUNT,
      modeExtras: migrated.modeExtras ?? {},
      aiReads: migrated.aiReads ?? { monthKey: '', used: 0 },
      aiReadCache: migrated.aiReadCache ?? {},
      whatChangedSeenISO: migrated.whatChangedSeenISO ?? null,
      debts: Array.isArray(migrated.debts) ? migrated.debts : DEFAULT_DEBTS,
      household: migrated.household ?? DEFAULT_HOUSEHOLD,
      plans: Array.isArray(migrated.plans) ? migrated.plans : DEFAULT_PLANS,
      lens: migrated.lens ?? DEFAULT_LENS,
      melo: migrated.melo ?? DEFAULT_MELO,
      tinyWins: Array.isArray(migrated.tinyWins) ? migrated.tinyWins : [],
      timelineEvents: Array.isArray(migrated.timelineEvents)
        ? migrated.timelineEvents
        : DEFAULT_TIMELINE_EVENTS,
      incomeSources: Array.isArray(migrated.incomeSources)
        ? migrated.incomeSources
        : DEFAULT_INCOME_SOURCES,
      dismissedIncomeSignals: Array.isArray(migrated.dismissedIncomeSignals)
        ? migrated.dismissedIncomeSignals
        : [],
      dismissedBillSignals: Array.isArray(migrated.dismissedBillSignals)
        ? migrated.dismissedBillSignals
        : [],
      dismissedDriftSignals: normaliseDriftCooldownEntries(migrated.dismissedDriftSignals),
      dismissedAnnualSignals: Array.isArray(migrated.dismissedAnnualSignals)
        ? migrated.dismissedAnnualSignals
        : [],
      merchantCategories: migrated.merchantCategories ?? DEFAULT_MERCHANT_CATEGORIES,
    };
    // Sweep stale sub-nudges on load — an override whose nudged renewal
    // date has already passed is consumed and deleted. Matches ENGINES.md
    // § 6 "sub-nudge clears the day after nudgedDate".
    // OTA cleanup: strip any demo/seed data that leaked onto a REAL user's
    // device (idempotent; a no-op for genuine demo/preview states). This is the
    // step that cleans an already-contaminated install — first-run seeding
    // changes cannot, since the demo data is already persisted in the blob.
    return purgeSeedIfReal({
      ...loaded,
      subOverrides: sweepStaleOverrides(loaded.subs, loaded.subOverrides),
    });
  } catch {
    loadDegraded = true;
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
 *  review queue (`readerCandidates` + its `readerClosingBalance` sibling): they
 *  are read-once / review-before-truth hand-offs that `load()` already resets,
 *  so persisting them would be noise and — for `readerCandidates` — would let
 *  unreviewed candidates survive a restart, which the review-before-truth rule
 *  forbids.
 *  Per ENGINES §7 store-migration / RN_PORT "Store migration". */
export function getPersistBlob(): string {
  const {
    calendarFocusDate: _f,
    routeFocusDate: _r,
    readerCandidates: _rc,
    readerClosingBalance: _rcb,
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
  const setAt = new Date().toISOString();
  // ACCOUNTS_MODEL.md §3 — `setCurrentBalance` is still the ONLY write path every screen uses today
  // (the account-picker/creator UI + `setAccountBalance` migration is P3, not yet wired into
  // BulkStatementLanding/GuidedCheckInScreen/OnboardingSheet). Until that migration lands, this
  // legacy path must keep the synthesized default bank account (`DEFAULT_ACCOUNT_ID`) in sync —
  // otherwise `selectBankBalanceMinor`/`bankTransactions` (read by Safe Zone, the route curve, and
  // every bank-cashflow selector) would silently go stale the moment a user's balance changes,
  // even though there is still only ONE real account. Only the default account is touched, and only
  // when it's a non-liability (bank) account — a user who has already added a second account via P3
  // is expected to use `setAccountBalance` going forward, but this keeps every pre-P3 install
  // correct with zero behavior change (single-account sum-of-one stays byte-identical).
  // `next.amount` remains the DEFAULT account's new balance, but `currentBalance.amount` is now the
  // recomputed bank-only total across ALL accounts (mirroring `setAccountBalance`'s bankTotal), so a
  // user with a second account added via the statement-import picker sees the correct combined figure
  // instead of a stale echo of the default account alone.
  const accounts = state.accounts ?? [];
  const nextAccounts = accounts.map((a) =>
    a.id === DEFAULT_ACCOUNT_ID && !a.isLiability
      ? { ...a, balanceMinor: next.amount, balanceAsOfISO: setAt }
      : a,
  );
  const bankAccounts = nextAccounts.filter((a) => !a.isLiability);
  const bankTotal =
    bankAccounts.length === 0
      ? next.amount
      : bankAccounts.reduce((sum, a) => sum + a.balanceMinor, 0);
  setPartial({ currentBalance: { ...next, amount: bankTotal, setAt }, accounts: nextAccounts });
}

/* ---------- Accounts (ACCOUNTS_MODEL.md §2 / §4 P1-P2) ---------- */

/** ACCOUNTS_MODEL.md §2.4 — stable id for the `Debt` row synced from a credit-card `Account`, so
 *  find-or-create is idempotent (same accountId always maps to the same Debt row, never a
 *  duplicate). Not exported — callers never construct this id themselves, only `syncCardDebt`
 *  does, and readers key off `Debt.linkedAccountId` (below) rather than parsing this string. */
function cardDebtId(accountId: string): string {
  return `debt-for-${accountId}`;
}

/** ACCOUNTS_MODEL.md §2.4 recommendation (a) — sync-on-write: whenever a `kind: 'credit-card'`
 *  account's balance changes (import or manual), find-or-create a paired `Debt` row so the existing
 *  debt engine (`debtEngine.summarise`, `weightedApr`, avalanche/snowball ordering — all pure
 *  functions over `Debt[]`) and every current `state.debts` reader (the Debt strategy, `LogPaymentSheet`,
 *  `notifyState.ts`) see imported cards alongside seed loans/BNPL with ZERO changes to any of them.
 *  This is the chosen bridge over reading liability accounts directly from `debtEngine`, because
 *  `apr`/`minPayment`/`dueDom` have no equivalent on `Account` and the amortisation math needs them —
 *  a statement import can supply the new balance, but payoff details still need the user to declare
 *  them once.
 *
 *  Behavior:
 *  - No existing `Debt` row for this account (brand new card, no payoff details declared yet) →
 *    does NOT create one with invented apr/minPayment (0%/£0 would make `debtEngine.summarise`
 *    report a false instant/free payoff — ACCOUNTS_MODEL.md §2.4's explicit warning). Returns
 *    `{ needsPayoffDetails: true }` so the caller can surface an "add payoff details" prompt
 *    (mirroring `strategies/debt.ts`'s existing empty-state honesty pattern). The account's balance
 *    itself is still tracked correctly by `selectNetPositionMinor`/`totalDebtMinor` even with no
 *    linked `Debt` row — only the amortisation VIEW (months-to-payoff) needs the extra fields.
 *  - An existing linked `Debt` row → updates its `balance` from the account's `balanceMinor`,
 *    leaving `apr`/`minPayment`/`dueDom`/`name` untouched (those are the user's own declarations,
 *    never overwritten by a statement import). Returns `{ needsPayoffDetails: false }`.
 *
 *  Not exported — `addAccount`/`setAccountBalance` call this internally for any `kind: 'credit-card'`
 *  account, so every write path that can change a card's balance stays in sync automatically; a
 *  caller never needs to remember to call this separately. */
function syncCardDebt(accountId: string, balanceMinor: number): { needsPayoffDetails: boolean } {
  const debts = state.debts ?? [];
  const linkedId = cardDebtId(accountId);
  const existing = debts.find((d) => d.id === linkedId);
  if (existing === undefined) {
    return { needsPayoffDetails: true };
  }
  setPartial({
    debts: debts.map((d) => (d.id === linkedId ? { ...d, balance: Math.max(0, balanceMinor) } : d)),
  });
  return { needsPayoffDetails: false };
}

/** ACCOUNTS_MODEL.md §2.4 — declare payoff details (APR/min payment/due day) for a credit-card
 *  `Account` that has no linked `Debt` row yet (i.e. `syncCardDebt` returned `needsPayoffDetails:
 *  true`). Creates the linked `Debt` row keyed by `debt-for-${accountId}` with the account's CURRENT
 *  balance. No-op if the account doesn't exist, isn't a credit card, or already has a linked `Debt`
 *  row (use `addDebt`/direct edits for a standalone loan/BNPL `Debt` — this is only for the
 *  account-linked card path). This is the UI seam the "add payoff details" prompt calls. */
export function addCardPayoffDetails(
  accountId: string,
  details: { apr: number; minPayment: number; dueDom: number },
): Debt | null {
  const accounts = state.accounts ?? [];
  const account = accounts.find((a) => a.id === accountId);
  if (account === undefined || account.kind !== 'credit-card') return null;
  const debts = state.debts ?? [];
  const linkedId = cardDebtId(accountId);
  if (debts.some((d) => d.id === linkedId)) return null;
  const full: Debt = {
    id: linkedId,
    name: account.name,
    kind: 'card',
    balance: Math.max(0, account.balanceMinor),
    apr: details.apr,
    minPayment: details.minPayment,
    dueDom: details.dueDom,
    addedAt: new Date().toISOString(),
    linkedAccountId: accountId,
  };
  setPartial({ debts: [...debts, full] });
  return full;
}

/** Add a new named account. `id` auto-generates when omitted; `balance`/`balanceAsOfISO`/`addedAt`
 *  default to 0/now/now for a freshly-declared account with no known balance yet. `isLiability`
 *  defaults `true` for `kind: 'credit-card'` and `false` for every other kind, matching
 *  ACCOUNTS_MODEL.md §2.1's convention — pass it explicitly to override. Account-picker/creator UI is
 *  P3; this is the plumbing it will call.
 *
 *  ACCOUNTS_MODEL.md §2.4 (P2) — a `kind: 'credit-card'` account with a non-zero starting balance
 *  attempts `syncCardDebt` immediately (a card can be added with its statement-derived balance already
 *  known, e.g. from the account-creation flow), so it appears in `totalDebtMinor`/the debt view
 *  without a separate "now sync it" step. A brand-new card with no linked `Debt` row yet still needs
 *  `addCardPayoffDetails` before it contributes amortisation math (payoff months) — see `syncCardDebt`. */
export function addAccount(
  input: Partial<Omit<Account, 'id'>> & Pick<Account, 'name' | 'kind'>,
): Account {
  const now = new Date().toISOString();
  const account: Account = {
    id: `acct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name,
    kind: input.kind,
    isLiability: input.isLiability ?? input.kind === 'credit-card',
    balanceMinor: input.balanceMinor ?? 0,
    balanceAsOfISO: input.balanceAsOfISO ?? now,
    addedAt: input.addedAt ?? now,
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.closed !== undefined ? { closed: input.closed } : {}),
  };
  const nextAccounts = [...(state.accounts ?? []), account];
  if (!account.isLiability && account.balanceMinor !== 0) {
    // Same two-way sync invariant as `setAccountBalance`: a new bank account arriving WITH an
    // opening balance moves bank money, so the legacy scalar follows the bank sum in the same
    // write. (The current UI creates accounts at £0 and sets the balance later, so this is a
    // guard for the API contract, not a behavior change for any live flow.)
    const bankTotal = nextAccounts
      .filter((a) => !a.isLiability)
      .reduce((sum, a) => sum + a.balanceMinor, 0);
    setPartial({
      accounts: nextAccounts,
      currentBalance: {
        amount: bankTotal,
        source: 'corrected',
        confidence: 'corrected',
        setAt: account.balanceAsOfISO,
      },
    });
  } else {
    setPartial({ accounts: nextAccounts });
  }
  if (account.kind === 'credit-card') syncCardDebt(account.id, account.balanceMinor);
  return account;
}

/** Rename an existing account. No-op if the id doesn't exist. */
export function renameAccount(accountId: string, name: string) {
  const accounts = state.accounts ?? [];
  if (!accounts.some((a) => a.id === accountId)) return;
  setPartial({
    accounts: accounts.map((a) => (a.id === accountId ? { ...a, name } : a)),
  });
}

/** ACCOUNTS_MODEL.md §3 step 4 — set a SPECIFIC account's balance (replaces the global
 *  `setCurrentBalance` write for any account-aware caller). Stamps `balanceAsOfISO`. No-op if the
 *  account id doesn't exist (never silently creates one — callers must `addAccount` first).
 *
 *  Two-way sync invariant: `setCurrentBalance` (legacy path) mirrors into the default account, and
 *  this path mirrors back into the legacy `currentBalance` scalar for any NON-liability write —
 *  the scalar becomes the bank-only sum (`selectBankBalanceMinor` over the updated accounts).
 *  Without the reverse sync, every remaining `currentBalance` reader (Calendar ladder, Account,
 *  DayDetail, Paywall, Review, the mode-input builders) keeps showing the pre-import balance while
 *  the route shows the new one. `provenance` labels the scalar honestly (a statement-derived write
 *  must not masquerade as user-entered); it defaults to a manual correction. Liability (card)
 *  writes never touch the scalar — borrowing is not bank money.
 *
 *  ACCOUNTS_MODEL.md §2.4 (P2) — when the account is `kind: 'credit-card'`, also runs `syncCardDebt`
 *  so its linked `Debt` row's balance stays current (a statement import's closing balance, or a
 *  manual edit, both flow through this single write path). See `syncCardDebt`'s doc for the
 *  find-or-create contract and the `needsPayoffDetails` signal. */
export function setAccountBalance(
  accountId: string,
  amount: number,
  asOfISO?: string,
  provenance?: { source: BalanceSource; confidence: BalanceConfidence },
) {
  const accounts = state.accounts ?? [];
  const account = accounts.find((a) => a.id === accountId);
  if (account === undefined) return;
  const balanceAsOfISO = asOfISO ?? new Date().toISOString();
  const nextAccounts = accounts.map((a) =>
    a.id === accountId ? { ...a, balanceMinor: amount, balanceAsOfISO } : a,
  );
  if (account.isLiability) {
    setPartial({ accounts: nextAccounts });
  } else {
    const bankTotal = nextAccounts
      .filter((a) => !a.isLiability)
      .reduce((sum, a) => sum + a.balanceMinor, 0);
    setPartial({
      accounts: nextAccounts,
      currentBalance: {
        amount: bankTotal,
        source: provenance?.source ?? 'corrected',
        confidence: provenance?.confidence ?? 'corrected',
        setAt: balanceAsOfISO,
      },
    });
  }
  if (account.kind === 'credit-card') syncCardDebt(accountId, amount);
}

/** ACCOUNTS_MODEL.md §2.4 — sum of non-liability (`bank`/`savings`/`cash`) account balances. This is
 *  "how much spendable money exists" — Safe Zone / day-to-day spend safety must read THIS, never a
 *  credit card's balance (borrowing, not bank money). On a single-account (migrated) install this is
 *  byte-identical to the old `state.currentBalance.amount` scalar — pinned by store.test.ts, since
 *  `synthesizeDefaultAccount` mirrors `currentBalance` exactly and there is exactly one bank account.
 *  Falls back to `state.currentBalance.amount` when `accounts` is absent/empty (hand-built fixtures
 *  predating this field), so this selector is always safe to call. */
export function selectBankBalanceMinor(state: AppState): number {
  const accounts = state.accounts ?? [];
  if (accounts.length === 0) return state.currentBalance.amount;
  return accounts.filter((a) => !a.isLiability).reduce((sum, a) => sum + a.balanceMinor, 0);
}

/** ACCOUNTS_MODEL.md §2.4 — net position: Σ(non-liability balances) − Σ(liability balances). This is
 *  the "are we solvent" number (net-worth-style framing), DISTINCT from `selectBankBalanceMinor` /
 *  Safe Zone (bank-only, day-to-day spend safety). Falls back to `state.currentBalance.amount` when
 *  `accounts` is absent/empty, matching `selectBankBalanceMinor`'s back-compat contract. */
export function selectNetPositionMinor(state: AppState): number {
  const accounts = state.accounts ?? [];
  if (accounts.length === 0) return state.currentBalance.amount;
  return accounts.reduce((sum, a) => sum + (a.isLiability ? -a.balanceMinor : a.balanceMinor), 0);
}

/** ACCOUNTS_MODEL.md §2.4 point 2 — the "total owed" figure the payoff view needs: every
 *  credit-card `Account`'s balance PLUS every pure-`Debt` row (seed loans/BNPL, and any card `Debt`
 *  that isn't linked to an `Account`), counted exactly once each.
 *
 *  Double-count guard: a `kind: 'credit-card'` `Account` that has been synced (`syncCardDebt`/
 *  `addCardPayoffDetails`) has BOTH its own `balanceMinor` AND a linked `Debt` row carrying the same
 *  balance (`Debt.linkedAccountId === account.id`) — summing both blindly would double the card's
 *  contribution. So this selector sums liability accounts directly, then adds only the `Debt` rows
 *  that are NOT linked to any account (`d.linkedAccountId === undefined` — pure loans/BNPL, or a
 *  not-yet-account-linked card `Debt` predating this phase), never a linked `Debt` row's own
 *  `balance` a second time. */
export function totalDebtMinor(state: AppState): number {
  const accounts = state.accounts ?? [];
  const debts = state.debts ?? [];
  const cardAccountTotal = accounts
    .filter((a) => a.isLiability)
    .reduce((sum, a) => sum + a.balanceMinor, 0);
  const unlinkedDebtTotal = debts
    .filter((d) => d.linkedAccountId === undefined)
    .reduce((sum, d) => sum + d.balance, 0);
  return cardAccountTotal + unlinkedDebtTotal;
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

/* ---------- Drift signals (`lib/driftSignals.ts`) — DATA_INTELLIGENCE.md phase ⑥ ---------- */
/* ---------- + per-merchant re-propose COOLDOWN (task: "drift thrash" fix) ---------- */

/** Shared writer for both drift actions below — records (or refreshes) this merchant's cooldown
 *  entry with `at` = now, replacing any prior entry for the SAME merchant (never accumulating one row
 *  per re-trigger) so `findDriftCandidates`'s cooldown check always reads the MOST RECENT action. */
function recordDriftCooldown(merchant: string) {
  const key = normaliseIncomeSignalKey(merchant);
  const current = state.dismissedDriftSignals ?? [];
  const rest = current.filter((entry) => entry.merchant !== key);
  setPartial({
    dismissedDriftSignals: [{ merchant: key, at: new Date().toISOString() }, ...rest],
  });
}

/** Record a detected drift-signal merchant as DISMISSED (`DriftCaughtSheet`'s "Not this one", either
 *  flavour — income drift or bill drift share one list, see `AppState.dismissedDriftSignals`'s doc for
 *  why). Starts/refreshes this merchant's `DRIFT_COOLDOWN_DAYS` (45) re-propose cooldown — a future
 *  detection pass over the same merchant is suppressed until the cooldown lapses UNLESS the new
 *  deviation exceeds the cooldown's `DRIFT_COOLDOWN_BREAKTHROUGH_FRACTION` (30%) break-through, per
 *  `lib/caughtDrift.ts`'s `findDriftCandidates`. */
export function dismissDriftSignal(merchant: string) {
  recordDriftCooldown(merchant);
}

/** Record a detected drift-signal merchant as CONFIRMED (`DriftCaughtSheet`'s "Yes, update it", either
 *  flavour). A confirmed drift is now the entity's honest current value — but the SAME merchant can
 *  still drift again later (a bill can rise twice), so this is a cooldown, not a permanent silence: it
 *  starts/refreshes the identical `DRIFT_COOLDOWN_DAYS` (45) window `dismissDriftSignal` does, quieting
 *  small re-detections of the number that was JUST corrected (classic thrash source — noisy pay ±10-14%
 *  re-triggering every landing) while still letting a genuinely new >30% deviation break through. */
export function confirmDriftSignal(merchant: string) {
  recordDriftCooldown(merchant);
}

/* ---------- Annual candidates (`lib/historyStats.ts` detectAnnualCandidates) ---------- */

/** Record a detected annual-candidate merchant as dismissed (`AnnualCaughtSheet`'s
 *  "Not this one"). A future detection pass over the same merchant is
 *  suppressed rather than surfacing the sheet again — mirrors
 *  `dismissBillSignal`'s "said no once, stays quiet" contract exactly.
 *  Idempotent. */
export function dismissAnnualSignal(merchant: string) {
  const key = normaliseIncomeSignalKey(merchant);
  const current = state.dismissedAnnualSignals ?? [];
  if (current.includes(key)) return;
  setPartial({ dismissedAnnualSignals: [key, ...current] });
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

/** Record a mode's onboarding follow-up answer (£). Merged per mode — re-running onboarding with a
 *  different intent never wipes another mode's declaration. See `AppState.modeExtras`. */
export function setModeExtra(mode: MoneyMode, amount: number) {
  const current = state.modeExtras ?? {};
  setPartial({ modeExtras: { ...current, [mode]: Math.max(0, Math.round(amount)) } });
}

/** FULL (one-time tier) entitlement setter — the write path since the Free/Full/Live
 *  restructure. Sets BOTH legacy flags so every persisted-shape reader (old blobs, the
 *  entitlement record, `useLens`'s grandfather rule) agrees. */
export function setLensFullUnlocked(unlocked: boolean) {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  setPartial({ lens: { ...lens, plusUnlocked: unlocked, proUnlocked: unlocked } });
}

/** @deprecated Legacy Plus setter — kept for the entitlement reconciler's back-compat path only.
 *  A legacy Plus entitlement now means Full (see `LensState`). */
export function setLensPlusUnlocked(unlocked: boolean) {
  setLensFullUnlocked(unlocked);
}

/** @deprecated Legacy Pro setter — same back-compat rule as `setLensPlusUnlocked`. */
export function setLensProUnlocked(unlocked: boolean) {
  setLensFullUnlocked(unlocked);
}

/** Start a one-cycle free trial that unlocks every paid lens together.
 *  `cycleId` is the anchor date (see `lib/lens.ts` `useLens().startTrial`).
 *
 *  ONE trial, ever — enforced here, not just in the UI: an ended trial leaves its anchor in
 *  `trialEndedCycleId`, and a second start would wipe it (re-arming `canOfferTrial` and every
 *  trial CTA) — an infinite re-trial loop through any surface that forgets to check. No-op while
 *  a trial is active OR after one has ended. */
export function startLensTrial(cycleId: string) {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  if (lens.trialCycleId !== null || lens.trialEndedCycleId !== null) return;
  setPartial({
    lens: {
      ...lens,
      trialCycleId: cycleId,
      trialEndedCycleId: null,
      trialEndAcknowledged: true,
    },
  });
}

/** End the active trial. Called by `lib/lens.ts`'s `endLensTrialIfExpired` (boot / foreground /
 *  ritual close, once the trial's end date has passed). Moves the anchor into `trialEndedCycleId`
 *  and clears the ack flag so Today's one-time "trial ended" prompt can actually fire — leaving
 *  `trialEndedCycleId` unset would relock silently AND make `canOfferTrial` true, i.e. an
 *  infinitely restartable trial. No-op when no trial is active. */
export function endLensTrial() {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  if (lens.trialCycleId === null) return;
  setPartial({
    lens: {
      ...lens,
      trialCycleId: null,
      trialEndedCycleId: lens.trialCycleId,
      trialEndAcknowledged: false,
    },
  });
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

/** Log a payment against a debt — decrements the balance, never below £0. A card-linked Debt
 *  mirrors an Account (see `Debt.linkedAccountId`'s doc) — a payment must land on BOTH in one
 *  write, or the next `syncCardDebt` (statement import) erases it. */
export function logDebtPayment(id: string, amount: number) {
  if (!(amount > 0)) return;
  const target = (state.debts ?? []).find((d) => d.id === id);
  if (target === undefined) return;
  const nextDebts = (state.debts ?? []).map((d) =>
    d.id === id ? { ...d, balance: Math.max(0, d.balance - amount) } : d,
  );
  const linkedId = target.linkedAccountId;
  if (linkedId !== undefined) {
    const accounts = (state.accounts ?? []).map((a) =>
      a.id === linkedId
        ? {
            ...a,
            balanceMinor: Math.max(0, a.balanceMinor - amount),
            balanceAsOfISO: new Date().toISOString(),
          }
        : a,
    );
    setPartial({ debts: nextDebts, accounts });
    return;
  }
  setPartial({ debts: nextDebts });
}

/** Reverses a logged payment — increments the balance back by `amount`. Used by LogPaymentSheet's
 *  Tier-1 undo window (useUndo/showUndo) so tapping Undo restores exactly what was paid, mirroring
 *  the pattern EditTxnSheet uses for its own undo snapshot-restore. Mirrors `logDebtPayment`'s
 *  linked-account sync so an undo restores BOTH sides. */
export function undoDebtPayment(id: string, amount: number) {
  if (!(amount > 0)) return;
  const target = (state.debts ?? []).find((d) => d.id === id);
  if (target === undefined) return;
  const nextDebts = (state.debts ?? []).map((d) =>
    d.id === id ? { ...d, balance: d.balance + amount } : d,
  );
  const linkedId = target.linkedAccountId;
  if (linkedId !== undefined) {
    const accounts = (state.accounts ?? []).map((a) =>
      a.id === linkedId
        ? { ...a, balanceMinor: a.balanceMinor + amount, balanceAsOfISO: new Date().toISOString() }
        : a,
    );
    setPartial({ debts: nextDebts, accounts });
    return;
  }
  setPartial({ debts: nextDebts });
}

/** ACCOUNTS_MODEL.md §2.4 point 3 — the payment-path seam for a credit-card `Account` linked to a
 *  `Debt` row (`kind: 'credit-card'`, synced via `syncCardDebt`/`addCardPayoffDetails`). Paying a
 *  card down from a bank account is a TRANSFER, not two independent edits: it must reduce the card's
 *  owed amount AND reduce the paying bank account's balance by the same amount, atomically (a single
 *  `setPartial` call), so `totalDebtMinor`/`selectNetPositionMinor` never observe a half-applied
 *  state where money has vanished from the bank side without yet landing on the card side (or vice
 *  versa).
 *
 *  This does NOT post a `Transaction` on either account — that's a deliberate scope line for this
 *  phase (see ACCOUNTS_MODEL.md §2.4 point 3's "leave a clean seam" instruction): a future
 *  payment-tracking phase can decide whether a card payment should also show up in the ledger as a
 *  paired transfer pair (bank outflow + card inflow) the way a real transfer would; for now this
 *  function is the single source of truth for "a card payment happened" and every caller (a future
 *  "pay my card" UI action) should route through here rather than calling `setAccountBalance` twice
 *  by hand, which would not be atomic and would not touch the linked `Debt` row.
 *
 *  No-op (returns `false`) if: `amount` isn't positive, `bankAccountId` isn't a non-liability
 *  account, or `cardAccountId` isn't a `kind: 'credit-card'` account. Never overdraws the bank
 *  account below the amount available is NOT enforced here (mirrors `logDebtPayment`'s existing
 *  "trust the amount the user typed" contract) — the caller's confirm-sheet is responsible for any
 *  "you don't have that much" warning copy, this function only does the arithmetic honestly. The
 *  card's balance is clamped at £0 (can't go negative from overpaying), matching every other
 *  debt-balance write in this file. */
export function payCreditCardFromBank(
  bankAccountId: string,
  cardAccountId: string,
  amount: number,
): boolean {
  if (!(amount > 0)) return false;
  const accounts = state.accounts ?? [];
  const bank = accounts.find((a) => a.id === bankAccountId);
  const card = accounts.find((a) => a.id === cardAccountId);
  if (bank === undefined || bank.isLiability) return false;
  if (card === undefined || card.kind !== 'credit-card') return false;

  const now = new Date().toISOString();
  const nextCardBalance = Math.max(0, card.balanceMinor - amount);
  const nextAccounts = accounts.map((a) => {
    if (a.id === bankAccountId) {
      return { ...a, balanceMinor: a.balanceMinor - amount, balanceAsOfISO: now };
    }
    if (a.id === cardAccountId) {
      return { ...a, balanceMinor: nextCardBalance, balanceAsOfISO: now };
    }
    return a;
  });
  const linkedId = cardDebtId(cardAccountId);
  const debts = (state.debts ?? []).map((d) =>
    d.id === linkedId ? { ...d, balance: nextCardBalance } : d,
  );
  // Same two-way sync invariant as `setAccountBalance`: the bank side moved, so the legacy
  // `currentBalance` scalar must move with it in the SAME atomic write — its readers would
  // otherwise show the pre-payment bank balance.
  const bankTotal = nextAccounts
    .filter((a) => !a.isLiability)
    .reduce((sum, a) => sum + a.balanceMinor, 0);
  setPartial({
    accounts: nextAccounts,
    debts,
    currentBalance: { amount: bankTotal, source: 'corrected', confidence: 'corrected', setAt: now },
  });
  return true;
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
 *
 *  DATE-CORRECT ORDERING (task: statement re-import date/cap correctness):
 *  `merged` is first sorted by `when` DESCENDING (newest first) with a
 *  STABLE sort, so:
 *    - the persisted ledger is always date-correct, regardless of which
 *      order rows were prepended in (a manual add, a batch import, or a
 *      re-import landing rows out of chronological order all converge on
 *      the same date-sorted list);
 *    - ties (identical `when`, e.g. a batch of rows that all default to
 *      "now") preserve their PRE-SORT relative order — Array#sort is
 *      guaranteed stable (ES2019+), so passing the list in
 *      newest-caller-first order (as every call site already does) keeps
 *      today's existing "last row ends up at the head" ordering contract
 *      for same-instant rows;
 *    - the `TRANSACTION_CAP` slice below therefore evicts the OLDEST rows
 *      BY DATE, not the rows that merely happened to be inserted first —
 *      an older statement import can no longer evict newer, already-present
 *      history just because of concatenation order.
 *  Oldest-evicted-first, honest count out. Pure. */
function applyTransactionRetention(
  merged: readonly Transaction[],
  priorDroppedCount: number,
): { transactions: Transaction[]; droppedTransactionCount: number } {
  const sorted = [...merged].sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0));
  if (sorted.length <= TRANSACTION_CAP) {
    return { transactions: sorted, droppedTransactionCount: priorDroppedCount };
  }
  const evicted = sorted.length - TRANSACTION_CAP;
  return {
    transactions: sorted.slice(0, TRANSACTION_CAP),
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
    ...(t.accountId !== undefined ? { accountId: t.accountId } : {}),
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
 *  head and the FIRST row ends up deepest — for rows sharing the same `when`
 *  (the common case: no explicit date, all default to "now"). This function
 *  reproduces that by reversing `fullRows` before prepending. `when`-DESCENDING
 *  final ordering is then enforced by `applyTransactionRetention` (see its doc)
 *  so rows carrying a real, distinct statement date always land in the
 *  chronologically correct position rather than wherever they were
 *  concatenated — a byte-identical ordering change from the old loop only for
 *  same-instant rows; a correctness fix for dated rows.
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
    ...(t.accountId !== undefined ? { accountId: t.accountId } : {}),
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

/* ---------- Bulk "add all as history" (task: BULK ADD-AS-HISTORY) ---------- */

/** A closing-balance offer surfaced by `addStatementAsHistory` when the reader supplied one — never
 *  fabricated (see `statementReaderParse.ts` / `statementReaderClient.ts`'s closing-balance fields).
 *  The caller (the bulk-landing screen) offers this as a ONE-TAP confirm; nothing here writes a
 *  balance itself — review-before-truth means the write only happens on the user's explicit "Use it"
 *  tap. `accountId` (ACCOUNTS_MODEL.md §3 step 4) is the account THIS offer's balance belongs to
 *  (the same one `addStatementAsHistory` tagged the batch's transactions with) — the confirm button
 *  should call `setAccountBalance(accountId, ...)`, never the legacy global `setCurrentBalance`, so a
 *  second account's import can never clobber a different account's balance. Optional for shape
 *  back-compat with hand-built `AddStatementAsHistoryResult` fixtures predating this field (mirrors
 *  `droppedTransactionCount?`/`duplicatesSkipped?`'s own back-compat contract on the parent type) —
 *  `addStatementAsHistory` itself always populates it; a caller reading an offer with `accountId`
 *  absent should fall back to `DEFAULT_ACCOUNT_ID`. */
export type StatementClosingBalanceOffer = {
  amountPence: number;
  asOfISO: string;
  accountId?: string;
};

/** What `addStatementAsHistory` hands back to the bulk-landing screen — one honest summary of a
 *  whole-statement "add all" landing, plus the two follow-on offers the owner spec calls for: the
 *  strongest detected income signal (if any) and a closing-balance offer (if the reader supplied
 *  one). Both offers are OPTIONAL and OFFERED, never auto-applied — review-before-truth extends to
 *  what happens after the add, not just to the add itself. */
export type AddStatementAsHistoryResult = StatementSummary & {
  /** The strongest income signal detected over the FULL post-landing ledger — `undefined` when
   *  nothing qualifies (mirrors `findCaughtIncome`'s own "nothing to offer" contract). "Strongest" is
   *  the detector's own first result: `findCaughtIncome`/`detectIncomeSources` already ranks by
   *  occurrence/confidence, so this is simply `signals[0]`, not a second ranking pass. */
  incomeSignal?: IncomeCaughtCandidate;
  /** Present only when the caller supplied a closing balance alongside the candidates (i.e. the
   *  reader actually returned one) — never invented here. */
  closingBalanceOffer?: StatementClosingBalanceOffer;
  /** How many OLDER transactions THIS import caused `TRANSACTION_CAP` retention to evict — the
   *  delta of `droppedTransactionCount` across this call, never the store's running lifetime total
   *  (see `bulkSummaryLine`'s doc for why that distinction matters). `0`/absent when this import
   *  didn't push the ledger over the cap, or for a pre-add preview summary that hasn't landed yet
   *  (`buildStatementSummary` alone never sets this field — only `addStatementAsHistory`, which
   *  actually performs the write, can know what it evicted). Task: HISTORY TRIM HONESTY — surfaced
   *  so the bulk-landing summary can be honest about a big import trimming older on-device history,
   *  never silent. */
  droppedTransactionCount?: number;
  /** How many of the candidates handed to THIS call were already present in the ledger (by stable
   *  import id — `importedTransactionId`, an `imp-`-prefixed hash of `statementReaderDedup.ts`'s
   *  `dedupeKey` policy: date-or-'no-date' + amount + normalised merchant) and were therefore
   *  skipped rather than double-counted. Task: RE-IMPORT DEDUP — surfaced so the landing summary can
   *  be honest about a
   *  re-import ("Added N new · M already in Folio") instead of silently re-adding money that was
   *  already there. `0` when every candidate was genuinely new (the common case for a first
   *  import). Optional for shape back-compat with hand-built `AddStatementAsHistoryResult` fixtures
   *  predating this field (mirrors `droppedTransactionCount?` above); `addStatementAsHistory` always
   *  populates it. */
  duplicatesSkipped?: number;
  /** Reconciliation self-check: did the extracted rows add up to the statement's OWN opening/closing
   *  balance + stated totals? `'ok'` = every figure lines up; `'mismatch'` = some rows are likely
   *  missing/misread (surfaced as a warning, never auto-blocked — review-before-truth); `'unverified'`
   *  = the statement didn't print enough to check. Always present (computed over the reader's full
   *  extraction, before dedup). See `reconcileStatement`. */
  reconciliation?: ReconciliationResult;
};

/** Short, deterministic non-cryptographic string hash (32-bit FNV-1a), rendered as an 8-char base-36
 *  string. Used only to derive a STABLE transaction id from a candidate's `dedupeKey` — defense in
 *  depth alongside the Set-based skip in `addStatementAsHistory`: even if that pre-filter were ever
 *  bypassed (a future call site, a refactor), re-adding the exact same candidate twice collides on
 *  the same `id` rather than silently minting a second row for the same money. Not used for anything
 *  security-sensitive — collision resistance only needs to be "good enough to not duplicate a
 *  transaction by accident", not cryptographic. */
function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Stable, deterministic transaction id for one imported candidate — `imp-` + a hash of its
 *  `dedupeKey`. Two imports of the exact same candidate (same date/amount/merchant) always produce
 *  the same id, so even a duplicate that slipped past the Set-based skip below would overwrite/collide
 *  with the existing row's id rather than mint a second row. Manual single-entry `addTransaction`
 *  is untouched — it keeps its existing random `txn-${Date.now()}-...` id, since a manual entry has
 *  no "candidate" to derive a stable key from and doesn't need re-import defense. */
function importedTransactionId(candidate: CandidateMoneyItem): string {
  return `imp-${stableHash(dedupeKey(candidate))}`;
}

/** Bulk-land a whole statement's candidates as history in ONE user-confirmed action (task: BULK
 *  ADD-AS-HISTORY — the core of the "one confirm populates everything" flow). Composes, in order:
 *
 *   1. RE-IMPORT DEDUP (task: statement re-import correctness) — drop any candidate whose STABLE
 *      import id (`importedTransactionId` — `imp-` + a hash of `dedupeKey`'s date/amount/merchant
 *      key, same normalisation as `statementReaderDedup.ts`'s `dedupeKey`) already matches an
 *      EXISTING `imp-`-prefixed row id in `state.transactions`. Comparing by id (not by
 *      reconstructing a natural key from the landed row's `when`, the previous approach) is what
 *      makes a candidate with no `date` round-trip correctly: both sides hash the same `'no-date'`
 *      sentinel, instead of comparing that sentinel against the real "now" timestamp
 *      `candidateToTransactionDraft`/`addTransactionsBatch` stamps onto a date-less row's `when` —
 *      see `transactionImportKey`'s doc for the bug this replaced. This is deliberately narrower
 *      than that module's own chunk-merge dedup:
 *      it only ever suppresses a candidate against what's *already landed in the ledger* — it never
 *      touches within-import duplicates (two chunks of the SAME read repeating a boundary row),
 *      which `mergeChunkCandidates` has already resolved upstream before candidates ever reach here.
 *      A genuine same-day repeat purchase (two identical £3.50 coffees) collides on this key just
 *      like it would in the chunk-merge case — a known, documented ambiguity, not a new one: the
 *      user can still add the second one by hand, and review-before-truth means nothing was ever
 *      silently over-counted, only (rarely) under-counted in a way the user can correct.
 *   2. Map every SURVIVING candidate to a transaction draft (`candidateToTransactionDraft` — signed
 *      amount verbatim, kind-correct category INCLUDING income; see that module's doc for why this
 *      can never coerce an income row onto a spend bucket), stamping a STABLE `imp-`-prefixed id
 *      (`importedTransactionId`) derived from the same key — defense in depth alongside the dedup
 *      filter above: even a candidate that somehow slipped past step 1 collides on id with the
 *      already-landed row instead of duplicating it.
 *   3. `addTransactionsBatch` — the single retention-aware write path (one `setPartial` for the
 *      whole batch, matches VisualizerScreen's existing "Add all"). That function's own doc covers
 *      the DATE-DESCENDING sort + cap-by-date fix layered under this task.
 *   4. `syncHistoryCycles()` — so Insights has reconstructed cycles for the newly-landed history
 *      instead of staying empty regardless of import volume (this is the fix for the diagnosed
 *      "syncHistoryCycles is only called from VisualizerScreen.commit, never reached with real
 *      candidates" gap). Re-running over the deduped+sorted ledger means a repeat import of an
 *      identical statement (nothing new survives step 1) reconstructs IDENTICAL cycles, never
 *      doubled ones.
 *   5. Run the FOUR caught-* detectors ONCE over the full post-landing ledger state (income takes
 *      precedence per the existing ReviewScreen.tsx onAdd ordering — see that function's comment for
 *      the full income > bill > drift > annual precedence and the overspent quiet-moment gate) and
 *      surface the strongest income signal as an offer. Bills/drift/annual are detected here for
 *      parity with that same ordering (nothing here forces the caller to open a caught-sheet — the
 *      caller decides what to do with `incomeSignal`), but only `incomeSignal` is threaded through
 *      the return per the owner spec's two named offers (income + closing balance).
 *
 * `closingBalance`/`closingDate` are OPTIONAL inputs — pass them straight from the reader's result
 * when it supplied them (see `statementReaderParse.ts`'s `closingBalance`/`closingDate` fields).
 * Never fabricated here: omit them and no `closingBalanceOffer` is returned.
 *
 * No-op-safe: an empty `candidates` array adds nothing, runs no detectors, and returns a zeroed
 * summary with no offers — the caller can call this unconditionally without a length guard. Same for
 * an ALL-DUPLICATE `candidates` array (a byte-identical re-import of a statement already landed):
 * nothing new is added, no detectors run (there is nothing new for them to see), and
 * `duplicatesSkipped` honestly reports every one of them.
 *
 * `accountId` (ACCOUNTS_MODEL.md §3 step 3/4) — OPTIONAL, trailing, defaults to `DEFAULT_ACCOUNT_ID`
 * so every existing call site (all 3 UI call sites + every test in this file) keeps working
 * unchanged. When supplied, every landed transaction is tagged with it
 * (`candidateToTransactionDraft`) and, if the caller ALSO supplied `closingBalance`,
 * `result.closingBalanceOffer` carries THIS `accountId` so the caller's confirm tap can call
 * `setAccountBalance(accountId, ...)` on THAT account — never the global `currentBalance` scalar,
 * and never written by this function itself (review-before-truth: the offer is surfaced, not
 * auto-applied, matching the caller's existing "Use it" / "Not now" confirm gate — see
 * `StatementClosingBalanceOffer`'s doc).
 */
export function addStatementAsHistory(
  candidates: readonly CandidateMoneyItem[],
  closingBalance?: ReaderClosingBalance,
  accountId: string = DEFAULT_ACCOUNT_ID,
): AddStatementAsHistoryResult {
  // Reconciliation self-check over the reader's FULL extraction (before dedup) — the statement's own
  // opening/closing balance + stated totals describe the whole statement, not just the new rows.
  const reconciliation = reconcileStatement(candidates, statementTotalsFrom(closingBalance));

  if (candidates.length === 0) {
    return {
      ...buildStatementSummary(candidates),
      droppedTransactionCount: 0,
      duplicatesSkipped: 0,
      reconciliation,
    };
  }

  // Demo→real transition (belt for any path that bypassed onboarding's wipe): an
  // import IS real data, so clear any lingering demo/seed set first — the
  // imported rows must never mix with seed rows in the same session. No-op once
  // the user is already real (`isRealUser`), so a normal re-import is untouched.
  if (!isRealUser(getState())) {
    setPartial(stripSeedData(getState()));
  }

  // Step 1 — drop candidates already present in the ledger. Compared by STABLE IMPORT ID
  // (`importedTransactionId`, an `imp-`-prefixed hash of `dedupeKey`) rather than by reconstructing
  // a natural key from the landed row's `when` (the previous approach): a candidate with no `date`
  // hashes to `dedupeKey`'s `'no-date'` sentinel on BOTH sides this way, so it round-trips correctly
  // instead of comparing against the real "now" timestamp `addTransactionsBatch` stamped onto the
  // landed row (which could never match `'no-date'` and silently defeated dedup for every date-less
  // candidate — see `transactionImportKey`'s doc). `existingImportIds` is computed once from the
  // CURRENT persisted ledger, not recomputed per candidate. Only ids carrying the `imp-` prefix are
  // even candidates for a match (a manual `addTransaction` row's random `txn-...` id never collides).
  const existingImportIds = new Set(
    getState()
      .transactions.map((t) => t.id)
      .filter((id) => id.startsWith('imp-')),
  );
  const newCandidates = candidates.filter((c) => !existingImportIds.has(importedTransactionId(c)));
  const duplicatesSkipped = candidates.length - newCandidates.length;

  // The honest landing summary reflects what's actually being added, not the raw input length — a
  // re-import summary line should say "Found 0 transactions" (plus the duplicate count), never claim
  // it found rows it then silently didn't add.
  const summary = buildStatementSummary(newCandidates);
  if (newCandidates.length === 0) {
    return { ...summary, droppedTransactionCount: 0, duplicatesSkipped, reconciliation };
  }

  const droppedBeforeAdd = getState().droppedTransactionCount ?? 0;
  addTransactionsBatch(
    newCandidates.map((c) => ({
      ...candidateToTransactionDraft(c, accountId),
      id: importedTransactionId(c),
    })),
  );
  syncHistoryCycles();
  logStatementImport(newCandidates, accountId);

  const stateAfterAdd = getState();
  const overspent = isOverspentLanding(stateAfterAdd);
  const droppedByThisImport = (stateAfterAdd.droppedTransactionCount ?? 0) - droppedBeforeAdd;

  // Same precedence ordering as ReviewScreen.tsx's onAdd (income > bill > drift > annual, gated off
  // entirely when the landing is overspent) — computed here for parity even though only the income
  // signal is threaded through the return today.
  const incomeSignals = overspent
    ? []
    : findCaughtIncome(
        stateAfterAdd.transactions,
        stateAfterAdd.incomeSources ?? [],
        stateAfterAdd.dismissedIncomeSignals ?? [],
      );
  if (!overspent && incomeSignals.length === 0) {
    findCaughtBills(
      stateAfterAdd.transactions,
      stateAfterAdd.subs.map((s) => s.name),
      stateAfterAdd.dismissedBillSignals ?? [],
    );
  }
  if (!overspent && incomeSignals.length === 0) {
    findCaughtAnnual(
      stateAfterAdd.transactions,
      stateAfterAdd.dismissedAnnualSignals ?? [],
      stateAfterAdd.subs.map((s) => s.name),
    );
  }

  const result: AddStatementAsHistoryResult = {
    ...summary,
    droppedTransactionCount: droppedByThisImport,
    duplicatesSkipped,
    reconciliation,
  };
  const strongestIncomeSignal = incomeSignals[0];
  if (strongestIncomeSignal !== undefined) result.incomeSignal = strongestIncomeSignal;
  if (closingBalance !== undefined) {
    result.closingBalanceOffer = {
      amountPence: Math.round(closingBalance.amount * 100),
      asOfISO: closingBalance.asOfISO,
      accountId,
    };
  }
  return result;
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

/** `CandidateMoneyItem.source` ('csv' | 'paste' | 'pdf' | 'photo') → `StatementImportRecord.source`
 *  ('paste' | 'pdf' | 'image' | 'csv' | 'txt' | 'manual' | 'unknown') — only the label differs
 *  ('photo' -> 'image', matching `ReviewItem.source`'s naming); every other candidate source passes
 *  through unchanged. */
function toStatementImportSource(
  source: CandidateMoneyItem['source'],
): StatementImportRecord['source'] {
  return source === 'photo' ? 'image' : source;
}

/** Interim import-log writer (task: coherence-fix) — the single write path for
 *  `AppState.statementImports`. Called ONCE per `addStatementAsHistory` call that actually lands at
 *  least one new transaction (the caller already guards on `newCandidates.length === 0` before
 *  reaching this, so a byte-identical re-import that adds nothing never logs a phantom row). The
 *  record's `source` is the first landed candidate's own source — good enough for an honest label on
 *  a single-import row without a second "was this a mixed-source batch" concept the UI doesn't need
 *  yet. Newest first, capped at `STATEMENT_IMPORT_CAP` (200), mirroring `logTimelineEvent`'s own
 *  retention shape. Not exported — `addStatementAsHistory` is the only real caller (every import must
 *  go through it, so a caller should never log an import without actually landing one).
 *
 *  `accountId` defaults to `DEFAULT_ACCOUNT_ID` when omitted, mirroring `accountIdOf`'s own back-compat
 *  contract — `addStatementAsHistory` now passes through whatever account the caller resolved (a
 *  named account from BulkStatementLanding's picker, or the default when the caller didn't resolve
 *  one), so this log entry always matches which account the batch's transactions were tagged with. */
function logStatementImport(
  newCandidates: readonly CandidateMoneyItem[],
  accountId?: string,
): void {
  if (newCandidates.length === 0) return;
  const first = newCandidates[0]!;
  const entry: StatementImportRecord = {
    id: `imp-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source: toStatementImportSource(first.source),
    rowCount: newCandidates.length,
    atISO: new Date().toISOString(),
    accountId: accountId ?? DEFAULT_ACCOUNT_ID,
  };
  const existing = state.statementImports ?? [];
  setPartial({ statementImports: [entry, ...existing].slice(0, STATEMENT_IMPORT_CAP) });
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

/** Stage the closing balance the statement reader reported alongside a read
 *  (`StatementReadResult.closingBalance` — see statementReaderClient.ts), the
 *  sibling of `setReaderCandidates`. IntakeScreen calls this in the same place
 *  it calls `setReaderCandidates` for every reader `ok` (and chunked `ok`/
 *  `partial`) branch that carries one; pass `null` (or omit the call) when the
 *  read didn't produce one — never fabricated here. Consumed by
 *  `BulkStatementLanding` via `useReaderClosingBalance()`. Same review-before-
 *  truth lifecycle as `readerCandidates`: excluded from `getPersistBlob`, reset
 *  by `load()`, and cleared alongside it by `clearReaderCandidates()`. */
/** The closing-balance fact the statement reader stages, plus the OPTIONAL reconciliation figures
 *  (opening balance + the statement's own stated totals) it may also capture — threaded verbatim
 *  reader → `setReaderClosingBalance` → success screen → `BulkStatementLanding` →
 *  `addStatementAsHistory` so the reconciliation self-check has everything the statement printed.
 *  Widening every seam to this ONE type is deliberate: a narrower seam would silently drop the
 *  reconciliation figures (the exact class of bug that dropped the closing balance before). */
export type ReaderClosingBalance = {
  amount: number;
  asOfISO: string;
  openingAmount?: number;
  statedTotalDebits?: number;
  statedTotalCredits?: number;
};

/** One cached statement read (see `AppState.aiReadCache`): the full candidate set + closing
 *  balance a successful read produced, so re-picking the same file replays it for free. `at` is
 *  the ISO write time — the eviction order. */
export type AiReadCacheEntry = {
  candidates: CandidateMoneyItem[];
  closingBalance: ReaderClosingBalance | null;
  at: string;
};

/** Count one AI statement read against the current month. `monthKey` comes from the caller
 *  (lib/billing/readAllowance.ts `monthKeyOf`) so this stays clock-free and Node-testable; a key
 *  change rolls the counter over to 1 (lazy monthly reset). */
export function recordAiRead(monthKey: string) {
  const current = state.aiReads;
  const used = current && current.monthKey === monthKey ? current.used + 1 : 1;
  setPartial({ aiReads: { monthKey, used } });
}

/** Cache a successful statement read by file-content key. Oversized reads are not cached (they
 *  would tax every subsequent persist write more than the saved gateway call is worth); the
 *  oldest entries are evicted so the cache never exceeds READ_CACHE_MAX_ENTRIES. */
export function cacheAiRead(key: string, entry: AiReadCacheEntry) {
  if (entry.candidates.length > READ_CACHE_MAX_CANDIDATES) return;
  const current = state.aiReadCache ?? {};
  const drops = readCacheEvictions(current);
  const kept = Object.fromEntries(Object.entries(current).filter(([k]) => !drops.includes(k)));
  setPartial({ aiReadCache: { ...kept, [key]: entry } });
}

/** The cached read for a file-content key, or null. Pure read — no expiry (a statement's content
 *  never changes; the cache is only bounded by entry-count eviction). */
export function getCachedAiRead(key: string): AiReadCacheEntry | null {
  return state.aiReadCache?.[key] ?? null;
}

/** Stamp the What-Changed baseline (see `AppState.whatChangedSeenISO`). Called by
 *  ui/WhatChangedRow.tsx on its silent first-mount baseline and on every tap-through. */
export function markWhatChangedSeen(nowISO: string) {
  setPartial({ whatChangedSeenISO: nowISO });
}

/** Re-derive every sub's `nextRenewalDaysAway` from its date anchor (lib/renewalMath.ts
 *  `reanchorRenewals`) — the app-foreground half of the date-anchor fix (load() covers boot).
 *  A phone that stays alive across midnight re-derives here instead of rotting until the next
 *  cold start. No-op (no write, no listener churn) when nothing changed. */
export function reanchorSubRenewals(todayIso: string = new Date().toISOString().slice(0, 10)) {
  const { items, changed } = reanchorRenewals(state.subs, todayIso);
  if (changed) setPartial({ subs: items });
}

export function setReaderClosingBalance(closingBalance: ReaderClosingBalance | null) {
  setPartial({ readerClosingBalance: closingBalance });
}

/** Clear the staged statement-reader review queue — call once Review has
 *  consumed the candidates (confirmed or discarded) so the staging slot is
 *  empty again. Clears the `readerClosingBalance` sibling in the same call so
 *  a stale balance from a prior read can never survive into the next one. */
export function clearReaderCandidates() {
  setPartial({ readerCandidates: [], readerClosingBalance: null });
}

/** Read path for the staged statement-reader review queue. A thin selector over
 *  `useAppStore` (the store's one reactive seam) so the Review surface subscribes
 *  to just this slice. Defined down with the other `use*` hooks so it sits after
 *  `useAppStore` is declared. */
export function useReaderCandidates(): CandidateMoneyItem[] {
  return useAppStore((s) => s.readerCandidates);
}

/** Read path for the staged statement-reader closing balance (the
 *  `readerCandidates` sibling set by `setReaderClosingBalance`). Returns `null`
 *  when the current read didn't carry one — a stable reference (not a fresh
 *  `null` literal per call, though `null` needs no identity guard) so
 *  `BulkStatementLandingProps.closingBalance` gets `undefined`/`null`
 *  consistently rather than a fabricated object. */
export function useReaderClosingBalance(): ReaderClosingBalance | null {
  return useAppStore((s) => s.readerClosingBalance ?? null);
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

/** Queue TTL — items older than 14 days age out (design source REVIEW_TTL_MS). Also applied to
 *  `reviewQueueSpillover` (same field, same clock) so a spillover row ages out honestly even if it
 *  never gets a chance to surface. */
const REVIEW_TTL_MS = 14 * 24 * 3600 * 1000;
/** Queue cap — newest 60 kept visible (design source's `.slice(0, 60)`). Anything bumped past this
 *  by `enqueueReviewItems` goes to `reviewQueueSpillover`, not oblivion — see that field's doc. */
const REVIEW_QUEUE_CAP = 60;
/** Spillover cap — the outer bound on how much overflow `enqueueReviewItems` will hold onto beyond
 *  the visible 60. 500 gives a multi-chunk bulk import (hundreds of candidates) real headroom while
 *  still keeping persisted state bounded, matching the spirit of `TRANSACTION_CAP`'s sizing. Once
 *  this outer cap is hit, the OLDEST spillover rows are dropped first (same "newest wins" policy as
 *  the visible queue) — a bound, not a silent per-call drop: an import this large is already
 *  surfaced honestly via the enqueue toast, and the outer 500 is a last-resort ceiling, not the
 *  common case. */
const REVIEW_QUEUE_SPILLOVER_CAP = 500;

/** Return shape for `enqueueReviewItems` — see that function's doc for what `dropped` counts. */
export type EnqueueReviewItemsResult = {
  /** The candidates from THIS call that were actually added (queue or spillover) — same value the
   *  pre-spillover version of this function returned, preserved for existing callers. */
  fresh: ReviewItem[];
  /** How many of `fresh` did NOT make the visible 60-row `reviewQueue` this call — i.e. landed in
   *  `reviewQueueSpillover` instead (or, in the rare outer-cap case, were dropped entirely). Zero
   *  means every fresh candidate is visible in Review right now. Callers (the intake success screens)
   *  surface a toast when this is > 0 so a large import never silently "loses" the tail. */
  dropped: number;
};

/** Enqueue candidates from an intake reader. Each candidate becomes one Review
 *  card. `id` and `addedAt` are stamped here so callers can pass minimal input.
 *  Duplicates already in the queue OR spillover (same merchant + amount + date) are skipped so
 *  re-running a reader on the same file doesn't nag twice. Candidates whose signature is in
 *  `ignoredReviewSigs` are also skipped — the user already said "not this one" for that exact row
 *  (ENGINES.md § 6 "Future intakes skip exact re-matches"). The suppression signature is this
 *  store's `reviewCandidateSig` (the same key the Review surface's Ignore writes), so the skip and
 *  the writes always agree.
 *
 *  SPILLOVER (phase ⑦ "silent queue truncation" fix): the visible `reviewQueue` stays capped at
 *  `REVIEW_QUEUE_CAP` (60) so Review never renders a wall of cards, but a bulk import can produce far
 *  more candidates than that in one call. Rather than silently discarding whatever doesn't fit this
 *  call, anything bumped past the visible cap is combined with the existing spillover, re-sorted
 *  newest-first, TTL-filtered, and capped at `REVIEW_QUEUE_SPILLOVER_CAP` (500) — see
 *  `refillReviewQueueFromSpillover` for how it drains back in as the visible queue empties out. */
export function enqueueReviewItems(
  candidates: Array<Omit<ReviewItem, 'id' | 'addedAt'>>,
): EnqueueReviewItemsResult {
  if (candidates.length === 0) return { fresh: [], dropped: 0 };
  const existingQueue = state.reviewQueue ?? [];
  const existingSpillover = state.reviewQueueSpillover ?? [];
  const ignored = new Set(state.ignoredReviewSigs ?? []);
  const now = Date.now();
  const fresh: ReviewItem[] = [];
  for (const c of candidates) {
    if (ignored.has(reviewCandidateSig(c.merchant, c.amount, c.date ?? ''))) continue;
    const dupe =
      existingQueue.some(
        (it) =>
          it.merchant === c.merchant &&
          it.amount === c.amount &&
          (it.date ?? '') === (c.date ?? ''),
      ) ||
      existingSpillover.some(
        (it) =>
          it.merchant === c.merchant &&
          it.amount === c.amount &&
          (it.date ?? '') === (c.date ?? ''),
      );
    if (dupe) continue;
    fresh.push({
      ...c,
      id: `rv-${now}-${Math.random().toString(36).slice(2, 8)}`,
      addedAt: new Date(now).toISOString(),
    });
  }
  if (fresh.length === 0) return { fresh: [], dropped: 0 };

  // Newest-first, TTL-filtered pool of every row this call needs to place: the fresh candidates plus
  // everything already visible or already spilled over.
  const notExpired = (it: ReviewItem) => now - new Date(it.addedAt).getTime() < REVIEW_TTL_MS;
  const pool = [...fresh, ...existingQueue, ...existingSpillover].filter(notExpired);
  const nextQueue = pool.slice(0, REVIEW_QUEUE_CAP);
  const nextSpillover = pool.slice(REVIEW_QUEUE_CAP, REVIEW_QUEUE_CAP + REVIEW_QUEUE_SPILLOVER_CAP);

  setPartial({ reviewQueue: nextQueue, reviewQueueSpillover: nextSpillover });

  const freshIds = new Set(fresh.map((it) => it.id));
  const freshVisible = nextQueue.filter((it) => freshIds.has(it.id)).length;
  return { fresh, dropped: fresh.length - freshVisible };
}

/** Drain `reviewQueueSpillover` back into the visible `reviewQueue` as space frees up — the other
 *  half of the phase ⑦ spillover fix. Call this anywhere the visible queue shrinks (today: after
 *  `resolveReviewItem`) so a cleared row is honestly replaced by the oldest-waiting overflow item
 *  rather than leaving spillover parked forever. Moves at most enough spillover rows to bring
 *  `reviewQueue` back up to `REVIEW_QUEUE_CAP`; a no-op when the queue isn't under-full or spillover
 *  is empty. TTL-filters the spillover pool on the way in, same as `enqueueReviewItems`, so a row that
 *  aged out while parked never resurfaces. */
export function refillReviewQueueFromSpillover() {
  const queue = state.reviewQueue ?? [];
  const spillover = state.reviewQueueSpillover ?? [];
  const room = REVIEW_QUEUE_CAP - queue.length;
  if (room <= 0 || spillover.length === 0) return;
  const now = Date.now();
  const fresh = spillover.filter((it) => now - new Date(it.addedAt).getTime() < REVIEW_TTL_MS);
  if (fresh.length === 0) {
    if (fresh.length !== spillover.length) setPartial({ reviewQueueSpillover: fresh });
    return;
  }
  const toMove = fresh.slice(0, room);
  const remaining = fresh.slice(room);
  setPartial({
    reviewQueue: [...queue, ...toMove],
    reviewQueueSpillover: remaining,
  });
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
 *  `addIgnoredReviewSig`). Silent no-op if the id is gone. Refills the now-freed slot from
 *  `reviewQueueSpillover` (if any) so the visible queue honestly drains the overflow instead of
 *  leaving it parked once there's room for it. */
export function resolveReviewItem(id: string) {
  const queue = state.reviewQueue ?? [];
  const next = queue.filter((it) => it.id !== id);
  if (next.length !== queue.length) {
    setPartial({ reviewQueue: next });
    refillReviewQueueFromSpillover();
  }
}

/** Drain the whole queue — used when the user explicitly says "clear all"
 *  or when a cycle closes and stale candidates should stop nagging. Also drains the spillover: a
 *  "clear all" that left the overflow parked would just silently repopulate the queue moments later. */
export function clearReviewQueue() {
  const hadQueue = (state.reviewQueue ?? []).length > 0;
  const hadSpillover = (state.reviewQueueSpillover ?? []).length > 0;
  if (hadQueue || hadSpillover) setPartial({ reviewQueue: [], reviewQueueSpillover: [] });
}

/** Public sweep — call on Today mount to age out expired items in both the visible queue and the
 *  spillover, then refill any room the sweep opened up. */
export function sweepReviewQueue() {
  const queue = state.reviewQueue ?? [];
  const spillover = state.reviewQueueSpillover ?? [];
  const now = Date.now();
  const notExpired = (it: ReviewItem) => now - new Date(it.addedAt).getTime() < REVIEW_TTL_MS;
  const nextQueue = queue.filter(notExpired);
  const nextSpillover = spillover.filter(notExpired);
  const changed = nextQueue.length !== queue.length || nextSpillover.length !== spillover.length;
  if (changed) {
    setPartial({ reviewQueue: nextQueue, reviewQueueSpillover: nextSpillover });
    refillReviewQueueFromSpillover();
  }
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
  const emptyBalance: CurrentBalance = { ...EMPTY_BALANCE, setAt: new Date().toISOString() };
  const empty: AppState = {
    schemaVersion: state.schemaVersion,
    pots: [],
    subs: [],
    subPaused: {},
    subOverrides: {},
    cycles: [],
    // Keeps `done` (no forced re-onboarding) and the name (a preference, not money data), but
    // ZEROES the income figure: it feeds every "coming in" read, and surviving a clear-to-empty
    // it kept telling the owner their old income on a supposedly blank app (2026-07-11).
    onboarding: { ...state.onboarding, done: true, monthlyIncome: 0 },
    currentBalance: emptyBalance,
    // Mirrors `currentBalance` exactly, same as every other load/reset path — a clean-empty reset
    // still has exactly one (empty) default bank account, never zero accounts.
    accounts: [synthesizeDefaultAccount(emptyBalance)],
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
    readerClosingBalance: null,
    ignoredReviewSigs: [],
    reviewQueue: [],
    reviewQueueSpillover: [],
    statementImports: [],
    moneyMode: 'survival',
    bufferAmount: 100,
    modeExtras: {},
    aiReads: { monthKey: '', used: 0 },
    aiReadCache: {},
    whatChangedSeenISO: null,
    dismissedIncomeSignals: [],
    dismissedBillSignals: [],
    dismissedDriftSignals: [],
    dismissedAnnualSignals: [],
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
    // Re-stamp the date anchor to match the rolled day count — without this the next hydration's
    // re-anchor (lib/renewalMath.ts) would recompute from the OLD anchor and undo the demo shift.
    nextRenewalISO: anchorIsoFor(
      s.nextRenewalDaysAway <= 0 ? 30 : s.nextRenewalDaysAway,
      new Date().toISOString().slice(0, 10),
    ),
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
