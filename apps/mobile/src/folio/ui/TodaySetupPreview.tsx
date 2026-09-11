import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FinancialPlanResult } from '@folio/finance-engine';
import type { AppState } from '../store';
import type { Nav } from '../types';
import { gap, serif, useTheme } from '../theme';
import { Melo } from '../melo/Melo';
import { useDayClock } from '../lib/useDayClock';
import { FinancialSetupNotice } from './FinancialSetupNotice';
import { TodayRecentTxns } from '../screens/today/TodayRecentTxns';

/** Retain Today's identity while the entered picture is still incomplete. */
export function TodaySetupPreview({
  state,
  plan,
  nav,
}: {
  state: AppState;
  plan: FinancialPlanResult | null;
  nav: Nav;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const now = useDayClock();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.canvas }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + gap.md }]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
            Today
          </Text>
          <Text style={[styles.date, { color: t.muted }]}>
            {(now ?? new Date()).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Melo"
          onPress={() => nav.openMelo()}
          style={styles.melo}
        >
          <Melo size={52} mood="curious" />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => nav.openSheet('lens-picker')}
        style={styles.changeView}
      >
        <Text style={{ color: t.calmStrong, fontSize: 14 }}>Change how Today is shown →</Text>
      </Pressable>
      <FinancialSetupNotice state={state} plan={plan} onSetup={() => nav.openSheet('onboarding')} />
      <TodayRecentTxns nav={nav} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: gap.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: gap.md },
  title: { fontFamily: serif.display, fontSize: 28, lineHeight: 34 },
  date: { fontSize: 13, lineHeight: 19, marginTop: gap.xs },
  melo: { minWidth: 64, minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  changeView: { minHeight: 48, justifyContent: 'center' },
});
