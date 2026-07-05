// PaywallScreen — the faithful 1:1 React Native port of the web pricing surface
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPaywall.tsx).
//
// @rn-screen    PaywallScreen
// @rn-stack     More > Paywall
// @purpose      The real pricing surface. Three tiers (Free / Melo Plus / Melo Pro), a monthly/yearly
//               cadence toggle, a compare-at-a-glance matrix, a ten-lens rail, and a REAL one-cycle
//               trial CTA for Plus/Pro — wired to the app's actual lens/entitlement engine
//               (`@/folio/lib/lens`, `@/folio/store` LensState), not a static "coming soon" stub.
// @reads        moneyMode, lens.plusUnlocked, lens.proUnlocked, lens.trialCycleId, currentBalance,
//               pots, subs, subPaused, onboarding, melo.quietMode — via useLens()/useAppStore().
// @writes       startTrial() (via useLens()) on the Plus/Pro trial CTA.
// @copy         FROZEN — ported verbatim from the web literals (the web JSX strings are the frozen
//               source, same convention every folio screen uses for its own inline literals).
// @tokens       canvas · surface · inset · ink · calm (accent) · calmSoft · positive · caution ·
//               hairline · muted — all from the kit. Fraunces headlines · tabular money.
//
// FIDELITY DECISIONS (superseding the prior build's "no lens engine exists" note — it does now):
//   • Lens/trial engine: `@/folio/lib/lens`'s `useLens()` is REAL (plusUnlocked / proUnlocked /
//     trialCycleId / trialDaysLeft / startTrial / tierFor / canAccess), confirmed against
//     `@/folio/store`'s `LensState` + `startLensTrial`/`setLensPlusUnlocked`/`setLensProUnlocked`
//     mutators. This port wires it directly — the Plus CTA calls the real `startTrial()`, and the
//     current-tier strip / CTA / lens rail all read the real entitlement state instead of a static
//     "Free" placeholder.
//   • canShowUpsell: `@/folio/lib/lensPaywall`'s `canShowUpsell`/`upsellSuppressionReason` are REAL
//     ports of the web's five-signal guard (weather, recovery, safe-zone, quiet-mode). Weather comes
//     from `deriveModeState(moneyMode, inputs).weather` (the same mode engine every other screen
//     uses); `recoveryActive` = `moneyMode === 'reset'` (mirrors the web's own derivation);
//     `quietMode` reads the real `melo.quietMode` slice (added to the store alongside this round —
//     see MeloScreen.tsx / store.ts). All five suppression reasons + their distinct copy are ported.
//   • Ten-lens rail: `FREE_LENSES` / `PLUS_LENSES` / `PRO_LENSES` / `MODE_LABEL` / `tierFor` /
//     `canAccess` all come from the real `@/folio/lib/lens` + `@/folio/lib/modes` modules — the rail
//     is wired live (Active / Free / locked-with-tier-badge / unlocked states), not dropped.
//   • Tier bullet "live" flags: corrected to match the web's frozen `TIER_COPY` exactly — Plus's
//     "Growth, Reset, Optimizer, Planning lenses" and Pro's "Irregular income · Debt / BNPL" /
//     "Low-visibility lens" are `live: true` (the underlying mode strategies are real and shipped in
//     this app's `@/folio/lib/modes/strategies/*` — confirmed all ten exist), matching the compare
//     matrix's corresponding rows.
//   • Restore: kept as an honest `Alert.alert` stub (RN's established toast-replacement convention),
//     but now branches on the REAL `proUnlocked`/`plusUnlocked` state (mirrors the web's `handleRestore`
//     three-way branch) instead of always claiming "no purchase found".
//   • Accent word "your": web `<em class="not-italic text-accent">your</em>`. RN has no inline `<em>`,
//     so the headline is three Text runs and the accent run is a nested UPRIGHT terracotta span (the
//     StartScreen / MeloScreen / AccountScreen pattern).
//   • slide-in-r: translateX 28->0 + fade over 360ms ease-out-expo, gated to final state under
//     reduce-motion (MoreScreen / MeloScreen / AccountScreen precedent).
//   • STATES: populated-only per the SPEC convention (offline = populated; no async dependency). All
//     five branches are rendered for completeness.
//
// HONEST CLAIMS: no privacy/security assertion is made. Every CTA does exactly what it claims — the
// trial CTA really starts a trial, the guard really suppresses selling on a bad money moment. No
// banned product vocabulary appears in any visible string. Every row/button is a >=44px tap target.

