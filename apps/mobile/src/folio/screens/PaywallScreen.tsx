// PaywallScreen — the pricing surface, restructured 2026-07-10 to the Free/Full/Live money model
// (MONEY_MODEL.md §2b). This SUPERSEDES the web port's Free/Plus/Pro subscription shape — the web
// screen (folio-melo ScreenPaywall.tsx) still shows the old model; this screen is now the source
// of truth for pricing until the web catches up.
//
// @rn-screen    PaywallScreen
// @rn-stack     More > Paywall
// @purpose      Three doors: FREE (safety + fit-free lenses, always), FULL (one-time purchase —
//               every lens and all software, yours forever), LIVE (small monthly sub — the only
//               recurring price, attached to recurring bank/sync infrastructure when it ships).
//               Compare matrix, ten-lens rail, and a REAL
//               one-cycle trial CTA for Full — wired to the actual lens/entitlement engine.
// @reads        moneyMode, lens (via useLens(): fullUnlocked/trialCycleId/trialEndedCycleId/
//               trialDaysLeft/tierFor), currentBalance, pots, subs, subPaused, onboarding,
//               melo.quietMode, incomeSources.
// @writes       startTrial() (Full trial CTA) · setLensFullUnlocked + saveEntitlement (real
//               purchase/restore paths, only reachable once billing is live).
// @tokens       canvas · surface · inset · ink · calm (accent) · calmSoft · positive · caution ·
//               hairline · muted — all from the kit. Fraunces headlines · tabular money.
//
// MODEL RULES this screen enforces (MONEY_MODEL.md, owner-confirmed 2026-07-06):
//   • Free is never quality-degraded — it includes the fit-free lenses (money-shape lenses:
//     Survival, Stability, Debt, Irregular, Reset, Low-visibility) and the full safety layer.
//     Depth/planning lenses (Growth, Optimizer, Planning, Household) are the Full unlock.
//   • Full is ONE-TIME. Software has zero marginal cost, so it never rents. No cadence applies.
//   • Live is the only subscription, priced at the recurring bank/sync infrastructure it covers.
//     The cadence toggle applies to Live alone.
//   • canShowUpsell guard (weather/recovery/safe-zone/quiet-mode) — never sell on a bad money
//     moment. Unchanged from the prior build; all five suppression reasons render.
//   • One-cycle trial (payday-anchored, 21-day floor, one ever) unlocks the Full lenses; it never
//     grants Live — Live meters a real recurring cost, there is nothing to trial offline.
//   • Legacy Plus/Pro purchasers grandfather into Full (lens.ts/entitlements.ts own that rule).
//
// HONEST CLAIMS: prices are prototype numbers until the Play listing exists (footer says so). The
// trial CTA really starts a trial; the guard really suppresses selling; purchase/restore only
// render once probeAvailability() proves the store is reachable. Every row/button ≥44px.

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
import { setLensFullUnlocked } from '@/folio/store';
import { useLens, trialEndIsoFor, FREE_LENSES, FULL_LENSES } from '@/folio/lib/lens';
import { canShowUpsell, upsellSuppressionReason } from '@/folio/lib/lensPaywall';
import { deriveModeState, MODE_LABEL, type MoneyMode } from '@/folio/lib/modes';
import { safeZoneMath } from '@/folio/lib/modes/safeZone';
import { useRoute } from '@/folio/lib/storeRoute';
import {
  probeAvailability,
  productIdFor,
  purchase,
  finishPurchase,
  restore as restorePurchases,
  type BillingCadence,
} from '@/folio/lib/billing/iap';
import { loadActiveEntitlement, saveVerifiedEntitlement } from '@/folio/lib/billing/entitlements';
import { verifyGooglePurchase } from '@/folio/lib/billing/billingVerification';
import { resolveCtaMode } from '@/folio/lib/billing/ctaMode';
import { showToast } from '@/folio/ui/Toast';
import type { Nav } from '@/folio/types';

