// @rn-engine statement-reader|photo-reader|text-reader — produces CandidateMoneyItem[] into Review (see BUILD_PLAN §3)
//
// ReviewScreen — the faithful 1:1 React Native port of the web one-decision review card
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenReview.tsx).
//
// @rn-screen    ReviewScreen
// @rn-stack     Intake > Review
// @purpose      One found item, one decision. A single review card — the amount, the date, what
//               adding it would do to the balance, and a category — with one dominant "Add to my
//               picture". This is review-before-truth: nothing counts until the user taps Add.
// @reads        — (nav only; the web @reads is an em-dash. The web file's ~16 store imports are DEAD
//               in its body and are NOT ported. This screen reads no store state.)
// @writes       addTransaction (only on Accept / "Keep both"). De-dupe: when the candidate matches an
//               existing row the card PROPOSES a link (ENGINES §8 / lib/reviewDedupe → lib/dedupe);
//               "Link them" adds NOTHING (no double count), "Keep both" is the only Add.
// @opens-sheet  edit-txn (the ⋯ and the Edit button open the edit-txn sheet via nav.openSheet)
// @copy         FROZEN
// @tokens       surface · hairline · inset · calm (accent) · calmSoft (accent-soft) · muted · ink ·
//               inverse — all from the kit via '@/folio/theme'. No new token.
// @motion       stamp 600ms cubic-bezier(.34,1.56,.64,1) (the "Added" seal) · slide-in-r (whole
//               screen) · count-up on the "if you add it" balance · press 0.97 (kit `pressed`).
//               Reduced motion = final state (stamp + slide collapse, count-up snaps).
//
// @rn-engine statement-reader|photo-reader|text-reader — produces CandidateMoneyItem[] into Review
//   (see BUILD_PLAN §3). This wave ports the UI only; the real readers are built later. The single
//   candidate below (merchant / amount / date / balance numbers) is the engine's eventual output —
//   here it is a local sample that REUSES the web source's exact values (Tesco · £42 · from £325 →
//   £283), no fabricated merchants/numbers.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/source):
//   • The accent word in the headline ("Tesco") is rendered UPRIGHT terracotta inside the Fraunces
//     line (web <em class="not-italic text-[accent]">) — built as three Text runs so the merchant
//     name is the single coloured run. It is bound from the candidate, not hand-typed.
//   • REVIEW-BEFORE-TRUTH: the web's onAdd mutated NOTHING (it just stamped + nav.go('today')). This
//     RN port honours the screen's purpose — Add calls store.addTransaction ONCE for the candidate,
//     then routes to Today after the stamp settles. Nothing else mutates the path. The web's
//     nav.bumpReview() (a showcase-only re-key) has no RN analog and is intentionally dropped.
//   • The stamp is the "Added" seal: a 600ms scale-overshoot on cubic-bezier(.34,1.56,.64,1) (the
//     web's stamp curve), firing exactly once on Accept, never looping. Gated to a no-op (final
//     state) under reduce-motion.
//   • The count-up balance uses the kit's useCountUp (re-exported via theme) so the "if you add it"
//     figure settles from £325 → £283 with the same easeOutCubic the rest of the surface uses; it
//     snaps under reduce-motion. The before/delta line ("from £325 · drops by £42") is derived from
//     the candidate so the numbers can never drift apart.
//   • The category chips are spend buckets (the web CATEGORIES list, verbatim). The active chip reads
//     accent-soft fill + terracotta text; the rest read surface + muted, faithful to the web. They
//     are disabled once stamped (the decision is sealed).
//   • The web's '←' and '⋯' glyphs are kept as small inline drawings: the back arrow as the shared
//     react-native-svg BackArrow, the "more" as three tappable dots (the codebase ships no icon font).
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring Melo + StartScreen.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Banned visible words (import / rows /
// parser / extraction / OCR / sync / dashboard / analytics / users / 100% / bank-grade / AI-powered /
// smart / provenance / source record / indexed) are absent. Copy is VERBATIM — the eyebrow / headline
// frame / card labels / chips / CTAs are @copy FROZEN inline literals (not keyed in COPY_DECK); the
// Melo line is its own frozen literal.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { elevation, gap, radius, serif, useCountUp, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import {
  addIgnoredReviewSig,
  addTransaction,
  reviewCandidateSig,
  useAppStore,
  type Transaction,
} from '@/folio/store';
import { reviewDateToIso, reviewMatch, reviewMatchSubline } from '@/folio/lib/reviewDedupe';
import type { Nav } from '@/folio/types';

