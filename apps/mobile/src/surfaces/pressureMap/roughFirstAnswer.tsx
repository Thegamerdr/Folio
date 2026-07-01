// Rough First Answer — a relief path, not a form.
//
// One topic at a time: money you can see now, when money comes in next, what must
// leave before then. Rough is fine, skip is allowed, and it ends on an immediate
// payoff: a first read on whether the money lasts. It writes through the same
// canonical quick-estimate the rest of the app uses.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { QuickEstimateInput } from '../../local/localLedger';
import { currentLocalIsoDate } from '../mobileShell';
import {
  Body,
  ChipToggle,
  Display,
  Eyebrow,
  MoneyPad,
  Muted,
  PressureScreen,
  PrimaryAction,
  QuietLink,
  gap,
  poundsLabel,
  useTheme,
  type Palette,
} from './kit';
import { MeloPresence } from './melo';

type WhenKey = 'soon' | 'next-week' | 'month-end' | 'unsure';

const INCOME_WHEN: readonly { key: WhenKey; label: string; days: number }[] = [
  { key: 'soon', label: 'This week', days: 5 },
  { key: 'next-week', label: 'Next week', days: 10 },
  { key: 'month-end', label: 'End of month', days: 22 },
  { key: 'unsure', label: 'Not sure', days: 14 },
];

const BILL_WHEN: readonly { key: WhenKey; label: string; days: number }[] = [
  { key: 'soon', label: 'In a few days', days: 3 },
  { key: 'next-week', label: 'Next week', days: 8 },
  { key: 'month-end', label: 'Later this month', days: 18 },
  { key: 'unsure', label: 'Not sure', days: 10 },
];

function addDays(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function digits(value: string): number {
  const clean = value.replace(/[^0-9]/g, '');
  return clean.length === 0 ? 0 : Number(clean);
}

export function QuickEstimateScreen({
  onSaveEstimate,
}: {
  onSaveEstimate: (input: QuickEstimateInput) => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const today = useMemo(() => currentLocalIsoDate(), []);
  const [step, setStep] = useState(0);
  const [cash, setCash] = useState('');
  const [income, setIncome] = useState('');
  const [incomeWhen, setIncomeWhen] = useState<WhenKey>('next-week');
  const [bill, setBill] = useState('');
  const [billWhen, setBillWhen] = useState<WhenKey>('next-week');

  const back = () => setStep((s) => Math.max(0, s - 1));
  const next = () => setStep((s) => s + 1);

  const save = () => {
    const incomeDays = INCOME_WHEN.find((o) => o.key === incomeWhen)?.days ?? 14;
    const billDays = BILL_WHEN.find((o) => o.key === billWhen)?.days ?? 10;
    const input: QuickEstimateInput = {
      cashNowText: String(digits(cash)),
      incomeAmountText: String(digits(income)),
      incomeDate: addDays(today, incomeDays),
      incomeTitle: 'Income',
      incomeCertainty: 'expected',
      billAmountText: String(digits(bill)),
      billDate: addDays(today, billDays),
      billTitle: 'Bill',
    };
    onSaveEstimate(input);
  };

  if (step === 3) {
    return (
      <SummaryStep
        cash={digits(cash)}
        income={digits(income)}
        bill={digits(bill)}
        onBack={back}
        onShow={save}
      />
    );
  }

  return (
    <PressureScreen style={styles.screen}>
      <View style={styles.head}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={12} onPress={back}>
          <Text style={styles.backText}>{step === 0 ? '' : '‹ Back'}</Text>
        </Pressable>
        <Progress step={step} />
      </View>

      {step === 0 ? (
        <AmountStep
          eyebrow="Where you stand"
          question="What money can you see today?"
          helper="Across the accounts you actually use. Roughly is fine."
          value={cash}
          onChange={setCash}
          onNext={next}
          onSkip={() => {
            setCash('');
            next();
          }}
          primaryLabel="Next"
        />
      ) : null}

      {step === 1 ? (
        <AmountStep
          eyebrow="What's coming"
          question="When does money come in next?"
          helper="Your next pay or income — even a rough date and amount helps."
          value={income}
          onChange={setIncome}
          onNext={next}
          onSkip={() => {
            setIncome('');
            next();
          }}
          primaryLabel="Next"
          chips={INCOME_WHEN.map((o) => ({ key: o.key, label: o.label }))}
          selectedChip={incomeWhen}
          onSelectChip={(k) => setIncomeWhen(k)}
        />
      ) : null}

      {step === 2 ? (
        <AmountStep
          eyebrow="Before then"
          question="What must leave before then?"
          helper="A big bill, rent, or a payment you can't miss. One is enough for now."
          value={bill}
          onChange={setBill}
          onNext={next}
          onSkip={() => {
            setBill('');
            next();
          }}
          primaryLabel="See my picture"
          chips={BILL_WHEN.map((o) => ({ key: o.key, label: o.label }))}
          selectedChip={billWhen}
          onSelectChip={(k) => setBillWhen(k)}
        />
      ) : null}
    </PressureScreen>
  );
}

function AmountStep({
  eyebrow,
  question,
  helper,
  value,
  onChange,
  onNext,
  onSkip,
  primaryLabel,
  chips,
  selectedChip,
  onSelectChip,
}: {
  eyebrow: string;
  question: string;
  helper: string;
  value: string;
  onChange: (next: string) => void;
  onNext: () => void;
  onSkip: () => void;
  primaryLabel: string;
  chips?: readonly { key: WhenKey; label: string }[] | undefined;
  selectedChip?: WhenKey | undefined;
  onSelectChip?: ((key: WhenKey) => void) | undefined;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.stepBody}>
      <View style={styles.stepIntro}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Display style={styles.question}>{question}</Display>
        <Muted style={styles.helper}>{helper}</Muted>
      </View>

      <MeloPresence size="sm" state="melo_guiding_input" style={styles.melo} />

      {chips && onSelectChip ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <ChipToggle
              key={c.key}
              label={c.label}
              onPress={() => onSelectChip(c.key)}
              selected={selectedChip === c.key}
            />
          ))}
        </View>
      ) : null}

      <Text style={styles.amount}>{poundsLabel(value)}</Text>

      <MoneyPad onChange={onChange} value={value} />

      <View style={styles.footer}>
        <QuietLink
          accessibilityHint="Skips this and leaves it out for now."
          label="Skip for now"
          onPress={onSkip}
        />
        <PrimaryAction label={primaryLabel} onPress={onNext} />
      </View>
    </View>
  );
}

