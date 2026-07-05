// MeloWeatherGlyph — the faithful 1:1 RN port of the web
// (folio-melo/.claude/worktrees/design-main/src/components/folio/MeloWeatherGlyph.tsx).
//
// A tiny "horizon strip" (aspect 22:12) — a small window of sky that sits beside/above the honest
// weather label. Not a stock weather icon: the *contents* and *ink density* of the strip carry the
// mood. Sunny is mostly empty; storm is mostly full. The eye reads the cycle before it reads the
// shape.
//
// State vocabulary (all hairline ink; only storm/rainbow/alarm carry the calm/terracotta accent —
// that scarcity is what makes accent states mean something):
//   sunny   — low sun disc on the right, empty sky
//   cloudy  — a single long cloud silhouette, no sun
//   rainy   — lower cloud + two short vertical drops
//   storm   — dense low cloud + one accent diagonal (weight, not noise)
//   rainbow — three stacked arcs, top arc accent (the break after)
//   night   — small high crescent + one ink speck as a star
//   alarm   — horizon line + a single accent dot doing a 2s opacity breath (0.55 -> 1 -> 0.55).
//             Heartbeat, not alert. Reduced motion swaps to steady full opacity.
//   fog     — a low haze band + faint suggestion of shapes above. Ink-only.
//   windy   — three angled strokes suggesting drift. Ink-only.
//   heatwave— sun disc + two rising ripples. Accent on the ripples signals warmth, not danger.
//   freeze  — a small snowflake-ish cross. Ink-only.
//
// Contract preserved: `size` is treated as HEIGHT (px). Width derives as height * 22/12. No new
// data — the caller passes the derived `weather` value.
//
// RN mapping: the web's `key={weather}` re-mount for a cross-fade + the alarm opacity breath both
// become reanimated shared values. Reduced motion collapses to the final rest state per MOTION.md.

import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/folio/theme';

// Local reduce-motion hook — kept self-contained rather than importing a shared utility, matching
// the house pattern every screen + Melo.tsx already uses (no shared `useReduceMotion` module
// exists in this app; each foundation piece owns a tiny copy instead of pulling in a dependency).
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

// FIDELITY DECISION: the web imports `MeloWeather` from `@/lib/melo/state` (the Melo emotional
// engine — meloState/derive weather thresholds), which is not yet ported to RN (confirmed: no
// `@/folio/lib/melo/state` module and no `MeloWeather` export anywhere in this app — the modes/
// melo-state engine port is a separate parallel workstream). This glyph is a pure presentational
// primitive, so it declares its own local `MeloWeather` union matching the web's vocabulary
// exactly (§5 of PORT_BIBLE) rather than fabricate the engine. Once `@/folio/lib/melo/state` (or
// `@/folio/lib/modes`) ships a real `MeloWeather` export, re-point this type to that import.
export type MeloWeather =
  | 'sunny'
  | 'cloudy'
  | 'rainy'
  | 'storm'
  | 'rainbow'
  | 'night'
  | 'alarm'
  | 'fog'
  | 'windy'
  | 'heatwave'
  | 'freeze';

export type MeloWeatherGlyphProps = {
  weather: MeloWeather;
  /** Height in px. Default 12 (header + chat avatar). Width = height * 22/12. */
  size?: number | undefined;
};

