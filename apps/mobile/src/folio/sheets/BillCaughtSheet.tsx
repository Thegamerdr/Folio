// @rn-engine bill-detector — WIRED. `useCaughtBills()` (lib/caughtBills -> lib/subSignals
//   `detectRecurring` over the live ledger) supplies the candidate: gated on a confirmed
//   weekly/fortnightly/monthly series existing, its merchant NOT already in the subs catalog, NOT
//   already claimed by the sub-catch pass (subs take precedence — see lib/caughtBills.ts), and not on
//   the user's dismissed-bills list. An explicit `candidate={null}` selects the empty branch;
//   omitting `candidate` reads the first real caught candidate, else null — never a synthetic sample.
//
// BillCaughtSheet — DATA_INTELLIGENCE.md phase ⑤(B). Modeled directly on SubCaughtSheet.tsx /
// IncomeCaughtSheet.tsx (same structure, voice, and kit usage) — the recurring-BILL sibling to
// SubCaughtSheet's recurring-charge catch and IncomeCaughtSheet's recurring-credit catch.
//
// REAL ENTITY DECISION (recorded in full in lib/caughtBills.ts's module header): the live folio spine
// has no separate bill entity — `AddEntryScreen`'s own "Add a bill" flow writes `setSubs`, so a `Sub`
// IS the recurring-outflow record for both subscriptions and bills. Confirm here writes the exact
// same `subs[]` catalog SubCaughtSheet's confirm does; the two sheets differ only in which merchants
// they catch (mutually exclusive, subs win ties) and in copy voice ("going out" vs "spotted").
//
// @rn-sheet     BillCaughtSheet
// @purpose      Melo noticed a likely recurring bill (money going out). Confirm to add it as a
//               tracked recurring cost (the same catalog a caught subscription joins), or dismiss
//               this one. Hedged language throughout — "Looks like", never "is".
// @reads        subs (REAL — to skip a duplicate add + keep the empty branch honest); candidate is
//               the first REAL caught bill from useCaughtBills(), falling back to the empty doorway.
// @writes       setSubs (REAL — the confirmed candidate is appended to the same recurring-cost list
//               SubCaughtSheet writes to); dismissBillSignal (REAL — on "Not this one", records the
//               merchant so future detection passes stay quiet).
// @copy         copy.bills.caught.* — head carries the accent merchant name; body is cadence-aware
//               (weekly/fortnightly/monthly, DATA_INTELLIGENCE.md phase ⑤(A)). Never claims certainty.
// @tokens       --surface (sheet body) · --inset (candidate card) · --hairline (card border + divider)
//               · --accent (t.calm — accent name, amount, confirm fill) · --ink / --muted (text)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · gentle scale-in on the candidate card ·
//               press 0.97 on both actions · collapses to final state under reduce-motion (MOTION.md)
//
// STATES (mirrors SubCaughtSheet's / IncomeCaughtSheet's five branches):
//   • populated — the happy path: Melo curious + hedged headline + candidate card + two actions.
//   • loading   — confirm in flight: primary label swaps "Yes, add it" -> "Adding…".
//   • empty     — guard: this sheet only opens when a candidate exists. With no candidate it renders
//                 the calm bills.empty doorway (EmptyState) rather than an error.
//   • error     — if the write fails, the honest err.generic line shows and the button re-enables;
//                 the sheet does NOT dismiss on failure (no silent close over a lost write).
//   • offline   — a local write, so offline is identical to populated (no network).
//
// Design-system discipline: every colour / font / spacing / radius / shadow token comes from
// '@/folio/theme'. Melo + MeloLine from '@/folio/melo/*', strings from '@/folio/copy/copy', the empty
// doorway from '@/folio/ui/EmptyState'. Nothing new is defined — no colour, font, spacing token, or
// dependency. Tap targets are >=44px; tap-only.

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { gap, magnitude, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { copy } from '@/folio/copy/copy';
import { dismissBillSignal, setSubs, useAppStore, type Sub } from '@/folio/store';
import { useCaughtBills, type CaughtBillCandidate } from '@/folio/lib/caughtBills';
import {
  anchorIsoFor,
  nextRenewalDaysAwayFrom,
  renewalPeriodDaysFor,
} from '@/folio/lib/renewalMath';
import type { Cadence } from '@/folio/lib/subSignals';

// ---------------------------------------------------------------------------
// Cadence display labels — mirrors SubCaughtSheet's CADENCE_LABEL/CADENCE_UNIT
// tables exactly so all three "caught" sheets read consistently.
// ---------------------------------------------------------------------------

const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: 'weekly',
  fortnightly: 'fortnightly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  yearly: 'yearly',
};