function SummaryStep({
  cash,
  income,
  bill,
  onBack,
  onShow,
}: {
  cash: number;
  income: number;
  bill: number;
  onBack: () => void;
  onShow: () => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const projected = cash + income - bill;
  const tone = projected < 0 ? 'short' : projected < 5000 ? 'tight' : 'clear';
  const headline =
    tone === 'short'
      ? 'It looks tight before payday.'
      : tone === 'tight'
        ? 'It should just about hold.'
        : 'It looks like it holds.';
  const detail =
    tone === 'short'
      ? `On this rough picture you reach payday around ${poundsLabel(String(Math.abs(Math.round(projected / 100))))} short.`
      : `On this rough picture you reach payday with about ${poundsLabel(String(Math.round(projected / 100)))} to spare.`;

  return (
    <PressureScreen style={styles.screen}>
      <View style={styles.head}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Progress step={3} />
      </View>

      <View style={styles.stepIntro}>
        <Eyebrow tone={tone === 'short' ? 'warm' : undefined}>Your first read</Eyebrow>
        <Display style={styles.summaryHeadline}>{headline}</Display>
        <Body style={styles.summaryDetail}>{detail}</Body>
        <Muted style={styles.summaryNote}>
          This is a rough start. You can correct anything, add a statement, or check your real
          payments next.
        </Muted>
      </View>

      <View style={styles.footer}>
        <PrimaryAction
          accessibilityHint="Builds your money path from this picture."
          label="Show my money path"
          onPress={onShow}
        />
      </View>
    </PressureScreen>
  );
}

function Progress({ step }: { step: number }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View accessibilityLabel={`Step ${Math.min(step + 1, 3)} of 3`} style={styles.progress}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.progressDot, i <= step ? styles.progressDotOn : undefined]} />
      ))}
    </View>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    screen: { gap: gap.lg },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 24,
    },
    backText: { color: t.secondary, fontSize: 15, fontWeight: '600' },
    progress: { flexDirection: 'row', gap: 6 },
    progressDot: { width: 22, height: 4, borderRadius: 2, backgroundColor: t.hairline },
    progressDotOn: { backgroundColor: t.calm },

    stepBody: { gap: gap.lg },
    melo: { marginTop: -gap.xs },
    stepIntro: { gap: gap.sm },
    question: { fontSize: 28, lineHeight: 33 },
    helper: { fontSize: 14, maxWidth: 330 },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm },

    amount: {
      color: t.ink,
      fontSize: 46,
      fontWeight: '800',
      letterSpacing: -1.4,
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
      paddingVertical: gap.xs,
    },

    footer: { gap: gap.xs, marginTop: gap.xs },

    summaryHeadline: { fontSize: 30, lineHeight: 36, marginTop: gap.xs },
    summaryDetail: { color: t.secondary, fontSize: 17, lineHeight: 25, marginTop: gap.xs },
    summaryNote: { marginTop: gap.sm },
  });
}
