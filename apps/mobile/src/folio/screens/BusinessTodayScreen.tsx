import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  calculateBusinessRunway,
  calculateVatBoxes,
  generateDueRecurringInvoices,
  totalOutstandingInvoicesMinor,
  type BusinessEntity,
} from '@folio/business-workspace';

import { Melo } from '@/folio/melo/Melo';
import { gap, pressed, radius, serif, useTheme } from '@/folio/theme';
import { updateBusinessOperations, useAppStore } from '@/folio/store';
import type { Nav, ScreenId } from '@/folio/types';
import { formatMinor } from './business/BusinessUi';
import { useBusinessOperations } from './business/useBusinessOperations';

export function BusinessTodayScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const workspace = useAppStore(
    (state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId)!,
  );
  const accounts = useAppStore((state) => state.accounts ?? []);
  const business = useBusinessOperations();
  useEffect(() => {
    const generated = generateDueRecurringInvoices(business);
    if (generated !== business) updateBusinessOperations(generated);
  }, [business]);
  const cashAccounts = useMemo(
    () =>
      accounts.map((account) => ({
        ...account,
        // The inherited Account model stores major units despite the legacy field name.
        // Business engines use integer minor units end-to-end.
        balanceMinor: Math.round(account.balanceMinor * 100),
      })),
    [accounts],
  );
  const runway = useMemo(
    () => calculateBusinessRunway(business, cashAccounts),
    [business, cashAccounts],
  );
  const owedMinor = totalOutstandingInvoicesMinor(business);
  const openVatReturn = useMemo(
    () =>
      business.vatReturns
        .filter((item) => item.filedExternallyOn === undefined)
        .sort((left, right) => left.dueOn.localeCompare(right.dueOn))[0] ?? null,
    [business.vatReturns],
  );
  const vatLiabilityMinor = openVatReturn ? calculateVatBoxes(openVatReturn).box5Minor : 0;
  const accountCount = accounts.filter((account) => account.closed !== true).length;
  const hasCash = accountCount > 0;
  const entity = business.entity;

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.sm, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.headerDate, { color: t.muted }]}>
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
          <View style={styles.headerRight}>
            <Text style={[styles.workspaceKind, { color: t.muted }]}>Business</Text>
            <Pressable
              accessibilityLabel={`Open Melo for ${workspace.name}`}
              accessibilityRole="button"
              onPress={() => nav.go('melo')}
              style={({ pressed: isPressed }) => [
                styles.meloButton,
                { backgroundColor: t.surface, borderColor: t.hairline },
                isPressed ? pressed : undefined,
              ]}
            >
              <Melo mood="calm" size={24} />
            </Pressable>
          </View>
        </View>

        <View style={styles.answer}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>
            {entity ? `${entityName(entity)} · ${entityKind(entity)}` : workspace.name}
          </Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {hasCash ? (
              runway.daysLeft === null ? (
                <>
                  The business is <Text style={{ color: t.calm }}>covered</Text> on what&apos;s due.
                </>
              ) : (
                <>
                  The business can pay what&apos;s due for{' '}
                  <Text style={{ color: t.calm }}>
                    {runway.daysLeft === 1 ? '1 day' : `${runway.daysLeft} days`}
                  </Text>
                  .
                </>
              )
            ) : (
              <>
                Add what the business holds to see if it&apos;s{' '}
                <Text style={{ color: t.calm }}>covered</Text>.
              </>
            )}
          </Text>
          <Text style={[styles.why, { color: t.muted }]}>
            {hasCash
              ? `${formatMinor(runway.cashMinor)} in hand, ${formatMinor(runway.incoming30Minor)} due in and ${formatMinor(runway.outgoing30Minor)} due out over the next 30 days.`
              : "Nothing added yet, so there's no cash picture to work from."}
          </Text>
          {hasCash ? (
            <Text style={[styles.estimate, { color: t.muted }]}>
              This is worked out from what you&apos;ve added, so treat it as a close guess.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              nav.go(
                hasCash && owedMinor > 0
                  ? 'business-invoices'
                  : hasCash
                    ? 'business-runway'
                    : 'account',
              )
            }
            style={({ pressed: isPressed }) => [
              styles.answerMove,
              { backgroundColor: t.calm, opacity: isPressed ? 0.62 : 1 },
            ]}
          >
            <Text style={[styles.answerMoveLabel, { color: t.inverse }]}>
              {hasCash && owedMinor > 0
                ? "Chase what's owed"
                : hasCash
                  ? 'Open cash runway'
                  : 'Add what the business holds'}
            </Text>
          </Pressable>
        </View>

        {entity === null ? (
          <View style={[styles.emptyExplanation, { borderTopColor: t.hairline }]}>
            <Text style={[styles.emptyExplanationBody, { color: t.muted }]}>
              Current cash, dated money in and committed money out — built only from amounts you
              have checked.
            </Text>
          </View>
        ) : hasCash ? (
          <>
            {owedMinor > 0 || vatLiabilityMinor !== 0 ? (
              <View style={[styles.metricStrip, { borderColor: t.hairline }]}>
                {owedMinor > 0 ? (
                  <MetricCard
                    label="Owed to you"
                    onPress={() => nav.go('business-invoices')}
                    value={formatMinor(owedMinor)}
                  />
                ) : null}
                {vatLiabilityMinor !== 0 ? (
                  <MetricCard
                    label={vatLiabilityMinor > 0 ? 'VAT est.' : 'VAT reclaim'}
                    onPress={() => nav.go('business-vat')}
                    value={formatMinor(Math.abs(vatLiabilityMinor))}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.emptyExplanation, { borderTopColor: t.hairline }]}>
            <Text style={[styles.emptyExplanationBody, { color: t.muted }]}>
              Current cash, dated money in and committed money out — built only from amounts you
              have checked.
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Action
            emphasis
            hint={hasCash ? 'Full 30-day picture' : 'Build this workspace from a real balance'}
            label={hasCash ? 'Open cash runway' : 'Add an account'}
            onPress={() => nav.go(hasCash ? 'business-runway' : 'account')}
          />
          <Action
            hint="Review every amount before it counts"
            label="Read a statement or receipt"
            onPress={() => nav.go('intake')}
          />
          <Action
            hint="Talk through this business picture only"
            label="Ask Melo"
            onPress={() => nav.go('melo')}
          />
          {entity === null ? (
            <Action
              hint="Sole trader or limited company — changes tax and filing dates"
              label="Set the business type"
              onPress={() => nav.go('business-entity-setup')}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function entityName(entity: BusinessEntity): string {
  return entity.kind === 'ltd' ? entity.companyName : entity.tradingName?.trim() || 'Business';
}

function entityKind(entity: BusinessEntity): string {
  return entity.kind === 'ltd' ? 'Limited Company' : 'Sole Trader';
}

function MetricCard({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed: isPressed }) => [styles.metricCard, { opacity: isPressed ? 0.62 : 1 }]}
    >
      <Text style={[styles.metricLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: t.ink }]}>{value}</Text>
    </Pressable>
  );
}

function Action({
  label,
  hint,
  onPress,
  emphasis = false,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  emphasis?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.action,
        emphasis ? styles.actionPrimary : undefined,
        {
          backgroundColor: emphasis ? t.calm : 'transparent',
          borderBottomColor: emphasis ? 'transparent' : t.hairline,
          opacity: isPressed ? 0.62 : 1,
        },
      ]}
    >
      <View style={styles.actionCopy}>
        <Text style={[styles.actionLabel, { color: emphasis ? t.inverse : t.ink }]}>{label}</Text>
        <Text style={[styles.actionHint, { color: emphasis ? t.inverse : t.muted }]}>{hint}</Text>
      </View>
      <Text
        accessibilityElementsHidden
        style={[styles.arrow, { color: emphasis ? t.inverse : t.calmStrong }]}
      >
        →
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerDate: { fontFamily: serif.displayItalic, fontSize: 14 },
  headerRight: { alignItems: 'center', flexDirection: 'row', gap: gap.sm },
  workspaceKind: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.7 },
  meloButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  answer: { marginTop: gap.lg },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: serif.display,
    fontSize: 28,
    letterSpacing: -0.56,
    lineHeight: 32,
    marginTop: gap.sm,
  },
  why: { fontSize: 14, lineHeight: 20, marginTop: gap.md },
  estimate: { fontSize: 12.5, lineHeight: 20, marginTop: 6 },
  answerMove: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: gap.lg,
    minHeight: 44,
    paddingHorizontal: gap.lg,
  },
  answerMoveLabel: { fontSize: 14, fontWeight: '600' },
  emptyExplanation: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    paddingTop: gap.lg,
  },
  emptyExplanationBody: { fontSize: 14, lineHeight: 20 },
  metricStrip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: gap.xl,
  },
  metricCard: {
    flex: 1,
    minHeight: 64,
    paddingVertical: gap.md,
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontFamily: serif.medium,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    marginTop: gap.xs,
  },
  actions: { marginTop: gap.xl },
  action: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 68,
    paddingVertical: gap.md,
  },
  actionPrimary: {
    borderBottomWidth: 0,
    borderRadius: radius.lg,
    marginBottom: gap.sm,
    minHeight: 62,
    paddingHorizontal: gap.lg,
  },
  actionCopy: { flex: 1, paddingRight: gap.lg },
  actionLabel: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  actionHint: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  arrow: { fontSize: 18 },
});