// The single candidate this screen reviews — the eventual shape of one CandidateMoneyItem from a
// reader. `before` is the current balance; `after` is what it becomes if the item (a spend) is added.
export type ReviewCandidate = {
  /** The posted transaction id this candidate corresponds to, when it already exists as a row (so the
   *  edit-txn sheet can correct THAT transaction). The pre-truth SAMPLE has none — a candidate is not
   *  a posted fact until Accept, so there is no real subject to edit yet, and the edit-txn sheet falls
   *  back to its safe inert branch rather than editing a random row. */
  id?: string;
  merchant: string;
  /** Magnitude in £ (always positive — `flow` carries the direction). */
  amount: number;
  flow: 'in' | 'out';
  date: string;
  before: number;
};

// What a completed read hands this screen. Until the reader lands, the shell passes the SAMPLE below
// (the web source's exact Tesco · £42 · £325 numbers), so the screen renders honestly.
const SAMPLE_CANDIDATE: ReviewCandidate = {
  merchant: 'Tesco',
  amount: 42,
  flow: 'out',
  date: '26 June',
  before: 325,
};

// The category chips — the web CATEGORIES list, verbatim.
const CATEGORIES = [
  'Groceries',
  'Transport',
  'Bills',
  'Eating out',
  'Subscription',
  'Shopping',
  'Other',
] as const;
type Category = (typeof CATEGORIES)[number];

// The render states this screen can occupy.
export type ReviewState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type ReviewScreenProps = {
  nav: Nav;
  candidate?: ReviewCandidate;
  state?: ReviewState;
};

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1) — for the slide-in.
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// The stamp's signature curve — the web's cubic-bezier(.34, 1.56, .64, 1) (a soft overshoot).
const STAMP_EASE = Easing.bezier(0.34, 1.56, 0.64, 1);

// slide-in-r geometry (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// Stamp duration (web .stamp ~600ms) and the dwell after a successful Add before routing to Today
// (web setTimeout 900ms).
const STAMP_MS = 600;
const ADD_DWELL_MS = 900;

// The "if you add it" count-up duration (web useCountUp(..., 700)).
const COUNT_MS = 700;

// Map a chosen category chip → a Transaction category bucket, so an accepted item flows into the
// money path with an honest bucket.
function categoryFor(label: Category): Transaction['category'] {
  switch (label) {
    case 'Groceries':
    case 'Eating out':
      return 'food';
    case 'Transport':
      return 'transport';
    case 'Bills':
    case 'Subscription':
      return 'bills';
    case 'Shopping':
      return 'shopping';
    default:
      return 'other';
  }
}

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

