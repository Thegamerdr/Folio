/**
 * Next best action: one recommendation, ranked, mirroring the copy register already live in
 * MeloGlance's action card (ritual > fog/refresh > recovery > structural > buffer warning >
 * review > first spend log > nothing). Deterministic, pure, no clock — the caller supplies
 * every signal already known to the day's derived state.
 */

import { formatPounds, type Pence } from './core.js';
import { lintCopy } from './copy.js';

export type NextBestActionId =
  | 'ritual'
  | 'refreshBalance'
  | 'recovery'
  | 'keepDry'
  | 'review'
  | 'logFirstSpend'
  | null;

export interface NextBestAction {
  readonly id: Exclude<NextBestActionId, null>;
  readonly title: string;
  readonly body: string;
  readonly cta: string;
}

export interface NextBestActionInputs {
  readonly ritualDue: boolean;
  readonly fog: boolean;
  readonly inRecovery: boolean;
  readonly moveDoneToday: boolean;
  readonly ladder: string;
  readonly structural: boolean;
  readonly structuralOptionBody: string | null;
  readonly keepDryPerDay: string;
  readonly paydayLabel: string;
  readonly reviewDue: boolean;
  readonly hasSpendLog: boolean;
  readonly recoveryMovePence: Pence;
}

function ritualAction(): NextBestAction {
  return {
    id: 'ritual',
    title: 'Payday',
    body: 'Two minutes with Melo makes the month safe.',
    cta: 'Start the ritual',
  };
}

function refreshBalanceAction(): NextBestAction {
  return {
    id: 'refreshBalance',
    title: 'Refresh my picture',
    body: 'Tell me today’s balance and everything sharpens back up.',
    cta: 'Update balance (30s)',
  };
}

function recoveryAction(i: NextBestActionInputs): NextBestAction {
  if (i.moveDoneToday) {
    return {
      id: 'recovery',
      title: 'Done for today',
      body: 'That was the whole ask. See you tomorrow — I’ll bring the numbers.',
      cta: '',
    };
  }
  if (i.structural) {
    return {
      id: 'recovery',
      title: 'This cycle doesn’t fit',
      body:
        i.structuralOptionBody ??
        'Three steps. The first one takes a minute. No lecture in any of them.',
      cta: 'See the way through',
    };
  }
  return {
    id: 'recovery',
    title: 'Today’s move',
    body: `Shift ${formatPounds(i.recoveryMovePence)} to bills. Then we’re done for today — no second ask.`,
    cta: 'Do today’s move',
  };
}

function keepDryAction(i: NextBestActionInputs): NextBestAction {
  return {
    id: 'keepDry',
    title: 'Keep it dry',
    body: `${i.keepDryPerDay}/day until ${i.paydayLabel} keeps the storm off.`,
    cta: 'Show the math',
  };
}

function reviewAction(): NextBestAction {
  return {
    id: 'review',
    title: 'The week, in 30 seconds',
    body: 'What moved, what stayed quiet, what lands next week — one honest look.',
    cta: 'See the week',
  };
}

function logFirstSpendAction(): NextBestAction {
  return {
    id: 'logFirstSpend',
    title: 'A first spend logged',
    body: 'Log one thing you bought today — it is how the picture starts sharpening.',
    cta: 'Log a spend',
  };
}

const WARNING_KEEP_DRY_LADDER = 'warning';

/**
 * One recommendation, in priority order: ritual > fog > recovery > structural warning >
 * keepDry (only in the warning ladder) > review > logFirstSpend (only with an empty log) >
 * null when nothing needs the user's attention.
 */
export function pickNextBestAction(i: NextBestActionInputs): NextBestAction | null {
  let action: NextBestAction | null = null;

  if (i.ritualDue) {
    action = ritualAction();
  } else if (i.fog) {
    action = refreshBalanceAction();
  } else if (i.inRecovery) {
    action = recoveryAction(i);
  } else if (i.ladder === WARNING_KEEP_DRY_LADDER) {
    action = keepDryAction(i);
  } else if (i.reviewDue) {
    action = reviewAction();
  } else if (!i.hasSpendLog) {
    action = logFirstSpendAction();
  }

  if (action !== null) {
    const violations = [...lintCopy(action.title), ...lintCopy(action.body)];
    if (violations.length > 0) {
      throw new Error(`nextBestAction "${action.id}" failed lintCopy: ${violations.join(', ')}`);
    }
  }

  return action;
}
