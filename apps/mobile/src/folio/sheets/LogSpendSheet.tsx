// @rn-sheet     LogSpendSheet
// @purpose      Quick manual spend entry — merchant, amount, category. Writes one negative-amount
//               manual transaction and closes. This is the failure-only fast-path capture sheet,
//               NOT a reader flow — never route reader candidates here.
// @writes       addTransaction
// @copy         FROZEN (verbatim from the web source; the spec flags these literals are not yet in
//               COPY_DECK — '@/folio/copy/copy' carries only currency.symbol for this sheet)
// @tokens       --surface (merchant input · amount card) · --hairline (input/card borders) ·
//               --accent (focus ring · £ + amount text · primary fill) · --muted-ink (eyebrow ·
//               'Amount' · 'Not yet' · disabled fill @30%) · --ink (selected chip fill) ·
//               --paper (selected chip text · sheet ground) · --inset (unselected chip fill)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · press (scale 0.97) on every chip +
//               both CTAs; collapses to final state under reduce-motion (MOTION.md)
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetLogSpend.tsx) and its
// spec (plans/rn-port/specs/LogSpendSheet.spec.md). The spec and the web source agree exactly: this
// sheet has ONE render branch — the form is always rendered ready (merchant='', amount='',
// category='food'). STATES.md has no row for it, so there is no empty / loading / error / offline
// branch; the only conditional visual is the disabled primary CTA. Per the spec's `moods` row and
// MELO_MOODS.md this sheet renders NO Melo ("No mood = no Melo") — resist adding one.
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme'
// (which re-exports the pressure-map kit). Nothing new is defined — no colour, no font, no spacing
// value, no dependency.
//
// Money discipline: the amount is stored NEGATIVE (amount: -v) — dropping the sign would corrupt
// the money path (inflow vs spend). Validation is duplicated on purpose: the disabled prop AND the
// save() early-return share the same predicate (merchant.trim() && parseFloat(amount) > 0) so a
// programmatic save can't bypass the gate. The category chips EXCLUDE 'income' (spend-only) though
// the Transaction.category type includes it — the explicit `cats` array is the source of truth, not
// the full union. The amount sanitiser only strips non [0-9.] characters; it does NOT block multiple
// dots — matched to the web behaviour for parity rather than "fixed".

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { addTransaction, type Transaction } from '@/folio/store';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type LogSpendSheetProps = {
  // Whether the sheet is mounted/visible — wired straight to the kit Sheet primitive.
  visible: boolean;
  onClose: () => void;
};

// Spend-only chip set — the Transaction.category union EXCLUDING 'income' (the web's literal `cats`).
const CATS: readonly Transaction['category'][] = [
  'food',
  'transport',
  'fun',
  'bills',
  'shopping',
  'other',
];

const PRESS_SCALE = 0.97; // .press — scale 0.97 on :active
const DISABLED_FILL_ALPHA = '4D'; // --muted-ink @ 30% (0x4D ≈ 0.30 * 255), appended as #RRGGBBAA
const MIN_TAP = 44; // tap-only, >=44px
// Chips render at h-8 (32px) to stay visually faithful; (44 - 32) / 2 = 6px of vertical slop lifts the
// touch target to the 44px minimum without changing the chip's drawn height or the row's rhythm.
const CHIP_TAP_SLOP = (MIN_TAP - 32) / 2; // 6

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed, mirrors the OnboardingSheet hook)
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
// LogSpendSheet
// ---------------------------------------------------------------------------