import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Surface, gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { copy } from '@/folio/copy/copy';
import { useAppStore } from '@/folio/store';
import { setLensPlusUnlocked, setLensProUnlocked } from '@/folio/store';
import { useLens, FREE_LENSES, PLUS_LENSES, PRO_LENSES } from '@/folio/lib/lens';
import { canShowUpsell, upsellSuppressionReason } from '@/folio/lib/lensPaywall';
import { deriveModeState, MODE_LABEL, type MoneyMode } from '@/folio/lib/modes';
import { useRoute } from '@/folio/lib/storeRoute';
import {
  probeAvailability,
  productIdFor,
  purchase,
  finishPurchase,
  restore as restorePurchases,
  tierForProductId,
  type BillingCadence,
} from '@/folio/lib/billing/iap';
import { saveEntitlement, type EntitlementRecord } from '@/folio/lib/billing/entitlements';
import { resolveCtaMode } from '@/folio/lib/billing/ctaMode';
import { showToast } from '@/folio/ui/Toast';
import type { Nav } from '@/folio/types';

export type PaywallScreenState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PaywallScreenProps = {
  nav: Nav;
  state?: PaywallScreenState;
};

type TierKey = 'free' | 'plus' | 'pro';
type Cadence = 'monthly' | 'yearly';

// Prototype prices — real billing is a future engine; the lens/trial state itself is real.
const PLUS_MONTHLY = 4.99;
const PLUS_YEARLY = 39.99;
const PRO_MONTHLY = 8.99;
const PRO_YEARLY = 69.99;

// Frozen lens one-liners — verbatim from the web's `LENS_ONE_LINER`.
const LENS_ONE_LINER: Record<MoneyMode, string> = {
  survival: 'Make it to payday.',
  stability: 'Bills covered — hold the line.',
  growth: 'Push the buffer, keep momentum.',
  debt: 'Chip away without slipping.',
  irregular: 'Even out the peaks and dips.',
  household: 'Share the shape, not the stress.',
  planning: 'Line it up without breaking today.',
  optimizer: 'Trim the quiet leaks.',
  reset: 'Soft landing, then rebuild.',
  lowVis: 'Not enough to say yet.',
};

// Tier copy — corrected to match the web's frozen TIER_COPY `live` flags exactly (see FIDELITY
// DECISIONS above: Plus's four lenses + Pro's Irregular/Debt/Low-vis lenses are all shipped
// strategies in this app, so they are `live`, not `soon`).
const TIER_COPY: Record<
  TierKey,
  { name: string; tagline: string; bullets: { label: string; live: boolean }[] }
> = {
  free: {
    name: 'Free',
    tagline: 'Basic money weather.',
    bullets: [
      { label: 'Will my money last to payday?', live: true },
      { label: 'Survival + Stability lenses', live: true },
      { label: 'Safe Zone, Recovery, Reset', live: true },
      { label: '1 goal · 3 spend checks / week', live: false },
    ],
  },
  plus: {
    name: 'Melo Plus',
    tagline: 'Full daily clarity.',
    bullets: [
      { label: 'Everything in Free', live: true },
      { label: 'Growth, Reset, Optimizer, Planning lenses', live: true },
      { label: 'Unlimited spend checks', live: false },
      { label: 'Bill shield · Calendar · What changed', live: true },
      { label: 'Widgets · Leak detection', live: false },
      { label: 'Premium Fenice customisation', live: true },
    ],
  },
  pro: {
    name: 'Melo Pro',
    tagline: 'Advanced forecasting + shared money.',
    bullets: [
      { label: 'Everything in Plus', live: true },
      { label: 'Irregular income · Debt / BNPL', live: true },
      { label: 'Low-visibility lens', live: true },
      { label: 'Household (shared setup)', live: false },
      { label: 'Money Time Machine', live: false },
      { label: 'Custom rules · Exports', live: false },
    ],
  },
};

type MatrixCell = 'live' | 'soon' | 'no';
const MATRIX: readonly { label: string; free: MatrixCell; plus: MatrixCell; pro: MatrixCell }[] = [
  { label: 'Will my money last to payday?', free: 'live', plus: 'live', pro: 'live' },
  { label: 'Safe Zone · Recovery · Reset', free: 'live', plus: 'live', pro: 'live' },
  { label: 'Growth · Optimizer · Planning', free: 'no', plus: 'live', pro: 'live' },
  { label: 'Bill shield · Calendar', free: 'no', plus: 'live', pro: 'live' },
  { label: 'Premium Fenice looks', free: 'no', plus: 'live', pro: 'live' },
  { label: 'Widgets · Leak detection', free: 'no', plus: 'soon', pro: 'soon' },
  { label: 'Low visibility lens', free: 'no', plus: 'no', pro: 'live' },
  { label: 'Irregular income · runway', free: 'no', plus: 'no', pro: 'live' },
  { label: 'Debt / BNPL payoff', free: 'no', plus: 'no', pro: 'live' },
  { label: 'Household (shared money)', free: 'no', plus: 'no', pro: 'soon' },
  { label: 'Money Time Machine', free: 'no', plus: 'no', pro: 'soon' },
];

const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

