import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getDecisionLedgerEntries,
  getState,
  recordMaterialDecision,
  recordProvisionalAnswer,
  setCurrentBalance,
  setMeloPrimerSeen,
  setOnboarding,
  useAppStore,
} from '@/folio/store';
import { buildProvisionalFirstAnswer } from '@/folio/lib/criticalJourneys';
import { gap, pressed, radius, serif, useTheme } from '@/folio/theme';
import { EmptyState } from '@/folio/ui/EmptyState';
import { SafeRangeBeforeAfter, UnknownsAndContradictions } from '@/folio/ui/TrustedCoreSurfaces';
import type { Nav } from '@/folio/types';
import type { ProvisionalAnswerRecord } from '@folio/domain';

type FirstAnswerQuestionId = 'last_payday' | 'afford_amount' | 'tight_month' | 'needed_info';

const QUESTIONS: readonly { id: FirstAnswerQuestionId; label: string; prompt: string }[] = [
  {
    id: 'last_payday',
    label: 'Will my money last until payday?',
    prompt: 'Will my money last until payday?',
  },
  {
    id: 'afford_amount',
    label: 'Can I afford a specific amount?',
    prompt: 'Can I afford this amount?',
  },
  {
    id: 'tight_month',
    label: 'What is making this month tight?',
    prompt: 'What is making this month tight?',
  },
  {
    id: 'needed_info',
    label: 'What does Melo need before it can answer safely?',
    prompt: 'What information does Melo need before it can answer safely?',
  },
];

function parsePounds(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, '');
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function parseDay(input: string): number | null {
  const value = Number(input.trim());
  if (!Number.isInteger(value) || value < 1 || value > 31) return null;
  return value;
}

function money(minor: number | null): string {
  if (minor === null) return 'missing';
  const sign = minor < 0 ? '−' : '';
  return `${sign}£${Math.round(Math.abs(minor) / 100).toLocaleString('en-GB')}`;
}

function relianceLabel(answer: ProvisionalAnswerRecord): string {
  if (answer.reliance === 'blocked') return 'Do not rely on this yet';
  if (answer.reliance === 'use_caution') return 'Useful direction, not a final answer';
  return 'Safe enough for this limited question';
}

