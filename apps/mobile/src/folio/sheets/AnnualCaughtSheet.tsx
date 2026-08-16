// @rn-engine annual-radar — WIRED. `useCaughtAnnual()` (lib/caughtAnnual -> lib/historyStats
//   `detectAnnualCandidates` over the live ledger) supplies the candidate: gated on a debit cluster
//   recurring at roughly annual cadence (>=2 occurrences, similar magnitude, ~365-day or 11-13-month
//   gaps — see historyStats.ts's own doc), and not on the user's dismissed-annual list. An explicit
//   `candidate={null}` selects the empty branch; omitting `candidate` reads the first real caught
//   candidate, else null — never a synthetic sample.
//
// AnnualCaughtSheet — DATA_INTELLIGENCE.md phase ⑥ item 5 ("annual-bill radar"). Modeled directly on
// BillCaughtSheet.tsx / DriftCaughtSheet.tsx (same structure, voice, and kit usage) — the once-a-year
// sibling to those "caught" sheets.
//
// REAL ENTITY DECISION: unlike bill/sub drift, an annual bill is NOT confirmed into the `subs[]`
// catalog (that catalog is for RECURRING outflows the app tracks renewal countdowns for — see
// caughtBills.ts's own module header — and this codebase's Sub type has no annual cadence concept
// worth a renewal countdown for something that fires once a year). The honest minimal write is a
// dated `CalendarEvent` (`kind: 'out'`, store.ts) for the EXPECTED next occurrence — the same
// mechanism a user's own manual "Add a bill to the calendar" already uses (AddEventSheet), so this
// sheet's confirm reuses `addCalendarEvent` rather than inventing a new entity.
//
// SURFACE CHOICE (task brief: "pick the honest minimal surface that fits existing patterns, document
// choice"): this sheet is opened from a NEW quiet card appended to InsightsScreen's non-frozen extra
// block (see InsightsScreen.tsx's own comment at the annual-radar card) rather than a CalendarScreen
// row — both InsightsScreen's core layout and CalendarScreen are FROZEN 1:1 web ports, and Insights
// already grew non-frozen cards the same way (weekly digest, tiny wins) without touching the frozen
// portion above them.
//
// @rn-sheet     AnnualCaughtSheet
// @purpose      Melo noticed a bill that repeats about once a year. Confirm adds a dated calendar
//               event for the expected next occurrence, or dismiss this one. Hedged throughout
//               ("around", "usually") — an annual estimate is never presented as a settled fact.
// @reads        candidate is the first REAL caught candidate from useCaughtAnnual(), falling back to
//               the empty doorway.
// @writes       addCalendarEvent (REAL — confirm adds one dated 'out' event for the expected next
//               occurrence); dismissAnnualSignal (REAL — on "Not this one", records the merchant so
//               future detection passes stay quiet).
// @copy         copy.annual.caught.* — hedged throughout ("around", "usually").
// @tokens       --surface (sheet body) · --inset (candidate card) · --hairline (card border + divider)
//               · --accent (t.calm — accent name, amount, confirm fill) · --ink / --muted (text)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · gentle scale-in on the candidate card ·
//               press 0.97 on both actions · collapses to final state under reduce-motion (MOTION.md)
//
// STATES (mirrors the sibling caught sheets' five branches):
//   • populated — the happy path: Melo curious + hedged headline + candidate card + two actions.
//   • loading   — confirm in flight: primary label swaps "Add to calendar" -> "Adding…".
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
import { addCalendarEvent, dismissAnnualSignal } from '@/folio/store';
import {
  expectedMonthLabel,
  nextAnnualOccurrenceIso,
  useCaughtAnnual,
  type AnnualCaughtCandidate,
} from '@/folio/lib/caughtAnnual';

// The web `formatGBP`-equivalent whole-pound display — reused from the sibling sheets'
// `candidateAmountLabel` convention so every caught candidate reads the same way.
function candidateAmountLabel(amount: number): string {
  return magnitude(Math.round(amount) * 100);
}

// ---------------------------------------------------------------------------
// Public API — self-hosting sheet (mirrors BillCaughtSheet/DriftCaughtSheet): owns its own Sheet
// host so it drops straight into the shell as a sibling, `visible` driven by the 'annual-caught' SheetId.
// ---------------------------------------------------------------------------

