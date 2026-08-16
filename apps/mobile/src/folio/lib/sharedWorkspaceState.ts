import type { AppState } from '../store';

/**
 * The explicit non-financial state allowed to follow the person between Personal and Business.
 * Everything not named here remains inside its encrypted workspace partition.
 */
export const SHARED_WORKSPACE_STATE_KEYS = [
  'meloPrimerSeen',
  'meloPrimerBeat',
  'meloPrimerSeenAt',
  'melo',
  'chartStyle',
] as const satisfies readonly (keyof AppState)[];

export type SharedWorkspaceState = Pick<AppState, (typeof SHARED_WORKSPACE_STATE_KEYS)[number]>;

export function pickSharedWorkspaceState(state: AppState): SharedWorkspaceState {
  return {
    ...(state.meloPrimerSeen === undefined ? {} : { meloPrimerSeen: state.meloPrimerSeen }),
    ...(state.meloPrimerBeat === undefined ? {} : { meloPrimerBeat: state.meloPrimerBeat }),
    ...(state.meloPrimerSeenAt === undefined ? {} : { meloPrimerSeenAt: state.meloPrimerSeenAt }),
    ...(state.melo === undefined ? {} : { melo: state.melo }),
    ...(state.chartStyle === undefined ? {} : { chartStyle: state.chartStyle }),
  };
}
