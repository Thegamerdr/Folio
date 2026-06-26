// One-row Truth Decision.
//
// Review is a decision moment, not an import table. One waiting row at a time, the
// action belongs to the row, nothing touches Today until the user taps Add. No file
// machinery sits above the row; no parser / category / system wording.

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type {
  DocumentItemInput,
  LocalDocumentStage,
  LocalImportDraft,
  LocalImportDraftEditInput,
  LocalImportRejectionReason,
} from '../../local/localLedger';
import {
  Body,
  Display,
  Eyebrow,
  GhostButton,
  Hairline,
  MoneyPad,
  Muted,
  PressureScreen,
  PrimaryAction,
  QuietLink,
  gap,
  magnitude,
  paper,
  poundsLabel,
} from './kit';
import { FileWorkbench, PasteSheet } from './fileWorkbench';
import { MeloPresence } from './melo';

const SAMPLE_CSV = [
  'Date,Description,Amount',
  '2026-06-26,Tesco,-42.00',
  '2026-06-25,Salary,1200.00',
  '2026-06-24,Gym membership,-29.99',
].join('\n');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1] ?? ''}`;
}

const REASON_COPY: Readonly<Record<string, string>> = {
  formula_like_text: 'Worth checking: this amount is higher than usual.',
  uncategorised: 'Needs a label before it is added.',
  ambiguous_amount: 'Worth checking: the amount looks unclear.',
  ambiguous_date: 'Worth checking: the date looks unclear.',
  possible_duplicate: 'This might be a duplicate.',
  possible_transfer: 'This might be a transfer between your accounts.',
  uncertain_counterparty: 'Worth checking: who this was with.',
  untrusted_parser_input: 'The wording needs a quick check.',
  missing_required_field: 'Add the missing detail before you add it.',
};

function reasonText(reasons: readonly string[]): string | null {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const reason of reasons) {
    const key = reason
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    const copy = REASON_COPY[key] ?? 'Worth a quick check before you add it.';
    if (!seen.has(copy)) {
      seen.add(copy);
      lines.push(copy);
    }
  }
  return lines.length === 0 ? null : lines.join(' ');
}

export function ImportReviewScreen({
  documentStages,
  drafts,
  onAddFromDocument,
  onApplyDraftEdit,
  onConfirmDraft,
  onDismissDraft,
  onMeloSuggestDraft,
  onPickDocument,
  onRemoveDocument,
  onStageImport,
}: {
  discoveryRows?: unknown;
  documentStages?: readonly LocalDocumentStage[] | undefined;
  drafts: readonly LocalImportDraft[];
  importSurfaceMode?: string | undefined;
  lastAction?: string | null | undefined;
  onAddFromDocument: (input: DocumentItemInput) => void;
  onApplyDraftEdit: (rowId: string, input: LocalImportDraftEditInput) => void;
  onConfirmDraft: (rowId: string) => void;
  onDismissDraft: (
    rowId: string,
    reason?: LocalImportRejectionReason,
    status?: 'Rejected' | 'Excluded',
  ) => void;
  onMeloSuggestDraft: (rowId: string) => void;
  onPickDocument: () => void;
  onRemoveDocument: (documentId: string) => void;
  onStartManualFromFile?: () => void;
  onStageImport: (text: string) => void;
  privateExampleMode?: boolean | undefined;
  summary?: unknown;
}) {
  const [decided, setDecided] = useState<readonly string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [editing, setEditing] = useState<LocalImportDraft | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const files = documentStages ?? [];

  const pending = drafts.filter((d) => !decided.includes(d.rowId));
  const current = pending[0];
  const total = drafts.length;
  const position = total - pending.length + 1;

  const decide = (rowId: string, action: () => void) => {
    action();
    setShowMore(false);
    setDecided((prev) => (prev.includes(rowId) ? prev : [...prev, rowId]));
  };

  if (!current) {
    return (
      <PressureScreen style={styles.screen}>
        <View style={styles.intro}>
          <Eyebrow>Review</Eyebrow>
          <Display style={styles.title}>
            {total === 0 ? 'Nothing to check right now.' : 'All caught up.'}
          </Display>
          <Body style={styles.sub}>
            {total === 0
              ? 'When you bring in a statement, each row waits here for you to decide — one at a time. Nothing is added on its own.'
              : 'Every waiting row has been handled. Your money path only reflects what you chose to add.'}
          </Body>
        </View>
        <MeloPresence state="melo_review_waiting" style={styles.melo} />
        <View style={styles.emptyActions}>
          <PrimaryAction
            accessibilityHint="Paste the lines from your banking app."
            label="Paste from your bank"
            onPress={() => setPasteOpen(true)}
          />
          <GhostButton
            accessibilityHint="Choose a statement file or a photo of one."
            label="Choose a file"
            onPress={onPickDocument}
          />
          <QuietLink
            accessibilityHint="Loads a small sample statement so you can try reviewing."
            label="Try it with a sample"
            onPress={() => {
              setDecided([]);
              onStageImport(SAMPLE_CSV);
            }}
          />
        </View>
        <FileWorkbench
          files={files}
          onAddFromDocument={onAddFromDocument}
          onRemoveDocument={onRemoveDocument}
          showMelo={false}
        />
        <PasteSheet
          onClose={() => setPasteOpen(false)}
          onStage={onStageImport}
          visible={pasteOpen}
        />
      </PressureScreen>
    );
  }

  const out = current.amountMinor < 0;
  const flag = reasonText(current.reasons);

  return (
    <PressureScreen style={styles.screen}>
      <View style={styles.header}>
        <Eyebrow>Review</Eyebrow>
        <Text style={styles.counter}>
          {position} of {total} to check
        </Text>
      </View>

      <MeloPresence state="melo_review_safe_to_add" style={styles.melo} />

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.question}>
          Is this your {current.interpretation}?
        </Text>
        <Text style={styles.amount}>
          {magnitude(current.amountMinor)} {out ? 'out' : 'in'} · {formatDay(current.date)}
        </Text>
        <Muted style={styles.source}>From your statement</Muted>

        <View style={styles.consequence}>
          <Text style={styles.consequenceText}>
            If you add it, your payday picture {out ? 'drops' : 'rises'} by{' '}
            {magnitude(current.amountMinor)}.
          </Text>
        </View>

        {flag ? (
          <View style={styles.flag}>
            <View style={styles.flagDot} />
            <Text style={styles.flagText}>{flag}</Text>
          </View>
        ) : null}

        <PrimaryAction
          accessibilityHint="Adds this row to your money. Nothing changed until now."
          label="Add to my money"
          onPress={() => decide(current.rowId, () => onConfirmDraft(current.rowId))}
        />

        <View style={styles.secondaryRow}>
          <GhostButton
            accessibilityHint="Change this row before adding it."
            flex
            label="Edit"
            onPress={() => setEditing(current)}
          />
          <GhostButton
            accessibilityHint="Keep this row out of your money."
            flex
            label="Ignore"
            onPress={() => decide(current.rowId, () => onDismissDraft(current.rowId, 'other'))}
          />
        </View>

        <Pressable
          accessibilityHint="Shows more ways to handle this row."
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => setShowMore((v) => !v)}
          style={styles.moreToggle}
        >
          <Text style={styles.moreToggleText}>{showMore ? 'Fewer options' : 'More'}</Text>
        </Pressable>

        {showMore ? (
          <View style={styles.moreGrid}>
            <Hairline />
            <MoreOption
              label="It's a duplicate"
              onPress={() =>
                decide(current.rowId, () => onDismissDraft(current.rowId, 'duplicate'))
              }
            />
            <MoreOption
              label="It's a transfer between my accounts"
              onPress={() =>
                decide(current.rowId, () =>
                  onDismissDraft(current.rowId, 'transfer-internal', 'Excluded'),
                )
              }
            />
            <MoreOption
              label="Suggest a label for me"
              onPress={() => decide(current.rowId, () => onMeloSuggestDraft(current.rowId))}
            />
            <MoreOption
              label="Leave it for later"
              onPress={() => decide(current.rowId, () => undefined)}
            />
          </View>
        ) : null}
      </View>

      <EditSheet
        draft={editing}
        onCancel={() => setEditing(null)}
        onSave={(input) => {
          if (editing) onApplyDraftEdit(editing.rowId, input);
          setEditing(null);
        }}
      />

      <FileWorkbench
        files={files}
        onAddFromDocument={onAddFromDocument}
        onRemoveDocument={onRemoveDocument}
      />
      <PasteSheet onClose={() => setPasteOpen(false)} onStage={onStageImport} visible={pasteOpen} />
    </PressureScreen>
  );
}

function MoreOption({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.moreOption, pressed ? { opacity: 0.7 } : undefined]}
    >
      <Text style={styles.moreOptionText}>{label}</Text>
    </Pressable>
  );
}

function EditSheet({
  draft,
  onCancel,
  onSave,
}: {
  draft: LocalImportDraft | null;
  onCancel: () => void;
  onSave: (input: LocalImportDraftEditInput) => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [primed, setPrimed] = useState<string | null>(null);

  if (draft && primed !== draft.rowId) {
    setPrimed(draft.rowId);
    setName(draft.interpretation);
    setAmount(String(Math.round(Math.abs(draft.amountMinor) / 100)));
  }

  return (
    <Modal animationType="slide" transparent visible={draft !== null} onRequestClose={onCancel}>
      <Pressable accessibilityLabel="Cancel" style={styles.scrim} onPress={onCancel} />
      <View style={styles.editSheet}>
        <View style={styles.sheetHandle} />
        <Text accessibilityRole="header" style={styles.editTitle}>
          Change it before you add it
        </Text>
        <Text style={styles.editLabel}>What is it?</Text>
        <TextInput
          accessibilityLabel="What this row is"
          onChangeText={setName}
          placeholder="e.g. Tesco shop"
          placeholderTextColor={paper.muted}
          style={styles.input}
          value={name}
        />
        <Text style={styles.editLabel}>How much?</Text>
        <Text style={styles.editAmount}>{poundsLabel(amount)}</Text>
        <MoneyPad onChange={setAmount} value={amount} />
        <View style={styles.editFooter}>
          <GhostButton flex label="Cancel" onPress={onCancel} />
          <View style={styles.flex}>
            <PrimaryAction
              label="Save"
              onPress={() => {
                const sign = draft && draft.amountMinor < 0 ? '-' : '';
                const pounds = amount.replace(/[^0-9]/g, '') || '0';
                onSave({
                  interpretation: name.trim() || (draft?.interpretation ?? ''),
                  amountText: `${sign}${pounds}`,
                  date: draft?.date ?? '',
                });
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { gap: gap.lg },
  melo: { marginBottom: gap.xs },
  intro: { gap: gap.sm, paddingTop: gap.lg },
  title: { fontSize: 30, lineHeight: 36 },
  sub: { color: paper.secondary, fontSize: 16, lineHeight: 23 },
  emptyActions: { gap: gap.sm, marginTop: gap.md },

  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  counter: { color: paper.muted, fontSize: 13, fontWeight: '700' },

  card: {
    backgroundColor: paper.surface,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairline,
    padding: gap.xl,
    gap: gap.md,
    shadowColor: '#10241C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 3,
  },
  question: {
    color: paper.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  amount: {
    color: paper.ink,
    fontSize: 19,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  source: { marginTop: -4 },

  consequence: {
    backgroundColor: paper.sunken,
    borderRadius: 14,
    padding: gap.md,
  },
  consequenceText: { color: paper.ink, fontSize: 15, lineHeight: 21, fontWeight: '500' },

  flag: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  flagDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: paper.warm, marginTop: 7 },
  flagText: { color: paper.warmInk, fontSize: 14, lineHeight: 20, flex: 1 },

  secondaryRow: { flexDirection: 'row', gap: gap.sm },

  moreToggle: { alignSelf: 'center', paddingVertical: 6 },
  moreToggleText: { color: paper.secondary, fontSize: 15, fontWeight: '600' },

  moreGrid: { gap: 2 },
  moreOption: { paddingVertical: 14 },
  moreOptionText: { color: paper.ink, fontSize: 16 },

  scrim: { flex: 1, backgroundColor: 'rgba(24, 35, 29, 0.42)' },
  editSheet: {
    backgroundColor: paper.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: gap.xl,
    paddingTop: gap.md,
    paddingBottom: gap.xxxl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: paper.hairline,
    marginBottom: gap.lg,
  },
  editTitle: { color: paper.ink, fontSize: 22, fontWeight: '800', marginBottom: gap.md },
  editLabel: { color: paper.muted, fontSize: 13, fontWeight: '700', marginTop: gap.sm },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: paper.hairlineStrong,
    paddingVertical: 8,
    fontSize: 18,
    color: paper.ink,
    marginBottom: gap.sm,
  },
  editAmount: {
    color: paper.ink,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingVertical: gap.xs,
  },
  editFooter: { flexDirection: 'row', gap: gap.sm, marginTop: gap.md },
});
