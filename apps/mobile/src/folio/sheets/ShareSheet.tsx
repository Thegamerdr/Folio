// ShareSheet — the faithful 1:1 React Native port of the web "share your cycle" sheet
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetShare.tsx).
//
// @rn-sheet     ShareSheet
// @purpose      Quiet win card for sharing a closed cycle. A bottom sheet showing a single share
//               card (month label, spare left over, count of paused subscriptions) that the user
//               can share via the native share sheet, copy, or dismiss.
// @reads        cycles (most recent → cycles[0]) · subPaused (paused count). REAL store reads.
// @writes       —  (no store writes; native Share / Clipboard side-effect only)
// @copy         FROZEN — the visible strings are reproduced VERBATIM from the web original below.
//               Several of them are NOT yet in COPY_DECK.md ('A quiet win', 'left over this month',
//               the card sentences, '— quiet money, no spreadsheet', 'Share', 'Copied ✓',
//               'Not now', the share text + title). They must be ADDED to COPY_DECK before ship and
//               swapped for keyed entries; until then the keyed strings that DO exist read through
//               '@/folio/copy/copy' (app.name 'Folio', currency.symbol '£'). The accent word renders
//               terracotta + UPRIGHT (never italic), matching the web <em className="not-italic">.
// @tokens       --paper (sheet body, via Sheet → t.surface) · --accent (t.calm — headline accent,
//               brand dot, primary fill) · --accent-soft (t.calmSoft — card gradient start) ·
//               --surface (t.surface — card gradient end) · --positive (t.positive — DECLARED, not
//               visibly applied, per the web doc block; not invented here) · --hairline (t.hairline —
//               card border) · --muted-ink (t.muted) · --ink (t.ink) · white (t.inverse — primary label).
// @motion       sheet-rise + scrim-in (inherited from Sheet) · stamp / verdict-stamp on the win card
//               (600ms back-out cubic-bezier(.34,1.56,.64,1) — the doc block's "stamp on render";
//               the card stamping in IS the moment) · press 0.97 on both actions · all collapse to
//               final state under reduce-motion (MOTION.md — reduced motion is the resolved layout).
//
// STATES (per ShareSheet.spec.md "stateBranches" — all five render):
//   • populated, pausedCount > 1  — card body says "N quiet subscriptions paused. You made it…".
//   • populated, pausedCount === 1 — card body says "1 quiet subscription paused. You made it…"
//                                    (singular). The SHARE TEXT carries its OWN singular/plural
//                                    decision ('sub'/'subs') — both are ported, never unified.
//   • populated, pausedCount === 0 — card body collapses to just "You made it to the end of the month."
//   • empty (no closed cycle)      — this sheet is the close-payoff, so showing a £0 card is off-tone.
//                                    With cycles[] empty it renders the calm insights.empty doorway
//                                    (EmptyState, Melo calm) rather than a fabricated £0 win
//                                    (spec fidelityRisks — "only present this sheet when a cycle is
//                                    closed"). 'Open the ritual' just dismisses here.
//   • copied (button sub-state)    — the primary label flips "Share" → "Copied ✓" for 1600ms after a
//                                    real Clipboard write (the explicit Copy fallback path only —
//                                    NOT when the native share dialog is shown/dismissed).
//
//   loading / share-in-flight — while the native share dialog is opening the primary label swaps to
//                "Sharing…" and disables; per the task's hard rule loading is Melo (curious) + a
//                MeloLine, NEVER a spinner. error — a failed copy is swallowed honestly (no fake
//                "Copied ✓"); the label simply stays "Share". offline — share/copy are local, so
//                offline is identical to populated.
//
// Web Share fallback re-modelled for RN (spec fidelityRisks): on the web, share() tried
// navigator.share then fell through to clipboard. On RN the native Share is primary; a user
// dismiss (dismissedAction) is a silent no-op and does NOT copy. The "Copied ✓" affordance only
// ever follows an actual Clipboard write via the explicit secondary Copy action.
//
// Design-system discipline: every colour / font / spacing / radius / shadow token comes from
// '@/folio/theme' (which re-exports the pressure-map kit). Melo + MeloLine from '@/folio/melo/*',
// strings from '@/folio/copy/copy', the empty doorway from '@/folio/ui/EmptyState'. Nothing new is
// defined — no colour, font, spacing token, or dependency. Tap targets are >=44px; tap-only.
//
// @deps  react-native Share + Clipboard (core, dependency-free — same pattern as CalendarExportSheet)
//        · react-native-svg LinearGradient (installed; the card's accent-soft→surface wash is drawn
//          as an SVG background rect, the established in-repo gradient pattern — there is no
//          expo-linear-gradient dependency).

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Clipboard,
  Easing,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { elevation, gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { copy } from '@/folio/copy/copy';
import { awardTinyWin, useAppStore } from '@/folio/store';

// ---------------------------------------------------------------------------
// Frozen copy — VERBATIM from the web original. These are NOT yet in COPY_DECK.md (see @copy); they
// are reproduced here so the port renders today and must be added to the deck + keyed before ship.
// app.name and currency.symbol DO exist in the deck and are read through it.
// ---------------------------------------------------------------------------

const FROZEN = {
  eyebrow: 'A quiet win',
  // "Cycle closed, <monthLabel>." — monthLabel is the terracotta accent run (upright).
  headlineLead: 'Cycle closed, ',
  headlineTail: '.',
  monthFallback: 'this month',
  amountSub: 'left over this month',
  footer: '— quiet money, no spreadsheet',
  shareLabel: 'Share',
  copiedLabel: 'Copied ✓',
  sharingLabel: 'Sharing…',
  copyLabel: 'Copy',
  dismiss: 'Not now',
  shareTitle: 'Melo · cycle closed',
  // Melo's quiet line while the native dialog is opening (loading is Melo + line, never a spinner).
  sharingLine: 'Sending your quiet win…',
} as const;

// Card body — singular/plural on pausedCount, mirroring the web ternary exactly. pausedCount === 0
// collapses to the bare "You made it…" line.
function cardBodyText(pausedCount: number): string {
  if (pausedCount > 0) {
    const noun = pausedCount === 1 ? 'subscription' : 'subscriptions';
    return `${pausedCount} quiet ${noun} paused. You made it to the end of the month.`;
  }
  return 'You made it to the end of the month.';
}

// Share-intent payload — a SEPARATE singular/plural decision ('sub'/'subs'), ported as-is and never
// unified with the card body's 'subscription'/'subscriptions'. The £ comes from the deck symbol.
function shareText(monthLabel: string, saved: number, pausedCount: number): string {
  const noun = pausedCount === 1 ? 'sub' : 'subs';
  const symbol = copy.global.currency.symbol;
  const brand = copy.global.app.name;
  return `Closed ${monthLabel} with ${brand} · ${symbol}${saved} spare, ${pausedCount} quiet ${noun} paused. Quiet money, no spreadsheet.`;
}

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed — mirrors the sibling sheets' hook).
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

// ---------------------------------------------------------------------------
// Public API — self-hosting sheet (mirrors SubCaughtSheet / EditItemSheet): owns its own Sheet host
// so it drops straight into the shell as a sibling, `visible` driven by the 'share' SheetId. The
// route file that mounts it is separate and is NOT created here.
// ---------------------------------------------------------------------------

export type ShareSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function ShareSheet({ visible, onClose }: ShareSheetProps) {
  const reduceMotion = useReduceMotion();

  // REAL store reads. cycles[0] is the most recent closed cycle; an empty list means no cycle has
  // been closed yet (the empty branch — this sheet is the payoff for closing one).
  const cycles = useAppStore((s) => s.cycles);
  const hasCycle = cycles.length > 0;

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      {hasCycle ? (
        <ShareBody reduceMotion={reduceMotion} onClose={onClose} />
      ) : (
        // ---- empty branch — a calm doorway, never a fabricated £0 win (insights.empty.*). ----
        // 'Open the ritual' would route to the close ritual; from the share sheet with no cycle the
        // honest action is simply to dismiss back to where the ritual can be started.
        <EmptyState
          mood="calm"
          headline={copy.insights.empty.head}
          body={copy.insights.empty.body}
          cta={{ label: copy.insights.empty.cta, onPress: onClose }}
        />
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The win-card body — eyebrow + headline + the share card + Share / Copy / Not now.
//   Hosts the copied + share-in-flight sub-states as local state.
// ---------------------------------------------------------------------------

type ShareStatus = 'idle' | 'sharing';

function ShareBody({ reduceMotion, onClose }: { reduceMotion: boolean; onClose: () => void }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  // Most-recent closed cycle + paused count (both REAL reads — subPaused counted live).
  const latest = useAppStore((state) => state.cycles[0]);
  const subPaused = useAppStore((state) => state.subPaused);

  const monthLabel = latest?.label ?? FROZEN.monthFallback;
  const saved = latest?.spare ?? 0;
  const pausedCount = Object.values(subPaused).filter(Boolean).length;

  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<ShareStatus>('idle');
  const sharing = status === 'sharing';

  // The 1600ms "Copied ✓" revert — id held in a ref and cleared on unmount so the timer never
  // fires setState after the sheet is dismissed quickly (spec fidelityRisks).
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) {
        clearTimeout(copiedTimer.current);
        copiedTimer.current = null;
      }
    };
  }, []);

  const text = shareText(monthLabel, saved, pausedCount);

  // stamp / verdict-stamp — the win card stamps in on render (600ms back-out). Final state (scale 1,
  // opacity 1) immediately under reduce-motion (MOTION.md: reduced motion is the resolved layout).
  const cardScale = useMemo(() => new Animated.Value(reduceMotion ? 1 : 0.9), [reduceMotion]);
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
        duration: 600,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1), // back-out — the stamp overshoot
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, cardScale, cardOpacity]);

  // Native share is PRIMARY. A user dismiss is a silent no-op (NOT a fallback copy). Failures are
  // swallowed honestly — no fabricated success, the label just returns to "Share".
  async function onShare() {
    if (sharing) return;
    setStatus('sharing');
    try {
      const result = await Share.share({ title: FROZEN.shareTitle, message: text });
      if (result.action === Share.sharedAction) awardTinyWin('first-postcard-shared');
    } catch {
      /* user-cancelled or share failed — silent, honest no-op (no fake "Copied ✓"). */
    } finally {
      setStatus('idle');
    }
  }

  // Explicit Copy — the only path that shows "Copied ✓", and only after a real Clipboard write.
  function onCopy() {
    try {
      Clipboard.setString(text);
      setCopied(true);
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => {
        setCopied(false);
        copiedTimer.current = null;
      }, 1600);
    } catch {
      /* clipboard failure — swallowed, no error UI, no fake success (honest-copy rule). */
    }
  }

  const amountLabel = `${copy.global.currency.symbol}${saved}`;

  return (
    <View style={s.body}>
      {/* Eyebrow — 11px, uppercase, tracked, muted. */}
      <Text style={s.eyebrow}>{FROZEN.eyebrow}</Text>

      {/* "Cycle closed, <monthLabel>." — monthLabel renders terracotta + UPRIGHT (web <em not-italic
          text-accent>); never italicised, never moved off the trailing period. */}
      <Text accessibilityRole="header" style={s.headline}>
        {FROZEN.headlineLead}
        <Text style={s.headlineAccent}>{monthLabel}</Text>
        {FROZEN.headlineTail}
      </Text>

      {/* The share / win card — accent-soft→surface wash (drawn as an SVG background), hairline
          border, soft card lift, stamping in on render. */}
      <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
        {/* Gradient ground — to-br (top-left → bottom-right): accent-soft start → surface end. */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="shareCardFill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={t.calmSoft} />
              <Stop offset="1" stopColor={t.surface} />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx={radius.xl}
            ry={radius.xl}
            fill="url(#shareCardFill)"
          />
        </Svg>

        {/* Brand chip row — accent dot + the app name from the deck ('Melo'). */}
        <View style={s.brandRow}>
          <View style={s.brandDot} />
          <Text style={s.brandLabel}>{copy.global.app.name}</Text>
        </View>

        {/* Hero amount — £{saved}, Fraunces 40px, tabular figures so money reads as money. */}
        <Text style={s.cardAmount}>{amountLabel}</Text>
        <Text style={s.cardAmountSub}>{FROZEN.amountSub}</Text>

        {/* Body — singular/plural on pausedCount, or the bare "You made it…" at 0. */}
        <Text style={s.cardBody}>{cardBodyText(pausedCount)}</Text>

        {/* Italic Fraunces footer — the tagline tone. */}
        <Text style={s.cardFooter}>{FROZEN.footer}</Text>
      </Animated.View>

      {/* Share-in-flight — Melo (curious) + a quiet line. Loading is NEVER a spinner. */}
      {sharing ? (
        <View style={s.sharingRow}>
          <MeloLine text={FROZEN.sharingLine} mood="curious" size={28} />
        </View>
      ) : null}

      {/* Primary — native Share. Disabled + dimmed while the dialog is opening. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sharing ? 'Sharing' : FROZEN.shareLabel}
        accessibilityState={{ disabled: sharing }}
        disabled={sharing}
        onPress={onShare}
        style={({ pressed }) => [
          s.primary,
          { backgroundColor: t.calm },
          sharing ? s.primaryBusy : undefined,
          pressed && !sharing ? s.pressed : undefined,
        ]}
      >
        <Text style={[s.primaryLabel, { color: t.inverse }]}>
          {sharing ? FROZEN.sharingLabel : FROZEN.shareLabel}
        </Text>
      </Pressable>

      {/* Copy — the explicit clipboard path, the only place "Copied ✓" appears. Low emphasis. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Copied' : FROZEN.copyLabel}
        disabled={sharing}
        hitSlop={10}
        onPress={onCopy}
        style={({ pressed }) => [s.secondary, pressed && !sharing ? s.pressed : undefined]}
      >
        <Text style={s.secondaryLabel}>{copied ? FROZEN.copiedLabel : FROZEN.copyLabel}</Text>
      </Pressable>

      {/* Dismiss — always an option, lowest emphasis. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={FROZEN.dismiss}
        disabled={sharing}
        hitSlop={10}
        onPress={onClose}
        style={({ pressed }) => [s.dismiss, pressed && !sharing ? s.pressed : undefined]}
      >
        <Text style={s.dismissLabel}>{FROZEN.dismiss}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette (makeStyles(t) per the kit pattern).
// Layout metrics ride along so each element has a single style source. Web → token mapping noted
// inline; every value comes from the kit (gap / radius / serif / elevation), nothing hard-coded that
// the kit already owns.
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    // Web: px-2 pb-2 inside the sheet body. The Sheet host already pads horizontally, so only the
    // small bottom breathing room remains here.
    body: {
      paddingBottom: gap.sm,
    },

    // Eyebrow — 11px, uppercase, tracking-[0.14em] (~1.54 at 11px), muted-ink.
    eyebrow: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.54,
      textTransform: 'uppercase',
    },
    // Headline — Fraunces 24px, tight leading, mt-1.
    headline: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 24,
      letterSpacing: -0.3,
      lineHeight: 28,
      marginTop: gap.xs, // mt-1 ≈ 4
    },
    // The accent run — same upright Fraunces face, recoloured terracotta. NEVER italic.
    headlineAccent: {
      color: t.calm,
    },

    // Share card — rounded-[24px] (radius.xl), p-6, hairline border, soft card lift, mt-5. The
    // accent-soft→surface wash is the SVG background rect; overflow hidden so it clips to the radius.
    card: {
      borderColor: t.hairline,
      borderRadius: radius.xl, // 24
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
      overflow: 'hidden',
      padding: gap.xl, // p-6 ≈ 24
      ...elevation.card,
    },

    // Brand chip row — items-center gap-2, 11px uppercase tracked muted.
    brandRow: {
      alignItems: 'center',
      columnGap: gap.sm,
      flexDirection: 'row',
    },
    // 6x6 accent dot (web w-1.5 h-1.5).
    brandDot: {
      backgroundColor: t.calm,
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    brandLabel: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.54,
      textTransform: 'uppercase',
    },

    // Hero amount — Fraunces 40px, leading-none, tabular figures. mt-3.
    cardAmount: {
      color: t.ink,
      fontFamily: serif.display,
      fontSize: 40,
      fontVariant: ['tabular-nums'],
      lineHeight: 40,
      marginTop: gap.md, // mt-3 ≈ 12
    },
    // Sub — 12px muted, mt-1.
    cardAmountSub: {
      color: t.muted,
      fontSize: 12,
      marginTop: gap.xs, // mt-1 ≈ 4
    },
    // Body — 13.5px, relaxed leading, ink, mt-5.
    cardBody: {
      color: t.ink,
      fontSize: 13.5,
      lineHeight: 20,
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
    },
    // Footer — Fraunces italic, 12px muted, mt-4.
    cardFooter: {
      color: t.muted,
      fontFamily: serif.displayItalic,
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: gap.lg, // mt-4 ≈ 16
    },

    // Share-in-flight Melo line — spaced above the actions.
    sharingRow: {
      marginTop: gap.lg,
    },

    // Primary — full width, h-12 (48), rounded-2xl (radius.lg per the sibling sheets' 2xl mapping),
    // terracotta, mt-5. White medium label.
    primary: {
      alignItems: 'center',
      borderRadius: radius.lg,
      height: 48,
      justifyContent: 'center',
      marginTop: gap.lg + gap.xs, // mt-5 ≈ 20
    },
    primaryBusy: {
      opacity: 0.5,
    },
    primaryLabel: {
      fontSize: 14,
      fontWeight: '500',
    },

    // Copy — ghost, h-10 (40), 12.5px muted centred, mt-2.
    secondary: {
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      marginTop: gap.sm, // mt-2 ≈ 8
    },
    secondaryLabel: {
      color: t.muted,
      fontSize: 12.5,
      textAlign: 'center',
    },

    // Dismiss — same low-emphasis ghost as Copy. (Web had only 'Not now'; Copy is the re-modelled
    // explicit fallback, so both sit here at equal, quiet weight beneath the filled Share.)
    dismiss: {
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      marginTop: gap.xs, // small step under Copy
    },
    dismissLabel: {
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