export type PaywallScreenState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PaywallScreenProps = {
  nav: Nav;
  state?: PaywallScreenState;
};

type TierKey = 'free' | 'full' | 'live';
type Cadence = 'monthly' | 'yearly';

// Prices — OWNER-CONFIRMED 2026-07-11 ("do all" sign-off; MONEY_MODEL.md §7.3 closed). Full is
// one-time (software never rents); Live is the only recurring price. The cadence toggle applies
// to Live alone.
const FULL_ONE_TIME = 29.99;
const LIVE_MONTHLY = 2.99;
const LIVE_YEARLY = 24.99;

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

// Tier copy — Free/Full/Live doors (MONEY_MODEL.md §2b). `live: false` renders a "soon" tag, so
// every flag is a truth claim about TODAY's build:
//   • The six fit-free lenses + safety layer are shipped → live.
//   • The four Full lenses (Growth/Optimizer/Planning/Household strategies) are shipped → live.
//   • Statement and photo reading is on-device and does not become a metered quality tier.
//   • Wardrobe gating, widgets, briefings, bank sync and encrypted sync are not built → soon.
const TIER_COPY: Record<
  TierKey,
  { name: string; tagline: string; bullets: { label: string; live: boolean }[] }
> = {
  free: {
    name: 'Free',
    tagline: 'The safety layer. Always.',
    bullets: [
      { label: 'Will my money last to payday?', live: true },
      { label: 'Six money-shape lenses — Survival to Low-vis', live: true },
      { label: 'Safe Zone · Recovery · Bill shield · Calendar', live: true },
      { label: 'On-device statement and photo reading', live: true },
    ],
  },
  full: {
    name: 'Melo Full',
    tagline: 'Every lens. One payment. Yours for good.',
    bullets: [
      { label: 'Everything in Free', live: true },
      { label: 'Growth, Optimizer, Planning, Household lenses', live: true },
      { label: 'Local history, scenarios and exports', live: true },
      { label: "'What changed' briefing", live: false },
      { label: 'Widgets · Leak detection', live: false },
      // D6 (owner "do all", 2026-07-11): wardrobe is EARNED-ONLY (the blueprint's unbuyable
      // treatment) — earned things are never for sale, so it left the paywall entirely.
    ],
  },
  live: {
    name: 'Melo Live',
    tagline: 'The always-on lane — pay only while you use it.',
    bullets: [
      { label: 'Live bank sync', live: false },
      { label: 'Encrypted backup and multi-device sync', live: false },
      { label: 'Cancel any month — the app keeps working', live: true },
    ],
  },
};

