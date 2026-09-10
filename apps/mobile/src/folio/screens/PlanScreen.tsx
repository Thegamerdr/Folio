// Exact native presentation owner for the pinned Lovable Plan tab root:
// private-money-pilot@ad90b4fee36c58be156e145e8663d8c6be1bf0eb
// src/components/folio/screens/ScreenPlanHub.tsx.
//
// This is deliberately separate from pinned ScreenPlans / native PlansScreen. ScreenPlanHub owns
// MainTabs > Plan and is a financial narrative, not a directory: editorial lead, one dominant card,
// a ruled tight-point note, four real derived movements, set-aside facts, quiet destinations and one
// closed command disclosure. The route/calendar engines remain native authorities; no product number
// is copied from a screenshot or from Lovable's browser store.
//
// @rn-screen    PlanScreen
// @rn-stack     MainTabs > Plan
// @reads        subs · subPaused · subOverrides · onboarding · pots · debts · calendarEvents ·
//               currentBalance (through useRoute + deriveCalendarEvents)
// @writes       — (navigation only)
// @opens-sheet  add-event · onboarding (three source sheets still require shared native registration)
// @motion       press 0.97 only; ScreenPlanHub has no route-entry animation.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { elevation, gap, radius, serif, useTheme, weightFamily, type Palette } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { useAppStore } from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import { selectPaydayTightPoint, tightPointDayLabel } from '@/folio/lib/moneyPath';
import { useDayClock } from '@/folio/lib/useDayClock';
import type { Nav } from '@/folio/types';
import { buildCanonicalPlanUpcoming, shortPlanDay } from './planModel';
import { buildFinancialPlanFromState } from '@/folio/lib/financialPlan';
import {
  selectFinancialPresentation,
  formatMoney as formatGBP,
} from '@/folio/lib/financialPresentation';
import { FinancialSetupNotice } from '@/folio/ui/FinancialSetupNotice';

// ---------------------------------------------------------------------------
// formatGBP — the web's exact pure function (folio kit). Signed, Intl en-GB, no
// fraction digits, U+2212 MINUS SIGN (not a hyphen) so tabular figures align and
// the glyph matches the web byte-for-byte. Reproduced locally rather than using
// the kit's money() (which emits a hyphen-minus).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Money — the web <Money> primitive: a tabular Fraunces figure. Only the sizes /
// tones this screen uses are mapped (sm/lg · negative/ink) — faithful to the web.
// ---------------------------------------------------------------------------
const MONEY_SIZE = { sm: 16, lg: 36 } as const;

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
  const match = /^([−-]?)(£)(.*)$/u.exec(value);
  const fontSize = MONEY_SIZE[size];
  return (
    <Text
      style={[
        styles.money,
        { fontSize: MONEY_SIZE[size], lineHeight: size === 'lg' ? 40 : 24, color },
      ]}
      numberOfLines={1}
    >
      {match ? (
        <>
          {match[1]}
          <Text style={{ fontSize: fontSize * 0.62 }}>{match[2]}</Text>
          {match[3]}
        </>
      ) : (
        value
      )}
    </Text>
  );
}

// The render states this screen can occupy (spec stateBranches). The list is derived from the store +
// the pure engines, so the only real transient is the one-frame mount-gate (before `now` is set),
// which shows the loading branch: Melo curious + a line, never a spinner. Error shows an inline retry;
// offline ≡ populated (local-first, no network language).
export type PlansState = 'populated' | 'empty' | 'loading' | 'error' | 'offline';

export type PlanScreenProps = {
  nav: Nav;
  /** Force a render state (defaults to deriving from the live upcoming list). Exposed for the shell +
   *  tests, mirroring PotsScreen. */
  state?: PlansState;
};

// A stable sentinel "now" for the one render before the mount-gate opens. `useRoute` can't be called
// conditionally, so it runs against this until `now` is set; the result is discarded (`route = null`)
// that frame. Module-level so its identity never churns the hook's memo. Mirrors TodayScreen.
const EPOCH = new Date(0);

