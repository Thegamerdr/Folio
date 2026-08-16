import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  calculateBusinessRunway,
  calculateVatBoxes,
  totalOutstandingInvoicesMinor,
  type BusinessEntity,
} from '@folio/business-workspace';

import { gap, pressed, radius, serif, useTheme } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { poseForContext } from '@/folio/lib/melo/poseForContext';
import { useAppStore } from '@/folio/store';
import type { Nav, ScreenId } from '@/folio/types';
import { formatMinor } from './business/BusinessUi';
import { useBusinessOperations } from './business/useBusinessOperations';
import {
  MeloCompanionExclusion,
  MeloCompanionPerch,
  useMeloCompanionScrollHandlers,
} from '@/folio/companion/MeloCompanionHost';

export function BusinessTodayScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const workspace = useAppStore(
    (state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId)!,
  );
  const accounts = useAppStore((state) => state.accounts ?? []);
  const business = useBusinessOperations();
  const quietMode = useAppStore((state) => state.melo?.quietMode === true);
  const companionScroll = useMeloCompanionScrollHandlers();
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
  const runwayPose = poseForContext('biz-runway', {
    quietMode,
    runwayDays: runway.daysLeft,
  });
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
        {...companionScroll}
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
              <MeloCompanionPerch companionSize={24} id="business-today/header" priority={30}>
                <Melo mood={runwayPose.mood} asleep={runwayPose.asleep} size={24} />
              </MeloCompanionPerch>
            </Pressable>
          </View>
        </View>

        <MeloCompanionExclusion id="business-today/hero" attentionSalience={0.7}>
          <View style={styles.hero}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>
              {entity ? `${entityName(entity)} · ${entityKind(entity)}` : workspace.name}
            </Text>
            <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
              Build your working cash picture.
            </Text>
            <Text style={[styles.intro, { color: t.muted }]}>
              Add the accounts and regular costs you rely on. Melo will map what is available now
              and what the next 35 days need.
            </Text>
          </View>
        </MeloCompanionExclusion>

        <MeloCompanionExclusion id="business-today/money-picture" attentionSalience={1}>
          {entity === null ? (
            <View
              style={[
                styles.entityNudge,
                { backgroundColor: t.repairSoft, borderColor: t.hairline },
              ]}
            >
              <Text style={[styles.nudgeEyebrow, { color: t.repair }]}>First — the shape</Text>
              <Text style={[styles.nudgeTitle, { color: t.ink }]}>
                Sole Trader or Limited Company?
              </Text>
              <Text style={[styles.nudgeBody, { color: t.muted }]}>
                The two work differently — tax, filings, how you pay yourself. Pick once and
                everything else fits around it.
              </Text>
              <LinkAction
                label="Pick a business type"
                onPress={() => nav.go('business-entity-setup')}
              />
            </View>
          ) : hasCash ? (
            <>
              <View style={[styles.runway, { backgroundColor: t.inset }]}>
                <Text style={[styles.nudgeEyebrow, { color: t.muted }]}>Cash runway</Text>
                <Text style={[styles.runwayTitle, { color: t.ink }]}>
                  {runway.daysLeft === null
                    ? 'Cash is steady.'
                    : `Lasts ${runway.daysLeft === 1 ? '1 day' : `${runway.daysLeft} days`}.`}
                </Text>
                <Text style={[styles.runwayBody, { color: t.muted }]}>
                  {formatMinor(runway.cashMinor)} in hand · {formatMinor(runway.incoming30Minor)}{' '}
                  due in · {formatMinor(runway.outgoing30Minor)} due out in the next 30 days.
                </Text>
                <LinkAction label="Open runway" onPress={() => nav.go('business-runway')} />
              </View>
              {owedMinor > 0 || vatLiabilityMinor !== 0 ? (
                <View style={styles.metricGrid}>
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
            <View style={[styles.emptyWell, { backgroundColor: t.inset }]}>
              <Text style={[styles.nudgeEyebrow, { color: t.muted }]}>
                Your first business view
              </Text>
              <Text style={[styles.nudgeTitle, { color: t.ink }]}>
                See the next 35 days together.
              </Text>
              <Text style={[styles.nudgeBody, { color: t.muted }]}>
                Current cash, dated money in and committed money out—built only from amounts you
                have reviewed.
              </Text>
            </View>
          )}
        </MeloCompanionExclusion>

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

function LinkAction({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed: isPressed }) => [styles.linkAction, { opacity: isPressed ? 0.62 : 1 }]}
    >
      <Text style={[styles.linkLabel, { color: t.calmStrong }]}>{label} →</Text>
    </Pressable>
  );
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
      style={({ pressed: isPressed }) => [
        styles.metricCard,
        {
          backgroundColor: t.surface,
          borderColor: t.hairline,
          opacity: isPressed ? 0.62 : 1,
        },
      ]}
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
        <Text style={[styles.actionLabel, { color: emphasis ? t.accentInk : t.ink }]}>{label}</Text>
        <Text style={[styles.actionHint, { color: emphasis ? t.accentInk : t.muted }]}>{hint}</Text>
      </View>
      <Text
        accessibilityElementsHidden
        style={[styles.arrow, { color: emphasis ? t.accentInk : t.calmStrong }]}
      >
        →
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 28 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerDate: { fontFamily: serif.displayItalic, fontSize: 13 },
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
  hero: { marginTop: gap.lg },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 13 },
  headline: {
    fontFamily: serif.display,
    fontSize: 32,
    letterSpacing: -0.35,
    lineHeight: 37,
    marginTop: gap.xs,
  },
  intro: { fontSize: 13.5, lineHeight: 20, marginTop: gap.sm, maxWidth: 520 },
  entityNudge: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.xl,
  },
  emptyWell: { borderRadius: radius.xl, marginTop: gap.xl, padding: gap.xl },
  nudgeEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  nudgeTitle: { fontFamily: serif.medium, fontSize: 20, lineHeight: 25, marginTop: gap.sm },
  nudgeBody: { fontSize: 13, lineHeight: 20, marginTop: gap.sm },
  linkAction: { justifyContent: 'center', marginTop: gap.sm, minHeight: 44 },
  linkLabel: { fontSize: 13, fontWeight: '600' },
  runway: { borderRadius: radius.xl, marginTop: gap.xl, padding: gap.xl },
  runwayTitle: { fontFamily: serif.medium, fontSize: 26, lineHeight: 30, marginTop: gap.sm },
  runwayBody: { fontSize: 12.5, lineHeight: 19, marginTop: gap.sm },
  metricGrid: { flexDirection: 'row', gap: gap.md, marginTop: gap.md },
  metricCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 86,
    padding: gap.lg,
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
