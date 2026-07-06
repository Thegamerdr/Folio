// BulkStatementLanding — the shared bulk-landing surface for a multi-candidate read (task: BULK
// ADD-AS-HISTORY). Rendered by PdfSuccessScreen / ImageSuccessScreen / PasteSuccessScreen in place
// of their ordinary single-item preview whenever the reader/parse produced MORE THAN ONE candidate
// (a "statement"), per `isBulkStatement` (lib/bulkLanding.ts). Single-candidate reads are UNCHANGED
// — each screen's existing per-row `enqueueReviewItems` -> Review path still handles those.
//
// FLOW (owner spec, task: BULK ADD-AS-HISTORY):
//   1. BULK LANDING — a calm summary: 'Found {N} transactions · {from}–{to} · £{in} in / £{out}
//      out', a short preview list with money-in vs money-out unmistakably distinguished (the same
//      positiveInk/repairInk convention TodayScreen's "Coming in" / "Going out" uses — reused here,
//      never re-invented). PRIMARY CTA 'Add all as history' calls `addStatementAsHistory` and
//      routes to Today (via the offer sequencer below). SECONDARY 'Review one by one' falls back to
//      the screen's existing per-row enqueue-then-Review path — nobody who wants line-by-line
//      control loses it.
//   2. POST-IMPORT OFFERS — after the add lands, `nextBulkLandingOffer` (lib/bulkLanding.ts) walks
//      the two named offers ONE AT A TIME, each with its own calm confirm card: closing balance
//      first ('Your balance looks like £X as of {date} — use it?' -> setCurrentBalance), then an
//      unmatched income signal (routes to the existing self-deriving IncomeCaughtSheet — it reads
//      the live post-add ledger itself, so no candidate payload needs threading through). Both are
//      SKIPPABLE ("Not now") and NEITHER auto-applies — review-before-truth extends past the add
//      itself, matching the single-item Review card's own confirm-before-truth contract.
//
// @tokens surface · hairline · calm (accent) · calmSoft · muted · ink · inverse · positiveInk ·
//         repairInk — all from '@/folio/theme'. No new token, no new colour.
// @motion none of its own — mounts inside the success screens' existing slide-in-r frame.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import {
  bulkSummaryLine,
  closingBalanceOfferLine,
  nextBulkLandingOffer,
  type BulkLandingOffer,
} from '@/folio/lib/bulkLanding';
import { buildStatementSummary } from '@/folio/lib/statementSummary';
import type { CandidateMoneyItem } from '@/folio/lib/importSheet';
import {
  addStatementAsHistory,
  setCurrentBalance,
  type AddStatementAsHistoryResult,
} from '@/folio/store';
import type { Nav } from '@/folio/types';

export type BulkStatementLandingProps = {
  nav: Nav;
  /** The full candidate batch this statement read produced — rendered as the preview list AND, on
   *  "Add all as history", handed to `addStatementAsHistory` verbatim (this component makes the
   *  ONE money-path write; nothing lands before that tap). */
  candidates: readonly CandidateMoneyItem[];
  /** Passed straight through to `addStatementAsHistory` when the reader supplied a closing balance
   *  (see that function's doc) — omit when it didn't. Never fabricated by this component. */
  closingBalance?: { amount: number; asOfISO: string };
  /** Fires once "Add all as history" has actually landed the batch — the caller clears whatever
   *  staging slot it used (e.g. `clearReaderCandidates`), since that slot differs per reader path.
   *  Fired exactly once, before the post-import offers (if any) are shown. */
  onAdded: () => void;
  /** Fires when the user chooses "Review one by one" — the caller's existing per-row enqueue path. */
  onReviewOneByOne: () => void;
};

