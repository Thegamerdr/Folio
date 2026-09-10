// Alternate Plans route: preserve its narrative and destinations while every financial
// amount, obligation and date uses the canonical plan shared by Today, Plan and Calendar.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { elevation, gap, radius, serif, useTheme, type Palette } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { ScreenHeader } from '@/folio/ui/ScreenHeader';
import { useAppStore } from '@/folio/store';
import { useDayClock } from '@/folio/lib/useDayClock';
import { formatMoney as formatGBP, formatFinancialDate } from '@/folio/lib/financialPresentation';
import { FinancialSetupNotice } from '@/folio/ui/FinancialSetupNotice';
import { buildPlansScreenPresentation } from './plansScreenModel';
import type { Nav } from '@/folio/types';

// ---------------------------------------------------------------------------
// Money — the web <Money> primitive: a tabular Fraunces figure. Only the sizes /
// tones this screen uses are mapped (sm/lg · negative/ink) — faithful to the web.
// ---------------------------------------------------------------------------
const MONEY_SIZE = { sm: 15, lg: 28 } as const;

function Money({
  value,
  size,
  tone = 'ink',
  t,
}: {
  value: string;
  size: 'sm' | 'lg';
  tone?: 'ink' | 'negative';
  t: Palette;
}) {
  const color = tone === 'negative' ? t.repair : t.ink;
  return (
    <Text style={[styles.money, { fontSize: MONEY_SIZE[size], color }]} numberOfLines={1}>
      {value}
    </Text>
  );
}

// The render states this screen can occupy (spec stateBranches). The list is derived from the store +
// the pure engines, so the only real transient is the one-frame mount-gate (before `now` is set),
// which shows the loading branch: Melo curious + a line, never a spinner. Error shows an inline retry;
// offline ≡ populated (local-first, no network language).
export type PlansState = 'populated' | 'empty' | 'loading' | 'error' | 'offline';

export type PlansScreenProps = {
  nav: Nav;
  /** Force a render state (defaults to deriving from the live upcoming list). Exposed for the shell +
   *  tests, mirroring PotsScreen. */
  state?: PlansState;
};

// slide-in-r geometry (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms,
// on the editorial ease-out-expo. Mirrors PotsScreen / ReviewScreen / Melo.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Parse a derived event's ISO day ("YYYY-MM-DD") into its split date parts ("12" / "Jul"). The
// engine works in ISO/UTC; we read the calendar parts straight off the string so the displayed day
// matches the engine's day exactly (no local-tz drift from re-parsing through a Date).
function splitIsoDay(iso: string): { day: string; month: string } {
  const [, m = '', d = ''] = iso.split('-');
  const monthIdx = Number(m) - 1;
  return { day: String(Number(d)), month: MONTH_SHORT[monthIdx] ?? '' };
}

// Local reduce-motion read, mirroring PotsScreen / ReviewScreen / Melo: read once, then subscribe.
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

