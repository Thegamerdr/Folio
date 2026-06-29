// Melo — the faithful 1:1 React Native port of Folio's brand character.
//
// This is NOT the older "seedling-guardian" mark in surfaces/pressureMap/melo/MeloFigure.tsx. This is
// the canonical FOLDED-DOCUMENT Melo from the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/kit.tsx → <Melo>), mirrored unit-for-
// unit onto react-native-svg + react-native-reanimated. The geometry, the viewBox, every coordinate,
// the stroke weights, and the motion durations/easings all match the web original so the character
// reads identically across web and native.
//
// IDENTITY (must not drift — see MELO_MOODS.md "Form & materiality"):
//   • chunky 2.4 single ink-outline folded document (the body path is one continuous stroke)
//   • a caution-yellow folded top-right corner with an inner crease line for depth
//   • two solid ink ear-cup ellipses sitting BEHIND the body (he is listening to your money)
//   • ink-dot eyes with asymmetric white catchlights, five expressions
//   • a mouth at 1.7 stroke weight, carved into him, not penned on
//   • cheek blush on cheer/celebrate; a worry-bead on concern; torn-paper confetti on celebrate
//   • two beige content lines (he IS the page); a soft paper-lift shadow beneath
//
// COLOUR DISCIPLINE: every fill/stroke comes from the active folio palette via useTheme(). No
// hard-coded brand colours. The web token → palette mapping (confirmed against kit.tsx `paper`):
//   --ink → ink · --surface → surface · --caution → caution · --accent → calm ·
//   --accent-soft → calmSoft · --positive → positive · --negative → repair.
//
// MOTION: breathe (4.4s default / 2.4s curious-fast / 6s concern-slow), blink (~5.4s, L/R phase
// offset), mood swap (600ms tilt + a 520ms scale pulse), pose-in (520ms overshoot), tap (420ms
// acknowledge bounce). All gated to FINAL STATE when reduce-motion is on (MOTION.md: reduced motion
// is the resolved layout, never a slower animation).

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme, type Palette } from '@/surfaces/pressureMap/kit';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type MeloMood = 'calm' | 'curious' | 'cheer' | 'concern' | 'celebrate';

export type MeloPose =
  | 'none' // default, just Melo
  | 'safe' // green tick — verdict positive, route holds
  | 'check' // amber "?" — Folio wants you to glance at something
  | 'thinking' // ink sparkle on accent-soft — Folio is working it out
  | 'reading' // ink sweeps on paper — Folio is reading a statement
  | 'mismatch' // coral cross — numbers don't line up
  | 'sealed'; // wax-seal glint — cycle closed

export type MeloProps = {
  mood: MeloMood;
  pose?: MeloPose;
  size?: number;
  grounded?: boolean;
  onTap?: () => void;
};

// ---------------------------------------------------------------------------
// Mood specs — mirrored from the web kit's MOODS map (byte-faithful coordinates)
// ---------------------------------------------------------------------------

type EyeExpression = 'open' | 'up' | 'closed-smile' | 'closed-worry';

type MoodSpec = Readonly<{
  tilt: number; // body tilt in degrees, about (20, 22)
  eyes: EyeExpression;
  mouth: string; // path drawn at the body stroke weight (1.7)
  breatheMs: number; // breathe cycle length for this mood
  breatheScale: number; // peak scale of the breathe pulse
  breatheOpacity: number; // trough opacity of the breathe pulse
  cheek: boolean; // terracotta blush (cheer / celebrate)
  earLift: number; // 0..1 — right ear lifts on curious
  worryBead: boolean; // small bead at the temple on concern
  confetti: boolean; // torn-paper confetti on celebrate
}>;

