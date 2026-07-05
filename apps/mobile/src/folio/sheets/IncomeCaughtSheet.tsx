// IncomeCaughtSheet — DATA_INTELLIGENCE.md phase ② confirmation surface for
// detected income signals. Modeled directly on SubCaughtSheet.tsx (same
// structure, voice, and kit usage) — the recurring-CREDIT sibling to that
// recurring-CHARGE sheet.
//
// @rn-engine income-detector — WIRED. `useCaughtIncome()` (lib/caughtIncome ->
//   lib/incomeSignals `detectIncomeSources` over the live ledger) supplies the
//   candidate: gated on a signal existing, its merchant having no existing
//   `IncomeSource`, and not being on the user's dismissed list. An explicit
//   `candidate={null}` selects the empty branch; omitting `candidate` reads the
//   first real caught signal, else null — never a synthetic sample.
//
// @rn-sheet     IncomeCaughtSheet
// @purpose      Melo noticed a likely recurring credit. Confirm to promote it to a
//               declared income source (phase ① `IncomeSource`), or dismiss this one.
//               Hedged language throughout — "Looks like", never "is". Voice: "Melo
//               noticed", never "we detected".
// @reads        incomeSources (REAL — to skip a duplicate promote + keep the empty
//               branch honest); candidate is the first REAL caught signal from
//               useCaughtIncome(), falling back to the empty doorway when none exist.
// @writes       upsertIncomeSource (REAL — on confirm, writes a new IncomeSource with
//               source:'inferred'); dismissIncomeSignal (REAL — on "Not this one",
//               records the merchant so future detection passes stay quiet).
// @copy         copy.income.caught.* — head carries the accent merchant name; body
//               hedges harder ("amounts vary — check this") when confidence is
//               'possible' rather than 'strong'. Never claims certainty.
// @tokens       --surface (sheet body) · --inset (candidate card) · --hairline (card
//               border + divider) · --accent (t.calm — accent name/amount/confirm fill)
//               · --ink / --muted (text)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · gentle scale-in on the
//               candidate card · press 0.97 on both actions · collapses to final state
//               under reduce-motion (MOTION.md)
//
// STATES (mirrors SubCaughtSheet's five branches):
//   • populated — the happy path: Melo curious + hedged headline + candidate card +
//                 editable amount field + two actions.
//   • loading   — confirm in flight: primary label swaps "Yes, add it" -> "Adding…".
//   • empty     — guard: this sheet only opens when a candidate exists. With no
//                 candidate it renders the calm subs-style empty doorway.
//   • error     — if the write fails, the honest err.generic line shows and the
//                 button re-enables; the sheet does NOT dismiss on failure.
//   • offline   — a local write, so offline is identical to populated (no network).
//
// Design-system discipline: every colour / font / spacing / radius / shadow token
// comes from '@/folio/theme'. Melo + MeloLine from '@/folio/melo/*', strings from
// '@/folio/copy/copy', the empty doorway from '@/folio/ui/EmptyState'. Nothing new
// is defined — no colour, font, spacing token, or dependency. Tap targets >=44px.

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { gap, magnitude, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { copy } from '@/folio/copy/copy';
import {
  dismissIncomeSignal,
  upsertIncomeSource,
  useAppStore,
  type IncomeSource,
} from '@/folio/store';
import { useCaughtIncome, type IncomeCaughtCandidate } from '@/folio/lib/caughtIncome';
import type { IncomeCadence } from '@/folio/lib/incomeSignals';

// ---------------------------------------------------------------------------
// Cadence display label — plain English for the card + hedge copy. Node-safe,
// no locale dependence, mirrors the deterministic style of the engine's own
// `shortDateLabel`-type helpers.
// ---------------------------------------------------------------------------

const CADENCE_LABEL: Record<IncomeCadence, string> = {
  weekly: 'weekly',
  fortnightly: 'fortnightly',
  'four-weekly': 'four-weekly',
  monthly: 'monthly',
};

// The web `formatGBP`-equivalent whole-pound display used by SubCaughtSheet's
// `candidateAmountLabel` — reused here so income and sub candidates read the
// same way (whole pounds, pence only when non-zero via the kit's `magnitude`).
function candidateAmountLabel(amount: number): string {
  return magnitude(Math.round(amount * 100));
}

/** "2026-06-12" -> "12 Jun". Pure, UTC-based, no locale — matches caughtSubs.ts's
 *  own `shortDateLabel` so the two sheets format dates identically. */
const MONTHS_SHORT = [
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
] as const;

function shortDateLabel(iso: string): string {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) return iso;
  const d = new Date(ms);
  const day = d.getUTCDate();
  const month = MONTHS_SHORT[d.getUTCMonth()] ?? '';
  return `${day} ${month}`.trim();
}

