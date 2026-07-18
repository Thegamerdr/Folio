import type { Nav } from '../../types';
import { isDampened, type DismissRecord } from './dismissReasons';

export type OneMove =
  | Readonly<{
      key: 'review' | 'recovery' | 'ritual' | 'caught-sub';
      line: string;
      cta: string;
      onTap: () => void;
    }>
  | null;

export type OneMoveImpression = Readonly<{
  key: string;
  shownAt: string;
  tappedAt?: string;
}>;

export type OneMoveInputs = Readonly<{
  reviewCount: number;
  tightPoint: number;
  cycleOverdueDays: number;
  caughtSubName: string | null;
  nav: Nav;
  history?: readonly OneMoveImpression[];
  dismissLog?: readonly DismissRecord[];
}>;

function seenRecently(key: string, history: readonly OneMoveImpression[] = []): boolean {
  return history.slice(0, 3).some((entry) => entry.key === key && entry.tappedAt === undefined);
}

/** Return one ranked action, or stay quiet when every candidate is absent/dampened. */
export function deriveOneMove(inputs: OneMoveInputs): OneMove {
  const candidates: Array<NonNullable<OneMove>> = [];
  if (inputs.reviewCount > 0) {
    const repeated = seenRecently('review', inputs.history);
    candidates.push({
      key: 'review',
      line: repeated
        ? 'Still waiting to be checked.'
        : inputs.reviewCount === 1
          ? "One thing's waiting to be checked."
          : `${inputs.reviewCount} things are waiting to be checked.`,
      cta: 'Open Review',
      onTap: () => inputs.nav.go('review'),
    });
  }
  if (inputs.tightPoint < 0) {
    const repeated = seenRecently('recovery', inputs.history);
    candidates.push({
      key: 'recovery',
      line: repeated
        ? 'The path is still under. One preview move can lift it.'
        : 'The path dips below zero. One preview move can lift it.',
      cta: 'Open Recovery',
      onTap: () => inputs.nav.go('recovery'),
    });
  }
  if (inputs.cycleOverdueDays > 0) {
    const repeated = seenRecently('ritual', inputs.history);
    candidates.push({
      key: 'ritual',
      line: repeated
        ? "The cycle's still open. Close it when you're ready."
        : inputs.cycleOverdueDays === 1
          ? 'Payday landed yesterday. Close the cycle when you’re ready.'
          : `Payday landed ${inputs.cycleOverdueDays} days ago. Close the cycle when you’re ready.`,
      cta: 'Payday ritual',
      onTap: () => inputs.nav.go('ritual'),
    });
  }
  if (inputs.caughtSubName) {
    const repeated = seenRecently('caught-sub', inputs.history);
    candidates.push({
      key: 'caught-sub',
      line: repeated
        ? `${inputs.caughtSubName} is still unhandled.`
        : `I spotted ${inputs.caughtSubName}. Add it to the plan or wait until it shows again.`,
      cta: 'Handle it',
      onTap: () => inputs.nav.openSheet('sub-caught'),
    });
  }
  const dismissLog = inputs.dismissLog ?? [];
  return candidates.find((candidate) => !isDampened(candidate.key, dismissLog)) ?? null;
}