const CADENCE_UNIT: Record<Cadence, string> = {
  weekly: 'weeks',
  fortnightly: 'fortnights',
  monthly: 'months',
  quarterly: 'quarters',
  yearly: 'years',
};

// The web `formatGBP`-equivalent whole-pound display — reused from SubCaughtSheet's
// `candidateAmountLabel` convention so bill/sub/income candidates all read the same way.
function candidateAmountLabel(amount: number): string {
  return magnitude(Math.round(amount) * 100);
}

// ---------------------------------------------------------------------------
// Public API — self-hosting sheet (mirrors SubCaughtSheet/IncomeCaughtSheet): owns its own Sheet
// host so it drops straight into the shell as a sibling, `visible` driven by the 'bill-caught' SheetId.
// ---------------------------------------------------------------------------

export type BillCaughtSheetProps = {
  visible: boolean;
  onClose: () => void;
  // The detector-supplied candidate. Optional so the shell can mount the sheet before a signal
  // exists; when omitted, the FIRST real caught candidate is used, else the empty doorway — never a
  // synthetic sample. Pass `null` explicitly to force the empty branch.
  candidate?: CaughtBillCandidate | null | undefined;
};

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed, mirrors the sibling sheets' hook)
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

export function BillCaughtSheet({ visible, onClose, candidate }: BillCaughtSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  // Real detector output over the live ledger (payment facts only — name / amount / seen /
  // last-charged / cadence). The shape matches CaughtBillCandidate, so the first real catch drops
  // straight in.
  const caught = useCaughtBills();

  // Resolution order mirrors the sibling sheets: explicit prop (incl. `null`) wins; otherwise the
  // FIRST real caught candidate; otherwise NULL -> empty doorway. Never a synthetic sample.
  const resolved: CaughtBillCandidate | null =
    candidate === undefined ? (caught[0] ?? null) : candidate;

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      {resolved === null ? (
        // ---- empty branch — a calm doorway, never an error (bills.empty.*). ----
        <EmptyState
          mood="calm"
          headline={copy.bills.empty.head}
          body={copy.bills.empty.body}
          cta={{ label: copy.bills.empty.cta, onPress: onClose }}
        />
      ) : (
        <BillCaughtBody
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
// The populated body — header + candidate card + hedge + two actions.
//   Hosts the loading + error branches as local state (`status`).
// ---------------------------------------------------------------------------

type ConfirmStatus = 'idle' | 'busy' | 'error';

function BillCaughtBody({
  styles: s,
  palette: t,
  reduceMotion,
  candidate,
  onClose,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
  candidate: CaughtBillCandidate;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<ConfirmStatus>('idle');

  // Real subs — used to skip a duplicate add (belt-and-braces; the detector hook already filters
  // catalog + sub-claimed merchants) and so a confirm appends to the honest list, not a fabricated one.
  const subs = useAppStore((state) => state.subs);

  const busy = status === 'busy';
  const cadenceLabel = CADENCE_LABEL[candidate.cadence];

  // Gentle scale-in on the candidate card — mirrors the sibling sheets' @motion.
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

  // Confirm — perform the REAL write, then close. Appends the candidate to `subs` (the real
  // recurring-outflow catalog — see the module-header decision note) via `setSubs` BEFORE
  // dismissing. A failure surfaces err.generic and re-enables the button rather than silently
  // closing over a lost write.
  function confirm() {
    setStatus('busy');
    try {
      const already = subs.some(
        (existing) => existing.name.trim().toLowerCase() === candidate.name.trim().toLowerCase(),
      );
      if (!already) {
        const todayIso = new Date().toISOString().slice(0, 10);
        // Honest renewal estimate derived from the SAME facts the detector caught (cadence +
        // last-charged date) — never a hardcoded constant (lib/renewalMath.ts; identical
        // convention to SubCaughtSheet's confirm). The date-anchor pair makes it durable: every
        // hydration re-derives the day count from the anchor, so it never rots.
        const daysAway = nextRenewalDaysAwayFrom(
          candidate.cadence,
          candidate.lastDateIso,
          todayIso,
        );
        const periodDays = renewalPeriodDaysFor(candidate.cadence);
        const newSub: Sub = {
          name: candidate.name,
          cost: candidate.amount,
          nextRenewalDaysAway: daysAway,
          nextRenewalISO: anchorIsoFor(daysAway, todayIso),
          ...(periodDays !== undefined ? { renewalPeriodDays: periodDays } : {}),
          lastUsedDaysAgo: 0,
          usesPerMonth: 0,
        };
        setSubs((prev) => [...prev, newSub]);
      }
      onClose();
    } catch {
      setStatus('error');
    }
  }

  // Dismiss — records the merchant so future detection passes stay quiet (mirrors
  // IncomeCaughtSheet's dismiss contract). Writes nothing to subs; this is a suppression, not a
  // correction.
  function dismiss() {
    dismissBillSignal(candidate.name);
    onClose();
  }

  const headParts = splitHead(copy.bills.caught.head(candidate.name));

  return (
    <View style={s.body}>
      {/* Header row — Melo (curious) + the hedged headline. */}
      <View style={s.headerRow}>
        <Melo size={32} mood="curious" />
        <View style={s.headerText}>
          <Text style={s.eyebrow}>Melo noticed</Text>
          {/* "Melo noticed <name>. going out" — the name renders terracotta, upright (never
              italic), matching SubCaughtSheet's / IncomeCaughtSheet's accent treatment. */}
          <Text accessibilityRole="header" style={s.headline}>
            {headParts.lead}
            <Text style={s.headlineAccent}>{headParts.accent}</Text>
          </Text>
        </View>
      </View>

      {/* Candidate card — inset well, hairline, gentle scale-in. */}
      <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
        <View style={s.cardTopRow}>
          <Text style={s.cardName}>{candidate.name}</Text>
          <Text style={s.cardAmount}>{candidateAmountLabel(candidate.amount)}</Text>
        </View>
        <View style={s.cardMetaRow}>
          <Text style={s.cardMeta}>
            Seen {candidate.seen} {CADENCE_UNIT[candidate.cadence]} in a row
          </Text>
          <View style={s.divider} />
          <Text style={s.cardMeta}>Last: {candidate.lastDate}</Text>
        </View>
      </Animated.View>

      {/* Hedged explanation — never "is", always "Looks like"; cadence-aware. */}
      <Text style={s.hedge}>{copy.bills.caught.body(cadenceLabel)}</Text>

      {/* Error path — honest, non-dismissing. Only after a failed add. */}
      {status === 'error' ? (
        <View style={s.errorRow}>
          <MeloLine text={copy.err.generic} mood="concern" size={28} />
        </View>
      ) : null}

      {/* Primary — Yes, add it / Adding… (the real write happens before close). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? 'Adding' : 'Yes, add it'}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={confirm}
        style={({ pressed }) => [
          s.primary,
          { backgroundColor: t.calm },
          busy ? s.primaryBusy : undefined,
          pressed && !busy ? s.pressed : undefined,
        ]}
      >
        <Text style={[s.primaryLabel, { color: t.accentInk }]}>
          {busy ? 'Adding…' : 'Yes, add it'}
        </Text>
      </Pressable>

      {/* Refusal — always an option, low emphasis (never a second filled button). Records the
          dismissal so this merchant stops surfacing. */}
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
// Headline accent split — copy.bills.caught.head is "Melo noticed **{merchant}** going out." Splits
// the finished string into the plain lead + accent so the render layer can colour only the
// {merchant} portion terracotta, matching the sibling sheets' splitHead exactly.
// ---------------------------------------------------------------------------

function splitHead(head: string): { lead: string; accent: string } {
  const open = head.indexOf('**');
  const close = head.lastIndexOf('**');
  if (open === -1 || close === -1 || close === open) {
    return { lead: '', accent: head };
  }
  return {
    lead: head.slice(0, open),
    accent: head.slice(open + 2, close),
  };
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette. Layout metrics mirror
// SubCaughtSheet's makeStyles 1:1 so all three "caught" sheets feel like siblings.
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
      color: t.calmStrong,
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
      color: t.calmStrong,
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
