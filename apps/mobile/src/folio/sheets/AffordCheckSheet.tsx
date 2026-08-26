// @rn-sheet     AffordCheckSheet
// @purpose      Before You Spend — "Can I afford £X?" verdict sheet. Celebrates the CHECK, never
//               the purchase; offers Shelf-it as the calm alternative when the amount doesn't fit
//               today.
// @reads        the live route (@/folio/lib/storeRoute useRoute) for the tightest-spare figure +
//               its date — RN's equivalent of the web's currentBalance/subs/pots/bufferAmount inputs
//               to safeZoneMath (see lib/affordCheck.ts header for the full reuse-vs-deviation note).
// @writes       addShelfItem (optional, via lib/shelf.ts — see STORE-SEAM DEVIATION below)
// @copy         FROZEN — verbatim from the web source below; never "you can't afford this".
// @tokens       --surface (input/amount card) · --hairline (card/input borders) · --accent
//               (t.calm — focus ring, £ + amount text, primary fill) · --muted-ink (t.muted) ·
//               --ink (t.ink, secondary CTA fill) · --paper (t.canvas, on-ink label)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · press (scale 0.97) on both CTAs;
//               collapses to final state under reduce-motion (MOTION.md)
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetAffordCheck.tsx).
// Layout, copy, and verdict states are ported verbatim; the underlying compute engine now calls
// the same `safeZoneMath(ModeInputs)` the web reads (ported verbatim at lib/modes/safeZone.ts),
// so "Safe Zone now" on this sheet agrees byte-for-byte with the web and with Today's own
// headline number (PARITY_GAPS.md Group 1 fix — previously re-derived from the route engine and
// so could disagree with the Safe Zone total on other lens screens).
//
// STORE-SEAM DEVIATION (flagged per instructions): the web writes `addShelfItem` / `awardTinyWin`
// on the shared app store. RN's `store.ts` has neither a `shelf` slot nor a tiny-wins slot, and
// `store.ts` is outside this batch's file list (file-disjoint discipline) — so this sheet calls
// `addShelfItem` from the new, PROVISIONAL, module-scoped store in ./lib/shelf.ts instead (see that
// file's header for the full note). `awardTinyWin('afford-streak-3')` has NO RN equivalent at all
// (no tiny-wins engine exists yet) — the "Done" button therefore does NOT award anything; this is a
// silent scope reduction vs the web, flagged here and in wiringNeeds rather than fabricating a new
// engine inside this batch.
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme'.
// Melo + MeloLine from '@/folio/melo/*'. Nothing new is defined — no colour, font, spacing value,
// or dependency.

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
import { MeloLine } from '@/folio/melo/MeloLine';
import { useRoute } from '@/folio/lib/storeRoute';
import { useAppStore } from '@/folio/store';
import { checkAfford, type AffordVerdict } from '@/folio/lib/affordCheck';
import { safeZoneMath } from '@/folio/lib/modes/safeZone';
import { addShelfItem } from '@/folio/lib/shelf';
import { formatGBP } from '@/folio/screens/today/format';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type AffordCheckSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const PRESS_SCALE = 0.97;

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

