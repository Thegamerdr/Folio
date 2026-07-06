// @rn-engine drift-detector — WIRED. `useCaughtDrift()` (lib/caughtDrift -> lib/driftSignals
//   `detectIncomeDrift` + `detectBillDrift` over the live ledger/declared sources/sub catalog)
//   supplies the candidate: gated on a >15% deviation existing for an inferred/onboarding income
//   source or a catalogued bill/sub, and not on the user's dismissed-drift list. An explicit
//   `candidate={null}` selects the empty branch; omitting `candidate` reads the first real caught
//   candidate, else null — never a synthetic sample.
//
// DriftCaughtSheet — DATA_INTELLIGENCE.md phase ⑥ ("history-fed forecasts", item 3 bill-drift + the
// drift re-check folded in from phase ②). Modeled directly on BillCaughtSheet.tsx / IncomeCaughtSheet.tsx
// (same structure, voice, and kit usage) — ONE sheet, TWO flavours (task brief: "one generic pattern,
// two flavors") rather than two near-duplicate sheets, since income-drift and bill-drift are the same
// UX shape: "here's a number that moved since we last asked you, update it or don't."
//
// @rn-sheet     DriftCaughtSheet
// @purpose      Melo noticed a stored number (declared pay, or a tracked bill's cost) has drifted from
//               what the live ledger currently shows. Confirm updates that SAME entity in place — never
//               a new one — or dismiss this one. Hedged language throughout ("around", "usually",
//               "lately") — a drift observation is a history-fed ESTIMATE, never a settled fact.
// @reads        candidate is the first REAL caught candidate from useCaughtDrift(), falling back to
//               the empty doorway.
// @writes       upsertIncomeSource (REAL — income-flavour confirm: replaces the SAME source id with
//               the detected amount/cadence, never appends a second source); setSubs (REAL —
//               bill-flavour confirm: updates the matched Sub's `cost` in place by name, never appends
//               a new Sub); confirmDriftSignal (REAL — on confirm, starts this merchant's 45-day
//               re-propose COOLDOWN so the number just corrected doesn't immediately re-trigger on
//               noise); dismissDriftSignal (REAL — on "Not this one", starts the SAME cooldown, shared
//               list for both flavours — either action means "dealt with, stay quiet for a while").
// @copy         copy.drift.caught.* — hedged throughout, cadence-aware for the income flavour.
// @tokens       --surface (sheet body) · --inset (candidate card) · --hairline (card border + divider)
//               · --accent (t.calm — accent name, amount, confirm fill) · --ink / --muted (text)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · gentle scale-in on the candidate card ·
//               press 0.97 on both actions · collapses to final state under reduce-motion (MOTION.md)
//
// STATES (mirrors BillCaughtSheet's/IncomeCaughtSheet's five branches):
//   • populated — the happy path: Melo curious + hedged headline + candidate card + two actions.
//   • loading   — confirm in flight: primary label swaps "Yes, update it" -> "Updating…".
//   • empty     — guard: this sheet only opens when a candidate exists. With no candidate it renders
//                 a calm doorway (EmptyState) rather than an error.
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
import {
  confirmDriftSignal,
  dismissDriftSignal,
  setSubs,
  upsertIncomeSource,
  useAppStore,
} from '@/folio/store';
import { useCaughtDrift, type DriftCaughtCandidate } from '@/folio/lib/caughtDrift';

// ---------------------------------------------------------------------------
// Cadence display label — reused from the sibling sheets' tables so every "caught" sheet reads
// consistently. Only the income flavour with a detected cadence uses this.
// ---------------------------------------------------------------------------

const CADENCE_LABEL: Record<'weekly' | 'fortnightly' | 'four-weekly' | 'monthly', string> = {
  weekly: 'weekly',
  fortnightly: 'fortnightly',
  'four-weekly': 'four-weekly',
  monthly: 'monthly',
};

