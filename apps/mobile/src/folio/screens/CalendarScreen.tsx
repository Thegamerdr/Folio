/**
 * @rn-screen    CalendarScreen
 * @rn-stack     More > Calendar
 * @purpose      The time view of your money — the explanation layer for the Route.
 *               Three planner views (Month · Week · Agenda) over the same data.
 * @reads        subs, subPaused, subOverrides, onboarding, calendarEvents, calendarFocusDate, pots
 * @writes       addCalendarEvent / removeCalendarEvent / updateCalendarEvent · togglePaused ·
 *               nudgeSub / resetSubOverrides · setCalendarFocusDate / setRouteFocusDate
 * @opens-sheet  route-detail · add-event · calendar-export · calendar-connect
 * @copy         FROZEN
 * @tokens       --paper --accent --positive --negative --caution --hairline --accent-soft
 * @motion       slide-in-r · scale-in for tightest-day banner · soft view crossfade
 *
 * @rn-future    Business calendar lives alongside Personal — invoices, VAT,
 *               reconciliation, client commitments. Built in RN.
 *
 * ===========================================================================
 * Faithful 1:1 RN port of the web design source
 * (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenCalendar.tsx).
 * ===========================================================================
 *
 * The Calendar is three planner views (Month / Week / Agenda) over ONE shared derived timeline. It
 * shows what lands and what leaves each day, surfaces the lowest spare-£ point, and lets the user
 * nudge / pause sub renewals and move / remove manual events. It bridges both directions with the
 * Route on Today: setCalendarFocusDate (Route → here) and setRouteFocusDate + nav.go('today')
 * (here → Route).
 *
 * DATA is REAL — read from the store via useAppStore, derived through the real calendar engine
 * (deriveCalendarEvents / groupByDay / computeSpareAndTightest / formatDayHeader / formatDayProse /
 * previewSubNudge), and written through the real mutators. The £720 starting spare is sourced from
 * the store's SAMPLE balance (currentBalance.amount), faithful to the web prototype's literal 720;
 * the real Money-path engine will replace this anchor later (tagged @rn-engine money-path below).
 *
 * VOICE is FROZEN. Every visible string is verbatim from the web source. COPY_DECK.md has no
 * Calendar section, so the deck-keyed strings used here (app name "Folio") come through
 * '@/folio/copy/copy'; the rest are frozen inline exactly as the web shipped them, screened for the
 * banned vocabulary (no import / rows / parser / extraction / OCR / sync / dashboard / analytics /
 * users / 100% / bank-grade / AI-powered / smart / provenance / source record / indexed). The
 * calendar-app button reads "Add to your calendar app", never ".ics".
 *
 * MOOD mapping: the web meloCalendarMood returns calm | soft | alert, which is NOT the RN Melo's
 * canonical vocabulary (calm | curious | cheer | concern | celebrate). Per the spec's fidelity note,
 * soft → curious and alert → concern. The copy carries the meaning; the mood is decorative.
 *
 * HOSTED-CALENDAR engines are NOT built. The export sheet's .ics serializer IS real (eventsToIcs in
 * '@/folio/lib/ics'); the hosted webcal feed and the Google push are UI-only and tagged
 * `// @rn-engine hosted-calendar`. The sheets themselves are hosted by the shell (add-event /
 * calendar-export / calendar-connect SheetIds); this screen only opens them via nav.openSheet.
 *
 * FIDELITY notes carried into this port:
 *   • react-native-svg supports neither preserveAspectRatio='none' nor vectorEffect='non-scaling-
 *     stroke'. Both charts compute their points against an onLayout-measured width + a fixed height
 *     and use a fixed strokeWidth.
 *   • Hover-driven nudge preview (onMouseEnter/onFocus) has no touch analog → onPressIn/onPressOut.
 *   • scrollIntoView({block:'center'}) → refs + onLayout-measured y + ScrollView.scrollTo({y,
 *     animated}). The agenda jump and the Route → Calendar focus bridge both ride this.
 *   • The web hydration-gate skeleton (today === null) is an SSR/UTC artifact; RN has no SSR, so
 *     `today` is set at mount and the skeleton is kept only as a one-frame calm empty frame.
 *   • '−' is U+2212 (MINUS SIGN) in amounts + nudge labels, never ASCII '-'.
 *   • All £ chips clamp Math.max(0, Math.round()) — never show negative spare even when the tightest
 *     spare ≤ 0 (which still drives the alert Melo band). Clamp + band stay separate.
 *   • Monday-start week math: (getDay()+6)%7 for weekStart and the month leading blanks.
 *   • Past-day dimming differs per view (agenda/week 0.55, month 0.45 only when !selected) — kept.
 *   • Reduced motion → every animation resolves straight to its final state.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  useAppStore,
  removeCalendarEvent,
  updateCalendarEvent,
  setCalendarFocusDate,
  setRouteFocusDate,
  togglePaused,
  nudgeSub,
  resetSubOverrides,
} from '@/folio/store';
import { elevation, gap, radius, serif, useTheme, type Palette } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { type MeloMood } from '@/folio/melo/Melo';
import {
  deriveCalendarEvents,
  groupByDay,
  computeSpareAndTightest,
  formatDayHeader,
  formatDayProse,
  previewSubNudge,
  type DerivedEvent,
} from '@/folio/lib/calendarEvents';
import { useRoute } from '@/folio/lib/storeRoute';
import type { Nav } from '@/folio/types';

// The three planner views. Default is Agenda (the web default), the most legible on a narrow phone.
// Named CalendarView (not `View`) so it never shadows react-native's <View>.
type CalendarView = 'month' | 'week' | 'agenda';

// @rn-engine money-path — the starting-spare anchor. The web prototype anchored the spare ladder to a
// literal £720. The real Money-path engine now owns this figure: the ladder anchors to the ROUTE START
// (the same spendable base TodayScreen draws the route from), via the shared `@/folio/lib/storeRoute`
// bridge — `currentBalance.amount` minus earmarked pot cash (open borrows are 0 from `routeFromStore`).
// That base is read reactively off the store in both the screen (the `startingSpare` selector) and the
// per-event nudge preview (`previewStart`), so the Calendar's spare ladder, its tightest-day pill, and
// the what-if preview all anchor to the IDENTICAL figure and agree with the Route's curve. The tightest
// pill itself defers to `route.tightPoint` once the engine is ready, so it matches Today's lowest point.

// slide-in-r geometry (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms,
// on the editorial ease-out-expo. Mirrors PotsScreen / ReviewScreen / Melo.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;
// scale-in (web .scale-in): the tightest-day pill eases from scale 0.97 → 1 with a fade, 320ms.
const SCALE_IN_MS = 320;
const SCALE_FROM = 0.97;
// soft view crossfade — the body fades on a view switch without re-deriving the data, 180ms.
const VIEW_FADE_MS = 180;
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// A stable sentinel "now" for the one frame before the mount-gate opens. `useRoute` can't be called
// conditionally, so it runs against this until `today` is set; the result is discarded (`route = null`)
// that frame. Module-level so its identity never churns the hook's memo. Mirrors TodayScreen.
const EPOCH = new Date(0);

// The legend / dot vocabulary. KIND_DOT resolves a kind to a palette colour at render time (it takes
// the active palette, because an SVG-free coloured dot still needs a theme colour, not a class).
// manual = ink at 60% (web bg-[var(--ink)]/60); the rest map 1:1 to the web tokens.
function kindDotColor(t: Palette, kind: DerivedEvent['kind']): string {
  if (kind === 'in') return t.positive;
  if (kind === 'out') return t.repair;
  if (kind === 'review') return t.calm;
  if (kind === 'deadline') return t.caution;
  return withAlpha(t.ink, 0.6); // manual
}

// sr-only kind labels (web KIND_LABEL) — read by assistive tech before the row title.
const KIND_LABEL: Record<DerivedEvent['kind'], string> = {
  in: 'Money in',
  out: 'Money out',
  review: 'Review',
  deadline: 'Deadline',
  manual: 'You added this',
};

// Apply an alpha to a #RRGGBB palette colour → rgba(). Used for the two web "/60" and "/70" ink
// tints (manual dot, month selected-day dots + tick) that have no dedicated palette key. Falls back
// to the colour untouched if it is not a 6-digit hex (defensive — every palette key here is hex).
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m || m[1] === undefined) return hex;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Add `days` to an ISO date (YYYY-MM-DD), local-time, return ISO. Verbatim from the web. */
function shiftIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// amountStr — "+£11" / "−£540" / "+£11.99". The '−' is U+2212 (MINUS SIGN), not ASCII '-'; the '+'
// and the toFixed(0|2) split (whole pounds drop the decimals) are byte-faithful to the web.
function amountStr(e: DerivedEvent): string | null {
  if (typeof e.amount !== 'number') return null;
  const sign = e.amount >= 0 ? '+' : '−';
  return `${sign}£${Math.abs(e.amount).toFixed(e.amount % 1 === 0 ? 0 : 2)}`;
}

