import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectBusinessOneMove } from '@folio/business-workspace';

import { Melo, type MeloMood } from '@/folio/melo/Melo';
import { gap, radius, serif, useTheme } from '@/folio/theme';
import { useAppStore } from '@/folio/store';
import type { Nav, ScreenId } from '@/folio/types';
import { useBusinessOperations } from './business/useBusinessOperations';

export function BusinessMeloScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const accounts = useAppStore((state) => state.accounts ?? []);
  const business = useBusinessOperations();
  const move = useMemo(
    () =>
      selectBusinessOneMove(
        business,
        accounts.map((account) => ({
          ...account,
          balanceMinor: Math.round(account.balanceMinor * 100),
        })),
      ),
    [accounts, business],
  );
  const mood: MeloMood =
    move.kind === 'runway' || move.kind === 'vat'
      ? 'concern'
      : move.kind === 'invoice' || move.kind === 'obligation'
        ? 'curious'
        : 'calm';

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wordmarkRow}>
          <Text style={[styles.wordmark, { color: t.ink }]}>Melo</Text>
          <Text style={[styles.workspaceKind, { color: t.muted }]}>Business</Text>
        </View>

        <View style={styles.hero}>
          <Melo mood={mood} size={74} />
          <Text style={[styles.eyebrow, { color: t.muted }]}>Business</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {move.headline}
          </Text>
          <Text style={[styles.intro, { color: t.muted }]}>{move.body}</Text>
        </View>

        {move.action ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go(actionRoute(move.action!.target))}
            style={({ pressed }) => [
              styles.move,
              { backgroundColor: t.inset, opacity: pressed ? 0.62 : 1 },
            ]}
          >
            <Text style={[styles.moveLabel, { color: t.ink }]}>{move.action.label}</Text>
            <Text accessibilityElementsHidden style={[styles.arrow, { color: t.calmStrong }]}>
              →
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.watching}>
          <Text style={[styles.sectionTitle, { color: t.muted }]}>What Melo watches here</Text>
          {[
            'Cash across business accounts and 30-day burn.',
            'Invoices aging past their due date.',
            'VAT pot vs the estimated bill.',
            'Recurring obligations landing inside the runway.',
          ].map((line) => (
            <Text key={line} style={[styles.watchLine, { color: t.muted }]}>
              · {line}
            </Text>
          ))}
        </View>

        <Pressable
          accessibilityHint="Opens the local companion for Business."
          accessibilityRole="button"
          onPress={() =>
            nav.openMelo({
              seed: "I'm looking only at Business.",
            })
          }
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: t.calm, opacity: pressed ? 0.68 : 1 },
          ]}
        >
          <Text style={[styles.primaryLabel, { color: t.accentInk }]}>Ask Melo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function actionRoute(
  target: NonNullable<ReturnType<typeof selectBusinessOneMove>['action']>['target'],
): ScreenId {
  if (target === 'account') return 'account';
  if (target === 'runway') return 'business-runway';
  if (target === 'vat') return 'business-vat';
  if (target === 'invoices') return 'business-invoices';
  return 'business-obligations';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  wordmarkRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  wordmark: { fontFamily: serif.displayItalic, fontSize: 14 },
  workspaceKind: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.7 },
  hero: { alignItems: 'flex-start', marginTop: gap.xl },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 13, marginTop: gap.md },
  headline: {
    fontFamily: serif.display,
    fontSize: 31,
    letterSpacing: -0.35,
    lineHeight: 37,
    marginTop: gap.xs,
  },
  intro: { fontSize: 13.5, lineHeight: 21, marginTop: gap.md, maxWidth: 520 },
  move: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    marginTop: gap.lg,
    minHeight: 50,
    paddingHorizontal: gap.lg,
  },
  moveLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  arrow: { fontSize: 18, marginLeft: gap.md },
  watching: { marginTop: gap.xl },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: gap.sm,
    textTransform: 'uppercase',
  },
  watchLine: { fontSize: 12.5, lineHeight: 20 },
  primary: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: gap.xl,
    minHeight: 52,
    paddingHorizontal: gap.lg,
  },
  primaryLabel: { fontSize: 15, fontWeight: '700' },
});
