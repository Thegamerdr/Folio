// Setup, editable after onboarding (a 10/10-gap fix: nothing about your money should be
// write-once). Payday day, income, essentials, savings, buffer, and the bill list — same
// rough-is-fine register as onboarding. Saving writes through to the store; the engine
// recomputes on the next render. No dead ends: cancel always available.

import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

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

import type { MoneyMode } from '@folio/melo-engine';
import { MeloMascot } from '../mascot/MeloMascot';
import { FENICE_ACCESSORIES } from '../mascot/fenice';
import { MoneyModeSelector } from '../components/MoneyModeSelector';
import { AppIconPreview, WidgetPreviewCard } from '../components/BrandPreviews';
import type { MeloBill, MeloSetup } from '../state/meloStore';
import { BILL_PRESETS, billId, parsePoundsText } from '../state/presets';

const PAYDAY_PRESETS = [1, 5, 10, 15, 20, 25, 28] as const;

type Props = {
  setup: MeloSetup;
  onSave: (partial: Partial<Omit<MeloSetup, 'onboarded'>>) => void;
  onClose: () => void;
  /** §14 manual payday trigger — "I got paid today" offers the ritual without waiting
   *  for the calendar. Optional so demo/preview callers can omit it. */
  onPaidToday?: (() => void) | undefined;
  /** Trust infrastructure: wipe everything on this phone. Two-tap confirmed inline —
   *  the row arms on the first tap, fires on the second. Optional for demo callers. */
  onResetAll?: (() => void) | undefined;
  /** The auto-resolved money mode (from the numbers) — shown inside the selector. */
  autoMode: MoneyMode;
};

