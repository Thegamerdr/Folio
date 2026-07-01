// @rn-engine edit-txn — the candidate-correction form is now REAL: it applies the user's edits to the
//   in-review candidate (name / amount / date / category / note) and hands the corrected candidate
//   back to its owner. It is a LOCAL correction before anything counts — never destructive, never a
//   money-path write. The owner's later Accept (Review/Visualizer → store.addTransaction) is the only
//   write. Full persisted correction-history is wired later (see BUILD_PLAN §3).
//
// EditItemSheet — the faithful 1:1 React Native port of the web found-item correction sheet
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetEditItem.tsx).
//
// @rn-sheet     EditItemSheet
// @purpose      Correct a found item (name, amount, date, category, optional note) BEFORE it's added.
//               This is the pre-truth correction form: it edits the candidate in hand, never the money
//               path. Nothing is committed from here — the user's later Accept (in Review/Visualizer)
//               is the only write. "Save changes" returns the corrected candidate to the owner via
//               `onSave`; the owner re-renders the row with the new values and lets Accept add them.
//               When no candidate is supplied (the shell's `visible`/`onClose`-only call), the form
//               renders the faithful sample and Save is a no-op close — the web close-only contract.
// @writes       — (no store mutation — review-before-truth; an Accept downstream is the only write)
// @copy         FROZEN (verbatim from the web source; these literals are not yet in COPY_DECK —
//               '@/folio/copy/copy' carries only currency.symbol for this sheet)
// @tokens       --surface (field wells) · --hairline (well borders) · --accent (t.calm, selected
//               type chip) · --inset (unselected type chip) · --muted-ink (labels) · --ink (values) ·
//               --negative (t.repair, "Ignore this") · --inverse (selected chip / primary label)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · press 0.97 on every chip + every CTA;
//               collapses to final state under reduce-motion (MOTION.md)
//
// Faithful 1:1 RN port. The web source renders ONE branch — the form, primed with the web's sample
// values (name 'Tesco', amount '42.00', type 'spending'). There is no empty/loading/error/offline
// branch (STATES.md has no row for an edit sheet); the only conditional visual is the selected type
// chip. Per MELO_MOODS.md this sheet renders NO Melo ("No mood = no Melo").
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme' (which
// re-exports the pressure-map kit). Nothing new is defined — no colour, font, spacing, or dependency.
// The web '×' close glyph is drawn as a small inline react-native-svg cross (the codebase ships no
// icon font). The four field wells are RN Views + TextInputs (the web <label>/<input> pattern); the
// Date well is read-only (the web shows a static '26 Jun').
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
import { copy } from '@/folio/copy/copy';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// The in-review candidate this sheet corrects. A LOCAL pre-truth shape — every field is editable
// here, and nothing is a money fact until the owner's Accept calls `store.addTransaction`. `id` (when
// present) lets the owner key the corrected candidate back onto the right row.
export type EditCandidate = {
  id?: string;
  /** The merchant / "what is it" line. */
  name: string;
  /** Signed £ — negative = spend, positive = inflow. Sign is preserved across the edit. */
  amount: number;
  /** Short display date, e.g. "26 Jun" (read-only here, carried through unchanged). */
  date?: string;
  /** The suggested type label (one of TYPES). */
  type?: string;
  /** Optional free-text note. */
  note?: string;
};

export type EditItemSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The candidate to correct. Omitted in the shell's close-only call → the faithful sample renders. */
  candidate?: EditCandidate;
  /** Receives the corrected candidate when the user taps "Save changes". Omitted → Save just closes
   *  (the web close-only contract, used by the shell's `visible`/`onClose`-only mount). */
  onSave?: (next: EditCandidate) => void;
};

// The type chips — the web `types` list, verbatim.
const TYPES = ['spending', 'income', 'bill', 'debt payment', 'transfer', 'refund'] as const;

// Blank defaults for a cold open (no candidate supplied — e.g. the shell's close-only mount or the
// Shortfall "edit" entry). The fields show their placeholders, NEVER a fake "Tesco · £42 · 26 Jun"
// pre-fill. `type` keeps a sensible default chip selected. A real candidate overrides every field.
const SAMPLE = { name: '', amount: '', date: '', type: 'spending' as string };

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
// EditItemSheet
// ---------------------------------------------------------------------------

