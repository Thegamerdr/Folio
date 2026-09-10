// Share a recorded forecast review through the native share sheet or explicit Copy.
// Current forecast pauses are labelled separately; neither action changes financial records.
// Native share dismissal remains a no-op, and the postcard award follows a completed share only.

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
import { MeloLine } from '@/folio/melo/MeloLine';
import { EmptyState } from '@/folio/ui/EmptyState';
import { copy } from '@/folio/copy/copy';
import { triggerFeedback } from '@/folio/lib/feedback';
import { awardTinyWin, useAppStore } from '@/folio/store';
import {
  buildShareReviewPresentation,
  type ShareReviewPresentation,
} from '@/folio/lib/shareReviewPresentation';

const SHARE_COPY = {
  eyebrow: 'A recorded review',
  headlineLead: 'Recorded ',
  footer: '— quiet money, no spreadsheet',
  shareLabel: 'Share',
  copiedLabel: 'Copied ✓',
  sharingLabel: 'Sharing…',
  copyLabel: 'Copy',
  dismiss: 'Not now',
  shareTitle: 'Melo · recorded forecast review',
  sharingLine: 'Opening your forecast review…',
} as const;

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

  const cycles = useAppStore((state) => state.cycles);
  const subPaused = useAppStore((state) => state.subPaused);
  const pausedCount = Object.values(subPaused).filter(Boolean).length;
  const presentation = buildShareReviewPresentation(cycles, pausedCount, copy.global.app.name);

  return (
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      {presentation ? (
        <ShareBody presentation={presentation} reduceMotion={reduceMotion} onClose={onClose} />
      ) : (
        <EmptyState
          mood="curious"
          headline="No recorded review yet"
          body="Complete a payday review to create a forecast card."
          cta={{ label: SHARE_COPY.dismiss, onPress: onClose }}
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

function ShareBody({
  presentation,
  reduceMotion,
  onClose,
}: {
  presentation: ShareReviewPresentation;
  reduceMotion: boolean;
  onClose: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const quietMode = useAppStore((state) => state.melo?.quietMode === true);
  const soundEnabled = useAppStore((state) => state.melo?.soundEnabled === true);

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

  const text = presentation.shareText;

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
      const result = await Share.share({ title: SHARE_COPY.shareTitle, message: text });
      if (result.action === Share.sharedAction) {
        awardTinyWin('first-postcard-shared');
        void triggerFeedback('postcard-shared', { quietMode, soundEnabled });
      }
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

  return (
    <View style={s.body}>
      {/* Eyebrow — 11px, uppercase, tracked, muted. */}
      <Text style={s.eyebrow}>{SHARE_COPY.eyebrow}</Text>

      {/* The full recorded date identifies the snapshot being shared. */}
      <Text accessibilityRole="header" style={s.headline}>
        {SHARE_COPY.headlineLead}
        <Text style={s.headlineAccent}>{presentation.recordedDate}</Text>
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

        {/* Display and share payload use the same signed, precisely formatted forecast. */}
        <Text style={s.cardAmount}>{presentation.amount}</Text>
        <Text style={s.cardAmountSub}>{presentation.amountLabel}</Text>

        <Text style={s.cardBody}>{presentation.forecastScope}</Text>
        <Text style={s.cardBody}>{presentation.currentPauses}</Text>

        {/* Italic Fraunces footer — the tagline tone. */}
        <Text style={s.cardFooter}>{SHARE_COPY.footer}</Text>
      </Animated.View>

      {/* Share-in-flight — Melo (curious) + a quiet line. Loading is NEVER a spinner. */}
      {sharing ? (
        <View style={s.sharingRow}>
          <MeloLine text={SHARE_COPY.sharingLine} mood="curious" size={28} />
        </View>
      ) : null}

      {/* Primary — native Share. Disabled + dimmed while the dialog is opening. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sharing ? 'Sharing' : SHARE_COPY.shareLabel}
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
          {sharing ? SHARE_COPY.sharingLabel : SHARE_COPY.shareLabel}
        </Text>
      </Pressable>

      {/* Copy — the explicit clipboard path, the only place "Copied ✓" appears. Low emphasis. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Copied' : SHARE_COPY.copyLabel}
        disabled={sharing}
        hitSlop={10}
        onPress={onCopy}
        style={({ pressed }) => [s.secondary, pressed && !sharing ? s.pressed : undefined]}
      >
        <Text style={s.secondaryLabel}>
          {copied ? SHARE_COPY.copiedLabel : SHARE_COPY.copyLabel}
        </Text>
      </Pressable>

      {/* Dismiss — always an option, lowest emphasis. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={SHARE_COPY.dismiss}
        disabled={sharing}
        hitSlop={10}
        onPress={onClose}
        style={({ pressed }) => [s.dismiss, pressed && !sharing ? s.pressed : undefined]}
      >
        <Text style={s.dismissLabel}>{SHARE_COPY.dismiss}</Text>
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
