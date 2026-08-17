import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, radius, useTheme } from '@/folio/theme';
import type { Nav, ScreenId } from '@/folio/types';

export type AdjustPathMode = 'preview' | 'resolve' | 'recovery';

const MODES: readonly Readonly<{
  id: AdjustPathMode;
  label: string;
  route: ScreenId;
}>[] = [
  { id: 'preview', label: 'Preview', route: 'whatif' },
  { id: 'resolve', label: 'Resolve', route: 'shortfall' },
  { id: 'recovery', label: 'Recovery', route: 'recovery' },
];

/** One labelled, accessible mode switch for every Adjust Path surface. */
export function AdjustPathTabs({ active, nav }: Readonly<{ active: AdjustPathMode; nav: Nav }>) {
  const t = useTheme();

  return (
    <View>
      <View
        accessibilityLabel="Adjust Path modes"
        accessibilityRole="tablist"
        style={[styles.rail, { backgroundColor: t.inset }]}
      >
        {MODES.map((mode) => {
          const selected = mode.id === active;
          return (
            <Pressable
              accessibilityLabel={`${mode.label}, Adjust Path mode`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={mode.id}
              onPress={() => {
                if (!selected) nav.go(mode.route);
              }}
              style={({ pressed }) => [
                styles.tab,
                selected ? { backgroundColor: t.surface } : undefined,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.label, { color: selected ? t.ink : t.muted }]}>
                {mode.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityHint="Opens purchases you chose to wait on"
        accessibilityLabel="Saved for later"
        accessibilityRole="button"
        onPress={() => nav.openSheet('shelf')}
        style={({ pressed }) => [styles.saved, pressed ? styles.pressed : undefined]}
      >
        <Text style={[styles.savedLabel, { color: t.muted }]}>Saved for later</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: 2,
    marginTop: gap.lg,
    padding: 3,
  },
  tab: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.xs,
  },
  label: { fontSize: 11, fontWeight: '700' },
  saved: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.xs,
  },
  savedLabel: { fontSize: 11, fontWeight: '600' },
  pressed: { opacity: 0.62 },
});
