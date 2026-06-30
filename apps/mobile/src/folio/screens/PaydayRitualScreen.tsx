// PaydayRitualScreen — the faithful 1:1 React Native port of the web close-the-cycle ritual
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPaydayRitual.tsx).
//
// @rn-screen    PaydayRitualScreen
// @rn-stack     MainTabs > Today > Ritual
// @purpose      Multi-step (4-step) close-the-cycle ceremony. Computes retrospective actuals for the
//               trailing 30 days (spent, left-over/spare, lowest tight point, set-aside), walks the
//               user through them one slow step at a time with a Melo line per step, captures one
//               optional 140-char "line for next-you", and on the final step calls addCycle() to
//               record the closed cycle. Copy is FROZEN — ceremonial, slow, never rushed. nav.back /
//               "Save and finish later" both exit WITHOUT recording a cycle.
// @reads        subs, subPaused, onboarding, transactions, pots, currentBalance, potLedger, nextYouNote
// @writes       setNextYouNote (every keystroke) · addCycle (once, on the final-step CTA)
// @opens-sheet  share (~350ms after finish) — Melo chat (~1500ms after finish) is opened via
//               nav.openMelo, not a SheetId.
// @copy         FROZEN — ceremonial, slow, never rushed.
// @tokens       canvas (paper) · calm (accent) · positive · hairline · muted · ink · surface · inset
//               · inverse — all from the kit via '@/folio/theme'. No new token.
// @motion       slide-in-r (whole screen) · progress-dot width/colour tween (500ms) · count-up on the
//               stat money (money never slides) · verdict-stamp (the seal on completion) · press 0.97
//               (kit `pressed`) · Melo breathe/blink + mood-swap per step. Reduced motion = final state.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/store/copy sources):
//   • FOUR STEPS, populated happy-path is the only branch this component renders; the screen-level
//     empty branch ("Nothing to close yet") is gated upstream but rendered here for completeness via
//     EmptyState, so the surface never dead-ends if mounted with no cycle to close (STATES.md).
//   • The accent word in each headline (month / a little / squeeze / line) is rendered UPRIGHT
//     terracotta inside the Fraunces line — the web <em class="not-italic text-[accent]"> — built as
//     three Text runs so the accent run is the single coloured, non-italic span (NOT italic).
//   • RETROSPECTIVE ACTUALS are REAL store data, end to end:
//       spent     = Σ|negative txn amount| in the trailing 30 days (transactions)
//       setAside  = round(Σ potLedger DEPOSIT entries in the trailing 30 days) (potLedger)
//       spare     = route.spare      — balance on the resolved next payday (the curve's read-out)
//       tightPoint = route.tightPoint.{amount,date} — lowest projected balance + the day it lands on
//     `spare` and the tight point now come from the SAME pure money-path engine every other surface
//     uses, via the shared store→route bridge (`@/folio/lib/storeRoute`: `useRoute(now)` reactive /
//     `routeFromStore(state, now)` pure). The clock is mount-gated like TodayScreen (module-level EPOCH
//     + a `now` state) so `new Date()` never runs during the first render. See `// @rn-engine money-path`.
//   • Step 3 body now names the REAL tightest day from `route.tightPoint.date` (formatted with the same
//     `formatDayProse` Today uses), replacing the web's hardcoded "12 Jul looks tightest…" placeholder.
//     The unverifiable "two bills land that week" claim is dropped — only honest copy ships.
//   • setNextYouNote fires on EVERY keystroke (web parity) so the draft survives leave/return; note is
//     seeded from the persisted draft.
//   • addCycle is local + synchronous → finish never shows a spinner. The finish choreography (Today →
//     Share sheet at ~350ms → Melo chat at ~1500ms) is preserved, with both timers cleared on unmount
//     so neither fires after the screen is gone.
//   • verdict-stamp: a "Sealed" seal scale-overshoots in on finish (the ceremonial seal moment), once,
//     never looping; gated to its final state under reduce-motion.
//   • Progress dots tween width (20↔28) + colour over 500ms (web transition-all duration-500); a 4px
//     element's width tween is acceptable and mirrors the web cadence.
//   • Money counts up, never slides (MOTION rule) — the stat figure settles to target via useCountUp.
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring Melo + StartScreen + Review.
//   • The step-4 textarea is a multiline TextInput (autoFocus, maxLength 140, 3 lines) on an inset
//     well; KeyboardAvoidingView keeps the bottom CTAs reachable when the keyboard pops.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Tap targets are >=44px (CTAs h-58 /
// h-44; back glyph carries hitSlop). Banned visible words (import / rows / parser / extraction / OCR /
// sync / dashboard / analytics / users / 100% / bank-grade / AI-powered / smart / provenance / source
// record / indexed) are absent. Copy is VERBATIM — the ritual strings are @copy FROZEN inline literals
// (the web keeps them inline; they are not keyed in COPY_DECK, whose ritual.* keys describe a different
// older ritual). The keyed copy module exposes no matching entries, so the frozen literals are inline.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
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
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { elevation, gap, pressed, radius, serif, useCountUp, useTheme, type Palette } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { type MeloMood } from '@/folio/melo/Melo';
import {
  addCycle,
  setNextYouNote,
  useAppStore,
  type AppState,
} from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import { formatDayProse } from '@/folio/screens/today/format';
import type { Nav } from '@/folio/types';