const MOODS: Readonly<Record<MeloMood, MoodSpec>> = {
  calm: {
    tilt: 0,
    eyes: 'open',
    mouth: 'M15.5 27 Q20 29.6 24.5 27',
    breatheMs: 4400,
    breatheScale: 1.04,
    breatheOpacity: 0.94,
    cheek: false,
    earLift: 0,
    worryBead: false,
    confetti: false,
  },
  curious: {
    tilt: -3,
    eyes: 'up',
    mouth: 'M17 27.4 Q20 26.4 23 27.4',
    breatheMs: 2400,
    breatheScale: 1.06,
    breatheOpacity: 0.9,
    cheek: false,
    earLift: 1,
    worryBead: false,
    confetti: false,
  },
  cheer: {
    tilt: 2,
    eyes: 'open',
    mouth: 'M14.5 26.4 Q20 31 25.5 26.4',
    breatheMs: 4400,
    breatheScale: 1.04,
    breatheOpacity: 0.94,
    cheek: true,
    earLift: 0,
    worryBead: false,
    confetti: false,
  },
  concern: {
    tilt: -2,
    eyes: 'closed-worry',
    mouth: 'M16.5 28.2 Q20 26.4 23.5 28.2',
    breatheMs: 6000,
    breatheScale: 1.025,
    breatheOpacity: 0.96,
    cheek: false,
    earLift: 0,
    worryBead: true,
    confetti: false,
  },
  celebrate: {
    tilt: 1,
    eyes: 'closed-smile',
    mouth: 'M14 26 Q20 31.6 26 26',
    breatheMs: 4400,
    breatheScale: 1.04,
    breatheOpacity: 0.94,
    cheek: true,
    earLift: 0,
    worryBead: false,
    confetti: true,
  },
};

// Shared cubic-bezier — the web's cubic-bezier(.16, 1, .3, 1) "ease-out-expo".
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// Folded-corner geometry — the fold is baked into the body path so the ink outline reads as one
// continuous stroke (matches the web original exactly).
const FOLD = 7.5;
const STROKE = 2.4;

const BODY_PATH = [
  'M 9.5 5.5',
  `L ${33.5 - FOLD} 5.5`,
  `L 33.5 ${5.5 + FOLD}`,
  'L 33.5 35',
  'Q 33.5 38.5 30 38.5',
  'L 10 38.5',
  'Q 6.5 38.5 6.5 35',
  'L 6.5 9',
  'Q 6.5 5.5 9.5 5.5',
  'Z',
].join(' ');

const FOLD_FILL_PATH = [
  `M ${33.5 - FOLD} 5.5`,
  `L ${33.5 - FOLD} ${5.5 + FOLD}`,
  `L 33.5 ${5.5 + FOLD}`,
  'Z',
].join(' ');

const FOLD_CREASE_PATH = `M ${33.5 - FOLD} ${5.5 + FOLD} L 33.5 ${5.5 + FOLD}`;

const FOLD_SHADOW_PATH = [
  `M ${33.5 - FOLD} ${5.5 + FOLD + 0.4}`,
  `L ${33.5 - FOLD + 0.4} ${5.5 + FOLD + 1.6}`,
  `L 33.5 ${5.5 + FOLD + 0.4}`,
  'Z',
].join(' ');

// ---------------------------------------------------------------------------
// Reduced-motion hook (local, AccessibilityInfo-backed)
// ---------------------------------------------------------------------------

// Kept self-contained rather than importing the 8.5k-line mobileShell (which would pull a large
// native module graph into this foundation piece). Mirrors mobileShell's useReducedMotionPreference
// exactly: read once, then subscribe to changes.
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}

// ---------------------------------------------------------------------------
// Animated SVG primitives
// ---------------------------------------------------------------------------

const AnimatedG = Animated.createAnimatedComponent(G);

// ---------------------------------------------------------------------------
// Melo
// ---------------------------------------------------------------------------

