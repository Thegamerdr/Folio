import atlasManifestJson from '../../../assets/melo/motion/fenice-melo-atlas.json';

export type MeloAtlasFrame = Readonly<{
  filename: string;
  rect: Readonly<{ x: number; y: number; width: number; height: number }>;
  durationMs: number;
}>;

export type MeloAtlasAnimation = Readonly<{
  frames: readonly MeloAtlasFrame[];
  loopType: 'loop' | 'once' | 'hold-last';
  loopCount: number | null;
  entryFrame: string;
  exitFrame: string;
  reducedMotionFallbackFrame: string;
}>;

export type MeloAtlasManifest = Readonly<{
  schemaVersion: number;
  atlas: Readonly<{
    width: number;
    height: number;
    cellWidth: number;
    cellHeight: number;
  }>;
  animations: Readonly<Record<string, MeloAtlasAnimation>>;
}>;

export const MELO_ATLAS = atlasManifestJson as MeloAtlasManifest;

const ENGINE_TO_ATLAS_STATE: Readonly<Record<string, string>> = {
  'gaze-left': 'look-left',
  'gaze-right': 'look-right',
  'gaze-up': 'look-up',
  'gaze-down': 'look-down',
  'concern-major': 'concerned-major',
};

export function resolveMeloAtlasState(visualState: string): string {
  const mapped = ENGINE_TO_ATLAS_STATE[visualState] ?? visualState;
  return MELO_ATLAS.animations[mapped] ? mapped : 'idle-calm';
}

export function frameIndexForFilename(animation: MeloAtlasAnimation, filename: string): number {
  const index = animation.frames.findIndex((frame) => frame.filename === filename);
  return index >= 0 ? index : 0;
}

export function meloAtlasContract() {
  return {
    schemaVersion: MELO_ATLAS.schemaVersion,
    atlasWidth: MELO_ATLAS.atlas.width,
    atlasHeight: MELO_ATLAS.atlas.height,
    cellWidth: MELO_ATLAS.atlas.cellWidth,
    cellHeight: MELO_ATLAS.atlas.cellHeight,
    stateCount: Object.keys(MELO_ATLAS.animations).length,
  } as const;
}