export function MeloSettings({ setup, onSave, onClose, onPaidToday, onResetAll, autoMode }: Props) {
  const t = useTheme();
  const [paydayDay, setPaydayDay] = useState(setup.paydayDay);
  const [lastWorkingDay, setLastWorkingDay] = useState(setup.paydayLastWorkingDay);
  const [incomeText, setIncomeText] = useState(String(Math.round(setup.incomePence / 100)));
  const [incomeVaries, setIncomeVaries] = useState(setup.incomeVaries);
  const [essentialsText, setEssentialsText] = useState(
    String(Math.round(setup.essentialsPerDayPence / 100)),
  );
  const [savingsText, setSavingsText] = useState(String(Math.round(setup.savingsPence / 100)));
  const [bufferText, setBufferText] = useState(String(Math.round(setup.bufferPence / 100)));
  const [comfortableText, setComfortableText] = useState(
    String(Math.round(setup.comfortablePerDayPence / 100)),
  );
  const [bills, setBills] = useState<readonly MeloBill[]>(setup.bills);
  const [quietMode, setQuietMode] = useState(setup.quietMode);
  const [wardrobe, setWardrobe] = useState<string | null>(setup.wardrobe);
  const [resetArmed, setResetArmed] = useState(false);

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
      paydayLastWorkingDay: lastWorkingDay,
      incomePence: parsePoundsText(incomeText) || setup.incomePence,
      incomeVaries,
      essentialsPerDayPence: parsePoundsText(essentialsText) || setup.essentialsPerDayPence,
      savingsPence: parsePoundsText(savingsText),
      bufferPence: parsePoundsText(bufferText),
      comfortablePerDayPence: parsePoundsText(comfortableText) || setup.comfortablePerDayPence,
      bills,
      quietMode,
      wardrobe,
    });
    onClose();
  };

  // Export = trust made tangible: the full setup as plain JSON, shared straight off the
  // phone. Nothing leaves unless the user sends it somewhere.
  const exportData = () => {
    void Share.share({
      title: 'My Melo data',
      message: JSON.stringify(setup, null, 2),
    }).catch(() => {
      // The share sheet was dismissed or unavailable — nothing to clean up.
    });
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
        <Pressable
          onPress={() => setLastWorkingDay((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ selected: lastWorkingDay }}
          style={[
            s.chip,
            s.lwdChip,
            {
              borderColor: lastWorkingDay ? t.calm : t.hairline,
              backgroundColor: lastWorkingDay ? t.calmSoft : t.inset,
            },
          ]}
        >
          <Text style={[s.chipLabel, { color: t.ink }]}>the last working day</Text>
        </Pressable>
        {lastWorkingDay ? (
          <Muted style={s.sectionNote}>Month-end — weekend month-ends pay the Friday before.</Muted>
        ) : null}

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
          <FieldRow
            label="Comfortable per day — your tight line"
            value={comfortableText}
            onChange={setComfortableText}
          />
        </Surface>

        <Muted style={s.sectionTag}>INCOME</Muted>
        <View style={s.chipsWrap}>
          {(['steady', 'it varies'] as const).map((label, idx) => {
            const varies = idx === 1;
            const selected = incomeVaries === varies;
            return (
              <Pressable
                key={label}
                onPress={() => setIncomeVaries(varies)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  s.chip,
                  {
                    borderColor: selected ? t.calm : t.hairline,
                    backgroundColor: selected ? t.calmSoft : t.inset,
                  },
                ]}
              >
                <Text style={[s.chipLabel, { color: t.ink }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {incomeVaries ? (
          <Muted style={s.sectionNote}>
            Plan on a low month — good months become breathing room.
          </Muted>
        ) : null}

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

        <Muted style={s.sectionTag}>MONEY MODE</Muted>
        <MoneyModeSelector
          value={(setup.manualMode as MoneyMode | null) ?? null}
          onChange={(m) => onSave({ manualMode: m })}
          autoResolved={autoMode}
        />

        <Muted style={s.sectionTag}>MELO — ACCESSORIES</Muted>
        <View style={s.chipsWrap}>
          <Pressable
            onPress={() => setWardrobe(null)}
            style={[
              s.chip,
              {
                borderColor: wardrobe === null ? t.calm : t.hairline,
                backgroundColor: wardrobe === null ? t.calmSoft : t.inset,
              },
            ]}
          >
            <Text style={[s.chipLabel, { color: t.ink }]}>nothing on</Text>
          </Pressable>
          {FENICE_ACCESSORIES.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setWardrobe(item.id)}
              style={[
                s.chip,
                s.formChip,
                {
                  borderColor: wardrobe === item.id ? t.calm : t.hairline,
                  backgroundColor: wardrobe === item.id ? t.calmSoft : t.inset,
                },
              ]}
            >
              <MeloMascot emotion="calm" colorway={setup.colorway} size={40} wardrobe={item.id} />
              <Text style={[s.chipLabel, { color: t.ink }]}>{item.name}</Text>
            </Pressable>
          ))}
        </View>

        {onPaidToday ? (
          <>
            <Muted style={s.sectionTag}>THE RITUAL</Muted>
            <Surface style={s.list} tone="sunken">
              <View style={s.quietRow}>
                <View style={s.quietBody}>
                  <Body style={s.quietTitle}>Paid on a different day?</Body>
                  <Text style={[s.quietDetail, { color: t.muted }]}>
                    Tell Melo and the two-minute ritual is ready on the home screen.
                  </Text>
                </View>
                <GhostButton
                  label="I got paid"
                  onPress={() => {
                    onPaidToday();
                    onClose();
                  }}
                />
              </View>
            </Surface>
          </>
        ) : null}

        <Muted style={s.sectionTag}>COMING WITH THE NATIVE BUILD</Muted>
        <WidgetPreviewCard />
        <AppIconPreview />

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

        <Muted style={s.sectionTag}>DATA</Muted>
        <Surface style={s.list} tone="sunken">
          <Pressable onPress={exportData} style={s.quietRow} accessibilityRole="button">
            <View style={s.quietBody}>
              <Body style={s.quietTitle}>Export my data</Body>
              <Text style={[s.quietDetail, { color: t.muted }]}>
                Your data, plain JSON, straight off this phone — nowhere else has a copy.
              </Text>
            </View>
          </Pressable>
          {onResetAll ? (
            <Pressable
              onPress={() => {
                if (resetArmed) {
                  onResetAll();
                } else {
                  setResetArmed(true);
                }
              }}
              style={s.quietRow}
              accessibilityRole="button"
              accessibilityState={{ selected: resetArmed }}
            >
              <View style={s.quietBody}>
                <Body style={s.quietTitle}>Start over</Body>
                {resetArmed ? (
                  <Text style={[s.quietDetail, { color: t.calmStrong }]}>
                    Tap once more — this wipes Melo’s memory on this phone.
                  </Text>
                ) : (
                  <Text style={[s.quietDetail, { color: t.muted }]}>
                    Wipe everything and begin fresh. Two taps, so a stray thumb can’t do it.
                  </Text>
                )}
              </View>
            </Pressable>
          ) : null}
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
  sectionNote: { marginTop: 10, fontSize: 12.5, lineHeight: 17 },
  lwdChip: { marginTop: 10, alignSelf: 'flex-start' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipLabel: { fontSize: 13.5, fontWeight: '500' },
  formChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6 },
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
