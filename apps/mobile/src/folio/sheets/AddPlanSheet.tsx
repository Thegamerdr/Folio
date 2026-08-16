// @rn-sheet     AddPlanSheet
// @purpose      Declare one big-ticket target (holiday, laptop, deposit) with a name, £ target,
//               by-date and weekly cadence. Feeds `plans[]` — the Planning lens strategy +
//               planEngine read it live.
// @reads        —
// @writes       addPlan (via the store)
// @copy         FROZEN — calm, plain. "How much", "by when", "each week".
// @tokens       --paper --surface --hairline --accent --inset --muted-ink (mapped via
//               '@/folio/theme')
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetAddPlan.tsx).
//
// PARITY_GAPS Group 2 fixes:
//   - The web's "By when" field is a native <input type="date"> — a guaranteed-valid date. RN has no
//     equivalent without a new dependency, so it stays a free-text ISO field, but `canAdd` now
//     requires the input to actually MATCH the YYYY-MM-DD shape (not just be non-empty) — a malformed
//     date can no longer silently reach `plans[]`/the Planning-lens engine's date math.
//   - The web shows a confirmation toast on save ("Plan added · {name} · £{target} by {byDate} —
//     £{perWeek}/wk."). RN reuses the existing undo/toast lib (useUndo/showUndo) as the confirmation
//     surface — Undo here removes the just-added plan, a faithful (if stronger) analogue.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { addDaysToLocalDate } from '@folio/domain';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { addPlan, currentFinancialDate, removePlan } from '@/folio/store';
import { useUndo } from '@/folio/ui/useUndo';

// Strict YYYY-MM-DD shape check — the web's native date input guarantees this; RN's free-text field
// must validate it explicitly so a malformed string never reaches the Planning-lens date math.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type AddPlanSheetProps = {
  visible: boolean;
  onClose: () => void;
};

// Default the by-date to ~12 weeks out — enough runway that most first plans read "on pace" so the
// user sees a green result immediately (mirrors the web's `defaultByDate`).
function defaultByDate(): string {
  return addDaysToLocalDate(currentFinancialDate(), 84);
}

export function AddPlanSheet({ visible, onClose }: AddPlanSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { showUndo } = useUndo();

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [byDate, setByDate] = useState(defaultByDate());
  const [perWeek, setPerWeek] = useState('');
  const [saved, setSaved] = useState('');

  const tgt = Number(target) || 0;
  const wk = Number(perWeek) || 0;
  const already = Number(saved) || 0;
  const validByDate = ISO_DATE_RE.test(byDate);
  const canAdd = name.trim().length > 0 && tgt > 0 && validByDate;

  function handleAdd() {
    if (!canAdd) return;
    const p = addPlan({ name, target: tgt, saved: already, byDate, perWeek: wk });
    onClose();
    showUndo(`Plan added · ${p.name}`, () => {
      removePlan(p.id);
    });
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.body}>
        <Text style={s.eyebrow}>Add a plan</Text>
        <Text style={s.headline}>
          One target at a <Text style={s.accentWord}>time.</Text>
        </Text>
        <Text style={s.subline}>Rough is fine — you can adjust it later.</Text>

        <View style={s.field}>
          <Text style={s.label}>What is it</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Holiday · September"
            placeholderTextColor={t.muted}
            style={[s.input, { backgroundColor: t.inset, borderColor: t.hairline, color: t.ink }]}
            accessibilityLabel="What is it"
          />
        </View>

        <View style={s.row}>
          <View style={s.rowField}>
            <Text style={s.label}>Target</Text>
            <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
              <Text style={[s.currency, { color: t.muted }]}>£</Text>
              <TextInput
                value={target}
                onChangeText={(v) => setTarget(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={t.muted}
                style={[s.moneyInput, { color: t.ink }]}
                accessibilityLabel="Target amount"
              />
            </View>
          </View>
          <View style={s.rowField}>
            <Text style={s.label}>By when</Text>
            <TextInput
              value={byDate}
              onChangeText={setByDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={t.muted}
              style={[
                s.input,
                {
                  backgroundColor: t.inset,
                  borderColor: byDate.length > 0 && !validByDate ? t.repair : t.hairline,
                  color: t.ink,
                },
              ]}
              accessibilityLabel="By when"
              accessibilityHint="Format: YYYY-MM-DD"
            />
            {byDate.length > 0 && !validByDate ? (
              <Text style={[s.dateHint, { color: t.repair }]}>Use YYYY-MM-DD</Text>
            ) : null}
          </View>
        </View>

        <View style={s.row}>
          <View style={s.rowField}>
            <Text style={s.label}>Each week</Text>
            <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
              <Text style={[s.currency, { color: t.muted }]}>£</Text>
              <TextInput
                value={perWeek}
                onChangeText={(v) => setPerWeek(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={t.muted}
                style={[s.moneyInput, { color: t.ink }]}
                accessibilityLabel="Each week"
              />
            </View>
          </View>
          <View style={s.rowField}>
            <Text style={s.label}>Already saved</Text>
            <View style={[s.moneyRow, { backgroundColor: t.inset, borderColor: t.hairline }]}>
              <Text style={[s.currency, { color: t.muted }]}>£</Text>
              <TextInput
                value={saved}
                onChangeText={(v) => setSaved(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={t.muted}
                style={[s.moneyInput, { color: t.ink }]}
                accessibilityLabel="Already saved"
              />
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAdd }}
          disabled={!canAdd}
          onPress={handleAdd}
          style={[s.primary, { backgroundColor: canAdd ? t.calm : `${t.muted}66` }]}
        >
          <Text style={[s.primaryLabel, { color: t.accentInk }]}>Add plan</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={s.cancel}>
          <Text style={[s.cancelLabel, { color: t.muted }]}>Cancel</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
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
    label: { fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: t.muted },
    input: {
      marginTop: gap.xs,
      height: 44,
      paddingHorizontal: gap.md,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      fontSize: 13.5,
    },
    row: { marginTop: gap.md, flexDirection: 'row', gap: gap.sm },
    rowField: { flex: 1 },
    dateHint: { fontSize: 10.5, marginTop: gap.xxs },
    moneyRow: {
      marginTop: gap.xs,
      height: 44,
      paddingHorizontal: gap.md,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    currency: { fontSize: 14, fontVariant: ['tabular-nums'] },
    moneyInput: { flex: 1, fontSize: 13.5, fontVariant: ['tabular-nums'], padding: 0 },
    primary: {
      marginTop: gap.xl,
      height: 54,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: { fontSize: 15, fontWeight: '500' },
    cancel: { marginTop: gap.sm, height: 44, alignItems: 'center', justifyContent: 'center' },
    cancelLabel: { fontSize: 13.5 },
  });
}
