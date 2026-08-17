import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, radius, typeScale, useTheme } from '@/folio/theme';
import type { Nav } from '@/folio/types';
import {
  intakeResultHelpPrompt,
  type IntakeResultOutcome,
  type IntakeResultSource,
} from './intakeResultHelp';
import { ProductIcon } from './ProductIcon';

/** The same native header geometry and back affordance across every intake outcome. */
export function IntakeResultHeader({ nav, title }: Readonly<{ nav: Nav; title: string }>) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={12}
        onPress={nav.back}
        style={({ pressed }) => [styles.back, pressed ? styles.pressed : undefined]}
      >
        <ProductIcon color={t.muted} name="back" />
      </Pressable>
      <Text style={[styles.headerLabel, { color: t.muted }]}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

/** One navigation and help contract for every statement intake result. */
export function IntakeResultRail({
  nav,
  outcome,
  source,
}: Readonly<{ nav: Nav; outcome: IntakeResultOutcome; source: IntakeResultSource }>) {
  const t = useTheme();

  return (
    <View
      accessibilityLabel="Add data result options"
      accessibilityRole="tablist"
      style={[styles.rail, { backgroundColor: t.inset }]}
    >
      <View
        accessibilityLabel="Result, selected"
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
        style={[styles.tab, { backgroundColor: t.surface }]}
      >
        <Text style={[styles.label, { color: t.ink }]}>Result</Text>
      </View>
      <Pressable
        accessibilityHint="Shows previous files and reading attempts"
        accessibilityLabel="History, Add data section"
        accessibilityRole="tab"
        accessibilityState={{ selected: false }}
        onPress={() => nav.go('intake-history')}
        style={({ pressed }) => [styles.tab, pressed ? styles.pressed : undefined]}
      >
        <Text style={[styles.label, { color: t.muted }]}>History</Text>
      </Pressable>
      <Pressable
        accessibilityHint="Opens Melo with help for this result"
        accessibilityLabel="Help with this result"
        accessibilityRole="tab"
        accessibilityState={{ selected: false }}
        onPress={() => nav.openMelo({ prefill: intakeResultHelpPrompt(source, outcome) })}
        style={({ pressed }) => [styles.tab, pressed ? styles.pressed : undefined]}
      >
        <Text style={[styles.label, { color: t.muted }]}>Help</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  back: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  headerLabel: {
    fontSize: typeScale.caption,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  headerSpacer: { width: 44 },
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
  label: { fontSize: typeScale.micro, fontWeight: '700' },
  pressed: { opacity: 0.62 },
});
