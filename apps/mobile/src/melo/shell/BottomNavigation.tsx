// The Melo shell's own bottom nav — four tabs (Today / Calendar / Melo / Settings), Warm Paper
// register: cream surface, hairline top border, active = ink + a small ember dot, inactive =
// muted. Deliberately separate from the pressure-map BottomNav (kit.tsx `BottomNav`) — that one
// drives the legacy product-screen tabs; this one is Melo's own four-tab set. Quiet unicode
// glyphs, no icon library, matching kit's existing NavIcon pattern of "tiny mark + label".

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, useTheme, type Palette } from '@/surfaces/pressureMap/kit';

export type MeloTab = 'today' | 'calendar' | 'melo' | 'settings';

type TabDef = { id: MeloTab; label: string; glyph: string };

const TABS: readonly TabDef[] = [
  { id: 'today', label: 'Today', glyph: '○' },
  { id: 'calendar', label: 'Calendar', glyph: '▤' },
  { id: 'melo', label: 'Melo', glyph: '◉' },
  { id: 'settings', label: 'Settings', glyph: '⚙' },
];

// Extra breathing room above the system gesture inset / 3-button nav bar, mirrors the constant
// kit.tsx's BottomNav uses for the same reason (never let the home-gesture strip eat taps).
const NAV_SAFE_GAP = 6;

type Props = {
  active: MeloTab;
  onChange: (tab: MeloTab) => void;
};

export function BottomNavigation({ active, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const navPaddingBottom = (insets.bottom > 0 ? insets.bottom : 12) + NAV_SAFE_GAP;

  return (
    <View style={[s.nav, { paddingBottom: navPaddingBottom }]}>
      {TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            accessibilityHint={`Switches to ${tab.label}.`}
            accessibilityLabel={`${tab.label} tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={styles.item}
          >
            <View style={styles.glyphRow}>
              <Text style={[s.glyph, selected ? s.glyphActive : undefined]}>{tab.glyph}</Text>
              {selected ? <View style={[s.emberDot, { backgroundColor: t.calm }]} /> : null}
            </View>
            <Text style={[s.label, selected ? s.labelActive : undefined]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Colour-free layout — shared across light/dark, mirrors kit.tsx's `layout` split.
const styles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 10,
  },
  glyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

function makeStyles(t: Palette) {
  return StyleSheet.create({
    nav: {
      flexDirection: 'row',
      backgroundColor: t.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.hairline,
      paddingTop: gap.sm,
    },
    glyph: {
      fontSize: 18,
      color: t.muted,
    },
    glyphActive: {
      color: t.ink,
    },
    emberDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    label: {
      fontSize: 11,
      color: t.muted,
    },
    labelActive: {
      color: t.ink,
      fontWeight: '600',
    },
  });
}