export function PlansScreen({ nav, state }: PlansScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const appState = useAppStore((st) => st);
  const { subs, subPaused, pots } = appState;
  const debts = appState.debts ?? [];
  const now = useDayClock();
  const model = useMemo(
    () => (now ? buildPlansScreenPresentation(appState, now) : null),
    [appState, now],
  );
  const financialPlan = model?.plan ?? null;
  const presentation = model?.presentation;
  const upcoming = model?.upcoming ?? [];
  const total = (model?.totalMinor ?? 0) / 100;
  const payday = model?.paydayLabel ?? 'Next payday · Not set';
  const tightDate = model?.tightPoint?.date ?? null;
  const tightSpare = model?.tightPoint ? model.tightPoint.amountMinor / 100 : null;
  const daysToPayday = model?.daysToPayday ?? null;
  const potsSaved = pots.reduce((sum, pot) => sum + pot.saved, 0);
  const liveSubs = subs.filter((sub) => !subPaused[sub.name]);
  const [showAdd, setShowAdd] = useState(false);

  const resolvedState: PlansState = state ?? (now === null ? 'loading' : 'populated');

  // slide-in-r — drives the whole screen. Resolves straight to final state under reduce-motion.
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

  // ── LOADING ────────────────────────────────────────────────────────────────────────────────────
  // The list is synchronous, so this is defensive only. Melo curious + a line, NEVER a spinner.
  if (resolvedState === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxxl }]}
      >
        <MeloLine mood="curious" text="One second — looking at what's coming." />
      </View>
    );
  }

  // ── EMPTY ──────────────────────────────────────────────────────────────────────────────────────
  // Nothing spoken for before payday → the header + title frame + EmptyState ("No plans yet", calm).
  // STATES.md mandates this; the prototype never rendered it.
  if (
    resolvedState === 'empty' &&
    presentation?.complete &&
    financialPlan?.nextIncomeDate &&
    upcoming.length === 0
  ) {
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <View style={[styles.frame, { paddingTop: insets.top + gap.sm }]}>
          <ScreenHeader onBack={nav.back} eyebrow="PLAN" eyebrowWeight="600" backHitWidth={24} />
          <View style={styles.intro}>
            <Text style={[styles.eyebrowItalic, { color: t.muted }]}>
              Your money between now and
            </Text>
            <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
              {'the '}
              <Text style={[styles.headingAccent, { color: t.calm }]}>next payday.</Text>
            </Text>
          </View>
          <View style={styles.emptyWrap}>
            <EmptyState
              mood="calm"
              headline="No plans yet"
              body={model?.emptyMessage ?? 'Review your numbers before relying on this forecast.'}
              cta={{ label: '+ Add a bill', onPress: () => nav.go('add-bill') }}
            />
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────────────────────────
  // The list reads from local state, so a failure is rare; STATES.md asks for an inline retry rather
  // than a dead end. Calm Melo line + a single "Try again" that re-routes through the shell.
  if (resolvedState === 'error') {
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <View style={[styles.frame, { paddingTop: insets.top + gap.sm }]}>
          <ScreenHeader onBack={nav.back} eyebrow="PLAN" eyebrowWeight="600" backHitWidth={24} />
          <View style={styles.errorWrap}>
            <MeloLine mood="concern" text="Couldn't bring up what's coming just now." />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try again"
              onPress={() => nav.go('plans')}
              style={({ pressed: isPressed }) => [
                styles.retry,
                { backgroundColor: t.calm },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.retryLabel, { color: t.inverse }]}>Try again</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── POPULATED / OFFLINE ─────────────────────────────────────────────────────────────────────────
  // offline ≡ populated (local-first; renders identically, no network language). The composition
  // follows the pinned Plan Hub: one dominant answer, then a timeline, then quieter destinations.
  const tightTone = presentation?.canReassure ? 'calm' : 'concern';
  const tightMessage =
    tightDate && tightSpare !== null
      ? `Lowest projected account balance: ${formatGBP(tightSpare)} on ${formatFinancialDate(tightDate)}, before the next income. This balance is before your protected buffer.`
      : 'Add your numbers to see the projected account balance.';
  const meloText = presentation?.canReassure
    ? 'These are your recorded commitments. Review a date to see what is still unpaid.'
    : (presentation?.message ?? 'Add or confirm your numbers to see the plan.');

  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.sm, paddingBottom: insets.bottom + gap.huge },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader onBack={nav.back} eyebrow="PLAN" eyebrowWeight="600" backHitWidth={24} />

        <View style={styles.intro}>
          <Text style={[styles.eyebrowItalic, { color: t.muted }]}>Your money between now and</Text>
          <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
            {'the '}
            <Text style={[styles.headingAccent, { color: t.calm }]}>next payday.</Text>
          </Text>
          <Text style={[styles.narrative, { color: t.muted }]}>
            What is still to leave, where it gets tight, and what you can change before it does.
          </Text>
        </View>

        {!presentation?.complete || !financialPlan?.nextIncomeDate ? (
          <FinancialSetupNotice
            state={appState}
            plan={financialPlan}
            onSetup={() => nav.openSheet('onboarding')}
          />
        ) : (
          <View style={[styles.dominant, { backgroundColor: t.surface, borderColor: t.hairline }]}>
            <Text style={[styles.smallLabel, { color: t.muted }]}>Reserved commitments</Text>
            <Money value={formatGBP(total)} size="lg" tone="negative" t={t} />
            <Text style={[styles.dominantCaption, { color: t.muted }]}>
              {upcoming.length === 0
                ? model?.emptyMessage
                : `${upcoming.length} recorded commitment${upcoming.length === 1 ? '' : 's'} before ${formatFinancialDate(financialPlan?.nextIncomeDate)}. Includes unpaid bills and money set aside.`}
            </Text>
            {presentation.overdueCount > 0 ? (
              <Text style={[styles.dominantCaption, { color: t.repair }]}>
                {presentation.overdueCount} overdue ·{' '}
                {formatGBP(
                  presentation.overdue.reduce((sum, item) => sum + item.amountMinor, 0) / 100,
                )}{' '}
                still reserved
              </Text>
            ) : null}
            <Text style={[styles.dominantCaption, { color: t.muted }]}>
              {presentation.canReassure ? 'Safe to spend until payday' : 'After recorded costs'}:{' '}
              {formatGBP(financialPlan.safeToSpendMinor / 100)}
            </Text>
            <Text style={[styles.dominantCaption, { color: t.muted }]}>
              After bills, everyday essentials, debt minimums and your buffer. {daysToPayday} days
              until {formatFinancialDate(financialPlan.nextIncomeDate)}.
            </Text>
            {!presentation.canReassure ? (
              <Text style={[styles.dominantCaption, { color: t.repair }]}>
                {presentation.message}
              </Text>
            ) : null}
            <View style={styles.dominantActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See what's coming"
                onPress={() => nav.go('calendar')}
                style={({ pressed: isPressed }) => [
                  styles.primaryCta,
                  styles.dominantPrimary,
                  { backgroundColor: t.calm },
                  elevation.cta,
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.primaryCtaLabel, { color: t.inverse }]}>
                  See what's coming
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try a change"
                onPress={() => nav.go('whatif')}
                style={({ pressed: isPressed }) => [
                  styles.quietAction,
                  { borderColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.secondaryCtaLabel, { color: t.muted }]}>Try a change</Text>
              </Pressable>
            </View>
          </View>
        )}

        {presentation?.complete && financialPlan?.nextIncomeDate ? (
          <View
            style={[
              styles.pressureNote,
              { borderTopColor: t.hairline, borderBottomColor: t.hairline },
            ]}
          >
            <View
              style={[
                styles.pressureDot,
                { backgroundColor: tightTone === 'concern' ? t.repair : t.calm },
              ]}
            />
            <Text style={[styles.pressureText, { color: t.muted }]}>{tightMessage}</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionEyebrow, { color: t.muted }]}>What's coming</Text>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>The next few dates</Text>
          </View>
          <Text style={[styles.sectionMeta, { color: t.muted }]}>{payday}</Text>
        </View>

        <View
          style={[styles.timeline, { borderTopColor: t.hairline, borderBottomColor: t.hairline }]}
        >
          {upcoming.length === 0 ? (
            <Text style={[styles.timelineEmpty, { color: t.muted }]}>
              {model?.emptyMessage ?? 'Add your numbers to see upcoming commitments.'}
            </Text>
          ) : null}
          {upcoming.slice(0, 4).map((u, i) => (
            <Pressable
              key={u.id}
              accessibilityRole="button"
              accessibilityLabel={`${u.name}, ${formatGBP(u.amount)}, ${formatFinancialDate(u.date)}, ${u.note}`}
              accessibilityHint="Opens this date in Calendar."
              onPress={() => nav.openSheet('day-detail', { date: u.date })}
              style={({ pressed: isPressed }) => [
                styles.timelineRow,
                i > 0 ? { borderTopWidth: 1, borderTopColor: t.hairline } : undefined,
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <View style={styles.dateCol}>
                <Text style={[styles.dateMonth, { color: t.muted }]}>
                  {splitIsoDay(u.date).month}
                </Text>
                <Text style={[styles.dateDay, { color: t.ink }]}>{splitIsoDay(u.date).day}</Text>
              </View>
              <View
                style={[
                  styles.kindBar,
                  {
                    backgroundColor: u.id.startsWith('debt-minimum:') ? t.caution : t.repair,
                    opacity: u.id.startsWith('debt-minimum:') ? 1 : 0.6,
                  },
                ]}
              />
              <View style={styles.rowBody}>
                <Text style={[styles.rowName, { color: t.ink }]}>{u.name}</Text>
                <Text
                  style={[
                    styles.rowNote,
                    { color: u.date < (financialPlan?.asOf ?? u.date) ? t.repair : t.muted },
                  ]}
                >
                  {u.note} · {formatFinancialDate(u.date)}
                </Text>
                <Money value={formatGBP(-u.amount)} size="sm" t={t} />
              </View>
            </Pressable>
          ))}
          {upcoming.length > 4 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all upcoming dates"
              onPress={() => nav.go('calendar')}
              style={({ pressed: isPressed }) => [
                styles.moreTimeline,
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.moreTimelineLabel, { color: t.calm }]}>
                See all {upcoming.length} dates →
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.statsSection}>
          <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Set aside</Text>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Held back on purpose</Text>
          <View style={[styles.statLine, { borderBottomColor: t.hairline }]}>
            <View>
              <Text style={[styles.statLabel, { color: t.ink }]}>In pots</Text>
              <Text style={[styles.statCaption, { color: t.muted }]}>
                {pots.length ? `${pots.length} pot${pots.length === 1 ? '' : 's'}` : 'no pots yet'}
              </Text>
            </View>
            <Text style={[styles.statValue, { color: t.ink }]}>{formatGBP(potsSaved)}</Text>
          </View>
          <View style={[styles.statLine, { borderBottomColor: t.hairline }]}>
            <View>
              <Text style={[styles.statLabel, { color: t.ink }]}>Active recurring bills</Text>
              <Text style={[styles.statCaption, { color: t.muted }]}>
                {liveSubs.length ? 'recorded recurring schedules' : 'none active'}
              </Text>
            </View>
            <Text style={[styles.statValue, { color: t.ink }]}>{liveSubs.length}</Text>
          </View>
          <View style={[styles.statLine, { borderBottomColor: t.hairline }]}>
            <View>
              <Text style={[styles.statLabel, { color: t.ink }]}>Debts tracked</Text>
              <Text style={[styles.statCaption, { color: t.muted }]}>
                {debts.some((debt) => debt.balance > 0)
                  ? 'active balances and minimums'
                  : debts.length
                    ? 'cleared records kept'
                    : 'nothing tracked yet'}
              </Text>
            </View>
            <Text style={[styles.statValue, { color: t.ink }]}>{debts.length}</Text>
          </View>
        </View>

        <View style={styles.destinations}>
          <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Go deeper</Text>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Places that shape the path</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('debts')}
            style={({ pressed: isPressed }) => [
              styles.destinationRow,
              { borderBottomColor: t.hairline },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <View>
              <Text style={[styles.destinationLabel, { color: t.ink }]}>Debts</Text>
              <Text style={[styles.destinationMeta, { color: t.muted }]}>
                Balances, minimums and payment history
              </Text>
            </View>
            <Text style={[styles.destinationArrow, { color: t.muted }]}>→</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('calendar')}
            style={({ pressed: isPressed }) => [
              styles.destinationRow,
              { borderBottomColor: t.hairline },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <View>
              <Text style={[styles.destinationLabel, { color: t.ink }]}>Calendar</Text>
              <Text style={[styles.destinationMeta, { color: t.muted }]}>
                the dates that matter
              </Text>
            </View>
            <Text style={[styles.destinationArrow, { color: t.muted }]}>→</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('subs')}
            style={({ pressed: isPressed }) => [
              styles.destinationRow,
              { borderBottomColor: t.hairline },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <View>
              <Text style={[styles.destinationLabel, { color: t.ink }]}>Bills and commitments</Text>
              <Text style={[styles.destinationMeta, { color: t.muted }]}>
                {liveSubs.length} active
              </Text>
            </View>
            <Text style={[styles.destinationArrow, { color: t.muted }]}>→</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('pots')}
            style={({ pressed: isPressed }) => [
              styles.destinationRow,
              { borderBottomColor: t.hairline },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <View>
              <Text style={[styles.destinationLabel, { color: t.ink }]}>Pots</Text>
              <Text style={[styles.destinationMeta, { color: t.muted }]}>
                {pots.length ? `${pots.length} earmarked` : 'no pots yet'}
              </Text>
            </View>
            <Text style={[styles.destinationArrow, { color: t.muted }]}>→</Text>
          </Pressable>
        </View>

        <View style={[styles.addSection, { borderTopColor: t.hairline }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showAdd }}
            onPress={() => setShowAdd((visible) => !visible)}
            style={({ pressed: isPressed }) => [
              styles.addDisclosure,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <View>
              <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Add</Text>
              <Text style={[styles.destinationLabel, { color: t.ink }]}>
                Put something in the plan
              </Text>
            </View>
            <Text style={[styles.destinationArrow, { color: t.muted }]}>{showAdd ? '−' : '+'}</Text>
          </Pressable>
          {showAdd ? (
            <View style={styles.addChoices}>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.go('add-bill')}
                style={({ pressed: isPressed }) => [
                  styles.choiceRow,
                  { borderBottomColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.choiceLabel, { color: t.ink }]}>Add a bill</Text>
                <Text style={[styles.destinationArrow, { color: t.muted }]}>→</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.openSheet('declare-debt')}
                style={({ pressed: isPressed }) => [
                  styles.choiceRow,
                  { borderBottomColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.choiceLabel, { color: t.ink }]}>Add a debt</Text>
                <Text style={[styles.destinationArrow, { color: t.muted }]}>→</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.openSheet('add-event')}
                style={({ pressed: isPressed }) => [
                  styles.choiceRow,
                  { borderBottomColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.choiceLabel, { color: t.ink }]}>Add a date</Text>
                <Text style={[styles.destinationArrow, { color: t.muted }]}>→</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.meloBlock}>
          <MeloLine mood={tightTone} text={meloText} />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // The empty / error frame — px-7 (gap.xl) full-height column.
  frame: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // px-7 ≈ screen inset → gap.xl. flexGrow:1 lets short content sit and tall content scroll.
  content: {
    flexGrow: 1,
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },

  // Intro frame — mt-5 (gap.lg).
  intro: {
    marginTop: gap.lg,
  },
  // Fraunces italic eyebrow, 13px muted.
  eyebrowItalic: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces display line, 28px, tight, mt-0 (the eyebrow already spaces it).
  heading: {
    fontFamily: serif.display,
    fontSize: 28,
    lineHeight: 32,
  },
  // The accent word stays UPRIGHT terracotta (web em.not-italic).
  headingAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  narrative: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: gap.sm,
    maxWidth: 340,
  },

  dominant: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    marginTop: gap.lg,
    padding: gap.lg,
    ...elevation.card,
  },
  dominantCaption: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: gap.xs,
  },
  dominantActions: {
    flexDirection: 'column',
    gap: gap.sm,
    marginTop: gap.lg,
  },
  quietAction: {
    alignItems: 'center',
    borderRadius: radius.xxl,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: 'center',
  },
  dominantPrimary: {
    paddingHorizontal: gap.sm,
  },
  pressureNote: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: gap.sm,
    marginTop: gap.xl,
    paddingVertical: gap.md,
  },
  pressureDot: {
    borderRadius: radius.pill,
    height: 7,
    width: 7,
  },
  pressureText: {
    flex: 1,
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    alignItems: 'flex-start',
    gap: gap.sm,
    marginTop: gap.xl,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: serif.display,
    fontSize: 20,
    lineHeight: 25,
    marginTop: 2,
  },
  sectionMeta: {
    fontFamily: serif.displayItalic,
    fontSize: 12,
    marginBottom: 3,
    textAlign: 'left',
  },
  timeline: {
    borderBottomWidth: 1,
    borderTopWidth: 1,
    marginTop: gap.md,
  },
  timelineRow: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
    minHeight: 72,
    paddingVertical: gap.md,
  },
  moreTimeline: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  moreTimelineLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  timelineEmpty: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: gap.lg,
  },
  statsSection: {
    marginTop: gap.xl,
  },
  statLine: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statCaption: {
    fontSize: 11.5,
    marginTop: 1,
  },
  statValue: {
    fontFamily: serif.display,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
  destinations: {
    marginTop: gap.xl,
  },
  destinationRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingVertical: gap.sm,
  },
  destinationLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  destinationMeta: {
    fontSize: 11.5,
    marginTop: 2,
  },
  destinationArrow: {
    fontSize: 18,
    fontWeight: '400',
  },
  addSection: {
    borderTopWidth: 1,
    marginTop: gap.xl,
    paddingTop: gap.md,
  },
  addDisclosure: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
  },
  addChoices: {
    marginTop: gap.xs,
  },
  choiceRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  choiceLabel: {
    fontSize: 13.5,
  },

  emptyWrap: {
    flex: 1,
    marginTop: gap.xl,
  },
  errorWrap: {
    flex: 1,
    gap: gap.xl,
    justifyContent: 'center',
  },
  retry: {
    alignItems: 'center',
    borderRadius: radius.xl,
    minHeight: 52,
    justifyContent: 'center',
  },
  retryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Set-aside / next-payday card — surface, 1px hairline, 2xl radius, p-5, baseline-spread, mt-5.
  summaryCard: {
    alignItems: 'baseline',
    borderRadius: radius.xxl,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.lg,
    padding: gap.lg,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  // 11px uppercase tracked muted (web tracking-[0.12em]@11px ≈ 1.3px).
  smallLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  // Fraunces 15px, mt-0.5 — the dated payday marker.
  paydayValue: {
    fontFamily: serif.display,
    fontSize: 15,
    marginTop: 2,
  },

  // The upcoming list card — surface, 1px hairline, 2xl radius, mt-5. Rows carry their own dividers.
  listCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    marginTop: gap.lg,
    overflow: 'hidden',
  },
  // Row — px-5 py-3.5, centred, gap-3.
  row: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
    paddingHorizontal: gap.lg,
    paddingVertical: 14,
  },
  // Date column — 44px wide, centred (month eyebrow over a tabular day).
  dateCol: {
    alignItems: 'center',
    width: 44,
  },
  // 10px uppercase tracked muted (web tracking-[0.12em]@10px ≈ 1.2px).
  dateMonth: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  // Fraunces 18px tabular, tight — the day number.
  dateDay: {
    fontFamily: serif.display,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
  },
  // Kind bar — w-1.5 h-8 rounded-full.
  kindBar: {
    borderRadius: radius.pill,
    height: 32,
    width: 6,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '500',
  },
  rowNote: {
    fontSize: 11.5,
    marginTop: 1,
  },

  // Money primitive — Fraunces, tabular, medium.
  money: {
    fontFamily: serif.display,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },

  // CTAs — mt-5.
  ctaBlock: {
    marginTop: gap.lg,
  },
  // Primary "+ Add a bill" — full width, h-[52px], 2xl radius, terracotta, the accent-tinted lift.
  primaryCta: {
    alignItems: 'center',
    borderRadius: radius.xxl,
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryCtaLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  // Secondary "or add a debt" — quiet full-width link, h-[42px], mt-2.
  secondaryCta: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    marginTop: gap.sm,
  },
  secondaryCtaLabel: {
    fontSize: 13,
  },

  // The closing Melo line — mt-5 mb-8.
  meloBlock: {
    marginBottom: gap.xxl,
    marginTop: gap.lg,
  },

  // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
