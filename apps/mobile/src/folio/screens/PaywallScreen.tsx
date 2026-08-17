/**
 * Native port of the live Lovable plans surface: Free / Melo Plus / Melo Pro,
 * monthly/yearly pricing, one-cycle trial, suppression guard, and real store restore.
 */
import type { ProductSubscription, Purchase } from 'expo-iap';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { copy } from '@/folio/copy/copy';
import { reconcileEntitlements, saveVerifiedEntitlement } from '@/folio/lib/billing/entitlements';
import {
  storeBillingCapability,
  verifyGooglePurchase,
} from '@/folio/lib/billing/billingVerification';
import { resolveCtaMode } from '@/folio/lib/billing/ctaMode';
import {
  closeConnection,
  finishPurchase,
  probeAvailability,
  productIdFor,
  purchase,
  queryProducts,
  restoreWithStatus as restorePurchases,
  tierForProductId,
  type BillingCadence,
} from '@/folio/lib/billing/iap';
import { FREE_LENSES, PLUS_LENSES, PRO_LENSES, useLens, type LensTier } from '@/folio/lib/lens';
import { canShowUpsell, upsellSuppressionReason } from '@/folio/lib/lensPaywall';
import { deriveModeState, MODE_LABEL, type MoneyMode } from '@/folio/lib/modes';
import { safeZoneMath } from '@/folio/lib/modes/safeZone';
import { useRoute } from '@/folio/lib/storeRoute';
import { useAppStore } from '@/folio/store';
import { StatePanel } from '@/folio/ui/StatePanel';
import { Surface, gap, radius, serif, useTheme, type Palette } from '@/folio/theme';
import type { Nav } from '@/folio/types';

export type PaywallScreenState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PaywallScreenProps = {
  nav: Nav;
  state?: PaywallScreenState;
};

const ORDER: readonly MoneyMode[] = [...FREE_LENSES, ...PLUS_LENSES, ...PRO_LENSES];

type MatrixCell = 'live' | 'soon' | 'no';

const LIVE_BULLETS: Readonly<Record<LensTier, readonly boolean[]>> = {
  free: [true, true, true, false],
  plus: [true, true, false, true, false, true],
  pro: [true, true, true, false, false, false],
};

const COMPARISON: readonly Readonly<Record<LensTier, MatrixCell>>[] = [
  { free: 'live', plus: 'live', pro: 'live' },
  { free: 'live', plus: 'live', pro: 'live' },
  { free: 'no', plus: 'live', pro: 'live' },
  { free: 'no', plus: 'live', pro: 'live' },
  { free: 'no', plus: 'live', pro: 'live' },
  { free: 'no', plus: 'soon', pro: 'soon' },
  { free: 'no', plus: 'no', pro: 'live' },
  { free: 'no', plus: 'no', pro: 'live' },
  { free: 'no', plus: 'no', pro: 'live' },
  { free: 'no', plus: 'no', pro: 'soon' },
  { free: 'no', plus: 'no', pro: 'soon' },
];

function planName(tier: LensTier): string {
  if (tier === 'pro') return copy.plans.tier.pro.name;
  if (tier === 'plus') return copy.plans.tier.plus.name;
  return copy.plans.tier.free.name;
}

function tierBullets(tier: LensTier): readonly string[] {
  if (tier === 'pro') return copy.plans.tier.pro.bullets;
  if (tier === 'plus') return copy.plans.tier.plus.bullets;
  return copy.plans.tier.free.bullets;
}

function guardBody(reason: ReturnType<typeof upsellSuppressionReason>): string {
  if (reason === 'safe-zone-negative') return copy.plans.guard.negative;
  if (reason === 'recovery-active') return copy.plans.guard.recovery;
  if (reason === 'quiet-mode') return copy.plans.guard.quiet;
  if (reason === 'weather-fog') return copy.plans.guard.fog;
  return copy.plans.guard.weather;
}

