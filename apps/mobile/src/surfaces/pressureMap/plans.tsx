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

import { StyleSheet, Text, View } from 'react-native';

import {
  Body,
  gap,
  Headline,
  paper,
  PressureScreen,
  PrimaryAction,
  QuietLink,
  Surface,
} from './kit';
import { Kicker, MeloLine, ScreenHeader, SectionLabel } from './secondaryKit';
import type { LocalPlanRow, LocalPlansModel, LocalPlanTone } from '../../local/localPlansAdapter';

// Left tone bar — the web splits the marks two ways: a debt is caution (amber data mark), a bill
// (or anything needing a look) is the repair/negative coral. The engine's tone drives which.
function barColor(tone: LocalPlanTone): string {
  if (tone === 'estimated') return paper.caution;
  if (tone === 'attention') return paper.repair;
  return paper.repairSoft;
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

function PlanRow({ row, first }: { row: LocalPlanRow; first: boolean }) {
  const { month, day } = splitDate(row.dueDate);
  return (
    <View style={[styles.row, first ? styles.rowFirst : undefined]}>
      <View style={styles.dateCol}>
        {month ? <Text style={styles.dateMonth}>{month}</Text> : null}
        <Text style={styles.dateDay}>{day}</Text>
      </View>
      <View style={[styles.bar, { backgroundColor: barColor(row.tone) }]} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {row.title}
        </Text>
        <Text style={styles.rowNote} numberOfLines={1}>
          {row.stateLabel}
        </Text>
      </View>
      <Text style={styles.rowAmount}>{row.target}</Text>
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
  const rows = plans.planRows;

  return (
    <PressureScreen>
      <ScreenHeader label="Plans" onBack={onBack} />

      <View style={{ gap: gap.xs }}>
        <Kicker>Before next payday</Kicker>
        <Headline lead="What's " accent="already" tail=" spoken for." />
      </View>

      <Surface style={styles.summary}>
        <View>
          <SectionLabel>Set aside</SectionLabel>
          <Text style={styles.summaryValue}>{plans.committedTotal}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <SectionLabel>Horizon</SectionLabel>
          <Text style={styles.summaryHorizon}>Payday</Text>
        </View>
      </Surface>

      {plans.recoveryBriefing !== undefined ? (
        <Surface style={styles.repairCard}>
          <SectionLabel>Needs a look</SectionLabel>
          <Text style={styles.repairTitle}>{plans.recoveryBriefing.title}</Text>
          <Body style={{ fontSize: 14 }}>{plans.recoveryBriefing.fact}</Body>
        </Surface>
      ) : null}

      {rows.length > 0 ? (
        <View style={styles.list}>
          {rows.map((row, index) => (
            <PlanRow key={row.id} row={row} first={index === 0} />
          ))}
        </View>
      ) : (
        <Surface>
          <Body>
            Nothing planned yet. Add a bill or a debt and it shows up here, in date order.
          </Body>
        </Surface>
      )}

      <View style={styles.addBlock}>
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

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  summaryValue: {
    color: paper.repairInk,
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 28,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  summaryHorizon: {
    color: paper.ink,
    fontFamily: 'Fraunces_500Medium',
    fontSize: 15,
    marginTop: 2,
  },

  repairCard: { gap: 6 },
  repairTitle: {
    color: paper.ink,
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 17,
  },

  list: {
    backgroundColor: paper.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairlineStrong,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.md,
    paddingVertical: 14,
    paddingHorizontal: gap.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.hairline,
  },
  rowFirst: { borderTopWidth: 0 },

  dateCol: { width: 44, alignItems: 'center' },
  dateMonth: {
    color: paper.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  dateDay: {
    color: paper.ink,
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 18,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },

  bar: { width: 6, height: 32, borderRadius: 3 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: paper.ink, fontSize: 14, fontWeight: '600' },
  rowNote: { color: paper.muted, fontSize: 12, marginTop: 2 },
  rowAmount: {
    color: paper.ink,
    fontFamily: 'Fraunces_500Medium',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },

  addBlock: { gap: gap.xs },
});