// Local-date ISO (avoids UTC drift in toISOString around midnight). Verbatim from the web.
function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Net £ movement on a day — used for up/down ticks and spare deltas. Verbatim from the web. */
function netForDay(evs: DerivedEvent[] | undefined): number {
  if (!evs) return 0;
  let n = 0;
  for (const e of evs) if (typeof e.amount === 'number') n += e.amount;
  return n;
}

/** Build a screen-reader sentence for a day cell — colour dots alone don't carry meaning to
 *  assistive tech. Includes spare £ + tightest flag. Verbatim from the web describeDay. */
function describeDay(
  iso: string,
  evs: DerivedEvent[] | undefined,
  spare: number | undefined,
  isTightest: boolean,
): string {
  const head = formatDayProse(iso);
  if (!evs || evs.length === 0) return `${head}, nothing planned`;
  const parts = evs.map((e) => {
    const labels: Record<DerivedEvent['kind'], string> = {
      in: 'money in',
      out: 'money out',
      review: 'review',
      deadline: 'deadline',
      manual: 'you added',
    };
    const amt = typeof e.amount === 'number' ? ` £${Math.abs(e.amount).toFixed(0)}` : '';
    return `${labels[e.kind]}${amt} ${e.title}`;
  });
  const spareTxt =
    typeof spare === 'number' ? `, £${Math.max(0, Math.round(spare))} spare after` : '';
  const tightTxt = isTightest ? ', tightest day in the window' : '';
  return `${head}: ${parts.join('; ')}${spareTxt}${tightTxt}`;
}

/* Melo voice on the Calendar — softens or sharpens with the tightest day. Four bands so an
 * overspent month doesn't get the same line as "tight". Verbatim from the web. */
function meloCalendarLine(tight: number, empty: boolean): string {
  if (empty) return 'Nothing pulling at your money this week.';
  if (tight <= 0) return "The middle of the month runs short. Let's move something together.";
  if (tight < 50) return 'There’s a pinch coming. We can soften it together.';
  if (tight < 200) return 'A squeeze in the middle — but you should make it through.';
  return 'Quiet on most days. A few that matter.';
}

// The web mood is calm | soft | alert; the RN Melo's vocabulary is calm | curious | cheer | concern |
// celebrate. Per the spec fidelity note: soft → curious, alert → concern. Calendar is absent from
// MELO_MOODS.md — this mapping is the documented choice (the copy carries meaning; mood is decorative).
function meloCalendarMood(tight: number, empty: boolean): MeloMood {
  if (empty) return 'curious'; // web 'soft'
  if (tight < 50) return 'concern'; // web 'alert'
  if (tight < 200) return 'curious'; // web 'soft'
  return 'calm';
}