export function Melo({ mood, pose = 'none', size = 28, grounded = true, onTap }: MeloProps) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const spec = MOODS[mood];

  // Breathe — a continuous scale+opacity pulse on the whole figure. Three rhythms by mood.
  const breathe = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(breathe);
    if (reduceMotion) {
      breathe.value = 0; // final state = the rest pose (scale 1, opacity 1)
      return;
    }
    breathe.value = withRepeat(
      withTiming(1, { duration: spec.breatheMs / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(breathe);
  }, [breathe, reduceMotion, spec.breatheMs]);

  const breatheStyle = useAnimatedStyle(() => {
    const scale = 1 + breathe.value * (spec.breatheScale - 1);
    const opacity = 1 - breathe.value * (1 - spec.breatheOpacity);
    return { opacity, transform: [{ scale }] };
  });

  // Mood swap — a one-shot 520ms scale pulse on the inner group (re-fires whenever mood changes),
  // matching the web's .melo-mood-pulse. The body tilt itself eases over 600ms via `tilt`.
  const moodPulse = useSharedValue(1);
  const tilt = useSharedValue(spec.tilt);
  useEffect(() => {
    if (reduceMotion) {
      moodPulse.value = 1;
      tilt.value = spec.tilt;
      return;
    }
    tilt.value = withTiming(spec.tilt, { duration: 600, easing: EASE_OUT_EXPO });
    moodPulse.value = withSequence(
      withTiming(0.985, { duration: 0 }),
      withTiming(1.025, { duration: 286, easing: EASE_OUT_EXPO }),
      withTiming(1, { duration: 234, easing: EASE_OUT_EXPO }),
    );
  }, [moodPulse, tilt, reduceMotion, spec.tilt]);

  const moodGroupProps = useAnimatedProps(() => ({
    // Tilt about the web's pivot (20, 22); the pulse scales about the same origin.
    transform: [
      { translateX: 20 },
      { translateY: 22 },
      { rotate: `${tilt.value}deg` },
      { scale: moodPulse.value },
      { translateX: -20 },
      { translateY: -22 },
    ],
  }));

  // Tap — a 420ms acknowledge bounce on the whole figure (only when onTap is set).
  const tapScale = useSharedValue(1);
  function handleTap() {
    if (!onTap) return;
    if (!reduceMotion) {
      tapScale.value = withSequence(
        withTiming(0.92, { duration: 147, easing: EASE_OUT_EXPO }),
        withTiming(1.04, { duration: 147, easing: EASE_OUT_EXPO }),
        withTiming(1, { duration: 126, easing: EASE_OUT_EXPO }),
      );
    }
    onTap();
  }
  const tapStyle = useAnimatedStyle(() => ({ transform: [{ scale: tapScale.value }] }));

  // Right ear lifts a hair on curious.
  const earRightY = 22 - spec.earLift * 1.2;

  const ariaLabel = onTap ? `Melo, ${mood}, tap to chat` : `Melo, ${mood}`;

  const figure = (
    <Animated.View style={[{ width: size, height: size }, breatheStyle, tapStyle]}>
      <Svg width={size} height={size} viewBox="0 0 40 44">
        <Defs>
          <RadialGradient id="melo-lift" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={t.ink} stopOpacity={0.24} />
            <Stop offset="100%" stopColor={t.ink} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="melo-grain" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={t.surface} stopOpacity={0.85} />
            <Stop offset="35%" stopColor={t.surface} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Paper-lift shadow — proves he's a sheet resting on the paper, not a sticker. */}
        {grounded ? <Ellipse cx={20} cy={41.6} rx={12.5} ry={1.7} fill="url(#melo-lift)" /> : null}

        {/* Celebrate — torn-paper confetti drawn from the palette. */}
        {spec.confetti ? (
          <G opacity={0.95}>
            <Rect
              x={1.5}
              y={9}
              width={2.6}
              height={1.5}
              rx={0.4}
              fill={t.calm}
              origin="2.8, 9.8"
              rotation={-18}
            />
            <Rect
              x={35}
              y={3.5}
              width={2.6}
              height={1.5}
              rx={0.4}
              fill={t.caution}
              origin="36.3, 4.3"
              rotation={22}
            />
            <Rect
              x={36}
              y={26}
              width={2.2}
              height={1.4}
              rx={0.4}
              fill={t.positive}
              origin="37.1, 26.7"
              rotation={-10}
            />
            <Rect
              x={1}
              y={28}
              width={2.4}
              height={1.4}
              rx={0.4}
              fill={t.calm}
              origin="2.2, 28.7"
              rotation={14}
            />
          </G>
        ) : null}

        <AnimatedG animatedProps={moodGroupProps}>
          {/* Ear cups — chunky ink pads, BEHIND the body so the body covers their inner edge. */}
          <Ellipse cx={4.8} cy={22} rx={3.2} ry={4.2} fill={t.ink} />
          <Ellipse cx={35.2} cy={earRightY} rx={3.2} ry={4.2} fill={t.ink} />

          {/* Soft cast-shadow under the fold flap. */}
          <Path d={FOLD_SHADOW_PATH} fill={t.ink} opacity={0.12} />

          {/* Document body — paper fill, single bold ink outline. */}
          <Path
            d={BODY_PATH}
            fill={t.surface}
            stroke={t.ink}
            strokeWidth={STROKE}
            strokeLinejoin="round"
          />
          {/* Top paper-grain highlight. */}
          <Path d={BODY_PATH} fill="url(#melo-grain)" opacity={0.35} />

          {/* Folded corner — caution-yellow with an inner crease line for depth. */}
          <Path
            d={FOLD_FILL_PATH}
            fill={t.caution}
            stroke={t.ink}
            strokeWidth={STROKE}
            strokeLinejoin="round"
          />
          <Path
            d={FOLD_CREASE_PATH}
            stroke={t.ink}
            strokeOpacity={0.35}
            strokeWidth={0.5}
            fill="none"
          />

          {/* Content lines — two short beige strokes (writing on a document). */}
          <Line
            x1={11.5}
            y1={31}
            x2={22.5}
            y2={31}
            stroke={t.hairlineStrong}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <Line
            x1={11.5}
            y1={34}
            x2={18.5}
            y2={34}
            stroke={t.hairlineStrong}
            strokeWidth={1.6}
            strokeLinecap="round"
          />

          {/* Cheek blush — only on cheer / celebrate. */}
          {spec.cheek ? (
            <G fill={t.calm} opacity={0.32}>
              <Ellipse cx={12.8} cy={24.4} rx={1.5} ry={0.9} />
              <Ellipse cx={27.2} cy={24.4} rx={1.5} ry={0.9} />
            </G>
          ) : null}

          {/* Concern — single small worry-bead at the temple. */}
          {spec.worryBead ? (
            <Path
              d="M28.5 16 Q29.4 17.4 29.4 18.4 Q29.4 19.4 28.5 19.4 Q27.6 19.4 27.6 18.4 Q27.6 17.4 28.5 16 Z"
              fill={t.calm}
              opacity={0.55}
              stroke={t.ink}
              strokeWidth={0.45}
            />
          ) : null}

          {/* Brows — subtle expression depth. */}
          {mood === 'concern' ? (
            <G stroke={t.ink} strokeWidth={1.05} strokeLinecap="round" fill="none" opacity={0.85}>
              <Path d="M14 17.4 L17.4 18.4" />
              <Path d="M26 17.4 L22.6 18.4" />
            </G>
          ) : null}
          {mood === 'curious' ? (
            <G stroke={t.ink} strokeWidth={1.05} strokeLinecap="round" fill="none" opacity={0.7}>
              <Path d="M22.4 17.6 L25.6 17.0" />
            </G>
          ) : null}

          {/* Eyes — five expressions. */}
          <Eyes expression={spec.eyes} ink={t.ink} surface={t.surface} />

          {/* Mouth — drawn at the body stroke weight so it feels carved, not penned. */}
          <Path
            d={spec.mouth}
            stroke={t.ink}
            strokeWidth={1.7}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </AnimatedG>

        {/* Pose badge — contextual signal, stays upright OUTSIDE the tilt group. */}
        {pose !== 'none' ? <PoseBadge pose={pose} palette={t} reduceMotion={reduceMotion} /> : null}
      </Svg>
    </Animated.View>
  );

  if (onTap) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ariaLabel}
        onPress={handleTap}
        hitSlop={hitSlopFor(size)}
        style={tapTargetStyle(size)}
      >
        {figure}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={ariaLabel}
      style={{ width: size, height: size }}
    >
      {figure}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Eyes
