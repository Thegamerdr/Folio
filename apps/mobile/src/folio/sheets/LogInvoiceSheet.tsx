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
const DISABLED_FILL_ALPHA = '4D'; // --muted-ink @ 30% (0x4D ≈ 0.30 * 255), appended as #RRGGBBAA

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
      {/* Eyebrow — Fraunces italic, muted (literal; not in COPY_DECK per the web source). */}
      <Text style={s.eyebrow}>Log an invoice</Text>
      {/* Headline — Fraunces display (literal). */}
      <Text style={s.headline} accessibilityRole="header">
        What just landed?
      </Text>

      {/* Source input — focus ring animates borderColor to --accent (mirrors merchant input). */}
      <TextInput
        autoFocus
        value={source}
        onChangeText={setSource}
        onFocus={() => setSourceFocused(true)}
        onBlur={() => setSourceFocused(false)}
        placeholder="From · e.g. Studio Ltd"
        placeholderTextColor={t.muted}
        style={[s.sourceInput, sourceFocused ? s.sourceInputFocused : null]}
        accessibilityLabel="From"
        returnKeyType="done"
      />

      {/* Amount card — label left, £ + decimal input right, baseline-aligned. Positive/inflow tone
          (t.positive), the inverse of LogSpendSheet's t.calm spend tone. */}
      <View style={s.amountCard}>
        <Text style={s.amountLabel}>Amount</Text>
        <View style={s.amountValueRow}>
          <Text style={s.currency}>{copy.global.currency.symbol}</Text>
          <TextInput
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={t.positive}
            style={s.amountInput}
            accessibilityLabel="Amount"
          />
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
  const disabledFill = `${t.muted}${DISABLED_FILL_ALPHA}`;

  return StyleSheet.create({
    amountCard: {
      alignItems: 'baseline',
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: gap.md,
      paddingHorizontal: gap.lg + gap.xs, // px-5 ≈ 20
      paddingVertical: gap.lg, // py-4 = 16
    },
    amountInput: {
      color: t.positive,
      fontFamily: serif.display,
      fontSize: 34,
      fontVariant: ['tabular-nums'],
      paddingVertical: 0,
      textAlign: 'right',
      width: 112, // slightly wider than LogSpendSheet's 96 — invoice amounts run larger
    },
    amountLabel: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    amountValueRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
    },
    body: {
      paddingBottom: gap.sm, // pb-2
      paddingHorizontal: gap.xs, // px-1
    },
    currency: {
      color: t.positive,
      fontFamily: serif.display,
      fontSize: 28,
      fontVariant: ['tabular-nums'],
    },
    dismiss: {
      alignItems: 'center',
      height: 40, // h-10
      justifyContent: 'center',
      marginTop: gap.sm, // mt-2
    },
    dismissLabel: {
      color: t.muted,
      fontSize: 12.5,
    },
    eyebrow: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      fontStyle: 'italic',
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 24,
      letterSpacing: -0.4,
      lineHeight: 28, // leading-tight
      marginTop: gap.xxs, // mt-0.5 ≈ 2
    },
    hint: {
      color: t.muted,
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: gap.md, // mt-3
    },
    primary: {
      alignItems: 'center',
      backgroundColor: t.calm,
      borderRadius: radius.lg,
      height: gap.xxxl, // h-12 = 48
      justifyContent: 'center',
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
    },
    primaryDisabled: {
      backgroundColor: disabledFill,
    },
    primaryLabel: {
      color: t.accentInk,
      fontSize: 14,
      fontWeight: '500',
    },
    sourceInput: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md, // rounded-xl = 12
      borderWidth: StyleSheet.hairlineWidth,
      color: t.ink,
      fontSize: 14,
      marginTop: gap.lg, // mt-4 = 16
      paddingHorizontal: gap.lg, // px-4 = 16
      paddingVertical: gap.md, // py-3 = 12
    },
    sourceInputFocused: {
      borderColor: t.calm,
      borderWidth: 1,
    },
  });
}
