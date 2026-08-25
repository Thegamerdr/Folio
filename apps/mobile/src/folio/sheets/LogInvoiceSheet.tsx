// @rn-sheet     LogInvoiceSheet
// @purpose      Log an incoming invoice / gig payment for the Irregular Income lens. Extends runway
//               immediately because the strategy reads `currentBalance.amount` when deriving
//               weeks-covered.
// @writes       addTransaction (positive amount, category="income")
// @copy         FROZEN (verbatim from the web source; not yet in COPY_DECK except currency.symbol)
// @tokens       --surface --hairline --accent --positive (mapped to t.surface / t.hairline / t.calm /
//               t.positive via '@/folio/theme')
// @notes        Lightweight — no client selection, no VAT maths. That lives in the RN app's future
//               invoicing surface (see ENGINES.md RN-scope). The Irregular Income lens itself (the
//               strategy that reads this transaction to derive runway) is NOT ported yet — this sheet
//               only performs the one real, already-supported write (a positive manual transaction),
//               which is honest and useful on its own regardless of lens status.
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetLogInvoice.tsx). The web
// source has ONE render branch — the form is always ready (source='', amount=''); STATES.md has no row
// for it, so there is no empty/loading/error/offline branch, matching the sibling LogSpendSheet.
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme' (which
// re-exports the pressure-map kit). Nothing new is defined — no colour, font, spacing value, or
// dependency. Self-hosting sheet (mirrors LogSpendSheet) — owns its own kit Sheet, visible/onClose only.
//
// Money discipline: the amount is stored POSITIVE (an inflow), category 'income' — the exact inverse of
// LogSpendSheet's negative spend. The web `source` field (an invoice's "who paid you") maps to
// Transaction.merchant, matching the store's existing shape (no new field).

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { copy } from '@/folio/copy/copy';
import { addTransaction } from '@/folio/store';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type LogInvoiceSheetProps = {
  // Whether the sheet is mounted/visible — wired straight to the kit Sheet primitive.
  visible: boolean;
  onClose: () => void;
};

const PRESS_SCALE = 0.97; // .press — scale 0.97 on :active

// The web's default "From" label when the field is left blank ("Invoice").
const DEFAULT_SOURCE = 'Invoice';

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed, mirrors LogSpendSheet's hook exactly)
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
// LogInvoiceSheet
// ---------------------------------------------------------------------------

