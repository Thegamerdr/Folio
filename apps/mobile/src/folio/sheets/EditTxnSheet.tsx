// @rn-engine edit-txn — REAL. The web source's "Save changes" is a pure visual demo: it calls
//   `onClose` and mutates nothing (SheetEditTxn.tsx), and its fields are a FROZEN, hardcoded subject
//   ("Tesco · 26 June" · £42.00 · Groceries · …) bound to no real transaction. We intentionally make
//   the save real per the handoff + ENGINES.md §6: when the shell threads a `target` (the posted
//   transaction the opener chose), this sheet prefills from THAT row and Save routes a non-destructive
//   correction through the store's `editTransaction` (replace-in-place + append one immutable
//   correction record per changed field; a no-op patch records nothing), then closes.
//
//   The earlier no-op version documented the bug: every opener called nav.openSheet('edit-txn') with
//   NO payload, so the sheet could not know WHICH row the user meant — a hardcoded resolution from the
//   merchant name "Tesco" edited the wrong row. That is fixed at the source: nav.openSheet now carries
//   an optional `{ id }` payload (types.ts), the shell parks it in `editTxnTarget` and threads it here
//   as `target`, and ReviewScreen passes the candidate's real subject id. With NO target (cold open)
//   the sheet keeps a safe inert fallback — it shows the frozen sample and Save just closes, so it
//   never edits a random row.
//
// EditTxnSheet — the faithful 1:1 React Native port of the web edit-transaction sheet
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetEditTxn.tsx).
//
// @rn-sheet     EditTxnSheet
// @purpose      Correct an existing transaction. The web source renders amount / category / repeat /
//               note as read-only rows with a single "Save changes" that closes without writing; this
//               port keeps that visual frame and read-only Amount / Category / Repeat rows, and makes
//               the Note row a single editable field (the engine's `note` field — ENGINES §6) so a
//               real correction is possible. Save applies the change via the store, then closes.
// @writes       editTransaction (store; replace-in-place + one TxnEdit per changed field, §6). With no
//               target, or an unchanged note, NOTHING is written (the web close-only contract holds).
// @copy         FROZEN (verbatim frame; the field VALUES are bound from the real transaction)
// @tokens       --surface (field rows) · --hairline (row borders) · --accent (t.calm, primary fill) ·
//               --muted-ink (field labels) · --ink (field values) · --inverse (primary label)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · press 0.97 on the close glyph + the
//               CTA; collapses to final state under reduce-motion (MOTION.md)
//
// Faithful 1:1 RN port. The web source renders ONE branch — the field summary with four rows. There is
// no empty/loading/error/offline branch (STATES.md has no row for an edit sheet). Per MELO_MOODS.md
// this sheet renders NO Melo ("No mood = no Melo").
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme' (which
// re-exports the pressure-map kit). Nothing new is defined — no colour, font, spacing, or dependency.
// The web '×' close glyph is drawn as a small inline react-native-svg cross (the codebase ships no
// icon font).
//
// This sheet OWNS its Sheet host (visible / onClose), mounted as a sibling in the shell — mirroring
// the LogSpendSheet + OnboardingSheet pattern — so it never nests inside the generic sheet host.

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { editTransaction, useAppStore, type Transaction } from '@/folio/store';
import type { EditableTransaction } from '@/folio/lib/editTxn';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type EditTxnSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The posted transaction id the opener chose to correct. Threaded by the shell from
   *  nav.openSheet('edit-txn', { id }). Omitted / unresolved → the safe inert fallback. */
  target?: string | undefined;
};

// The store category enum → the human label shown on the read-only Category row. Matches the Timeline
// chip mapping so the same row reads identically wherever the user sees it.
const CATEGORY_LABEL: Readonly<Record<Transaction['category'], string>> = {
  food: 'Groceries',
  transport: 'Transport',
  bills: 'Bills',
  fun: 'Eating out',
  shopping: 'Shopping',
  income: 'Income',
  other: 'Other',
};

// "26 June" — the web title's date prose, computed from the real ISO `when`. Parsed at local midnight
// so the day agrees with the stored timestamp (no UTC drift), matching the Today/Timeline formatters.
function monthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

