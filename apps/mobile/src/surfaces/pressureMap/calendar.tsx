// Calendar — the time view of your money (Quiet Paper Luxury, theme-aware).
//
// Faithful RN port of the Lovable web ScreenCalendar.tsx. Three planner views over the SAME derived
// timeline — Month (grid + spare sparkline), Week (7-day strip + spare-trend), Agenda (chronological
// day blocks). Switching views never reloads data: every view reads the same `events` / `groups` /
// `spareByDay` props the container computed once.
//
// This screen is PRESENTATIONAL. The container (Phase-2 wiring) calls the Phase-1 engine —
// deriveCalendarEvents(ledger, asOfDateIso) + computeSparePerDay(events, openingBalanceMinor) —
// and passes the results down, plus the engine-mutator callbacks (sub nudge / pause, manual move /
// remove / add, export, connect) and the Route<->Calendar focus bridges. Nothing here touches the
// store, so it stays trivially testable and the engine opening-balance never leaks into the view.
//
// Web parity map (STATES.md "Calendar — view + interaction notes"):
//  • header: back / "What's coming" / spacer · kicker "Calendar" + serif headline accent
//  • tablist Month·Week·Agenda — switching never reloads data
//  • past days de-emphasised (~0.5 opacity) in every view
//  • tightest pill collapses to one line + "Jump ->" (onFocusTightest)
//  • each day/agenda panel: kind dots + labels + amounts + "See this day on the Route ->"
//  • sub rows: Pause this + -3d/-1d/+1d/+3d nudge (+ "Nudged +Nd" caption + Reset when override != 0)
//  • manual rows: -1d/+1d move + Remove
//  • footer: + Add an event · Add to your calendar app · Connect Google
//  • dynamic Melo line (empty / overspent / pinch / tight / calm bands) + missing-lever empty state

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import {
  Body,
  gap,
  Headline,
  magnitude,
  type Palette,
  PressureScreen,
  radius,
  Surface,
  useTheme,
} from './kit';
import { Kicker, MeloLine, ScreenHeader, type MeloTone } from './secondaryKit';
import type { DerivedCalendarEvent, DerivedCalendarEventKind } from '../../local/calendarEvents';

// ---------------------------------------------------------------------------
// Props — the clean container contract
// ---------------------------------------------------------------------------

/** One day's bucket of derived events, in engine sort order. Mirrors the shape returned by
 *  groupCalendarEventsByDay (the container can pass that result straight through). */
export type CalendarDayGroup = Readonly<{
  dateIso: string;
  events: readonly DerivedCalendarEvent[];
}>;

/** Running spare £ for a single day — one entry per money-moving day (engine SparePerDay). */
export type CalendarSparePerDay = Readonly<{ dateIso: string; spareMinor: number }>;

export type CalendarScreenProps = Readonly<{
  // Today, as the engine sees it (ledger.asOfDate). Drives past-day de-emphasis and the grid anchor —
  // passed in (never `new Date()`) so the screen agrees with the ledger to the day and stays pure.
  asOfDateIso: string;

  // The derived timeline (deriveCalendarEvents output) and its day grouping. `groups` is the same
  // data as `events`, pre-bucketed by the engine's groupCalendarEventsByDay — passed so the screen
  // never re-derives. `events.length === 0` is the empty state.
  events: readonly DerivedCalendarEvent[];
  groups: readonly CalendarDayGroup[];

  // Running spare-per-day (computeSparePerDay output) + the tightest point. The container computes
  // this from the events and the Route opening balance, so the view never needs the balance itself.
  spareByDay: readonly CalendarSparePerDay[];
  tightestDateIso: string | null;
  tightestSpareMinor: number;

  // Per-sub override map (ledger.subOverrides) — drives the "Nudged +Nd" caption + Reset visibility.
  subOverrides: Readonly<Record<string, number>>;

  // Which missing lever the empty state should name. The container reads onboarding/subs/pots and
  // sets these so the empty copy points the user at the right next input.
  missingPayday: boolean;
  missingBills: boolean;
  missingPots: boolean;

  // A specific day to jump to on mount (Route -> Calendar bridge). The container sets this from its
  // one-shot calendar focus date; the screen consumes it to pick the initial active day per view.
  focusDateIso?: string | undefined;

  // --- Navigation + bridges ---
  onBack: () => void;
  // Calendar -> Route: focus a given day on the money path (Today). Wired to setRouteFocusDate + go.
  onFocusOnRoute: (dateIso: string) => void;

  // --- Engine mutators (container wires to the canonical repository wrappers) ---
  // Sub rows: nudge a renewal by ±days (clamped ±7 in the store), pause it, or clear the override.
  onNudgeSub: (subName: string, deltaDays: number) => void;
  onPauseSub: (subName: string) => void;
  onResetSub: (subName: string) => void;
  // Manual rows: move a user event by ±days, or remove it.
  onUpdateEvent: (eventId: string, nextDateIso: string) => void;
  onRemoveEvent: (eventId: string) => void;
  // Sheets.
  onAddEvent: () => void;
  onExport: () => void;
  onConnect: () => void;
}>;

