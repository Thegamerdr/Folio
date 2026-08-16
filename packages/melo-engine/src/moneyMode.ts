/**
 * Money mode: the top-level framing for how the app should talk about the current cycle
 * (survival, stability, growth, and so on). Deterministic and pure — manualMode always wins
 * (the user's own framing is never overridden), and every other signal falls back through a
 * fixed priority order. MODE_LABELS carries the calm, warm one-line copy for each mode, and
 * every line is asserted with lintCopy in the test file.
 */

import { assertPence, type Pence } from './core.js';
import { lintCopy } from './copy.js';

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
  | 'lowVisibility';

export interface MoneyModeInputs {
  readonly ladder: string;
  readonly journey: string;
  readonly billsCovered: boolean;
  readonly savingsThisCyclePence: Pence;
  readonly cyclesEndedPositive: number;
  readonly incomeVaries: boolean;
  readonly quietMode: boolean;
  readonly hasDebtBills: boolean;
  readonly manualMode: MoneyMode | null;
}

const GROWTH_STREAK_THRESHOLD = 2;
const CALM_LADDERS = new Set(['calm', 'protected']);
const RECOVERY_JOURNEYS = new Set(['recovery', 'rebuilding']);
const DANGER_LADDERS = new Set(['danger', 'overspent']);

/**
 * Resolves the mode in fixed priority order once manualMode is off the table: quiet mode,
 * reset (mid-recovery), survival (danger ladder), irregular income, debt bills, growth
 * (a real positive streak with savings this cycle), optimizer (stable, bills-covered, but not
 * yet saving — sits between stability and growth), stability (bills covered and calm), and
 * planning as the honest default when nothing else applies.
 */
export function resolveMoneyMode(inputs: MoneyModeInputs): MoneyMode {
  if (inputs.manualMode !== null) return inputs.manualMode;
  assertPence(inputs.savingsThisCyclePence, 'savingsThisCyclePence');

  if (inputs.quietMode) return 'lowVisibility';
  if (RECOVERY_JOURNEYS.has(inputs.journey)) return 'reset';
  if (DANGER_LADDERS.has(inputs.ladder)) return 'survival';
  if (inputs.incomeVaries) return 'irregular';
  if (inputs.hasDebtBills) return 'debt';
  if (inputs.cyclesEndedPositive >= GROWTH_STREAK_THRESHOLD && inputs.savingsThisCyclePence > 0) {
    return 'growth';
  }
  if (
    inputs.billsCovered &&
    inputs.cyclesEndedPositive >= 1 &&
    inputs.savingsThisCyclePence === 0
  ) {
    return 'optimizer';
  }
  if (inputs.billsCovered && CALM_LADDERS.has(inputs.ladder)) return 'stability';
  return 'planning';
}

export const MODE_LABELS: Record<MoneyMode, { readonly name: string; readonly line: string }> = {
  survival: {
    name: 'Survival',
    line: 'Getting to payday — that is the whole job right now.',
  },
  stability: {
    name: 'Stability',
    line: 'Bills covered, buffer holding. Steady is the goal here.',
  },
  growth: {
    name: 'Growth',
    line: 'A real run of good cycles — the spare is starting to add up.',
  },
  debt: {
    name: 'Paying down',
    line: 'One clear job this cycle: keep the debt bills moving down.',
  },
  irregular: {
    name: 'Irregular income',
    line: 'Money comes in waves here — the plan flexes with it, not against it.',
  },
  household: {
    name: 'Household',
    line: 'Shared money, shared plan — everyone sees the same honest picture.',
  },
  planning: {
    name: 'Planning',
    line: 'Nothing urgent today — a good stretch to plan a little ahead.',
  },
  optimizer: {
    name: 'Optimizer',
    line: 'Steady and covered — a good moment to spot what is quietly leaking.',
  },
  reset: {
    name: 'Reset',
    line: 'Finding solid ground, one small step at a time.',
  },
  lowVisibility: {
    name: 'Quiet mode',
    line: 'Kept deliberately quiet — open the app any time for the full picture.',
  },
};

// Enforced once at module load: every mode line must pass the same copy law as the rest of
// the app's user-facing strings.
for (const [mode, { line }] of Object.entries(MODE_LABELS)) {
  const violations = lintCopy(line);
  if (violations.length > 0) {
    throw new Error(`MODE_LABELS.${mode} line failed lintCopy: ${violations.join(', ')}`);
  }
}
