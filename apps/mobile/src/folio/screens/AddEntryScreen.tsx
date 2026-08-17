// AddEntryScreen — the faithful 1:1 React Native port of the web manual-entry form
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenAddEntry.tsx).
//
// @rn-screen    AddEntryScreen
// @rn-stack     Intake > Add a bill | Add a debt
// @purpose      Single-form entry for one recurring bill or debt payment. Reused for both kinds via
//               the `kind` ("bill" | "debt") prop, which swaps the eyebrow label, the headline +
//               accent word, the name placeholder, and the frequency options.
// @reads        — (no store reads — the web @reads is an em-dash; confirmed in the spec)
// @writes       setSubs (for bills) — debts mirror to RN's own engine.
// @opens-sheet  —
// @copy         FROZEN
// @tokens       canvas (paper) · surface · hairline · calm (accent) · muted · ink — all from the kit
// @motion       slide-in-r (whole screen) · stamp on save · press 0.97 (kit `pressed`) · Melo breathe
//               + blink (from MeloLine, soft mood)
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit source):
//   • Both kinds render. The kind-dependent strings come in pairs (eyebrow, headline+accent,
//     placeholder, freq options, default freq) — never collapsed to one variant.
//   • Copy is @copy FROZEN inline literals: the web keeps these strings INLINE (the COPY_DECK `add.*`
//     keys cover the method-picker/Review flow, NOT this typed form), so they are reproduced verbatim
//     here. `copy.global.app.currency.symbol` is reused for the £ glyph so the symbol stays keyed.
//   • The accent word ("out" for bill / "payment" for debt) renders UPRIGHT in terracotta (t.calm) —
//     the web uses <em className="not-italic text-[var(--accent)]">. The headline is built from three
//     Text runs so the accent run is a nested upright calm-coloured span inside the Fraunces line. The
//     italic kicker ("One thing at a time") is a SEPARATE element and stays italic.
//   • The amount keypad logic is ported byte-for-byte from the web `onKey`: '←' deletes the last char;
//     '.' is ignored if one already exists else appends (prefixing '0' when the string is empty); max
//     two decimal places; the whole string is capped at 7 chars via .slice(0, 7). The in-screen keypad
//     IS the design — no free-form numeric TextInput is substituted, and the name TextInput is blurred
//     when a key is pressed so the OS keyboard never hides the pad.
//   • Amount is a STRING in state, displayed with a literal £ prefix; empty shows the em-dash "£—"
//     (U+2014), filled shows "£{amount}" with tabular figures so digits don't jitter as the pad updates.
//   • FIDELITY FIX (per the spec): the web 'Add it to plans' button persists NOTHING (it only
//     nav.go("plans")). This RN port builds a record from {name, amount, when, freq} and persists it —
//     setSubs for a bill, the debt mirror (tagged below) for a debt — BEFORE navigating.
//   • slide-in-r: translateX 28→0 + fade over 360ms, ease-out-expo — gated to FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring Melo's own gating.
//   • stamp on save: declared in the web @motion but unimplemented in the web body. Here it fires
//     exactly ONCE on commit — a 420ms verdict-stamp (scale overshoot → settle, back-out easing), never
//     looping — then the save proceeds. Gated to no-op under reduce-motion.
//   • STATES.md (AddEntry row): empty = n/a · loading = per-method (Melo curious + a line, never a
//     spinner; max 4s then fallback) · populated = the form · error = per-method fallback · offline =
//     "saved, will read later". All five branches render for completeness; the populated branch is the
//     real, single interactive state for this typed form. The per-method loading/fallback states belong
//     to the upstream READER flow that routes INTO this form, so they are rendered with the reader's
//     design language and the reader is tagged below.
//
// ENGINE DISCIPLINE: this screen is the manual typed path — it never reads a file, so it touches no
// reader. The text-reader (CSV/TSV/TXT → candidates) is WIRED via parseSheet on the reader screens.
// @rn-engine ocr-extraction (native PdfRenderer + ML Kit module — not built; see nativeTextExtraction.ts)
//   — the still-missing PDF-text / OCR extraction. Until it lands, a PDF / photo pick on Intake that
//   can't be read routes to the honest pdf-fallback / image-fallback, never to this form pretending it
//   parsed; this typed form stays the deliberate last-resort manual path.
// @rn-engine edit-txn — the full correction-history of an edited entry is wired later (see BUILD_PLAN §3)

