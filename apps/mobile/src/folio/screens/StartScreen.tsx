// StartScreen — the faithful 1:1 React Native port of the web first-run doorway
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenStart.tsx).
//
// @rn-screen    StartScreen
// @rn-stack     Onboarding > Start
// @purpose      First-run doorway — frames the one question Folio answers, offers the paths in.
// @reads        — (nav only; no store reads — the web @reads is empty, confirmed in the spec)
// @writes       — (no store actions; the web file's many store imports are DEAD for this screen)
// @opens-sheet  — (navigation is screen-to-screen via nav.go, never a sheet)
// @copy         FROZEN
// @tokens       canvas (paper) · calm (accent) · muted · hairline · serif (Fraunces) — all from the kit
// @motion       slide-in-r (whole screen) · pointer-nudge (kit-owned, on the PrimaryAction arrow)
//               · press 0.97 (kit `pressed`) · Melo breathe + blink (from MeloLine, calm mood)
// @notes        Secondary paths expose real setup and Melo only; production never seeds invented
//               money into the user's Today view.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit source):
//   • The accent word "last" is rendered UPRIGHT (not italic) in terracotta — the web uses
//     <em class="not-italic text-[accent]">. The headline is built as three Text runs so the accent
//     run is a nested, upright, calm-coloured span inside the Fraunces hero line.
//   • The primary CTA is the kit's <PrimaryAction>: it carries the terracotta fill, the `cta`
//     elevation (the warm raised glow), the centred label and the right-pinned arrow glyph — the
//     in-system realisation of the web button (whose literal box-shadow + inset highlight is NOT a
//     token and must not be reintroduced here). "pointer-nudge" is the kit-owned arrow.
//   • The three secondary links are an inline 3-up row separated by two 1px hairline rules, exactly
//     like the web. Each is a Pressable carrying the kit `pressed` feel (scale 0.97 / lowered
//     opacity) — the token equivalent of the web `press` util.
//   • slide-in-r: translateX 28→0 + fade over 360ms, ease-out-expo — gated to FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring Melo's own gating.
//   • STATES: the spec declares Start populated-only (offline ≡ populated; empty/loading/error n/a).
//     All five branches are rendered for completeness: populated/offline = the doorway; loading =
//     Melo curious + a line (never a spinner); empty/error = the calm EmptyState doorway.
//
// Tokens only — no new colour, font, spacing, or radius. Tap targets are >=44px (kit primitives) or
// carry hitSlop. Copy is VERBATIM: the keyed strings come from '@/folio/copy/copy'; the Start
// headline + subhead + CTA + secondary labels are @copy FROZEN inline literals (the web keeps them
// inline; they are not keyed in COPY_DECK — only app.name/app.tag are).

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, PrimaryAction, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { StatePanel } from '@/folio/ui/StatePanel';
import type { Nav } from '@/folio/types';

// The render states this screen can occupy. Per the spec, Start is populated-only and offline is
// identical to populated (local-first, no network dependency); loading/empty/error are n/a for a
// pure doorway but are rendered for completeness so every branch is exercised.
export type StartState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type StartScreenProps = {
  nav: Nav;
  state?: StartState;
};

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (from the spec @motion): the whole screen enters from +28px on X with a fade.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// Local reduce-motion read, mirroring Melo.tsx exactly: read once, then subscribe to changes. Kept
// self-contained so this screen pulls no heavy module graph.
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