// ---------------------------------------------------------------------------

// Eyes carry the blink. Left and right blink ~5.4s apart with a small phase offset (a slightly
// shorter delay on the right), so it never reads as mechanical. Blink = a quick scaleY collapse at
// the tail of each cycle, mirroring the web @keyframes blink (≈93% of the cycle).
function Eyes({
  expression,
  ink,
  surface,
}: {
  expression: EyeExpression;
  ink: string;
  surface: string;
}) {
  if (expression === 'closed-smile') {
    return (
      <G stroke={ink} strokeWidth={1.6} strokeLinecap="round" fill="none">
        <Path d="M13.5 20.2 Q16 18 18.5 20.2" />
        <Path d="M21.5 20.2 Q24 18 26.5 20.2" />
      </G>
    );
  }
  if (expression === 'closed-worry') {
    return (
      <G stroke={ink} strokeWidth={1.6} strokeLinecap="round" fill="none">
        <Path d="M13.5 19.5 Q16 20.8 18.5 19.5" />
        <Path d="M21.5 19.5 Q24 20.8 26.5 19.5" />
      </G>
    );
  }

  // open / up — pupils nudged up on "up". Each eye blinks on its own offset clock.
  const pupilCy = expression === 'up' ? 19.4 : 20;
  const catchCy = expression === 'up' ? 18.9 : 19.5;
  const catchCyR = expression === 'up' ? 18.95 : 19.55;
  return (
    <>
      <BlinkEye
        cx={16}
        cy={pupilCy}
        catchCx={15.5}
        catchCy={catchCy}
        catchR={0.5}
        delayMs={0}
        ink={ink}
        surface={surface}
      />
      <BlinkEye
        cx={24}
        cy={pupilCy}
        catchCx={23.6}
        catchCy={catchCyR}
        catchR={0.42}
        delayMs={460}
        ink={ink}
        surface={surface}
      />
    </>
  );
}

