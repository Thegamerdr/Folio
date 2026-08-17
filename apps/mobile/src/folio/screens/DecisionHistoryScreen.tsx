import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DecisionLedgerEntry } from '@folio/domain';

import {
  deleteDecisionLedgerEntry,
  disableDecisionLedgerLearning,
  removeDecisionLedgerLearning,
  useAppStore,
} from '@/folio/store';
import { decisionLedgerGroups } from '@/folio/lib/decisionLedger';
import { gap, radius, serif, useTheme } from '@/folio/theme';
import { EmptyState } from '@/folio/ui/EmptyState';
import {
  CorrectionImpactSheet,
  DecisionReceipt,
  MaterialChangeCard,
} from '@/folio/ui/TrustedCoreSurfaces';
import { ReviewJourneyTabs } from '@/folio/ui/ReviewJourneyTabs';
import type { Nav } from '@/folio/types';

export function DecisionHistoryScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const entries = useAppStore((state) => state.decisionLedger ?? []);
  const materialChanges = useAppStore((state) => state.materialChanges ?? []);
  const correctionImpacts = useAppStore((state) => state.correctionImpacts ?? []);
  const workspaceKind = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.kind ??
      'personal',
  );
  const visible = useMemo(
    () =>
      [...entries]
        .filter((entry) => entry.status !== 'deleted')
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [entries],
  );
  const groups = useMemo(() => decisionLedgerGroups(visible), [visible]);
  const [selectedId, setSelectedId] = useState<string | null>(visible[0]?.id ?? null);
  const selected = visible.find((entry) => String(entry.id) === selectedId) ?? visible[0] ?? null;
  const selectedMaterialChanges = selected
    ? materialChanges
        .filter((change) =>
          change.affectedDecisionIds.some((id) => String(id) === String(selected.id)),
        )
        .slice(0, 3)
    : [];
  const selectedCorrectionImpacts = selected
    ? correctionImpacts
        .filter((impact) =>
          impact.affectedDecisionIds.some((id) => String(id) === String(selected.id)),
        )
        .slice(0, 3)
    : [];

  if (workspaceKind === 'business') {
    return (
      <EmptyState
        mood="calm"
        headline="Decision history is Personal for now."
        body="Business receipts are deliberately out of this phase, so no business choices are logged here yet."
        cta={{ label: 'Back to business', onPress: nav.back }}
      />
    );
  }

  if (visible.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: t.canvas }]}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              hitSlop={12}
              onPress={nav.back}
              style={({ pressed }) => [styles.back, { opacity: pressed ? 0.65 : 1 }]}
            >
              <Text style={[styles.backLabel, { color: t.muted }]}>‹</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: t.muted }]}>Review</Text>
              <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
                Decision history
              </Text>
            </View>
          </View>
          <ReviewJourneyTabs active="decisions" nav={nav} />
          <View style={styles.emptyJourney}>
            <EmptyState
              mood="calm"
              headline="No decision receipts yet."
              body="Melo records material choices only after you confirm them."
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={12}
            onPress={nav.back}
            style={({ pressed }) => [styles.back, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Text style={[styles.backLabel, { color: t.muted }]}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>Trust & data</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
              Decision history
            </Text>
          </View>
        </View>

        <Text style={[styles.intro, { color: t.muted }]}>
          Receipts for material money choices. No chat transcripts, raw documents or full app
          snapshots live here.
        </Text>
        <ReviewJourneyTabs active="decisions" nav={nav} />

        <DecisionGroup
          entries={groups.awaitingOutcome}
          onSelect={setSelectedId}
          selectedId={selectedId}
          title="Awaiting outcome"
        />
        <DecisionGroup
          entries={groups.recentlyResolved}
          onSelect={setSelectedId}
          selectedId={selectedId}
          title="Recently resolved"
        />
        <DecisionGroup
          entries={groups.draftOrCancelled}
          onSelect={setSelectedId}
          selectedId={selectedId}
          title="Draft or cancelled"
        />

        {selected ? <ReceiptCard entry={selected} nav={nav} /> : null}
        {selectedMaterialChanges.map((change) => (
          <MaterialChangeCard key={change.id} change={change} />
        ))}
        {selectedCorrectionImpacts.map((impact) => (
          <CorrectionImpactSheet key={impact.id} impact={impact} />
        ))}
      </ScrollView>
    </View>
  );
}

