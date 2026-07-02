// Onboarding (MELO_BLUEPRINT.md §9): value before data-ask, one question per screen, the number
// lands at the reveal. Seven beats: cold open → pick your Melo → payday → income → balance →
// bills → THE REVEAL (computed by the real engine from what was just typed — never a mock).

import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatPounds } from '@folio/melo-engine';
import {
  Body,
  Display,
  GhostButton,
  HeroMoney,
  Muted,
  PrimaryAction,
  QuietLink,
  useTheme,
} from '@/surfaces/pressureMap/kit';
import { useCountUp } from '@/surfaces/pressureMap/useCountUp';

import { MeloMascot } from '../mascot/MeloMascot';
import { RunwayStrip } from '../components/RunwayStrip';
import { WeatherSky } from '../components/WeatherSky';
import { deriveLive } from '../state/derive';
import type { MeloBill, MeloSetup } from '../state/meloStore';
import { BILL_PRESETS, billId, parsePoundsText } from '../state/presets';
import { MELO_COLORWAYS, type MeloColorway } from '../theme/weather';

type Beat = 'cold' | 'pick' | 'payday' | 'income' | 'balance' | 'bills' | 'reveal';

const PAYDAY_PRESETS = [1, 5, 10, 15, 20, 25, 28] as const;

type Props = {
  onComplete: (setup: Omit<MeloSetup, 'onboarded'>) => void;
  onSkipToDemo: () => void;
};

