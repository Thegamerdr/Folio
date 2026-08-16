// Melo — the faithful 1:1 React Native port of Folio's brand character.
//
// This is the canonical PNG-sprite phoenix / fenice money companion — the owner's LOCKED brand
// mascot. Source of truth (read-only, do not edit): the Lovable web component at
// C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/MeloPhoenix.tsx
//
// Mood is expressed as physical gesture (tilt, float, halo pulse, ember output) and by cross-fading
// between a small pose-sprite library — never by recolouring the bird. One character across every
// surface.
//
// Rendering stack (back to front):
//   1. Halo         — soft radial ember light, breathes with vitality
//   2. Embers       — up to 5 drifting particles rising behind the bird
//   3. Phoenix pose — cross-fades 420ms between pose sprites, floats + tilts + breathes
//   4. Ground pool  — soft warm shadow anchoring it to the surface
//   5. Pose badge   — optional enamel-pin accessory (kept from the pre-sprite vector rig; still an
//                      overlay, not a repaint of the bird itself)
//
// PUBLIC API IS FROZEN: every folio screen imports { Melo, MeloMood, MeloPose } from this file with
// the same mood/pose/size/grounded/onTap contract as the previous vector implementation, so this
// rewrite changes ONLY the rendering internals — zero call sites need to change.
//
// COLOUR DISCIPLINE (pose badge only — the bird itself is always the locked coral/gold/cream
// palette from the web original, never re-themed): every fill/stroke on the badge comes from the
// active folio palette via useTheme(). The web token → palette mapping (confirmed against kit.tsx
// `paper`): --ink → ink · --surface → surface · --caution → caution · --accent → calm ·
// --accent-soft → calmSoft · --positive → positive · --negative → repair.

import { useEffect, useId, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { serif, useTheme, type Palette } from '@/surfaces/pressureMap/kit';
import { useAppStore } from '@/folio/store';
import { CANONICAL_ASSETS } from '@/folio/assets/canonicalAssets';
import { useMeloInlineCharacterVisible } from '@/folio/companion/MeloCompanionVisibility';
import { takeCelebrateSlot, takeHeroSlot } from '@/folio/lib/melo/cadence';
import { useMeloVitality, useWeatherIntensityBias } from '@/folio/lib/melo/useVitality';

const phoenixHero = CANONICAL_ASSETS['melo/phoenix-hero.png'];
const phoenixAsleep = CANONICAL_ASSETS['melo/phoenix-asleep.png'];
const phoenixCurious = CANONICAL_ASSETS['melo/phoenix-curious.png'];
const phoenixCheer = CANONICAL_ASSETS['melo/phoenix-cheer.png'];
const phoenixProtect = CANONICAL_ASSETS['melo/phoenix-protect.png'];
const phoenixCelebrate = CANONICAL_ASSETS['melo/phoenix-celebrate.png'];
const phoenixThink = CANONICAL_ASSETS['melo/phoenix-think.png'];
const phoenixConcern = CANONICAL_ASSETS['melo/phoenix-concern.png'];
const phoenixScarf = CANONICAL_ASSETS['melo/phoenix-hero-scarf.png'];
const phoenixCrown = CANONICAL_ASSETS['melo/phoenix-hero-crown.png'];
const phoenixHeadphones = CANONICAL_ASSETS['melo/phoenix-hero-headphones.png'];

const WARDROBE_SRC: Readonly<Record<string, number>> = {
  crown: phoenixCrown,
  headphones: phoenixHeadphones,
  scarf: phoenixScarf,
};
const WARDROBE_PRIORITY = ['crown', 'headphones', 'scarf'] as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type MeloMood = 'calm' | 'curious' | 'cheer' | 'concern' | 'celebrate' | 'protect' | 'think';

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
  asleep?: boolean;
  vitality?: number;
  intensity?: number;
  /** Continuous decorative float. Root companions set this false and let choreography drive motion. */
  ambientMotion?: boolean;
  /** Halo and ember effects. Root companions enable these only for meaningful reactions. */
  effects?: boolean;
  /** Mirrors the authored body so a perched Melo can face the relevant side of the interface. */
  facing?: 'left' | 'right' | 'neutral';
  /** Reserved for the single root-mounted runtime; other instances yield while it owns the screen. */
  persistent?: boolean;
  onTap?: () => void;
};

