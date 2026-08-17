import { describe, expect, it } from 'vitest';

import {
  frameIndexForFilename,
  meloAtlasContract,
  resolveMeloAtlasState,
} from './MeloAtlasContract';

describe('MeloAnimatedSprite', () => {
  it('ships the validated A+ native atlas contract', () => {
    expect(meloAtlasContract()).toEqual({
      schemaVersion: 1,
      atlasWidth: 1536,
      atlasHeight: 4992,
      cellWidth: 192,
      cellHeight: 208,
      stateCount: 42,
    });
  });

  it.each([
    ['gaze-left', 'look-left'],
    ['gaze-right', 'look-right'],
    ['gaze-up', 'look-up'],
    ['gaze-down', 'look-down'],
    ['concern-major', 'concerned-major'],
    ['thinking-loop', 'thinking-loop'],
    ['not-a-real-state', 'idle-calm'],
  ])('maps engine state %s to atlas state %s', (engineState, atlasState) => {
    expect(resolveMeloAtlasState(engineState)).toBe(atlasState);
  });

  it('falls back to the first frame when a manifest reference is absent', () => {
    const animation = {
      frames: [
        {
          filename: 'one.png',
          rect: { x: 0, y: 0, width: 192, height: 208 },
          durationMs: 100,
        },
      ],
      loopType: 'once' as const,
      loopCount: null,
      entryFrame: 'one.png',
      exitFrame: 'one.png',
      reducedMotionFallbackFrame: 'one.png',
    };
    expect(frameIndexForFilename(animation, 'missing.png')).toBe(0);
  });
});
