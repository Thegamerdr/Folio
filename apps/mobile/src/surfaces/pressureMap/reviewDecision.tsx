// One decision at a time, before it counts.
//
// Review is a decision moment, not an import table. One waiting payment at a time,
// the decision is the editorial hero — eyebrow, a serif question that leads, the
// amount given air, then one obvious action and quiet ways out. Nothing touches Today
// until you add it. No file machinery sits above the decision; no parser / category /
// system wording. Empty reads as a calm "nothing waiting", not a bare "no data".

import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type {
  DocumentItemInput,
  LocalDocumentStage,
  LocalImportDraft,
  LocalImportDraftEditInput,
  LocalImportRejectionReason,
} from '../../local/localLedger';
import {
  Body,
  Eyebrow,
  GhostButton,
  Hairline,
  Headline,
  MoneyPad,
  Muted,
  PressureScreen,
  PrimaryAction,
  QuietLink,
  gap,
  magnitude,
  poundsLabel,
  serif,
  useTheme,
  type Palette,
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
  onAddNote,
  onApplyDraftEdit,
  onCapturePhoto,
  onConfirmDraft,
  onDismissDraft,
  onMeloSuggestDraft,
  onOpenFoundItems,
  onPickDocument,
  onPickImage,
  onRemoveDocument,
  onStageImport,
  onViewFile,
}: {
  discoveryRows?: unknown;
  documentStages?: readonly LocalDocumentStage[] | undefined;
  drafts: readonly LocalImportDraft[];
  importSurfaceMode?: string | undefined;
  lastAction?: string | null | undefined;
  onAddFromDocument: (input: DocumentItemInput) => void;
  onAddNote?: ((documentId: string, note: string) => void) | undefined;
  onApplyDraftEdit: (rowId: string, input: LocalImportDraftEditInput) => void;
  onCapturePhoto?: (() => void) | undefined;
  onConfirmDraft: (rowId: string) => void;
  onDismissDraft: (
    rowId: string,
    reason?: LocalImportRejectionReason,
    status?: 'Rejected' | 'Excluded',
  ) => void;
  onMeloSuggestDraft: (rowId: string) => void;
  onOpenFoundItems?: (() => void) | undefined;
  onPickDocument: () => void;
  onPickImage?: (() => void) | undefined;
  onRemoveDocument: (documentId: string) => void;
  onStartManualFromFile?: () => void;
  onStageImport: (text: string) => void;
  onViewFile?: ((file: LocalDocumentStage) => void) | undefined;
  privateExampleMode?: boolean | undefined;
  summary?: unknown;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
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

  // Re-label this payment as something else (a refund, income, a bill, a debt payment) without
  // leaving the decision. It edits the same draft through the canonical edit path, flips the sign
  // to match the flow, and stays on the card so the dominant "Add" remains the next step. Nothing
  // is added until the user chooses — this only corrects what the card says it is.
  const reclassify = (draft: LocalImportDraft, label: string, flow: 'in' | 'out') => {
    const pounds = String(Math.round(Math.abs(draft.amountMinor) / 100));
    onApplyDraftEdit(draft.rowId, {
      interpretation: label,
      amountText: `${flow === 'out' ? '-' : ''}${pounds}`,
      date: draft.date,
    });
    setShowMore(false);
  };

  if (!current) {
    const handled = total > 0;
    return (
      <PressureScreen style={styles.screen}>
        <View style={styles.calmHeader}>
          <Eyebrow>Review</Eyebrow>
          <Headline
            lead={handled ? 'Everything is ' : 'Nothing is '}
            accent={handled ? 'checked' : 'waiting'}
            tail="."
          />
          <Body style={styles.calmBody}>
            {handled
              ? 'Everything you brought in has been decided. Your path to payday only moves on what you chose to add.'
              : 'Bring in a statement and each payment waits here, one at a time, for you to decide. Nothing is ever added on its own.'}
          </Body>
        </View>

        {/* Preview the SHAPE of the answer: one calm doorway showing what a decision looks like —
            never a bare "no data". */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.shape}
        >
          <RestGlyph />
          <Text style={styles.shapeLabel}>
            {handled ? 'All caught up' : "One at a time, when you're ready"}
          </Text>
        </View>

        <MeloPresence state="melo_review_waiting" style={styles.melo} />

        <View style={styles.emptyActions}>
          <PrimaryAction
            accessibilityHint="Paste the lines from your banking app."
            label="Paste from your bank"
            onPress={() => setPasteOpen(true)}
          />
          <View style={styles.intakeGrid}>
            <IntakeTile label="Choose a file" hint="PDF · CSV · text" onPress={onPickDocument} />
            {onPickImage ? (
              <IntakeTile label="Add an image" hint="screenshot · photo" onPress={onPickImage} />
            ) : null}
            {onCapturePhoto ? (
              <IntakeTile label="Take a photo" hint="snap a statement" onPress={onCapturePhoto} />
            ) : null}
            <IntakeTile
              label="Try a sample"
              hint="see it first"
              onPress={() => {
                setDecided([]);
                onStageImport(SAMPLE_CSV);
              }}
            />
          </View>
        </View>

        <FileWorkbench
          files={files}
          onAddFromDocument={onAddFromDocument}
          onAddNote={onAddNote}
          onRemoveDocument={onRemoveDocument}
          onViewFile={onViewFile}
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
      {/* The decision is the hero. Eyebrow + a quiet count, then a serif question that leads,
          the amount given real air below it. No card, no heavy box — the cream is the depth. */}
      <View style={styles.decision}>
        <View style={styles.decisionHead}>
          <Eyebrow>Review</Eyebrow>
          <Text style={styles.counter}>
            {position} of {total} to check
          </Text>
        </View>
        {onOpenFoundItems && total > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens the full editable list of everything Folio found."
            hitSlop={8}
            onPress={onOpenFoundItems}
            style={styles.seeAll}
          >
            <Text style={styles.seeAllText}>Check what Folio found — all {total}</Text>
          </Pressable>
        ) : null}

        {/* The question leads the page in the editorial serif — one calm human line. The
            interpretation is the variable part, so the whole question carries the accent (the
            italic display face) rather than splitting mid-line; reads as one thought. */}
        <Text accessibilityRole="header" style={styles.question}>
          Is this your {current.interpretation}?
        </Text>

        <Text
          accessibilityLabel={`${magnitude(current.amountMinor)} ${out ? 'out' : 'in'} on ${formatDay(
            current.date,
          )}, from your statement.`}
          style={[styles.amount, out ? styles.amountOut : styles.amountIn]}
        >
          {magnitude(current.amountMinor)}
          <Text style={styles.amountDirection}>{out ? '  out' : '  in'}</Text>
        </Text>
        <Muted style={styles.meta}>{formatDay(current.date)} · From your statement</Muted>

        <Body style={styles.consequence}>
          Add it and your payday picture {out ? 'drops' : 'rises'} by{' '}
          {magnitude(current.amountMinor)}.
        </Body>

        {flag ? (
          <View style={styles.flag}>
            <View style={styles.flagDot} />
            <Text style={styles.flagText}>{flag}</Text>
          </View>
        ) : null}
      </View>

      <MeloPresence state="melo_review_safe_to_add" style={styles.melo} />

      {/* One obvious action, then quiet ways out — never three equal buttons. */}
      <View style={styles.actions}>
        <PrimaryAction
          accessibilityHint="Adds this payment to your money. Nothing changed until now."
          label="Add to my money"
          onPress={() => decide(current.rowId, () => onConfirmDraft(current.rowId))}
        />
        <View style={styles.quietRow}>
          <QuietLink
            accessibilityHint="Change this payment before adding it."
            label="Edit"
            onPress={() => setEditing(current)}
          />
          <QuietLink
            accessibilityHint="Keep this one out of your money."
            label="Ignore"
            onPress={() => decide(current.rowId, () => onDismissDraft(current.rowId, 'other'))}
          />
        </View>

        <Pressable
          accessibilityHint="Shows more ways to handle this one."
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => setShowMore((v) => !v)}
          style={styles.moreToggle}
        >
          <Text style={styles.moreToggleText}>{showMore ? 'Fewer options' : 'More'}</Text>
        </Pressable>

        {showMore ? (
          <View style={styles.moreGrid}>
            {/* Take it out of your money entirely. */}
            <Hairline />
            <MoreOption
              label="It's a duplicate"
              onPress={() =>
                decide(current.rowId, () => onDismissDraft(current.rowId, 'duplicate'))
              }
            />
            <Hairline />
            <MoreOption
              label="It's a transfer between my accounts"
              onPress={() =>
                decide(current.rowId, () =>
                  onDismissDraft(current.rowId, 'transfer-internal', 'Excluded'),
                )
              }
            />

            {/* It's actually something else — re-label it, then add it. Stays on the card. */}
            <Hairline />
            <Text style={styles.moreCaption}>It's actually…</Text>
            <MoreOption label="A refund" onPress={() => reclassify(current, 'Refund', 'in')} />
            <Hairline />
            <MoreOption label="Income" onPress={() => reclassify(current, 'Income', 'in')} />
            <Hairline />
            <MoreOption label="A bill" onPress={() => reclassify(current, 'Bill', 'out')} />
            <Hairline />
            <MoreOption
              label="A debt payment"
              onPress={() => reclassify(current, 'Debt payment', 'out')}
            />

            {/* Quiet ways to defer or get help naming it. */}
            <Hairline />
            <MoreOption
              label="Suggest a label for me"
              onPress={() => decide(current.rowId, () => onMeloSuggestDraft(current.rowId))}
            />
            <Hairline />
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
        onAddNote={onAddNote}
        onRemoveDocument={onRemoveDocument}
        onViewFile={onViewFile}
      />
      <PasteSheet onClose={() => setPasteOpen(false)} onStage={onStageImport} visible={pasteOpen} />
    </PressureScreen>
  );
}

// One calm intake choice — a small surface tile in the empty-review grid. Not equal-weight with the
// dominant Paste action; these sit quiet below it.
function IntakeTile({
  label,
  hint,
  onPress,
}: {
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.intakeTile, pressed ? { opacity: 0.7 } : undefined]}
    >
      <Text style={styles.intakeTileLabel}>{label}</Text>
      <Text style={styles.intakeTileHint}>{hint}</Text>
    </Pressable>
  );
}

