// ImageSuccessScreen — the faithful 1:1 React Native port of the web photo-read confirmation gate
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenImageSuccess.tsx).
//
// @rn-screen    ImageSuccessScreen
// @rn-stack     Intake > Text found
// @purpose      Show what Folio read from a photo before the user accepts. A calm preview gate: an
//               image thumb + the saved name + a short list of found money items + one Melo line,
//               then a primary path to review what was found and a secondary path to a different
//               image. Nothing is committed here — the user only chooses to proceed.
// @reads        — (nav only; the web @reads is an em-dash. The web file's ~17 store imports are DEAD
//               in its body and are NOT ported. This screen reads no store state.)
// @writes       — (no store mutation; the web @writes is an em-dash. An Accept in the downstream
//               Review/Visualizer step is what calls store.addTransaction — never here.)
// @opens-sheet  edit-item (INTENDED downstream from Review; NOT fired here — the web buttons route to
//               'visualizer'/'intake'. Kept documented but not opened.)
// @copy         FROZEN
// @tokens       surface · hairline · inset · positive · calm (accent) · muted · ink · inverse — all
//               from the kit via '@/folio/theme'. No new token.
// @motion       slide-in-r (whole screen) · press 0.97 (kit `pressed`) · Melo breathe + blink
//               (from MeloLine, calm mood — the only continuous motion on this quiet screen).
//
// @rn-engine photo-reader — WIRED to the real reader. When the Intake screen has STAGED candidates
//   in the store (`readerCandidates`) — the LLM reader's output for a picked photo, or the pure
//   `parseSheet` output for a picked CSV / TSV / TXT — this screen renders THOSE real candidates
//   (review-before-truth — candidates only, never auto-counted). When the slot is empty (a cold /
//   dev open, e.g. FolioShell rendering it with `nav` only), it falls back to the faithful SAMPLE
//   below: the web source's exact two items, restated as text and run through the real `parseSheet`
//   engine (no hand-built array, no fabricated merchants / numbers). The image name is the reader's
//   metadata; the sample keeps the web source's value, and a live read shows an honest label since
//   the reader stages only the money movements, not the photo's filename.
// @rn-engine ocr-extraction — the extractor for a real photo is the LLM reader (gateway vision
//   model, src/local/statementReaderClient.ts), reached from the Intake screen. The native ML Kit
//   Text Recognition module is NOT the blocker anymore; this success preview is reached when the
//   reader staged real candidates, and a read that found nothing routes to the honest image-fallback.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/source):
//   • Accent word "read" is rendered UPRIGHT terracotta inside the Fraunces headline (web
//     <em class="not-italic text-[accent]">). Sourced from the keyed copy.add.success.image
//     ('Folio **read** your image.') and split on the **accent** marker so exactly one accent word
//     renders.
//   • Money tone is NOT sign-derived. Both found items are spend; rendered in INK (the web <Money>
//     defaults to tone='ink'). The sign is carried by the U+2212 minus glyph only; the amounts are
//     now formatted FROM the engine's signed candidate amount (formatSignedAmount), which re-emits the
//     web's exact strings: pence kept when present (−27.40 → "−£27.40"), whole pounds otherwise
//     (−40 → "−£40"). The hint is mapped from the candidate, with a faithful per-merchant override for
//     the web's exact wording ('likely spending' / 'looks like cash out') so the render stays
//     byte-identical while the money facts flow through the real engine.
//   • The web's literal '←' glyph is drawn as a small inline react-native-svg icon (the codebase
//     ships no icon font), matching PdfSuccessScreen's BackArrow. The image thumb is a calm inset
//     paper-well rectangle (the web's paper-grain placeholder) — no real image asset on this wave.
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring Melo + StartScreen.
//   • Press feedback is the kit `pressed` feel (scale 0.97 / lowered opacity) via Pressable.
//   • Push-to-bottom: a ScrollView whose contentContainer is flexGrow:1 with a flex:1 spacer pins
//     the CTAs to the bottom; bottom safe-area replaces the web's trailing margin.
//
// STATES (per STATES.md): this file IS the populated/success branch for the photo reader. All five
// branches render for completeness: populated/offline = the preview (offline ≡ populated, local-
// first); loading = Melo curious + a line, NEVER a spinner; empty/error = the calm EmptyState
// doorway routing to the photo fallback / a different image.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Tap targets are >=44px or carry
// hitSlop. Copy is VERBATIM: the headline uses the keyed add.success.image; the eyebrow / body /
// section label / Melo line / CTAs are @copy FROZEN inline literals (the web keeps them inline).

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
import { parseSheet, type CandidateKind, type CandidateMoneyItem } from '@/folio/lib/importSheet';
import { useReaderCandidates } from '@/folio/store';
import type { Nav } from '@/folio/types';

