import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { triggerFeedback } from '@/folio/lib/feedback';
import { subscribeMeloReaction, type MeloReactionPayload } from '@/folio/lib/melo/reactionBus';
import { useAppStore } from '@/folio/store';
import { gap, radius, serif, useTheme } from '@/folio/theme';

export const EARN_CHANNEL = 'earn-beat';

type Stamp = {
  id: string;
  line: string;
  kind: 'win' | 'wardrobe';
};

/** Quiet, non-interrupting earned-win / new-touch overlay from the live Lovable shell. */
export function EarnStamp() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const quietMode = useAppStore((state) => state.melo?.quietMode ?? false);
  const soundEnabled = useAppStore((state) => state.melo?.soundEnabled ?? false);
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotionRef = useRef(false);
  const preferencesRef = useRef({ quietMode, soundEnabled });
  preferencesRef.current = { quietMode, soundEnabled };

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotionRef.current = enabled;
    });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotionRef.current = enabled;
    });
    const unsubscribe = subscribeMeloReaction(EARN_CHANNEL, (payload: MeloReactionPayload) => {
      if (showTimer.current !== null) clearTimeout(showTimer.current);

      const next: Stamp = {
        id: `es-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        line: payload.line,
        kind: payload.key === 'wardrobe' ? 'wardrobe' : 'win',
      };
      setStamp(next);
      progress.stopAnimation();
      progress.setValue(reduceMotionRef.current ? 1 : 0);
      if (!reduceMotionRef.current) {
        Animated.timing(progress, {
          duration: 260,
          toValue: 1,
          useNativeDriver: true,
        }).start();
      }
      if (!reduceMotionRef.current && !preferencesRef.current.quietMode) {
        void triggerFeedback('earn-stamp', preferencesRef.current);
      }

      const duration = payload.durationMs || 2_800;
      showTimer.current = setTimeout(
        () => {
          if (reduceMotionRef.current) {
            setStamp((current) => (current?.id === next.id ? null : current));
            return;
          }
          Animated.timing(progress, {
            duration: 320,
            toValue: 0,
            useNativeDriver: true,
          }).start(() => {
            setStamp((current) => (current?.id === next.id ? null : current));
          });
        },
        Math.max(0, duration - (reduceMotionRef.current ? 0 : 320)),
      );
    });

    return () => {
      unsubscribe();
      motion.remove();
      progress.stopAnimation();
      if (showTimer.current !== null) clearTimeout(showTimer.current);
    };
  }, [progress]);

  if (stamp === null) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.host, { top: insets.top + gap.md }]}
    >
      <Animated.View
        style={[
          styles.stamp,
          {
            backgroundColor: t.canvas,
            borderColor: t.hairline,
            shadowColor: t.ink,
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-4, 0],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.98, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.meta}>
          <View style={[styles.dotHalo, { backgroundColor: t.calmSoft }]}>
            <View style={[styles.dot, { backgroundColor: t.calm }]} />
          </View>
          <Text style={[styles.label, { color: t.muted }]}>
            {stamp.kind === 'wardrobe' ? 'Melo · new touch' : 'Earned'}
          </Text>
        </View>
        <Text style={[styles.line, { color: t.ink }]}>{stamp.line}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 40,
  },
  stamp: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 6,
    maxWidth: '80%',
    minWidth: 210,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm + 2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  meta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: gap.sm,
  },
  dotHalo: {
    alignItems: 'center',
    borderRadius: 7,
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  line: {
    fontFamily: serif.display,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 4,
  },
});