function BlinkEye({
  cx,
  cy,
  catchCx,
  catchCy,
  catchR,
  delayMs,
  ink,
  surface,
}: {
  cx: number;
  cy: number;
  catchCx: number;
  catchCy: number;
  catchR: number;
  delayMs: number;
  ink: string;
  surface: string;
}) {
  const reduceMotion = useReduceMotion();
  const blink = useSharedValue(1); // 1 = open, ~0.08 = closed

  useEffect(() => {
    cancelAnimation(blink);
    if (reduceMotion) {
      blink.value = 1; // final state = eyes open
      return;
    }
    // One cycle ≈ 5400ms: open almost the whole time, a quick collapse + reopen near the end.
    const cycle = withSequence(
      withTiming(1, { duration: 5022 }), // ~93% open
      withTiming(0.08, { duration: 120, easing: Easing.in(Easing.ease) }),
      withTiming(1, { duration: 258, easing: EASE_OUT_EXPO }),
    );
    blink.value = withDelay(delayMs, withRepeat(cycle, -1, false));
    return () => cancelAnimation(blink);
  }, [blink, reduceMotion, delayMs]);

  const eyeProps = useAnimatedProps(() => ({
    // Collapse vertically about the pupil centre — a blink, not a shrink.
    transform: [{ translateY: cy }, { scaleY: blink.value }, { translateY: -cy }],
  }));

  return (
    <>
      <AnimatedG animatedProps={eyeProps}>
        <Circle cx={cx} cy={cy} r={1.6} fill={ink} />
      </AnimatedG>
      {/* Catchlight — a small near-white spark. Uses the surface (paper) colour so it reads as a
          highlight in both light and dark, never a hard-coded white. */}
      <Circle cx={catchCx} cy={catchCy} r={catchR} fill={surface} opacity={0.95} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Pose badge — an enamel-pin accessory at the lower-right corner
// ---------------------------------------------------------------------------

function PoseBadge({
  pose,
  palette,
  reduceMotion,
}: {
  pose: Exclude<MeloPose, 'none'>;
  palette: Palette;
  reduceMotion: boolean;
}) {
  const cx = 33;
  const cy = 36;
  const r = 5.4;
  const ink = palette.ink;

  // Pose-in — a 520ms scale-in with a soft overshoot, then it stays put (no looping).
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1.08, { duration: 312, easing: EASE_OUT_EXPO }),
      withTiming(1, { duration: 208, easing: EASE_OUT_EXPO }),
    );
  }, [enter, reduceMotion]);

  const enterProps = useAnimatedProps(() => ({
    opacity: enter.value === 0 ? 0 : 1,
    transform: [
      { translateX: cx },
      { translateY: cy },
      { scale: enter.value },
      { translateX: -cx },
      { translateY: -cy },
    ],
  }));

  const swatch = POSE_PALETTE(palette)[pose];

  return (
    <AnimatedG animatedProps={enterProps}>
      {/* Lift shadow under the badge. */}
      <Ellipse cx={cx} cy={cy + r + 0.6} rx={r * 0.85} ry={0.9} fill={ink} opacity={0.12} />
      <Circle cx={cx} cy={cy} r={r} fill={swatch.fill} stroke={swatch.stroke} strokeWidth={0.9} />
      {/* Inner hairline — reads as an enamel pin on paper. */}
      <Circle
        cx={cx}
        cy={cy}
        r={r - 0.9}
        fill="none"
        stroke={palette.surface}
        strokeOpacity={0.35}
        strokeWidth={0.4}
      />
      <PoseMark pose={pose} cx={cx} cy={cy} palette={palette} />
    </AnimatedG>
  );
}