export type AnnualCaughtSheetProps = {
  visible: boolean;
  onClose: () => void;
  // The detector-supplied candidate. Optional so the shell can mount the sheet before a signal
  // exists; when omitted, the FIRST real caught candidate is used, else the empty doorway — never a
  // synthetic sample. Pass `null` explicitly to force the empty branch.
  candidate?: AnnualCaughtCandidate | null | undefined;
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

export function AnnualCaughtSheet({ visible, onClose, candidate }: AnnualCaughtSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  // Real detector output over the live ledger (payment facts only — merchant / amount / occurrences /
  // last-seen). The shape matches AnnualCaughtCandidate, so the first real catch drops straight in.
  const caught = useCaughtAnnual();

  // Resolution order mirrors the sibling sheets: explicit prop (incl. `null`) wins; otherwise the
  // FIRST real caught candidate; otherwise NULL -> empty doorway. Never a synthetic sample.
  const resolved: AnnualCaughtCandidate | null =
    candidate === undefined ? (caught[0] ?? null) : candidate;

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      {resolved === null ? (
        // ---- empty branch — a calm doorway, never an error (annual.empty.*). ----
        <EmptyState
          mood="calm"
          headline={copy.annual.empty.head}
          body={copy.annual.empty.body}
          cta={{ label: copy.annual.empty.cta, onPress: onClose }}
        />
      ) : (
        <AnnualCaughtBody
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

function AnnualCaughtBody({
  styles: s,
  palette: t,
  reduceMotion,
  candidate,
  onClose,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
  candidate: AnnualCaughtCandidate;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<ConfirmStatus>('idle');
  const busy = status === 'busy';

  const month = expectedMonthLabel(candidate.lastSeen);
  const nextOccurrenceIso = useMemo(
    () => nextAnnualOccurrenceIso(candidate.lastSeen),
    [candidate.lastSeen],
  );

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

  // Confirm — the REAL write: a dated 'out' CalendarEvent for the expected next occurrence (one year
  // on from the last-seen charge — see lib/caughtAnnual.ts's nextAnnualOccurrenceIso), via the SAME
  // addCalendarEvent a manual "Add a bill" already uses. A failure surfaces err.generic and re-enables
  // the button rather than silently closing over a lost write.
  function confirm() {
    setStatus('busy');
    try {
      addCalendarEvent({
        date: nextOccurrenceIso,
        kind: 'out',
        title: candidate.merchant,
        amount: -Math.abs(candidate.amount),
      });
      onClose();
    } catch {
      setStatus('error');
    }
  }

  // Dismiss — records the merchant so future detection passes stay quiet (mirrors
  // dismissBillSignal's "said no once, stays quiet" contract). Writes nothing to calendarEvents; this
  // is a suppression, not a correction.
  function dismiss() {
    dismissAnnualSignal(candidate.merchant);
    onClose();
  }

  const headParts = splitHead(copy.annual.caught.head(candidate.merchant));

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
          <Text style={s.cardAmount}>{candidateAmountLabel(candidate.amount)}</Text>
        </View>
        <View style={s.cardMetaRow}>
          <Text style={s.cardMeta}>
            Seen {candidate.occurrences} {candidate.occurrences === 1 ? 'time' : 'times'}
          </Text>
          <View style={s.divider} />
          <Text style={s.cardMeta}>Usually {month}</Text>
        </View>
      </Animated.View>

      {/* Hedged explanation — never "is", always "around"/"usually". */}
      <Text style={s.hedge}>
        {copy.annual.caught.body(candidateAmountLabel(candidate.amount), month)}
      </Text>

      {/* Error path — honest, non-dismissing. Only after a failed write. */}
      {status === 'error' ? (
        <View style={s.errorRow}>
          <MeloLine text={copy.err.generic} mood="concern" size={28} />
        </View>
      ) : null}

      {/* Primary — Add to calendar / Adding… (the real write happens before close). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? 'Adding' : 'Add to calendar'}
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
          {busy ? 'Adding…' : 'Add to calendar'}
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
// Headline accent split — mirrors BillCaughtSheet's splitHead exactly.
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