export function PaywallScreen({ nav, state = 'populated' }: PaywallScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<LensTier>('plus');
  const [cadence, setCadence] = useState<BillingCadence>('yearly');
  const [billingAvailable, setBillingAvailable] = useState(false);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingProducts, setBillingProducts] = useState<ProductSubscription[]>([]);
  const [billingBusy, setBillingBusy] = useState(false);
  const billingCapability = useMemo(() => storeBillingCapability(Platform.OS), []);

  const moneyMode = useAppStore((store) => store.moneyMode ?? 'survival');
  const currentBalance = useAppStore((store) => store.currentBalance);
  const pots = useAppStore((store) => store.pots);
  const subs = useAppStore((store) => store.subs);
  const subPaused = useAppStore((store) => store.subPaused);
  const spendHold = useAppStore((store) => store.spendHold ?? null);
  const onboarding = useAppStore((store) => store.onboarding);
  const quietMode = useAppStore((store) => store.melo?.quietMode ?? false);
  const now = useMemo(() => new Date(), []);
  const route = useRoute(now);
  const lens = useLens();

  useEffect(() => {
    let mounted = true;
    if (!billingCapability.supported) {
      setBillingProducts([]);
      setBillingAvailable(false);
      setBillingLoading(false);
      return () => {
        mounted = false;
      };
    }
    void (async () => {
      const availability = await probeAvailability();
      const products = availability.available ? await queryProducts() : [];
      if (!mounted) return;
      setBillingProducts(products);
      setBillingAvailable(availability.available && products.length > 0);
      setBillingLoading(false);
    })();
    return () => {
      mounted = false;
      void closeConnection();
    };
  }, [billingCapability.supported]);

  const safeZoneTotal = useMemo(
    () =>
      safeZoneMath({
        currentBalance,
        onboarding,
        pots,
        subs,
        subPaused,
        tightestSpare: route.tightPoint.amount,
        tightestDate: route.tightPoint.date,
        ritualCompletedRecently: false,
      }).total,
    [currentBalance, onboarding, pots, route, subPaused, subs],
  );

  const weather = useMemo(
    () =>
      deriveModeState(moneyMode, {
        currentBalance,
        onboarding,
        pots,
        subs,
        subPaused,
        tightestSpare: route.tightPoint.amount,
        tightestDate: route.tightPoint.date,
        ritualCompletedRecently: false,
      }).weather,
    [currentBalance, moneyMode, onboarding, pots, route, subPaused, subs],
  );

  const guardInputs = {
    weather,
    recoveryActive: spendHold !== null,
    safeZoneTotal,
    quietMode,
  };
  const canSell = canShowUpsell(guardInputs);
  const suppression = upsellSuppressionReason(guardInputs);
  const selectedProductId = selected === 'free' ? null : productIdFor(selected, cadence);
  const selectedProduct =
    selectedProductId === null
      ? null
      : (billingProducts.find((product) => product.id === selectedProductId) ?? null);
  const ctaMode = resolveCtaMode({
    selected,
    canSell,
    billingAvailable: billingAvailable && selectedProduct !== null,
    plusUnlocked: lens.plusUnlocked,
    proUnlocked: lens.proUnlocked,
    trialCycleId: lens.trialCycleId,
    trialEndedCycleId: lens.trialEndedCycleId,
  });
  const trialEndLabel = useMemo(() => {
    const payday = onboarding.payday || 25;
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), payday);
    const end =
      thisMonth.getTime() < now.getTime()
        ? new Date(now.getFullYear(), now.getMonth() + 1, payday)
        : thisMonth;
    return end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }, [now, onboarding.payday]);
  const chargeThisCycle =
    selected === 'free'
      ? 0
      : selected === 'plus'
        ? cadence === 'yearly'
          ? 39.99
          : 4.99
        : cadence === 'yearly'
          ? 69.99
          : 8.99;
  const wouldStrain = canSell && selected !== 'free' && safeZoneTotal - chargeThisCycle < 50;

  if (state === 'error' || state === 'offline' || state === 'empty') {
    return (
      <StatePanel
        body={state === 'offline' ? copy.err.offline : 'Plan options are unavailable right now.'}
        fullScreen
        kind={state === 'offline' ? 'offline' : state === 'error' ? 'error' : 'genuine-empty'}
        primaryAction={{ label: 'Back', onPress: nav.back }}
        title={state === 'error' ? copy.err.generic : copy.plans.title}
      />
    );
  }

  if (state === 'loading') {
    return <StatePanel fullScreen kind="loading" title="Loading plan options" />;
  }

  const restore = async () => {
    if (billingBusy) return;
    if (!billingCapability.supported) {
      Alert.alert(copy.plans.restore, billingCapability.message);
      return;
    }
    setBillingBusy(true);
    try {
      const restored = await restorePurchases();
      if (restored.status === 'unavailable') {
        Alert.alert(copy.err.generic, restored.message);
        return;
      }
      let restoredTier: 'plus' | 'pro' | null = null;
      let pending = false;
      let verificationMessage: string | null = null;
      for (const storePurchase of restored.purchases) {
        const verification = await verifyGooglePurchase(storePurchase);
        if (verification.status === 'pending') {
          pending = true;
          continue;
        }
        if (verification.status !== 'verified') {
          verificationMessage ??= verification.message;
          continue;
        }
        const saved = await saveVerifiedEntitlement(verification.grant);
        if (saved === null) {
          verificationMessage ??= copy.plans.billing.save_failed;
          continue;
        }
        await finishPurchase(storePurchase);
        if (verification.entitlement.tier === 'pro') restoredTier = 'pro';
        else if (restoredTier === null) restoredTier = 'plus';
      }
      await reconcileEntitlements();
      const activeTier =
        restoredTier === 'pro'
          ? copy.plans.tier.pro.name
          : restoredTier === 'plus'
            ? copy.plans.tier.plus.name
            : null;
      Alert.alert(
        copy.plans.restore,
        activeTier === null
          ? pending
            ? copy.plans.billing.processing
            : (verificationMessage ?? copy.plans.restore_result.none)
          : copy.plans.restore_result.active(activeTier),
      );
    } catch (reason: unknown) {
      Alert.alert(
        copy.err.generic,
        reason instanceof Error ? reason.message : 'Purchases could not be restored right now.',
      );
    } finally {
      setBillingBusy(false);
    }
  };

  const buySelectedPlan = async () => {
    if (!billingCapability.supported) {
      Alert.alert(copy.plans.title, billingCapability.message);
      return;
    }
    if (
      billingBusy ||
      selected === 'free' ||
      selectedProductId === null ||
      selectedProduct === null
    ) {
      return;
    }
    setBillingBusy(true);
    try {
      let owned: readonly Purchase[] = [];
      if (lens.plusUnlocked && !lens.proUnlocked) {
        const restored = await restorePurchases();
        if (restored.status === 'unavailable') {
          Alert.alert(copy.err.generic, restored.message);
          return;
        }
        owned = restored.purchases;
      }
      const oldPlus = owned.find(
        (storePurchase) =>
          tierForProductId(storePurchase.productId) === 'plus' &&
          typeof storePurchase.purchaseToken === 'string' &&
          storePurchase.purchaseToken.length > 0,
      );
      const replacement =
        selected === 'pro' && oldPlus?.purchaseToken
          ? {
              oldProductId: oldPlus.productId,
              purchaseToken: oldPlus.purchaseToken,
            }
          : undefined;
      if (selected === 'pro' && lens.plusUnlocked && replacement === undefined) {
        Alert.alert(
          copy.plans.title,
          'Melo needs the current Plus purchase token to replace that subscription safely. Restore purchases before upgrading.',
        );
        return;
      }
      const outcome = await purchase(selectedProductId, selectedProduct, replacement);
      if (outcome.status === 'cancelled') return;
      if (outcome.status === 'pending') {
        Alert.alert(copy.plans.title, copy.plans.billing.processing);
        return;
      }
      if (outcome.status === 'failed') {
        Alert.alert(copy.err.generic, outcome.message);
        return;
      }
      const verification = await verifyGooglePurchase(outcome.purchase);
      if (verification.status === 'pending') {
        Alert.alert(copy.plans.title, copy.plans.billing.processing);
        return;
      }
      if (verification.status !== 'verified') {
        Alert.alert(copy.err.generic, verification.message);
        return;
      }
      const saved = await saveVerifiedEntitlement(verification.grant);
      if (saved === null) {
        Alert.alert(copy.err.generic, copy.plans.billing.save_failed);
        return;
      }
      await reconcileEntitlements();
      await finishPurchase(outcome.purchase);
      Alert.alert(
        copy.plans.title,
        copy.plans.restore_result.active(
          verification.entitlement.tier === 'pro'
            ? copy.plans.tier.pro.name
            : copy.plans.tier.plus.name,
        ),
      );
    } catch (reason: unknown) {
      Alert.alert(
        copy.err.generic,
        reason instanceof Error ? reason.message : 'The store could not complete this purchase.',
      );
    } finally {
      setBillingBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + gap.huge }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={nav.back}
            style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
          >
            <Text style={styles.topButtonLabel}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>{copy.plans.title}</Text>
          <Pressable
            accessibilityLabel={copy.plans.restore_a11y}
            accessibilityRole="button"
            accessibilityState={{ busy: billingBusy, disabled: billingBusy }}
            disabled={billingBusy}
            onPress={restore}
            style={({ pressed }) => [
              styles.topButton,
              pressed && styles.pressed,
              billingBusy && styles.disabled,
            ]}
          >
            <Text style={styles.restoreLabel}>{copy.plans.restore}</Text>
          </Pressable>
        </View>

        <Text style={styles.current}>{copy.plans.current(planName(lens.paidTier))}</Text>
        <Text style={styles.eyebrow}>{copy.plans.eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.headline}>
          Look at your money <Text style={styles.accent}>your</Text> way.
        </Text>
        <Text style={styles.body}>{copy.plans.body}</Text>

        {!canSell ? (
          <Surface style={styles.guard}>
            <Text style={styles.guardHead}>{copy.plans.guard.head}</Text>
            <Text style={styles.guardBody}>{guardBody(suppression)}</Text>
          </Surface>
        ) : null}

        <View accessibilityRole="radiogroup" style={styles.cadence}>
          {(['monthly', 'yearly'] as const).map((option) => {
            const active = cadence === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => setCadence(option)}
                style={({ pressed }) => [
                  styles.cadenceButton,
                  active && styles.cadenceButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.cadenceLabel, active && styles.cadenceLabelActive]}>
                  {option === 'monthly'
                    ? copy.plans.cadence.monthly
                    : `${copy.plans.cadence.yearly} · ${copy.plans.cadence.saving}`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.tiers}>
          {(['free', 'plus', 'pro'] as const).map((tier) => {
            const selectedNow = tier === selected;
            const currentNow = tier === lens.paidTier;
            const name = planName(tier);
            const storeProduct =
              tier === 'free'
                ? null
                : (billingProducts.find((product) => product.id === productIdFor(tier, cadence)) ??
                  null);
            const fallbackPrice =
              tier === 'free'
                ? copy.plans.tier.free.price
                : tier === 'pro'
                  ? cadence === 'yearly'
                    ? copy.plans.tier.pro.yearly_price
                    : copy.plans.tier.pro.price
                  : cadence === 'yearly'
                    ? copy.plans.tier.plus.yearly_price
                    : copy.plans.tier.plus.price;
            const price =
              !canSell && tier !== 'free'
                ? copy.plans.tier.price_hidden
                : storeProduct !== null
                  ? `${storeProduct.displayPrice} / ${
                      cadence === 'yearly' ? copy.plans.cadence.year : copy.plans.cadence.month
                    }`
                  : fallbackPrice;
            const yearlyNote =
              tier === 'pro'
                ? copy.plans.tier.pro.yearly_note
                : tier === 'plus'
                  ? copy.plans.tier.plus.yearly_note
                  : null;
            const tagline =
              tier === 'pro'
                ? copy.plans.tier.pro.tagline
                : tier === 'plus'
                  ? copy.plans.tier.plus.tagline
                  : copy.plans.tier.free.tagline;
            const bullets = tierBullets(tier);
            return (
              <Pressable
                key={tier}
                accessibilityLabel={`${name}, ${price}`}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedNow }}
                onPress={() => setSelected(tier)}
                style={({ pressed }) => [
                  styles.tier,
                  selectedNow && styles.tierSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.tierHead}>
                  <View style={styles.tierIdentity}>
                    <Text style={styles.tierName}>{name}</Text>
                    {currentNow ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeLabel}>{copy.plans.tier.current}</Text>
                      </View>
                    ) : tier === 'plus' && canSell ? (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedBadgeLabel}>
                          {copy.plans.tier.most_picked}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.priceBlock}>
                    <Text style={styles.tierPrice}>{price}</Text>
                    {canSell && cadence === 'yearly' && yearlyNote !== null ? (
                      <Text style={styles.yearlyNote}>{yearlyNote}</Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.tierTagline}>{tagline}</Text>
                <View style={styles.bullets}>
                  {bullets.map((bullet, index) => {
                    const live = LIVE_BULLETS[tier][index] ?? false;
                    return (
                      <View key={bullet} style={styles.bulletRow}>
                        <View style={[styles.bulletDot, !live && styles.bulletDotSoon]} />
                        <Text style={[styles.bulletLabel, !live && styles.bulletLabelSoon]}>
                          {bullet}
                          {!live ? (
                            <Text style={styles.soonLabel}> {copy.plans.tier.soon}</Text>
                          ) : null}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Surface style={styles.comparison}>
          <View style={styles.comparisonHead}>
            <Text style={[styles.comparisonHeading, styles.comparisonFeature]}>
              {copy.plans.compare.title}
            </Text>
            {(['free', 'plus', 'pro'] as const).map((tier) => (
              <Text key={tier} style={styles.comparisonHeading}>
                {tier === 'free' ? copy.plans.tier.free.name : tier === 'plus' ? 'Plus' : 'Pro'}
              </Text>
            ))}
          </View>
          {COMPARISON.map((row, index) => {
            const label = copy.plans.compare.rows[index];
            if (label === undefined) return null;
            return (
              <View key={label} style={styles.comparisonRow}>
                <Text style={[styles.comparisonLabel, styles.comparisonFeature]}>{label}</Text>
                {(['free', 'plus', 'pro'] as const).map((tier) => {
                  const cell = row[tier];
                  return (
                    <View
                      key={tier}
                      accessibilityLabel={`${label}, ${planName(tier)}: ${
                        cell === 'live'
                          ? 'included'
                          : cell === 'soon'
                            ? copy.plans.tier.soon
                            : 'not included'
                      }`}
                      style={styles.comparisonCell}
                    >
                      {cell === 'live' ? (
                        <View style={styles.comparisonDot} />
                      ) : (
                        <Text style={cell === 'soon' ? styles.comparisonSoon : styles.comparisonNo}>
                          {cell === 'soon' ? copy.plans.tier.soon : '—'}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </Surface>

        {canSell && selected !== 'free' ? (
          <Surface style={styles.affordability}>
            <Text style={styles.affordabilityText}>
              {copy.plans.affordability.spare(
                `${safeZoneTotal < 0 ? '-' : ''}£${Math.abs(safeZoneTotal).toFixed(0)}`,
              )}
            </Text>
            {wouldStrain ? (
              <Text style={styles.affordabilityTight}>{copy.plans.affordability.tight}</Text>
            ) : null}
          </Surface>
        ) : null}

        {canSell ? (
          ctaMode === 'free-note' || ctaMode === 'unlocked' ? (
            <Surface style={styles.statusCard}>
              <Text style={styles.statusHead}>{copy.plans.current(planName(selected))}</Text>
            </Surface>
          ) : ctaMode === 'trial-active' ? (
            <Surface style={styles.statusCard}>
              <Text style={styles.statusHead}>{copy.plans.trial.active}</Text>
              <Text style={styles.statusBody}>{copy.plans.trial.active_until(trialEndLabel)}</Text>
              <Text style={styles.statusBody}>{copy.plans.trial.no_renew}</Text>
            </Surface>
          ) : ctaMode === 'purchase' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: billingBusy, disabled: billingBusy }}
              disabled={billingBusy}
              onPress={buySelectedPlan}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                billingBusy && styles.disabled,
              ]}
            >
              <Text style={styles.primaryLabel}>
                {billingBusy
                  ? copy.plans.action.connecting
                  : copy.plans.action.subscribe(planName(selected))}
              </Text>
            </Pressable>
          ) : ctaMode === 'trial' && lens.canOfferTrial ? (
            <View style={styles.trialAction}>
              <Pressable
                accessibilityRole="button"
                onPress={lens.startTrial}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryLabel}>{copy.plans.trial.try_plus(trialEndLabel)}</Text>
              </Pressable>
              <Text style={styles.trialFootnote}>{copy.plans.trial.no_card}</Text>
            </View>
          ) : ctaMode === 'none' ? (
            <Surface style={styles.statusCard}>
              <Text style={styles.statusHead}>
                {billingLoading ? copy.plans.title : copy.plans.billing.pending_head}
              </Text>
              <Text style={styles.statusBody}>
                {billingLoading ? copy.plans.billing.checking : copy.plans.billing.pending_body}
              </Text>
            </Surface>
          ) : null
        ) : null}

        <Text style={styles.lensCounts}>{copy.lens.picker.counts}</Text>
        <Surface style={styles.lensList}>
          {ORDER.map((mode, index) => {
            const tier = lens.tierFor(mode);
            return (
              <View key={mode} style={[styles.lensRow, index > 0 && styles.lensRowBorder]}>
                <View style={styles.lensText}>
                  <Text style={styles.lensName}>{MODE_LABEL[mode]}</Text>
                  <Text style={styles.lensLine}>{copy.lens.line[mode]}</Text>
                </View>
                <Text style={styles.lensBadge}>{copy.lens.badge[tier]}</Text>
              </View>
            );
          })}
        </Surface>

        <Surface style={styles.promise}>
          <Text style={styles.promiseHead}>{copy.plans.promise.head}</Text>
          {[
            copy.plans.promise.path,
            copy.plans.promise.ownership,
            copy.plans.promise.core,
            copy.plans.promise.safety,
            copy.plans.promise.upsell,
            copy.plans.promise.trial,
          ].map((line) => (
            <Text key={line} style={styles.promiseLine}>
              · {line}
            </Text>
          ))}
        </Surface>
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Palette) {
  return StyleSheet.create({
    screen: { backgroundColor: theme.canvas, flex: 1 },
    content: { paddingHorizontal: gap.lg, paddingTop: gap.sm },
    topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    topButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 44,
    },
    topButtonLabel: { color: theme.muted, fontSize: 22 },
    restoreLabel: { color: theme.muted, fontSize: 12, textDecorationLine: 'underline' },
    topTitle: {
      color: theme.muted,
      fontSize: 12,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    current: { color: theme.muted, fontSize: 12, marginTop: gap.sm },
    eyebrow: {
      color: theme.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      marginTop: gap.lg,
    },
    headline: {
      color: theme.ink,
      fontFamily: serif.display,
      fontSize: 28,
      lineHeight: 34,
      marginTop: gap.xs,
    },
    accent: { color: theme.calm },
    body: { color: theme.muted, fontSize: 13, lineHeight: 20, marginTop: gap.sm },
    guard: { backgroundColor: theme.inset, marginTop: gap.lg, padding: gap.lg },
    guardHead: {
      color: theme.muted,
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    guardBody: {
      color: theme.ink,
      fontFamily: serif.displayItalic,
      fontSize: 16,
      lineHeight: 21,
      marginTop: gap.xs,
    },
    cadence: {
      backgroundColor: theme.inset,
      borderColor: theme.hairline,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      marginTop: gap.lg,
      padding: 4,
    },
    cadenceButton: {
      alignItems: 'center',
      borderRadius: radius.pill,
      flex: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: gap.sm,
    },
    cadenceButtonActive: { backgroundColor: theme.surface },
    cadenceLabel: { color: theme.muted, fontSize: 12, fontWeight: '500' },
    cadenceLabelActive: { color: theme.ink },
    tiers: { gap: gap.sm, marginTop: gap.lg },
    tier: {
      backgroundColor: theme.surface,
      borderColor: theme.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      minHeight: 88,
      padding: gap.lg,
    },
    tierSelected: { borderColor: theme.calm, borderWidth: 2 },
    tierHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
    tierIdentity: {
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 1,
      gap: gap.xs,
    },
    tierName: { color: theme.ink, fontFamily: serif.display, fontSize: 18 },
    currentBadge: {
      backgroundColor: theme.positiveSoft,
      borderRadius: radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    currentBadgeLabel: {
      color: theme.positiveInk,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    recommendedBadge: {
      backgroundColor: theme.calmSoft,
      borderRadius: radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    recommendedBadgeLabel: {
      color: theme.calmStrong,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    priceBlock: { alignItems: 'flex-end', flexShrink: 0, marginLeft: gap.sm },
    tierPrice: {
      color: theme.ink,
      fontFamily: serif.display,
      fontSize: 18,
      fontVariant: ['tabular-nums'],
    },
    yearlyNote: {
      color: theme.muted,
      fontSize: 10,
      fontVariant: ['tabular-nums'],
      marginTop: 3,
    },
    tierTagline: { color: theme.muted, fontSize: 12, marginTop: gap.xs },
    includes: { color: theme.calmStrong, fontSize: 11, marginTop: gap.sm },
    bullets: { gap: 6, marginTop: gap.md },
    bulletRow: { alignItems: 'flex-start', flexDirection: 'row', gap: gap.sm },
    bulletDot: {
      backgroundColor: theme.calm,
      borderRadius: radius.pill,
      height: 6,
      marginTop: 5,
      width: 6,
    },
    bulletDotSoon: { backgroundColor: theme.muted, opacity: 0.4 },
    bulletLabel: { color: theme.ink, flex: 1, fontSize: 12, lineHeight: 18 },
    bulletLabelSoon: { color: theme.muted },
    soonLabel: {
      color: theme.muted,
      fontSize: 9,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    comparison: { marginTop: gap.lg, overflow: 'hidden' },
    comparisonHead: {
      alignItems: 'center',
      backgroundColor: theme.inset,
      flexDirection: 'row',
      minHeight: 40,
      paddingHorizontal: gap.md,
    },
    comparisonHeading: {
      color: theme.muted,
      flex: 0.62,
      fontSize: 9,
      letterSpacing: 1,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    comparisonFeature: { flex: 1.6, textAlign: 'left' },
    comparisonRow: {
      alignItems: 'center',
      borderTopColor: theme.hairline,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      minHeight: 48,
      paddingHorizontal: gap.md,
      paddingVertical: gap.sm,
    },
    comparisonLabel: { color: theme.ink, fontSize: 11, lineHeight: 15, paddingRight: gap.sm },
    comparisonCell: { alignItems: 'center', flex: 0.62, justifyContent: 'center' },
    comparisonDot: {
      backgroundColor: theme.calm,
      borderRadius: radius.pill,
      height: 8,
      width: 8,
    },
    comparisonSoon: {
      color: theme.muted,
      fontSize: 8,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    comparisonNo: { color: theme.muted, fontSize: 13, opacity: 0.4 },
    affordability: {
      alignItems: 'center',
      backgroundColor: theme.inset,
      marginTop: gap.md,
      padding: gap.md,
    },
    affordabilityText: {
      color: theme.muted,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },
    affordabilityTight: {
      color: theme.warmInk,
      fontSize: 11,
      fontStyle: 'italic',
      marginTop: 3,
    },
    statusCard: { backgroundColor: theme.calmSoft, marginTop: gap.md, padding: gap.lg },
    trialCard: { backgroundColor: theme.inset, marginTop: gap.md, padding: gap.lg },
    trialAction: { marginTop: gap.md },
    trialFootnote: {
      color: theme.muted,
      fontSize: 10,
      fontStyle: 'italic',
      marginTop: gap.sm,
      textAlign: 'center',
    },
    statusHead: { color: theme.ink, fontSize: 13, fontWeight: '600' },
    statusBody: { color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: gap.xs },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: theme.ink,
      borderRadius: radius.md,
      justifyContent: 'center',
      marginTop: gap.md,
      minHeight: 44,
      paddingHorizontal: gap.lg,
    },
    primaryLabel: { color: theme.canvas, fontSize: 14, fontWeight: '600' },
    lensCounts: {
      color: theme.muted,
      fontSize: 11,
      letterSpacing: 1.4,
      marginTop: gap.xl,
      textTransform: 'uppercase',
    },
    lensList: { marginTop: gap.sm, overflow: 'hidden' },
    lensRow: {
      alignItems: 'center',
      flexDirection: 'row',
      minHeight: 56,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.sm,
    },
    lensRowBorder: { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth },
    lensText: { flex: 1 },
    lensName: { color: theme.ink, fontSize: 14, fontWeight: '500' },
    lensLine: { color: theme.muted, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
    lensBadge: {
      color: theme.muted,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    promise: { backgroundColor: theme.inset, marginTop: gap.xl, padding: gap.lg },
    promiseHead: {
      color: theme.muted,
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    promiseLine: { color: theme.ink, fontSize: 12, lineHeight: 18, marginTop: gap.xs },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  });
}
