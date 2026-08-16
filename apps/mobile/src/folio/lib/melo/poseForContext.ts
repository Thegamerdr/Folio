import type { MeloMood } from '../../melo/Melo';

export type PoseSurface =
  | 'today'
  | 'ritual'
  | 'recovery'
  | 'shortfall'
  | 'insights'
  | 'postcard'
  | 'melo-tab'
  | 'voice-hold'
  | 'signature-moment'
  | 'error'
  | 'biz-runway'
  | 'meet-melo-1'
  | 'meet-melo-2'
  | 'meet-melo-3';

export type PoseState = Readonly<{
  quietMode?: boolean;
  pathBendPct?: number;
  cleanStreakDays?: number;
  runwayDays?: number | null;
}>;

export type ContextPose = Readonly<{ mood: MeloMood; asleep: boolean }>;

const IDLE: ContextPose = { mood: 'calm', asleep: false };
const ASLEEP: ContextPose = { mood: 'calm', asleep: true };

/** Exact native mirror of Lovable src/lib/melo/pose.ts. */
export function poseForContext(surface: PoseSurface, state: PoseState = {}): ContextPose {
  if (state.quietMode && surface !== 'signature-moment' && surface !== 'voice-hold') {
    return ASLEEP;
  }
  switch (surface) {
    case 'today':
      if ((state.pathBendPct ?? 0) > 0.1) return { mood: 'concern', asleep: false };
      if ((state.cleanStreakDays ?? 0) >= 7) return { mood: 'cheer', asleep: false };
      return IDLE;
    case 'ritual':
      return { mood: 'curious', asleep: false };
    case 'recovery':
      return { mood: 'protect', asleep: false };
    case 'shortfall':
      return { mood: 'concern', asleep: false };
    case 'insights':
      return { mood: 'think', asleep: false };
    case 'postcard':
    case 'signature-moment':
      return { mood: 'celebrate', asleep: false };
    case 'voice-hold':
      return { mood: 'curious', asleep: false };
    case 'error':
      return { mood: 'concern', asleep: false };
    case 'biz-runway':
      if (state.runwayDays !== null && state.runwayDays !== undefined) {
        if (state.runwayDays >= 90) return { mood: 'cheer', asleep: false };
        if (state.runwayDays < 30) return { mood: 'concern', asleep: false };
      }
      return IDLE;
    case 'meet-melo-1':
      return { mood: 'curious', asleep: false };
    case 'meet-melo-2':
      return { mood: 'think', asleep: false };
    case 'meet-melo-3':
      return { mood: 'calm', asleep: false };
    case 'melo-tab':
    default:
      return IDLE;
  }
}
