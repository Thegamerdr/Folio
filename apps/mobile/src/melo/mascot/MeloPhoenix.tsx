// MeloPhoenix — 1:1 RN port of the locked web mascot identity.
//
// Source of truth (read-only, do not edit): the Lovable web component at
// C:/dev/folio-melo/.claude/worktrees/design-main/src/components/folio/MeloPhoenix.tsx
//
// Melo is a compact phoenix / fenice money companion. Mood is expressed as
// physical gesture (tilt, float, halo, embers) and by cross-fading between a
// small pose library — never by recolouring the bird. Ported from CSS/PNG to
// react-native Animated + react-native-svg, same rendering order:
//   1. Halo         — soft radial ember light, breathes with vitality
//   2. Embers        — 3-5 drifting particles, deterministic placement
//   3. Phoenix pose  — cross-fades 420ms between pose sprites, floats
//   4. Ground pool   — soft warm shadow anchoring it to the surface
//
// This file adapts the engine's MascotFamily (calm/joy/concern/stress/
// sadness/hope/squint) onto the web's PhoenixMood vocabulary (calm/curious/
// cheer/concern/celebrate/protect/think) per the pinned mapping below, and
// keeps the existing MeloMascot call-site contract (emotion/size/glow/
// breathe/breatheDurationMs/wardrobe) so it drops in without touching
// callers.

import { useEffect, useRef, useState, type JSX } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import type { MascotFamily } from '@folio/melo-engine';

const phoenixHero = require('./assets/phoenix-hero.png');
const phoenixProtect = require('./assets/phoenix-protect.png');
const phoenixCelebrate = require('./assets/phoenix-celebrate.png');
const phoenixThink = require('./assets/phoenix-think.png');
const phoenixConcern = require('./assets/phoenix-concern.png');

/** Web pose vocabulary — see design-main MeloPhoenix.tsx `PhoenixMood`. */
type PhoenixMood = 'calm' | 'curious' | 'cheer' | 'concern' | 'celebrate' | 'protect' | 'think';

type MoodSpec = {
  tilt: number; // deg — body rotation
  scale: number; // subtle mass change
  floatAmplitude: number; // px, vertical drift
  floatDurationMs: number; // per float half-cycle
  glow: number; // halo opacity 0..1 (base, before vitality)
  embers: number; // 0..5 particles (base)
  emberSpeedMs: number; // ms per rise cycle
  src: number;
};

