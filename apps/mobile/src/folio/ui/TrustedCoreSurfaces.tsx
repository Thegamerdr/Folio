import { Pressable, StyleSheet, Text, View } from 'react-native';
import type {
  CorrectionImpactRecord,
  DecisionLedgerEntry,
  MaterialFinancialChange,
  TrustedSafeRangeSnapshot,
  TrustedSafeRangeSourceBreakdown,
} from '@folio/domain';

import { gap, radius, serif, typeScale, useTheme } from '@/folio/theme';
import { receiptSummary } from '@/folio/lib/decisionLedger';
import type {
  PaydayForecastAccountability,
  ScenarioComparisonRow,
} from '@/folio/lib/criticalJourneys';

function moneyLabel(value: { minorUnits: number } | null | undefined): string {
  if (value === null || value === undefined) return 'unknown';
  const sign = value.minorUnits < 0 ? '−' : '';
  return `${sign}£${Math.round(Math.abs(value.minorUnits) / 100).toLocaleString('en-GB')}`;
}

function deltaLabel(value: { minorUnits: number } | null | undefined): string {
  if (value === null || value === undefined) return 'no recorded movement';
  const sign = value.minorUnits > 0 ? '+' : value.minorUnits < 0 ? '−' : '';
  return `${sign}£${Math.round(Math.abs(value.minorUnits) / 100).toLocaleString('en-GB')}`;
}

export function SafeRangeBeforeAfter({
  after,
  before,
  title = 'Safe Range before and after',
}: {
  before?: TrustedSafeRangeSnapshot | undefined;
  after?: TrustedSafeRangeSnapshot | undefined;
  title?: string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text style={[styles.eyebrow, { color: t.muted }]}>{title}</Text>
      <View style={styles.compareRow}>
        <RangeColumn label="Before" range={before} />
        <Text style={[styles.arrow, { color: t.muted }]}>→</Text>
        <RangeColumn label="Now" range={after} />
      </View>
    </View>
  );
}

function RangeColumn({
  label,
  range,
}: {
  label: string;
  range?: TrustedSafeRangeSnapshot | undefined;
}) {
  const t = useTheme();
  return (
    <View style={[styles.rangeColumn, { backgroundColor: t.inset }]}>
      <Text style={[styles.smallLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.money, { color: t.ink }]}>
        {range
          ? `${moneyLabel(range.expectedSafeMin)}–${moneyLabel(range.expectedSafeMax)}`
          : 'unknown'}
      </Text>
      <Text style={[styles.meta, { color: t.muted }]}>
        {range ? `${range.reliance.replaceAll('_', ' ')} · ${range.freshness}` : 'not recorded'}
      </Text>
    </View>
  );
}

