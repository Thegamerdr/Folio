// @rn-engine money-path-bills — the dated bills/debt/renewal list + "set aside" total + next-payday
//   marker (this screen's real data spine) now come from the REAL derived engines:
//     • the dated list = `deriveCalendarEvents` (@/folio/lib/calendarEvents) "out" events (recurring
//       bills + subscription renewals + pot top-ups — everything genuinely spoken for) that fall on
//       or before the next payday, each turned into a dated row;
//     • the "Set aside" total = the sum of those out-events' magnitudes;
//     • the next-payday marker = the engine's resolved payday (the `payday` "in" event's date),
//       which `deriveCalendarEvents` resolves through `resolvePayday` (Feb-31 clamp + weekend shift),
//       the same date `routeFromStore`/`useRoute` give `daysToPayday` from.
//   The shared store→money-path bridge `useRoute(now)` (@/folio/lib/storeRoute) ties this screen to
//   the same curve every other surface reads. A debt installment is a real kind in the render, but
//   the derivation engine carries no debt source yet, so no debt row is invented — bills/subs/pots
//   are bills, and the `kind === 'debt'` branch lights up honestly once a debt model exists.
//
// PlansScreen — the faithful 1:1 React Native port of the web "What's coming before payday" screen
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPlans.tsx).
//
// @rn-screen    PlansScreen
// @rn-stack     More > Plans
// @purpose      What's already spoken for before next payday — a read-only forward look at money
//               between now and payday: upcoming renewals (and, once the engine lands, bills + a debt
//               installment) shown as a dated list, with a "Set aside" total, a next-payday marker,
//               two add CTAs (a bill / a debt), and a closing Melo line.
// @reads        subs · subPaused · subOverrides · onboarding · pots · calendarEvents (via the shared
//               `useRoute` bridge + `deriveCalendarEvents`) — the doc-block @reads contract.
// @writes       — (navigation only: nav.back / nav.go('add-bill') / nav.openSheet('declare-debt');
//               tapping a row opens the route-detail sheet via nav.openSheet, honouring @opens-sheet).
// @opens-sheet  route-detail
// @copy         FROZEN — the web prototype used INLINE literals (none are keyed in COPY_DECK yet), so
//               every visible string here is a frozen inline literal taken VERBATIM from the source.
//               No banned word (import / rows / parser / extraction / OCR / sync / dashboard /
//               analytics / users / 100% / bank-grade / AI-powered / smart / provenance / source
//               record / indexed) appears, and no privacy/security claim is made.
// @tokens       surface · hairline · calm (accent) · muted · caution · repair (negative) · ink ·
//               canvas (paper) — all from the kit via '@/folio/theme'. No new token.
// @motion       slide-in-r (whole screen, 28px→0 + fade, 360ms ease-out-expo) · press 0.97 on the back
//               glyph, both CTAs, and each upcoming row · Melo breathe/blink via the closing MeloLine
//               (mood calm — the web's 'soft' alias normalises to calm on the canonical Melo
//               vocabulary). No count-up (Money renders static strings here). Every motion collapses
//               to its FINAL STATE under reduce-motion.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit / store / sibling screens):
//   • DATA IS REAL, NOT THE DEMO LITERALS. The web prototype hardcoded six upcoming items, a £959
//     total, and a "25 Jul" payday. The spec's #1 fidelity risk is copying those literals. So the
//     upcoming list is GENERATED from the real derived timeline (`deriveCalendarEvents`): every "out"
//     event (recurring bills + subscription renewals + pot top-ups) on or before the next payday
//     becomes a dated row, the total is summed from that real list, and the payday marker is the
//     engine-resolved payday (the derived `payday` event's date). Paused subs are excluded by the
//     engine (subPaused contract); the same `now` feeds `useRoute`, so the list, the total, and
//     `daysToPayday` all read one consistent curve.
//   • MONEY IS REAL MONEY. formatGBP is the web's exact pure function (Intl en-GB, 0 fraction digits,
//     U+2212 minus). It is reproduced locally — NOT the kit's money(), which uses a hyphen-minus — so
//     the en-dash glyph and tabular alignment match the web byte-for-byte (spec fidelityRisk).
//   • Money primitive → a tabular Fraunces <Text>. size sm = 15px, lg = 28px; tone negative paints
//     t.repair (web --negative), default ink paints t.ink. font-medium, tabular nums (spec rnPrimitiveMap).
//   • EMPTY STATE ADDED. STATES.md mandates "No plans yet" but the prototype never rendered it. When
//     nothing is spoken for before payday, the EmptyState primitive (Melo calm + Fraunces accent line
//     + body) renders — a calm doorway, never an error.
//   • ROW TAP → route-detail. @opens-sheet declares route-detail but the prototype wired no handler;
//     per the spec's recommendation each upcoming row is tappable and calls nav.openSheet('route-detail').
//   • KIND BAR. debt → caution-gold vertical bar (t.caution); bill/renewal → t.repair at 60% opacity
//     (web bg-[--negative]/60). The one conditional in the JSX, preserved.
//   • MELO MOOD reconciled to the canonical vocabulary: the closing MeloLine's web mood 'soft'
//     normalises to 'calm'. Loading shows Melo curious + a line (hard rule: never a spinner).
//   • letterSpacing converted from em to absolute px per font size (web 0.14em@12px≈1.7, 0.12em@11px≈1.3,
//     0.12em@10px≈1.2) — RN letterSpacing is px, not em (spec fidelityRisk).
//   • Hairlines are an explicit 1px (web uses a 1px border + 1px dividers; StyleSheet.hairlineWidth is
//     thinner and reads weaker) — borderWidth:1 with t.hairline. Inter-row dividers are per-row top
//     borders (skip first), reproducing the web divide-y.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. The web slide-in-r / press feels are
// mirrored from PotsScreen / ReviewScreen.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { elevation, gap, radius, serif, useTheme, type Palette } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { ScreenHeader } from '@/folio/ui/ScreenHeader';
import { useAppStore } from '@/folio/store';
import { useRoute } from '@/folio/lib/storeRoute';
import { deriveCalendarEvents, type DerivedEvent } from '@/folio/lib/calendarEvents';
import type { Nav } from '@/folio/types';