function POSE_PALETTE(
  t: Palette,
): Readonly<Record<Exclude<MeloPose, 'none'>, { fill: string; stroke: string }>> {
  return {
    safe: { fill: t.positive, stroke: t.positive },
    check: { fill: t.caution, stroke: t.caution },
    thinking: { fill: t.calmSoft, stroke: t.calm },
    reading: { fill: t.surface, stroke: t.ink },
    mismatch: { fill: t.repair, stroke: t.repair },
    sealed: { fill: t.calm, stroke: t.calm },
  };
}

function PoseMark({
  pose,
  cx,
  cy,
  palette,
}: {
  pose: Exclude<MeloPose, 'none'>;
  cx: number;
  cy: number;
  palette: Palette;
}) {
  const ink = palette.ink;
  // On-badge marks that sit on a coloured fill use the paper colour as the "knockout" so they read
  // in both themes (the web used #FFFFFF; surface is the theme-correct equivalent).
  const knockout = palette.surface;

  switch (pose) {
    case 'safe':
      return (
        <Path
          d={`M ${cx - 2.2} ${cy + 0.1} L ${cx - 0.4} ${cy + 1.9} L ${cx + 2.4} ${cy - 1.8}`}
          stroke={knockout}
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    case 'mismatch':
      return (
        <G stroke={knockout} strokeWidth={1.3} strokeLinecap="round">
          <Line x1={cx - 1.8} y1={cy - 1.8} x2={cx + 1.8} y2={cy + 1.8} />
          <Line x1={cx + 1.8} y1={cy - 1.8} x2={cx - 1.8} y2={cy + 1.8} />
        </G>
      );
    case 'check':
      return (
        <SvgText x={cx} y={cy + 1.6} textAnchor="middle" fontSize={5.4} fontWeight="600" fill={ink}>
          ?
        </SvgText>
      );
    case 'thinking':
      return (
        <Path
          d={`M ${cx} ${cy - 2.6} L ${cx + 0.7} ${cy - 0.3} L ${cx + 2.6} ${cy} L ${cx + 0.7} ${cy + 0.3} L ${cx} ${cy + 2.6} L ${cx - 0.7} ${cy + 0.3} L ${cx - 2.6} ${cy} L ${cx - 0.7} ${cy - 0.3} Z`}
          fill={ink}
        />
      );
    case 'reading':
      return (
        <G stroke={ink} strokeLinecap="round">
          <Line x1={cx - 2.2} y1={cy - 0.9} x2={cx + 2.2} y2={cy - 0.9} strokeWidth={1.1} />
          <Line
            x1={cx - 2.2}
            y1={cy + 1.2}
            x2={cx + 1.2}
            y2={cy + 1.2}
            strokeWidth={1.1}
            opacity={0.55}
          />
        </G>
      );
    case 'sealed':
      return (
        <G>
          <Path
            d={`M ${cx - 1.4} ${cy - 1} L ${cx + 0.6} ${cy - 1} M ${cx - 1.4} ${cy} L ${cx - 0.2} ${cy} M ${cx - 1.4} ${cy - 1} L ${cx - 1.4} ${cy + 1.6}`}
            stroke={ink}
            strokeOpacity={0.85}
            strokeWidth={0.7}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={cx - 1.6} cy={cy - 1.4} r={0.6} fill={palette.surface} opacity={0.9} />
        </G>
      );
  }
}

// ---------------------------------------------------------------------------
// Tap-target sizing — guarantee a >=44px touch area regardless of glyph size
// ---------------------------------------------------------------------------

const MIN_TAP = 44;

function tapTargetStyle(size: number) {
  const pad = Math.max(0, (MIN_TAP - size) / 2);
  return {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: MIN_TAP,
    minHeight: MIN_TAP,
    padding: pad,
  };
}

function hitSlopFor(size: number): number {
  return Math.max(0, Math.ceil((MIN_TAP - size) / 2));
}
