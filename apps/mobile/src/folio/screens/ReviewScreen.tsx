// @rn-engine statement-reader|photo-reader|text-reader — produces CandidateMoneyItem[] into Review (see BUILD_PLAN §3)
//
// ReviewScreen — the native review-before-truth surface shared by manual, statement, photo and
// provider-neutral bank candidates.
//
// @rn-screen    ReviewScreen
// @rn-stack     Intake > Review
// @purpose      One found item, one decision. A single review card — the amount, the date, what
//               accepting it records, and a category — with one dominant "Add to my
//               picture". This is review-before-truth: nothing counts until the user taps Add.
// @reads        reviewQueue[0] + currentBalance (frozen at mount — the next queued intake candidate
//               when no direct candidate prop is passed, web ScreenReview.tsx parity), transactions
//               (reactive, for the de-dupe proposal).
// @writes       addTransaction (only on Accept / "Keep both") · resolveReviewItem (drains the queued
//               item on Accept AND on Ignore, so the Today "waiting to be checked" chip decrements).
//               De-dupe: when the candidate matches an existing row the card PROPOSES a link
//               (ENGINES §8 / lib/reviewDedupe → lib/dedupe); "Link them" adds NOTHING (no double
//               count), "Keep both" is the only Add.
// @copy         FROZEN
// @tokens       surface · hairline · inset · calm (accent) · calmSoft (accent-soft) · muted · ink ·
//               inverse — all from the kit via '@/folio/theme'. No new token.
// @motion       stamp 600ms cubic-bezier(.34,1.56,.64,1) (the "Added" seal) · slide-in-r (whole
//               screen) · count-up on the accepted amount · press 0.97 (kit `pressed`).
//               Reduced motion = final state (stamp + slide collapse, count-up snaps).
//
// @rn-engine statement-reader|photo-reader|text-reader|open-banking — all semi-automatic sources
//   stage candidates here; none writes directly to the ledger.
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
//   • The count-up amount uses the kit's useCountUp (re-exported via theme). Review accepts statement
//     history; it does not rewrite the user's sourced current bank balance, so this panel describes
//     the real write instead of repeating the frozen prototype's false "you'll have £…" promise.
//   • The category chips are spend buckets (the web CATEGORIES list, verbatim). The active chip reads
//     accent-soft fill + terracotta text; the rest read surface + muted, faithful to the web. They
//     are disabled once stamped (the decision is sealed).
//   • The web's '←' glyph is kept as the shared react-native-svg BackArrow.
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring Melo + StartScreen.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Banned visible words (import / rows /
// parser / extraction / OCR / sync / dashboard / analytics / users / 100% / bank-grade / AI-powered /
// smart / provenance / source record / indexed) are absent. Copy is VERBATIM — the eyebrow / headline
// frame / card labels / chips / CTAs are @copy FROZEN inline literals (not keyed in COPY_DECK); the
// Melo line is its own frozen literal.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
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

import { elevation, gap, radius, serif, useCountUp, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { Melo } from '@/folio/melo/Melo';
import { copy } from '@/folio/copy/copy';
import {
  addIgnoredBankExternalId,
  addIgnoredReviewSig,
  addTransaction,
  forgetMerchantCategory,
  getState,
  resolveReviewItem,
  reviewCandidateSig,
  rememberMerchantCategory,
  useAppStore,
  type ReviewItem,
  type Transaction,
} from '@/folio/store';
import { reviewDateToIso, reviewMatch, reviewMatchSubline } from '@/folio/lib/reviewDedupe';
import { findCaughtIncome } from '@/folio/lib/caughtIncome';
import { findCaughtBills } from '@/folio/lib/caughtBills';
import { findDriftCandidates } from '@/folio/lib/caughtDrift';
import { findCaughtAnnual } from '@/folio/lib/caughtAnnual';
import { isOverspentLanding } from '@/folio/lib/storeRoute';
import { openEvidenceDocument } from '@/folio/lib/documentVault';
import { showStatusDialog } from '@/folio/ui/statusDialogs';
import { formatGBP } from '@/folio/screens/today/format';
import { formatEditableAmount } from '@/folio/screens/reviewFormat';
import type { Nav } from '@/folio/types';

// The single candidate this screen reviews — the eventual shape of one CandidateMoneyItem from a
// reader. `before` is the sourced current balance shown for context; Review never rewrites it.
export type ReviewCandidate = {
  /** The posted transaction id this candidate may correspond to, used only by duplicate matching. */
  id?: string;
  merchant: string;
  /** Magnitude in £ (always positive — `flow` carries the direction). */
  amount: number;
  flow: 'in' | 'out';
  date: string;
  before: number;
  /** Account selected at statement intake. Absent legacy/manual candidates use Main. */
  accountId?: string;
  sourceEvidenceId?: string;
  /** Present only for a row staged by Melo's Open Banking service. */
  source?: 'bank';
  externalId?: string;
  bankConnectionId?: string;
  /** The reader's suggested `Transaction['category']` bucket (model guess, or a
   *  merchant-memory recall — see `rememberedCategory`), when known. Used only
   *  to pre-select a chip below; the user's own tap always wins. */
  category?: Transaction['category'];
  /** Present and `true` only when `category` came from remembered merchant
   *  memory (`lib/merchantMemory.ts`), not a fresh model guess — drives the
   *  honest "remembered" caption rather than passing memory off as a fresh
   *  confident read. */
  rememberedCategory?: true;
};

// Hooks below require a stable candidate shape before the empty doorway returns. This sentinel is
// never rendered or accepted; unlike the inherited web placeholder it contains no sample merchant
// or financial data.
const NON_RENDERED_EMPTY_CANDIDATE: ReviewCandidate = {
  merchant: '',
  amount: 0,
  flow: 'out',
  date: '',
  before: 0,
};

// The category chips — the web CATEGORIES list, verbatim, PLUS 'Income' (task: income-category
// fix). An income-flow candidate must never be forced into a spend bucket like 'Groceries' — see
// `categoryFor`/`categoryLabelFor` below for the paired mapping this chip completes.
const PERSONAL_CATEGORIES = [
  'Groceries',
  'Transport',
  'Bills',
  'Eating out',
  'Subscription',
  'Shopping',
  'Income',
  'Other',
] as const;
// Pinned ScreenReview category order. Income is appended only for a real incoming candidate: the
// browser prototype did not model incoming review items, while native must keep the accepted record
// truthful instead of visually selecting a spend category for money in.
const SOURCE_PERSONAL_CATEGORIES = [
  'Groceries',
  'Transport',
  'Bills',
  'Eating out',
  'Subscription',
  'Shopping',
  'Other',
] as const;
const BUSINESS_CATEGORIES = [
  'Travel',
  'Software & services',
  'Supplies',
  'Client income',
  'Other',
] as const;
type Category = (typeof PERSONAL_CATEGORIES)[number] | (typeof BUSINESS_CATEGORIES)[number];

// The render states this screen can occupy.
export type ReviewState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type ReviewScreenProps = {
  nav: Nav;
  candidate?: ReviewCandidate;
  state?: ReviewState;
  /** The pinned Review tab mounts this decision surface in place, without a second safe area/header. */
  embedded?: boolean;
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

// Accepted-amount count-up duration (web useCountUp(..., 700)).
const COUNT_MS = 700;

// Map a chosen category chip → a Transaction category bucket, so an accepted item flows into the
// money path with an honest bucket. 'Income' -> 'income' (task: income-category fix — an income
// candidate must never store 'food' just because 'food' happened to be the default chip).
function categoryFor(label: Category): Transaction['category'] {
  switch (label) {
    case 'Groceries':
    case 'Eating out':
      return 'food';
    case 'Transport':
    case 'Travel':
      return 'transport';
    case 'Bills':
    case 'Subscription':
    case 'Software & services':
      return 'bills';
    case 'Shopping':
    case 'Supplies':
      return 'shopping';
    case 'Income':
    case 'Client income':
      return 'income';
    default:
      return 'other';
  }
}

// The reverse of `categoryFor`, for pre-selecting a chip from a candidate's incoming
// `Transaction['category']` bucket (a model guess or a merchant-memory recall). `categoryFor` is
// many-to-one (Groceries/Eating out both fold to 'food'; Bills/Subscription both fold to 'bills'), so
// this picks one representative chip per bucket — good enough for a pre-fill the user can still
// change; it is never used to grade correctness. 'income' -> 'Income' (task: income-category fix) so
// an income-flow candidate pre-selects the Income chip instead of falling through to the 'Groceries'
// default declared below.
function categoryLabelFor(bucket: Transaction['category'], business: boolean): Category | null {
  if (business) {
    switch (bucket) {
      case 'transport':
        return 'Travel';
      case 'bills':
        return 'Software & services';
      case 'shopping':
        return 'Supplies';
      case 'income':
        return 'Client income';
      default:
        return 'Other';
    }
  }
  switch (bucket) {
    case 'food':
      return 'Groceries';
    case 'transport':
      return 'Transport';
    case 'bills':
      return 'Bills';
    case 'shopping':
      return 'Shopping';
    case 'income':
      return 'Income';
    case 'other':
      return 'Other';
    default:
      return null;
  }
}

// Month names for the friendly date line — reviewDateToIso (lib/reviewDedupe.ts) parses this exact
// "26 June" form back to ISO, so the display and the suppression signature can never drift apart.
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

// Render an ISO YYYY-MM-DD as the card's friendly "26 June" form. A non-ISO or missing date returns
// the input unchanged — never invented, never reformatted on a guess.
function friendlyDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTH_NAMES[Number(m[2]) - 1];
  if (!month) return iso;
  return `${Number(m[3])} ${month}`;
}

// The caption noun for where a queued candidate came from — the web design's exact source mapping
// (TodayNudges.tsx: paste → "paste", pdf → "statement", image → "photo", anything else → "intake").
function sourceNoun(source: ReviewItem['source']): string {
  return source === 'paste'
    ? 'paste'
    : source === 'pdf'
      ? 'statement'
      : source === 'image'
        ? 'photo'
        : source === 'bank'
          ? 'bank connection'
          : 'intake';
}

// The known Transaction category buckets, for safely narrowing a ReviewItem's free-text `category`
// (a model guess, or a merchant-memory recall carried through queueInputFromCandidates — either way
// it is an untrusted string, not a validated union member). An unrecognised value is dropped rather
// than coerced, so a bad guess never mis-labels the pre-selected chip.
const KNOWN_CATEGORY_BUCKETS: ReadonlySet<Transaction['category']> = new Set([
  'food',
  'transport',
  'bills',
  'fun',
  'shopping',
  'income',
  'other',
]);
function asCategoryBucket(value: string | undefined): Transaction['category'] | undefined {
  if (value === undefined) return undefined;
  return KNOWN_CATEGORY_BUCKETS.has(value as Transaction['category'])
    ? (value as Transaction['category'])
    : undefined;
}

// Thread one queued ReviewItem into this screen's candidate shape. `id` is intentionally OMITTED —
// a queued candidate is not a posted fact (review-before-truth). `date` keeps the item's raw ISO
// (or '' when the reader pinned none) so the
// de-dupe engine and the Ignore signature read the exact stored value; display formats separately.
// `category`/`rememberedCategory` carry the reader's guess or a merchant-memory recall
// (DATA_INTELLIGENCE.md phase ③) through to pre-select a chip + show honest provenance.
function candidateFromQueueItem(item: ReviewItem, before: number): ReviewCandidate {
  const bucket = asCategoryBucket(item.category);
  return {
    merchant: item.merchant,
    amount: Math.abs(item.amount),
    flow: item.amount < 0 ? 'out' : 'in',
    date: item.date ?? '',
    before,
    ...(item.accountId !== undefined ? { accountId: item.accountId } : {}),
    ...(item.sourceEvidenceId !== undefined ? { sourceEvidenceId: item.sourceEvidenceId } : {}),
    ...(item.source === 'bank' ? { source: 'bank' as const } : {}),
    ...(item.externalId !== undefined ? { externalId: item.externalId } : {}),
    ...(item.bankConnectionId !== undefined ? { bankConnectionId: item.bankConnectionId } : {}),
    ...(bucket !== undefined ? { category: bucket } : {}),
    ...(bucket !== undefined && item.rememberedCategory
      ? { rememberedCategory: true as const }
      : {}),
  };
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
  embedded = false,
}: ReviewScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const workspaceKind = useAppStore(
    (current) =>
      current.workspaces.find((workspace) => workspace.id === current.activeWorkspaceId)?.kind ??
      'personal',
  );
  const isBusiness = workspaceKind === 'business';
  const categories: readonly Category[] = isBusiness ? BUSINESS_CATEGORIES : PERSONAL_CATEGORIES;
  const workspace = useAppStore(
    (current) =>
      current.workspaces.find((candidate) => candidate.id === current.activeWorkspaceId)!,
  );
  const evidenceDocuments = useAppStore((current) => current.evidenceDocuments);

  // Queue consumption (web ScreenReview.tsx `reviewQueue[0]`): with no direct candidate prop, the
  // screen reviews the NEXT queued intake candidate. Frozen ONCE at mount (useState initializer) so
  // the card never flips mid-decision when the queue shrinks — the web got the same stability from
  // its nav.bumpReview() re-key; here the shell re-mounts the screen on every visit, so the next
  // visit picks up the next queued item. `before` is the live balance at mount, mirroring the web's
  // store read.
  const [queued] = useState<{ item: ReviewItem; count: number } | null>(() => {
    if (candidateProp !== undefined) return null;
    const queue = getState().reviewQueue ?? [];
    const top = queue[0];
    return top ? { item: top, count: queue.length } : null;
  });
  const queuedCandidate = useMemo(
    () => (queued ? candidateFromQueueItem(queued.item, getState().currentBalance.amount) : null),
    [queued],
  );

  // Whether a REAL candidate was handed in — directly as a prop, or pulled from the persisted
  // review queue. A cold open from the shell (FolioShell renders <ReviewScreen nav={nav} /> with no
  // candidate — e.g. the Intake "Add numbers yourself" path) with an EMPTY queue passes none. We
  // never fabricate a sample row in that case: the empty doorway shows below, so the user can never
  // accidentally add fake data as a real transaction. The non-rendered empty sentinel exists only
  // so hooks and derivations below never read undefined.
  const hasRealCandidate = candidateProp !== undefined || queuedCandidate !== null;
  const candidate = candidateProp ?? queuedCandidate ?? NON_RENDERED_EMPTY_CANDIDATE;
  const sourceEvidence = useMemo(
    () =>
      candidate.sourceEvidenceId === undefined
        ? undefined
        : evidenceDocuments?.find((document) => document.id === candidate.sourceEvidenceId),
    [candidate.sourceEvidenceId, evidenceDocuments],
  );

  const openSourceEvidence = () => {
    if (sourceEvidence === undefined) return;
    void openEvidenceDocument(workspace, sourceEvidence).catch((reason: unknown) => {
      showStatusDialog('dialog.review-source-open-failed', {
        message: reason instanceof Error ? reason.message : undefined,
      });
    });
  };

  const [stamped, setStamped] = useState(false);
  // Pre-select the chip from the candidate's incoming category (a model guess, or a merchant-memory
  // recall — DATA_INTELLIGENCE.md phase ③) when one resolves to a known chip. Falling further back:
  // an 'in'-flow candidate with no usable category guess pre-selects 'Income' rather than the spend
  // default (task: income-category fix — a bare income row must never land on 'Groceries' just
  // because that's the first chip in the list). An out-flow candidate with no guess falls back to
  // 'Other', not the first chip: the device pass proved "Landlord rent" was otherwise presented as
  // groceries despite carrying no evidence for that category. `categoryLabelFor` is the reverse of
  // `categoryFor` below. Lazy
  // initializer — evaluated once at mount, exactly like the merchant/amount seeds below.
  const [category, setCategory] = useState<Category>(() => {
    // ScreenReview @ ad90b4f opens personal spend review on Groceries. Incoming money is the one
    // native authority the browser fixture did not model, so it keeps an honest Income default.
    if (embedded && !isBusiness) return candidate.flow === 'in' ? 'Income' : 'Groceries';
    return (
      (candidate.category !== undefined
        ? categoryLabelFor(candidate.category, isBusiness)
        : null) ?? (candidate.flow === 'in' ? (isBusiness ? 'Client income' : 'Income') : 'Other')
    );
  });
  // Whether the chip is still showing an untouched merchant-memory recall — drives the "remembered"
  // caption. Any manual chip tap (including re-picking the same label) counts as the user's own
  // decision, so the caption clears rather than misrepresenting a fresh tap as passive memory.
  const [showingRecall, setShowingRecall] = useState(
    () => candidate.rememberedCategory === true && candidate.category !== undefined,
  );

  // Web-exact inline edit (ScreenReview.tsx): merchant and amount-out are corrected directly on the
  // review card before Add, not in a separate sheet. Seeded from the candidate; the candidate itself
  // is never mutated — only the local draft, which is what Accept actually records.
  const [merchant, setMerchant] = useState(candidate.merchant);
  const [amountText, setAmountText] = useState(() => formatEditableAmount(candidate.amount));
  const editedAmount = Math.max(0, Number(amountText.replace(/,/g, '')) || 0);

  // Existing rows + a mount-gated clock, for the de-dupe proposal (ENGINES §8 / the dedupe engine):
  // when the candidate looks like a transaction the user ALREADY added, Review PROPOSES a link rather
  // than silently double-counting. Read reactively so a just-added row is considered.
  const transactions = useAppStore((st) => st.transactions);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const signedDelta = candidate.flow === 'out' ? -editedAmount : editedAmount;
  const previewAmount = useCountUp(editedAmount, COUNT_MS, reduceMotion);

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
        merchant,
      },
      transactions,
      now.toISOString().slice(0, 10),
    );
  }, [hasRealCandidate, stamped, now, candidate, signedDelta, merchant, transactions]);

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
    if (stamped || editedAmount <= 0) return;
    setStamped(true);
    const finalMerchant = merchant.trim() || 'Unnamed';
    const finalCategory = categoryFor(category);
    const statementDate = reviewDateToIso(
      candidate.date,
      now?.getFullYear() ?? new Date().getFullYear(),
    );
    addTransaction({
      merchant: finalMerchant,
      amount: signedDelta,
      category: finalCategory,
      source: candidate.source === 'bank' ? 'bank' : 'manual',
      ...(statementDate !== null ? { when: `${statementDate}T00:00:00.000Z` } : {}),
      ...(candidate.accountId !== undefined ? { accountId: candidate.accountId } : {}),
      ...(candidate.sourceEvidenceId !== undefined
        ? { sourceEvidenceId: candidate.sourceEvidenceId }
        : {}),
      ...(candidate.externalId !== undefined ? { externalId: candidate.externalId } : {}),
      ...(candidate.bankConnectionId !== undefined
        ? { bankConnectionId: candidate.bankConnectionId }
        : {}),
    });
    // LEARN (lib/merchantMemory.ts, DATA_INTELLIGENCE.md phase ③): every Accept confirms this
    // merchant's category — whether the user changed the chip away from the incoming guess, or left
    // it as-is. A passive accept of a correct guess is still a confirmation (rememberMerchantCategory
    // dedupes via hits++ on a repeat), so re-imports stop re-asking the same question forever.
    rememberMerchantCategory(finalMerchant, finalCategory);
    // Drain the queued item this card was showing so the Today chip decrements
    // (web ScreenReview.tsx: `if (topCandidate) resolveReviewItem(topCandidate.id)`).
    // No-op when the card came from a direct candidate prop.
    if (queued) resolveReviewItem(queued.item.id, 'accepted');
    if (!reduceMotion) {
      stampScale.value = withSequence(
        withTiming(1.12, { duration: STAMP_MS * 0.6, easing: STAMP_EASE }),
        withTiming(1, { duration: STAMP_MS * 0.4, easing: STAMP_EASE }),
      );
    } else {
      stampScale.value = 1;
    }
    // Income-signal check (DATA_INTELLIGENCE.md phase ②) — run over the ledger
    // AFTER this accept has landed. Propose-and-confirm only: this opens the
    // sheet after the stamp's dwell, it never writes an IncomeSource itself.
    // No-op when nothing qualifies, so the ordinary Today dwell-route is
    // unaffected for the common case.
    //
    // Bill-signal check (DATA_INTELLIGENCE.md phase ⑤(B)) runs the same way, but income takes
    // precedence when BOTH fire on the same landing — only one caught-sheet opens per landing; a
    // qualifying bill simply re-evaluates fresh next time a batch lands (see VisualizerScreen.commit
    // for the identical ordering + rationale).
    //
    // Drift + annual-radar checks (DATA_INTELLIGENCE.md phase ⑥) extend the SAME ordering, ranked
    // BELOW income-caught and bill-caught (see VisualizerScreen.commit's identical extended ordering
    // comment) — each only evaluated when nothing higher in the order already qualified, so at most
    // one of the four ever computes past the first hit.
    //
    // QUIET-MOMENT GATE (task: never-pressure-during-danger spirit): none of the four proposal checks
    // even run when this landing's money state is overspent — Melo asking "update your pay?" or
    // "spotted a recurring bill?" while the verdict line is already "something has to move" would work
    // against the app's own tone. A suppressed proposal is DEFERRED, not lost: every check below is
    // already re-evaluated fresh on the NEXT landing (see the ordering comment above), so whatever
    // would have qualified here simply gets its turn once the user is out of the danger band.
    const stateAfterAdd = getState();
    const overspent = !isBusiness && isOverspentLanding(stateAfterAdd);
    const incomeSignals =
      isBusiness || overspent
        ? []
        : findCaughtIncome(
            stateAfterAdd.transactions,
            stateAfterAdd.incomeSources ?? [],
            stateAfterAdd.dismissedIncomeSignals ?? [],
          );
    const billSignals =
      isBusiness || overspent || incomeSignals.length > 0
        ? []
        : findCaughtBills(
            stateAfterAdd.transactions,
            stateAfterAdd.subs.map((s) => s.name),
            stateAfterAdd.dismissedBillSignals ?? [],
          );
    const driftSignals =
      isBusiness || overspent || incomeSignals.length > 0 || billSignals.length > 0
        ? []
        : findDriftCandidates(
            stateAfterAdd.transactions,
            stateAfterAdd.incomeSources ?? [],
            stateAfterAdd.subs,
            stateAfterAdd.dismissedDriftSignals ?? [],
          );
    const annualSignals =
      isBusiness ||
      overspent ||
      incomeSignals.length > 0 ||
      billSignals.length > 0 ||
      driftSignals.length > 0
        ? []
        : findCaughtAnnual(
            stateAfterAdd.transactions,
            stateAfterAdd.dismissedAnnualSignals ?? [],
            stateAfterAdd.subs.map((s) => s.name),
          );
    dwellRef.current = setTimeout(
      () => {
        if (incomeSignals.length > 0) {
          nav.openSheet('income-caught');
        } else if (billSignals.length > 0) {
          nav.openSheet('bill-caught');
        } else if (driftSignals.length > 0) {
          nav.openSheet('drift-caught');
        } else if (annualSignals.length > 0) {
          nav.openSheet('annual-caught');
        } else {
          nav.go('today');
        }
      },
      reduceMotion ? 0 : ADD_DWELL_MS,
    );
  }

  // Link them — the candidate is the same as an existing row, so we DON'T add a duplicate: no double
  // count, the existing row is untouched. Nothing is created or destroyed here, so the decision is
  // reversible (the user can re-add from intake). Route to Today, like any completed decision.
  function onLink() {
    if (stamped) return;
    if (queued) resolveReviewItem(queued.item.id, 'linked');
    nav.go('today');
  }

  // Ignore — mirrors the web source's ignoreReviewItem exactly: record the candidate's signature
  // (merchant|amountCents|date, store.ts reviewCandidateSig) so HiddenReviewSheet can list it and the
  // user can un-hide it later, and so a future intake with the exact same merchant/amount/date is
  // suppressed rather than nagging again (ENGINES.md §6). Only real candidates have a signature worth
  // recording — the pre-truth SAMPLE/empty-doorway path has nothing to suppress.
  function onIgnore() {
    if (hasRealCandidate) {
      if (candidate.externalId !== undefined) {
        addIgnoredBankExternalId(candidate.externalId);
      } else {
        const year = now?.getFullYear() ?? new Date().getFullYear();
        const dateIso = reviewDateToIso(candidate.date, year) ?? candidate.date;
        addIgnoredReviewSig(reviewCandidateSig(merchant, signedDelta, dateIso), merchant);
      }
      // A queued candidate also leaves the queue (web ignoreReviewItem drops the item AND records
      // its signature; RN composes the same outcome from the two store actions).
      if (queued) resolveReviewItem(queued.item.id, 'ignored');
    }
    nav.back();
  }

  // Cancel — web ScreenReview.tsx's plain Cancel button: backs out with NO side effect at all (no
  // suppression signature, unlike Ignore). The edited draft is simply discarded.
  function onCancel() {
    if (stamped) return;
    nav.back();
  }

  // The personal Review TAB owns the pinned browser composition directly. The native decision
  // authorities above remain unchanged: this branch is presentation only, and its Add / Ignore /
  // Cancel actions call the same review-before-truth handlers as the standalone detail route.
  if (embedded && !isBusiness) {
    if (state === 'loading') {
      return (
        <View style={[sourceStyles.loading, { backgroundColor: t.canvas }]}>
          <MeloLine mood="curious" text="One second — getting this ready for you." />
        </View>
      );
    }

    if (state === 'empty' || !hasRealCandidate) {
      return (
        <Animated.View style={[sourceStyles.root, enterStyle, { backgroundColor: t.canvas }]}>
          <View style={sourceStyles.emptyContent}>
            <View style={sourceStyles.emptyRow}>
              <View style={sourceStyles.emptyMelo}>
                <Melo mood="calm" size={56} />
              </View>
              <View style={sourceStyles.emptyCopy}>
                <Text style={[sourceStyles.emptyHeadline, { color: t.ink }]}>
                  Nothing waiting to be <Text style={{ color: t.calm }}>checked</Text>.
                </Text>
                <Text style={[sourceStyles.emptyBody, { color: t.muted }]}>
                  When Melo finds something new, it will show up here first.
                </Text>
              </View>
            </View>
            {(getState().ignoredReviewSigs ?? []).length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.openSheet('hidden-review')}
                style={({ pressed: isPressed }) => [
                  sourceStyles.hiddenButton,
                  { borderColor: t.hairline },
                  isPressed ? sourceStyles.pressed : undefined,
                ]}
              >
                <Text style={[sourceStyles.hiddenLabel, { color: t.muted }]}>
                  {(getState().ignoredReviewSigs ?? []).length} hidden · un-hide
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      );
    }

    const sourceCategories: readonly Category[] =
      candidate.flow === 'in'
        ? ([...SOURCE_PERSONAL_CATEGORIES, 'Income'] as const)
        : SOURCE_PERSONAL_CATEGORIES;
    const afterAmount = Math.max(
      0,
      candidate.before + (candidate.flow === 'out' ? -editedAmount : editedAmount),
    );
    const hidden = (getState().ignoredReviewSigs ?? []).length;

    return (
      <Animated.View style={[sourceStyles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <ScrollView
          contentContainerStyle={sourceStyles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[sourceStyles.eyebrow, { color: t.muted }]}>New transaction found</Text>

          {hidden > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.openSheet('hidden-review')}
              style={sourceStyles.hiddenInline}
            >
              <Text style={[sourceStyles.hiddenInlineLabel, { color: t.muted }]}>
                {hidden} hidden · un-hide
              </Text>
            </Pressable>
          ) : null}

          <View style={sourceStyles.hero}>
            {stamped ? (
              <Animated.View
                pointerEvents="none"
                style={[sourceStyles.stamp, stampStyle, { borderColor: t.calm }]}
              >
                <Text style={[sourceStyles.stampLabel, { color: t.calm }]}>Added</Text>
              </Animated.View>
            ) : null}
            <View style={[sourceStyles.merchantRule, { borderBottomColor: t.hairline }]}>
              <TextInput
                accessibilityLabel="Merchant"
                editable={!stamped}
                onChangeText={setMerchant}
                style={[sourceStyles.merchantInput, { color: t.ink }]}
                value={merchant}
              />
            </View>
            <View style={sourceStyles.amountRow}>
              <Text style={[sourceStyles.amountPrefix, { color: t.ink }]}>
                {candidate.flow === 'out' ? '−£' : '+£'}
              </Text>
              <TextInput
                accessibilityLabel="Amount"
                editable={!stamped}
                inputMode="decimal"
                keyboardType="decimal-pad"
                onChangeText={setAmountText}
                style={[
                  sourceStyles.amountValue,
                  { color: t.ink, width: Math.max(40, amountText.length * 31) },
                ]}
                value={amountText}
              />
            </View>
            <Text style={[sourceStyles.editHint, { color: t.muted }]}>Tap to edit</Text>
          </View>

          <View
            style={[
              sourceStyles.balanceShift,
              { backgroundColor: t.surface, borderColor: t.hairline },
            ]}
          >
            <View>
              <Text style={[sourceStyles.balanceLabel, { color: t.muted }]}>Now</Text>
              <Text style={[sourceStyles.balanceValue, { color: t.ink }]}>
                {formatGBP(candidate.before)}
              </Text>
            </View>
            <View style={sourceStyles.balanceArrow}>
              <View style={[sourceStyles.arrowRule, { backgroundColor: t.hairline }]} />
              <Text style={[sourceStyles.arrowGlyph, { color: t.muted }]}>→</Text>
              <View style={[sourceStyles.arrowRule, { backgroundColor: t.hairline }]} />
            </View>
            <View style={sourceStyles.afterBlock}>
              <Text style={[sourceStyles.balanceLabel, { color: t.muted }]}>After</Text>
              <Text style={[sourceStyles.balanceValue, { color: t.calm }]}>
                {formatGBP(Math.round(afterAmount))}
              </Text>
            </View>
          </View>

          <View style={sourceStyles.categoryBlock}>
            <Text style={[sourceStyles.categoryEyebrow, { color: t.muted }]}>Category</Text>
            <View style={sourceStyles.chipRow}>
              {sourceCategories.map((item) => {
                const active = item === category;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: stamped }}
                    disabled={stamped}
                    onPress={() => {
                      setCategory(item);
                      setShowingRecall(false);
                    }}
                    style={({ pressed: isPressed }) => [
                      sourceStyles.chip,
                      {
                        backgroundColor: active ? t.calm : 'transparent',
                        borderColor: active ? t.calm : t.hairline,
                      },
                      isPressed ? sourceStyles.pressed : undefined,
                    ]}
                  >
                    <Text style={[sourceStyles.chipLabel, { color: active ? t.inverse : t.muted }]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={sourceStyles.spacer} />

          {dupeProposal && !stamped ? (
            <View
              style={[sourceStyles.dupeCard, { backgroundColor: t.calmSoft, borderColor: t.calm }]}
            >
              <Text style={[sourceStyles.dupeHead, { color: t.ink }]}>
                This looks like something you already added.
              </Text>
              <Text style={[sourceStyles.dupeSub, { color: t.muted }]}>
                {reviewMatchSubline(dupeProposal)}
              </Text>
              <View style={sourceStyles.dupeRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onLink}
                  style={({ pressed: isPressed }) => [
                    sourceStyles.dupePrimary,
                    { backgroundColor: t.calm },
                    isPressed ? sourceStyles.pressed : undefined,
                  ]}
                >
                  <Text style={[sourceStyles.dupePrimaryLabel, { color: t.inverse }]}>
                    Link them
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onAdd}
                  style={({ pressed: isPressed }) => [
                    sourceStyles.dupeCell,
                    { backgroundColor: t.surface, borderColor: t.hairline },
                    isPressed ? sourceStyles.pressed : undefined,
                  ]}
                >
                  <Text style={[sourceStyles.secondaryLabel, { color: t.ink }]}>Keep both</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={onIgnore}
                style={({ pressed: isPressed }) => [
                  sourceStyles.dupeIgnore,
                  { backgroundColor: t.surface, borderColor: t.hairline },
                  isPressed ? sourceStyles.pressed : undefined,
                ]}
              >
                <Text style={[sourceStyles.secondaryLabel, { color: t.ink }]}>Ignore</Text>
              </Pressable>
              <Text style={[sourceStyles.dupeFoot, { color: t.muted }]}>
                Linking keeps your original.
              </Text>
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: stamped || editedAmount <= 0 }}
                disabled={stamped || editedAmount <= 0}
                onPress={onAdd}
                style={({ pressed: isPressed }) => [
                  sourceStyles.primary,
                  { backgroundColor: t.calm },
                  stamped || editedAmount <= 0 ? sourceStyles.disabled : undefined,
                  isPressed ? sourceStyles.pressed : undefined,
                ]}
              >
                <Text style={[sourceStyles.primaryLabel, { color: t.inverse }]}>
                  {stamped ? 'Added' : 'Add to '}
                  {!stamped ? <Text style={sourceStyles.meloWord}>Melo</Text> : null}
                </Text>
              </Pressable>

              <View style={sourceStyles.secondaryRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={stamped}
                  onPress={onIgnore}
                  style={({ pressed: isPressed }) => [
                    sourceStyles.ignoreButton,
                    { borderColor: t.hairline },
                    isPressed ? sourceStyles.pressed : undefined,
                  ]}
                >
                  <Text style={[sourceStyles.secondaryLabel, { color: t.muted }]}>
                    Ignore permanently
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onCancel}
                  style={({ pressed: isPressed }) => [
                    sourceStyles.cancelButton,
                    isPressed ? sourceStyles.pressed : undefined,
                  ]}
                >
                  <Text style={[sourceStyles.secondaryLabel, { color: t.muted }]}>Cancel</Text>
                </Pressable>
              </View>
            </>
          )}
          <View style={sourceStyles.bottomSpace} />
        </ScrollView>
      </Animated.View>
    );
  }

  // empty — no candidate to review: an explicit empty state, OR a cold open with no candidate passed
  // (we show the doorway instead of a fabricated sample row). Routes to intake rather than dead-ending.
  if (state === 'empty' || !hasRealCandidate) {
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <View style={[styles.emptyWrap, { paddingTop: insets.top + gap.xxl }]}>
          <MeloLine
            mood="calm"
            text={
              isBusiness
                ? "Nothing to review in this business yet. Add a statement or receipt and I'll show what I find."
                : "Nothing to review yet. Add a statement and I'll show what I find."
            }
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
  const balanceLine = isBusiness
    ? `to Business activity · current cash stays ${formatGBP(candidate.before)}`
    : `to your history · balance stays ${formatGBP(candidate.before)}`;

  // Position + provenance. Queue-fed cards read honestly from the queue ("1 of N", the item's own
  // intake source); the direct-candidate path keeps its original literals byte-for-byte.
  const positionLabel = queued ? `1 of ${queued.count}` : '1 of 3';
  const provenance = queued ? `from your ${sourceNoun(queued.item.source)}` : 'from your statement';
  const dateLine = candidate.date ? `${friendlyDate(candidate.date)} · ${provenance}` : provenance;

  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back glyph · real queue position. The trailing spacer keeps the counter centred;
            a candidate is already editable inline, so it must not open the posted-transaction sheet. */}
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
          <Text
            accessibilityLabel={`Item ${positionLabel}`}
            style={[styles.position, { color: t.muted }]}
          >
            {positionLabel}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Intro — italic "Review" kicker + the headline with the merchant as the single accent word. */}
        <View style={styles.intro}>
          <Text style={[styles.kicker, { color: t.muted }]}>Review</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {isBusiness ? 'Is this a Business ' : 'Is this your '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>
              {merchant.trim() || candidate.merchant}
            </Text>
            {isBusiness ? ' record?' : ' payment?'}
          </Text>
        </View>

        {/* The review card — amount, date, and the exact record accepting it will create. */}
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

          {/* Merchant — web-exact inline edit (ScreenReview.tsx): underlined text input directly on
              the card, corrected before Add rather than in a separate sheet. */}
          <View style={styles.merchantField}>
            <Text style={[styles.fieldLabel, { color: t.muted }]}>Merchant</Text>
            <TextInput
              accessibilityLabel="Merchant"
              editable={!stamped}
              onChangeText={setMerchant}
              style={[
                styles.merchantInput,
                { borderBottomColor: t.hairline, color: t.ink },
                stamped ? styles.inputDisabled : undefined,
              ]}
              value={merchant}
            />
          </View>

          <View style={styles.amountHeaderRow}>
            <Text style={[styles.fieldLabel, { color: t.muted }]}>
              {isOut ? 'Amount out' : 'Amount in'}
            </Text>
            <Text style={[styles.outLabel, { color: t.muted }]}>{isOut ? 'out' : 'in'}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={[styles.amountPrefix, { color: t.ink }]}>£</Text>
            <TextInput
              accessibilityLabel={isOut ? 'Amount out' : 'Amount in'}
              editable={!stamped}
              inputMode="decimal"
              keyboardType="decimal-pad"
              onChangeText={setAmountText}
              style={[
                styles.amountValue,
                { color: t.ink },
                stamped ? styles.inputDisabled : undefined,
              ]}
              value={amountText}
            />
          </View>
          <Text style={[styles.dateLine, { color: t.muted }]}>{dateLine}</Text>

          {sourceEvidence !== undefined ? (
            <Pressable
              accessibilityHint="Decrypts a temporary copy and opens the device share or viewer sheet"
              accessibilityLabel={`Open saved source, ${sourceEvidence.filename}`}
              accessibilityRole="button"
              onPress={openSourceEvidence}
              style={({ pressed: isPressed }) => [
                styles.sourceEvidence,
                { backgroundColor: t.inset },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <View style={styles.sourceEvidenceText}>
                <Text numberOfLines={1} style={[styles.sourceEvidenceName, { color: t.ink }]}>
                  {sourceEvidence.filename}
                </Text>
                <Text style={[styles.sourceEvidenceHint, { color: t.muted }]}>Saved source</Text>
              </View>
              <Text style={[styles.sourceEvidenceAction, { color: t.calm }]}>Open</Text>
            </Pressable>
          ) : null}

          <View style={[styles.cardDivider, { backgroundColor: t.hairline }]} />

          <View style={styles.projectionRow}>
            <View style={[styles.projIcon, { backgroundColor: t.calmSoft }]}>
              <Text style={[styles.projGlyph, { color: t.calm }]}>{isOut ? '−' : '+'}</Text>
            </View>
            <View accessibilityLiveRegion="polite" style={styles.projBody}>
              <Text style={[styles.projLead, { color: t.ink }]}>
                {isBusiness
                  ? isOut
                    ? 'This will add a business expense of'
                    : 'This will add business income of'
                  : isOut
                    ? 'This will add a spend of'
                    : 'This will add income of'}
              </Text>
              <Text style={[styles.projBalance, { color: t.ink }]}>{formatGBP(previewAmount)}</Text>
              <Text style={[styles.projDelta, { color: t.muted }]}>{balanceLine}</Text>
            </View>
          </View>
        </View>

        {/* Category chips. */}
        <View style={styles.catBlock}>
          <Text style={[styles.catLabel, { color: t.muted }]}>
            {isBusiness
              ? 'How should this business record be labelled?'
              : 'What kind of money is this?'}
          </Text>
          <View style={styles.chipRow}>
            {categories.map((c) => {
              const active = c === category;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: stamped }}
                  disabled={stamped}
                  onPress={() => {
                    setCategory(c);
                    // Any manual tap — even re-picking the same chip — is the user's own decision,
                    // not a passive memory recall, so the "remembered" caption clears.
                    setShowingRecall(false);
                  }}
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
          {/* Provenance caption (DATA_INTELLIGENCE.md phase ③, honesty discipline): shown ONLY while
              the chip still reflects an untouched merchant-memory recall — never for a fresh model
              guess, and cleared the moment the user taps any chip themselves. Tappable: lets the user
              forget this merchant's memory outright without disturbing their current chip pick. */}
          {showingRecall ? (
            <Pressable
              accessibilityHint="Removes the remembered category for this merchant"
              accessibilityLabel="Forget this remembered category"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                forgetMerchantCategory(merchant);
                setShowingRecall(false);
              }}
            >
              <Text style={[styles.catRemembered, { color: t.muted }]}>
                {copy.add.review.remembered} · {copy.add.review.forget}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Melo line — the quiet companion, calm mood. MeloLine adds the straight quotes. */}
        <View style={styles.meloBlock}>
          <MeloLine
            mood="calm"
            text={
              isBusiness
                ? 'This stays a proposal until you add it to Business activity.'
                : 'Take your time. You can change this later.'
            }
          />
        </View>

        {/* Spacer pins the CTAs to the bottom, mirroring the web flex-1 spacer. */}
        <View style={styles.spacer} />

        {dupeProposal && !stamped ? (
          /* De-dupe proposal — "This looks like something you already added." Propose, never
             auto-merge (ENGINES §8 / the dedupe engine): Link them (adds NOTHING — no double count) ·
            Keep both (the normal Add) · edit inline above · Ignore (records the suppression).
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
            <Text style={[styles.dupeFoot, { color: t.muted }]}>
              Need to change it? Edit the fields above first.
            </Text>
            <View style={styles.dupeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ignore the imported one"
                onPress={onIgnore}
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
            {/* Primary CTA — the dominant "Add to my picture"; reads "Added…" once sealed. Web-exact
                disabled guard: sealed OR the edited amount is zero/blank. */}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: stamped || editedAmount <= 0 }}
              accessibilityLabel={
                stamped
                  ? isBusiness
                    ? 'Added to Business activity'
                    : 'Added to your picture'
                  : isBusiness
                    ? 'Add to Business activity'
                    : 'Add to my picture'
              }
              disabled={stamped || editedAmount <= 0}
              onPress={onAdd}
              style={({ pressed: isPressed }) => [
                styles.primary,
                { backgroundColor: t.calm },
                stamped || editedAmount <= 0 ? styles.primaryStamped : undefined,
                isPressed && !stamped && editedAmount > 0 ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.primaryLabel, { color: t.inverse }]}>
                {stamped
                  ? isBusiness
                    ? 'Added to Business activity'
                    : 'Added to your picture'
                  : isBusiness
                    ? 'Add to Business activity'
                    : 'Add to my picture'}
              </Text>
            </Pressable>

            {/* Secondary row: Ignore records a suppression signature; Cancel backs out with no side
                effect and discards the inline draft. */}
            <View style={styles.secondaryRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ignore"
                disabled={stamped}
                onPress={onIgnore}
                style={({ pressed: isPressed }) => [
                  styles.secondaryCell,
                  { backgroundColor: t.surface, borderColor: t.hairline },
                  isPressed && !stamped ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.secondaryLabel, { color: t.ink }]}>Ignore</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onCancel}
                style={({ pressed: isPressed }) => [
                  styles.secondaryCell,
                  { backgroundColor: t.surface, borderColor: t.hairline },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.secondaryLabel, { color: t.ink }]}>Cancel</Text>
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
  headerSpacer: {
    height: 44,
    width: 24,
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
  // Merchant field — web-exact (ScreenReview.tsx label className="text-[10.5px] uppercase
  // tracking-[0.12em]"): a tiny uppercase-tracked label over an underlined inline text input.
  merchantField: {
    marginTop: 0,
  },
  fieldLabel: {
    fontSize: 10.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  // Web: "mt-1 w-full ... text-[18px] font-medium ... border-b border-hairline py-1".
  merchantInput: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    fontSize: 18,
    fontWeight: '500',
    marginTop: gap.xs,
    paddingVertical: gap.xs,
  },
  // Web: "mt-4 flex items-baseline justify-between" above the amount row.
  amountHeaderRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.lg,
  },
  // 12px uppercase tracked muted (web "text-[12px] uppercase tracking-[0.14em]").
  outLabel: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  // Amount row — the big £ prefix + the inline number input, baseline aligned (web "mt-1 flex
  // items-baseline gap-1").
  amountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    marginTop: gap.xs,
  },
  amountPrefix: {
    fontFamily: serif.display,
    fontSize: 36,
    fontVariant: ['tabular-nums'],
    marginRight: gap.xxs,
  },
  // Money size 36px, Fraunces, tabular (web "font-display tabular text-[36px]"), flexed to fill
  // the row like the web's `w-full` input.
  amountValue: {
    flex: 1,
    fontFamily: serif.display,
    fontSize: 36,
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  // 13px muted, mt-3.
  dateLine: {
    fontSize: 13,
    marginTop: gap.md,
  },
  sourceEvidence: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    marginTop: gap.md,
    minHeight: 48,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
  },
  sourceEvidenceText: {
    flex: 1,
    minWidth: 0,
  },
  sourceEvidenceName: {
    fontSize: 13,
    fontWeight: '500',
  },
  sourceEvidenceHint: {
    fontSize: 11,
    marginTop: gap.xxs,
  },
  sourceEvidenceAction: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: gap.md,
  },
  // h-px divider, mt-6.
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
  },
  // Acceptance-effect row — sign icon + amount/history copy, gap-3, mt-5.
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
  // Fraunces 28px tabular accepted amount, mt-0.5.
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
  // Merchant-memory provenance caption (DATA_INTELLIGENCE.md phase ③) — small muted note under the
  // chip row, matching the existing muted-caption pattern (dateLine/projDelta: 12-13px muted, small
  // top margin). Never bold, never the accent colour — this is a quiet aside, not a call to action.
  catRemembered: {
    fontSize: 12,
    marginTop: gap.xs,
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

// ScreenReview.tsx @ ad90b4f — local geometry for the embedded personal composition. Kept local so
// the parity recovery does not mutate shared kit/shell tokens while another lane calibrates them.
const sourceStyles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingBottom: gap.xl,
    paddingHorizontal: gap.xl,
    paddingTop: gap.lg,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
    paddingTop: gap.lg,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: gap.xl,
    paddingHorizontal: gap.xl,
    paddingTop: gap.lg,
  },
  emptyRow: { alignItems: 'center', flexDirection: 'row', gap: gap.lg },
  emptyMelo: { alignItems: 'center', height: 64, justifyContent: 'center', width: 64 },
  emptyCopy: { flex: 1, minWidth: 0 },
  emptyHeadline: { fontFamily: serif.display, fontSize: 28, lineHeight: 32 },
  emptyBody: { fontSize: 14, lineHeight: 22, marginTop: gap.md, maxWidth: 240 },
  hiddenButton: {
    alignSelf: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    marginTop: gap.lg + gap.xs,
    minHeight: 44,
    paddingHorizontal: gap.lg,
  },
  hiddenLabel: { fontSize: 12.5 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.76,
    marginTop: gap.xl,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  hiddenInline: { alignItems: 'center', marginTop: gap.sm },
  hiddenInlineLabel: {
    fontFamily: serif.displayItalic,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  hero: { marginTop: gap.lg + gap.xs, position: 'relative' },
  stamp: {
    borderRadius: radius.pill,
    borderWidth: 2,
    paddingHorizontal: gap.md,
    paddingVertical: gap.xs,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  stampLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.98, textTransform: 'uppercase' },
  merchantRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' },
  merchantInput: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.3,
    padding: 0,
    paddingBottom: gap.xs,
    textAlign: 'center',
  },
  amountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: gap.lg,
  },
  amountPrefix: {
    fontFamily: serif.display,
    fontSize: 56,
    fontVariant: ['tabular-nums'],
    fontWeight: '400',
    lineHeight: 57,
  },
  amountValue: {
    fontFamily: serif.display,
    fontSize: 56,
    fontVariant: ['tabular-nums'],
    fontWeight: '400',
    lineHeight: 57,
    padding: 0,
  },
  editHint: { fontSize: 11, marginTop: gap.sm, textAlign: 'center' },
  balanceShift: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: gap.md,
    marginTop: gap.xl + gap.xs,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.lg,
  },
  balanceLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase' },
  balanceValue: {
    fontFamily: serif.display,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    marginTop: gap.xs,
  },
  balanceArrow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: gap.xs },
  arrowRule: { flex: 1, height: StyleSheet.hairlineWidth },
  arrowGlyph: { fontSize: 14, lineHeight: 16 },
  afterBlock: { alignItems: 'flex-end' },
  categoryBlock: { marginTop: gap.xl },
  categoryEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    marginBottom: gap.md,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gap.md,
    paddingVertical: 6,
  },
  chipLabel: { fontSize: 12.5 },
  spacer: { flex: 1, minHeight: gap.lg },
  primary: {
    alignItems: 'center',
    borderRadius: radius.lg,
    height: 54,
    justifyContent: 'center',
  },
  primaryLabel: { fontSize: 16, fontWeight: '500' },
  meloWord: { fontFamily: serif.displayItalic, fontWeight: '400' },
  disabled: { opacity: 0.6 },
  secondaryRow: { alignItems: 'center', flexDirection: 'row', gap: gap.md, marginTop: gap.md },
  ignoreButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  cancelButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: gap.lg,
  },
  secondaryLabel: { fontSize: 14 },
  dupeCard: { borderRadius: radius.lg, borderWidth: 1, padding: gap.lg },
  dupeHead: { fontFamily: serif.display, fontSize: 16, lineHeight: 20 },
  dupeSub: { fontSize: 12.5, marginTop: gap.xs },
  dupeRow: { flexDirection: 'row', gap: gap.md, marginTop: gap.md },
  dupePrimary: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  dupePrimaryLabel: { fontSize: 14, fontWeight: '600' },
  dupeCell: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  dupeIgnore: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    marginTop: gap.md,
  },
  dupeFoot: { fontSize: 11, marginTop: gap.md, textAlign: 'center' },
  bottomSpace: { height: gap.lg },
  pressed: { opacity: 0.6, transform: [{ scale: 0.97 }] },
});
