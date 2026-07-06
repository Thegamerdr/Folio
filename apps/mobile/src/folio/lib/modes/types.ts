/**
 * Money Mode — the user's declared current financial situation.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/types.ts`, 1:1. Ten
 * modes; every mode has a real strategy (see `strategies/`).
 *
 * This file is intentionally tiny and dependency-free so the store, the
 * strategies, and the UI can all import from it without a cycle.
 */
import type {
  Sub,
  Pot,
  Onboarding,
  CurrentBalance,
  Debt,
  Household,
  Plan,
  Transaction,
  IncomeSource,
} from '../../store';
import type { MeloMood, MeloPose } from '../../melo/Melo';

/** RN's canonical Melo has no `MeloWeather` type yet — the source design's
 *  weather vocabulary (sunny/cloudy/rainy/storm/rainbow/night/alarm, plus
 *  mode-extended fog/windy/heatwave/freeze) isn't wired into a native
 *  surface anywhere in this worktree. Declared locally so every strategy
 *  can port its weather logic verbatim without inventing a different union
 *  or blocking on a UI surface that doesn't exist yet. */
export type MeloWeather =
  | 'sunny'
  | 'cloudy'
  | 'rainy'
  | 'storm'
  | 'rainbow'
  | 'night'
  | 'alarm'
  | 'fog';

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

/** Whether a given mode currently has a real strategy. All ten modes ship a
 *  full strategy in this port (mirrors the design source's shipped set —
 *  the design source's own comment about "only survival + stability" is
 *  stale relative to its own strategies/ directory, which has all ten). */
export const MODE_SHIP_STATUS: Record<MoneyMode, 'shipped' | 'parked'> = {
  survival: 'shipped',
  stability: 'shipped',
  growth: 'shipped',
  debt: 'shipped',
  irregular: 'shipped',
  household: 'shipped',
  planning: 'shipped',
  optimizer: 'shipped',
  reset: 'shipped',
  lowVis: 'shipped',
};

/** Short human labels for pickers. Never used as verdict copy. */
export const MODE_LABEL: Record<MoneyMode, string> = {
  survival: 'Make it to payday',
  stability: 'Stay in control',
  growth: 'Build savings',
  debt: 'Pay down debt',
  irregular: 'Handle irregular income',
  household: 'Share bills with someone',
  planning: 'Plan a big purchase',
  optimizer: 'Cut waste',
  reset: 'Get back on track',
  lowVis: 'Just see what’s going on',
};

/** Snapshot passed to every strategy. Kept flat so strategies stay pure. */
export type ModeInputs = {
  currentBalance: CurrentBalance;
  onboarding: Onboarding;
  pots: Pot[];
  subs: Sub[];
  subPaused: Record<string, boolean>;
  /** From the caller's route/tightest-point computation. Signed £. */
  tightestSpare: number;
  tightestDate: string | null;
  /** Optional context — passed through to weather threshold logic. */
  unfamiliarSubCaught?: boolean;
  ritualCompletedRecently?: boolean;
  /** Local hour 0-23; enables `night` weather. */
  hour?: number;
  /** User-declared safety buffer (£). Stability + several other modes use
   *  it. Defaults to £100 when unset. */
  bufferAmount?: number;
  /** Outstanding debts. Read by the Debt lens strategy + amortisation
   *  engine. Empty for users who haven't declared any. */
  debts?: Debt[];
  /** Household lens shared-bills state. Read by the Household strategy.
   *  Absent for users on any other lens (falls back to 50/50 default). */
  household?: Household;
  /** Planning lens plans. Read by the Planning strategy + planEngine.
   *  Absent for users off the lens. */
  plans?: Plan[];
  /** The ledger (store `transactions`) — DATA_INTELLIGENCE.md phase ⑥.
   *  Read by the Irregular strategy's history-fed income floor
   *  (`historyStats.monthlyIncomeSeries`). Absent/empty falls back to the
   *  strategy's pre-history behaviour unchanged (see irregular.ts). Optional
   *  so every existing call site (none of which currently threads history)
   *  keeps compiling untouched. */
  transactions?: Transaction[];
  /** Declared income sources (store `incomeSources`) — read alongside
   *  `transactions` by the Irregular strategy so its history-fed floor can
   *  tell how many full months of income history actually exist. Optional,
   *  same reasoning as `transactions`. */
  incomeSources?: IncomeSource[];
  /** "Today" as an ISO "YYYY-MM-DD", for the strategy's history window
   *  (current in-progress month is always excluded from any history-fed
   *  math — see historyStats.ts). Optional; a strategy without history
   *  input has no use for it. */
  todayISO?: string;
};

/** What a Safe Zone number means in this mode. `formula` is a plain-English
 *  caption ("safe to spend this month"). `priority` is the underlying
 *  commitment the number protects. */
export type SafeZone = {
  /** Signed £. Negative = the priority isn't currently protected. */
  amount: number;
  /** e.g. "reach payday", "protect this month's bills", "hit the goal". */
  priority: string;
  /** Small caption — the honest label. */
  formula: string;
  confidence: 'high' | 'estimating' | 'low';
  /** Optional context date, e.g. tightest-point date. */
  date?: string | null;
};

/** Per-mode Melo voice tint. Fed into the system prompt alongside the
 *  existing MeloTone (calm/honest/dry/coachy). One canonical Melo — this
 *  changes register, not identity. */
export type MeloVoiceTint = {
  /** Short label ("protector", "calm guide", ...). Never user-facing. */
  archetype: string;
  /** One-sentence directive injected into the system prompt. */
  directive: string;
};

/** The full mode-derived view Today (and any future mode-aware surface)
 *  reads. Melo mood/pose/weather live here so the strategy owns the
 *  vocabulary end-to-end. */
export type ModeState = {
  mode: MoneyMode;
  safeZone: SafeZone;
  /** Verdict headline — the italic accent line. Uses the one-accent-word
   *  rule from the design system (accent word marked client-side). */
  verdict: string;
  /** Small caption under the big number ("safe to spend this month"). */
  spareLabel: string;
  /** Melo mood/pose/weather. Strategies own the derivation so weather
   *  thresholds can differ per mode without a switch tree in one file. */
  mood: MeloMood;
  pose: MeloPose;
  weather: MeloWeather;
  voice: MeloVoiceTint;
};

/** The strategy contract every mode plugin implements. Pure. No side effects. */
export type ModeStrategy = {
  mode: MoneyMode;
  derive: (inputs: ModeInputs) => ModeState;
};