// ---------------------------------------------------------------------------
// Mood specs — mirrored 1:1 from the web kit's MOOD map (PhoenixMood), full 7-mood set.
// curious shares the think sprite and cheer shares the hero sprite exactly as the source
// MOOD table does; float/halo timing names map to amplitude/duration pairs (base 3/3200,
// fast 3/2400, slow 2/4000) and emberSpeed seconds convert to ms.
// ---------------------------------------------------------------------------

type MoodSpec = Readonly<{
  tilt: number; // deg — body rotation
  scale: number; // subtle mass change
  floatAmplitude: number; // px, vertical drift
  floatDurationMs: number; // per float half-cycle
  glow: number; // halo opacity 0..1 (base, before vitality)
  embers: number; // 0..5 particles (base)
  emberSpeedMs: number; // ms per rise cycle
  src: number;
}>;

const MOOD: Readonly<Record<MeloMood, MoodSpec>> = {
  calm: {
    tilt: 0,
    scale: 1.0,
    floatAmplitude: 3,
    floatDurationMs: 3200,
    glow: 0.42,
    embers: 2,
    emberSpeedMs: 6400,
    src: phoenixHero,
  },
  curious: {
    tilt: -4,
    scale: 1.01,
    floatAmplitude: 3,
    floatDurationMs: 2400,
    glow: 0.52,
    embers: 3,
    emberSpeedMs: 4800,
    src: phoenixCurious,
  },
  cheer: {
    tilt: 2,
    scale: 1.03,
    floatAmplitude: 3,
    floatDurationMs: 3200,
    glow: 0.7,
    embers: 4,
    emberSpeedMs: 4200,
    src: phoenixCheer,
  },
  concern: {
    tilt: -2,
    scale: 0.98,
    floatAmplitude: 2,
    floatDurationMs: 4000,
    glow: 0.22,
    embers: 1,
    emberSpeedMs: 8000,
    src: phoenixConcern,
  },
  celebrate: {
    tilt: 4,
    scale: 1.05,
    floatAmplitude: 3,
    floatDurationMs: 2400,
    glow: 0.92,
    embers: 5,
    emberSpeedMs: 3200,
    src: phoenixCelebrate,
  },
  protect: {
    tilt: 0,
    scale: 1.02,
    floatAmplitude: 3,
    floatDurationMs: 3200,
    glow: 0.6,
    embers: 3,
    emberSpeedMs: 5600,
    src: phoenixProtect,
  },
  think: {
    tilt: -6,
    scale: 1.0,
    floatAmplitude: 2,
    floatDurationMs: 4000,
    glow: 0.34,
    embers: 2,
    emberSpeedMs: 7200,
    src: phoenixThink,
  },
};

// Deterministic pseudo-random for particle placement — same formula as the web original
// (Math.sin(seed) fractional part) so ember scatter matches in feel.
function rand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Reduced-motion hook (local, AccessibilityInfo-backed)
// ---------------------------------------------------------------------------

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
// Melo
// ---------------------------------------------------------------------------

