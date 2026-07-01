// Check what Folio found — the editable visualizer.
//
// This is the list view that sits BETWEEN bringing something in and the one-row Review decision:
// a readable, editable list of everything Folio found, where you correct, ignore, or choose what to
// add. It reads as a calm checklist of human payments on warm paper, never a grid of cells. Nothing
// here touches Today; only the items you add (below) ever do.
//
// The list reads the found items the engine already holds. Editing, ignoring, and adding all go
// through the same engine paths the one-row Review uses, so there is one source of truth.
//
// Layout is a faithful port of the Folio WEB screen (ScreenVisualizer.tsx): a back/statement top
// bar, an italic "From your statement" kicker over the headline, three summary chips on the near-
// white inset, a single surface card of editable rows (20px SQUARE accent checkbox, not a round
// tick), and a sticky bottom CTA. Built from RN primitives composing the pressure-map kit.

import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { LocalImportDraft, LocalImportDraftEditInput } from '../../local/localLedger';
import {
  Body,
  CheckGlyph,
  Eyebrow,
  elevation,
  GhostButton,
  Headline,
  MoneyPad,
  Muted,
  PressureScreen,
  PrimaryAction,
  QuietLink,
  gap,
  poundsLabel,
  radius,
  serif,
  useTheme,
  type Palette,
} from './kit';
import { MeloPresence } from './melo';
import { ScreenHeader } from './secondaryKit';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1] ?? ''}`;
}

// The row amount always reads as money, to two decimal places, matching the web (toFixed(2)).
// Derived purely from the existing draft minor amount — no new data, no formatting drift in sign.
function magnitude2dp(minor: number): string {
  return `£${(Math.abs(minor) / 100).toFixed(2)}`;
}

// A light, editable type guess from the interpretation + flow. The user can change it in the edit
// sheet; this is only the suggested label shown on the row.
function suggestedType(draft: LocalImportDraft): string {
  if (draft.amountMinor >= 0) {
    if (/refund|reimburse|cashback|rebate|return/i.test(draft.interpretation)) return 'Refund';
    return /salary|wage|pay|income|payroll/i.test(draft.interpretation) ? 'Income' : 'Money in';
  }
  if (
    /rent|energy|octopus|council|water|broadband|insurance|mobile|gas|electric|bill/i.test(
      draft.interpretation,
    )
  ) {
    return 'Bill';
  }
  if (/klarna|loan|card|debt|finance|bnpl|repayment/i.test(draft.interpretation)) {
    return 'Debt payment';
  }
  return 'Spending';
}

function needsCheck(draft: LocalImportDraft): boolean {
  return draft.status === 'Needs review' || draft.reasons.length > 0;
}

export function FoundItemsScreen({
  drafts,
  onApplyDraftEdit,
  onConfirmMany,
  onDismissDraft,
  onReviewItem,
  onLeaveForLater,
}: {
  drafts: readonly LocalImportDraft[];
  onApplyDraftEdit: (rowId: string, input: LocalImportDraftEditInput) => void;
  onConfirmMany: (rowIds: readonly string[]) => void;
  onDismissDraft: (rowId: string) => void;
  onReviewItem: (rowId: string) => void;
  onLeaveForLater: () => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  // Everything starts ticked — the user excludes what doesn't belong. Excluding is local and
  // reversible until they tap Add; it never mutates the ledger.
  const [excluded, setExcluded] = useState<readonly string[]>([]);
  const [editing, setEditing] = useState<LocalImportDraft | null>(null);

  const included = drafts.filter((d) => !excluded.includes(d.rowId));
  const checkCount = drafts.filter((d) => needsCheck(d)).length;
  const clearCount = drafts.length - checkCount;

  const toggle = (rowId: string) =>
    setExcluded((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId],
    );

  if (drafts.length === 0) {
    return (
      <PressureScreen style={styles.screen}>
        <ScreenHeader label="From your statement" onBack={onLeaveForLater} />
        <View style={styles.head}>
          <Eyebrow>From your statement</Eyebrow>
          <Text accessibilityRole="header" style={styles.title}>
            Nothing to check yet.
          </Text>
          <Body style={styles.sub}>
            When you bring in a statement, everything Folio finds shows up here for you to check —
            before any of it counts.
          </Body>
        </View>
        <MeloPresence state="melo_review_waiting" style={styles.melo} />
        <PrimaryAction label="Back" onPress={onLeaveForLater} />
      </PressureScreen>
    );
  }

  return (
    <PressureScreen style={styles.screen}>
      {/* Top bar — back (← / Later both leave for later) · statement marker · balancing spacer. */}
      <ScreenHeader label="From your statement" onBack={onLeaveForLater} />

      <View style={styles.head}>
        <Text style={styles.kicker}>From your statement</Text>
        <Headline lead="Check what Folio " accent="found" tail="." style={styles.titleHeadline} />
        <Muted style={styles.sub}>Nothing is added until you choose.</Muted>

        <View style={styles.tallies}>
          <View style={styles.tallyStrong}>
            <Text style={styles.tallyStrongText}>{drafts.length} found</Text>
          </View>
          <View style={styles.tally}>
            <Text style={styles.tallyText}>{clearCount} clear</Text>
          </View>
          <View style={styles.tally}>
            <Text style={styles.tallyText}>{checkCount} to check</Text>
          </View>
        </View>
      </View>

      <MeloPresence state="melo_review_waiting" style={styles.melo} />

      {/* The editable list — one calm row per found item on a single surface card, hairline-divided.
          Tap the square to include/exclude, tap the row to review it on its own, or use Edit. Not a
          grid; rows on paper. */}
      <View style={styles.list}>
        {drafts.map((draft, index) => {
          const isIn = draft.amountMinor >= 0;
          const isIncluded = !excluded.includes(draft.rowId);
          const isCheck = needsCheck(draft);
          return (
            <View key={draft.rowId} style={[styles.row, index > 0 ? styles.rowDivider : undefined]}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isIncluded }}
                accessibilityLabel={`${isIncluded ? 'Including' : 'Leaving out'} ${draft.interpretation}`}
                hitSlop={10}
                onPress={() => toggle(draft.rowId)}
                style={[styles.check, isIncluded ? styles.checkOn : styles.checkOff]}
              >
                {isIncluded ? <CheckGlyph color={t.inverse} size={14} /> : null}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityHint="Reviews this one on its own."
                onPress={() => onReviewItem(draft.rowId)}
                style={styles.rowBody}
              >
                <Text style={styles.rowName} numberOfLines={1}>
                  {draft.interpretation}
                </Text>
                <View style={styles.rowMetaLine}>
                  <Text style={styles.rowMeta}>{formatDay(draft.date)}</Text>
                  <Text style={styles.rowDot}>·</Text>
                  <Text style={[styles.rowMeta, isCheck ? styles.rowMetaCheck : undefined]}>
                    {suggestedType(draft)}
                  </Text>
                </View>
              </Pressable>

              <Text style={[styles.amount, isIn ? styles.amountIn : styles.amountOut]}>
                {isIn ? '+' : '−'}
                {magnitude2dp(draft.amountMinor)}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${draft.interpretation}`}
                hitSlop={8}
                onPress={() => setEditing(draft)}
                style={styles.editButton}
              >
                <Text style={styles.editLabel}>Edit</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Sticky bottom CTA — adds only the ticked items; "Later" leaves everything here unchanged. */}
      <View style={styles.footer}>
        <View style={styles.footerCta}>
          <PrimaryAction
            accessibilityHint="Adds the items you kept ticked to your money. The rest stay out."
            label={
              included.length > 0 ? `Add ${included.length} to my money` : 'Choose what to add'
            }
            disabled={included.length === 0}
            onPress={() => onConfirmMany(included.map((d) => d.rowId))}
          />
        </View>
        <QuietLink
          accessibilityHint="Keeps everything here, unchanged, for later."
          label="Leave for later"
          onPress={onLeaveForLater}
        />
      </View>

      <EditFoundItemSheet
        draft={editing}
        onCancel={() => setEditing(null)}
        onSave={(input) => {
          if (editing) onApplyDraftEdit(editing.rowId, input);
          setEditing(null);
        }}
      />
    </PressureScreen>
  );
}