export function StartScreen({ nav, state = 'populated' }: StartScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // slide-in-r — drives the whole screen. 0 = resting (translateX 0, opacity 1); under reduce-motion
  // we resolve straight to the final state instead of animating.
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

  // empty / error — the calm EmptyState doorway (n/a in practice, rendered for completeness). The
  // single CTA still routes to the guided check-in so the doorway never dead-ends.
  if (state === 'empty' || state === 'error') {
    return (
      <StatePanel
        body={
          state === 'error'
            ? 'The first step could not be shown.'
            : 'Start with a rough number. Nothing counts until you choose.'
        }
        fullScreen
        kind={state === 'error' ? 'error' : 'first-time-empty'}
        primaryAction={{ label: 'See where you stand', onPress: () => nav.go('first-answer') }}
        title={state === 'error' ? copy.err.generic : 'Will your money last to payday?'}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (per the hard rule + STATES.md). A calm,
  // centred holding moment while the doorway settles.
  if (state === 'loading') {
    return (
      <StatePanel
        body="Preparing the first step."
        fullScreen
        kind="loading"
        title="Getting Melo ready"
      />
    );
  }

  // populated / offline — the real doorway. offline ≡ populated (local-first; nothing on this screen
  // needs the network).
  return (
    <Animated.View
      style={[
        styles.screen,
        enterStyle,
        {
          backgroundColor: t.canvas,
          paddingTop: insets.top + gap.xxl,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* The doorway scrolls — on a short viewport or with large OS text the CTA + secondary links
          sit below the fold. flexGrow:1 keeps the spacer pinning them to the bottom when there's room
          and lets the column scroll when there isn't. */}
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — wordmark + Privacy link. */}
        <View style={styles.header}>
          <Text style={[styles.wordmark, { color: t.ink }]}>{copy.global.app.name}</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={16}
            onPress={() => nav.go('privacy')}
            style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.privacy, { color: t.muted }]}>Privacy</Text>
          </Pressable>
        </View>

        {/* Hero — the one question. "last" is the single accent word: upright, terracotta. */}
        <View style={styles.hero}>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'Will your money '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>last</Text>
            {' to payday?'}
          </Text>
          <Text style={[styles.subhead, { color: t.muted }]}>
            Start with a rough number. Nothing counts until you choose.
          </Text>
        </View>

        {/* Melo line — the quiet companion, calm mood (its breathe + blink are the only continuous
          motion on the resting screen). MeloLine adds the straight quotes; we pass the raw text. */}
        <View style={styles.meloLine}>
          <MeloLine text="Melo, here. I only speak when something shifts." />
          <Text style={[styles.meloSubline, { color: t.muted }]}>
            A small companion. Not a bank, not a coach.
          </Text>
        </View>

        <View style={[styles.watchCard, { backgroundColor: t.inset, borderColor: t.hairline }]}>
          <Text style={[styles.watchEyebrow, { color: t.muted }]}>Here's what I'm watching</Text>
          <View style={styles.watchList}>
            <Text style={[styles.watchItem, { color: t.ink }]}>
              {'· Your '}
              <Text style={{ color: t.calmStrong }}>path</Text>
              {' to payday'}
            </Text>
            <Text style={[styles.watchItem, { color: t.ink }]}>
              {'· Subs that '}
              <Text style={{ color: t.calmStrong }}>quietly</Text>
              {' renew'}
            </Text>
            <Text style={[styles.watchItem, { color: t.ink }]}>
              {'· The '}
              <Text style={{ color: t.calmStrong }}>tight point</Text>
              {' ahead'}
            </Text>
          </View>
        </View>

        {/* Spacer pins the CTA + secondary links to the bottom, mirroring the web flex-1 spacer. */}
        <View style={styles.spacer} />

        {/* Primary CTA — the kit's PrimaryAction carries the terracotta fill, the warm raised glow,
          the centred label and the right-pinned arrow (the in-system "→" + pointer-nudge owner). */}
        <PrimaryAction
          label="See where you stand"
          onPress={() => nav.go('first-answer')}
          accessibilityHint="Opens the first answer flow"
        />

        {/* Secondary paths — both lead to a real workflow; there is no customer-facing sample mode. */}
        <View style={styles.secondaryRow}>
          <SecondaryLink label="Add a statement" onPress={() => nav.go('intake')} />
          <View style={[styles.divider, { backgroundColor: t.hairline }]} />
          <SecondaryLink label="Meet Melo" onPress={() => nav.go('melo')} />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// A quiet inline secondary path. Inline text (not the kit's full-width QuietLink, which pins a
// chevron and spans the row) so the three sit side by side with hairline dividers, faithful to the
// web. Carries the kit `pressed` feel and a hitSlop so the tap target clears 44px despite the small
// 12.5px label.
function SecondaryLink({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={16}
      onPress={onPress}
      style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
    >
      <Text style={[styles.secondaryLabel, { color: t.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // px-7 ≈ screen inset (gap.xl = 24); pt is the safe-area top + gap.xxl (32) header offset.
  screen: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // Scroll container fills the screen; content grows to a full viewport so the flex:1 spacer keeps
  // pinning the CTA when there's room, then scrolls when there isn't.
  scrollFlex: {
    flex: 1,
  },
  scrollBody: {
    flexGrow: 1,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Fraunces italic wordmark, 15px (web font-display italic text-[15px]).
  wordmark: {
    fontFamily: serif.displayItalic,
    fontSize: 15,
  },
  // Privacy — uppercase, tracked, 12px, muted (web tracking-wide uppercase).
  privacy: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // mt-14 (56px) = gap.xxl (32) + gap.xl (24).
  hero: {
    marginTop: gap.xxl + gap.xl,
  },
  // Fraunces hero, 42px, tight line-height (web text-[42px] leading-[1.05] tracking-tight).
  headline: {
    fontFamily: serif.display,
    fontSize: 42,
    letterSpacing: -0.5,
    lineHeight: 44,
  },
  // The accent word stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // mt-5 (20px) = gap.lg (16) + gap.xs (4); 15px relaxed, muted, max-width ~300.
  subhead: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: gap.lg + gap.xs,
    maxWidth: 300,
  },
  // mt-10 (40px) = gap.xl (24) + gap.lg (16).
  meloLine: {
    marginTop: gap.xl + gap.lg,
  },
  meloSubline: {
    fontSize: 12.5,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: gap.sm,
    maxWidth: 300,
  },
  watchCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  watchEyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  watchList: {
    gap: gap.xs,
    marginTop: gap.sm,
  },
  watchItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  spacer: {
    flex: 1,
  },
  // mt-5 (20px) = gap.lg + gap.xs; gap-3 (12px) = gap.md between items.
  secondaryRow: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: gap.lg + gap.xs,
  },
  secondaryLabel: {
    fontSize: 12.5,
  },
  // The 1px vertical hairline rule between secondary links (web w-px h-3).
  divider: {
    height: 12,
    width: 1,
  },
  // The kit press feel applied to inline tappables (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