function DecisionGroup({
  entries,
  onSelect,
  selectedId,
  title,
}: {
  entries: readonly DecisionLedgerEntry[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  title: string;
}) {
  const t = useTheme();
  if (entries.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: t.muted }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        {entries.map((entry, index) => (
          <Pressable
            accessibilityLabel={`${entry.question.text}. ${entry.status}. Open receipt.`}
            accessibilityRole="button"
            accessibilityState={{ selected: String(entry.id) === selectedId }}
            key={entry.id}
            onPress={() => onSelect(String(entry.id))}
            style={({ pressed }) => [
              styles.row,
              index > 0
                ? { borderTopColor: t.hairline, borderTopWidth: StyleSheet.hairlineWidth }
                : undefined,
              String(entry.id) === selectedId ? { backgroundColor: t.inset } : undefined,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <View style={styles.rowCopy}>
              <Text numberOfLines={1} style={[styles.rowTitle, { color: t.ink }]}>
                {entry.question.text}
              </Text>
              <Text style={[styles.rowHint, { color: t.muted }]}>
                {entry.decisionType} · {entry.createdAt.slice(0, 10)}
              </Text>
            </View>
            <Text style={[styles.rowStatus, { color: t.calmStrong }]}>{entry.status}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ReceiptCard({ entry, nav }: { entry: DecisionLedgerEntry; nav: Nav }) {
  const t = useTheme();
  const canDisable = entry.learning.permitted;
  return (
    <View style={[styles.receipt, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <DecisionReceipt entry={entry} />
      <View style={styles.controls}>
        <Control label="Correct" onPress={() => nav.go('review')} />
        <Control label="Export" onPress={() => nav.go('account')} />
        <Control
          disabled={!canDisable}
          label="Disable learning"
          onPress={() => disableDecisionLedgerLearning(entry.id)}
        />
        <Control label="Remove learning" onPress={() => removeDecisionLedgerLearning(entry.id)} />
        <Control
          destructive
          label="Delete receipt"
          onPress={() => deleteDecisionLedgerEntry(entry.id)}
        />
      </View>
    </View>
  );
}

function Control({
  destructive,
  disabled,
  label,
  onPress,
}: {
  destructive?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        {
          backgroundColor: destructive ? t.repair : t.inset,
          opacity: disabled ? 0.45 : pressed ? 0.68 : 1,
        },
      ]}
    >
      <Text style={[styles.controlLabel, { color: destructive ? t.inverse : t.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  header: { alignItems: 'center', flexDirection: 'row', gap: gap.md },
  back: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  backLabel: { fontSize: 34, lineHeight: 36 },
  headerCopy: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.32,
    textTransform: 'uppercase',
  },
  title: { fontFamily: serif.display, fontSize: 34, letterSpacing: -1.2, lineHeight: 38 },
  intro: { fontSize: 14, lineHeight: 21, marginTop: gap.md },
  emptyJourney: { marginTop: gap.lg },
  group: { marginTop: gap.xl },
  groupTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.24,
    marginBottom: gap.sm,
    textTransform: 'uppercase',
  },
  card: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: gap.md,
    minHeight: 62,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
  },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowHint: { fontSize: 12, marginTop: 3 },
  rowStatus: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  pressed: { opacity: 0.65 },
  receipt: {
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.lg,
  },
  receiptEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.24,
    textTransform: 'uppercase',
  },
  receiptTitle: { fontFamily: serif.display, fontSize: 26, lineHeight: 30, marginTop: gap.xs },
  receiptRows: { gap: 6, marginTop: gap.md },
  receiptLine: { fontSize: 13, lineHeight: 19 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm, marginTop: gap.lg },
  control: {
    alignItems: 'center',
    borderRadius: radius.lg,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.md,
  },
  controlLabel: { fontSize: 13, fontWeight: '900' },
});