const TYPES: readonly { label: string; flow: 'in' | 'out' }[] = [
  { label: 'Spending', flow: 'out' },
  { label: 'Income', flow: 'in' },
  { label: 'Bill', flow: 'out' },
  { label: 'Debt payment', flow: 'out' },
  { label: 'Refund', flow: 'in' },
  { label: 'Transfer', flow: 'out' },
];

function EditFoundItemSheet({
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
  const [type, setType] = useState<(typeof TYPES)[number]>(TYPES[0]!);
  const [primed, setPrimed] = useState<string | null>(null);

  if (draft && primed !== draft.rowId) {
    setPrimed(draft.rowId);
    setName(draft.interpretation);
    setAmount(String(Math.round(Math.abs(draft.amountMinor) / 100)));
    setType(draft.amountMinor >= 0 ? (TYPES[1] ?? TYPES[0]!) : TYPES[0]!);
  }

  return (
    <Modal animationType="slide" transparent visible={draft !== null} onRequestClose={onCancel}>
      <Pressable accessibilityLabel="Cancel" style={styles.scrim} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.sheetTitle}>
            Correct it before it counts.
          </Text>

          <Text style={styles.label}>What is it?</Text>
          <TextInput
            accessibilityLabel="What this payment is"
            onChangeText={setName}
            placeholder="e.g. Tesco shop"
            placeholderTextColor={t.muted}
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            {TYPES.map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityState={{ selected: type.label === option.label }}
                onPress={() => setType(option)}
                style={[
                  styles.typeChip,
                  type.label === option.label ? styles.typeChipOn : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    type.label === option.label ? styles.typeChipTextOn : undefined,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>How much?</Text>
          <Text style={styles.editAmount}>{poundsLabel(amount)}</Text>
          <MoneyPad onChange={setAmount} value={amount} />

          <View style={styles.editFooter}>
            <GhostButton flex label="Cancel" onPress={onCancel} />
            <View style={styles.flex}>
              <PrimaryAction
                label="Save"
                onPress={() => {
                  const pounds = amount.replace(/[^0-9]/g, '') || '0';
                  onSave({
                    interpretation: name.trim() || (draft?.interpretation ?? ''),
                    amountText: `${type.flow === 'out' ? '-' : ''}${pounds}`,
                    date: draft?.date ?? '',
                  });
                }}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    flex: { flex: 1 },
    screen: { gap: gap.lg },
    head: { gap: gap.xs, paddingTop: gap.xs },

    // Italic "From your statement" kicker — web uses font-display italic, 13px, muted ink.
    kicker: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
    },
    title: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 27,
      lineHeight: 33,
      letterSpacing: -0.3,
      marginTop: 2,
    },
    titleHeadline: { marginTop: 4 },
    sub: { marginTop: gap.xs },
    melo: { marginTop: gap.xs },

    // Summary chips — near-white inset wells. "N found" is ink-medium; "clear" / "to check" are muted.
    tallies: { flexDirection: 'row', gap: gap.xs, marginTop: gap.md },
    tallyStrong: {
      backgroundColor: t.inset,
      borderRadius: radius.pill,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    tallyStrongText: { color: t.ink, fontSize: 11, fontWeight: '600' },
    tally: {
      backgroundColor: t.inset,
      borderRadius: radius.pill,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    tallyText: { color: t.muted, fontSize: 11, fontWeight: '500' },

    // Single surface card, web rounded-2xl (32) with a soft lift; rows hairline-divided inside.
    list: {
      backgroundColor: t.surface,
      borderRadius: radius.xxl,
      paddingHorizontal: gap.md,
      ...elevation.card,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: gap.sm, paddingVertical: 14 },
    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.hairline,
    },

    // The web checkbox is a 20px SQUARE: accent fill + white tick when on, ink/40 border when off.
    // Not a round green tick — square keeps the "tick each line" checklist reading.
    check: {
      width: 20,
      height: 20,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: t.calm, borderColor: t.calm },
    // Web uses an ink/40 border on a transparent ground; `hairlineStrong` is the palette's strong
    // divider and carries the same "quiet outline" relationship on BOTH grounds (a faint dark line on
    // cream, a faint light line on warm-black) — so it replaces the light-only ink/40 literal.
    checkOff: { backgroundColor: 'transparent', borderColor: t.hairlineStrong },

    rowBody: { flex: 1, minWidth: 0 },
    rowName: { color: t.ink, fontSize: 14, fontWeight: '600' },
    rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    rowMeta: { color: t.muted, fontSize: 11.5 },
    // "to check" reads in caution amber, matching web text-[var(--caution)].
    rowMetaCheck: { color: t.caution },
    rowDot: { color: t.muted, fontSize: 11.5 },

    amount: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
    amountIn: { color: t.positive },
    amountOut: { color: t.ink },

    editButton: { paddingLeft: 2 },
    editLabel: { color: t.muted, fontSize: 11.5 },

    // Sticky footer: the CTA carries its own lift; "Leave for later" is the quiet secondary path.
    footer: { gap: gap.xs, marginTop: gap.sm, alignItems: 'stretch' },
    footerCta: { alignSelf: 'stretch' },

    scrim: { flex: 1, backgroundColor: 'rgba(26, 24, 21, 0.42)' },
    sheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: gap.xl,
      paddingTop: gap.md,
      paddingBottom: gap.xxxl,
      maxHeight: '90%',
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.hairline,
      marginBottom: gap.lg,
    },
    sheetTitle: { color: t.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
    label: { color: t.muted, fontSize: 13, fontWeight: '700', marginTop: gap.lg },
    input: {
      borderBottomWidth: 1.5,
      borderBottomColor: t.hairlineStrong,
      paddingVertical: 8,
      fontSize: 18,
      color: t.ink,
    },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.xs, marginTop: gap.sm },
    typeChip: {
      borderRadius: radius.pill,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: t.hairline,
      backgroundColor: t.surface,
    },
    typeChipOn: { borderColor: t.calm, backgroundColor: t.calmSoft },
    typeChipText: { color: t.secondary, fontSize: 13.5, fontWeight: '600' },
    typeChipTextOn: { color: t.calmStrong },
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
