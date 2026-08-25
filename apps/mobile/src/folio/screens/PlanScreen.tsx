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

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { elevation, gap, radius, serif, useTheme, weightFamily, type Palette } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { useAppStore } from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import { deriveCalendarEvents, type DerivedEvent } from '@/folio/lib/calendarEvents';
import type { Nav } from '@/folio/types';
import { buildPlanUpcoming, shortPlanDay } from './planModel';

// ---------------------------------------------------------------------------
// formatGBP — the web's exact pure function (folio kit). Signed, Intl en-GB, no
// fraction digits, U+2212 MINUS SIGN (not a hyphen) so tabular figures align and
// the glyph matches the web byte-for-byte. Reproduced locally rather than using
// the kit's money() (which emits a hyphen-minus).
// ---------------------------------------------------------------------------
function formatGBP(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}£${Math.abs(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

// ---------------------------------------------------------------------------
// Money — the web <Money> primitive: a tabular Fraunces figure. Only the sizes /
// tones this screen uses are mapped (sm/lg · negative/ink) — faithful to the web.
// ---------------------------------------------------------------------------
const MONEY_SIZE = { sm: 16, lg: 40 } as const;

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
    <Text
      style={[
        styles.money,
        { fontSize: MONEY_SIZE[size], lineHeight: size === 'lg' ? 40 : 24, color },
      ]}
      numberOfLines={1}
    >
      {value}
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

  // Real store reads — the slices the derived timeline depends on (subs · subPaused · subOverrides ·
  // onboarding · pots · manual calendarEvents). The route's own inputs are read inside `useRoute`.
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const subOverrides = useAppStore((st) => st.subOverrides);
  const onboarding = useAppStore((st) => st.onboarding);
  const pots = useAppStore((st) => st.pots);
  const calendarEvents = useAppStore((st) => st.calendarEvents);
  const incomeSources = useAppStore((st) => st.incomeSources ?? []);
  const whatIfHolds = useAppStore((st) => st.whatIfHolds ?? []);
  const debts = useAppStore((st) => st.debts ?? []);
  // Demo example bills only while the seed is untouched; a cleared/real user sees only their own.
  const includeSampleBills = useAppStore((st) => st.currentBalance.source === 'sample');

  // Mount-gate the clock (mirrors TodayScreen): defer `new Date()` to an effect so nothing reads the
  // wall clock during the first render. Until it opens, the screen holds the loading branch.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // The shared store→money-path bridge — same curve every surface reads. The hook can't be called
  // conditionally, so it always runs against `now ?? EPOCH`; before the mount-gate opens we discard
  // that transient result (`route = null`). `daysToPayday` (and the resolved payday it implies) come
  // from here; the dated list + the marker date come from `deriveCalendarEvents`, which resolves the
  // SAME payday through `resolvePayday` (and the same `now`), so the two never disagree.
  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;

  // The real derived timeline — bills + sub renewals + pot top-ups, payday, deadlines, reviews. We
  // read its "out" events (money spoken for) and its `payday` event (the next-payday marker date).
  const events = useMemo<DerivedEvent[]>(
    () =>
      now
        ? deriveCalendarEvents({
            subs,
            subPaused,
            subOverrides,
            onboarding,
            manualEvents: calendarEvents,
            pots,
            incomeSources,
            whatIfHolds,
            now,
            includeSampleBills,
          })
        : [],
    [
      now,
      subs,
      subPaused,
      subOverrides,
      onboarding,
      calendarEvents,
      pots,
      incomeSources,
      whatIfHolds,
      includeSampleBills,
    ],
  );

  const upcoming = useMemo(() => buildPlanUpcoming(events), [events]);
  const total = useMemo(() => upcoming.reduce((sum, u) => sum + u.amount, 0), [upcoming]);
  const tightDate = route?.tightPoint.date ?? null;
  const tightSpare = route?.tightPoint.amount ?? null;
  const daysToPayday = route?.daysToPayday ?? null;
  const potsSaved = useMemo(() => pots.reduce((sum, pot) => sum + pot.saved, 0), [pots]);
  const liveSubs = useMemo(() => subs.filter((sub) => !subPaused[sub.name]), [subs, subPaused]);
  const showSampleMarker = !onboarding.done || includeSampleBills;
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
    tightDate && tightSpare !== null
      ? `Around ${shortPlanDay(tightDate)} you're down to ${formatGBP(tightSpare)}. Everything after that depends on this week.`
      : 'The path is still quiet. Add a commitment when there is something real to protect.';

  const destinations = [
    { label: 'Calendar', meta: 'the dates that matter', onPress: () => nav.go('calendar') },
    { label: 'Subscriptions', meta: `${liveSubs.length} active`, onPress: () => nav.go('subs') },
    {
      label: 'Debts',
      meta: debts.length ? `${debts.length} tracked` : 'nothing tracked yet',
      onPress: undefined,
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
      meta: 'something that leaves every month',
      onPress: () => nav.go('add-bill'),
    },
    { label: 'Add a debt', meta: 'balance, rate, payoff', onPress: () => nav.go('add-debt') },
    { label: 'Add a date', meta: 'a one-off in or out', onPress: () => nav.openSheet('add-event') },
    { label: 'Sub check-in', meta: 'still worth it? three choices', onPress: undefined },
    { label: 'Log a transfer', meta: 'between your own accounts', onPress: undefined },
    { label: 'Pair a refund', meta: 'link the money in to the earlier spend', onPress: undefined },
  ];

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: gap.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {showSampleMarker ? (
          <View style={styles.sampleMarker}>
            <View style={[styles.sampleDot, { backgroundColor: t.caution }]} />
            <Text style={[styles.sampleText, { color: t.muted }]}>Sample numbers</Text>
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

        <View style={[styles.dominant, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text style={[styles.smallLabel, { color: t.muted }]}>
            {upcoming.length} thing{upcoming.length === 1 ? '' : 's'} still to leave
          </Text>
          <View style={styles.figureAmount}>
            <Money value={formatGBP(total)} size="lg" t={t} />
          </View>
          <Text style={[styles.dominantCaption, { color: t.muted }]}>
            {daysToPayday === 0
              ? 'payday is today'
              : `over the ${daysToPayday ?? 0} day${daysToPayday === 1 ? '' : 's'} to payday`}
          </Text>
          <View style={styles.dominantActions}>
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
              <Text numberOfLines={1} style={[styles.buttonLabel, { color: t.ink }]}>
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
              <Text style={[styles.buttonLabel, { color: t.calmStrong }]}>Try a change</Text>
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.pressureNote,
            { borderLeftColor: tightSpare !== null && tightSpare < 0 ? t.repair : t.caution },
          ]}
        >
          <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Tight point</Text>
          <Text style={[styles.pressureText, { color: t.ink }]}>{tightMessage}</Text>
        </View>

        <View style={[styles.chapterDivider, { backgroundColor: t.hairline }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionEyebrow, { color: t.muted }]}>What's coming</Text>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>The next few dates</Text>
          <View style={styles.timelineList}>
            {upcoming.length === 0 ? (
              <Text style={[styles.timelineEmpty, { color: t.muted }]}>
                Nothing is scheduled to leave before payday.
              </Text>
            ) : null}
            {upcoming.slice(0, 4).map((u, i) => (
              <Pressable
                key={u.id}
                accessibilityRole="button"
                accessibilityLabel={`${u.name}, ${formatGBP(u.amount)}, ${shortPlanDay(u.date)}`}
                accessibilityHint="Opens Calendar."
                onPress={() => nav.go('calendar')}
                style={({ pressed: isPressed }) => [
                  styles.timelineRow,
                  i > 0 ? { borderTopWidth: 1, borderTopColor: t.hairline } : undefined,
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text
                  style={[styles.timelineWhen, { color: u.date === tightDate ? t.calm : t.muted }]}
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
                accessibilityRole={item.onPress ? 'button' : undefined}
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
                  accessibilityRole={choice.onPress ? 'button' : undefined}
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
  );
}

const styles = StyleSheet.create({
  root: {
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
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 230,
  },
  dominant: {
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 24,
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
  dominantActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  quietAction: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  buttonLabel: {
    fontFamily: weightFamily(500),
    fontSize: 14,
    lineHeight: 22,
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
