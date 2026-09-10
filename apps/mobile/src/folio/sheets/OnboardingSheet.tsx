// @rn-sheet     OnboardingSheet
// @purpose      Progressive onboarding — identity, intent, income, current money, essentials,
//               protected buffer, bundled commitments and optional pots.
// @writes       setOnboarding, setMoneyMode, setModeExtra, setBufferAmount, setCurrentBalance, setPots
// @copy         Plain setup copy; reviewed against the 0.0.5 screenshot correction specification.
// @tokens       --paper (Sheet) · --accent (t.calm) · --accent-soft (t.calmSoft) ·
//               --inset (t.inset) · --hairline (t.hairline) · --ink (t.ink) · --muted-ink (t.muted)
// @motion       fixed-width step fade · progress-pip width/colour tween
//
// Faithful RN port of the web design source with the manual finance fields added to make a first
// run useful without Open Banking.
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetOnboarding.tsx) and its
// spec (plans/rn-port/specs/SheetOnboarding.spec.md). The web source renders SEVEN steps with inline
// copy that diverges from the COPY_DECK onb.* keys; per the spec the CODE is the rendered truth, so
// the seven steps and their exact inline strings are ported verbatim (PARITY_GAPS.md Group 4 —
// BREAKS-PARITY fix: the intent-picker + mode-extra steps were previously dropped, so `setMoneyMode`
// never fired during RN onboarding; restored here). The accent word in each headline is rendered
// terracotta italic (the web's `<em class="not-italic text-accent">` reads as one coloured run; here
// it is one Fraunces-italic, t.calm-coloured Text run inside the headline).
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme'
// (which re-exports the pressure-map kit). Nothing new is defined — no colour, no font, no spacing
// value, no dependency. The slider is built from RN's own View + PanResponder (the project does not
// ship @react-native-community/slider and this wave adds no dependency); its track/thumb are painted
// from t.calm / t.inset / t.hairline, min/max/step exact to the web (<input type=range>), and it
// exposes no live value bubble — the big tabular number above is the only readout (spec fidelityRisk
// "RANGE THUMB has no live value bubble").
//
// MELO MOOD (spec `moods` + MELO_MOODS.md): the web source rendered no Melo; the spec asks the port to
// reproduce the documented mood — onboarding steps 1-3 = calm, the pot picker = curious, complete =
// cheer. A small Melo sits beside the eyebrow, calm for name/payday/income/balance and curious on the
// pot step. The loading STATE renders Melo curious beside a MeloLine, never a spinner.
//
// Motion gates to its final resolved state under reduce-motion (MOTION.md): the step slide and the
// completion stamp collapse to no-op, the pips snap, and the Sheet appears at rest.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import {
  Eyebrow,
  gap,
  money,
  pressed,
  radius,
  serif,
  Sheet,
  useIsDark,
  useTheme,
  type Palette,
} from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { copy } from '@/folio/copy/copy';
import { useAppStore, type IncomeSource } from '@/folio/store';
import { parseManualMoney } from '@/folio/lib/manualMoney';
import { isHorizontalSliderGesture, parseDayOfMonth } from '@/folio/lib/formDrafts';
import type { MoneyMode } from '@/folio/lib/modes/types';
import { isBusinessDay } from '@/folio/lib/payday';
import {
  commitOnboarding,
  isOnboardingFirstRun,
  skipOnboardingForNow,
} from '@/folio/lib/onboardingMutations';

// ---------------------------------------------------------------------------
// Intent picker + mode-specific extra question (BREAKS-PARITY fix) — web
// `INTENT_OPTIONS` + `MODE_EXTRA` (folio-melo SheetOnboarding.tsx), ported
// verbatim. This is the ONLY place `setMoneyMode` fires during onboarding —
// without it every user onboards into the default mode and none of the
// mode-driven copy on Recovery/Ritual/WhatIf/RouteDetail can ever show
// correctly (the root cause PARITY_GAPS.md Group 4 calls out).
// ---------------------------------------------------------------------------

// MONEY_MODES.md § 3 — user-declared intent → mode mapping. Kept in the user's language, not the
// internal mode key. Order matches the product spec.
type IntentOption = { label: string; mode: MoneyMode; modeLabel: string };

const INTENT_OPTIONS: readonly IntentOption[] = [
  { label: 'Know what I can safely spend', mode: 'stability', modeLabel: 'Stability' },
  { label: 'Stop running out before payday', mode: 'survival', modeLabel: 'Survival' },
  { label: 'Build savings', mode: 'growth', modeLabel: 'Growth' },
  { label: 'Pay down debt', mode: 'debt', modeLabel: 'Debt' },
  { label: 'Manage irregular income', mode: 'irregular', modeLabel: 'Irregular income' },
  { label: 'Control subscriptions and leaks', mode: 'optimizer', modeLabel: 'Optimizer' },
  { label: 'Plan a big purchase', mode: 'planning', modeLabel: 'Planning' },
  { label: 'Share bills with someone', mode: 'household', modeLabel: 'Household' },
  { label: 'Feel less anxious about money', mode: 'stability', modeLabel: 'Stability' },
  { label: 'Understand where my money goes', mode: 'lowVis', modeLabel: 'Low visibility' },
];

// Mode-specific follow-up step (inserted after the intent step). EVERY mode's answer persists to
// the store's `modeExtras` slice (Survival/Stability's also lands in `bufferAmount`, the input
// their engines read today); the hints say "saved" honestly — the mode engines adopt the value as
// each deepens, and re-asking a question the user already answered is banned by that promise.
type ModeExtra = {
  eyebrow: string;
  headLead: string;
  headAccent: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  hint: string;
};

