/** Sequential first-run introduction for the companion. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Sheet, gap, radius, serif, useTheme } from '@/folio/theme';
import { Melo, type MeloMood } from '@/folio/melo/Melo';

type IntroPage = { eyebrow: string; title: string; body: string[]; mood: MeloMood };

const PAGES: readonly IntroPage[] = [
  {
    eyebrow: 'What I watch',
    title: 'Three things, quietly.',
    body: [
      'Your path to payday — one line that bends as money moves.',
      'The subscriptions that keep renewing — you decide what stays.',
      'The tight point — the lowest your balance is likely to dip before payday lands.',
    ],
    mood: 'curious',
  },
  {
    eyebrow: 'How I talk',
    title: 'Only when something shifts.',
    body: [
      'One line at a time. Short, plain and calm.',
      'One move, never five. You can always undo it.',
      'No nudges you did not ask for. Notifications stay off until you turn them on.',
    ],
    mood: 'calm',
  },
  {
    eyebrow: 'Your first ritual',
    title: 'A minute on payday.',
    body: [
      'Close the cycle and see what actually landed.',
      'Set aside for pots — nothing moves until you save.',
      "Choose next month's shape with one small tweak.",
    ],
    mood: 'cheer',
  },
];

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

export function MeloIntroSheet({
  visible,
  onClose,
  onContinue,
}: {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
}) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const [step, setStep] = useState(0);
  const progress = useRef(new Animated.Value(1)).current;
  const page = PAGES[step]!;
  const last = step === PAGES.length - 1;

  useEffect(() => {
    progress.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion) {
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [progress, reduceMotion, step]);

  const pageStyle = useMemo(
    () => ({
      opacity: progress,
      transform: [
        { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
      ],
    }),
    [progress],
  );

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <View
        accessibilityRole="summary"
        accessibilityLabel={`Meet Melo, page ${step + 1} of ${PAGES.length}`}
      >
        <View style={styles.progressRail} accessibilityElementsHidden>
          {PAGES.map((item, index) => (
            <View
              key={item.eyebrow}
              style={[
                styles.progressTick,
                { backgroundColor: index <= step ? t.calm : t.hairline },
              ]}
            />
          ))}
        </View>
        <Animated.View style={pageStyle}>
          <View style={styles.meloWrap}>
            <Melo mood={page.mood} size={86} pose="none" grounded />
          </View>
          <Text style={[styles.eyebrow, { color: t.muted }]}>{page.eyebrow}</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
            {page.title}
          </Text>
          <View style={styles.body}>
            {page.body.map((line) => (
              <View
                key={line}
                style={[styles.row, { backgroundColor: t.inset, borderColor: t.hairline }]}
              >
                <View style={[styles.dot, { backgroundColor: t.calm }]} />
                <Text style={[styles.rowText, { color: t.muted }]}>{line}</Text>
              </View>
            ))}
          </View>
          {last ? (
            <Text style={[styles.ready, { color: t.muted }]}>
              Ready when you are — the next screen sets the shape.
            </Text>
          ) : null}
        </Animated.View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={step > 0 ? () => setStep((value) => value - 1) : onClose}
            hitSlop={8}
            style={styles.quietAction}
          >
            <Text style={[styles.quietLabel, { color: t.muted }]}>
              {step > 0 ? 'Back' : 'Not now'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={last ? 'Set the shape' : 'Next'}
            onPress={
              last ? onContinue : () => setStep((value) => Math.min(PAGES.length - 1, value + 1))
            }
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: t.ink },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.primaryLabel, { color: t.canvas }]}>
              {last ? 'Set the shape' : 'Next'} →
            </Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  progressRail: { flexDirection: 'row', gap: gap.xs, marginBottom: gap.lg },
  progressTick: { borderRadius: 2, flex: 1, height: 3 },
  meloWrap: { alignItems: 'center', marginBottom: gap.md },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 13 },
  title: { fontFamily: serif.display, fontSize: 27, lineHeight: 31, marginTop: gap.xs },
  body: { gap: gap.sm, marginTop: gap.lg },
  row: {
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: gap.sm,
    paddingHorizontal: gap.md,
    paddingVertical: gap.md,
  },
  dot: { borderRadius: 3, height: 6, marginTop: 5, width: 6 },
  rowText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  ready: { fontFamily: serif.displayItalic, fontSize: 12.5, lineHeight: 18, marginTop: gap.md },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.xl,
  },
  quietAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: gap.xs },
  quietLabel: { fontSize: 12.5, textDecorationLine: 'underline' },
  primary: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: gap.lg,
  },
  primaryLabel: { fontSize: 13.5, fontWeight: '600' },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
});
