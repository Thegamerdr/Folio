// Shared calm state views (Empty / Loading / Error) for the Melo shell and any surface that
// needs a quiet placeholder instead of inventing its own. Kit-based, Warm Paper register, no
// spinners and no panic red — the loading dot breathes the same way MeloMascot does, honouring
// the OS reduce-motion setting (MeloMascot.tsx is the pattern this file mirrors).

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Body, GhostButton, Muted, PrimaryAction, useTheme } from '@/surfaces/pressureMap/kit';

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

type EmptyStateProps = {
  title: string;
  body: string;
  cta?: string | undefined;
  onPress?: (() => void) | undefined;
};

export function EmptyState({ title, body, cta, onPress }: EmptyStateProps) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
      <Muted style={styles.body}>{body}</Muted>
      {cta && onPress ? (
        <View style={styles.cta}>
          <PrimaryAction label={cta} onPress={onPress} />
        </View>
      ) : null}
    </View>
  );
}

type LoadingStateProps = {
  line?: string | undefined;
};

const PULSE_DURATION_MS = 900;

export function LoadingState({ line }: LoadingStateProps) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.7);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.emberDot, { backgroundColor: t.calm, opacity }]} />
      <Muted style={styles.loadingLine}>{line ?? 'One moment.'}</Muted>
    </View>
  );
}

type ErrorStateProps = {
  line: string;
  onRetry?: (() => void) | undefined;
};

export function ErrorState({ line, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.wrap}>
      <Body style={styles.body}>{line}</Body>
      {onRetry ? (
        <View style={styles.cta}>
          <GhostButton label="Try again" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  loadingLine: {
    textAlign: 'center',
  },
  cta: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  emberDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