const MOOD: Record<PhoenixMood, MoodSpec> = {
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
    src: phoenixThink,
  },
  cheer: {
    tilt: 2,
    scale: 1.03,
    floatAmplitude: 3,
    floatDurationMs: 3200,
    glow: 0.7,
    embers: 4,
    emberSpeedMs: 4200,
    src: phoenixHero,
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
    floatDurationMs: 2800,
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

/** Screen readers hear a human mood, never an internal emotion-family name (parity with MeloMascot). */
const A11Y_MOOD: Record<MascotFamily, string> = {
  calm: 'calm',
  joy: 'happy',
  concern: 'a little worried',
  stress: 'keeping watch',
  sadness: 'sad',
  hope: 'hopeful',
  squint: 'unable to see clearly',
};

/**
 * Engine MascotFamily -> web PhoenixMood, pinned per task spec:
 *   calm -> calm
 *   joy -> cheer (hero pose), or celebrate when glow > 0.9
 *   concern -> concern
 *   stress -> protect
 *   sadness -> concern (vitality capped at 0.35 by the caller-facing curve below)
 *   hope -> curious (hero pose, slight tilt)
 *   squint -> think
 */
function toMood(emotion: MascotFamily, vitality: number): PhoenixMood {
  switch (emotion) {
    case 'calm':
      return 'calm';
    case 'joy':
      return vitality > 0.9 ? 'celebrate' : 'cheer';
    case 'concern':
      return 'concern';
    case 'stress':
      return 'protect';
    case 'sadness':
      return 'concern';
    case 'hope':
      return 'curious';
    case 'squint':
      return 'think';
    default:
      return 'calm';
  }
}

// Deterministic pseudo-random for particle placement — same formula as web
// (Math.sin(seed) fractional part) so ember scatter matches in feel.
function rand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduce(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

type Props = {
  emotion: MascotFamily;
  size?: number;
  /** 0..1 — plumage vitality. Drives halo strength, ember count, and glow curve. */
  glow?: number;
  breathe?: boolean;
  breatheDurationMs?: number;
  /** Accepted for call-site compatibility. Sprite poses carry no separate
   * accessory layer yet — unknown/known ids both render nothing (v1). */
  wardrobe?: string | null;
};

export function MeloPhoenix({
  emotion,
  size = 96,
  glow = 0.7,
  breathe = false,
  breatheDurationMs = 6_500,
  wardrobe = null,
}: Props): JSX.Element {
  // wardrobe accessories are not implemented for sprite poses v1 — accepted,
  // intentionally unused (see Props comment above).
  void wardrobe;

  const vitalityInput = Math.max(0, Math.min(1, glow));
  const mood = toMood(emotion, vitalityInput);
  const spec = MOOD[mood];
  const reduceMotion = useReduceMotion();

  // Vitality curve, ported from web: 0.35 (dim) -> 1.25 (radiant). Concern
  // mood caps it at 0.5. Sadness (mapped to concern above) is additionally
  // capped at 0.35 per the pinned mapping.
  const vCap = mood === 'concern' ? (emotion === 'sadness' ? 0.35 : 0.5) : 1;
  const v = vitalityInput * vCap;
  const vMul = 0.35 + v * 0.9;

  const effGlow = Math.min(1, spec.glow * vMul);
  const effEmbers = Math.max(0, Math.round(spec.embers * (0.4 + v * 0.9)));
  const showEmbers = !reduceMotion && effEmbers > 0 && size >= 44;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Melo, ${A11Y_MOOD[emotion]}`}
    >
      <Halo size={size} opacity={effGlow * 0.75} />
      {showEmbers && <Embers size={size} count={effEmbers} speedMs={spec.emberSpeedMs} />}
      <PhoenixBody
        spec={spec}
        size={size}
        breathe={breathe}
        breatheDurationMs={breatheDurationMs}
        reduceMotion={reduceMotion}
      />
      <GroundPool size={size} opacity={0.5 + v * 0.3} />
    </View>
  );
}

/** 1. Halo — breathing ember light behind the bird. */
function Halo({ size, opacity }: { size: number; opacity: number }) {
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
          <RadialGradient id="meloPhoenixHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="rgb(224,99,58)" stopOpacity={0.32} />
            <Stop offset="0.55" stopColor="rgb(217,164,65)" stopOpacity={0.1} />
            <Stop offset="0.78" stopColor="rgb(224,99,58)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill="url(#meloPhoenixHalo)" />
      </Svg>
    </View>
  );
}

/** 2. Embers — drifting particles rising behind the bird, deterministic placement. */
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

/**
 * 3. Phoenix body — floats + tilts, cross-fades 420ms between the previous
 * and current pose sprite so a worried -> calm transition reads as relief,
 * not an asset swap. Honours reduce-motion (instant swap, no fade, no float).
 */
function PhoenixBody({
  spec,
  size,
  breathe,
  breatheDurationMs,
  reduceMotion,
}: {
  spec: MoodSpec;
  size: number;
  breathe: boolean;
  breatheDurationMs: number;
  reduceMotion: boolean;
}) {
  const [prevSrc, setPrevSrc] = useState<number | null>(null);
  const lastSrc = useRef(spec.src);
  const crossFade = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  const breatheScale = useRef(new Animated.Value(1)).current;

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
    if (reduceMotion) {
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
  }, [float, spec.floatDurationMs, reduceMotion]);

  // Breathing loop (opt-in via prop, respects reduce-motion — mirrors MeloMascot).
  useEffect(() => {
    if (!breathe || reduceMotion || breatheDurationMs <= 0) {
      breatheScale.setValue(1);
      return;
    }
    const half = breatheDurationMs / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheScale, {
          toValue: 1.025,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheScale, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, breatheDurationMs, reduceMotion, breatheScale]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -spec.floatAmplitude],
  });

  const poseTransform = [
    { translateY },
    { scale: breatheScale },
    { rotate: `${spec.tilt}deg` },
    { scale: spec.scale },
  ];

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }}>
      {prevSrc !== null && (
        <Animated.Image
          source={prevSrc}
          resizeMode="contain"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            opacity: crossFade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: poseTransform,
          }}
        />
      )}
      <Animated.Image
        source={spec.src}
        resizeMode="contain"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          opacity: reduceMotion ? 1 : crossFade,
          transform: poseTransform,
        }}
      />
    </View>
  );
}

/** 4. Ground pool — soft warm shadow anchoring the bird to the surface. */
function GroundPool({ size, opacity }: { size: number; opacity: number }) {
  const width = size * 0.44;
  const height = size * 0.06;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: size * 0.28,
        bottom: 0,
        width,
        height,
        opacity,
      }}
    >
      <Svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="meloPhoenixGround" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="rgba(26,24,21,1)" stopOpacity={0.14} />
            <Stop offset="0.78" stopColor="rgba(26,24,21,1)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill="url(#meloPhoenixGround)" />
      </Svg>
    </View>
  );
}

export default MeloPhoenix;
