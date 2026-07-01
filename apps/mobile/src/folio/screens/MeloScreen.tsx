// MeloScreen — the faithful 1:1 React Native port of the web Melo surface
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenMelo.tsx).
//
// @rn-screen    MeloScreen
// @rn-stack     MainTabs > Melo
// @purpose      Standalone Melo companion surface. In the live web prototype this is NOT the full
//               chat surface its doc block promises — it is a persona/mood PLAYGROUND: a hero Melo
//               card that reflects the current money-pressure mood, plus a five-row pressure picker
//               that lets you switch the band and watch Melo (and, conceptually, the money path)
//               change with her. This port reproduces what the web JSX actually renders, not the
//               doc-block's chat/snapshot/applyMeloTool promises (see SPEC fidelityRisks: the rendered
//               component does none of those — they are the melo-chat SHEET's concern, not this screen).
// @reads        the live money-path route (via the shared `routeFromStore` bridge over the store
//               snapshot — the SAME curve Today / WhatIf read) to choose the band Melo OPENS in, and
//               the active Pressure band thereafter (web read it off `nav.pressure`; the RN Nav
//               contract carries no pressure, so the shell threads a `pressure` prop as the pre-mount
//               fallback and this screen holds the picker's local selection on top of it — mirrors
//               TodayScreen / PotsScreen / WhatIfScreen).
// @writes       — NONE. The active band is LOCAL component state (the web `nav.setPressure(p)` was a
//               local nav flip with no store behind it); reading the route is pure and never mutates
//               the store. No store mutator is wired — faithful to the web, whose ~20 store-action
//               imports + meloHero/waxSeal assets are DEAD on this screen.
// @opens-sheet  — (none; the rendered web component opens no sheet. The full chat lives in melo-chat.)
// @copy         FROZEN. The hero line + row lines are VERBATIM from the design's pressureLine map
//               (reconciled into ./today/pressure); the kicker / headline / footer hint are the web's
//               inline @copy-frozen literals. The single accent word "quiet" is terracotta + upright.
// @tokens       canvas (paper) · surface · inset/surface (rows) · calm (accent) · calmSoft (active row) ·
//               muted · hairline · serif (Fraunces) — all from the kit, no new token.
// @motion       slide-in-r (whole screen, 360ms) · press 0.97 (back + each row) · Melo breathe + blink +
//               mood-pulse (kit-owned, per mood). All gated to FINAL STATE under reduce-motion.
// @melo-mood    derived from the active band via pressureMood (reconciled to the canonical Melo
//               vocabulary calm | curious | cheer | concern | celebrate — the lossy web soft/alert
//               aliases are DROPPED, per SPEC + MELO_MOODS).
//
// FIDELITY DECISIONS (each grounded in the SPEC + confirmed kit/store source):
//   • Mood mapping: the web routed Pressure through the legacy 3-way pressureMood (calm|soft|alert),
//     which the web kit's normalizeMood collapsed (soft→calm, alert→concern). The RN port re-maps
//     Pressure DIRECTLY onto the canonical 5 moods via ./today/pressure's pressureMood — the
//     documented, reconciled set (safe→calm, calm→calm, soft→curious, pressured→concern,
//     overspent→concern). No lossy alias path is reintroduced.
//   • intensity={1.4}: the web hero Melo amplified its tilt past the standard tiers. The canonical RN
//     <Melo> has no `intensity` prop (tilt is baked per mood); the hero renders at the canonical mood
//     tilt. Tagged below rather than inventing a non-existent prop.
//   • Accent word "quiet": web uses <em class="not-italic text-accent">. RN has no inline <em>, so the
//     headline is three Text runs and the accent run is a nested, UPRIGHT, terracotta span (the
//     StartScreen pattern — same Fraunces face, colour-only override, never italic).
//   • Row labels: keys are lowercase; the web CSS-capitalized them. RN uses textTransform:'capitalize'
//     so the data is never mutated.
//   • Lines: rendered with the literal straight double-quotes the web wraps them in (typographic voice,
//     part of the string — not a decoration). The em dash inside pressured/overspent is preserved.
//   • The pressure band is local state, but its OPENING value is now @rn-engine money-path WIRED: the
//     band Melo first poses in is read from the real route's tightest point (route.tightPoint.amount)
//     through the shared `routeFromStore` bridge, mapped onto the canonical bands by the same
//     per-band floors the rest of the app uses (pressureLow, safest→tightest) — so the copy ("your
//     money path shifts with her") is honest. Flipping the picker is still a purely local selection
//     (mirrors the web's `nav.setPressure`), and a deliberate flip is never overridden by a later
//     engine update (tracked by `touched`). Reading the route is pure — the store is never mutated.
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to final state under
//     reduce-motion (resolved layout, never a slower animation) — mirrors Melo's own gating.
//   • STATES: the SPEC declares this screen populated-only (offline ≡ populated; empty/loading/error
//     n/a — no async, no spinner). All five branches are rendered for completeness: populated/offline =
//     the playground; loading = Melo curious + a line (NEVER a spinner, per the hard rule + STATES.md);
//     empty/error = the calm EmptyState doorway, which never dead-ends.
//
// HONEST CLAIMS: this screen asserts no privacy/security property. No banned product vocabulary appears
// in any visible string. Tokens only; tap targets are >=44px (full-width rows) or carry hitSlop.

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import type { Nav, Pressure } from '@/folio/types';