type CalendarView = 'month' | 'week' | 'agenda';

// ---------------------------------------------------------------------------
// Kind vocabulary (dots + screen-reader labels)
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<DerivedCalendarEventKind, string> = {
  in: 'Money in',
  out: 'Money out',
  review: 'Review',
  deadline: 'Deadline',
  manual: 'You added this',
};

// Dot colour per kind — resolved against the active palette so it follows the theme.
function kindColor(t: Palette, kind: DerivedCalendarEventKind): string {
  if (kind === 'in') return t.positive;
  if (kind === 'out') return t.repair;
  if (kind === 'review') return t.calm;
  if (kind === 'deadline') return t.caution;
  return t.muted; // manual
}

// ---------------------------------------------------------------------------
// Date helpers (local-time, ISO YYYY-MM-DD — no UTC drift)
// ---------------------------------------------------------------------------

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function parseIso(iso: string): Date {
  const parts = iso.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d);
}

function isoOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

const FULL_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** "MON 14 JUL" style day header. */
function dayHeader(iso: string): string {
  const d = parseIso(iso);
  const wd = WEEKDAY_SHORT[(d.getDay() + 6) % 7] ?? '';
  const mon = MONTH_NAMES[d.getMonth()] ?? '';
  return `${wd.toUpperCase()} ${d.getDate()} ${mon.slice(0, 3).toUpperCase()}`;
}

/** "Monday 14 July" prose for accessibility + the tightest pill. */
function dayProse(iso: string): string {
  const d = parseIso(iso);
  const wd = FULL_WEEKDAYS[d.getDay()] ?? '';
  const mon = MONTH_NAMES[d.getMonth()] ?? '';
  return `${wd} ${d.getDate()} ${mon}`;
}

/** Signed amount string, e.g. "+£1,200" / "-£42". Uses canonical formatting (magnitude) + an
 *  explicit sign so money-in vs money-out reads at a glance. */
function amountStr(e: DerivedCalendarEvent): string | null {
  if (typeof e.amountMinor !== 'number') return null;
  const sign = e.amountMinor >= 0 ? '+' : '-';
  return `${sign}${magnitude(e.amountMinor)}`;
}

function netForDay(events: readonly DerivedCalendarEvent[]): number {
  let n = 0;
  for (const e of events) if (typeof e.amountMinor === 'number') n += e.amountMinor;
  return n;
}

/** Spare-minor lookup by ISO day. */
function spareLookup(spareByDay: readonly CalendarSparePerDay[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of spareByDay) map[s.dateIso] = s.spareMinor;
  return map;
}

/** Screen-reader sentence for a day cell — colour dots alone don't carry meaning to assistive tech. */
function describeDay(
  iso: string,
  events: readonly DerivedCalendarEvent[] | undefined,
  spareMinor: number | undefined,
  isTightest: boolean,
): string {
  const head = dayProse(iso);
  if (!events || events.length === 0) return `${head}, nothing planned`;
  const parts = events.map((e) => {
    const amt = typeof e.amountMinor === 'number' ? ` ${magnitude(e.amountMinor)}` : '';
    return `${KIND_LABEL[e.kind].toLowerCase()}${amt} ${e.title}`;
  });
  const spareTxt =
    typeof spareMinor === 'number' ? `, ${magnitude(Math.max(0, spareMinor))} spare after` : '';
  const tightTxt = isTightest ? ', tightest day in the window' : '';
  return `${head}: ${parts.join('; ')}${spareTxt}${tightTxt}`;
}

// ---------------------------------------------------------------------------
// Melo voice — four bands so an overspent month never reads like "tight"
// ---------------------------------------------------------------------------

function meloCalendarLine(tightMinor: number, empty: boolean): string {
  if (empty) return 'Nothing pulling at your money this week.';
  if (tightMinor <= 0) return "The middle of the month runs short. Let's move something together.";
  if (tightMinor < 5000) return "There's a pinch coming. We can soften it together.";
  if (tightMinor < 20000) return 'A squeeze in the middle — but you should make it through.';
  return 'Quiet on most days. A few that matter.';
}

function meloCalendarMood(tightMinor: number, empty: boolean): MeloTone {
  if (empty) return 'soft';
  if (tightMinor < 5000) return 'alert';
  if (tightMinor < 20000) return 'soft';
  return 'calm';
}

// ===========================================================================
// Screen
// ===========================================================================