// The web `formatGBP`-equivalent whole-pound display — reused from the sibling sheets'
// `candidateAmountLabel` convention so every caught candidate reads the same way.
function candidateAmountLabel(amount: number): string {
  return magnitude(Math.round(amount) * 100);
}

// ---------------------------------------------------------------------------
// Public API — self-hosting sheet (mirrors BillCaughtSheet/IncomeCaughtSheet): owns its own Sheet
// host so it drops straight into the shell as a sibling, `visible` driven by the 'drift-caught' SheetId.
// ---------------------------------------------------------------------------

export type DriftCaughtSheetProps = {
  visible: boolean;
  onClose: () => void;
  // The detector-supplied candidate. Optional so the shell can mount the sheet before a signal
  // exists; when omitted, the FIRST real caught candidate is used, else the empty doorway — never a
  // synthetic sample. Pass `null` explicitly to force the empty branch.
  candidate?: DriftCaughtCandidate | null | undefined;
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

export function DriftCaughtSheet({ visible, onClose, candidate }: DriftCaughtSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  // Real detector output over the live ledger + declared sources + sub catalog (payment facts only —
  // merchant / stored vs detected amount / cadence where relevant). The shape matches
  // DriftCaughtCandidate, so the first real catch drops straight in.
  const caught = useCaughtDrift();

  // Resolution order mirrors the sibling sheets: explicit prop (incl. `null`) wins; otherwise the
  // FIRST real caught candidate; otherwise NULL -> empty doorway. Never a synthetic sample.
  const resolved: DriftCaughtCandidate | null =
    candidate === undefined ? (caught[0] ?? null) : candidate;

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      {resolved === null ? (
        // ---- empty branch — a calm doorway, never an error. ----
        <EmptyState
          mood="calm"
          headline="Nothing drifting right now."
          body="When a stored number stops matching what the ledger shows, it turns up here for you to check."
          cta={{ label: 'Not yet', onPress: onClose }}
        />
      ) : (
        <DriftCaughtBody
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
// The populated body — header + candidate card + hedge + two actions. Hosts the loading + error
// branches as local state (`status`). Branches its copy/write on `candidate.kind`, never its layout.
// ---------------------------------------------------------------------------

type ConfirmStatus = 'idle' | 'busy' | 'error';

function DriftCaughtBody({
  styles: s,
  palette: t,
  reduceMotion,
  candidate,
  onClose,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
  candidate: DriftCaughtCandidate;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<ConfirmStatus>('idle');

  // Real store slices — used to confirm the entity being updated still exists (belt-and-braces; the
  // detector hook already computed against the live slices) so a confirm updates the honest current
  // record, not a stale one.
  const incomeSources = useAppStore((state) => state.incomeSources ?? []);
  const subs = useAppStore((state) => state.subs);

  const busy = status === 'busy';
  const isIncome = candidate.kind === 'income';

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

  // Confirm — the REAL write, UPDATES the same entity in place (never appends a second one):
  //   income flavour -> upsertIncomeSource with the SAME sourceId (replaces, per upsertIncomeSource's
  //     own "exists ? replace : append" contract).
  //   bill flavour    -> setSubs mapping the matched Sub's cost by name (id-free entity — Subs are
  //     keyed by name, see caughtBills.ts's own REAL BILL ENTITY DECISION note).
  // Then confirmDriftSignal starts this merchant's re-propose cooldown (task: "drift thrash" fix) — a
  // confirm means "dealt with", so the number just corrected shouldn't immediately re-trigger from
  // noise on the next landing, mirroring dismiss's cooldown exactly.
  // A failure surfaces err.generic and re-enables the button rather than silently closing over a
  // lost write.
  function confirm() {
    setStatus('busy');
    try {
      if (candidate.kind === 'income') {
        const existing = incomeSources.find((source) => source.id === candidate.sourceId);
        if (existing !== undefined) {
          upsertIncomeSource({
            ...existing,
            amount: candidate.detectedAmount,
            ...(candidate.detectedCadence !== undefined
              ? { cadence: candidate.detectedCadence }
              : {}),
          });
        }
      } else {
        setSubs((prev) =>
          prev.map((sub) =>
            sub.name.trim().toLowerCase() === candidate.merchant.trim().toLowerCase()
              ? { ...sub, cost: candidate.detectedAmount }
              : sub,
          ),
        );
      }
      confirmDriftSignal(candidate.merchant);
      onClose();
    } catch {
      setStatus('error');
    }
  }

  // Dismiss — starts this merchant's 45-day re-propose cooldown (task: "drift thrash" fix), same
  // cooldown log confirm() writes to, so either action means "stop re-proposing this for a while".
  // Writes nothing to incomeSources/subs; this is a suppression, not a correction.
  function dismiss() {
    dismissDriftSignal(candidate.merchant);
    onClose();
  }

  const headText = isIncome
    ? copy.drift.caught.income.head()
    : copy.drift.caught.bill.head(candidate.merchant);
  const headParts = splitHead(headText);

  const bodyText = isIncome
    ? copy.drift.caught.income.body(
        candidate.merchant,
        candidateAmountLabel(candidate.detectedAmount),
        candidate.detectedCadence !== undefined
          ? CADENCE_LABEL[candidate.detectedCadence]
          : candidate.storedCadence !== undefined
            ? CADENCE_LABEL[
                candidate.storedCadence === 'last-working-day' ? 'monthly' : candidate.storedCadence
              ]
            : 'usual',
      )
    : copy.drift.caught.bill.body(
        candidate.merchant,
        candidateAmountLabel(candidate.detectedAmount),
      );

  return (
    <View style={s.body}>
      {/* Header row — Melo (curious) + the hedged headline. */}
      <View style={s.headerRow}>
        <Melo size={32} mood="curious" />
        <View style={s.headerText}>
          <Text style={s.eyebrow}>Melo noticed</Text>
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
          <Text style={s.cardAmount}>{candidateAmountLabel(candidate.detectedAmount)}</Text>
        </View>
        <View style={s.cardMetaRow}>
          <Text style={s.cardMeta}>Was {candidateAmountLabel(candidate.storedAmount)}</Text>
          {candidate.kind === 'bill' ? (
            <>
              <View style={s.divider} />
              <Text style={s.cardMeta}>Last: {shortDateLabel(candidate.lastSeenISO)}</Text>
            </>
          ) : null}
        </View>
      </Animated.View>

      {/* Hedged explanation — never a bare figure presented as fact; always "around"/"usually"/
          "lately" per the copy deck. */}
      <Text style={s.hedge}>{bodyText}</Text>

      {/* Error path — honest, non-dismissing. Only after a failed write. */}
      {status === 'error' ? (
        <View style={s.errorRow}>
          <MeloLine text={copy.err.generic} mood="concern" size={28} />
        </View>
      ) : null}

      {/* Primary — Yes, update it / Updating… (the real write happens before close). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? 'Updating' : copy.drift.caught.cta}
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
        <Text style={[s.primaryLabel, { color: t.inverse }]}>
          {busy ? 'Updating…' : copy.drift.caught.cta}
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
// Headline accent split — mirrors BillCaughtSheet's / IncomeCaughtSheet's splitHead exactly: the
// deck wraps the accent run in ** **; this splits the finished string into the plain lead + accent
// so the render layer can colour only the marked portion terracotta.
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

// Short month labels for the bill flavour's "Last: {date}" meta — deterministic + Node-safe (no
// locale/Intl dependence), identical table to caughtBills.ts / IncomeCaughtSheet.tsx so every
// "caught" sheet formats dates the same way.
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
  const ms = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(ms)) return iso;
  const d = new Date(ms);
  const day = d.getUTCDate();
  const month = MONTHS_SHORT[d.getUTCMonth()] ?? '';
  return `${day} ${month}`.trim();
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette. Layout metrics mirror
// BillCaughtSheet's makeStyles 1:1 so every "caught" sheet feels like siblings.
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