// A single thing Folio read from the photo — `merchant` is the display name, `hint` is the voice-
// approved confidence line, and `amount` is the preformatted signed money string (the reader formats
// it; the screen renders it).
export type FoundItem = {
  merchant: string;
  hint: string;
  amount: string;
};

// What a completed read hands this screen. Until the reader lands, the shell passes the SAMPLE below
// (the web source's exact image name + two items), so the screen renders honestly off real-shaped data.
export type FoundImage = {
  imageName: string;
  items: readonly FoundItem[];
};

// The render states this screen can occupy (per STATES.md ImageSuccess row).
export type ImageSuccessState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type ImageSuccessScreenProps = {
  nav: Nav;
  image?: FoundImage;
  state?: ImageSuccessState;
};

// Per-merchant hint wording (the photo reader's voice line), layered on top of a live parse's money
// facts (the same metadata-map role SAMPLE_ROW_META plays in the Visualizer). Kept beside the text so
// the render stays byte-identical. Both rows are `spend` to the engine; the web hand-wrote a distinct
// 'looks like cash out' for the ATM row, so an explicit override preserves it. Anything not overridden
// falls back to the kind-derived hint below.
const SAMPLE_HINTS: Readonly<Record<string, string>> = {
  "Sainsbury's": 'likely spending',
  'ATM withdrawal': 'looks like cash out',
};

// Map the engine's candidate `kind` → a voice-approved confidence hint (never a raw category code).
function hintForKind(kind: CandidateKind): string {
  switch (kind) {
    case 'income':
      return 'looks like income';
    case 'bill':
      return 'looks like a bill';
    case 'subscription':
      return 'looks like a subscription';
    case 'spend':
      return 'likely spending';
    default:
      return 'a money item';
  }
}

