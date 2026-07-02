// Melo-surface-local tokens: weather tints + mascot colorways (MELO_BLUEPRINT.md §11).
// Deliberately NOT added to the pressureMap kit yet — this surface builds on a parallel branch
// with zero contact with shared kit files; fold these into the kit at merge time if Melo becomes
// the front door. Everything else (paper, ink, type, spacing) comes from the kit.

import type { DataState, JourneyState, LadderState, Weather } from '@folio/melo-engine';

export interface WeatherVisual {
  /** Gradient top stop — the sky's mood colour. */
  readonly top: string;
  /** Gradient mid stop — blends toward the kit canvas at the bottom. */
  readonly mid: string;
  /** Weather-chip dot colour. */
  readonly dot: string;
  /** Weather-chip word (the state line carries the detail; this stays short). */
  readonly word: string;
}

export const WEATHER_VISUALS: Record<Weather, WeatherVisual> = {
  sunny: { top: '#F3E2BE', mid: '#F6ECD6', dot: '#E0B45C', word: 'Sunny' },
  cloudy: { top: '#DEE1DA', mid: '#ECEADF', dot: '#AEB4A9', word: 'Cloudy' },
  rain: { top: '#C7D0D6', mid: '#E4E4DA', dot: '#7E96A5', word: 'Rain likely' },
  storm: { top: '#46505A', mid: '#77776C', dot: '#46505A', word: 'Storm' },
  fog: { top: '#B9B3C2', mid: '#E2DEDA', dot: '#A79FB4', word: 'Fog' },
  rainbow: { top: '#B7A493', mid: '#E8DCCB', dot: '#B98F5E', word: 'Clearing' },
};

export type MeloColorway = 'ember' | 'moss' | 'tide';

export interface MeloColorwayFills {
  readonly body: string;
  readonly shade: string;
  readonly crest: string;
  readonly glow: string;
  readonly belly: string;
}

export const MELO_COLORWAYS: Record<MeloColorway, MeloColorwayFills> = {
  ember: { body: '#C97E55', shade: '#B06A45', crest: '#9E5C3B', glow: '#FFC98A', belly: '#EBBD96' },
  moss: { body: '#94A483', shade: '#7F8F6F', crest: '#6E7F5E', glow: '#E6EFC6', belly: '#CBD8B2' },
  tide: { body: '#8AA3B5', shade: '#7690A2', crest: '#647E90', glow: '#CFE7F2', belly: '#B6CEDC' },
};

/** Belly-glow brightness is a status display: bright when safe, dim in a storm (§3.1). */
export function glowFor(view: {
  readonly data: DataState;
  readonly journey: JourneyState;
  readonly ladder: LadderState;
}): number {
  if (view.data === 'fog') return 0.35;
  if (view.journey === 'recovery') return 0.5;
  if (view.journey === 'rebuilding') return 0.6;
  switch (view.ladder) {
    case 'winning':
      return 0.9;
    case 'protected':
    case 'calm':
      return 0.85;
    case 'tight':
      return 0.55;
    case 'warning':
      return 0.4;
    case 'danger':
      return 0.22;
    case 'overspent':
      return 0.2;
  }
}

/** Storm breathes slowly (co-regulation, §3.2); calm idles gently; harsh states stay still. */
export function breatheFor(view: { readonly data: DataState; readonly ladder: LadderState }): {
  readonly enabled: boolean;
  readonly durationMs: number;
} {
  if (view.data === 'fog') return { enabled: false, durationMs: 0 };
  if (view.ladder === 'danger') return { enabled: true, durationMs: 10_000 };
  if (view.ladder === 'calm' || view.ladder === 'protected' || view.ladder === 'winning') {
    return { enabled: true, durationMs: 6_500 };
  }
  return { enabled: false, durationMs: 0 };
}
