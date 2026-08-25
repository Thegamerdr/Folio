// @rn-sheet     ShelfSheet
// @purpose      24-Hour Shelf — parked wants that re-surface a day later. Replaces impulse-blocking
//               with a quiet delay; never judges the purchase, celebrates the pause.
// @reads        shelf (via lib/shelf.ts useShelf() — see STORE-SEAM DEVIATION below)
// @writes       addShelfItem, resolveShelfItem (lib/shelf.ts)
// @copy         FROZEN — verbatim from the web source below; never judges the purchase.
// @tokens       --surface (input/row cards) · --hairline (borders/dividers) · --accent (t.calm —
//               focus ring, £ input, 'Shelf it' fill) · --ink (t.ink, 'Still want it' fill) ·
//               --muted-ink (t.muted)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · press (scale 0.97) on every button;
//               collapses to final state under reduce-motion (MOTION.md)
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetShelf.tsx). Layout,
// copy, and the ripe/settling/empty branches are ported verbatim.
//
// STORE-SEAM DEVIATION (flagged per instructions — do not silently "fix"): the web reads/writes
// `shelf` on the shared app store. RN's `store.ts` has no `shelf` slot and is outside this batch's
// file list (file-disjoint discipline), so this sheet reads/writes the new, PROVISIONAL,
// module-scoped store in ./lib/shelf.ts instead. See that file's header for the full note and the
// planned swap-over once store.ts grows a real `shelf` slice.
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme'.
// MeloLine from '@/folio/melo/MeloLine'. Nothing new is defined — no colour, font, spacing value,
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
import {
  addShelfItem,
  isRipe,
  resolveShelfItem,
  shelfBadgeCopy,
  sweepShelfNow,
  useShelf,
  type ShelfItem,
} from '@/folio/lib/shelf';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ShelfSheetProps = {
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

export function ShelfSheet({ visible, onClose }: ShelfSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  // Sweep stale (>7d) pending items to `expired` once per mount — mirrors the real store's sweep
  // hook (see store.ts sweepSubOverrides-style pattern used elsewhere in this app).
  useEffect(() => {
    sweepShelfNow();
  }, []);

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <ShelfBody styles={s} palette={t} reduceMotion={reduceMotion} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

function ShelfBody({
  styles: s,
  palette: t,
  reduceMotion,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
}) {
  const shelf = useShelf();
  const [label, setLabel] = useState('');
  const [amountRaw, setAmountRaw] = useState('');

  const pending = shelf.filter((it) => it.status === 'pending');
  const ripe = pending.filter((it) => isRipe(it));
  const settling = pending.filter((it) => !isRipe(it));

  function add() {
    const l = label.trim();
    const v = parseFloat(amountRaw);
    if (!l || !(v > 0)) return;
    addShelfItem(l, v);
    setLabel('');
    setAmountRaw('');
  }

  return (
    <View style={s.body}>
      <Text style={s.eyebrow}>24-Hour Shelf</Text>
      <Text style={s.headline} accessibilityRole="header">
        Give it a day.
      </Text>

      <View style={s.addRow}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="What is it?"
          placeholderTextColor={t.muted}
          style={s.labelInput}
          accessibilityLabel="What is it"
          returnKeyType="next"
        />
        <TextInput
          value={amountRaw}
          onChangeText={(text) => setAmountRaw(text.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="£"
          placeholderTextColor={t.muted}
          style={s.amountInput}
          accessibilityLabel="Amount"
        />
        <PressCta
          label="Shelf it"
          onPress={add}
          reduceMotion={reduceMotion}
          style={s.addCta}
          labelStyle={s.addCtaLabel}
          accessibilityLabel="Shelf it"
        />
      </View>

      {ripe.length > 0 && (
        <>
          <Text style={s.sectionLabel}>Ready to re-see</Text>
          <View style={s.list}>
            {ripe.map((it) => (
              <RipeRow
                key={it.id}
                item={it}
                styles={s}
                reduceMotion={reduceMotion}
                onKeep={() => resolveShelfItem(it.id, 'kept')}
                onLetGo={() => resolveShelfItem(it.id, 'let-go')}
              />
            ))}
          </View>
        </>
      )}

      {settling.length > 0 && (
        <>
          <Text style={s.sectionLabel}>Settling</Text>
          <View style={s.settlingCard}>
            {settling.map((it, i) => (
              <View key={it.id} style={[s.settlingRow, i > 0 ? s.settlingRowDivider : null]}>
                <View>
                  <Text style={s.settlingLabel}>{it.label}</Text>
                  <Text style={s.settlingBadge}>{shelfBadgeCopy(it)}</Text>
                </View>
                <Text style={s.settlingAmount}>{`£${it.amount}`}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {shelf.length === 0 && (
        <View style={s.emptyLine}>
          <MeloLine text="Park a want. Come back tomorrow and see if it still fits." mood="calm" />
        </View>
      )}
    </View>
  );
}

function RipeRow({
  item,
  styles: s,
  reduceMotion,
  onKeep,
  onLetGo,
}: {
  item: ShelfItem;
  styles: ReturnType<typeof makeStyles>;
  reduceMotion: boolean;
  onKeep: () => void;
  onLetGo: () => void;
}) {
  return (
    <View style={s.ripeCard}>
      <View style={s.ripeHeaderRow}>
        <Text style={s.ripeLabel}>{item.label}</Text>
        <Text style={s.ripeAmount}>{`£${item.amount}`}</Text>
      </View>
      <View style={s.ripeCtaRow}>
        <PressCta
          label="Still want it"
          onPress={onKeep}
          reduceMotion={reduceMotion}
          style={s.keepCta}
          labelStyle={s.keepCtaLabel}
          accessibilityLabel="Still want it"
        />
        <PressCta
          label="Let it go"
          onPress={onLetGo}
          reduceMotion={reduceMotion}
          style={s.letGoCta}
          labelStyle={s.letGoCtaLabel}
          accessibilityLabel="Let it go"
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
  style: object;
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
// Styles — web → kit map: grid-cols[1fr_auto_auto] gap-2 · h-10=40 · px-3=md(12) · py-2.5≈10 ·
// rounded-xl=md(12) · rounded-2xl→radius.lg (system-consistent, matches sibling sheets) ·
// mt-5=lg+xs(20) · mt-2=sm(8) · px-4=lg(16) · py-3=md(12) · mt-3=md(12) · divide-y→hairline border.
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    addCta: {
      alignItems: 'center',
      backgroundColor: t.calm,
      borderRadius: radius.md,
      height: 40,
      justifyContent: 'center',
      paddingHorizontal: gap.md,
    },
    addCtaLabel: { color: t.inverse, fontSize: 12.5, fontWeight: '500' },
    addRow: {
      flexDirection: 'row',
      gap: gap.sm,
      marginTop: gap.lg,
    },
    amountInput: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: t.ink,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      paddingHorizontal: gap.md,
      paddingVertical: 10,
      width: 80,
    },
    body: { paddingBottom: gap.sm },
    emptyLine: { marginTop: gap.lg + gap.xs },
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
    keepCta: {
      alignItems: 'center',
      backgroundColor: t.ink,
      borderRadius: radius.md,
      height: 40,
      justifyContent: 'center',
    },
    keepCtaLabel: { color: t.canvas, fontSize: 13 },
    labelInput: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: t.ink,
      flex: 1,
      fontSize: 13,
      paddingHorizontal: gap.md,
      paddingVertical: 10,
    },
    letGoCta: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      height: 40,
      justifyContent: 'center',
    },
    letGoCtaLabel: { color: t.ink, fontSize: 13 },
    list: { gap: gap.sm, marginTop: gap.sm },
    ripeAmount: { color: t.ink, fontSize: 13, fontVariant: ['tabular-nums'] },
    ripeCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      padding: gap.lg,
    },
    ripeCtaRow: { flexDirection: 'row', gap: gap.sm, marginTop: gap.md },
    ripeHeaderRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    ripeLabel: { color: t.ink, fontSize: 14, fontWeight: '500' },
    sectionLabel: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.4,
      marginTop: gap.lg + gap.xs,
      textTransform: 'uppercase',
    },
    settlingAmount: { color: t.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
    settlingBadge: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 11,
      fontStyle: 'italic',
      marginTop: 2,
    },
    settlingCard: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.sm,
    },
    settlingLabel: { color: t.ink, fontSize: 13.5 },
    settlingRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    settlingRowDivider: {
      borderTopColor: t.hairline,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
  });
}
