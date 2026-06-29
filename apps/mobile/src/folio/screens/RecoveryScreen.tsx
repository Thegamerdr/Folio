// @rn-engine money-path — the overspent verdict + each move's real £ lift + the re-drawn route are
//   the money-path / spend-holds engines (ENGINES §6), NOT built this wave. This screen is the
//   CONSUMER of an overspent verdict: it renders the design state (preview bundle of corrective
//   moves, live after-move figure) and commits the real, available store mutations on Rebuild. The
//   shortfall figure and per-move lift below are the engine's eventual output; until it lands they
//   reuse the web source's exact sample (shortfall 94 · +£118 / +£12 / +£60), with the "Pause a sub"
//   move bound to a real quiet sub from the store so nothing is fabricated where live data exists.
//
// RecoveryScreen — the faithful 1:1 React Native port of the web Recovery surface
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenRecovery.tsx).
//
// @rn-screen    RecoveryScreen
// @rn-stack     More > Recovery
// @purpose      "Something has to move." Guided, non-blaming triage when the projection is
//               overspent. Renders the current shortfall, lets the user pick exactly ONE corrective
//               move (move a bill / pause a sub / hold spending), live-previews the after-move
//               balance, offers a Melo talk-through escape hatch, then "Rebuild the plan" commits
//               the chosen move and routes to today-after. "Not now" backs out.
// @reads        subs, subPaused, tightPointGoal (via useAppStore — the doc-block @reads, now honoured)
// @writes       togglePaused (Pause a sub) · nudgeSub (Move a bill) · setTightPointGoal (Set a hold)
//               — fired ONCE, only on the "Rebuild the plan" commit (preview-then-commit, no silent
//               path mutation while the user is just selecting).
// @opens-sheet  melo-chat (via nav.openMelo with a prefill)
// @copy         FROZEN — empathetic, never blaming. Every visible string is inline-frozen VERBATIM
//               from the web source. COPY_DECK's `short.*` block is conceptually related but is NOT a
//               verbatim match for any Recovery string (e.g. deck `short.refuse` = "Leave it for now"
//               vs the web's "Not now"; deck `short.head` = "Short by {amount}." vs the card label
//               "Shortfall"), so keying them would CHANGE the copy. Faithful-1:1 wins: the strings
//               stay exactly as the source shipped them, none concatenated.
// @tokens       surface · hairline · inset · calm (accent) · calmStrong · calmSoft (accent-soft) ·
//               muted · secondary · ink · positiveInk · repairInk · inverse — all from the kit via
//               '@/folio/theme'. No new token.
// @motion       slide-in-r (whole screen, 360ms ease-out-expo) · press 0.97 (every tappable) ·
//               fade-in (expanded move-card body, 220ms) · count-up on the after/shortfall figure
//               (MOTION.md: money values count up, never slide). Reduced motion = final state.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/source):
//   • SINGLE-SELECT: tapping the active card deselects (picked → null), which disables the CTA —
//     the exact web toggle. The move group exposes accessibilityRole="radio" + selected state.
//   • MOOD (canonical, per MELO_MOODS): the web passed kit-internal aliases ('soft'/'alert'); the
//     canonical Recovery mood is 'concern'. Preserved softening logic: after >= 0 (the move closes
//     the gap) → 'calm'; still short → 'concern' (careful, never alarmed — no red/shake). The aside
//     Melo stays 'calm'.
//   • PREVIEW-THEN-COMMIT: selecting a move mutates NOTHING; it only previews the after figure. The
//     real store write happens once, on "Rebuild the plan", for the picked move only.
//   • COUNT-UP: the after/shortfall figure settles between values via the kit useCountUp (snaps under
//     reduce-motion), so the number never hard-swaps on selection.
//   • '−' is U+2212 MINUS SIGN (not a hyphen) and '→' is U+2192 — kept exact for tabular alignment.
//   • slide-in-r / fade-in collapse to final state under reduce-motion (resolved layout, never a
//     slower animation), mirroring ReviewScreen / Melo / StartScreen.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Banned visible words (import / rows /
// parser / extraction / OCR / sync / dashboard / analytics / users / 100% / bank-grade / AI-powered /
// smart / provenance / source record / indexed) are absent from every visible string.

import { useEffect, useMemo, useRef, useState } from 'react';
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

