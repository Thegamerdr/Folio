import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { shellCompanionPlacement } from '@/folio/lib/melo/shellCompanion';
import { Melo } from '@/folio/melo/Melo';
import { setMelo, useAppStore } from '@/folio/store';
import { useTheme } from '@/folio/theme';
import type { Nav, ScreenId } from '@/folio/types';

const INTRO_DWELL_MS = 15_000;

/** Native counterpart of the pinned shell-local semantic companion layer. It renders only where
 * the source owns a real perch, honours quiet mode and the persisted side preference, and keeps
 * the canonical phoenix as the sole character renderer. */
export function ShellMeloCompanion({ screen, nav }: { screen: ScreenId; nav: Nav }) {
  const t = useTheme();
  const melo = useAppStore((state) => state.melo ?? { quietMode: false, wardrobe: [] });
  const [showIntro, setShowIntro] = useState(melo.companionIntroSeen !== true);
  const placement = shellCompanionPlacement(screen, melo.preferredPosition ?? 'auto');

  useEffect(() => {
    if (!showIntro || placement === null || melo.quietMode) return undefined;
    const timeout = setTimeout(() => {
      setShowIntro(false);
      setMelo({ companionIntroSeen: true });
    }, INTRO_DWELL_MS);
    return () => clearTimeout(timeout);
  }, [melo.quietMode, placement?.bubbleLeft, placement?.top, showIntro]);

  if (placement === null || melo.quietMode) return null;

  const openMelo = () => {
    setShowIntro(false);
    setMelo({ companionIntroSeen: true });
    nav.openMelo();
  };

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.layer]}>
      {showIntro ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="text"
          pointerEvents="none"
          style={[
            styles.bubble,
            {
              top: placement.top,
              left: placement.bubbleLeft,
              backgroundColor: t.ink,
              shadowColor: t.ink,
            },
          ]}
        >
          <Text style={[styles.bubbleText, { color: t.canvas }]}>Hi, I&apos;m Melo.</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Melo, perched. Open Melo"
        accessibilityHint="Opens Melo"
        hitSlop={8}
        onPress={openMelo}
        style={({ pressed }) => [
          styles.bird,
          { top: placement.top, left: placement.birdLeft },
          pressed ? styles.pressed : undefined,
        ]}
      >
        <Melo mood="calm" size={64} grounded={false} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 55,
  },
  bubble: {
    position: 'absolute',
    width: 220,
    minHeight: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 55,
    elevation: 8,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  bubbleText: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  bird: {
    position: 'absolute',
    width: 64,
    height: 64,
    zIndex: 56,
    elevation: 9,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