// The amount row value — magnitude with two decimals, faithful to the web "£42.00" (the sign is the
// money fact and is shown as the direction, not retyped here; this row is read-only).
function amountLabel(amount: number): string {
  return `£${Math.abs(amount).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed, mirrors the LogSpendSheet hook)
// ---------------------------------------------------------------------------

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

// ---------------------------------------------------------------------------
// EditTxnSheet
// ---------------------------------------------------------------------------

export function EditTxnSheet({ visible, onClose, target }: EditTxnSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  // Read the live transaction the opener chose. Reactive (useAppStore) so the row reflects the latest
  // values; `undefined` when no target is threaded or the id no longer resolves → inert fallback.
  const txn = useAppStore((st) =>
    target ? st.transactions.find((row) => row.id === target) : undefined,
  ) as EditableTransaction | undefined;

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      {txn ? (
        <EditTxnForm styles={s} palette={t} onClose={onClose} txn={txn} />
      ) : (
        <InertFallback styles={s} palette={t} onClose={onClose} />
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Real branch — prefilled from the threaded transaction. Save routes a non-destructive correction
// through the store's editTransaction (ENGINES §6), then closes.
// ---------------------------------------------------------------------------

function EditTxnForm({
  styles: s,
  palette: t,
  onClose,
  txn,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  onClose: () => void;
  txn: EditableTransaction;
}) {
  // The Note row is the one editable field (the engine's `note` field — §6). Primed from the real
  // transaction's note. Amount / Category / Repeat stay read-only display rows, faithful to the web.
  const [note, setNote] = useState(txn.note ?? '');

  const title = `${txn.merchant} · ${monthDay(txn.when)}`.replace(/ · $/, '');

  // Save — apply the correction to THIS transaction via the store. editTransaction runs the pure
  // applyTxnEdit engine, replaces the row in place (same id, no duplicate), and appends one immutable
  // TxnEdit record per changed field. A note left at its current value is a no-op and records nothing
  // (§6), so an accidental Save never fabricates history. Then close.
  function handleSave() {
    const trimmed = note.trim();
    const current = txn.note ?? '';
    // Only thread the note when it actually changed — exactOptionalPropertyTypes means we pass the
    // single changed field. editTransaction itself also no-ops an unchanged value, but skipping the
    // call when nothing changed keeps the write path quiet.
    if (trimmed !== current) {
      editTransaction(txn.id, { note: trimmed }, 'user');
    }
    onClose();
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Header — eyebrow + close glyph. */}
      <View style={s.headerRow}>
        <Text style={s.eyebrow}>Edit transaction</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [pressed ? s.pressed : undefined]}
        >
          <CloseGlyph color={t.muted} />
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={s.headline}>
        {title}
      </Text>

      {/* Read-only field rows — bound from the real transaction. */}
      <View style={s.fields}>
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Amount</Text>
          <Text style={s.fieldValue}>{amountLabel(txn.amount)}</Text>
        </View>
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Category</Text>
          <Text style={s.fieldValue}>{CATEGORY_LABEL[txn.category]}</Text>
        </View>
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Repeat</Text>
          <Text style={s.fieldValue}>Once</Text>
        </View>
        {/* Note — the one editable field. Styled exactly like a value cell so the row reads the same. */}
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Note</Text>
          <TextInput
            accessibilityLabel="Note"
            onChangeText={setNote}
            placeholder="Add a note"
            placeholderTextColor={t.muted}
            style={s.fieldValueInput}
            value={note}
          />
        </View>
      </View>

      {/* Primary — Save changes (non-destructive correction, then close). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save changes"
        onPress={handleSave}
        style={({ pressed }) => [s.primary, { backgroundColor: t.calm }, pressed ? s.pressed : undefined]}
      >
        <Text style={[s.primaryLabel, { color: t.inverse }]}>Save changes</Text>
      </Pressable>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Inert fallback — no target threaded (cold open). Shows the web's frozen sample and Save just closes
// (the web close-only contract). Never edits a row, so a payload-less open is always safe.
// ---------------------------------------------------------------------------

function InertFallback({
  styles: s,
  palette: t,
  onClose,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  onClose: () => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={s.headerRow}>
        <Text style={s.eyebrow}>Edit transaction</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [pressed ? s.pressed : undefined]}
        >
          <CloseGlyph color={t.muted} />
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={s.headline}>
        Nothing to edit here
      </Text>

      <View style={s.fields}>
        <Text style={[s.fieldValue, { color: t.muted }]}>
          Open this from a transaction — tap one in your timeline or a found item — and you can correct
          it here. Nothing&apos;s selected right now.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        style={({ pressed }) => [s.primary, { backgroundColor: t.calm }, pressed ? s.pressed : undefined]}
      >
        <Text style={[s.primaryLabel, { color: t.inverse }]}>Close</Text>
      </Pressable>
    </ScrollView>
  );
}

// Close glyph — the web '×', drawn inline. 18×18 user space.
function CloseGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M4 4 L14 14 M14 4 L4 14" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette.
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    eyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 24,
      letterSpacing: -0.3,
      lineHeight: 28,
      marginTop: gap.sm,
    },
    // Fields block — space-y-3, mt-5.
    fields: {
      marginTop: gap.lg + gap.xs,
      rowGap: gap.md,
    },
    // Field row — surface, hairline, rounded-xl, px-4 py-3, key left / value right.
    fieldRow: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    // 12px uppercase tracked label.
    fieldLabel: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    // 14px medium value.
    fieldValue: {
      color: t.ink,
      fontSize: 14,
      fontWeight: '500',
    },
    // The editable Note value — same 14px medium look as a value cell, right-aligned, flexed so the
    // input fills the row's right side without shifting the label.
    fieldValueInput: {
      color: t.ink,
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      marginLeft: gap.md,
      paddingVertical: 0,
      textAlign: 'right',
    },
    // Primary — full width, h-[54px], 2xl radius, terracotta, mt-6.
    primary: {
      alignItems: 'center',
      borderRadius: radius.xl,
      height: 54,
      justifyContent: 'center',
      marginTop: gap.xl,
    },
    primaryLabel: {
      fontSize: 15,
      fontWeight: '500',
    },
    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