export function Melo({
  mood,
  pose = 'none',
  size = 28,
  grounded = true,
  asleep = false,
  vitality,
  intensity = 1,
  ambientMotion = true,
  effects = true,
  facing = 'neutral',
  persistent = false,
  onTap,
}: MeloProps) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const inlineCharacterVisible = useMeloInlineCharacterVisible();
  const quietMode = useAppStore((state) => state.melo?.quietMode === true);
  const wardrobe = useAppStore((state) => state.melo?.wardrobe ?? []);
  const cycleId = useAppStore((state) => state.cycles[0]?.closedAt ?? 'none');
  const vitalityFromStore = useMeloVitality();
  const weatherBias = useWeatherIntensityBias();
  const heroGrant = useRef<boolean | null>(null);
  if (size >= 100 && heroGrant.current === null) heroGrant.current = takeHeroSlot();
  if (size < 100) heroGrant.current = null;
  const renderSize = size >= 100 && heroGrant.current === false ? 64 : size;

  const celebrateGrant = useRef<{ cycleId: string; granted: boolean } | null>(null);
  if (mood === 'celebrate') {
    if (celebrateGrant.current?.cycleId !== cycleId) {
      celebrateGrant.current = { cycleId, granted: takeCelebrateSlot(cycleId) };
    }
  } else {
    celebrateGrant.current = null;
  }
  const cadenceMood =
    mood === 'celebrate' && celebrateGrant.current?.granted === false ? 'cheer' : mood;
  const effectiveMood = asleep ? 'calm' : cadenceMood;
  const baseSpec = asleep ? { ...MOOD.calm, src: phoenixAsleep } : MOOD[effectiveMood];
  const wardrobeSwappable =
    !asleep &&
    (effectiveMood === 'calm' || effectiveMood === 'cheer' || effectiveMood === 'protect');
  const activeWardrobe = wardrobeSwappable
    ? WARDROBE_PRIORITY.find((id) => wardrobe.includes(id))
    : undefined;
  const wardrobeSrc = activeWardrobe ? WARDROBE_SRC[activeWardrobe] : undefined;
  const spec = wardrobeSrc === undefined ? baseSpec : { ...baseSpec, src: wardrobeSrc };

  const vCap = cadenceMood === 'concern' ? 0.5 : 1;
  const v = asleep
    ? 0.15
    : Math.max(0, Math.min(1, (vitality ?? vitalityFromStore) * weatherBias * intensity)) * vCap;
  const vMul = 0.35 + v * 0.9;

  const effGlow = Math.min(1, spec.glow * vMul);
  const effEmbers = Math.max(0, Math.round(spec.embers * (0.4 + v * 0.9)));
  const showGlow = effects && !asleep && renderSize >= 32;
  const showEmbers = showGlow && !reduceMotion && effEmbers > 0 && renderSize >= 44;

  // Tap — a quick acknowledge scale (matches the vector rig's tap affordance).
  const tapScale = useRef(new Animated.Value(1)).current;
  function handleTap() {
    if (!onTap) return;
    if (!reduceMotion) {
      Animated.sequence([
        Animated.timing(tapScale, { toValue: 0.92, duration: 110, useNativeDriver: true }),
        Animated.timing(tapScale, { toValue: 1.04, duration: 110, useNativeDriver: true }),
        Animated.timing(tapScale, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
    onTap();
  }

  const ariaLabel = onTap ? `Melo, ${mood}, tap to chat` : `Melo, ${mood}`;

  // Quiet Mode is a product-level promise to hide the character while keeping every money feature
  // available. Preserve the requested footprint so layouts do not jump when it is toggled.
  if (quietMode || (!persistent && !inlineCharacterVisible)) return null;

  const figure = (
    <Animated.View
      style={{
        width: renderSize,
        height: renderSize,
        opacity: asleep ? 0.78 : 1,
        transform: [{ scale: tapScale }],
      }}
    >
      <Halo size={renderSize} opacity={effGlow * 0.75} visible={showGlow} />
      {showEmbers ? (
        <Embers size={renderSize} count={effEmbers} speedMs={spec.emberSpeedMs} />
      ) : null}
      <PhoenixBody
        animateAmbient={ambientMotion}
        facing={facing}
        spec={spec}
        size={renderSize}
        reduceMotion={reduceMotion}
        showGlow={showGlow}
        effGlow={effGlow}
        tintColor={asleep ? t.muted : undefined}
      />
      {asleep && renderSize >= 64 ? (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            color: t.muted,
            fontFamily: serif.displayItalic,
            fontSize: Math.round(renderSize * 0.16),
            fontStyle: 'italic',
            letterSpacing: -0.3,
            lineHeight: Math.round(renderSize * 0.18),
            opacity: 0.7,
            position: 'absolute',
            right: renderSize * 0.1,
            top: renderSize * 0.06,
          }}
        >
          zz
        </Text>
      ) : null}
      {grounded ? <GroundPool size={renderSize} opacity={0.5 + v * 0.3} /> : null}
      {pose !== 'none' ? (
        <PoseBadge pose={pose} palette={t} reduceMotion={reduceMotion} size={renderSize} />
      ) : null}
    </Animated.View>
  );

  if (onTap) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ariaLabel}
        onPress={handleTap}
        hitSlop={hitSlopFor(renderSize)}
        style={tapTargetStyle(renderSize)}
      >
        {figure}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={ariaLabel}
      style={{ width: renderSize, height: renderSize }}
    >
      {figure}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 1. Halo — breathing ember light behind the bird.
// ---------------------------------------------------------------------------

function Halo({ size, opacity, visible }: { size: number; opacity: number; visible: boolean }) {
  const uid = useId();
  if (!visible) return null;
  const inset = size * 0.14;
  const diameter = size + inset * 2;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -inset,
        top: -inset,
        width: diameter,
        height: diameter,
        opacity,
      }}
    >
      <Svg width={diameter} height={diameter} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`meloHalo-${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="rgb(224,99,58)" stopOpacity={0.32} />
            <Stop offset="0.55" stopColor="rgb(217,164,65)" stopOpacity={0.1} />
            <Stop offset="0.78" stopColor="rgb(224,99,58)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={`url(#meloHalo-${uid})`} />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 2. Embers — drifting particles rising behind the bird, deterministic placement.
// ---------------------------------------------------------------------------

function Embers({ size, count, speedMs }: { size: number; count: number; speedMs: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }).map((_, i) => (
        <Ember key={i} index={i} size={size} speedMs={speedMs} />
      ))}
    </View>
  );
}