export function EditItemSheet({ visible, onClose, candidate, onSave }: EditItemSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <EditItemForm
        styles={s}
        palette={t}
        onClose={onClose}
        candidate={candidate}
        onSave={onSave}
      />
    </Sheet>
  );
}

// The web type chip → an EditCandidate `type` label. The candidate's stored type may arrive in any
// casing (e.g. a reader's "Spending"); match it to a chip case-insensitively so the right chip lights
// up, falling back to the candidate's raw type, then the sample's. No new vocabulary — only the web's
// own TYPES list is offered.
function chipForType(type: string | undefined): string {
  if (!type) return SAMPLE.type;
  const lower = type.toLowerCase();
  const match = TYPES.find((option) => option === lower);
  return match ?? type;
}

// ---------------------------------------------------------------------------
// The form — the only render branch.
// ---------------------------------------------------------------------------

function EditItemForm({
  styles: s,
  palette: t,
  onClose,
  candidate,
  onSave,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  onClose: () => void;
  candidate?: EditCandidate | undefined;
  onSave?: ((next: EditCandidate) => void) | undefined;
}) {
  // Prime each field from the candidate in hand (or the faithful sample when none is supplied). The
  // amount shows the magnitude — the sign is the money fact and is preserved on save, not retyped.
  const [name, setName] = useState(candidate?.name ?? SAMPLE.name);
  const [amount, setAmount] = useState(
    candidate ? Math.abs(candidate.amount).toFixed(2) : SAMPLE.amount,
  );
  const [note, setNote] = useState(candidate?.note ?? '');
  const [type, setType] = useState<string>(candidate ? chipForType(candidate.type) : SAMPLE.type);

  // The Date well stays read-only (faithful to the web's static "26 Jun"); it is carried through the
  // correction unchanged. With no candidate, the sample's date renders exactly as before.
  const dateLabel = candidate?.date ?? SAMPLE.date;

  // Build the corrected candidate and hand it to the owner (LOCAL correction — never a store write).
  // The signed amount keeps the candidate's original sign: a blank/invalid amount falls back to the
  // candidate's current value rather than coercing to 0. With no candidate / no onSave (the shell's
  // close-only mount) this is a plain close — the web contract.
  function handleSave() {
    if (candidate && onSave) {
      const cleaned = amount.replace(/[^0-9.]/g, '');
      const magnitude = cleaned === '' ? Math.abs(candidate.amount) : Number(cleaned);
      const safeMagnitude = Number.isFinite(magnitude) ? magnitude : Math.abs(candidate.amount);
      const signed = candidate.amount >= 0 ? safeMagnitude : -safeMagnitude;
      const trimmedNote = note.trim();
      const resolvedType = type.trim() || candidate.type;
      onSave({
        ...candidate,
        name: name.trim() || candidate.name,
        amount: signed,
        // exactOptionalPropertyTypes: only set these when they resolve to a value; the spread keeps
        // the candidate's prior value otherwise (an emptied note/type is never written as undefined).
        ...(resolvedType ? { type: resolvedType } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
      });
    }
    onClose();
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Header — eyebrow + close glyph. */}
      <View style={s.headerRow}>
        <Text style={s.eyebrow}>Check this item</Text>
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
        Correct anything before it counts.
      </Text>

      {/* Name well. */}
      <View style={s.well}>
        <Text style={s.fieldLabel}>Name</Text>
        <TextInput
          accessibilityLabel="Name"
          onChangeText={setName}
          style={s.fieldValueInput}
          value={name}
        />
      </View>

      {/* Amount + Date row. */}
      <View style={s.gridRow}>
        <View style={[s.well, s.gridCell]}>
          <Text style={s.fieldLabel}>Amount</Text>
          <View style={s.amountValueRow}>
            <Text style={s.currency}>{copy.global.currency.symbol}</Text>
            <TextInput
              accessibilityLabel="Amount"
              keyboardType="decimal-pad"
              onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
              style={s.amountInput}
              value={amount}
            />
          </View>
        </View>
        <View style={[s.well, s.gridCell]}>
          <Text style={s.fieldLabel}>Date</Text>
          <Text style={s.dateValue}>{dateLabel}</Text>
        </View>
      </View>

      {/* Type chips. */}
      <View style={s.well}>
        <Text style={s.fieldLabel}>Type</Text>
        <View style={s.chipRow}>
          {TYPES.map((option) => {
            const on = type === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setType(option)}
                style={({ pressed }) => [
                  s.typeChip,
                  { backgroundColor: on ? t.calm : t.inset },
                  pressed ? s.pressed : undefined,
                ]}
              >
                <Text style={[s.typeChipLabel, { color: on ? t.inverse : t.muted }]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Note well (optional). */}
      <View style={s.well}>
        <Text style={s.fieldLabel}>Note (optional)</Text>
        <TextInput
          accessibilityLabel="Note"
          onChangeText={setNote}
          placeholder="Weekly shop"
          placeholderTextColor={t.muted}
          style={s.fieldValueInput}
          value={note}
        />
      </View>

      {/* Primary — Save changes: applies the correction to the in-review candidate and returns it to
          the owner (review-before-truth — no money-path write). With no candidate/onSave it closes,
          faithful to the web's close-only contract. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save changes"
        onPress={handleSave}
        style={({ pressed }) => [
          s.primary,
          { backgroundColor: t.calm },
          pressed ? s.pressed : undefined,
        ]}
      >
        <Text style={[s.primaryLabel, { color: t.inverse }]}>Save changes</Text>
      </Pressable>

      {/* Secondary row — Ignore this (negative) + Cancel. */}
      <View style={s.secondaryRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ignore this"
          onPress={onClose}
          style={({ pressed }) => [
            s.secondaryCell,
            { backgroundColor: t.surface, borderColor: t.hairline },
            pressed ? s.pressed : undefined,
          ]}
        >
          <Text style={[s.secondaryLabel, { color: t.repair }]}>Ignore this</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onClose}
          style={({ pressed }) => [
            s.secondaryCell,
            { backgroundColor: t.surface, borderColor: t.hairline },
            pressed ? s.pressed : undefined,
          ]}
        >
          <Text style={[s.secondaryLabel, { color: t.ink }]}>Cancel</Text>
        </Pressable>
      </View>
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
    // Field well — surface, hairline, rounded-xl, px-4 py-3.
    well: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.md,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    // 11px uppercase tracked label.
    fieldLabel: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    // 15px medium value input, mt-1.
    fieldValueInput: {
      color: t.ink,
      fontSize: 15,
      fontWeight: '500',
      marginTop: gap.xs,
      paddingVertical: 0,
    },
    // Amount + Date grid row, gap-3.
    gridRow: {
      columnGap: gap.md,
      flexDirection: 'row',
      marginTop: gap.md,
    },
    gridCell: {
      flex: 1,
      marginTop: 0,
    },
    amountValueRow: {
      alignItems: 'baseline',
      columnGap: gap.xs,
      flexDirection: 'row',
      marginTop: gap.xs,
    },
    currency: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 18,
      fontVariant: ['tabular-nums'],
    },
    amountInput: {
      color: t.ink,
      flex: 1,
      fontFamily: serif.display,
      fontSize: 18,
      fontVariant: ['tabular-nums'],
      paddingVertical: 0,
    },
    // 15px medium read-only Date value, mt-1.
    dateValue: {
      color: t.ink,
      fontSize: 15,
      fontWeight: '500',
      marginTop: gap.xs,
    },
    // Type chip row — wrap, gap-1.5, mt-2.
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.xs + gap.xxs,
      marginTop: gap.sm,
    },
    // px-3 py-1.5 rounded-full type chip.
    typeChip: {
      borderRadius: radius.pill,
      paddingHorizontal: gap.md,
      paddingVertical: 6,
    },
    typeChipLabel: {
      fontSize: 12,
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
    // Secondary row — Ignore + Cancel, gap-2.5, mt-2.
    secondaryRow: {
      columnGap: gap.md - gap.xxs,
      flexDirection: 'row',
      marginTop: gap.sm,
    },
    // h-12 (48) rounded-xl, surface, hairline. flex:1.
    secondaryCell: {
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      height: 48,
      justifyContent: 'center',
    },
    secondaryLabel: {
      fontSize: 13,
    },
    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