import { gap, radius, serif, useCountUp, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import {
  nudgeSub,
  setTightPointGoal,
  togglePaused,
  useAppStore,
  type Sub,
} from '@/folio/store';
import { EmptyState } from '@/folio/ui/EmptyState';
import type { Nav } from '@/folio/types';

// One corrective move the user can pick. `deltaValue` is the £ lift this move would give the route's
// shortfall (the money-path engine's eventual output — see the @rn-engine note at the top). `commit`
// applies the move's real, available store mutation once, on Rebuild. `subName` (when present) ties
// a "Pause a sub" move to a live sub so the commit pauses the right one.
type Move = {
  id: string;
  /** The card's small uppercase kind label (e.g. "Pause a sub"). */
  kind: string;
  /** The headline of the move (e.g. "Pause Disney+ for a month"). */
  title: string;
  /** The signed-figure delta line (e.g. "+£12 this month"). */
  delta: string;
  /** The £ this move lifts the shortfall by (preview only until commit). */
  deltaValue: number;
  /** The expanded explanation shown when the card is active. */
  body: string;
  /** A small caption under the body (cost / evidence). */
  cost?: string;
  /** The frozen Melo aside shown when this move is picked. */
  melo: string;
  /** Pause a sub binds to a real sub name so the commit pauses the right one. */
  subName?: string;
  /** The real, available store write this move commits on Rebuild. */
  commit: () => void;
};

// The render states this screen can occupy (STATES.md: Recovery is ✅ populated; offline ≡ populated;
// loading shows Melo, never a spinner; empty/error fall back rather than dead-ending on a blank).
export type RecoveryState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type RecoveryScreenProps = {
  nav: Nav;
  state?: RecoveryState;
};

// The web source's overspent shortfall (money-path engine's eventual output). @rn-engine money-path.
const SAMPLE_SHORTFALL = 94;

// The web source's per-move lifts (money-path engine's eventual output). @rn-engine money-path.
const MOVE_BILL_LIFT = 118;
const MOVE_SUB_LIFT = 12;
const MOVE_HOLD_LIFT = 60;

// A calm tight-point floor the "Set a hold" move commits when the user has none set — a soft pause
// on discretionary spend reads as "protect this much at the low point". @rn-engine money-path.
const HOLD_FLOOR = 60;

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1) — for the slide-in + fade-in.
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// fade-in for the expanded move body (web .fade-in ~220ms).
const FADE_MS = 220;

// The after/shortfall count-up duration — a calm settle on each selection change.
const COUNT_MS = 420;

// The prefill the talk-through link seeds Melo with — frozen, verbatim from the web source.
const MELO_PREFILL = "I'm short to payday. Help me think this through.";

// The default Melo aside when no move is picked — frozen, verbatim from the web source.
const DEFAULT_MELO_LINE = 'No shame here. One small move can rebuild the week.';

// Local reduce-motion read, mirroring Melo.tsx / ReviewScreen.tsx exactly: read once, then subscribe.
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

// Pick the quietest live sub to offer as the "Pause a sub" move: prefer one not already paused, with
// the fewest plays (0 = quiet), tie-broken by longest since last used. Falls back to the web sample
// (Disney+) shape when there is nothing live. @rn-engine money-path will rank these properly later.
function quietestSub(subs: Sub[], subPaused: Record<string, boolean>): Sub | undefined {
  const candidates = subs.filter((s) => !subPaused[s.name]);
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) =>
    a.usesPerMonth !== b.usesPerMonth
      ? a.usesPerMonth - b.usesPerMonth
      : b.lastUsedDaysAgo - a.lastUsedDaysAgo,
  )[0];
}