export function MeloOnboarding({ onComplete, onSkipToDemo }: Props) {
  const t = useTheme();
  const [beat, setBeat] = useState<Beat>('cold');
  const [colorway, setColorway] = useState<MeloColorway>('ember');
  const [paydayDay, setPaydayDay] = useState(28);
  const [incomeText, setIncomeText] = useState('');
  const [balanceText, setBalanceText] = useState('');
  const [bills, setBills] = useState<readonly MeloBill[]>([]);

  const incomePence = parsePoundsText(incomeText);
  const balancePence = parsePoundsText(balanceText);

  const draft: Omit<MeloSetup, 'onboarded'> = useMemo(
    () => ({
      colorway,
      paydayDay,
      incomePence,
      balancePence,
      balanceUpdatedAtMs: Date.now(),
      bills,
      essentialsPerDayPence: 1_400,
      savingsPence: 4_000,
      bufferPence: 2_000,
    }),
    [colorway, paydayDay, incomePence, balancePence, bills],
  );

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

  const billsTotal = bills.reduce((sum, b) => sum + b.amountPence, 0);

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      {beat === 'cold' ? (
        <View style={s.cold}>
          <MeloMascot emotion="calm" colorway={colorway} size={120} glow={0.85} breathe />
          <Display style={s.coldTitle}>I’m Melo.</Display>
          <Body style={s.coldSub}>
            Two questions and I’ll tell you what’s actually safe to spend.
          </Body>
          <View style={s.coldCta}>
            <PrimaryAction label="Let’s do it" onPress={() => setBeat('pick')} />
          </View>
          <QuietLink label="look around first" onPress={onSkipToDemo} />
        </View>
      ) : null}

      {beat === 'pick' ? (
        <Step
          question="Pick your Melo."
          sub="They all worry about you equally."
          cta="This one"
          onNext={() => setBeat('payday')}
        >
          <View style={s.pickRow}>
            {(Object.keys(MELO_COLORWAYS) as MeloColorway[]).map((cw) => (
              <Pressable
                key={cw}
                onPress={() => setColorway(cw)}
                style={[
                  s.pickCard,
                  { borderColor: cw === colorway ? t.calm : t.hairline, backgroundColor: t.inset },
                ]}
              >
                <MeloMascot emotion="calm" colorway={cw} size={72} glow={0.8} />
                <Text style={[s.pickName, { color: t.ink }]}>
                  {cw === 'ember' ? 'Ember' : cw === 'moss' ? 'Moss' : 'Tide'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Step>
      ) : null}

      {beat === 'payday' ? (
        <Step
          question="When does money arrive?"
          sub="Everything counts back from that day."
          cta="That’s my payday"
          onNext={() => setBeat('income')}
        >
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
          <Muted style={s.stepNote}>Paid the last working day? Pick the 28th for now.</Muted>
        </Step>
      ) : null}

      {beat === 'income' ? (
        <Step
          question="Roughly what lands?"
          sub="Rough is fine — I round down on your behalf."
          cta="Next"
          disabled={incomePence <= 0}
          onNext={() => setBeat('balance')}
        >
          <AmountInput value={incomeText} onChange={setIncomeText} placeholder="1450" />
        </Step>
      ) : null}

      {beat === 'balance' ? (
        <Step
          question="And what’s in the account right now?"
          sub="Today’s rough balance — this is where the maths starts."
          cta="Next"
          disabled={balanceText.length === 0}
          onNext={() => setBeat('bills')}
        >
          <AmountInput value={balanceText} onChange={setBalanceText} placeholder="1240" />
        </Step>
      ) : null}

      {beat === 'bills' ? (
        <Step
          question="Which of these are yours?"
          sub="These get protected first — before anything else gets spent."
          cta="Shield these"
          onNext={() => setBeat('reveal')}
          secondary={{ label: 'add the rest later', onPress: () => setBeat('reveal') }}
        >
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
            <View style={[s.amountList, { borderColor: t.hairline, backgroundColor: t.inset }]}>
              {bills.map((b) => (
                <View key={b.id} style={s.amountRow}>
                  <Text style={[s.amountName, { color: t.secondary }]}>{b.name}</Text>
                  <View style={s.amountEdit}>
                    <Text style={[s.amountPound, { color: t.muted }]}>£</Text>
                    <TextInput
                      defaultValue={String(Math.round(b.amountPence / 100))}
                      onChangeText={(text) => setBillAmount(b.id, text)}
                      keyboardType="number-pad"
                      style={[s.amountField, { color: t.ink }]}
                    />
                  </View>
                </View>
              ))}
              <View style={[s.amountTotal, { borderTopColor: t.hairline }]}>
                <Text style={[s.amountName, { color: t.ink, fontWeight: '600' }]}>Protected</Text>
                <Text style={[s.amountName, { color: t.ink, fontWeight: '600' }]}>
                  {formatPounds(billsTotal)}
                </Text>
              </View>
            </View>
          ) : null}
        </Step>
      ) : null}

      {beat === 'reveal' ? <Reveal draft={draft} onDone={() => onComplete(draft)} /> : null}
    </ScrollView>
  );
}

function Reveal({ draft, onDone }: { draft: Omit<MeloSetup, 'onboarded'>; onDone: () => void }) {
  const derived = useMemo(
    () =>
      deriveLive(
        { ...draft, onboarded: true },
        { record: null, recoveryStartISO: null, moveDoneISO: null },
        [],
      ),
    [draft],
  );
  const sz = derived.safeZone.safeZonePence;
  const honest = sz <= 0;
  const animated = useCountUp(Math.max(sz, 0), 1_200);

  return (
    <View style={s.reveal}>
      <View style={s.revealSky}>
        <WeatherSky weather={honest ? 'cloudy' : 'sunny'} height={190} />
      </View>
      <View style={s.revealBody}>
        <MeloMascot
          emotion={honest ? 'calm' : 'joy'}
          colorway={draft.colorway}
          size={104}
          glow={honest ? 0.5 : 0.85}
        />
        <HeroMoney accessibilityLabel={`Safe Zone ${formatPounds(sz)}`}>
          {honest ? formatPounds(sz) : formatPounds(Math.round(animated))}
        </HeroMoney>
        <Muted>{honest ? 'spare this cycle' : `safe until ${derived.paydayLabel}`}</Muted>
        <Body style={s.revealLine}>
          {honest
            ? 'Tight month already — good timing, that’s exactly what I’m for. Bills first, then we steer the rest.'
            : 'That’s your real number — balance minus everything that’s spoken for.'}
        </Body>
        <View style={s.revealRunway}>
          <RunwayStrip
            daysToPayday={derived.safeZone.daysToPayday}
            bills={derived.runwayBills}
            dangerDay={derived.dangerDayOffset}
            paydayLabel={derived.paydayLabel}
          />
        </View>
        <View style={s.revealCta}>
          <PrimaryAction label="Take me home" onPress={onDone} />
        </View>
      </View>
    </View>
  );
}

function Step({
  question,
  sub,
  cta,
  onNext,
  disabled,
  secondary,
  children,
}: {
  question: string;
  sub: string;
  cta: string;
  onNext: () => void;
  disabled?: boolean;
  secondary?: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  return (
    <View style={s.step}>
      <Display style={s.question}>{question}</Display>
      <Muted style={s.questionSub}>{sub}</Muted>
      <View style={s.stepBody}>{children}</View>
      <View style={s.stepCta}>
        <PrimaryAction label={cta} onPress={onNext} disabled={disabled} />
        {secondary ? <GhostButton label={secondary.label} onPress={secondary.onPress} /> : null}
      </View>
    </View>
  );
}

function AmountInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
}) {
  const t = useTheme();
  return (
    <View style={[s.amountWrap, { borderBottomColor: t.hairlineStrong }]}>
      <Text style={[s.amountCurrency, { color: t.muted }]}>£</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        style={[s.amountBig, { color: t.ink }]}
        autoFocus
      />
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 40 },
  cold: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    gap: 8,
    minHeight: 560,
  },
  coldTitle: { marginTop: 16 },
  coldSub: { textAlign: 'center', marginTop: 4, lineHeight: 22 },
  coldCta: { alignSelf: 'stretch', marginTop: 22 },
  step: { paddingHorizontal: 26, paddingTop: 64, flexGrow: 1 },
  question: {},
  questionSub: { marginTop: 6, lineHeight: 20 },
  stepBody: { marginTop: 24 },
  stepNote: { marginTop: 12, fontSize: 12.5 },
  stepCta: { marginTop: 28, gap: 8 },
  pickRow: { flexDirection: 'row', gap: 12 },
  pickCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
  },
  pickName: { fontSize: 13.5, fontWeight: '600' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipLabel: { fontSize: 13.5, fontWeight: '500' },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    borderBottomWidth: 2,
    paddingBottom: 6,
  },
  amountCurrency: { fontSize: 26 },
  amountBig: { flex: 1, fontSize: 40, fontWeight: '600', fontVariant: ['tabular-nums'] },
  amountList: { marginTop: 16, borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountName: { fontSize: 14 },
  amountEdit: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  amountPound: { fontSize: 14 },
  amountField: {
    minWidth: 64,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    paddingVertical: 2,
    textAlign: 'right',
  },
  amountTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    marginTop: 2,
  },
  reveal: { flexGrow: 1 },
  revealSky: { height: 190 },
  revealBody: { alignItems: 'center', marginTop: -70, paddingHorizontal: 26 },
  revealLine: { textAlign: 'center', marginTop: 14, lineHeight: 21, maxWidth: 300 },
  revealRunway: { alignSelf: 'stretch', marginTop: 22 },
  revealCta: { alignSelf: 'stretch', marginTop: 26 },
});