// A calm "at rest" mark for the empty state — a soft paydown horizon with a single settled
// point. It previews the shape of a decision (a payment landing on the line) without faking
// data. Near-flat, hairline only; the cream is the depth.
function RestGlyph() {
  const t = useTheme();
  return (
    <Svg width={72} height={44} viewBox="0 0 72 44">
      <Line
        x1={8}
        y1={30}
        x2={64}
        y2={30}
        stroke={t.hairlineStrong}
        strokeWidth={1.4}
        strokeDasharray="2 5"
        strokeLinecap="round"
      />
      <Path
        d="M8 30c10 0 12-12 22-12s14 12 24 12"
        stroke={t.calm}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
      />
      <Circle cx={30} cy={18} r={4} fill={t.surface} stroke={t.calm} strokeWidth={2} />
    </Svg>
  );
}

function MoreOption({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
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
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
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
          accessibilityLabel="What this payment is"
          onChangeText={setName}
          placeholder="e.g. Tesco shop"
          placeholderTextColor={t.muted}
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

function makeStyles(t: Palette) {
  return StyleSheet.create({
  flex: { flex: 1 },

  // Editorial page rhythm: generous, uneven air. The decision leads and owns the top of the
  // page; the action sits quiet below with a clear gap between them. Not a uniform card stack.
  screen: { gap: gap.xl },
  melo: { marginTop: gap.xs },

  // --- Empty state -------------------------------------------------------------------------
  calmHeader: { gap: gap.sm, paddingTop: gap.lg },
  calmBody: { color: t.secondary, marginTop: gap.xxs },
  shape: {
    alignItems: 'center',
    gap: gap.sm,
    paddingVertical: gap.xl,
  },
  shapeLabel: {
    color: t.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  emptyActions: { gap: gap.md },
  emptyQuiet: { alignItems: 'center', gap: gap.xxs },
  intakeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm },
  intakeTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.hairline,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: gap.md,
  },
  intakeTileLabel: { color: t.ink, fontSize: 14.5, fontWeight: '600' },
  intakeTileHint: { color: t.muted, fontSize: 11.5, marginTop: 2 },
  seeAll: { alignSelf: 'flex-start', marginTop: gap.xs },
  seeAllText: { color: t.calmStrong, fontSize: 13.5, fontWeight: '700' },

  // --- Active decision ---------------------------------------------------------------------
  decision: { gap: gap.sm, paddingTop: gap.md },
  decisionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  counter: { color: t.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },

  // The serif question is the editorial hero — it leads the page at headline scale, set in the
  // italic display face so the whole human question reads as the accent (the interpretation is
  // the variable part, so the line carries the accent rather than splitting mid-word).
  question: {
    color: t.ink,
    fontFamily: serif.displayItalic,
    fontSize: 29,
    lineHeight: 37,
    letterSpacing: -0.3,
    marginTop: gap.xs,
  },

  // The amount is the figure that matters next to the verdict — large, tabular, given air.
  amount: {
    fontSize: 46,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1.4,
    fontVariant: ['tabular-nums'],
    marginTop: gap.md,
  },
  amountIn: { color: t.positiveInk }, // money in reads green — "you make it"
  amountOut: { color: t.ink },
  amountDirection: {
    fontSize: 20,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: 0,
    color: t.muted,
  },
  meta: { marginTop: gap.xxs },

  consequence: { color: t.secondary, marginTop: gap.sm },

  flag: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: gap.xs,
  },
  flagDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.warm, marginTop: 7 },
  flagText: { color: t.warmInk, fontSize: 14, lineHeight: 20, flex: 1 },

  // --- Actions -----------------------------------------------------------------------------
  actions: { gap: gap.sm },
  quietRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: gap.xl,
  },

  moreToggle: { alignSelf: 'center', paddingVertical: 6, marginTop: gap.xxs },
  moreToggleText: { color: t.muted, fontSize: 14, fontWeight: '600' },

  moreGrid: { marginTop: gap.xs },
  moreOption: { paddingVertical: 15 },
  moreOptionText: { color: t.ink, fontSize: 16 },
  moreCaption: {
    color: t.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    paddingTop: gap.sm,
  },

  // --- Edit sheet --------------------------------------------------------------------------
  scrim: { flex: 1, backgroundColor: 'rgba(26, 24, 21, 0.42)' },
  editSheet: {
    backgroundColor: t.surface,
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
    backgroundColor: t.hairline,
    marginBottom: gap.lg,
  },
  editTitle: { color: t.ink, fontSize: 22, fontWeight: '800', marginBottom: gap.md },
  editLabel: { color: t.muted, fontSize: 13, fontWeight: '700', marginTop: gap.sm },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: t.hairlineStrong,
    paddingVertical: 8,
    fontSize: 18,
    color: t.ink,
    marginBottom: gap.sm,
  },
  editAmount: {
    color: t.ink,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingVertical: gap.xs,
  },
  editFooter: { flexDirection: 'row', gap: gap.sm, marginTop: gap.md },
  });
}