// ---------------------------------------------------------------------------
// formatGBP — the web's exact pure function (folio kit). Signed, Intl en-GB, no
// fraction digits, U+2212 MINUS SIGN (not a hyphen) so tabular figures align and
// the glyph matches the web byte-for-byte. Reproduced locally rather than using
// the kit's money() (which emits a hyphen-minus).
// ---------------------------------------------------------------------------
function formatGBP(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}£${Math.abs(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

// The en-dash minus glyph used in the per-row "−£{amount}" template (web literal '−£').
const MINUS = '−';

// ---------------------------------------------------------------------------
// Money — the web <Money> primitive: a tabular Fraunces figure. Only the sizes /
// tones this screen uses are mapped (sm/lg · negative/ink) — faithful to the web.
// ---------------------------------------------------------------------------
const MONEY_SIZE = { sm: 15, lg: 28 } as const;

function Money({
  value,
  size,
  tone = 'ink',
  t,
}: {
  value: string;
  size: 'sm' | 'lg';
  tone?: 'ink' | 'negative';
  t: Palette;
}) {
  const color = tone === 'negative' ? t.repair : t.ink;
  return (
    <Text style={[styles.money, { fontSize: MONEY_SIZE[size], color }]} numberOfLines={1}>
      {value}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Upcoming item — the dated forward-look row (the web's `upcoming[]` shape).
// `day` / `month` are the split date parts ("12" / "Jul"); `kind` drives the bar.
// ---------------------------------------------------------------------------
type UpcomingKind = 'bill' | 'debt';
type Upcoming = {
  id: string;
  day: string;
  month: string;
  name: string;
  amount: number;
  kind: UpcomingKind;
  note: string;
};

// The render states this screen can occupy (spec stateBranches). The list is derived from the store +
// the pure engines, so the only real transient is the one-frame mount-gate (before `now` is set),
// which shows the loading branch: Melo curious + a line, never a spinner. Error shows an inline retry;
// offline ≡ populated (local-first, no network language).
export type PlansState = 'populated' | 'empty' | 'loading' | 'error' | 'offline';

export type PlansScreenProps = {
  nav: Nav;
  /** Force a render state (defaults to deriving from the live upcoming list). Exposed for the shell +
   *  tests, mirroring PotsScreen. */
  state?: PlansState;
};

// slide-in-r geometry (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms,
// on the editorial ease-out-expo. Mirrors PotsScreen / ReviewScreen / Melo.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// A stable sentinel "now" for the one render before the mount-gate opens. `useRoute` can't be called
// conditionally, so it runs against this until `now` is set; the result is discarded (`route = null`)
// that frame. Module-level so its identity never churns the hook's memo. Mirrors TodayScreen.
const EPOCH = new Date(0);

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Parse a derived event's ISO day ("YYYY-MM-DD") into its split date parts ("12" / "Jul"). The
// engine works in ISO/UTC; we read the calendar parts straight off the string so the displayed day
// matches the engine's day exactly (no local-tz drift from re-parsing through a Date).
function splitIsoDay(iso: string): { day: string; month: string } {
  const [, m = '', d = ''] = iso.split('-');
  const monthIdx = Number(m) - 1;
  return { day: String(Number(d)), month: MONTH_SHORT[monthIdx] ?? '' };
}

// Build the upcoming list from the REAL derived timeline. Every "out" event the calendar engine
// derives (recurring bills + subscription renewals + pot top-ups — money genuinely spoken for) that
// lands on or before the next payday becomes a dated row, in the engine's date order. Paused subs are
// already excluded by `deriveCalendarEvents` (subPaused contract). The engine carries no debt source
// yet, so every row is a `bill`; the render's `debt` branch stays intact for when one lands. Pure —
// takes the derived events + the resolved payday ISO.
function buildUpcoming(events: readonly DerivedEvent[], paydayIso: string | null): Upcoming[] {
  return events
    .filter((e) => e.kind === 'out' && typeof e.amount === 'number')
    .filter((e) => paydayIso === null || e.date <= paydayIso)
    .map((e) => {
      const { day, month } = splitIsoDay(e.date);
      return {
        id: e.id,
        day,
        month,
        name: e.title,
        amount: Math.round(Math.abs(e.amount ?? 0)),
        kind: 'bill' as const,
        note: e.note ?? (e.recurring === 'monthly' ? 'monthly' : ''),
      };
    });
}

// The next-payday marker label — "Payday · 25 Jul" (web literal shape), from the engine-resolved
// payday ISO (the derived `payday` event's date, already clamped + weekend-shifted by `resolvePayday`).
function paydayLabel(paydayIso: string | null): string {
  if (paydayIso === null) return 'Payday';
  const { day, month } = splitIsoDay(paydayIso);
  return `Payday · ${day} ${month}`;
}

// Local reduce-motion read, mirroring PotsScreen / ReviewScreen / Melo: read once, then subscribe.
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

export function PlansScreen({ nav, state }: PlansScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Real store reads — the slices the derived timeline depends on (subs · subPaused · subOverrides ·
  // onboarding · pots · manual calendarEvents). The route's own inputs are read inside `useRoute`.
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const subOverrides = useAppStore((st) => st.subOverrides);
  const onboarding = useAppStore((st) => st.onboarding);
  const pots = useAppStore((st) => st.pots);
  const calendarEvents = useAppStore((st) => st.calendarEvents);
  // Demo example bills only while the seed is untouched; a cleared/real user sees only their own.
  const includeSampleBills = useAppStore((st) => st.currentBalance.source === 'sample');

  // Mount-gate the clock (mirrors TodayScreen): defer `new Date()` to an effect so nothing reads the
  // wall clock during the first render. Until it opens, the screen holds the loading branch.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // The shared store→money-path bridge — same curve every surface reads. The hook can't be called
  // conditionally, so it always runs against `now ?? EPOCH`; before the mount-gate opens we discard
  // that transient result (`route = null`). `daysToPayday` (and the resolved payday it implies) come
  // from here; the dated list + the marker date come from `deriveCalendarEvents`, which resolves the
  // SAME payday through `resolvePayday` (and the same `now`), so the two never disagree.
  const routeResult = useRoute(now ?? EPOCH);
  const route = now ? routeResult : null;

  // The real derived timeline — bills + sub renewals + pot top-ups, payday, deadlines, reviews. We
  // read its "out" events (money spoken for) and its `payday` event (the next-payday marker date).
  const events = useMemo<DerivedEvent[]>(
    () =>
      now
        ? deriveCalendarEvents({
            subs,
            subPaused,
            subOverrides,
            onboarding,
            manualEvents: calendarEvents,
            pots,
            now,
            includeSampleBills,
          })
        : [],
    [now, subs, subPaused, subOverrides, onboarding, calendarEvents, pots, includeSampleBills],
  );

  // The engine-resolved next payday — the first derived `payday` event's ISO date. `deriveCalendarEvents`
  // resolves it through the SAME `resolvePayday` (Feb-31 clamp + weekend shift) that `routeFromStore`
  // uses for the curve, off the SAME `now`, so this date is exactly `now + route.daysToPayday`. We
  // take the engine's ISO directly (no local→UTC reconstruction, which would drift), and only trust it
  // once the route has computed (the mount-gate is open and a real curve exists). Drives the marker
  // and bounds the upcoming list, so the list, the total, and the marker stay tied to Today's curve.
  const paydayIso = useMemo(
    () => (route ? (events.find((e) => e.source === 'payday')?.date ?? null) : null),
    [route, events],
  );

  const upcoming = useMemo(() => buildUpcoming(events, paydayIso), [events, paydayIso]);
  const total = useMemo(() => upcoming.reduce((sum, u) => sum + u.amount, 0), [upcoming]);
  const payday = useMemo(() => paydayLabel(paydayIso), [paydayIso]);

  const resolvedState: PlansState =
    state ?? (now === null ? 'loading' : upcoming.length === 0 ? 'empty' : 'populated');

  // slide-in-r — drives the whole screen. Resolves straight to final state under reduce-motion.
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

  // ── LOADING ────────────────────────────────────────────────────────────────────────────────────
  // The list is synchronous, so this is defensive only. Melo curious + a line, NEVER a spinner.
  if (resolvedState === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxxl }]}
      >
        <MeloLine mood="curious" text="One second — looking at what's coming." />
      </View>
    );
  }

  // ── EMPTY ──────────────────────────────────────────────────────────────────────────────────────
  // Nothing spoken for before payday → the header + title frame + EmptyState ("No plans yet", calm).
  // STATES.md mandates this; the prototype never rendered it.
  if (resolvedState === 'empty') {
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <View style={[styles.frame, { paddingTop: insets.top + gap.sm }]}>
          <ScreenHeader onBack={nav.back} eyebrow="PLANS" eyebrowWeight="600" backHitWidth={24} />
          <View style={styles.intro}>
            <Text style={[styles.eyebrowItalic, { color: t.muted }]}>Before next payday</Text>
            <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
              {"What's "}
              <Text style={[styles.headingAccent, { color: t.calm }]}>already</Text>
              {' spoken for.'}
            </Text>
          </View>
          <View style={styles.emptyWrap}>
            <EmptyState
              mood="calm"
              headline="No plans yet"
              body="Nothing's due before payday. Add a bill or a debt to see it here."
              cta={{ label: '+ Add a bill', onPress: () => nav.go('add-bill') }}
            />
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────────────────────────
  // The list reads from local state, so a failure is rare; STATES.md asks for an inline retry rather
  // than a dead end. Calm Melo line + a single "Try again" that re-routes through the shell.
  if (resolvedState === 'error') {
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <View style={[styles.frame, { paddingTop: insets.top + gap.sm }]}>
          <ScreenHeader onBack={nav.back} eyebrow="PLANS" eyebrowWeight="600" backHitWidth={24} />
          <View style={styles.errorWrap}>
            <MeloLine mood="concern" text="Couldn't bring up what's coming just now." />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try again"
              onPress={() => nav.go('plans')}
              style={({ pressed: isPressed }) => [
                styles.retry,
                { backgroundColor: t.calm },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.retryLabel, { color: t.accentInk }]}>Try again</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── POPULATED / OFFLINE ─────────────────────────────────────────────────────────────────────────
  // offline ≡ populated (local-first; renders identically, no network language).
  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.sm, paddingBottom: insets.bottom + gap.huge },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader onBack={nav.back} eyebrow="PLANS" eyebrowWeight="600" backHitWidth={24} />

        {/* Title frame — italic "Before next payday" eyebrow + the display line with the ONE upright
            terracotta accent word ("already"). */}
        <View style={styles.intro}>
          <Text style={[styles.eyebrowItalic, { color: t.muted }]}>Before next payday</Text>
          <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
            {"What's "}
            <Text style={[styles.headingAccent, { color: t.calm }]}>already</Text>
            {' spoken for.'}
          </Text>
        </View>

        {/* Set aside / Next payday card — the total (lg, negative tone) + the dated payday marker. */}
        <View style={[styles.summaryCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <View>
            <Text style={[styles.smallLabel, { color: t.muted }]}>Set aside</Text>
            <Money value={formatGBP(total)} size="lg" tone="negative" t={t} />
          </View>
          <View style={styles.summaryRight}>
            <Text style={[styles.smallLabel, { color: t.muted }]}>Next payday</Text>
            <Text style={[styles.paydayValue, { color: t.ink }]}>{payday}</Text>
          </View>
        </View>

        {/* The upcoming list — a hairline card of dated rows (per-row top divider, skip first). Each row
            is tappable → route-detail (honours @opens-sheet). */}
        <View style={[styles.listCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          {upcoming.map((u, i) => (
            <Pressable
              key={u.id}
              accessibilityRole="button"
              accessibilityLabel={`${u.name}, ${MINUS}£${u.amount}, ${u.day} ${u.month}`}
              accessibilityHint="Opens the detail for this."
              onPress={() => nav.openSheet('route-detail')}
              style={({ pressed: isPressed }) => [
                styles.row,
                i > 0 ? { borderTopWidth: 1, borderTopColor: t.hairline } : undefined,
                isPressed ? styles.pressed : undefined,
              ]}
            >
              {/* Date column — month eyebrow over a tabular Fraunces day. 44px wide, centred. */}
              <View style={styles.dateCol}>
                <Text style={[styles.dateMonth, { color: t.muted }]}>{u.month}</Text>
                <Text style={[styles.dateDay, { color: t.ink }]}>{u.day}</Text>
              </View>

              {/* Kind bar — debt = caution gold; bill/renewal = negative @ 60%. */}
              <View
                style={[
                  styles.kindBar,
                  u.kind === 'debt'
                    ? { backgroundColor: t.caution }
                    : { backgroundColor: t.repair, opacity: 0.6 },
                ]}
              />

              {/* Name + note — both truncate to one line. */}
              <View style={styles.rowBody}>
                <Text style={[styles.rowName, { color: t.ink }]} numberOfLines={1}>
                  {u.name}
                </Text>
                <Text style={[styles.rowNote, { color: t.muted }]} numberOfLines={1}>
                  {u.note}
                </Text>
              </View>

              {/* Amount — small tabular Fraunces, en-dash minus. */}
              <Money value={`${MINUS}£${u.amount}`} size="sm" t={t} />
            </Pressable>
          ))}
        </View>

        {/* CTAs — exact live Lovable layout: bill primary, then add-debt + debt-schedule peers. */}
        <View style={styles.ctaBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a bill"
            onPress={() => nav.go('add-bill')}
            style={({ pressed: isPressed }) => [
              styles.primaryCta,
              { backgroundColor: t.calm },
              elevation.cta,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.primaryCtaLabel, { color: t.accentInk }]}>+ Add a bill</Text>
          </Pressable>
          <View style={styles.secondaryCtaRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="or add a debt"
              onPress={() => nav.openSheet('declare-debt')}
              style={({ pressed: isPressed }) => [
                styles.secondaryCta,
                { borderColor: t.hairline },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.secondaryCtaLabel, { color: t.muted }]}>or add a debt</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Debt schedule"
              onPress={() => nav.openSheet('debt-schedule')}
              style={({ pressed: isPressed }) => [
                styles.secondaryCta,
                { borderColor: t.hairline },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.secondaryCtaLabel, { color: t.muted }]}>Debt schedule →</Text>
            </Pressable>
          </View>
        </View>

        {/* The closing Melo line — web mood 'soft' → calm on the canonical vocabulary. */}
        <View style={styles.meloBlock}>
          <MeloLine mood="calm" text="Move one if the timing doesn't suit you." />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // The empty / error frame — px-7 (gap.xl) full-height column.
  frame: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // px-7 ≈ screen inset → gap.xl. flexGrow:1 lets short content sit and tall content scroll.
  content: {
    flexGrow: 1,
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },

  // Intro frame — mt-5 (gap.lg).
  intro: {
    marginTop: gap.lg,
  },
  // Fraunces italic eyebrow, 13px muted.
  eyebrowItalic: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces display line, 28px, tight, mt-0 (the eyebrow already spaces it).
  heading: {
    fontFamily: serif.display,
    fontSize: 28,
    lineHeight: 32,
  },
  // The accent word stays UPRIGHT terracotta (web em.not-italic).
  headingAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },

  emptyWrap: {
    flex: 1,
    marginTop: gap.xl,
  },
  errorWrap: {
    flex: 1,
    gap: gap.xl,
    justifyContent: 'center',
  },
  retry: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 52,
    justifyContent: 'center',
  },
  retryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Set-aside / next-payday card — surface, 1px hairline, 2xl radius, p-5, baseline-spread, mt-5.
  summaryCard: {
    alignItems: 'baseline',
    borderRadius: radius.xxl,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.lg,
    padding: gap.lg,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  // 11px uppercase tracked muted (web tracking-[0.12em]@11px ≈ 1.3px).
  smallLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  // Fraunces 15px, mt-0.5 — the dated payday marker.
  paydayValue: {
    fontFamily: serif.display,
    fontSize: 15,
    marginTop: 2,
  },

  // The upcoming list card — surface, 1px hairline, 2xl radius, mt-5. Rows carry their own dividers.
  listCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    marginTop: gap.lg,
    overflow: 'hidden',
  },
  // Row — px-5 py-3.5, centred, gap-3.
  row: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
    paddingHorizontal: gap.lg,
    paddingVertical: 14,
  },
  // Date column — 44px wide, centred (month eyebrow over a tabular day).
  dateCol: {
    alignItems: 'center',
    width: 44,
  },
  // 10px uppercase tracked muted (web tracking-[0.12em]@10px ≈ 1.2px).
  dateMonth: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  // Fraunces 18px tabular, tight — the day number.
  dateDay: {
    fontFamily: serif.display,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
  },
  // Kind bar — w-1.5 h-8 rounded-full.
  kindBar: {
    borderRadius: radius.pill,
    height: 32,
    width: 6,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '500',
  },
  rowNote: {
    fontSize: 11.5,
    marginTop: 1,
  },

  // Money primitive — Fraunces, tabular, medium.
  money: {
    fontFamily: serif.display,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },

  // CTAs — mt-5.
  ctaBlock: {
    marginTop: gap.lg,
  },
  // Primary "+ Add a bill" — full width, h-[52px], 2xl radius, terracotta, the accent-tinted lift.
  primaryCta: {
    alignItems: 'center',
    borderRadius: radius.xxl,
    height: 52,
    justifyContent: 'center',
  },
  primaryCtaLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  secondaryCtaRow: {
    flexDirection: 'row',
    gap: gap.sm,
    marginTop: gap.sm,
  },
  // Live Lovable uses two equal 42px hairline buttons.
  secondaryCta: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    height: 42,
    justifyContent: 'center',
  },
  secondaryCtaLabel: {
    fontSize: 13,
  },

  // The closing Melo line — mt-5 mb-8.
  meloBlock: {
    marginBottom: gap.xxl,
    marginTop: gap.lg,
  },

  // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