function Ember({ index, size, speedMs }: { index: number; size: number; speedMs: number }) {
  const seed = index + 1;
  const leftPct = 20 + rand(seed * 3.1) * 60;
  const delayMs = rand(seed * 5.7) * speedMs;
  const durMs = speedMs * (0.85 + rand(seed * 7.3) * 0.4);
  const dotSize = Math.max(3, size * (0.05 + rand(seed * 2.2) * 0.05));
  const isCoral = rand(seed * 11.1) > 0.5;
  const color = isCoral ? 'rgba(224,99,58,0.7)' : 'rgba(217,164,65,0.7)';

  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(drift, {
          toValue: 1,
          duration: durMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, delayMs, durMs]);

  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.55] });
  const opacity = drift.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0, 0.7, 0.4, 0],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        bottom: size * 0.42,
        width: dotSize,
        height: dotSize,
        borderRadius: dotSize / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// 3. Phoenix body — floats + tilts, cross-fades 420ms between the previous and current pose
// sprite so a worried -> calm transition reads as relief, not an asset swap. Honours reduce-motion
// (instant swap, no fade, no float).
// ---------------------------------------------------------------------------

function PhoenixBody({
  animateAmbient,
  facing,
  spec,
  size,
  reduceMotion,
  showGlow,
  effGlow,
  tintColor,
}: {
  animateAmbient: boolean;
  facing: 'left' | 'right' | 'neutral';
  spec: MoodSpec;
  size: number;
  reduceMotion: boolean;
  showGlow: boolean;
  effGlow: number;
  tintColor?: string | undefined;
}) {
  const [prevSrc, setPrevSrc] = useState<number | null>(null);
  const lastSrc = useRef(spec.src);
  const crossFade = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;

  // Pose cross-fade.
  useEffect(() => {
    if (lastSrc.current === spec.src) return;
    if (reduceMotion) {
      lastSrc.current = spec.src;
      return;
    }
    setPrevSrc(lastSrc.current);
    lastSrc.current = spec.src;
    crossFade.setValue(0);
    Animated.timing(crossFade, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => setPrevSrc(null));
  }, [spec.src, reduceMotion, crossFade]);

  // Slow float loop (per-mood amplitude/speed).
  useEffect(() => {
    if (reduceMotion || !animateAmbient) {
      float.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: spec.floatDurationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: spec.floatDurationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animateAmbient, float, spec.floatDurationMs, reduceMotion]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -spec.floatAmplitude],
  });

  const poseTransform = [
    { translateY },
    { rotate: `${spec.tilt}deg` },
    { scale: spec.scale },
    { scaleX: facing === 'left' ? -1 : 1 },
  ];

  const shadowOpacity = showGlow ? 0.2 + effGlow * 0.35 : 0;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }}>
      {prevSrc !== null ? (
        <Animated.Image
          source={prevSrc}
          resizeMode="contain"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            opacity: crossFade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: poseTransform,
            shadowColor: 'rgb(224,99,58)',
            shadowOpacity,
            shadowRadius: size * 0.06,
            shadowOffset: { width: 0, height: size * 0.03 },
            tintColor,
          }}
        />
      ) : null}
      <Animated.Image
        source={spec.src}
        resizeMode="contain"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          opacity: reduceMotion ? 1 : crossFade,
          transform: poseTransform,
          shadowColor: 'rgb(224,99,58)',
          shadowOpacity,
          shadowRadius: size * 0.06,
          shadowOffset: { width: 0, height: size * 0.03 },
          tintColor,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// 4. Ground pool — soft warm shadow anchoring the bird to the surface.
