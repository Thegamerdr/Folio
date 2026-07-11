// VisualizerScreen — the faithful 1:1 React Native port of the web "what Folio found" preview
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenVisualizer.tsx).
//
// @rn-screen    VisualizerScreen
// @rn-stack     Intake > Check
// @purpose      Visual preview of what Folio found before the user reviews item-by-item — a
//               multi-select checklist of candidate money items with a live "Add N · ±£X" CTA.
// @reads        readerCandidates (the store's review-before-truth slot — the Intake reader's staged
//               PDF / photo / text candidates; the web file's other 14 store imports were all dead)
// @writes       addTransactionsBatch + syncHistoryCycles + clearReaderCandidates (only on Accept —
//               the chosen candidates flow into the money path as one batch, then the staged review
//               queue is consumed)
// @opens-sheet  — (the per-row Fix opens a LOCAL edit sheet, not a shell SheetId; nav stays screen-to-screen)
// @copy         FROZEN — keyed strings from '@/folio/copy/copy' (add.*); the eyebrow / kicker /
//               headline / subhead / chips / CTA are the web's inline literals (not in COPY_DECK,
//               kept verbatim). The accent word "found." renders terracotta.
// @tokens       canvas · surface · inset · ink · muted · calm · positive · caution · hairline ·
//               hairlineStrong · inverse · serif — all from '@/folio/theme' (no new tokens)
// @motion       slide-in-r (whole screen) · press 0.97 (kit `pressed`, every tappable) ·
//               checkbox 150ms colour/fill swap. route-draw lives on today-after, NOT here
//               (the web doc block's @motion 'route-draw' is aspirational — there is no SVG path
//               on this surface; faithful entrance is slide-in-r). Reduced motion = final state.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/store source):
//   • STATES (STATES.md): all five branches render. populated = the checklist (web's only built
//     branch). loading = Melo curious + ONE line, NEVER a spinner, capped at ~4s → fallback to
//     populated. empty = the calm EmptyState doorway ("Add a statement first"). error = the
//     calm EmptyState with err.statement.unreadable + a route to a fallback. offline ≡ populated
//     (local-first; nothing here needs the network).
//   • MELO (MELO_MOODS.md): reading=curious. The web prototype has no Melo on this surface, so the
//     port has none on the header either — faithful to the design. Melo appears ONLY on loading
//     (curious). "No mood = no Melo" discipline holds everywhere else.
//   • READER OUTPUT, now REAL + LIVE: the web faked the found items with a module const. This screen
//     now renders the STAGED reader candidates from the store (`readerCandidates`) when present — the
//     LLM reader's output for a picked PDF / photo, or the pure `parseSheet` output for a picked CSV /
//     TSV / TXT, both staged by the Intake screen. When the slot is empty (a cold / dev open, e.g.
//     FolioShell rendering this screen with `nav` only), it falls back to the faithful sample: the
//     web's exact eight rows, restated as spreadsheet text and run through the same real `parseSheet`
//     engine (no hand-built array, no new merchants / numbers). The display `type` label and the "to
//     check" flag are the web's exact per-row values for the sample, re-attached after the parse (the
//     engine owns the money facts; the UI owns the label); a live read with no matching sample row
//     degrades to the candidate's own kind/category and a low-confidence "to check" — honest, never
//     invented. Review-before-truth: nothing mutates the money path until the user taps Add (which
//     posts every chosen candidate in one addTransactionsBatch call, then clears the staged queue);
//     Fix opens the edit form.
//   • NUMBER FORMATTING is preserved deliberately: rows use toFixed(2) (pence), the CTA uses
//     toFixed(0) (whole £). The − minus glyph (U+2212) and the '·' middot are kept exactly. Inflows
//     read positive (green); spend reads ink. tabular figures throughout.
//   • DIVIDERS: Tailwind divide-y has no RN analog — a manual per-row top hairline; the first row
//     carries none so it never doubles with the card's outer hairline.
//   • em / alpha conversions: letter-spacing 0.14em → 12 * 0.14 = 1.68px absolute; the web's
//     `border-ink/40` unchecked checkbox border → the live palette's ink at 40% alpha
//     (`inkAlpha(t.ink, 0.4)`) — the spec's exact conversion (rgba on the resolved --ink token),
//     dark-mode-safe, no new colour token. NOT a lighter hairline token.
//
// @rn-engine text-reader — WIRED: parseSheet (apps/mobile/src/folio/lib/importSheet.ts) produces the
//   real CandidateMoneyItem[] (+ honest ColumnIssue[]) this screen reviews; see BUILD_PLAN §3.
//
// Tokens only — no new colour, font, spacing, or radius. Copy is VERBATIM. Banned visible words
// (import / rows / parser / extraction / OCR / sync / dashboard / analytics / users / 100% /
// bank-grade / AI-powered / smart / provenance / source record / indexed) are absent.

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { type Palette, gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import {
  addTransactionsBatch,
  clearReaderCandidates,
  getState,
  syncHistoryCycles,
  useReaderCandidates,
  type Transaction,
} from '@/folio/store';
import {
  parseSheet,
  type CandidateMoneyItem as SheetCandidate,
  type ColumnIssue,
} from '@/folio/lib/importSheet';
import { findCaughtIncome } from '@/folio/lib/caughtIncome';
import { findCaughtBills } from '@/folio/lib/caughtBills';
import { findDriftCandidates } from '@/folio/lib/caughtDrift';
import { findCaughtAnnual } from '@/folio/lib/caughtAnnual';
import { isOverspentLanding } from '@/folio/lib/storeRoute';
import type { Nav } from '@/folio/types';

// ---------------------------------------------------------------------------
// Candidate money item — the shape a statement / photo / text reader produces.
// The reader is built later (@rn-engine above); this UI-only wave renders the
// LOCAL SAMPLE below (the web's exact eight rows, verbatim) so the design states
// are faithful without fabricating new data.
// ---------------------------------------------------------------------------

export type CandidateMoneyItem = {
  /** Stable id — the merchant doubles as the selection key (matches the web). */
  merchant: string;
  /** Already-formatted short date, e.g. "26 Jun". */
  date: string;
  /** Signed £ with pence. Negative = spend, positive = inflow. */
  amount: number;
  /** The reader's suggested type label, shown on the row. */
  type: string;
  /** 'ok' = clear, 'check' = wants a glance (rendered in caution + counted "to check"). */
  status: 'ok' | 'check';
  /** Optional free-text correction note the user adds in the Fix form (LOCAL, pre-truth). Not shown
   *  on the row; carried on the candidate so an Accept could thread it through later. */
  note?: string;
  /** The reader's REAL statement date as ISO (YYYY-MM-DD), carried separately from the display `date`
   *  label so Accept can stamp the posted transaction with the day it actually happened — not "today".
   *  Survives a Fix edit (which only changes the display `date`). Absent → Accept falls back to now. */
  whenIso?: string;
};

// Per-merchant display metadata the reader layers on top of the money facts: the web's exact short
// date label, suggested type label, and "to check" flag. The engine owns merchant + signed amount;
// these restate the web's exact displayed labels (no new data) so the render stays byte-identical.
type RowMeta = { date: string; type: string; status: 'ok' | 'check' };
const SAMPLE_ROW_META: Readonly<Record<string, RowMeta>> = {
  Tesco: { date: '26 Jun', type: 'Groceries', status: 'ok' },
  'Salary — Whitstone Ltd': { date: '25 Jun', type: 'Income', status: 'ok' },
  'Octopus Energy': { date: '24 Jun', type: 'Bill', status: 'ok' },
  'Transfer to Sarah': { date: '24 Jun', type: 'Unknown', status: 'check' },
  'Pret a Manger': { date: '23 Jun', type: 'Eating out', status: 'ok' },
  Klarna: { date: '22 Jun', type: 'Debt', status: 'check' },
  Spotify: { date: '22 Jun', type: 'Subscription', status: 'ok' },
  'Refund — ASOS': { date: '21 Jun', type: 'Unknown', status: 'check' },
};

// Map the engine's candidates → this screen's render shape. The merchant + signed amount are the
// real `parseSheet` output; the short date / type label / status are restated from the web's exact
// per-merchant metadata (fallbacks keep a live, non-sample paste honest rather than throwing).
function toRenderCandidates(candidates: readonly SheetCandidate[]): CandidateMoneyItem[] {
  return candidates.map((candidate) => {
    const meta = SAMPLE_ROW_META[candidate.merchant];
    // REAL candidate data wins; the sample metadata is a FALLBACK for the demo paste only
    // (whose candidates carry no date/category). The old precedence let a real statement
    // containing e.g. "Octopus Energy" pick up the demo's fake "24 Jun" label.
    return {
      merchant: candidate.merchant,
      date: candidate.date ?? meta?.date ?? '',
      amount: candidate.amount,
      type: candidate.category ?? meta?.type ?? 'Unknown',
      // A real read's confidence drives the "wants a glance" flag; the demo rows (no
      // confidence field) fall back to the web's hand-written flags.
      status:
        candidate.confidence !== undefined
          ? candidate.confidence === 'low'
            ? 'check'
            : 'ok'
          : (meta?.status ?? 'ok'),
      // Carry the real ISO statement date through to Accept (exactOptionalPropertyTypes: omit when absent).
      ...(candidate.date ? { whenIso: candidate.date } : {}),
    };
  });
}

// The render states this screen can occupy (STATES.md). offline ≡ populated (local-first).
export type VisualizerState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type VisualizerScreenProps = {
  nav: Nav;
  state?: VisualizerState;
  /** Live pasted/CSV text. When present it is read by the real `parseSheet` engine into the found
   *  list (+ honest issues). Omitted in the demo — the screen falls back to the faithful sample. */
  sourceText?: string;
  /** Pre-derived found candidates. Overrides the engine derivation when supplied (e.g. a fixture). */
  candidates?: readonly CandidateMoneyItem[];
};

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (web .slide-in-r): the whole screen enters from +28px on X with a fade, 360ms.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// The checkbox 150ms fill swap (web `transition-all duration-150`).
const CHECK_MS = 150;

// Loading is capped so a stuck reader never holds the curious holding moment forever (STATES.md:
// loading ≈ 4s then fallback). At the cap we resolve to the populated checklist.
const LOADING_CAP_MS = 4000;

// em → absolute: the eyebrow's letter-spacing 0.14em on a 12px face.
const EYEBROW_TRACKING = 12 * 0.14;

// The web's unchecked checkbox border is `border-[var(--ink)]/40` — ink at 40% alpha, NOT a lighter
// hairline token (per the spec's conversion note). Derive it from the live palette so the quiet-but-
// present outline holds in both light (#1A1815) and dark (#F4F0E6) ink — no new colour token added.
const UNCHECKED_BORDER_ALPHA = 0.4;
function inkAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Map a candidate's suggested type → a Transaction category, so an accepted item flows into the
// money path with an honest bucket. Faithful + banned-word-free.
function categoryFor(item: CandidateMoneyItem): Transaction['category'] {
  if (item.amount > 0) return 'income';
  const type = item.type.toLowerCase();
  if (type.includes('bill') || type.includes('debt') || type.includes('subscription'))
    return 'bills';
  if (type.includes('grocer') || type.includes('eating') || type.includes('food')) return 'food';
  if (type.includes('transport') || type.includes('travel')) return 'transport';
  return 'other';
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

export function VisualizerScreen({
  nav,
  state = 'populated',
  sourceText,
  candidates: candidatesOverride,
}: VisualizerScreenProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // The REAL staged candidates from the Intake reader (PDF / photo via the LLM reader, or CSV / TSV /
  // TXT via `parseSheet`), held in the store's review-before-truth slot. When present they are what
  // the user reviews here — the source of truth for this surface. They are mapped through the same
  // `toRenderCandidates` as a live paste (the metadata fallbacks keep a non-sample read honest).
  const staged = useReaderCandidates();

  // The real engine derivation, in priority order:
  //   1. an explicit `candidates` prop (fixtures / tests) always wins;
  //   2. the store's STAGED reader candidates (the live PDF / photo / text read) when non-empty;
  //   3. live pasted/CSV `sourceText` threaded in, read by `parseSheet`;
  //   4. nothing staged → an EMPTY list, so the calm "add a statement first" doorway shows.
  // There is deliberately NO sample fallback: the Review tab is reachable from the bottom nav at any
  // time, and fabricating rows the user can never clear is exactly the "sample everywhere" problem.
  // Sample/demo content lives in the store (source: 'sample'/'seed') and is gated by the demo regime;
  // this transient review surface only ever shows a REAL staged read.
  // `issues` are the engine's honest prompts; staged candidates carry none of their own (the reader
  // already validated them), so they review cleanly.
  const { candidates, issues } = useMemo(() => {
    if (candidatesOverride) {
      return { candidates: candidatesOverride, issues: [] as readonly ColumnIssue[] };
    }
    if (staged.length > 0) {
      return { candidates: toRenderCandidates(staged), issues: [] as readonly ColumnIssue[] };
    }
    if (sourceText !== undefined) {
      const parsed = parseSheet(sourceText);
      return { candidates: toRenderCandidates(parsed.candidates), issues: parsed.issues };
    }
    return {
      candidates: [] as readonly CandidateMoneyItem[],
      issues: [] as readonly ColumnIssue[],
    };
  }, [candidatesOverride, staged, sourceText]);

  // loading auto-resolve: when the curious holding moment times out (~4s, immediate under
  // reduce-motion), fall through to the populated checklist instead of spinning forever.
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (state !== 'loading') {
      setLoadingTimedOut(false);
      return;
    }
    if (reduceMotion) {
      setLoadingTimedOut(true);
      return;
    }
    const id = setTimeout(() => setLoadingTimedOut(true), LOADING_CAP_MS);
    return () => clearTimeout(id);
  }, [state, reduceMotion]);

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

  // Selection is ephemeral — keyed by merchant, immutable spread (matches the web `toggle`).
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const toggle = (merchant: string) =>
    setSelected((prev) => ({ ...prev, [merchant]: !prev[merchant] }));

  // The per-row Fix sheet (@rn-engine edit-txn) — a local correction before anything counts.
  const [editing, setEditing] = useState<CandidateMoneyItem | null>(null);
  // Local edits to candidates, keyed by the original merchant; applied over the sample for display.
  const [edits, setEdits] = useState<Record<string, CandidateMoneyItem>>({});
  const items = useMemo(() => candidates.map((c) => edits[c.merchant] ?? c), [candidates, edits]);

  const count = Object.values(selected).filter(Boolean).length;
  const clearCount = items.filter((i) => i.status === 'ok').length;
  const checkCount = items.length - clearCount;
  const selectedTotal = items.reduce((sum, i) => (selected[i.merchant] ? sum + i.amount : sum), 0);

  const ctaLabel =
    count === 0
      ? 'Choose what to add'
      : `Add ${count} · ${selectedTotal >= 0 ? '+' : '−'}£${Math.abs(selectedTotal).toFixed(0)}`;

  // Accept — the ONLY money-path mutation on this surface. Each chosen candidate becomes a posted
  // Transaction (review-before-truth: this is the user's deliberate "add"). Once the user has
  // confirmed here, the staged reader queue is consumed: `clearReaderCandidates()` empties the
  // store's review-before-truth slot so a returning open of this surface (or a later read) starts
  // clean and the same candidates can't be reviewed twice. Then the route is re-drawn on today-after.
  function commit(chosen: readonly CandidateMoneyItem[]) {
    if (chosen.length === 0) return;
    // Single batch write (DATA_INTELLIGENCE.md §5(A)) — was a per-row
    // `addTransaction` loop; `addTransactionsBatch` reproduces the same final
    // ordering in one `setPartial` instead of `chosen.length` of them.
    addTransactionsBatch(
      chosen.map((item) => {
        // Preserve the statement date the reader captured (whenIso, YYYY-MM-DD) so an imported item
        // lands on the day it ACTUALLY happened in the timeline + money path — not stamped "today".
        // Falls back to now only when the reader gave no usable date.
        const isoDay =
          item.whenIso && /^\d{4}-\d{2}-\d{2}$/.test(item.whenIso) ? item.whenIso : null;
        return {
          merchant: item.merchant,
          amount: item.amount,
          category: categoryFor(item),
          source: 'manual' as const,
          // Anchor UTC (not local midnight) so the statement's calendar day is the bucketed day on
          // any device TZ — a local-midnight parse shifts 1st-of-month rows into the PRIOR month
          // once the device is east of UTC (e.g. 2026-07-01 local -> 2026-06-30T23:00Z), which then
          // mis-buckets the row in historyCycles' UTC-sliced `monthKeyOf`.
          ...(isoDay ? { when: new Date(`${isoDay}T00:00:00Z`).toISOString() } : {}),
        };
      }),
    );
    // Reconstruct any newly-qualifying past-month cycles now that the batch has
    // landed (DATA_INTELLIGENCE.md §5(B)) — a no-op when nothing qualifies yet.
    syncHistoryCycles();
    clearReaderCandidates();
    // Income-signal check (DATA_INTELLIGENCE.md phase ②) — run over the ledger
    // AFTER the batch has landed, so a newly-completed pattern is visible to the
    // detector. Propose-and-confirm only: this opens the sheet, it never writes
    // an IncomeSource itself. No-op when nothing qualifies (no signal, already
    // declared, or already dismissed) — the "Add all" flow never blocks on it.
    //
    // Bill-signal check (DATA_INTELLIGENCE.md phase ⑤(B)) runs the same way, but income takes
    // precedence when BOTH fire on the same landing: only one caught-sheet opens per landing (never
    // stack two), and a qualifying bill simply waits — it re-evaluates fresh next time a batch lands,
    // so nothing is lost, just deferred. Simplest honest ordering; documented here deliberately.
    //
    // Drift + annual-radar checks (DATA_INTELLIGENCE.md phase ⑥) extend the SAME one-sheet-per-landing
    // ordering, ranked BELOW income-caught and bill-caught: a fresh catch (a brand-new recurring
    // payment/bill) is more valuable than a drift correction on something already known, and an
    // annual radar hit is the gentlest, least time-sensitive of the four. Each deferred check simply
    // re-evaluates fresh next time a batch lands — nothing is lost, just deferred.
    //
    // QUIET-MOMENT GATE (task: never-pressure-during-danger spirit): skip the ENTIRE cascade when this
    // landing's money state is overspent — none of the four proposal sheets is worth opening while the
    // app's own tone is already "something has to move". Deferred, not lost: every check below already
    // re-evaluates fresh on the NEXT landing (see the ordering comment above), so a real candidate here
    // simply waits for a landing that isn't in the danger band.
    const state = getState();
    if (isOverspentLanding(state)) {
      nav.go('today-after');
      return;
    }
    const incomeSignals = findCaughtIncome(
      state.transactions,
      state.incomeSources ?? [],
      state.dismissedIncomeSignals ?? [],
    );
    if (incomeSignals.length > 0) {
      nav.openSheet('income-caught');
      return;
    }
    const billSignals = findCaughtBills(
      state.transactions,
      state.subs.map((s) => s.name),
      state.dismissedBillSignals ?? [],
    );
    if (billSignals.length > 0) {
      nav.openSheet('bill-caught');
      return;
    }
    const driftSignals = findDriftCandidates(
      state.transactions,
      state.incomeSources ?? [],
      state.subs,
      state.dismissedDriftSignals ?? [],
    );
    if (driftSignals.length > 0) {
      nav.openSheet('drift-caught');
      return;
    }
    const annualSignals = findCaughtAnnual(
      state.transactions,
      state.dismissedAnnualSignals ?? [],
      state.subs.map((s) => s.name),
    );
    if (annualSignals.length > 0) {
      nav.openSheet('annual-caught');
      return;
    }
    nav.go('today-after');
  }

  // Accept the per-row selection — the chosen subset (the one-by-one path: tick rows, then Add N).
  function acceptSelected() {
    if (count === 0) return;
    commit(items.filter((item) => selected[item.merchant]));
  }

  // Add all — the bulk option. Tapping it IS the user's review-before-truth confirmation of the
  // whole batch: EVERY staged candidate is posted through the SAME add path as a per-row accept,
  // then the queue is cleared. It does not remove or replace the per-row Edit / Ignore controls —
  // bulk is an OPTION beside the one-by-one flow, never the only path. No-op on an empty list.
  function acceptAll() {
    if (items.length === 0) return;
    commit(items);
  }

  // empty — the calm doorway: no statement read yet, so there is nothing to check. Shown when the
  // caller asks for it OR there is simply nothing staged to review (a cold open from the bottom nav),
  // so the Review tab never fabricates rows. Loading keeps its own branch below. The single CTA routes
  // to intake so the doorway never dead-ends. (verbatim: add.option.statement)
  if (state === 'empty' || (items.length === 0 && state !== 'loading')) {
    return (
      <EmptyState
        mood="calm"
        headline="Add a statement first."
        body="When Melo reads one, what it finds shows up here for you to check — before any of it counts."
        cta={{ label: copy.add.option.statement, onPress: () => nav.go('intake') }}
      />
    );
  }

  // A hard column issue means the engine could not understand the input at all (no amount/name
  // column, or empty input) and produced nothing — that IS the "couldn't read this one" case, so it
  // resolves to the same calm error doorway. Row-level issues (a single bad amount) are not hard;
  // the good rows still render in the checklist below.
  const hasHardIssue = issues.some(
    (issue) =>
      issue.code === 'missing-amount' ||
      issue.code === 'missing-merchant' ||
      issue.code === 'empty-input',
  );

  // error — Folio couldn't read this one. The calm EmptyState (err.statement.unreadable, verbatim),
  // routing to the PDF fallback where the file is kept as a note rather than dead-ending.
  if (state === 'error' || (hasHardIssue && items.length === 0)) {
    return (
      <EmptyState
        mood="concern"
        headline={copy.err.statement.unreadable}
        cta={{ label: copy.add.review.fix, onPress: () => nav.go('pdf-fallback') }}
      />
    );
  }

  // loading — Melo curious + ONE line, NEVER a spinner (the hard rule + STATES.md). Capped at ~4s,
  // then we fall through to the populated checklist below.
  if (state === 'loading' && !loadingTimedOut) {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="One second — reading what's here." />
      </View>
    );
  }

  // populated / offline (and loading-after-timeout) — the real checklist. offline ≡ populated.
  return (
    <Animated.View
      style={[styles.screen, enterStyle, { backgroundColor: t.canvas, paddingTop: insets.top }]}
    >
      {/* Header — back · "June statement" eyebrow · balancing spacer. */}
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={16}
          onPress={nav.back}
          style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.eyebrow}>June statement</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Intro — italic kicker · headline with the terracotta accent word · subhead · chips. */}
      <View style={styles.intro}>
        <Text style={styles.kicker}>From your statement</Text>
        <Text accessibilityRole="header" style={styles.headline}>
          {'Check what Folio '}
          <Text style={styles.headlineAccent}>found.</Text>
        </Text>
        <Text style={styles.subhead}>Nothing is added until you choose.</Text>

        <View style={styles.summaryRow}>
          <View accessibilityRole="summary" accessibilityLabel="Summary" style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipStrongText}>{items.length} found</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{clearCount} clear</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{checkCount} to check</Text>
            </View>
          </View>

          {/* Add all — the bulk OPTION. A quiet text action beside the summary, set apart from the
              dominant footer CTA so the per-row flow stays primary. Tapping it adds every found item
              at once (the tap is the batch's review-before-truth confirmation). Disabled with nothing
              to add. The per-row Edit / Ignore controls below are untouched — one-by-one stays. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add all ${items.length}`}
            accessibilityHint="Adds everything Folio found at once. You can still add them one by one instead."
            accessibilityState={{ disabled: items.length === 0 }}
            disabled={items.length === 0}
            hitSlop={10}
            onPress={acceptAll}
            style={({ pressed: isPressed }) => [
              styles.addAll,
              isPressed && items.length > 0 ? styles.pressed : undefined,
            ]}
          >
            <Text
              style={[
                styles.addAllText,
                items.length === 0 ? styles.addAllTextDisabled : undefined,
              ]}
            >
              Add all
            </Text>
          </Pressable>
        </View>
      </View>

      {/* The editable checklist — one calm row per candidate on a single surface card, hairline-
          divided. Tap the square (or the row body) to include/exclude; Fix opens the edit form. */}
      <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {items.map((item, index) => {
            const isOn = !!selected[item.merchant];
            const isIn = item.amount > 0;
            const isCheck = item.status === 'check';
            return (
              <View
                key={item.merchant}
                style={[styles.row, index > 0 ? styles.rowDivider : undefined]}
              >
                <Checkbox
                  checked={isOn}
                  reduceMotion={reduceMotion}
                  palette={t}
                  accessibilityLabel={`${isOn ? 'Remove' : 'Add'} ${item.merchant}`}
                  onPress={() => toggle(item.merchant)}
                />

                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Includes or leaves out this one."
                  onPress={() => toggle(item.merchant)}
                  style={({ pressed: isPressed }) => [
                    styles.rowBody,
                    isPressed ? styles.pressed : undefined,
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text numberOfLines={1} style={styles.merchant}>
                      {item.merchant}
                    </Text>
                    <View style={styles.metaLine}>
                      <Text style={styles.metaText}>{item.date}</Text>
                      <Text style={styles.metaText}>·</Text>
                      <Text style={[styles.metaText, isCheck ? styles.metaCheck : undefined]}>
                        {item.type}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.amount, isIn ? styles.amountIn : styles.amountOut]}>
                    {isIn ? '+' : '−'}£{Math.abs(item.amount).toFixed(2)}
                  </Text>
                </Pressable>

                {/* Fix — opens the local edit form (@rn-engine edit-txn). The web routed Edit to
                    'review'; the port opens the ported correction form so it never dead-ends in a
                    blank manual form. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Fix ${item.merchant}`}
                  hitSlop={8}
                  onPress={() => setEditing(item)}
                  style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
                >
                  <Text style={styles.edit}>{copy.add.review.fix}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={styles.listTail} />
      </ScrollView>

      {/* Footer CTA bar — the dominant "Add N · ±£X" + a quiet Later (leaves everything here). */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + gap.md }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Adds the items you chose to your money. The rest stay out."
          accessibilityState={{ disabled: count === 0 }}
          disabled={count === 0}
          onPress={acceptSelected}
          style={({ pressed: isPressed }) => [
            styles.cta,
            count === 0 ? styles.ctaDisabled : undefined,
            isPressed && count > 0 ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.ctaText, count === 0 ? styles.ctaTextDisabled : undefined]}>
            {ctaLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Keeps everything here, unchanged, for later."
          hitSlop={12}
          onPress={nav.back}
          style={({ pressed: isPressed }) => [styles.later, isPressed ? styles.pressed : undefined]}
        >
          <Text style={styles.laterText}>Later</Text>
        </Pressable>
      </View>

      <EditCandidateSheet
        candidate={editing}
        onCancel={() => setEditing(null)}
        onSave={(next) => {
          if (editing) setEdits((prev) => ({ ...prev, [editing.merchant]: next }));
          setEditing(null);
        }}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Checkbox — a 20px SQUARE: accent fill + white tick when on, quiet outline when off. The 150ms
// fill swap (web transition-all duration-150) animates the background; reduce-motion = final state.
// ---------------------------------------------------------------------------

function Checkbox({
  checked,
  reduceMotion,
  palette,
  accessibilityLabel,
  onPress,
}: {
  checked: boolean;
  reduceMotion: boolean;
  palette: Palette;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  // 0 = off (transparent fill, quiet border), 1 = on (accent fill + border).
  const fill = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      fill.value = checked ? 1 : 0;
      return;
    }
    fill.value = withTiming(checked ? 1 : 0, {
      duration: CHECK_MS,
      easing: Easing.out(Easing.ease),
    });
  }, [checked, reduceMotion, fill]);

  // off-state border = the web's ink/40 (derived from the live palette), on = accent fill + border.
  const uncheckedBorder = useMemo(
    () => inkAlpha(palette.ink, UNCHECKED_BORDER_ALPHA),
    [palette.ink],
  );
  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: fill.value > 0.5 ? palette.calm : 'transparent',
    borderColor: fill.value > 0.5 ? palette.calm : uncheckedBorder,
  }));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
    >
      <Animated.View style={[styles.box, boxStyle]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// EditCandidateSheet (@rn-engine edit-txn) — the per-row "Fix something" correction form. A faithful
// port of the web edit form: name, type, amount. Editing is LOCAL — it never mutates the money path;
// only the Add CTA (Accept) does. Full correction-history persistence is wired later (see BUILD_PLAN §3).
// ---------------------------------------------------------------------------

const EDIT_TYPES: readonly string[] = [
  'Groceries',
  'Income',
  'Bill',
  'Eating out',
  'Debt',
  'Subscription',
  'Unknown',
];

function EditCandidateSheet({
  candidate,
  onCancel,
  onSave,
}: {
  candidate: CandidateMoneyItem | null;
  onCancel: () => void;
  onSave: (next: CandidateMoneyItem) => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<string>(EDIT_TYPES[0]!);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [primed, setPrimed] = useState<string | null>(null);

  // Prime the form from the candidate the first time this row opens (derive-from-prop on open). The
  // full correction set is primed: name, amount (magnitude — sign stays the money fact), type, date,
  // and the optional note.
  if (candidate && primed !== candidate.merchant) {
    setPrimed(candidate.merchant);
    setName(candidate.merchant);
    setAmount(Math.abs(candidate.amount).toFixed(2));
    setType(candidate.type);
    setDate(candidate.date);
    setNote(candidate.note ?? '');
  }

  // Apply the correction to the in-review candidate and hand it back to the screen. This is a LOCAL
  // edit — it updates the row the user sees; only the screen's Add CTA (Accept) writes to the money
  // path via store.addTransactionsBatch. A blank/invalid amount falls back to the candidate's current
  // value rather than coercing to 0, so an untouched amount field can never silently zero a real figure.
  function handleSave() {
    if (!candidate) return;
    const cleaned = amount.replace(/[^0-9.]/g, '');
    const magnitude = cleaned === '' ? Math.abs(candidate.amount) : Number(cleaned);
    const safeMagnitude = Number.isFinite(magnitude) ? magnitude : Math.abs(candidate.amount);
    const signed = candidate.amount >= 0 ? safeMagnitude : -safeMagnitude;
    const trimmedNote = note.trim();
    onSave({
      ...candidate,
      merchant: name.trim() || candidate.merchant,
      amount: signed,
      type: type.trim() || candidate.type,
      date: date.trim() || candidate.date,
      // exactOptionalPropertyTypes: only carry `note` when it has content; an emptied note drops it.
      ...(trimmedNote ? { note: trimmedNote } : {}),
    });
    setPrimed(null);
  }

  return (
    <Modal animationType="slide" transparent visible={candidate !== null} onRequestClose={onCancel}>
      <Pressable accessibilityLabel="Cancel" style={styles.scrim} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.sheetTitle}>
            Correct it before it counts.
          </Text>

          <Text style={styles.fieldLabel}>What is it?</Text>
          <TextInput
            accessibilityLabel="What this payment is"
            onChangeText={setName}
            placeholder="e.g. Tesco shop"
            placeholderTextColor={t.muted}
            style={styles.input}
            value={name}
          />

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            {EDIT_TYPES.map((option) => {
              const on = type === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setType(option)}
                  style={[styles.typeChip, on ? styles.typeChipOn : undefined]}
                >
                  <Text style={[styles.typeChipText, on ? styles.typeChipTextOn : undefined]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>How much?</Text>
          <TextInput
            accessibilityLabel="How much"
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={t.muted}
            style={[styles.input, styles.amountInput]}
            value={amount}
          />

          <Text style={styles.fieldLabel}>When?</Text>
          <TextInput
            accessibilityLabel="When this was"
            onChangeText={setDate}
            placeholder="e.g. 26 Jun"
            placeholderTextColor={t.muted}
            style={styles.input}
            value={date}
          />

          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput
            accessibilityLabel="A note for this one"
            onChangeText={setNote}
            placeholder="e.g. weekly shop"
            placeholderTextColor={t.muted}
            style={styles.input}
            value={note}
          />

          <View style={styles.editFooter}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed: isPressed }) => [
                styles.ghost,
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={styles.ghostLabel}>{copy.add.review.fix}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleSave}
              style={({ pressed: isPressed }) => [
                styles.saveButton,
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={styles.saveLabel}>{copy.add.review.confirm}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles — two layers per the kit DARK-MODE PATTERN. This file's colour + layout both ride in
// makeStyles(t) (rebuilt per render via useMemo) so the surface follows light/dark.
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    // px-7 ≈ gap.xl (24); the screen sizes to its column and pins the footer at the bottom.
    screen: {
      flex: 1,
    },
    loading: {
      flex: 1,
      paddingHorizontal: gap.xl,
    },

    // Header — back · eyebrow · balancing spacer. web px-7 pt-4 pb-2 space-between.
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: gap.xl,
      paddingTop: gap.lg,
      paddingBottom: gap.sm,
    },
    backArrow: {
      color: t.muted,
      fontSize: 20,
    },
    eyebrow: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: EYEBROW_TRACKING,
      textTransform: 'uppercase',
    },
    headerSpacer: {
      width: 20,
    },

    // Intro block — web px-7 pt-3.
    intro: {
      paddingHorizontal: gap.xl,
      paddingTop: gap.md,
    },
    // Italic Fraunces kicker, 13px muted (web font-display italic text-[13px]).
    kicker: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      lineHeight: 18,
    },
    // Fraunces headline, 26px tight (web font-display text-[26px] leading-tight mt-1).
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 26,
      letterSpacing: -0.3,
      lineHeight: 31,
      marginTop: gap.xs,
    },
    // The accent word "found." — same upright Fraunces face, recoloured terracotta (web
    // <em class="not-italic text-[var(--accent)]">).
    headlineAccent: {
      color: t.calm,
      fontFamily: serif.display,
      fontStyle: 'normal',
    },
    subhead: {
      color: t.muted,
      fontSize: 12.5,
      lineHeight: 18,
      marginTop: gap.sm,
    },

    // Summary row — the chips on the left, the quiet "Add all" bulk action on the right. Mirrors
    // the web summary's mt-4 vertical rhythm; the chips keep their own row so they wrap as before.
    summaryRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.sm,
      justifyContent: 'space-between',
      marginTop: gap.lg,
    },
    // Summary chips — near-white inset wells (web mt-4 row gap-2). "N found" is ink-medium; the
    // others muted. tabular figures. flexShrink so the chips give way to "Add all" if space is tight.
    chipsRow: {
      flexDirection: 'row',
      flexShrink: 1,
      flexWrap: 'wrap',
      gap: gap.sm,
    },
    // "Add all" — a quiet text action in the kit's calm accent, never a filled button (the filled
    // CTA is the footer's job). Reuses the press feel + accent token; no new visual style.
    addAll: {
      paddingHorizontal: gap.xs,
      paddingVertical: 4,
    },
    addAllText: {
      color: t.calm,
      fontSize: 12.5,
      fontWeight: '500',
    },
    addAllTextDisabled: {
      color: t.muted,
    },
    chip: {
      backgroundColor: t.inset,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipStrongText: {
      color: t.ink,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
      fontWeight: '500',
    },
    chipText: {
      color: t.muted,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },

    // Scroll list — web mt-3 flex-1, hidden scrollbar, px-4.
    listScroll: {
      flex: 1,
      marginTop: gap.md,
      paddingHorizontal: gap.lg,
    },
    // Single surface card — web bg-surface hairline rounded-2xl (~16 → radius.lg) with rows divided.
    card: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: gap.lg,
    },
    listTail: {
      height: gap.lg,
    },

    // Row — web px-4 py-3.5 flex-row items-center gap-3. The first row carries no top hairline.
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.md,
      paddingVertical: 14,
    },
    rowDivider: {
      borderTopColor: t.hairline,
      borderTopWidth: StyleSheet.hairlineWidth,
    },

    rowBody: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: gap.md,
      minWidth: 0,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
    },
    merchant: {
      color: t.ink,
      fontSize: 14,
      fontWeight: '500',
    },
    metaLine: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      marginTop: 2,
    },
    metaText: {
      color: t.muted,
      fontSize: 11.5,
    },
    // 'to check' reads in caution amber (web text-[var(--caution)]). Colour is never the only
    // signal — the "N to check" chip + the type label carry the meaning too.
    metaCheck: {
      color: t.caution,
    },

    amount: {
      fontSize: 14,
      fontVariant: ['tabular-nums'],
      fontWeight: '500',
    },
    amountIn: {
      color: t.positive,
    },
    amountOut: {
      color: t.ink,
    },

    edit: {
      color: t.muted,
      fontSize: 11.5,
    },

    // The 20px SQUARE checkbox (web w-[20px] h-[20px] rounded-md border). Colour is animated in
    // <Checkbox>; the static layout lives here.
    box: {
      alignItems: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
      height: 20,
      justifyContent: 'center',
      width: 20,
    },
    tick: {
      color: t.inverse,
      fontSize: 12,
      lineHeight: 14,
    },

    // Footer CTA bar — web px-5 py-3 bg-paper top-hairline row gap-3.
    footer: {
      alignItems: 'center',
      backgroundColor: t.canvas,
      borderTopColor: t.hairline,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: gap.md,
      paddingHorizontal: gap.lg,
      paddingTop: gap.md,
    },
    cta: {
      alignItems: 'center',
      backgroundColor: t.calmStrong,
      borderRadius: radius.md,
      flex: 1,
      height: 48,
      justifyContent: 'center',
    },
    ctaDisabled: {
      backgroundColor: t.inset,
      opacity: 0.4,
    },
    ctaText: {
      color: t.inverse,
      fontSize: 14,
      fontVariant: ['tabular-nums'],
      fontWeight: '500',
    },
    ctaTextDisabled: {
      color: t.muted,
    },
    later: {
      height: 48,
      justifyContent: 'center',
      paddingHorizontal: gap.md,
    },
    laterText: {
      color: t.muted,
      fontSize: 12.5,
    },

    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },

    // Edit sheet (@rn-engine edit-txn) — mirrors the sibling foundItems edit sheet.
    scrim: {
      backgroundColor: 'rgba(26, 24, 21, 0.42)',
      flex: 1,
    },
    sheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '90%',
      paddingBottom: gap.xxxl,
      paddingHorizontal: gap.xl,
      paddingTop: gap.md,
    },
    sheetHandle: {
      alignSelf: 'center',
      backgroundColor: t.hairline,
      borderRadius: 3,
      height: 5,
      marginBottom: gap.lg,
      width: 40,
    },
    sheetTitle: {
      color: t.ink,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    fieldLabel: {
      color: t.muted,
      fontSize: 13,
      fontWeight: '700',
      marginTop: gap.lg,
    },
    input: {
      borderBottomColor: t.hairlineStrong,
      borderBottomWidth: 1.5,
      color: t.ink,
      fontSize: 18,
      paddingVertical: 8,
    },
    amountInput: {
      fontVariant: ['tabular-nums'],
    },
    typeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.xs,
      marginTop: gap.sm,
    },
    typeChip: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    typeChipOn: {
      backgroundColor: t.calmSoft,
      borderColor: t.calm,
    },
    typeChipText: {
      color: t.secondary,
      fontSize: 13.5,
      fontWeight: '600',
    },
    typeChipTextOn: {
      color: t.calmStrong,
    },
    editFooter: {
      flexDirection: 'row',
      gap: gap.sm,
      marginTop: gap.xl,
    },
    ghost: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderColor: t.hairlineStrong,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      flex: 1,
      paddingVertical: 15,
    },
    ghostLabel: {
      color: t.ink,
      fontSize: 16,
      fontWeight: '600',
    },
    saveButton: {
      alignItems: 'center',
      backgroundColor: t.calmStrong,
      borderRadius: radius.lg,
      flex: 1,
      paddingVertical: 15,
    },
    saveLabel: {
      color: t.inverse,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
