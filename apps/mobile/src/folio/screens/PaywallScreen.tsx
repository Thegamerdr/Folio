// PaywallScreen — the faithful 1:1 React Native port of the web pricing surface
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPaywall.tsx).
//
// @rn-screen    PaywallScreen
// @rn-stack     More > Paywall
// @purpose      The real pricing surface. Three tiers (Free / Melo Plus / Melo Pro), a monthly/yearly
//               cadence toggle, a compare-at-a-glance matrix, and an honest "coming soon" state for
//               every paid action — see FIDELITY DECISIONS for why no purchase is actually offered
//               yet.
// @reads        currentBalance, pots (for a Safe Zone approximation — see FIDELITY DECISIONS)
// @writes       — none. No trial start, no purchase, no store mutation of any kind.
// @copy         FROZEN — ported verbatim from the web literals (no COPY_DECK entry exists yet for
//               this screen; the web JSX strings are the frozen source, same convention
//               MeloScreen/AccountScreen use for their own inline literals).
// @tokens       canvas · surface · inset · ink · calm (accent) · calmSoft · positive · caution ·
//               hairline · muted — all from the kit. Fraunces headlines · tabular money.
//
// FIDELITY DECISIONS — this screen is, per GAP_MAP.md's own note, "a real build not just a port":
//   • Lens/billing engine absent: the web reads `useLens()` (plusUnlocked/proUnlocked/trialCycleId/
//     startTrial/tierFor), `moneyMode`, and `melo.quietMode` from engines that do not exist anywhere
//     in this RN store (confirmed: no `lens`, `moneyMode`, or `melo` field in
//     apps/mobile/src/folio/store.ts). RN_PORT.md's loop discipline forbids inventing a new engine
//     silently ("must be added to ENGINES.md first"). This port therefore does NOT fabricate a lens
//     store, a trial mechanism, or a MoneyMode union — every tier/lens concept below is presentation
//     only, driven by LOCAL component state, never persisted, never mutating the real store.
//   // @rn-engine lens-tier (needs @/folio/lib/lens equivalent: plusUnlocked/proUnlocked/
//   // trialCycleId/startTrial + the ten-lens MoneyMode union + real billing — not wired here)
//   • Ten-lens rail: the web's `FREE_LENSES`/`PLUS_LENSES`/`PRO_LENSES` + `MODE_LABEL` come from the
//     unbuilt Money Mode/lens engine (GAP_MAP batch 2 — TodayMode/TodayStability/SheetLensPicker are
//     also still missing). This screen ports the STATIC tier-copy/matrix (which needs no live lens
//     state) but drops the live "ten lenses, N free/plus/pro, active now" rail, since it would have
//     to either read an engine that doesn't exist or fabricate one. Reported as a wiringNeeds
//     dependency rather than silently faked.
//   • canShowUpsell: the web guard (`@/lib/lens/paywall`) reads `weather` (from `deriveMeloState`,
//     also unbuilt in RN), `recoveryActive` (moneyMode === 'reset', unbuilt), and `melo.quietMode`
//     (unbuilt). None of those signals exist yet. The ONE real signal this port CAN read honestly is
//     the live Safe Zone approximation (`currentBalance.amount - sum(pot.saved)`), so `canSell` here
//     is a minimal, honestly-scoped port of just the "safe-zone-negative" branch of the real guard —
//     upsells are suppressed when the approximate Safe Zone is negative, and shown otherwise. This is
//     LESS conservative than the real five-signal guard (no weather/recovery/quiet-mode suppression),
//     which is why it's flagged here and in wiringNeeds rather than presented as the finished guard.
//   • Trial CTA: since there is no `startTrial()`/`lens.trialCycleId`, the Plus/Pro primary actions
//     never claim to grant access — both render an honest "coming soon" state (mirrors the web Pro
//     column's own "coming with the mobile app" pattern, extended to Plus too, since neither can
//     really unlock anything yet). No fake "Trial started" confirmation is ever shown.
//   • Restore: same honest-stub pattern as the web's restore handler, via Alert.alert (RN's
//     established toast-replacement convention — SubscriptionsScreen / MeloChatSheet / PrivacyScreen)
//     instead of sonner.
//   • "Notify me when Pro ships": the web persisted this via `localStorage`. RN has no such API; this
//     port keeps it as in-memory local state only (resets on remount) rather than inventing a
//     persistence seam for a placeholder feature.
//   • Accent word "your": web `<em class="not-italic text-accent">your</em>`. RN has no inline `<em>`,
//     so the headline is three Text runs and the accent run is a nested UPRIGHT terracotta span (the
//     StartScreen / MeloScreen / AccountScreen pattern).
//   • slide-in-r: translateX 28->0 + fade over 360ms ease-out-expo, gated to final state under
//     reduce-motion (MoreScreen / MeloScreen / AccountScreen precedent).
//   • STATES: populated-only per the SPEC convention (offline = populated; no async dependency). All
//     five branches are rendered for completeness.
//
// HONEST CLAIMS: no privacy/security assertion is made. No purchase is ever claimed to succeed. No
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
import type { Nav } from '@/folio/types';

export type PaywallScreenState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PaywallScreenProps = {
  nav: Nav;
  state?: PaywallScreenState;
};

type TierKey = 'free' | 'plus' | 'pro';
type Cadence = 'monthly' | 'yearly';