function ChevronGlyph({
  direction = 'right',
  color,
}: {
  direction?: 'right' | 'up' | 'down';
  color: string;
}) {
  const path =
    direction === 'right' ? 'M6 3l5 5-5 5' : direction === 'up' ? 'M3 10l5-5 5 5' : 'M3 6l5 5 5-5';
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      <Path
        d={path}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
      />
    </Svg>
  );
}

export function PlanScreen({ nav, state }: PlanScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const stackDominantActions = width < 380;

  // Supporting facts alongside the canonical plan. The route reads its own store inputs.
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const onboarding = useAppStore((st) => st.onboarding);
  const pots = useAppStore((st) => st.pots);
  const debts = useAppStore((st) => st.debts ?? []);
  const appState = useAppStore((st) => st);

  // Mount-gate the clock (mirrors TodayScreen): defer `new Date()` to an effect so nothing reads the
  // wall clock during the first render. Until it opens, the screen holds the loading branch.
  const now = useDayClock();

  // Keep the mounted route current; the list and headline share the canonical financial plan below.
  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;
  const financialPlan = useMemo(
    () => (now ? buildFinancialPlanFromState(appState, { now }) : null),
    [appState, now],
  );

  const upcoming = useMemo(() => buildCanonicalPlanUpcoming(financialPlan), [financialPlan]);
  const financePresentation = selectFinancialPresentation(appState, financialPlan);
  const total = useMemo(() => upcoming.reduce((sum, u) => sum + u.amount, 0), [upcoming]);
  const planTightPoint = useMemo(() => (route ? selectPaydayTightPoint(route) : null), [route]);
  const tightDate = planTightPoint?.date ?? null;
  const tightSpare = planTightPoint?.amount ?? null;
  const daysToPayday = financialPlan?.nextIncomeDate
    ? Math.round(
        (Date.parse(financialPlan.nextIncomeDate) - Date.parse(financialPlan.asOf)) / 86_400_000,
      )
    : null;
  const potsSaved = useMemo(() => pots.reduce((sum, pot) => sum + pot.saved, 0), [pots]);
  const liveSubs = useMemo(() => subs.filter((sub) => !subPaused[sub.name]), [subs, subPaused]);
  const showSampleMarker = !onboarding.done;
  const [showAdd, setShowAdd] = useState(false);

  const resolvedState: PlansState = state ?? (now === null ? 'loading' : 'populated');

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
  if (resolvedState === 'empty') {
    return (
      <View style={[styles.root, { backgroundColor: t.canvas }]}>
        <View style={[styles.frame, { paddingTop: insets.top + gap.sm }]}>
          <View style={styles.intro}>
            <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Plan</Text>
            <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
              {'Between now and '}
              <Text style={[styles.headingAccent, { color: t.calm }]}>payday.</Text>
            </Text>
            <Text style={[styles.narrative, { color: t.muted }]}>
              What is still to leave, where it gets tight, and what you can change before it does.
            </Text>
          </View>
          <View style={styles.emptyWrap}>
            <EmptyState
              mood="calm"
              headline="No plans yet"
              body="Nothing's due before payday. Add a bill or a debt to see it here."
              cta={{ label: '+ Add a bill', onPress: () => nav.go('add-bill') }}
            />
          </View>
        </View>
      </View>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────────────────────────
  // The list reads from local state, so a failure is rare; STATES.md asks for an inline retry rather
  // than a dead end. Calm Melo line + a single "Try again" that re-routes through the shell.
  if (resolvedState === 'error') {
    return (
      <View style={[styles.root, { backgroundColor: t.canvas }]}>
        <View style={[styles.frame, { paddingTop: insets.top + gap.sm }]}>
          <View style={styles.errorWrap}>
            <MeloLine mood="concern" text="Couldn't bring up what's coming just now." />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try again"
              onPress={() => nav.go('plan')}
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
      </View>
    );
  }

  // ── POPULATED / OFFLINE ─────────────────────────────────────────────────────────────────────────
  // offline ≡ populated (local-first; renders identically, no network language). The composition
  // follows the pinned Plan Hub: one dominant answer, then a timeline, then quieter destinations.
  const tightMessage =
    tightDate && tightSpare !== null && now
      ? `Your lowest point before payday is ${formatGBP(tightSpare)} · ${tightPointDayLabel(tightDate, now)}.`
      : 'The path is still quiet. Add a commitment when there is something real to protect.';

  const destinations = [
    { label: 'Calendar', meta: 'the dates that matter', onPress: () => nav.go('calendar') },
    {
      label: 'Bills & commitments',
      meta: `${liveSubs.length} tracked`,
      onPress: () => nav.go('subs'),
    },
    {
      label: 'Debts',
      meta: debts.length ? `${debts.length} tracked` : 'nothing tracked yet',
      onPress: () => nav.go('debts'),
    },
    {
      label: 'Pots',
      meta: pots.length ? `${pots.length} pots` : 'no pots yet',
      value: formatGBP(potsSaved),
      onPress: () => nav.go('pots'),
    },
    {
      label: 'Payday and income',
      meta: 'change when and how money lands',
      onPress: () => nav.openSheet('onboarding'),
    },
    { label: 'Recovery', meta: 'something has to move', onPress: () => nav.go('recovery') },
    {
      label: 'Path visualiser',
      meta: 'the day-by-day working',
      onPress: () => nav.go('visualizer'),
    },
  ];

  const addChoices = [
    {
      label: 'Add a bill',
      meta: 'a regular cost at any cadence',
      onPress: () => nav.go('add-bill'),
    },
    {
      label: 'Add a debt',
      meta: 'balance, rate, payoff',
      onPress: () => nav.openSheet('declare-debt'),
    },
    { label: 'Add a date', meta: 'a one-off in or out', onPress: () => nav.openSheet('add-event') },
    {
      label: 'Review regular costs',
      meta: 'still worth it? three choices',
      onPress: () => nav.go('subs'),
    },
    {
      label: 'Log a transfer',
      meta: 'between your own accounts',
      onPress: () => nav.openSheet('transfer'),
    },
    {
      label: 'Pair a refund',
      meta: 'link the money in to the earlier spend',
      onPress: () => nav.openSheet('refund'),
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <View style={[styles.viewportSafeArea, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: gap.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {showSampleMarker ? (
            <View style={styles.sampleMarker}>
              <View style={[styles.sampleDot, { backgroundColor: t.caution }]} />
              <Text style={[styles.sampleText, { color: t.muted }]}>Add your money</Text>
            </View>
          ) : null}

          <View style={styles.intro}>
            <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Plan</Text>
            <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
              {'Between now and '}
              <Text style={[styles.headingAccent, { color: t.calm }]}>payday.</Text>
            </Text>
            <Text style={[styles.narrative, { color: t.muted }]}>
              What is still to leave, where it gets tight, and what you can change before it does.
            </Text>
          </View>

          {!financePresentation.complete || !financialPlan?.nextIncomeDate ? (
            <FinancialSetupNotice
              state={appState}
              plan={financialPlan}
              onSetup={() => nav.openSheet('onboarding')}
            />
          ) : (
            <View
              style={[styles.dominant, { backgroundColor: t.surface, borderColor: t.hairline }]}
            >
              <Text style={[styles.smallLabel, { color: t.muted }]}>
                {upcoming.length} thing{upcoming.length === 1 ? '' : 's'} still to leave
              </Text>
              <View style={styles.figureAmount}>
                <Money value={formatGBP(total)} size="lg" t={t} />
              </View>
              {financePresentation.overdueCount > 0 ? (
                <Text style={[styles.narrative, { color: t.repairInk }]}>
                  {financePresentation.overdueCount} overdue ·{' '}
                  {formatGBP(
                    financePresentation.overdue.reduce((sum, item) => sum + item.amountMinor, 0) /
                      100,
                  )}{' '}
                  still reserved
                </Text>
              ) : null}
              <Text style={[styles.dominantCaption, { color: t.muted }]}>
                {daysToPayday === null
                  ? 'within this forecast, including unpaid bills'
                  : `over the ${daysToPayday} day${daysToPayday === 1 ? '' : 's'} to payday, including unpaid bills`}
              </Text>
              {financialPlan ? (
                <View style={[styles.safePlan, { borderTopColor: t.hairline }]}>
                  <View>
                    <Text style={[styles.smallLabel, { color: t.muted }]}>
                      {financePresentation.canReassure ? 'Safe to spend' : 'After recorded costs'}
                    </Text>
                    <Text style={[styles.safeCaption, { color: t.muted }]}>
                      after bills, essentials and buffer
                    </Text>
                  </View>
                  <Money
                    value={formatGBP(financialPlan.safeToSpendMinor / 100)}
                    size="sm"
                    tone={financialPlan.safeToSpendMinor < 0 ? 'negative' : 'ink'}
                    t={t}
                  />
                </View>
              ) : null}
              <View
                style={[
                  styles.dominantActions,
                  stackDominantActions ? styles.dominantActionsStack : undefined,
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="See what's coming"
                  onPress={() => nav.go('calendar')}
                  style={({ pressed: isPressed }) => [
                    styles.secondaryButton,
                    { backgroundColor: t.surface, borderColor: t.hairline },
                    isPressed ? styles.pressed : undefined,
                  ]}
                >
                  <Text style={[styles.buttonLabel, { color: t.ink }]} numberOfLines={1}>
                    See what's coming
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Try a change"
                  onPress={() => nav.go('whatif')}
                  style={({ pressed: isPressed }) => [
                    styles.quietAction,
                    isPressed ? styles.pressed : undefined,
                  ]}
                >
                  <Text style={[styles.buttonLabel, { color: t.calmStrong }]} numberOfLines={1}>
                    Try a change
                  </Text>
                </Pressable>
              </View>
              {!financePresentation.canReassure && (
                <Text style={[styles.narrative, { color: t.repairInk }]}>
                  {financePresentation.message}
                </Text>
              )}
            </View>
          )}

          {financePresentation.complete && financialPlan?.nextIncomeDate && (
            <View
              style={[
                styles.pressureNote,
                { borderLeftColor: tightSpare !== null && tightSpare < 0 ? t.repair : t.caution },
              ]}
            >
              <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Tight point</Text>
              <Text style={[styles.pressureText, { color: t.ink }]}>{tightMessage}</Text>
            </View>
          )}

          <View style={[styles.chapterDivider, { backgroundColor: t.hairline }]} />

          <View style={styles.section}>
            <Text style={[styles.sectionEyebrow, { color: t.muted }]}>What's coming</Text>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>The next few dates</Text>
            <View style={styles.timelineList}>
              {upcoming.length === 0 ? (
                <Text style={[styles.timelineEmpty, { color: t.muted }]}>
                  {daysToPayday === null
                    ? 'No unpaid bills or debt minimums are recorded within this forecast.'
                    : 'No unpaid bills or debt minimums are recorded before payday.'}
                </Text>
              ) : null}
              {upcoming.slice(0, 4).map((u, i) => (
                <Pressable
                  key={u.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${u.name}, ${formatGBP(u.amount)}, ${shortPlanDay(u.date)}, ${u.note}`}
                  accessibilityHint="Opens Calendar."
                  onPress={() => nav.openSheet('day-detail', { date: u.date })}
                  style={({ pressed: isPressed }) => [
                    styles.timelineRow,
                    i > 0 ? { borderTopWidth: 1, borderTopColor: t.hairline } : undefined,
                    isPressed ? styles.pressed : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.timelineWhen,
                      { color: u.date === tightDate ? t.calm : t.muted },
                    ]}
                  >
                    {shortPlanDay(u.date)}
                  </Text>
                  <View
                    style={[
                      styles.timelineDot,
                      { backgroundColor: u.date === tightDate ? t.calm : t.muted },
                    ]}
                  />
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowName, { color: t.ink }]} numberOfLines={1}>
                      {u.name}
                    </Text>
                    <Text style={[styles.rowNote, { color: t.muted }]} numberOfLines={1}>
                      {u.note || 'spoken for'}
                    </Text>
                  </View>
                  <Money value={formatGBP(u.amount)} size="sm" tone="negative" t={t} />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Set aside</Text>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>Held back on purpose</Text>
            <View style={styles.sectionChildren}>
              <View style={styles.statLine}>
                <View>
                  <Text style={[styles.statLabel, { color: t.ink }]}>In pots</Text>
                  <Text style={[styles.statCaption, { color: t.muted }]}>
                    {pots.length
                      ? `${pots.length} pot${pots.length === 1 ? '' : 's'}`
                      : 'no pots yet'}
                  </Text>
                </View>
                <Text style={[styles.statValue, { color: t.ink }]}>{formatGBP(potsSaved)}</Text>
              </View>
              <View style={styles.statLine}>
                <View>
                  <Text style={[styles.statLabel, { color: t.ink }]}>Subscriptions running</Text>
                  <Text style={[styles.statCaption, { color: t.muted }]}>
                    {liveSubs.length ? 'renewing on their own' : 'none active'}
                  </Text>
                </View>
                <Text style={[styles.statValue, { color: t.ink }]}>{liveSubs.length}</Text>
              </View>
              {debts.length ? (
                <View style={styles.statLine}>
                  <View>
                    <Text style={[styles.statLabel, { color: t.ink }]}>Debts tracked</Text>
                    <Text style={[styles.statCaption, { color: t.muted }]}>
                      repayments already in the path
                    </Text>
                  </View>
                  <Text style={[styles.statValue, { color: t.ink }]}>{debts.length}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.destinations}>
            <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Go deeper</Text>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>Places that shape the path</Text>
            <View style={styles.navList}>
              {destinations.map((item, index) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  onPress={item.onPress}
                  style={({ pressed: isPressed }) => [
                    styles.destinationRow,
                    index > 0 ? { borderTopWidth: 1, borderTopColor: t.hairline } : undefined,
                    isPressed ? styles.pressed : undefined,
                  ]}
                >
                  <View style={styles.rowBody}>
                    <Text style={[styles.destinationLabel, { color: t.ink }]}>{item.label}</Text>
                    <Text style={[styles.destinationMeta, { color: t.muted }]} numberOfLines={1}>
                      {item.meta}
                    </Text>
                  </View>
                  {'value' in item && item.value ? (
                    <Text style={[styles.destinationValue, { color: t.muted }]}>{item.value}</Text>
                  ) : null}
                  <ChevronGlyph color={t.muted} />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.addSection}>
            <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Add</Text>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>Put something in the plan</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showAdd }}
              onPress={() => setShowAdd((visible) => !visible)}
              style={({ pressed: isPressed }) => [
                styles.addDisclosure,
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <View style={styles.rowBody}>
                <Text style={[styles.disclosureLabel, { color: t.ink }]}>Add something</Text>
                <Text style={[styles.destinationMeta, { color: t.muted }]} numberOfLines={1}>
                  bills, debts, dates, transfers and refunds
                </Text>
              </View>
              <ChevronGlyph direction={showAdd ? 'up' : 'down'} color={t.muted} />
            </Pressable>
            {showAdd ? (
              <View style={styles.addChoices}>
                {addChoices.map((choice, index) => (
                  <Pressable
                    key={choice.label}
                    accessibilityRole="button"
                    onPress={choice.onPress}
                    style={({ pressed: isPressed }) => [
                      styles.choiceRow,
                      index > 0 ? { borderTopWidth: 1, borderTopColor: t.hairline } : undefined,
                      isPressed ? styles.pressed : undefined,
                    ]}
                  >
                    <View style={styles.rowBody}>
                      <Text style={[styles.choiceLabel, { color: t.ink }]}>{choice.label}</Text>
                      <Text style={[styles.destinationMeta, { color: t.muted }]} numberOfLines={1}>
                        {choice.meta}
                      </Text>
                    </View>
                    <ChevronGlyph color={t.muted} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Text style={[styles.addTruth, { color: t.muted }]}>
              Nothing lands in your plan until you say so.
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  viewportSafeArea: {
    flex: 1,
  },
  frame: {
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  loading: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sampleMarker: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    minHeight: 16,
  },
  sampleDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  sampleText: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.54,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  intro: {
    marginTop: 20,
  },
  eyebrowItalic: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  heading: {
    fontFamily: serif.display,
    fontSize: 28,
    letterSpacing: -0.56,
    lineHeight: 32,
    marginTop: 8,
  },
  headingAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  narrative: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 21.7,
    marginTop: 8,
  },
  dominant: {
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 16,
    padding: 24,
    ...elevation.card,
  },
  smallLabel: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.54,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  figureAmount: {
    marginTop: 4,
  },
  dominantCaption: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 4,
  },
  safePlan: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
  },
  safeCaption: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  dominantActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  dominantActionsStack: {
    flexDirection: 'column',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 45.375,
    paddingHorizontal: 16,
    flexShrink: 1,
  },
  quietAction: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 45.375,
    paddingHorizontal: 16,
    flexShrink: 1,
  },
  buttonLabel: {
    fontFamily: weightFamily(500),
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressureNote: {
    borderLeftWidth: 2,
    marginTop: 24,
    paddingLeft: 12,
  },
  pressureText: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 22,
    marginTop: 4,
  },
  chapterDivider: {
    height: 1,
    marginTop: 32,
  },
  section: {
    marginTop: 32,
  },
  sectionEyebrow: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.54,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: weightFamily(500),
    fontSize: 16,
    lineHeight: 24,
    marginTop: 4,
  },
  sectionChildren: {
    marginTop: 12,
  },
  timelineList: {
    marginTop: 24,
  },
  timelineRow: {
    alignItems: 'center',
    columnGap: 12,
    flexDirection: 'row',
    minHeight: 44,
    paddingVertical: 10,
  },
  timelineWhen: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    lineHeight: 19,
    width: 62,
  },
  timelineDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  timelineEmpty: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 22,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 22,
  },
  rowNote: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 2,
  },
  statLine: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statLabel: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 22,
  },
  statCaption: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 2,
  },
  statValue: {
    fontFamily: weightFamily(500),
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    lineHeight: 25,
  },
  destinations: {
    marginTop: 48,
  },
  navList: {
    marginTop: 12,
  },
  destinationRow: {
    alignItems: 'center',
    columnGap: 12,
    flexDirection: 'row',
    minHeight: 44,
    paddingVertical: 10,
  },
  destinationLabel: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 22,
  },
  destinationMeta: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 2,
  },
  destinationValue: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    lineHeight: 19,
  },
  addSection: {
    marginTop: 48,
  },
  addDisclosure: {
    alignItems: 'center',
    columnGap: 12,
    flexDirection: 'row',
    marginTop: 24,
    minHeight: 44,
    paddingVertical: 8,
  },
  disclosureLabel: {
    fontFamily: weightFamily(500),
    fontSize: 14,
    lineHeight: 22,
  },
  addChoices: {
    marginTop: 4,
  },
  choiceRow: {
    alignItems: 'center',
    columnGap: 12,
    flexDirection: 'row',
    minHeight: 44,
    paddingVertical: 10,
  },
  choiceLabel: {
    fontFamily: weightFamily(400),
    fontSize: 14,
    lineHeight: 22,
  },
  addTruth: {
    fontFamily: weightFamily(400),
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 12,
  },
  money: {
    fontFamily: weightFamily(500),
    fontVariant: ['tabular-nums'],
  },
  emptyWrap: {
    flex: 1,
    marginTop: 24,
  },
  errorWrap: {
    flex: 1,
    gap: 24,
    justifyContent: 'center',
  },
  retry: {
    alignItems: 'center',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
  },
  retryLabel: {
    fontFamily: weightFamily(500),
    fontSize: 15,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