export function LogInvoiceSheet({ visible, onClose }: LogInvoiceSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <LogInvoiceForm styles={s} palette={t} reduceMotion={reduceMotion} onClose={onClose} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The form — the only render branch (web source has one state: populated/default).
// ---------------------------------------------------------------------------

function LogInvoiceForm({
  styles: s,
  palette: t,
  reduceMotion,
  onClose,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
  onClose: () => void;
}) {
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [sourceFocused, setSourceFocused] = useState(false);

  const canSave = parseFloat(amount) > 0;

  function save() {
    const label = source.trim() || DEFAULT_SOURCE;
    const v = parseFloat(amount);
    if (!(v > 0)) return;
    addTransaction({ merchant: label, amount: Math.abs(v), category: 'income', source: 'manual' });
    onClose();
  }

  return (
    <View style={s.body}>
      {/* Canonical pinned sheet header. */}
      <Text style={s.eyebrow}>Log an invoice</Text>
      <Text style={s.headline} accessibilityRole="header">
        What just landed?
      </Text>

      <View style={s.fields}>
        <View>
          <Text style={s.fieldLabel}>From</Text>
          <TextInput
            accessibilityLabel="From"
            autoFocus
            onBlur={() => setSourceFocused(false)}
            onChangeText={setSource}
            onFocus={() => setSourceFocused(true)}
            placeholder="e.g. Studio Ltd"
            placeholderTextColor={t.muted}
            returnKeyType="done"
            style={[s.fieldInput, sourceFocused ? s.fieldInputFocused : null]}
            value={source}
          />
        </View>

        <View style={s.nextField}>
          <Text style={s.fieldLabel}>Amount</Text>
          <View style={s.amountField}>
            <Text style={s.currency}>{copy.global.currency.symbol}</Text>
            <TextInput
              accessibilityLabel="Amount"
              keyboardType="decimal-pad"
              onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              placeholderTextColor={t.muted}
              style={s.amountInput}
              value={amount}
            />
          </View>
        </View>
      </View>

      {/* Reassurance line — the web's honest "no tax maths" caption (literal). */}
      <Text style={s.hint}>
        Adds to your balance and extends runway right away. No tax maths — just the honest number.
      </Text>

      {/* Primary — 'Log it'; disabled until amount > 0. */}
      <PressCta
        label="Log it"
        onPress={save}
        disabled={!canSave}
        reduceMotion={reduceMotion}
        style={[s.primary, !canSave ? s.primaryDisabled : null]}
        labelStyle={s.primaryLabel}
        accessibilityLabel="Log it"
      />

      {/* Dismiss — 'Not yet'; only ever calls onClose. */}
      <PressCta
        label="Not yet"
        onPress={onClose}
        reduceMotion={reduceMotion}
        style={s.dismiss}
        labelStyle={s.dismissLabel}
        accessibilityLabel="Not yet"
        hitSlop={{ top: 2, bottom: 2 }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// PressCta — a full-width button with the .press scale (mirrors LogSpendSheet's helper exactly).
// ---------------------------------------------------------------------------

function PressCta({
  label,
  onPress,
  disabled,
  reduceMotion,
  style,
  labelStyle,
  accessibilityLabel,
  hitSlop,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  reduceMotion: boolean;
  style: object | (object | null)[];
  labelStyle: object;
  accessibilityLabel: string;
  hitSlop?: { top: number; bottom: number };
}) {
  const scale = useMemo(() => new Animated.Value(1), []);

  function press(to: number) {
    if (reduceMotion || disabled) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, { toValue: to, duration: 120, useNativeDriver: true }).start();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => press(PRESS_SCALE)}
      onPressOut={() => press(1)}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <Text style={labelStyle}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette. Metrics mirror LogSpendSheet 1:1
// (same web spacing scale: px-1 pb-2 body, mt-4 source input, mt-3 amount card, mt-3 hint, mt-5/mt-2
// CTAs) since SheetLogInvoice's web layout is structurally identical to SheetLogSpend's.
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    amountField: {
      alignItems: 'center',
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      minHeight: 48,
      paddingHorizontal: gap.md,
    },
    amountInput: {
      color: t.ink,
      flex: 1,
      fontSize: 14,
      fontVariant: ['tabular-nums'],
      paddingHorizontal: gap.sm,
      paddingVertical: 0,
    },
    // Native text/button metrics make this otherwise identical web stack 12dp shorter. Preserve
    // the pinned sheet's bottom rhythm so the header, fields, and actions land on the same rows.
    body: { paddingBottom: gap.md },
    currency: {
      color: t.muted,
      fontSize: 14,
      fontVariant: ['tabular-nums'],
    },
    dismiss: {
      alignItems: 'center',
      height: 40, // h-10
      justifyContent: 'center',
      marginTop: gap.sm, // mt-2
    },
    dismissLabel: {
      color: t.calmStrong,
      fontSize: 12.5,
    },
    eyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.54,
      lineHeight: 16,
      textTransform: 'uppercase',
    },
    fieldInput: {
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: t.ink,
      fontSize: 14,
      minHeight: 48,
      paddingHorizontal: gap.md,
      paddingVertical: gap.sm,
    },
    fieldInputFocused: { borderColor: t.calmStrong, borderWidth: 1.5 },
    fieldLabel: { color: t.muted, fontSize: 12.5, lineHeight: 17, marginBottom: 6 },
    fields: { marginTop: gap.lg },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 20,
      letterSpacing: -0.4,
      lineHeight: 25,
      marginTop: gap.xs,
    },
    hint: {
      color: t.muted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: gap.md,
    },
    nextField: { marginTop: gap.md },
    primary: {
      alignItems: 'center',
      backgroundColor: t.calmStrong,
      borderRadius: radius.lg,
      height: gap.xxxl,
      justifyContent: 'center',
      marginTop: gap.xl,
    },
    primaryDisabled: { opacity: 0.45 },
    primaryLabel: {
      color: t.inverse,
      fontSize: 14,
      fontWeight: '500',
    },
  });
}