// Local reduce-motion read — mirrors PotsScreen / Melo: read once, then subscribe to changes.
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

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function CalendarScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Real store reads (spec: data is REAL).
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const subOverrides = useAppStore((st) => st.subOverrides);
  const onboarding = useAppStore((st) => st.onboarding);
  const manual = useAppStore((st) => st.calendarEvents);
  const focusDate = useAppStore((st) => st.calendarFocusDate);
  const pots = useAppStore((st) => st.pots);

  // RN has no SSR — set `today` at mount. The null-guard is kept only so the very first frame is a
  // calm empty frame rather than a flash of half-derived content (NOT the web's UTC/SSR rationale).
  // It also doubles as the money-path mount-gate (mirrors TodayScreen): the route engine has no honest
  // "today" until this is set, so the route is discarded that one frame.
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setToday(d);
  }, []);

  // @rn-engine money-path — the running-spare ladder + the tightest-day pill anchor to the REAL route,
  // not the old literal £720. `useRoute` (the shared store→money-path bridge) maps the live store onto
  // `computeRoute` exactly as TodayScreen does, so the Calendar's curve agrees with the Route's curve.
  // The hook can't be called conditionally, so it always runs against `today ?? EPOCH`; before the
  // mount-gate opens (`today === null`) the engine has no honest "today", so that transient result is
  // discarded (`route = null`) and the pre-mount calm frame renders with no spare £ anyway.
  const routeResult = useRoute(today ?? EPOCH);
  const route = today ? routeResult : null;

  // Where the ladder starts — `currentBalance.amount − Σ pots.saved`, matching `routeFromStore` so
  // the Calendar ladder and the Route curve stay equal. The already-SAVED pot cash is earmarked OUT
  // of the start (the "saved amount lowers Today's spare" rule); the pots' FUTURE −perWeek top-up dips
  // are different money and stay in the dated events ("bends the path") — two distinct effects, no
  // double-count. We do NOT re-add those dated dips to the start.
  const startingSpare = useAppStore((st) => st.currentBalance.amount - st.pots.reduce((acc, p) => acc + p.saved, 0));

  // Events / groups / spare are memoised ABOVE the view branch so switching views never re-derives
  // the data (STATES: "switching never reloads"). Only the presentational subview swaps.
  const events = useMemo(
    () =>
      today
        ? deriveCalendarEvents({
            subs,
            subPaused,
            subOverrides,
            onboarding,
            manualEvents: manual,
            pots,
            now: today,
          })
        : [],
    [subs, subPaused, subOverrides, onboarding, manual, pots, today],
  );

  const groups = useMemo(() => groupByDay(events), [events]);
  const eventsByDay = useMemo(() => {
    const map: Record<string, DerivedEvent[]> = {};
    for (const g of groups) map[g.date] = g.events;
    return map;
  }, [groups]);

  const { spareByDay, tightestDate, tightestSpare } = useMemo(
    () => computeSpareAndTightest(groups, startingSpare),
    [groups, startingSpare],
  );

  const [view, setView] = useState<CalendarView>('agenda');

  // Cross-view "jump" — to tightest, or to a specific date from Route detail. Views read `jumpDate`;
  // bumping `jumpPulse` re-triggers a smooth scroll / offset realignment.
  const [jumpPulse, setJumpPulse] = useState(0);
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  // Jump to the lowest-spare day. Targets the Route's tight point when the engine is ready (so the jump
  // lands on the same day the pill names), else the ladder's tightest.
  const jumpToTightest = () => {
    const target = route ? route.tightPoint.date : tightestDate;
    if (!target) return;
    setJumpDate(target);
    setJumpPulse((p) => p + 1);
  };

  // Bridge from Route detail → Calendar. One-shot: consume + clear.
  useEffect(() => {
    if (!today || !focusDate) return;
    setJumpDate(focusDate);
    setJumpPulse((p) => p + 1);
    setCalendarFocusDate(null);
  }, [today, focusDate]);

  // The agenda jump scrolls the screen ScrollView; the ref + a registry of measured row offsets are
  // owned here so AgendaView can ask for a scroll without owning the scroller.
  const scrollRef = useRef<ScrollView>(null);

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

  // soft view crossfade — the body fades out/in on a view switch (final state under reduce-motion).
  const bodyFade = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      bodyFade.value = 1;
      return;
    }
    bodyFade.value = withTiming(0, { duration: VIEW_FADE_MS / 2, easing: EASE_OUT_EXPO }, () => {
      bodyFade.value = withTiming(1, { duration: VIEW_FADE_MS / 2, easing: EASE_OUT_EXPO });
    });
  }, [view, bodyFade, reduceMotion]);
  const bodyFadeStyle = useAnimatedStyle(() => ({ opacity: bodyFade.value }));

  // PRE-MOUNT FRAME — RN has no SSR; this is a calm empty frame for the one frame before `today` is
  // set at mount. Header + title + an empty surface card, NO spare £.
  if (!today) {
    return (
      <Animated.View style={[layout.root, enterStyle, { backgroundColor: t.canvas }]}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            layout.content,
            { paddingTop: insets.top + gap.md, paddingBottom: insets.bottom + gap.huge },
          ]}
        >
          <Header nav={nav} t={t} s={s} />
          <TitleBlock s={s} withSubhead={false} />
          <View style={s.skeletonCard} />
        </ScrollView>
      </Animated.View>
    );
  }

  const isEmpty = events.length === 0;
  const missingPayday = !onboarding.payday || !onboarding.monthlyIncome;
  const missingBills = subs.length === 0;
  const missingPots = pots.length === 0 || pots.every((p) => !(p.perWeek > 0));

  // The lowest-spare point. The tightest-day pill must AGREE with the Route's tight point (the same
  // lowest-balance day TodayScreen shows), so when the route is ready it is authoritative — date and
  // £ both come from `route.tightPoint`. Until the mount-gate opens, fall back to the ladder's tightest
  // (anchored to the same route start) so the pre-mount-to-mounted transition never flips the figure.
  // Driving the jump target and the views' accent-soft highlighting off this same `lowDate` keeps the
  // pill, the jump, and the highlighted day pointing at one coherent day.
  const lowDate = route ? route.tightPoint.date : tightestDate;
  const lowSpare = route ? route.tightPoint.amount : tightestSpare;
  const tightestLeft = Math.max(0, Math.round(lowSpare));

  return (
    <Animated.View style={[layout.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          layout.content,
          { paddingTop: insets.top + gap.md, paddingBottom: insets.bottom + gap.huge },
        ]}
      >
        <Header nav={nav} t={t} s={s} />
        <TitleBlock s={s} withSubhead />

        {/* View switcher — a tablist over the inset well. The selected tab lifts to the paper surface
            with a soft shadow; the rest are muted text. */}
        <View accessibilityRole="tablist" style={s.switcher}>
          {(['month', 'week', 'agenda'] as CalendarView[]).map((v) => {
            const selected = view === v;
            return (
              <Pressable
                key={v}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${capitalize(v)} view`}
                onPress={() => setView(v)}
                style={({ pressed }) => [
                  s.tab,
                  selected ? s.tabSelected : undefined,
                  pressed ? layout.pressed : undefined,
                ]}
              >
                <Text style={[s.tabLabel, selected ? s.tabLabelSelected : undefined]}>
                  {capitalize(v)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Tightest-day pill — a single line bridging to the lowest spare point. All three views
            already highlight that day in colour; this is just the jump action. scale-in on appear. */}
        {lowDate && !isEmpty ? (
          <TightestPill
            s={s}
            onPress={jumpToTightest}
            dateProse={formatDayProse(lowDate)}
            left={tightestLeft}
            reduceMotion={reduceMotion}
          />
        ) : null}

        {/* Body — switch by view. Wrapped in the soft crossfade. */}
        <Animated.View style={[layout.body, bodyFadeStyle]}>
          {isEmpty ? (
            <CalendarEmptyState
              s={s}
              missingPayday={missingPayday}
              missingBills={missingBills}
              missingPots={missingPots}
            />
          ) : view === 'agenda' ? (
            <AgendaView
              nav={nav}
              t={t}
              s={s}
              groups={groups}
              spareByDay={spareByDay}
              tightestDate={lowDate}
              today={today}
              jumpDate={jumpDate}
              jumpPulse={jumpPulse}
              scrollRef={scrollRef}
            />
          ) : view === 'week' ? (
            <WeekView
              nav={nav}
              t={t}
              s={s}
              eventsByDay={eventsByDay}
              spareByDay={spareByDay}
              tightestDate={lowDate}
              today={today}
              jumpDate={jumpDate}
              jumpPulse={jumpPulse}
            />
          ) : (
            <MonthView
              nav={nav}
              t={t}
              s={s}
              eventsByDay={eventsByDay}
              spareByDay={spareByDay}
              tightestDate={lowDate}
              today={today}
              jumpDate={jumpDate}
              jumpPulse={jumpPulse}
            />
          )}
        </Animated.View>

        {/* Legend — four of the five KIND_DOT kinds (the manual "You added this" dot is intentionally
            omitted, matching the web). */}
        <View style={layout.legend}>
          {(['in', 'out', 'review', 'deadline'] as DerivedEvent['kind'][]).map((kind) => (
            <View key={kind} style={layout.legendItem}>
              <View style={[layout.legendDot, { backgroundColor: kindDotColor(t, kind) }]} />
              <Text style={s.legendLabel}>{KIND_LABEL[kind]}</Text>
            </View>
          ))}
        </View>

        {/* Footer actions — three CTAs. Add an event (terracotta), Add to your calendar app (the real
            .ics export sheet), Connect Google (hosted push — UI only). Labels never truncate; long
            labels wrap. */}
        <View style={layout.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add an event"
            onPress={() => nav.openSheet('add-event')}
            style={({ pressed }) => [s.footerCtaAccent, pressed ? layout.pressed : undefined]}
          >
            <Text style={s.footerCtaAccentLabel}>+ Add an event</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add to your calendar app"
            onPress={() => nav.openSheet('calendar-export')}
            style={({ pressed }) => [s.footerCta, pressed ? layout.pressed : undefined]}
          >
            <Text style={s.footerCtaLabel}>Add to your calendar app</Text>
          </Pressable>
          {/* @rn-engine hosted-calendar — the Google push (a hosted webcal feed) is not built; this
              opens the connect sheet as UI only. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Connect Google"
            onPress={() => nav.openSheet('calendar-connect')}
            style={({ pressed }) => [s.footerCta, pressed ? layout.pressed : undefined]}
          >
            <Text style={s.footerCtaLabel}>Connect Google</Text>
          </Pressable>
        </View>

        {/* Melo line — the band follows the tightest day (empty / overspent / pinch / squeeze / quiet).
            loading is never a spinner; this line + the curious mood IS the calm "working" state. */}
        <View style={layout.meloBlock}>
          <MeloLine
            text={meloCalendarLine(lowSpare, isEmpty)}
            mood={meloCalendarMood(lowSpare, isEmpty)}
          />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Header — back chevron · centred uppercase eyebrow "What's coming" · symmetric spacer.
// ---------------------------------------------------------------------------

function Header({ nav, t, s }: { nav: Nav; t: Palette; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={layout.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={nav.back}
        style={({ pressed }) => [layout.backHit, pressed ? layout.pressed : undefined]}
      >
        <Text style={[s.backGlyph, { color: t.muted }]}>←</Text>
      </Pressable>
      <Text style={s.eyebrow}>What&apos;s coming</Text>
      <View style={layout.headerSpacer} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Title block — italic "Calendar" kicker + the display line with the terracotta accent + subhead.
// ---------------------------------------------------------------------------

function TitleBlock({
  s,
  withSubhead,
}: {
  s: ReturnType<typeof makeStyles>;
  withSubhead: boolean;
}) {
  return (
    <View style={layout.title}>
      <Text style={s.kicker}>Calendar</Text>
      <Text accessibilityRole="header" style={s.headline}>
        {'Your week, with what’s '}
        <Text style={s.headlineAccent}>coming and going.</Text>
      </Text>
      {withSubhead ? <Text style={s.subhead}>Each day, what lands and what leaves.</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tightest-day pill — scale-in banner: "Lowest point: {day} · £{n} left" + "Go there →".
// ---------------------------------------------------------------------------

function TightestPill({
  s,
  onPress,
  dateProse,
  left,
  reduceMotion,
}: {
  s: ReturnType<typeof makeStyles>;
  onPress: () => void;
  dateProse: string;
  left: number;
  reduceMotion: boolean;
}) {
  const appear = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      appear.value = 1;
      return;
    }
    appear.value = withTiming(1, { duration: SCALE_IN_MS, easing: EASE_OUT_EXPO });
  }, [appear, reduceMotion]);
  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: SCALE_FROM + appear.value * (1 - SCALE_FROM) }],
  }));

  return (
    <Animated.View style={appearStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Lowest point: ${dateProse}, £${left} left. Go there.`}
        onPress={onPress}
        style={({ pressed }) => [s.pill, pressed ? layout.pressed : undefined]}
      >
        <Text style={s.pillText}>
          <Text style={s.pillLead}>Lowest point:</Text>
          {` ${dateProse} · £${left} left`}
        </Text>
        <Text style={s.pillGo}>Go there →</Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Empty state — name the first missing lever (payday > bills > pots, else generic). The web renders a
// QUOTED italic Fraunces head + a muted body inside a plain surface card (bg-surface · hairline ·
// rounded-2xl · p-6 · centred) with NO mascot. This is the faithful 1:1 of that treatment, inlined
// rather than routed through the shared EmptyState primitive — the primitive drops the surrounding
// quote marks (it splits an accent word instead) and adds a grounded Melo, neither of which the
// Calendar empty card has. The literal quote marks wrap the head exactly as the web's "{head}" did.
// ---------------------------------------------------------------------------

function CalendarEmptyState({
  s,
  missingPayday,
  missingBills,
  missingPots,
}: {
  s: ReturnType<typeof makeStyles>;
  missingPayday: boolean;
  missingBills: boolean;
  missingPots: boolean;
}) {
  let head = 'Nothing pulling at your money this week.';
  let line = 'Add a payday or a bill below to start the picture.';
  if (missingPayday) {
    head = 'No payday set yet.';
    line = 'Add your payday so Folio knows when money lands.';
  } else if (missingBills) {
    head = 'Nothing leaving yet.';
    line = "Add a bill or two so Folio knows what's leaving.";
  } else if (missingPots) {
    head = 'No saving rhythm yet.';
    line = 'Add a pot below to see how weekly savings shape your dips.';
  }
  return (
    <View style={layout.emptyWrap}>
      <View style={s.emptyCard}>
        <Text style={s.emptyHead}>{`"${head}"`}</Text>
        <Text style={s.emptyBody}>{line}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Agenda view — a stack of day cards. The tightest day is accent-soft; past days dim to 0.55 and drop
// their "See on Route" link. The jump (tightest or Route-focus date) scrolls the screen ScrollView so
// the target day sits roughly centred.
// ---------------------------------------------------------------------------

function AgendaView({
  nav,
  t,
  s,
  groups,
  spareByDay,
  tightestDate,
  today,
  jumpDate,
  jumpPulse,
  scrollRef,
}: {
  nav: Nav;
  t: Palette;
  s: ReturnType<typeof makeStyles>;
  groups: { date: string; events: DerivedEvent[] }[];
  spareByDay: Record<string, number>;
  tightestDate: string | null;
  today: Date;
  jumpDate: string | null;
  jumpPulse: number;
  scrollRef: React.RefObject<ScrollView | null>;
}) {
  const todayIso = isoDay(today);
  // onLayout-measured y offset per day card (relative to the scroll content), so a jump can centre it.
  const offsets = useRef<Record<string, number>>({});

  useEffect(() => {
    const target = jumpDate ?? tightestDate;
    if (!target) return;
    const y = offsets.current[target];
    if (typeof y !== 'number') return;
    // block:center → scroll so the card sits a little above middle. A small upward bias keeps the
    // day header in view rather than the card's vertical centre vanishing under the title.
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
  }, [jumpPulse, jumpDate, tightestDate, scrollRef]);

  return (
    <View style={layout.agendaStack}>
      {groups.map((g) => {
        const isTightest = g.date === tightestDate;
        const isPast = g.date < todayIso;
        const spare = spareByDay[g.date];
        return (
          <View
            key={g.date}
            onLayout={(e: LayoutChangeEvent) => {
              offsets.current[g.date] = e.nativeEvent.layout.y;
            }}
            style={[
              s.dayCard,
              isTightest ? s.dayCardTightest : undefined,
              isPast ? layout.past : undefined,
            ]}
          >
            <View style={layout.dayHead}>
              <View style={layout.dayHeadLeft}>
                <Text style={s.dayHeader}>{formatDayHeader(g.date)}</Text>
                {isPast ? <Text style={s.pastMarker}>past</Text> : null}
              </View>
              {typeof spare === 'number' ? (
                <Text style={s.spareRight}>£{Math.max(0, Math.round(spare))} left after</Text>
              ) : null}
            </View>
            <View style={layout.eventList}>
              {g.events.map((e) => (
                <EventRow key={e.id} e={e} t={t} s={s} />
              ))}
            </View>
            {!isPast ? <SeeOnRoute nav={nav} s={s} date={g.date} /> : null}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Week view — a Mon-start 7-day strip with a spare-trend sparkline above it, then stacked day blocks
// for the days that carry events. ‹ / › step the week; the jump realigns the offset to the target's
// week. Past days dim to 0.55.
// ---------------------------------------------------------------------------

function WeekView({
  nav,
  t,
  s,
  eventsByDay,
  spareByDay,
  tightestDate,
  today,
  jumpDate,
  jumpPulse,
}: {
  nav: Nav;
  t: Palette;
  s: ReturnType<typeof makeStyles>;
  eventsByDay: Record<string, DerivedEvent[]>;
  spareByDay: Record<string, number>;
  tightestDate: string | null;
  today: Date;
  jumpDate: string | null;
  jumpPulse: number;
}) {
  const [offset, setOffset] = useState(0); // in weeks

  const weekStart = useMemo(() => {
    const d = new Date(today);
    const dow = (d.getDay() + 6) % 7; // 0 = Mon
    d.setDate(d.getDate() - dow + offset * 7);
    return d;
  }, [today, offset]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  // Jump to the week containing the jump target (route-detail date or tightest).
  useEffect(() => {
    const target = jumpDate ?? tightestDate;
    if (!target || jumpPulse === 0) return;
    const tgt = new Date(target + 'T00:00:00');
    const baseMon = new Date(today);
    baseMon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const diffDays = Math.round((tgt.getTime() - baseMon.getTime()) / 86_400_000);
    setOffset(Math.floor(diffDays / 7));
  }, [jumpPulse, jumpDate, tightestDate, today]);

  const monthLabel = weekStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const todayIso = isoDay(today);

  // Spare trend — spare £ at the end of each day, carried forward when a day has no events.
  const trend = useMemo(() => {
    const vals: number[] = [];
    let last: number | null = null;
    for (const d of days) {
      const iso = isoDay(d);
      if (typeof spareByDay[iso] === 'number') last = spareByDay[iso] ?? last;
      vals.push(last ?? 0);
    }
    return vals;
  }, [days, spareByDay]);

  const minV = Math.min(...trend);
  const maxV = Math.max(...trend);
  const tightIdx = trend.indexOf(minV);

  return (
    <View style={layout.weekStack}>
      <View style={layout.monthNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          onPress={() => setOffset((o) => o - 1)}
          style={({ pressed }) => [s.navRound, pressed ? layout.pressed : undefined]}
        >
          <Text style={s.navArrow}>‹</Text>
        </Pressable>
        <Text style={s.monthLabelUpper}>{monthLabel}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          onPress={() => setOffset((o) => o + 1)}
          style={({ pressed }) => [s.navRound, pressed ? layout.pressed : undefined]}
        >
          <Text style={s.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* Spare-trend card — "What's left this week" + low/high, with the accent sparkline beneath. */}
      <View style={s.trendCard}>
        <View style={layout.trendHead}>
          <Text style={s.trendLabel}>What&apos;s left this week</Text>
          <Text style={s.trendRange}>
            low £{Math.max(0, Math.round(minV))} · high £{Math.max(0, Math.round(maxV))}
          </Text>
        </View>
        <Sparkline
          values={trend}
          height={24}
          strokeWidth={1.4}
          color={t.calm}
          markIndex={tightIdx}
          markRadius={2}
        />
      </View>

      {/* Strip — seven day columns: weekday initial, day number (accent on tightest), ≤4 kind dots. */}
      <View style={layout.strip}>
        {days.map((d) => {
          const iso = isoDay(d);
          const evs = eventsByDay[iso] ?? [];
          const isToday = iso === todayIso;
          const isTightest = iso === tightestDate;
          const isPast = iso < todayIso;
          const a11y = describeDay(iso, evs, spareByDay[iso], isTightest);
          return (
            <View
              key={iso}
              accessible
              accessibilityLabel={a11y}
              style={[
                layout.stripCol,
                isTightest ? s.stripColTightest : isToday ? s.stripColToday : undefined,
                isPast ? layout.past : undefined,
              ]}
            >
              <Text style={s.stripWeekday}>
                {d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 1)}
              </Text>
              <Text style={[s.stripDay, isTightest ? s.stripDayTightest : undefined]}>
                {d.getDate()}
              </Text>
              <View style={layout.stripDots}>
                {evs.slice(0, 4).map((e) => (
                  <View
                    key={e.id}
                    style={[layout.stripDot, { backgroundColor: kindDotColor(t, e.kind) }]}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {/* Stacked day blocks for the week — only days that carry events. */}
      <View style={layout.weekBlocks}>
        {days.map((d) => {
          const iso = isoDay(d);
          const evs = eventsByDay[iso] ?? [];
          if (evs.length === 0) return null;
          const isTightest = iso === tightestDate;
          const isPast = iso < todayIso;
          const spare = spareByDay[iso];
          return (
            <View
              key={iso}
              style={[
                s.weekBlock,
                isTightest ? s.dayCardTightest : undefined,
                isPast ? layout.past : undefined,
              ]}
            >
              <View style={layout.dayHead}>
                <Text style={s.dayHeader}>{formatDayHeader(iso)}</Text>
                {typeof spare === 'number' ? (
                  <Text style={s.spareRight}>£{Math.max(0, Math.round(spare))} left</Text>
                ) : null}
              </View>
              <View style={layout.eventListCompact}>
                {evs.map((e) => (
                  <EventRow key={e.id} e={e} t={t} s={s} compact />
                ))}
              </View>
              {!isPast ? <SeeOnRoute nav={nav} s={s} date={iso} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Month view — a Mon-start grid. Each cell: day number, an up/down net tick, ≤3 kind dots. Selected =
// ink fill + paper text; tightest = accent-soft; today = inset; past dims to 0.45 unless selected. A
// spare sparkline sits under the grid; the selected-day panel lists that day's events (or the empty
// line) and offers "See on Route" when the selected day is today-or-later.
// ---------------------------------------------------------------------------

function MonthView({
  nav,
  t,
  s,
  eventsByDay,
  spareByDay,
  tightestDate,
  today,
  jumpDate,
  jumpPulse,
}: {
  nav: Nav;
  t: Palette;
  s: ReturnType<typeof makeStyles>;
  eventsByDay: Record<string, DerivedEvent[]>;
  spareByDay: Record<string, number>;
  tightestDate: string | null;
  today: Date;
  jumpDate: string | null;
  jumpPulse: number;
}) {
  const todayIso = isoDay(today);
  const [offset, setOffset] = useState(0); // months
  const [selected, setSelected] = useState<string>(todayIso);

  const monthAnchor = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + offset, 1),
    [today, offset],
  );

  // Jump to month + select the target day (route-detail date or tightest).
  useEffect(() => {
    const target = jumpDate ?? tightestDate;
    if (!target || jumpPulse === 0) return;
    const tgt = new Date(target + 'T00:00:00');
    const diff =
      (tgt.getFullYear() - today.getFullYear()) * 12 + (tgt.getMonth() - today.getMonth());
    setOffset(diff);
    setSelected(target);
  }, [jumpPulse, jumpDate, tightestDate, today]);

  // Build the grid: leading blanks from the Monday-start week.
  const cells = useMemo(() => {
    const first = monthAnchor;
    const startDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(new Date(first.getFullYear(), first.getMonth(), d));
    }
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [monthAnchor]);

  // Spare-line sparkline under the grid — carries spare £ forward through every day of the month, so
  // flat stretches read as "nothing happens".
  const monthDays = useMemo(() => cells.filter((c): c is Date => c !== null), [cells]);
  const spareLine = useMemo(() => {
    const vals: number[] = [];
    let last: number | null = null;
    for (const d of monthDays) {
      const iso = isoDay(d);
      if (typeof spareByDay[iso] === 'number') last = spareByDay[iso] ?? last;
      vals.push(last ?? 0);
    }
    return vals;
  }, [monthDays, spareByDay]);
  const minS = spareLine.length ? Math.min(...spareLine) : 0;

  const monthLabel = monthAnchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const selectedEvents = eventsByDay[selected] ?? [];

  return (
    <View style={layout.monthStack}>
      <View style={layout.monthNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setOffset((o) => o - 1)}
          style={({ pressed }) => [s.navRound, pressed ? layout.pressed : undefined]}
        >
          <Text style={s.navArrow}>‹</Text>
        </Pressable>
        <Text style={s.monthLabelDisplay}>{monthLabel}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => setOffset((o) => o + 1)}
          style={({ pressed }) => [s.navRound, pressed ? layout.pressed : undefined]}
        >
          <Text style={s.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* Weekday header — M T W T F S S, Monday-start. */}
      <View style={layout.weekdayRow}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={i} style={s.weekdayCell}>
            {d}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={layout.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={`blank-${i}`} style={layout.gridBlank} />;
          const iso = isoDay(d);
          const evs = eventsByDay[iso] ?? [];
          const isToday = iso === todayIso;
          const isTightest = iso === tightestDate;
          const isSelected = iso === selected;
          const isPast = iso < todayIso;
          const net = netForDay(evs);
          const tick = net > 0 ? '▲' : net < 0 ? '▼' : '';
          const tickColor = isSelected
            ? withAlpha(t.canvas, 0.7)
            : net > 0
              ? t.positive
              : net < 0
                ? t.repair
                : 'transparent';
          return (
            <Pressable
              key={iso}
              accessibilityRole="button"
              accessibilityLabel={describeDay(iso, evs, spareByDay[iso], isTightest)}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelected(iso)}
              style={({ pressed }) => [
                layout.gridCell,
                isSelected
                  ? s.gridCellSelected
                  : isTightest
                    ? s.gridCellTightest
                    : isToday
                      ? s.gridCellToday
                      : undefined,
                isPast && !isSelected ? layout.pastMonth : undefined,
                pressed ? layout.pressed : undefined,
              ]}
            >
              <Text
                style={[
                  s.gridDay,
                  isSelected ? s.gridDaySelected : isTightest ? s.gridDayTightest : undefined,
                ]}
              >
                {d.getDate()}
              </Text>
              {tick ? <Text style={[s.gridTick, { color: tickColor }]}>{tick}</Text> : null}
              <View style={layout.gridDots}>
                {evs.slice(0, 3).map((e) => (
                  <View
                    key={e.id}
                    style={[
                      layout.gridDot,
                      {
                        backgroundColor: isSelected
                          ? withAlpha(t.canvas, 0.7)
                          : kindDotColor(t, e.kind),
                      },
                    ]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Spare-line sparkline — where the dip is. Only with more than one point. */}
      {spareLine.length > 1 ? (
        <View style={layout.sparkBlock}>
          <View style={layout.trendHead}>
            <Text style={s.trendLabel}>Spare across the month</Text>
            <Text style={s.trendRange}>low £{Math.max(0, Math.round(minS))}</Text>
          </View>
          <Sparkline values={spareLine} height={20} strokeWidth={1.2} color={t.calm} />
        </View>
      ) : null}

      {/* Selected-day panel. */}
      <View style={s.selectedPanel}>
        <Text style={s.dayHeader}>{formatDayHeader(selected)}</Text>
        {selectedEvents.length === 0 ? (
          <Text style={s.nothingLine}>Nothing moves your money on this day.</Text>
        ) : (
          <View style={layout.eventList}>
            {selectedEvents.map((e) => (
              <EventRow key={e.id} e={e} t={t} s={s} />
            ))}
          </View>
        )}
        {selected >= todayIso ? <SeeOnRoute nav={nav} s={s} date={selected} /> : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — react-native-svg has no preserveAspectRatio='none' / vectorEffect='non-scaling-stroke',
// so the polyline is computed against an onLayout-measured width + a fixed height, with a fixed
// strokeWidth. An optional accent dot marks the lowest point.
// ---------------------------------------------------------------------------

function Sparkline({
  values,
  height,
  strokeWidth,
  color,
  markIndex,
  markRadius,
}: {
  values: number[];
  height: number;
  strokeWidth: number;
  color: string;
  markIndex?: number | undefined;
  markRadius?: number | undefined;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const minV = values.length ? Math.min(...values) : 0;
  const maxV = values.length ? Math.max(...values) : 0;
  const span = Math.max(1, maxV - minV);
  const padTop = strokeWidth;
  const padBottom = strokeWidth;
  const usableH = Math.max(1, height - padTop - padBottom);

  const points =
    width > 0 && values.length > 0
      ? values
          .map((v, i) => {
            const x = (i / Math.max(1, values.length - 1)) * width;
            const y = height - padBottom - ((v - minV) / span) * usableH;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(' ')
      : '';

  const markX =
    markIndex !== undefined && markIndex >= 0 && width > 0
      ? (markIndex / Math.max(1, values.length - 1)) * width
      : null;
  // The lowest point sits at the bottom of the usable band (minV → minV maps to the floor).
  const markY = height - padBottom;

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && points ? (
        <Svg width={width} height={height}>
          <Polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {markX !== null && markRadius !== undefined ? (
            <Circle cx={markX} cy={markY} r={markRadius} fill={color} />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Event row — a leading kind dot (+ sr-only kind label), the title (+ "you added this" badge when
// manual), the amount (positive-coloured for "in", ink otherwise; '−' is U+2212). Non-compact rows
// also carry the note + the "Repeats monthly/yearly" hint + the per-event actions: sub renewals get
// the pause/nudge controls; manual events get Move ±1d + Remove.
// ---------------------------------------------------------------------------

function EventRow({
  e,
  t,
  s,
  compact = false,
}: {
  e: DerivedEvent;
  t: Palette;
  s: ReturnType<typeof makeStyles>;
  compact?: boolean;
}) {
  const amt = amountStr(e);
  const recurringLabel =
    e.recurring === 'monthly'
      ? 'Repeats monthly'
      : e.recurring === 'yearly'
        ? 'Repeats yearly'
        : null;

  return (
    <View style={layout.eventRow}>
      <View style={[layout.eventDot, { backgroundColor: kindDotColor(t, e.kind) }]} />
      <View style={layout.eventBody}>
        <View style={layout.eventTitleRow}>
          <Text
            style={[compact ? s.eventTitleCompact : s.eventTitle, layout.eventTitleFlex]}
            numberOfLines={1}
            // The dot is decorative; the kind label is folded into the title's a11y label so the row
            // reads "Money out: Rent" the way the web sr-only span did.
            accessibilityLabel={`${KIND_LABEL[e.kind]}: ${e.title}${e.manual ? ', you added this' : ''}`}
          >
            {e.title}
            {e.manual ? <Text style={s.manualBadge}>{'  you added this'}</Text> : null}
          </Text>
          {amt ? (
            <Text
              style={[
                compact ? s.eventAmountCompact : s.eventAmount,
                { color: e.kind === 'in' ? t.positive : t.ink },
              ]}
            >
              {amt}
            </Text>
          ) : null}
        </View>

        {!compact && e.note ? <Text style={s.eventNote}>{e.note}</Text> : null}
        {!compact && recurringLabel ? (
          <View style={layout.recurringRow}>
            <Text style={s.recurringGlyph}>↻</Text>
            <Text style={s.recurringLabel}>{recurringLabel}</Text>
          </View>
        ) : null}

        {/* Per-event actions. */}
        {e.source === 'sub' && e.subName ? (
          <SubRenewalActions name={e.subName} s={s} />
        ) : e.manual ? (
          <View style={layout.manualActions}>
            <Text style={s.moveLabel}>Move</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Move one day earlier"
              onPress={() => updateCalendarEvent(e.id, { date: shiftIso(e.date, -1) })}
              style={({ pressed }) => [s.nudgeRound, pressed ? layout.pressed : undefined]}
            >
              <Text style={s.nudgeRoundLabel}>−1d</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Move one day later"
              onPress={() => updateCalendarEvent(e.id, { date: shiftIso(e.date, 1) })}
              style={({ pressed }) => [s.nudgeRound, pressed ? layout.pressed : undefined]}
            >
              <Text style={s.nudgeRoundLabel}>+1d</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${e.title}`}
              hitSlop={8}
              onPress={() => removeCalendarEvent(e.id)}
              style={({ pressed }) => [layout.textAction, pressed ? layout.pressed : undefined]}
            >
              <Text style={s.removeLabel}>Remove</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// See on Route — closes the loop the other way: from a Calendar day back to the Route on Today, with
// the matching path point pulsed. Sets the route-focus bridge, then navigates to Today.
// ---------------------------------------------------------------------------

function SeeOnRoute({
  nav,
  s,
  date,
}: {
  nav: Nav;
  s: ReturnType<typeof makeStyles>;
  date: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`See ${formatDayProse(date)} on your money path`}
      onPress={() => {
        setRouteFocusDate(date);
        nav.go('today');
      }}
      style={({ pressed }) => [layout.seeOnRoute, pressed ? layout.pressed : undefined]}
    >
      <Text style={s.seeOnRouteLabel}>See this day on your money path</Text>
      <Text style={s.seeOnRouteArrow}>→</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Sub renewal actions — the "what if I move this?" affordance for flexible bills. Pause is one option;
// nudging ±1d / ±3d is the gentler one. The preview line shows the £ lift on the tight day BEFORE you
// commit. The web drove the preview off hover/focus; touch has no hover, so it rides onPressIn/Out
// (press-and-hold a nudge to preview, release to commit). A persistent caption shows the live nudge.
// ---------------------------------------------------------------------------

const NUDGES: readonly { d: number; label: string }[] = [
  { d: -3, label: '−3d' },
  { d: -1, label: '−1d' },
  { d: 1, label: '+1d' },
  { d: 3, label: '+3d' },
];

function SubRenewalActions({ name, s }: { name: string; s: ReturnType<typeof makeStyles> }) {
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const subOverrides = useAppStore((st) => st.subOverrides);
  const onboarding = useAppStore((st) => st.onboarding);
  const manualEvents = useAppStore((st) => st.calendarEvents);
  const pots = useAppStore((st) => st.pots);

  // RN has no hover; the "preview" is shown while a nudge button is pressed (onPressIn) and cleared on
  // release (onPressOut). `hover` keeps the web's variable name so the parity reads 1:1.
  const [hover, setHover] = useState<number | null>(null);
  const currentDelta = subOverrides[name] ?? 0;

  // The what-if anchor — the SAME `balance − Σ pots.saved` start the screen's ladder + route use, so
  // the previewed "lowest day" lift reads against the real curve. The already-saved pot cash is
  // earmarked out of the start; the pots' future −perWeek top-up dips stay in the dated events — two
  // distinct effects, no double-count.
  const currentBalance = useAppStore((st) => st.currentBalance);
  const previewStart = currentBalance.amount - pots.reduce((acc, p) => acc + p.saved, 0);

  const previewDelta = useMemo(() => {
    if (hover === null) return null;
    // Re-route a HYPOTHETICAL scenario, never the live store: `previewSubNudge` builds the timeline
    // twice (base + a nudged COPY of `subOverrides`) and computes each against `previewStart` without
    // mutating any store slice — the same pure derivation the screen ladder runs.
    return previewSubNudge({
      subName: name,
      deltaDays: hover,
      subs,
      subPaused,
      subOverrides,
      onboarding,
      manualEvents,
      pots,
      startingSpare: previewStart,
    });
  }, [hover, name, subs, subPaused, subOverrides, onboarding, manualEvents, pots, previewStart]);

  return (
    <View style={layout.subActionsBlock}>
      <View style={layout.subActionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pause ${name}`}
          hitSlop={8}
          onPress={() => togglePaused(name, true)}
          style={({ pressed }) => [layout.textAction, pressed ? layout.pressed : undefined]}
        >
          <Text style={s.subTextAction}>Pause this</Text>
        </Pressable>
        <Text style={s.moveLabel}>Move</Text>
        {NUDGES.map((n) => (
          <Pressable
            key={n.d}
            accessibilityRole="button"
            accessibilityLabel={`Nudge ${name} by ${n.d > 0 ? '+' : ''}${n.d} days`}
            onPress={() => nudgeSub(name, n.d)}
            onPressIn={() => setHover(n.d)}
            onPressOut={() => setHover(null)}
            style={({ pressed }) => [s.nudgePill, pressed ? layout.pressed : undefined]}
          >
            <Text style={s.nudgePillLabel}>{n.label}</Text>
          </Pressable>
        ))}
        {currentDelta !== 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reset nudge on ${name}`}
            hitSlop={8}
            onPress={() => resetSubOverrides(name)}
            style={({ pressed }) => [layout.textAction, pressed ? layout.pressed : undefined]}
          >
            <Text style={s.resetLabel}>Reset</Text>
          </Pressable>
        ) : null}
      </View>

      {hover !== null && previewDelta !== null ? (
        <Text style={s.previewLine}>
          {previewDelta > 0
            ? `would free up £${previewDelta} on your lowest day`
            : previewDelta < 0
              ? `would cost £${Math.abs(previewDelta)} on your lowest day`
              : 'no change to your lowest day'}
        </Text>
      ) : null}
      {currentDelta !== 0 && hover === null ? (
        <Text style={s.nudgedCaption}>
          Nudged {currentDelta > 0 ? '+' : ''}
          {currentDelta}d from its usual day
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function capitalize(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

// ---------------------------------------------------------------------------
// Styles — layout-only (static) vs colour-bearing (makeStyles(t)), per the kit's DARK-MODE PATTERN.
// The screen lives in the shell's framed column (paddingHorizontal: 24); the web px-7 (28) inner pad
// is carried here so the content keeps its editorial side margin.
// ---------------------------------------------------------------------------

const layout = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: 4,
    gap: gap.xl,
  },

  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backHit: { minWidth: 44, minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerSpacer: { width: 44 },

  title: { gap: 4 },

  body: { gap: gap.xl },
  emptyWrap: { marginTop: 8 },

  // Legend — a two-column grid of dot + label.
  legend: { flexDirection: 'row', flexWrap: 'wrap' },
  legendItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  legendDot: { width: 6, height: 6, borderRadius: 3 },

  // Footer — three stacked full-width CTAs (a column on a narrow phone so long labels never truncate).
  footer: { gap: 8 },

  meloBlock: { marginTop: 4 },

  // Agenda
  agendaStack: { gap: gap.lg },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  dayHeadLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
  eventList: { gap: gap.sm, marginTop: 10 },
  eventListCompact: { gap: 6, marginTop: 8 },
  past: { opacity: 0.55 },
  pastMonth: { opacity: 0.45 },

  // Week
  weekStack: { gap: gap.md },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trendHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  strip: { flexDirection: 'row', gap: 4 },
  stripCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  stripDots: { flexDirection: 'row', gap: 2, marginTop: 4, height: 6, alignItems: 'center' },
  stripDot: { width: 4, height: 4, borderRadius: 2 },
  weekBlocks: { gap: gap.sm, marginTop: 8 },

  // Month
  monthStack: { gap: gap.md },
  weekdayRow: { flexDirection: 'row', gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  // 7 columns with 4px gaps between them → (100% − 6×4px) / 7. Expressed as a fixed-ish percentage
  // that leaves room for the gaps without overflowing.
  gridBlank: { width: '13.0%', aspectRatio: 1, minHeight: 44 },
  gridCell: {
    width: '13.0%',
    minHeight: 44,
    aspectRatio: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDots: { flexDirection: 'row', gap: 2, marginTop: 2, height: 4, alignItems: 'center' },
  gridDot: { width: 4, height: 4, borderRadius: 2 },
  sparkBlock: { paddingHorizontal: 4, paddingTop: 4 },

  // Event row
  eventRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  eventDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  eventBody: { flex: 1, minWidth: 0 },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  eventTitleFlex: { flexShrink: 1 },
  recurringRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },

  manualActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 4,
    marginTop: 8,
  },
  textAction: { paddingVertical: 6, justifyContent: 'center' },

  // Sub renewal actions
  subActionsBlock: { marginTop: 8 },
  subActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 6,
  },

  // See on Route
  seeOnRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 6,
  },
});

function makeStyles(t: Palette) {
  return StyleSheet.create({
    backGlyph: { fontSize: 20, fontWeight: '500' },
    eyebrow: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: 1.68,
      textTransform: 'uppercase',
    },

    // Title block
    kicker: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 28,
      lineHeight: 32,
      letterSpacing: -0.3,
    },
    headlineAccent: { color: t.calm },
    subhead: { color: t.muted, fontSize: 12.5, lineHeight: 17, marginTop: 4 },

    // Empty state — plain surface card (web bg-surface · hairline · rounded-2xl · p-6 · text-center),
    // a quoted italic Fraunces head + a muted body. No mascot, no shadow (the web card carries none).
    emptyCard: {
      backgroundColor: t.surface,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      padding: 24,
      alignItems: 'center',
    },
    emptyHead: {
      color: t.ink,
      fontFamily: serif.displayItalic,
      fontSize: 15,
      textAlign: 'center',
    },
    emptyBody: {
      color: t.muted,
      fontSize: 12,
      marginTop: 8,
      textAlign: 'center',
    },

    // Pre-mount calm frame
    skeletonCard: {
      minHeight: 280,
      backgroundColor: t.surface,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
    },

    // View switcher
    switcher: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: radius.xxl,
      backgroundColor: t.inset,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
    },
    tab: {
      flex: 1,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabSelected: {
      backgroundColor: t.canvas,
      ...elevation.card,
      shadowOpacity: 0.04,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
    },
    tabLabel: { color: t.muted, fontSize: 12.5 },
    tabLabelSelected: { color: t.ink },

    // Tightest-day pill
    pill: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: t.calmSoft,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    pillText: { color: t.ink, fontSize: 12.5, flexShrink: 1 },
    pillLead: { color: t.calm, fontWeight: '600' },
    pillGo: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: 1.44,
      textTransform: 'uppercase',
      flexShrink: 0,
    },

    // Legend
    legendLabel: { color: t.muted, fontSize: 11 },

    // Footer CTAs
    footerCtaAccent: {
      minHeight: 48,
      borderRadius: radius.xxl,
      backgroundColor: t.calm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    footerCtaAccentLabel: { color: t.inverse, fontSize: 12.5, fontWeight: '500' },
    footerCta: {
      minHeight: 48,
      borderRadius: radius.xxl,
      backgroundColor: t.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    footerCtaLabel: { color: t.ink, fontSize: 12.5 },

    // Day cards (agenda + week block)
    dayCard: {
      backgroundColor: t.surface,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      padding: 16,
    },
    dayCardTightest: { backgroundColor: t.calmSoft },
    weekBlock: {
      backgroundColor: t.surface,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      padding: 14,
    },
    dayHeader: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.47,
      textTransform: 'uppercase',
    },
    pastMarker: {
      color: t.muted,
      fontSize: 10.5,
      fontFamily: serif.displayItalic,
      textTransform: 'none',
    },
    spareRight: { color: t.muted, fontSize: 11, fontVariant: ['tabular-nums'] },

    // Month / week nav
    navRound: {
      width: 28,
      height: 28,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navArrow: { color: t.muted, fontSize: 18, lineHeight: 20 },
    monthLabelUpper: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: 1.68,
      textTransform: 'uppercase',
    },
    monthLabelDisplay: { color: t.ink, fontFamily: serif.display, fontSize: 16 },

    // Spare-trend card (week)
    trendCard: {
      backgroundColor: t.surface,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    trendLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.47,
      textTransform: 'uppercase',
    },
    trendRange: { color: t.muted, fontSize: 11, fontVariant: ['tabular-nums'] },

    // Week strip
    stripColTightest: { backgroundColor: t.calmSoft },
    stripColToday: { backgroundColor: t.inset },
    stripWeekday: {
      color: t.muted,
      fontSize: 9.5,
      letterSpacing: 1.14,
      textTransform: 'uppercase',
    },
    stripDay: { color: t.ink, fontSize: 14, marginTop: 2, fontVariant: ['tabular-nums'] },
    stripDayTightest: { color: t.calm, fontWeight: '500' },

    // Month grid
    weekdayCell: {
      flex: 1,
      textAlign: 'center',
      color: t.muted,
      fontSize: 9.5,
      letterSpacing: 1.14,
      textTransform: 'uppercase',
    },
    gridCellSelected: { backgroundColor: t.ink },
    gridCellTightest: { backgroundColor: t.calmSoft },
    gridCellToday: { backgroundColor: t.inset },
    gridDay: { color: t.ink, fontSize: 13, fontVariant: ['tabular-nums'] },
    gridDaySelected: { color: t.canvas },
    gridDayTightest: { color: t.calm, fontWeight: '500' },
    gridTick: { fontSize: 7, marginTop: 1 },

    // Selected-day panel (month)
    selectedPanel: {
      backgroundColor: t.surface,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      padding: 16,
      marginTop: 4,
    },
    nothingLine: {
      color: t.muted,
      fontSize: 12.5,
      fontFamily: serif.displayItalic,
      marginTop: 8,
    },

    // Event row
    eventTitle: { color: t.ink, fontSize: 13 },
    eventTitleCompact: { color: t.ink, fontSize: 12.5 },
    manualBadge: {
      color: t.muted,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    eventAmount: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
    },
    eventAmountCompact: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 12.5,
      fontVariant: ['tabular-nums'],
    },
    eventNote: { color: t.muted, fontSize: 11, marginTop: 2 },
    recurringGlyph: { color: t.muted, fontSize: 10.5 },
    recurringLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.26,
      textTransform: 'uppercase',
    },

    // Manual + sub actions
    moveLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.26,
      textTransform: 'uppercase',
    },
    nudgeRound: {
      width: 36,
      height: 36,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nudgeRoundLabel: { color: t.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
    removeLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.26,
      textTransform: 'uppercase',
    },
    subTextAction: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.26,
      textTransform: 'uppercase',
    },
    nudgePill: {
      minWidth: 44,
      height: 36,
      paddingHorizontal: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nudgePillLabel: { color: t.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
    resetLabel: {
      color: t.calm,
      fontSize: 10.5,
      letterSpacing: 1.26,
      textTransform: 'uppercase',
    },
    previewLine: {
      color: t.muted,
      fontSize: 10.5,
      fontFamily: serif.displayItalic,
      marginTop: 4,
    },
    nudgedCaption: {
      color: t.calm,
      fontSize: 10.5,
      fontFamily: serif.displayItalic,
      marginTop: 4,
    },

    // See on Route
    seeOnRouteLabel: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.32,
      textTransform: 'uppercase',
    },
    seeOnRouteArrow: { color: t.calm, fontSize: 14 },
  });
}
