// @rn-engine sub-detector — the recurring-charge detector that supplies this candidate is wired
//   later (see RN_PORT.md "Subscription detector" + BUILD_PLAN §3). Until it exists, the sheet
//   renders against a synthetic candidate (the web prototype's hardcoded one), so the layout, copy,
//   states and Melo mood can be verified now. When the engine lands, pass `candidate` (or read a
//   `pendingSubCandidate` slice) instead — the render branches below already cover the null case.
//
// SubCaughtSheet — the faithful 1:1 React Native port of the web "subscription spotted" sheet
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetSubCaught.tsx).
//
// @rn-sheet     SubCaughtSheet
// @purpose      Folio spotted a likely recurring charge. Confirm to add it as a subscription, or
//               dismiss this one. Hedged language throughout — "Looks like", never "is".
// @reads        subs (REAL — to skip a duplicate add + keep the empty branch honest); candidate is
//               synthetic until the detector engine exists (see @rn-engine above).
// @writes       setSubs (REAL — the confirmed candidate is appended to the subscriptions list before
//               the sheet closes); removeSub is NOT called here. "Not this one" writes nothing.
// @copy         FROZEN — never claims certainty. subs.caught.head / subs.caught.body verbatim from
//               COPY_DECK via '@/folio/copy/copy'; the **name.** accent renders terracotta + upright.
// @tokens       --surface (sheet body) · --inset (candidate card) · --hairline (card border + divider)
//               · --accent (t.calm — accent name, amount, confirm fill) · --ink / --muted (text)
// @motion       sheet-rise + scrim-in (inherited from Sheet) · gentle scale-in on the candidate card
//               (the doc block's @motion) · press 0.97 on both actions · all collapse to final state
//               under reduce-motion (MOTION.md)
//
// STATES (per the spec + STATES.md) — all five branches render:
//   • populated — the happy path: Melo curious + hedged headline + candidate card + two actions.
//   • loading   — confirm in flight: the primary label swaps "Yes, add it" → "Adding…", disabled +
//                 dimmed during the real setSubs write. (NOT a spinner — Melo stays curious.)
//   • empty     — guard: this sheet only opens when a candidate exists. With no candidate it renders
//                 the calm subs.empty doorway (EmptyState) rather than an error.
//   • error     — if the add fails, the honest err.generic line shows and the button re-enables; the
//                 sheet does NOT dismiss on failure (no silent close over a lost write).
//   • offline   — adding a sub is a local write, so offline is identical to populated (no network).
//
// Design-system discipline: every colour / font / spacing / radius / shadow token comes from
// '@/folio/theme' (which re-exports the pressure-map kit). Melo + MeloLine from '@/folio/melo/*',
// strings from '@/folio/copy/copy', the empty doorway from '@/folio/ui/EmptyState'. Nothing new is
// defined — no colour, font, spacing token, or dependency. Tap targets are >=44px; tap-only.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, magnitude, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { copy } from '@/folio/copy/copy';
import { setSubs, useAppStore, type Sub } from '@/folio/store';

// ---------------------------------------------------------------------------
// Candidate — the recurring charge the detector flags.
// ---------------------------------------------------------------------------

// The detector's output. `amount` is whole-or-fractional £ (mirrors the web candidate's `amount`);
// the RN Sub it becomes stores this as `cost`. `seen` = how many cycles it has appeared; `lastDate`
// is the human last-seen label; `category` is carried for the (future) Sub categorisation.
export type SubCandidate = {
  name: string;
  amount: number;
  seen: number; // how many cycles seen
  lastDate: string;
  category: string;
};

// The web prototype's synthetic candidate, verbatim. Replaced by the detector engine's output once
// it exists (@rn-engine sub-detector). Kept here so the populated branch renders honestly today.
const SYNTHETIC_CANDIDATE: SubCandidate = {
  name: 'Sound+ Studio',
  amount: 6.99,
  seen: 3,
  lastDate: '12 Jun',
  category: 'music',
};

// The web `formatGBP` rounds to whole pounds (maximumFractionDigits: 0), so £6.99 shows as "£7".
// The kit's `magnitude` formats MINOR units (pence) and shows pence when non-zero — so to preserve
// the web's whole-pound display the amount is rounded to the nearest pound first, then ×100.
function candidateAmountLabel(amount: number): string {
  return magnitude(Math.round(amount) * 100);
}

