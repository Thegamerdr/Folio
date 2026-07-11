// ImageFallbackScreen — the faithful 1:1 React Native port of the web photo-not-read fallback
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenImageFallback.tsx).
//
// @rn-screen    ImageFallbackScreen
// @rn-stack     Intake > From a photo
// @purpose      The failure state when the photo reader can't produce things to check. The image is
//               kept in Folio (nothing is lost); the screen offers a calm retry, a quiet "view image"
//               affordance, and a last-resort manual path. Honest copy, one clear recovery.
// @reads        — (nav only; the web @reads is an em-dash. The web file's ~17 store imports are DEAD
//               in its body and are NOT ported. This screen reads no store state.)
// @writes       — (no store mutation; the web @writes is an em-dash. Nothing is added here — the
//               manual path routes to Review, where an Accept is the only write.)
// @opens-sheet  edit-item (INTENDED downstream from Review; NOT fired here. Kept documented.)
// @copy         FROZEN
// @tokens       surface · hairline · inset · calm (accent) · muted · ink · inverse — all from the
//               kit via '@/folio/theme'. No new token.
// @motion       slide-in-r (whole screen) · press 0.97 (kit `pressed`) · Melo breathe + blink
//               (from MeloLine, calm mood — the only continuous motion on this quiet screen).
//
// @rn-engine ocr-extraction (native PdfRenderer + ML Kit module — not built; see nativeTextExtraction.ts)
//   This screen IS the honest destination for that gap: today every photo / screenshot pick on the
//   Intake screen reaches here because the on-device OCR extractor returns `none` (the native ML Kit
//   Text Recognition module is not built). The image was saved to the app cache, on-device only
//   (nothing lost, no bytes leave the phone); we say so plainly ("Image saved" / "will read later")
//   and never claim a read happened. When the native module lands, a successful extract will parse to
//   candidates and route to image-success instead — with NO change to this fallback. The image name
//   below is the saved image's name; here it is a local sample that REUSES the web source's exact
//   value (no fabricated names).
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/source):
//   • Accent word "saved." is rendered UPRIGHT terracotta inside the Fraunces headline (web
//     <em class="not-italic text-[accent]">). Sourced from the keyed copy.add.fallback.image
//     ('Image **saved.**') and split on the **accent** marker so exactly one accent word renders.
//   • The web's literal '←' glyph is drawn as a small inline react-native-svg icon (the codebase
//     ships no icon font), matching PdfSuccessScreen's BackArrow. The image thumb is a calm inset
//     paper-well rectangle with a quiet "photo" caption (the web placeholder).
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring Melo + StartScreen.
//   • Press feedback is the kit `pressed` feel (scale 0.97 / lowered opacity) via Pressable.
//   • Push-to-bottom: a ScrollView whose contentContainer is flexGrow:1 with a flex:1 spacer pins
//     the CTAs to the bottom; bottom safe-area replaces the web's trailing margin.
//   • The "View image" affordance is presentational on this UI-only wave (the viewer is a later
//     surface). It is a real >=44px tappable that no-ops calmly.
//
// STATES (per STATES.md): this file IS the fallback/error branch for the photo reader. All five
// branches render for completeness: populated/offline = the fallback (offline ≡ populated, local-
// first); loading = Melo curious + a line, NEVER a spinner; empty = the calm EmptyState doorway.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Tap targets are >=44px or carry
// hitSlop. Copy is VERBATIM: the headline uses the keyed add.fallback.image; the eyebrow / body /
// note / Melo line / CTAs are @copy FROZEN inline literals (the web keeps them inline).

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { copy } from '@/folio/copy/copy';
import { EmptyState } from '@/folio/ui/EmptyState';
import { consumeReaderFallbackReason } from '@/folio/lib/readerFallbackReason';
import type { Nav } from '@/folio/types';

// What a failed read hands this screen — just the saved image's name. Until the reader lands, the
// shell passes the SAMPLE below (the web source's exact name), so the screen renders honestly.
export type SavedImage = {
  imageName: string;
};