// ---------------------------------------------------------------------------
// Public API — self-hosting sheet (mirrors SubCaughtSheet): owns its own Sheet
// host so it drops straight into the shell as a sibling, `visible` driven by
// the 'income-caught' SheetId.
// ---------------------------------------------------------------------------

export type IncomeCaughtSheetProps = {
  visible: boolean;
  onClose: () => void;
  // The detector-supplied candidate. Optional so the shell can mount the sheet
  // before a signal exists; when omitted, the FIRST real caught signal is used,
  // else the empty doorway — never a synthetic sample. Pass `null` explicitly
  // to force the empty branch.
  candidate?: IncomeCaughtCandidate | null | undefined;
};

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed, mirrors SubCaughtSheet's hook)
// ---------------------------------------------------------------------------

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduce(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

export function IncomeCaughtSheet({ visible, onClose, candidate }: IncomeCaughtSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  // Real detector output over the live ledger, already gated on "no existing
  // IncomeSource for this merchant" + "not dismissed" (lib/caughtIncome.ts).
  const caught = useCaughtIncome();

  // Resolution order mirrors SubCaughtSheet: explicit prop (incl. `null`) wins;
  // otherwise the FIRST real caught candidate; otherwise NULL -> empty doorway.
  // Never a synthetic sample — an app with nothing detected shows the honest
  // empty state, not fake data.
  const resolved: IncomeCaughtCandidate | null =
    candidate === undefined ? (caught[0] ?? null) : candidate;

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      {resolved === null ? (
        // ---- empty branch — a calm doorway, never an error. ----
        <EmptyState
          mood="calm"
          headline="No new pay patterns yet."
          body="When Melo notices a recurring payment into your account, it shows up here for you to check."
          cta={{ label: 'Not yet', onPress: onClose }}
        />
      ) : (
        <IncomeCaughtBody
          styles={s}
          palette={t}
          reduceMotion={reduceMotion}
          candidate={resolved}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The populated body — header + candidate card + editable amount + hedge +
// two actions. Hosts the loading + error branches as local state (`status`).
// ---------------------------------------------------------------------------

type ConfirmStatus = 'idle' | 'busy' | 'error';

function IncomeCaughtBody({
  styles: s,
  palette: t,
  reduceMotion,
  candidate,
  onClose,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
  candidate: IncomeCaughtCandidate;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<ConfirmStatus>('idle');
  // Editable amount — pre-filled with the detected median, but the user can
  // correct it before confirming (review-before-truth: the write is theirs).
  const [amountText, setAmountText] = useState(() => candidate.medianAmount.toFixed(2));

  // Real income sources — used only to avoid a duplicate promote if the list
  // changed since this sheet's candidate was computed (belt-and-braces; the
  // detector hook already filters known merchants).
  const incomeSources = useAppStore((state) => state.incomeSources ?? []);

  const busy = status === 'busy';
  const isPossible = candidate.confidence === 'possible';
  const cadenceLabel = CADENCE_LABEL[candidate.cadence];
  const isUpdate = candidate.updatesSourceId !== undefined;
  const primaryLabel = isUpdate ? copy.income.caught.update.cta : 'Yes, add it';

  // Gentle scale-in on the candidate card — mirrors SubCaughtSheet's @motion.
  const cardScale = useMemo(() => new Animated.Value(reduceMotion ? 1 : 0.96), [reduceMotion]);
  const cardOpacity = useMemo(() => new Animated.Value(reduceMotion ? 1 : 0), [reduceMotion]);
  useEffect(() => {
    if (reduceMotion) {
      cardScale.setValue(1);
      cardOpacity.setValue(1);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 320,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, cardScale, cardOpacity]);

  const editedAmount = parseFloat(amountText);
  const canConfirm = Number.isFinite(editedAmount) && editedAmount > 0;

  // Confirm — the REAL write: promote the candidate to a declared IncomeSource
  // (source:'inferred') via upsertIncomeSource, BEFORE dismissing. A failure
  // surfaces err.generic and re-enables the button rather than silently
  // closing over a lost write. Never auto-applied — this only runs on tap.
  //
  // When candidate.updatesSourceId is set, this is the SAME real income as an
  // existing declared source (see caughtIncome.ts sameIncomeMatch) — the write
  // MUST reuse that source's id so upsertIncomeSource REPLACES it in place,
  // never appends a second entry for the same income.
  function confirm() {
    if (!canConfirm) return;
    setStatus('busy');
    try {
      const already = incomeSources.some(
        (existing) =>
          existing.label.trim().toLowerCase() === candidate.merchant.trim().toLowerCase(),
      );
      if (!already) {
        const newSource: IncomeSource = {
          id: candidate.updatesSourceId ?? `income-${Date.now()}`,
          label: candidate.merchant,
          cadence: candidate.cadence,
          anchorISO: candidate.anchorISO,
          amount: editedAmount,
          source: 'inferred',
        };
        upsertIncomeSource(newSource);
      }
      onClose();
    } catch {
      setStatus('error');
    }
  }

  // Dismiss — records the merchant so future detection passes stay quiet
  // (mirrors HiddenReviewSheet's un-hide-able "said no once" contract). Writes
  // nothing to incomeSources; this is a suppression, not a correction.
  function dismiss() {
    dismissIncomeSignal(candidate.merchant);
    onClose();
  }

  const headParts = isUpdate
    ? splitHead(copy.income.caught.update.head())
    : splitHead(copy.income.caught.head(candidate.merchant));
  const hedgeBody = isUpdate
    ? isPossible
      ? copy.income.caught.update.body.possible(candidate.merchant, cadenceLabel)
      : copy.income.caught.update.body.strong(candidate.merchant, cadenceLabel)
    : isPossible
      ? copy.income.caught.body.possible(cadenceLabel)
      : copy.income.caught.body.strong(cadenceLabel);

  return (
    <View style={s.body}>
      {/* Header row — Melo (curious) + the hedged headline. */}
      <View style={s.headerRow}>
        <Melo size={32} mood="curious" />
        <View style={s.headerText}>
          <Text style={s.eyebrow}>Melo noticed</Text>
          {/* "Melo noticed <merchant>. pays you" — the merchant renders terracotta,
              upright (never italic), matching SubCaughtSheet's accent treatment. */}
          <Text accessibilityRole="header" style={s.headline}>
            {headParts.lead}
            <Text style={s.headlineAccent}>{headParts.accent}</Text>
          </Text>
        </View>
      </View>

      {/* Candidate card — inset well, hairline, gentle scale-in. */}
      <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
        <View style={s.cardTopRow}>
          <Text style={s.cardName}>{candidate.merchant}</Text>
          <Text style={s.cardAmount}>{candidateAmountLabel(candidate.medianAmount)}</Text>
        </View>
        <View style={s.cardMetaRow}>
          <Text style={s.cardMeta}>
            {candidate.occurrences} {cadenceLabel} payments
          </Text>
          <View style={s.divider} />
          <Text style={s.cardMeta}>Last: {shortDateLabel(candidate.lastSeenISO)}</Text>
        </View>
      </Animated.View>

      {/* Editable amount — pre-filled with the detected median; the user can
          correct it before confirm (review-before-truth: nothing is guessed
          into the store without a chance to fix it first). */}
      <View style={s.amountRow}>
        <Text style={s.amountLabel}>Amount</Text>
        <View style={s.amountValueRow}>
          <Text style={s.currency}>{copy.global.currency.symbol}</Text>
          <TextInput
            value={amountText}
            onChangeText={(text) => setAmountText(text.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            style={s.amountInput}
            accessibilityLabel="Amount"
          />
        </View>
      </View>

      {/* Hedged explanation — never "is", always "Looks like"; hedges harder
          when confidence is 'possible' (amounts vary). */}
      <Text style={s.hedge}>{hedgeBody}</Text>

      {/* Error path — honest, non-dismissing. Only after a failed write. */}
      {status === 'error' ? (
        <View style={s.errorRow}>
          <MeloLine text={copy.err.generic} mood="concern" size={28} />
        </View>
      ) : null}

      {/* Primary — 'Yes, add it' / 'Adding…' for a new source, or the update
          CTA / 'Updating…' when this candidate replaces an existing source
          (the real write happens before close either way). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? (isUpdate ? 'Updating' : 'Adding') : primaryLabel}
        accessibilityState={{ disabled: busy || !canConfirm }}
        disabled={busy || !canConfirm}
        onPress={confirm}
        style={({ pressed }) => [
          s.primary,
          { backgroundColor: t.calm },
          busy || !canConfirm ? s.primaryBusy : undefined,
          pressed && !busy && canConfirm ? s.pressed : undefined,
        ]}
      >
        <Text style={[s.primaryLabel, { color: t.inverse }]}>
          {busy ? (isUpdate ? 'Updating…' : 'Adding…') : primaryLabel}
        </Text>
      </Pressable>

      {/* Refusal — always an option, low emphasis (never a second filled button).
          Records the dismissal so this merchant stops surfacing. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Not this one"
        disabled={busy}
        hitSlop={10}
        onPress={dismiss}
        style={({ pressed }) => [s.refuse, pressed && !busy ? s.pressed : undefined]}
      >
        <Text style={s.refuseLabel}>Not this one</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Headline accent split — copy.income.caught.head is "Melo noticed **{merchant}**
// pays you." The deck wraps the accent run in ** **; this splits the finished
// string into the plain lead + accent so the render layer can colour only the
// {merchant} portion terracotta, matching SubCaughtSheet's splitHead exactly.
// ---------------------------------------------------------------------------

function splitHead(head: string): { lead: string; accent: string; trail?: string } {
  const open = head.indexOf('**');
  const close = head.indexOf('**', open + 2);
  if (open === -1 || close === -1 || close === open) {
    return { lead: '', accent: head };
  }
  return {
    lead: head.slice(0, open),
    accent: head.slice(open + 2, close) + head.slice(close + 2),
  };
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette. Layout metrics
// mirror SubCaughtSheet's makeStyles 1:1 so the two sheets feel like siblings,
// plus one extra `amountRow`/`amountValueRow`/`amountInput`/`currency` block
// for the editable-amount field (styled after LogSpendSheet's amount card).
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: {
      paddingBottom: gap.sm,
    },

    headerRow: {
      alignItems: 'flex-start',
      columnGap: gap.md,
      flexDirection: 'row',
    },
    headerText: {
      flex: 1,
    },
    eyebrow: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      fontStyle: 'italic',
    },
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 24,
      letterSpacing: -0.3,
      lineHeight: 28,
      marginTop: gap.xxs,
    },
    headlineAccent: {
      color: t.calm,
    },

    card: {
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.lg + gap.xs,
      paddingHorizontal: gap.lg + gap.xs,
      paddingVertical: gap.lg,
    },
    cardTopRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    cardName: {
      color: t.ink,
      fontSize: 15,
    },
    cardAmount: {
      color: t.calm,
      fontFamily: serif.display,
      fontSize: 22,
      fontVariant: ['tabular-nums'],
    },
    cardMetaRow: {
      alignItems: 'center',
      columnGap: gap.md,
      flexDirection: 'row',
      marginTop: gap.sm,
    },
    cardMeta: {
      color: t.muted,
      fontSize: 11.5,
    },
    divider: {
      backgroundColor: t.hairline,
      height: 12,
      width: StyleSheet.hairlineWidth,
    },

    // Editable amount row — inset card, label left, £ + input right (mirrors
    // LogSpendSheet's amountCard/amountValueRow/amountInput/currency).
    amountRow: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: gap.md,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    amountLabel: {
      color: t.muted,
      fontSize: 13,
    },
    amountValueRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
    },
    currency: {
      color: t.calm,
      fontFamily: serif.display,
      fontSize: 20,
      marginRight: gap.xxs,
    },
    amountInput: {
      color: t.calm,
      fontFamily: serif.display,
      fontSize: 20,
      fontVariant: ['tabular-nums'],
      minWidth: 64,
      padding: 0,
      textAlign: 'right',
    },

    hedge: {
      color: t.muted,
      fontSize: 13.5,
      lineHeight: 20,
      marginTop: gap.lg,
    },

    errorRow: {
      marginTop: gap.md,
    },

    primary: {
      alignItems: 'center',
      borderRadius: radius.lg,
      height: 48,
      justifyContent: 'center',
      marginTop: gap.lg + gap.xs,
    },
    primaryBusy: {
      opacity: 0.5,
    },
    primaryLabel: {
      fontSize: 14,
      fontWeight: '500',
    },

    refuse: {
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      marginTop: gap.sm,
    },
    refuseLabel: {
      color: t.muted,
      fontSize: 12.5,
      textAlign: 'center',
    },

    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