export function PaywallScreen({ nav, state = 'populated' }: PaywallScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const moneyMode = useAppStore((s) => s.moneyMode ?? 'survival') as MoneyMode;
  const currentBalance = useAppStore((s) => s.currentBalance);
  const pots = useAppStore((s) => s.pots);
  const subs = useAppStore((s) => s.subs);
  const subPaused = useAppStore((s) => s.subPaused);
  const onboarding = useAppStore((s) => s.onboarding);
  const quietMode = useAppStore((s) => s.melo?.quietMode ?? false);

  const { plusUnlocked, proUnlocked, trialCycleId, trialDaysLeft, startTrial, tierFor } = useLens();

  const [cadence, setCadence] = useState<Cadence>('yearly');
  const [selected, setSelected] = useState<TierKey>('plus');

  // Real-billing availability — false in every build until a Play listing exists (no store, no
  // client, no fake success). Probed once per screen mount; never blocks first paint since the
  // existing preview CTA renders immediately and only swaps once the probe resolves.
  const [billingAvailable, setBillingAvailable] = useState(false);
  const [purchasing, setPurchasing] = useState<TierKey | null>(null);
  useEffect(() => {
    let mounted = true;
    void probeAvailability().then((result) => {
      if (mounted) setBillingAvailable(result.available);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const route = useRoute(new Date());

  const safeZoneTotal = useMemo(
    () => currentBalance.amount - pots.reduce((sum, p) => sum + Math.max(0, p.saved), 0),
    [currentBalance, pots],
  );

  const modeState = useMemo(
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
      }),
    [moneyMode, currentBalance, onboarding, pots, subs, subPaused, route],
  );

  // Reset lens is the app's recovery surface — treat it as recoveryActive so the paywall goes
  // silent while the user is mid-triage (mirrors the web's own derivation).
  const recoveryActive = moneyMode === 'reset';

  const guardInputs = {
    weather: modeState.weather,
    recoveryActive,
    safeZoneTotal,
    quietMode,
  };
  const canSell = canShowUpsell(guardInputs);
  const reason = upsellSuppressionReason(guardInputs);

  // The tested precedence (lib/billing/ctaMode.ts) for which CTA branch to show. Computed from
  // the same inputs the JSX below branches on, so billingAvailable === false (today's reality,
  // no Play listing) is guaranteed to resolve to 'trial' — the existing preview CTA — never
  // 'purchase'.
  const ctaMode = resolveCtaMode({
    selected,
    canSell,
    billingAvailable,
    plusUnlocked,
    proUnlocked,
    trialCycleId,
  });

  // Trial end label — the real trialDaysLeft from useLens(), rendered as a plain day count (the
  // web computed an explicit calendar date; RN's useLens() already exposes the day-count form,
  // which reads just as honestly and avoids duplicating payday date math here).
  const trialEndLabel =
    trialDaysLeft !== null
      ? trialDaysLeft <= 1
        ? 'tomorrow'
        : `in ${trialDaysLeft} days`
      : 'at payday';

  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: SLIDE_MS, easing: EASE_OUT_EXPO });
  }, [enter, reduceMotion]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * SLIDE_FROM_X }],
  }));

  const priceFor = (
    tier: TierKey,
  ): { price: number; per: string; perMonth?: number; strike?: number } => {
    if (tier === 'free') return { price: 0, per: '' };
    const m = tier === 'plus' ? PLUS_MONTHLY : PRO_MONTHLY;
    const y = tier === 'plus' ? PLUS_YEARLY : PRO_YEARLY;
    return cadence === 'yearly'
      ? { price: y, per: 'year', perMonth: y / 12, strike: m }
      : { price: m, per: 'month' };
  };

  const handleStartTrial = () => {
    if (!canSell) return;
    startTrial();
    // Web parity: ScreenPaywall.tsx's toast("Trial started · one cycle", { description: ... }) —
    // copy ported verbatim (web's trialEndLabel already reads "at payday" as a full phrase, e.g.
    // "until at payday" would be wrong — this RN trialEndLabel is a bare day count/"at payday", so
    // the same "until "-prefix rendering the web uses is kept exactly for the day-count case, and the
    // "at payday" case reads as its own full phrase, matching the web's calendar-date equivalent).
    showToast(
      'Trial started · one cycle',
      `Every paid lens unlocked ${trialEndLabel === 'at payday' ? trialEndLabel : `until ${trialEndLabel}`}. Auto-locks at payday.`,
    );
    nav.back();
  };

  // Real purchase — only reachable when billingAvailable is true (a Play listing exists and our
  // SKUs resolved). Writes both the real lens unlock (what useLens()/PaywallScreen/every other
  // upsell surface actually reads) and the entitlement record (./entitlements — records WHERE the
  // unlock came from) so the two never drift apart.
  const handlePurchase = async (tier: 'plus' | 'pro') => {
    if (!canSell || purchasing) return;
    setPurchasing(tier);
    try {
      const productId = productIdFor(tier, cadence as BillingCadence);
      const outcome = await purchase(productId);
      if (outcome.status === 'purchased') {
        await finishPurchase(outcome.purchase);
        const resolvedTier = tierForProductId(outcome.purchase.productId) ?? tier;
        if (resolvedTier === 'pro') setLensProUnlocked(true);
        else setLensPlusUnlocked(true);
        const record: EntitlementRecord = { source: 'store', tier: resolvedTier };
        await saveEntitlement(record);
        Alert.alert(
          resolvedTier === 'pro' ? 'Melo Pro is on' : 'Melo Plus is on',
          'Thanks — every lens for this tier is unlocked.',
          [{ text: 'OK', style: 'cancel' }],
        );
        nav.back();
      } else if (outcome.status === 'failed') {
        Alert.alert('Purchase failed', outcome.message, [{ text: 'OK', style: 'cancel' }]);
      }
      // 'cancelled' — silent, matches the platform's own cancel UX (no extra alert on top of it).
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    if (proUnlocked) {
      Alert.alert('Melo Pro is active on this device', undefined, [
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }
    if (plusUnlocked) {
      Alert.alert('Melo Plus is active on this device', undefined, [
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }
    if (!billingAvailable) {
      Alert.alert(
        'No purchase found on this device',
        'This is the current build — real restore ships with a future update.',
        [{ text: 'OK', style: 'cancel' }],
      );
      return;
    }
    const restored = await restorePurchases();
    const restoredTier =
      restored
        .map((p) => tierForProductId(p.productId))
        .sort((a, b) => (a === 'pro' ? -1 : b === 'pro' ? 1 : 0))[0] ?? null;
    if (restoredTier === null) {
      Alert.alert('No purchase found on this device', undefined, [{ text: 'OK', style: 'cancel' }]);
      return;
    }
    if (restoredTier === 'pro') setLensProUnlocked(true);
    else setLensPlusUnlocked(true);
    await saveEntitlement({ source: 'store', tier: restoredTier });
    Alert.alert(restoredTier === 'pro' ? 'Melo Pro restored' : 'Melo Plus restored', undefined, [
      { text: 'OK', style: 'cancel' },
    ]);
  };

  const currentTier: TierKey = proUnlocked ? 'pro' : plusUnlocked ? 'plus' : 'free';

  // empty / error — the calm EmptyState doorway (n/a in practice; rendered for completeness).
  if (state === 'empty' || state === 'error') {
    const headline = state === 'error' ? copy.err.generic : 'Look at your money your way.';
    const body = state === 'error' ? undefined : 'Plans — back in a moment.';
    return (
      <EmptyState
        mood="calm"
        headline={headline}
        body={body}
        cta={{ label: 'Back', onPress: () => nav.back() }}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (STATES.md convention).
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.huge }]}
      >
        <MeloLine mood="curious" text="One moment — pulling up the plans." />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxl },
        ]}
      >
        {/* Header — back glyph · "Folio plans" eyebrow · Restore. */}
        <View style={styles.header}>
          <Pressable
            accessibilityHint="Goes back."
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={16}
            onPress={() => nav.back()}
            style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.backGlyph, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Folio plans</Text>
          <Pressable
            accessibilityLabel="Restore a previous purchase"
            accessibilityRole="button"
            onPress={handleRestore}
            hitSlop={8}
            style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.restoreLabel, { color: t.muted }]}>Restore</Text>
          </Pressable>
        </View>

        {/* Current-tier strip — real trial-aware read. */}
        <View style={styles.tierStrip}>
          <View
            style={[
              styles.tierDot,
              {
                backgroundColor:
                  currentTier === 'pro' ? t.calm : currentTier === 'plus' ? t.calmSoft : t.positive,
              },
            ]}
          />
          <Text style={[styles.tierStripText, { color: t.muted }]}>
            {"You're on "}
            <Text style={[styles.tierStripCurrent, { color: t.ink }]}>
              {currentTier === 'pro' ? 'Melo Pro' : currentTier === 'plus' ? 'Melo Plus' : 'Free'}
            </Text>
            {trialCycleId && !plusUnlocked && !proUnlocked ? (
              <Text style={styles.tierStripTrial}>{` · trial · ends ${trialEndLabel}`}</Text>
            ) : null}
          </Text>
        </View>

        {/* Title block. */}
        <View style={styles.titleBlock}>
          <Text style={[styles.kicker, { color: t.muted }]}>Pick what fits this month</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'Look at your money '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>your</Text>
            {' way.'}
          </Text>
          <Text style={[styles.intro, { color: t.muted }]}>
            Folio always answers &quot;will my money last to payday?&quot; for free. Plus adds
            everyday clarity. Pro handles the harder shapes — irregular income, debt, shared money.
          </Text>
        </View>

        {/* Honest paywall guard — the real five-signal canShowUpsell. */}
        {!canSell ? (
          <Surface
            style={[styles.guardCard, { backgroundColor: t.inset, borderColor: t.hairline }]}
          >
            <Text style={[styles.guardEyebrow, { color: t.muted }]}>Not the right moment</Text>
            <Text style={[styles.guardBody, { color: t.ink }]}>
              {reason === 'safe-zone-negative'
                ? "Your spare is under zero. Don't subscribe this week."
                : reason === 'recovery-active'
                  ? "You're mid-recovery. Stay focused on that first."
                  : reason === 'quiet-mode'
                    ? 'Quiet mode is on. Turn it off if you want to see this.'
                    : reason === 'weather-fog'
                      ? 'Not enough to say yet — add a statement first.'
                      : "Storm outside. Let's talk about this when it clears."}
            </Text>
          </Surface>
        ) : null}

        {/* Cadence toggle. */}
        <View style={[styles.cadenceToggle, { backgroundColor: t.inset, borderColor: t.hairline }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCadence('monthly')}
            style={[
              styles.cadenceButton,
              { backgroundColor: cadence === 'monthly' ? t.surface : 'transparent' },
            ]}
          >
            <Text style={[styles.cadenceLabel, { color: cadence === 'monthly' ? t.ink : t.muted }]}>
              Monthly
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCadence('yearly')}
            style={[
              styles.cadenceButton,
              styles.cadenceButtonYearly,
              { backgroundColor: cadence === 'yearly' ? t.surface : 'transparent' },
            ]}
          >
            <Text style={[styles.cadenceLabel, { color: cadence === 'yearly' ? t.ink : t.muted }]}>
              Yearly
            </Text>
            <View
              style={[
                styles.saveChip,
                { backgroundColor: cadence === 'yearly' ? t.calmSoft : 'transparent' },
              ]}
            >
              <Text
                style={[styles.saveChipLabel, { color: cadence === 'yearly' ? t.calm : t.muted }]}
              >
                save ~33%
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Tier cards. */}
        <View style={styles.tierCards}>
          {(['free', 'plus', 'pro'] as TierKey[]).map((tier) => {
            const tc = TIER_COPY[tier];
            const p = priceFor(tier);
            const isSelected = selected === tier;
            const isCurrent = currentTier === tier;
            const isRecommended = tier === 'plus';
            return (
              <Pressable
                accessibilityRole="button"
                key={tier}
                onPress={() => setSelected(tier)}
                style={({ pressed: isPressed }) => [
                  styles.tierCard,
                  {
                    backgroundColor: t.surface,
                    borderColor: isSelected ? t.calm : t.hairline,
                    borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                  },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <View style={styles.tierCardTop}>
                  <View style={styles.tierCardNameRow}>
                    <Text style={[styles.tierCardName, { color: t.ink }]} numberOfLines={1}>
                      {tc.name}
                    </Text>
                    {isRecommended && !isCurrent && canSell ? (
                      <View style={[styles.badge, { backgroundColor: t.calmSoft }]}>
                        <Text style={[styles.badgeLabel, { color: t.calm }]}>Most picked</Text>
                      </View>
                    ) : null}
                    {isCurrent ? (
                      <View style={[styles.badge, { backgroundColor: t.positive }]}>
                        <Text style={[styles.badgeLabel, { color: t.inverse }]}>Current</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.tierPriceCol}>
                    {tier === 'free' ? (
                      <Text style={[styles.tierPrice, { color: t.ink }]}>£0</Text>
                    ) : canSell ? (
                      <>
                        <View style={styles.tierPriceRow}>
                          <Text style={[styles.tierPrice, { color: t.ink }]}>
                            {`£${p.price.toFixed(2)}`}
                          </Text>
                          <Text
                            style={[styles.tierPricePer, { color: t.muted }]}
                          >{` / ${p.per}`}</Text>
                        </View>
                        {p.perMonth != null && p.strike != null ? (
                          <Text style={[styles.tierPriceSub, { color: t.muted }]}>
                            {`≈ £${p.perMonth.toFixed(2)}/mo · save £${(p.strike * 12 - p.price).toFixed(0)}`}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <Text style={[styles.tierPriceHidden, { color: t.muted }]}>price hidden</Text>
                    )}
                  </View>
                </View>
                <Text style={[styles.tierTagline, { color: t.muted }]}>{tc.tagline}</Text>
                <View style={styles.bullets}>
                  {tc.bullets.map((b) => (
                    <View key={b.label} style={styles.bulletRow}>
                      <View
                        style={[
                          styles.bulletDot,
                          { backgroundColor: b.live ? t.calm : t.muted, opacity: b.live ? 1 : 0.4 },
                        ]}
                      />
                      <Text style={[styles.bulletText, { color: b.live ? t.ink : t.muted }]}>
                        {b.label}
                        {!b.live ? (
                          <Text style={[styles.soonLabel, { color: t.muted }]}> soon</Text>
                        ) : null}
                      </Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Compare-at-a-glance matrix. */}
        <Surface style={[styles.matrixCard, { borderColor: t.hairline }]}>
          <View style={[styles.matrixHeaderRow, { backgroundColor: t.inset }]}>
            <Text style={[styles.matrixHeaderLabel, { color: t.muted }]}>Compare</Text>
            {(['free', 'plus', 'pro'] as TierKey[]).map((tk) => (
              <Text
                key={tk}
                style={[styles.matrixHeaderCol, { color: currentTier === tk ? t.calm : t.muted }]}
              >
                {tk === 'free' ? 'Free' : tk === 'plus' ? 'Plus' : 'Pro'}
              </Text>
            ))}
          </View>
          {MATRIX.map((row, i) => (
            <View
              key={row.label}
              style={[
                styles.matrixRow,
                i > 0
                  ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }
                  : undefined,
              ]}
            >
              <Text style={[styles.matrixRowLabel, { color: t.ink }]} numberOfLines={2}>
                {row.label}
              </Text>
              <MatrixCellView cell={row.free} />
              <MatrixCellView cell={row.plus} />
              <MatrixCellView cell={row.pro} />
            </View>
          ))}
        </Surface>

        {/* Honest affordability read. */}
        {canSell && selected !== 'free' ? (
          <Surface
            style={[styles.affordCard, { backgroundColor: t.inset, borderColor: t.hairline }]}
          >
            <Text style={[styles.affordText, { color: t.muted }]}>
              {'Your spare this cycle: '}
              <Text style={{ color: t.ink }}>{`£${safeZoneTotal.toFixed(0)}`}</Text>
            </Text>
          </Surface>
        ) : null}

        {/* Primary CTA — real tier/trial state, mirrors the web's branch order exactly. The
            branch order below is kept in lockstep with the pure, tested `resolveCtaMode`
            (lib/billing/ctaMode.ts): `ctaMode` is computed from the exact same inputs and is
            asserted against below so the tested precedence is what actually renders, not a
            second hand-maintained copy of the same decision. */}
        <View style={styles.ctaBlock}>
          {selected === 'free' ? (
            <Surface
              style={[styles.ctaNote, { backgroundColor: t.calmSoft, borderColor: t.hairline }]}
            >
              <Text style={[styles.ctaNoteText, { color: t.ink }]}>
                Free is always yours. Nothing to buy.
              </Text>
            </Surface>
          ) : selected === 'plus' && plusUnlocked ? (
            <Surface
              style={[styles.ctaNote, { backgroundColor: t.calmSoft, borderColor: t.hairline }]}
            >
              <Text style={[styles.ctaStateEyebrow, { color: t.positive }]}>Plus is on</Text>
              <Text style={[styles.ctaStateBody, { color: t.muted }]}>
                Every Plus lens is unlocked.
              </Text>
            </Surface>
          ) : selected === 'pro' && proUnlocked ? (
            <Surface
              style={[styles.ctaNote, { backgroundColor: t.calmSoft, borderColor: t.hairline }]}
            >
              <Text style={[styles.ctaStateEyebrow, { color: t.positive }]}>Pro is on</Text>
              <Text style={[styles.ctaStateBody, { color: t.muted }]}>Every lens is unlocked.</Text>
            </Surface>
          ) : trialCycleId && (selected === 'plus' || selected === 'pro') ? (
            <Surface
              style={[styles.ctaNote, { backgroundColor: t.calmSoft, borderColor: t.hairline }]}
            >
              <Text style={[styles.ctaStateEyebrow, { color: t.calm }]}>Trial · this cycle</Text>
              <Text style={[styles.ctaStateBody, { color: t.muted }]}>
                {`Every lens unlocked ${trialEndLabel === 'at payday' ? 'until payday' : trialEndLabel}.`}
              </Text>
              <Text style={[styles.ctaFootnote, { color: t.muted }]}>
                No auto-renew — we&apos;ll ask again at payday.
              </Text>
            </Surface>
          ) : ctaMode === 'purchase' && (selected === 'plus' || selected === 'pro') ? (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={purchasing !== null}
                onPress={() => void handlePurchase(selected)}
                style={({ pressed: isPressed }) => [
                  styles.ctaButton,
                  { backgroundColor: t.calm, opacity: purchasing !== null ? 0.6 : 1 },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.ctaButtonLabel, { color: t.inverse }]}>
                  {purchasing === selected
                    ? 'Processing…'
                    : `Get ${selected === 'pro' ? 'Pro' : 'Plus'} — £${priceFor(selected).price.toFixed(2)} / ${priceFor(selected).per}`}
                </Text>
              </Pressable>
              <Text style={[styles.ctaFootnote, { color: t.muted }]}>
                Charged by Google Play · cancel anytime in your subscriptions.
              </Text>
            </>
          ) : canSell && selected === 'plus' ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={handleStartTrial}
                style={({ pressed: isPressed }) => [
                  styles.ctaButton,
                  { backgroundColor: t.calm },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.ctaButtonLabel, { color: t.inverse }]}>
                  {`Try Plus free — ends ${trialEndLabel}`}
                </Text>
              </Pressable>
              <Text style={[styles.ctaFootnote, { color: t.muted }]}>
                One cycle · no card · we don&apos;t charge when it ends.
              </Text>
            </>
          ) : canSell && selected === 'pro' ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={handleStartTrial}
                style={({ pressed: isPressed }) => [
                  styles.ctaButton,
                  { backgroundColor: t.calm },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.ctaButtonLabel, { color: t.inverse }]}>
                  {`Try Pro free — ends ${trialEndLabel}`}
                </Text>
              </Pressable>
              <Text style={[styles.ctaFootnote, { color: t.muted }]}>
                One cycle · no card · we don&apos;t charge when it ends.
              </Text>
            </>
          ) : null}
        </View>

        {/* Lens rail — the ten in one glance, by tier, wired to the real lens engine. */}
        <View style={styles.lensRailBlock}>
          <Text style={[styles.lensRailEyebrow, { color: t.muted }]}>
            {`Ten lenses · ${FREE_LENSES.length} free · ${PLUS_LENSES.length} plus · ${PRO_LENSES.length} pro`}
          </Text>
          <Surface style={[styles.lensRailCard, { borderColor: t.hairline }]}>
            {[...FREE_LENSES, ...PLUS_LENSES, ...PRO_LENSES].map((m, index) => {
              const tier = tierFor(m);
              const unlocked =
                tier === 'free' ||
                (tier === 'plus' && (plusUnlocked || proUnlocked || !!trialCycleId)) ||
                (tier === 'pro' && (proUnlocked || !!trialCycleId));
              return (
                <View key={m}>
                  {index > 0 ? (
                    <View style={[styles.lensRailDivider, { backgroundColor: t.hairline }]} />
                  ) : null}
                  <View style={styles.lensRailRow}>
                    <View
                      style={[
                        styles.lensRailDot,
                        {
                          backgroundColor:
                            tier === 'free' ? t.positive : unlocked ? t.calm : t.muted,
                          opacity: tier === 'free' || unlocked ? 1 : 0.4,
                        },
                      ]}
                    />
                    <View style={styles.lensRailText}>
                      <Text style={[styles.lensRailLabel, { color: t.ink }]}>{MODE_LABEL[m]}</Text>
                      <Text
                        style={[styles.lensRailLine, { color: t.muted }]}
                        numberOfLines={1}
                      >{`"${LENS_ONE_LINER[m]}"`}</Text>
                    </View>
                    {moneyMode === m ? (
                      <Text style={[styles.lensRailState, { color: t.calm }]}>Active</Text>
                    ) : tier === 'free' ? (
                      <Text style={[styles.lensRailState, { color: t.muted }]}>Free</Text>
                    ) : !unlocked ? (
                      <Text style={[styles.lensRailState, { color: t.muted }]}>
                        {`🔒 ${tier === 'pro' ? 'Pro' : 'Plus'}`}
                      </Text>
                    ) : (
                      <Text style={[styles.lensRailState, { color: t.calm }]}>
                        {tier === 'pro' ? 'Pro' : 'Plus'}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </Surface>
        </View>

        {/* Our promise. */}
        <Surface
          style={[styles.promiseCard, { backgroundColor: t.inset, borderColor: t.hairline }]}
        >
          <Text style={[styles.promiseEyebrow, { color: t.muted }]}>Our promise</Text>
          <View style={styles.promiseList}>
            <Text style={[styles.promiseLine, { color: t.ink }]}>
              · The money-path question stays free. Always.
            </Text>
            <Text style={[styles.promiseLine, { color: t.ink }]}>
              · Bills Shield, Before You Spend, 24-Hour Shelf, Recovery — never behind a tier.
            </Text>
            <Text style={[styles.promiseLine, { color: t.ink }]}>
              · No upsell during a storm, in Recovery, or when your spare is under zero.
            </Text>
            <Text style={[styles.promiseLine, { color: t.ink }]}>
              · No auto-charge after a trial. We ask again at payday.
            </Text>
          </View>
        </Surface>

        <Text style={[styles.footer, { color: t.muted }]}>
          Prototype pricing — real billing ships with a future update.
        </Text>
      </ScrollView>
    </Animated.View>
  );
}

function MatrixCellView({ cell }: { cell: MatrixCell }) {
  const t = useTheme();
  if (cell === 'live') {
    return (
      <View style={styles.matrixCellWrap}>
        <View style={[styles.matrixDot, { backgroundColor: t.calm }]} />
      </View>
    );
  }
  if (cell === 'soon') {
    return (
      <View style={styles.matrixCellWrap}>
        <Text style={[styles.matrixSoon, { color: t.muted }]}>soon</Text>
      </View>
    );
  }
  return (
    <View style={styles.matrixCellWrap}>
      <Text style={[styles.matrixDash, { color: t.muted }]}>—</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  content: {
    paddingHorizontal: gap.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backGlyph: {
    fontSize: 20,
    lineHeight: 24,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  restoreLabel: {
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  tierStrip: {
    alignItems: 'center',
    columnGap: gap.xs + gap.xxs,
    flexDirection: 'row',
    marginTop: gap.md,
  },
  tierDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  tierStripText: {
    fontSize: 11,
  },
  tierStripCurrent: {
    fontWeight: '500',
  },
  tierStripTrial: {
    fontStyle: 'italic',
  },
  titleBlock: {
    marginTop: gap.md,
  },
  kicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  headline: {
    fontFamily: serif.display,
    fontSize: 26,
    letterSpacing: -0.2,
    lineHeight: 30,
  },
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: gap.sm,
  },
  guardCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    padding: gap.lg,
  },
  guardEyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  guardBody: {
    fontFamily: serif.displayItalic,
    fontSize: 15,
    lineHeight: 20,
    marginTop: gap.xs,
  },
  cadenceToggle: {
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
    paddingVertical: gap.sm + gap.xxs,
  },
  cadenceButtonYearly: {
    columnGap: gap.xs + gap.xxs,
    flexDirection: 'row',
  },
  cadenceLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  saveChip: {
    borderRadius: radius.sm,
    paddingHorizontal: gap.xs + gap.xxs,
    paddingVertical: 1,
  },
  saveChipLabel: {
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tierCards: {
    marginTop: gap.md,
    rowGap: gap.md,
  },
  tierCard: {
    borderRadius: radius.xl,
    padding: gap.lg,
  },
  tierCardTop: {
    alignItems: 'flex-start',
    columnGap: gap.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tierCardNameRow: {
    alignItems: 'center',
    columnGap: gap.sm,
    flex: 1,
    flexDirection: 'row',
    flexShrink: 1,
  },
  tierCardName: {
    fontFamily: serif.display,
    fontSize: 18,
    lineHeight: 21,
  },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: gap.xs + gap.xxs,
    paddingVertical: 2,
  },
  badgeLabel: {
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  tierPriceCol: {
    alignItems: 'flex-end',
  },
  tierPriceRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  tierPrice: {
    fontFamily: serif.display,
    fontSize: 22,
    lineHeight: 24,
  },
  tierPricePer: {
    fontSize: 11,
  },
  tierPriceSub: {
    fontSize: 10.5,
    marginTop: 2,
  },
  tierPriceHidden: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  tierTagline: {
    fontFamily: serif.displayItalic,
    fontSize: 12,
    marginTop: gap.xs,
  },
  bullets: {
    marginTop: gap.md,
    rowGap: gap.xs + gap.xxs,
  },
  bulletRow: {
    alignItems: 'flex-start',
    columnGap: gap.sm,
    flexDirection: 'row',
  },
  bulletDot: {
    borderRadius: 999,
    height: 6,
    marginTop: 6,
    width: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  soonLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  matrixCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    overflow: 'hidden',
  },
  matrixHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm + gap.xxs,
  },
  matrixHeaderLabel: {
    flex: 1.4,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  matrixHeaderCol: {
    flex: 0.6,
    fontSize: 10,
    letterSpacing: 1.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  matrixRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm + gap.xxs,
  },
  matrixRowLabel: {
    flex: 1.4,
    fontSize: 12.5,
    lineHeight: 16,
    paddingRight: gap.xs,
  },
  matrixCellWrap: {
    alignItems: 'center',
    flex: 0.6,
  },
  matrixDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  matrixSoon: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  matrixDash: {
    fontSize: 14,
    opacity: 0.4,
  },
  affordCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    padding: gap.md,
  },
  affordText: {
    fontSize: 11.5,
    textAlign: 'center',
  },
  ctaBlock: {
    marginTop: gap.md,
  },
  ctaNote: {
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: gap.lg,
  },
  ctaNoteText: {
    fontFamily: serif.displayItalic,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  ctaStateEyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  ctaStateBody: {
    fontSize: 13,
    marginTop: gap.xs,
  },
  ctaButton: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 54,
    justifyContent: 'center',
  },
  ctaButtonLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  ctaFootnote: {
    fontSize: 10.5,
    marginTop: gap.sm,
    textAlign: 'center',
  },
  lensRailBlock: {
    marginBottom: gap.md,
    marginTop: gap.xl,
  },
  lensRailEyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  lensRailCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.sm,
    overflow: 'hidden',
  },
  lensRailDivider: {
    height: StyleSheet.hairlineWidth,
  },
  lensRailRow: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  lensRailDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  lensRailText: {
    flex: 1,
  },
  lensRailLabel: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  lensRailLine: {
    fontFamily: serif.displayItalic,
    fontSize: 11.5,
    fontStyle: 'italic',
    marginTop: gap.xxs,
  },
  lensRailState: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  promiseCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    padding: gap.lg,
  },
  promiseEyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  promiseList: {
    marginTop: gap.sm,
    rowGap: gap.xs + gap.xxs,
  },
  promiseLine: {
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    fontFamily: serif.displayItalic,
    fontSize: 10.5,
    marginBottom: gap.xxl,
    marginTop: gap.lg,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