export function AffordCheckSheet({ visible, onClose }: AffordCheckSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <AffordCheckForm styles={s} palette={t} reduceMotion={reduceMotion} onClose={onClose} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Verdict → tone colour + Melo mood + Melo line (ported verbatim from the web branches).
// ---------------------------------------------------------------------------

function toneColor(t: Palette, state: AffordVerdict['state']): string {
  switch (state) {
    case 'safe':
      return t.positiveInk;
    case 'tight':
      return t.calm;
    case 'safe-later':
      return t.warmInk;
    case 'not-now':
      return t.muted;
  }
}

function meloMoodFor(state: AffordVerdict['state']): 'cheer' | 'concern' | 'calm' {
  if (state === 'safe') return 'cheer';
  if (state === 'not-now') return 'concern';
  return 'calm';
}

function meloLineFor(state: AffordVerdict['state']): string {
  switch (state) {
    case 'safe':
      return "You checked — that's the muscle.";
    case 'tight':
      return "It'd fit, but you'd feel it. Your call.";
    case 'safe-later':
      return 'Kinder to wait. Same want, different day.';
    case 'not-now':
      return "Not this week. Shelf it — I'll bring it back tomorrow.";
  }
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

const NOW = new Date();

function AffordCheckForm({
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
  const [label, setLabel] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const amount = Math.max(0, parseFloat(amountRaw) || 0);

  // Same ModeInputs shape TodayScreen/safeZoneMath consumers build — the route bridge supplies
  // the tightest-point figure/date (the same "when" Today itself uses), and the rest of the
  // snapshot comes straight off the store, exactly like the web's `inputs` useMemo.
  const route = useRoute(NOW);
  const onboarding = useAppStore((st) => st.onboarding);
  const pots = useAppStore((st) => st.pots);
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const currentBalance = useAppStore((st) => st.currentBalance);
  const bufferAmount = useAppStore((st) => st.bufferAmount ?? 100);

  const modeInputs = useMemo(
    () => ({
      currentBalance,
      onboarding,
      pots,
      subs,
      subPaused,
      tightestSpare: route.tightPoint.amount,
      tightestDate: route.tightPoint.date,
      ritualCompletedRecently: false,
      bufferAmount,
    }),
    [
      currentBalance,
      onboarding,
      pots,
      subs,
      subPaused,
      route.tightPoint.amount,
      route.tightPoint.date,
      bufferAmount,
    ],
  );
  const zone = useMemo(() => safeZoneMath(modeInputs), [modeInputs]);
  const verdict = useMemo(() => checkAfford(amount, modeInputs), [amount, modeInputs]);

  const canShelf =
    verdict.state === 'not-now' || verdict.state === 'tight' || verdict.state === 'safe-later';

  function shelfIt() {
    addShelfItem(label || 'Something', amount, verdict.state);
    onClose();
  }

  return (
    <View style={s.body}>
      <Text style={s.eyebrow}>Before you spend</Text>
      <Text style={s.headline} accessibilityRole="header">
        Can I afford this?
      </Text>

      <TextInput
        value={label}
        onChangeText={setLabel}
        placeholder="What is it? (optional)"
        placeholderTextColor={t.muted}
        style={s.labelInput}
        accessibilityLabel="What is it"
        returnKeyType="next"
      />

      <View style={s.amountCard}>
        <Text style={s.amountLabel}>Amount</Text>
        <View style={s.amountValueRow}>
          <Text style={s.currency}>£</Text>
          <TextInput
            value={amountRaw}
            onChangeText={(text) => setAmountRaw(text.replace(/[^0-9.]/g, ''))}
            autoFocus={process.env.EXPO_PUBLIC_MELO_PARITY_CAPTURE !== 'true'}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={t.muted}
            style={s.amountInput}
            accessibilityLabel="Amount"
          />
        </View>
      </View>

      {amount > 0 && (
        <View style={s.verdictCard}>
          <Text style={[s.verdictHeadline, { color: toneColor(t, verdict.state) }]}>
            {verdict.headline}
          </Text>
          <View style={s.verdictRow}>
            <View style={s.verdictCol}>
              <Text style={s.verdictLabel}>Safe Zone now</Text>
              <Text style={s.verdictValue}>{formatGBP(zone.total)}</Text>
            </View>
            <View style={s.verdictCol}>
              <Text style={s.verdictLabel}>After this</Text>
              <Text style={[s.verdictValue, verdict.after < 0 ? { color: t.repairInk } : null]}>
                {formatGBP(verdict.after)}
              </Text>
            </View>
          </View>
          {verdict.state === 'safe-later' && verdict.safeOn && (
            <Text style={s.verdictNote}>Runway opens back up on payday.</Text>
          )}
        </View>
      )}

      {amount > 0 && (
        <View style={s.meloLine}>
          <MeloLine text={meloLineFor(verdict.state)} mood={meloMoodFor(verdict.state)} size={28} />
        </View>
      )}

      <View style={s.ctaRow}>
        {canShelf && amount > 0 && (
          <PressCta
            label="Shelf it for a day"
            onPress={shelfIt}
            reduceMotion={reduceMotion}
            style={s.shelfCta}
            labelStyle={s.shelfCtaLabel}
            accessibilityLabel="Shelf it for a day"
          />
        )}
        <PressCta
          label="Done"
          onPress={onClose}
          reduceMotion={reduceMotion}
          style={[s.doneCta, canShelf && amount > 0 ? s.doneCtaSecondary : s.doneCtaPrimary]}
          labelStyle={canShelf && amount > 0 ? s.doneCtaLabelSecondary : s.doneCtaLabelPrimary}
          accessibilityLabel="Done"
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PressCta — shared press-scale button (mirrors LogSpendSheet's PressCta).
// ---------------------------------------------------------------------------

function PressCta({
  label,
  onPress,
  reduceMotion,
  style,
  labelStyle,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  reduceMotion: boolean;
  style: object | (object | null | false)[];
  labelStyle: object;
  accessibilityLabel: string;
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
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => press(PRESS_SCALE)}
      onPressOut={() => press(1)}
      style={{ flex: 1 }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <Text style={labelStyle}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles — web → kit map: px-1=xs(4) · pb-2=sm(8) · mt-4=lg(16) · mt-3=md(12) · mt-5=lg+xs(20) ·
// mt-2=sm(8) · px-3=md(12) · py-2.5≈10 · px-5=lg+xs(20) · py-4=lg(16) · h-11≈44 · rounded-xl=md(12) ·
// rounded-2xl→radius.lg (system-consistent card corner, matches LogSpendSheet's own reconciliation).
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
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
      paddingHorizontal: gap.lg + gap.xs,
      paddingVertical: gap.lg,
    },
    amountInput: {
      color: t.calm,
      fontFamily: serif.display,
      fontSize: 34,
      fontVariant: ['tabular-nums'],
      paddingVertical: 0,
      textAlign: 'right',
      width: 96,
    },
    amountLabel: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    amountValueRow: { alignItems: 'baseline', flexDirection: 'row' },
    body: { paddingBottom: gap.sm },
    ctaRow: { flexDirection: 'row', gap: gap.sm, marginTop: gap.lg + gap.xs },
    currency: {
      color: t.calm,
      fontFamily: serif.display,
      fontSize: 28,
      fontVariant: ['tabular-nums'],
    },
    doneCta: {
      alignItems: 'center',
      borderRadius: radius.md,
      height: 44,
      justifyContent: 'center',
    },
    doneCtaLabelPrimary: { color: t.inverse, fontSize: 13, fontWeight: '500' },
    doneCtaLabelSecondary: { color: t.ink, fontSize: 13 },
    doneCtaPrimary: { backgroundColor: t.calm },
    doneCtaSecondary: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderWidth: StyleSheet.hairlineWidth,
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
      fontSize: 22,
      letterSpacing: -0.3,
      lineHeight: 26,
      marginTop: gap.xxs,
    },
    labelInput: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: t.ink,
      fontSize: 13,
      marginTop: gap.lg,
      paddingHorizontal: gap.md,
      paddingVertical: 10,
    },
    meloLine: { marginTop: gap.lg },
    shelfCta: {
      alignItems: 'center',
      backgroundColor: t.calm,
      borderRadius: radius.md,
      height: 44,
      justifyContent: 'center',
    },
    shelfCtaLabel: { color: t.inverse, fontSize: 13, fontWeight: '500' },
    verdictCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.lg,
      padding: gap.lg,
    },
    verdictCol: {},
    verdictHeadline: {
      fontFamily: serif.displayItalic,
      fontSize: 16,
      fontStyle: 'italic',
    },
    verdictLabel: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    verdictNote: { color: t.muted, fontSize: 11.5, marginTop: gap.sm },
    verdictRow: {
      flexDirection: 'row',
      gap: gap.md,
      marginTop: gap.sm,
    },
    verdictValue: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 18,
      fontVariant: ['tabular-nums'],
    },
  });
}
