// MeloFigure — Melo's visual runtime.
//
// PRIMARY: the accepted Lovable Melo visual (`assets/melo-hero.png`), rendered as the character
// across the core slice. This is the swap point for a future 3D / Rive / Lottie / Skia Melo — the
// same props (mood, size, reduceMotion) carry over, so only this file changes when the animated
// runtime lands.
//
// FALLBACK: the earlier hand-drawn "hooded seedling-guardian" SVG mark. It now renders ONLY if the
// raster asset fails to load (and stays available for a deliberate `variant="mark"`). Mood is
// expressed subtly here (gaze / lean / path curve); the raster is a single calm pose today and a
// future Rive Melo will map the moods to real poses.

import { useState } from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';

import type { MeloMood } from './meloStates';
import { paper } from '../kit';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MELO_ASSET = require('../../../../assets/melo-hero.png');

export function MeloFigure({
  mood,
  size = 40,
  variant = 'asset',
}: {
  mood: MeloMood;
  size?: number | undefined;
  // reduceMotion is accepted for API parity with the future animated runtime; both the raster and
  // the SVG mark are already static, so there is nothing to disable.
  reduceMotion?: boolean | undefined;
  // 'asset' = the accepted Lovable Melo raster (default). 'mark' forces the SVG fallback mark.
  variant?: 'asset' | 'mark' | undefined;
}) {
  const [assetFailed, setAssetFailed] = useState(false);
  const showMark = variant === 'mark' || assetFailed;

  if (!showMark) {
    return (
      <Image
        accessibilityRole="image"
        accessibilityLabel="Melo"
        source={MELO_ASSET}
        onError={() => setAssetFailed(true)}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return <MeloMark mood={mood} size={size} />;
}

type MoodPose = Readonly<{
  gazeDx: number;
  gazeDy: number;
  lean: number;
  pathCp: number;
  warmth: number;
}>;

const MOOD_POSE: Readonly<Record<MeloMood, MoodPose>> = {
  calm: { gazeDx: 0, gazeDy: 0, lean: 0, pathCp: 40.5, warmth: 0.85 },
  attentive: { gazeDx: 1.4, gazeDy: -0.3, lean: 2.2, pathCp: 38, warmth: 1 },
  reassuring: { gazeDx: -0.6, gazeDy: 0, lean: -1.4, pathCp: 41.5, warmth: 1 },
  'soft-concern': { gazeDx: -1.2, gazeDy: 0.7, lean: -0.8, pathCp: 37, warmth: 0.7 },
};

// The fallback mark — only rendered if the raster asset can't load, or when explicitly requested.
function MeloMark({ mood, size }: { mood: MeloMood; size: number }) {
  const p = MOOD_POSE[mood];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityRole="image">
      <Path
        d={`M5 ${p.pathCp} C 15 ${p.pathCp}, 18 38, 24 38 C 30 38, 33 ${p.pathCp}, 43 ${p.pathCp - 1.5}`}
        stroke={paper.calmSoft}
        strokeWidth={4.4}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={`M5 ${p.pathCp} C 15 ${p.pathCp}, 18 38, 24 38 C 30 38, 33 ${p.pathCp}, 43 ${p.pathCp - 1.5}`}
        stroke={paper.calm}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={41} cy={p.pathCp - 1.5} r={2.1} fill={paper.warm} opacity={p.warmth} />
      <G rotation={p.lean} originX={24} originY={26}>
        <Ellipse cx={24} cy={37.4} rx={8.2} ry={1.7} fill={paper.calmStrong} opacity={0.14} />
        <Path
          d="M24 9
             C 16.4 9, 12.2 15.3, 12.2 22.4
             C 12.2 29.4, 13.6 34.2, 16.4 36.1
             C 19 37.9, 29 37.9, 31.6 36.1
             C 34.4 34.2, 35.8 29.4, 35.8 22.4
             C 35.8 15.3, 31.6 9, 24 9 Z"
          fill={paper.calmSoft}
          stroke={paper.calm}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <Path
          d="M15.6 19.5 C 18.5 13.6, 29.5 13.6, 32.4 19.5"
          stroke={paper.calm}
          strokeWidth={1.4}
          strokeLinecap="round"
          fill="none"
          opacity={0.45}
        />
        <Path
          d="M17.8 14.4 C 19.8 11.8, 24 10.7, 27.2 11.6"
          stroke={paper.surface}
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
          opacity={0.6}
        />
        <Line
          x1={20 + p.gazeDx}
          y1={23.4 + p.gazeDy}
          x2={28 + p.gazeDx}
          y2={23.4 + p.gazeDy}
          stroke={paper.ink}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <Circle cx={24} cy={29.6} r={1.7} fill={paper.warm} opacity={p.warmth * 0.9} />
      </G>
    </Svg>
  );
}
