// Plans — what is already spoken for before payday (Quiet Paper Luxury).
//
// Drop-in replacement for the old mobileShell PlansScreen: same prop contract (plus onBack /
// onAddBill / onAddDebt), same LocalPlansModel, the accepted Lovable "what's coming" design. The
// list is driven by the real plan rows from the canonical engine. A recovery briefing, when the
// engine produces one, stays visible as a calm review card.
//
// Layout faithfully ports the web ScreenPlans: a 44px date column (uppercase month + tabular day),
// a left tone bar (caution for debt, repair for a bill/needs-look), the name + a quiet note, and a
// signed amount. The primary add is a SINGLE accent "+ Add a bill" with a quiet "or add a debt"
// link beneath it — never two equal ghost buttons.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Body,
  gap,
  Headline,
  type Palette,
  PressureScreen,
  PrimaryAction,
  QuietLink,
  Surface,
  useTheme,
} from './kit';
import { Kicker, MeloLine, ScreenHeader, SectionLabel } from './secondaryKit';
import type { LocalPlanRow, LocalPlansModel, LocalPlanTone } from '../../local/localPlansAdapter';

// Left tone bar — the web splits the marks two ways: a debt is caution (amber data mark), a bill
// (or anything needing a look) is the repair/negative coral. The engine's tone drives which.
function barColor(tone: LocalPlanTone, t: Palette): string {
  if (tone === 'estimated') return t.caution;
  if (tone === 'attention') return t.repair;
  return t.repairSoft;
}

// Web renders the date column from a "<day> <month>" string (e.g. "1 Jul"): uppercase month on top,
// tabular day below. The engine's dueDate is the same shape; split it the same way, with a calm
// fallback when it isn't two tokens.
function splitDate(dueDate: string): { month: string; day: string } {
  const parts = dueDate.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { day: parts[0] ?? '', month: (parts[1] ?? '').toUpperCase() };
  }
  return { day: dueDate, month: '' };
}

function PlanRow({
  row,
  first,
  s,
  t,
}: {
  row: LocalPlanRow;
  first: boolean;
  s: ReturnType<typeof makeStyles>;
  t: Palette;
}) {
  const { month, day } = splitDate(row.dueDate);
  return (
    <View style={[layout.row, s.row, first ? layout.rowFirst : undefined]}>
      <View style={layout.dateCol}>
        {month ? <Text style={s.dateMonth}>{month}</Text> : null}
        <Text style={s.dateDay}>{day}</Text>
      </View>
      <View style={[layout.bar, { backgroundColor: barColor(row.tone, t) }]} />
      <View style={layout.rowText}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {row.title}
        </Text>
        <Text style={s.rowNote} numberOfLines={1}>
          {row.stateLabel}
        </Text>
      </View>
      <Text style={s.rowAmount}>{row.target}</Text>
    </View>
  );
}

export function PlansScreen({
  onAddBill,
  onAddDebt,
  onBack,
  plans,
}: {
  onAddBill: () => void;
  onAddDebt: () => void;
  onBack: () => void;
  // Accepted for prop-contract parity with the container. The web Plans design has no
  // calendar/imports entry point, so these stay in the signature but are not rendered.
  onOpenCalendar: () => void;
  onOpenImports: () => void;
  plans: LocalPlansModel;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const rows = plans.planRows;

  return (
    <PressureScreen>
      <ScreenHeader label="Plans" onBack={onBack} />

      <View style={{ gap: gap.xs }}>
        <Kicker>Before next payday</Kicker>
        <Headline lead="What's " accent="already" tail=" spoken for." />
      </View>

      <Surface style={layout.summary}>
        <View>
          <SectionLabel>Set aside</SectionLabel>
          <Text style={s.summaryValue}>{plans.committedTotal}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <SectionLabel>Horizon</SectionLabel>
          <Text style={s.summaryHorizon}>Payday</Text>
        </View>
      </Surface>

      {plans.recoveryBriefing !== undefined ? (
        <Surface style={layout.repairCard}>
          <SectionLabel>Needs a look</SectionLabel>
          <Text style={s.repairTitle}>{plans.recoveryBriefing.title}</Text>
          <Body style={layout.repairFact}>{plans.recoveryBriefing.fact}</Body>
        </Surface>
      ) : null}

      {rows.length > 0 ? (
        <View style={[layout.list, s.list]}>
          {rows.map((row, index) => (
            <PlanRow key={row.id} row={row} first={index === 0} s={s} t={t} />
          ))}
        </View>
      ) : (
        <Surface>
          <Body>
            Nothing planned yet. Add a bill or a debt and it shows up here, in date order.
          </Body>
        </Surface>
      )}

      <View style={layout.addBlock}>
        <PrimaryAction
          label="+ Add a bill"
          accessibilityHint="Adds a recurring bill."
          onPress={onAddBill}
        />
        <QuietLink
          label="or add a debt"
          accessibilityHint="Adds a debt payment."
          onPress={onAddDebt}
        />
      </View>

      <MeloLine tone="soft" text="Move one if it sits in the wrong week." />
    </PressureScreen>
  );
}

// Layout-only styles — no colour, so they never change with the theme.
const layout = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },

  repairCard: { gap: 6 },
  repairFact: { fontSize: 14 },

  list: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.md,
    paddingVertical: 14,
    paddingHorizontal: gap.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowFirst: { borderTopWidth: 0 },

  dateCol: { width: 44, alignItems: 'center' },

  bar: { width: 6, height: 32, borderRadius: 3 },
  rowText: { flex: 1, minWidth: 0 },

  addBlock: { gap: gap.xs },
});

// Colour-bearing styles — rebuilt whenever the active palette changes.
function makeStyles(t: Palette) {
  return StyleSheet.create({
    summaryValue: {
      color: t.repairInk,
      fontFamily: 'Fraunces_600SemiBold',
      fontSize: 28,
      letterSpacing: -0.3,
      fontVariant: ['tabular-nums'],
    },
    summaryHorizon: {
      color: t.ink,
      fontFamily: 'Fraunces_500Medium',
      fontSize: 15,
      marginTop: 2,
    },

    repairTitle: {
      color: t.ink,
      fontFamily: 'Fraunces_600SemiBold',
      fontSize: 17,
    },

    list: {
      backgroundColor: t.surface,
      borderColor: t.hairlineStrong,
    },
    row: {
      borderTopColor: t.hairline,
    },

    dateMonth: {
      color: t.muted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    dateDay: {
      color: t.ink,
      fontFamily: 'Fraunces_600SemiBold',
      fontSize: 18,
      lineHeight: 20,
      fontVariant: ['tabular-nums'],
    },

    rowTitle: { color: t.ink, fontSize: 14, fontWeight: '600' },
    rowNote: { color: t.muted, fontSize: 12, marginTop: 2 },
    rowAmount: {
      color: t.ink,
      fontFamily: 'Fraunces_500Medium',
      fontSize: 15,
      fontVariant: ['tabular-nums'],
    },
  });
}
