import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppState } from '../store';
import type { FinancialPlanResult } from '@folio/finance-engine';
import { selectFinancialPresentation, formatMoney } from '../lib/financialPresentation';
import { gap, radius, serif, useTheme } from '../theme';

export function FinancialSetupNotice({
  state,
  plan,
  onSetup,
}: {
  state: AppState;
  plan: FinancialPlanResult | null;
  onSetup: () => void;
}) {
  const t = useTheme();
  const presentation = selectFinancialPresentation(state, plan);
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
        {presentation.label}
      </Text>
      {presentation.balanceKnown && (
        <Text style={[styles.balance, { color: t.ink }]}>
          {formatMoney((plan?.currentBalanceMinor ?? state.currentBalance.amount * 100) / 100)}{' '}
          balance entered
        </Text>
      )}
      <Text style={[styles.body, { color: t.muted }]}>{presentation.message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onSetup}
        style={[styles.button, { backgroundColor: t.calm }]}
      >
        <Text style={{ color: t.inverse, fontSize: 15 }}>
          {presentation.balanceKnown ? 'Resume setup' : 'Add my numbers'}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: gap.lg,
    marginVertical: gap.lg,
  },
  title: { fontFamily: serif.display, fontSize: 26, lineHeight: 32 },
  balance: { fontSize: 20, fontVariant: ['tabular-nums'], marginTop: gap.md },
  body: { fontSize: 14, lineHeight: 21, marginTop: gap.md },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    padding: gap.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: gap.lg,
  },
});