export function ReviewScreen({
  nav,
  candidate: candidateProp,
  state = 'populated',
}: ReviewScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // Whether a REAL candidate was handed in. A cold open from the shell (FolioShell renders
  // <ReviewScreen nav={nav} /> with no candidate — e.g. the Intake "Add numbers yourself" path)
  // passes none. We never fabricate a sample row in that case: the empty doorway shows below, so the
  // user can never accidentally Add a fake "Tesco £42" as a real transaction. SAMPLE_CANDIDATE is kept
  // ONLY as a safe fallback so the hooks/derivations below never read undefined — its values are never
  // displayed when `hasRealCandidate` is false.
  const hasRealCandidate = candidateProp !== undefined;
  const candidate = candidateProp ?? SAMPLE_CANDIDATE;

  const [stamped, setStamped] = useState(false);
  const [category, setCategory] = useState<Category>('Groceries');

  // Existing rows + a mount-gated clock, for the de-dupe proposal (ENGINES §8 / the dedupe engine):
  // when the candidate looks like a transaction the user ALREADY added, Review PROPOSES a link rather
  // than silently double-counting. Read reactively so a just-added row is considered.
  const transactions = useAppStore((st) => st.transactions);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  // The payload threaded to the edit-txn sheet — the candidate's real subject id when it already
  // exists as a posted transaction. Under exactOptionalPropertyTypes the `id` key is OMITTED (not set
  // to undefined) for the pre-truth SAMPLE, so the sheet receives no target and uses its safe inert
  // fallback rather than editing a random row.
  const editTargetPayload = candidate.id !== undefined ? { id: candidate.id } : {};

  // The "if you add it" balance: before until stamped, after once committed (a spend drops it).
  const signedDelta = candidate.flow === 'out' ? -candidate.amount : candidate.amount;
  const afterBalance = candidate.before + signedDelta;
  const balance = useCountUp(stamped ? afterBalance : candidate.before, COUNT_MS, reduceMotion);

  // The de-dupe proposal for THIS candidate against existing rows, or null (the pure engine decides).
  // Skipped when there's no real candidate, once sealed, before the clock mounts, or when the
  // candidate's date can't be read — a candidate we can't compare is never merged on a guess.
  const dupeProposal = useMemo(() => {
    if (!hasRealCandidate || stamped || now === null) return null;
    const dateIso = reviewDateToIso(candidate.date, now.getFullYear());
    if (dateIso === null) return null;
    return reviewMatch(
      {
        id: candidate.id ?? 'review-candidate',
        amount: signedDelta,
        dateIso,
        merchant: candidate.merchant,
      },
      transactions,
      now.toISOString().slice(0, 10),
    );
  }, [hasRealCandidate, stamped, now, candidate, signedDelta, transactions]);

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

  // The "Added" stamp — a 600ms scale-overshoot on the stamp curve, fired once on Accept.
  const stampScale = useSharedValue(0);
  const stampStyle = useAnimatedStyle(() => ({
    opacity: stampScale.value > 0 ? 1 : 0,
    transform: [{ scale: stampScale.value }, { rotate: '-8deg' }],
  }));

  // The dwell timer is cleaned up on unmount so a fast back-out never fires a stray nav.
  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (dwellRef.current) clearTimeout(dwellRef.current);
    },
    [],
  );

  // Accept — the ONLY money-path mutation on this surface. The candidate becomes one posted
  // Transaction (review-before-truth: the user's deliberate "add"), the stamp seals it, then Today.
  function onAdd() {
    if (stamped) return;
    setStamped(true);
    addTransaction({
      merchant: candidate.merchant,
      amount: signedDelta,
      category: categoryFor(category),
      source: 'manual',
    });
    if (!reduceMotion) {
      stampScale.value = withSequence(
        withTiming(1.12, { duration: STAMP_MS * 0.6, easing: STAMP_EASE }),
        withTiming(1, { duration: STAMP_MS * 0.4, easing: STAMP_EASE }),
      );
    } else {
      stampScale.value = 1;
    }
    dwellRef.current = setTimeout(() => nav.go('today'), reduceMotion ? 0 : ADD_DWELL_MS);
  }

  // Link them — the candidate is the same as an existing row, so we DON'T add a duplicate: no double
  // count, the existing row is untouched. Nothing is created or destroyed here, so the decision is
  // reversible (the user can re-add from intake). Route to Today, like any completed decision.
  function onLink() {
    if (stamped) return;
    nav.go('today');
  }

  // Ignore — mirrors the web source's ignoreReviewItem exactly: record the candidate's signature
  // (merchant|amountCents|date, store.ts reviewCandidateSig) so HiddenReviewSheet can list it and the
  // user can un-hide it later, and so a future intake with the exact same merchant/amount/date is
  // suppressed rather than nagging again (ENGINES.md §6). Only real candidates have a signature worth
  // recording — the pre-truth SAMPLE/empty-doorway path has nothing to suppress.
  function onIgnore() {
    if (hasRealCandidate) {
      const year = now?.getFullYear() ?? new Date().getFullYear();
      const dateIso = reviewDateToIso(candidate.date, year) ?? candidate.date;
      addIgnoredReviewSig(reviewCandidateSig(candidate.merchant, signedDelta, dateIso));
    }
    nav.back();
  }

  // empty — no candidate to review: an explicit empty state, OR a cold open with no candidate passed
  // (we show the doorway instead of a fabricated sample row). Routes to intake rather than dead-ending.
  if (state === 'empty' || !hasRealCandidate) {
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <View style={[styles.emptyWrap, { paddingTop: insets.top + gap.xxl }]}>
          <MeloLine
            mood="calm"
            text="Nothing to review yet. Add a statement and I'll show what I find."
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a statement"
            onPress={() => nav.go('intake')}
            style={({ pressed: isPressed }) => [
              styles.primary,
              { backgroundColor: t.calm, marginTop: gap.xl },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.primaryLabel, { color: t.inverse }]}>Add a statement</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  // loading — Melo curious + a line, NEVER a spinner (hard rule + STATES.md).
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="One second — getting this ready for you." />
      </View>
    );
  }

  // populated / offline / error — the real one-decision card. offline ≡ populated (local-first); a
  // direct error mount still shows the card so the user can decide on the candidate in hand.
  const isOut = candidate.flow === 'out';
  const moneyStr = `${isOut ? '£' : '+£'}${candidate.amount.toFixed(2)}`;
  const dropLine = `from £${candidate.before} · ${isOut ? 'drops' : 'rises'} by £${candidate.amount}`;

  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back glyph · "1 of 3" position · more-options glyph (opens edit-txn). */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [
              styles.pressIcon,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <BackArrow color={t.muted} />
          </Pressable>
          <Text accessibilityLabel="Item 1 of 3" style={[styles.position, { color: t.muted }]}>
            1 of 3
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More options"
            hitSlop={12}
            onPress={() => nav.openSheet('edit-txn', editTargetPayload)}
            style={({ pressed: isPressed }) => [
              styles.pressIcon,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <MoreDots color={t.muted} />
          </Pressable>
        </View>

        {/* Intro — italic "Review" kicker + the headline with the merchant as the single accent word. */}
        <View style={styles.intro}>
          <Text style={[styles.kicker, { color: t.muted }]}>Review</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'Is this your '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>{candidate.merchant}</Text>
            {' payment?'}
          </Text>
        </View>

        {/* The review card — amount, date, and what adding it does to the balance. */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          {/* The "Added" seal — only after Accept. */}
          {stamped ? (
            <Animated.View
              style={[styles.stamp, stampStyle, { borderColor: t.calm }]}
              pointerEvents="none"
            >
              <Text style={[styles.stampLabel, { color: t.calm }]}>Added</Text>
            </Animated.View>
          ) : null}

          <View style={styles.amountRow}>
            <Text style={[styles.amountValue, { color: t.ink }]}>{moneyStr}</Text>
            <Text style={[styles.outLabel, { color: t.muted }]}>{isOut ? 'out' : 'in'}</Text>
          </View>
          <Text
            style={[styles.dateLine, { color: t.muted }]}
          >{`${candidate.date} · from your statement`}</Text>

          <View style={[styles.cardDivider, { backgroundColor: t.hairline }]} />

          <View style={styles.projectionRow}>
            <View style={[styles.projIcon, { backgroundColor: t.calmSoft }]}>
              <Text style={[styles.projGlyph, { color: t.calm }]}>↓</Text>
            </View>
            <View accessibilityLiveRegion="polite" style={styles.projBody}>
              <Text style={[styles.projLead, { color: t.ink }]}>If you add it, you'll have</Text>
              <Text style={[styles.projBalance, { color: t.ink }]}>{`£${balance.toFixed(0)}`}</Text>
              <Text style={[styles.projDelta, { color: t.muted }]}>{dropLine}</Text>
            </View>
          </View>
        </View>

        {/* Category chips. */}
        <View style={styles.catBlock}>
          <Text style={[styles.catLabel, { color: t.muted }]}>What kind of spend?</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: stamped }}
                  disabled={stamped}
                  onPress={() => setCategory(c)}
                  style={({ pressed: isPressed }) => [
                    styles.chip,
                    {
                      backgroundColor: active ? t.calmSoft : t.surface,
                      borderColor: t.hairline,
                    },
                    isPressed && !stamped ? styles.pressed : undefined,
                  ]}
                >
                  <Text style={[styles.chipLabel, { color: active ? t.calm : t.muted }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Melo line — the quiet companion, calm mood. MeloLine adds the straight quotes. */}
        <View style={styles.meloBlock}>
          <MeloLine mood="calm" text="Take your time. You can change this later." />
        </View>

        {/* Spacer pins the CTAs to the bottom, mirroring the web flex-1 spacer. */}
        <View style={styles.spacer} />

        {dupeProposal && !stamped ? (
          /* De-dupe proposal — "This looks like something you already added." Propose, never
             auto-merge (ENGINES §8 / the dedupe engine): Link them (adds NOTHING — no double count) ·
             Keep both (the normal Add) · Edit before linking (opens edit-txn) · Ignore (backs out).
             Linking removes nothing; the original stays. */
          <View style={[styles.dupeCard, { backgroundColor: t.calmSoft, borderColor: t.calm }]}>
            <Text style={[styles.dupeHead, { color: t.ink }]}>
              This looks like something you already added.
            </Text>
            <Text style={[styles.dupeSub, { color: t.muted }]}>
              {reviewMatchSubline(dupeProposal)}
            </Text>
            <View style={styles.dupeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Link them"
                onPress={onLink}
                style={({ pressed: isPressed }) => [
                  styles.dupePrimary,
                  { backgroundColor: t.calm },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.dupePrimaryLabel, { color: t.inverse }]}>Link them</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Keep both"
                onPress={onAdd}
                style={({ pressed: isPressed }) => [
                  styles.dupeCell,
                  { backgroundColor: t.surface, borderColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.dupeCellLabel, { color: t.ink }]}>Keep both</Text>
              </Pressable>
            </View>
            <View style={styles.dupeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit before linking"
                onPress={() => nav.openSheet('edit-txn', editTargetPayload)}
                style={({ pressed: isPressed }) => [
                  styles.dupeCell,
                  { backgroundColor: t.surface, borderColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.dupeCellLabel, { color: t.ink }]}>Edit before linking</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ignore the imported one"
                onPress={nav.back}
                style={({ pressed: isPressed }) => [
                  styles.dupeCell,
                  { backgroundColor: t.surface, borderColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.dupeCellLabel, { color: t.ink }]}>Ignore</Text>
              </Pressable>
            </View>
            <Text style={[styles.dupeFoot, { color: t.muted }]}>
              Linking keeps your original — nothing is removed.
            </Text>
          </View>
        ) : (
          <>
            {/* Primary CTA — the dominant "Add to my picture"; reads "Added…" once sealed. */}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: stamped }}
              accessibilityLabel={stamped ? 'Added to your picture' : 'Add to my picture'}
              disabled={stamped}
              onPress={onAdd}
              style={({ pressed: isPressed }) => [
                styles.primary,
                { backgroundColor: t.calm },
                stamped ? styles.primaryStamped : undefined,
                isPressed && !stamped ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.primaryLabel, { color: t.inverse }]}>
                {stamped ? 'Added to your picture' : 'Add to my picture'}
              </Text>
            </Pressable>

            {/* Secondary row — Edit (opens edit-txn) + Ignore (backs out). */}
            <View style={styles.secondaryRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit"
                onPress={() => nav.openSheet('edit-txn', editTargetPayload)}
                style={({ pressed: isPressed }) => [
                  styles.secondaryCell,
                  { backgroundColor: t.surface, borderColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.secondaryLabel, { color: t.ink }]}>Edit</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ignore"
                onPress={nav.back}
                style={({ pressed: isPressed }) => [
                  styles.secondaryCell,
                  { backgroundColor: t.surface, borderColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.secondaryLabel, { color: t.ink }]}>Ignore</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// Back arrow — the web '←' glyph, drawn inline (matches PdfSuccessScreen). 20×20 user space.
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

// More-options — the web '⋯' glyph, drawn inline as three dots. 20×20 user space.
function MoreDots({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M5 10 h0.01 M10 10 h0.01 M15 10 h0.01"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // px-7 ≈ screen inset → gap.xl (24). flexGrow:1 + a flex:1 spacer pins the CTAs to the bottom.
  content: {
    flexGrow: 1,
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  emptyWrap: {
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
  // "1 of 3" — 12px muted, tabular.
  position: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  // mt-6 (24) → gap.xl.
  intro: {
    marginTop: gap.xl,
  },
  // Fraunces italic kicker, 13px muted.
  kicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces headline, 28px, tight line-height, mt-1.
  headline: {
    fontFamily: serif.display,
    fontSize: 28,
    lineHeight: 32,
    marginTop: gap.xs,
  },
  // The accent word stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // Card — surface, hairline, 2xl radius, p-6, mt-6, relative for the absolute stamp.
  // Web carries boxShadow var(--shadow-card); the kit's elevation.card is that token's RN form
  // (warm near-black lift, the same one the kit's own Surface uses) — the card floats on the cream.
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.xl,
    position: 'relative',
    ...elevation.card,
  },
  // The "Added" seal — top-right pill, 2px terracotta ring, uppercase tracked terracotta label.
  stamp: {
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
  stampLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  // Amount row — the big money + the "out"/"in" label, baseline aligned.
  amountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Money size 'xl' = 44px, Fraunces, tabular. Web Money applies font-medium (weight 500).
  amountValue: {
    fontFamily: serif.display,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
    letterSpacing: -1,
  },
  // 12px uppercase tracked muted.
  outLabel: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  // 13px muted, mt-3.
  dateLine: {
    fontSize: 13,
    marginTop: gap.md,
  },
  // h-px divider, mt-6.
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
  },
  // Projection row — the down icon + the "if you add it" copy, gap-3, mt-5.
  projectionRow: {
    alignItems: 'flex-start',
    columnGap: gap.md,
    flexDirection: 'row',
    marginTop: gap.lg + gap.xs,
  },
  // w-8 h-8 (32) rounded-full accent-soft tile.
  projIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  projGlyph: {
    fontSize: 14,
  },
  projBody: {
    flex: 1,
  },
  // 13px lead.
  projLead: {
    fontSize: 13,
  },
  // Fraunces 28px tabular projected balance, mt-0.5.
  projBalance: {
    fontFamily: serif.display,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    marginTop: gap.xxs,
  },
  // 12px muted tabular delta, mt-1.
  projDelta: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    marginTop: gap.xs,
  },
  // Category block — mt-5.
  catBlock: {
    marginTop: gap.lg + gap.xs,
  },
  // 11px uppercase tracked muted, mb-2.
  catLabel: {
    fontSize: 11,
    letterSpacing: 1.8,
    marginBottom: gap.sm,
    textTransform: 'uppercase',
  },
  // Wrapping chip row — gap-1.5.
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gap.xs + gap.xxs,
  },
  // px-3 py-1.5 rounded-full hairline chip.
  chip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.md,
    paddingVertical: 6,
  },
  chipLabel: {
    fontSize: 12,
  },
  // mt-4 around the Melo line.
  meloBlock: {
    marginTop: gap.lg,
  },
  spacer: {
    flex: 1,
  },
  // Primary CTA — full width, h-[60px], 2xl radius, terracotta fill.
  // Web carries boxShadow 0 12px 24px -10px rgba(224,99,58,.55); the kit's elevation.cta is that
  // terracotta-tinted lift (the same one the kit's own PrimaryAction uses) — the dominant next step.
  primary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 60,
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
  // Secondary row — Edit + Ignore, gap-2.5, mt-3.
  secondaryRow: {
    columnGap: gap.md - gap.xxs,
    flexDirection: 'row',
    marginTop: gap.md,
  },
  // h-12 (48) rounded-xl, surface, hairline. flex:1 so the two share the row evenly.
  secondaryCell: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 14,
  },
  // De-dupe proposal card — accent-soft surface + the calm ring; the propose-never-merge affordance.
  dupeCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: gap.md,
    padding: gap.lg,
  },
  dupeHead: {
    fontFamily: serif.display,
    fontSize: 16,
    lineHeight: 20,
  },
  dupeSub: {
    fontSize: 12.5,
    marginTop: gap.xs,
  },
  dupeRow: {
    columnGap: gap.md - gap.xxs,
    flexDirection: 'row',
    marginTop: gap.md,
  },
  dupePrimary: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  dupePrimaryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  dupeCell: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  dupeCellLabel: {
    fontSize: 14,
  },
  dupeFoot: {
    fontSize: 11,
    marginTop: gap.md,
    textAlign: 'center',
  },
  // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