// ---------------------------------------------------------------------------

function GroundPool({ size, opacity }: { size: number; opacity: number }) {
  const uid = useId();
  const width = size * 0.44;
  const height = size * 0.06;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: size * 0.28, bottom: 0, width, height, opacity }}
    >
      <Svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={`meloGround-${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="rgba(26,24,21,1)" stopOpacity={0.14} />
            <Stop offset="0.78" stopColor="rgba(26,24,21,1)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={`url(#meloGround-${uid})`} />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 5. Pose badge — an enamel-pin accessory at the lower-right corner. Kept from the pre-sprite
// vector rig as a separate overlay (the sprite bird itself is never repainted).
// ---------------------------------------------------------------------------

const AnimatedG = Animated.createAnimatedComponent(G);
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

function PoseBadge({
  pose,
  palette,
  reduceMotion,
  size,
}: {
  pose: Exclude<MeloPose, 'none'>;
  palette: Palette;
  reduceMotion: boolean;
  size: number;
}) {
  const badgeSize = 40; // fixed badge-space viewBox, independent of the bird's own size
  const cx = 33;
  const cy = 36;
  const r = 5.4;
  const ink = palette.ink;

  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.timing(enter, { toValue: 0, duration: 0, useNativeDriver: false }),
      Animated.timing(enter, {
        toValue: 1.08,
        duration: 312,
        easing: EASE_OUT_EXPO,
        useNativeDriver: false,
      }),
      Animated.timing(enter, {
        toValue: 1,
        duration: 208,
        easing: EASE_OUT_EXPO,
        useNativeDriver: false,
      }),
    ]).start();
  }, [enter, reduceMotion]);

  const swatch = POSE_PALETTE(palette)[pose];

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${badgeSize} ${badgeSize}`}>
        <G opacity={reduceMotion ? 1 : undefined}>
          {/* Lift shadow under the badge. */}
          <Circle cx={cx} cy={cy + r + 0.6} r={r * 0.85} fill={ink} opacity={0.12} />
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            fill={swatch.fill}
            stroke={swatch.stroke}
            strokeWidth={0.9}
          />
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
        </G>
      </Svg>
    </View>
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
