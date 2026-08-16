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
//     ENGINES.md §6 "Melo — tool name matching" across the canonical twelve
//     approval-gated Personal and Business tools.

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
import type { DismissReason, DismissRecord } from './lib/melo/dismissReasons';
import type { OneMoveImpression, OneMoveRecord, OneMove } from './lib/melo/oneMove';
import type { MemoryLine } from './lib/melo/memory';
import { evaluateWardrobe, unlockedWardrobe } from './lib/melo/wardrobeUnlocks';
import { releaseCelebrateSlotForNewCycle } from './lib/melo/cadence';
import {
  applyBusinessWeeklyProgress,
  applyCycleCloseProgress,
  applyRitualCompletion,
  createMeloStreakState,
  createPhoenixStageState,
  deriveBusinessForegroundStage,
  deriveBusinessStage,
  deriveForegroundStage,
  normaliseMeloStreakState,
  normalisePhoenixStageState,
  transitionPhoenixStage,
  type MeloStreakState,
  type PhoenixStageState,
  type StageInput,
} from './lib/melo/stage';
import { deriveBusinessMeloSignals } from './lib/melo/businessStageSignals';
import {
  MELO_TOOL_NAMES,
  isBusinessMeloTool,
  isPersonalMeloTool,
  type MeloToolName,
} from './lib/melo/toolContract';
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
import {
  createPersonalWorkspaceRoot,
  normalisePersonalWorkspaceRoot,
  PERSONAL_WORKSPACE_ID,
  requireWorkspaceData,
  workspaceLocalDate,
  type PersistedWorkspace,
  type WorkspaceRoot,
} from './lib/workspaceRoot';
import {
  createWorkspaceScopedRowRepository,
  normaliseWorkspaceRowPatch,
  normaliseWorkspaceRows,
  ownWorkspaceRow,
  requireWorkspaceRows,
  type WorkspaceScopedRowRepository,
} from './lib/workspaceRows';
import { assertValidWorkspaceRoot } from './lib/workspacePartition';
import {
  clearPendingAppStateCommands,
  createPendingAppStateCommand,
  enqueuePendingAppStateCommand,
  type PendingAppStateCommandInput,
} from './lib/typedCommandBridge';
import type {
  CorrectionImpactRecord,
  CriticalJourneyContinuityRecord,
  DecisionLedgerEntry,
  DecisionRecordId,
  MaterialDecisionKind,
  MaterialFinancialChange,
  MaterialFinancialChangeType,
  ProvisionalAnswerRecord,
  TrustedSafeRangeSnapshot,
  WorkspaceId,
} from '@folio/domain';
import {
  addDaysToLocalDate,
  createCurrencyCode,
  createInstantString,
  createMoney,
  localDateFromInstant,
} from '@folio/domain';
import {
  addCorrection,
  createDecisionDraft,
  deleteDecision,
  disableDecisionLearning,
  evaluateForecast,
  exportDecisionLedger,
  markAwaitingOutcome,
  markPresented,
  recordChoice,
  recordConsent,
  removeDecisionLearning,
  resolveOutcome,
  safeRangeSnapshotFromResult,
  type CreateDecisionDraftInput,
  type DecisionLedgerMutationResult,
  type ForecastEvaluationInput,
  type OutcomeInput,
} from './lib/decisionLedger';
import { buildTrustedSafeRangeFromAppState } from './lib/trustedSafeRange';
import {
  calculateBusinessRunway,
  distributableReservesMinor,
  emptyBusinessOperationsState,
  hasBusinessOperationsData,
  normaliseBusinessOperationsState,
  type BusinessOperationsState,
} from '@folio/business-workspace';

/** The element type of the persisted `AppState.edits` slot. It is the engine's
 *  full `TxnEdit` with `id` relaxed to optional: every record this store writes
 *  is produced by `applyTxnEdit` and so always carries an `id`, but the export
 *  engine + its tests read the slot tolerantly (older/loose shapes without an
 *  `id`), so the persisted contract must not require it. Runtime values are
 *  always full `TxnEdit`s; the relaxation is purely a structural-compat seam. */
export type StoredTxnEdit = Omit<TxnEdit, 'id'> & {
  id?: string;
  workspaceId?: WorkspaceId;
};

/** One cooldown record on `AppState.dismissedDriftSignals` — see that field's doc for the full
 *  "drift thrash" fix. `merchant` is the normalised key (`normaliseIncomeSignalKey`); `at` is the ISO
 *  timestamp of the confirm-or-dismiss action that started the cooldown window. */
export type DriftCooldownEntry = { merchant: string; at: string; workspaceId?: WorkspaceId };

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
  /** Required on every production persisted row from schema v10 onward. */
  workspaceId?: WorkspaceId;
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
  workspaceId?: WorkspaceId;
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
  /** ISO day after the skipped renewal. Paused subscriptions resume when this
   *  day arrives, so "pause for a month" means skip one occurrence rather
   *  than an arbitrary 30-day timer. */
  pausedUntil?: string;
  /** Per-sub ritual behaviour. Prompt is the safe/default choice. */
  autoResume?: 'prompt' | 'silent';
  /** Plain-language memory retained while paused so restore surfaces can
   *  explain why the user made the choice. */
  pauseReason?: string;
  /** ISO day on which the subscription was paused. */
  pausedAt?: string;
  /** Number of observed/demo-renewed billing cycles. Melo checks in every third renewal. */
  renewalCount?: number;
};

export type CancelledSub = {
  name: string;
  workspaceId?: WorkspaceId;
  monthlyAmount: number;
  cancelledAt: string;
};

/** A bounded discretionary-spend cap created by Recovery. */
export type SpendHold = {
  start: string;
  end: string;
  dailyCap: number;
  setAt: string;
  /** Breaches are recorded for review; they never cancel the hold. */
  breachedDates?: string[];
};

/** A scenario the user explicitly chose to keep on the active cycle. */
export type WhatIfHold = {
  id: string;
  workspaceId?: WorkspaceId;
  amount: number;
  recurrence: 'once' | 'weekly' | 'monthly';
  addedAt: string;
  label?: string;
};

/** A single outstanding debt line — loan, credit card, BNPL, or "other".
 *  Purely local; ports the Lovable design's Debt lens data shape 1:1
 *  (folio-melo `src/lib/store.ts` `Debt`). APR is annual %, min payment is
 *  monthly £, `dueDom` is day-of-month the payment falls. Balance is
 *  decremented by future debt-payment logging (not yet wired here). */
export type Debt = {
  id: string;
  workspaceId?: WorkspaceId;
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
  workspaceId?: WorkspaceId;
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

/** Lens entitlement state for the frozen Free / Plus / Pro model.
 *  Pro is a superset, so every Pro grant also grants Plus. `trialCycleId` marks the cycle the user
 *  activated a one-cycle free trial in; it is cleared only at explicit cycle close.
 *  `trialEndedCycleId` captures the ended trial so
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
  workspaceId?: WorkspaceId;
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
  workspaceId?: WorkspaceId;
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
  workspaceId?: WorkspaceId;
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
  workspaceId?: WorkspaceId;
  /** ISO timestamp */
  when: string;
  merchant: string;
  /** Negative = spend, positive = inflow. £ with decimals OK. */
  amount: number;
  category: 'food' | 'transport' | 'fun' | 'bills' | 'shopping' | 'income' | 'other';
  /** Where it came from — manual entry, Melo-logged, or seed/demo. */
  source: 'manual' | 'melo' | 'seed' | 'bank';
  /** ID of the encrypted source original retained on this device. Optional for manual/bank rows and
   *  legacy imports. The workspace-owned evidence metadata resolves the filename and media type. */
  sourceEvidenceId?: string;
  /** Stable, provider-neutral ID for an optional Open Banking row. It is generated by Melo's
   *  backend and is not the provider transaction ID. Used only to stop repeat refreshes from
   *  offering the same row again. */
  externalId?: string;
  /** Melo-local connection ID for separating disconnect from the optional local-history deletion. */
  bankConnectionId?: string;
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
  workspaceId?: WorkspaceId;
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
  workspaceId?: WorkspaceId;
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
  workspaceId?: WorkspaceId;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Optional device-local wall-clock time (`HH:mm`). An omitted value is an all-day event. */
  time?: string;
  kind: 'in' | 'out' | 'review' | 'deadline';
  title: string;
  note?: string;
  /** Signed pounds — positive = in, negative = out, undefined for review/deadline. */
  amount?: number;
  /**
   * User-chosen local notification lead time. The reminder fires this many minutes before the
   * event's `date` + `time`; all-day events use 09:00 local time. Omitted means no reminder.
   */
  reminderOffsetMinutes?: number;
};

export type AppState = {
  /** Bumped on every breaking shape change. Read by `migrate()` on load
   *  so the prototype stops silently falling back to defaults for missing
   *  fields. RN must keep the same scheme (per RN_PORT.md "Store migration"). */
  schemaVersion: number;
  /** Durable workspace registry. Schema v9 intentionally contains Personal only; Business cannot
   *  be activated until every entity/query/export/companion seam is workspace-scoped. */
  workspaces: readonly PersistedWorkspace[];
  /** Visible workspace selection. Locked to Personal in schema v9. */
  activeWorkspaceId: WorkspaceId;
  /** Owns every current top-level data slot in this legacy AppState partition. */
  dataWorkspaceId: WorkspaceId;
  pots: Pot[];
  subs: Sub[];
  subPaused: Record<string, boolean>;
  /** Last Melo keep/pause check-in day keyed by subscription name. Workspace-local. */
  subCheckIns?: Record<string, string>;
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
  /** Recoverable subscription archive. Removing a subscription never destroys
   *  the last-known cost or cancellation date. */
  cancelledSubs?: CancelledSub[];
  /** Active Recovery cap. Cleared when the cycle closes. */
  spendHold?: SpendHold | null;
  /** Scenario holds deliberately committed from What-if. Cleared at cycle close. */
  whatIfHolds?: WhatIfHold[];
  /** Phase D Decision Ledger — bounded receipts for material decisions only. Empty on migration;
   *  never reconstructed from old timelines, chats or transaction rows. */
  decisionLedger?: DecisionLedgerEntry[];
  /** Phase E first-answer continuity — provisional Safe Range answers the user explicitly keeps.
   *  Viewing a provisional answer alone never creates a Decision Ledger entry. */
  provisionalAnswers?: ProvisionalAnswerRecord[];
  /** Phase E causal What-Changed records. Bounded, deterministic and workspace-owned; this is not
   *  a generic activity feed and never stores duplicate AppState snapshots. */
  materialChanges?: MaterialFinancialChange[];
  /** Phase E correction/recalculation receipts. Originals survive here so historical decisions are
   *  corrected and invalidated, never silently rewritten. */
  correctionImpacts?: CorrectionImpactRecord[];
  /** Phase E app-restart continuity for confirmation journeys. Bounded and workspace-owned. */
  criticalJourneyContinuity?: CriticalJourneyContinuityRecord[];
  /** One-time Melo introduction acknowledgement. */
  meloPrimerSeen?: boolean;
  /** Last completed intro beat, so a killed app resumes instead of restarting the sequence. */
  meloPrimerBeat?: number;
  /** When the one-time intro was completed or skipped. */
  meloPrimerSeenAt?: string | null;
  /** Previous Today-open stamp used for the honest since-last-open delta. */
  lastOpenedAt?: string | null;
  /** Rolling local continuity log for the single ranked action shown on Today. */
  oneMoveHistory?: OneMoveImpression[];
  /** User-visible one-move history with accepted/dismissed state and seven-day outcomes. */
  meloMoves?: OneMoveRecord[];
  /** Recent ranked-action dismissals, used only to dampen the same suggestion kind. */
  meloDismissLog?: DismissRecord[];
  /** Inspectable companion memory. Every line can be edited or forgotten by the user. */
  meloMemoryThread?: MemoryLine[];
  /** Tombstones stop a deliberately forgotten observed event being re-added on the next sync. */
  meloForgottenMemoryIds?: string[];
  /**
   * Local Business operations owned by this encrypted workspace partition.
   * Personal partitions keep the neutral empty shape; a Business partition
   * persists entity, invoice, obligation, tax-preparation and companion
   * continuity here without mixing it into Personal money.
   */
  business?: BusinessOperationsState;
  /** Lens / Plus-Pro entitlement state (`lib/lens.ts`). See `LensState`.
   *  Optional for shape back-compat; `DEFAULTS`/`load()` always populate it. */
  lens?: LensState;
  /** Melo companion settings — quiet mode + equipped wardrobe touches. Ports
   *  the Lovable design's `melo` slice 1:1 (folio-melo `src/lib/store.ts`).
   *  Optional for shape back-compat; `DEFAULTS`/`load()` always populate it. */
  melo?: MeloState;
  /** Workspace-local phoenix progression. Never copied during a workspace switch. */
  stage: PhoenixStageState;
  /** Workspace-local qualifying-cycle streak. Never copied during a workspace switch. */
  streak: MeloStreakState;
  /** Global visual preference shared across Personal and Business. */
  chartStyle?: ChartStyle;
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
  /** Open Banking rows the user explicitly ignored. Provider-neutral IDs only; provider IDs and
   *  credentials never enter the app/store. */
  ignoredBankExternalIds?: string[];
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
  /** Encrypted-original metadata for statements/receipts retained in this workspace. File bytes live
   *  in a separate AES-GCM document vault; picker/cache URIs never enter persisted state. */
  evidenceDocuments?: EvidenceDocument[];
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
  workspaceId?: WorkspaceId;
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
  /** Encrypted original that produced this landing, when one was retained. */
  sourceEvidenceId?: string;
};

export type EvidenceDocument = {
  id: string;
  workspaceId?: WorkspaceId;
  filename: string;
  mediaType: string;
  byteSize: number;
  addedAtISO: string;
  sourceType: 'document' | 'image' | 'camera';
  extractionStatus: 'read' | 'unreadable' | 'not-requested';
  storageState: 'encrypted-device-vault';
  /** Confirmed records this encrypted original was attached to after intake. The transaction's
   * sourceEvidenceId remains reserved for its original import provenance; later receipts live here
   * so attaching one can never overwrite or mislabel the statement that created the row. */
  linkedTransactionIds?: string[];
};

/** Retention cap for `statementImports` — mirrors `timelineEvents`'s 200-entry cap. */
export const STATEMENT_IMPORT_CAP = 200;

/** A single unreviewed intake candidate (design source `ReviewItem`, verbatim
 *  shape). Signed pounds — negative = out, positive = in — matches
 *  `Transaction`. */
export type ReviewItem = {
  id: string;
  workspaceId?: WorkspaceId;
  /** Which intake path produced it. Used only for captions, never logic. */
  source: 'paste' | 'pdf' | 'image' | 'csv' | 'txt' | 'manual' | 'bank';
  /** Encrypted original retained on device, when this proposal came from a selected file/photo. */
  sourceEvidenceId?: string;
  merchant: string;
  amount: number;
  /** ISO YYYY-MM-DD if the reader pinned a date. */
  date?: string;
  /** The account the user selected before choosing one-by-one review. Omitted
   *  for legacy/manual queue items, which continue to resolve to Main. */
  accountId?: string;
  /** Provider-neutral server-generated ID used to suppress a repeat bank refresh. */
  externalId?: string;
  /** Melo-local connection ID. Enables a separate "delete imported history" choice on disconnect. */
  bankConnectionId?: string;
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

export type MeloTone = 'calm' | 'honest' | 'dry' | 'coachy';
export type ChartStyle = 'curve' | 'bars' | 'minimal';

/** Melo companion settings (`MeloScreen`). `quietMode` hides the character
 *  (numbers stay); `wardrobe` contains at most one equipped full-body companion-touch id. `tone` is the global
 *  companion style used by chat and proactive Today guidance. It remains optional for persisted-
 *  shape compatibility with installs created before the preference was retained. */
export type MeloState = {
  quietMode: boolean;
  wardrobe: string[];
  tone?: MeloTone;
  /** Optional milestone sound preference. Missing means off for every pre-feature install. */
  soundEnabled?: boolean;
};
/** Current schema version. Bump on every breaking shape change and add
 *  a new entry to `MIGRATIONS` below. Never silently re-key existing data. */
export const CURRENT_SCHEMA_VERSION = 20;

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
 *  not the DEFAULTS fixture data, since this is used by `load()`/`migrate()`
 *  for a genuinely-missing slot on an existing install. */
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
const DEFAULT_MELO: MeloState = { quietMode: false, wardrobe: [], tone: 'calm' };

const DEFAULT_DECISION_LEDGER: DecisionLedgerEntry[] = [];
const DEFAULT_PROVISIONAL_ANSWERS: ProvisionalAnswerRecord[] = [];
const DEFAULT_MATERIAL_CHANGES: MaterialFinancialChange[] = [];
const DEFAULT_CORRECTION_IMPACTS: CorrectionImpactRecord[] = [];
const DEFAULT_CRITICAL_JOURNEY_CONTINUITY: CriticalJourneyContinuityRecord[] = [];
const PHASE_E_RECORD_CAP = 50;

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

const DEFAULTS: AppState = normaliseWorkspaceRows(
  {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...createPersonalWorkspaceRoot(),
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
    subCheckIns: {},
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
    evidenceDocuments: [],
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
    cancelledSubs: [],
    spendHold: null,
    whatIfHolds: [],
    decisionLedger: DEFAULT_DECISION_LEDGER,
    provisionalAnswers: DEFAULT_PROVISIONAL_ANSWERS,
    materialChanges: DEFAULT_MATERIAL_CHANGES,
    correctionImpacts: DEFAULT_CORRECTION_IMPACTS,
    criticalJourneyContinuity: DEFAULT_CRITICAL_JOURNEY_CONTINUITY,
    meloPrimerSeen: false,
    meloPrimerBeat: 0,
    meloPrimerSeenAt: null,
    lastOpenedAt: null,
    oneMoveHistory: [],
    meloMoves: [],
    meloDismissLog: [],
    meloMemoryThread: [],
    meloForgottenMemoryIds: [],
    business: emptyBusinessOperationsState(),
    lens: {
      plusUnlocked: false,
      proUnlocked: false,
      trialCycleId: null,
      trialEndedCycleId: null,
      trialEndAcknowledged: true,
    },
    melo: { quietMode: false, wardrobe: [], tone: 'calm' },
    stage: createPhoenixStageState(SAMPLE_BALANCE.setAt),
    streak: createMeloStreakState(SAMPLE_BALANCE.setAt),
    chartStyle: 'curve',
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
  },
  PERSONAL_WORKSPACE_ID,
);

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

const OBSOLETE_TRUSTED_CORE_CONFIDENCE_FIELDS = new Set([
  'confidence',
  'confidenceAtTheTime',
  'confidenceWasJustified',
]);

/** Restrict the v20 cleanup to persisted trusted-core slices. Import/parser source quality still
 * uses its own `confidence` metadata and must survive this migration unchanged. */
function removeUnsupportedTrustedCoreConfidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUnsupportedTrustedCoreConfidence);
  if (value === 'cashflow_confidence') return 'cashflow_source_quality';
  if (value === null || typeof value !== 'object') return value;

  const cleaned: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (OBSOLETE_TRUSTED_CORE_CONFIDENCE_FIELDS.has(key)) continue;
    const nextKey = key === 'confidenceReasons' ? 'evidenceNotes' : key;
    const nextValue =
      key === 'impact' && nested === 'raises'
        ? 'supports'
        : key === 'impact' && nested === 'lowers'
          ? 'limits'
          : removeUnsupportedTrustedCoreConfidence(nested);
    cleaned[nextKey] = nextValue;
  }
  return cleaned;
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
  // v8 → v9: make the current top-level store's ownership explicit. Every existing record remains
  // byte-identical and belongs to the immutable Personal data partition. Business activation is
  // intentionally locked out until rows and query boundaries carry required workspace IDs.
  9: (prev) => {
    const workspaceRoot = createPersonalWorkspaceRoot();
    return {
      ...prev,
      schemaVersion: 9,
      workspaces: workspaceRoot.workspaces,
      activeWorkspaceId: workspaceRoot.activeWorkspaceId,
      dataWorkspaceId: workspaceRoot.dataWorkspaceId,
    };
  },
  // v9 → v10: stamp every independently addressable production row with its non-null Personal
  // workspace owner. A conflicting pre-existing owner is treated as corruption instead of being
  // overwritten. Keyed maps/scalars remain owned by the enclosing `dataWorkspaceId` partition.
  10: (prev) =>
    normaliseWorkspaceRows(
      {
        ...prev,
        schemaVersion: 10,
      },
      PERSONAL_WORKSPACE_ID,
    ) as Record<string, unknown>,
  // v10 → v11: adopt the isolated-partition file contract without trusting a pre-v11 Business
  // root. Every existing blob is definitively Personal; only a v11 partition created through the
  // new manifest/key transaction may carry Business metadata.
  11: (prev) => {
    const workspaceRoot = normalisePersonalWorkspaceRoot({
      workspaces: prev['workspaces'],
      activeWorkspaceId: prev['activeWorkspaceId'],
      dataWorkspaceId: prev['dataWorkspaceId'],
    });
    return { ...prev, schemaVersion: 11, ...workspaceRoot };
  },
  // v11 → v12: add the Lovable rework's durable subscription archive,
  // Recovery/What-if holds, and companion introduction/open-memory fields.
  // All additions are neutral so existing money totals remain unchanged.
  12: (prev) => ({
    ...prev,
    schemaVersion: 12,
    cancelledSubs: Array.isArray(prev['cancelledSubs']) ? prev['cancelledSubs'] : [],
    spendHold: prev['spendHold'] ?? null,
    whatIfHolds: Array.isArray(prev['whatIfHolds']) ? prev['whatIfHolds'] : [],
    meloPrimerSeen: prev['meloPrimerSeen'] === true,
    meloPrimerBeat:
      typeof prev['meloPrimerBeat'] === 'number'
        ? Math.max(0, Math.min(3, Math.floor(prev['meloPrimerBeat'])))
        : 0,
    meloPrimerSeenAt:
      typeof prev['meloPrimerSeenAt'] === 'string' ? prev['meloPrimerSeenAt'] : null,
    lastOpenedAt: typeof prev['lastOpenedAt'] === 'string' ? prev['lastOpenedAt'] : null,
    oneMoveHistory: Array.isArray(prev['oneMoveHistory'])
      ? (prev['oneMoveHistory'] as OneMoveImpression[]).slice(0, 7)
      : [],
    meloMoves: Array.isArray(prev['meloMoves'])
      ? (prev['meloMoves'] as OneMoveRecord[]).slice(0, 50)
      : [],
    meloDismissLog: Array.isArray(prev['meloDismissLog'])
      ? (prev['meloDismissLog'] as DismissRecord[]).slice(0, 20)
      : [],
    meloMemoryThread: Array.isArray(prev['meloMemoryThread'])
      ? (prev['meloMemoryThread'] as MemoryLine[]).slice(0, 200)
      : [],
    meloForgottenMemoryIds: Array.isArray(prev['meloForgottenMemoryIds'])
      ? (prev['meloForgottenMemoryIds'] as string[]).slice(0, 500)
      : [],
  }),
  // v12 → v13: add the approved local Business operating model. The neutral
  // empty value changes no Personal totals and is owned by the same encrypted
  // workspace partition as accounts and transactions.
  13: (prev) => ({
    ...prev,
    schemaVersion: 13,
    business: normaliseBusinessOperationsState(
      prev['business'] as Partial<BusinessOperationsState> | null | undefined,
    ),
  }),
  // v13 → v14: persist the frozen chart-style preference. It is non-financial and follows the
  // person across isolated Personal and Business partitions.
  14: (prev) => ({
    ...prev,
    schemaVersion: 14,
    chartStyle:
      prev['chartStyle'] === 'bars' || prev['chartStyle'] === 'minimal'
        ? prev['chartStyle']
        : 'curve',
  }),
  // v14 → v15: add workspace-local phoenix stage and qualifying-cycle streak slices. The fallback
  // timestamp comes from that partition's own balance observation, never another workspace.
  15: (prev) => {
    const balance = prev['currentBalance'] as Partial<CurrentBalance> | null | undefined;
    const fallbackAt =
      typeof balance?.setAt === 'string' ? balance.setAt : '1970-01-01T00:00:00.000Z';
    return {
      ...prev,
      schemaVersion: 15,
      stage: normalisePhoenixStageState(
        prev['stage'] as Partial<PhoenixStageState> | null | undefined,
        fallbackAt,
      ),
      streak: normaliseMeloStreakState(
        prev['streak'] as Partial<MeloStreakState> | null | undefined,
        fallbackAt,
      ),
    };
  },
  // v15 → v16: retain Melo's per-subscription check-in cooldown and renewal counter shape.
  // The map lives inside the encrypted workspace partition, so Personal and Business can never
  // suppress one another's prompts.
  16: (prev) => ({
    ...prev,
    schemaVersion: 16,
    subCheckIns:
      prev['subCheckIns'] !== null &&
      typeof prev['subCheckIns'] === 'object' &&
      !Array.isArray(prev['subCheckIns'])
        ? Object.fromEntries(
            Object.entries(prev['subCheckIns'] as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
          )
        : {},
  }),
  // v16 → v17: add the Phase D Decision Ledger slice. Existing users get an empty ledger; history is
  // never fabricated from timelines, transactions, review queues, chats or cycle records.
  17: (prev) => ({
    ...prev,
    schemaVersion: 17,
    decisionLedger: Array.isArray(prev['decisionLedger']) ? prev['decisionLedger'] : [],
  }),
  // v17 → v18: add Phase E critical-journey continuity records. Existing users get empty bounded
  // arrays; no historical material changes, provisional answers or correction impacts are
  // fabricated from old timelines or receipts.
  18: (prev) => ({
    ...prev,
    schemaVersion: 18,
    provisionalAnswers: Array.isArray(prev['provisionalAnswers'])
      ? (prev['provisionalAnswers'] as ProvisionalAnswerRecord[]).slice(0, PHASE_E_RECORD_CAP)
      : [],
    materialChanges: Array.isArray(prev['materialChanges'])
      ? (prev['materialChanges'] as MaterialFinancialChange[]).slice(0, PHASE_E_RECORD_CAP)
      : [],
    correctionImpacts: Array.isArray(prev['correctionImpacts'])
      ? (prev['correctionImpacts'] as CorrectionImpactRecord[]).slice(0, PHASE_E_RECORD_CAP)
      : [],
    criticalJourneyContinuity: Array.isArray(prev['criticalJourneyContinuity'])
      ? (prev['criticalJourneyContinuity'] as CriticalJourneyContinuityRecord[]).slice(
          0,
          PHASE_E_RECORD_CAP,
        )
      : [],
  }),
  // v18 → v19: remove companion money/event history that the former shared-state allow-list may
  // have copied into Business. Origin provenance does not exist for these records, so Business is
  // privacy-cleaned once; Personal history and presentation preferences remain byte-for-byte.
  19: (prev) => {
    const dataWorkspaceId = prev['dataWorkspaceId'];
    const workspaces = Array.isArray(prev['workspaces']) ? prev['workspaces'] : [];
    const isBusinessPartition = workspaces.some(
      (candidate) =>
        candidate !== null &&
        typeof candidate === 'object' &&
        (candidate as Record<string, unknown>)['id'] === dataWorkspaceId &&
        (candidate as Record<string, unknown>)['kind'] === 'business',
    );
    return {
      ...prev,
      schemaVersion: 19,
      ...(isBusinessPartition
        ? {
            oneMoveHistory: [],
            meloMoves: [],
            meloDismissLog: [],
            meloMemoryThread: [],
            meloForgottenMemoryIds: [],
          }
        : {}),
    };
  },
  // v19 → v20: remove the unsupported aggregate confidence vocabulary only from persisted
  // trusted-core history. Source-specific parser/import confidence remains intact elsewhere.
  20: (prev) => ({
    ...prev,
    schemaVersion: 20,
    decisionLedger: removeUnsupportedTrustedCoreConfidence(prev['decisionLedger']),
    provisionalAnswers: removeUnsupportedTrustedCoreConfidence(prev['provisionalAnswers']),
    materialChanges: removeUnsupportedTrustedCoreConfidence(prev['materialChanges']),
    correctionImpacts: removeUnsupportedTrustedCoreConfidence(prev['correctionImpacts']),
    criticalJourneyContinuity: removeUnsupportedTrustedCoreConfidence(
      prev['criticalJourneyContinuity'],
    ),
  }),
};

