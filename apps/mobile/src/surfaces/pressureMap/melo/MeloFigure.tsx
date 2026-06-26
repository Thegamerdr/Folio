// MeloFigure — the TEMPORARY high-quality placeholder for Melo's body.
//
// This is the single swap point for Melo's visual runtime. A real 3D / Rive / Lottie / Skia Melo
// replaces THIS file's export later, keeping the same props (mood, size, reduceMotion). Nothing
// else in the app needs to change.
//
// Design intent: Melo is a small, hooded guide that STANDS ON the money path and carries it
// forward — a quiet seedling-guardian silhouette, not a smiley, blob, mascot sticker, or plain "M".
// Recognition comes from three things, not a face:
//   1. a soft domed-hood body with a tucked, attentive posture,
//   2. a single calm "horizon" gaze band instead of two dots + a smile,
//   3. the green money-path curve that flows under Melo's feet — its defining, on-brand motif,
//      finished with one warm amber waypoint so trust reads even at small sizes.
// Moods are SUBTLE: gaze offset, a slight body lean, and the curvature of the path it carries.

import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';

import type { MeloMood } from './meloStates';
import { paper } from '../kit';

type MoodPose = Readonly<{
  // Horizontal gaze offset (px) — where Melo is quietly looking.
  gazeDx: number;
  // Vertical gaze offset (px) — a touch lower reads as soft concern, level reads as calm.
  gazeDy: number;
  // Small body lean in degrees — toward the work when attentive, settled back when reassuring.
  lean: number;
  // Control-point Y of the money-path curve Melo stands on. Lower = a gentler, settled dip;
  // higher = a tighter rise (the path "asking a question").
  pathCp: number;
  // Opacity of the warm amber waypoint — brighter when reassuring/attentive, quietest at rest.
  warmth: number;
}>;

const MOOD_POSE: Readonly<Record<MeloMood, MoodPose>> = {
  calm: { gazeDx: 0, gazeDy: 0, lean: 0, pathCp: 40.5, warmth: 0.85 },
  attentive: { gazeDx: 1.4, gazeDy: -0.3, lean: 2.2, pathCp: 38, warmth: 1 },
  reassuring: { gazeDx: -0.6, gazeDy: 0, lean: -1.4, pathCp: 41.5, warmth: 1 },
  'soft-concern': { gazeDx: -1.2, gazeDy: 0.7, lean: -0.8, pathCp: 37, warmth: 0.7 },
};

export function MeloFigure({
  mood,
  size = 40,
}: {
  mood: MeloMood;
  size?: number | undefined;
  // reduceMotion is accepted for API parity with the future animated runtime; the placeholder is
  // already static so there is nothing to disable.
  reduceMotion?: boolean | undefined;
}) {
  const p = MOOD_POSE[mood];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityRole="image">
      {/* the money path Melo stands on and carries forward — the on-brand motif */}
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
      {/* warm amber waypoint ahead on the path — the quiet "you're heading somewhere good" point */}
      <Circle cx={41} cy={p.pathCp - 1.5} r={2.1} fill={paper.warm} opacity={p.warmth} />

      {/* Melo's body — a hooded seedling-guardian, leaning gently with mood */}
      <G rotation={p.lean} originX={24} originY={26}>
        {/* settled shadow grounding Melo to the path */}
        <Ellipse cx={24} cy={37.4} rx={8.2} ry={1.7} fill={paper.calmStrong} opacity={0.14} />

        {/* the soft hooded body: a tapered dome that tucks in at the base */}
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

        {/* hood seam — a single soft ridge that gives the silhouette character without a face */}
        <Path
          d="M15.6 19.5 C 18.5 13.6, 29.5 13.6, 32.4 19.5"
          stroke={paper.calm}
          strokeWidth={1.4}
          strokeLinecap="round"
          fill="none"
          opacity={0.45}
        />

        {/* paper-light catch on the hood for quiet depth */}
        <Path
          d="M17.8 14.4 C 19.8 11.8, 24 10.7, 27.2 11.6"
          stroke={paper.surface}
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
          opacity={0.6}
        />

        {/* the calm gaze: a single soft horizon band, NOT two dots + a smile */}
        <Line
          x1={20 + p.gazeDx}
          y1={23.4 + p.gazeDy}
          x2={28 + p.gazeDx}
          y2={23.4 + p.gazeDy}
          stroke={paper.ink}
          strokeWidth={2.2}
          strokeLinecap="round"
        />

        {/* warm heart-point — a small amber glow at Melo's centre, the trust signal */}
        <Circle cx={24} cy={29.6} r={1.7} fill={paper.warm} opacity={p.warmth * 0.9} />
      </G>
    </Svg>
  );
}