// Format a signed GBP magnitude the way the rest of the success screens do: whole pounds grouped,
// pence only when the magnitude isn't whole, leading +/- glyph (matches formatSignedAmount in
// PdfSuccessScreen/ImageSuccessScreen — restated here rather than importing a screen-local helper).
function formatSignedAmount(amount: number): string {
  const magnitude = Math.abs(amount);
  const grouped = magnitude.toLocaleString('en-GB', {
    minimumFractionDigits: Number.isInteger(magnitude) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const sign = amount >= 0 ? '+' : '−';
  return `${sign}£${grouped}`;
}

export function BulkStatementLanding({
  nav,
  candidates,
  closingBalance,
  onAdded,
  onReviewOneByOne,
}: BulkStatementLandingProps) {
  const t = useTheme();

  // The bulk summary + offers — `null` until "Add all as history" is tapped (the ONE money-path
  // write on this component; nothing lands from a render alone).
  const [summary, setSummary] = useState<AddStatementAsHistoryResult | null>(null);
  // Which offers have already been resolved (confirmed OR skipped) this landing — drives
  // `nextBulkLandingOffer` to walk the sequence exactly once each, never re-showing one.
  const [shownOffers, setShownOffers] = useState<ReadonlySet<BulkLandingOffer>>(new Set());

  const currentOffer = summary !== null ? nextBulkLandingOffer(summary, shownOffers) : null;

  function resolveOffer(offer: BulkLandingOffer) {
    if (summary === null) return;
    const next = new Set(shownOffers);
    if (offer !== null) next.add(offer);
    setShownOffers(next);
    // Once the walk is exhausted, route onward — mirrors ReviewScreen.onAdd's own
    // "nothing left to offer -> go home" fallthrough.
    if (nextBulkLandingOffer(summary, next) === null) {
      nav.go('today');
    }
  }

  function handleAddAll() {
    const result = addStatementAsHistory(candidates, closingBalance);
    setSummary(result);
    onAdded();
    // If neither offer exists, route straight to Today (or to the existing bill/drift/annual
    // caught-sheet chain, which `addStatementAsHistory` computes for parity but does not surface —
    // see that function's doc; only income + closing-balance are threaded through per the owner
    // spec's two named offers).
    if (nextBulkLandingOffer(result, new Set()) === null) {
      nav.go('today');
    }
  }

  // Post-import offer sequencer — replaces the landing card once the add has happened AND at
  // least one offer remains. Each offer is its own calm confirm, "Not now" always skips it.
  const closingBalanceOffer =
    currentOffer === 'closing-balance' ? (summary?.closingBalanceOffer ?? null) : null;
  if (closingBalanceOffer !== null) {
    const offer = closingBalanceOffer;
    return (
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Text style={[styles.offerHead, { color: t.ink }]}>{closingBalanceOfferLine(offer)}</Text>
        <View style={styles.offerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use this balance"
            onPress={() => {
              setCurrentBalance({
                amount: offer.amountPence / 100,
                source: 'statement',
                confidence: 'statement-derived',
              });
              resolveOffer('closing-balance');
            }}
            style={({ pressed }) => [
              styles.offerPrimary,
              { backgroundColor: t.calm },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.offerPrimaryLabel, { color: t.inverse }]}>Use it</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={() => resolveOffer('closing-balance')}
            style={({ pressed }) => [
              styles.offerSecondary,
              { borderColor: t.hairline },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.offerSecondaryLabel, { color: t.muted }]}>Not now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const incomeOffer = currentOffer === 'income' ? (summary?.incomeSignal ?? null) : null;
  if (incomeOffer !== null) {
    const signal = incomeOffer;
    return (
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Text style={[styles.offerHead, { color: t.ink }]}>
          {`Looks like ${signal.merchant} pays you — set as your pay?`}
        </Text>
        <View style={styles.offerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check this income"
            onPress={() => {
              resolveOffer('income');
              nav.openSheet('income-caught');
            }}
            style={({ pressed }) => [
              styles.offerPrimary,
              { backgroundColor: t.calm },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.offerPrimaryLabel, { color: t.inverse }]}>Check it</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={() => resolveOffer('income')}
            style={({ pressed }) => [
              styles.offerSecondary,
              { borderColor: t.hairline },
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.offerSecondaryLabel, { color: t.muted }]}>Not now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // The pre-add preview summary — the exact same pure math `addStatementAsHistory` runs
  // internally (`buildStatementSummary`), computed here just for the headline before any write
  // happens, so the pre-add and post-add headlines read byte-identical.
  const previewSummary: AddStatementAsHistoryResult = buildStatementSummary(candidates);

  // The bulk landing card itself — summary line + preview list + the two CTAs. Hidden once
  // `summary` is set and there's nothing left to offer (nav.go('today') has already fired by then).
  return (
    <>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
        <Text style={[styles.summary, { color: t.ink }]}>{bulkSummaryLine(previewSummary)}</Text>
        <View style={styles.list}>
          {candidates.slice(0, 6).map((row) => {
            const isIn = row.amount >= 0;
            return (
              <View key={row.id} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: isIn ? t.positive : t.calm }]} />
                <Text numberOfLines={1} style={[styles.merchant, { color: t.ink }]}>
                  {row.merchant}
                </Text>
                <Text style={[styles.amount, { color: isIn ? t.positiveInk : t.repairInk }]}>
                  {formatSignedAmount(row.amount)}
                </Text>
              </View>
            );
          })}
          {candidates.length > 6 ? (
            <Text style={[styles.more, { color: t.muted }]}>
              {`+ ${candidates.length - 6} more`}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.meloBlock}>
        <MeloLine mood="calm" text="One tap adds it all. You can still check each one instead." />
      </View>

      <View style={styles.spacer} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add all as history"
        onPress={handleAddAll}
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: t.calm },
          pressed ? styles.pressed : undefined,
        ]}
      >
        <Text style={[styles.primaryLabel, { color: t.inverse }]}>Add all as history</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Review one by one"
        onPress={onReviewOneByOne}
        style={({ pressed }) => [styles.secondary, pressed ? styles.pressed : undefined]}
      >
        <Text style={[styles.secondaryLabel, { color: t.muted }]}>Review one by one</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.lg + gap.xs,
  },
  summary: {
    fontFamily: serif.display,
    fontSize: 17,
    lineHeight: 22,
  },
  list: {
    marginTop: gap.lg,
    rowGap: gap.sm,
  },
  row: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
  },
  dot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  merchant: {
    flex: 1,
    fontSize: 13.5,
  },
  amount: {
    fontFamily: serif.display,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  more: {
    fontSize: 11.5,
    marginTop: gap.xxs,
  },
  meloBlock: {
    marginTop: gap.lg + gap.xs,
  },
  spacer: {
    flex: 1,
  },
  primary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 58,
    justifyContent: 'center',
    marginTop: gap.lg,
  },
  primaryLabel: {
    fontSize: 15.5,
    fontWeight: '500',
  },
  secondary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 46,
    justifyContent: 'center',
    marginTop: gap.sm,
  },
  secondaryLabel: {
    fontSize: 13,
  },
  // Offer confirm card — head line + two-button row (primary confirm / quiet skip).
  offerHead: {
    fontFamily: serif.display,
    fontSize: 16,
    lineHeight: 21,
  },
  offerRow: {
    columnGap: gap.md,
    flexDirection: 'row',
    marginTop: gap.lg,
  },
  offerPrimary: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  offerPrimaryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  offerSecondary: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  offerSecondaryLabel: {
    fontSize: 14,
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