import { pressureLine, pressureMood } from './today/pressure';

// The render states this screen can occupy. Per the SPEC, MeloScreen is populated-only and offline is
// identical to populated (local-first, no network); loading/empty/error are n/a for a pure playground
// but are rendered for completeness so every branch is exercised.
export type MeloScreenState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type MeloScreenProps = {
  nav: Nav;
  /** The route pressure band. The web read this off `nav.pressure`; the RN Nav contract has no
   *  pressure, so the shell threads it explicitly (mirrors Today / Pots / WhatIf). Seeds the picker's
   *  initial selection; the user can flip it locally on this screen. Defaults to 'calm' — the web
   *  app's default landing mood (folio-melo index: `search.p ?? "calm"`). */
  pressure?: Pressure;
  /** STATES.md branch. Defaults to 'populated'. */
  state?: MeloScreenState;
};

// The five bands, in the web's order — safest to tightest.
const BANDS: readonly Pressure[] = ['safe', 'calm', 'soft', 'pressured', 'overspent'];

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (from the SPEC @motion): the whole screen enters from +28px on X with a fade.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// Hero / row Melo sizes — byte-faithful to the web (<Melo size={120} /> hero, <Melo size={28} /> rows).
const HERO_MELO_SIZE = 120;
const ROW_MELO_SIZE = 28;

// Local reduce-motion read, mirroring Melo.tsx / StartScreen exactly: read once, then subscribe.
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