// Prototype prices — real billing ships once the lens/billing engine lands (see FIDELITY DECISIONS).
const PLUS_MONTHLY = 4.99;
const PLUS_YEARLY = 39.99;
const PRO_MONTHLY = 8.99;
const PRO_YEARLY = 69.99;

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
      { label: 'Growth, Reset, Optimizer, Planning lenses', live: false },
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
      { label: 'Irregular income · Debt / BNPL', live: false },
      { label: 'Low-visibility lens', live: false },
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
  { label: 'Growth · Optimizer · Planning', free: 'no', plus: 'soon', pro: 'soon' },
  { label: 'Bill shield · Calendar', free: 'no', plus: 'live', pro: 'live' },
  { label: 'Premium Fenice looks', free: 'no', plus: 'live', pro: 'live' },
  { label: 'Widgets · Leak detection', free: 'no', plus: 'soon', pro: 'soon' },
  { label: 'Low visibility lens', free: 'no', plus: 'no', pro: 'soon' },
  { label: 'Irregular income · runway', free: 'no', plus: 'no', pro: 'soon' },
  { label: 'Debt / BNPL payoff', free: 'no', plus: 'no', pro: 'soon' },
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

  const currentBalance = useAppStore((s) => s.currentBalance);
  const pots = useAppStore((s) => s.pots);

  const [cadence, setCadence] = useState<Cadence>('yearly');
  const [selected, setSelected] = useState<TierKey>('plus');
  const [proNotifyOn, setProNotifyOn] = useState(false);

  // Honest Safe Zone approximation — the one real signal available without the unbuilt lens/melo
  // engines (see FIDELITY DECISIONS canShowUpsell note).
  const safeZoneTotal = useMemo(
    () => currentBalance.amount - pots.reduce((sum, p) => sum + Math.max(0, p.saved), 0),
    [currentBalance, pots],
  );
  // Minimal, honestly-scoped guard: suppress only on a negative Safe Zone. The real five-signal guard
  // (weather/recovery/quiet-mode) cannot be ported until those engines exist.
  const canSell = safeZoneTotal >= 0;

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

  const handleComingSoon = (tierName: string) =>
    Alert.alert(
      `${tierName} — coming soon`,
      'Real billing ships once the plan engine lands. Nothing will be charged today.',
      [{ text: 'OK', style: 'cancel' }],
      { cancelable: true },
    );

  const handleProNotify = () => {
    setProNotifyOn(true);
    Alert.alert('On the list', "We'll let you know the moment Melo Pro ships.", [
      { text: 'OK', style: 'cancel' },
    ]);
  };

  const handleRestore = () =>
    Alert.alert(
      'No purchase found on this device',
      'This is the current build — real restore ships with the plan engine.',
      [{ text: 'OK', style: 'cancel' }],
      { cancelable: true },
    );

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

        {/* Current-tier strip — always Free (see FIDELITY DECISIONS lens-tier note). */}
        <View style={styles.tierStrip}>
          <View style={[styles.tierDot, { backgroundColor: t.positive }]} />
          <Text style={[styles.tierStripText, { color: t.muted }]}>
            {"You're on "}
            <Text style={[styles.tierStripCurrent, { color: t.ink }]}>Free</Text>
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

        {/* Honest paywall guard — never sell when the Safe Zone is negative. */}
        {!canSell ? (
          <Surface
            style={[styles.guardCard, { backgroundColor: t.inset, borderColor: t.hairline }]}
          >
            <Text style={[styles.guardEyebrow, { color: t.muted }]}>Not the right moment</Text>
            <Text style={[styles.guardBody, { color: t.ink }]}>
              Your spare is under zero. Don&apos;t subscribe this week.
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
            const isCurrent = tier === 'free';
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
            <Text style={[styles.matrixHeaderCol, { color: t.muted }]}>Free</Text>
            <Text style={[styles.matrixHeaderCol, { color: t.muted }]}>Plus</Text>
            <Text style={[styles.matrixHeaderCol, { color: t.muted }]}>Pro</Text>
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

        {/* Primary CTA. */}
        <View style={styles.ctaBlock}>
          {selected === 'free' ? (
            <Surface
              style={[styles.ctaNote, { backgroundColor: t.calmSoft, borderColor: t.hairline }]}
            >
              <Text style={[styles.ctaNoteText, { color: t.ink }]}>
                Free is always yours. Nothing to buy.
              </Text>
            </Surface>
          ) : canSell ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleComingSoon(TIER_COPY[selected].name)}
                style={({ pressed: isPressed }) => [
                  styles.ctaButton,
                  { backgroundColor: t.calm },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.ctaButtonLabel, { color: t.inverse }]}>
                  {`${TIER_COPY[selected].name} — coming soon`}
                </Text>
              </Pressable>
              {selected === 'pro' ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={proNotifyOn}
                  onPress={handleProNotify}
                  style={({ pressed: isPressed }) => [
                    styles.ctaSecondary,
                    { borderColor: t.hairline },
                    isPressed && !proNotifyOn ? styles.pressed : undefined,
                  ]}
                >
                  <Text
                    style={[styles.ctaSecondaryLabel, { color: proNotifyOn ? t.muted : t.ink }]}
                  >
                    {proNotifyOn ? 'On the list ✓' : 'Notify me when Pro ships'}
                  </Text>
                </Pressable>
              ) : null}
              <Text style={[styles.ctaFootnote, { color: t.muted }]}>
                Real billing ships once the plan engine lands. Nothing is charged today.
              </Text>
            </>
          ) : null}
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
              · No upsell when your spare is under zero.
            </Text>
            <Text style={[styles.promiseLine, { color: t.ink }]}>
              · No auto-charge, ever, without you choosing it.
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
  ctaSecondary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    marginTop: gap.sm,
  },
  ctaSecondaryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  ctaFootnote: {
    fontSize: 10.5,
    marginTop: gap.sm,
    textAlign: 'center',
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