const VIEW_W = 22;
const VIEW_H = 12;
const STROKE = 1.3;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function MeloWeatherGlyph({ weather, size = 12 }: MeloWeatherGlyphProps) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const height = size;
  const width = Math.round((size * VIEW_W) / VIEW_H);

  const breath = useSharedValue(1);
  useEffect(() => {
    if (weather !== 'alarm' || reduceMotion) {
      breath.value = 1;
      return undefined;
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return undefined;
  }, [breath, weather, reduceMotion]);

  const breathProps = useAnimatedProps(() => ({ opacity: breath.value }));

  const ink = t.ink;
  const accent = t.calm;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height }}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} fill="none">
        <G
          key={weather}
          stroke={ink}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {weather === 'sunny' ? <Circle cx={16.5} cy={8.5} r={2.2} fill="none" /> : null}

          {weather === 'cloudy' ? (
            <Path d="M3.5 8.5 Q5 5.5 8 6 Q10 3.8 13 5.2 Q16.5 4.8 17.5 7.5 Q18.5 9 16.5 9.2 L5 9.2 Q3.2 9 3.5 8.5 Z" />
          ) : null}

          {weather === 'rainy' ? (
            <G>
              <Path d="M5 7 Q6.2 4.5 9 5 Q11 3.5 13.5 4.8 Q16 4.6 16.8 6.8 Q17.6 8 15.8 8.2 L6.5 8.2 Q4.8 8 5 7 Z" />
              <Path d="M8 10 v1.5" />
              <Path d="M13 10 v1.5" />
            </G>
          ) : null}

          {weather === 'storm' ? (
            <G>
              <Path
                d="M3 7.5 Q4.5 4 8 4.5 Q10.5 2.5 14 4 Q17.5 3.5 18.5 6.5 Q19.5 8.5 17 8.8 L5 8.8 Q2.5 8.5 3 7.5 Z"
                fill={ink}
                fillOpacity={0.14}
              />
              <Path d="M11 9 l-1.4 2.6" stroke={accent} />
            </G>
          ) : null}

          {weather === 'rainbow' ? (
            <G>
              <Path d="M3 11 A8 8 0 0 1 19 11" stroke={accent} />
              <Path d="M5 11 A6 6 0 0 1 17 11" />
              <Path d="M7 11 A4 4 0 0 1 15 11" />
            </G>
          ) : null}

          {weather === 'night' ? (
            <G>
              <Path d="M16 6 A3 3 0 1 1 13.5 3.2 A2.3 2.3 0 0 0 16 6 Z" />
              <Circle cx={5.5} cy={4} r={0.55} fill={ink} stroke="none" />
            </G>
          ) : null}

          {weather === 'alarm' ? (
            <G>
              <Path d="M2.5 10.5 H19.5" />
              <AnimatedCircle
                cx={11}
                cy={6}
                r={1.4}
                fill={accent}
                stroke="none"
                animatedProps={breathProps}
              />
            </G>
          ) : null}

          {weather === 'fog' ? (
            <G>
              <Path d="M2 8.5 H20" strokeOpacity={0.5} />
              <Path d="M3 10 H19" strokeOpacity={0.35} />
              <Path d="M6 6.5 Q8 5.5 10 6.5" strokeOpacity={0.25} />
              <Path d="M13 6 Q15 5 17 6" strokeOpacity={0.25} />
            </G>
          ) : null}

          {weather === 'windy' ? (
            <G>
              <Path d="M3 4.5 Q9 4 15 5.5 L18 5.5" />
              <Path d="M3 8   Q9 7.5 15 9   L18 9" strokeOpacity={0.7} />
              <Path d="M3 11  Q9 10.5 15 11.5 L18 11.5" strokeOpacity={0.4} />
            </G>
          ) : null}

          {weather === 'heatwave' ? (
            <G>
              <Circle cx={16.5} cy={4.5} r={1.8} fill="none" />
              <Path d="M2 8   Q6 6.5 10 8   T18 8" stroke={accent} strokeOpacity={0.6} />
              <Path d="M2 10.5 Q6 9   10 10.5 T18 10.5" stroke={accent} />
            </G>
          ) : null}

          {weather === 'freeze' ? (
            <G>
              <Path d="M11 2.5 V10.5" />
              <Path d="M6 6.5 L16 6.5" />
              <Path d="M7.5 3   L14.5 10" strokeOpacity={0.6} />
              <Path d="M14.5 3 L7.5 10" strokeOpacity={0.6} />
            </G>
          ) : null}
        </G>
      </Svg>
    </View>
  );
}
