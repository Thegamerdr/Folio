// @rn-sheet     OnboardingSheet
// @purpose      Seven-step onboarding — name, intent picker (→ Money Mode), mode-specific extra
//               question, payday, income, balance, pot picker.
// @writes       setOnboarding, setMoneyMode, setBufferAmount, setCurrentBalance, setPots
// @copy         FROZEN (verbatim from '@/folio/copy/copy' + the spec's inline strings)
// @tokens       --paper (Sheet) · --accent (t.calm) · --accent-soft (t.calmSoft) ·
//               --inset (t.inset) · --hairline (t.hairline) · --ink (t.ink) · --muted-ink (t.muted)
// @motion       slide between steps · progress-pip width/colour tween · stamp on completion
//
// Faithful 1:1 RN port of the web design source
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
import {
  resetToEmpty,
  setBufferAmount,
  setCurrentBalance,
  setIncomeSources,
  setMoneyMode,
  setOnboarding,
  setPots as storeSetPots,
  useAppStore,
  type IncomeSource,
} from '@/folio/store';
import type { MoneyMode } from '@/folio/lib/modes/types';
import { isBusinessDay } from '@/folio/lib/payday';
import { monthlyEquivalent } from '@/folio/lib/driftSignals';

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

// Mode-specific follow-up step (inserted after the intent step). Only Survival/Stability's captured
// value is persisted today (their engines read `bufferAmount`); the other modes still capture the
// answer visibly and label it honestly as "for when the mode ships fully" — never silently dropped.
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
    hint: 'Folio warns before the balance dips below this.',
  },
  stability: {
    eyebrow: 'Comfort line',
    headLead: 'What balance ',
    headAccent: 'feels safe?',
    unit: '£',
    min: 0,
    max: 2000,
    step: 25,
    hint: 'Anything above this reads as safe-to-spend.',
  },
  growth: {
    eyebrow: 'Monthly pace',
    headLead: 'How much would you ',
    headAccent: 'like to save?',
    unit: '£',
    min: 0,
    max: 1500,
    step: 25,
    hint: 'A pace, not a promise. Captured for when Growth mode ships fully.',
  },
  debt: {
    eyebrow: 'The number',
    headLead: 'Roughly how much ',
    headAccent: 'is owed?',
    unit: '£',
    min: 0,
    max: 30000,
    step: 100,
    hint: 'Ballpark. Captured for when Debt mode ships fully.',
  },
  optimizer: {
    eyebrow: 'Target',
    headLead: 'How much would you like to ',
    headAccent: 'trim?',
    unit: '£',
    min: 0,
    max: 300,
    step: 5,
    hint: "Per month. Captured for when Optimizer's leak tracking ships fully.",
  },
  reset: {
    eyebrow: 'Essentials',
    headLead: 'Rough weekly ',
    headAccent: 'essentials?',
    unit: '£',
    min: 0,
    max: 400,
    step: 10,
    hint: 'Food, transport, non-negotiables. Captured for when Reset mode ships fully.',
  },
  irregular: {
    eyebrow: 'Floor',
    headLead: 'Your ',
    headAccent: 'worst month',
    unit: '£',
    min: 0,
    max: 5000,
    step: 50,
    hint: 'Captured for when Irregular income runway ships fully.',
  },
  planning: {
    eyebrow: 'Target',
    headLead: 'How much for ',
    headAccent: 'the goal?',
    unit: '£',
    min: 0,
    max: 20000,
    step: 100,
    hint: 'Captured for when Planning mode ships fully.',
  },
  household: {
    eyebrow: 'Your share',
    headLead: 'Rough share of ',
    headAccent: 'bills?',
    unit: '£',
    min: 0,
    max: 3000,
    step: 25,
    hint: 'Captured for when Household mode ships fully.',
  },
  lowVis: {
    eyebrow: 'Start rough',
    headLead: 'Guess your ',
    headAccent: 'typical monthly outgoings.',
    unit: '£',
    min: 0,
    max: 5000,
    step: 50,
    hint: "It's fine to guess. Folio sharpens this each cycle.",
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

// Income-per-occurrence slider range/unit, branched on the declared cadence (step 3, STEP_CADENCE)
// — a monthly range (£500-£8000) is honest for a monthly earner but 4x-wrong for a weekly one, so
// the captured value must stay "the per-occurrence amount for that cadence", never a monthly-sized
// number mislabelled. Mirrors the cadence branching already used at STEP_PAYDAY just above. Ranges
// are per-occurrence guesses, not derived — weekly/fortnightly/four-weekly scale roughly with the
// monthly range divided by the cadence's OCCURRENCES_PER_MONTH (driftSignals.ts), rounded to a calm
// step size; monthly/last-working-day keep the original range unchanged.
type IncomeRange = { min: number; max: number; step: number; unit: string };

const INCOME_RANGE_BY_CADENCE: Record<PayCadence, IncomeRange> = {
  monthly: { min: 500, max: 8000, step: 20, unit: '/ month' },
  'last-working-day': { min: 500, max: 8000, step: 20, unit: '/ month' },
  weekly: { min: 25, max: 2000, step: 5, unit: '/ week' },
  fortnightly: { min: 50, max: 4000, step: 10, unit: '/ 2 weeks' },
  'four-weekly': { min: 100, max: 7500, step: 20, unit: '/ 4 weeks' },
};

const STEP_SLIDE_MS = 360; // doc-block "slide between steps"
const STAMP_MS = 600; // doc-block "stamp on completion"
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const PROGRESS_PIP_MS = 400; // web transition-all duration-400
const MIN_TAP = 44; // tap-only, >=44px

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

export function OnboardingSheet({ visible, onClose, state = 'populated' }: OnboardingSheetProps) {
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
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <OnboardingFlow styles={s} palette={t} reduceMotion={reduceMotion} onClose={onClose} />
    </Sheet>
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
  const ob = useAppStore((st) => st.onboarding);
  const existingPots = useAppStore((st) => st.pots);
  const currentBalance = useAppStore((st) => st.currentBalance);
  const savedMode = useAppStore((st) => st.moneyMode ?? 'survival');
  const isDark = useIsDark();
  const savedBuffer = useAppStore((st) => st.bufferAmount ?? 100);

  const [step, setStep] = useState(0);
  const [name, setName] = useState(ob.name);
  const [payday, setPayday] = useState(ob.payday);
  const [income, setIncome] = useState(ob.monthlyIncome);
  // Pay cadence (new step, ahead of the day picker) — see lib/income.ts. Monthly is the honest
  // default: it matches every existing user's behaviour byte-for-byte until they say otherwise.
  const [cadence, setCadence] = useState<PayCadence>('monthly');
  // The income slider's range/unit branches on the declared cadence — a weekly earner's
  // per-occurrence figure lives on a much smaller scale than a monthly one (see
  // INCOME_RANGE_BY_CADENCE above). Recomputed, not stored, so it always tracks `cadence`.
  const incomeRange = useMemo(() => INCOME_RANGE_BY_CADENCE[cadence], [cadence]);
  // When the user changes cadence AFTER already having moved the income slider, clamp the captured
  // value into the new range rather than leaving a stale out-of-range number (e.g. £2400 surviving
  // a switch to weekly, where the max is £2000) — the slider itself only clamps at drag-time, so a
  // cadence change with no further drag would otherwise leave an invisible out-of-range value.
  useEffect(() => {
    setIncome((prev) => Math.min(incomeRange.max, Math.max(incomeRange.min, prev)));
  }, [incomeRange]);
  // Anchor date for the three week-based cadences — "when did pay last arrive?" Defaults to today so
  // the date picker never opens on a blank/undefined value.
  const [anchorISO, setAnchorISO] = useState<string>(todayIso());
  const [showAnchorPicker, setShowAnchorPicker] = useState(false);
  // Intent picker + mode-extra (BREAKS-PARITY fix) — MONEY_MODES.md § 3 — user-declared intent maps
  // to a Money Mode, stored explicitly (never silently switched later). `modeExtra` is the mode's
  // follow-up captured value; only Survival/Stability's is persisted today (see `done()` below).
  const [intentMode, setIntentMode] = useState<MoneyMode>(savedMode);
  const [modeExtra, setModeExtra] = useState<number>(savedBuffer);
  // Pre-seed from the existing balance unless it's still the sample, in which case start blank so the
  // user feels they're entering it fresh (spec BALANCE SEED LOGIC).
  const [balance, setBalance] = useState<number>(
    currentBalance.source === 'sample' ? 0 : currentBalance.amount,
  );
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

  function done() {
    // CLEAN SLATE on completion — finishing onboarding (the primary "make them yours" path) takes
    // the app OUT of the demo REGIME and into a genuinely empty app ready for the user's real data.
    // The sample (demo transactions/subs/cycles/pots/balance) was a PRE-ONBOARDING preview only;
    // it must NOT persist once the user has chosen to begin. `resetToEmpty` wipes every demo slot,
    // sets the balance to a neutral £0, and forces onboarding.done true (so the sample-numbers nudge
    // is gone and no demo number lingers). We then write the user's real values on top of that empty
    // state. This is the ONLY place the demo→clean transition happens; "Skip for now" never runs it,
    // so skipping is an explicit, deliberate choice to KEEP exploring the sample.
    resetToEmpty();

    // Legacy day-of-month equivalent — kept alive for anything not yet swept onto `incomeSources`
    // (see lib/income.ts doc-block). Monthly/last-working-day earners already have an honest
    // day-of-month; week-based cadences use the day-of-month their anchor date falls on, which is the
    // nearest honest single-number equivalent of "when pay lands" for a legacy reader.
    const legacyPayday =
      cadence === 'monthly'
        ? payday
        : cadence === 'last-working-day'
          ? lastWorkingDayOfMonthNumber()
          : dayOfMonthFromIso(anchorISO);

    // Legacy monthly-equivalent — `onboarding.monthlyIncome` is read by name as a MONTHLY figure by
    // several surfaces that haven't yet migrated to `selectMonthlyIncome`/`incomeSources` (see
    // lib/income.ts doc-block). `income` above is the per-occurrence amount at the declared cadence
    // (e.g. a weekly earner's per-week figure), so writing it verbatim into a slot named
    // "monthlyIncome" would understate a weekly/fortnightly/four-weekly earner's real monthly total
    // by ~4x/2x/etc. `monthlyEquivalent` (driftSignals.ts) puts it on the correct monthly footing —
    // the same cadence table `selectMonthlyIncome` and the drift-detection engine already use, so
    // this legacy slot and the modern selector never diverge.
    const monthlyIncomeEquivalent = monthlyEquivalent(income, cadence);

    // The user's real onboarding identity, written over the clean state. `resetToEmpty` preserved the
    // prior (still-blank) onboarding fields and flipped done→true; this overwrites name/payday/income
    // with what they entered while keeping done true.
    setOnboarding({
      name,
      payday: legacyPayday,
      monthlyIncome: monthlyIncomeEquivalent,
      done: true,
    });

    // The income-cadence model (lib/income.ts) — the FIRST declared source, correctly cadenced. Every
    // caller downstream (calendarEvents, storeRoute, notifications, the widget) reads this instead of
    // re-deriving payday math, so a weekly/fortnightly/four-weekly/last-working-day earner gets correct
    // "next payday" math everywhere, not just the legacy single-lump approximation above.
    const incomeSource: IncomeSource = {
      id: 'income-onboarding-pay',
      label: 'Pay',
      cadence,
      amount: income,
      source: 'onboarding',
      ...(cadence === 'monthly' ? { dayOfMonth: payday } : {}),
      ...(WEEK_BASED_CADENCES.has(cadence) ? { anchorISO } : {}),
    };
    setIncomeSources([incomeSource]);

    // The user's declared intent → Money Mode (BREAKS-PARITY fix — the root cause: without this,
    // every RN user onboarded into the default mode and no mode-driven copy anywhere in the app
    // could ever show correctly). Persist the mode-extra value only for the modes whose engines
    // actually read it today (Survival/Stability read `bufferAmount`); other modes still capture the
    // answer on-screen so the copy stays honest, but nothing is written for them yet.
    setMoneyMode(intentMode);
    if (intentMode === 'survival' || intentMode === 'stability') {
      setBufferAmount(modeExtra);
    }

    // Write the balance the user just entered with an honest source label (ENGINES.md §6). If they
    // left it at £0, `resetToEmpty`'s neutral £0 (user-entered/rough) already stands — no demo balance
    // survives either way.
    if (balance > 0) {
      setCurrentBalance({ amount: balance, source: 'user-entered', confidence: 'rough' });
    }

    // The pots the user picked, created fresh at £0 saved. The app is now empty, so there are no prior
    // saved amounts to carry — every chosen pot is a brand-new, honestly-zero set-aside the user will
    // fund themselves. Picking none leaves Pots genuinely empty (its empty state invites the first one).
    const nextPots = POT_TEMPLATES.filter((tpl) => picked.has(tpl.id)).map((tpl) => ({
      id: tpl.id,
      name: tpl.name,
      saved: 0,
      goal: tpl.goal,
      perWeek: tpl.perWeek,
      accent: tpl.accent,
    }));
    if (nextPots.length > 0) storeSetPots(nextPots);
    onClose();
  }

  // The mode-extra step's copy for the currently-picked intent mode.
  const extra = MODE_EXTRA[intentMode];

  // Typed as a fixed 8-tuple so `steps[0]` is known-defined under noUncheckedIndexedAccess (BREAKS-
  // PARITY fix — restores the web's intent-picker + mode-extra steps; RN previously skipped both,
  // so `setMoneyMode` never fired during onboarding). A cadence step was inserted ahead of the day
  // picker (extends beyond the Lovable design — the web has no cadence UI). STEP_INDEX below
  // documents each index.
  const steps: readonly [Step, Step, Step, Step, Step, Step, Step, Step] = [
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
    { eyebrow: 'Pots', head: { lead: 'What are you ', accent: 'saving for?', tail: '' } },
  ];
  // Step indices — mirror the `steps` array above. 0 Hello · 1 intent picker · 2 mode-extra ·
  // 3 cadence · 4 payday-day/anchor · 5 income · 6 balance · 7 pots.
  const STEP_CADENCE = 3;
  const STEP_PAYDAY = 4;
  const STEP_POTS = 7;
  // `step` is always a valid index (0..7) — the `?? steps[0]` is a defensive fallback that satisfies
  // noUncheckedIndexedAccess; it is never reached at runtime.
  const current = steps[step] ?? steps[0];
  const isLast = step === steps.length - 1;
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
  const bodyTranslateX = slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [-24, 0, 24] });

  // Stamp on completion — a 600ms back-out scale pulse on the primary button as `done()` fires,
  // then close. Under reduce-motion it is a no-op and we close immediately.
  const stamp = useRef(new Animated.Value(1)).current;
  function handlePrimary() {
    if (!isLast) {
      setStep((x) => x + 1);
      return;
    }
    if (reduceMotion) {
      done();
      return;
    }
    Animated.sequence([
      Animated.timing(stamp, { toValue: 0.94, duration: 0, useNativeDriver: true }),
      Animated.timing(stamp, {
        toValue: 1.04,
        duration: STAMP_MS * 0.55,
        easing: EASE_OUT_EXPO,
        useNativeDriver: true,
      }),
      Animated.timing(stamp, {
        toValue: 1,
        duration: STAMP_MS * 0.45,
        easing: EASE_OUT_EXPO,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) done();
    });
  }

  return (
    <View style={s.body}>
      {/* Progress pips — three states (active w7 accent · done w5 ink/60 · future w5 hairline). */}
      <View style={s.pips}>
        {steps.map((_, i) => (
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
      <Animated.View style={{ transform: [{ translateX: bodyTranslateX }] }}>
        {step === 0 ? (
          <TextInput
            autoFocus
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
        {step === 1 ? (
          <View style={s.fieldBlock}>
            <Text style={s.intentIntro}>
              Choose one to start. You can change this later — Melo reshapes around it.
            </Text>
            <View style={s.intentList}>
              {INTENT_OPTIONS.map((opt) => {
                const on = intentMode === opt.mode;
                return (
                  <Pressable
                    key={opt.label}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${opt.modeLabel}: ${opt.label}`}
                    onPress={() => setIntentMode(opt.mode)}
                    style={({ pressed: isPressed }) => [
                      s.intentRow,
                      on ? s.intentRowActive : s.intentRowInactive,
                      isPressed ? pressed : null,
                    ]}
                  >
                    <View style={s.intentRowText}>
                      <Text style={s.intentModeLabel}>{opt.modeLabel}</Text>
                      <Text style={s.intentLabel}>{opt.label}</Text>
                    </View>
                    <View style={[s.intentDotRing, on ? s.intentDotRingActive : null]}>
                      {on ? <View style={s.intentDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Mode-extra follow-up (BREAKS-PARITY fix) — one slider per mode, copy from MODE_EXTRA. */}
        {step === 2 ? (
          <View style={s.fieldBlock}>
            <View style={s.valueRow}>
              <Text style={s.bigValue}>
                {extra.unit}
                {modeExtra.toLocaleString()}
              </Text>
            </View>
            <FolioSlider
              min={extra.min}
              max={extra.max}
              step={extra.step}
              value={modeExtra}
              onChange={setModeExtra}
              palette={t}
              accessibilityLabel={extra.eyebrow}
            />
            <Text style={s.help}>{extra.hint}</Text>
          </View>
        ) : null}

        {/* Cadence picker (new step, ahead of the day picker) — calm, jargon-free options. Choosing a
            week-based cadence swaps the next step's slider for a date pick; monthly/last-working-day
            keep the day-of-month slider (hidden for last-working-day, which needs no day input). */}
        {step === STEP_CADENCE ? (
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

        {step === STEP_PAYDAY ? (
          <View style={s.fieldBlock}>
            {cadence === 'monthly' ? (
              <>
                <View style={s.valueRow}>
                  <Text style={s.bigValue}>{String(payday)}</Text>
                  <Text style={s.unit}>of the month</Text>
                </View>
                <FolioSlider
                  min={PAYDAY_MIN}
                  max={PAYDAY_MAX}
                  step={PAYDAY_STEP}
                  value={payday}
                  onChange={setPayday}
                  palette={t}
                  accessibilityLabel="Payday day of the month"
                />
              </>
            ) : null}

            {cadence === 'last-working-day' ? (
              <Text style={s.help}>
                The last working day of each month — Folio works this out for you.
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
                  <Text style={s.bigValue}>{anchorISO}</Text>
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

        {step === 5 ? (
          <View style={s.fieldBlock}>
            <View style={s.valueRow}>
              <Text style={s.bigValue}>{poundsTabular(income)}</Text>
              <Text style={s.unit}>{incomeRange.unit}</Text>
            </View>
            <FolioSlider
              min={incomeRange.min}
              max={incomeRange.max}
              step={incomeRange.step}
              value={income}
              onChange={setIncome}
              palette={t}
              accessibilityLabel={`Rough income${incomeRange.unit}`}
            />
            <Text style={s.help}>Doesn't need to be exact. Folio adjusts as you go.</Text>
          </View>
        ) : null}

        {step === 6 ? (
          <View style={s.fieldBlock}>
            <View style={s.valueRow}>
              <Text style={s.bigValue}>{poundsTabular(balance)}</Text>
              <Text style={s.unit}>roughly</Text>
            </View>
            <FolioSlider
              min={BALANCE_MIN}
              max={BALANCE_MAX}
              step={BALANCE_STEP}
              value={balance}
              onChange={setBalance}
              palette={t}
              accessibilityLabel="Rough current account balance"
            />
            <Text style={s.help}>
              Your guess is fine. Folio uses this as the starting point — every number you'll see is
              anchored here, not a sample.
            </Text>
          </View>
        ) : null}

        {step === STEP_POTS ? (
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

      {/* Primary — "Next" (steps 1-4) then "Begin quietly" (last step). Stamps on completion. */}
      <Animated.View style={{ transform: [{ scale: stamp }] }}>
        <Pressable
          accessibilityRole="button"
          onPress={handlePrimary}
          style={({ pressed: isPressed }) => [s.primary, isPressed ? pressed : null]}
        >
          <Text style={s.primaryLabel}>{isLast ? 'Begin quietly' : 'Next'}</Text>
        </Pressable>
      </Animated.View>

      {/* Skip ≠ finished — leave onboarding.done false so the sample-numbers nudge stays and Today
          doesn't read an empty name as the user's real name (spec SKIP ≠ DONE). The ONLY action is
          onClose(); it must never call setOnboarding done:true. */}
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        // Visual height stays the web's 40 (h-10); hitSlop extends the touch area to >=44px tall so
        // the row meets the tap-target minimum without changing the faithful vertical rhythm (same
        // technique Melo uses for small glyphs).
        hitSlop={{ top: 2, bottom: 2 }}
        style={({ pressed: isPressed }) => [s.skip, isPressed ? pressed : null]}
      >
        <Text style={s.skipLabel}>Skip for now</Text>
      </Pressable>
      <Text style={s.footer}>
        Skipping keeps sample numbers on Today. Folio works honestly once these are yours.
      </Text>
    </View>
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

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        onChange(valueFromX(e.nativeEvent.locationX));
      },
      onPanResponderMove: (e) => {
        onChange(valueFromX(e.nativeEvent.locationX));
      },
    }),
  ).current;

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
    footer: {
      color: t.muted,
      fontSize: 10.5,
      lineHeight: 15,
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
      height: gap.xxxl, // 48 — web h-12
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
      height: gap.xxxl, // 48 — web h-12
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
      gap: gap.sm,
    },
  });
}
