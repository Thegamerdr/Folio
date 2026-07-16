import type { MeloTone } from '@/folio/store';

export const DEFAULT_MELO_TONE: MeloTone = 'calm';

const TONE_DESCRIPTIONS: Readonly<Record<MeloTone, string>> = {
  calm: 'Gentle answers. Proactive money suggestions stay off Today.',
  honest: 'Plain answers. Proactive money suggestions stay off Today.',
  dry: 'Terse answers. Proactive money suggestions stay off Today.',
  coachy: 'Useful questions, plus optional moves based on your money.',
};

/**
 * Facts, review work, safety/recovery routes and rituals never disappear with tone.
 * Only proactive suggestions about changing the user's money are reserved for Coachy.
 */
export function canSurfaceProactiveMoneySuggestion(tone: MeloTone | undefined): boolean {
  return (tone ?? DEFAULT_MELO_TONE) === 'coachy';
}

export function describeMeloTone(tone: MeloTone | undefined): string {
  return TONE_DESCRIPTIONS[tone ?? DEFAULT_MELO_TONE];
}

export type MeloTodayMoneyNudgeKind = 'subscription-pause' | 'tight-point' | 'spending-review';

export function selectMeloTodayMoneyNudge(
  input: Readonly<{
    tone: MeloTone | undefined;
    hasUpcomingSubscription: boolean;
    tightPointGoal: number | null;
    tightestSpare: number | null;
    recentSpend: number;
  }>,
): MeloTodayMoneyNudgeKind | null {
  const canSuggest = canSurfaceProactiveMoneySuggestion(input.tone);
  if (canSuggest && input.hasUpcomingSubscription) return 'subscription-pause';
  if (
    canSuggest &&
    input.tightPointGoal !== null &&
    input.tightestSpare !== null &&
    input.tightestSpare < input.tightPointGoal
  ) {
    return 'tight-point';
  }
  if (input.recentSpend > 0) return 'spending-review';
  return null;
}