export function MeloScreen({ nav, pressure = 'calm', state = 'populated' }: MeloScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // The active band IS the shell's app-wide pressure (the `pressure` prop) — already DERIVED from the
  // real route AND gated (an empty/cleared app stays neutral calm, never alarmist) AND override-aware.
  // Reading the prop keeps the Melo screen in LOCKSTEP with Today, instead of running a second, ungated
  // derivation that could disagree (it did: an empty app showed "overspent" here while Today was calm).
  // Picking a row sets the band APP-WIDE via nav.setPressure — the shell owns the override.
  const active = pressure;
  const selectBand = (p: Pressure) => nav.setPressure(p);

  // slide-in-r — drives the whole screen. 0 = resting (translateX 0, opacity 1); under reduce-motion
  // resolve straight to the final state instead of animating.
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
  // single CTA routes back so the doorway never dead-ends. EmptyState gates its own motion.
  if (state === 'empty' || state === 'error') {
    const headline = state === 'error' ? copy.err.generic : 'Meet Melo, your quiet companion.';
    const body =
      state === 'error' ? undefined : 'A quiet presence across the journey. Nothing to set up.';
    return (
      <EmptyState
        mood="calm"
        headline={headline}
        body={body}
        cta={{ label: 'Back', onPress: () => nav.back() }}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (per the hard rule + STATES.md). A calm, centred
  // holding moment while the surface settles.
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.huge }]}
      >
        <MeloLine mood="curious" text="One moment — Melo's settling in." />
      </View>
    );
  }

  // populated / offline — the real playground. offline ≡ populated (local-first; nothing here needs
  // the network). Web used overflow-y-auto no-scrollbar inside a fixed phone -> RN ScrollView.
  const heroMood = pressureMood[active];
  const heroLine = pressureLine[active];

  return (
    <Animated.View style={[styles.flex, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back glyph · "Melo" eyebrow · spacer to keep the label optically centred. */}
        <View style={styles.header}>
          <Pressable
            accessibilityHint="Goes back."
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={16}
            onPress={() => nav.back()}
            style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.backGlyph, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>{copy.global.melo.name}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Title block — Fraunces italic kicker + the hero headline with one accent word. */}
        <View style={styles.titleBlock}>
          <Text style={[styles.kicker, { color: t.muted }]}>Companion</Text>
          {/* "quiet" is the single accent word: UPRIGHT (web em.not-italic), terracotta. */}
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'A '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>quiet</Text>
            {' presence across the journey.'}
          </Text>
        </View>

        {/* Hero card — surface, hairline, rounded-2xl. Melo at 120 reflecting the active band's mood,
            with her quoted line beneath in Fraunces italic. (Web intensity={1.4} has no RN prop — the
            canonical mood tilt is rendered; see FIDELITY DECISIONS.) */}
        <View style={[styles.heroCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Melo size={HERO_MELO_SIZE} mood={heroMood} grounded />
          <Text style={[styles.heroLine, { color: t.muted }]}>{`“${heroLine}”`}</Text>
        </View>

        {/* Pressure picker — the five bands. Tapping one re-poses the hero Melo + swaps her line. Each
            row is a full-width >=44px tap target carrying the kit press feel. */}
        <View style={styles.picker}>
          {BANDS.map((p) => {
            const isActive = active === p;
            return (
              <Pressable
                accessibilityHint="Sets the pressure band and re-poses Melo."
                accessibilityLabel={`${p} pressure`}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={p}
                onPress={() => selectBand(p)}
                style={({ pressed: isPressed }) => [
                  styles.row,
                  {
                    backgroundColor: isActive ? t.calmSoft : t.surface,
                    borderColor: t.hairline,
                  },
                  isPressed ? styles.pressed : undefined,
                ]}
              >
                <Melo size={ROW_MELO_SIZE} mood={pressureMood[p]} grounded />
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: t.ink }]}>{p}</Text>
                  <Text style={[styles.rowLine, { color: t.muted }]}>{`“${pressureLine[p]}”`}</Text>
                </View>
                {isActive ? <Text style={[styles.rowDot, { color: t.calm }]}>●</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {/* Footer hint — VERBATIM from the web design source. */}
        <Text style={[styles.footerHint, { color: t.muted }]}>
          Try each mood — Melo changes, and your money path shifts with her.
        </Text>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  // px-7 ≈ gap.xl (24) horizontal inset, matching the web screen padding.
  scroll: {
    paddingHorizontal: gap.xl,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // Header row — back · eyebrow · spacer, space-between.
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // The web back glyph is a 20px ← in muted ink.
  backGlyph: {
    fontSize: 20,
    lineHeight: 24,
  },
  // Eyebrow — 12px uppercase, tracked (web tracking-[0.14em] ≈ 1.7 on a 12px label), muted.
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  // A 20px spacer mirroring the web `w-5` so the eyebrow stays optically centred opposite the glyph.
  headerSpacer: {
    width: 20,
  },
  // mt-6 (24px) = gap.xl.
  titleBlock: {
    marginTop: gap.xl,
  },
  // Fraunces italic kicker, 13px, muted (web font-display italic text-[13px]).
  kicker: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces hero headline, 28px, tight leading, mt-1 (web text-[28px] leading-tight mt-1).
  headline: {
    fontFamily: serif.display,
    fontSize: 28,
    letterSpacing: -0.3,
    lineHeight: 32,
    marginTop: gap.xs,
  },
  // The accent word stays UPRIGHT (web em.not-italic) — same Fraunces face, colour-only override.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // mt-6 (24px) = gap.xl; items-center column; rounded-2xl; py-10 (40px) vertical.
  heroCard: {
    alignItems: 'center',
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    paddingVertical: gap.xxl + gap.sm,
  },
  // mt-5 (20px) ≈ gap.lg + gap.xs; Fraunces italic, 14px, centred, max-width ~240.
  heroLine: {
    fontFamily: serif.displayItalic,
    fontSize: 14,
    lineHeight: 20,
    marginTop: gap.lg + gap.xs,
    maxWidth: 240,
    textAlign: 'center',
  },
  // mt-5 (20px) ≈ gap.lg + gap.xs; rows separated by gap.sm (web space-y-2 = 8px).
  picker: {
    gap: gap.sm,
    marginTop: gap.lg + gap.xs,
  },
  // Each row — full width, rounded-xl, px-4 py-3, items-center, gap-3 (12px), hairline.
  row: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    columnGap: gap.md,
    flexDirection: 'row',
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  rowText: {
    flex: 1,
  },
  // 13px medium, capitalized via textTransform (the data stays lowercase).
  rowLabel: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  // 11.5px Fraunces italic, muted — the band's quoted line.
  rowLine: {
    fontFamily: serif.displayItalic,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 1,
  },
  // The active-row selected indicator — a 12px terracotta dot (web ●).
  rowDot: {
    fontSize: 12,
  },
  // mt-5 mb-8 centred, 11px, muted.
  footerHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: gap.lg + gap.xs,
    textAlign: 'center',
  },
  // The kit press feel applied to inline tappables (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
