// SubCaughtSheet — "Folio spotted a likely recurring charge."
//
// Faithful RN port of the web SheetSubCaught (src/components/folio/sheets/SheetSubCaught.tsx).
// Folio noticed one merchant charging a similar amount, about once a month, that is NOT already a
// subscription, and asks — never claims — whether to add it. The copy is FROZEN: it says "Looks
// like", never "is"; it never asserts certainty. The user confirms (-> create the subscription) or
// waves it away ("Not this one").
//
// Presentation ONLY. It never talks to the engine. The container computes the candidate with the
// engine's detectRecurringChargeCandidate (RecurringChargeCandidate) and passes it in; on confirm it
// calls onConfirm(candidate) — the container creates the subscription through the canonical mutation
// path and closes the sheet. Money is read through formatMinorAmount so there's no formatting drift
// with the rest of the surface. The candidate already carries minor units + a pre-formatted date
// label, so this file never formats a date or touches money beyond formatMinorAmount.
//
// @rn-sheet  SubCaughtSheet
// @copy      FROZEN — never claims certainty. "Looks like" not "is".
// @tokens    paper.surface · paper.inset · paper.hairline · paper.calm · gap · radius
// @motion    sheet-rise (shared Sheet primitive) · the candidate card rests inside the rise

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatMinorAmount } from '../../../local/localLedger';
import type { RecurringChargeCandidate } from '../../../local/recurringChargeDetection';
import {
  Body,
  Headline,
  PrimaryAction,
  QuietLink,
  gap,
  paper,
  radius,
  serif,
} from '../kit';
import { MeloFigure } from '../melo/MeloFigure';
import { Sheet } from '../Sheet';

// The visible-during-confirm flag drives the FROZEN "Adding…" label so the user sees the create land
// rather than a silent close. Once busy, the secondary "Not this one" path is disabled too, so the
// confirm can't race a dismiss.
export type SubCaughtSheetProps = Readonly<{
  // The likely-recurring charge the engine surfaced, or null when there's nothing to suggest. When
  // null the sheet renders nothing (the container simply shouldn't open it, but null is handled so a
  // stale candidate can't crash the surface).
  candidate: RecurringChargeCandidate | null;
  // Whether the sheet is on screen. The shared Sheet primitive owns the rise/scrim.
  visible: boolean;
  // Confirm: add this candidate as a subscription. The container performs the create through the
  // canonical mutation path, then closes the sheet. The confirmed candidate is passed back so the
  // container has the name/amount/category without re-deriving them.
  onConfirm: (candidate: RecurringChargeCandidate) => void;
  // Dismiss without adding — "Not this one", or a scrim tap.
  onClose: () => void;
  // Honour the OS reduce-motion preference; forwarded to the shared Sheet. Source it the same way
  // the container sources it for every other sheet.
  reduceMotion?: boolean | undefined;
}>;

export function SubCaughtSheet({
  candidate,
  visible,
  onConfirm,
  onClose,
  reduceMotion,
}: SubCaughtSheetProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = () => {
    if (busy || candidate === null) return;
    setBusy(true);
    onConfirm(candidate);
  };

  // Nothing to suggest — render nothing rather than an empty sheet. In practice the container only
  // opens this sheet when a candidate exists; this guard just keeps a stale null from crashing.
  if (candidate === null) {
    return null;
  }

  return (
    <Sheet onClose={onClose} reduceMotion={reduceMotion} visible={visible}>
      <View style={styles.body}>
        <View style={styles.header}>
          <MeloFigure mood="attentive" reduceMotion={reduceMotion} size={32} />
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>I noticed</Text>
            <Headline accent={`${candidate.name}.`} lead="Folio spotted " style={styles.headline} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardName}>{candidate.name}</Text>
            <Text style={styles.cardAmount}>{formatMinorAmount(candidate.amountMinor)}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>{`Seen ${candidate.seen} months in a row`}</Text>
            <View style={styles.metaDivider} />
            <Text style={styles.metaText}>{`Last: ${candidate.lastDateLabel}`}</Text>
          </View>
        </View>

        <Body style={styles.lead}>
          Looks like a monthly charge. Add it to subscriptions so Folio can plan around it?
        </Body>

        <View style={styles.action}>
          <PrimaryAction
            accessibilityHint="Adds this charge to your subscriptions"
            disabled={busy}
            label={busy ? 'Adding…' : 'Yes, add it'}
            onPress={handleConfirm}
          />
        </View>
        <View style={styles.quiet}>
          <QuietLink
            accessibilityHint="Dismiss this suggestion"
            label="Not this one"
            onPress={busy ? () => {} : onClose}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: gap.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: gap.md,
  },
  headerText: {
    flex: 1,
    gap: gap.xxs,
  },
  // The italic serif kicker above the headline (web: font-display italic, muted ink).
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
    color: paper.muted,
  },
  headline: {
    fontSize: 24,
    lineHeight: 29,
  },
  // The candidate card — a near-white inset well with a hairline edge (web: bg-inset + hairline).
  card: {
    backgroundColor: paper.inset,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairline,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
    marginTop: gap.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 15,
    color: paper.ink,
  },
  // Amount in the terracotta accent, serif, tabular — money always reads as money.
  cardAmount: {
    fontFamily: serif.display,
    fontSize: 22,
    color: paper.calm,
    fontVariant: ['tabular-nums'],
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.sm,
    marginTop: gap.xs,
  },
  metaText: {
    fontSize: 11.5,
    color: paper.muted,
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
    backgroundColor: paper.hairlineStrong,
  },
  lead: {
    color: paper.muted,
    marginTop: gap.xs,
  },
  action: {
    marginTop: gap.sm,
  },
  quiet: {
    alignItems: 'center',
    marginTop: gap.xs,
  },
});
