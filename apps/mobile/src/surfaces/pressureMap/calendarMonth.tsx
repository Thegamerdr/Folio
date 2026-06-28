// Calendar — only the dates that matter (Quiet Paper Luxury).
//
// Faithful port of the Lovable web screen (ScreenCalendar.tsx) onto RN primitives. Same prop
// contract as the old mobileShell CalendarScreen (plus onBack), same LocalCalendarModel. The month
// is the one the ledger is reading (asOfDate); every marked day comes from the real calendar agenda
// (money in, bills, debts) and the route's tight point — never a static sample. The web design is
// the source of truth for layout, spacing, hierarchy and copy; the data underneath stays real.
//
// Web parity map:
//  • header: back / "Calendar" / spacer (ScreenHeader matches the web row)
//  • kicker "<month>" italic serif + Headline "The dates that matter." (accent "matter.")
//  • month-grid Surface: weekday row M T W T F S S, then a 7-col Monday-start day grid
//  • cell marks: payday = solid accent circle · tight = accent-soft fill · bill = negative ring on
//    inset · debt = caution ring on inset · today = hairline ring
//  • legend: 2-col, 4 inset tiles (dot + label + derived note)
//  • a Ghost button + a quiet Melo line

import { StyleSheet, Text, View } from 'react-native';

import { Body, gap, GhostButton, Headline, paper, PressureScreen, radius, Surface } from './kit';
import { Kicker, MeloLine, ScreenHeader } from './secondaryKit';
import type { LocalCalendarModel } from '../../local/localCalendarAdapter';
import type { LocalLedgerState, LocalRouteSummary } from '../../local/localLedger';

type Mark = 'payday' | 'tight' | 'bill' | 'debt';

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
];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function markForKind(kind: string): Exclude<Mark, 'tight'> | undefined {
  if (kind === 'income') return 'payday';
  if (kind === 'commitment' || kind === 'plan') return 'bill';
  if (kind === 'recovery') return 'debt';
  return undefined;
}

// "1 · 3 · 12" style note from a set of day-of-month numbers (matches the web legend notes).
function daysNote(days: readonly number[]): string {
  if (days.length === 0) return '—';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length <= 3) return sorted.join(' · ');
  return `${sorted.slice(0, 3).join(' · ')} +${sorted.length - 3}`;
}

