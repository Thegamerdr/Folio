// MeloReaction — faithful 1:1 RN port of the web visual prototype
// (folio-melo/.claude/worktrees/design-main/src/components/folio/MeloReaction.tsx).
//
// MELO_EMOTIONAL_ENGINE.md § 3 lists 16 micro-moments. This ships only the *visual language* so the
// look matches the web original; the queue, cooldown table, dedupe, and "strongest-wins" resolution
// are a separate, larger engine (`meloReactions`, ENGINES.md § 9.4) — do not add cooldown/queue
// logic here.
//
// The visual is ONE grammar — a "margin note": a short coloured hairline rule followed by a single
// line of Fraunces italic in Melo's voice. No card, no chrome, no shadow, no absolute positioning.
//
//   ─── in the pot. quietly working
//
// - Rule is 8px wide x 1px tall, terracotta (t.calm) by default; "concern" mood switches to caution
//   gold (t.caution) — the one colour-temperature shift, the only variation across the catalogue.
// - Line is 12.5px Fraunces italic, muted ink. No quotation marks — Melo is present, not quoted
//   (this is the one place in the app that deliberately omits MeloLine's smart quotes).
// - Enter: rule draws left-to-right (width 0 -> 8, 140ms), then the text fades + rises 2px (220ms,
//   120ms delay) — ported from the web's two CSS keyframes onto Reanimated. Exit: opacity fade.
//   Reduced-motion: both resolve to their final state instantly (web's `prefers-reduced-motion`).
//
// Placement is a single `anchor` prop:
//   - "under-melo" — the header row's post-Melo whisper (Today).
//   - "under-row"  — flows under the row that fired (pot row, sub row).
// Both flow with normal layout — neither floats. The parent controls spacing via `style`.
//
// Timer discipline: the auto-dismiss timer id lives in a ref, cleared on unmount AND when a new
// reaction replaces the current one, so we never setState after unmount (mirrors the web's
// window.clearTimeout discipline with RN's setTimeout/clearTimeout).

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { serif, useTheme } from '@/folio/theme';
import { subscribeMeloReaction, type MeloReactionPayload } from '@/folio/lib/melo/reactionBus';

export type MeloReactionAnchor = 'under-melo' | 'under-row';

export type MeloReactionProps = {
  channel: string;
  anchor: MeloReactionAnchor;
  /** Only fire when payload.key matches (e.g. a pot id or sub name). */
  matchKey?: string;
  style?: StyleProp<ViewStyle>;
};

const RULE_WIDTH = 8;
const RULE_MS = 140;
const LINE_MS = 220;
const LINE_DELAY_MS = 120;

// Local reduce-motion read — same pattern as PotsScreen / ShortfallScreen / Melo.
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

export function MeloReaction({ channel, anchor, matchKey, style }: MeloReactionProps) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const [current, setCurrent] = useState<MeloReactionPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ruleProgress = useSharedValue(reduceMotion ? 1 : 0);
  const lineProgress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    const unsub = subscribeMeloReaction(channel, (p) => {
      if (matchKey && p.key !== matchKey) return;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setCurrent(p);
      if (reduceMotion) {
        ruleProgress.value = 1;
        lineProgress.value = 1;
      } else {
        ruleProgress.value = 0;
        lineProgress.value = 0;
        ruleProgress.value = withTiming(1, { duration: RULE_MS, easing: Easing.ease });
        lineProgress.value = withDelay(
          LINE_DELAY_MS,
          withTiming(1, { duration: LINE_MS, easing: Easing.ease }),
        );
      }
      timerRef.current = setTimeout(() => {
        setCurrent(null);
        timerRef.current = null;
      }, p.durationMs);
    });
    return () => {
      unsub();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, matchKey, reduceMotion]);

  const ruleStyle = useAnimatedStyle(() => ({
    width: ruleProgress.value * RULE_WIDTH,
  }));
  const lineStyle = useAnimatedStyle(() => ({
    opacity: lineProgress.value,
    transform: [{ translateY: (1 - lineProgress.value) * 2 }],
  }));

  if (!current) return null;

  const ruleColor = current.mood === 'concern' ? t.caution : t.calm;
  const wrapperStyle = anchor === 'under-melo' ? styles.wrapMelo : styles.wrapRow;

  return (
    <View style={[wrapperStyle, style]} accessibilityRole="text" accessibilityLiveRegion="polite">
      <Animated.View style={[styles.rule, { backgroundColor: ruleColor }, ruleStyle]} />
      <Animated.Text style={[styles.line, { color: t.muted }, lineStyle]}>
        {current.line}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapMelo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  wrapRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rule: {
    flexShrink: 0,
    height: 1,
  },
  line: {
    flex: 1,
    fontFamily: serif.displayItalic,
    fontSize: 12.5,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