export function LogSpendSheet({ visible, onClose }: LogSpendSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <LogSpendForm styles={s} palette={t} reduceMotion={reduceMotion} onClose={onClose} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The form — the only render branch (spec stateBranches: populated/default is the only one).
// ---------------------------------------------------------------------------

function LogSpendForm({
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
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Transaction['category']>('food');
  const [merchantFocused, setMerchantFocused] = useState(false);

  // Shared validation predicate — used by BOTH the disabled gate and save() (spec: keep both so a
  // programmatic save can't bypass the gate).
  const canSave = merchant.trim().length > 0 && parseFloat(amount) > 0;

  function save() {
    const m = merchant.trim();
    const v = parseFloat(amount);
    if (!m || !(v > 0)) return;
    addTransaction({ merchant: m, amount: -v, category, source: 'manual' });
    onClose();
  }

  return (
    <View style={s.body}>
      {/* Eyebrow — Fraunces italic, muted (literal; not in COPY_DECK per the spec). */}
      <Text style={s.eyebrow}>Log a spend</Text>
      {/* Headline — Fraunces display (literal). */}
      <Text style={s.headline} accessibilityRole="header">
        What just left?
      </Text>

      {/* Merchant input — focus ring animates borderColor to --accent. */}
      <TextInput
        autoFocus
        value={merchant}
        onChangeText={setMerchant}
        onFocus={() => setMerchantFocused(true)}
        onBlur={() => setMerchantFocused(false)}
        placeholder="Where · e.g. Tesco"
        placeholderTextColor={t.muted}
        style={[s.merchantInput, merchantFocused ? s.merchantInputFocused : null]}
        accessibilityLabel="Where"
        returnKeyType="done"
      />

      {/* Amount card — label left, £ + decimal input right, baseline-aligned. */}
      <View style={s.amountCard}>
        <Text style={s.amountLabel}>Amount</Text>
        <View style={s.amountValueRow}>
          <Text style={s.currency}>{copy.global.currency.symbol}</Text>
          <TextInput
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={t.calm}
            style={s.amountInput}
            accessibilityLabel="Amount"
          />
        </View>
      </View>

      {/* Category chips — exactly one active (--ink fill / --paper text); rest --inset / --ink. */}
      <View style={s.chipRow}>
        {CATS.map((c) => (
          <CategoryChip
            key={c}
            label={c}
            selected={category === c}
            onPress={() => setCategory(c)}
            styles={s}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>

      {/* Primary — 'Log it'; disabled until merchant non-empty AND amount > 0. */}
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
// CategoryChip — press scale 0.97 (collapses under reduce-motion).
// ---------------------------------------------------------------------------

function CategoryChip({
  label,
  selected,
  onPress,
  styles: s,
  reduceMotion,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  reduceMotion: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function press(to: number) {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, { toValue: to, duration: 120, useNativeDriver: true }).start();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => press(PRESS_SCALE)}
      onPressOut={() => press(1)}
      // Lift the 32px chip's touch target to the 44px minimum without changing its drawn height.
      hitSlop={{
        top: CHIP_TAP_SLOP,
        bottom: CHIP_TAP_SLOP,
        left: CHIP_TAP_SLOP,
        right: CHIP_TAP_SLOP,
      }}
    >
      <Animated.View
        style={[s.chip, selected ? s.chipSelected : s.chipUnselected, { transform: [{ scale }] }]}
      >
        <Text style={selected ? s.chipLabelSelected : s.chipLabelUnselected}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// PressCta — a full-width button with the .press scale (both CTAs share it).
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
  const scale = useRef(new Animated.Value(1)).current;

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
// Styles — colour-bearing, resolved against the active palette. Spacing/radius from kit tokens only.
// Web → kit map: px-1=xs(4) · mt-0.5≈xxs(2) · mt-4=lg(16) · mt-3=md(12) · mt-5=lg+xs(20) ·
// mt-2=sm(8) · px-4=lg(16) · py-3=md(12) · px-5=lg+xs(20) · py-4=lg(16) · gap-1.5=xs+xxs(6) ·
// h-8=32 · h-12=xxxl(48) · h-10=40 · w-24≈96 · rounded-xl=md(12) · rounded-2xl=xl(24, web 16) →
// the kit's nearest card radius. The web amount card is rounded-2xl(16); the kit card radius is
// radius.lg(18) which is the established card corner across the ported folio surfaces, so the card
// uses radius.lg for system consistency and the input uses radius.md(12) = rounded-xl.
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  // Disabled primary fill = --muted-ink at 30% alpha (compute, never substitute --hairline).
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
      color: t.calm,
      fontFamily: serif.display,
      fontSize: 34,
      fontVariant: ['tabular-nums'],
      // padding stripped so the digits sit on the £ baseline; width ≈ web w-24.
      paddingVertical: 0,
      textAlign: 'right',
      width: 96,
    },
    amountLabel: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.3, // tracking-[0.12em] on an 11px label ≈ 1.3
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
    chip: {
      alignItems: 'center',
      borderRadius: radius.pill,
      height: 32, // h-8
      justifyContent: 'center',
      paddingHorizontal: gap.md, // px-3 = 12
    },
    chipLabelSelected: {
      color: t.canvas, // --paper → the canvas ground (selected chip text knocks out on --ink)
      fontSize: 12,
    },
    chipLabelUnselected: {
      color: t.ink,
      fontSize: 12,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.xs + gap.xxs, // gap-1.5 = 6
      marginTop: gap.md,
    },
    chipSelected: {
      backgroundColor: t.ink,
    },
    chipUnselected: {
      backgroundColor: t.inset,
    },
    currency: {
      color: t.calm,
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
    merchantInput: {
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
    merchantInputFocused: {
      borderColor: t.calm, // focus:ring-1 focus:ring-[var(--accent)]
      borderWidth: 1,
    },
    primary: {
      alignItems: 'center',
      backgroundColor: t.calm,
      borderRadius: radius.lg, // rounded-2xl card corner — system-consistent
      height: gap.xxxl, // h-12 = 48
      justifyContent: 'center',
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
    },
    primaryDisabled: {
      backgroundColor: disabledFill,
    },
    primaryLabel: {
      // The web uses literal text-white on the accent fill; t.inverse is the kit's canonical
      // on-accent knockout (white in light, near-white in dark) — same token the kit's PrimaryAction
      // uses, so the label stays legible in both themes.
      color: t.inverse,
      fontSize: 14,
      fontWeight: '500',
    },
  });
}

// Tap-target note: the chips are h-8 (32) and the dismiss row is h-10 (40); both are under the 44px
// minimum by the web's own rhythm. Both keep their faithful visual height and use hitSlop to extend
// the touch area to >=44px without changing the vertical rhythm (the same technique OnboardingSheet
// uses for its skip row). MIN_TAP is the reference CHIP_TAP_SLOP targets.