export function FirstAnswerScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const appState = useAppStore((state) => state);
  const workspaceKind = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.kind ??
      'personal',
  );
  const decisionCount = useAppStore((state) => state.decisionLedger?.length ?? 0);
  const [questionId, setQuestionId] = useState<FirstAnswerQuestionId>('last_payday');
  const [balance, setBalance] = useState('');
  const [payday, setPayday] = useState('');
  const [income, setIncome] = useState('');
  const [essentials, setEssentials] = useState('');
  const [affordAmount, setAffordAmount] = useState('');
  const [keptId, setKeptId] = useState<string | null>(null);
  const [savedToSetup, setSavedToSetup] = useState(false);
  const [previousAnswer, setPreviousAnswer] = useState<ProvisionalAnswerRecord | null>(null);
  const [decisionId, setDecisionId] = useState<string | null>(null);

  const selectedQuestion =
    QUESTIONS.find((question) => question.id === questionId) ?? QUESTIONS[0]!;
  const balanceMinorRaw = parsePounds(balance);
  const affordMinor = questionId === 'afford_amount' ? parsePounds(affordAmount) : null;
  const balanceMinor =
    balanceMinorRaw === null
      ? null
      : questionId === 'afford_amount' && affordMinor !== null
        ? balanceMinorRaw - affordMinor
        : balanceMinorRaw;
  const paydayDay = parseDay(payday);
  const incomeMinor = parsePounds(income);
  const essentialsMinor = parsePounds(essentials);
  const hasEnteredAnything =
    balanceMinorRaw !== null ||
    paydayDay !== null ||
    incomeMinor !== null ||
    essentialsMinor !== null;

  const answer = useMemo(() => {
    if (workspaceKind !== 'personal' || balanceMinorRaw === null) return null;
    return buildProvisionalFirstAnswer(appState, {
      workspaceId: appState.activeWorkspaceId,
      question: selectedQuestion.prompt,
      balanceMinor,
      paydayDay,
      monthlyIncomeMinor: incomeMinor,
      essentialBillsMinor: essentialsMinor,
      now: new Date(),
      savedToSetup,
    });
  }, [
    appState,
    balanceMinor,
    balanceMinorRaw,
    essentialsMinor,
    incomeMinor,
    paydayDay,
    savedToSetup,
    selectedQuestion.prompt,
    workspaceKind,
  ]);

  if (workspaceKind !== 'personal') {
    return (
      <EmptyState
        mood="calm"
        headline="First Answer is Personal for now."
        body="Business has its own runway model, so this provisional Personal answer stays out of that workspace."
        cta={{ label: 'Back', onPress: nav.back }}
      />
    );
  }

  const keepAnswer = () => {
    if (!answer) return;
    recordProvisionalAnswer(answer);
    setKeptId(String(answer.id));
  };

  const saveIntoSetup = () => {
    if (!answer || balanceMinorRaw === null) return;
    const stored = buildProvisionalFirstAnswer(getState(), {
      workspaceId: appState.activeWorkspaceId,
      question: selectedQuestion.prompt,
      balanceMinor,
      paydayDay,
      monthlyIncomeMinor: incomeMinor,
      essentialBillsMinor: essentialsMinor,
      now: new Date(),
      savedToSetup: true,
    });
    recordProvisionalAnswer(stored);
    setCurrentBalance({
      amount: balanceMinorRaw / 100,
      source: 'user-entered',
      confidence: 'rough',
    });
    setOnboarding({
      done: true,
      ...(paydayDay === null ? {} : { payday: paydayDay }),
      ...(incomeMinor === null ? {} : { monthlyIncome: incomeMinor / 100 }),
    });
    setMeloPrimerSeen(true);
    setSavedToSetup(true);
    setKeptId(String(stored.id));
  };

  const addHighestValueMissing = () => {
    if (answer) setPreviousAnswer(answer);
    if (balanceMinorRaw === null) setBalance('720');
    else if (paydayDay === null) setPayday('25');
    else if (incomeMinor === null) setIncome('2180');
    else if (essentialsMinor === null) setEssentials('900');
  };

  const createMaterialChoice = () => {
    if (!answer || affordMinor === null) return;
    const before = getDecisionLedgerEntries().length;
    const entry = recordMaterialDecision({
      idempotencyKey: `first_answer_purchase_${answer.id}_${affordMinor}`,
      decisionType: 'purchase-affordability',
      contextRoute: 'first-answer',
      question: `Do not spend ${money(affordMinor)} based on this provisional answer.`,
      questionSource: 'user',
      priority: 'avoid_shortfall',
      amountMinor: -affordMinor,
      bufferDeltaMinor: -affordMinor,
      confirmedAction: true,
      safeRange: answer.safeRange,
      assumptions: answer.assumptions,
      outcome: 'awaiting',
      now: new Date(),
    });
    const after = getDecisionLedgerEntries().length;
    if (entry) setDecisionId(String(entry.id));
    if (after === before && entry) setDecisionId(String(entry.id));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: t.canvas }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [styles.back, isPressed ? pressed : undefined]}
          >
            <Text style={[styles.backLabel, { color: t.muted }]}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>First trustworthy answer</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
              Start with just enough.
            </Text>
          </View>
        </View>

        {appState.currentBalance.source === 'sample' && !hasEnteredAnything ? (
          <View style={[styles.notice, { backgroundColor: t.inset, borderColor: t.hairline }]}>
            <Text style={[styles.noticeTitle, { color: t.ink }]}>Sample mode</Text>
            <Text style={[styles.body, { color: t.muted }]}>
              Melo can explain the shape, but sample numbers are not treated as your money.
            </Text>
          </View>
        ) : null}

        <View style={styles.questionGrid}>
          {QUESTIONS.map((question) => {
            const selected = question.id === questionId;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={question.id}
                onPress={() => {
                  setQuestionId(question.id);
                  setPreviousAnswer(null);
                  setDecisionId(null);
                }}
                style={[
                  styles.question,
                  {
                    backgroundColor: selected ? t.calmSoft : t.surface,
                    borderColor: selected ? t.calm : t.hairline,
                  },
                ]}
              >
                <Text style={[styles.questionLabel, { color: t.ink }]}>{question.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Minimum information</Text>
          <MoneyInput label="Current available amount" value={balance} onChangeText={setBalance} />
          {questionId === 'afford_amount' ? (
            <MoneyInput
              label="Amount you are deciding on"
              value={affordAmount}
              onChangeText={setAffordAmount}
            />
          ) : null}
          <PlainInput label="Payday day of month" value={payday} onChangeText={setPayday} />
          <MoneyInput label="Expected income" value={income} onChangeText={setIncome} />
          <MoneyInput
            label="Essentials before payday"
            value={essentials}
            onChangeText={setEssentials}
          />
        </View>

        {answer ? (
          <>
            <View
              accessibilityRole="summary"
              accessibilityLiveRegion="polite"
              style={[styles.result, { backgroundColor: t.surface, borderColor: t.hairline }]}
            >
              <Text style={[styles.eyebrow, { color: t.muted }]}>Provisional Safe Range</Text>
              <Text style={[styles.resultMoney, { color: t.ink }]}>
                {money(answer.safeRange.expectedSafeMin?.minorUnits ?? null)}–
                {money(answer.safeRange.expectedSafeMax?.minorUnits ?? null)}
              </Text>
              <Text style={[styles.body, { color: t.muted }]}>{relianceLabel(answer)}</Text>
              <Text style={[styles.meta, { color: t.muted }]}>
                {answer.truth.replaceAll('_', ' ')} · {answer.reliance.replaceAll('_', ' ')} ·{' '}
                {answer.safeRange.freshness}
              </Text>
            </View>

            {previousAnswer ? (
              <SafeRangeBeforeAfter
                before={previousAnswer.safeRange}
                after={answer.safeRange}
                title="Why it changed after the new fact"
              />
            ) : null}

            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
              <Text style={[styles.eyebrow, { color: t.muted }]}>Known facts</Text>
              {answer.enteredFacts.map((fact) => (
                <Text key={fact.id} style={[styles.body, { color: t.ink }]}>
                  {fact.label}: {fact.truth.replaceAll('_', ' ')}
                </Text>
              ))}
              {answer.enteredFacts.length === 0 ? (
                <Text style={[styles.body, { color: t.muted }]}>Nothing confirmed yet.</Text>
              ) : null}
              {answer.assumptions.map((assumption) => (
                <Text key={assumption} style={[styles.body, { color: t.muted }]}>
                  Assumption: {assumption}
                </Text>
              ))}
            </View>

            <UnknownsAndContradictions
              missing={answer.missingMaterialInfo}
              contradictions={answer.contradictions}
            />

            {answer.nextBestInput ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add next missing input: ${answer.nextBestInput}`}
                onPress={addHighestValueMissing}
                style={({ pressed: isPressed }) => [
                  styles.secondaryButton,
                  { backgroundColor: t.inset, borderColor: t.hairline },
                  isPressed ? pressed : undefined,
                ]}
              >
                <Text style={[styles.secondaryButtonLabel, { color: t.ink }]}>
                  Add next: {answer.nextBestInput}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={keepAnswer}
                style={({ pressed: isPressed }) => [
                  styles.primary,
                  { backgroundColor: t.ink },
                  isPressed ? pressed : undefined,
                ]}
              >
                <Text style={[styles.primaryLabel, { color: t.canvas }]}>
                  {keptId === String(answer.id)
                    ? 'Provisional answer kept'
                    : 'Keep provisional answer'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={saveIntoSetup}
                style={({ pressed: isPressed }) => [
                  styles.primary,
                  { backgroundColor: t.calm },
                  isPressed ? pressed : undefined,
                ]}
              >
                <Text style={[styles.primaryLabel, { color: t.accentInk }]}>
                  Use these in setup
                </Text>
              </Pressable>
            </View>

            {questionId === 'afford_amount' && affordMinor !== null ? (
              <Pressable
                accessibilityRole="button"
                onPress={createMaterialChoice}
                style={({ pressed: isPressed }) => [
                  styles.secondaryButton,
                  { backgroundColor: t.surface, borderColor: t.hairline },
                  isPressed ? pressed : undefined,
                ]}
              >
                <Text style={[styles.secondaryButtonLabel, { color: t.ink }]}>
                  {decisionId
                    ? `Decision receipt created · ${decisionCount + 1}`
                    : 'Record my choice not to spend'}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View style={[styles.result, { backgroundColor: t.surface, borderColor: t.hairline }]}>
            <Text style={[styles.eyebrow, { color: t.muted }]}>No defensible answer yet</Text>
            <Text style={[styles.body, { color: t.muted }]}>
              Add your current available amount first. Melo will show assumptions and unknowns
              before anything is treated as reliable.
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={nav.back}
          style={({ pressed: isPressed }) => [styles.leave, isPressed ? pressed : undefined]}
        >
          <Text style={[styles.leaveLabel, { color: t.muted }]}>Leave without saving</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MoneyInput({
  label,
  onChangeText,
  value,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <PlainInput
      keyboardType="decimal-pad"
      label={label}
      value={value}
      onChangeText={onChangeText}
    />
  );
}

function PlainInput({
  keyboardType,
  label,
  onChangeText,
  value,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  const t = useTheme();
  return (
    <View style={styles.inputBlock}>
      <Text style={[styles.inputLabel, { color: t.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType ?? 'number-pad'}
        onChangeText={onChangeText}
        placeholder="missing"
        placeholderTextColor={t.muted}
        style={[styles.input, { backgroundColor: t.inset, borderColor: t.hairline, color: t.ink }]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: gap.sm, marginTop: gap.lg },
  back: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  backLabel: { fontSize: 34, lineHeight: 36 },
  body: { fontSize: 13, lineHeight: 19, marginTop: gap.xs },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    padding: gap.lg,
  },
  content: { paddingHorizontal: gap.xl },
  eyebrow: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.35, textTransform: 'uppercase' },
  header: { alignItems: 'center', flexDirection: 'row', gap: gap.md },
  headerCopy: { flex: 1 },
  input: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: gap.md,
  },
  inputBlock: { marginTop: gap.md },
  inputLabel: {
    fontSize: 11,
    letterSpacing: 1.1,
    marginBottom: gap.xs,
    textTransform: 'uppercase',
  },
  leave: { alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: gap.lg },
  leaveLabel: { fontSize: 13 },
  meta: { fontSize: 11.5, lineHeight: 16, marginTop: gap.sm },
  notice: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    padding: gap.md,
  },
  noticeTitle: { fontSize: 13.5, fontWeight: '700' },
  primary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: gap.lg,
  },
  primaryLabel: { fontSize: 14, fontWeight: '700' },
  question: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 58,
    minWidth: 148,
    padding: gap.md,
  },
  questionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm, marginTop: gap.xl },
  questionLabel: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  result: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.lg,
    padding: gap.lg,
  },
  resultMoney: {
    fontFamily: serif.display,
    fontSize: 33,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.7,
    marginTop: gap.xs,
  },
  root: { flex: 1 },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    marginTop: gap.md,
    minHeight: 48,
    paddingHorizontal: gap.md,
  },
  secondaryButtonLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  title: { fontFamily: serif.display, fontSize: 31, letterSpacing: -0.7, lineHeight: 34 },
});