type MatrixCell = 'live' | 'soon' | 'no';
const MATRIX: readonly { label: string; free: MatrixCell; full: MatrixCell; live: MatrixCell }[] = [
  { label: 'Will my money last to payday?', free: 'live', full: 'live', live: 'live' },
  { label: 'Safe Zone · Recovery · Reset', free: 'live', full: 'live', live: 'live' },
  { label: 'Six money-shape lenses', free: 'live', full: 'live', live: 'live' },
  { label: 'Growth · Optimizer · Planning · Household', free: 'no', full: 'live', live: 'no' },
  { label: 'Bill shield · Calendar', free: 'live', full: 'live', live: 'live' },
  { label: 'On-device statement reading', free: 'live', full: 'live', live: 'live' },
  { label: 'Live bank sync', free: 'no', full: 'no', live: 'soon' },
  { label: 'Encrypted backup · device sync', free: 'no', full: 'no', live: 'soon' },
  { label: "'What changed' briefing", free: 'no', full: 'soon', live: 'no' },
  { label: 'Widgets · Leak detection', free: 'no', full: 'soon', live: 'no' },
  { label: 'Money Time Machine', free: 'no', full: 'soon', live: 'no' },
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

  const { fullUnlocked, trialCycleId, trialEndedCycleId, trialDaysLeft, startTrial, tierFor } =
    useLens();

  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [selected, setSelected] = useState<TierKey>('full');

  // Live subscription state — read from the entitlement record (the lens store never carries
  // Live; it gates AI quantity, not lenses). False until a real store purchase writes it.
  const [liveActive, setLiveActive] = useState(false);
  useEffect(() => {
    let mounted = true;
    void loadActiveEntitlement('live').then((record) => {
      if (mounted && record?.tier === 'live') setLiveActive(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

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

  // Canonical Safe Zone total (balance − Bills Shield − buffer) — was a home-rolled
  // balance-minus-pots figure that ignored shielded bills and the user's buffer, so it read
  // more generous than the real Safe Zone and could let the never-sell-in-a-bad-moment guard
  // (canShowUpsell) allow an upsell exactly when the real Safe Zone was ≤ 0 (plan 107 Step 3).
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
    [currentBalance, onboarding, pots, subs, subPaused, route],
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
    fullUnlocked,
    liveActive,
    trialCycleId,
    trialEndedCycleId,
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

  // The PROSPECTIVE end date for a trial started right now — used by the start-trial CTA and its
  // toast, where `trialDaysLeft` is still null in this render's closure (the trial hasn't been
  // written yet). Computed from the SAME `trialEndIsoFor` the relock enforces, so what the button
  // promises is the day access actually ends — the old 'at payday' fallback misstated the lock
  // date whenever the 21-day floor pushed the end past the next payday.
  const incomeSources = useAppStore((s) => s.incomeSources);
  const prospectiveTrialEndLabel = useMemo(() => {
    const startIso = new Date().toISOString().slice(0, 10); // same anchor form startTrial writes.
    const endIso = trialEndIsoFor(startIso, incomeSources ?? [], onboarding.payday || 25);
    const end = new Date(`${endIso}T00:00:00`);
    if (Number.isNaN(end.getTime())) return 'when the cycle ends';
    return end.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }, [incomeSources, onboarding.payday]);

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
    if (tier === 'full') return { price: FULL_ONE_TIME, per: 'one-time' };
    return cadence === 'yearly'
      ? { price: LIVE_YEARLY, per: 'year', perMonth: LIVE_YEARLY / 12, strike: LIVE_MONTHLY }
      : { price: LIVE_MONTHLY, per: 'month' };
  };

  const handleStartTrial = () => {
    if (!canSell) return;
    startTrial();
    // Truth pass (2026-07-10): "Auto-locks at payday" was false while `endLensTrial` had no
    // callers, and stays imprecise now that the relock enforces the countdown's own end date
    // (payday-anchored with a 21-day floor — a weekly earner locks ~4 cycles out, not next
    // payday). The toast now points at the countdown it actually enforces.
    showToast(
      'Trial started · one cycle',
      `Every paid lens unlocked until ${prospectiveTrialEndLabel}. Locks itself then — nothing renews.`,
    );
    nav.back();
  };

  // Real purchase — only reachable when billingAvailable is true (a Play listing exists and our
  // SKUs resolved). Full writes the real lens unlock (what useLens()/every upsell surface reads);
  // Live only writes the entitlement record — it gates AI quantity, never lenses. Both write the
  // record so the billing layer always knows where an entitlement came from.
  const handlePurchase = async (tier: 'full' | 'live') => {
    if (!canSell || purchasing) return;
    setPurchasing(tier);
    try {
      const productId = productIdFor(tier, cadence as BillingCadence);
      const outcome = await purchase(productId);
      if (outcome.status === 'purchased') {
        const verification = await verifyGooglePurchase(outcome.purchase);
        if (verification.status !== 'verified') {
          const title =
            verification.status === 'pending'
              ? 'Purchase pending'
              : verification.status === 'unavailable'
                ? 'Purchase needs verification'
                : 'Purchase not confirmed';
          const message =
            verification.status === 'pending'
              ? 'Google Play is still processing it. Melo will not unlock or finish the purchase until Play confirms it.'
              : verification.message;
          Alert.alert(title, message, [{ text: 'OK', style: 'cancel' }]);
          return;
        }
        const persisted = await saveVerifiedEntitlement(verification.grant);
        if (persisted === null) {
          Alert.alert(
            'Purchase needs verification',
            'Melo verified the purchase but could not safely save its signed entitlement. Try Restore purchases shortly.',
            [{ text: 'OK', style: 'cancel' }],
          );
          return;
        }
        const resolvedTier = verification.entitlement.tier;
        if (resolvedTier === 'full') setLensFullUnlocked(true);
        else setLiveActive(true);
        // The Worker already attempts acknowledgement; finishing here is the replay-safe client
        // fallback, and only happens after provider verification + signed local persistence.
        await finishPurchase(outcome.purchase);
        Alert.alert(
          resolvedTier === 'live' ? 'Melo Live is on' : 'Melo Full is yours',
          resolvedTier === 'live'
            ? 'Unlimited reads while it runs — cancel any month.'
            : 'Every lens unlocked. One payment — nothing renews.',
          [{ text: 'OK', style: 'cancel' }],
        );
        nav.back();
      } else if (outcome.status === 'pending') {
        Alert.alert(
          'Purchase pending',
          'Google Play is still processing it. Melo will unlock only after Play confirms the payment.',
          [{ text: 'OK', style: 'cancel' }],
        );
      } else if (outcome.status === 'failed') {
        Alert.alert('Purchase failed', outcome.message, [{ text: 'OK', style: 'cancel' }]);
      }
      // 'cancelled' — silent, matches the platform's own cancel UX (no extra alert on top of it).
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    if (!billingAvailable) {
      // No store to query. Report what this device already holds, honestly.
      if (fullUnlocked || liveActive) {
        const owned =
          fullUnlocked && liveActive ? 'Full + Live are' : fullUnlocked ? 'Full is' : 'Live is';
        Alert.alert(`Melo ${owned} active on this device`, undefined, [
          { text: 'OK', style: 'cancel' },
        ]);
        return;
      }
      Alert.alert(
        'No purchase found on this device',
        'This is the current build — real restore ships with a future update.',
        [{ text: 'OK', style: 'cancel' }],
      );
      return;
    }
    const restored = await restorePurchases();
    if (restored.length === 0) {
      Alert.alert('No purchase found on this device', undefined, [{ text: 'OK', style: 'cancel' }]);
      return;
    }
    const tiers = new Set<'full' | 'live'>();
    let pending = false;
    let unavailableMessage: string | null = null;
    for (const restoredPurchase of restored) {
      const verification = await verifyGooglePurchase(restoredPurchase);
      if (verification.status === 'pending') {
        pending = true;
        continue;
      }
      if (verification.status !== 'verified') {
        if (verification.status === 'unavailable') unavailableMessage = verification.message;
        continue;
      }
      const persisted = await saveVerifiedEntitlement(verification.grant);
      if (persisted === null) {
        unavailableMessage = 'Melo could not safely save the signed store entitlement.';
        continue;
      }
      tiers.add(verification.entitlement.tier);
      await finishPurchase(restoredPurchase);
    }
    if (tiers.size === 0) {
      Alert.alert(
        pending
          ? 'Purchase pending'
          : unavailableMessage
            ? 'Restore needs verification'
            : 'No active purchase found',
        pending
          ? 'Google Play is still processing this purchase.'
          : (unavailableMessage ?? 'Google Play did not confirm an active Melo purchase.'),
        [{ text: 'OK', style: 'cancel' }],
      );
      return;
    }
    if (tiers.has('full')) setLensFullUnlocked(true);
    if (tiers.has('live')) setLiveActive(true);
    const label =
      tiers.has('full') && tiers.has('live')
        ? 'Melo Full + Live restored'
        : tiers.has('live')
          ? 'Melo Live restored'
          : 'Melo Full restored';
    Alert.alert(label, undefined, [{ text: 'OK', style: 'cancel' }]);
  };

  // Ownership per door — Full and Live are independent (not a ladder), so "current" is per-tier.
  const ownsTier = (tier: TierKey): boolean =>
    tier === 'full' ? fullUnlocked : tier === 'live' ? liveActive : !fullUnlocked && !liveActive;
  const currentPlanLabel =
    fullUnlocked && liveActive
      ? 'Melo Full + Live'
      : fullUnlocked
        ? 'Melo Full'
        : liveActive
          ? 'Melo Live'
          : 'Free';

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
        {/* Header — back glyph · "Melo plans" eyebrow · Restore. */}
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
          <Text style={[styles.eyebrow, { color: t.muted }]}>Melo plans</Text>
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
              { backgroundColor: fullUnlocked || liveActive ? t.calm : t.positive },
            ]}
          />
          <Text style={[styles.tierStripText, { color: t.muted }]}>
            {"You're on "}
            <Text style={[styles.tierStripCurrent, { color: t.ink }]}>{currentPlanLabel}</Text>
            {trialCycleId && !fullUnlocked ? (
              <Text style={styles.tierStripTrial}>{` · trial · ends ${trialEndLabel}`}</Text>
            ) : null}
          </Text>
        </View>

        {/* Title block. */}
        <View style={styles.titleBlock}>
          <Text style={[styles.kicker, { color: t.muted }]}>Pick what fits</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'Look at your money '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>your</Text>
            {' way.'}
          </Text>
          <Text style={[styles.intro, { color: t.muted }]}>
            Melo always answers &quot;will my money last to payday?&quot; for free. Full unlocks
            every lens with one payment — yours for good. Live is the optional subscription for
            automatic bank refresh and encrypted sync when those services launch.
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

        {/* Cadence toggle — applies to Live alone (Full is one-time; Free has no price). Only
            rendered while the Live door is selected so it can't read as renting Full. */}
        {selected === 'live' ? (
          <View
            style={[styles.cadenceToggle, { backgroundColor: t.inset, borderColor: t.hairline }]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => setCadence('monthly')}
              style={[
                styles.cadenceButton,
                { backgroundColor: cadence === 'monthly' ? t.surface : 'transparent' },
              ]}
            >
              <Text
                style={[styles.cadenceLabel, { color: cadence === 'monthly' ? t.ink : t.muted }]}
              >
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
              <Text
                style={[styles.cadenceLabel, { color: cadence === 'yearly' ? t.ink : t.muted }]}
              >
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
                  save ~30%
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        {/* Tier cards. */}
        <View style={styles.tierCards}>
          {(['free', 'full', 'live'] as TierKey[]).map((tier) => {
            const tc = TIER_COPY[tier];
            const p = priceFor(tier);
            const isSelected = selected === tier;
            const isCurrent = ownsTier(tier);
            const isRecommended = tier === 'full';
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
                          <Text style={[styles.tierPricePer, { color: t.muted }]}>
                            {p.per === 'one-time' ? ' one-time' : ` / ${p.per}`}
                          </Text>
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
            {(['free', 'full', 'live'] as TierKey[]).map((tk) => (
              <Text
                key={tk}
                style={[styles.matrixHeaderCol, { color: ownsTier(tk) ? t.calm : t.muted }]}
              >
                {tk === 'free' ? 'Free' : tk === 'full' ? 'Full' : 'Live'}
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
              <MatrixCellView cell={row.full} />
              <MatrixCellView cell={row.live} />
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

        {/* Primary CTA — one switch on the tested, pure `ctaMode` (lib/billing/ctaMode.ts).
            `ctaMode` is computed above from the exact same inputs this render reads, so the
            tested precedence IS what renders — there is no second hand-maintained copy of the
            branch order to drift out of lockstep with it. Every string/behavior below is
            unchanged from the prior inline-condition version; this is a pure de-duplication. */}
        <View style={styles.ctaBlock}>
          {ctaMode === 'free-note' ? (
            <Surface
              style={[styles.ctaNote, { backgroundColor: t.calmSoft, borderColor: t.hairline }]}
            >
              <Text style={[styles.ctaNoteText, { color: t.ink }]}>
                Free is always yours. Nothing to buy.
              </Text>
            </Surface>
          ) : ctaMode === 'unlocked' ? (
            <Surface
              style={[styles.ctaNote, { backgroundColor: t.calmSoft, borderColor: t.hairline }]}
            >
              <Text style={[styles.ctaStateEyebrow, { color: t.positive }]}>
                {selected === 'live' ? 'Live is on' : 'Full is yours'}
              </Text>
              <Text style={[styles.ctaStateBody, { color: t.muted }]}>
                {selected === 'live'
                  ? 'Unlimited reads while it runs.'
                  : 'Every lens is unlocked — for good.'}
              </Text>
            </Surface>
          ) : ctaMode === 'trial-active' ? (
            <Surface
              style={[styles.ctaNote, { backgroundColor: t.calmSoft, borderColor: t.hairline }]}
            >
              <Text style={[styles.ctaStateEyebrow, { color: t.calm }]}>Trial · this cycle</Text>
              <Text style={[styles.ctaStateBody, { color: t.muted }]}>
                {`Every lens unlocked ${trialEndLabel === 'at payday' ? 'until payday' : trialEndLabel}.`}
              </Text>
              <Text style={[styles.ctaFootnote, { color: t.muted }]}>
                No auto-renew — we&apos;ll ask when the trial ends.
              </Text>
            </Surface>
          ) : ctaMode === 'purchase' ? (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={purchasing !== null}
                onPress={() => void handlePurchase(selected as 'full' | 'live')}
                style={({ pressed: isPressed }) => [
                  styles.ctaButton,
                  { backgroundColor: t.calm, opacity: purchasing !== null ? 0.6 : 1 },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.ctaButtonLabel, { color: t.inverse }]}>
                  {purchasing === selected
                    ? 'Processing…'
                    : selected === 'full'
                      ? `Get Full — £${priceFor('full').price.toFixed(2)} one-time`
                      : `Get Live — £${priceFor('live').price.toFixed(2)} / ${priceFor('live').per}`}
                </Text>
              </Pressable>
              <Text style={[styles.ctaFootnote, { color: t.muted }]}>
                {selected === 'full'
                  ? 'Charged once by Google Play. Nothing renews.'
                  : 'Charged by Google Play · cancel anytime in your subscriptions.'}
              </Text>
            </>
          ) : ctaMode === 'trial' ? (
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
                  {`Try Full free — ends ${prospectiveTrialEndLabel}`}
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
            {`Ten lenses · ${FREE_LENSES.length} free · ${FULL_LENSES.length} in Full`}
          </Text>
          <Surface style={[styles.lensRailCard, { borderColor: t.hairline }]}>
            {[...FREE_LENSES, ...FULL_LENSES].map((m, index) => {
              const tier = tierFor(m);
              const unlocked = tier === 'free' || fullUnlocked || !!trialCycleId;
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
                      <Text style={[styles.lensRailState, { color: t.muted }]}>🔒 Full</Text>
                    ) : (
                      <Text style={[styles.lensRailState, { color: t.calm }]}>Full</Text>
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
              · No auto-charge after a trial. It simply locks when it ends.
            </Text>
          </View>
        </Surface>

        <Text style={[styles.footer, { color: t.muted }]}>
          Want both? A Full + Live bundle arrives with real billing.{'\n'}Real billing ships with a
          future update.
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
