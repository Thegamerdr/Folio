import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/folio/store';
import { gap, radius, serif, useTheme, weightFamily } from '@/folio/theme';
import type { Nav } from '@/folio/types';

export function DebtsScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const debts = useAppStore((state) => state.debts) ?? [];
  return (
    <View style={[styles.root, { backgroundColor: t.canvas, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: gap.lg, paddingBottom: insets.bottom + gap.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Plan"
          onPress={nav.back}
          style={styles.back}
        >
          <Text style={[styles.backLabel, { color: t.muted }]}>‹ Plan</Text>
        </Pressable>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Plan</Text>
        <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
          Debts <Text style={{ color: t.calm }}>tracked</Text>.
        </Text>
        <Text style={[styles.subhead, { color: t.muted }]}>
          Balances and repayments you have chosen to keep in view.
        </Text>
        <View style={styles.list}>
          {debts.length === 0 ? (
            <Text style={[styles.empty, { color: t.muted }]}>No debts declared yet.</Text>
          ) : (
            debts.map((debt) => (
              <View key={debt.id} style={[styles.row, { borderBottomColor: t.hairline }]}>
                <View style={styles.rowCopy}>
                  <Text style={[styles.name, { color: t.ink }]}>{debt.name}</Text>
                  <Text
                    style={[styles.meta, { color: t.muted }]}
                  >{`£${debt.balance.toLocaleString('en-GB')} outstanding · ${debt.apr}% APR`}</Text>
                </View>
              </View>
            ))
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.openSheet('declare-debt')}
          style={({ pressed }) => [
            styles.add,
            { backgroundColor: t.calm },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.addLabel, { color: t.inverse }]}>+ Add a debt</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  backLabel: { fontFamily: weightFamily(500), fontSize: 14 },
  eyebrow: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.54,
    lineHeight: 16,
    marginTop: gap.lg,
    textTransform: 'uppercase',
  },
  heading: { fontFamily: serif.display, fontSize: 28, lineHeight: 32, marginTop: gap.xs },
  subhead: { fontFamily: weightFamily(400), fontSize: 14, lineHeight: 22, marginTop: gap.sm },
  list: { marginTop: gap.xl },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
    justifyContent: 'center',
    paddingVertical: gap.sm,
  },
  rowCopy: { minWidth: 0 },
  name: { fontFamily: weightFamily(500), fontSize: 15, lineHeight: 22 },
  meta: { fontFamily: weightFamily(400), fontSize: 12.5, lineHeight: 19, marginTop: 2 },
  empty: { fontFamily: weightFamily(400), fontSize: 14, lineHeight: 22, paddingVertical: gap.xl },
  add: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 48,
    marginTop: gap.xl,
  },
  addLabel: { fontFamily: weightFamily(500), fontSize: 14 },
  pressed: { opacity: 0.76 },
});