export function RecoveryScreen({ nav, state = 'populated' }: RecoveryScreenProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // The doc-block @reads, now honoured (the web import was dead). Subs inform the "Pause a sub" move.
  const subs = useAppStore((st) => st.subs);
  const subPaused = useAppStore((st) => st.subPaused);

  const [picked, setPicked] = useState<string | null>(null);

  // The three corrective moves. Pause-a-sub binds to a real quiet sub when one exists; the others
  // carry the web source's exact sample numbers until the money-path engine lands (@rn-engine above).
  const moves: Move[] = useMemo(() => {
    const sub = quietestSub(subs, subPaused);
    const subTitle = sub ? `Pause ${sub.name} for a month` : 'Pause Disney+ for a month';
    return [
      {
        id: 'move-bill',
        kind: 'Move a bill',
        title: 'Move Octopus to the 12th',
        delta: `+£${MOVE_BILL_LIFT} this week`,
        deltaValue: MOVE_BILL_LIFT,
        body: 'Pushes Octopus from the 7th to the 12th. Lands two days after payday instead of two before.',
        cost: 'no fee · supplier allows it',
        melo: 'Quietest move. Same money, kinder timing.',
        // Slide the flexible bill later in the cycle — the real "what if I move this?" write.
        commit: () => nudgeSub('Octopus Energy', 5),
      },
      {
        id: 'pause-sub',
        kind: 'Pause a sub',
        title: subTitle,
        delta: `+£${MOVE_SUB_LIFT} this month`,
        deltaValue: MOVE_SUB_LIFT,
        body: 'Nothing comes out of your account for one month. Resumes automatically unless you cancel.',
        cost: '0 plays in 6 weeks · low-cost to pause',
        melo: 'Small experiment. You can resume any time.',
        ...(sub ? { subName: sub.name } : {}),
        // Pause the chosen quiet sub — the real store write.
        commit: () => {
          if (sub) togglePaused(sub.name, true);
        },
      },
      {
        id: 'hold-spend',
        kind: 'Set a hold',
        title: 'Hold spending for 3 days',
        delta: `+£${MOVE_HOLD_LIFT} estimated`,
        deltaValue: MOVE_HOLD_LIFT,
        body: "Bills and recurring still pay. Discretionary spend goes on a soft pause — you'll see a gentle nudge if you try.",
        cost: 'based on your average daily discretionary',
        melo: 'Three calm days. Not punishment, just space.',
        // Set a tight-point floor — the soft-pause is held as a floor to protect at the low point.
        commit: () => setTightPointGoal(HOLD_FLOOR),
      },
    ];
  }, [subs, subPaused]);

  const pickedMove = moves.find((m) => m.id === picked);

  // The after-move figure: the shortfall (negative) lifted by the picked move, clamped so a move
  // never reads as overshooting the gap downward. Negative = still short, >= 0 = reaches room.
  const after = pickedMove
    ? Math.max(-SAMPLE_SHORTFALL + pickedMove.deltaValue, -SAMPLE_SHORTFALL)
    : -SAMPLE_SHORTFALL;
  const reachesRoom = after >= 0;

  // Count up the magnitude between selections (MOTION.md: money values count up, never slide).
  const afterMagnitude = useCountUp(Math.abs(after), COUNT_MS, reduceMotion);

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

  // Guard a stray commit after unmount (defensive — no timers here, but keep the contract explicit).
  const committedRef = useRef(false);

  // "Rebuild the plan" — the ONLY commit. Applies the picked move's real store write once, then
  // routes to today-after. @rn-engine money-path: the web also set pressure='soft' so today-after
  // re-draws the route to the softened plan; the RN Nav carries no pressure setter yet, so that
  // soft-pressure route re-draw is the money-path engine's job. The ordered intent is preserved:
  // commit the move first, then navigate.
  function onRebuild() {
    if (!pickedMove || committedRef.current) return;
    committedRef.current = true;
    pickedMove.commit();
    nav.go('today-after');
  }

  // empty — no overspent verdict to recover from. Per the spec, Recovery is only reached from an
  // overspent verdict; with no shortfall it should not render a blank Recovery, so it offers a calm
  // doorway back to Today rather than dead-ending.
  if (state === 'empty') {
    return (
      <EmptyState
        mood="calm"
        headline="Nothing to repair"
        body="You're on track to payday. Recovery shows up only when something needs a move."
        cta={{ label: 'Back to today', onPress: () => nav.go('today') }}
      />
    );
  }

  // loading — Melo curious + a line, NEVER a spinner (hard rule + STATES.md).
  if (state === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}>
        <MeloLine mood="curious" text="One second — working out what would move." />
      </View>
    );
  }

  // populated / offline / error — the real triage surface. offline ≡ populated (local-first); a
  // direct error mount still shows the surface so the user can act on the moves in hand.
  const eyebrow = 'Recovery';
  const caption = pickedMove
    ? reachesRoom
      ? 'you reach payday with room'
      : `still £${Math.round(afterMagnitude)} short — try another move`
    : 'to reach payday with room';
  const sign = reachesRoom ? '+' : '−'; // U+2212 MINUS SIGN
  const afterValue = `${sign}£${Math.round(afterMagnitude)}`;

  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.md, paddingBottom: insets.bottom + gap.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back glyph · "Recovery" eyebrow · spacer (keeps the eyebrow optically centred). */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [styles.pressIcon, isPressed ? styles.pressed : undefined]}
          >
            <BackArrow color={t.muted} />
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>{eyebrow}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Title block — italic reassurance + the headline with "move." as the single accent word. */}
        <View style={styles.titleBlock}>
          <Text style={[styles.kicker, { color: t.muted }]}>It happens. Let's repair calmly.</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'Something has to '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>move.</Text>
          </Text>
        </View>

        {/* Shortfall card — Melo (mood softens when the move closes the gap) + the live after figure. */}
        <View style={[styles.shortfallCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Melo size={56} mood={reachesRoom ? 'calm' : 'concern'} grounded={false} />
          <View style={styles.shortfallBody} accessibilityLiveRegion="polite">
            <Text style={[styles.cardLabel, { color: t.muted }]}>
              {pickedMove ? 'After this move' : 'Shortfall'}
            </Text>
            <Text
              accessibilityLabel={`${afterValue} ${caption}`}
              style={[styles.afterValue, { color: reachesRoom ? t.positiveInk : t.repairInk }]}
            >
              {afterValue}
            </Text>
            <Text style={[styles.cardCaption, { color: t.muted }]}>{caption}</Text>
          </View>
        </View>

        {/* "Pick one thing" — the single-select move group. */}
        <Text style={[styles.sectionLabel, { color: t.muted }]}>Pick one thing</Text>
        <View accessibilityRole="radiogroup" style={styles.moveList}>
          {moves.map((m) => (
            <MoveCard
              key={m.id}
              move={m}
              active={picked === m.id}
              reduceMotion={reduceMotion}
              t={t}
              s={s}
              // Single-select: tapping the active card deselects (→ null), disabling the CTA.
              onPress={() => setPicked((prev) => (prev === m.id ? null : m.id))}
            />
          ))}
        </View>

        {/* Talk-through escape hatch — opens Melo seeded with the frozen prefill. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Talk it through with Melo"
          hitSlop={8}
          onPress={() => nav.openMelo({ prefill: MELO_PREFILL })}
          style={({ pressed: isPressed }) => [styles.talkLink, isPressed ? styles.pressed : undefined]}
        >
          <Text style={[styles.talkLinkText, { color: t.muted }]}>
            {'Not sure? Talk it through with Melo →'}
          </Text>
        </Pressable>

        {/* Melo aside — the picked move's frozen line, or the default. MeloLine adds the quotes. */}
        <View style={styles.meloAside}>
          <MeloLine mood="calm" size={28} text={pickedMove?.melo ?? DEFAULT_MELO_LINE} />
        </View>

        {/* Primary CTA — disabled until a move is picked; commits the move, routes to today-after. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rebuild the plan"
          accessibilityState={{ disabled: !pickedMove }}
          disabled={!pickedMove}
          onPress={onRebuild}
          style={({ pressed: isPressed }) => [
            styles.primary,
            { backgroundColor: pickedMove ? t.calmStrong : t.sunken },
            isPressed && pickedMove ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.primaryLabel, { color: pickedMove ? t.inverse : t.muted }]}>
            Rebuild the plan
          </Text>
        </Pressable>

        {/* Secondary — back out, no move made. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not now"
          onPress={nav.back}
          style={({ pressed: isPressed }) => [styles.secondary, isPressed ? styles.pressed : undefined]}
        >
          <Text style={[styles.secondaryLabel, { color: t.muted }]}>Not now</Text>
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Move card — one corrective move. Active = accent-soft fill + a terracotta ring (border, not a drop
// shadow, so the flat paper look holds), revealing the body + cost with a fade-in.
// ---------------------------------------------------------------------------

function MoveCard({
  move,
  active,
  reduceMotion,
  t,
  s,
  onPress,
}: {
  move: Move;
  active: boolean;
  reduceMotion: boolean;
  t: Palette;
  s: ReturnType<typeof makeStyles>;
  onPress: () => void;
}) {
  // fade-in for the expanded body — opacity 0 → 1 over 220ms, final-state under reduce-motion.
  const reveal = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    if (!active) {
      reveal.value = 0;
      return;
    }
    if (reduceMotion) {
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: FADE_MS, easing: EASE_OUT_EXPO });
  }, [active, reduceMotion, reveal]);
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${move.kind}: ${move.title}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.moveCard,
        active
          ? { backgroundColor: t.calmSoft, borderColor: t.calm }
          : { backgroundColor: t.surface, borderColor: t.hairline },
        isPressed ? styles.pressed : undefined,
      ]}
    >
      <View style={styles.moveTopRow}>
        <Text style={[styles.moveKind, { color: t.muted }]}>{move.kind}</Text>
        <Text style={[styles.moveDelta, { color: active ? t.calmStrong : t.positiveInk }]}>
          {move.delta}
        </Text>
      </View>
      <Text style={[styles.moveTitle, { color: t.ink }]}>{move.title}</Text>
      {active ? (
        <Animated.View style={[styles.moveExpanded, revealStyle]}>
          <Text style={[styles.moveBody, { color: t.secondary }]}>{move.body}</Text>
          {move.cost ? <Text style={[styles.moveCost, { color: t.muted }]}>{move.cost}</Text> : null}
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

// Back arrow — the web '←' glyph, drawn inline (matches ReviewScreen). 20×20 user space.
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

// Layout-only styles (spacing, type, flex, radii) — theme-independent, kept module-level static per
// the kit's DARK-MODE PATTERN. Only colour-bearing values are applied inline from the active palette.
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // px-7 ≈ screen inset → gap.xl (24).
  content: {
    flexGrow: 1,
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pressIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 24,
  },
  // The right-edge spacer balancing the back glyph (web `w-5`).
  headerSpacer: {
    width: 20,
  },
  // Eyebrow — 12px uppercase tracked muted (web tracking-[0.14em] ≈ 1.7px letterSpacing).
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  // Title block — mt-5.
  titleBlock: {
    marginTop: gap.lg + gap.xs,
  },
  // Fraunces italic kicker, 13px muted.
  kicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
    lineHeight: 18,
  },
  // Fraunces headline, 30px, tight line-height (web leading-[1.05]), mt-1.
  headline: {
    fontFamily: serif.display,
    fontSize: 30,
    letterSpacing: -0.3,
    lineHeight: 32,
    marginTop: gap.xs,
  },
  // The accent word stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // Shortfall card — surface, hairline, 2xl radius, p-5, row, mt-5.
  shortfallCard: {
    alignItems: 'center',
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    columnGap: gap.lg,
    flexDirection: 'row',
    marginTop: gap.lg + gap.xs,
    padding: gap.lg + gap.xs,
  },
  shortfallBody: {
    flex: 1,
  },
  // 11px uppercase tracked muted (web tracking-[0.12em] ≈ 1.4px).
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  // The big after/shortfall figure — money size 'lg', tabular, mt small.
  afterValue: {
    fontSize: 34,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 2,
  },
  // Fraunces italic caption, 11.5px muted, mt-1.
  cardCaption: {
    fontFamily: serif.displayItalic,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: gap.xs,
  },
  // "Pick one thing" — 11px uppercase tracked muted, mt-5, px-1.
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.7,
    marginTop: gap.lg + gap.xs,
    paddingHorizontal: gap.xs,
    textTransform: 'uppercase',
  },
  // The move list — mt-2, gap-2.5 between cards.
  moveList: {
    marginTop: gap.sm,
    rowGap: gap.sm + gap.xxs,
  },
  // A move card — 2xl radius, px-5 py-4, hairline (the active ring/fill are applied inline).
  moveCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    paddingHorizontal: gap.lg + gap.xs,
    paddingVertical: gap.md + gap.xs,
  },
  moveTopRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // 10.5px uppercase tracked muted (web tracking-[0.12em]).
  moveKind: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  // 12px tabular delta — terracotta when active, calm green otherwise.
  moveDelta: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  // 14.5px medium move title, mt-0.5.
  moveTitle: {
    fontSize: 14.5,
    fontWeight: '500',
    marginTop: gap.xxs,
  },
  // Expanded body — mt-2, gap-1.5, fade-in.
  moveExpanded: {
    marginTop: gap.sm,
    rowGap: gap.xs + gap.xxs,
  },
  // 12.5px body, relaxed line-height (web leading-relaxed).
  moveBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  // 11px cost/evidence caption.
  moveCost: {
    fontSize: 11,
    lineHeight: 15,
  },
  // The talk-through link — mt-3, self-start, underlined offset (web underline-offset-2).
  talkLink: {
    alignSelf: 'flex-start',
    marginTop: gap.md,
    paddingVertical: 4,
  },
  talkLinkText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  // The Melo aside — mt-4.
  meloAside: {
    marginTop: gap.lg,
  },
  // Primary CTA — full width, h-[54px], 2xl radius (the fill is applied inline by picked state).
  primary: {
    alignItems: 'center',
    borderRadius: radius.xxl,
    height: 54,
    justifyContent: 'center',
    marginBottom: gap.md,
    marginTop: gap.lg + gap.xs,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  // Secondary — h-[44px], a quiet muted label.
  secondary: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginBottom: gap.xl,
  },
  secondaryLabel: {
    fontSize: 13,
  },
  // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});

// Colour-bearing factory — kept for the DARK-MODE PATTERN parity with sibling screens. The card's
// per-state colours are applied inline from the active palette (they switch on `active`/`picked`,
// not on the theme), so this currently holds no static colour styles; it exists so a later colour
// extraction follows the same `useMemo(() => makeStyles(t), [t])` shape the kit prescribes.
function makeStyles(_t: Palette) {
  return StyleSheet.create({});
}
