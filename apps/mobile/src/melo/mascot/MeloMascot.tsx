// The Melo mascot rig — react-native-svg port of the Phase-1 prototype rig.
// Seven emotion families (engine MascotFamily), three colorways, belly-glow as a status display.
// Adult by restraint (MELO_BLUEPRINT.md §3.1): medium eyes, calm posture, no perpetual grin.
// Breathing is a slow scale loop that honours the OS reduce-motion setting.

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { MascotFamily } from '@folio/melo-engine';

import { MELO_COLORWAYS, type MeloColorway } from '../theme/weather';

const INK = '#3A342C';
const UMBRELLA = '#5A646E';

type Props = {
  emotion: MascotFamily;
  colorway?: MeloColorway;
  size?: number;
  /** 0..1 — belly-glow brightness (bright = safe, dim = storm). */
  glow?: number;
  breathe?: boolean;
  breatheDurationMs?: number;
};

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

export function MeloMascot({
  emotion,
  colorway = 'ember',
  size = 96,
  glow = 0.8,
  breathe = false,
  breatheDurationMs = 6_500,
}: Props) {
  const c = MELO_COLORWAYS[colorway];
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!breathe || reduceMotion || breatheDurationMs <= 0) {
      scale.setValue(1);
      return;
    }
    const half = breatheDurationMs / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.025,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, breatheDurationMs, reduceMotion, scale]);

  const crestDip =
    emotion === 'concern' ? 2.5 : emotion === 'stress' ? 3 : emotion === 'sadness' ? 3.5 : 0;
  const glowId = `meloGlow-${colorway}`;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel={`Melo, ${emotion}`}>
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c.glow} stopOpacity="1" />
            <Stop offset="1" stopColor={c.glow} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* tail */}
        <Path d="M86 94 q16 8 24 -2 q-9 -1 -15 -9" fill={c.shade} />
        {/* body */}
        <Path
          d="M60 20 C42 20 28 38 28 66 C28 94 42 106 60 106 C78 106 92 94 92 66 C92 38 78 20 60 20 Z"
          fill={c.body}
        />
        {/* crest */}
        <G translateY={crestDip}>
          <Circle cx={46} cy={24} r={5} fill={c.crest} />
          <Circle cx={60} cy={18.5} r={6} fill={c.crest} />
          <Circle cx={74} cy={24} r={5} fill={c.crest} />
        </G>
        {/* belly + glow */}
        <Ellipse cx={60} cy={81} rx={20} ry={15.5} fill={c.belly} opacity={0.95} />
        <Ellipse cx={60} cy={81} rx={16} ry={12} fill={`url(#${glowId})`} opacity={glow} />

        <Face emotion={emotion} bodyFill={c.body} />
      </Svg>
    </Animated.View>
  );
}

function Face({ emotion, bodyFill }: { emotion: MascotFamily; bodyFill: string }) {
  switch (emotion) {
    case 'calm':
      return (
        <G>
          <Ellipse cx={46} cy={56} rx={4} ry={4.6} fill={INK} />
          <Ellipse cx={74} cy={56} rx={4} ry={4.6} fill={INK} />
          <Rect x={40.5} y={48.6} width={11} height={5} rx={2.5} fill={bodyFill} />
          <Rect x={68.5} y={48.6} width={11} height={5} rx={2.5} fill={bodyFill} />
          <Path
            d="M55 72 q5 3.5 10 0"
            stroke={INK}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      );
    case 'joy':
      return (
        <G>
          <Path
            d="M40 57 q6 -7 12 0"
            stroke={INK}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M68 57 q6 -7 12 0"
            stroke={INK}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M53 70 q7 8 14 0"
            stroke={INK}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
          <Ellipse cx={39} cy={65} rx={4} ry={2.4} fill="#C4623A" opacity={0.22} />
          <Ellipse cx={81} cy={65} rx={4} ry={2.4} fill="#C4623A" opacity={0.22} />
        </G>
      );
    case 'concern':
      return (
        <G>
          <Path d="M39 46.5 l13 -3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M81 46.5 l-13 -3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={46} cy={56} rx={4.2} ry={5} fill={INK} />
          <Ellipse cx={74} cy={56} rx={4.2} ry={5} fill={INK} />
          <Path d="M55 73 h10" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
    case 'stress':
      return (
        <G>
          {/* the storm vigil: composed, holding a small umbrella (§3.2) */}
          <Path d="M66 24 A21 21 0 0 1 108 24 L108 25 Q87 16 66 25 Z" fill={UMBRELLA} />
          <Path
            d="M87 24 V50 q0 6 6 6"
            stroke={INK}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M40 46 h12" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M68 46 h12" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={46} cy={56} rx={3.8} ry={4.2} fill={INK} />
          <Ellipse cx={74} cy={56} rx={3.8} ry={4.2} fill={INK} />
          <Path d="M56 73 h8" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
    case 'sadness':
      return (
        <G>
          {/* one honest beat — never aimed at the user (§3.1) */}
          <Path d="M39 43.5 l13 3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M81 43.5 l-13 3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Ellipse cx={46} cy={57} rx={4} ry={4.2} fill={INK} />
          <Ellipse cx={74} cy={57} rx={4} ry={4.2} fill={INK} />
          <Rect x={40.5} y={50} width={11} height={4.6} rx={2.3} fill={bodyFill} />
          <Rect x={68.5} y={50} width={11} height={4.6} rx={2.3} fill={bodyFill} />
          <Path
            d="M55 75 q5 -3 10 0"
            stroke={INK}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      );
    case 'hope':
      return (
        <G rotation={-3} origin="60, 60">
          <Ellipse cx={46} cy={55} rx={4} ry={4.6} fill={INK} />
          <Ellipse cx={74} cy={55} rx={4} ry={4.6} fill={INK} />
          <Circle cx={47.6} cy={53.4} r={1.3} fill="#FFF6EA" opacity={0.9} />
          <Circle cx={75.6} cy={53.4} r={1.3} fill="#FFF6EA" opacity={0.9} />
          <Path
            d="M55 72 q6 2.5 11 -1"
            stroke={INK}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      );
    case 'squint':
      return (
        <G>
          <Path
            d="M38 47 Q60 40 82 47"
            stroke={INK}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            opacity={0.7}
          />
          <Path d="M40 56 h12" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M68 56 h12" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M56 72 h8" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
  }
}