import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as RNTextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { StatePanel } from '@/folio/ui/StatePanel';
import { addCalendarEvent, currentFinancialDate, setSubs, type Sub } from '@/folio/store';
import { buildDebtSchedule, type DebtCadence } from '@/folio/lib/debt';
import { anchorIsoFor, daysUntilDayOfMonth } from '@/folio/lib/renewalMath';
import type { Nav } from '@/folio/types';

// The render states this screen can occupy (STATES.md "AddEntry" row). For this typed form, the real
// interactive state is `populated`; the others are rendered for completeness and faithful to the
// matrix (loading/error are per-method and belong to the upstream reader, offline is "saved, will read
// later"). `empty` is n/a for AddEntry but is mapped to the calm doorway so no branch dead-ends.
export type AddEntryState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type AddEntryScreenProps = {
  nav: Nav;
  kind: 'bill' | 'debt';
  state?: AddEntryState;
};

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (from the spec @motion): the whole screen enters from +28px on X with a fade.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// stamp-on-save geometry — a single 420ms verdict-stamp: a quick scale overshoot then settle.
const STAMP_MS = 420;

// loading dwell cap (STATES.md "AddEntry" loading column = per-method): the curious Melo line is
// shown for at most this long, then the screen resolves to the per-method fallback — NEVER a spinner,
// never an indefinite wait. The reader engine (built later) will resolve sooner on success.
const LOADING_TIMEOUT_MS = 4000;

// The numeric keypad — 12 keys, 3-col grid. Identical to the web `keys` array (the "←" delete glyph
// is the literal U+2190 the web uses).
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '←'] as const;

// The "When" (day-of-month) options — identical to the web select.
const WHEN_OPTIONS = ['1st', '3rd', '7th', '12th', '15th', '20th', '25th', 'Last day'] as const;

// Local reduce-motion read, mirroring Melo.tsx / StartScreen.tsx exactly: read once, then subscribe.
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

// Map the keyed currency symbol so the £ glyph stays sourced from COPY_DECK, not a bare literal.
const POUND = copy.global.currency.symbol;

