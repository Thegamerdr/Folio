/**
 * @rn-lib       modeSuggest
 * @purpose      Honest mode auto-detection. Reads the same snapshot the
 *               strategies use and returns AT MOST one suggestion: the
 *               mode the user's data currently looks like, and a short
 *               human reason. Never switches silently — Today shows the
 *               suggestion as a dismissible banner; the actual switch is
 *               always a user tap.
 * @reads        ModeInputs (subs, pots, onboarding, currentBalance, tight)
 * @writes       —
 * @notes        RN port of folio-melo (design-main) `src/lib/modes/suggest.ts`,
 *               kept verbatim. Order matters: Reset > Optimizer > Growth >
 *               Planning > Stability > LowVis. Survival is the shipped
 *               default so we don't suggest it — only suggest moving *out*
 *               of it.
 */
import type { ModeInputs, MoneyMode } from './types';
import { MODE_LABEL } from './types';
import { monthlyEquivalent } from '../driftSignals';

/**
 * The cadence-correct monthly income figure, computed from `ModeInputs` alone (no full `AppState`
 * available here, so this can't call `selectMonthlyIncome` directly — same fallback order though:
 * declared `incomeSources` summed via their real cadence, else the legacy onboarding lump). Fixes the
 * ~4x-wrong figure a weekly earner without a monthly onboarding lump used to get from
 * `onboarding.monthlyIncome || 0` alone.
 */
function monthlyIncomeFrom(inputs: ModeInputs): number {
  const sources = inputs.incomeSources ?? [];
  if (sources.length > 0) {
    return sources.reduce((sum, src) => sum + monthlyEquivalent(src.amount, src.cadence), 0);
  }
  return inputs.onboarding.monthlyIncome || 0;
}

export type ModeSuggestion = {
  mode: MoneyMode;
  label: string; // e.g. "Cut waste"
  reason: string; // one plain sentence, under 90 chars
} | null;

export function suggestMode(current: MoneyMode, inputs: ModeInputs): ModeSuggestion {
  const { tightestSpare, subs, subPaused, pots, currentBalance } = inputs;
  const income = monthlyIncomeFrom(inputs);
  const balance = currentBalance.amount;
  const liveSubs = subs.filter((s) => !subPaused[s.name]);
  const leakySubs = liveSubs.filter((s) => s.usesPerMonth === 0 || s.lastUsedDaysAgo > 21);
  const leakTotal = leakySubs.reduce((sum, s) => sum + s.cost, 0);
  const activePots = pots.filter((p) => p.perWeek > 0);
  const potsSaved = pots.reduce((s, p) => s + Math.max(0, p.saved), 0);
  const goalPots = pots.filter((p) => (p.goal ?? 0) > 0);

  const knowsIncome = income > 0;
  const knowsBalance = currentBalance.source !== 'sample';
  const hasSubs = subs.length > 0;

  // Reset — cash is essentially gone.
  if (income > 0 && balance < income * 0.1 && tightestSpare < 0 && current !== 'reset') {
    return {
      mode: 'reset',
      label: MODE_LABEL.reset,
      reason: 'Balance is low and the path is negative. One small step at a time might fit better.',
    };
  }

  // Optimizer — real leaks worth naming.
  if (leakTotal >= 25 && current !== 'optimizer') {
    return {
      mode: 'optimizer',
      label: MODE_LABEL.optimizer,
      reason: `About £${leakTotal.toFixed(0)}/mo sits in subs you rarely open.`,
    };
  }

  // Growth — steady, room to save, no pace yet.
  if (
    tightestSpare > income * 0.3 &&
    activePots.length === 0 &&
    knowsIncome &&
    current !== 'growth' &&
    current !== 'planning'
  ) {
    return {
      mode: 'growth',
      label: MODE_LABEL.growth,
      reason: 'The month holds with room to spare. Worth turning some of it into pace?',
    };
  }

  // Planning — has a goal pot with a target, no clear plan mode.
  if (
    goalPots.length > 0 &&
    potsSaved < goalPots.reduce((s, p) => s + (p.goal ?? 0), 0) &&
    current === 'survival'
  ) {
    return {
      mode: 'planning',
      label: MODE_LABEL.planning,
      reason: "You've named a goal. A planning view puts a date on it.",
    };
  }

  // Stability — comfortable, no crisis, still in Survival.
  if (current === 'survival' && tightestSpare > income * 0.2 && knowsIncome) {
    return {
      mode: 'stability',
      label: MODE_LABEL.stability,
      reason: 'Nothing here looks tight. A steadier view might feel better.',
    };
  }

  // LowVis — barely any signal.
  if (!knowsIncome && !knowsBalance && !hasSubs && current !== 'lowVis') {
    return {
      mode: 'lowVis',
      label: MODE_LABEL.lowVis,
      reason: 'Not much to go on yet. A softer view is more honest.',
    };
  }

  return null;
}
