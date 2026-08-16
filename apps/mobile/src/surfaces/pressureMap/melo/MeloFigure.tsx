// Compatibility adapter for the original pressure-map surfaces.
//
// The React Native product now has one character renderer: `@/folio/melo/Melo`. Older core
// surfaces still speak the smaller pressure-map mood vocabulary, so this file only translates
// those names. It must never grow a second image, SVG mascot, animation loop or fallback identity.

import { Melo, type MeloMood as CanonicalMeloMood } from '@/folio/melo/Melo';

import type { MeloMood } from './meloStates';

const MOOD_MAP: Readonly<Record<MeloMood, CanonicalMeloMood>> = {
  calm: 'calm',
  attentive: 'curious',
  reassuring: 'protect',
  'soft-concern': 'concern',
};

export function MeloFigure({
  mood,
  size = 40,
  reduceMotion = false,
}: {
  mood: MeloMood;
  size?: number | undefined;
  reduceMotion?: boolean | undefined;
  /** Retained for source compatibility; both historical variants now use canonical Melo. */
  variant?: 'asset' | 'mark' | undefined;
}) {
  return (
    <Melo
      ambientMotion={!reduceMotion}
      effects={false}
      grounded={false}
      mood={MOOD_MAP[mood]}
      size={size}
    />
  );
}