export function MaterialChangeCard({ change }: { change: MaterialFinancialChange }) {
  const t = useTheme();
  const cause = change.causes[0]?.label ?? change.explanationCode;
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text style={[styles.eyebrow, { color: t.muted }]}>What changed</Text>
      <Text style={[styles.title, { color: t.ink }]}>{cause}</Text>
      <SafeRangeBeforeAfter before={change.before} after={change.after} title="Range impact" />
      <View style={styles.factGrid}>
        <Fact label="Source" value={change.sourceIds.join(', ') || 'none'} />
        <Fact label="Truth" value={change.truth.replaceAll('_', ' ')} />
        <Fact label="Effect" value={deltaLabel(change.monetaryEffect)} />
        <Fact label="Action" value={change.userActionRequired ? 'needs attention' : 'none'} />
      </View>
      {change.affectedDecisionIds.length > 0 ? (
        <Text style={[styles.body, { color: t.muted }]}>
          Affected decisions: {change.affectedDecisionIds.join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

export function TruthAndSourceList({
  rows,
  title = 'Truth and source',
}: {
  rows: readonly TrustedSafeRangeSourceBreakdown[];
  title?: string;
}) {
  const t = useTheme();
  if (rows.length === 0) return null;
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text style={[styles.eyebrow, { color: t.muted }]}>{title}</Text>
      {rows.map((row) => (
        <View key={row.factId} style={styles.sourceRow}>
          <Text style={[styles.sourceLabel, { color: t.ink }]}>{row.label}</Text>
          <Text style={[styles.meta, { color: t.muted }]}>
            {row.truthClass.replaceAll('_', ' ')} · {row.freshness}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function UnknownsAndContradictions({
  contradictions,
  missing,
}: {
  missing: readonly string[];
  contradictions: readonly string[];
}) {
  const t = useTheme();
  if (missing.length === 0 && contradictions.length === 0) return null;
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text style={[styles.eyebrow, { color: t.muted }]}>Unknowns and contradictions</Text>
      {missing.map((item) => (
        <Text key={`m-${item}`} style={[styles.body, { color: t.muted }]}>
          Missing: {item}
        </Text>
      ))}
      {contradictions.map((item) => (
        <Text key={`c-${item}`} style={[styles.body, { color: t.repairInk }]}>
          Contradiction: {item}
        </Text>
      ))}
    </View>
  );
}

export function DecisionComparison({
  onSelect,
  rows,
  selectedId,
}: {
  rows: readonly ScenarioComparisonRow[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text style={[styles.eyebrow, { color: t.muted }]}>Decision comparison</Text>
      {rows.map((row) => {
        const selected = row.id === selectedId;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={row.id}
            onPress={() => onSelect(row.id)}
            style={[
              styles.option,
              {
                backgroundColor: selected ? t.calmSoft : t.inset,
                borderColor: selected ? t.calm : t.hairline,
              },
            ]}
          >
            <Text style={[styles.optionTitle, { color: t.ink }]}>{row.label}</Text>
            <Text style={[styles.meta, { color: t.muted }]}>
              Cash {deltaLabel({ minorUnits: row.immediateCashEffectMinor })} · tight point{' '}
              {deltaLabel({ minorUnits: row.tightestPointEffectMinor })}
            </Text>
            <Text style={[styles.meta, { color: t.muted }]}>
              Range {deltaLabel({ minorUnits: row.expectedRangeEffectMinor })} · conservative{' '}
              {deltaLabel({ minorUnits: row.conservativeBoundaryEffectMinor })}
            </Text>
            <Text style={[styles.meta, { color: t.muted }]}>
              Risk {row.essentialCommitmentRisk} · {row.reliance.replaceAll('_', ' ')} ·{' '}
              {row.reversible ? 'reversible' : 'hard to undo'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DecisionReceipt({ entry }: { entry: DecisionLedgerEntry }) {
  const t = useTheme();
  const lines = receiptSummary(entry);
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text style={[styles.eyebrow, { color: t.muted }]}>Decision receipt</Text>
      <Text style={[styles.title, { color: t.ink }]}>{entry.question.text}</Text>
      {lines.map((line) => (
        <Text key={line} style={[styles.body, { color: t.muted }]}>
          {line}
        </Text>
      ))}
      {entry.scenarios.length > 0 ? (
        <Text style={[styles.body, { color: t.muted }]}>
          Compared: {entry.scenarios.map((scenario) => scenario.label).join(', ')}
        </Text>
      ) : null}
      {entry.userChoice.selectedMoveIds.length > 0 ? (
        <Text style={[styles.body, { color: t.muted }]}>
          Moves: {entry.userChoice.selectedMoveIds.join(', ')}
        </Text>
      ) : null}
      {entry.corrections.length > 0 || entry.userCorrectionRefs.length > 0 ? (
        <Text style={[styles.body, { color: t.repairInk }]}>
          Updated by later correction. Original receipt preserved.
        </Text>
      ) : null}
    </View>
  );
}

export function CorrectionImpactSheet({ impact }: { impact: CorrectionImpactRecord }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text style={[styles.eyebrow, { color: t.muted }]}>Correction impact</Text>
      <Text style={[styles.title, { color: t.ink }]}>
        {impact.subject.kind} · {impact.field}
      </Text>
      <Text style={[styles.body, { color: t.muted }]}>
        Original: {String(impact.original)} · Corrected: {String(impact.corrected)}
      </Text>
      <SafeRangeBeforeAfter before={impact.before} after={impact.after} title="Recalculation" />
      <Text style={[styles.body, { color: t.muted }]}>
        Decisions affected: {impact.affectedDecisionIds.length || 'none'}
      </Text>
      <Text style={[styles.body, { color: t.muted }]}>
        Future use: {impact.futureBehaviour.replaceAll('_', ' ')}
      </Text>
    </View>
  );
}

export function RecoveryBundlePreview({
  after,
  before,
  remainingGapMinor,
  selectedLabels,
}: {
  before?: TrustedSafeRangeSnapshot | undefined;
  after?: TrustedSafeRangeSnapshot | undefined;
  remainingGapMinor: number;
  selectedLabels: readonly string[];
}) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text style={[styles.eyebrow, { color: t.muted }]}>Recovery bundle preview</Text>
      <Text style={[styles.body, { color: t.muted }]}>
        {selectedLabels.length === 0
          ? 'Choose one or more supported moves before anything changes.'
          : selectedLabels.join(' · ')}
      </Text>
      <SafeRangeBeforeAfter before={before} after={after} title="Combined Safe Range" />
      <Text style={[styles.body, { color: remainingGapMinor > 0 ? t.repairInk : t.positiveInk }]}>
        {remainingGapMinor > 0
          ? `${moneyLabel({ minorUnits: remainingGapMinor })} still to solve.`
          : 'Protected threshold reached.'}
      </Text>
    </View>
  );
}

export function ForecastAccountabilitySummary({
  accountability,
}: {
  accountability: PaydayForecastAccountability;
}) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <Text style={[styles.eyebrow, { color: t.muted }]}>Forecast accountability</Text>
      <View style={styles.factGrid}>
        <Fact label="Result" value={accountability.classification.replaceAll('_', ' ')} />
        <Fact label="Actual" value={moneyLabel(accountability.actualEndPosition)} />
        <Fact label="Reliance" value={accountability.relianceAtTheTime.replaceAll('_', ' ')} />
        <Fact
          label="Reliance matched outcome"
          value={accountability.relianceMatchedOutcome ? 'yes' : 'no'}
        />
        <Fact
          label="Boundary"
          value={
            accountability.classification === 'outside_range'
              ? 'breached'
              : accountability.classification === 'unverifiable'
                ? 'unknown'
                : 'held'
          }
        />
      </View>
      <Text style={[styles.body, { color: t.muted }]}>{accountability.mainSourceOfError}</Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.fact, { backgroundColor: t.inset }]}>
      <Text style={[styles.smallLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: t.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: { fontSize: typeScale.title, paddingTop: gap.lg },
  body: { fontSize: typeScale.caption, lineHeight: 18, marginTop: gap.xs },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    padding: gap.md,
  },
  compareRow: { alignItems: 'stretch', flexDirection: 'row', gap: gap.sm, marginTop: gap.sm },
  eyebrow: {
    fontSize: typeScale.micro,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  fact: { borderRadius: radius.md, flex: 1, minWidth: 128, padding: gap.sm },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm, marginTop: gap.md },
  factValue: { fontSize: typeScale.caption, lineHeight: 16, marginTop: 3 },
  meta: { fontSize: typeScale.micro, lineHeight: 16, marginTop: 2 },
  money: {
    fontFamily: serif.display,
    fontSize: typeScale.body,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  option: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.sm,
    padding: gap.md,
  },
  optionTitle: { fontSize: typeScale.bodySmall, fontWeight: '700' },
  rangeColumn: { borderRadius: radius.md, flex: 1, padding: gap.sm },
  smallLabel: { fontSize: typeScale.micro, letterSpacing: 1, textTransform: 'uppercase' },
  sourceLabel: { fontSize: typeScale.bodySmall, fontWeight: '700' },
  sourceRow: { marginTop: gap.sm },
  title: {
    fontFamily: serif.display,
    fontSize: typeScale.title,
    lineHeight: 24,
    marginTop: gap.xs,
  },
});
