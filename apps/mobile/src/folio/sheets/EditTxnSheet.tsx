// @rn-engine edit-txn — NO write. The web source's "Save changes" is a pure visual demo: it calls
//   `onClose` and mutates nothing (SheetEditTxn.tsx). The fields are a FROZEN, hardcoded subject
//   ("Tesco · 26 June" · £42.00 · Groceries · …) — not bound to any real transaction.
//
//   An earlier version of this port tried to make the save real by resolving the subject from a
//   HARDCODED merchant name ("Tesco") and routing a fixed patch through `editTransaction`. But no
//   caller threads a real subject: every opener (Timeline rows, the Review ⋯/Edit) calls
//   nav.openSheet('edit-txn') with no payload, so the sheet has no way to know WHICH row the user
//   meant. The hardcoded resolution therefore edited the wrong row — the first real txn that happened
//   to be named "Tesco" — or silently no-op'd. That is the bug this file is being corrected for.
//
//   The honest, faithful behaviour is the web's: show the frozen fields and close on save without
//   writing. `// @rn-engine edit-txn` marks where a non-destructive correction (the store's
//   `editTransaction`, ENGINES.md §6 — replace-in-place + append one correction record per changed
//   field, no-op on unchanged) would route ONCE a real subject can reach this sheet (a payload on
//   nav.openSheet, or a store editing-target slot — both outside this file, neither built yet).
//
// EditTxnSheet — the faithful 1:1 React Native port of the web edit-transaction sheet
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetEditTxn.tsx).
//
// @rn-sheet     EditTxnSheet
// @purpose      Review a transaction's fields (amount, category, repeat, note). The web source renders
//               them as read-only rows with a single "Save changes" that closes without writing; this
//               port keeps that visual + behavioural contract exactly.
// @writes       — none (faithful to the web demo; see the @rn-engine edit-txn note above).
// @copy         FROZEN (verbatim from the web source; these literals are not yet in COPY_DECK)
// @tokens       --surface (field rows) · --hairline (row borders) · --accent (t.calm, primary fill) ·
//               --muted-ink (field labels) · --ink (field values) · --inverse (primary label)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · press 0.97 on the close glyph + the
//               CTA; collapses to final state under reduce-motion (MOTION.md)
//
// Faithful 1:1 RN port. The web source renders ONE branch — the field summary (Tesco · 26 June) with
// four read-only rows. There is no empty/loading/error/offline branch (STATES.md has no row for an
// edit sheet). Per MELO_MOODS.md this sheet renders NO Melo ("No mood = no Melo").
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
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type EditTxnSheetProps = {
  visible: boolean;
  onClose: () => void;
};

// One read-only field row — key + value. The web source's four fields, verbatim.
type Field = { k: string; v: string };
const FIELDS: readonly Field[] = [
  { k: 'Amount', v: '£42.00' },
  { k: 'Category', v: 'Groceries' },
  { k: 'Repeat', v: 'Once' },
  { k: 'Note', v: 'Weekly shop' },
];

// The web title — verbatim ('Tesco · 26 June'). A frozen demo subject, not bound to a real row.
const TITLE = 'Tesco · 26 June';

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

export function EditTxnSheet({ visible, onClose }: EditTxnSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  // Save = close, faithful to the web demo (SheetEditTxn's "Save changes" → onClose). The fields are
  // a frozen, hardcoded subject not bound to any real row, and no caller threads a real subject
  // (nav.openSheet carries no payload), so writing here would correct the WRONG transaction. The save
  // therefore writes nothing and simply closes. `// @rn-engine edit-txn` — a non-destructive
  // correction (store `editTransaction`, ENGINES §6) routes here once a real subject can reach this
  // sheet; see the header note.
  function handleSave() {
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
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
          {TITLE}
        </Text>

        {/* Read-only field rows. */}
        <View style={s.fields}>
          {FIELDS.map((f) => (
            <View key={f.k} style={s.fieldRow}>
              <Text style={s.fieldLabel}>{f.k}</Text>
              <Text style={s.fieldValue}>{f.v}</Text>
            </View>
          ))}
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
    </Sheet>
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
