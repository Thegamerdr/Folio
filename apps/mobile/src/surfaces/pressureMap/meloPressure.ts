// Pure Melo pressure-ladder logic — no React Native imports, so it is unit-testable under vitest
// (importing the .tsx companion surface would drag in react-native's Flow source). meloCompanion.tsx
// re-exports these so the screen and the tests share one source of truth.

import type { MeloMood } from './melo/meloStates';
import { routeHasMeaningfulPath } from './routeMath';
import type { LocalRouteSummary } from '../../local/localLedger';

export type PressureKey = 'safe' | 'calm' | 'soft' | 'pressured' | 'overspent';

// Melo's emotional range — the spectrum she moves through as the route tightens. Lines are her
// voice (verbatim from the accepted design); the mood drives the figure's pose.
//
// Ordered safest -> tightest. The mood must degrade MONOTONICALLY down this list: as money tightens
// Melo never relaxes back to a calmer pose. Concern rank is calm < attentive < soft-concern, so the
// mood column is non-decreasing in concern from `safe` to `overspent`. (The earlier ladder dropped
// `overspent` back to soft-concern after a more-concerned `pressured`, and put soft-concern on the
// milder `soft` band before the worse `pressured` band — non-monotonic, so the figure could look
// calmer at a worse balance.)
export const SPECTRUM: readonly {
  key: PressureKey;
  label: string;
  mood: MeloMood;
  line: string;
}[] = [
  {
    key: 'safe',
    label: 'Safe',
    mood: 'calm',
    line: 'Plenty of room. Breathe.',
  },
  {
    key: 'calm',
    label: 'Calm',
    mood: 'calm',
    line: 'You make it to payday.',
  },
  {
    key: 'soft',
    label: 'Soft',
    mood: 'attentive',
    line: 'Tight - but the path holds.',
  },
  {
    key: 'pressured',
    label: 'Pressured',
    mood: 'soft-concern',
    line: 'The middle of next week is the squeeze.',
  },
  {
    key: 'overspent',
    label: 'Overspent',
    mood: 'soft-concern',
    line: 'Something has to move. Let us look together.',
  },
];

// Where Melo is right now, read from the route. A ledger with no meaningful path sits at calm
// (neutral) rather than guessing a pressure from an empty £0. The thresholds descend monotonically,
// so a lower tightest balance can only map to an equal-or-tighter band.
export function currentPressure(route: LocalRouteSummary): PressureKey {
  if (!routeHasMeaningfulPath(route)) return 'calm';
  const tight = route.tightestBalanceMinor;
  if (tight < 0) return 'overspent';
  if (tight < 5000) return 'pressured'; // < £50
  if (tight < 18400) return 'soft'; // < £184
  if (tight < 32500) return 'calm'; // < £325
  return 'safe';
}