// The render states this screen can occupy (per STATES.md ImageFallback row).
export type ImageFallbackState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type ImageFallbackScreenProps = {
  nav: Nav;
  image?: SavedImage;
  state?: ImageFallbackState;
};

// The web prototype's hardcoded image name, reused VERBATIM (no fabricated names).
const SAMPLE_IMAGE: SavedImage = { imageName: 'IMG_2643.jpg' };

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (spec @motion): the whole screen enters from +28px on X with a fade over 360ms.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// Local reduce-motion read, mirroring Melo.tsx + StartScreen.tsx exactly: read once, then subscribe.
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

// Split a frozen copy string on its single **accent** marker into lead / accent / tail.
function splitAccent(source: string): { lead: string; accent: string; tail: string } {
  const open = source.indexOf('**');
  const close = source.indexOf('**', open + 2);
  if (open === -1 || close === -1) {
    return { lead: source, accent: '', tail: '' };
  }
  return {
    lead: source.slice(0, open),
    accent: source.slice(open + 2, close),
    tail: source.slice(close + 2),
  };
}

export function ImageFallbackScreen({
  nav,
  image = SAMPLE_IMAGE,
  state = 'populated',
}: ImageFallbackScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // slide-in-r — drives the whole screen. Under reduce-motion we resolve straight to final state.
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

  const { lead, accent, tail } = useMemo(() => splitAccent(copy.add.fallback.image), []);

  // Consumed ONCE on mount — when the reader (IntakeScreen) knew a specific reason the read failed
  // (long export, timeout, gateway trouble), it carries over here via a module-level handoff (see
  // readerFallbackReason.ts) rather than being lost once its toast dismisses. `undefined` when the
  // reader had nothing more specific to say (or on a cold/direct nav here) — the body line below
  // falls back to the honest generic copy in that case, exactly as before.
  const [readerReason] = useState(() => consumeReaderFallbackReason());

  // empty — n/a in practice; rendered as the calm doorway so the screen never dead-ends.
  if (state === 'empty') {
    return (
      <EmptyState
        mood="calm"
        headline="Nothing to add."
        body="Try a different image, or add one thing yourself."
        cta={{ label: 'Try another image', onPress: () => nav.go('intake') }}
      />
    );
  }

  // loading — Melo curious + a line, NEVER a spinner (hard rule + STATES.md).
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="Melo is reading…" />
      </View>
    );
  }

  // populated / offline / error — the real fallback. offline ≡ populated (the read already happened).
  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back glyph · Image label · balancing spacer. */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [
              styles.pressIcon,
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <BackArrow color={t.muted} />
          </Pressable>
          <Text style={[styles.headerLabel, { color: t.muted }]}>Image</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Intro — italic "Saved" eyebrow, headline with the single accent word "saved.", calm body. */}
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Saved</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {lead}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>{accent}</Text>
            {tail}
          </Text>
          <Text style={[styles.body, { color: t.muted }]}>
            {readerReason ?? 'I could not read it clearly enough to show things to check.'}
          </Text>
        </View>

        {/* Image card — thumb + truncating name + "saved in Melo" + a quiet View. */}
        <View style={[styles.imageCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <View style={[styles.thumb, { backgroundColor: t.inset, borderColor: t.hairline }]}>
            <Text style={[styles.thumbCaption, { color: t.muted }]}>photo</Text>
          </View>
          <View style={styles.imageMeta}>
            <Text numberOfLines={1} style={[styles.imageName, { color: t.ink }]}>
              {image.imageName}
            </Text>
            <Text style={[styles.imageSub, { color: t.muted }]}>saved in Melo</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View image"
            hitSlop={12}
            onPress={() => {}}
            style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.viewLink, { color: t.muted }]}>View</Text>
          </Pressable>
        </View>

        {/* Note well — the calm advice block. */}
        <View style={[styles.noteWell, { backgroundColor: t.inset }]}>
          <Text style={[styles.noteText, { color: t.muted }]}>
            Try a clearer image first. If that still does not work, you can add one thing yourself.
          </Text>
        </View>

        {/* Melo line — the quiet companion, calm mood. MeloLine adds the straight quotes. */}
        <View style={styles.meloBlock}>
          <MeloLine
            mood="calm"
            text="Let's give the image one more try before we ask you to type."
          />
        </View>

        {/* Spacer pins the CTAs to the bottom, mirroring the web flex-1 spacer. */}
        <View style={styles.spacer} />

        {/* Primary CTA — terracotta retry. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try another image"
          onPress={() => nav.go('intake')}
          style={({ pressed: isPressed }) => [
            styles.primary,
            { backgroundColor: t.calm },
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.primaryLabel, { color: t.inverse }]}>Try another image</Text>
        </Pressable>

        {/* Secondary row — "View image" (presentational) + the manual last-resort path to Review. */}
        <View style={styles.secondaryRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View image"
            onPress={() => {}}
            style={({ pressed: isPressed }) => [
              styles.secondaryCell,
              { backgroundColor: t.surface, borderColor: t.hairline },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.secondaryLabel, { color: t.ink }]}>View image</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add one thing myself"
            onPress={() => nav.go('review')}
            style={({ pressed: isPressed }) => [
              styles.secondaryCell,
              { backgroundColor: t.surface, borderColor: t.hairline },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.secondaryLabel, { color: t.muted }]}>Add one thing myself</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// Back arrow — the web '←' glyph, drawn inline (matches PdfSuccessScreen). 20×20 user space.
function BackArrow({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M12 4 L6 10 L12 16"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M6 10 H16" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // px-7 ≈ screen inset → gap.xl (24). flexGrow:1 + a flex:1 spacer pins the CTAs to the bottom.
  content: {
    flexGrow: 1,
    paddingHorizontal: gap.xl,
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
  pressIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 20,
  },
  // Image — uppercase, tracked, 12px, muted.
  headerLabel: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  headerSpacer: {
    width: 20,
  },
  // mt-6 (24) → gap.xl.
  intro: {
    marginTop: gap.xl,
  },
  // Fraunces italic eyebrow, 13px, muted.
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces hero, 30px, tight line-height, mt-1.
  headline: {
    fontFamily: serif.display,
    fontSize: 30,
    lineHeight: 34,
    marginTop: gap.xs,
  },
  // The accent word stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // 13.5px relaxed body, mt-3, muted, max-width ~300.
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: gap.md,
    maxWidth: 300,
  },
  // Image card — surface, hairline, 2xl radius, p-3, row, gap-3, mt-5.
  imageCard: {
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    columnGap: gap.md,
    flexDirection: 'row',
    marginTop: gap.lg + gap.xs,
    padding: gap.md,
  },
  // w-16 h-20 (64×80) rounded-lg inset thumb with a quiet "photo" caption.
  thumb: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    height: 80,
    justifyContent: 'center',
    width: 64,
  },
  thumbCaption: {
    fontSize: 11,
  },
  imageMeta: {
    flex: 1,
    minWidth: 0,
  },
  // 13.5px medium, truncating.
  imageName: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  // 11px muted.
  imageSub: {
    fontSize: 11,
    marginTop: gap.xxs,
  },
  // 11.5px muted, underlined "View".
  viewLink: {
    fontSize: 11.5,
    textDecorationLine: 'underline',
  },
  // Note well — inset bg, rounded-xl, p-4, mt-5.
  noteWell: {
    borderRadius: radius.md,
    marginTop: gap.lg + gap.xs,
    padding: gap.lg,
  },
  noteText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  // mt-5.
  meloBlock: {
    marginTop: gap.lg + gap.xs,
  },
  spacer: {
    flex: 1,
  },
  // Primary CTA — full width, h-[54px], 2xl radius, terracotta fill.
  primary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 54,
    justifyContent: 'center',
    marginBottom: gap.sm,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  // Secondary row — two cells, gap-2.5.
  secondaryRow: {
    columnGap: gap.md - gap.xxs,
    flexDirection: 'row',
  },
  // h-12 (48) rounded-xl, surface, hairline. flex:1 so the two share the row evenly.
  secondaryCell: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 13,
  },
  // The kit press feel (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