function migrate(parsed: Record<string, unknown>): Record<string, unknown> {
  const startVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;
  if (startVersion > CURRENT_SCHEMA_VERSION) {
    // The public hydration boundary rejects future schemas before assigning persistedBlob. Keep
    // this guard as defence in depth so an internal caller can never turn unknown data into
    // editable defaults.
    throw new Error(
      `Persisted schema v${startVersion} is newer than supported v${CURRENT_SCHEMA_VERSION}.`,
    );
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
// localStorage. `null` = nothing persisted yet (first run).
let persistedBlob: Record<string, unknown> | null = null;

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
  const rKeys = Object.keys(r).filter((key) => key !== 'workspaceId');
  return seeds.some((seed) => {
    const sd = seed as Record<string, unknown>;
    const sKeys = Object.keys(sd).filter((key) => key !== 'workspaceId');
    return rKeys.length === sKeys.length && rKeys.every((k) => r[k] === sd[k]);
  });
}

/** True when the state shows ANY sign of real use, so legacy fixture data must never sit
 *  alongside it: onboarding done, a non-`sample` balance, any non-seed
 *  transaction, or any logged statement import. A state matching NONE of these
 *  is an untouched development fixture. `load()` replaces that whole legacy state with the clean
 *  first-run state after this selective cleanup has protected any real rows.
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
    s.pots.some((pot) => !isShippedSeedRecord(pot, DEFAULTS.pots)) ||
    s.subs.some((subscription) => !isShippedSeedRecord(subscription, DEFAULT_SUBS)) ||
    s.cycles.some((cycle) => !isShippedSeedRecord(cycle, DEFAULTS.cycles)) ||
    (s.debts ?? []).some(
      (debt) => !debt.id.startsWith('seed-') && !isShippedSeedRecord(debt, DEFAULTS.debts ?? []),
    ) ||
    (s.plans ?? []).some(
      (plan) => !plan.id.startsWith('seed-') && !isShippedSeedRecord(plan, DEFAULTS.plans ?? []),
    ) ||
    (s.accounts ?? []).some(
      (account) =>
        account.id !== DEFAULT_ACCOUNT_ID ||
        account.name !== 'Main' ||
        account.balanceMinor !== s.currentBalance.amount,
    ) ||
    (s.incomeSources ?? []).some((income) => income.source !== 'onboarding') ||
    s.potLedger.length > 0 ||
    (s.edits?.length ?? 0) > 0 ||
    s.calendarEvents.length > 0 ||
    (s.timelineEvents?.length ?? 0) > 0 ||
    (s.reviewQueue?.length ?? 0) > 0 ||
    (s.reviewQueueSpillover?.length ?? 0) > 0 ||
    (s.statementImports?.length ?? 0) > 0 ||
    (s.evidenceDocuments?.length ?? 0) > 0 ||
    Object.keys(s.subPaused).length > 0 ||
    Object.keys(s.subCheckIns ?? {}).length > 0 ||
    Object.keys(s.subOverrides).length > 0 ||
    Object.keys(s.modeExtras ?? {}).length > 0 ||
    Object.keys(s.merchantCategories ?? {}).length > 0 ||
    (s.cancelledSubs?.length ?? 0) > 0 ||
    s.spendHold != null ||
    (s.whatIfHolds?.length ?? 0) > 0 ||
    (s.decisionLedger?.length ?? 0) > 0 ||
    (s.provisionalAnswers?.length ?? 0) > 0 ||
    (s.materialChanges?.length ?? 0) > 0 ||
    (s.correctionImpacts?.length ?? 0) > 0 ||
    (s.criticalJourneyContinuity?.length ?? 0) > 0 ||
    s.meloPrimerSeen === true ||
    s.lastOpenedAt != null ||
    (s.oneMoveHistory?.length ?? 0) > 0 ||
    (s.meloMoves?.length ?? 0) > 0 ||
    (s.meloDismissLog?.length ?? 0) > 0 ||
    hasBusinessOperationsData(normaliseBusinessOperationsState(s.business))
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
    subCheckIns: dropStrippedSubs(s.subCheckIns ?? {}),
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
 *  and a no-op for an untouched legacy fixture state. This is what removes demo data
 *  that already leaked onto a real device — first-run seeding changes alone
 *  cannot, because the demo data is already persisted in the blob. */
export function purgeSeedIfReal(s: AppState): AppState {
  return isRealUser(s) ? stripSeedData(s) : s;
}

/** The state every first run lands on, including development and emulator builds. Sample money is
 *  never an implicit product state; visual fixtures belong in tests and explicit prototypes. */
function firstRunState(): AppState {
  const emptyBalance: CurrentBalance = { ...EMPTY_BALANCE, setAt: new Date().toISOString() };
  return normaliseWorkspaceRows(
    {
      ...DEFAULTS,
      pots: [],
      subs: [],
      subPaused: {},
      subOverrides: {},
      cycles: [],
      // Release first-run is genuinely blank. The old demo's £2,180/month must not survive merely
      // because onboarding has not been completed yet; the onboarding slider now honestly starts at
      // zero and writes only what the owner chooses.
      onboarding: { done: false, name: '', payday: 25, monthlyIncome: 0 },
      debts: [],
      plans: [],
      currentBalance: emptyBalance,
      accounts: [synthesizeDefaultAccount(emptyBalance)],
      transactions: [],
      incomeSources: [],
    },
    PERSONAL_WORKSPACE_ID,
  );
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
      // First run on this device always starts clean. Development builds follow the same product
      // contract so emulator screenshots and owner testing cannot accidentally present fake money.
      return firstRunState();
    }
    // Deep-clone the persisted blob so migrate/load never mutate the stored copy.
    const parsedRaw = JSON.parse(JSON.stringify(persistedBlob)) as Record<string, unknown>;
    const migrated = migrate(parsedRaw) as Partial<AppState>;
    const fallbackRoot = createPersonalWorkspaceRoot();
    const workspaceRoot = assertValidWorkspaceRoot({
      workspaces: Array.isArray(migrated.workspaces)
        ? (migrated.workspaces as readonly PersistedWorkspace[])
        : fallbackRoot.workspaces,
      activeWorkspaceId:
        typeof migrated.activeWorkspaceId === 'string'
          ? (migrated.activeWorkspaceId as WorkspaceId)
          : fallbackRoot.activeWorkspaceId,
      dataWorkspaceId:
        typeof migrated.dataWorkspaceId === 'string'
          ? (migrated.dataWorkspaceId as WorkspaceId)
          : fallbackRoot.dataWorkspaceId,
    });
    const activeWorkspace = workspaceRoot.workspaces.find(
      (workspace) => workspace.id === workspaceRoot.activeWorkspaceId,
    )!;
    // Resolved once so `accounts` (below) can synthesize the default account from the SAME balance
    // this load is about to publish — never a stale/different one.
    const resolvedCurrentBalance = migrated.currentBalance ?? SAMPLE_BALANCE;
    const loaded: AppState = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      workspaces: [...workspaceRoot.workspaces],
      activeWorkspaceId: workspaceRoot.activeWorkspaceId,
      dataWorkspaceId: workspaceRoot.dataWorkspaceId,
      pots: Array.isArray(migrated.pots) ? migrated.pots : DEFAULTS.pots,
      // Date-anchor re-derivation (lib/renewalMath.ts): every hydration recomputes each sub's
      // relative day count from its persisted date anchor (synthesizing anchors for legacy
      // subs), so `nextRenewalDaysAway` can never rot between sessions.
      subs: reanchorRenewals(
        Array.isArray(migrated.subs) ? migrated.subs : DEFAULTS.subs,
        localDateFromInstant(new Date(), activeWorkspace.timeZone),
      ).items,
      subPaused: migrated.subPaused ?? {},
      subCheckIns:
        migrated.subCheckIns !== null &&
        typeof migrated.subCheckIns === 'object' &&
        !Array.isArray(migrated.subCheckIns)
          ? Object.fromEntries(
              Object.entries(migrated.subCheckIns).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string',
              ),
            )
          : {},
      subOverrides: migrated.subOverrides ?? {},
      cycles: Array.isArray(migrated.cycles) ? migrated.cycles : DEFAULTS.cycles,
      onboarding: { ...DEFAULTS.onboarding, ...(migrated.onboarding ?? {}) },
      currentBalance: resolvedCurrentBalance,
      // ACCOUNTS_MODEL.md §2.1 migration: an install that already has `accounts` keeps them
      // untouched; one that doesn't (every pre-existing install) gets exactly one synthesized
      // `'Main'` bank account mirroring `resolvedCurrentBalance` — see `synthesizeDefaultAccount`.
      accounts: Array.isArray(migrated.accounts)
        ? migrated.accounts.length > 0 || activeWorkspace.kind === 'business'
          ? migrated.accounts
          : [synthesizeDefaultAccount(resolvedCurrentBalance)]
        : activeWorkspace.kind === 'business'
          ? []
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
      evidenceDocuments: Array.isArray(migrated.evidenceDocuments)
        ? migrated.evidenceDocuments
        : [],
      moneyMode: migrated.moneyMode ?? DEFAULT_MONEY_MODE,
      bufferAmount: migrated.bufferAmount ?? DEFAULT_BUFFER_AMOUNT,
      modeExtras: migrated.modeExtras ?? {},
      aiReads: migrated.aiReads ?? { monthKey: '', used: 0 },
      aiReadCache: migrated.aiReadCache ?? {},
      whatChangedSeenISO: migrated.whatChangedSeenISO ?? null,
      debts: Array.isArray(migrated.debts) ? migrated.debts : DEFAULT_DEBTS,
      household: migrated.household ?? DEFAULT_HOUSEHOLD,
      plans: Array.isArray(migrated.plans) ? migrated.plans : DEFAULT_PLANS,
      cancelledSubs: Array.isArray(migrated.cancelledSubs) ? migrated.cancelledSubs : [],
      spendHold: migrated.spendHold ?? null,
      whatIfHolds: Array.isArray(migrated.whatIfHolds) ? migrated.whatIfHolds : [],
      decisionLedger: Array.isArray(migrated.decisionLedger) ? migrated.decisionLedger : [],
      provisionalAnswers: Array.isArray(migrated.provisionalAnswers)
        ? migrated.provisionalAnswers.slice(0, PHASE_E_RECORD_CAP)
        : [],
      materialChanges: Array.isArray(migrated.materialChanges)
        ? migrated.materialChanges.slice(0, PHASE_E_RECORD_CAP)
        : [],
      correctionImpacts: Array.isArray(migrated.correctionImpacts)
        ? migrated.correctionImpacts.slice(0, PHASE_E_RECORD_CAP)
        : [],
      criticalJourneyContinuity: Array.isArray(migrated.criticalJourneyContinuity)
        ? migrated.criticalJourneyContinuity.slice(0, PHASE_E_RECORD_CAP)
        : [],
      meloPrimerSeen: migrated.meloPrimerSeen === true,
      meloPrimerBeat:
        typeof migrated.meloPrimerBeat === 'number'
          ? Math.max(0, Math.min(3, Math.floor(migrated.meloPrimerBeat)))
          : 0,
      meloPrimerSeenAt:
        typeof migrated.meloPrimerSeenAt === 'string' ? migrated.meloPrimerSeenAt : null,
      lastOpenedAt: typeof migrated.lastOpenedAt === 'string' ? migrated.lastOpenedAt : null,
      oneMoveHistory: Array.isArray(migrated.oneMoveHistory)
        ? migrated.oneMoveHistory.slice(0, 7)
        : [],
      meloMoves: Array.isArray(migrated.meloMoves) ? migrated.meloMoves.slice(0, 50) : [],
      meloDismissLog: Array.isArray(migrated.meloDismissLog)
        ? migrated.meloDismissLog.slice(0, 20)
        : [],
      meloMemoryThread: Array.isArray(migrated.meloMemoryThread)
        ? migrated.meloMemoryThread.slice(0, 200)
        : [],
      meloForgottenMemoryIds: Array.isArray(migrated.meloForgottenMemoryIds)
        ? migrated.meloForgottenMemoryIds.slice(0, 500)
        : [],
      business: normaliseBusinessOperationsState(migrated.business),
      lens: migrated.lens ?? DEFAULT_LENS,
      melo: migrated.melo ?? DEFAULT_MELO,
      stage: normalisePhoenixStageState(migrated.stage, resolvedCurrentBalance.setAt),
      streak: normaliseMeloStreakState(migrated.streak, resolvedCurrentBalance.setAt),
      chartStyle:
        migrated.chartStyle === 'bars' || migrated.chartStyle === 'minimal'
          ? migrated.chartStyle
          : 'curve',
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
    const resumed = sweepAutoResume(
      loaded.subs,
      loaded.subPaused,
      localDateFromInstant(new Date(), activeWorkspace.timeZone),
    );
    const cleaned = purgeSeedIfReal(
      normaliseWorkspaceRows(
        {
          ...loaded,
          subs: resumed.subs,
          subPaused: resumed.paused,
          subOverrides: sweepStaleOverrides(resumed.subs, loaded.subOverrides),
        },
        workspaceRoot.dataWorkspaceId,
      ),
    );
    // Older development builds explicitly persisted a complete demo regime. It is not user data and
    // must not survive as a hidden alternative first-run product after sample mode is removed.
    return cleaned.currentBalance.source === 'sample' ? firstRunState() : cleaned;
  } catch {
    loadDegraded = true;
    return firstRunState();
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

/** Pause-for-one-occurrence expiry. A pause remains active through its
 *  skipped renewal and resumes on the following day. */
function sweepAutoResume(
  subs: Sub[],
  paused: Record<string, boolean>,
  today: string,
): { subs: Sub[]; paused: Record<string, boolean>; resumedNames: string[] } {
  const resumedNames: string[] = [];
  const pausedNext = { ...paused };
  const subsNext = subs.map((subscription) => {
    if (!subscription.pausedUntil || subscription.pausedUntil > today) return subscription;
    resumedNames.push(subscription.name);
    pausedNext[subscription.name] = false;
    const {
      pausedUntil: _pausedUntil,
      pauseReason: _pauseReason,
      pausedAt: _pausedAt,
      ...rest
    } = subscription;
    return rest as Sub;
  });
  return {
    subs: resumedNames.length > 0 ? subsNext : subs,
    paused: pausedNext,
    resumedNames,
  };
}

/** Public sweep — Today calls this on mount so an override that aged
 *  out between sessions is dropped before any reads. */
export function sweepSubOverrides() {
  const next = sweepStaleOverrides(state.subs, state.subOverrides);
  const changed =
    Object.keys(next).length !== Object.keys(state.subOverrides).length ||
    Object.entries(next).some(([k, v]) => state.subOverrides[k] !== v);
  if (changed) {
    const removedNames = Object.keys(state.subOverrides).filter(
      (name) => !Object.prototype.hasOwnProperty.call(next, name),
    );
    setPartialWithTypedCommand(
      { subOverrides: next },
      {
        commandType: 'folio.subscription_overrides.expire.v1',
        actorKind: 'system',
        entityRefs: uniqueOpaqueContainerEntityRefs('subscription', removedNames),
        before: {
          overrides: Object.fromEntries(
            removedNames.map((name) => [name, state.subOverrides[name] ?? null]),
          ),
        },
        after: {},
        invalidatedProjectionKinds: ['subscriptions', 'cashflow', 'calendar'],
      },
    );
  }
}

/** Public foreground sweep for one-occurrence subscription pauses. */
export function sweepAutoResumeNow(today: string = currentFinancialDate()): string[] {
  const swept = sweepAutoResume(state.subs, state.subPaused, today);
  if (swept.resumedNames.length === 0) return [];
  const timelineEvents = [
    ...swept.resumedNames.map((name) =>
      createTimelineEvent('sub-resumed', name, 'One paused renewal has passed.'),
    ),
    ...(state.timelineEvents ?? []),
  ].slice(0, 200);
  setPartialWithTypedCommand(
    { subs: swept.subs, subPaused: swept.paused, timelineEvents },
    {
      commandType: 'folio.subscriptions.auto_resume.v1',
      actorKind: 'system',
      entityRefs: uniqueOpaqueContainerEntityRefs('subscription', swept.resumedNames),
      before: { paused: Object.fromEntries(swept.resumedNames.map((name) => [name, true])) },
      after: { paused: Object.fromEntries(swept.resumedNames.map((name) => [name, false])) },
      invalidatedProjectionKinds: ['subscriptions', 'cashflow', 'calendar'],
    },
  );
  return swept.resumedNames;
}

let state: AppState = load();
const listeners = new Set<() => void>();

/** Calendar day used by financial defaults in the active data workspace. */
export function currentFinancialDate(now: Date = new Date()): string {
  return workspaceLocalDate(state, now);
}

function emit() {
  for (const l of listeners) l();
}

function persist() {
  // In-memory port: snapshot the current state into the persisted blob.
  // Web original wrote JSON to window.localStorage; here we keep a structural
  // copy so a later migrate() never aliases live state.
  try {
    const checked = requireWorkspaceRows(
      requireWorkspaceData(state, state.activeWorkspaceId),
      state.activeWorkspaceId,
    );
    persistedBlob = JSON.parse(JSON.stringify(checked)) as Record<string, unknown>;
  } catch {
    /* serialization failure — ignore, matches web quota/private-mode swallow */
  }
}

export function getState(): AppState {
  return requireWorkspaceRows(
    requireWorkspaceData(state, state.activeWorkspaceId),
    state.activeWorkspaceId,
  );
}

/** Explicit non-React query boundary for services that need addressable row collections. */
export function getWorkspaceRowRepository(
  requestedWorkspaceId: WorkspaceId = state.activeWorkspaceId,
): WorkspaceScopedRowRepository {
  return createWorkspaceScopedRowRepository(state, requestedWorkspaceId);
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
export function getPersistBlob(
  requestedWorkspaceId: WorkspaceId = state.activeWorkspaceId,
): string {
  return serializeWorkspacePartition(state, requestedWorkspaceId);
}

export function serializeWorkspacePartition(
  partition: AppState,
  requestedWorkspaceId: WorkspaceId,
): string {
  assertValidWorkspaceRoot(partition);
  const checked = requireWorkspaceRows(
    requireWorkspaceData(partition, requestedWorkspaceId),
    requestedWorkspaceId,
  );
  const {
    calendarFocusDate: _f,
    routeFocusDate: _r,
    readerCandidates: _rc,
    readerClosingBalance: _rcb,
    ...persistable
  } = checked;
  return JSON.stringify(persistable);
}

export type StoreHydrationResult =
  | Readonly<{ status: 'applied' }>
  | Readonly<{ status: 'malformed' }>
  | Readonly<{ status: 'degraded' }>
  | Readonly<{ status: 'incompatible-future-schema'; schemaVersion: number }>;

/** Hydrate the store from a persisted JSON blob (read off disk by the native
 *  adapter). Runs the SAME path as `load()`: park the raw blob into
 *  `persistedBlob`, then `setPartial` the loaded+migrated state so listeners
 *  fire and the round-trip is identical to a first-run load. A malformed blob
 *  is a safe no-op (matches `load()`'s catch). Pure + Node-safe. */
export function hydrateFromBlob(
  raw: string,
  requestedWorkspaceId: WorkspaceId = state.activeWorkspaceId,
): StoreHydrationResult {
  const parsed = parseHydrationBlob(raw);
  if (parsed === null) return { status: 'malformed' };
  return applyHydratedBlob(parsed, requestedWorkspaceId);
}

/**
 * Apply a user-confirmed backup restore. This deliberately sits beside
 * `hydrateFromBlob`: cold app loads, migrations and relaunches must not
 * fabricate a restore explanation, while an explicit replace-from-backup action
 * must preserve a review-required What Changed record.
 */
export function restoreBackupFromBlob(
  raw: string,
  requestedWorkspaceId: WorkspaceId = state.activeWorkspaceId,
): StoreHydrationResult {
  const parsed = parseHydrationBlob(raw);
  if (parsed === null) return { status: 'malformed' };
  const incompatible = incompatibleFutureSchema(parsed);
  if (incompatible !== null) return incompatible;
  const capture = beginMaterialWrite({
    type: 'restored_backup',
    sourceIds: [`fact_backup_restore_${fnv1a32Hex(raw, 0x811c9dc5)}`],
    idempotencyKey: `backup_restore_${String(requestedWorkspaceId)}_${fnv1a32Hex(raw, 0x01000193)}`,
    reviewRequired: true,
    force: true,
  });
  const result = applyHydratedBlob(parsed, requestedWorkspaceId);
  if (result.status === 'applied') completeMaterialWrite(capture);
  return result;
}

function parseHydrationBlob(raw: string): Record<string, unknown> | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null; // malformed blob — leave current state untouched.
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  return parsed;
}

function applyHydratedBlob(
  parsed: Record<string, unknown>,
  requestedWorkspaceId: WorkspaceId,
): StoreHydrationResult {
  const incompatible = incompatibleFutureSchema(parsed);
  if (incompatible !== null) return incompatible;
  // Route through the persisted-blob slot so load() applies migrate() + the
  // same field defaulting as a cold start. Publish as one complete partition replacement: routing
  // through setPartial would stamp the incoming Business rows as the previously-active Personal
  // workspace during an intentional switch.
  const previousPersistedBlob = persistedBlob;
  persistedBlob = parsed;
  const loaded = load();
  if (loadDegraded) {
    persistedBlob = previousPersistedBlob;
    return { status: 'degraded' };
  }
  try {
    if (
      String(loaded.activeWorkspaceId) !== String(requestedWorkspaceId) ||
      String(loaded.dataWorkspaceId) !== String(requestedWorkspaceId)
    ) {
      throw new Error(
        `Persisted partition does not belong to workspace ${String(requestedWorkspaceId)}.`,
      );
    }
    assertValidWorkspaceRoot(loaded);
    requireWorkspaceRows(requireWorkspaceData(loaded, requestedWorkspaceId), requestedWorkspaceId);
    state = loaded;
    persist();
    emit();
    return { status: 'applied' };
  } catch (reason: unknown) {
    persistedBlob = previousPersistedBlob;
    throw reason;
  }
}

function incompatibleFutureSchema(
  parsed: Record<string, unknown>,
): Extract<StoreHydrationResult, { status: 'incompatible-future-schema' }> | null {
  const schemaVersion = parsed['schemaVersion'];
  return typeof schemaVersion === 'number' && schemaVersion > CURRENT_SCHEMA_VERSION
    ? { status: 'incompatible-future-schema', schemaVersion }
    : null;
}

function nextStateForPartial(patch: Partial<AppState>): AppState {
  const rootKeys = new Set<keyof AppState>([
    'schemaVersion',
    'workspaces',
    'activeWorkspaceId',
    'dataWorkspaceId',
  ]);
  const touchesWorkspaceData = (Object.keys(patch) as Array<keyof AppState>).some(
    (key) => !rootKeys.has(key),
  );
  if (
    (patch.activeWorkspaceId !== undefined &&
      String(patch.activeWorkspaceId) !== String(state.activeWorkspaceId)) ||
    (patch.dataWorkspaceId !== undefined &&
      String(patch.dataWorkspaceId) !== String(state.dataWorkspaceId))
  ) {
    throw new Error('Workspace switches require a complete, verified partition replacement.');
  }
  if (touchesWorkspaceData) {
    requireWorkspaceRows(
      requireWorkspaceData(state, state.activeWorkspaceId),
      state.activeWorkspaceId,
    );
  }
  const ownedPatch = normaliseWorkspaceRowPatch(patch, state.activeWorkspaceId);
  const next = { ...state, ...ownedPatch };
  assertValidWorkspaceRoot(next);
  return next;
}

function publishState(next: AppState): void {
  state = next;
  persist();
  emit();
}

export function setPartial(patch: Partial<AppState>) {
  publishState(nextStateForPartial(patch));
}

type AppStateCommandDescriptor = Omit<PendingAppStateCommandInput, 'workspaceId' | 'occurredAt'> & {
  occurredAt?: string;
};

/** Queue the privacy-minimal typed receipt before publishing the matching synchronous mutation. */
function setPartialWithTypedCommand(
  patch: Partial<AppState>,
  descriptor: AppStateCommandDescriptor,
): void {
  const next = nextStateForPartial(patch);
  const receipt = createPendingAppStateCommand({
    ...descriptor,
    workspaceId: state.activeWorkspaceId,
  });
  enqueuePendingAppStateCommand(receipt);
  publishState(next);
}

/**
 * Subscription names and user-chosen pot ids can contain private labels. Audit entity references
 * need stable correlation, but never need those labels themselves, so container receipts use a
 * deterministic workspace-scoped opaque id. The command delta already stores checksums rather than
 * values; this closes the equivalent metadata seam in `entityRefs`.
 */
function opaqueContainerEntityRef(type: string, sourceId: string): { type: string; id: string } {
  const source = `${String(state.activeWorkspaceId)}\u001f${type}\u001f${sourceId}`;
  return {
    type,
    id: `${type}-${fnv1a32Hex(source, 0x811c9dc5)}${fnv1a32Hex(source, 0x01000193)}`,
  };
}

function financialContextEntityRef(): { type: 'financial-context'; id: string } {
  return {
    type: 'financial-context',
    id: `${String(state.activeWorkspaceId)}:active`,
  };
}

function workspaceCollectionEntityRef(type: string): { type: string; id: string } {
  return { type, id: `${String(state.activeWorkspaceId)}:active` };
}

function fnv1a32Hex(input: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function uniqueOpaqueContainerEntityRefs(
  type: string,
  sourceIds: readonly string[],
): Array<{ type: string; id: string }> {
  return [...new Set(sourceIds)].map((sourceId) => opaqueContainerEntityRef(type, sourceId));
}

function activeWorkspaceKind(): 'personal' | 'business' {
  return (
    state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.kind ??
    'personal'
  );
}

type MaterialDecisionWriteOptions = Readonly<{ recordDecision?: boolean }>;

function shouldRecordMaterialDecision(options?: MaterialDecisionWriteOptions): boolean {
  return options?.recordDecision !== false;
}

const TRUSTED_CORE_GBP = createCurrencyCode('GBP');
const MATERIAL_CHANGE_MIN_DELTA_MINOR = 100;

type MaterialWriteCapture = Readonly<{
  workspaceId: WorkspaceId;
  type: MaterialFinancialChangeType;
  sourceIds: readonly string[];
  truth: MaterialFinancialChange['truth'];
  occurredAt: string;
  idempotencyKey: string;
  before?: TrustedSafeRangeSnapshot;
  monetaryEffectMinor?: number | null;
  reviewRequired?: boolean;
}>;

type MaterialWriteInput = Readonly<{
  type: MaterialFinancialChangeType;
  sourceIds: readonly string[];
  truth?: MaterialFinancialChange['truth'];
  occurredAt?: Date | string;
  idempotencyKey: string;
  monetaryEffectMinor?: number | null;
  reviewRequired?: boolean;
  force?: boolean;
}>;

function trustedCoreInstant(input: Date | string): ReturnType<typeof createInstantString> {
  return createInstantString(
    input instanceof Date ? input.toISOString() : new Date(input).toISOString(),
  );
}

function trustedCoreMoney(minorUnits: number | null | undefined) {
  if (minorUnits === null || minorUnits === undefined) return null;
  return createMoney({ minorUnits: Math.round(minorUnits), currency: TRUSTED_CORE_GBP });
}

function safeRangeSnapshotForState(
  candidate: AppState,
  now: Date | string,
): TrustedSafeRangeSnapshot | undefined {
  try {
    return safeRangeSnapshotFromResult(buildTrustedSafeRangeFromAppState(candidate, { now }));
  } catch {
    return undefined;
  }
}

function moneyDelta(
  after: ReturnType<typeof trustedCoreMoney> | undefined,
  before: ReturnType<typeof trustedCoreMoney> | undefined,
) {
  if (after === null || after === undefined || before === null || before === undefined) {
    return undefined;
  }
  return trustedCoreMoney(after.minorUnits - before.minorUnits) ?? undefined;
}

function strongestRangeDeltaMinor(
  before: TrustedSafeRangeSnapshot | undefined,
  after: TrustedSafeRangeSnapshot | undefined,
): number {
  const lower = moneyDelta(after?.expectedSafeMin, before?.expectedSafeMin)?.minorUnits ?? 0;
  const upper = moneyDelta(after?.expectedSafeMax, before?.expectedSafeMax)?.minorUnits ?? 0;
  const conservative =
    moneyDelta(after?.conservativeBoundary, before?.conservativeBoundary)?.minorUnits ?? 0;
  return [lower, upper, conservative].reduce((strongest, candidate) =>
    Math.abs(candidate) > Math.abs(strongest) ? candidate : strongest,
  );
}

function materialChangeDirection(deltaMinor: number): 'improved' | 'worsened' | 'same' {
  if (deltaMinor > 0) return 'improved';
  if (deltaMinor < 0) return 'worsened';
  return 'same';
}

function materialChangeSubject(type: MaterialFinancialChangeType): string {
  switch (type) {
    case 'new_transaction':
      return 'A new transaction';
    case 'balance_correction':
      return 'A balance correction';
    case 'bill_amount_change':
      return 'A bill amount change';
    case 'bill_date_shift':
      return 'A bill date shift';
    case 'income_change':
      return 'An income change';
    case 'subscription_detected':
      return 'A subscription change';
    case 'debt_payment':
      return 'A debt payment';
    case 'pot_move':
      return 'A pot move';
    case 'reviewed_statement':
      return 'A reviewed statement';
    case 'provider_stale':
      return 'Provider freshness changed';
    case 'restored_backup':
      return 'A backup restore';
    case 'user_correction':
      return 'A user correction';
    case 'forecast_recalculation':
      return 'A forecast recalculation';
  }
}

function materialChangeCauseLabel(type: MaterialFinancialChangeType, deltaMinor: number): string {
  const direction = materialChangeDirection(deltaMinor);
  const suffix =
    direction === 'improved'
      ? 'improved the Safe Range'
      : direction === 'worsened'
        ? 'reduced the Safe Range'
        : 'changed the facts without materially moving the Safe Range';
  return `${materialChangeSubject(type)} ${suffix}`;
}

function decisionUsesAnySource(
  decision: DecisionLedgerEntry,
  sourceIds: readonly string[],
  before: TrustedSafeRangeSnapshot | undefined,
  after: TrustedSafeRangeSnapshot | undefined,
): boolean {
  const sourceSet = new Set(sourceIds);
  const directSources = [
    ...decision.factRefs,
    ...(decision.safeRange?.sourceFactIds ?? []),
    ...(decision.forecast?.sourceFactIds ?? []),
  ];
  if (directSources.some((sourceId) => sourceSet.has(sourceId))) return true;
  if (before === undefined || after === undefined) return false;
  return (
    before.status !== after.status ||
    before.reliance !== after.reliance ||
    Math.abs(strongestRangeDeltaMinor(before, after)) >= MATERIAL_CHANGE_MIN_DELTA_MINOR
  );
}

function beginMaterialWrite(input: MaterialWriteInput): MaterialWriteCapture | null {
  if (activeWorkspaceKind() !== 'personal') return null;
  if (
    input.force !== true &&
    input.reviewRequired !== true &&
    state.currentBalance.source === 'sample'
  ) {
    return null;
  }
  const occurredAt = input.occurredAt ?? new Date();
  const occurredISO = trustedCoreInstant(occurredAt);
  const before = safeRangeSnapshotForState(state, occurredAt);
  return {
    workspaceId: state.activeWorkspaceId,
    type: input.type,
    sourceIds: [...new Set(input.sourceIds)],
    truth: input.truth ?? 'user_confirmed',
    occurredAt: occurredISO,
    idempotencyKey: input.idempotencyKey,
    ...(before === undefined ? {} : { before }),
    ...(input.monetaryEffectMinor === undefined
      ? {}
      : { monetaryEffectMinor: input.monetaryEffectMinor }),
    ...(input.reviewRequired === undefined ? {} : { reviewRequired: input.reviewRequired }),
  };
}

function completeMaterialWrite(
  capture: MaterialWriteCapture | null,
): MaterialFinancialChange | null {
  if (capture === null) return null;
  if (String(capture.workspaceId) !== String(state.activeWorkspaceId)) return null;
  const after = safeRangeSnapshotForState(state, capture.occurredAt);
  const strongestDelta = strongestRangeDeltaMinor(capture.before, after);
  const monetaryEffect =
    trustedCoreMoney(capture.monetaryEffectMinor ?? null) ?? trustedCoreMoney(strongestDelta);
  const materiallyMoved =
    Math.max(Math.abs(strongestDelta), Math.abs(monetaryEffect?.minorUnits ?? 0)) >=
    MATERIAL_CHANGE_MIN_DELTA_MINOR;
  const reviewRequired =
    capture.reviewRequired === true ||
    [
      'inferred',
      'estimated',
      'assumed',
      'missing',
      'stale',
      'contradicted',
      'sample_demo',
    ].includes(capture.truth);
  const affectedDecisionIds = getDecisionLedgerEntries(capture.workspaceId)
    .filter((entry) => decisionUsesAnySource(entry, capture.sourceIds, capture.before, after))
    .map((entry) => entry.id);
  const statusChanged =
    capture.before !== undefined &&
    after !== undefined &&
    (capture.before.status !== after.status || capture.before.reliance !== after.reliance);
  if (!materiallyMoved && !reviewRequired && affectedDecisionIds.length === 0 && !statusChanged) {
    return null;
  }
  const lowerDelta = moneyDelta(after?.expectedSafeMin, capture.before?.expectedSafeMin);
  const upperDelta = moneyDelta(after?.expectedSafeMax, capture.before?.expectedSafeMax);
  const conservativeBoundaryDelta = moneyDelta(
    after?.conservativeBoundary,
    capture.before?.conservativeBoundary,
  );
  const id = `material_change_${fnv1a32Hex(
    `${String(capture.workspaceId)}:${capture.idempotencyKey}`,
    0x811c9dc5,
  )}`;
  const causeAmount = trustedCoreMoney(strongestDelta) ?? monetaryEffect ?? null;
  const change: MaterialFinancialChange = {
    id,
    workspaceId: capture.workspaceId,
    occurredAt: trustedCoreInstant(capture.occurredAt),
    detectedAt: trustedCoreInstant(new Date()),
    type: capture.type,
    sourceIds: capture.sourceIds,
    truth: capture.truth,
    ...(capture.before === undefined ? {} : { before: capture.before }),
    ...(after === undefined ? {} : { after }),
    ...(monetaryEffect === null ? {} : { monetaryEffect }),
    rangeEffect: {
      ...(lowerDelta === undefined ? {} : { lowerDelta }),
      ...(upperDelta === undefined ? {} : { upperDelta }),
      ...(conservativeBoundaryDelta === undefined ? {} : { conservativeBoundaryDelta }),
    },
    causes: [
      {
        id: `${id}:primary`,
        label: materialChangeCauseLabel(capture.type, strongestDelta),
        weight: 'primary',
        sourceFactIds: capture.sourceIds,
        amount: causeAmount,
      },
    ],
    affectedDecisionIds,
    reviewRequired,
    userActionRequired:
      reviewRequired ||
      affectedDecisionIds.length > 0 ||
      after?.status === 'shortfall' ||
      after?.status === 'contradicted' ||
      after?.status === 'stale',
    explanationCode: `material.${capture.type}.${materialChangeDirection(strongestDelta)}.${capture.truth}`,
  };
  try {
    return recordMaterialFinancialChange(change);
  } catch {
    recordCriticalJourneyContinuity({
      id: `critical_journey_${fnv1a32Hex(`${id}:record_failed`, 0x01000193)}`,
      workspaceId: capture.workspaceId,
      journeyId: 'material_financial_change',
      status: 'blocked',
      startedAt: trustedCoreInstant(capture.occurredAt),
      updatedAt: trustedCoreInstant(new Date()),
      currentRoute: 'material-writer',
      pendingAction: 'record material change',
      blockerCodes: ['material_change_record_failed'],
      decisionLedgerEntryIds: affectedDecisionIds,
      materialChangeIds: [],
      correctionImpactIds: [],
      ...(after === undefined ? {} : { lastSafeRange: after }),
    });
    return null;
  }
}

type StoreMaterialDecisionInput = Omit<
  CreateDecisionDraftInput,
  'workspaceId' | 'workspaceKind' | 'now'
> & {
  now?: Date | string;
  choice?: DecisionLedgerEntry['userChoice']['state'];
  selectedMoveIds?: readonly string[];
  selectedScenarioId?: DecisionLedgerEntry['chosenScenarioId'];
  outcome?: 'awaiting' | Omit<OutcomeInput, 'entryId' | 'now'>;
  forecastEvaluation?: Omit<ForecastEvaluationInput, 'entryId' | 'now'>;
};

function publishDecisionLedgerMutation(
  result: DecisionLedgerMutationResult,
  commandType: string,
  before: unknown,
  occurredAt: string,
): DecisionLedgerEntry | null {
  if (!result.accepted || result.entry === null) return null;
  setPartialWithTypedCommand(
    { decisionLedger: result.entries },
    {
      commandType,
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('decision-ledger-entry', String(result.entry.id))],
      before: { decisionLedger: before },
      after: { decisionLedgerEntry: result.entry },
      invalidatedProjectionKinds: ['decision-ledger', 'companion'],
      occurredAt,
    },
  );
  return result.entry;
}

type PhaseERow =
  | ProvisionalAnswerRecord
  | MaterialFinancialChange
  | CorrectionImpactRecord
  | CriticalJourneyContinuityRecord;

function requireActivePhaseERow<TRow extends PhaseERow>(row: TRow, collection: string): TRow {
  if (String(row.workspaceId) !== String(state.activeWorkspaceId)) {
    throw new Error(
      `${collection}/${String(row.id)} belongs to workspace ${String(row.workspaceId)}, not ${String(
        state.activeWorkspaceId,
      )}.`,
    );
  }
  return row;
}

function upsertPhaseERow<TRow extends PhaseERow>(
  rows: readonly TRow[],
  row: TRow,
  sortKey: (candidate: TRow) => string,
): TRow[] {
  const byId = new Map<string, TRow>();
  byId.set(String(row.id), row);
  for (const candidate of rows) {
    if (!byId.has(String(candidate.id))) byId.set(String(candidate.id), candidate);
  }
  return [...byId.values()]
    .sort((left, right) => sortKey(right).localeCompare(sortKey(left)))
    .slice(0, PHASE_E_RECORD_CAP);
}

export function recordProvisionalAnswer(record: ProvisionalAnswerRecord): ProvisionalAnswerRecord {
  const owned = requireActivePhaseERow(record, 'provisionalAnswers');
  const before = state.provisionalAnswers ?? [];
  const next = upsertPhaseERow(before, owned, (candidate) => candidate.updatedAt);
  setPartialWithTypedCommand(
    { provisionalAnswers: next },
    {
      commandType: 'folio.critical_journey.provisional_answer.record.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('provisional-answer', String(owned.id))],
      before: { provisionalAnswers: before },
      after: { provisionalAnswer: owned },
      invalidatedProjectionKinds: ['cashflow', 'companion'],
      occurredAt: String(owned.updatedAt),
    },
  );
  return owned;
}

export function recordMaterialFinancialChange(
  change: MaterialFinancialChange,
): MaterialFinancialChange {
  const owned = requireActivePhaseERow(change, 'materialChanges');
  const before = state.materialChanges ?? [];
  const next = upsertPhaseERow(before, owned, (candidate) => candidate.detectedAt);
  setPartialWithTypedCommand(
    { materialChanges: next },
    {
      commandType: 'folio.material_change.record.v1',
      actorKind: 'system',
      entityRefs: [opaqueContainerEntityRef('material-change', String(owned.id))],
      before: { materialChanges: before },
      after: { materialChange: owned },
      invalidatedProjectionKinds: ['cashflow', 'route', 'decision-ledger', 'companion'],
      occurredAt: String(owned.detectedAt),
    },
  );
  return owned;
}

export function recordCorrectionImpact(impact: CorrectionImpactRecord): CorrectionImpactRecord {
  const owned = requireActivePhaseERow(impact, 'correctionImpacts');
  const beforeImpacts = state.correctionImpacts ?? [];
  const beforeLedger = state.decisionLedger ?? [];
  let nextLedger = beforeLedger;
  for (const entryId of owned.affectedDecisionIds) {
    const mutation = addCorrection(nextLedger, {
      entryId,
      field: owned.field,
      before: owned.original,
      after: owned.corrected,
      reason: `Phase E correction ${String(owned.id)} recalculated ${owned.subject.kind}.`,
      recalculatesForecast: owned.before !== undefined || owned.after !== undefined,
      now: owned.correctedAt,
      commandId: `${String(owned.id)}:${String(entryId)}`,
    });
    if (mutation.accepted) nextLedger = mutation.entries;
  }
  const nextImpacts = upsertPhaseERow(beforeImpacts, owned, (candidate) => candidate.correctedAt);
  setPartialWithTypedCommand(
    { correctionImpacts: nextImpacts, decisionLedger: nextLedger },
    {
      commandType: 'folio.correction_impact.record.v1',
      actorKind: 'user',
      entityRefs: [
        opaqueContainerEntityRef('correction-impact', String(owned.id)),
        ...owned.affectedDecisionIds.map((entryId) =>
          opaqueContainerEntityRef('decision-ledger-entry', String(entryId)),
        ),
      ],
      before: { correctionImpacts: beforeImpacts, decisionLedger: beforeLedger },
      after: { correctionImpact: owned, decisionLedger: nextLedger },
      invalidatedProjectionKinds: ['cashflow', 'decision-ledger', 'companion'],
      occurredAt: String(owned.correctedAt),
    },
  );
  return owned;
}

export function recordCriticalJourneyContinuity(
  continuity: CriticalJourneyContinuityRecord,
): CriticalJourneyContinuityRecord {
  const owned = requireActivePhaseERow(continuity, 'criticalJourneyContinuity');
  const before = state.criticalJourneyContinuity ?? [];
  const next = upsertPhaseERow(before, owned, (candidate) => candidate.updatedAt);
  setPartialWithTypedCommand(
    { criticalJourneyContinuity: next },
    {
      commandType: 'folio.critical_journey.continuity.record.v1',
      actorKind: 'system',
      entityRefs: [opaqueContainerEntityRef('critical-journey', String(owned.id))],
      before: { criticalJourneyContinuity: before },
      after: { criticalJourneyContinuity: owned },
      invalidatedProjectionKinds: ['route', 'companion'],
      occurredAt: String(owned.updatedAt),
    },
  );
  return owned;
}

export function recordMaterialDecision(
  input: StoreMaterialDecisionInput,
): DecisionLedgerEntry | null {
  const now = input.now ?? new Date();
  const nowISO = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const before = state.decisionLedger ?? [];
  let mutation = createDecisionDraft(before, {
    ...input,
    workspaceId: state.activeWorkspaceId,
    workspaceKind: activeWorkspaceKind(),
    now,
  });
  if (!mutation.accepted || mutation.entry === null) return null;
  if (mutation.reason === 'Already recorded.' && mutation.entry.userChoice.state !== 'unknown') {
    return mutation.entry;
  }

  mutation = markPresented(mutation.entries, mutation.entry.id, now, input.idempotencyKey);
  if (mutation.entry === null) return null;
  mutation = recordChoice(mutation.entries, {
    entryId: mutation.entry.id,
    state: input.choice ?? 'accepted',
    selectedMoveIds: input.selectedMoveIds ?? [],
    selectedScenarioId: input.selectedScenarioId ?? null,
    now,
    commandId: `${input.idempotencyKey}:choice`,
  });
  if (mutation.entry === null) return null;

  mutation = recordConsent(mutation.entries, {
    entryId: mutation.entry.id,
    required: true,
    granted: true,
    label: 'User confirmed this material decision.',
    sourceControlId: input.idempotencyKey,
    now,
    commandId: `${input.idempotencyKey}:consent`,
  });
  if (mutation.entry === null) return null;

  if (input.outcome === 'awaiting') {
    mutation = markAwaitingOutcome(
      mutation.entries,
      mutation.entry.id,
      now,
      `${input.idempotencyKey}:awaiting`,
    );
  } else if (input.outcome !== undefined) {
    mutation = resolveOutcome(mutation.entries, {
      ...input.outcome,
      entryId: mutation.entry.id,
      now,
      commandId: input.outcome.commandId ?? `${input.idempotencyKey}:outcome`,
    });
  }
  if (mutation.entry === null) return null;

  if (input.forecastEvaluation !== undefined) {
    mutation = evaluateForecast(mutation.entries, {
      ...input.forecastEvaluation,
      entryId: mutation.entry.id,
      now,
    });
  }

  return publishDecisionLedgerMutation(
    mutation,
    'folio.decision_ledger.record_material.v1',
    before,
    nowISO,
  );
}

export function getDecisionLedgerEntries(
  workspaceId: WorkspaceId = state.activeWorkspaceId,
): readonly DecisionLedgerEntry[] {
  return exportDecisionLedger(state.decisionLedger ?? [], workspaceId);
}

export function deleteDecisionLedgerEntry(id: DecisionRecordId): boolean {
  const before = state.decisionLedger ?? [];
  const mutation = deleteDecision(before, id, new Date());
  return (
    publishDecisionLedgerMutation(
      mutation,
      'folio.decision_ledger.delete.v1',
      before,
      new Date().toISOString(),
    ) !== null
  );
}

export function disableDecisionLedgerLearning(id: DecisionRecordId): boolean {
  const before = state.decisionLedger ?? [];
  const mutation = disableDecisionLearning(before, id, new Date());
  return (
    publishDecisionLedgerMutation(
      mutation,
      'folio.decision_ledger.learning.disable.v1',
      before,
      new Date().toISOString(),
    ) !== null
  );
}

export function removeDecisionLedgerLearning(id: DecisionRecordId): boolean {
  const before = state.decisionLedger ?? [];
  const mutation = removeDecisionLearning(before, id, new Date());
  return (
    publishDecisionLedgerMutation(
      mutation,
      'folio.decision_ledger.learning.remove.v1',
      before,
      new Date().toISOString(),
    ) !== null
  );
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function setPots(pots: Pot[] | ((prev: Pot[]) => Pot[])) {
  const next = typeof pots === 'function' ? pots(state.pots) : pots;
  if (structurallyEqual(state.pots, next)) {
    setPartial({ pots: next });
    return;
  }
  const capture = beginMaterialWrite({
    type: 'pot_move',
    sourceIds: ['fact_pots_saved'],
    idempotencyKey: `pots_replace_${fnv1a32Hex(JSON.stringify(next), 0x01000193)}`,
  });
  const refs = uniqueOpaqueContainerEntityRefs(
    'pot',
    [...state.pots, ...next].map((pot) => pot.id),
  );
  setPartialWithTypedCommand(
    { pots: next },
    {
      commandType: 'folio.pots.replace.v1',
      actorKind: 'user',
      entityRefs: refs,
      before: { pots: state.pots },
      after: { pots: next },
      invalidatedProjectionKinds: ['pots', 'cashflow'],
    },
  );
  completeMaterialWrite(capture);
}

export function setSubs(subs: Sub[] | ((prev: Sub[]) => Sub[])) {
  const next = typeof subs === 'function' ? subs(state.subs) : subs;
  if (structurallyEqual(state.subs, next)) {
    setPartial({ subs: next });
    return;
  }
  const capture = beginMaterialWrite({
    type: 'subscription_detected',
    sourceIds: ['fact_subscriptions'],
    idempotencyKey: `subscriptions_replace_${fnv1a32Hex(JSON.stringify(next), 0x01000193)}`,
  });
  const refs = uniqueOpaqueContainerEntityRefs(
    'subscription',
    [...state.subs, ...next].map((subscription) => subscription.name),
  );
  setPartialWithTypedCommand(
    { subs: next },
    {
      commandType: 'folio.subscriptions.replace.v1',
      actorKind: 'user',
      entityRefs: refs,
      before: { subscriptions: state.subs },
      after: { subscriptions: next },
      invalidatedProjectionKinds: ['subscriptions', 'cashflow', 'calendar'],
    },
  );
  completeMaterialWrite(capture);
}

export function removeSub(name: string): TinyWin | null {
  const removed = state.subs.find((subscription) => subscription.name === name);
  const { [name]: _gone, ...restPaused } = state.subPaused;
  const { [name]: _goneCheckIn, ...restCheckIns } = state.subCheckIns ?? {};
  const { [name]: _gone2, ...restOverrides } = state.subOverrides;
  const subscriptions = state.subs.filter((s) => s.name !== name);
  const cancelledSubs: CancelledSub[] = removed
    ? [
        {
          name: removed.name,
          workspaceId: removed.workspaceId ?? state.activeWorkspaceId,
          monthlyAmount: removed.cost,
          cancelledAt: currentFinancialDate(),
        },
        ...(state.cancelledSubs ?? []).filter((subscription) => subscription.name !== removed.name),
      ].slice(0, 60)
    : (state.cancelledSubs ?? []);
  const changed =
    subscriptions.length !== state.subs.length ||
    Object.prototype.hasOwnProperty.call(state.subPaused, name) ||
    Object.prototype.hasOwnProperty.call(state.subCheckIns ?? {}, name) ||
    Object.prototype.hasOwnProperty.call(state.subOverrides, name);
  const patch = {
    subs: subscriptions,
    subPaused: restPaused,
    subCheckIns: restCheckIns,
    subOverrides: restOverrides,
    cancelledSubs,
  };
  if (!changed) {
    setPartial(patch);
    return null;
  }
  const capture = beginMaterialWrite({
    type: 'subscription_detected',
    sourceIds: [`fact_subscription_${fnv1a32Hex(name, 0x811c9dc5)}`],
    idempotencyKey: `subscription_remove_${name}_${cancelledSubs[0]?.cancelledAt ?? 'unknown'}`,
    monetaryEffectMinor: removed ? Math.round(removed.cost * 100) : null,
  });
  setPartialWithTypedCommand(patch, {
    commandType: 'folio.subscription.remove.v1',
    actorKind: 'user',
    entityRefs: [opaqueContainerEntityRef('subscription', name)],
    before: {
      subscription: state.subs.filter((subscription) => subscription.name === name),
      paused: state.subPaused[name] ?? null,
      checkedInAt: state.subCheckIns?.[name] ?? null,
      overrideDays: state.subOverrides[name] ?? null,
    },
    after: {
      archived: cancelledSubs.find((subscription) => subscription.name === name) ?? null,
    },
    invalidatedProjectionKinds: ['subscriptions', 'cashflow', 'calendar'],
  });
  completeMaterialWrite(capture);
  return removed ? awardTinyWin('first-sub-cancelled') : null;
}

/** Restore a recoverably cancelled subscription using its last-known cost.
 *  The renewal date is deliberately marked as an editable 30-day estimate. */
export function restoreSub(name: string): boolean {
  const archived = (state.cancelledSubs ?? []).find((subscription) => subscription.name === name);
  if (!archived) return false;
  const cancelledSubs = (state.cancelledSubs ?? []).filter(
    (subscription) => subscription.name !== name,
  );
  if (state.subs.some((subscription) => subscription.name === archived.name)) {
    setPartial({ cancelledSubs });
    return false;
  }
  const today = currentFinancialDate();
  const restored: Sub = {
    name: archived.name,
    workspaceId: archived.workspaceId ?? state.activeWorkspaceId,
    cost: archived.monthlyAmount,
    nextRenewalDaysAway: 30,
    nextRenewalISO: anchorIsoFor(30, today),
    lastUsedDaysAgo: 0,
    usesPerMonth: 0,
  };
  const capture = beginMaterialWrite({
    type: 'subscription_detected',
    sourceIds: [`fact_subscription_${fnv1a32Hex(restored.name, 0x811c9dc5)}`],
    idempotencyKey: `subscription_restore_${restored.name}_${today}`,
    monetaryEffectMinor: -Math.round(restored.cost * 100),
  });
  setPartialWithTypedCommand(
    { subs: [restored, ...state.subs], cancelledSubs },
    {
      commandType: 'folio.subscription.restore.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('subscription', restored.name)],
      before: { archived },
      after: { subscription: restored },
      invalidatedProjectionKinds: ['subscriptions', 'cashflow', 'calendar'],
    },
  );
  completeMaterialWrite(capture);
  return true;
}

/** Rolling monthly amount no longer leaving the account after cancellations. */
export function getMonthlyCancelSavings(cancelled: readonly CancelledSub[]): number {
  return Math.round(cancelled.reduce((sum, subscription) => sum + subscription.monthlyAmount, 0));
}

export function addToPot(id: string, amount: number, source: string = 'manual') {
  if (!(amount > 0)) return;
  const before = state.pots.find((p) => p.id === id);
  const capture = beginMaterialWrite({
    type: 'pot_move',
    sourceIds: [`fact_pot_${id}`],
    idempotencyKey: `pot_deposit_${id}_${source}_${Date.now()}`,
    monetaryEffectMinor: -Math.round(amount * 100),
  });
  const entry: PotLedgerEntry = {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    potId: id,
    at: new Date().toISOString(),
    kind: 'deposit',
    amount,
    source,
  };
  const nextPots = state.pots.map((p) => (p.id === id ? { ...p, saved: p.saved + amount } : p));
  const potLedger = [entry, ...state.potLedger].slice(0, 500);
  setPartialWithTypedCommand(
    { pots: nextPots, potLedger },
    {
      commandType: 'folio.pot.deposit.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('pot', id), { type: 'pot-ledger-entry', id: entry.id }],
      before: { pot: before ?? null },
      after: { pot: nextPots.find((pot) => pot.id === id) ?? null, ledgerEntry: entry },
      invalidatedProjectionKinds: ['pots', 'pot-ledger', 'cashflow'],
      occurredAt: entry.at,
    },
  );
  const afterPot = nextPots.find((pot) => pot.id === id);
  recordMaterialDecision({
    idempotencyKey: `pot_deposit_${entry.id}`,
    decisionType: 'pot-contribution',
    contextRoute: 'pots',
    question: `Set aside £${amount.toFixed(2)}${afterPot ? ` for ${afterPot.name}` : ''}.`,
    questionSource: source === 'melo' ? 'melo-proposed' : 'user',
    priority: 'build_buffer',
    amountMinor: Math.round(amount * 100),
    bufferDeltaMinor: Math.round(amount * 100),
    confirmedAction: true,
    outcome: 'awaiting',
    now: entry.at,
    meloExplanation:
      source === 'melo' ? 'Melo recorded the pot move after user confirmation.' : null,
  });
  completeMaterialWrite(capture);

  // Emit a Melo reaction if this deposit tips the pot over the goal line (or over the halfway
  // threshold on the way up). RN port of folio-melo lib/store.ts `addToPot` (byte-faithful
  // thresholds/copy/durations). Reactions are the visual language of MELO_EMOTIONAL_ENGINE.md § 3 —
  // no cooldown/dedupe/queue here; that is the separate `meloReactions` engine (ENGINES.md § 9.4).
  if (before && before.goal > 0) {
    const after = nextPots.find((p) => p.id === id);
    if (after) {
      const beforeRatio = before.saved / before.goal;
      const afterRatio = after.saved / after.goal;
      if (beforeRatio < 1 && afterRatio >= 1) awardTinyWin('first-pot-fully-funded');
      void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
        if (beforeRatio < 1 && afterRatio >= 1) {
          emitMeloReaction('pots-inline', {
            mood: 'cheer',
            pose: 'safe',
            line: `${after.name.split(' · ')[0] ?? after.name} is full. Small yes.`,
            durationMs: 4200,
            key: id,
            eventType: 'POT_GOAL_HIT',
            eventPriority: 'high',
            eventIntensity: 'major',
          });
        } else if (beforeRatio < 0.5 && afterRatio >= 0.5) {
          emitMeloReaction('pots-inline', {
            mood: 'curious',
            pose: 'none',
            line: 'Halfway. Quietly working.',
            durationMs: 3400,
            key: id,
            eventType: 'POT_HALFWAY',
            eventIntensity: 'small',
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
  const capture = beginMaterialWrite({
    type: 'pot_move',
    sourceIds: [`fact_pot_${id}`],
    idempotencyKey: `pot_borrow_${id}_${source}_${Date.now()}`,
    monetaryEffectMinor: Math.round(amount * 100),
  });
  const entry: PotLedgerEntry = {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    potId: id,
    at: new Date().toISOString(),
    kind: 'borrow',
    amount,
    source,
  };
  const pots = state.pots.map((p) => (p.id === id ? { ...p, saved: p.saved - amount } : p));
  const potLedger = [entry, ...state.potLedger].slice(0, 500);
  setPartialWithTypedCommand(
    { pots, potLedger },
    {
      commandType: 'folio.pot.borrow.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('pot', id), { type: 'pot-ledger-entry', id: entry.id }],
      before: { pot },
      after: { pot: pots.find((candidate) => candidate.id === id), ledgerEntry: entry },
      invalidatedProjectionKinds: ['pots', 'pot-ledger', 'cashflow'],
      occurredAt: entry.at,
    },
  );
  recordMaterialDecision({
    idempotencyKey: `pot_borrow_${entry.id}`,
    decisionType: 'pot-borrow',
    contextRoute: 'pots',
    question: `Borrow £${amount.toFixed(2)} from ${pot.name}.`,
    questionSource: source === 'melo' ? 'melo-proposed' : 'user',
    priority: 'avoid_shortfall',
    amountMinor: -Math.round(amount * 100),
    bufferDeltaMinor: -Math.round(amount * 100),
    confirmedAction: true,
    outcome: 'awaiting',
    now: entry.at,
    meloExplanation:
      source === 'melo' ? 'Melo recorded the pot borrow after user confirmation.' : null,
  });
  completeMaterialWrite(capture);
  // Whisper on Today so the borrow feels acknowledged, not silent.
  void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
    emitMeloReaction('today-header', {
      mood: 'calm',
      pose: 'safe',
      line: `Borrowed £${amount} from ${pot.name.split(' · ')[0] ?? pot.name}. Ritual will remind you to repay.`,
      durationMs: 4200,
      key: `borrow-${id}`,
      eventType: 'POT_BORROWED',
      eventIntensity: 'normal',
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
  const capture = beginMaterialWrite({
    type: 'pot_move',
    sourceIds: [`fact_pot_${id}`, 'fact_pot_borrow'],
    idempotencyKey: `pot_repay_${id}_${source}_${Date.now()}`,
    monetaryEffectMinor: 0,
  });
  const entry: PotLedgerEntry = {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    potId: id,
    at: new Date().toISOString(),
    kind: 'repay',
    amount,
    source,
  };
  setPartialWithTypedCommand(
    { potLedger: [entry, ...state.potLedger].slice(0, 500) },
    {
      commandType: 'folio.pot.repay.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('pot', id), { type: 'pot-ledger-entry', id: entry.id }],
      before: {},
      after: { ledgerEntry: entry },
      invalidatedProjectionKinds: ['pot-ledger', 'cashflow'],
      occurredAt: entry.at,
    },
  );
  completeMaterialWrite(capture);
}

/** ENGINES.md § 4 "Pot borrow hard-capped by default" (RN port of folio-melo lib/store.ts
 *  `setPotAllowNegative`). Toggles the per-pot opt-in that lets a buffer pot go briefly negative when
 *  borrowed from, instead of the default hard cap at £0. */
export function setPotAllowNegative(id: string, value: boolean) {
  const pot = state.pots.find((candidate) => candidate.id === id);
  const pots = state.pots.map((p) => (p.id === id ? { ...p, allowNegative: value } : p));
  if (pot === undefined || structurallyEqual(state.pots, pots)) {
    setPartial({ pots });
    return;
  }
  setPartialWithTypedCommand(
    { pots },
    {
      commandType: 'folio.pot.overdraft_policy.set.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('pot', id)],
      before: { allowNegative: pot.allowNegative ?? false },
      after: { allowNegative: value },
      invalidatedProjectionKinds: ['pots', 'cashflow'],
    },
  );
}

/** Awards a Tiny Win the first (and only) time this kind fires (RN port of folio-melo lib/store.ts
 *  `awardTinyWin`, per `lib/wins.ts`'s one-shot-per-kind contract). No-op if already awarded. Newest
 *  first, capped at 40. Returns the new win, or null if this kind was already awarded. */
export function awardTinyWin(kind: TinyWinKind): TinyWin | null {
  const existing = state.tinyWins ?? [];
  if (hasWin(existing, kind)) return null;
  const win = makeWin(kind);
  const tinyWins = [win, ...existing].slice(0, 40);
  setPartialWithTypedCommand(
    { tinyWins },
    {
      commandType: 'folio.companion.tiny_win.award.v1',
      actorKind: 'system',
      entityRefs: [opaqueContainerEntityRef('tiny-win', kind)],
      before: { tinyWins: existing },
      after: { tinyWins },
      invalidatedProjectionKinds: ['companion', 'insights'],
    },
  );
  void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
    emitMeloReaction('earn-beat', {
      mood: 'cheer',
      pose: 'sealed',
      line: win.message,
      durationMs: 2_800,
      eventType: 'SUCCESS',
      eventIntensity: 'small',
    });
  });
  return win;
}

/** Remove a just-awarded win when its reversible action is undone in the same interaction. */
export function revokeTinyWin(kind: TinyWinKind) {
  const existing = state.tinyWins ?? [];
  const tinyWins = existing.filter((win) => win.kind !== kind);
  if (tinyWins.length === existing.length) return;
  setPartial({ tinyWins });
}

/** Mark a sub as "just used" — resets lastUsedDaysAgo to 0 and nudges
 *  the monthly count up by one, so the Subs screen pulse turns green. */
export function markSubUsed(name: string) {
  const before = state.subs.find((subscription) => subscription.name === name);
  if (before === undefined) return;
  const subs = state.subs.map((subscription) =>
    subscription.name === name
      ? {
          ...subscription,
          lastUsedDaysAgo: 0,
          usesPerMonth: subscription.usesPerMonth + 1,
        }
      : subscription,
  );
  setPartialWithTypedCommand(
    { subs },
    {
      commandType: 'folio.subscription.mark_used.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('subscription', name)],
      before: { subscription: before },
      after: { subscription: subs.find((subscription) => subscription.name === name) },
      invalidatedProjectionKinds: ['subscriptions'],
    },
  );
}

function derivePauseReason(subscription: Sub): string {
  if (typeof subscription.trialEndsInDays === 'number') return 'trial was about to charge';
  if (subscription.usesPerMonth === 0) return "you hadn't used it";
  const costPerUsePence = (subscription.cost * 100) / Math.max(1, subscription.usesPerMonth);
  if (costPerUsePence > 200) return 'cost per use was high';
  if (subscription.lastUsedDaysAgo > 21) return "you hadn't opened it in weeks";
  return 'you chose to rest it';
}

function addDaysToIso(iso: string, days: number): string {
  return addDaysToLocalDate(iso, days);
}

function subscriptionWithPause(subscription: Sub, paused: boolean, today: string): Sub {
  if (!paused) {
    const {
      pausedUntil: _pausedUntil,
      pauseReason: _pauseReason,
      pausedAt: _pausedAt,
      ...rest
    } = subscription;
    return rest as Sub;
  }
  const renewal =
    subscription.nextRenewalISO ??
    anchorIsoFor(Math.max(0, subscription.nextRenewalDaysAway), today);
  return {
    ...subscription,
    pausedUntil: addDaysToIso(renewal, 1),
    autoResume: subscription.autoResume ?? 'prompt',
    pauseReason: derivePauseReason(subscription),
    pausedAt: today,
  };
}

export function togglePaused(
  name: string,
  value?: boolean,
  options?: MaterialDecisionWriteOptions,
) {
  const current = !!state.subPaused[name];
  const next = value ?? !current;
  const hadStoredValue = Object.prototype.hasOwnProperty.call(state.subPaused, name);
  const subPaused = { ...state.subPaused, [name]: next };
  const today = currentFinancialDate();
  const subs =
    current === next
      ? state.subs
      : state.subs.map((subscription) =>
          subscription.name === name
            ? subscriptionWithPause(subscription, next, today)
            : subscription,
        );
  const timelineEvent =
    current === next ? null : createTimelineEvent(next ? 'sub-paused' : 'sub-resumed', name);
  const timelineEvents =
    timelineEvent === null
      ? undefined
      : [timelineEvent, ...(state.timelineEvents ?? [])].slice(0, 200);
  if (current === next && hadStoredValue) {
    setPartial({ subPaused, subs });
  } else {
    const subscription = subs.find((candidate) => candidate.name === name);
    const capture = beginMaterialWrite({
      type: 'subscription_detected',
      sourceIds: [`fact_subscription_${fnv1a32Hex(name, 0x811c9dc5)}`],
      idempotencyKey: `subscription_${next ? 'pause' : 'resume'}_${name}_${today}`,
      monetaryEffectMinor: subscription ? Math.round(subscription.cost * 100) * (next ? 1 : -1) : 0,
    });
    setPartialWithTypedCommand(
      { subPaused, subs, ...(timelineEvents === undefined ? {} : { timelineEvents }) },
      {
        commandType: next ? 'folio.subscription.pause.v1' : 'folio.subscription.resume.v1',
        actorKind: 'user',
        entityRefs: [opaqueContainerEntityRef('subscription', name)],
        before: {
          paused: hadStoredValue ? state.subPaused[name] : null,
          subscription: state.subs.find((subscription) => subscription.name === name) ?? null,
        },
        after: {
          paused: next,
          subscription: subs.find((subscription) => subscription.name === name) ?? null,
        },
        invalidatedProjectionKinds: ['subscriptions', 'cashflow', 'calendar'],
      },
    );
    completeMaterialWrite(capture);
  }

  // Sub toggled → whisper on the subs surface. RN port of folio-melo lib/store.ts `togglePaused`
  // (byte-faithful mood/pose/copy/durations). MELO_EMOTIONAL_ENGINE.md § 3 "sub paused" / "sub
  // resumed" reactions — cooldown/dedupe is the separate `meloReactions` engine (ENGINES.md § 9.4).
  if (current !== next && shouldRecordMaterialDecision(options)) {
    const subscription = subs.find((candidate) => candidate.name === name);
    recordMaterialDecision({
      idempotencyKey: `subscription_${next ? 'pause' : 'resume'}_${name}_${today}`,
      decisionType: 'recurring-commitment-change',
      contextRoute: 'subs',
      question: `${next ? 'Pause' : 'Resume'} ${name}.`,
      questionSource: 'user',
      priority: 'keep_commitment',
      amountMinor: subscription ? Math.round(subscription.cost * 100) : 0,
      confirmedAction: true,
      outcome: 'awaiting',
      now: `${today}T00:00:00.000Z`,
    });
    void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
      emitMeloReaction('subs-inline', {
        mood: next ? 'calm' : 'curious',
        pose: next ? 'safe' : 'check',
        line: next
          ? `${name} paused for one cycle. I'll resume it after.`
          : `${name} back on. I'll watch the timing.`,
        durationMs: 4000,
        key: name,
        eventType: next ? 'SUB_PAUSED' : 'SUB_RESUMED',
        eventIntensity: 'small',
      });
    });
  }
}

/** Record the explicit answer to Melo's every-third-renewal subscription check-in. */
export function logSubCheckIn(name: string, verdict: 'keep' | 'pause') {
  const today = currentFinancialDate();
  const subCheckIns = { ...(state.subCheckIns ?? {}), [name]: today };
  setPartialWithTypedCommand(
    { subCheckIns },
    {
      commandType: 'folio.subscription.check_in.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('subscription', name)],
      before: { checkedInAt: state.subCheckIns?.[name] ?? null },
      after: { checkedInAt: today, verdict },
      invalidatedProjectionKinds: ['subscriptions'],
    },
  );
  if (verdict === 'pause' && !state.subPaused[name]) {
    togglePaused(name, true);
  }
}

export function pauseMany(names: string[], value: boolean) {
  const uniqueNames = [...new Set(names)];
  if (uniqueNames.length === 0) return;
  const next = { ...state.subPaused };
  for (const n of uniqueNames) next[n] = value;
  const targetNames = new Set(uniqueNames);
  const today = currentFinancialDate();
  const subs = state.subs.map((subscription) =>
    targetNames.has(subscription.name) && !!state.subPaused[subscription.name] !== value
      ? subscriptionWithPause(subscription, value, today)
      : subscription,
  );
  if (structurallyEqual(state.subPaused, next) && structurallyEqual(state.subs, subs)) {
    setPartial({ subPaused: next, subs });
    return;
  }
  const monthlyEffectMinor = subs
    .filter((subscription) => uniqueNames.includes(subscription.name))
    .reduce((sum, subscription) => sum + Math.round(subscription.cost * 100), 0);
  const capture = beginMaterialWrite({
    type: 'subscription_detected',
    sourceIds: uniqueNames.map((name) => `fact_subscription_${fnv1a32Hex(name, 0x811c9dc5)}`),
    idempotencyKey: `subscriptions_${value ? 'pause_many' : 'resume_many'}_${uniqueNames.join('_')}_${today}`,
    monetaryEffectMinor: value ? monthlyEffectMinor : -monthlyEffectMinor,
  });
  setPartialWithTypedCommand(
    { subPaused: next, subs },
    {
      commandType: value
        ? 'folio.subscriptions.pause_many.v1'
        : 'folio.subscriptions.resume_many.v1',
      actorKind: 'user',
      entityRefs: uniqueOpaqueContainerEntityRefs('subscription', uniqueNames),
      before: {
        paused: Object.fromEntries(
          uniqueNames.map((name) => [name, state.subPaused[name] ?? null]),
        ),
      },
      after: {
        paused: Object.fromEntries(uniqueNames.map((name) => [name, value])),
        subscriptions: subs.filter((subscription) => targetNames.has(subscription.name)),
      },
      invalidatedProjectionKinds: ['subscriptions', 'cashflow', 'calendar'],
    },
  );
  completeMaterialWrite(capture);
}

export function addCycle(c: CycleRecord) {
  // The note the user just wrote at cycle close becomes "past-you's line"
  // for the next ritual. Clearing it here means the next cycle starts with
  // a blank input rather than echoing the same note forever.
  const cycles = [c, ...state.cycles].slice(0, 24);
  const closedAt =
    c.closedAt.length === 10
      ? new Date(`${c.closedAt}T00:00:00.000Z`).toISOString()
      : new Date(c.closedAt).toISOString();
  const cycleId = `${String(state.activeWorkspaceId)}\u001f${c.closedAt}\u001f${c.label}`;
  const progress = applyCycleCloseProgress(state.stage, state.streak, {
    cycleId,
    spare: c.spare,
    tightPoint: c.tightPoint,
    closedAt,
  });
  const currentMelo = state.melo ?? DEFAULT_MELO;
  const wardrobe = evaluateWardrobe(cycles, currentMelo.wardrobe);
  const previouslyUnlocked = unlockedWardrobe(state.cycles);
  const addedTouch = unlockedWardrobe(cycles).find((touch) => !previouslyUnlocked.includes(touch));
  const capture = beginMaterialWrite({
    type: 'forecast_recalculation',
    sourceIds: [`fact_cycle_${fnv1a32Hex(cycleId, 0x811c9dc5)}`],
    idempotencyKey: `cycle_close_${cycleId}`,
    monetaryEffectMinor: Math.round(c.spare * 100),
  });
  setPartialWithTypedCommand(
    {
      cycles,
      nextYouNote: '',
      subOverrides: {},
      spendHold: null,
      whatIfHolds: [],
      stage: progress.stage,
      streak: progress.streak,
      melo: { ...currentMelo, wardrobe },
    },
    {
      commandType: 'folio.cycle.close.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('cycle', `${c.closedAt}\u001f${c.label}`)],
      before: {
        subOverrides: state.subOverrides,
        spendHold: state.spendHold ?? null,
        whatIfHolds: state.whatIfHolds ?? [],
        stage: state.stage,
        streak: state.streak,
        wardrobe: currentMelo.wardrobe,
      },
      after: { cycle: c, stage: progress.stage, streak: progress.streak, wardrobe },
      invalidatedProjectionKinds: ['cycles', 'insights', 'cashflow', 'calendar', 'companion'],
      occurredAt: closedAt,
    },
  );
  recordMaterialDecision({
    idempotencyKey: `payday_plan_${cycleId.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    decisionType: 'payday-plan',
    contextRoute: 'ritual',
    question: `Close ${c.label} with £${c.spare.toFixed(2)} spare.`,
    questionSource: 'payday-ritual',
    priority: 'cashflow_source_quality',
    amountMinor: Math.round(c.spare * 100),
    bufferDeltaMinor: Math.round(c.tightPoint * 100),
    confirmedAction: true,
    outcome: {
      state: c.spare >= 0 && c.tightPoint >= 0 ? 'as-expected' : 'worse-than-expected',
      actualCashDeltaMinor: Math.round(c.spare * 100),
      actualBufferDeltaMinor: Math.round(c.tightPoint * 100),
      actualSourceFactIds: [],
      note: c.note,
      forecastErrorMinor: null,
    },
    now: closedAt,
    forecastEvaluation: {
      actualTightestPointMinor: Math.round(c.tightPoint * 100),
      actualEndPositionMinor: Math.round(c.spare * 100),
      note: 'Evaluated from the cycle close values the user confirmed.',
      sourceFactIds: [],
    },
  });
  completeMaterialWrite(capture);
  void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
    emitMeloReaction('companion-root', {
      mood: 'cheer',
      pose: 'safe',
      line: 'Cycle closed. Your next path is ready.',
      durationMs: 3_200,
      eventType: 'CYCLE_CLOSED',
      eventPriority: 'high',
      eventIntensity: 'major',
    });
  });
  releaseCelebrateSlotForNewCycle();
  if (addedTouch !== undefined) {
    void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
      emitMeloReaction('earn-beat', {
        mood: 'cheer',
        pose: 'sealed',
        line:
          addedTouch === 'scarf'
            ? 'Melo earned a scarf. Warm cycle.'
            : addedTouch === 'crown'
              ? 'Three safe cycles. Melo wears the crown.'
              : 'Melo picked up a new touch.',
        durationMs: 3_200,
        key: 'wardrobe',
        eventType: 'SUCCESS',
        eventIntensity: 'small',
      });
    });
  }
  if (
    cycles.length >= 4 &&
    cycles.slice(0, 4).every((cycle) => cycle.tightPoint >= 0 && cycle.spare >= 0)
  ) {
    awardTinyWin('four-week-green-streak');
  }
}

/** Complete the explicit payday rebirth beat after the cycle-close write. */
export function completePaydayRitualMelo(now: Date = new Date()): boolean {
  const at = now.toISOString();
  const stage = applyRitualCompletion(state.stage, at);
  if (stage === state.stage) return false;
  setPartialWithTypedCommand(
    { stage },
    {
      commandType: 'folio.companion.stage.ritual_complete.v1',
      actorKind: 'user',
      entityRefs: [workspaceCollectionEntityRef('companion-progression')],
      before: { stage: state.stage },
      after: { stage },
      invalidatedProjectionKinds: ['companion'],
      occurredAt: at,
    },
  );
  void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
    emitMeloReaction('companion-root', {
      mood: 'cheer',
      pose: 'sealed',
      line: 'Payday ritual complete.',
      durationMs: 3_200,
      eventType: 'RITUAL_COMPLETED',
      eventPriority: 'high',
      eventIntensity: 'major',
    });
  });
  return true;
}

/** Refresh the active workspace's stage after 24h without ever reading another partition. */
export function refreshMeloStage(input: StageInput, now: Date = new Date()): boolean {
  const at = now.toISOString();
  const stage = deriveForegroundStage(state.stage, input, at);
  if (stage === state.stage) return false;
  setPartialWithTypedCommand(
    { stage },
    {
      commandType: 'folio.companion.stage.foreground_refresh.v1',
      actorKind: 'system',
      entityRefs: [workspaceCollectionEntityRef('companion-progression')],
      before: { stage: state.stage },
      after: { stage },
      invalidatedProjectionKinds: ['companion'],
      occurredAt: at,
    },
  );
  return true;
}

/** Run Business foreground progression against this Business partition only. */
export function refreshBusinessMeloProgress(now: Date = new Date()): boolean {
  const active = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
  if (active?.kind !== 'business') return false;

  const at = now.toISOString();
  const business = normaliseBusinessOperationsState(state.business);
  const initialSignals = businessMeloSignals(
    business,
    state.streak,
    (state.melo ?? DEFAULT_MELO).quietMode,
    now,
  );
  const streak = applyBusinessWeeklyProgress(state.streak, {
    runwayDays: initialSignals.runwayDays,
    overdueInvoiceCount: initialSignals.overdueInvoiceCount,
    now: at,
  });
  const stageSignals =
    streak === state.streak
      ? initialSignals
      : businessMeloSignals(business, streak, (state.melo ?? DEFAULT_MELO).quietMode, now);
  const stage = deriveBusinessForegroundStage(state.stage, stageSignals.stageInput, at);
  if (stage === state.stage && streak === state.streak) return false;

  setPartialWithTypedCommand(
    { stage, streak },
    {
      commandType: 'folio.companion.business_progress.foreground_refresh.v1',
      actorKind: 'system',
      entityRefs: [workspaceCollectionEntityRef('companion-progression')],
      before: { stage: state.stage, streak: state.streak },
      after: { stage, streak },
      invalidatedProjectionKinds: ['companion'],
      occurredAt: at,
    },
  );
  return true;
}

export function setOnboarding(o: Partial<Onboarding>) {
  const onboarding = { ...state.onboarding, ...o };
  const capture =
    o.monthlyIncome !== undefined || o.payday !== undefined
      ? beginMaterialWrite({
          type: 'income_change',
          sourceIds: ['fact_income_schedule'],
          idempotencyKey: `onboarding_income_${String(o.payday ?? onboarding.payday)}_${String(
            o.monthlyIncome ?? onboarding.monthlyIncome,
          )}`,
          monetaryEffectMinor:
            o.monthlyIncome === undefined
              ? null
              : Math.round((o.monthlyIncome - state.onboarding.monthlyIncome) * 100),
        })
      : null;
  setPartialWithTypedCommand(
    { onboarding },
    {
      commandType: 'folio.financial_context.onboarding.set.v1',
      actorKind: 'user',
      entityRefs: [financialContextEntityRef()],
      before: { onboarding: state.onboarding },
      after: { onboarding },
      invalidatedProjectionKinds: ['income', 'calendar', 'cashflow', 'route'],
    },
  );
  completeMaterialWrite(capture);
}

/** ENGINES.md § 6 "Starting balance — source + confidence". The single
 *  write path for the user's current account position. Always stamps
 *  `setAt` so the source label can show "you set this 2 days ago" later. */
export function setCurrentBalance(next: Omit<CurrentBalance, 'setAt'>) {
  const setAt = new Date().toISOString();
  const capture = beginMaterialWrite({
    type: 'balance_correction',
    sourceIds: ['fact_current_balance'],
    truth:
      next.source === 'sample'
        ? 'sample_demo'
        : next.confidence === 'rough'
          ? 'estimated'
          : next.confidence === 'statement-derived'
            ? 'observed'
            : 'user_confirmed',
    idempotencyKey: `current_balance_${setAt}`,
    monetaryEffectMinor: Math.round((next.amount - state.currentBalance.amount) * 100),
  });
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
  const nextBalance = { ...next, amount: bankTotal, setAt };
  setPartialWithTypedCommand(
    { currentBalance: nextBalance, accounts: nextAccounts },
    {
      commandType: 'folio.balance.set_current.v1',
      actorKind: balanceActorKind(next.source),
      entityRefs: [{ type: 'balance', id: `${String(state.activeWorkspaceId)}:current` }],
      before: { balance: state.currentBalance },
      after: { balance: nextBalance },
      changedEntityIds: nextAccounts.some((account) => account.id === DEFAULT_ACCOUNT_ID)
        ? [DEFAULT_ACCOUNT_ID]
        : [],
      invalidatedProjectionKinds: ['account-balances', 'cashflow'],
      occurredAt: setAt,
    },
  );
  completeMaterialWrite(capture);
}

function balanceActorKind(source: BalanceSource): PendingAppStateCommandInput['actorKind'] {
  if (source === 'statement' || source === 'pdf-derived' || source === 'ocr-derived')
    return 'import';
  if (source === 'sample') return 'system';
  return 'user';
}

function transactionActorKind(
  transactions: readonly Pick<Transaction, 'source' | 'sourceEvidenceId'>[],
): PendingAppStateCommandInput['actorKind'] {
  if (transactions.some((transaction) => transaction.sourceEvidenceId !== undefined))
    return 'import';
  const sources = new Set(transactions.map((transaction) => transaction.source));
  if (sources.size !== 1) return 'system';
  const source = transactions[0]?.source;
  if (source === 'melo') return 'melo';
  if (source === 'bank') return 'sync';
  if (source === 'seed') return 'system';
  return 'user';
}

function transactionTruth(
  transaction: Pick<Transaction, 'source' | 'sourceEvidenceId'>,
): MaterialFinancialChange['truth'] {
  if (transaction.source === 'seed') return 'sample_demo';
  if (transaction.source === 'bank' || transaction.sourceEvidenceId !== undefined)
    return 'observed';
  if (transaction.source === 'melo') return 'user_confirmed';
  return 'user_confirmed';
}

function transactionSourceIds(
  transaction: Pick<Transaction, 'id' | 'category' | 'sourceEvidenceId'>,
) {
  return [
    `fact_transaction_${transaction.id}`,
    transaction.category === 'income' ? 'fact_income_history' : 'fact_spend_history',
    ...(transaction.sourceEvidenceId === undefined
      ? []
      : [`fact_evidence_${transaction.sourceEvidenceId}`]),
  ];
}

function reviewActorKind(
  items: readonly Pick<ReviewItem, 'source'>[],
): PendingAppStateCommandInput['actorKind'] {
  const sources = new Set(items.map((item) => item.source));
  if (sources.size === 1 && items[0]?.source === 'bank') return 'sync';
  if (sources.size === 1 && items[0]?.source === 'manual') return 'user';
  return 'import';
}

/* ---------- Accounts (ACCOUNTS_MODEL.md §2 / §4 P1-P2) ---------- */

/** ACCOUNTS_MODEL.md §2.4 — stable id for the `Debt` row synced from a credit-card `Account`, so
 *  find-or-create is idempotent (same accountId always maps to the same Debt row, never a
 *  duplicate). Not exported — callers never construct this id themselves, only `syncCardDebt`
 *  does, and readers key off `Debt.linkedAccountId` (below) rather than parsing this string. */
function cardDebtId(accountId: string): string {
  return `debt-for-${accountId}`;
}

/** ACCOUNTS_MODEL.md §2.4 — declare payoff details (APR/min payment/due day) for a credit-card
 *  `Account` that has no linked `Debt` row yet. Creates the linked `Debt` row keyed by
 *  `debt-for-${accountId}` with the account's CURRENT
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
  setPartialWithTypedCommand(
    { debts: [...debts, full] },
    {
      commandType: 'folio.debt.card_payoff_details.add.v1',
      actorKind: 'user',
      entityRefs: [
        { type: 'account', id: accountId },
        { type: 'debt', id: full.id },
      ],
      before: { account },
      after: { debt: full },
      invalidatedProjectionKinds: ['debt-summary', 'cashflow'],
      occurredAt: full.addedAt,
    },
  );
  return full;
}

/** Add a new named account. `id` auto-generates when omitted; `balance`/`balanceAsOfISO`/`addedAt`
 *  default to 0/now/now for a freshly-declared account with no known balance yet. `isLiability`
 *  defaults `true` for `kind: 'credit-card'` and `false` for every other kind, matching
 *  ACCOUNTS_MODEL.md §2.1's convention — pass it explicitly to override. Account-picker/creator UI is
 *  P3; this is the plumbing it will call.
 *
 *  ACCOUNTS_MODEL.md §2.4 (P2) — a brand-new card is never given invented APR/minimum-payment
 *  details. It still contributes to net position immediately, and `addCardPayoffDetails` creates the
 *  linked amortisation row only after the user declares those missing facts. */
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
  let patch: Partial<AppState>;
  if (!account.isLiability && account.balanceMinor !== 0) {
    // Same two-way sync invariant as `setAccountBalance`: a new bank account arriving WITH an
    // opening balance moves bank money, so the legacy scalar follows the bank sum in the same
    // write. (The current UI creates accounts at £0 and sets the balance later, so this is a
    // guard for the API contract, not a behavior change for any live flow.)
    const bankTotal = nextAccounts
      .filter((a) => !a.isLiability)
      .reduce((sum, a) => sum + a.balanceMinor, 0);
    patch = {
      accounts: nextAccounts,
      currentBalance: {
        amount: bankTotal,
        source: 'corrected',
        confidence: 'corrected',
        setAt: account.balanceAsOfISO,
      },
    };
  } else {
    patch = { accounts: nextAccounts };
  }
  setPartialWithTypedCommand(patch, {
    commandType: 'folio.account.add.v1',
    actorKind: 'user',
    entityRefs: [{ type: 'account', id: account.id }],
    before: {},
    after: { account },
    changedEntityIds: [account.id],
    invalidatedProjectionKinds: ['accounts', 'account-balances', 'cashflow'],
    occurredAt: now,
  });
  return account;
}

/** Rename an existing account. No-op if the id doesn't exist. */
export function renameAccount(accountId: string, name: string) {
  const accounts = state.accounts ?? [];
  const account = accounts.find((candidate) => candidate.id === accountId);
  if (account === undefined || account.name === name) return;
  const renamed = { ...account, name };
  setPartialWithTypedCommand(
    { accounts: accounts.map((candidate) => (candidate.id === accountId ? renamed : candidate)) },
    {
      commandType: 'folio.account.rename.v1',
      actorKind: 'user',
      entityRefs: [{ type: 'account', id: accountId }],
      before: { account },
      after: { account: renamed },
      changedEntityIds: [accountId],
      invalidatedProjectionKinds: ['accounts'],
    },
  );
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
 *  ACCOUNTS_MODEL.md §2.4 (P2) — when the account is `kind: 'credit-card'` and already has declared
 *  payoff details, its linked `Debt` balance is updated in this same typed mutation. A card without
 *  payoff details remains honest rather than acquiring invented APR/minimum-payment values. */
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
  const capture = beginMaterialWrite({
    type: account.isLiability ? 'debt_payment' : 'balance_correction',
    sourceIds: [account.isLiability ? `fact_debt_account_${accountId}` : 'fact_current_balance'],
    truth:
      provenance?.source === 'sample'
        ? 'sample_demo'
        : provenance?.confidence === 'rough'
          ? 'estimated'
          : provenance?.confidence === 'statement-derived'
            ? 'observed'
            : 'user_confirmed',
    idempotencyKey: `account_balance_${accountId}_${balanceAsOfISO}`,
    monetaryEffectMinor: amount - account.balanceMinor,
  });
  const nextAccounts = accounts.map((a) =>
    a.id === accountId ? { ...a, balanceMinor: amount, balanceAsOfISO } : a,
  );
  let nextDebts = state.debts ?? [];
  const linkedDebtId = cardDebtId(accountId);
  const linkedDebtChanged =
    account.kind === 'credit-card' && nextDebts.some((debt) => debt.id === linkedDebtId);
  if (linkedDebtChanged) {
    nextDebts = nextDebts.map((debt) =>
      debt.id === linkedDebtId ? { ...debt, balance: Math.max(0, amount) } : debt,
    );
  }
  let patch: Partial<AppState>;
  if (account.isLiability) {
    patch = { accounts: nextAccounts, ...(linkedDebtChanged ? { debts: nextDebts } : {}) };
  } else {
    const bankTotal = nextAccounts
      .filter((a) => !a.isLiability)
      .reduce((sum, a) => sum + a.balanceMinor, 0);
    patch = {
      accounts: nextAccounts,
      ...(linkedDebtChanged ? { debts: nextDebts } : {}),
      currentBalance: {
        amount: bankTotal,
        source: provenance?.source ?? 'corrected',
        confidence: provenance?.confidence ?? 'corrected',
        setAt: balanceAsOfISO,
      },
    };
  }
  setPartialWithTypedCommand(patch, {
    commandType: 'folio.account.set_balance.v1',
    actorKind: balanceActorKind(provenance?.source ?? 'corrected'),
    entityRefs: [
      { type: 'account', id: accountId },
      ...(linkedDebtChanged ? [{ type: 'debt', id: linkedDebtId }] : []),
    ],
    before: {
      balance: { amount: account.balanceMinor, asOfISO: account.balanceAsOfISO },
    },
    after: { balance: { amount, asOfISO: balanceAsOfISO } },
    changedEntityIds: [accountId, ...(linkedDebtChanged ? [linkedDebtId] : [])],
    invalidatedProjectionKinds: ['account-balances', 'cashflow', 'debt-summary'],
    occurredAt: balanceAsOfISO,
  });
  completeMaterialWrite(capture);
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
  const capture = beginMaterialWrite({
    type: 'forecast_recalculation',
    sourceIds: ['fact_protected_buffer'],
    idempotencyKey: `tight_point_goal_${String(amount)}`,
    monetaryEffectMinor:
      amount === null ? null : Math.round((amount - (state.tightPointGoal ?? 0)) * 100),
  });
  setPartialWithTypedCommand(
    { tightPointGoal: amount },
    {
      commandType: 'folio.financial_context.tight_point_goal.set.v1',
      actorKind: 'user',
      entityRefs: [financialContextEntityRef()],
      before: { tightPointGoal: state.tightPointGoal },
      after: { tightPointGoal: amount },
      invalidatedProjectionKinds: ['cashflow', 'route'],
    },
  );
  completeMaterialWrite(capture);
}

/* ---------- Income sources (`lib/income.ts`) ---------- */

/** Replace the whole income-source list. Accepts either a value or an updater
 *  over the previous list, mirroring `setPots`/`setSubs`. */
export function setIncomeSources(
  sources: IncomeSource[] | ((prev: IncomeSource[]) => IncomeSource[]),
) {
  const prev = state.incomeSources ?? DEFAULT_INCOME_SOURCES;
  const next = typeof sources === 'function' ? sources(prev) : sources;
  const nextTotal = next.reduce((sum, source) => sum + Math.round(source.amount * 100), 0);
  const prevTotal = prev.reduce((sum, source) => sum + Math.round(source.amount * 100), 0);
  const capture = beginMaterialWrite({
    type: 'income_change',
    sourceIds: ['fact_income_schedule'],
    idempotencyKey: `income_replace_${fnv1a32Hex(JSON.stringify(next), 0x01000193)}`,
    monetaryEffectMinor: nextTotal - prevTotal,
  });
  setPartialWithTypedCommand(
    { incomeSources: next },
    {
      commandType: 'folio.income_schedules.replace.v1',
      actorKind: 'user',
      entityRefs: [workspaceCollectionEntityRef('income-schedule-set')],
      before: { incomeSources: prev },
      after: { incomeSources: next },
      invalidatedProjectionKinds: ['income', 'calendar', 'cashflow', 'route'],
    },
  );
  completeMaterialWrite(capture);
}

/** Add a new source, or replace the existing one with the same `id`. Immutable
 *  — never mutates the previous list. */
export function upsertIncomeSource(sourceEntry: IncomeSource) {
  const prev = state.incomeSources ?? DEFAULT_INCOME_SOURCES;
  const exists = prev.some((s) => s.id === sourceEntry.id);
  const next = exists
    ? prev.map((s) => (s.id === sourceEntry.id ? sourceEntry : s))
    : [...prev, sourceEntry];
  const beforeSource = prev.find((source) => source.id === sourceEntry.id);
  const capture = beginMaterialWrite({
    type: 'income_change',
    sourceIds: [`fact_income_source_${sourceEntry.id}`],
    idempotencyKey: `income_upsert_${sourceEntry.id}_${fnv1a32Hex(JSON.stringify(sourceEntry), 0x01000193)}`,
    monetaryEffectMinor: Math.round((sourceEntry.amount - (beforeSource?.amount ?? 0)) * 100),
  });
  setPartialWithTypedCommand(
    { incomeSources: next },
    {
      commandType: exists ? 'folio.income_schedule.update.v1' : 'folio.income_schedule.add.v1',
      // Upsert is a committed user action even when the candidate originated from inference.
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('income-schedule', sourceEntry.id)],
      before: { incomeSource: prev.find((source) => source.id === sourceEntry.id) ?? null },
      after: { incomeSource: sourceEntry },
      invalidatedProjectionKinds: ['income', 'calendar', 'cashflow', 'route'],
    },
  );
  completeMaterialWrite(capture);
}

/** Remove a source by id. No-op if the id is not present. */
export function removeIncomeSource(id: string) {
  const prev = state.incomeSources ?? DEFAULT_INCOME_SOURCES;
  const removed = prev.find((source) => source.id === id);
  const incomeSources = prev.filter((source) => source.id !== id);
  if (removed === undefined) {
    setPartial({ incomeSources });
    return;
  }
  const capture = beginMaterialWrite({
    type: 'income_change',
    sourceIds: [`fact_income_source_${id}`],
    idempotencyKey: `income_remove_${id}`,
    monetaryEffectMinor: -Math.round(removed.amount * 100),
  });
  setPartialWithTypedCommand(
    { incomeSources },
    {
      commandType: 'folio.income_schedule.remove.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('income-schedule', id)],
      before: { incomeSource: removed },
      after: { incomeSource: null },
      invalidatedProjectionKinds: ['income', 'calendar', 'cashflow', 'route'],
    },
  );
  completeMaterialWrite(capture);
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
  const dismissedIncomeSignals = [key, ...current];
  setPartialWithTypedCommand(
    { dismissedIncomeSignals },
    {
      commandType: 'folio.intelligence.income_signal.dismiss.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('income-signal', key)],
      before: { dismissedIncomeSignals: current },
      after: { dismissedIncomeSignals },
      invalidatedProjectionKinds: ['income-signals'],
    },
  );
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
  const dismissedBillSignals = [key, ...current];
  setPartialWithTypedCommand(
    { dismissedBillSignals },
    {
      commandType: 'folio.intelligence.bill_signal.dismiss.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('bill-signal', key)],
      before: { dismissedBillSignals: current },
      after: { dismissedBillSignals },
      invalidatedProjectionKinds: ['bill-signals'],
    },
  );
}

/* ---------- Drift signals (`lib/driftSignals.ts`) — DATA_INTELLIGENCE.md phase ⑥ ---------- */
/* ---------- + per-merchant re-propose COOLDOWN (task: "drift thrash" fix) ---------- */

/** Shared writer for both drift actions below — records (or refreshes) this merchant's cooldown
 *  entry with `at` = now, replacing any prior entry for the SAME merchant (never accumulating one row
 *  per re-trigger) so `findDriftCandidates`'s cooldown check always reads the MOST RECENT action. */
function recordDriftCooldown(merchant: string, action: 'dismiss' | 'confirm') {
  const key = normaliseIncomeSignalKey(merchant);
  const current = state.dismissedDriftSignals ?? [];
  const rest = current.filter((entry) => entry.merchant !== key);
  const dismissedDriftSignals = [{ merchant: key, at: new Date().toISOString() }, ...rest];
  setPartialWithTypedCommand(
    { dismissedDriftSignals },
    {
      commandType: `folio.intelligence.drift_signal.${action}.v1`,
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('drift-signal', key)],
      before: { dismissedDriftSignals: current },
      after: { dismissedDriftSignals },
      invalidatedProjectionKinds: ['drift-signals'],
    },
  );
}

/** Record a detected drift-signal merchant as DISMISSED (`DriftCaughtSheet`'s "Not this one", either
 *  flavour — income drift or bill drift share one list, see `AppState.dismissedDriftSignals`'s doc for
 *  why). Starts/refreshes this merchant's `DRIFT_COOLDOWN_DAYS` (45) re-propose cooldown — a future
 *  detection pass over the same merchant is suppressed until the cooldown lapses UNLESS the new
 *  deviation exceeds the cooldown's `DRIFT_COOLDOWN_BREAKTHROUGH_FRACTION` (30%) break-through, per
 *  `lib/caughtDrift.ts`'s `findDriftCandidates`. */
export function dismissDriftSignal(merchant: string) {
  recordDriftCooldown(merchant, 'dismiss');
}

/** Record a detected drift-signal merchant as CONFIRMED (`DriftCaughtSheet`'s "Yes, update it", either
 *  flavour). A confirmed drift is now the entity's honest current value — but the SAME merchant can
 *  still drift again later (a bill can rise twice), so this is a cooldown, not a permanent silence: it
 *  starts/refreshes the identical `DRIFT_COOLDOWN_DAYS` (45) window `dismissDriftSignal` does, quieting
 *  small re-detections of the number that was JUST corrected (classic thrash source — noisy pay ±10-14%
 *  re-triggering every landing) while still letting a genuinely new >30% deviation break through. */
export function confirmDriftSignal(merchant: string) {
  recordDriftCooldown(merchant, 'confirm');
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
  const dismissedAnnualSignals = [key, ...current];
  setPartialWithTypedCommand(
    { dismissedAnnualSignals },
    {
      commandType: 'folio.intelligence.annual_signal.dismiss.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('annual-signal', key)],
      before: { dismissedAnnualSignals: current },
      after: { dismissedAnnualSignals },
      invalidatedProjectionKinds: ['annual-signals'],
    },
  );
}

/* ---------- Merchant→category memory (`lib/merchantMemory.ts`) ---------- */

function setMerchantCategoriesWithTypedCommand(
  key: string,
  current: MerchantCategoryMap,
  merchantCategories: MerchantCategoryMap,
  action: 'remember' | 'forget',
): void {
  setPartialWithTypedCommand(
    { merchantCategories },
    {
      commandType: `folio.intelligence.merchant_category.${action}.v1`,
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('merchant-category', key)],
      before: { memory: current[key] ?? null },
      after: { memory: merchantCategories[key] ?? null },
      invalidatedProjectionKinds: ['merchant-memory', 'review-proposals'],
    },
  );
}

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
    setMerchantCategoriesWithTypedCommand(
      key,
      current,
      { ...current, [key]: nextEntry },
      'remember',
    );
    return;
  }

  const nextEntry = { category, correctedAt, hits: 1 };
  const entries = Object.entries(current);
  if (entries.length < MERCHANT_CATEGORY_CAP) {
    setMerchantCategoriesWithTypedCommand(
      key,
      current,
      { ...current, [key]: nextEntry },
      'remember',
    );
    return;
  }

  // At capacity and this is a new merchant — evict the least-recently-
  // corrected entry first to make room.
  const oldest = entries.reduce((a, b) => (a[1].correctedAt <= b[1].correctedAt ? a : b));
  const rest = { ...current };
  delete rest[oldest[0]];
  setMerchantCategoriesWithTypedCommand(key, current, { ...rest, [key]: nextEntry }, 'remember');
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
  setMerchantCategoriesWithTypedCommand(key, current, rest, 'forget');
}

/* ---------- Lens / Money Mode engine (ports folio-melo `lib/store.ts` 1:1) ---------- */

/** The user's declared Money Mode / Lens. See `lib/modes/types.ts`. */
export function setMoneyMode(mode: MoneyMode) {
  const previousMode = state.moneyMode ?? DEFAULT_MONEY_MODE;
  setPartialWithTypedCommand(
    { moneyMode: mode },
    {
      commandType: 'folio.financial_context.money_mode.set.v1',
      actorKind: 'user',
      entityRefs: [financialContextEntityRef()],
      before: { moneyMode: previousMode },
      after: { moneyMode: mode },
      invalidatedProjectionKinds: ['lens', 'cashflow', 'route'],
    },
  );
  if (previousMode !== mode && (previousMode === 'reset' || mode === 'reset')) {
    void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
      emitMeloReaction('companion-root', {
        mood: mode === 'reset' ? 'protect' : 'calm',
        pose: 'safe',
        line: mode === 'reset' ? 'Recovery mode is ready.' : 'Recovery mode is complete.',
        durationMs: 3_600,
        eventType: mode === 'reset' ? 'RECOVERY_ENTER' : 'RECOVERY_EXIT',
        eventPriority: 'high',
        eventIntensity: 'normal',
      });
    });
  }
}

/** User-declared safety buffer for Stability + other buffer-aware lenses. */
export function setBufferAmount(amount: number) {
  const bufferAmount = Math.max(0, Math.round(amount));
  setPartialWithTypedCommand(
    { bufferAmount },
    {
      commandType: 'folio.financial_context.buffer.set.v1',
      actorKind: 'user',
      entityRefs: [financialContextEntityRef()],
      before: { bufferAmount: state.bufferAmount ?? DEFAULT_BUFFER_AMOUNT },
      after: { bufferAmount },
      invalidatedProjectionKinds: ['cashflow', 'route'],
    },
  );
}

/** Record a mode's onboarding follow-up answer (£). Merged per mode — re-running onboarding with a
 *  different intent never wipes another mode's declaration. See `AppState.modeExtras`. */
export function setModeExtra(mode: MoneyMode, amount: number) {
  const current = state.modeExtras ?? {};
  const modeExtras = { ...current, [mode]: Math.max(0, Math.round(amount)) };
  setPartialWithTypedCommand(
    { modeExtras },
    {
      commandType: 'folio.financial_context.mode_extra.set.v1',
      actorKind: 'user',
      entityRefs: [financialContextEntityRef()],
      before: { modeExtras: current },
      after: { modeExtras },
      invalidatedProjectionKinds: ['lens', 'cashflow', 'route'],
    },
  );
}

/** @deprecated Compatibility bridge for obsolete Full receipts. A Full grant maps to Pro. */
export function setLensFullUnlocked(unlocked: boolean) {
  setLensProUnlocked(unlocked);
}

export function setLensPlusUnlocked(unlocked: boolean) {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  const next = { ...lens, plusUnlocked: unlocked || lens.proUnlocked };
  if (structurallyEqual(lens, next)) return;
  setPartialWithTypedCommand(
    { lens: next },
    {
      commandType: 'folio.companion.entitlement.reconcile.v1',
      actorKind: 'system',
      entityRefs: [workspaceCollectionEntityRef('companion-runtime')],
      before: { lens },
      after: { lens: next },
      invalidatedProjectionKinds: ['entitlements', 'lens', 'companion'],
    },
  );
}

export function setLensProUnlocked(unlocked: boolean) {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  const next = {
    ...lens,
    proUnlocked: unlocked,
    plusUnlocked: unlocked ? true : lens.plusUnlocked,
  };
  if (structurallyEqual(lens, next)) return;
  setPartialWithTypedCommand(
    { lens: next },
    {
      commandType: 'folio.companion.entitlement.reconcile.v1',
      actorKind: 'system',
      entityRefs: [workspaceCollectionEntityRef('companion-runtime')],
      before: { lens },
      after: { lens: next },
      invalidatedProjectionKinds: ['entitlements', 'lens', 'companion'],
    },
  );
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
  const next = {
    ...lens,
    trialCycleId: cycleId,
    trialEndedCycleId: null,
    trialEndAcknowledged: true,
  };
  setPartialWithTypedCommand(
    { lens: next },
    {
      commandType: 'folio.companion.lens_trial.start.v1',
      actorKind: 'user',
      entityRefs: [workspaceCollectionEntityRef('companion-runtime')],
      before: { lens },
      after: { lens: next },
      invalidatedProjectionKinds: ['entitlements', 'lens', 'companion'],
    },
  );
}

/** End the active trial at explicit payday-cycle close. Moves the anchor into `trialEndedCycleId`
 *  and clears the ack flag so Today's one-time "trial ended" prompt can actually fire — leaving
 *  `trialEndedCycleId` unset would relock silently AND make `canOfferTrial` true, i.e. an
 *  infinitely restartable trial. No-op when no trial is active. */
export function endLensTrial() {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  if (lens.trialCycleId === null) return;
  const next = {
    ...lens,
    trialCycleId: null,
    trialEndedCycleId: lens.trialCycleId,
    trialEndAcknowledged: false,
  };
  setPartialWithTypedCommand(
    { lens: next },
    {
      commandType: 'folio.companion.lens_trial.end.v1',
      actorKind: 'system',
      entityRefs: [workspaceCollectionEntityRef('companion-runtime')],
      before: { lens },
      after: { lens: next },
      invalidatedProjectionKinds: ['entitlements', 'lens', 'companion'],
    },
  );
}

/** User has seen the "trial ended" prompt on Today — don't show it again. */
export function acknowledgeTrialEnd() {
  const lens: LensState = state.lens ?? DEFAULT_LENS;
  if (lens.trialEndAcknowledged) return;
  const next = { ...lens, trialEndAcknowledged: true };
  setPartialWithTypedCommand(
    { lens: next },
    {
      commandType: 'folio.companion.lens_trial.acknowledge_end.v1',
      actorKind: 'user',
      entityRefs: [workspaceCollectionEntityRef('companion-runtime')],
      before: { lens },
      after: { lens: next },
      invalidatedProjectionKinds: ['lens', 'companion'],
    },
  );
}

/* ---------- Melo companion settings (`MeloScreen`) ---------- */

/** Patch the Melo companion settings (quiet mode / wardrobe / global tone). Immutable —
 *  merges onto the current `melo` slice (or the default if absent). */
export function setMelo(patch: Partial<MeloState>) {
  const melo: MeloState = state.melo ?? DEFAULT_MELO;
  const next = {
    ...melo,
    ...patch,
    ...(patch.wardrobe
      ? { wardrobe: patch.wardrobe.filter((item) => item.length > 0).slice(0, 1) }
      : {}),
  };
  if (structurallyEqual(melo, next)) return;
  const active = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
  const now = new Date();
  const stage =
    active?.kind === 'business'
      ? transitionPhoenixStage(
          state.stage,
          deriveBusinessStage(
            businessMeloSignals(
              normaliseBusinessOperationsState(state.business),
              state.streak,
              next.quietMode,
              now,
            ).stageInput,
          ).stage,
          now.toISOString(),
        )
      : state.stage;
  setPartialWithTypedCommand(
    { melo: next, stage },
    {
      commandType: 'folio.companion.preferences.update.v1',
      actorKind: 'user',
      entityRefs: [workspaceCollectionEntityRef('companion-runtime')],
      before: { melo, stage: state.stage },
      after: { melo: next, stage },
      invalidatedProjectionKinds: ['companion'],
    },
  );
}

export function setChartStyle(chartStyle: ChartStyle) {
  if (state.chartStyle === chartStyle) return;
  setPartialWithTypedCommand(
    { chartStyle },
    {
      commandType: 'folio.companion.preferences.update.v1',
      actorKind: 'user',
      entityRefs: [workspaceCollectionEntityRef('companion-runtime')],
      before: { chartStyle: state.chartStyle ?? 'curve' },
      after: { chartStyle },
      invalidatedProjectionKinds: ['companion'],
    },
  );
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
    ...(d.linkedAccountId !== undefined ? { linkedAccountId: d.linkedAccountId } : {}),
  };
  const capture = beginMaterialWrite({
    type: 'debt_payment',
    sourceIds: [`fact_debt_${full.id}`],
    idempotencyKey: `debt_add_${full.id}`,
    monetaryEffectMinor: -Math.round(full.balance * 100),
  });
  setPartialWithTypedCommand(
    { debts: [...(state.debts ?? []), full] },
    {
      commandType: 'folio.debt.add.v1',
      actorKind: 'user',
      entityRefs: [
        { type: 'debt', id: full.id },
        ...(full.linkedAccountId === undefined
          ? []
          : [{ type: 'account', id: full.linkedAccountId }]),
      ],
      before: {},
      after: { debt: full },
      invalidatedProjectionKinds: ['debt-summary', 'cashflow'],
      occurredAt: full.addedAt,
    },
  );
  completeMaterialWrite(capture);
  return full;
}

export function removeDebt(id: string) {
  const target = (state.debts ?? []).find((debt) => debt.id === id);
  if (target === undefined) return;
  const capture = beginMaterialWrite({
    type: 'debt_payment',
    sourceIds: [`fact_debt_${id}`],
    idempotencyKey: `debt_remove_${id}`,
    monetaryEffectMinor: Math.round(target.balance * 100),
  });
  setPartialWithTypedCommand(
    { debts: (state.debts ?? []).filter((debt) => debt.id !== id) },
    {
      commandType: 'folio.debt.remove.v1',
      actorKind: 'user',
      entityRefs: [
        { type: 'debt', id },
        ...(target.linkedAccountId === undefined
          ? []
          : [{ type: 'account', id: target.linkedAccountId }]),
      ],
      before: { debt: target },
      after: {},
      invalidatedProjectionKinds: ['debt-summary', 'cashflow'],
    },
  );
  completeMaterialWrite(capture);
}

/** Log a payment against a debt — decrements the balance, never below £0. A card-linked Debt
 *  mirrors an Account (see `Debt.linkedAccountId`'s doc) — a payment must land on BOTH in one
 *  write, or the next `syncCardDebt` (statement import) erases it. */
export function logDebtPayment(id: string, amount: number) {
  if (!(amount > 0)) return;
  const target = (state.debts ?? []).find((d) => d.id === id);
  if (target === undefined) return;
  const changedAtForCapture = new Date().toISOString();
  const capture = beginMaterialWrite({
    type: 'debt_payment',
    sourceIds: [`fact_debt_${id}`],
    idempotencyKey: `debt_payment_${id}_${changedAtForCapture}`,
    monetaryEffectMinor: Math.round(amount * 100),
    occurredAt: changedAtForCapture,
  });
  const nextDebts = (state.debts ?? []).map((d) =>
    d.id === id ? { ...d, balance: Math.max(0, d.balance - amount) } : d,
  );
  const linkedId = target.linkedAccountId;
  if (linkedId !== undefined) {
    const linkedAccount = (state.accounts ?? []).find((account) => account.id === linkedId);
    const changedAt = new Date().toISOString();
    const accounts = (state.accounts ?? []).map((a) =>
      a.id === linkedId
        ? {
            ...a,
            balanceMinor: Math.max(0, a.balanceMinor - amount),
            balanceAsOfISO: changedAt,
          }
        : a,
    );
    setPartialWithTypedCommand(
      { debts: nextDebts, accounts },
      {
        commandType: 'folio.debt.payment.record.v1',
        actorKind: 'user',
        entityRefs: [
          { type: 'debt', id },
          ...(linkedAccount === undefined ? [] : [{ type: 'account', id: linkedId }]),
        ],
        before: {
          debt: target,
          ...(linkedAccount === undefined ? {} : { account: linkedAccount }),
        },
        after: {
          debt: nextDebts.find((debt) => debt.id === id),
          ...(linkedAccount === undefined
            ? {}
            : { account: accounts.find((account) => account.id === linkedId) }),
        },
        invalidatedProjectionKinds: ['account-balances', 'debt-summary', 'cashflow'],
        occurredAt: changedAt,
      },
    );
    completeMaterialWrite(capture);
    emitDebtPaymentCompanionReaction(
      target.balance,
      nextDebts.find((debt) => debt.id === id)?.balance,
    );
    return;
  }
  setPartialWithTypedCommand(
    { debts: nextDebts },
    {
      commandType: 'folio.debt.payment.record.v1',
      actorKind: 'user',
      entityRefs: [{ type: 'debt', id }],
      before: { debt: target },
      after: { debt: nextDebts.find((debt) => debt.id === id) },
      invalidatedProjectionKinds: ['debt-summary', 'cashflow'],
    },
  );
  completeMaterialWrite(capture);
  emitDebtPaymentCompanionReaction(
    target.balance,
    nextDebts.find((debt) => debt.id === id)?.balance,
  );
}

function emitDebtPaymentCompanionReaction(before: number, after: number | undefined): void {
  if (!(before > 0) || after !== 0) return;
  void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
    emitMeloReaction('companion-root', {
      mood: 'celebrate',
      pose: 'sealed',
      line: 'That debt is cleared.',
      durationMs: 4_200,
      eventType: 'DEBT_CLEARED',
      eventPriority: 'high',
      eventIntensity: 'major',
    });
  });
}

/** Reverses a logged payment — increments the balance back by `amount`. Used by LogPaymentSheet's
 *  Tier-1 undo window (useUndo/showUndo) so tapping Undo restores exactly what was paid, mirroring
 *  the pattern EditTxnSheet uses for its own undo snapshot-restore. Mirrors `logDebtPayment`'s
 *  linked-account sync so an undo restores BOTH sides. */
export function undoDebtPayment(id: string, amount: number) {
  if (!(amount > 0)) return;
  const target = (state.debts ?? []).find((d) => d.id === id);
  if (target === undefined) return;
  const changedAtForCapture = new Date().toISOString();
  const capture = beginMaterialWrite({
    type: 'debt_payment',
    sourceIds: [`fact_debt_${id}`],
    idempotencyKey: `debt_payment_reverse_${id}_${changedAtForCapture}`,
    monetaryEffectMinor: -Math.round(amount * 100),
    occurredAt: changedAtForCapture,
  });
  const nextDebts = (state.debts ?? []).map((d) =>
    d.id === id ? { ...d, balance: d.balance + amount } : d,
  );
  const linkedId = target.linkedAccountId;
  if (linkedId !== undefined) {
    const linkedAccount = (state.accounts ?? []).find((account) => account.id === linkedId);
    const changedAt = new Date().toISOString();
    const accounts = (state.accounts ?? []).map((a) =>
      a.id === linkedId
        ? { ...a, balanceMinor: a.balanceMinor + amount, balanceAsOfISO: changedAt }
        : a,
    );
    setPartialWithTypedCommand(
      { debts: nextDebts, accounts },
      {
        commandType: 'folio.debt.payment.reverse.v1',
        actorKind: 'user',
        entityRefs: [
          { type: 'debt', id },
          ...(linkedAccount === undefined ? [] : [{ type: 'account', id: linkedId }]),
        ],
        before: {
          debt: target,
          ...(linkedAccount === undefined ? {} : { account: linkedAccount }),
        },
        after: {
          debt: nextDebts.find((debt) => debt.id === id),
          ...(linkedAccount === undefined
            ? {}
            : { account: accounts.find((account) => account.id === linkedId) }),
        },
        invalidatedProjectionKinds: ['account-balances', 'debt-summary', 'cashflow'],
        occurredAt: changedAt,
      },
    );
    completeMaterialWrite(capture);
    return;
  }
  setPartialWithTypedCommand(
    { debts: nextDebts },
    {
      commandType: 'folio.debt.payment.reverse.v1',
      actorKind: 'user',
      entityRefs: [{ type: 'debt', id }],
      before: { debt: target },
      after: { debt: nextDebts.find((debt) => debt.id === id) },
      invalidatedProjectionKinds: ['debt-summary', 'cashflow'],
    },
  );
  completeMaterialWrite(capture);
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
  const capture = beginMaterialWrite({
    type: 'debt_payment',
    sourceIds: [`fact_debt_account_${cardAccountId}`, 'fact_current_balance'],
    idempotencyKey: `credit_card_payment_${bankAccountId}_${cardAccountId}_${now}`,
    monetaryEffectMinor: -Math.round(amount * 100),
    occurredAt: now,
  });
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
  setPartialWithTypedCommand(
    {
      accounts: nextAccounts,
      debts,
      currentBalance: {
        amount: bankTotal,
        source: 'corrected',
        confidence: 'corrected',
        setAt: now,
      },
    },
    {
      commandType: 'folio.credit_card.payment.record.v1',
      actorKind: 'user',
      entityRefs: [
        { type: 'account', id: bankAccountId },
        { type: 'account', id: cardAccountId },
        ...(debts.some((debt) => debt.id === linkedId) ? [{ type: 'debt', id: linkedId }] : []),
      ],
      before: {
        bankAccount: bank,
        cardAccount: card,
        debt: (state.debts ?? []).find((debt) => debt.id === linkedId) ?? null,
      },
      after: {
        bankAccount: nextAccounts.find((account) => account.id === bankAccountId),
        cardAccount: nextAccounts.find((account) => account.id === cardAccountId),
        debt: debts.find((debt) => debt.id === linkedId) ?? null,
      },
      invalidatedProjectionKinds: ['account-balances', 'debt-summary', 'cashflow'],
      occurredAt: now,
    },
  );
  completeMaterialWrite(capture);
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
  setPartialWithTypedCommand(
    { plans: [...(state.plans ?? []), full] },
    {
      commandType: 'folio.plan.add.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('plan', full.id)],
      before: {},
      after: { plan: full },
      invalidatedProjectionKinds: ['plans', 'calendar', 'cashflow', 'route'],
      occurredAt: full.addedAt,
    },
  );
  return full;
}

export function removePlan(id: string) {
  const before = (state.plans ?? []).find((plan) => plan.id === id);
  const plans = (state.plans ?? []).filter((plan) => plan.id !== id);
  if (before === undefined) {
    setPartial({ plans });
    return;
  }
  setPartialWithTypedCommand(
    { plans },
    {
      commandType: 'folio.plan.remove.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('plan', id)],
      before: { plan: before },
      after: { plan: null },
      invalidatedProjectionKinds: ['plans', 'calendar', 'cashflow', 'route'],
    },
  );
}

export function addToPlan(id: string, amount: number) {
  if (!(amount > 0)) return;
  const before = (state.plans ?? []).find((plan) => plan.id === id);
  if (before === undefined) return;
  const plans = (state.plans ?? []).map((plan) =>
    plan.id === id ? { ...plan, saved: plan.saved + amount } : plan,
  );
  setPartialWithTypedCommand(
    { plans },
    {
      commandType: 'folio.plan.contribution.record.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('plan', id)],
      before: { plan: before },
      after: { plan: plans.find((plan) => plan.id === id) },
      invalidatedProjectionKinds: ['plans', 'cashflow', 'route'],
    },
  );
}

/* ---------- Household (Household lens) ---------- */

export function setHousehold(patch: Partial<Household>) {
  const household = state.household ?? DEFAULT_HOUSEHOLD;
  const nextHousehold = { ...household, ...patch };
  setPartialWithTypedCommand(
    { household: nextHousehold },
    {
      commandType: 'folio.financial_context.household.set.v1',
      actorKind: 'user',
      entityRefs: [financialContextEntityRef()],
      before: { household },
      after: { household: nextHousehold },
      invalidatedProjectionKinds: ['household', 'cashflow'],
    },
  );
}

export function setSubShareOverride(subName: string, share: number) {
  const household = state.household ?? DEFAULT_HOUSEHOLD;
  const nextHousehold = {
    ...household,
    subShareOverrides: {
      ...household.subShareOverrides,
      [subName]: Math.max(0, Math.min(1, share)),
    },
  };
  setPartialWithTypedCommand(
    { household: nextHousehold },
    {
      commandType: 'folio.financial_context.household_subscription_share.set.v1',
      actorKind: 'user',
      entityRefs: [financialContextEntityRef()],
      before: { household },
      after: { household: nextHousehold },
      invalidatedProjectionKinds: ['household', 'cashflow'],
    },
  );
}

export function removeSubShareOverride(subName: string) {
  const household = state.household ?? DEFAULT_HOUSEHOLD;
  const { [subName]: _gone, ...rest } = household.subShareOverrides;
  const nextHousehold = { ...household, subShareOverrides: rest };
  setPartialWithTypedCommand(
    { household: nextHousehold },
    {
      commandType: 'folio.financial_context.household_subscription_share.remove.v1',
      actorKind: 'user',
      entityRefs: [financialContextEntityRef()],
      before: { household },
      after: { household: nextHousehold },
      invalidatedProjectionKinds: ['household', 'cashflow'],
    },
  );
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

function requireSourceEvidence(sourceEvidenceId: string | undefined): EvidenceDocument | undefined {
  if (sourceEvidenceId === undefined) return undefined;
  const document = (state.evidenceDocuments ?? []).find(
    (candidate) =>
      candidate.id === sourceEvidenceId && candidate.workspaceId === state.activeWorkspaceId,
  );
  if (document === undefined) {
    throw new Error(`Evidence document ${sourceEvidenceId} is unavailable in this workspace.`);
  }
  return document;
}

export function addTransaction(
  t: Omit<Transaction, 'id' | 'when'> & { id?: string; when?: string },
): Transaction {
  requireSourceEvidence(t.sourceEvidenceId);
  const full: Transaction = {
    id: t.id ?? `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    when: t.when ?? new Date().toISOString(),
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    source: t.source,
    ...(t.sourceEvidenceId !== undefined ? { sourceEvidenceId: t.sourceEvidenceId } : {}),
    ...(t.accountId !== undefined ? { accountId: t.accountId } : {}),
    ...(t.externalId !== undefined ? { externalId: t.externalId } : {}),
    ...(t.bankConnectionId !== undefined ? { bankConnectionId: t.bankConnectionId } : {}),
  };
  const capture = beginMaterialWrite({
    type: full.category === 'income' || full.amount > 0 ? 'income_change' : 'new_transaction',
    sourceIds: transactionSourceIds(full),
    truth: transactionTruth(full),
    idempotencyKey: `transaction_add_${full.id}`,
    monetaryEffectMinor: Math.round(full.amount * 100),
    occurredAt: full.when,
  });
  const { transactions, droppedTransactionCount } = applyTransactionRetention(
    [full, ...state.transactions],
    state.droppedTransactionCount ?? 0,
  );
  setPartialWithTypedCommand(
    { transactions, droppedTransactionCount },
    {
      commandType: 'folio.transaction.record.v1',
      actorKind: transactionActorKind([full]),
      entityRefs: [{ type: 'transaction', id: full.id }],
      before: {},
      after: { transaction: full },
      changedEntityIds: [full.id],
      invalidatedProjectionKinds: ['transactions', 'cashflow', 'merchant-memory'],
      occurredAt: full.when,
    },
  );
  completeMaterialWrite(capture);
  return full;
}

export type WorkspaceOwnerTransferLeg = Readonly<{
  transferId: string;
  label: string;
  amount: number;
  direction: 'in' | 'out';
  when: string;
}>;

/**
 * Record one side of an owner transfer in the currently loaded encrypted partition.
 *
 * Transaction and account balance change publish together, so a screen never observes a ledger
 * entry without the matching cash movement. The persistence orchestrator writes the two workspace
 * legs and restores the original workspace before returning.
 */
export function recordWorkspaceOwnerTransferLeg(
  input: WorkspaceOwnerTransferLeg,
): Readonly<{ transactionId: string; accountId: string }> {
  if (!input.transferId.trim() || !input.label.trim() || !(input.amount > 0)) {
    throw new Error('Owner transfer leg requires an id, label and positive amount.');
  }
  if (!Number.isFinite(Date.parse(input.when))) {
    throw new Error('Owner transfer leg requires a valid time.');
  }
  const account = (state.accounts ?? []).find(
    (candidate) => !candidate.isLiability && candidate.closed !== true,
  );
  if (!account)
    throw new Error('Add an active cash account before moving money between workspaces.');
  const delta = input.direction === 'in' ? input.amount : -input.amount;
  if (account.balanceMinor + delta < 0) {
    throw new Error('The selected workspace account does not hold enough cash for this move.');
  }
  const transaction: Transaction = {
    id: `${input.transferId}:${input.direction}`,
    workspaceId: state.activeWorkspaceId,
    when: input.when,
    merchant: input.label,
    amount: delta,
    category: 'other',
    source: 'manual',
    accountId: account.id,
    externalId: input.transferId,
  };
  const { transactions, droppedTransactionCount } = applyTransactionRetention(
    [transaction, ...state.transactions.filter((row) => row.id !== transaction.id)],
    state.droppedTransactionCount ?? 0,
  );
  const accounts = (state.accounts ?? []).map((candidate) =>
    candidate.id === account.id
      ? {
          ...candidate,
          balanceMinor: candidate.balanceMinor + delta,
          balanceAsOfISO: input.when,
        }
      : candidate,
  );
  const bankTotal = accounts
    .filter((candidate) => !candidate.isLiability && candidate.closed !== true)
    .reduce((sum, candidate) => sum + candidate.balanceMinor, 0);
  const currentBalance: CurrentBalance = {
    ...state.currentBalance,
    amount: bankTotal,
    source: 'user-entered',
    confidence: 'corrected',
    setAt: input.when,
  };
  setPartialWithTypedCommand(
    { accounts, currentBalance, transactions, droppedTransactionCount },
    {
      commandType: 'folio.workspace.owner_transfer_leg.record.v1',
      actorKind: 'user',
      entityRefs: [
        { type: 'transaction', id: transaction.id },
        { type: 'account', id: account.id },
      ],
      before: { account },
      after: {
        account: accounts.find((candidate) => candidate.id === account.id),
        transaction,
      },
      changedEntityIds: [transaction.id, account.id],
      invalidatedProjectionKinds: ['transactions', 'account-balances', 'cashflow'],
      occurredAt: input.when,
    },
  );
  return { transactionId: transaction.id, accountId: account.id };
}

/** Compensating rollback used only when the second encrypted workspace leg cannot be committed. */
export function rollbackWorkspaceOwnerTransferLeg(transactionId: string): boolean {
  const transaction = state.transactions.find((row) => row.id === transactionId);
  if (!transaction || !transaction.accountId) return false;
  const account = (state.accounts ?? []).find(
    (candidate) => candidate.id === transaction.accountId,
  );
  if (!account) return false;
  const accounts = (state.accounts ?? []).map((candidate) =>
    candidate.id === account.id
      ? {
          ...candidate,
          balanceMinor: candidate.balanceMinor - transaction.amount,
          balanceAsOfISO: new Date().toISOString(),
        }
      : candidate,
  );
  const currentBalance: CurrentBalance = {
    ...state.currentBalance,
    amount: accounts
      .filter((candidate) => !candidate.isLiability && candidate.closed !== true)
      .reduce((sum, candidate) => sum + candidate.balanceMinor, 0),
    source: 'user-entered',
    confidence: 'corrected',
    setAt: new Date().toISOString(),
  };
  setPartialWithTypedCommand(
    {
      accounts,
      currentBalance,
      transactions: state.transactions.filter((row) => row.id !== transactionId),
    },
    {
      commandType: 'folio.workspace.owner_transfer_leg.rollback.v1',
      actorKind: 'system',
      entityRefs: [
        { type: 'transaction', id: transaction.id },
        { type: 'account', id: account.id },
      ],
      before: { account, transaction },
      after: { account: accounts.find((candidate) => candidate.id === account.id) },
      changedEntityIds: [transaction.id, account.id],
      invalidatedProjectionKinds: ['transactions', 'account-balances', 'cashflow'],
    },
  );
  return true;
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
  for (const row of rows) requireSourceEvidence(row.sourceEvidenceId);
  const fullRows: Transaction[] = rows.map((t, i) => ({
    id: t.id ?? `txn-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    when: t.when ?? new Date().toISOString(),
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    source: t.source,
    ...(t.sourceEvidenceId !== undefined ? { sourceEvidenceId: t.sourceEvidenceId } : {}),
    ...(t.accountId !== undefined ? { accountId: t.accountId } : {}),
    ...(t.externalId !== undefined ? { externalId: t.externalId } : {}),
    ...(t.bankConnectionId !== undefined ? { bankConnectionId: t.bankConnectionId } : {}),
  }));
  const capture = beginMaterialWrite({
    type: 'reviewed_statement',
    sourceIds: fullRows.flatMap(transactionSourceIds),
    truth: fullRows.some((row) => row.sourceEvidenceId !== undefined)
      ? 'observed'
      : 'user_confirmed',
    idempotencyKey: `transactions_batch_${fnv1a32Hex(
      fullRows.map((row) => row.id).join('|'),
      0x01000193,
    )}`,
    monetaryEffectMinor: Math.round(fullRows.reduce((sum, row) => sum + row.amount, 0) * 100),
    occurredAt: new Date().toISOString(),
  });
  const { transactions, droppedTransactionCount } = applyTransactionRetention(
    [...fullRows].reverse().concat(state.transactions),
    state.droppedTransactionCount ?? 0,
  );
  setPartialWithTypedCommand(
    { transactions, droppedTransactionCount },
    {
      commandType: 'folio.transactions.record_batch.v1',
      actorKind: transactionActorKind(fullRows),
      entityRefs: fullRows.map((transaction) => ({
        type: 'transaction',
        id: transaction.id,
      })),
      before: {},
      after: { transactions: fullRows },
      changedEntityIds: fullRows.map((transaction) => transaction.id),
      invalidatedProjectionKinds: ['transactions', 'cashflow', 'merchant-memory'],
      occurredAt: new Date().toISOString(),
    },
  );
  completeMaterialWrite(capture);
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
export function syncHistoryCycles(now: Date = new Date()): void {
  const todayIso = currentFinancialDate(now);
  const nextCycles = synthesizeHistoryCycles(
    state.transactions,
    state.incomeSources ?? DEFAULT_INCOME_SOURCES,
    state.cycles,
    todayIso,
  );
  if (structurallyEqual(state.cycles, nextCycles)) return;
  const cycleRefs = uniqueOpaqueContainerEntityRefs(
    'cycle',
    [...state.cycles, ...nextCycles].map(
      (cycle) => `${cycle.closedAt}\u001f${cycle.label}\u001f${cycle.reconstructed === true}`,
    ),
  );
  setPartialWithTypedCommand(
    { cycles: nextCycles },
    {
      commandType: 'folio.cycles.reconstruct.v1',
      actorKind: 'system',
      entityRefs: cycleRefs,
      before: { cycles: state.cycles },
      after: { cycles: nextCycles },
      invalidatedProjectionKinds: ['cycles', 'insights', 'cashflow'],
    },
  );
}

export function removeTransaction(id: string) {
  const target = state.transactions.find((transaction) => transaction.id === id);
  if (target === undefined) return;
  const capture = beginMaterialWrite({
    type: target.category === 'income' || target.amount > 0 ? 'income_change' : 'new_transaction',
    sourceIds: transactionSourceIds(target),
    truth: 'user_confirmed',
    idempotencyKey: `transaction_remove_${id}`,
    monetaryEffectMinor: -Math.round(target.amount * 100),
  });
  setPartialWithTypedCommand(
    {
      transactions: state.transactions.filter((transaction) => transaction.id !== id),
      evidenceDocuments: (state.evidenceDocuments ?? []).map((document) => {
        if (!(document.linkedTransactionIds ?? []).includes(id)) return document;
        const linkedTransactionIds = (document.linkedTransactionIds ?? []).filter(
          (candidate) => candidate !== id,
        );
        if (linkedTransactionIds.length > 0) return { ...document, linkedTransactionIds };
        const { linkedTransactionIds: _removed, ...rest } = document;
        return rest;
      }),
    },
    {
      commandType: 'folio.transaction.remove.v1',
      actorKind: 'user',
      entityRefs: [{ type: 'transaction', id }],
      before: { transaction: target },
      after: {},
      changedEntityIds: [id],
      invalidatedProjectionKinds: ['transactions', 'cashflow', 'merchant-memory'],
    },
  );
  completeMaterialWrite(capture);
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
  /** How many candidates handed to THIS call were already present by deterministic source-row
   *  identity. `importedTransactionId` hashes candidate source + candidate ID + normalized facts;
   *  natural-key similarity alone never increments this count or removes a row. Surfaced so the
   *  landing summary can
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

/** Short deterministic non-cryptographic hash used only for stable local import IDs. Every batch is
 * collision-checked before state mutation; this is not a security primitive. */
function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Stable transaction ID for one imported source row. Candidate source + deterministic row ID are
 * authoritative; normalized facts protect against accidental cross-parser ID reuse. Two real rows
 * with the same date/amount/merchant keep distinct IDs when their candidate IDs differ. */
function importedTransactionId(candidate: CandidateMoneyItem): string {
  const identity = `${candidate.source}\u0000${candidate.id}\u0000${dedupeKey(candidate)}`;
  return `imp-${stableHash(identity)}-${stableHash(`melo-import-row\u0000${identity}`)}`;
}

/** Bulk-land a whole statement's candidates as history in ONE user-confirmed action (task: BULK
 *  ADD-AS-HISTORY — the core of the "one confirm populates everything" flow). Composes, in order:
 *
 *   1. RE-IMPORT DEDUP (task: statement re-import correctness) — drop any candidate whose stable
 *      import ID (source + deterministic candidate row ID + normalized facts) already matches an
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
 *      Natural-key similarity is never deletion authority, so two identical £3.50 source rows with
 *      distinct candidate IDs both remain visible and may both land after confirmation.
 *   2. Map every SURVIVING candidate to a transaction draft (`candidateToTransactionDraft` — signed
 *      amount verbatim, kind-correct category INCLUDING income; see that module's doc for why this
 *      can never coerce an income row onto a spend bucket), stamping a STABLE `imp-`-prefixed id
 *      (`importedTransactionId`) derived from the same identity — defense in depth alongside the dedup
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

  const identifiedCandidates = candidates.map((candidate) => ({
    candidate,
    transactionId: importedTransactionId(candidate),
  }));
  const batchTransactionIds = new Set<string>();
  for (const identified of identifiedCandidates) {
    if (batchTransactionIds.has(identified.transactionId)) {
      throw new Error('Imported candidate ID collision; no transactions were added.');
    }
    batchTransactionIds.add(identified.transactionId);
  }

  // Demo→real transition (belt for any path that bypassed onboarding's wipe): an
  // import IS real data, so clear any lingering demo/seed set first — the
  // imported rows must never mix with seed rows in the same session. No-op once
  // the user is already real (`isRealUser`), so a normal re-import is untouched.
  if (!isRealUser(getState())) {
    setPartial(stripSeedData(getState()));
  }

  // Step 1 — drop candidates already present by stable source-row identity. Normalized facts remain
  // part of the generated ID as a cross-parser guard, but matching date/amount/merchant alone never
  // removes a candidate. `existingImportIds` is computed once from the current persisted ledger;
  // manual `txn-...` IDs cannot collide with the `imp-` namespace.
  const existingImportIds = new Set(
    getState()
      .transactions.map((t) => t.id)
      .filter((id) => id.startsWith('imp-')),
  );
  const newCandidateRows = identifiedCandidates.filter(
    ({ transactionId }) => !existingImportIds.has(transactionId),
  );
  const newCandidates = newCandidateRows.map(({ candidate }) => candidate);
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
    newCandidateRows.map(({ candidate, transactionId }) => ({
      ...candidateToTransactionDraft(candidate, accountId),
      id: transactionId,
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
  void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
    emitMeloReaction('companion-root', {
      mood: 'cheer',
      pose: 'safe',
      line: 'Statement imported.',
      durationMs: 3_200,
      eventType: 'STATEMENT_IMPORTED',
      eventPriority: 'normal',
      eventIntensity: 'small',
    });
  });
  return result;
}

/** @rn-engine timeline-verbs — build the timeline side effect that `togglePaused` and
 * `addIgnoredReviewSig` commit atomically with their underlying typed command. */
function createTimelineEvent(
  kind: TimelineEventKind,
  subject: string,
  note?: string,
): TimelineEvent {
  return {
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    kind,
    subject,
    ...(note !== undefined ? { note } : {}),
  };
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
 *  yet. Newest first, capped at `STATEMENT_IMPORT_CAP` (200), mirroring `timelineEvents`' own
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
  const evidence = first.sourceEvidenceId
    ? (state.evidenceDocuments ?? []).find((document) => document.id === first.sourceEvidenceId)
    : undefined;
  const entry: StatementImportRecord = {
    id: `imp-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source: toStatementImportSource(first.source),
    rowCount: newCandidates.length,
    atISO: new Date().toISOString(),
    accountId: accountId ?? DEFAULT_ACCOUNT_ID,
    ...(evidence !== undefined ? { filename: evidence.filename } : {}),
    ...(first.sourceEvidenceId !== undefined ? { sourceEvidenceId: first.sourceEvidenceId } : {}),
  };
  const existing = state.statementImports ?? [];
  const statementImports = [entry, ...existing].slice(0, STATEMENT_IMPORT_CAP);
  setPartialWithTypedCommand(
    { statementImports },
    {
      commandType: 'folio.intelligence.statement_import.record.v1',
      actorKind: 'import',
      entityRefs: [opaqueContainerEntityRef('statement-import', entry.id)],
      before: { statementImports: existing },
      after: { statementImports },
      invalidatedProjectionKinds: ['statement-imports', 'evidence'],
    },
  );
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
  const sourceIds = transactionSourceIds(target);
  const capture = beginMaterialWrite({
    type: 'user_correction',
    sourceIds,
    truth: by === 'melo' ? 'inferred' : 'user_confirmed',
    idempotencyKey: `transaction_edit_${txnId}_${at}`,
    monetaryEffectMinor:
      typeof patch.amount === 'number' ? Math.round((patch.amount - target.amount) * 100) : null,
    occurredAt: at,
  });
  setPartialWithTypedCommand(
    {
      transactions: state.transactions.map((t) => (t.id === txnId ? edited : t)),
      edits: [...(state.edits ?? []), ...edits],
    },
    {
      commandType: 'folio.transaction.correct.v1',
      actorKind: by === 'melo' ? 'melo' : 'user',
      entityRefs: [
        { type: 'transaction', id: txnId },
        ...edits.flatMap((edit) => (edit.id === undefined ? [] : [{ type: 'edit', id: edit.id }])),
      ],
      before: { transaction: target },
      after: { transaction: edited },
      changedEntityIds: [
        txnId,
        ...edits.flatMap((edit) => (edit.id === undefined ? [] : [edit.id])),
      ],
      invalidatedProjectionKinds: ['transactions', 'cashflow', 'merchant-memory'],
      occurredAt: at,
    },
  );
  const change = completeMaterialWrite(capture);
  const after = safeRangeSnapshotForState(state, at);
  for (const edit of edits) {
    const affectedDecisionIds =
      change?.affectedDecisionIds ??
      getDecisionLedgerEntries()
        .filter((entry) => decisionUsesAnySource(entry, sourceIds, capture?.before, after))
        .map((entry) => entry.id);
    recordCorrectionImpact({
      id: `correction_impact_${fnv1a32Hex(`${txnId}:${edit.field}:${at}`, 0x811c9dc5)}`,
      workspaceId: state.activeWorkspaceId,
      correctedAt: trustedCoreInstant(at),
      correctedBy: by,
      subject: { kind: 'transaction', id: txnId },
      field: edit.field,
      original: edit.before ?? null,
      corrected: edit.after ?? null,
      sourceIds,
      ...(capture?.before === undefined ? {} : { before: capture.before }),
      ...(after === undefined ? {} : { after }),
      materialChangeId: change?.id ?? null,
      affectedDecisionIds,
      contradictionState:
        capture?.before?.status === 'contradicted' && after?.status !== 'contradicted'
          ? 'resolved'
          : capture?.before?.status !== 'contradicted' && after?.status === 'contradicted'
            ? 'introduced'
            : after?.status === 'contradicted'
              ? 'still_present'
              : 'none',
      futureBehaviour: 'ask_before_reusing',
      reversedByCorrectionId: null,
    });
  }
}

export function addCalendarEvent(e: Omit<CalendarEvent, 'id'> & { id?: string }): CalendarEvent {
  const full: CalendarEvent = {
    id: e.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: e.date,
    kind: e.kind,
    title: e.title,
    // exactOptionalPropertyTypes: only set optional fields when present (never explicit undefined).
    ...(e.time !== undefined ? { time: e.time } : {}),
    ...(e.note !== undefined ? { note: e.note } : {}),
    ...(e.amount !== undefined ? { amount: e.amount } : {}),
    ...(e.reminderOffsetMinutes !== undefined
      ? { reminderOffsetMinutes: e.reminderOffsetMinutes }
      : {}),
  };
  const capture =
    full.amount === undefined
      ? null
      : beginMaterialWrite({
          type: full.kind === 'in' ? 'income_change' : 'bill_amount_change',
          sourceIds: [`fact_calendar_user_event_${full.id}`],
          idempotencyKey: `calendar_event_add_${full.id}`,
          monetaryEffectMinor: Math.round(full.amount * 100),
        });
  setPartialWithTypedCommand(
    { calendarEvents: [full, ...state.calendarEvents].slice(0, 100) },
    {
      commandType: 'folio.calendar_event.add.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('calendar-event', full.id)],
      before: {},
      after: { calendarEvent: full },
      invalidatedProjectionKinds: ['calendar', 'cashflow', 'route'],
    },
  );
  completeMaterialWrite(capture);
  return full;
}

export function removeCalendarEvent(id: string) {
  const before = state.calendarEvents.find((event) => event.id === id);
  const calendarEvents = state.calendarEvents.filter((event) => event.id !== id);
  if (before === undefined) {
    setPartial({ calendarEvents });
    return;
  }
  const capture =
    before.amount === undefined
      ? null
      : beginMaterialWrite({
          type: before.kind === 'in' ? 'income_change' : 'bill_amount_change',
          sourceIds: [`fact_calendar_user_event_${id}`],
          idempotencyKey: `calendar_event_remove_${id}`,
          monetaryEffectMinor: -Math.round(before.amount * 100),
        });
  setPartialWithTypedCommand(
    { calendarEvents },
    {
      commandType: 'folio.calendar_event.remove.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('calendar-event', id)],
      before: { calendarEvent: before },
      after: { calendarEvent: null },
      invalidatedProjectionKinds: ['calendar', 'cashflow', 'route'],
    },
  );
  completeMaterialWrite(capture);
}

/** Patch a manual calendar event (date nudge / edits). */
export function updateCalendarEvent(id: string, patch: Partial<Omit<CalendarEvent, 'id'>>) {
  const before = state.calendarEvents.find((event) => event.id === id);
  const calendarEvents = state.calendarEvents.map((event) =>
    event.id === id ? { ...event, ...patch } : event,
  );
  if (before === undefined) {
    setPartial({ calendarEvents });
    return;
  }
  const after = calendarEvents.find((event) => event.id === id);
  const beforeAmount = before.amount ?? 0;
  const afterAmount = after?.amount ?? 0;
  const dateShifted = patch.date !== undefined && patch.date !== before.date;
  const amountChanged = beforeAmount !== afterAmount;
  const capture =
    amountChanged || dateShifted
      ? beginMaterialWrite({
          type: dateShifted
            ? 'bill_date_shift'
            : before.kind === 'in'
              ? 'income_change'
              : 'bill_amount_change',
          sourceIds: [`fact_calendar_user_event_${id}`],
          idempotencyKey: `calendar_event_update_${id}_${fnv1a32Hex(JSON.stringify(patch), 0x01000193)}`,
          monetaryEffectMinor: Math.round((afterAmount - beforeAmount) * 100),
        })
      : null;
  setPartialWithTypedCommand(
    { calendarEvents },
    {
      commandType: 'folio.calendar_event.update.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('calendar-event', id)],
      before: { calendarEvent: before },
      after: { calendarEvent: calendarEvents.find((event) => event.id === id) },
      invalidatedProjectionKinds: ['calendar', 'cashflow', 'route'],
    },
  );
  completeMaterialWrite(capture);
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
  for (const item of items) requireSourceEvidence(item.sourceEvidenceId);
  const withMemory = applyMemoryToCandidates(items, state.merchantCategories);
  setPartial({ readerCandidates: withMemory });
}

/** Register metadata only after the encrypted original has been durably staged. The picker/cache URI
 *  is deliberately absent from this shape and therefore cannot leak into the state export. */
export function addEvidenceDocument(
  document: Omit<EvidenceDocument, 'workspaceId'> & { workspaceId?: WorkspaceId },
): EvidenceDocument {
  if (!/^evidence_[a-f0-9]{32}$/u.test(document.id)) {
    throw new Error('Evidence document ID is invalid.');
  }
  if (
    !Number.isFinite(Date.parse(document.addedAtISO)) ||
    new Date(document.addedAtISO).toISOString() !== document.addedAtISO ||
    document.filename.trim().length === 0 ||
    document.filename.length > 240 ||
    document.mediaType.trim().length === 0 ||
    !Number.isSafeInteger(document.byteSize) ||
    document.byteSize < 1
  ) {
    throw new Error('Evidence document metadata is invalid.');
  }
  const existing = (state.evidenceDocuments ?? []).find(
    (candidate) => candidate.id === document.id,
  );
  if (existing !== undefined) {
    if (
      existing.workspaceId !== state.activeWorkspaceId ||
      existing.filename !== document.filename ||
      existing.mediaType !== document.mediaType ||
      existing.byteSize !== document.byteSize ||
      existing.addedAtISO !== document.addedAtISO ||
      existing.sourceType !== document.sourceType ||
      existing.extractionStatus !== document.extractionStatus ||
      existing.storageState !== document.storageState ||
      !sameStringSet(existing.linkedTransactionIds, document.linkedTransactionIds)
    ) {
      throw new Error(`Evidence document ${document.id} conflicts with an existing record.`);
    }
    return existing;
  }
  const owned = ownWorkspaceRow(document, state.activeWorkspaceId, `evidence/${document.id}`);
  // Evidence rows are durable referential metadata. Silently slicing this list would strand older
  // encrypted originals and break transaction links, so storage pressure must be handled through an
  // explicit source-removal workflow rather than an invisible collection cap.
  const evidenceDocuments = [owned, ...(state.evidenceDocuments ?? [])];
  setPartialWithTypedCommand(
    { evidenceDocuments },
    {
      commandType: 'folio.intelligence.evidence_document.add.v1',
      actorKind: 'import',
      entityRefs: [opaqueContainerEntityRef('evidence-document', document.id)],
      before: { document: null },
      after: { document: owned },
      invalidatedProjectionKinds: ['evidence', 'statement-imports'],
    },
  );
  return owned;
}

function sameStringSet(left: readonly string[] | undefined, right: readonly string[] | undefined) {
  const a = [...(left ?? [])].sort();
  const b = [...(right ?? [])].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Link an already-encrypted receipt or supporting file to a confirmed transaction without
 * replacing the transaction's original import evidence. Idempotent for repeat taps. */
export function attachEvidenceDocumentToTransaction(
  evidenceId: string,
  transactionId: string,
): boolean {
  const transaction = state.transactions.find((candidate) => candidate.id === transactionId);
  if (transaction === undefined) {
    throw new Error(`Transaction ${transactionId} is unavailable in this workspace.`);
  }
  const document = requireSourceEvidence(evidenceId);
  if (document === undefined) throw new Error(`Evidence document ${evidenceId} is unavailable.`);
  const currentIds = document.linkedTransactionIds ?? [];
  if (currentIds.includes(transactionId)) return false;
  const updated: EvidenceDocument = {
    ...document,
    linkedTransactionIds: [...currentIds, transactionId],
  };
  setPartialWithTypedCommand(
    {
      evidenceDocuments: (state.evidenceDocuments ?? []).map((candidate) =>
        candidate.id === evidenceId ? updated : candidate,
      ),
    },
    {
      commandType: 'folio.intelligence.evidence_document.attach.v1',
      actorKind: 'user',
      entityRefs: [
        opaqueContainerEntityRef('evidence-document', evidenceId),
        { type: 'transaction', id: transactionId },
      ],
      before: { document },
      after: { document: updated },
      changedEntityIds: [transactionId],
      invalidatedProjectionKinds: ['evidence', 'transactions'],
    },
  );
  return true;
}

/** Remove only the transaction relationship. The encrypted original remains in the workspace vault
 * and can still be opened, exported or linked elsewhere. */
export function detachEvidenceDocumentFromTransaction(
  evidenceId: string,
  transactionId: string,
): boolean {
  const document = requireSourceEvidence(evidenceId);
  if (document === undefined || !(document.linkedTransactionIds ?? []).includes(transactionId)) {
    return false;
  }
  const linkedTransactionIds = (document.linkedTransactionIds ?? []).filter(
    (candidate) => candidate !== transactionId,
  );
  const updated: EvidenceDocument =
    linkedTransactionIds.length === 0
      ? (() => {
          const { linkedTransactionIds: _removed, ...rest } = document;
          return rest;
        })()
      : { ...document, linkedTransactionIds };
  setPartialWithTypedCommand(
    {
      evidenceDocuments: (state.evidenceDocuments ?? []).map((candidate) =>
        candidate.id === evidenceId ? updated : candidate,
      ),
    },
    {
      commandType: 'folio.intelligence.evidence_document.detach.v1',
      actorKind: 'user',
      entityRefs: [
        opaqueContainerEntityRef('evidence-document', evidenceId),
        { type: 'transaction', id: transactionId },
      ],
      before: { document },
      after: { document: updated },
      changedEntityIds: [transactionId],
      invalidatedProjectionKinds: ['evidence', 'transactions'],
    },
  );
  return true;
}

function withoutEvidenceLink<T extends { sourceEvidenceId?: string }>(
  row: T,
  evidenceId: string,
): T {
  if (row.sourceEvidenceId !== evidenceId) return row;
  const { sourceEvidenceId: _removed, ...rest } = row;
  return rest as T;
}

/** Forget one retained original while keeping the user's confirmed money/history. Every reference is
 *  cleared atomically so the state cannot contain a dangling evidence link. The native caller must
 *  delete the encrypted file first; this action owns only AppState metadata and relationships. */
export function removeEvidenceDocument(evidenceId: string): boolean {
  const documents = state.evidenceDocuments ?? [];
  const document = documents.find(
    (candidate) => candidate.id === evidenceId && candidate.workspaceId === state.activeWorkspaceId,
  );
  if (document === undefined) return false;
  const patch: Partial<AppState> = {
    evidenceDocuments: documents.filter((candidate) => candidate.id !== evidenceId),
    transactions: state.transactions.map((row) => withoutEvidenceLink(row, evidenceId)),
    statementImports: (state.statementImports ?? []).map((row) =>
      withoutEvidenceLink(row, evidenceId),
    ),
    readerCandidates: state.readerCandidates.map((row) => withoutEvidenceLink(row, evidenceId)),
    reviewQueue: (state.reviewQueue ?? []).map((row) => withoutEvidenceLink(row, evidenceId)),
    reviewQueueSpillover: (state.reviewQueueSpillover ?? []).map((row) =>
      withoutEvidenceLink(row, evidenceId),
    ),
  };
  setPartialWithTypedCommand(patch, {
    commandType: 'folio.intelligence.evidence_document.remove.v1',
    actorKind: 'user',
    entityRefs: [opaqueContainerEntityRef('evidence-document', evidenceId)],
    before: { document },
    after: { document: null },
    invalidatedProjectionKinds: [
      'evidence',
      'transactions',
      'statement-imports',
      'review-proposals',
    ],
  });
  return true;
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
export function recordAiRead(workspaceId: WorkspaceId, monthKey: string) {
  const scoped = requireWorkspaceRows(requireWorkspaceData(state, workspaceId), workspaceId);
  const current = scoped.aiReads;
  const used = current && current.monthKey === monthKey ? current.used + 1 : 1;
  const aiReads = { monthKey, used };
  setPartialWithTypedCommand(
    { aiReads },
    {
      commandType: 'folio.companion.ai_read.record.v1',
      actorKind: 'system',
      entityRefs: [workspaceCollectionEntityRef('companion-runtime')],
      before: { aiReads: current ?? null },
      after: { aiReads },
      invalidatedProjectionKinds: ['read-allowance', 'companion'],
    },
  );
}

/** Cache a successful statement read by file-content key. Oversized reads are not cached (they
 *  would tax every subsequent persist write more than the saved gateway call is worth); the
 *  oldest entries are evicted so the cache never exceeds READ_CACHE_MAX_ENTRIES. */
export function cacheAiRead(workspaceId: WorkspaceId, key: string, entry: AiReadCacheEntry) {
  if (entry.candidates.length > READ_CACHE_MAX_CANDIDATES) return;
  const scoped = requireWorkspaceRows(requireWorkspaceData(state, workspaceId), workspaceId);
  const current = scoped.aiReadCache ?? {};
  const drops = readCacheEvictions(current);
  const kept = Object.fromEntries(Object.entries(current).filter(([k]) => !drops.includes(k)));
  const aiReadCache = { ...kept, [key]: entry };
  setPartialWithTypedCommand(
    { aiReadCache },
    {
      commandType: 'folio.companion.ai_read_cache.store.v1',
      actorKind: 'system',
      entityRefs: [opaqueContainerEntityRef('ai-read-cache', key)],
      before: { cacheEntry: current[key] ?? null, evictedKeys: drops },
      after: { cacheEntry: entry },
      invalidatedProjectionKinds: ['read-cache', 'companion'],
    },
  );
}

/** The cached read for a file-content key, or null. Pure read — no expiry (a statement's content
 *  never changes; the cache is only bounded by entry-count eviction). */
export function getCachedAiRead(workspaceId: WorkspaceId, key: string): AiReadCacheEntry | null {
  const scoped = requireWorkspaceRows(requireWorkspaceData(state, workspaceId), workspaceId);
  return scoped.aiReadCache?.[key] ?? null;
}

/** Stamp the What-Changed baseline (see `AppState.whatChangedSeenISO`). Called by
 *  ui/WhatChangedRow.tsx on its silent first-mount baseline and on every tap-through. */
export function markWhatChangedSeen(nowISO: string) {
  const current = state.whatChangedSeenISO ?? null;
  if (current === nowISO) return;
  setPartialWithTypedCommand(
    { whatChangedSeenISO: nowISO },
    {
      commandType: 'folio.companion.what_changed.mark_seen.v1',
      actorKind: 'system',
      entityRefs: [workspaceCollectionEntityRef('companion-runtime')],
      before: { whatChangedSeenISO: current },
      after: { whatChangedSeenISO: nowISO },
      invalidatedProjectionKinds: ['what-changed', 'companion'],
    },
  );
}

/** Re-derive every sub's `nextRenewalDaysAway` from its date anchor (lib/renewalMath.ts
 *  `reanchorRenewals`) — the app-foreground half of the date-anchor fix (load() covers boot).
 *  A phone that stays alive across midnight re-derives here instead of rotting until the next
 *  cold start. No-op (no write, no listener churn) when nothing changed. */
export function reanchorSubRenewals(todayIso: string = currentFinancialDate()) {
  const { items, changed } = reanchorRenewals(state.subs, todayIso);
  if (changed) {
    const changedNames = items
      .filter((subscription, index) => !structurallyEqual(subscription, state.subs[index]))
      .map((subscription) => subscription.name);
    setPartialWithTypedCommand(
      { subs: items },
      {
        commandType: 'folio.subscription_renewals.reanchor.v1',
        actorKind: 'system',
        entityRefs: uniqueOpaqueContainerEntityRefs('subscription', changedNames),
        before: {
          subscriptions: state.subs.filter((subscription) =>
            changedNames.includes(subscription.name),
          ),
        },
        after: {
          subscriptions: items.filter((subscription) => changedNames.includes(subscription.name)),
        },
        invalidatedProjectionKinds: ['subscriptions', 'cashflow', 'calendar'],
      },
    );
  }
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
  const ignoredReviewSigs = [sig, ...current];
  const timelineEvent =
    subject === undefined ? null : createTimelineEvent('review-ignored', subject);
  const timelineEvents =
    timelineEvent === null
      ? undefined
      : [timelineEvent, ...(state.timelineEvents ?? [])].slice(0, 200);
  setPartialWithTypedCommand(
    { ignoredReviewSigs, ...(timelineEvents === undefined ? {} : { timelineEvents }) },
    {
      commandType: 'folio.intelligence.review_signature.ignore.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('review-signature', sig)],
      before: { ignoredReviewSigs: current },
      after: { ignoredReviewSigs },
      invalidatedProjectionKinds: ['review-proposals'],
    },
  );
}

/** Un-hide a previously-ignored Review candidate signature (HiddenReviewSheet's
 *  "Un-hide" action) — future intakes matching it will surface again. */
export function unhideReviewSig(sig: string) {
  const current = state.ignoredReviewSigs ?? [];
  if (!current.includes(sig)) return;
  const ignoredReviewSigs = current.filter((candidate) => candidate !== sig);
  setPartialWithTypedCommand(
    { ignoredReviewSigs },
    {
      commandType: 'folio.intelligence.review_signature.unhide.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('review-signature', sig)],
      before: { ignoredReviewSigs: current },
      after: { ignoredReviewSigs },
      invalidatedProjectionKinds: ['review-proposals'],
    },
  );
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
  const ignoredBankExternalIds = new Set(state.ignoredBankExternalIds ?? []);
  const now = Date.now();
  const fresh: ReviewItem[] = [];
  for (const c of candidates) {
    requireSourceEvidence(c.sourceEvidenceId);
    if (c.externalId !== undefined && ignoredBankExternalIds.has(c.externalId)) continue;
    if (
      c.externalId === undefined &&
      ignored.has(reviewCandidateSig(c.merchant, c.amount, c.date ?? ''))
    ) {
      continue;
    }
    const dupe = c.externalId
      ? state.transactions.some((it) => it.externalId === c.externalId) ||
        existingQueue.some((it) => it.externalId === c.externalId) ||
        existingSpillover.some((it) => it.externalId === c.externalId)
      : existingQueue.some(
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

  setPartialWithTypedCommand(
    { reviewQueue: nextQueue, reviewQueueSpillover: nextSpillover },
    {
      commandType: 'folio.review.enqueue.v1',
      actorKind: reviewActorKind(fresh),
      entityRefs: fresh.map((item) => ({ type: 'review-proposal', id: item.id })),
      before: {},
      after: { proposals: fresh },
      changedEntityIds: fresh.map((item) => item.id),
      invalidatedProjectionKinds: ['review-proposals'],
      occurredAt: fresh[0]!.addedAt,
    },
  );

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
    if (fresh.length !== spillover.length) {
      setPartialWithTypedCommand(
        { reviewQueueSpillover: fresh },
        {
          commandType: 'folio.review.spillover.expire.v1',
          actorKind: 'system',
          entityRefs: [workspaceCollectionEntityRef('review-queue')],
          before: { reviewQueueSpillover: spillover },
          after: { reviewQueueSpillover: fresh },
          invalidatedProjectionKinds: ['review-proposals'],
          occurredAt: new Date(now).toISOString(),
        },
      );
    }
    return;
  }
  const toMove = fresh.slice(0, room);
  const remaining = fresh.slice(room);
  const reviewQueue = [...queue, ...toMove];
  setPartialWithTypedCommand(
    { reviewQueue, reviewQueueSpillover: remaining },
    {
      commandType: 'folio.review.refill_from_spillover.v1',
      actorKind: 'system',
      entityRefs: [workspaceCollectionEntityRef('review-queue')],
      before: { reviewQueue: queue, reviewQueueSpillover: spillover },
      after: { reviewQueue, reviewQueueSpillover: remaining },
      invalidatedProjectionKinds: ['review-proposals'],
      occurredAt: new Date(now).toISOString(),
    },
  );
}

function refilledReviewQueue(
  queue: readonly ReviewItem[],
  spillover: readonly ReviewItem[],
  now: number,
): { reviewQueue: ReviewItem[]; reviewQueueSpillover: ReviewItem[] } {
  const room = REVIEW_QUEUE_CAP - queue.length;
  if (room <= 0 || spillover.length === 0) {
    return { reviewQueue: [...queue], reviewQueueSpillover: [...spillover] };
  }
  const fresh = spillover.filter((item) => now - new Date(item.addedAt).getTime() < REVIEW_TTL_MS);
  return {
    reviewQueue: [...queue, ...fresh.slice(0, room)],
    reviewQueueSpillover: fresh.slice(room),
  };
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
  accountId?: string,
): Array<Omit<ReviewItem, 'id' | 'addedAt'>> {
  return candidates.map((c) => ({
    source,
    merchant: c.merchant,
    amount: c.amount,
    ...(c.date !== undefined ? { date: c.date } : {}),
    ...(c.sourceEvidenceId !== undefined ? { sourceEvidenceId: c.sourceEvidenceId } : {}),
    ...(accountId !== undefined ? { accountId } : {}),
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
export function resolveReviewItem(
  id: string,
  resolution: 'accepted' | 'ignored' | 'linked' = 'accepted',
) {
  const queue = state.reviewQueue ?? [];
  const target = queue.find((item) => item.id === id);
  if (target === undefined) return;
  const next = queue.filter((it) => it.id !== id);
  const refilled = refilledReviewQueue(next, state.reviewQueueSpillover ?? [], Date.now());
  setPartialWithTypedCommand(refilled, {
    commandType: `folio.review.${resolution}.v1`,
    actorKind: 'user',
    entityRefs: [{ type: 'review-proposal', id }],
    before: { proposal: target },
    after: {},
    changedEntityIds: [id],
    invalidatedProjectionKinds: ['review-proposals'],
  });
  if (refilled.reviewQueue.length === 0 && refilled.reviewQueueSpillover.length === 0) {
    void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
      emitMeloReaction('companion-root', {
        mood: 'cheer',
        pose: 'safe',
        line: 'Review complete.',
        durationMs: 3_000,
        eventType: 'REVIEW_COMPLETED',
        eventPriority: 'normal',
        eventIntensity: 'small',
      });
    });
  }
}

const IGNORED_BANK_EXTERNAL_ID_CAP = 2_000;

/** Remember one explicitly ignored Open Banking row without letting one merchant/date/amount
 *  signature suppress a different legitimate bank transaction. */
export function addIgnoredBankExternalId(externalId: string): void {
  const id = externalId.trim();
  if (id.length === 0) return;
  const current = state.ignoredBankExternalIds ?? [];
  if (current.includes(id)) return;
  const ignoredBankExternalIds = [id, ...current].slice(0, IGNORED_BANK_EXTERNAL_ID_CAP);
  setPartialWithTypedCommand(
    { ignoredBankExternalIds },
    {
      commandType: 'folio.intelligence.bank_external_id.ignore.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('bank-external-id', id)],
      before: { ignoredBankExternalIds: current },
      after: { ignoredBankExternalIds },
      invalidatedProjectionKinds: ['review-proposals', 'open-banking'],
    },
  );
}

/** Device-side half of Open Banking disconnect. The server disconnect is always separate; this
 *  function runs only after the user explicitly chooses to remove already accepted/queued bank
 *  history from this device. */
export function deleteBankImportedHistory(connectionId: string): {
  deletedTransactions: number;
  deletedReviewItems: number;
} {
  const transactions = state.transactions.filter(
    (transaction) => transaction.bankConnectionId !== connectionId,
  );
  const reviewQueue = (state.reviewQueue ?? []).filter(
    (item) => item.bankConnectionId !== connectionId,
  );
  const reviewQueueSpillover = (state.reviewQueueSpillover ?? []).filter(
    (item) => item.bankConnectionId !== connectionId,
  );
  const deletedTransactions = state.transactions.length - transactions.length;
  const deletedReviewItems =
    (state.reviewQueue?.length ?? 0) +
    (state.reviewQueueSpillover?.length ?? 0) -
    reviewQueue.length -
    reviewQueueSpillover.length;
  if (deletedTransactions > 0 || deletedReviewItems > 0) {
    const removedTransactions = state.transactions.filter(
      (transaction) => transaction.bankConnectionId === connectionId,
    );
    const removedReviewItems = [
      ...(state.reviewQueue ?? []),
      ...(state.reviewQueueSpillover ?? []),
    ].filter((item) => item.bankConnectionId === connectionId);
    const capture = beginMaterialWrite({
      type: 'provider_stale',
      sourceIds: [
        `fact_provider_${connectionId}`,
        ...removedTransactions.flatMap(transactionSourceIds),
      ],
      truth: 'stale',
      idempotencyKey: `provider_history_delete_${connectionId}`,
      monetaryEffectMinor: -Math.round(
        removedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0) * 100,
      ),
      reviewRequired: true,
    });
    setPartialWithTypedCommand(
      { transactions, reviewQueue, reviewQueueSpillover },
      {
        commandType: 'folio.open_banking.history.delete.v1',
        actorKind: 'user',
        entityRefs: [
          ...removedTransactions.map((transaction) => ({
            type: 'transaction',
            id: transaction.id,
          })),
          ...removedReviewItems.map((item) => ({ type: 'review-proposal', id: item.id })),
        ],
        before: { transactions: removedTransactions, proposals: removedReviewItems },
        after: {},
        changedEntityIds: [
          ...removedTransactions.map((transaction) => transaction.id),
          ...removedReviewItems.map((item) => item.id),
        ],
        invalidatedProjectionKinds: ['transactions', 'cashflow', 'review-proposals'],
      },
    );
    completeMaterialWrite(capture);
  }
  return { deletedTransactions, deletedReviewItems };
}

/** Drain the whole queue — used when the user explicitly says "clear all"
 *  or when a cycle closes and stale candidates should stop nagging. Also drains the spillover: a
 *  "clear all" that left the overflow parked would just silently repopulate the queue moments later. */
export function clearReviewQueue() {
  const items = [...(state.reviewQueue ?? []), ...(state.reviewQueueSpillover ?? [])];
  if (items.length === 0) return;
  setPartialWithTypedCommand(
    { reviewQueue: [], reviewQueueSpillover: [] },
    {
      commandType: 'folio.review.clear.v1',
      actorKind: 'user',
      entityRefs: items.map((item) => ({ type: 'review-proposal', id: item.id })),
      before: { proposals: items },
      after: {},
      changedEntityIds: items.map((item) => item.id),
      invalidatedProjectionKinds: ['review-proposals'],
    },
  );
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
    const expired = [...queue, ...spillover].filter((item) => !notExpired(item));
    const refilled = refilledReviewQueue(nextQueue, nextSpillover, now);
    setPartialWithTypedCommand(refilled, {
      commandType: 'folio.review.expire.v1',
      actorKind: 'system',
      entityRefs: expired.map((item) => ({ type: 'review-proposal', id: item.id })),
      before: { proposals: expired },
      after: {},
      changedEntityIds: expired.map((item) => item.id),
      invalidatedProjectionKinds: ['review-proposals'],
      occurredAt: new Date(now).toISOString(),
    });
  }
}

/** Nudge a flexible bill (subscription renewal) by `deltaDays`. This is
 *  the "what if I move this?" affordance — additive so repeated taps stack,
 *  clamped to ±7 days so we don't pretend bills are fully discretionary. */
export function nudgeSub(name: string, deltaDays: number, options?: MaterialDecisionWriteOptions) {
  const current = state.subOverrides[name] ?? 0;
  const next = Math.max(-7, Math.min(7, current + deltaDays));
  const hadStoredValue = Object.prototype.hasOwnProperty.call(state.subOverrides, name);
  const subOverrides = { ...state.subOverrides, [name]: next };
  if (hadStoredValue && current === next) {
    setPartial({ subOverrides });
    return;
  }
  const capture = beginMaterialWrite({
    type: 'bill_date_shift',
    sourceIds: [`fact_subscription_${fnv1a32Hex(name, 0x811c9dc5)}`],
    idempotencyKey: `bill_date_change_${name}_${next}`,
    monetaryEffectMinor: 0,
  });
  setPartialWithTypedCommand(
    { subOverrides },
    {
      commandType: 'folio.subscription.nudge.v1',
      actorKind: 'user',
      entityRefs: [opaqueContainerEntityRef('subscription', name)],
      before: { overrideDays: hadStoredValue ? current : null },
      after: { overrideDays: next },
      invalidatedProjectionKinds: ['subscriptions', 'cashflow', 'calendar'],
    },
  );
  if (shouldRecordMaterialDecision(options)) {
    recordMaterialDecision({
      idempotencyKey: `bill_date_change_${name}_${next}`,
      decisionType: 'bill-date-change',
      contextRoute: 'recovery',
      question: `Move ${name} by ${next} days.`,
      questionSource: 'recovery',
      priority: 'avoid_shortfall',
      daysShifted: next,
      confirmedAction: true,
      outcome: 'awaiting',
    });
  }
  completeMaterialWrite(capture);
}

/** Reset all "what if" nudges on flexible bills. */
export function resetSubOverrides(name?: string) {
  if (name) {
    if (!Object.prototype.hasOwnProperty.call(state.subOverrides, name)) return;
    const { [name]: _gone, ...rest } = state.subOverrides;
    const capture = beginMaterialWrite({
      type: 'bill_date_shift',
      sourceIds: [`fact_subscription_${fnv1a32Hex(name, 0x811c9dc5)}`],
      idempotencyKey: `bill_date_change_reset_${name}`,
      monetaryEffectMinor: 0,
    });
    setPartialWithTypedCommand(
      { subOverrides: rest },
      {
        commandType: 'folio.subscription.nudge_reset.v1',
        actorKind: 'user',
        entityRefs: [opaqueContainerEntityRef('subscription', name)],
        before: { overrideDays: state.subOverrides[name] },
        after: {},
        invalidatedProjectionKinds: ['subscriptions', 'cashflow', 'calendar'],
      },
    );
    completeMaterialWrite(capture);
  } else {
    const names = Object.keys(state.subOverrides);
    if (names.length === 0) return;
    const capture = beginMaterialWrite({
      type: 'bill_date_shift',
      sourceIds: names.map((candidate) => `fact_subscription_${fnv1a32Hex(candidate, 0x811c9dc5)}`),
      idempotencyKey: `bill_date_change_reset_all_${names.join('_')}`,
      monetaryEffectMinor: 0,
    });
    setPartialWithTypedCommand(
      { subOverrides: {} },
      {
        commandType: 'folio.subscription.nudge_reset_all.v1',
        actorKind: 'user',
        entityRefs: uniqueOpaqueContainerEntityRefs('subscription', names),
        before: { overrides: state.subOverrides },
        after: {},
        invalidatedProjectionKinds: ['subscriptions', 'cashflow', 'calendar'],
      },
    );
    completeMaterialWrite(capture);
  }
}

/** Commit Recovery's bounded daily discretionary cap to the active cycle. */
export function setSpendHold(
  dailyCap: number,
  days: number,
  now: Date = new Date(),
  options?: MaterialDecisionWriteOptions,
) {
  const durationDays = Math.max(1, Math.round(days));
  const start = currentFinancialDate(now);
  const end = addDaysToLocalDate(start, durationDays - 1);
  const spendHold: SpendHold = {
    start,
    end,
    dailyCap: Math.max(0, Math.round(dailyCap)),
    setAt: now.toISOString(),
  };
  const capture = beginMaterialWrite({
    type: 'forecast_recalculation',
    sourceIds: ['fact_spending_hold'],
    idempotencyKey: `spending_hold_${spendHold.start}_${spendHold.end}_${spendHold.dailyCap}`,
    monetaryEffectMinor: Math.round(spendHold.dailyCap * 100 * durationDays),
    occurredAt: spendHold.setAt,
  });
  setPartialWithTypedCommand(
    { spendHold },
    {
      commandType: 'folio.recovery.spend_hold.set.v1',
      actorKind: 'user',
      entityRefs: [{ type: 'spend-hold', id: `${start}\u001f${end}` }],
      before: { spendHold: state.spendHold ?? null },
      after: { spendHold },
      invalidatedProjectionKinds: ['cashflow', 'calendar', 'route'],
      occurredAt: spendHold.setAt,
    },
  );
  if (shouldRecordMaterialDecision(options)) {
    recordMaterialDecision({
      idempotencyKey: `spending_hold_${spendHold.start}_${spendHold.end}_${spendHold.dailyCap}`,
      decisionType: 'spending-hold',
      contextRoute: 'recovery',
      question: `Hold spending at £${spendHold.dailyCap} a day until ${spendHold.end}.`,
      questionSource: 'recovery',
      priority: 'avoid_shortfall',
      amountMinor: Math.round(spendHold.dailyCap * 100 * durationDays),
      daysShifted: durationDays,
      confirmedAction: true,
      outcome: 'awaiting',
      now: spendHold.setAt,
    });
  }
  completeMaterialWrite(capture);
  void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
    emitMeloReaction('companion-root', {
      mood: 'protect',
      pose: 'safe',
      line: 'Recovery guardrail set.',
      durationMs: 3_200,
      eventType: 'RECOVERY',
      eventPriority: 'normal',
      eventIntensity: 'small',
    });
  });
}

export function clearSpendHold() {
  if (!state.spendHold) return;
  const previous = state.spendHold;
  const capture = beginMaterialWrite({
    type: 'forecast_recalculation',
    sourceIds: ['fact_spending_hold'],
    idempotencyKey: `spending_hold_clear_${previous.start}_${previous.end}`,
    monetaryEffectMinor: -Math.round(previous.dailyCap * 100),
  });
  setPartialWithTypedCommand(
    { spendHold: null },
    {
      commandType: 'folio.recovery.spend_hold.clear.v1',
      actorKind: 'user',
      entityRefs: [{ type: 'spend-hold', id: `${previous.start}\u001f${previous.end}` }],
      before: { spendHold: previous },
      after: {},
      invalidatedProjectionKinds: ['cashflow', 'calendar', 'route'],
    },
  );
  completeMaterialWrite(capture);
  void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
    emitMeloReaction('companion-root', {
      mood: 'calm',
      pose: 'safe',
      line: 'Recovery guardrail cleared.',
      durationMs: 3_000,
      eventType: 'RECOVERY_EXIT',
      eventPriority: 'normal',
      eventIntensity: 'small',
    });
  });
}

/** Record, but never auto-cancel, a day on which a spend hold was exceeded. */
export function recordSpendHoldBreach(day: string): boolean {
  const current = state.spendHold;
  if (!current || day < current.start || day > current.end) return false;
  if ((current.breachedDates ?? []).includes(day)) return false;
  const spendHold: SpendHold = {
    ...current,
    breachedDates: [...(current.breachedDates ?? []), day].sort(),
  };
  setPartialWithTypedCommand(
    { spendHold },
    {
      commandType: 'folio.recovery.spend_hold.breach.v1',
      actorKind: 'system',
      entityRefs: [{ type: 'spend-hold', id: `${current.start}\u001f${current.end}` }],
      before: { breachedDates: current.breachedDates ?? [] },
      after: { breachedDates: spendHold.breachedDates },
      invalidatedProjectionKinds: ['recovery', 'insights'],
    },
  );
  void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
    emitMeloReaction('companion-root', {
      mood: 'concern',
      pose: 'check',
      line: 'Spending moved past the daily hold.',
      durationMs: 3_600,
      eventType: 'BILL_RISK',
      eventPriority: 'high',
      eventIntensity: 'normal',
    });
  });
  return true;
}

export function addWhatIfHold(input: {
  amount: number;
  recurrence: WhatIfHold['recurrence'];
  label?: string;
  scenarios?: CreateDecisionDraftInput['scenarios'];
  selectedScenarioId?: DecisionLedgerEntry['chosenScenarioId'];
}): WhatIfHold | null {
  const amount = Math.max(0, Math.round(input.amount));
  if (!(amount > 0)) return null;
  const addedAt = new Date().toISOString();
  const hold: WhatIfHold = {
    id: `hold-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: state.activeWorkspaceId,
    amount,
    recurrence: input.recurrence,
    addedAt,
    ...(input.label?.trim() ? { label: input.label.trim() } : {}),
  };
  const whatIfHolds = [hold, ...(state.whatIfHolds ?? [])].slice(0, 24);
  const capture = beginMaterialWrite({
    type: 'forecast_recalculation',
    sourceIds: [`fact_what_if_hold_${hold.id}`],
    idempotencyKey: `what_if_hold_${hold.id}`,
    monetaryEffectMinor: -Math.round(amount * 100),
    occurredAt: addedAt,
  });
  setPartialWithTypedCommand(
    { whatIfHolds },
    {
      commandType: 'folio.what_if.hold.add.v1',
      actorKind: 'user',
      entityRefs: [{ type: 'what-if-hold', id: hold.id }],
      before: {},
      after: { hold },
      invalidatedProjectionKinds: ['cashflow', 'calendar', 'route'],
      occurredAt: addedAt,
    },
  );
  recordMaterialDecision({
    idempotencyKey: `what_if_hold_${hold.id}`,
    decisionType: 'scenario-choice',
    contextRoute: 'whatif',
    question: `Keep a ${hold.recurrence} £${amount} scenario on the money path.`,
    questionSource: 'scenario',
    priority: 'cashflow_source_quality',
    amountMinor: -Math.round(amount * 100),
    bufferDeltaMinor: -Math.round(amount * 100),
    confirmedAction: true,
    ...(input.scenarios === undefined ? {} : { scenarios: input.scenarios }),
    ...(input.selectedScenarioId === undefined
      ? {}
      : { selectedScenarioId: input.selectedScenarioId }),
    outcome: 'awaiting',
    now: addedAt,
  });
  completeMaterialWrite(capture);
  return hold;
}

export function removeWhatIfHold(id: string): boolean {
  const previous = (state.whatIfHolds ?? []).find((hold) => hold.id === id);
  if (!previous) return false;
  const capture = beginMaterialWrite({
    type: 'forecast_recalculation',
    sourceIds: [`fact_what_if_hold_${id}`],
    idempotencyKey: `what_if_hold_remove_${id}`,
    monetaryEffectMinor: Math.round(previous.amount * 100),
  });
  setPartialWithTypedCommand(
    { whatIfHolds: (state.whatIfHolds ?? []).filter((hold) => hold.id !== id) },
    {
      commandType: 'folio.what_if.hold.remove.v1',
      actorKind: 'user',
      entityRefs: [{ type: 'what-if-hold', id }],
      before: { hold: previous },
      after: {},
      invalidatedProjectionKinds: ['cashflow', 'calendar', 'route'],
    },
  );
  completeMaterialWrite(capture);
  return true;
}

export function clearWhatIfHolds() {
  const previous = state.whatIfHolds ?? [];
  if (previous.length === 0) return;
  const capture = beginMaterialWrite({
    type: 'forecast_recalculation',
    sourceIds: previous.map((hold) => `fact_what_if_hold_${hold.id}`),
    idempotencyKey: `what_if_hold_clear_all_${previous.map((hold) => hold.id).join('_')}`,
    monetaryEffectMinor: Math.round(previous.reduce((sum, hold) => sum + hold.amount, 0) * 100),
  });
  setPartialWithTypedCommand(
    { whatIfHolds: [] },
    {
      commandType: 'folio.what_if.hold.clear_all.v1',
      actorKind: 'user',
      entityRefs: previous.map((hold) => ({ type: 'what-if-hold', id: hold.id })),
      before: { holds: previous },
      after: {},
      invalidatedProjectionKinds: ['cashflow', 'calendar', 'route'],
    },
  );
  completeMaterialWrite(capture);
}

/** Stamp Today-open time and return the previous value for a stable per-mount recap. */
export function touchOpened(now = new Date()): string | null {
  const previous = state.lastOpenedAt ?? null;
  setPartial({ lastOpenedAt: now.toISOString() });
  return previous;
}

export function daysSinceLastOpen(now = new Date()): number | null {
  if (!state.lastOpenedAt) return null;
  const openedAt = Date.parse(state.lastOpenedAt);
  if (!Number.isFinite(openedAt)) return null;
  return Math.max(0, Math.floor((now.getTime() - openedAt) / 86_400_000));
}

export function setMeloPrimerSeen(seen = true) {
  if ((state.meloPrimerSeen ?? false) === seen) return;
  setPartial({
    meloPrimerSeen: seen,
    meloPrimerBeat: seen ? 0 : (state.meloPrimerBeat ?? 0),
    meloPrimerSeenAt: seen ? new Date().toISOString() : null,
  });
}

export function setMeloPrimerBeat(beat: number) {
  const next = Math.max(0, Math.min(3, Math.floor(beat)));
  if ((state.meloPrimerBeat ?? 0) === next) return;
  setPartial({ meloPrimerBeat: next });
}

export function recordOneMoveShown(
  offer: NonNullable<OneMove>,
  pathSpare: number,
  tightPoint: number,
  now = new Date(),
) {
  if (!offer.key) return;
  const current = state.oneMoveHistory ?? [];
  const today = currentFinancialDate(now);
  const latest = current[0];
  if (latest?.key === offer.key && latest.tappedAt === undefined && latest.shownAt === today) {
    return;
  }
  const createdAt = now.toISOString();
  const record: OneMoveRecord = {
    id: `move-${createdAt}-${offer.key}`,
    createdAt,
    headline: offer.line,
    kind: offer.kind,
    status: 'suggested',
    sourceKey: offer.key,
    baselinePathSpare: pathSpare,
    baselineTightPoint: tightPoint,
  };
  setPartial({
    oneMoveHistory: [{ key: offer.key, shownAt: today }, ...current].slice(0, 7),
    meloMoves: [record, ...(state.meloMoves ?? [])].slice(0, 50),
  });
}

export function recordOneMoveTapped(key: string, now = new Date()) {
  const current = state.oneMoveHistory ?? [];
  const index = current.findIndex((entry) => entry.key === key && entry.tappedAt === undefined);
  const acceptedAt = now.toISOString();
  const next = current.slice();
  if (index >= 0) next[index] = { ...next[index]!, tappedAt: acceptedAt };
  let accepted = false;
  const meloMoves = (state.meloMoves ?? []).map((move) => {
    if (accepted || move.sourceKey !== key || move.status !== 'suggested') return move;
    accepted = true;
    return { ...move, status: 'accepted' as const, acceptedAt };
  });
  setPartial({ oneMoveHistory: next, meloMoves });
}

export function recordOneMoveDismissed(
  key: string,
  reason: DismissReason | null,
  now = new Date(),
) {
  if (!key) return;
  const dismissedAt = now.toISOString();
  const entry: DismissRecord = { kind: key, reason, at: dismissedAt };
  let dismissed = false;
  const meloMoves = (state.meloMoves ?? []).map((move) => {
    if (dismissed || move.sourceKey !== key || move.status !== 'suggested') return move;
    dismissed = true;
    return { ...move, status: 'dismissed' as const, dismissedAt };
  });
  setPartial({
    meloDismissLog: [entry, ...(state.meloDismissLog ?? [])].slice(0, 20),
    meloMoves,
  });
}

/**
 * Resolve accepted moves once seven full days have passed and age untouched
 * suggestions out. Outcomes are observations, never success/failure scores.
 */
export function resolveOneMoveOutcomes(pathSpare: number, tightPoint: number, now = new Date()) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return;
  let changed = false;
  const moves = (state.meloMoves ?? []).map((move) => {
    const anchor = move.acceptedAt ?? move.createdAt;
    const anchorMs = Date.parse(anchor);
    if (!Number.isFinite(anchorMs) || nowMs - anchorMs < 7 * 86_400_000) return move;
    if (move.status === 'suggested') {
      changed = true;
      return { ...move, status: 'expired' as const };
    }
    if (
      move.status === 'accepted' &&
      move.outcome === undefined &&
      move.baselinePathSpare !== undefined &&
      move.baselineTightPoint !== undefined
    ) {
      changed = true;
      return {
        ...move,
        outcome: {
          resolvedAt: now.toISOString(),
          pathDelta: Math.round((pathSpare - move.baselinePathSpare) * 100) / 100,
          tightPointDelta: Math.round((tightPoint - move.baselineTightPoint) * 100) / 100,
        },
      };
    }
    return move;
  });
  if (changed) setPartial({ meloMoves: moves.slice(0, 50) });
}

/** Add newly observed, provable memory lines without overwriting edits or reviving forgotten lines. */
export function syncMeloMemoryThread(observed: readonly MemoryLine[]) {
  const current = state.meloMemoryThread ?? [];
  const forgotten = new Set(state.meloForgottenMemoryIds ?? []);
  const currentIds = new Set(current.map((line) => line.id));
  const additions = observed.filter((line) => !currentIds.has(line.id) && !forgotten.has(line.id));
  if (additions.length === 0) return;
  setPartial({
    meloMemoryThread: [...additions, ...current]
      .sort((left, right) => right.at.localeCompare(left.at))
      .slice(0, 200),
  });
}

export function upsertMeloMemoryLine(line: MemoryLine) {
  const current = state.meloMemoryThread ?? [];
  const exists = current.some((candidate) => candidate.id === line.id);
  setPartial({
    meloMemoryThread: (exists
      ? current.map((candidate) => (candidate.id === line.id ? line : candidate))
      : [line, ...current]
    )
      .sort((left, right) => right.at.localeCompare(left.at))
      .slice(0, 200),
    meloForgottenMemoryIds: (state.meloForgottenMemoryIds ?? []).filter((id) => id !== line.id),
  });
}

export function forgetMeloMemoryLine(id: string): MemoryLine | null {
  const current = state.meloMemoryThread ?? [];
  const line = current.find((candidate) => candidate.id === id) ?? null;
  if (!line) return null;
  setPartial({
    meloMemoryThread: current.filter((candidate) => candidate.id !== id),
    meloForgottenMemoryIds: [
      id,
      ...(state.meloForgottenMemoryIds ?? []).filter((item) => item !== id),
    ].slice(0, 500),
  });
  return line;
}

export function forgetAllMeloMemory() {
  const current = state.meloMemoryThread ?? [];
  const forgotten = new Set(state.meloForgottenMemoryIds ?? []);
  current.forEach((line) => forgotten.add(line.id));
  setPartial({
    meloMemoryThread: [],
    meloForgottenMemoryIds: [...forgotten].slice(0, 500),
  });
}

/**
 * Apply one atomic update to the active Business partition. This deliberately
 * refuses to write while Personal is active, so a route bug cannot leak
 * Business records into the Personal companion/export context.
 */
export function updateBusinessOperations(
  update:
    | Partial<BusinessOperationsState>
    | ((
        current: BusinessOperationsState,
      ) => Partial<BusinessOperationsState> | BusinessOperationsState),
) {
  const active = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
  if (active?.kind !== 'business') {
    throw new Error('Business operations require an active Business workspace.');
  }
  const current = normaliseBusinessOperationsState(state.business);
  const patch = typeof update === 'function' ? update(current) : update;
  const business = normaliseBusinessOperationsState({
    ...current,
    ...patch,
  });
  const now = new Date();
  const stage = transitionPhoenixStage(
    state.stage,
    deriveBusinessStage(
      businessMeloSignals(business, state.streak, (state.melo ?? DEFAULT_MELO).quietMode, now)
        .stageInput,
    ).stage,
    now.toISOString(),
  );
  setPartial({
    business,
    stage,
  });
  emitBusinessCompanionReaction(current, business);
}

/**
 * Translate confirmed Business writes into one calm, truthful companion beat. This deliberately
 * compares the saved before/after records instead of inferring meaning from screen copy, and emits
 * only the strongest result from an atomic update so the companion never chatters through a batch.
 */
function emitBusinessCompanionReaction(
  before: BusinessOperationsState,
  after: BusinessOperationsState,
): void {
  type Reaction = Readonly<{
    type: string;
    mood: 'calm' | 'curious' | 'cheer' | 'concern';
    pose: 'none' | 'safe' | 'check' | 'sealed';
    line: string;
    priority: 'normal' | 'high';
    intensity: 'small' | 'normal' | 'major';
    direction?: 'improved' | 'worsened';
  }>;

  const beforeInvoices = new Map(before.invoices.map((invoice) => [invoice.id, invoice] as const));
  const beforeFilings = new Map(before.filings.map((filing) => [filing.id, filing] as const));
  const submitted = after.filings.find(
    (filing) =>
      filing.status === 'submitted-external' &&
      beforeFilings.get(filing.id)?.status !== 'submitted-external',
  );
  const newlyOverdue = after.invoices.find(
    (invoice) =>
      invoice.status === 'overdue' && beforeInvoices.get(invoice.id)?.status !== 'overdue',
  );
  const newlyPaid = after.invoices.find(
    (invoice) => invoice.status === 'paid' && beforeInvoices.get(invoice.id)?.status !== 'paid',
  );
  const created = after.invoices.find((invoice) => !beforeInvoices.has(invoice.id));
  const removedTaxObligation = before.obligations.some(
    (obligation) =>
      obligation.category === 'tax' &&
      !after.obligations.some((candidate) => candidate.id === obligation.id),
  );

  let reaction: Reaction | null = submitted
    ? {
        type: 'FILING_COMPLETED',
        mood: 'cheer',
        pose: 'sealed',
        line: 'Filing recorded as submitted.',
        priority: 'high',
        intensity: 'major',
      }
    : newlyOverdue
      ? {
          type: 'INVOICE_OVERDUE',
          mood: 'concern',
          pose: 'check',
          line: 'An invoice needs attention.',
          priority: 'high',
          intensity: 'major',
        }
      : newlyPaid
        ? {
            type: 'INVOICE_PAID',
            mood: 'cheer',
            pose: 'safe',
            line: 'Invoice paid.',
            priority: 'normal',
            intensity: 'small',
          }
        : removedTaxObligation
          ? {
              type: 'TAX_OBLIGATION_RESOLVED',
              mood: 'calm',
              pose: 'safe',
              line: 'Tax obligation resolved.',
              priority: 'normal',
              intensity: 'small',
            }
          : created
            ? {
                type: created.status === 'issued' ? 'INVOICE_SENT' : 'INVOICE_CREATED',
                mood: 'calm',
                pose: 'safe',
                line: created.status === 'issued' ? 'Invoice issued.' : 'Invoice created.',
                priority: 'normal',
                intensity: 'small',
              }
            : null;

  if (!reaction) {
    const accountBalances = (state.accounts ?? []).map((account) => ({
      ...account,
      balanceMinor: Math.round(account.balanceMinor * 100),
    }));
    const beforeRunway = calculateBusinessRunway(before, accountBalances).daysLeft;
    const afterRunway = calculateBusinessRunway(after, accountBalances).daysLeft;
    const crossedThreshold =
      beforeRunway !== null &&
      afterRunway !== null &&
      [30, 60, 90].some(
        (threshold) =>
          (beforeRunway < threshold && afterRunway >= threshold) ||
          (beforeRunway >= threshold && afterRunway < threshold),
      );
    if (
      beforeRunway !== null &&
      afterRunway !== null &&
      (crossedThreshold || Math.abs(afterRunway - beforeRunway) >= 7)
    ) {
      const improved = afterRunway > beforeRunway;
      reaction = {
        type: 'RUNWAY_CHANGED',
        mood: improved ? 'calm' : 'concern',
        pose: improved ? 'safe' : 'check',
        line: improved ? 'Business runway improved.' : 'Business runway shortened.',
        priority: improved ? 'normal' : 'high',
        intensity: crossedThreshold ? 'major' : 'small',
        direction: improved ? 'improved' : 'worsened',
      };
    }
  }

  if (!reaction) return;
  void import('./lib/melo/reactionBus').then(({ emitMeloReaction }) => {
    emitMeloReaction('companion-root', {
      mood: reaction.mood,
      pose: reaction.pose,
      line: reaction.line,
      durationMs: reaction.intensity === 'major' ? 4_200 : 3_200,
      eventType: reaction.type,
      eventPriority: reaction.priority,
      eventIntensity: reaction.intensity,
      ...(reaction.direction ? { eventDirection: reaction.direction } : {}),
    });
  });
}

function businessMeloSignals(
  business: BusinessOperationsState,
  streak: MeloStreakState,
  quietMode: boolean,
  now: Date,
) {
  const runway = calculateBusinessRunway(
    business,
    (state.accounts ?? []).map((account) => ({
      ...account,
      // Legacy Account.balanceMinor stores major units; Business engines use true minor units.
      balanceMinor: Math.round(account.balanceMinor * 100),
    })),
    now,
  );
  return deriveBusinessMeloSignals({
    business,
    runwayDays: runway.daysLeft,
    quietMode,
    cleanStreakWeeks: streak.count,
    now,
  });
}

export function resetAll() {
  clearPendingAppStateCommands();
  state = normaliseWorkspaceRows(
    {
      ...DEFAULTS,
      transactions: seedTransactions(),
      calendarEvents: [],
      timelineEvents: [],
      incomeSources: [],
    },
    PERSONAL_WORKSPACE_ID,
  );
  persist();
  emit();
}

/**
 * Build a genuinely empty, fully-owned partition for an already-validated workspace root. This is
 * pure and does not publish the partition; the native persistence transaction must encrypt and
 * durably stage it before an active-workspace manifest can point at it.
 */
export function createEmptyWorkspacePartition(
  root: WorkspaceRoot,
  workspaceId: WorkspaceId,
  createdAt: string,
): AppState {
  assertValidWorkspaceRoot(root);
  if (
    String(root.activeWorkspaceId) !== String(workspaceId) ||
    String(root.dataWorkspaceId) !== String(workspaceId)
  ) {
    throw new Error('Empty partition root must select the workspace it owns.');
  }
  if (!Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString() !== createdAt) {
    throw new Error('Empty partition createdAt must be an ISO date.');
  }
  const workspace = root.workspaces.find((candidate) => candidate.id === workspaceId)!;
  const emptyBalance: CurrentBalance = {
    ...EMPTY_BALANCE,
    amount: 0,
    setAt: createdAt,
  };
  const empty: AppState = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workspaces: [...root.workspaces],
    activeWorkspaceId: workspaceId,
    dataWorkspaceId: workspaceId,
    pots: [],
    subs: [],
    subPaused: {},
    subCheckIns: {},
    subOverrides: {},
    cycles: [],
    onboarding: { done: true, name: '', payday: 25, monthlyIncome: 0 },
    currentBalance: emptyBalance,
    accounts: workspace.kind === 'personal' ? [synthesizeDefaultAccount(emptyBalance)] : [],
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
    evidenceDocuments: [],
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
    cancelledSubs: [],
    spendHold: null,
    whatIfHolds: [],
    decisionLedger: [],
    provisionalAnswers: [],
    materialChanges: [],
    correctionImpacts: [],
    criticalJourneyContinuity: [],
    meloPrimerSeen: false,
    meloPrimerBeat: 0,
    meloPrimerSeenAt: null,
    lastOpenedAt: null,
    oneMoveHistory: [],
    meloMoves: [],
    meloDismissLog: [],
    meloMemoryThread: [],
    meloForgottenMemoryIds: [],
    business: emptyBusinessOperationsState(),
    lens: { ...DEFAULT_LENS },
    melo: { ...DEFAULT_MELO, wardrobe: [] },
    stage: createPhoenixStageState(createdAt),
    streak: createMeloStreakState(createdAt),
    chartStyle: 'curve',
    tinyWins: [],
    timelineEvents: [],
    incomeSources: [],
    merchantCategories: {},
  };
  return normaliseWorkspaceRows(empty, workspaceId);
}

/** CLEAN-EMPTY reset — wipe the user's data to a genuinely empty state, with NO
 *  sample/demo reseed (the opposite of `resetAll`, which reseeds the demo set).
 *  Every user-data slot is cleared: transactions, pots, subs, the sub
 *  paused/override maps, ritual cycles, the correction-edit history, calendar
 *  events, the pot ledger, and the staged statement-reader review queue. The
 *  balance becomes a neutral, honest empty (£0, `user-entered`/`rough` — NOT
 *  `sample`). Personally identifying setup values are cleared too; only
 *  `onboarding.done` defaults to true so a returning clean user is NOT re-onboarded. Callers such
 *  as "Skip for now" may explicitly keep it false while still clearing all data.
 *  `schemaVersion` is preserved so the empty state still loads through the same
 *  migration contract. Pure + immutable — builds a brand-new state object, never
 *  mutates the previous one. */
export function resetToEmpty(options?: Readonly<{ onboardingDone?: boolean }>) {
  clearPendingAppStateCommands(state.activeWorkspaceId);
  const emptyBalance: CurrentBalance = { ...EMPTY_BALANCE, setAt: new Date().toISOString() };
  const workspaceRoot = assertValidWorkspaceRoot({
    workspaces: [...state.workspaces],
    activeWorkspaceId: state.activeWorkspaceId,
    dataWorkspaceId: state.dataWorkspaceId,
  });
  const activeWorkspace = workspaceRoot.workspaces.find(
    (workspace) => workspace.id === workspaceRoot.activeWorkspaceId,
  )!;
  const empty: AppState = {
    schemaVersion: state.schemaVersion,
    ...workspaceRoot,
    pots: [],
    subs: [],
    subPaused: {},
    subCheckIns: {},
    subOverrides: {},
    cycles: [],
    // Keep only the non-identifying completion flag so a deliberate local wipe does not force the
    // returning user through onboarding. Name, payday and income are all user data and must not
    // survive a control labelled "Clear local money & history". The shipped payday default is a
    // structural placeholder only; no prior user value is retained.
    onboarding: {
      done: options?.onboardingDone ?? true,
      name: '',
      payday: DEFAULTS.onboarding.payday,
      monthlyIncome: 0,
    },
    currentBalance: emptyBalance,
    // Personal keeps its neutral Main shell; a Business partition remains genuinely accountless
    // until the user adds or connects an account.
    accounts: activeWorkspace.kind === 'personal' ? [synthesizeDefaultAccount(emptyBalance)] : [],
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
    evidenceDocuments: [],
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
    cancelledSubs: [],
    spendHold: null,
    whatIfHolds: [],
    decisionLedger: [],
    provisionalAnswers: [],
    materialChanges: [],
    correctionImpacts: [],
    criticalJourneyContinuity: [],
    meloPrimerSeen: false,
    meloPrimerBeat: 0,
    meloPrimerSeenAt: null,
    lastOpenedAt: null,
    oneMoveHistory: [],
    meloMoves: [],
    meloDismissLog: [],
    meloMemoryThread: [],
    meloForgottenMemoryIds: [],
    business: emptyBusinessOperationsState(),
    lens: {
      plusUnlocked: false,
      proUnlocked: false,
      trialCycleId: null,
      trialEndedCycleId: null,
      trialEndAcknowledged: true,
    },
    melo: { quietMode: false, wardrobe: [], tone: 'calm' },
    stage: createPhoenixStageState(emptyBalance.setAt),
    streak: createMeloStreakState(emptyBalance.setAt),
    chartStyle: 'curve',
    tinyWins: [],
    timelineEvents: [],
    incomeSources: [],
    merchantCategories: {},
  };
  state = normaliseWorkspaceRows(empty, workspaceRoot.activeWorkspaceId);
  persist();
  emit();
}

/** Pure selector — true when the app holds any real user data (transactions,
 *  pots, subs, or ritual cycles). Lets a surface tell a genuinely-used app from
 *  a fresh/empty one (e.g. after `resetToEmpty`, this is false). No state read of
 *  its own — operates only on the snapshot it's given, so it's safe to call from
 *  selectors, `load()`, or tests. */
export function hasAnyUserData(s: AppState): boolean {
  return s.transactions.length > 0 || s.pots.length > 0 || s.subs.length > 0 || s.cycles.length > 0;
}

/**
 * True when Today has enough user-owned information to present a money picture instead of the
 * honest empty doorway. This deliberately does not treat `onboarding.done` or a non-sample £0
 * balance as evidence: both survive `resetToEmpty()`, and neither can support a claim about making
 * it to payday. Unlike `hasAnyUserData`, this also includes the finance inputs that can drive a
 * useful route without a posted transaction yet.
 */
export function hasConfiguredMoneyPicture(s: AppState): boolean {
  return (
    hasAnyUserData(s) ||
    s.currentBalance.amount !== 0 ||
    s.onboarding.monthlyIncome > 0 ||
    (s.incomeSources?.length ?? 0) > 0 ||
    (s.statementImports?.length ?? 0) > 0 ||
    (s.debts?.length ?? 0) > 0 ||
    (s.plans?.length ?? 0) > 0 ||
    s.calendarEvents.length > 0
  );
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
 *  slot in the app. Both the current clean first-run state and an untouched legacy sample state are
 *  empty by this check. A real statement/user balance is never considered empty. */
export function isEmptyForMeloImport(s: AppState): boolean {
  const noTransactions = s.transactions.length === 0;
  const noDebts = (s.debts ?? []).length === 0;
  const noOnboarding = !s.onboarding.done;
  const noOwnedBalance =
    s.currentBalance.source === 'sample' ||
    (s.currentBalance.source === 'user-entered' && s.currentBalance.amount === 0);
  return noTransactions && noDebts && noOnboarding && noOwnedBalance;
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
  setPartialWithTypedCommand(patch, {
    commandType: 'folio.legacy_melo.import.v1',
    actorKind: 'import',
    entityRefs: [
      {
        type: 'legacy-import',
        id: `melo-${fnv1a32Hex(String(state.activeWorkspaceId), 0x811c9dc5)}`,
      },
    ],
    before: {},
    after: { importedState: patch },
    invalidatedProjectionKinds: [
      'accounts',
      'account-balances',
      'transactions',
      'debt-summary',
      'cashflow',
    ],
  });
  return true;
}

/** Debug: shift every dated thing backwards by ~30 days and add a synthetic
 *  closed cycle. Lets us demo Insights without waiting a month. */
export function fastForwardMonth() {
  const day = 86_400_000;
  const shift = 30 * day;
  const newCycle: CycleRecord = {
    closedAt: currentFinancialDate(),
    label: new Date().toLocaleString('en-GB', { month: 'long' }),
    spare: 80 + Math.round(Math.random() * 120),
    tightPoint: 30 + Math.round(Math.random() * 60),
    setAside: 50 + Math.round(Math.random() * 40),
    note: 'Auto-closed via fast-forward.',
  };
  const agedCycles = state.cycles.map((c) => ({
    ...c,
    closedAt: addDaysToLocalDate(c.closedAt, -30),
  }));
  const agedTxns = state.transactions.map((t) => ({
    ...t,
    when: new Date(new Date(t.when).getTime() - shift).toISOString(),
  }));
  // Roll every sub forward into its next cycle; bump lastUsed and renewal count.
  const agedSubs = state.subs.map((s) => ({
    ...s,
    nextRenewalDaysAway: s.nextRenewalDaysAway <= 0 ? 30 : s.nextRenewalDaysAway,
    // Re-stamp the date anchor to match the rolled day count — without this the next hydration's
    // re-anchor (lib/renewalMath.ts) would recompute from the OLD anchor and undo the demo shift.
    nextRenewalISO: anchorIsoFor(
      s.nextRenewalDaysAway <= 0 ? 30 : s.nextRenewalDaysAway,
      currentFinancialDate(),
    ),
    lastUsedDaysAgo: s.lastUsedDaysAgo + 30,
    renewalCount: (s.renewalCount ?? 0) + 1,
  }));
  setPartialWithTypedCommand(
    {
      cycles: [newCycle, ...agedCycles].slice(0, 24),
      transactions: agedTxns,
      subs: agedSubs,
    },
    {
      commandType: 'folio.debug.fast_forward_month.v1',
      actorKind: 'system',
      entityRefs: [
        {
          type: 'debug-simulation',
          id: `month-${fnv1a32Hex(String(state.activeWorkspaceId), 0x01000193)}`,
        },
      ],
      before: {
        cycles: state.cycles,
        transactions: state.transactions,
        subscriptions: state.subs,
      },
      after: {
        cycles: [newCycle, ...agedCycles].slice(0, 24),
        transactions: agedTxns,
        subscriptions: agedSubs,
      },
      invalidatedProjectionKinds: [
        'cycles',
        'insights',
        'transactions',
        'subscriptions',
        'cashflow',
        'calendar',
      ],
    },
  );
}

/* ---------- Melo tool bridge ----------
 * Melo's server-side tools return a friendly message; the actual app state
 * change happens here on the client when a tool part finishes streaming.
 * Each tool returns an `undo` closure so the chat can offer a one-tap revert.
 * The user-confirmed contract has six Personal and six Business tools. Every
 * tool is scoped to the active encrypted workspace and returns an undo closure.
 */
export type { MeloToolName } from './lib/melo/toolContract';

export type MeloToolResult =
  | { applied: true; summary: string; undo: () => void }
  | { applied: false; reason: string }
  | { applied: false; reason: string; candidates: string[] };

/** ENGINES.md § 6 "Melo — tool name matching". Normalise a tool name the
 *  model emitted (lowercase / trim / strip punctuation → single spaces) so a
 *  loosely-named tool still resolves. Used by both `matchMeloTool` and
 *  `applyMeloTool`. Pure. */
export function normaliseMeloToolName(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
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

type NamedMeloTarget = Readonly<{ id: string; label: string; aliases?: readonly string[] }>;

function normaliseMeloTargetName(value: unknown): string {
  return String(value ?? '')
    .toLocaleLowerCase('en-GB')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function resolveMeloTarget(
  query: unknown,
  targets: readonly NamedMeloTarget[],
): { ok: true; target: NamedMeloTarget } | { ok: false; candidates: string[] } {
  const wanted = normaliseMeloTargetName(query);
  if (!wanted) {
    return targets.length === 1
      ? { ok: true, target: targets[0]! }
      : { ok: false, candidates: targets.map((target) => target.label) };
  }
  const namesFor = (target: NamedMeloTarget) =>
    [target.label, ...(target.aliases ?? [])]
      .map(normaliseMeloTargetName)
      .filter((name) => name.length > 0);
  const exact = targets.filter((target) => namesFor(target).includes(wanted));
  if (exact.length === 1) return { ok: true, target: exact[0]! };
  if (exact.length > 1) return { ok: false, candidates: exact.map((target) => target.label) };
  const contained = targets.filter((target) =>
    namesFor(target).some((name) => name.includes(wanted) || wanted.includes(name)),
  );
  return contained.length === 1
    ? { ok: true, target: contained[0]! }
    : { ok: false, candidates: contained.map((target) => target.label) };
}

function workspaceKind(): 'personal' | 'business' | null {
  return (
    state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.kind ?? null
  );
}

function workspaceMismatch(name: MeloToolName): MeloToolResult | null {
  const kind = workspaceKind();
  if (kind === 'personal' && isBusinessMeloTool(name)) {
    return { applied: false, reason: 'Switch to a Business workspace first.' };
  }
  if (kind === 'business' && isPersonalMeloTool(name)) {
    return { applied: false, reason: 'Switch to Personal first.' };
  }
  return kind === null ? { applied: false, reason: 'No active workspace.' } : null;
}

function positiveAmount(value: unknown): number | null {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function validIsoDay(value: unknown): string | null {
  const day = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`))
    ? day
    : null;
}

function businessCashAccount(
  input: Record<string, unknown>,
): { ok: true; account: Account } | { ok: false; result: MeloToolResult } {
  const accounts = (state.accounts ?? []).filter(
    (account) => !account.isLiability && account.closed !== true,
  );
  const resolved = resolveMeloTarget(
    input.account ?? input.accountName,
    accounts.map((account) => ({ id: account.id, label: account.name })),
  );
  if (!resolved.ok) {
    return {
      ok: false,
      result: {
        applied: false,
        reason: accounts.length === 0 ? 'Add a Business cash account first.' : 'Choose an account.',
        candidates: resolved.candidates,
      },
    };
  }
  const account = accounts.find((candidate) => candidate.id === resolved.target.id);
  return account
    ? { ok: true, account }
    : { ok: false, result: { applied: false, reason: 'Account is unavailable.' } };
}

function recordBusinessCash(
  input: Record<string, unknown>,
  label: string,
  amount: number,
  category: Transaction['category'],
): MeloToolResult {
  const selected = businessCashAccount(input);
  if (!selected.ok) return selected.result;
  const accountId = selected.account.id;
  const when = new Date().toISOString();
  const created = addTransaction({
    merchant: label,
    amount,
    category,
    source: 'melo',
    accountId,
    when,
  });
  setAccountBalance(accountId, selected.account.balanceMinor + amount, when, {
    source: 'corrected',
    confidence: 'corrected',
  });
  updateBusinessOperations({});
  return {
    applied: true,
    summary: `${amount < 0 ? 'Logged' : 'Recorded'} £${Math.abs(amount).toFixed(2)} ${
      amount < 0 ? 'paid to' : 'received from'
    } ${label}`,
    undo: () => {
      removeTransaction(created.id);
      const current = (state.accounts ?? []).find((account) => account.id === accountId);
      if (current) setAccountBalance(accountId, current.balanceMinor - amount);
      updateBusinessOperations({});
    },
  };
}

/* ---------- Melo tool family ----------
 * Every tool is candidate/honest: Melo proposes, the user confirms in chat,
 * and each successful result carries a six-second undo closure.
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
  const mismatch = workspaceMismatch(matched.name);
  if (mismatch) return mismatch;
  switch (matched.name) {
    case 'log_spend': {
      const merchant = String(input.merchant ?? '').trim();
      const amount = Number(input.amount ?? 0);
      const category = coerceCategory(input.category);
      if (!merchant || !(amount > 0)) return { applied: false, reason: 'bad args' };
      const created = addTransaction({ merchant, amount: -amount, category, source: 'melo' });
      recordMaterialDecision({
        idempotencyKey: `melo_log_spend_${created.id}`,
        decisionType: 'melo-confirmed-action',
        contextRoute: 'melo',
        question: `Log £${amount.toFixed(2)} at ${merchant}.`,
        questionSource: 'melo-proposed',
        priority: 'manual_adjustment',
        amountMinor: -Math.round(amount * 100),
        confirmedAction: true,
        outcome: 'awaiting',
        now: created.when,
        meloExplanation: 'Melo applied this only after the user confirmed the tool action.',
      });
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
      recordMaterialDecision({
        idempotencyKey: `melo_log_income_${created.id}`,
        decisionType: 'melo-confirmed-action',
        contextRoute: 'melo',
        question: `Log £${amount.toFixed(2)} in from ${merchant}.`,
        questionSource: 'melo-proposed',
        priority: 'manual_adjustment',
        amountMinor: Math.round(amount * 100),
        confirmedAction: true,
        outcome: 'awaiting',
        now: created.when,
        meloExplanation: 'Melo applied this only after the user confirmed the tool action.',
      });
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
      recordMaterialDecision({
        idempotencyKey: `melo_log_refund_${created.id}`,
        decisionType: 'melo-confirmed-action',
        contextRoute: 'melo',
        question: `Log £${amount.toFixed(2)} refund from ${merchant}.`,
        questionSource: 'melo-proposed',
        priority: 'manual_adjustment',
        amountMinor: Math.round(amount * 100),
        confirmedAction: true,
        outcome: 'awaiting',
        now: created.when,
        meloExplanation: 'Melo applied this only after the user confirmed the tool action.',
      });
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
      recordMaterialDecision({
        idempotencyKey: `melo_log_transfer_${outLeg.id}_${inLeg.id}`,
        decisionType: 'melo-confirmed-action',
        contextRoute: 'melo',
        question: `Log £${amount.toFixed(2)} transfer ${from} to ${to}.`,
        questionSource: 'melo-proposed',
        priority: 'manual_adjustment',
        amountMinor: Math.round(amount * 100),
        confirmedAction: true,
        outcome: 'awaiting',
        now: when,
        meloExplanation: 'Melo applied this only after the user confirmed the tool action.',
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
    case 'addToPot':
    case 'borrowFromPot': {
      const amount = positiveAmount(input.amount);
      const resolved = resolveMeloTarget(
        input.pot ?? input.potName ?? input.name,
        state.pots.map((pot) => ({ id: pot.id, label: pot.name })),
      );
      if (amount === null) return { applied: false, reason: 'Enter a positive amount.' };
      if (!resolved.ok) {
        return {
          applied: false,
          reason: state.pots.length === 0 ? 'Add a pot first.' : 'Choose a pot.',
          candidates: resolved.candidates,
        };
      }
      const pot = state.pots.find((candidate) => candidate.id === resolved.target.id);
      if (!pot) return { applied: false, reason: 'Pot is unavailable.' };
      const ledgerIdsBefore = new Set(state.potLedger.map((entry) => entry.id));
      if (matched.name === 'borrowFromPot') {
        if (!borrowFromPot(pot.id, amount, 'melo')) {
          return { applied: false, reason: `${pot.name} does not hold enough.` };
        }
      } else {
        addToPot(pot.id, amount, 'melo');
      }
      const ledgerEntry = state.potLedger.find((entry) => !ledgerIdsBefore.has(entry.id));
      return {
        applied: true,
        summary:
          matched.name === 'addToPot'
            ? `Added £${amount.toFixed(2)} to ${pot.name}`
            : `Borrowed £${amount.toFixed(2)} from ${pot.name}`,
        undo: () =>
          setPartial({
            pots: state.pots.map((candidate) =>
              candidate.id === pot.id
                ? {
                    ...candidate,
                    saved: candidate.saved + (matched.name === 'addToPot' ? -amount : amount),
                  }
                : candidate,
            ),
            potLedger: ledgerEntry
              ? state.potLedger.filter((entry) => entry.id !== ledgerEntry.id)
              : state.potLedger,
          }),
      };
    }
    case 'log_business_expense': {
      const amount = positiveAmount(input.amount);
      const merchant = String(input.merchant ?? input.payee ?? input.label ?? '').trim();
      if (amount === null || !merchant) return { applied: false, reason: 'bad args' };
      return recordBusinessCash(input, merchant, -amount, coerceCategory(input.category));
    }
    case 'log_business_income': {
      const amount = positiveAmount(input.amount);
      const source = String(input.source ?? input.merchant ?? input.payer ?? '').trim();
      if (amount === null || !source) return { applied: false, reason: 'bad args' };
      return recordBusinessCash(input, source, amount, 'income');
    }
    case 'log_invoice_sent': {
      const amount = positiveAmount(input.amount);
      const dueOn = validIsoDay(input.dueOn);
      const issuedOn = validIsoDay(input.issuedOn) ?? currentFinancialDate();
      const business = normaliseBusinessOperationsState(state.business);
      const resolved = resolveMeloTarget(
        input.client ?? input.clientName,
        business.clients.map((client) => ({ id: client.id, label: client.name })),
      );
      if (amount === null || dueOn === null) {
        return { applied: false, reason: 'Amount and due date are required.' };
      }
      if (!resolved.ok) {
        return {
          applied: false,
          reason: business.clients.length === 0 ? 'Add the client first.' : 'Choose a client.',
          candidates: resolved.candidates,
        };
      }
      const client = business.clients.find((candidate) => candidate.id === resolved.target.id);
      if (!client) return { applied: false, reason: 'Client is unavailable.' };
      const now = new Date().toISOString();
      const invoiceId = `invoice-melo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const invoice = {
        id: invoiceId,
        clientId: client.id,
        clientName: client.name,
        ...(String(input.reference ?? '').trim()
          ? { reference: String(input.reference).trim() }
          : {}),
        issuedOn,
        dueOn,
        totalMinor: Math.round(amount * 100),
        paidMinor: 0,
        status: 'issued' as const,
      };
      const firstInvoice = business.invoices.length === 0;
      updateBusinessOperations((current) => ({
        invoices: [...current.invoices, invoice],
        memory: firstInvoice
          ? [
              {
                id: `business-memory-${invoiceId}`,
                at: now,
                kind: 'first-invoice' as const,
                summary: `The first invoice was issued to ${client.name}.`,
                reflected: false,
              },
              ...current.memory,
            ].slice(0, 200)
          : current.memory,
      }));
      return {
        applied: true,
        summary: `Recorded £${amount.toFixed(2)} invoice sent to ${client.name}`,
        undo: () =>
          updateBusinessOperations((current) => ({
            invoices: current.invoices.filter((candidate) => candidate.id !== invoiceId),
            memory: current.memory.filter(
              (candidate) => candidate.id !== `business-memory-${invoiceId}`,
            ),
          })),
      };
    }
    case 'log_invoice_paid': {
      const business = normaliseBusinessOperationsState(state.business);
      const open = business.invoices.filter(
        (invoice) =>
          !['paid', 'void', 'credited'].includes(invoice.status) &&
          invoice.totalMinor > invoice.paidMinor,
      );
      const resolved = resolveMeloTarget(
        input.invoice ?? input.reference ?? input.client ?? input.clientName,
        open.map((invoice) => ({
          id: invoice.id,
          label: invoice.reference
            ? `${invoice.clientName} · ${invoice.reference}`
            : `${invoice.clientName} · due ${invoice.dueOn}`,
          aliases: [invoice.id, invoice.reference ?? '', invoice.clientName],
        })),
      );
      if (!resolved.ok) {
        return {
          applied: false,
          reason: open.length === 0 ? 'No open invoice was found.' : 'Choose an invoice.',
          candidates: resolved.candidates,
        };
      }
      const invoice = open.find((candidate) => candidate.id === resolved.target.id);
      if (!invoice) return { applied: false, reason: 'Invoice is unavailable.' };
      const remainingMinor = invoice.totalMinor - invoice.paidMinor;
      const requested =
        input.amount === undefined ? remainingMinor / 100 : positiveAmount(input.amount);
      if (requested === null || Math.round(requested * 100) > remainingMinor) {
        return { applied: false, reason: 'Payment exceeds the invoice balance.' };
      }
      const selected = businessCashAccount(input);
      if (!selected.ok) return selected.result;
      const paidMinor = Math.round(requested * 100);
      const paidOn = validIsoDay(input.paidOn) ?? currentFinancialDate();
      const now = new Date().toISOString();
      setAccountBalance(selected.account.id, selected.account.balanceMinor + requested, now, {
        source: 'corrected',
        confidence: 'corrected',
      });
      updateBusinessOperations((current) => ({
        invoices: current.invoices.map((candidate) =>
          candidate.id === invoice.id
            ? {
                ...candidate,
                paidMinor: candidate.paidMinor + paidMinor,
                paidOn,
                status:
                  candidate.paidMinor + paidMinor >= candidate.totalMinor
                    ? ('paid' as const)
                    : ('part-paid' as const),
              }
            : candidate,
        ),
        memory: [
          {
            id: `business-memory-paid-${invoice.id}-${Date.now()}`,
            at: now,
            kind: 'invoice-paid' as const,
            summary: `${invoice.clientName} paid £${requested.toFixed(2)}.`,
            reflected: false,
          },
          ...current.memory,
        ].slice(0, 200),
      }));
      const memoryId = normaliseBusinessOperationsState(state.business).memory[0]?.id;
      return {
        applied: true,
        summary: `Recorded £${requested.toFixed(2)} paid by ${invoice.clientName}`,
        undo: () => {
          const currentAccount = (state.accounts ?? []).find(
            (account) => account.id === selected.account.id,
          );
          if (currentAccount) {
            setAccountBalance(selected.account.id, currentAccount.balanceMinor - requested);
          }
          updateBusinessOperations((current) => ({
            invoices: current.invoices.map((candidate) =>
              candidate.id === invoice.id ? invoice : candidate,
            ),
            memory: memoryId
              ? current.memory.filter((candidate) => candidate.id !== memoryId)
              : current.memory,
          }));
        },
      };
    }
    case 'log_owner_draw': {
      const amount = positiveAmount(input.amount);
      const note = String(input.note ?? 'Owner draw').trim() || 'Owner draw';
      if (amount === null) return { applied: false, reason: 'bad args' };
      const business = normaliseBusinessOperationsState(state.business);
      const selected = businessCashAccount(input);
      if (!selected.ok) return selected.result;
      const result = recordBusinessCash(input, note, -amount, 'other');
      if (!result.applied || business.entity?.kind !== 'ltd') return result;
      const movementId = `dla-melo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      updateBusinessOperations((current) => ({
        dla: [
          ...current.dla,
          {
            id: movementId,
            date: currentFinancialDate(),
            amountMinor: Math.round(amount * 100),
            note,
          },
        ],
      }));
      return {
        applied: true,
        summary: result.summary,
        undo: () => {
          result.undo();
          updateBusinessOperations((current) => ({
            dla: current.dla.filter((movement) => movement.id !== movementId),
          }));
        },
      };
    }
    case 'log_dividend': {
      const amount = positiveAmount(input.amount);
      const business = normaliseBusinessOperationsState(state.business);
      if (business.entity?.kind !== 'ltd') {
        return { applied: false, reason: 'Dividends require a limited company.' };
      }
      const resolved = resolveMeloTarget(
        input.shareholder ?? input.recipient ?? input.name,
        business.entity.shareholders.map((shareholder) => ({
          id: shareholder.id,
          label: shareholder.name,
        })),
      );
      if (amount === null) return { applied: false, reason: 'bad args' };
      if (!resolved.ok) {
        return {
          applied: false,
          reason:
            business.entity.shareholders.length === 0
              ? 'Add a shareholder first.'
              : 'Choose a shareholder.',
          candidates: resolved.candidates,
        };
      }
      const shareholder = business.entity.shareholders.find(
        (candidate) => candidate.id === resolved.target.id,
      );
      const totalMinor = Math.round(amount * 100);
      if (!shareholder) return { applied: false, reason: 'Shareholder is unavailable.' };
      if (totalMinor > distributableReservesMinor(business)) {
        return { applied: false, reason: 'The dividend exceeds distributable reserves.' };
      }
      const dividendId = `dividend-melo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      updateBusinessOperations((current) => ({
        dividends: [
          ...current.dividends,
          {
            id: dividendId,
            shareholderId: shareholder.id,
            declaredOn: validIsoDay(input.declaredOn) ?? currentFinancialDate(),
            totalMinor,
            amountPerShareMinor: Math.round(totalMinor / Math.max(1, shareholder.shares)),
            otherIncomeMinor: Math.max(0, Math.round(Number(input.otherIncome ?? 0) * 100)),
          },
        ],
      }));
      return {
        applied: true,
        summary: `Declared £${amount.toFixed(2)} dividend for ${shareholder.name}`,
        undo: () =>
          updateBusinessOperations((current) => ({
            dividends: current.dividends.filter((dividend) => dividend.id !== dividendId),
          })),
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
    () => selector(getState()),
    () => selector(requireWorkspaceRows(DEFAULTS, PERSONAL_WORKSPACE_ID)),
  );
}