// Format a signed candidate amount the way the web preformatted it: the U+2212 minus '−' for money
// out, whole pounds grouped, pence only when present (−27.40 → "−£27.40", −40 → "−£40"). Income would
// lead with '+', kept for completeness though the sample is spend-only.
function formatSignedAmount(amount: number): string {
  const magnitude = Math.abs(amount);
  const grouped = magnitude.toLocaleString('en-GB', {
    minimumFractionDigits: Number.isInteger(magnitude) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const sign = amount >= 0 ? '+' : '−';
  return `${sign}£${grouped}`;
}

// Map the engine's CandidateMoneyItem[] (real `parseSheet` output) into this screen's render shape —
// merchant verbatim, the hint from the per-merchant override (else the kind), the amount from the
// signed magnitude. Faithful, no new data, candidates only (never auto-counted).
function toFoundItems(candidates: readonly CandidateMoneyItem[]): FoundItem[] {
  return candidates.map((candidate) => ({
    merchant: candidate.merchant,
    hint: SAMPLE_HINTS[candidate.merchant] ?? hintForKind(candidate.kind),
    amount: formatSignedAmount(candidate.amount),
  }));
}

// The honest image label for a LIVE read: the reader stages the money movements, not the photo's
// filename, so we never invent one. A calm line tells the truth about where the items came from.
const LIVE_READ_IMAGE_LABEL = 'Your photo';

// Build the FoundImage for a live read from the store's staged candidates. Honest metadata (no
// fabricated filename); the money movements are the reader's real output.
function liveImageFrom(candidates: readonly CandidateMoneyItem[]): FoundImage {
  return {
    imageName: LIVE_READ_IMAGE_LABEL,
    items: toFoundItems(candidates),
  };
}

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

export function ImageSuccessScreen({
  nav,
  image: imageProp,
  state = 'populated',
}: ImageSuccessScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  // The REAL staged candidates the Intake reader produced for this photo (review-before-truth). When
  // the slot is non-empty we render those; when it is empty (a cold open from the nav) we render an
  // EMPTY image so the empty-doorway gate below shows — never a fabricated sample. An explicit `image`
  // prop still wins (fixtures / tests).
  const staged = useReaderCandidates();
  const image: FoundImage =
    imageProp ??
    (staged.length > 0 ? liveImageFrom(staged) : { imageName: LIVE_READ_IMAGE_LABEL, items: [] });

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

  const { lead, accent, tail } = useMemo(() => splitAccent(copy.add.success.image), []);

  // error — the read failed; upstream routes to ImageFallback ('Image saved.'). If mounted in error
  // directly, show the calm fallback doorway rather than dead-ending.
  if (state === 'error') {
    return (
      <EmptyState
        mood="calm"
        headline="Image saved."
        body="Folio couldn't read this one clearly. Try a different image."
        cta={{ label: 'Use a different image', onPress: () => nav.go('intake') }}
      />
    );
  }

  // empty — n/a in practice (you only land here when something was read). Rendered as the calm
  // EmptyState so the screen never shows a hollow "0 things found" card.
  if (state === 'empty' || image.items.length === 0) {
    return (
      <EmptyState
        mood="calm"
        headline="Nothing to add."
        body="Folio didn't find money items in this one. Try a different image."
        cta={{ label: 'Use a different image', onPress: () => nav.go('intake') }}
      />
    );
  }

  // loading — Melo curious + a line, NEVER a spinner (hard rule + STATES.md).
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="Folio is reading…" />
      </View>
    );
  }

  // populated / offline — the real preview. offline ≡ populated (the read already happened upstream).
  const foundLabel = `${image.items.length} thing${image.items.length === 1 ? '' : 's'} found`;

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

        {/* Intro — green "Text found" eyebrow, the headline with the single accent word "read". */}
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: t.positive }]}>Text found</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {lead}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>{accent}</Text>
            {tail}
          </Text>
          <Text style={[styles.body, { color: t.muted }]}>
            Check what you want to add. Nothing counts until you choose.
          </Text>
        </View>

        {/* Image + found card. */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          {/* Image row — a calm inset thumb + the saved name. */}
          <View style={styles.imageRow}>
            <View style={[styles.thumb, { backgroundColor: t.inset, borderColor: t.hairline }]} />
            <View style={styles.imageMeta}>
              <Text numberOfLines={1} style={[styles.imageName, { color: t.ink }]}>
                {image.imageName}
              </Text>
              <Text style={[styles.imageSub, { color: t.muted }]}>saved in Folio</Text>
            </View>
          </View>

          {/* Hairline divider. */}
          <View style={[styles.divider, { backgroundColor: t.hairline }]} />

          {/* Found section — pluralised count + the candidate list. */}
          <View style={styles.foundSection}>
            <Text style={[styles.foundLabel, { color: t.muted }]}>{foundLabel}</Text>
            <View style={styles.foundList}>
              {image.items.map((item) => (
                <View key={item.merchant} style={styles.foundRow}>
                  <View style={[styles.dot, { backgroundColor: t.calm }]} />
                  <View style={styles.foundMeta}>
                    <Text numberOfLines={1} style={[styles.merchant, { color: t.ink }]}>
                      {item.merchant}
                    </Text>
                    <Text style={[styles.hint, { color: t.muted }]}>{item.hint}</Text>
                  </View>
                  {/* Money — tone INK; the sign is carried by the +/− glyph only. */}
                  <Text style={[styles.amount, { color: t.ink }]}>{item.amount}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Melo line — the quiet companion, calm mood. MeloLine adds the straight quotes. */}
        <View style={styles.meloBlock}>
          <MeloLine mood="calm" text="Add it only if it belongs." />
        </View>

        {/* Spacer pins the CTAs to the bottom, mirroring the web flex-1 spacer. */}
        <View style={styles.spacer} />

        {/* Primary CTA — terracotta fill; routes to the Visualizer preview where items are accepted. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check what Folio found"
          accessibilityHint="Opens the preview of what was found"
          onPress={() => nav.go('visualizer')}
          style={({ pressed: isPressed }) => [
            styles.primary,
            { backgroundColor: t.calm },
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.primaryLabel, { color: t.inverse }]}>Check what Folio found</Text>
        </Pressable>

        {/* Secondary CTA — quiet path back to intake to pick a different image. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use a different image"
          onPress={() => nav.go('intake')}
          style={({ pressed: isPressed }) => [
            styles.secondary,
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.secondaryLabel, { color: t.muted }]}>Use a different image</Text>
        </Pressable>
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
  // Image — uppercase, tracked, 12px, muted (web text-[12px] uppercase tracking-[0.14em]).
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
  // Fraunces italic eyebrow, 13px, green/positive (web font-display italic text-[13px] --positive).
  eyebrow: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
  },
  // Fraunces hero, 30px, tight line-height, mt-1 (4 → gap.xs).
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
  // 13.5px relaxed body, mt-3 (12 → gap.md), muted.
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: gap.md,
  },
  // Card — surface bg, 1px hairline border, 2xl radius, p-5, mt-6.
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.lg + gap.xs,
  },
  // Image row — thumb + meta, gap-3.
  imageRow: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
  },
  // w-14 h-16 (56×64) rounded-lg inset thumb (the web's paper-grain placeholder).
  thumb: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    height: 64,
    width: 56,
  },
  imageMeta: {
    flex: 1,
    minWidth: 0,
  },
  // 14px medium, truncating.
  imageName: {
    fontSize: 14,
    fontWeight: '500',
  },
  // 11.5px muted, mt-0.5.
  imageSub: {
    fontSize: 11.5,
    marginTop: gap.xxs,
  },
  // 1px divider, mt-5.
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: gap.lg + gap.xs,
  },
  // Found section, mt-5.
  foundSection: {
    marginTop: gap.lg + gap.xs,
  },
  // 11px uppercase tracked muted.
  foundLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  // mt-3 + space-y-3 between rows.
  foundList: {
    marginTop: gap.md,
    rowGap: gap.md,
  },
  // Found row — dot + meta + amount, gap-3.
  foundRow: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
  },
  // w-1.5 h-1.5 (6) rounded-full accent dot.
  dot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  foundMeta: {
    flex: 1,
    minWidth: 0,
  },
  // 13.5px medium, truncating.
  merchant: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  // 11.5px italic muted.
  hint: {
    fontSize: 11.5,
    fontStyle: 'italic',
  },
  // Money — the web <Money size="sm"> is Fraunces display, tabular, medium, 15px. Tone INK.
  amount: {
    fontFamily: serif.display,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  // mt-5.
  meloBlock: {
    marginTop: gap.lg + gap.xs,
  },
  spacer: {
    flex: 1,
  },
  // Primary CTA — h-[58px], 2xl radius, terracotta fill.
  primary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 58,
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 15.5,
    fontWeight: '500',
  },
  // Secondary CTA — h-[46px], 2xl radius, mt-2, no fill.
  secondary: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 46,
    justifyContent: 'center',
    marginTop: gap.sm,
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
