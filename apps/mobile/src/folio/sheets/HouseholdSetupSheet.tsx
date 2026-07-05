// @rn-sheet     HouseholdSetupSheet
// @purpose      Configure the Household lens: partner's name, default split, and per-sub share
//               overrides. Writes to the `household` slice; the Household strategy re-derives live
//               so Today updates on close.
// @reads        household, subs, subPaused
// @writes       setHousehold, setSubShareOverride, removeSubShareOverride
// @copy         FROZEN — calm, neutral, never assigns blame across people.
// @tokens       --paper --surface --hairline --accent --inset --muted-ink (mapped via
//               '@/folio/theme')
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetHouseholdSetup.tsx).
// The web uses a native <input type="range"> slider for the default-share percentage; RN has no
// slider primitive already in the kit, so this port uses the same ±5% stepper pattern the sub-share
// rows already use (a faithful behavioural equivalent, not a new control system).

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import {
  useAppStore,
  setHousehold,
  setSubShareOverride,
  removeSubShareOverride,
} from '@/folio/store';
import { computeBillSplits } from '@/folio/lib/modes/strategies/household';

export type HouseholdSetupSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const DEFAULT_HOUSEHOLD = { partnerName: '', defaultShare: 0.5, subShareOverrides: {} };

export function HouseholdSetupSheet({ visible, onClose }: HouseholdSetupSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const household = useAppStore((st) => st.household ?? DEFAULT_HOUSEHOLD);
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);

  const [name, setName] = useState(household.partnerName);
  const [pct, setPct] = useState(Math.round(household.defaultShare * 100));

  const previewHousehold = useMemo(
    () => ({ ...household, partnerName: name, defaultShare: pct / 100 }),
    [household, name, pct],
  );
  const splits = useMemo(
    () => computeBillSplits(subs, subPaused, previewHousehold),
    [subs, subPaused, previewHousehold],
  );

  function commit() {
    setHousehold({ partnerName: name.trim(), defaultShare: pct / 100 });
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.eyebrow}>Household</Text>
        <Text style={s.headline}>
          Neutral <Text style={s.accentWord}>ledger.</Text>
        </Text>
        <Text style={s.subline}>Just the numbers. Adjust any bill that isn't a clean split.</Text>

        <View style={s.field}>
          <Text style={s.label}>Sharing with</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sam"
            placeholderTextColor={t.muted}
            style={[s.input, { backgroundColor: t.inset, borderColor: t.hairline, color: t.ink }]}
            accessibilityLabel="Sharing with"
          />
        </View>

        <View style={s.field}>
          <View style={s.labelRow}>
            <Text style={s.label}>Your default share</Text>
            <Text style={s.pctValue}>
              {pct}% / {100 - pct}%
            </Text>
          </View>
          <View style={s.stepperRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lower your default share by 5%"
              onPress={() => setPct((v) => Math.max(0, v - 5))}
              style={[s.stepperBtn, { backgroundColor: t.inset, borderColor: t.hairline }]}
            >
              <Text style={s.stepperGlyph}>−</Text>
            </Pressable>
            <View style={[s.pctTrack, { backgroundColor: t.inset }]}>
              <View style={[s.pctFill, { width: `${pct}%`, backgroundColor: t.calm }]} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Raise your default share by 5%"
              onPress={() => setPct((v) => Math.min(100, v + 5))}
              style={[s.stepperBtn, { backgroundColor: t.inset, borderColor: t.hairline }]}
            >
              <Text style={s.stepperGlyph}>+</Text>
            </Pressable>
          </View>
          <Text style={s.hint}>Applies to any bill you haven't split individually.</Text>
        </View>

        <View style={s.field}>
          <View style={s.labelRow}>
            <Text style={s.label}>Bills in the next 30 days</Text>
            <Text style={s.pctValue}>{splits.length}</Text>
          </View>
          {splits.length === 0 ? (
            <View style={[s.emptyBox, { backgroundColor: t.inset }]}>
              <Text style={s.emptyText}>No shared bills detected in the next 30 days.</Text>
            </View>
          ) : (
            <View style={s.splitList}>
              {splits.map((b, idx) => {
                const pctYou = Math.round(b.sharePct * 100);
                return (
                  <View
                    key={b.name}
                    style={[
                      s.splitRow,
                      idx !== 0
                        ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }
                        : null,
                    ]}
                  >
                    <View style={s.splitTopRow}>
                      <View style={s.splitLeft}>
                        <Text style={s.splitName} numberOfLines={1}>
                          {b.name}
                        </Text>
                        <Text style={s.splitMeta}>
                          £{b.cost.toFixed(2)} · in {b.daysAway}d
                          {b.overridden ? <Text style={s.accentWord}> · custom</Text> : null}
                        </Text>
                      </View>
                      <View style={s.splitStepper}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Lower your share of ${b.name}`}
                          onPress={() => setSubShareOverride(b.name, Math.max(0, b.sharePct - 0.1))}
                          style={[s.miniBtn, { backgroundColor: t.inset, borderColor: t.hairline }]}
                        >
                          <Text style={s.miniGlyph}>−</Text>
                        </Pressable>
                        <Text style={s.splitPct}>{pctYou}%</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Raise your share of ${b.name}`}
                          onPress={() => setSubShareOverride(b.name, Math.min(1, b.sharePct + 0.1))}
                          style={[s.miniBtn, { backgroundColor: t.inset, borderColor: t.hairline }]}
                        >
                          <Text style={s.miniGlyph}>+</Text>
                        </Pressable>
                        {b.overridden ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Reset ${b.name} to default`}
                            onPress={() => removeSubShareOverride(b.name)}
                            style={s.resetBtn}
                          >
                            <Text style={s.resetLabel}>reset</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                    <View style={s.splitBottomRow}>
                      <Text style={s.splitBottomText}>You £{b.yourShare.toFixed(2)}</Text>
                      <Text style={s.splitBottomText}>
                        {' · '}
                        {name.trim() || 'Them'} £{b.partnerShare.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={commit}
          style={[s.primary, { backgroundColor: t.calm }]}
        >
          <Text style={[s.primaryLabel, { color: t.inverse }]}>Save</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={s.cancel}>
          <Text style={s.cancelLabel}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    scroll: { maxHeight: 560 },
    body: { paddingHorizontal: gap.xs, paddingBottom: gap.xs },
    eyebrow: { fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: t.muted },
    headline: {
      marginTop: gap.xs,
      fontFamily: serif.display,
      fontSize: 26,
      lineHeight: 30,
      color: t.ink,
    },
    accentWord: { color: t.calm },
    subline: { marginTop: gap.xs, fontSize: 12.5, fontStyle: 'italic', color: t.muted },
    field: { marginTop: gap.lg },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: t.muted },
    pctValue: { fontSize: 12, fontVariant: ['tabular-nums'], color: t.ink },
    input: {
      marginTop: gap.xs,
      height: 44,
      paddingHorizontal: gap.md,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      fontSize: 13.5,
    },
    stepperRow: { marginTop: gap.sm, flexDirection: 'row', alignItems: 'center', gap: gap.sm },
    stepperBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperGlyph: { fontSize: 14, color: t.ink },
    pctTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
    pctFill: { height: 6, borderRadius: 3 },
    hint: { marginTop: 6, fontSize: 10.5, fontStyle: 'italic', color: t.muted },
    emptyBox: { marginTop: gap.xs, borderRadius: radius.md, padding: gap.md },
    emptyText: { fontSize: 11.5, color: t.muted },
    splitList: {
      marginTop: gap.xs,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      overflow: 'hidden',
    },
    splitRow: { paddingHorizontal: gap.md, paddingVertical: gap.sm + 2 },
    splitTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    splitLeft: { flex: 1, paddingRight: gap.sm },
    splitName: { fontSize: 13, color: t.ink },
    splitMeta: { marginTop: 2, fontSize: 10.5, fontVariant: ['tabular-nums'], color: t.muted },
    splitStepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    miniBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniGlyph: { fontSize: 13, color: t.muted },
    splitPct: {
      width: 40,
      textAlign: 'center',
      fontSize: 11.5,
      fontVariant: ['tabular-nums'],
      color: t.ink,
    },
    resetBtn: { marginLeft: 4 },
    resetLabel: { fontSize: 10.5, textDecorationLine: 'underline', color: t.muted },
    splitBottomRow: { marginTop: 6, flexDirection: 'row', gap: 2 },
    splitBottomText: { fontSize: 10.5, fontVariant: ['tabular-nums'], color: t.muted },
    primary: {
      marginTop: gap.xl,
      height: 54,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: { fontSize: 15, fontWeight: '500' },
    cancel: { marginTop: gap.sm, height: 44, alignItems: 'center', justifyContent: 'center' },
    cancelLabel: { fontSize: 13.5, color: t.muted },
  });
}
