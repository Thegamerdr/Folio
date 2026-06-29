// @rn-engine edit-txn — the full correction-history of an edited item is wired later (see BUILD_PLAN §3)
//
// EditItemSheet — the faithful 1:1 React Native port of the web found-item correction sheet
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetEditItem.tsx).
//
// @rn-sheet     EditItemSheet
// @purpose      Correct a found item (name, amount, type, optional note) BEFORE it's added. This is
//               the pre-truth correction form: it edits the candidate in hand, never the money path.
//               Nothing is committed from here — the user's later Accept (in Review/Visualizer) is the
//               only write. The web buttons all close; this port keeps that contract (close-only).
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

export type EditItemSheetProps = {
  visible: boolean;
  onClose: () => void;
};

// The type chips — the web `types` list, verbatim.
const TYPES = ['spending', 'income', 'bill', 'debt payment', 'transfer', 'refund'] as const;

// The web sample priming values — reused verbatim (no fabricated numbers).
const SAMPLE = { name: 'Tesco', amount: '42.00', date: '26 Jun', type: 'spending' as string };

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

export function EditItemSheet({ visible, onClose }: EditItemSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <EditItemForm styles={s} palette={t} onClose={onClose} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The form — the only render branch.
// ---------------------------------------------------------------------------

function EditItemForm({
  styles: s,
  palette: t,
  onClose,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  onClose: () => void;
}) {
  const [name, setName] = useState(SAMPLE.name);
  const [amount, setAmount] = useState(SAMPLE.amount);
  const [note, setNote] = useState('');
  const [type, setType] = useState<string>(SAMPLE.type);

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
          <Text style={s.dateValue}>{SAMPLE.date}</Text>
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

      {/* Primary — Save changes (close-only, faithful to the web). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save changes"
        onPress={onClose}
        style={({ pressed }) => [s.primary, { backgroundColor: t.calm }, pressed ? s.pressed : undefined]}
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