const MODE_EXTRA: Record<MoneyMode, ModeExtra> = {
  survival: {
    eyebrow: 'Your buffer',
    headLead: 'How thin is ',
    headAccent: 'too thin?',
    unit: '£',
    min: 0,
    max: 500,
    step: 10,
    hint: 'Melo warns before the balance dips below this.',
  },
  stability: {
    eyebrow: 'Comfort line',
    headLead: 'What balance ',
    headAccent: 'feels safe?',
    unit: '£',
    min: 0,
    max: 2000,
    step: 25,
    hint: 'This buffer stays protected alongside your bills and essentials.',
  },
  growth: {
    eyebrow: 'Monthly pace',
    headLead: 'How much would you ',
    headAccent: 'like to save?',
    unit: '£',
    min: 0,
    max: 1500,
    step: 25,
    hint: 'A pace, not a promise. Saved for Growth mode.',
  },
  debt: {
    eyebrow: 'The number',
    headLead: 'Roughly how much ',
    headAccent: 'is owed?',
    unit: '£',
    min: 0,
    max: 30000,
    step: 100,
    hint: 'An estimate for your goal, separate from recorded debt balances. Add each named debt after setup.',
  },
  optimizer: {
    eyebrow: 'Target',
    headLead: 'How much would you like to ',
    headAccent: 'trim?',
    unit: '£',
    min: 0,
    max: 300,
    step: 5,
    hint: 'Per month. Saved for the Optimizer lens.',
  },
  reset: {
    eyebrow: 'Essentials',
    headLead: 'Rough weekly ',
    headAccent: 'essentials?',
    unit: '£',
    min: 0,
    max: 400,
    step: 10,
    hint: 'Food, transport, non-negotiables. Saved for Reset mode.',
  },
  irregular: {
    eyebrow: 'Floor',
    headLead: 'Your ',
    headAccent: 'worst month',
    unit: '£',
    min: 0,
    max: 5000,
    step: 50,
    hint: 'Saved for the Irregular income runway.',
  },
  planning: {
    eyebrow: 'Target',
    headLead: 'How much for ',
    headAccent: 'the goal?',
    unit: '£',
    min: 0,
    max: 20000,
    step: 100,
    hint: 'Saved for Planning mode.',
  },
  household: {
    eyebrow: 'Your share',
    headLead: 'Rough share of ',
    headAccent: 'bills?',
    unit: '£',
    min: 0,
    max: 3000,
    step: 25,
    hint: 'Saved for Household mode.',
  },
  lowVis: {
    eyebrow: 'Start rough',
    headLead: 'Guess your ',
    headAccent: 'typical monthly outgoings.',
    unit: '£',
    min: 0,
    max: 5000,
    step: 50,
    hint: "It's fine to guess. Melo sharpens this each cycle.",
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// The five render STATES the spec enumerates (stateBranches). `populated` is the real onboarding
// flow; the others are calm placeholders so the sheet has an honest face in every state the harness
// can put it in. Loading is a curious Melo + a line (never a spinner), per the spec.
export type OnboardingSheetState = 'empty' | 'loading' | 'populated' | 'error' | 'offline';

export type OnboardingSheetProps = {
  // Whether the sheet is mounted/visible — wired straight to the kit Sheet primitive.
  visible: boolean;
  initialField?: string | undefined;
  onClose: () => void;
  // Defaults to the real flow. The non-`populated` values exist to satisfy the spec's STATES matrix.
  state?: OnboardingSheetState | undefined;
};

// Whole-pound money rendered through the canonical formatter (minor units), so grouping is the kit's
// tabular "£1,200" everywhere — never an abbreviated "1.2K" (banned) and no formatting drift.
function poundsTabular(wholePounds: number): string {
  return money(Math.round(wholePounds) * 100);
}

// Each headline carries exactly one accent word (the web `<em>`). The lead is the run before it.
type Step = {
  eyebrow: string;
  // The headline split into a leading run + the single terracotta-italic accent run + a trailing run.
  head: { lead: string; accent: string; tail: string };
};

// ---------------------------------------------------------------------------
// Pot templates — byte-faithful to the web source (id/name/goal/perWeek/accent).
// ---------------------------------------------------------------------------

type PotTemplate = { id: string; name: string; goal: number; perWeek: number; accent: boolean };

const POT_TEMPLATES: readonly PotTemplate[] = [
  { id: 'holiday', name: 'Holiday · September', goal: 1200, perWeek: 35, accent: true },
  { id: 'buffer', name: 'Buffer', goal: 500, perWeek: 20, accent: false },
  { id: 'christmas', name: 'Christmas', goal: 300, perWeek: 15, accent: false },
  { id: 'pet', name: 'Vet fund', goal: 400, perWeek: 10, accent: false },
  { id: 'home', name: 'Home things', goal: 600, perWeek: 15, accent: false },
];

// Slider ranges — exact to the web `<input type=range>` per step (spec SLIDER FIDELITY).
const PAYDAY_MIN = 1;
const PAYDAY_MAX = 31;
const PAYDAY_STEP = 1;
const BALANCE_MIN = 0;
const BALANCE_MAX = 5000;
const BALANCE_STEP = 10;
const COMMITMENT_MAX = 5000;
const COMMITMENT_STEP = 10;

// Income-per-occurrence slider range/unit, branched on the declared cadence (step 3, STEP_CADENCE)
// — a monthly range (£500-£8000) is honest for a monthly earner but 4x-wrong for a weekly one, so
// the captured value must stay "the per-occurrence amount for that cadence", never a monthly-sized
// number mislabelled. Mirrors the cadence branching already used at STEP_PAYDAY just above. Ranges
// are per-occurrence guesses, not derived — weekly/fortnightly/four-weekly scale roughly with the
// monthly range divided by the cadence's OCCURRENCES_PER_MONTH (driftSignals.ts), rounded to a calm
// step size; monthly/last-working-day keep the original range unchanged.
type IncomeRange = { min: number; max: number; step: number; unit: string };

const INCOME_RANGE_BY_CADENCE: Record<PayCadence, IncomeRange> = {
  monthly: { min: 0, max: 8000, step: 20, unit: '/ month' },
  'last-working-day': { min: 0, max: 8000, step: 20, unit: '/ month' },
  weekly: { min: 0, max: 2000, step: 5, unit: '/ week' },
  fortnightly: { min: 0, max: 4000, step: 10, unit: '/ 2 weeks' },
  'four-weekly': { min: 0, max: 7500, step: 20, unit: '/ 4 weeks' },
};

const STEP_SLIDE_MS = 360; // doc-block "slide between steps"
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const PROGRESS_PIP_MS = 400; // web transition-all duration-400
const MIN_TAP = 48; // tap-only, >=44px

// ---------------------------------------------------------------------------
// Cadence selector — new "How does pay arrive?" step, ahead of the day picker.
// This extends beyond the Lovable design (the web has no cadence UI): the
// onboarding sheet is the ONLY place a user declares a cadence other than
// monthly, so the copy/tokens/pip pattern below are grown from the sheet's own
// visual language rather than imported from anywhere else. See lib/income.ts
// for the cadence engine this feeds.
// ---------------------------------------------------------------------------

type PayCadence = IncomeSource['cadence'];

type CadenceOption = { cadence: PayCadence; label: string };

// Calm, jargon-free labels — 'Every 4 weeks' not 'quadweekly' (spec copy rule).
const CADENCE_OPTIONS: readonly CadenceOption[] = [
  { cadence: 'monthly', label: 'Monthly' },
  { cadence: 'weekly', label: 'Every week' },
  { cadence: 'fortnightly', label: 'Every 2 weeks' },
  { cadence: 'four-weekly', label: 'Every 4 weeks' },
  { cadence: 'last-working-day', label: 'Last working day' },
];

const WEEK_BASED_CADENCES = new Set<PayCadence>(['weekly', 'fortnightly', 'four-weekly']);

const ISO_DATE_LENGTH = 10; // "YYYY-MM-DD"

function todayIso(): string {
  return new Date().toISOString().slice(0, ISO_DATE_LENGTH);
}

/** Zero-pad a positive integer to two digits ("3" -> "03"). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Day-of-month (1..31) an ISO "YYYY-MM-DD" string falls on. */
function dayOfMonthFromIso(iso: string): number {
  const day = Number(iso.slice(8, ISO_DATE_LENGTH));
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : 1;
}

/** Last non-weekend calendar day of the current month, as a day-of-month
 *  number — the honest "nearest day-of-month equivalent" for a
 *  last-working-day earner, used only to keep the legacy `onboarding.payday`
 *  slot populated for anything that hasn't yet been swept onto `incomeSources`. */
function lastWorkingDayOfMonthNumber(): number {
  const now = new Date();
  const lastCalendarDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  for (let day = lastCalendarDay; day >= 1; day--) {
    const candidate = new Date(now.getFullYear(), now.getMonth(), day);
    const iso = isoFromDate(candidate);
    if (isBusinessDay(iso)) return day;
  }
  return lastCalendarDay;
}

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed, mirrors Melo's local hook)
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
// OnboardingSheet
// ---------------------------------------------------------------------------

export function OnboardingSheet({
  visible,
  onClose,
  initialField,
  state = 'populated',
}: OnboardingSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  if (state !== 'populated') {
    return (
      <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
        <View style={s.body}>
          <OnboardingNonPopulated state={state} styles={s} onClose={onClose} />
        </View>
      </Sheet>
    );
  }

  return (
    <OnboardingFlow
      visible={visible}
      initialField={initialField}
      styles={s}
      palette={t}
      reduceMotion={reduceMotion}
      onClose={onClose}
    />
  );
}

// ---------------------------------------------------------------------------
// Non-populated STATES — empty / loading / error / offline
// ---------------------------------------------------------------------------

// loading = Melo curious + a quiet line, NEVER a spinner (spec). empty/error/offline are calm
// EmptyState doorways; their copy is verbatim from '@/folio/copy/copy' (err.offline / err.generic).
function OnboardingNonPopulated({
  state,
  styles: s,
  onClose,
}: {
  state: Exclude<OnboardingSheetState, 'populated'>;
  styles: ReturnType<typeof makeStyles>;
  onClose: () => void;
}) {
  if (state === 'loading') {
    return (
      <View style={s.loadingWrap}>
        <MeloLine mood="curious" text="One moment — getting your space ready." />
      </View>
    );
  }
  if (state === 'offline') {
    return <EmptyState mood="concern" headline="No connection" body={copy.err.offline} />;
  }
  if (state === 'error') {
    return <EmptyState mood="concern" headline="Something didn't catch" body={copy.err.generic} />;
  }
  // empty — nothing to set up yet; a calm doorway, retry via the parent.
  return (
    <EmptyState
      mood="calm"
      headline="Nothing yet"
      body="There's nothing to set up here just now."
      cta={{ label: 'Close', onPress: onClose }}
    />
  );
}

// ---------------------------------------------------------------------------
// The real onboarding flow (state === 'populated')
// ---------------------------------------------------------------------------

function OnboardingFlow({
  visible,
  initialField,
  styles: s,
  palette: t,
  reduceMotion,
  onClose,
}: {
  visible: boolean;
  initialField?: string | undefined;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
  onClose: () => void;
}) {
  const ob = useAppStore((st) => st.onboarding);
  const existingPots = useAppStore((st) => st.pots);
  const currentBalance = useAppStore((st) => st.currentBalance);
  const savedIncomeSource = useAppStore(
    (st) => st.incomeSources?.find((source) => source.id === 'income-onboarding-pay') ?? null,
  );
  const isFirstRun = useAppStore(isOnboardingFirstRun);
  // Returning users enter this sheet from "Payday and income". Keep only its owned fields in the
  // step sequence; mode, balance and pots belong to other surfaces and are not silently discarded.
  const isReturning = !isFirstRun;
  const savedMode = useAppStore((st) => st.moneyMode ?? 'survival');
  const isDark = useIsDark();
  const savedBuffer = useAppStore((st) => st.bufferAmount ?? 100);
  const savedEssentials = useAppStore((st) => st.modeExtras?.reset ?? 0);
  const savedBundledCommitment = useAppStore((st) => {
    const ownedName = st.onboarding.bundledCommitmentName;
    if (ownedName !== undefined) {
      return st.subs.find((subscription) => subscription.name === ownedName) ?? null;
    }
    return st.subs.find((subscription) => subscription.name === 'Rent + bills') ?? null;
  });

  const [step, setStep] = useState(initialField === 'payday' ? (isReturning ? 1 : 3) : 0);
  const [showSummary, setShowSummary] = useState(isReturning && !initialField);
  const [costsConfirmed, setCostsConfirmed] = useState(false);
  const [showMoreGoals, setShowMoreGoals] = useState(false);
  const [intentLabel, setIntentLabel] = useState(
    INTENT_OPTIONS.find((option) => option.mode === savedMode)?.label ?? INTENT_OPTIONS[0]!.label,
  );
  const [name, setName] = useState(ob.name);
  const [payday, setPayday] = useState(savedIncomeSource?.dayOfMonth ?? ob.payday);
  const [paydayInput, setPaydayInput] = useState(
    String(savedIncomeSource?.dayOfMonth ?? ob.payday),
  );
  // Pay cadence (new step, ahead of the day picker) — see lib/income.ts. Monthly is the honest
  // default: it matches every existing user's behaviour byte-for-byte until they say otherwise.
  const [cadence, setCadence] = useState<PayCadence>(savedIncomeSource?.cadence ?? 'monthly');
  const [income, setIncome] = useState(savedIncomeSource?.amount ?? ob.monthlyIncome);
  const [incomeInput, setIncomeInput] = useState(
    String(savedIncomeSource?.amount ?? ob.monthlyIncome),
  );
  // The income slider's range/unit branches on the declared cadence — a weekly earner's
  // per-occurrence figure lives on a much smaller scale than a monthly one (see
  // INCOME_RANGE_BY_CADENCE above). Recomputed, not stored, so it always tracks `cadence`.
  const incomeRange = useMemo(() => INCOME_RANGE_BY_CADENCE[cadence], [cadence]);
  // Cadence changes the slider's suggested range, never the user's exact entered amount.
  // Anchor date for the three week-based cadences — "when did pay last arrive?" Defaults to today so
  // the date picker never opens on a blank/undefined value.
  const [anchorISO, setAnchorISO] = useState<string>(savedIncomeSource?.anchorISO ?? todayIso());
  const [showAnchorPicker, setShowAnchorPicker] = useState(false);
  // Intent picker + mode-extra (BREAKS-PARITY fix) — MONEY_MODES.md § 3 — user-declared intent maps
  // to a Money Mode, stored explicitly (never silently switched later). `modeExtra` is the mode's
  // follow-up captured value; EVERY mode's answer persists to `modeExtras` on done() (see there).
  const [intentMode, setIntentMode] = useState<MoneyMode>(savedMode);
  const [modeExtra, setModeExtra] = useState<number>(savedBuffer);
  const [modeExtraInput, setModeExtraInput] = useState(String(savedBuffer));
  const [weeklyEssentials, setWeeklyEssentials] = useState<number>(savedEssentials);
  const [desiredBuffer, setDesiredBuffer] = useState<number>(savedBuffer);
  const [essentialsInput, setEssentialsInput] = useState(String(savedEssentials));
  const [bufferInput, setBufferInput] = useState(String(savedBuffer));
  const [commitmentInput, setCommitmentInput] = useState(String(savedBundledCommitment?.cost ?? 0));
  const [commitmentDayInput, setCommitmentDayInput] = useState(
    String(Number(savedBundledCommitment?.nextRenewalISO?.slice(8, 10) ?? 1)),
  );
  const [bundledCommitmentName, setBundledCommitmentName] = useState(
    savedBundledCommitment?.name ?? 'Rent + bills',
  );
  const [bundledCommitmentAmount, setBundledCommitmentAmount] = useState(
    savedBundledCommitment?.cost ?? 0,
  );
  const [bundledCommitmentDueDay, setBundledCommitmentDueDay] = useState(
    Number(savedBundledCommitment?.nextRenewalISO?.slice(8, 10) ?? 1),
  );
  // Pre-seed from the existing balance unless it's still the sample, in which case start blank so the
  // user feels they're entering it fresh (spec BALANCE SEED LOGIC).
  const [balance, setBalance] = useState<number>(
    currentBalance.source === 'sample' ? 0 : currentBalance.amount,
  );
  const [balanceInput, setBalanceInput] = useState(
    String(currentBalance.source === 'sample' ? 0 : currentBalance.amount),
  );
  const incomeInputValue = parseManualMoney(incomeInput, { allowZero: true });
  const balanceInputValue = parseManualMoney(balanceInput, {
    allowZero: true,
    allowNegative: true,
  });
  const paydayInputValue = parseDayOfMonth(paydayInput);
  const commitmentDayValue = parseDayOfMonth(commitmentDayInput);
  // Picked pot templates — pre-select whatever the user already has so a returning user lands on
  // their kept pots and first-timers land on the store defaults (Holiday + Buffer + Christmas).
  const [picked, setPicked] = useState<Set<string>>(
    () =>
      new Set(
        existingPots.map((p) => p.id).filter((id) => POT_TEMPLATES.some((tpl) => tpl.id === id)),
      ),
  );

  function togglePot(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const savingRef = useRef(false);
  function done() {
    if (savingRef.current || !costsConfirmed || !allNumbersValid) return;
    savingRef.current = true;
    // The shared production seam distinguishes first-run sample cleanup from returning-user edits.
    const legacyPayday =
      cadence === 'monthly'
        ? payday
        : cadence === 'last-working-day'
          ? lastWorkingDayOfMonthNumber()
          : dayOfMonthFromIso(anchorISO);
    const pickedPots = POT_TEMPLATES.filter((tpl) => picked.has(tpl.id)).map((tpl) => ({
      id: tpl.id,
      name: tpl.name,
      goal: tpl.goal,
      perWeek: tpl.perWeek,
      accent: tpl.accent,
    }));
    commitOnboarding({
      name,
      payday,
      monthlyIncome: income,
      balance,
      pickedPots,
      cadence,
      anchorISO,
      legacyPayday,
      intentMode,
      modeExtra,
      desiredBuffer,
      weeklyEssentials,
      ...(bundledCommitmentAmount > 0 || isReturning
        ? {
            bundledCommitment: {
              name: bundledCommitmentName,
              amount: bundledCommitmentAmount,
              dueDom: bundledCommitmentDueDay,
            },
          }
        : {}),
    });
    onClose();
  }

  function skipForNow() {
    // On a configured workspace this is cancellation, not a destructive reset.
    skipOnboardingForNow();
    onClose();
  }

  // The mode-extra step's copy for the currently-picked intent mode.
  const extra = MODE_EXTRA[intentMode];

  // Typed as a fixed 10-tuple so `steps[0]` is known-defined under noUncheckedIndexedAccess (BREAKS-
  // PARITY fix — restores the web's intent-picker + mode-extra steps; RN previously skipped both,
  // so `setMoneyMode` never fired during onboarding). A cadence step was inserted ahead of the day
  // picker (extends beyond the Lovable design — the web has no cadence UI). STEP_INDEX below
  // documents each index.
  const steps: readonly [Step, Step, Step, Step, Step, Step, Step, Step, Step, Step] = [
    { eyebrow: 'Hello', head: { lead: 'What should Melo ', accent: 'call you?', tail: '' } },
    {
      eyebrow: 'First thing',
      head: { lead: 'What should Melo ', accent: 'help with first?', tail: '' },
    },
    { eyebrow: extra.eyebrow, head: { lead: extra.headLead, accent: extra.headAccent, tail: '' } },
    { eyebrow: 'Rhythm', head: { lead: 'How does pay ', accent: 'arrive?', tail: '' } },
    { eyebrow: 'Rhythm', head: { lead: 'When does payday ', accent: 'land?', tail: '' } },
    { eyebrow: 'Rough only', head: { lead: 'What lands, ', accent: 'roughly?', tail: '' } },
    { eyebrow: 'Today', head: { lead: "What's ", accent: 'in your account', tail: ' right now?' } },
    {
      eyebrow: 'Essentials',
      head: { lead: 'What do you need for ', accent: 'the week?', tail: '' },
    },
    { eyebrow: 'Bills', head: { lead: 'What needs ', accent: 'protecting?', tail: '' } },
    { eyebrow: 'Pots', head: { lead: 'What are you ', accent: 'saving for?', tail: '' } },
  ];
  // Step indices — mirror the `steps` array above. 0 Hello · 1 intent picker · 2 mode-extra ·
  // 3 cadence · 4 payday-day/anchor · 5 income · 6 balance · 7 essentials · 8 commitment · 9 pots.
  const STEP_CADENCE = 3;
  const STEP_PAYDAY = 4;
  const STEP_BALANCE = 6;
  const STEP_ESSENTIALS = 7;
  const STEP_COMMITMENT = 8;
  const STEP_POTS = 9;
  // Returning users keep the payday/income editor and can also correct the essentials, buffer and
  // bundled bill values that feed the shared plan. The first-run flow keeps all setup steps.
  const visibleStepIndices = isReturning
    ? [0, STEP_CADENCE, STEP_PAYDAY, 5, STEP_BALANCE, STEP_ESSENTIALS, STEP_COMMITMENT]
    : steps.map((_, i) => i);
  const activeStepIndex = visibleStepIndices[step] ?? 0;
  const current = steps[activeStepIndex] ?? steps[0];
  const isLast = step === visibleStepIndices.length - 1;
  // MELO_MOODS.md: the middle steps read calm; the pot picker reads curious; a completed onboarding
  // reads cheer. The pot step is the last index.
  const meloMood = isLast ? 'curious' : 'calm';

  // Step slide — a 360ms slide-in on each step change (doc-block "slide between steps"). Direction
  // follows travel: forward steps enter from the right, the (unused-by-UI) back direction from the
  // left. Collapses to no transform under reduce-motion.
  const slide = useRef(new Animated.Value(0)).current;
  const prevStep = useRef(step);
  useEffect(() => {
    const forward = step >= prevStep.current;
    prevStep.current = step;
    if (reduceMotion) {
      slide.setValue(0);
      return;
    }
    slide.setValue(forward ? 1 : -1);
    const animation = Animated.timing(slide, {
      toValue: 0,
      duration: STEP_SLIDE_MS,
      easing: EASE_OUT_EXPO,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [step, reduceMotion, slide]);
  const bodyOpacity = slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.5, 1, 0.5] });

  function handlePrimary() {
    if (numericError !== null) return;
    Keyboard.dismiss();
    if (isReturning) {
      setShowSummary(true);
      setCostsConfirmed(false);
      return;
    }
    if (!isLast) {
      setStep((x) => x + 1);
      return;
    }
    if (!costsConfirmed) return;
    done();
  }

  const numericError =
    activeStepIndex === STEP_PAYDAY && cadence === 'monthly' && paydayInputValue === undefined
      ? 'Enter a day from 1 to 31.'
      : activeStepIndex === 5 && incomeInputValue === undefined
        ? 'Enter income of £0 or more.'
        : activeStepIndex === STEP_BALANCE && balanceInputValue === undefined
          ? 'Enter your current balance. A negative balance is allowed.'
          : activeStepIndex === 2 &&
              parseManualMoney(modeExtraInput, { allowZero: true }) === undefined
            ? 'Enter an amount of £0 or more.'
            : activeStepIndex === STEP_ESSENTIALS &&
                (parseManualMoney(essentialsInput, { allowZero: true }) === undefined ||
                  parseManualMoney(bufferInput, { allowZero: true }) === undefined)
              ? 'Enter essentials and a buffer of £0 or more.'
              : activeStepIndex === STEP_COMMITMENT &&
                  parseManualMoney(commitmentInput, { allowZero: true }) === undefined
                ? 'Enter a regular payment amount of £0 or more.'
                : activeStepIndex === STEP_COMMITMENT &&
                    bundledCommitmentAmount > 0 &&
                    commitmentDayValue === undefined
                  ? 'Enter a day from 1 to 31.'
                  : null;
  const allNumbersValid =
    incomeInputValue !== undefined &&
    balanceInputValue !== undefined &&
    (cadence !== 'monthly' || paydayInputValue !== undefined) &&
    parseManualMoney(essentialsInput, { allowZero: true }) !== undefined &&
    parseManualMoney(bufferInput, { allowZero: true }) !== undefined &&
    parseManualMoney(commitmentInput, { allowZero: true }) !== undefined &&
    (bundledCommitmentAmount === 0 || commitmentDayValue !== undefined);
  const reviewRows = [
    { label: 'Name', value: name || 'Not set', index: 0 },
    {
      label: 'Pay frequency',
      value: CADENCE_OPTIONS.find((option) => option.cadence === cadence)?.label ?? cadence,
      index: STEP_CADENCE,
    },
    {
      label: 'Payday',
      value:
        cadence === 'monthly'
          ? `Day ${paydayInput} each month`
          : cadence === 'last-working-day'
            ? 'Last working day'
            : `Last received ${new Date(`${anchorISO}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      index: STEP_PAYDAY,
    },
    { label: 'Income', value: `${money(Math.round(income * 100))} ${incomeRange.unit}`, index: 5 },
    { label: 'Current balance', value: money(Math.round(balance * 100)), index: STEP_BALANCE },
    {
      label: 'Essentials and buffer',
      value: `${money(Math.round(weeklyEssentials * 100))} / week · ${money(Math.round(desiredBuffer * 100))} protected`,
      index: STEP_ESSENTIALS,
    },
    {
      label: bundledCommitmentName || 'Regular payment',
      value: `${money(Math.round(bundledCommitmentAmount * 100))} / month${bundledCommitmentAmount > 0 ? ` · due day ${commitmentDayInput}` : ' · none included'}`,
      index: STEP_COMMITMENT,
    },
  ];
  const confirmation = (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: costsConfirmed }}
      onPress={() => setCostsConfirmed((previous) => !previous)}
      style={s.confirmation}
    >
      <Text style={s.skipLabel}>
        {costsConfirmed ? '☑' : '☐'} I’ve included my regular costs, essentials and buffer.
      </Text>
    </Pressable>
  );
  const footer = (
    <View>
      {showSummary || (!isReturning && isLast) ? confirmation : null}
      {!showSummary && numericError ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>
          {numericError}
        </Text>
      ) : null}
      {!showSummary && activeStepIndex === 1 ? (
        <Text style={s.selectedGoal}>Selected: {intentLabel}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{
          disabled: showSummary
            ? !costsConfirmed || !allNumbersValid
            : numericError !== null || (!isReturning && isLast && !costsConfirmed),
        }}
        disabled={
          showSummary
            ? !costsConfirmed || !allNumbersValid
            : numericError !== null || (!isReturning && isLast && !costsConfirmed)
        }
        onPress={showSummary ? done : handlePrimary}
        style={[
          s.primary,
          {
            marginTop: gap.xs,
            opacity: (
              showSummary
                ? !costsConfirmed || !allNumbersValid
                : numericError !== null || (!isReturning && isLast && !costsConfirmed)
            )
              ? 0.45
              : 1,
          },
        ]}
      >
        <Text style={s.primaryLabel}>
          {showSummary
            ? 'Save changes'
            : isReturning
              ? 'Review changes'
              : isLast
                ? 'Save my setup'
                : 'Next'}
        </Text>
      </Pressable>
      <View style={s.footerActions}>
        {!showSummary && (isReturning || step > 0) ? (
          <Pressable
            accessibilityRole="button"
            style={s.footerAction}
            onPress={() => {
              Keyboard.dismiss();
              isReturning ? setShowSummary(true) : setStep((previous) => Math.max(0, previous - 1));
            }}
          >
            <Text style={s.skipLabel}>Back</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" style={s.footerAction} onPress={skipForNow}>
          <Text style={s.skipLabel}>{isReturning ? 'Cancel' : 'Finish later'}</Text>
        </Pressable>
      </View>
    </View>
  );

  if (showSummary)
    return (
      <Sheet
        visible={visible}
        onClose={onClose}
        reduceMotion={reduceMotion}
        scrollKey="summary"
        footer={footer}
      >
        <Text accessibilityRole="header" style={s.headline}>
          Review your numbers
        </Text>
        <Text style={s.help}>
          Check your balance, payday and regular costs. Tap a row to change it; nothing changes
          until you save.
        </Text>
        {reviewRows.map((row) => (
          <Pressable
            key={row.index}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${row.label}`}
            onPress={() => {
              setStep(Math.max(0, visibleStepIndices.indexOf(row.index)));
              setShowSummary(false);
            }}
            style={s.summaryRow}
          >
            <Text style={s.cadenceLabel}>
              {row.label} <Text style={s.skipLabel}> · Edit</Text>
            </Text>
            <Text style={s.help}>{row.value}</Text>
          </Pressable>
        ))}
        <Text style={s.help}>
          Only numbers you add are used. Add any other bills from Plan. Cancel keeps your existing
          data unchanged.
        </Text>
      </Sheet>
    );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      reduceMotion={reduceMotion}
      scrollKey={step}
      footer={footer}
    >
      <View style={s.body}>
        {/* Progress pips — three states (active w7 accent · done w5 ink/60 · future w5 hairline). */}
        <Text style={s.selectedGoal}>
          {isReturning
            ? `Edit · ${current.eyebrow}`
            : `Step ${step + 1} of ${visibleStepIndices.length} · ${current.eyebrow}`}
        </Text>
        <View style={s.pips}>
          {visibleStepIndices.map((_, i) => (
            <ProgressPip
              key={i}
              kind={i === step ? 'active' : i < step ? 'done' : 'future'}
              palette={t}
              reduceMotion={reduceMotion}
            />
          ))}
        </View>

        {/* Eyebrow with the documented Melo mood beside it (the web rendered no Melo; the spec asks the
          port to add the mood). */}
        <View style={s.eyebrowRow}>
          <Melo mood={meloMood} size={24} grounded={false} />
          <Eyebrow tone="muted">{current.eyebrow}</Eyebrow>
        </View>

        {/* Headline — one terracotta-italic accent run carved into the Fraunces line. */}
        <Text style={s.headline} accessibilityRole="header">
          {current.head.lead}
          <Text style={s.headlineAccent}>{current.head.accent}</Text>
          {current.head.tail}
        </Text>

        {/* The per-step body — seven mutually exclusive branches, sliding on step change. */}
        <Animated.View style={{ opacity: bodyOpacity, width: '100%' }}>
          {activeStepIndex === 0 ? (
            <TextInput
              autoFocus={process.env.EXPO_PUBLIC_MELO_PARITY_CAPTURE !== 'true'}
              value={name}
              onChangeText={setName}
              placeholder={copy.onb[1].placeholder}
              placeholderTextColor={t.muted}
              style={s.nameInput}
              accessibilityLabel="Your name"
              returnKeyType="next"
            />
          ) : null}

          {/* Intent picker (BREAKS-PARITY fix) — the ten Money Modes, in the user's language. Choosing
            one sets `intentMode`, which `done()` persists via `setMoneyMode`. */}
          {!isReturning && activeStepIndex === 1 ? (
            <View style={s.fieldBlock}>
              <Text style={s.intentIntro}>
                Choose one to start. You can change this later — Melo reshapes around it.
              </Text>
              <View style={s.intentList}>
                {INTENT_OPTIONS.filter((_, index) => showMoreGoals || index < 4).map((opt) => {
                  const on = intentLabel === opt.label;
                  return (
                    <Pressable
                      key={opt.label}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${opt.modeLabel}: ${opt.label}`}
                      onPress={() => {
                        setIntentMode(opt.mode);
                        setIntentLabel(opt.label);
                      }}
                      style={({ pressed: isPressed }) => [
                        s.intentRow,
                        on ? s.intentRowActive : s.intentRowInactive,
                        isPressed ? pressed : null,
                      ]}
                    >
                      <View style={s.intentRowText}>
                        <Text style={s.intentModeLabel}>{opt.label}</Text>
                        <Text style={s.intentLabel}>{opt.modeLabel}</Text>
                      </View>
                      <View style={[s.intentDotRing, on ? s.intentDotRingActive : null]}>
                        {on ? <View style={s.intentDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showMoreGoals }}
                style={s.footerAction}
                onPress={() => setShowMoreGoals((previous) => !previous)}
              >
                <Text style={s.skipLabel}>{showMoreGoals ? 'Fewer goals' : 'More goals'}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Mode-extra follow-up (BREAKS-PARITY fix) — one slider per mode, copy from MODE_EXTRA. */}
          {!isReturning && activeStepIndex === 2 ? (
            <View style={s.fieldBlock}>
              <View style={s.valueRow}>
                <Text style={s.bigValue}>
                  {extra.unit}
                  {modeExtra.toLocaleString()}
                </Text>
              </View>
              <TextInput
                value={modeExtraInput}
                onChangeText={(raw) => {
                  setModeExtraInput(raw);
                  const parsed = parseManualMoney(raw, { allowZero: true });
                  if (parsed !== undefined) setModeExtra(parsed);
                }}
                selectTextOnFocus
                keyboardType="decimal-pad"
                style={s.amountInput}
                accessibilityLabel={`Exact ${extra.eyebrow.toLowerCase()} amount`}
              />
              <FolioSlider
                min={extra.min}
                max={extra.max}
                step={extra.step}
                value={modeExtra}
                onChange={(value) => {
                  setModeExtra(value);
                  setModeExtraInput(String(value));
                }}
                palette={t}
                accessibilityLabel={extra.eyebrow}
              />
              <Text style={s.help}>{extra.hint}</Text>
            </View>
          ) : null}

          {/* Cadence picker (new step, ahead of the day picker) — calm, jargon-free options. Choosing a
            week-based cadence swaps the next step's slider for a date pick; monthly/last-working-day
            keep the day-of-month slider (hidden for last-working-day, which needs no day input). */}
          {activeStepIndex === STEP_CADENCE ? (
            <View style={s.fieldBlock}>
              <View style={s.intentList}>
                {CADENCE_OPTIONS.map((opt) => {
                  const on = cadence === opt.cadence;
                  return (
                    <Pressable
                      key={opt.cadence}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={opt.label}
                      onPress={() => setCadence(opt.cadence)}
                      style={({ pressed: isPressed }) => [
                        s.intentRow,
                        on ? s.intentRowActive : s.intentRowInactive,
                        isPressed ? pressed : null,
                      ]}
                    >
                      <Text style={s.cadenceLabel}>{opt.label}</Text>
                      <View style={[s.intentDotRing, on ? s.intentDotRingActive : null]}>
                        {on ? <View style={s.intentDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {activeStepIndex === STEP_PAYDAY ? (
            <View style={s.fieldBlock}>
              {cadence === 'monthly' ? (
                <>
                  <View style={s.valueRow}>
                    <Text style={s.bigValue}>{paydayInput || '—'}</Text>
                    <Text style={s.unit}>of the month</Text>
                  </View>
                  <TextInput
                    value={paydayInput}
                    selectTextOnFocus
                    onChangeText={(value) => {
                      setPaydayInput(value);
                      const parsed = parseDayOfMonth(value);
                      if (parsed !== undefined && parsed >= 1 && parsed <= 31) setPayday(parsed);
                    }}
                    keyboardType="number-pad"
                    style={s.amountInput}
                    accessibilityLabel="Exact payday day of month"
                  />
                  {paydayInputValue === undefined ? (
                    <Text
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                      style={s.error}
                    >
                      Enter a day from 1 to 31.
                    </Text>
                  ) : (
                    <FolioSlider
                      min={PAYDAY_MIN}
                      max={PAYDAY_MAX}
                      step={PAYDAY_STEP}
                      value={payday}
                      onChange={(value) => {
                        setPayday(value);
                        setPaydayInput(String(value));
                      }}
                      palette={t}
                      accessibilityLabel="Payday day of the month"
                    />
                  )}
                  <Text style={s.help}>
                    For shorter months, payday falls on the last day of the month.
                  </Text>
                </>
              ) : null}

              {cadence === 'last-working-day' ? (
                <Text style={s.help}>
                  The last working day of each month — Melo works this out for you.
                </Text>
              ) : null}

              {WEEK_BASED_CADENCES.has(cadence) ? (
                <>
                  <Text style={s.help}>When did pay last arrive?</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Pick the date pay last arrived"
                    onPress={() => setShowAnchorPicker(true)}
                    style={({ pressed: isPressed }) => [s.anchorButton, isPressed ? pressed : null]}
                  >
                    <Text style={s.cadenceLabel}>
                      {new Date(`${anchorISO}T12:00:00`).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </Pressable>
                  {showAnchorPicker ? (
                    <DateTimePicker
                      value={new Date(`${anchorISO}T00:00:00`)}
                      mode="date"
                      display="default"
                      themeVariant={isDark ? 'dark' : 'light'}
                      maximumDate={new Date()}
                      onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                        setShowAnchorPicker(false);
                        if (selected) setAnchorISO(isoFromDate(selected));
                      }}
                    />
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          {activeStepIndex === 5 ? (
            <View style={s.fieldBlock}>
              <View style={s.valueRow}>
                <Text style={s.bigValue}>{poundsTabular(income)}</Text>
                <Text style={s.unit}>{incomeRange.unit}</Text>
              </View>
              <FolioSlider
                min={incomeRange.min}
                max={incomeRange.max}
                step={incomeRange.step}
                value={Math.min(incomeRange.max, Math.max(incomeRange.min, income))}
                onChange={(value) => {
                  setIncome(value);
                  setIncomeInput(String(value));
                }}
                palette={t}
                accessibilityLabel={`Rough income${incomeRange.unit}`}
              />
              <TextInput
                value={incomeInput}
                onChangeText={(value) => {
                  setIncomeInput(value);
                  const parsed = parseManualMoney(value, { allowZero: true });
                  if (parsed !== undefined) setIncome(parsed);
                }}
                keyboardType="decimal-pad"
                style={s.amountInput}
                accessibilityLabel={`Exact income${incomeRange.unit}`}
              />
              <Text style={s.help}>Doesn't need to be exact. Melo adjusts as you go.</Text>
            </View>
          ) : null}

          {activeStepIndex === STEP_BALANCE ? (
            <View style={s.fieldBlock}>
              <View style={s.valueRow}>
                <Text style={s.bigValue}>{poundsTabular(balance)}</Text>
                <Text style={s.unit}>available now</Text>
              </View>
              <FolioSlider
                min={BALANCE_MIN}
                max={BALANCE_MAX}
                step={BALANCE_STEP}
                value={Math.min(BALANCE_MAX, Math.max(BALANCE_MIN, balance))}
                onChange={(value) => {
                  setBalance(value);
                  setBalanceInput(String(value));
                }}
                palette={t}
                accessibilityLabel="Rough current account balance"
              />
              <TextInput
                value={balanceInput}
                onChangeText={(value) => {
                  setBalanceInput(value);
                  const parsed = parseManualMoney(value, { allowZero: true, allowNegative: true });
                  if (parsed !== undefined) setBalance(parsed);
                }}
                keyboardType="decimal-pad"
                style={s.amountInput}
                accessibilityLabel="Exact current account balance"
              />
              <Pressable
                accessibilityRole="button"
                style={s.footerAction}
                onPress={() => {
                  const raw = balanceInput.startsWith('-')
                    ? balanceInput.slice(1)
                    : `-${balanceInput}`;
                  setBalanceInput(raw);
                  const parsed = parseManualMoney(raw, { allowZero: true, allowNegative: true });
                  if (parsed !== undefined) setBalance(parsed);
                }}
              >
                <Text style={s.skipLabel}>
                  {balanceInput.startsWith('-')
                    ? 'Use a positive balance'
                    : 'Use a negative balance / overdraft'}
                </Text>
              </Pressable>
              <Text style={s.help}>
                Enter the balance available now, including income already received and payments
                already taken. Only numbers you add are used; you can correct them anytime.
              </Text>
            </View>
          ) : null}

          {activeStepIndex === STEP_ESSENTIALS ? (
            <View style={s.fieldBlock}>
              <View style={s.valueRow}>
                <Text style={s.bigValue}>{poundsTabular(weeklyEssentials)}</Text>
                <Text style={s.unit}>/ week essentials</Text>
              </View>
              <TextInput
                value={essentialsInput}
                selectTextOnFocus
                onChangeText={(value) => {
                  setEssentialsInput(value);
                  const parsed = parseManualMoney(value, { allowZero: true });
                  if (parsed !== undefined) setWeeklyEssentials(parsed);
                }}
                keyboardType="decimal-pad"
                style={s.amountInput}
                accessibilityLabel="Exact weekly essential living allowance"
              />
              <FolioSlider
                min={0}
                max={500}
                step={5}
                value={weeklyEssentials}
                onChange={(value) => {
                  setWeeklyEssentials(value);
                  setEssentialsInput(String(value));
                }}
                palette={t}
                accessibilityLabel="Weekly essential living allowance"
              />
              <View style={[s.valueRow, { marginTop: gap.lg }]}>
                <Text style={s.bigValue}>{poundsTabular(desiredBuffer)}</Text>
                <Text style={s.unit}>protected buffer</Text>
              </View>
              <TextInput
                value={bufferInput}
                selectTextOnFocus
                onChangeText={(value) => {
                  setBufferInput(value);
                  const parsed = parseManualMoney(value, { allowZero: true });
                  if (parsed !== undefined) setDesiredBuffer(parsed);
                }}
                keyboardType="decimal-pad"
                style={s.amountInput}
                accessibilityLabel="Exact protected cash buffer"
              />
              <FolioSlider
                min={0}
                max={1000}
                step={10}
                value={desiredBuffer}
                onChange={(value) => {
                  setDesiredBuffer(value);
                  setBufferInput(String(value));
                }}
                palette={t}
                accessibilityLabel="Protected cash buffer"
              />
              <Text style={s.help}>
                Essentials stay available until payday. The buffer can be £0 if you choose.
              </Text>
            </View>
          ) : null}

          {activeStepIndex === STEP_COMMITMENT ? (
            <View style={s.fieldBlock}>
              <TextInput
                value={bundledCommitmentName}
                onChangeText={setBundledCommitmentName}
                placeholder="For example, rent + bills"
                placeholderTextColor={t.muted}
                style={s.nameInput}
                accessibilityLabel="Recurring commitment name"
              />
              <View style={s.valueRow}>
                <Text style={s.bigValue}>{poundsTabular(bundledCommitmentAmount)}</Text>
                <Text style={s.unit}>/ month</Text>
              </View>
              <TextInput
                value={commitmentInput}
                selectTextOnFocus
                onChangeText={(value) => {
                  setCommitmentInput(value);
                  const parsed = parseManualMoney(value, { allowZero: true });
                  if (parsed !== undefined) setBundledCommitmentAmount(parsed);
                }}
                keyboardType="decimal-pad"
                style={s.amountInput}
                accessibilityLabel="Exact recurring commitment amount"
              />
              <FolioSlider
                min={0}
                max={COMMITMENT_MAX}
                step={COMMITMENT_STEP}
                value={bundledCommitmentAmount}
                onChange={(value) => {
                  setBundledCommitmentAmount(value);
                  setCommitmentInput(String(value));
                }}
                palette={t}
                accessibilityLabel="Recurring commitment amount"
              />
              <View style={s.valueRow}>
                <Text style={s.dueLabel}>Due on day</Text>
                <Text style={s.dueValue}>{commitmentDayInput || '—'}</Text>
                <Text style={s.unit}>of each month</Text>
              </View>
              <TextInput
                value={commitmentDayInput}
                selectTextOnFocus
                onChangeText={(raw) => {
                  setCommitmentDayInput(raw);
                  const parsed = parseDayOfMonth(raw);
                  if (parsed !== undefined) setBundledCommitmentDueDay(parsed);
                }}
                keyboardType="number-pad"
                style={s.amountInput}
                accessibilityLabel="Exact regular payment due day"
              />
              {commitmentDayValue === undefined ? (
                <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>
                  Enter a day from 1 to 31.
                </Text>
              ) : (
                <FolioSlider
                  min={1}
                  max={31}
                  step={1}
                  value={bundledCommitmentDueDay}
                  onChange={(value) => {
                    setBundledCommitmentDueDay(value);
                    setCommitmentDayInput(String(value));
                  }}
                  palette={t}
                  accessibilityLabel="Recurring commitment day"
                />
              )}
              <Text style={s.help}>
                In shorter months, use the last day. This records when it is due; it does not mark a
                payment as paid.
              </Text>
              <Text style={s.help}>
                One bundled payment is fine. Add separate bills later from Plan.
              </Text>
            </View>
          ) : null}

          {!isReturning && activeStepIndex === STEP_POTS ? (
            <View style={s.fieldBlock}>
              <Text style={s.potsIntro}>
                Pick any. Skip with none if you'd rather start blank — you can add later.
              </Text>
              <View style={s.potGrid}>
                {POT_TEMPLATES.map((tpl) => (
                  <PotTile
                    key={tpl.id}
                    template={tpl}
                    selected={picked.has(tpl.id)}
                    onPress={() => togglePot(tpl.id)}
                    styles={s}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </Animated.View>

        <Text style={s.footer}>
          {isReturning
            ? 'Cancel keeps everything you’ve already added unchanged.'
            : activeStepIndex === STEP_POTS
              ? 'You can add pots later. Save my setup keeps the numbers entered in these steps.'
              : 'Only numbers you add are used. Entries in these steps are saved together at the end; Finish later leaves existing data unchanged.'}
        </Text>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// ProgressPip — three states with a 400ms width + colour tween between them.
// ---------------------------------------------------------------------------

function ProgressPip({
  kind,
  palette: t,
  reduceMotion,
}: {
  kind: 'active' | 'done' | 'future';
  palette: Palette;
  reduceMotion: boolean;
}) {
  // active: w7 (28) accent · done/future: w5 (20). Animate width so the active pip grows/shrinks as
  // the step moves, matching the web transition-all on the indicator bars.
  const targetWidth = kind === 'active' ? 28 : 20;
  const width = useRef(new Animated.Value(targetWidth)).current;
  useEffect(() => {
    if (reduceMotion) {
      width.setValue(targetWidth);
      return;
    }
    const animation = Animated.timing(width, {
      toValue: targetWidth,
      duration: PROGRESS_PIP_MS,
      easing: EASE_OUT_EXPO,
      useNativeDriver: false, // width is a layout prop
    });
    animation.start();
    return () => animation.stop();
  }, [targetWidth, reduceMotion, width]);

  const backgroundColor = kind === 'active' ? t.calm : kind === 'done' ? t.ink : t.hairline;
  // The completed pip reads at ink/60 (web bg-[var(--ink)]/60).
  const opacity = kind === 'done' ? 0.6 : 1;

  return <Animated.View style={{ height: 4, borderRadius: 2, width, backgroundColor, opacity }} />;
}

// ---------------------------------------------------------------------------
// PotTile — selected = accent-soft + accent/40 ring · unselected = inset + hairline.
// ---------------------------------------------------------------------------

function PotTile({
  template,
  selected,
  onPress,
  styles: s,
}: {
  template: PotTemplate;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        s.potTile,
        selected ? s.potTileSelected : s.potTileUnselected,
        isPressed ? pressed : null,
      ]}
    >
      <Text style={s.potName}>{template.name}</Text>
      <Text style={s.potMeta}>
        {poundsTabular(template.goal)} · {poundsTabular(template.perWeek)}/wk
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// FolioSlider — a token-painted range built from View + PanResponder (no new dependency).
//
// Web parity: a thin track on --inset, a filled portion + thumb on --accent, snapping to `step`
// across [min, max]. No live value bubble — the big tabular number above is the only readout. The
// thumb tap target is padded out to >=44px tall via a transparent overlay so the row stays tap-only.
// ---------------------------------------------------------------------------

function FolioSlider({
  min,
  max,
  step,
  value,
  onChange,
  palette: t,
  accessibilityLabel,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (next: number) => void;
  palette: Palette;
  accessibilityLabel: string;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const THUMB = 22;
  const usable = Math.max(0, width - THUMB);
  const range = max - min || 1;
  const ratio = Math.min(1, Math.max(0, (value - min) / range));

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  }

  // Snap an x position (relative to the track's left edge) to the nearest stepped value.
  function valueFromX(x: number): number {
    const w = widthRef.current;
    const span = Math.max(1, w - THUMB);
    const clampedX = Math.min(span, Math.max(0, x - THUMB / 2));
    const raw = min + (clampedX / span) * range;
    const snapped = Math.round((raw - min) / step) * step + min;
    return Math.min(max, Math.max(min, snapped));
  }

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) =>
      isHorizontalSliderGesture(gesture.dx, gesture.dy),
    onPanResponderGrant: (e) => {
      onChange(valueFromX(e.nativeEvent.locationX));
    },
    onPanResponderMove: (e) => {
      onChange(valueFromX(e.nativeEvent.locationX));
    },
  });

  const thumbLeft = ratio * usable;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') {
          onChange(Math.min(max, value + step));
        } else if (event.nativeEvent.actionName === 'decrement') {
          onChange(Math.max(min, value - step));
        }
      }}
      onLayout={onLayout}
      style={sliderStyles.tapRow}
      {...responder.panHandlers}
    >
      <View style={[sliderStyles.track, { backgroundColor: t.inset }]}>
        <View
          style={[
            sliderStyles.fill,
            { backgroundColor: t.calm, width: Math.max(0, thumbLeft + THUMB / 2) },
          ]}
        />
      </View>
      <View
        style={[
          sliderStyles.thumb,
          {
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            left: thumbLeft,
            backgroundColor: t.calm,
            borderColor: t.inverse,
          },
        ]}
      />
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  fill: {
    borderRadius: 2,
    height: 4,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  tapRow: {
    height: MIN_TAP,
    justifyContent: 'center',
    width: '100%',
  },
  thumb: {
    borderWidth: 2,
    position: 'absolute',
    // vertically centred in the MIN_TAP row: (44 - 22) / 2
    top: 11,
  },
  track: {
    borderRadius: 2,
    height: 4,
    width: '100%',
  },
});

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette. Spacing/radius from kit tokens only.
// Web → kit spacing map: mt-5≈lg+xs(20) · mt-6=xl(24) · mt-3=md(12) · mt-2=sm(8) · mt-1=xs(4) ·
// mb-4=lg(16) · gap-2=sm(8) · px-2/pb-2=sm(8) · px-4=lg(16) · h-12=xxxl(48) · pip gap 1.5≈xs+xxs(6).
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    bigValue: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 40,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.8,
    },
    body: {
      paddingBottom: gap.sm,
      paddingHorizontal: gap.sm,
    },
    dueLabel: {
      color: t.muted,
      fontSize: 13,
    },
    dueValue: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 28,
      fontVariant: ['tabular-nums'],
    },
    eyebrowRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.sm,
    },
    fieldBlock: {
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
    },
    // Intent picker (BREAKS-PARITY fix) — mt-4, 3-line intro, then a scrollable row list.
    intentIntro: {
      color: t.muted,
      fontSize: 11.5,
      lineHeight: 17,
      marginBottom: gap.sm + gap.xxs,
      marginTop: gap.md,
    },
    intentList: {
      rowGap: gap.xs + gap.xxs, // web space-y-2
    },
    intentRow: {
      alignItems: 'center',
      borderRadius: radius.lg,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    intentRowActive: {
      backgroundColor: t.surface,
      borderColor: t.calm,
      borderWidth: 1,
    },
    intentRowInactive: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderWidth: StyleSheet.hairlineWidth,
    },
    intentRowText: {
      flexShrink: 1,
      paddingRight: gap.md,
    },
    intentModeLabel: {
      color: t.ink,
      fontFamily: serif.displayItalic,
      fontSize: 16,
      fontStyle: 'italic',
    },
    intentLabel: {
      color: t.muted,
      fontSize: 12,
      marginTop: 2,
    },
    intentDotRing: {
      alignItems: 'center',
      borderColor: t.hairline,
      borderRadius: 8,
      borderWidth: 1,
      height: 16,
      justifyContent: 'center',
      width: 16,
    },
    intentDotRingActive: {
      borderColor: t.calm,
    },
    intentDot: {
      backgroundColor: t.calm,
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    // Cadence picker (new step) — a single-line label reusing the intent row/dot-ring shell, no
    // subtitle so no intentRowText wrapper is needed.
    cadenceLabel: {
      color: t.ink,
      fontFamily: serif.displayItalic,
      fontSize: 16,
      fontStyle: 'italic',
    },
    // Anchor-date pick (week-based cadences) — a tappable row painted like the slider's tap target,
    // reusing --inset/--hairline so it reads as an input, not a label.
    anchorButton: {
      alignItems: 'flex-start',
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      justifyContent: 'center',
      marginTop: gap.sm,
      minHeight: gap.xxxl, // 48 — matches nameInput's h-12
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    amountInput: {
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: t.ink,
      fontSize: 14,
      marginTop: gap.sm,
      minHeight: gap.xxxl,
      paddingHorizontal: gap.lg,
    },
    footer: {
      color: t.muted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: gap.xs,
      opacity: 0.8,
      paddingHorizontal: gap.sm,
      textAlign: 'center',
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 26,
      letterSpacing: -0.5,
      lineHeight: 30,
      marginTop: gap.xs,
    },
    headlineAccent: {
      color: t.calm,
      fontFamily: serif.displayItalic,
      fontStyle: 'italic',
    },
    help: {
      color: t.muted,
      fontSize: 11.5,
      lineHeight: 17,
      marginTop: gap.md,
    },
    loadingWrap: {
      paddingVertical: gap.xl,
    },
    nameInput: {
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: t.ink,
      fontSize: 15,
      minHeight: gap.xxxl, // 48 — grows with text
      marginTop: gap.lg + gap.xs,
      paddingHorizontal: gap.lg,
    },
    pips: {
      flexDirection: 'row',
      gap: gap.xs + gap.xxs, // 6 — web gap-1.5
      marginBottom: gap.lg,
    },
    potGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.sm,
      marginTop: gap.md,
    },
    potMeta: {
      color: t.muted,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
      marginTop: gap.xxs,
    },
    potName: {
      color: t.ink,
      fontSize: 13,
      fontWeight: '500',
    },
    potTile: {
      borderRadius: radius.lg,
      // two columns: half the row minus half the gap.
      flexBasis: '48%',
      flexGrow: 1,
      paddingHorizontal: gap.md + gap.xxs, // 14 — web px-3.5
      paddingVertical: gap.md,
    },
    potTileSelected: {
      backgroundColor: t.calmSoft,
      borderColor: t.calm,
      borderWidth: 1,
    },
    potTileUnselected: {
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderWidth: StyleSheet.hairlineWidth,
    },
    potsIntro: {
      color: t.muted,
      fontSize: 12.5,
      lineHeight: 18,
    },
    primary: {
      alignItems: 'center',
      backgroundColor: t.calm,
      borderRadius: radius.lg,
      minHeight: gap.xxxl, // 48 — grows with text
      justifyContent: 'center',
      marginTop: gap.xl,
    },
    primaryLabel: {
      // The web uses literal text-white on the accent fill; t.inverse is the kit's canonical
      // on-accent knockout (white in light, canvas in dark) — same token PrimaryAction uses.
      color: t.inverse,
      fontSize: 14,
      fontWeight: '500',
    },
    skip: {
      alignItems: 'center',
      height: gap.xxxl - gap.sm, // 40 — web h-10
      justifyContent: 'center',
      marginTop: gap.sm,
    },
    skipLabel: {
      color: t.muted,
      fontSize: 12.5,
    },
    unit: {
      color: t.muted,
      fontSize: 13,
    },
    valueRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.sm,
    },
    error: { color: t.repair, fontSize: 13, lineHeight: 18, marginTop: gap.xs },
    selectedGoal: { color: t.muted, fontSize: 12, lineHeight: 17, marginBottom: gap.sm },
    confirmation: { minHeight: 48, justifyContent: 'center', paddingVertical: gap.sm },
    footerActions: { flexDirection: 'row', justifyContent: 'space-evenly' },
    footerAction: { minHeight: 48, justifyContent: 'center', paddingHorizontal: gap.lg },
    summaryRow: {
      paddingVertical: gap.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.hairline,
    },
  });
}