// ---------------------------------------------------------------------------
// Constants — motion cadence + ceremony numbers, mirrored from the web original
// ---------------------------------------------------------------------------

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// The seal's signature curve — a soft overshoot (matches Review's stamp curve).
const STAMP_EASE = Easing.bezier(0.34, 1.56, 0.64, 1);

// slide-in-r geometry (web .slide-in-r): the screen enters from +28px on X with a fade, 360ms.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// Progress dot tween (web transition-all duration-500). Width 20↔28px.
const DOT_MS = 500;
const DOT_W_ACTIVE = 28; // web w-7
const DOT_W_REST = 20; // web w-5

// The seal scale-overshoot on finish (the ceremonial verdict-stamp).
const STAMP_MS = 600;

// Finish choreography — Today, then the Share sheet, then the Melo chat (web setTimeout 350 / 1500).
const SHARE_DELAY_MS = 350;
const MELO_DELAY_MS = 1500;

// The stat count-up duration (money never slides — it ticks to target).
const COUNT_MS = 700;

// The trailing-30-day window the retrospective actuals look back over.
const CYCLE_WINDOW_MS = 30 * 86_400_000;

// The note's hard cap (web maxLength 140).
const NOTE_MAX = 140;

// The Melo seed handed to the chat after a finish (web verbatim).
const MELO_SEED =
  'Cycle closed — pots topped up, note saved for next-you. Want to look at next month together?';

// The fallback line written into the closed cycle when the textarea is empty (web verbatim).
const NO_NOTE = 'No note this cycle.';

// A stable sentinel "now" for the one render before the mount-gate opens (mirrors TodayScreen). The
// route hook can't be called conditionally, so it runs against this until `now` is set; that frame's
// route result is discarded (`route = null`). Module-level so its identity never churns the memo.
const EPOCH = new Date(0);

// ---------------------------------------------------------------------------
// Money — whole-pound grouping, matching the web's `£${n.toLocaleString("en-GB")}`
// ---------------------------------------------------------------------------

