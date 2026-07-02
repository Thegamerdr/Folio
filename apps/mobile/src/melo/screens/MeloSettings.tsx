// Setup, editable after onboarding (a 10/10-gap fix: nothing about your money should be
// write-once). Payday day, income, essentials, savings, buffer, and the bill list — same
// rough-is-fine register as onboarding. Saving writes through to the store; the engine
// recomputes on the next render. No dead ends: cancel always available.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatPounds } from '@folio/melo-engine';
import {
  Body,
  Display,
  GhostButton,
  Muted,
  PrimaryAction,
  Surface,
  useTheme,
} from '@/surfaces/pressureMap/kit';

import type { MeloBill, MeloSetup } from '../state/meloStore';
import { BILL_PRESETS, billId, parsePoundsText } from '../state/presets';

const PAYDAY_PRESETS = [1, 5, 10, 15, 20, 25, 28] as const;

type Props = {
  setup: MeloSetup;
  onSave: (partial: Partial<Omit<MeloSetup, 'onboarded'>>) => void;
  onClose: () => void;
};

export function MeloSettings({ setup, onSave, onClose }: Props) {
  const t = useTheme();
  const [paydayDay, setPaydayDay] = useState(setup.paydayDay);
  const [incomeText, setIncomeText] = useState(String(Math.round(setup.incomePence / 100)));
  const [essentialsText, setEssentialsText] = useState(
    String(Math.round(setup.essentialsPerDayPence / 100)),
  );
  const [savingsText, setSavingsText] = useState(String(Math.round(setup.savingsPence / 100)));
  const [bufferText, setBufferText] = useState(String(Math.round(setup.bufferPence / 100)));
  const [bills, setBills] = useState<readonly MeloBill[]>(setup.bills);
  const [quietMode, setQuietMode] = useState(setup.quietMode);

  const toggleBill = (preset: Omit<MeloBill, 'id'>) => {
    setBills((prev) => {
      const existing = prev.find((b) => b.name === preset.name);
      if (existing) return prev.filter((b) => b.name !== preset.name);
      return [...prev, { ...preset, id: billId(preset.name) }];
    });
  };

  const setBillAmount = (id: string, text: string) => {
    const amountPence = parsePoundsText(text);
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, amountPence } : b)));
  };

  const save = () => {
    onSave({
      paydayDay,
      incomePence: parsePoundsText(incomeText) || setup.incomePence,
      essentialsPerDayPence: parsePoundsText(essentialsText) || setup.essentialsPerDayPence,
      savingsPence: parsePoundsText(savingsText),
      bufferPence: parsePoundsText(bufferText),
      bills,
      quietMode,
    });
    onClose();
  };

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Display>Your setup.</Display>
        <Muted style={s.sub}>Rough is fine — everything recalculates when you save.</Muted>

        <Muted style={s.sectionTag}>PAYDAY</Muted>
        <View style={s.chipsWrap}>
          {PAYDAY_PRESETS.map((day) => (
            <Pressable
              key={day}
              onPress={() => setPaydayDay(day)}
              style={[
                s.chip,
                {
                  borderColor: day === paydayDay ? t.calm : t.hairline,
                  backgroundColor: day === paydayDay ? t.calmSoft : t.inset,
                },
              ]}
            >
              <Text style={[s.chipLabel, { color: t.ink }]}>the {day}</Text>
            </Pressable>
          ))}
        </View>

        <Muted style={s.sectionTag}>THE NUMBERS</Muted>
        <Surface style={s.list} tone="sunken">
          <FieldRow label="Income each cycle" value={incomeText} onChange={setIncomeText} />
          <FieldRow
            label="Essentials per day"
            value={essentialsText}
            onChange={setEssentialsText}
          />
          <FieldRow label="Savings each cycle" value={savingsText} onChange={setSavingsText} />
          <FieldRow label="Buffer — early warning" value={bufferText} onChange={setBufferText} />
        </Surface>

        <Muted style={s.sectionTag}>BILLS — SHIELDED FIRST</Muted>
        <View style={s.chipsWrap}>
          {BILL_PRESETS.map((preset) => {
            const selected = bills.some((b) => b.name === preset.name);
            return (
              <Pressable
                key={preset.name}
                onPress={() => toggleBill(preset)}
                style={[
                  s.chip,
                  {
                    borderColor: selected ? t.calm : t.hairline,
                    backgroundColor: selected ? t.calmSoft : t.inset,
                  },
                ]}
              >
                <Text style={[s.chipLabel, { color: t.ink }]}>{preset.name}</Text>
              </Pressable>
            );
          })}
        </View>
        {bills.length > 0 ? (
          <Surface style={s.list} tone="sunken">
            {bills.map((b) => (
              <View key={b.id} style={s.billRow}>
                <Text style={[s.billName, { color: t.secondary }]}>
                  {b.name} · day {b.dueDay}
                </Text>
                <View style={s.billEdit}>
                  <Text style={[s.pound, { color: t.muted }]}>£</Text>
                  <TextInput
                    defaultValue={String(Math.round(b.amountPence / 100))}
                    onChangeText={(text) => setBillAmount(b.id, text)}
                    keyboardType="number-pad"
                    style={[s.billField, { color: t.ink }]}
                  />
                </View>
              </View>
            ))}
            <View style={[s.billTotal, { borderTopColor: t.hairline }]}>
              <Body style={s.totalLabel}>Shielded</Body>
              <Body style={s.totalLabel}>
                {formatPounds(bills.reduce((sum, b) => sum + b.amountPence, 0))}
              </Body>
            </View>
          </Surface>
        ) : null}

        <Muted style={s.sectionTag}>QUIET MODE</Muted>
        <Surface style={s.list} tone="sunken">
          <Pressable
            onPress={() => setQuietMode((v) => !v)}
            style={s.quietRow}
            accessibilityRole="switch"
            accessibilityState={{ checked: quietMode }}
          >
            <View style={s.quietBody}>
              <Body style={s.quietTitle}>Ambient only</Body>
              <Text style={[s.quietDetail, { color: t.muted }]}>
                No nudges, no prompts — Melo only speaks up for a real danger warning.
              </Text>
            </View>
            <View
              style={[
                s.switchTrack,
                { backgroundColor: quietMode ? t.calm : t.inset, borderColor: t.hairline },
              ]}
            >
              <View
                style={[
                  s.switchThumb,
                  {
                    backgroundColor: t.canvas,
                    alignSelf: quietMode ? 'flex-end' : 'flex-start',
                  },
                ]}
              />
            </View>
          </Pressable>
        </Surface>

        <View style={s.cta}>
          <PrimaryAction label="Save" onPress={save} />
          <GhostButton label="cancel" onPress={onClose} />
        </View>
      </ScrollView>
    </View>
  );
}

function FieldRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={s.billRow}>
      <Text style={[s.billName, { color: t.secondary }]}>{label}</Text>
      <View style={s.billEdit}>
        <Text style={[s.pound, { color: t.muted }]}>£</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          style={[s.billField, { color: t.ink }]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 26, paddingTop: 30, paddingBottom: 40 },
  sub: { marginTop: 6, lineHeight: 20 },
  sectionTag: { marginTop: 22, marginBottom: 10, fontSize: 11.5, letterSpacing: 0.8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipLabel: { fontSize: 13.5, fontWeight: '500' },
  list: { gap: 10 },
  billRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  billName: { fontSize: 14, flexShrink: 1 },
  billEdit: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pound: { fontSize: 14 },
  billField: {
    minWidth: 64,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    paddingVertical: 2,
    textAlign: 'right',
  },
  billTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  totalLabel: { fontWeight: '600' },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  quietBody: { flex: 1, gap: 3 },
  quietTitle: { fontWeight: '600' },
  quietDetail: { fontSize: 12.5, lineHeight: 17 },
  switchTrack: { width: 46, height: 26, borderRadius: 999, borderWidth: 1, padding: 3 },
  switchThumb: { width: 18, height: 18, borderRadius: 999 },
  cta: { marginTop: 28, gap: 8 },
});