export function CalendarScreen(props: CalendarScreenProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const { events, groups, spareByDay, tightestDateIso, tightestSpareMinor, focusDateIso } = props;
  const isEmpty = events.length === 0;

  const spareMap = useMemo(() => spareLookup(spareByDay), [spareByDay]);
  const eventsByDay = useMemo(() => {
    const map: Record<string, readonly DerivedCalendarEvent[]> = {};
    for (const g of groups) map[g.dateIso] = g.events;
    return map;
  }, [groups]);

  const [view, setView] = useState<CalendarView>('agenda');

  return (
    <PressureScreen>
      <ScreenHeader label="What's coming" onBack={props.onBack} />

      <View style={layout.intro}>
        <Kicker>Calendar</Kicker>
        <Headline lead="What's " accent="coming and going." />
        <Body style={s.introBody}>Each day, what lands and what leaves.</Body>
      </View>

      {/* View switcher — switching never reloads data (same props feed every view). */}
      <View accessibilityRole="tablist" style={s.tablist}>
        {(['month', 'week', 'agenda'] as CalendarView[]).map((v) => {
          const active = view === v;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={v}
              onPress={() => setView(v)}
              style={[layout.tab, active ? s.tabActive : undefined]}
            >
              <Text style={[s.tabLabel, active ? s.tabLabelActive : undefined]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tightest-day pill — one line + Jump. Every view already paints the day; this is the bridge. */}
      {tightestDateIso && !isEmpty ? (
        <Pressable
          accessibilityHint="Jumps the active view to your lowest day."
          accessibilityRole="button"
          onPress={() => props.onFocusOnRoute(tightestDateIso)}
          style={({ pressed }) => [s.pill, pressed ? layout.pressed : undefined]}
        >
          <Text style={s.pillText} numberOfLines={1}>
            <Text style={s.pillAccent}>Lowest point: </Text>
            {dayProse(tightestDateIso)} · {magnitude(Math.max(0, tightestSpareMinor))} left
          </Text>
          <Text style={s.pillJump}>Jump →</Text>
        </Pressable>
      ) : null}

      {/* Body */}
      <View style={layout.body}>
        {isEmpty ? (
          <EmptyState
            missingPayday={props.missingPayday}
            missingBills={props.missingBills}
            missingPots={props.missingPots}
          />
        ) : view === 'agenda' ? (
          <AgendaView
            asOfDateIso={props.asOfDateIso}
            groups={groups}
            spareMap={spareMap}
            tightestDateIso={tightestDateIso}
            focusDateIso={focusDateIso}
            props={props}
          />
        ) : view === 'week' ? (
          <WeekView
            asOfDateIso={props.asOfDateIso}
            eventsByDay={eventsByDay}
            spareMap={spareMap}
            tightestDateIso={tightestDateIso}
            focusDateIso={focusDateIso}
            props={props}
          />
        ) : (
          <MonthView
            asOfDateIso={props.asOfDateIso}
            eventsByDay={eventsByDay}
            spareMap={spareMap}
            tightestDateIso={tightestDateIso}
            focusDateIso={focusDateIso}
            props={props}
          />
        )}
      </View>

      {/* Legend */}
      <View style={layout.legend}>
        {(['in', 'out', 'review', 'deadline'] as DerivedCalendarEventKind[]).map((kind) => (
          <View key={kind} style={layout.legendItem}>
            <View style={[layout.legendDot, { backgroundColor: kindColor(t, kind) }]} />
            <Text style={s.legendLabel}>{KIND_LABEL[kind]}</Text>
          </View>
        ))}
      </View>

      {/* Footer actions */}
      <View style={layout.footer}>
        <Pressable
          accessibilityHint="Adds a one-off money event to the calendar."
          accessibilityRole="button"
          onPress={props.onAddEvent}
          style={({ pressed }) => [s.footerPrimary, pressed ? layout.pressed : undefined]}
        >
          <Text style={s.footerPrimaryLabel}>+ Add an event</Text>
        </Pressable>
        <Pressable
          accessibilityHint="Exports paydays, bills and deadlines to your calendar app."
          accessibilityRole="button"
          onPress={props.onExport}
          style={({ pressed }) => [s.footerGhost, pressed ? layout.pressed : undefined]}
        >
          <Text style={s.footerGhostLabel}>Add to your calendar app</Text>
        </Pressable>
        <Pressable
          accessibilityHint="Connects your Google Calendar."
          accessibilityRole="button"
          onPress={props.onConnect}
          style={({ pressed }) => [s.footerGhost, pressed ? layout.pressed : undefined]}
        >
          <Text style={s.footerGhostLabel}>Connect Google</Text>
        </Pressable>
      </View>

      <MeloLine
        text={meloCalendarLine(tightestSpareMinor, isEmpty)}
        tone={meloCalendarMood(tightestSpareMinor, isEmpty)}
      />
    </PressureScreen>
  );
}

// ---------------------------------------------------------------------------
// Empty state — names the missing lever (payday / bills / pots)
// ---------------------------------------------------------------------------

function EmptyState({
  missingPayday,
  missingBills,
  missingPots,
}: {
  missingPayday: boolean;
  missingBills: boolean;
  missingPots: boolean;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
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
    <Surface style={layout.empty}>
      <Text style={s.emptyHead}>“{head}”</Text>
      <Text style={s.emptyLine}>{line}</Text>
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Agenda view — chronological day blocks
// ---------------------------------------------------------------------------

function AgendaView({
  asOfDateIso,
  groups,
  spareMap,
  tightestDateIso,
  focusDateIso,
  props,
}: {
  asOfDateIso: string;
  groups: readonly CalendarDayGroup[];
  spareMap: Record<string, number>;
  tightestDateIso: string | null;
  focusDateIso: string | undefined;
  props: CalendarScreenProps;
}) {
  return (
    <View style={layout.agenda}>
      {groups.map((g) => (
        <DayPanel
          key={g.dateIso}
          dateIso={g.dateIso}
          events={g.events}
          spareMinor={spareMap[g.dateIso]}
          asOfDateIso={asOfDateIso}
          isTightest={g.dateIso === tightestDateIso}
          isFocused={g.dateIso === focusDateIso}
          props={props}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Week view — 7-day strip + spare-trend SVG
// ---------------------------------------------------------------------------

function WeekView({
  asOfDateIso,
  eventsByDay,
  spareMap,
  tightestDateIso,
  focusDateIso,
  props,
}: {
  asOfDateIso: string;
  eventsByDay: Record<string, readonly DerivedCalendarEvent[]>;
  spareMap: Record<string, number>;
  tightestDateIso: string | null;
  focusDateIso: string | undefined;
  props: CalendarScreenProps;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  // Anchor the week on the focus/tightest day if set, else this week — derived, no effect needed.
  const initialOffset = useMemo(
    () => weekOffsetFor(asOfDateIso, focusDateIso ?? tightestDateIso),
    [asOfDateIso, focusDateIso, tightestDateIso],
  );
  const [offset, setOffset] = useState(initialOffset);

  const weekStart = useMemo(() => {
    const d = parseIso(asOfDateIso);
    const dow = (d.getDay() + 6) % 7; // Mon = 0
    d.setDate(d.getDate() - dow + offset * 7);
    return d;
  }, [asOfDateIso, offset]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  // Spare trend — spare £ at end of each day, carried forward when a day has no events.
  const trend = useMemo(() => {
    const vals: number[] = [];
    let last = 0;
    for (const d of days) {
      const iso = isoOf(d);
      if (typeof spareMap[iso] === 'number') last = spareMap[iso];
      vals.push(last);
    }
    return vals;
  }, [days, spareMap]);

  const minV = Math.min(...trend);
  const maxV = Math.max(...trend);
  const monthLabel = `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

  return (
    <View style={layout.weekWrap}>
      <View style={layout.weekNav}>
        <StepButton label="‹" hint="Previous week" onPress={() => setOffset((o) => o - 1)} s={s} />
        <Text style={s.weekMonth}>{monthLabel}</Text>
        <StepButton label="›" hint="Next week" onPress={() => setOffset((o) => o + 1)} s={s} />
      </View>

      {/* Spare trend */}
      <Surface style={layout.trendCard}>
        <View style={layout.trendHead}>
          <Text style={s.trendLabel}>What's left this week</Text>
          <Text style={s.trendRange}>
            low {magnitude(Math.max(0, minV))} · high {magnitude(Math.max(0, maxV))}
          </Text>
        </View>
        <Sparkline values={trend} color={t.calm} height={26} markTightest />
      </Surface>

      {/* Strip */}
      <View style={layout.strip}>
        {days.map((d) => {
          const iso = isoOf(d);
          const evs = eventsByDay[iso] ?? [];
          const isTightest = iso === tightestDateIso;
          const isPast = iso < asOfDateIso;
          return (
            <View
              accessibilityLabel={describeDay(iso, evs, spareMap[iso], isTightest)}
              key={iso}
              style={[
                layout.stripCell,
                isTightest ? s.stripCellTight : undefined,
                isPast ? layout.past : undefined,
              ]}
            >
              <Text style={s.stripDow}>{WEEKDAY_INITIALS[(d.getDay() + 6) % 7]}</Text>
              <Text style={[s.stripDate, isTightest ? s.stripDateTight : undefined]}>
                {d.getDate()}
              </Text>
              <View style={layout.stripDots}>
                {evs.slice(0, 4).map((e) => (
                  <View
                    key={e.id}
                    style={[layout.dotSmall, { backgroundColor: kindColor(t, e.kind) }]}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {/* Day blocks for days with events */}
      <View style={layout.weekBlocks}>
        {days.map((d) => {
          const iso = isoOf(d);
          const evs = eventsByDay[iso] ?? [];
          if (evs.length === 0) return null;
          return (
            <DayPanel
              key={iso}
              dateIso={iso}
              events={evs}
              spareMinor={spareMap[iso]}
              asOfDateIso={asOfDateIso}
              isTightest={iso === tightestDateIso}
              isFocused={iso === focusDateIso}
              props={props}
            />
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Month view — grid with up/down ticks + selected-day panel + spare sparkline
// ---------------------------------------------------------------------------

function MonthView({
  asOfDateIso,
  eventsByDay,
  spareMap,
  tightestDateIso,
  focusDateIso,
  props,
}: {
  asOfDateIso: string;
  eventsByDay: Record<string, readonly DerivedCalendarEvent[]>;
  spareMap: Record<string, number>;
  tightestDateIso: string | null;
  focusDateIso: string | undefined;
  props: CalendarScreenProps;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const initialOffset = useMemo(
    () => monthOffsetFor(asOfDateIso, focusDateIso ?? tightestDateIso),
    [asOfDateIso, focusDateIso, tightestDateIso],
  );
  const [offset, setOffset] = useState(initialOffset);
  const [selected, setSelected] = useState<string>(focusDateIso ?? asOfDateIso);

  const anchor = useMemo(() => {
    const d = parseIso(asOfDateIso);
    return new Date(d.getFullYear(), d.getMonth() + offset, 1);
  }, [asOfDateIso, offset]);

  const cells = useMemo(() => {
    const startDow = (anchor.getDay() + 6) % 7;
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      arr.push(new Date(anchor.getFullYear(), anchor.getMonth(), d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [anchor]);

  // Spare line under the grid — carries spare forward through every day of the month.
  const spareLine = useMemo(() => {
    const vals: number[] = [];
    let last = 0;
    for (const c of cells) {
      if (!c) continue;
      const iso = isoOf(c);
      if (typeof spareMap[iso] === 'number') last = spareMap[iso];
      vals.push(last);
    }
    return vals;
  }, [cells, spareMap]);
  const minS = spareLine.length ? Math.min(...spareLine) : 0;

  const monthLabel = `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
  const selectedEvents = eventsByDay[selected] ?? [];

  return (
    <View style={layout.monthWrap}>
      <View style={layout.weekNav}>
        <StepButton label="‹" hint="Previous month" onPress={() => setOffset((o) => o - 1)} s={s} />
        <Text style={s.monthLabel}>{monthLabel}</Text>
        <StepButton label="›" hint="Next month" onPress={() => setOffset((o) => o + 1)} s={s} />
      </View>

      <View style={layout.weekHead}>
        {WEEKDAY_INITIALS.map((d, i) => (
          <Text key={i} style={s.weekHeadCell}>
            {d}
          </Text>
        ))}
      </View>

      <View style={layout.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={`x${i}`} style={layout.gridCell} />;
          const iso = isoOf(d);
          const evs = eventsByDay[iso] ?? [];
          const isToday = iso === asOfDateIso;
          const isTightest = iso === tightestDateIso;
          const isSelected = iso === selected;
          const isPast = iso < asOfDateIso;
          const net = netForDay(evs);
          const tick = net > 0 ? '▲' : net < 0 ? '▼' : '';
          const tickColor = net > 0 ? t.positive : t.repair;
          return (
            <View key={iso} style={layout.gridCell}>
              <Pressable
                accessibilityLabel={describeDay(iso, evs, spareMap[iso], isTightest)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelected(iso)}
                style={[
                  layout.gridDay,
                  isSelected
                    ? s.gridDaySelected
                    : isTightest
                      ? s.gridDayTight
                      : isToday
                        ? s.gridDayToday
                        : undefined,
                  isPast && !isSelected ? layout.pastDeep : undefined,
                ]}
              >
                <Text
                  style={[
                    s.gridDayText,
                    isSelected
                      ? s.gridDayTextSelected
                      : isTightest
                        ? s.gridDayTextTight
                        : undefined,
                  ]}
                >
                  {d.getDate()}
                </Text>
                {tick ? (
                  <Text style={[s.gridTick, { color: isSelected ? t.inverse : tickColor }]}>
                    {tick}
                  </Text>
                ) : null}
                <View style={layout.gridDots}>
                  {evs.slice(0, 3).map((e) => (
                    <View
                      key={e.id}
                      style={[
                        layout.dotTiny,
                        { backgroundColor: isSelected ? t.inverse : kindColor(t, e.kind) },
                      ]}
                    />
                  ))}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Spare-line sparkline */}
      {spareLine.length > 1 ? (
        <View style={layout.monthSpark}>
          <View style={layout.trendHead}>
            <Text style={s.trendLabel}>Spare across the month</Text>
            <Text style={s.trendRange}>low {magnitude(Math.max(0, minS))}</Text>
          </View>
          <Sparkline values={spareLine} color={t.calm} height={20} />
        </View>
      ) : null}

      {/* Selected-day panel */}
      <Surface style={layout.selectedPanel}>
        <Text style={s.panelHead}>{dayHeader(selected)}</Text>
        {selectedEvents.length === 0 ? (
          <Text style={s.panelEmpty}>Nothing moves your money on this day.</Text>
        ) : (
          <View style={layout.panelEvents}>
            {selectedEvents.map((e) => (
              <EventRow key={e.id} event={e} props={props} />
            ))}
          </View>
        )}
        {selected >= asOfDateIso ? <SeeOnRoute dateIso={selected} props={props} /> : null}
      </Surface>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Day panel — shared by Agenda + Week blocks
// ---------------------------------------------------------------------------

function DayPanel({
  dateIso,
  events,
  spareMinor,
  asOfDateIso,
  isTightest,
  isFocused,
  props,
}: {
  dateIso: string;
  events: readonly DerivedCalendarEvent[];
  spareMinor: number | undefined;
  asOfDateIso: string;
  isTightest: boolean;
  isFocused: boolean;
  props: CalendarScreenProps;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const isPast = dateIso < asOfDateIso;
  return (
    <View
      style={[
        s.dayPanel,
        isTightest ? s.dayPanelTight : undefined,
        isFocused ? s.dayPanelFocused : undefined,
        isPast ? layout.past : undefined,
      ]}
    >
      <View style={layout.dayPanelHead}>
        <Text style={s.panelHead}>
          {dayHeader(dateIso)}
          {isPast ? <Text style={s.panelPast}> past</Text> : null}
        </Text>
        {typeof spareMinor === 'number' ? (
          <Text style={s.panelSpare}>{magnitude(Math.max(0, spareMinor))} left after</Text>
        ) : null}
      </View>
      <View style={layout.panelEvents}>
        {events.map((e) => (
          <EventRow key={e.id} event={e} props={props} />
        ))}
      </View>
      {!isPast ? <SeeOnRoute dateIso={dateIso} props={props} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Event row — kind dot + label + amount + per-event actions
// ---------------------------------------------------------------------------

function EventRow({ event, props }: { event: DerivedCalendarEvent; props: CalendarScreenProps }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const amt = amountStr(event);
  const recurringLabel =
    event.recurring === 'monthly'
      ? 'Repeats monthly'
      : event.recurring === 'yearly'
        ? 'Repeats yearly'
        : null;

  return (
    <View style={layout.eventRow}>
      <View style={[layout.eventDot, { backgroundColor: kindColor(t, event.kind) }]} />
      <View style={layout.eventBody}>
        <View style={layout.eventTitleRow}>
          <Text style={s.eventTitle} numberOfLines={1}>
            {/* sr-only kind label so the dot colour isn't the only signal */}
            <Text accessibilityElementsHidden style={layout.srOnly}>
              {KIND_LABEL[event.kind]}:{' '}
            </Text>
            {event.title}
            {event.manual ? <Text style={s.youAdded}> you added this</Text> : null}
          </Text>
          {amt ? (
            <Text style={[s.eventAmount, event.kind === 'in' ? s.eventAmountIn : undefined]}>
              {amt}
            </Text>
          ) : null}
        </View>
        {event.note ? <Text style={s.eventNote}>{event.note}</Text> : null}
        {recurringLabel ? <Text style={s.recurring}>↻ {recurringLabel}</Text> : null}

        {/* Per-event actions */}
        {event.source === 'sub' && event.subName ? (
          <SubRenewalActions
            subName={event.subName}
            currentDelta={props.subOverrides[event.subName] ?? 0}
            props={props}
          />
        ) : event.manual ? (
          <View style={layout.actionRow}>
            <Text style={s.actionLabel}>Move</Text>
            <NudgeButton
              label="-1d"
              hint="Move one day earlier"
              onPress={() => props.onUpdateEvent(event.id, shiftIso(event.dateIso, -1))}
              s={s}
            />
            <NudgeButton
              label="+1d"
              hint="Move one day later"
              onPress={() => props.onUpdateEvent(event.id, shiftIso(event.dateIso, 1))}
              s={s}
            />
            <Pressable
              accessibilityHint="Removes this event."
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => props.onRemoveEvent(event.id)}
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
// Sub renewal actions — Pause + ±1d/±3d nudge + caption/Reset when overridden
// ---------------------------------------------------------------------------

function SubRenewalActions({
  subName,
  currentDelta,
  props,
}: {
  subName: string;
  currentDelta: number;
  props: CalendarScreenProps;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const nudges: { d: number; label: string }[] = [
    { d: -3, label: '-3d' },
    { d: -1, label: '-1d' },
    { d: 1, label: '+1d' },
    { d: 3, label: '+3d' },
  ];
  return (
    <View style={layout.subActions}>
      <View style={layout.actionRow}>
        <Pressable
          accessibilityHint={`Pauses ${subName}.`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => props.onPauseSub(subName)}
        >
          <Text style={s.actionLabel}>Pause this</Text>
        </Pressable>
        <Text style={s.actionLabel}>Move</Text>
        {nudges.map((n) => (
          <NudgeButton
            key={n.d}
            label={n.label}
            hint={`Nudge ${subName} by ${n.d > 0 ? '+' : ''}${n.d} days`}
            onPress={() => props.onNudgeSub(subName, n.d)}
            s={s}
          />
        ))}
        {currentDelta !== 0 ? (
          <Pressable
            accessibilityHint={`Resets the nudge on ${subName}.`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => props.onResetSub(subName)}
          >
            <Text style={s.resetLabel}>Reset</Text>
          </Pressable>
        ) : null}
      </View>
      {currentDelta !== 0 ? (
        <Text style={s.nudgedCaption}>
          Nudged {currentDelta > 0 ? '+' : ''}
          {currentDelta}d from its usual day
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// See-on-Route bridge
// ---------------------------------------------------------------------------

function SeeOnRoute({ dateIso, props }: { dateIso: string; props: CalendarScreenProps }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      accessibilityHint="Shows this day on your money path."
      accessibilityLabel={`See ${dayProse(dateIso)} on your money path`}
      accessibilityRole="button"
      onPress={() => props.onFocusOnRoute(dateIso)}
      style={({ pressed }) => [layout.seeRoute, pressed ? layout.pressed : undefined]}
    >
      <Text style={s.seeRouteLabel}>See this day on your money path</Text>
      <Text style={s.seeRouteArrow}>→</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Small reusable bits
// ---------------------------------------------------------------------------

function NudgeButton({
  label,
  hint,
  onPress,
  s,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [s.nudge, pressed ? layout.pressed : undefined]}
    >
      <Text style={s.nudgeLabel}>{label}</Text>
    </Pressable>
  );
}

function StepButton({
  label,
  hint,
  onPress,
  s,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={hint}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [s.step, pressed ? layout.pressed : undefined]}
    >
      <Text style={s.stepLabel}>{label}</Text>
    </Pressable>
  );
}

/** A spare-trend polyline. `values` are minor units; the line is normalised to its own min/max. */
function Sparkline({
  values,
  color,
  height,
  markTightest,
}: {
  values: readonly number[];
  color: string;
  height: number;
  markTightest?: boolean | undefined;
}) {
  if (values.length < 2) return null;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(1, maxV - minV);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = height - 2 - ((v - minV) / span) * (height - 4);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const tightIdx = values.indexOf(minV);
  return (
    <Svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {markTightest && tightIdx >= 0 ? (
        <Circle
          cx={(tightIdx / (values.length - 1)) * 100}
          cy={height - 2 - ((minV - minV) / span) * (height - 4)}
          r={1.8}
          fill={color}
        />
      ) : null}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Offset helpers — which week/month index contains `target` relative to asOf
// ---------------------------------------------------------------------------

function weekOffsetFor(asOfDateIso: string, target: string | null): number {
  if (!target) return 0;
  const t = parseIso(target);
  const baseMon = parseIso(asOfDateIso);
  baseMon.setDate(baseMon.getDate() - ((baseMon.getDay() + 6) % 7));
  const diffDays = Math.round((t.getTime() - baseMon.getTime()) / 86_400_000);
  return Math.floor(diffDays / 7);
}

function monthOffsetFor(asOfDateIso: string, target: string | null): number {
  if (!target) return 0;
  const t = parseIso(target);
  const base = parseIso(asOfDateIso);
  return (t.getFullYear() - base.getFullYear()) * 12 + (t.getMonth() - base.getMonth());
}

// ===========================================================================
// Styles
// ===========================================================================

const layout = StyleSheet.create({
  pressed: { opacity: 0.6 },
  past: { opacity: 0.52 },
  pastDeep: { opacity: 0.45 },
  srOnly: { width: 0, height: 0 },

  intro: { gap: gap.xs },
  body: { gap: gap.md },

  tab: {
    flex: 1,
    height: 38,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: gap.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: gap.xs, width: '50%' },
  legendDot: { width: 7, height: 7, borderRadius: 4 },

  footer: { flexDirection: 'row', gap: gap.sm },

  empty: { alignItems: 'center', paddingVertical: gap.xxl },

  agenda: { gap: gap.md },

  // Week
  weekWrap: { gap: gap.md },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trendCard: { paddingVertical: gap.md, paddingHorizontal: gap.md, gap: gap.xs },
  trendHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  strip: { flexDirection: 'row', gap: 4 },
  stripCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: gap.xs,
    borderRadius: radius.md,
    gap: 2,
  },
  stripDots: { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center' },
  dotSmall: { width: 4, height: 4, borderRadius: 2 },
  weekBlocks: { gap: gap.sm },

  // Month
  monthWrap: { gap: gap.md },
  weekHead: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  gridDay: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  gridDots: { flexDirection: 'row', gap: 2, height: 4, alignItems: 'center' },
  dotTiny: { width: 4, height: 4, borderRadius: 2 },
  monthSpark: { gap: gap.xs, paddingHorizontal: gap.xs },
  selectedPanel: { gap: gap.sm },
  panelEvents: { gap: gap.sm },

  // Day panel
  dayPanelHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },

  // Event row
  eventRow: { flexDirection: 'row', gap: gap.sm, alignItems: 'flex-start' },
  eventDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  eventBody: { flex: 1, gap: 2 },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: gap.sm,
  },

  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: gap.sm,
    marginTop: 4,
  },
  subActions: { marginTop: 2, gap: 2 },

  seeRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: gap.sm,
  },
});

function makeStyles(t: Palette) {
  return StyleSheet.create({
    introBody: { color: t.muted, fontSize: 13, marginTop: 2 },

    tablist: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: radius.lg,
      backgroundColor: t.inset,
    },
    tabActive: {
      backgroundColor: t.surface,
      ...{
        shadowColor: t.ink,
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      },
    },
    tabLabel: { color: t.muted, fontSize: 13, fontWeight: '600' },
    tabLabelActive: { color: t.ink },

    pill: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: gap.sm,
      backgroundColor: t.calmSoft,
      borderRadius: radius.lg,
      paddingVertical: gap.sm,
      paddingHorizontal: gap.md,
    },
    pillText: { flex: 1, color: t.ink, fontSize: 13 },
    pillAccent: { color: t.calmStrong, fontWeight: '700' },
    pillJump: { color: t.calmStrong, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },

    emptyHead: {
      color: t.ink,
      fontFamily: 'Fraunces_500Medium_Italic',
      fontSize: 16,
      textAlign: 'center',
    },
    emptyLine: { color: t.muted, fontSize: 13, textAlign: 'center', marginTop: gap.xs },

    // Week
    weekMonth: {
      color: t.muted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    trendLabel: {
      color: t.muted,
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    trendRange: { color: t.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
    stripCellTight: { backgroundColor: t.calmSoft },
    stripDow: {
      color: t.muted,
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    stripDate: { color: t.ink, fontSize: 14, fontVariant: ['tabular-nums'] },
    stripDateTight: { color: t.calmStrong, fontWeight: '700' },

    // Month
    monthLabel: { color: t.ink, fontFamily: 'Fraunces_600SemiBold', fontSize: 16 },
    weekHeadCell: {
      flex: 1,
      textAlign: 'center',
      color: t.muted,
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    gridDaySelected: { backgroundColor: t.ink },
    gridDayTight: { backgroundColor: t.calmSoft },
    gridDayToday: { backgroundColor: t.inset },
    gridDayText: { color: t.ink, fontSize: 13, fontVariant: ['tabular-nums'], lineHeight: 15 },
    gridDayTextSelected: { color: t.inverse },
    gridDayTextTight: { color: t.calmStrong, fontWeight: '700' },
    gridTick: { fontSize: 7, lineHeight: 8 },

    // Day panel
    dayPanel: {
      backgroundColor: t.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      padding: gap.md,
      gap: gap.sm,
    },
    dayPanelTight: { backgroundColor: t.calmSoft, borderColor: t.calmSoft },
    dayPanelFocused: { borderColor: t.calm },
    panelHead: {
      color: t.muted,
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    panelPast: {
      color: t.muted,
      fontStyle: 'italic',
      letterSpacing: 0,
      textTransform: 'none',
      fontWeight: '400',
    },
    panelSpare: { color: t.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
    panelEmpty: { color: t.muted, fontSize: 13, fontStyle: 'italic' },

    // Event row
    eventTitle: { flex: 1, color: t.ink, fontSize: 13 },
    youAdded: { color: t.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
    eventAmount: {
      color: t.ink,
      fontSize: 13,
      fontFamily: 'Fraunces_600SemiBold',
      fontVariant: ['tabular-nums'],
    },
    eventAmountIn: { color: t.positiveInk },
    eventNote: { color: t.muted, fontSize: 11 },
    recurring: { color: t.muted, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase' },

    actionLabel: {
      color: t.muted,
      fontSize: 10.5,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    nudge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairlineStrong,
    },
    nudgeLabel: { color: t.secondary, fontSize: 11, fontVariant: ['tabular-nums'] },
    removeLabel: {
      color: t.repairInk,
      fontSize: 10.5,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    resetLabel: {
      color: t.calmStrong,
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    nudgedCaption: { color: t.calmStrong, fontSize: 10.5, fontStyle: 'italic' },

    seeRouteLabel: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    seeRouteArrow: { color: t.calmStrong, fontSize: 13, fontWeight: '700' },

    step: {
      width: 30,
      height: 30,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepLabel: { color: t.secondary, fontSize: 18, lineHeight: 20 },

    footerPrimary: {
      flex: 1,
      height: 48,
      borderRadius: radius.lg,
      backgroundColor: t.calmStrong,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    footerPrimaryLabel: {
      color: t.inverse,
      fontSize: 12.5,
      fontWeight: '700',
      textAlign: 'center',
    },
    footerGhost: {
      flex: 1,
      height: 48,
      borderRadius: radius.lg,
      backgroundColor: t.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    footerGhostLabel: { color: t.ink, fontSize: 12, textAlign: 'center' },

    legendLabel: { color: t.muted, fontSize: 11 },
  });
}
