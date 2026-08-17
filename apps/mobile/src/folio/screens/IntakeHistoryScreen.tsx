import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  removeEvidenceDocument,
  useAppStore,
  type EvidenceDocument,
  type StatementImportRecord,
} from '@/folio/store';
import { deleteEvidenceDocumentFile, openEvidenceDocument } from '@/folio/lib/documentVault';
import { gap, radius, serif, Surface, useTheme } from '@/folio/theme';
import { ReviewJourneyTabs } from '@/folio/ui/ReviewJourneyTabs';
import type { Nav } from '@/folio/types';

type Props = Readonly<{ nav: Nav }>;

const SOURCE_LABEL: Readonly<Record<StatementImportRecord['source'], string>> = {
  paste: 'Pasted text',
  pdf: 'PDF statement',
  image: 'Photo or screenshot',
  csv: 'CSV or text file',
  txt: 'Text file',
  manual: 'Manual entry',
  unknown: 'Source record',
};

export function IntakeHistoryScreen({ nav }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const workspace = useAppStore(
    (state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId)!,
  );
  const attempts = useAppStore((state) => state.statementImports ?? []);
  const evidence = useAppStore((state) => state.evidenceDocuments ?? []);
  const accounts = useAppStore((state) => state.accounts ?? []);
  const reviewQueue = useAppStore((state) => state.reviewQueue ?? []);
  const spillover = useAppStore((state) => state.reviewQueueSpillover ?? []);
  const readerCandidates = useAppStore((state) => state.readerCandidates ?? []);
  const [busyEvidenceId, setBusyEvidenceId] = useState<string | null>(null);

  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name] as const)),
    [accounts],
  );
  const pendingCount = reviewQueue.length + spillover.length + readerCandidates.length;

  function openEvidence(document: EvidenceDocument) {
    if (busyEvidenceId !== null) return;
    setBusyEvidenceId(document.id);
    void openEvidenceDocument(workspace, document)
      .catch((reason: unknown) => {
        Alert.alert(
          'Could not open this source',
          reason instanceof Error ? reason.message : 'The saved source could not be opened.',
        );
      })
      .finally(() => setBusyEvidenceId(null));
  }

  function confirmRemoveEvidence(document: EvidenceDocument) {
    Alert.alert(
      'Remove this saved source?',
      'The saved original will be deleted. Confirmed money remains, but its source link is removed.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove source',
          style: 'destructive',
          onPress: () => {
            setBusyEvidenceId(document.id);
            void deleteEvidenceDocumentFile(workspace, document)
              .then(() => {
                removeEvidenceDocument(document.id);
              })
              .catch((reason: unknown) => {
                Alert.alert(
                  'Could not remove this source',
                  reason instanceof Error
                    ? reason.message
                    : 'The saved source could not be removed.',
                );
              })
              .finally(() => setBusyEvidenceId(null));
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + gap.xxl,
          paddingHorizontal: gap.lg,
          paddingTop: insets.top + gap.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityHint="Returns to Money Sources."
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={16}
            onPress={nav.back}
          >
            <Text style={[styles.back, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Intake history</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
          What Melo read, kept and added.
        </Text>
        <Text style={[styles.intro, { color: t.muted }]}>
          Attempts stay inside {workspace.name}. Open a saved original, see what reached Review, or
          retry a source that could not be read.
        </Text>

        <ReviewJourneyTabs active="imports" nav={nav} />

        <View style={styles.summaryGrid}>
          <Summary value={String(attempts.length)} label="attempts" />
          <Summary value={String(pendingCount)} label="waiting for you" />
          <Summary value={String(evidence.length)} label="sources saved" />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => nav.go('intake')}
          style={[styles.primaryAction, { backgroundColor: t.ink }]}
        >
          <Text style={[styles.primaryActionLabel, { color: t.canvas }]}>Add another source</Text>
        </Pressable>

        <SectionTitle title="Attempts" detail="newest first" />
        {attempts.length === 0 ? (
          <Surface style={[styles.emptyCard, { borderColor: t.hairline }]}>
            <Text style={[styles.emptyTitle, { color: t.ink }]}>No source attempts yet.</Text>
            <Text style={[styles.emptyBody, { color: t.muted }]}>
              PDFs, photos, pasted text and files will appear here after Melo tries to read them.
            </Text>
          </Surface>
        ) : (
          attempts.map((attempt) => (
            <AttemptCard
              accountName={accountNames.get(attempt.accountId ?? 'acct-main') ?? 'Main'}
              attempt={attempt}
              key={attempt.id}
              onRetry={() => nav.go('intake')}
            />
          ))
        )}

        <SectionTitle title="Saved originals" detail={`${evidence.length} saved`} />
        {evidence.length === 0 ? (
          <Surface style={[styles.emptyCard, { borderColor: t.hairline }]}>
            <Text style={[styles.emptyTitle, { color: t.ink }]}>No original files retained.</Text>
            <Text style={[styles.emptyBody, { color: t.muted }]}>
              Manual and pasted entries may have no file. A retained PDF or image stays available
              until you choose to open or remove it.
            </Text>
          </Surface>
        ) : (
          evidence.map((document) => (
            <EvidenceCard
              busy={busyEvidenceId === document.id}
              document={document}
              key={document.id}
              onOpen={() => openEvidence(document)}
              onRemove={() => confirmRemoveEvidence(document)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Summary({ value, label }: Readonly<{ value: string; label: string }>) {
  const t = useTheme();
  return (
    <Surface style={[styles.summary, { borderColor: t.hairline }]}>
      <Text style={[styles.summaryValue, { color: t.ink }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: t.muted }]}>{label}</Text>
    </Surface>
  );
}

function AttemptCard({
  attempt,
  accountName,
  onRetry,
}: Readonly<{
  attempt: StatementImportRecord;
  accountName: string;
  onRetry: () => void;
}>) {
  const t = useTheme();
  const outcome = attempt.outcome ?? 'added';
  const failed = outcome === 'read-failed' || outcome === 'unsupported-currency';
  const duplicateCount = attempt.duplicatesSkipped ?? 0;
  return (
    <Surface style={[styles.attemptCard, { borderColor: t.hairline }]}>
      <View style={styles.attemptTop}>
        <View style={styles.attemptText}>
          <Text style={[styles.attemptTitle, { color: t.ink }]}>
            {attempt.filename ?? SOURCE_LABEL[attempt.source]}
          </Text>
          <Text style={[styles.attemptMeta, { color: t.muted }]}>
            {SOURCE_LABEL[attempt.source]} · {formatDateTime(attempt.atISO)} · {accountName}
          </Text>
        </View>
        <Text style={[styles.outcome, { color: failed ? t.repairInk : t.calmStrong }]}>
          {outcomeLabel(outcome)}
        </Text>
      </View>
      <Text style={[styles.attemptBody, { color: t.muted }]}>
        {attempt.reason ?? attemptResultLine(attempt)}
      </Text>
      {duplicateCount > 0 ? (
        <Text style={[styles.factLine, { color: t.muted }]}>
          {duplicateCount} exact {duplicateCount === 1 ? 'entry was' : 'entries were'} already
          present.
        </Text>
      ) : null}
      {attempt.reconciliationStatus !== undefined ? (
        <Text style={[styles.factLine, { color: t.muted }]}>
          Arithmetic check: {reconciliationLabel(attempt.reconciliationStatus)}.
        </Text>
      ) : null}
      {attempt.retryOfId !== undefined ? (
        <Text style={[styles.factLine, { color: t.muted }]}>
          This followed an earlier failed read.
        </Text>
      ) : null}
      {failed ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.inlineAction}>
          <Text style={[styles.inlineActionLabel, { color: t.calmStrong }]}>
            Try another read →
          </Text>
        </Pressable>
      ) : null}
    </Surface>
  );
}

function EvidenceCard({
  document,
  busy,
  onOpen,
  onRemove,
}: Readonly<{
  document: EvidenceDocument;
  busy: boolean;
  onOpen: () => void;
  onRemove: () => void;
}>) {
  const t = useTheme();
  const linkCount = document.linkedTransactionIds?.length ?? 0;
  return (
    <Surface style={[styles.evidenceCard, { borderColor: t.hairline }]}>
      <Text style={[styles.attemptTitle, { color: t.ink }]}>{document.filename}</Text>
      <Text style={[styles.attemptMeta, { color: t.muted }]}>
        {mediaLabel(document.mediaType)} · {formatBytes(document.byteSize)} · saved{' '}
        {formatDateTime(document.addedAtISO)}
      </Text>
      <Text style={[styles.attemptBody, { color: t.muted }]}>
        {document.extractionStatus === 'read'
          ? 'Melo read this original on the device.'
          : document.extractionStatus === 'unreadable'
            ? 'The original was kept, but reliable entries were not found.'
            : 'Saved as supporting evidence; it was not read for transactions.'}
        {linkCount > 0
          ? ` Linked to ${linkCount} confirmed ${linkCount === 1 ? 'record' : 'records'}.`
          : ''}
      </Text>
      <View style={styles.evidenceActions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onOpen}
          style={[styles.evidenceButton, { borderColor: t.hairline }]}
        >
          <Text style={[styles.evidenceButtonLabel, { color: t.ink }]}>
            {busy ? 'Working…' : 'Open source'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onRemove}
          style={[styles.evidenceButton, { borderColor: t.hairline }]}
        >
          <Text style={[styles.evidenceButtonLabel, { color: t.repairInk }]}>Remove</Text>
        </Pressable>
      </View>
    </Surface>
  );
}

function SectionTitle({ title, detail }: Readonly<{ title: string; detail: string }>) {
  const t = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: t.ink }]}>{title}</Text>
      <Text style={[styles.sectionDetail, { color: t.muted }]}>{detail}</Text>
    </View>
  );
}

function attemptResultLine(attempt: StatementImportRecord): string {
  const entries = attempt.rowCount;
  if ((attempt.outcome ?? 'added') === 'already-present') return 'No money was added again.';
  if (entries === 0) return 'No confirmed entries were added.';
  return `${entries} ${entries === 1 ? 'entry was' : 'entries were'} added after confirmation.`;
}

function outcomeLabel(outcome: NonNullable<StatementImportRecord['outcome']>): string {
  if (outcome === 'already-present') return 'already present';
  if (outcome === 'read-failed') return 'needs another read';
  if (outcome === 'unsupported-currency') return 'not supported';
  return 'added';
}

function reconciliationLabel(status: NonNullable<StatementImportRecord['reconciliationStatus']>) {
  if (status === 'ok') return 'figures matched';
  if (status === 'mismatch') return 'figures need review';
  return 'not enough figures to verify';
}

function mediaLabel(mediaType: string): string {
  if (mediaType.includes('pdf')) return 'PDF';
  if (mediaType.includes('image')) return 'Image';
  if (mediaType.includes('csv')) return 'CSV';
  return 'File';
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'unknown time';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerSpacer: { width: 24 },
  back: { fontSize: 22, lineHeight: 28 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  headline: { fontFamily: serif.display, fontSize: 34, lineHeight: 39, marginTop: gap.xl },
  intro: { fontFamily: serif.displayItalic, fontSize: 14, lineHeight: 21, marginTop: gap.sm },
  summaryGrid: { flexDirection: 'row', gap: gap.sm, marginTop: gap.xl },
  summary: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 82,
    padding: gap.sm,
  },
  summaryValue: { fontFamily: serif.display, fontSize: 24, lineHeight: 29 },
  summaryLabel: { fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  primaryAction: {
    alignItems: 'center',
    borderRadius: radius.xl,
    justifyContent: 'center',
    marginTop: gap.md,
    minHeight: 52,
  },
  primaryActionLabel: { fontSize: 13, fontWeight: '700' },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: gap.sm,
    marginTop: gap.xl,
  },
  sectionTitle: { fontFamily: serif.display, fontSize: 18, lineHeight: 23 },
  sectionDetail: { fontSize: 11.5 },
  emptyCard: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: gap.md },
  emptyTitle: { fontFamily: serif.display, fontSize: 17, lineHeight: 22 },
  emptyBody: { fontSize: 12, lineHeight: 18, marginTop: gap.xs },
  attemptCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: gap.sm,
    padding: gap.md,
  },
  attemptTop: { alignItems: 'flex-start', flexDirection: 'row', gap: gap.sm },
  attemptText: { flex: 1 },
  attemptTitle: { fontFamily: serif.display, fontSize: 16, lineHeight: 21 },
  attemptMeta: { fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  outcome: { fontSize: 10.5, fontWeight: '700', maxWidth: 92, textAlign: 'right' },
  attemptBody: { fontSize: 12, lineHeight: 18, marginTop: gap.sm },
  factLine: { fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  inlineAction: { justifyContent: 'center', marginTop: gap.sm, minHeight: 44 },
  inlineActionLabel: { fontSize: 12, fontWeight: '700' },
  evidenceCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: gap.sm,
    padding: gap.md,
  },
  evidenceActions: { flexDirection: 'row', gap: gap.sm, marginTop: gap.md },
  evidenceButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  evidenceButtonLabel: { fontSize: 12, fontWeight: '700' },
});