export function CalendarScreen({
  calendar,
  ledger,
  onAddCommitment: _onAddCommitment,
  onBack,
  onOpenMoney,
  route,
}: {
  calendar: LocalCalendarModel;
  ledger: LocalLedgerState;
  // Accepted for prop-contract parity with the container.
  onAddCommitment: (input: never) => void;
  onBack: () => void;
  onOpenImports: () => void;
  onOpenMoney: () => void;
  privateExampleMode: boolean;
  route: LocalRouteSummary;
}) {
  const [year, month, today] = ledger.asOfDate.split('-').map(Number) as [number, number, number];
  const daysInMonth = new Date(year, month, 0).getDate();
  // Monday-start: JS getDay() is Sun=0..Sat=6.
  const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Marks come from the real agenda for this month. Track per-mark day numbers so the legend notes
  // can read the actual dates (no synthetic sample).
  const marks = new Map<number, Mark>();
  const paydayDays: number[] = [];
  const billDays: number[] = [];
  const debtDays: number[] = [];
  for (const event of calendar.agenda) {
    const [ey, em, ed] = event.date.split('-').map(Number);
    if (ey === year && em === month && ed) {
      const mark = markForKind(event.kind);
      if (mark && !marks.has(ed)) {
        marks.set(ed, mark);
        if (mark === 'payday') paydayDays.push(ed);
        else if (mark === 'bill') billDays.push(ed);
        else debtDays.push(ed);
      }
    }
  }

  // The tight point is a single route day (route.tightestDay), not an agenda mark. If it falls in
  // the displayed month and the cell isn't already a harder mark, paint it accent-soft like the web.
  const [ty, tm, td] = (route.tightestDay ?? '').split('-').map(Number);
  const tightDay = ty === year && tm === month && td ? td : undefined;
  if (tightDay !== undefined && !marks.has(tightDay)) marks.set(tightDay, 'tight');

  const hasMarks = marks.size > 0;

  return (
    <PressureScreen>
      <ScreenHeader label="Calendar" onBack={onBack} />

      <View style={{ gap: gap.xs }}>
        <Kicker>{MONTH_NAMES[month - 1]}</Kicker>
        <Headline lead="The dates that " accent="matter." />
      </View>

      <Surface style={styles.grid}>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.daysRow}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`x${i}`} style={styles.cell} />;
            const mark = marks.get(day);
            const isToday = day === today;
            return (
              <View key={day} style={styles.cell}>
                <View
                  style={[
                    styles.dayInner,
                    mark === 'payday' ? styles.dayPayday : undefined,
                    mark === 'tight' ? styles.dayTight : undefined,
                    mark === 'bill' ? styles.dayBill : undefined,
                    mark === 'debt' ? styles.dayDebt : undefined,
                    isToday && mark === undefined ? styles.dayToday : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      mark === 'payday' ? styles.dayTextPayday : undefined,
                      mark === 'tight' ? styles.dayTextTight : undefined,
                      mark === undefined && !isToday ? styles.dayTextMuted : undefined,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Surface>

      <View style={styles.legend}>
        <LegendTile dotStyle={styles.lgPayday} label="Payday" note={daysNote(paydayDays)} />
        <LegendTile
          dotStyle={styles.lgTight}
          label="Tight point"
          note={tightDay !== undefined ? String(tightDay) : route.tightestDay}
        />
        <LegendTile dotStyle={styles.lgBill} label="Bill due" note={daysNote(billDays)} />
        <LegendTile dotStyle={styles.lgDebt} label="Debt payment" note={daysNote(debtDays)} />
      </View>

      {!hasMarks ? (
        <Body style={{ color: paper.muted, fontSize: 14 }}>
          The dates that matter will appear here as you add what comes in and what has to leave.
        </Body>
      ) : null}

      <GhostButton
        label="See what's coming"
        accessibilityHint="Opens a spend preview."
        onPress={onOpenMoney}
      />

      <MeloLine tone="soft" text="Quiet on most days. A few that matter." />
    </PressureScreen>
  );
}

function LegendTile({
  dotStyle,
  label,
  note,
}: {
  dotStyle: object;
  label: string;
  note: string;
}) {
  return (
    <View style={styles.legendTile}>
      <View style={[styles.legendDot, dotStyle]} />
      <View style={styles.legendText}>
        <Text style={styles.legendLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.legendNote} numberOfLines={1}>
          {note}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { paddingVertical: gap.lg },
  weekRow: { flexDirection: 'row', marginBottom: gap.sm },
  weekday: {
    flexBasis: '14.28%',
    textAlign: 'center',
    color: paper.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayInner: {
    width: '78%',
    aspectRatio: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // payday = solid accent circle · tight = accent-soft fill · bill = negative ring on inset ·
  // debt = caution ring on inset · today = hairline ring.
  dayPayday: { backgroundColor: paper.calm },
  dayTight: { backgroundColor: paper.calmSoft },
  dayBill: { backgroundColor: paper.inset, borderWidth: 1, borderColor: paper.repair },
  dayDebt: { backgroundColor: paper.inset, borderWidth: 1, borderColor: paper.caution },
  dayToday: { borderWidth: 1, borderColor: paper.hairlineStrong },
  dayText: { color: paper.ink, fontSize: 12, fontVariant: ['tabular-nums'] },
  dayTextPayday: { color: paper.inverse, fontWeight: '700' },
  dayTextTight: { fontWeight: '600' },
  dayTextMuted: { color: paper.muted },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm },
  legendTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.sm,
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: paper.inset,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairline,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { flex: 1 },
  legendLabel: { color: paper.ink, fontSize: 12.5 },
  legendNote: {
    color: paper.muted,
    fontSize: 10.5,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  lgPayday: { backgroundColor: paper.calm },
  lgTight: { backgroundColor: paper.calmSoft },
  lgBill: { backgroundColor: paper.inset, borderWidth: 1, borderColor: paper.repair },
  lgDebt: { backgroundColor: paper.inset, borderWidth: 1, borderColor: paper.caution },
});