// Parse the keypad string ("12.5") to a number on save. Empty / lone-dot → 0.
function parseAmount(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

// Map a "When" label ("1st", "Last day") to a day-of-month (1..31; "Last day" → 31, clamped later by
// the payday-clamp engine — see BUILD_PLAN §3).
function whenToDay(when: string): number {
  if (when === 'Last day') return 31;
  const n = parseInt(when, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

// Decode a debt "How often" label into the cadence + remaining-payment count the debt engine takes.
// The debt freq options encode BOTH: "Weekly · 6 left", "Monthly · 6 left", "Monthly · 12 left".
// Pure + total — an unrecognised label degrades to a sensible monthly default rather than throwing.
// Defaults live in named constants so the fallback is explicit, not a magic number.
const DEFAULT_DEBT_CADENCE: DebtCadence = 'monthly';
const DEFAULT_DEBT_PAYMENTS_LEFT = 6;
function parseDebtFreq(freq: string): { cadence: DebtCadence; paymentsLeft: number } {
  const lower = freq.toLowerCase();
  const cadence: DebtCadence = lower.includes('weekly')
    ? 'weekly'
    : lower.includes('yearly')
      ? 'yearly'
      : lower.includes('monthly')
        ? 'monthly'
        : DEFAULT_DEBT_CADENCE;
  const leftMatch = /(\d+)\s*left/.exec(lower);
  const parsed = leftMatch ? parseInt(leftMatch[1] ?? '', 10) : NaN;
  const paymentsLeft = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DEBT_PAYMENTS_LEFT;
  return { cadence, paymentsLeft };
}

// "Today" as the active workspace's financial calendar day for the debt engine anchor.
function todayIso(): string {
  return currentFinancialDate();
}

export function AddEntryScreen({ nav, kind, state = 'populated' }: AddEntryScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // ---- form state (useState only — the web reads NO store selectors here) -------------------------
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [when, setWhen] = useState('1st');
  const [freq, setFreq] = useState(kind === 'bill' ? 'Monthly' : 'Monthly · 6 left');
  const [nameFocused, setNameFocused] = useState(false);
  const nameRef = useRef<RNTextInput>(null);

  // ---- loading dwell — after LOADING_TIMEOUT_MS in `loading`, resolve to the per-method fallback
  // (STATES.md). Declared unconditionally (before any early return) so the Rules of Hooks hold. The
  // timer only arms while `state === 'loading'`; any other state clears it and resets the flag, so a
  // re-entry into loading starts the 4s window fresh. No spinner is ever shown — just the curious line
  // until the cap, then the calm fallback.
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (state !== 'loading') {
      setLoadingTimedOut(false);
      return;
    }
    const id = setTimeout(() => setLoadingTimedOut(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [state]);

  // kind-dependent frequency options (paired, never collapsed).
  const freqOptions =
    kind === 'bill'
      ? (['Weekly', 'Monthly', 'Yearly'] as const)
      : (['Weekly · 6 left', 'Monthly · 6 left', 'Monthly · 12 left'] as const);

  // ---- keypad — byte-for-byte port of the web `onKey` ---------------------------------------------
  const onKey = (k: (typeof KEYS)[number]) => {
    // Blur the name field so the OS keyboard never rises to hide the in-screen pad.
    nameRef.current?.blur();
    setAmount((v) => {
      if (k === '←') return v.slice(0, -1);
      if (k === '.') return v.includes('.') ? v : (v || '0') + '.';
      if (v.includes('.') && (v.split('.')[1]?.length ?? 0) >= 2) return v;
      return (v + k).slice(0, 7);
    });
  };

  // ---- slide-in-r — drives the whole screen -------------------------------------------------------
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

  // ---- stamp on save — fires exactly once on commit, never loops ----------------------------------
  const stamp = useSharedValue(1);
  const stampStyle = useAnimatedStyle(() => ({ transform: [{ scale: stamp.value }] }));

  // ---- save — the FIDELITY FIX: persist BEFORE navigating -----------------------------------------
  function commit() {
    const value = parseAmount(amount);

    if (kind === 'bill') {
      // A bill is a recurring charge → a Sub. Build the record from {name, amount, when, freq} and
      // persist via setSubs. lastUsedDaysAgo / usesPerMonth start neutral. The cadence engine
      // refines these later (BUILD_PLAN §3).
      //
      // nextRenewalDaysAway seeding (2026-07-10 device-smoke fix): the old code wrote the
      // day-of-month LITERAL as the days-away count — "12th" became "due in 12 days", landing the
      // bill on a phantom calendar day for the route, the calendar, and the Bills Shield. Monthly
      // derives the honest days-to-next-occurrence; Weekly/Yearly seed one period out. The
      // date-anchor pair below (Phase-2 rebuild, 2026-07-11) makes the seed DURABLE: the anchor
      // is the real due date, and every hydration re-derives the day count from it
      // (lib/renewalMath.ts `reanchorRenewals`) so it never rots between sessions.
      const seededDaysAway =
        freq === 'Weekly'
          ? 7
          : freq === 'Yearly'
            ? 365
            : daysUntilDayOfMonth(whenToDay(when), todayIso());
      const sub: Sub = {
        name: name.trim() || 'Untitled',
        cost: value,
        nextRenewalDaysAway: seededDaysAway,
        nextRenewalISO: anchorIsoFor(seededDaysAway, todayIso()),
        ...(freq === 'Weekly'
          ? { renewalPeriodDays: 7 }
          : freq === 'Yearly'
            ? { renewalPeriodDays: 365 }
            : {}), // Monthly — calendar day-of-month roll (renewalPeriodDays undefined).
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      };
      setSubs((prev) => [...prev, sub]);
    } else {
      // A debt payment mirrors to RN's own debt engine. The "N left" in the debt freq options encodes
      // both the cadence and the remaining-payments count; the pure engine turns {name, balance, dueDay,
      // cadence, paymentsLeft} + the per-payment amount into a dated payoff schedule. Each remaining
      // payment is persisted as a manual calendar event (a dated OUTFLOW, not a posted spend), so it
      // flows into the calendar-events derivation through the same `manualEvents` path bills + sub
      // renewals use — review-before-truth: these are upcoming commitments, never auto-counted as spent.
      // @rn-engine debt-engine — persist {name, amount, dueDay, cadence, paymentsLeft} + amortization (BUILD_PLAN §3)
      const debtName = name.trim() || 'Untitled';
      const { cadence, paymentsLeft } = parseDebtFreq(freq);
      // The typed amount is the agreed per-payment instalment; the modelled balance is that instalment
      // across the remaining payments (the form captures no separate total), so the schedule clears the
      // plan exactly over `paymentsLeft` payments.
      const schedule = buildDebtSchedule(
        {
          name: debtName,
          balance: value * paymentsLeft,
          dueDay: whenToDay(when),
          cadence,
          paymentsLeft,
          amount: value,
        },
        { now: todayIso() },
      );
      for (const payment of schedule.payments) {
        addCalendarEvent({
          date: payment.date,
          kind: 'out',
          title: debtName,
          amount: -payment.amount,
          note: `Payment ${payment.index} of ${schedule.remaining}`,
        });
      }
    }

    nav.go('plans');
  }

  function onSave() {
    if (reduceMotion) {
      commit();
      return;
    }
    // verdict-stamp: a quick scale overshoot then settle, once, then commit.
    stamp.value = withSequence(
      withTiming(1.06, { duration: STAMP_MS * 0.45, easing: EASE_OUT_EXPO }),
      withTiming(1, { duration: STAMP_MS * 0.55, easing: EASE_OUT_EXPO }),
    );
    commit();
  }

  // ---- empty — n/a for AddEntry, mapped to the calm doorway so the branch never dead-ends ---------
  if (state === 'empty') {
    return (
      <StatePanel
        body="One thing at a time. Type it in when you’re ready."
        fullScreen
        kind="first-time-empty"
        primaryAction={{ label: 'Not yet', onPress: nav.back }}
        title={kind === 'bill' ? 'Add a bill' : 'Add a debt'}
      />
    );
  }

  // ---- error — per-method fallback (STATES.md). Honest copy, one clear recovery. ------------------
  // The reader couldn't read this one; it was saved as a note. The user can still type the entry in.
  if (state === 'error') {
    return (
      <StatePanel
        body="The source could not be read, but you can still add the item yourself."
        fullScreen
        kind="error"
        primaryAction={{ label: 'Type it in', onPress: nav.back }}
        title={copy.err.statement.unreadable}
      />
    );
  }

  // ---- loading — per-method: Melo curious + a calm line, NEVER a spinner (max 4s then fallback). ---
  if (state === 'loading') {
    // Past the dwell cap with no resolution → the per-method fallback (same surface as `error`):
    // honest copy, one clear recovery. Keeps the contract "never an indefinite wait".
    if (loadingTimedOut) {
      return (
        <StatePanel
          body="The read took too long. Nothing was added."
          fullScreen
          kind="error"
          primaryAction={{ label: 'Type it in', onPress: nav.back }}
          title={copy.err.statement.unreadable}
        />
      );
    }
    return (
      <StatePanel
        body="Checking the source before anything is added."
        fullScreen
        kind="loading"
        title="Melo is reading"
      />
    );
  }

  // ---- populated / offline — the real, interactive form. offline degrades gracefully: the form is
  // local-first, so it works the same; the only offline tell is the Melo line, which reassures that a
  // statement added now is "saved, will read later".
  const isOffline = state === 'offline';
  const eyebrow = kind === 'bill' ? 'Add a regular payment' : 'Add a debt';
  const placeholder = kind === 'bill' ? 'Name · e.g. Rent or Netflix' : 'Name · e.g. Klarna sofa';
  const meloText = isOffline
    ? 'Saved. I’ll read it properly when you’re back online.'
    : 'An estimate is fine. You can adjust it later.';

  return (
    <Animated.View
      style={[
        styles.screen,
        enterStyle,
        {
          backgroundColor: t.canvas,
          paddingTop: insets.top + gap.lg,
          paddingBottom: insets.bottom + gap.lg,
        },
      ]}
    >
      {/* Top bar — back glyph · eyebrow · balancing spacer. */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={16}
          onPress={nav.back}
          style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
        >
          <Text style={[styles.backGlyph, { color: t.muted }]}>←</Text>
        </Pressable>
        <Text style={[styles.eyebrow, { color: t.muted }]}>{eyebrow}</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {/* Heading block — italic kicker + Fraunces headline with ONE upright terracotta accent word. */}
      <View style={styles.headingBlock}>
        <Text style={[styles.kicker, { color: t.muted }]}>One thing at a time</Text>
        <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
          {kind === 'bill' ? 'What goes ' : "What's the "}
          <Text style={[styles.headlineAccent, { color: t.calm }]}>
            {kind === 'bill' ? 'out' : 'payment'}
          </Text>
          {kind === 'bill' ? ', and when?' : ', and how often?'}
        </Text>
      </View>

      {/* Name input — surface well, hairline, focus border in terracotta (the web focus:ring). */}
      <TextInput
        ref={nameRef}
        value={name}
        onChangeText={setName}
        onFocus={() => setNameFocused(true)}
        onBlur={() => setNameFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        style={[
          styles.nameInput,
          {
            backgroundColor: t.surface,
            color: t.ink,
            borderColor: nameFocused ? t.calm : t.hairline,
          },
        ]}
      />

      {/* Amount display card — label + the £ amount, tabular figures, terracotta, em-dash when empty. */}
      <View style={[styles.amountCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Text style={[styles.fieldLabel, { color: t.muted }]}>Amount</Text>
        <Text
          accessibilityLabel={amount ? `${POUND}${amount}` : 'No amount yet'}
          style={[styles.amountValue, { color: t.calmStrong }]}
        >
          {amount ? `${POUND}${amount}` : `${POUND}—`}
        </Text>
      </View>

      {/* When / How often — two inline select cells (label on top, value below). A tap cycles to the
          next option (an on-brand inline picker, not a stock dropdown). */}
      <View style={styles.selectRow}>
        <SelectCell
          label="When"
          value={when}
          options={WHEN_OPTIONS}
          onCycle={setWhen}
          surface={t.surface}
          hairline={t.hairline}
          mutedColor={t.muted}
          inkColor={t.ink}
        />
        <SelectCell
          label="How often"
          value={freq}
          options={freqOptions}
          onCycle={setFreq}
          surface={t.surface}
          hairline={t.hairline}
          mutedColor={t.muted}
          inkColor={t.ink}
        />
      </View>

      {/* Numeric keypad — fixed 12-key 3-col grid. The pad IS the design. */}
      <View style={styles.keypad}>
        {KEYS.map((k) => (
          <Pressable
            accessibilityLabel={k === '←' ? 'Delete last digit' : `Key ${k}`}
            accessibilityRole="button"
            key={k}
            onPress={() => onKey(k)}
            style={({ pressed: isPressed }) => [
              styles.keyButton,
              { backgroundColor: t.surface, borderColor: t.hairline },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.keyLabel, { color: t.ink }]}>{k}</Text>
          </Pressable>
        ))}
      </View>

      {/* Melo reassurance line — the inline reassurance line. The web MeloLine used mood="soft"; the RN
          MeloMood union has no 'soft', and MELO_MOODS.md maps the Add-entry reassurance/fallback surface
          to `calm`, so 'soft' resolves to the in-system `calm` mood (breathe + blink, gentle). Offline
          swaps the copy, not the mood. */}
      <View style={styles.meloLine}>
        <MeloLine mood="calm" text={meloText} />
      </View>

      {/* Primary CTA — full-width terracotta, white label. The stamp scales it once on save. */}
      <Animated.View style={stampStyle}>
        <Pressable
          accessibilityHint="Saves this entry to your plans"
          accessibilityRole="button"
          onPress={onSave}
          style={({ pressed: isPressed }) => [
            styles.primaryCta,
            { backgroundColor: t.calm },
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.primaryLabel, { color: t.accentInk }]}>Add it to plans</Text>
        </Pressable>
      </Animated.View>

      {/* Secondary / dismiss CTA — quiet, muted, backs out. */}
      <Pressable
        accessibilityRole="button"
        onPress={nav.back}
        style={({ pressed: isPressed }) => [
          styles.secondaryCta,
          isPressed ? styles.pressed : undefined,
        ]}
      >
        <Text style={[styles.secondaryLabel, { color: t.muted }]}>Not yet</Text>
      </Pressable>
    </Animated.View>
  );
}

// An inline select cell: a label on top, the current value below. Tapping cycles to the next option —
// an on-brand inline picker matching the web cell styling (transparent value, no stock dropdown chrome)
// and clearing a >=44px tap target. readonly tuples are accepted so the kind-dependent option lists fit.
function SelectCell({
  label,
  value,
  options,
  onCycle,
  surface,
  hairline,
  mutedColor,
  inkColor,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onCycle: (next: string) => void;
  surface: string;
  hairline: string;
  mutedColor: string;
  inkColor: string;
}) {
  function next() {
    const i = options.indexOf(value);
    const ni = i === -1 ? 0 : (i + 1) % options.length;
    const chosen = options[ni];
    if (chosen !== undefined) onCycle(chosen);
  }
  return (
    <Pressable
      accessibilityHint="Cycles to the next option"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityRole="button"
      onPress={next}
      style={({ pressed: isPressed }) => [
        styles.selectCell,
        { backgroundColor: surface, borderColor: hairline },
        isPressed ? styles.pressed : undefined,
      ]}
    >
      <Text style={[styles.fieldLabelSm, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.selectValue, { color: inkColor }]}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // px-7 ≈ gap.xl (24) screen inset. The form sizes to content; on small devices it can scroll inside
  // the container ScrollView (the shell hosts these screens in one).
  screen: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },

  // Top bar — back glyph · eyebrow · spacer.
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backGlyph: {
    fontSize: 20,
  },
  // 12px uppercase tracked eyebrow (web text-[12px] tracking-[0.14em] uppercase).
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  // A 20px spacer balancing the back glyph so the eyebrow stays optically centred (web w-5).
  topBarSpacer: {
    width: 20,
  },

  // mt-5 (20px) = gap.lg (16) + gap.xs (4).
  headingBlock: {
    marginTop: gap.lg + gap.xs,
  },
  // Fraunces italic kicker, 13px (web font-display italic text-[13px]).
  kicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces headline, 26px, tight leading (web font-display text-[26px] leading-tight mt-0.5).
  headline: {
    fontFamily: serif.display,
    fontSize: 26,
    letterSpacing: -0.3,
    lineHeight: 31,
    marginTop: gap.xxs,
  },
  // The accent word stays UPRIGHT (web em.not-italic) — same display face, normal style, terracotta.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },

  // mt-4 (16px) = gap.lg. surface well, hairline, rounded-xl, px-4 py-3, 14px.
  nameInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 14,
    marginTop: gap.lg,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },

  // mt-3 (12px) = gap.md. surface, hairline, rounded-2xl, px-5 py-4, row baseline-aligned.
  amountCard: {
    alignItems: 'baseline',
    borderRadius: radius.xxl,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.md,
    paddingHorizontal: gap.xl - gap.xs,
    paddingVertical: gap.lg,
  },
  // 11px uppercase tracked label (web text-[11px] tracking-[0.12em] uppercase).
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  // Money size 'xl' = 44px, Fraunces, tabular figures so digits don't jitter as the pad updates.
  amountValue: {
    fontFamily: serif.display,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },

  // mt-3 (12px) two-col grid, gap-2.5 (10px) between cells.
  selectRow: {
    columnGap: gap.md - gap.xxs,
    flexDirection: 'row',
    marginTop: gap.md,
  },
  // surface, hairline, rounded-xl, px-4 py-3. flex:1 so the two share the row evenly.
  selectCell: {
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  // 10px uppercase tracked sub-label (web text-[10px] tracking-[0.12em] uppercase).
  fieldLabelSm: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  // 13.5px medium value (web text-[13.5px] font-medium mt-0.5).
  selectValue: {
    fontSize: 13.5,
    fontWeight: '500',
    marginTop: gap.xxs,
  },

  // mt-4 (16px) = gap.lg. 3-col grid, gap-2 (8px). flexWrap with 1/3-width keys.
  keypad: {
    columnGap: gap.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: gap.lg,
    rowGap: gap.sm,
  },
  // h-11 (44px), rounded-xl, surface, hairline, Fraunces 18px. Width is computed to leave two 8px gaps
  // across three columns: (100% - 16px) / 3.
  keyButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: '31.6%',
  },
  keyLabel: {
    fontFamily: serif.display,
    fontSize: 18,
  },

  // mt-4 mb-2 around the Melo line.
  meloLine: {
    marginBottom: gap.sm,
    marginTop: gap.lg,
  },

  // Primary CTA — full width, h-[52px], rounded-2xl, terracotta, white 15px medium label.
  primaryCta: {
    alignItems: 'center',
    borderRadius: radius.xxl,
    height: 52,
    justifyContent: 'center',
    marginBottom: gap.md,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Secondary CTA — full width, h-[42px], 13px muted.
  secondaryCta: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 13,
  },

  // The kit press feel applied to inline tappables (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
