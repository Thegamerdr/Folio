// SheetDayDetail — the faithful 1:1 React Native port of the web full-detail day drill-in
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetDayDetail.tsx).
//
// @rn-sheet    SheetDayDetail
// @rn-stack    Calendar (Month cell tap · +N chip · Week day header)
// @purpose     Full-detail day drill-in — the sheet the Month/Week views open when a user taps a
//              cell or the "+N" overflow chip. Same events, same spare-after, same tightest flag
//              as the inline selected-day panel, plus a "See on money path" bridge back to
//              Today's Route.
// @reads       calendarEvents (via deriveCalendarEvents) · currentBalance · subs/subPaused/
//              subOverrides · pots · onboarding — all REAL, read through useAppStore, exactly the
//              same derivation CalendarScreen uses so the sheet never disagrees with the cell it
//              opened from.
// @writes      — (per-event actions inside EventRow do the writes; this sheet itself writes only
//              the Route/Calendar focus-date bridges on its own two footer actions)
// @copy        FROZEN
// @tokens      --paper --surface --hairline --inset --accent --accent-soft --positive --negative
//              --caution --muted-ink · Fraunces headline (mapped: surface/hairline/inset/calm/
//              calmSoft/positive/repair/caution/muted per '@/folio/theme')
// @motion      sheet-rise + scrim-in (inherited from Sheet) · press 0.97 on the two footer buttons;
//              collapses to final state under reduce-motion (MOTION.md)
//
// Faithful 1:1 RN port. The web source renders ONE branch — the day summary + full event list —
// there is no separate empty/loading/error/offline branch for this sheet (STATES.md has no row for
// it); an empty day renders the "Nothing moves your money" headline + "No events" line inline,
// exactly as the web did. Per MELO_MOODS.md this sheet renders NO Melo ("No mood = no Melo").
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme'
// (which re-exports the pressure-map kit). EventRow + its style-object builder are reused verbatim
// from '@/folio/screens/CalendarScreen' (now exported for this purpose) so the day's events render
// pixel-identically to the inline Agenda/Week/Month panels — "the sheet must never disagree with
// the cell it opened from," per the web doc block. Nothing new is defined — no colour, font,
// spacing, or dependency.
//
// This sheet OWNS its Sheet host (visible / onClose), mounted as a sibling in the shell — mirroring
// the AddEventSheet + EditTxnSheet pattern — so it never nests inside the generic sheet host.

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { useAppStore, setRouteFocusDate, setCalendarFocusDate } from '@/folio/store';
import {
  deriveCalendarEvents,
  groupByDay,
  computeSpareAndTightest,
  formatDayHeader,
  formatDayProse,
} from '@/folio/lib/calendarEvents';
import { EventRow, makeStyles as makeCalendarStyles } from '@/folio/screens/CalendarScreen';
import type { Nav } from '@/folio/types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type SheetDayDetailProps = {
  visible: boolean;
  onClose: () => void;
  nav: Nav;
  /** ISO date (YYYY-MM-DD) to show. */
  date: string;
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function SheetDayDetail({ visible, onClose, nav, date }: SheetDayDetailProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  // The exact style object EventRow (and its per-event sub-controls) expect — reused verbatim from
  // CalendarScreen so the day's rows render pixel-identically to the inline panels.
  const rowStyles = useMemo(() => makeCalendarStyles(t), [t]);

  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const subOverrides = useAppStore((st) => st.subOverrides);
  const onboarding = useAppStore((st) => st.onboarding);
  const manual = useAppStore((st) => st.calendarEvents);
  const pots = useAppStore((st) => st.pots);
  const currentBalance = useAppStore((st) => st.currentBalance);

  // Same derivation the calendar screen uses — the sheet must never disagree with the cell it
  // opened from. `now` is stable per-render (no clock ticking inside a sheet), mirroring the web's
  // useMemo([]) — it only needs to be "today" at open time.
  const now = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const events = useMemo(
    () =>
      deriveCalendarEvents({
        subs,
        subPaused,
        subOverrides,
        onboarding,
        manualEvents: manual,
        pots,
        now,
      }),
    [subs, subPaused, subOverrides, onboarding, manual, pots, now],
  );

  const groups = useMemo(() => groupByDay(events), [events]);
  const { spareByDay, tightestDate } = useMemo(
    () => computeSpareAndTightest(groups, currentBalance.amount),
    [groups, currentBalance.amount],
  );

  const dayEvents = useMemo(
    () => groups.find((g) => g.date === date)?.events ?? [],
    [groups, date],
  );

  const spare = spareByDay[date];
  const isTightest = date === tightestDate;
  const today = todayIso();
  const isFuture = date >= today;

  // Net £ movement on this specific day — the fastest read.
  const net = useMemo(
    () => dayEvents.reduce((n, e) => n + (typeof e.amount === 'number' ? e.amount : 0), 0),
    [dayEvents],
  );

  // In / out split — the second-fastest read; a calm two-line summary.
  const { moneyIn, moneyOut } = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    for (const e of dayEvents) {
      if (typeof e.amount !== 'number') continue;
      if (e.amount >= 0) inSum += e.amount;
      else outSum += Math.abs(e.amount);
    }
    return { moneyIn: inSum, moneyOut: outSum };
  }, [dayEvents]);

  const seeOnRoute = () => {
    setRouteFocusDate(date);
    onClose();
    nav.go('today');
  };

  const headline =
    dayEvents.length === 0 ? (
      <>
        Nothing moves your <Text style={s.accentWord}>money</Text>.
      </>
    ) : isTightest ? (
      <>
        The <Text style={s.accentWord}>tightest</Text> day this window.
      </>
    ) : net >= 0 ? (
      <>
        A day of <Text style={s.accentWord}>lift</Text>.
      </>
    ) : (
      <>
        A day of <Text style={s.accentWord}>outflow</Text>.
      </>
    );

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View>
          <Text style={s.eyebrow}>{formatDayHeader(date)}</Text>
          <Text accessibilityRole="header" style={s.headline}>
            {headline}
          </Text>
        </View>

        {/* Money summary — in / out / spare after, calm and tabular. */}
        {dayEvents.length > 0 ? (
          <View style={s.summaryRow}>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>In</Text>
              <Text style={[s.summaryValue, { color: t.positive }]}>
                +£{moneyIn.toFixed(moneyIn % 1 === 0 ? 0 : 2)}
              </Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>Out</Text>
              <Text style={[s.summaryValue, { color: t.ink }]}>
                −£{moneyOut.toFixed(moneyOut % 1 === 0 ? 0 : 2)}
              </Text>
            </View>
            <View
              style={[
                s.summaryCell,
                isTightest ? { backgroundColor: t.calmSoft } : { backgroundColor: t.surface },
              ]}
            >
              <Text style={s.summaryLabel}>Spare after</Text>
              <Text style={[s.summaryValue, { color: isTightest ? t.calm : t.ink }]}>
                {typeof spare === 'number' ? `£${Math.max(0, Math.round(spare))}` : '—'}
              </Text>
            </View>
          </View>
        ) : null}

        {isTightest ? (
          <Text style={s.tightestNote}>
            This is the tightest day in the current window. Anything you move earlier lifts the
            whole picture.
          </Text>
        ) : null}

        {/* Full event list — every occurrence, no collapsing. */}
        <View style={s.eventsBlock}>
          <Text style={s.eventsLabel}>
            {dayEvents.length === 0
              ? 'No events'
              : `${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`}
          </Text>
          {dayEvents.length === 0 ? (
            <Text style={s.nothingLine}>Nothing planned. A quiet day for your money.</Text>
          ) : (
            <View style={s.eventList}>
              {dayEvents.map((e) => (
                <EventRow key={e.id} e={e} t={t} s={rowStyles} />
              ))}
            </View>
          )}
        </View>

        {/* Footer actions. */}
        <View style={s.footerRow}>
          {isFuture ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See on money path"
              onPress={seeOnRoute}
              style={({ pressed }) => [
                s.footerButton,
                {
                  backgroundColor: t.surface,
                  borderColor: t.hairline,
                  borderWidth: StyleSheet.hairlineWidth,
                },
                pressed ? s.pressed : undefined,
              ]}
            >
              <Text style={[s.footerButtonLabel, { color: t.ink }]}>See on money path</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={() => {
              setCalendarFocusDate(date);
              onClose();
            }}
            style={({ pressed }) => [
              s.footerButton,
              { backgroundColor: t.calm },
              !isFuture ? s.footerButtonFull : undefined,
              pressed ? s.pressed : undefined,
            ]}
          >
            <Text style={[s.footerButtonLabel, { color: t.inverse }]}>Done</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette. Scoped to this sheet's own frame
// (eyebrow / headline / summary grid / footer); event rows themselves borrow CalendarScreen's style
// object via `rowStyles` above so they render identically to the inline panels.
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    eyebrow: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 22,
      lineHeight: 26,
      marginTop: gap.xs,
    },
    accentWord: {
      color: t.calm,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: gap.sm,
      marginTop: gap.lg,
    },
    summaryCell: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      padding: gap.md,
    },
    summaryLabel: {
      color: t.muted,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    summaryValue: {
      fontFamily: serif.display,
      fontSize: 16,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    tightestNote: {
      color: t.muted,
      fontSize: 11.5,
      fontStyle: 'italic',
      marginTop: gap.sm,
    },
    eventsBlock: {
      marginTop: gap.xl,
    },
    eventsLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.4,
      marginBottom: gap.sm,
      textTransform: 'uppercase',
    },
    nothingLine: {
      color: t.muted,
      fontSize: 12.5,
      fontStyle: 'italic',
    },
    eventList: {
      rowGap: gap.md,
    },
    footerRow: {
      flexDirection: 'row',
      gap: gap.sm,
      marginTop: gap.xl,
    },
    footerButton: {
      alignItems: 'center',
      borderRadius: radius.lg,
      flex: 1,
      height: 44,
      justifyContent: 'center',
    },
    footerButtonFull: {
      flex: 1,
    },
    footerButtonLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