// ---------------------------------------------------------------------------
// Public API — self-hosting sheet (mirrors EditItemSheet / LogSpendSheet): owns its own Sheet host
// so it drops straight into the shell as a sibling, `visible` driven by the 'sub-caught' SheetId.
// ---------------------------------------------------------------------------

export type SubCaughtSheetProps = {
  visible: boolean;
  onClose: () => void;
  // The detector-supplied candidate. Optional so the shell can mount the sheet before the engine
  // exists; when omitted, the synthetic candidate stands in (and the empty branch is reachable by
  // passing `null` explicitly once the engine can report "nothing to add").
  candidate?: SubCandidate | null | undefined;
};

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed, mirrors the EditItemSheet/LogSpendSheet hook)
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

export function SubCaughtSheet({ visible, onClose, candidate }: SubCaughtSheetProps) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const reduceMotion = useReduceMotion();

  // `candidate === null` is an explicit "nothing flagged" (empty branch). `undefined` (the default,
  // pre-engine) falls back to the synthetic candidate so the populated branch renders today.
  const resolved: SubCandidate | null =
    candidate === undefined ? SYNTHETIC_CANDIDATE : candidate;

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      {resolved === null ? (
        // ---- empty branch — a calm doorway, never an error (subs.empty.*). ----
        <EmptyState
          mood="calm"
          headline={copy.subs.empty.head}
          body={copy.subs.empty.body}
          cta={{ label: copy.subs.empty.cta, onPress: onClose }}
        />
      ) : (
        <SubCaughtBody
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

function SubCaughtBody({
  styles: s,
  palette: t,
  reduceMotion,
  candidate,
  onClose,
}: {
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
  reduceMotion: boolean;
  candidate: SubCandidate;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<ConfirmStatus>('idle');

  // Real subs — used to skip a duplicate add (the detector can re-surface a name the user already
  // has) and so a confirm appends to the honest list rather than a fabricated one.
  const subs = useAppStore((state) => state.subs);

  const busy = status === 'busy';

  // Gentle scale-in on the candidate card — the doc block's @motion, absent from the web TSX but
  // specified, added here to match intent. Final state (scale 1) immediately under reduce-motion.
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

  // Confirm — perform the REAL write, then close. On the web this was a 320ms setTimeout shim; here
  // it appends the candidate to `subs` via the real `setSubs` mutator BEFORE dismissing. A failure
  // surfaces err.generic and re-enables the button rather than silently closing over a lost write.
  function confirm() {
    setStatus('busy');
    try {
      const already = subs.some(
        (existing) => existing.name.trim().toLowerCase() === candidate.name.trim().toLowerCase(),
      );
      if (!already) {
        const newSub: Sub = {
          name: candidate.name,
          cost: candidate.amount,
          // Sensible first-cycle defaults — the detector flags by recurrence, not by renewal date,
          // so the renewal/usage fields start neutral and the engine refines them later.
          nextRenewalDaysAway: 30,
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

  const headParts = splitHead(copy.subs.caught.head(candidate.name));

  return (
    <View style={s.body}>
      {/* Header row — Melo (curious) + the hedged headline. */}
      <View style={s.headerRow}>
        <Melo size={32} mood="curious" />
        <View style={s.headerText}>
          <Text style={s.eyebrow}>I noticed</Text>
          {/* "Folio spotted <name.>" — the name + period render terracotta, upright (never italic),
              exactly as the web <em className="not-italic text-accent">. The accent run is the
              {name}. portion of subs.caught.head, the lead is everything before it. */}
          <Text accessibilityRole="header" style={s.headline}>
            {headParts.lead}
            <Text style={s.headlineAccent}>{headParts.accent}</Text>
          </Text>
        </View>
      </View>

      {/* Candidate card — inset well, hairline, gentle scale-in. */}
      <Animated.View
        style={[s.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
      >
        <View style={s.cardTopRow}>
          <Text style={s.cardName}>{candidate.name}</Text>
          <Text style={s.cardAmount}>{candidateAmountLabel(candidate.amount)}</Text>
        </View>
        <View style={s.cardMetaRow}>
          <Text style={s.cardMeta}>Seen {candidate.seen} months in a row</Text>
          <View style={s.divider} />
          <Text style={s.cardMeta}>Last: {candidate.lastDate}</Text>
        </View>
      </Animated.View>

      {/* Hedged explanation — never "is", always "Looks like" (subs.caught.body, FROZEN). */}
      <Text style={s.hedge}>{copy.subs.caught.body}</Text>

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
        <Text style={[s.primaryLabel, { color: t.inverse }]}>
          {busy ? 'Adding…' : 'Yes, add it'}
        </Text>
      </Pressable>

      {/* Refusal — always an option, low emphasis (never a second filled button). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Not this one"
        disabled={busy}
        hitSlop={10}
        onPress={onClose}
        style={({ pressed }) => [s.refuse, pressed && !busy ? s.pressed : undefined]}
      >
        <Text style={s.refuseLabel}>Not this one</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Headline accent split — subs.caught.head is "Folio spotted **{name}.**". The deck wraps the accent
// run in ** **; this splits the finished string into the plain lead and the accent run so the render
// layer can colour only the {name}. portion terracotta (matching the web <em>). If for any reason the
// markers are absent, the whole string becomes the accent (never lost), with no lead.
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
// Styles — colour-bearing, resolved against the active palette (makeStyles(t) per the kit pattern).
// Layout metrics ride along here too so each element has a single style source.
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    // Web: px-1 pb-2 inside the sheet body. The Sheet host already pads horizontally, so this only
    // carries the small bottom breathing room.
    body: {
      paddingBottom: gap.sm,
    },

    // Header — Melo + copy, items-start gap-3.
    headerRow: {
      alignItems: 'flex-start',
      columnGap: gap.md,
      flexDirection: 'row',
    },
    headerText: {
      flex: 1,
    },
    // "I noticed" — Fraunces italic, 13px, muted (web font-display italic text-[13px] muted-ink).
    eyebrow: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 13,
      fontStyle: 'italic',
    },
    // "Folio spotted …" — Fraunces 24px, tight leading, mt-0.5 (web font-display text-[24px]).
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 24,
      letterSpacing: -0.3,
      lineHeight: 28,
      marginTop: gap.xxs, // mt-0.5 ≈ 2
    },
    // The accent run — same upright Fraunces face, only recoloured terracotta (web <em not-italic
    // text-accent>). Never italic, never moved off the period.
    headlineAccent: {
      color: t.calm,
    },

    // Candidate card — inset well, hairline, rounded-2xl, px-5 py-4, mt-5. rounded-2xl maps to the
    // kit's radius.lg(18) card corner for system consistency (same call the other ported sheets make).
    card: {
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
      paddingHorizontal: gap.lg + gap.xs, // px-5 ≈ 20
      paddingVertical: gap.lg, // py-4 = 16
    },
    cardTopRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    // 15px ink name.
    cardName: {
      color: t.ink,
      fontSize: 15,
    },
    // 22px Fraunces terracotta amount, tabular figures so money reads as money.
    cardAmount: {
      color: t.calm,
      fontFamily: serif.display,
      fontSize: 22,
      fontVariant: ['tabular-nums'],
    },
    // Meta row — items-center gap-3, mt-2.
    cardMetaRow: {
      alignItems: 'center',
      columnGap: gap.md,
      flexDirection: 'row',
      marginTop: gap.sm,
    },
    // 11.5px muted meta.
    cardMeta: {
      color: t.muted,
      fontSize: 11.5,
    },
    // Vertical divider — w-px h-3 hairline (web <span className="w-px h-3 bg-hairline">).
    divider: {
      backgroundColor: t.hairline,
      height: 12,
      width: StyleSheet.hairlineWidth,
    },

    // Hedged explanation — 13.5px muted, relaxed leading, mt-4 (16).
    hedge: {
      color: t.muted,
      fontSize: 13.5,
      lineHeight: 20,
      marginTop: gap.lg,
    },

    // Error row — the honest err.generic line, spaced above the actions.
    errorRow: {
      marginTop: gap.md,
    },

    // Primary — full width, h-12 (48), rounded-2xl, terracotta, mt-5. White medium label.
    primary: {
      alignItems: 'center',
      borderRadius: radius.lg,
      height: 48,
      justifyContent: 'center',
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
    },
    // disabled:opacity-50 while the add is in flight.
    primaryBusy: {
      opacity: 0.5,
    },
    primaryLabel: {
      fontSize: 14,
      fontWeight: '500',
    },

    // Refusal — ghost, h-10 (40), 12.5px muted centred, mt-2.
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

    // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
    pressed: {
      opacity: 0.6,
      transform: [{ scale: 0.97 }],
    },
  });
}
