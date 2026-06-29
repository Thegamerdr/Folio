// @rn-engine money-path-bills — the dated bills/debt/renewal list + "set aside" total + next-payday
//   marker (this screen's real data spine). Until the money-path/bills engine lands (BUILD_PLAN §;
//   ENGINES §6) only the parts that can be derived honestly from the store render: subscription
//   RENEWALS (from real subs + subPaused) become the upcoming list, and onboarding.payday anchors the
//   next-payday marker. Standing bills + debt installments need a bills model the store does not yet
//   carry, so their ROWS are designed-and-tagged here, not faked from the web demo's literals.
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
// @reads        subs · subPaused · onboarding (read via useAppStore) — the doc-block @reads contract.
// @writes       — (navigation only: nav.back / nav.go('add-bill') / nav.go('add-debt'); tapping a row
//               opens the route-detail sheet via nav.openSheet, honouring @opens-sheet).
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
//     upcoming list is GENERATED from real subscription renewals due before the next payday (subs +
//     subPaused via useAppStore), the total is summed from that real list, and the payday marker is
//     derived from onboarding.payday. Paused subs are excluded (subPaused contract).
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
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { elevation, gap, radius, serif, useTheme, type Palette } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { useAppStore, type Sub } from '@/folio/store';
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

// The render states this screen can occupy (spec stateBranches). The list is derived from local +
// synchronous store data, so loading/error are defensive: loading shows Melo curious + a line (never a
// spinner), error shows an inline retry, offline ≡ populated (local-first, no network language).
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

const MS_PER_DAY = 86_400_000;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Days from "now" until the next payday (onboarding.payday is a day-of-month). Pure, derived from a
// supplied `now` so the screen renders deterministically; mirrors the calendar engine's next-payday
// intent without depending on it.
function daysUntilNextPayday(payday: number, now: Date): number {
  const day = Math.min(Math.max(Math.round(payday) || 25, 1), 28);
  const candidate = new Date(now.getFullYear(), now.getMonth(), day);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return Math.max(0, Math.round((candidate.getTime() - now.getTime()) / MS_PER_DAY));
}

// Build the upcoming list from REAL subscription renewals due on/before the next payday. Paused subs
// are excluded (subPaused contract). Each surviving renewal becomes a dated bill row. Bills/debt rows
// need the money-path/bills engine (tagged at file head); until then the honest forward-look is the
// renewal set. Pure — takes the slice of state it reads + a `now`.
function buildUpcoming(
  subs: readonly Sub[],
  subPaused: Record<string, boolean>,
  paydayDelta: number,
  now: Date,
): Upcoming[] {
  return subs
    .filter((s) => !subPaused[s.name])
    .filter((s) => s.nextRenewalDaysAway >= 0 && s.nextRenewalDaysAway <= paydayDelta)
    .slice()
    .sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway)
    .map((s) => {
      const when = new Date(now.getTime() + s.nextRenewalDaysAway * MS_PER_DAY);
      return {
        id: s.name,
        day: String(when.getDate()),
        month: MONTH_SHORT[when.getMonth()] ?? '',
        name: s.name,
        amount: Math.round(s.cost),
        kind: 'bill' as const,
        note: 'monthly',
      };
    });
}

// The next-payday marker label — "Payday · 25 Jul" (web literal shape), derived from onboarding.payday.
function paydayLabel(paydayDelta: number, now: Date): string {
  const when = new Date(now.getTime() + paydayDelta * MS_PER_DAY);
  return `Payday · ${when.getDate()} ${MONTH_SHORT[when.getMonth()] ?? ''}`;
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

  // Real store reads — the doc-block @reads contract (subs · subPaused · onboarding for the payday).
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);
  const onboarding = useAppStore((st) => st.onboarding);

  // A single "now" per mount keeps the dates stable across re-renders within a session.
  const now = useMemo(() => new Date(), []);
  const paydayDelta = useMemo(
    () => daysUntilNextPayday(onboarding.payday, now),
    [onboarding.payday, now],
  );
  const upcoming = useMemo(
    () => buildUpcoming(subs, subPaused, paydayDelta, now),
    [subs, subPaused, paydayDelta, now],
  );
  const total = useMemo(() => upcoming.reduce((sum, u) => sum + u.amount, 0), [upcoming]);
  const payday = useMemo(() => paydayLabel(paydayDelta, now), [paydayDelta, now]);

  const resolvedState: PlansState = state ?? (upcoming.length === 0 ? 'empty' : 'populated');

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
          <Header onBack={nav.back} muted={t.muted} />
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
          <Header onBack={nav.back} muted={t.muted} />
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
              <Text style={[styles.retryLabel, { color: t.inverse }]}>Try again</Text>
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
        <Header onBack={nav.back} muted={t.muted} />

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
        <View
          style={[styles.summaryCard, { backgroundColor: t.surface, borderColor: t.hairline }]}
        >
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

        {/* CTAs — the lifted terracotta "+ Add a bill" primary + a quiet "or add a debt" link. */}
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
            <Text style={[styles.primaryCtaLabel, { color: t.inverse }]}>+ Add a bill</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="or add a debt"
            onPress={() => nav.go('add-debt')}
            style={({ pressed: isPressed }) => [
              styles.secondaryCta,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.secondaryCtaLabel, { color: t.muted }]}>or add a debt</Text>
          </Pressable>
        </View>

        {/* The closing Melo line — web mood 'soft' → calm on the canonical vocabulary. */}
        <View style={styles.meloBlock}>
          <MeloLine mood="calm" text="Move one if the timing doesn't suit you." />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────────────────────
// Back glyph (left) · "PLANS" eyebrow (centre, uppercase tracked, muted) · a balancing spacer (right).
function Header({ onBack, muted }: { onBack: () => void; muted: string }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={onBack}
        style={({ pressed: isPressed }) => [styles.backHit, isPressed ? styles.pressed : undefined]}
      >
        <BackArrow color={muted} />
      </Pressable>
      <Text style={[styles.eyebrow, { color: muted }]}>PLANS</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// Back arrow — the web '←' glyph, drawn inline (matches PotsScreen / ReviewScreen). 20×20.
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

  // Header — back · PLANS eyebrow · spacer.
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backHit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 24,
  },
  // 12px uppercase tracked muted (web tracking-[0.14em]@12px ≈ 1.7px).
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  // Balances the back glyph so the eyebrow stays optically centred (web <span className="w-5" />).
  headerSpacer: {
    width: 20,
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
  // Secondary "or add a debt" — quiet full-width link, h-[42px], mt-2.
  secondaryCta: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    marginTop: gap.sm,
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