// The web formats the ritual figures as whole pounds with thousands separators (e.g. "£1,234"). The
// kit's `money()` works in MINOR units and would drift the format, so this small helper reproduces the
// web's exact output for a whole-pound integer. Pure.
function poundsGrouped(whole: number): string {
  const sign = whole < 0 ? '-' : '';
  const digits = Math.abs(Math.round(whole)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}£${grouped}`;
}

// ---------------------------------------------------------------------------
// Reduced-motion read — mirrors Melo.tsx / StartScreen.tsx exactly
// ---------------------------------------------------------------------------

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

// ---------------------------------------------------------------------------
// Ledger actuals (ENGINES.md § 6 "cycle close numbers")
// ---------------------------------------------------------------------------

// The two close-day figures the money-path route does NOT supply — both are direct trailing-30-day
// ledger reads. `spare` and the tight point come from the route (see `// @rn-engine money-path` in the
// screen body), so they are intentionally absent here.
type LedgerActuals = {
  spent: number;
  setAside: number;
};

// Pure trailing-30-day ledger reads. `spent` = Σ|negative txn| in the window (transactions);
// `setAside` = Σ pot DEPOSIT entries in the window (potLedger). The trailing window is anchored to the
// injected `now` so nothing reads the clock during render — the mount-gated date is threaded in.
function computeLedgerActuals(s: AppState, now: Date): LedgerActuals {
  const cutoff = now.getTime() - CYCLE_WINDOW_MS;

  const spent = s.transactions
    .filter((tx) => tx.amount < 0 && new Date(tx.when).getTime() >= cutoff)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const setAside = Math.round(
    s.potLedger
      .filter((e) => e.kind === 'deposit' && new Date(e.at).getTime() >= cutoff)
      .reduce((sum, e) => sum + e.amount, 0),
  );

  return { spent: Math.round(spent), setAside };
}

// ---------------------------------------------------------------------------
// Step model
// ---------------------------------------------------------------------------

type StatTone = 'positive' | 'ink' | 'accent';

type RitualStep = {
  eyebrow: string;
  // The headline as its three runs: lead, the single accent word (upright terracotta), trail.
  headlineLead: string;
  headlineAccent: string;
  headlineTrail: string;
  // step 4 swaps the body for the textarea, so body is optional.
  body?: string;
  isNote?: boolean;
  stat: { label: string; value: number; tone: StatTone };
  melo: string;
  meloMood: MeloMood;
  cta: string;
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export type PaydayRitualState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PaydayRitualScreenProps = {
  nav: Nav;
  state?: PaydayRitualState;
};

export function PaydayRitualScreen({ nav, state = 'populated' }: PaydayRitualScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const [step, setStep] = useState(0);
  const [sealed, setSealed] = useState(false);

  // Mount-gate the clock (mirrors TodayScreen): defer `new Date()` to an effect so the first render
  // never reads the clock. Until `now` is set, the route runs against EPOCH and its result is
  // discarded (`route = null`); the ledger reads fall back to the same EPOCH window for that one frame.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // Store reads (the spec's @reads). `spent`/`setAside` derive from these ledger slices; `pots`
  // backs step 2's first-name list; the route (below) reads the rest of the snapshot internally.
  const transactions = useAppStore((st) => st.transactions);
  const potLedger = useAppStore((st) => st.potLedger);
  const pots = useAppStore((st) => st.pots);
  const persistedNote = useAppStore((st) => st.nextYouNote);

  // Step-4 input — seeded from the persisted draft so the user can leave and come back without losing
  // what they typed (ENGINES §7 "Cycle close note").
  const [note, setNote] = useState(persistedNote);

  // @rn-engine money-path
  // The cycle-close `spare` and tight point read the REAL route/ledger, not projections of their own:
  // the shared store→money-path bridge (`useRoute`) maps the live store onto the same pure engine
  // every other surface uses. `route.spare` is the balance on the resolved next payday; the tight
  // point is the lowest projected balance and the day it lands on. The hook can't be called
  // conditionally, so it always runs against `now ?? EPOCH`; before the mount-gate opens we discard
  // that transient result (`route = null`).
  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;

  // The two figures the route does not supply — direct trailing-30-day ledger reads, anchored to the
  // mount-gated `now` (EPOCH for the pre-gate frame, discarded the same way the route result is).
  const ledger = useMemo<LedgerActuals>(
    () => computeLedgerActuals({ transactions, potLedger } as AppState, now ?? EPOCH),
    [transactions, potLedger, now],
  );

  // The cycle-close actuals the steps + addCycle read. `spent`/`setAside` are the ledger reads; `spare`
  // and `tightPoint` are the route's read-outs (0 until the mount-gate opens — the pre-engine frame).
  const actuals = useMemo(
    () => ({
      spent: ledger.spent,
      setAside: ledger.setAside,
      spare: route ? Math.max(0, Math.round(route.spare)) : 0,
      tightPoint: route ? Math.max(0, Math.round(route.tightPoint.amount)) : 0,
    }),
    [ledger, route],
  );

  // The real tightest day, in the same prose form Today uses ("Tuesday 8"). Null until the route
  // resolves, which gates step 3's body onto an honest fallback for that single pre-engine frame.
  const tightestDayProse = route ? formatDayProse(route.tightPoint.date) : null;

  // Pot first-names for step 2's populated body — the first word of each pot that still tops up
  // (perWeek > 0), joined by ", " (web parity).
  const potFirstNames = useMemo(
    () =>
      pots
        .filter((p) => p.perWeek > 0)
        .map((p) => p.name.split(' ')[0])
        .join(', '),
    [pots],
  );

  const noted = note.trim().length > 0;

  const steps: RitualStep[] = [
    {
      eyebrow: 'Step one',
      headlineLead: 'Look at the ',
      headlineAccent: 'month',
      headlineTrail: ' just gone.',
      body: `You spent ${poundsGrouped(actuals.spent)}. Bills cleared. Lowest balance was ${poundsGrouped(actuals.tightPoint)}.`,
      stat: { label: 'Left over', value: actuals.spare, tone: 'positive' },
      melo: 'You made it through. Quietly well done.',
      meloMood: 'cheer',
      cta: 'Pay yourself first',
    },
    {
      eyebrow: 'Step two',
      headlineLead: 'Move ',
      headlineAccent: 'a little',
      headlineTrail: ' into pots.',
      body:
        actuals.setAside > 0
          ? `${potFirstNames} — ${poundsGrouped(actuals.setAside)} moved in this cycle so far. You can change any of these.`
          : 'No pot top-ups this cycle yet. Add one now if it feels right.',
      stat: { label: 'Set aside', value: actuals.setAside, tone: 'ink' },
      melo: 'Small, steady. Your future self will thank you.',
      meloMood: 'calm',
      cta: 'See the squeeze ahead',
    },
    {
      eyebrow: 'Step three',
      headlineLead: "Where's the ",
      headlineAccent: 'squeeze',
      headlineTrail: ' next month?',
      // @rn-engine money-path — the REAL tightest day comes from the route (`route.tightPoint.date`),
      // formatted with Today's `formatDayProse`. The web's hardcoded "12 Jul … two bills land that week"
      // placeholder is gone; we name the real day and drop the unverifiable bill claim. The pre-engine
      // frame (route not yet resolved) uses an honest day-agnostic line.
      body: tightestDayProse
        ? `${tightestDayProse} looks tightest. Worth knowing in advance.`
        : 'One day next month looks tightest. Worth knowing in advance.',
      stat: { label: 'Next low point', value: actuals.tightPoint, tone: 'accent' },
      melo: 'Knowing in advance is half the work.',
      meloMood: 'curious',
      cta: 'Leave a note for next-you',
    },
    {
      eyebrow: 'Step four',
      headlineLead: 'One ',
      headlineAccent: 'line',
      headlineTrail: ' for next-you.',
      isNote: true,
      stat: { label: 'Note', value: noted ? 1 : 0, tone: noted ? 'positive' : 'ink' },
      melo: noted ? 'Done. The month is wrapped up.' : 'Even a short line helps. Or skip it.',
      meloMood: noted ? 'celebrate' : 'calm',
      cta: 'Finish the review',
    },
  ];

  const current = steps[step] ?? steps[0]!;
  const isLast = step === steps.length - 1;

  // slide-in-r — drives the whole screen, resolves straight to final state under reduce-motion.
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: SLIDE_MS, easing: EASE_OUT_EXPO });
  }, [enter, reduceMotion]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * SLIDE_FROM_X }],
  }));

  // The ceremonial seal — a 600ms scale-overshoot fired once on finish, never looping.
  const sealScale = useSharedValue(0);
  const sealStyle = useAnimatedStyle(() => ({
    opacity: sealScale.value > 0 ? 1 : 0,
    transform: [{ scale: sealScale.value }, { rotate: '-8deg' }],
  }));

  // Finish choreography timers — cleared on unmount so neither fires after the screen is gone.
  const shareRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meloRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (shareRef.current) clearTimeout(shareRef.current);
      if (meloRef.current) clearTimeout(meloRef.current);
    },
    [],
  );

  function onAdvance() {
    if (!isLast) {
      setStep((x) => x + 1);
      return;
    }
    if (sealed) return;
    setSealed(true);

    // Record the closed cycle so Insights + Share have real data. addCycle clears nextYouNote and
    // keeps the latest 24 cycles internally. The close timestamp reads the clock at finish-time (an
    // event handler, not render), so it's the live close moment — distinct from the mount-gated `now`.
    const closedNow = new Date();
    addCycle({
      closedAt: closedNow.toISOString().slice(0, 10),
      label: closedNow.toLocaleString('en-GB', { month: 'long' }),
      spare: actuals.spare,
      tightPoint: actuals.tightPoint,
      setAside: actuals.setAside,
      note: note.trim() || NO_NOTE,
    });

    // The seal stamps in (gated to final state under reduce-motion).
    if (!reduceMotion) {
      sealScale.value = withSequence(
        withTiming(1.12, { duration: STAMP_MS * 0.6, easing: STAMP_EASE }),
        withTiming(1, { duration: STAMP_MS * 0.4, easing: STAMP_EASE }),
      );
    } else {
      sealScale.value = 1;
    }

    // Today → Share sheet → Melo chat, on the web's cadence. Timers are cleared on unmount.
    nav.go('today');
    shareRef.current = setTimeout(() => nav.openSheet('share'), SHARE_DELAY_MS);
    meloRef.current = setTimeout(() => nav.openMelo({ seed: MELO_SEED }), MELO_DELAY_MS);
  }

  function onNoteChange(next: string) {
    setNote(next);
    // Persist on every keystroke so the draft survives leave/return (web parity).
    setNextYouNote(next);
  }

  // empty (screen-level) — "Nothing to close yet". Gated upstream in practice; rendered here so a
  // direct mount with no cycle to close never dead-ends (STATES.md). The single CTA returns to Today.
  if (state === 'empty') {
    return (
      <EmptyState
        mood="calm"
        headline="Nothing to close yet"
        body="Your cycle wraps up at payday. Come back then and we'll close it together."
        cta={{ label: 'Back to today', onPress: () => nav.go('today') }}
      />
    );
  }

  // loading — Melo curious + a line, NEVER a spinner (hard rule + STATES.md). addCycle is local +
  // synchronous, so this is only a holding moment while the surface settles, not a finish state. The
  // pre-engine frame (`now === null`, before the mount-gate opens) shows the same branch (mirrors
  // TodayScreen's `isLoading = state === 'loading' || now === null`), so the ceremony never renders
  // with zero figures for one frame.
  if (state === 'loading' || now === null) {
    return (
      <View style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}>
        <MeloLine mood="curious" text="One quiet minute. Getting your month ready." />
      </View>
    );
  }

  // populated / offline / error — the real four-step ceremony. offline ≡ populated (local-first); a
  // direct error mount still shows the ritual so the user can close the cycle in hand.
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View
        style={[
          styles.screen,
          enterStyle,
          {
            backgroundColor: t.canvas,
            paddingTop: insets.top + gap.lg,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* The ceremony scrolls — on a short viewport the stat card + CTAs sit below the fold, and the
            step-4 textarea needs to scroll clear of the keyboard. flexGrow:1 keeps the spacer pinning
            the CTAs when there's room; keyboardShouldPersistTaps keeps the CTAs tappable mid-edit. */}
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Header — back glyph · "{n} of {total}" · animated progress dots · balancing spacer. */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [styles.backTap, isPressed ? pressed : undefined]}
          >
            <BackArrow color={t.muted} />
          </Pressable>

          <View style={styles.progress}>
            <Text
              accessibilityLabel={`Step ${step + 1} of ${steps.length}`}
              style={[styles.progressLabel, { color: t.muted }]}
            >
              {step + 1} of {steps.length}
            </Text>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dots}>
              {steps.map((_, i) => (
                <ProgressDot
                  key={i}
                  active={i === step}
                  done={i < step}
                  palette={t}
                  reduceMotion={reduceMotion}
                />
              ))}
            </View>
          </View>

          {/* Balances the back button so the progress block stays centred (web w-5 spacer). */}
          <View style={styles.headerSpacer} />
        </View>

        {/* Copy block — eyebrow · headline (with the single upright accent word) · body or textarea. */}
        <View style={styles.copyBlock}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>{current.eyebrow}</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {current.headlineLead}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>{current.headlineAccent}</Text>
            {current.headlineTrail}
          </Text>

          {current.isNote ? (
            <View style={styles.noteBlock}>
              <TextInput
                accessibilityLabel="One line for next-you"
                autoFocus
                value={note}
                onChangeText={onNoteChange}
                placeholder="One honest line — what to hold, what to watch."
                placeholderTextColor={t.muted}
                maxLength={NOTE_MAX}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={[
                  styles.noteInput,
                  { backgroundColor: t.inset, borderColor: t.hairline, color: t.ink },
                ]}
              />
              <Text style={[styles.noteCount, { color: t.muted }]}>{`${note.length}/${NOTE_MAX}`}</Text>
            </View>
          ) : (
            <Text style={[styles.body, { color: t.muted }]}>{current.body}</Text>
          )}
        </View>

        {/* Stat card — surface, hairline, soft card lift; the label + the count-up money figure. */}
        <View style={[styles.statCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          {/* The ceremonial seal — only after finish. */}
          {sealed ? (
            <Animated.View
              style={[styles.seal, sealStyle, { borderColor: t.calm }]}
              pointerEvents="none"
            >
              <Text style={[styles.sealLabel, { color: t.calm }]}>Sealed</Text>
            </Animated.View>
          ) : null}

          <Text style={[styles.statLabel, { color: t.muted }]}>{current.stat.label}</Text>
          <StatMoney
            label={current.stat.label}
            value={current.stat.value}
            tone={current.stat.tone}
            isNote={current.isNote === true}
            noted={noted}
            palette={t}
            reduceMotion={reduceMotion}
          />
        </View>

        {/* Melo line — the quiet companion; mood changes step-to-step. MeloLine adds the quotes. */}
        <View style={styles.meloBlock}>
          <MeloLine text={current.melo} mood={current.meloMood} />
        </View>

        {/* Spacer pins the CTAs to the bottom (web flex-1). */}
        <View style={styles.spacer} />

        {/* Primary CTA — advance, or finish on the last step. Coral lift via the cta elevation. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: sealed }}
          accessibilityLabel={current.cta}
          disabled={sealed}
          onPress={onAdvance}
          style={({ pressed: isPressed }) => [
            styles.primary,
            { backgroundColor: t.calm },
            sealed ? styles.primaryStamped : undefined,
            isPressed && !sealed ? pressed : undefined,
          ]}
        >
          <Text style={[styles.primaryLabel, { color: t.inverse }]}>{current.cta}</Text>
        </Pressable>

        {/* Secondary — "Save and finish later" exits WITHOUT recording a cycle. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save and finish later"
          onPress={nav.back}
          style={({ pressed: isPressed }) => [styles.secondary, isPressed ? pressed : undefined]}
        >
          <Text style={[styles.secondaryLabel, { color: t.muted }]}>Save and finish later</Text>
        </Pressable>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// StatMoney — the count-up money figure (money never slides)
// ---------------------------------------------------------------------------

// On the note step the stat is a glyph (✓ / —), not money, so it does not count up. On the other three
// steps it ticks to the target pound figure. Tone maps to the palette: positive (green) / ink / accent
// (terracotta).
function StatMoney({
  label,
  value,
  tone,
  isNote,
  noted,
  palette,
  reduceMotion,
}: {
  label: string;
  value: number;
  tone: StatTone;
  isNote: boolean;
  noted: boolean;
  palette: Palette;
  reduceMotion: boolean;
}) {
  const counted = useCountUp(value, COUNT_MS, reduceMotion);
  const color = tone === 'positive' ? palette.positive : tone === 'accent' ? palette.calm : palette.ink;

  if (isNote) {
    const glyph = noted ? '✓' : '—';
    return (
      <Text accessibilityLabel={`${label}: ${noted ? 'noted' : 'none'}`} style={[styles.statValue, { color }]}>
        {glyph}
      </Text>
    );
  }

  return (
    <Text
      accessibilityLabel={`${label}: ${poundsGrouped(value)}`}
      style={[styles.statValue, { color }]}
    >
      {poundsGrouped(counted)}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// ProgressDot — width + colour tween over 500ms (web transition-all duration-500)
// ---------------------------------------------------------------------------

function ProgressDot({
  active,
  done,
  palette,
  reduceMotion,
}: {
  active: boolean;
  done: boolean;
  palette: Palette;
  reduceMotion: boolean;
}) {
  // active: 28px accent · done: 20px ink (web ink/70) · future: 20px hairline.
  const targetWidth = active ? DOT_W_ACTIVE : DOT_W_REST;
  const targetColor = active ? palette.calm : done ? palette.ink : palette.hairline;

  const width = useSharedValue(targetWidth);
  useEffect(() => {
    if (reduceMotion) {
      width.value = targetWidth;
      return;
    }
    width.value = withTiming(targetWidth, { duration: DOT_MS, easing: EASE_OUT_EXPO });
  }, [width, targetWidth, reduceMotion]);

  const dotStyle = useAnimatedStyle(() => ({ width: width.value }));

  // Colour cross-fades by opacity on a coloured base — done dots read at the web's ~70% ink weight.
  return (
    <Animated.View
      style={[
        styles.dot,
        dotStyle,
        { backgroundColor: targetColor, opacity: done && !active ? 0.7 : 1 },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Back arrow — the web '←' glyph, drawn inline (matches Review/PdfSuccess). 20×20 user space.
// ---------------------------------------------------------------------------

function BackArrow({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M12 4 L6 10 L12 16"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M6 10 H16" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — layout-only static; colour comes from the palette at render time, the press feel and the
// CTA lift come from the kit `pressed` / `elevation` tokens (no hard-coded shadow / opacity)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  // Scroll container fills the screen; content grows to a full viewport so the flex:1 spacer keeps
  // pinning the CTAs when there's room, then scrolls when there isn't.
  scrollFlex: {
    flex: 1,
  },
  scrollBody: {
    flexGrow: 1,
  },
  // px-7 ≈ screen inset (gap.xl = 24). A flex:1 spacer pins the CTAs to the bottom.
  screen: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // Header row — back · progress · balancing spacer.
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backTap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 24,
  },
  // The progress block — "{n} of {total}" + the dots, gap-3.
  progress: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
  },
  // 10.5px uppercase, tracked, tabular, muted.
  progressLabel: {
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  // The dot row — gap-1.5.
  dots: {
    alignItems: 'center',
    columnGap: gap.xs + gap.xxs,
    flexDirection: 'row',
  },
  // h-1 rounded dots; width is animated per-dot.
  dot: {
    borderRadius: radius.pill,
    height: 4,
  },
  // Balances the 24px-min back tap so the progress block stays optically centred (web w-5).
  headerSpacer: {
    width: 20,
  },
  // mt-7 (28px) = gap.xl (24) + gap.xs (4).
  copyBlock: {
    marginTop: gap.xl + gap.xs,
  },
  // Fraunces italic eyebrow, 13px muted.
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces headline, 32px, tight line-height, mt-1.
  headline: {
    fontFamily: serif.display,
    fontSize: 32,
    lineHeight: 34,
    marginTop: gap.xs,
  },
  // The accent word stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // 14px muted, relaxed, mt-4, max-width ~320.
  body: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: gap.lg,
    maxWidth: 320,
  },
  // The step-4 note block — mt-3.
  noteBlock: {
    marginTop: gap.md,
  },
  // The textarea — inset well, hairline, rounded-xl, px-3 py-2.5, 14px. 3 lines tall.
  noteInput: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 84,
    paddingHorizontal: gap.md,
    paddingVertical: 10,
  },
  // 10.5px muted tabular counter, mt-1.
  noteCount: {
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
    marginTop: gap.xs,
    textAlign: 'right',
  },
  // Stat card — surface, hairline, 2xl radius, p-6, mt-6; relative for the absolute seal.
  statCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.xl,
    position: 'relative',
  },
  // 11px uppercase tracked muted.
  statLabel: {
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  // Money 'xl' = 44px, Fraunces, tabular; mt-1.
  statValue: {
    fontFamily: serif.display,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginTop: gap.xs,
  },
  // The "Sealed" seal — top-right pill, 2px terracotta ring, uppercase tracked label.
  seal: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: gap.md,
    paddingVertical: 4,
    position: 'absolute',
    right: gap.lg,
    top: gap.lg,
  },
  sealLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  // mt-6 around the Melo line.
  meloBlock: {
    marginTop: gap.xl,
  },
  spacer: {
    flex: 1,
  },
  // Primary CTA — full width, h-[58px], 2xl radius, terracotta fill, the kit's one lifted-action
  // elevation (the soft terracotta cta lift — iOS shadow + Android elevation, token-owned).
  primary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 58,
    justifyContent: 'center',
    ...elevation.cta,
  },
  primaryStamped: {
    opacity: 0.7,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  // Secondary — mt-2 mb-5, h-[42px], 13px muted.
  secondary: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    marginBottom: gap.lg + gap.xs,
    marginTop: gap.sm,
  },
  secondaryLabel: {
    fontSize: 13,
  },
});
