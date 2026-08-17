// PdfFallbackScreen — the faithful 1:1 React Native port of the web statement-not-read fallback
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPdfFallback.tsx).
//
// @rn-screen    PdfFallbackScreen
// @rn-stack     Intake > Statement not read
// @purpose      The failure state when the statement reader can't produce things to check. The file
//               is kept as a note (nothing is lost); the screen offers a calm retry, a quiet "view
//               file" affordance, and a last-resort manual path. Honest copy, one clear recovery.
// @reads        active workspace + encrypted evidence metadata for the retained file
// @writes       — (no store mutation; the web @writes is an em-dash. Nothing is added here — the
//               manual path routes to Review, where an Accept is the only write.)
// @opens-sheet  edit-item (INTENDED downstream from Review; NOT fired on this screen — the web
//               buttons route to 'intake'/'review'. Kept documented but not opened.)
// @copy         FROZEN
// @tokens       surface · hairline · inset · calm (accent) · muted · ink · inverse — all from the
//               kit via '@/folio/theme'. No new token.
// @motion       slide-in-r (whole screen) · press 0.97 (kit `pressed`) · Melo breathe + blink
//               (from MeloLine, calm mood — the only continuous motion on this quiet screen).
//
// @rn-engine ocr-extraction (PdfRenderer + bundled ML Kit attempted locally before this fallback)
//   This screen IS the honest destination for that gap: today every PDF pick on the Intake screen
//   reaches here because the on-device PDF-text / OCR extractor returns `none` (the native PdfRenderer
//   + ML Kit did not produce reliable rows). The file was saved to the app cache (nothing lost);
//   plainly ("File saved" / "will read later") and never claim a read happened. When the native module
//   lands, a successful extract will parse to candidates and route to pdf-success instead — with NO
//   change to this fallback. The card renders the retained file's real name.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/source):
//   • Accent word "saved." is rendered UPRIGHT terracotta inside the Fraunces headline (web
//     <em class="not-italic text-[accent]">). Sourced from the keyed copy.add.fallback.pdf
//     ('File **saved.**') and split on the **accent** marker so exactly one accent word renders.
//   • The web's literal '←' and '▤' glyphs are drawn as small inline react-native-svg icons (the
//     codebase ships no icon font), matching PdfSuccessScreen's BackArrow + FileGlyph.
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring Melo + StartScreen.
//   • Press feedback is the kit `pressed` feel (scale 0.97 / lowered opacity) via Pressable.
//   • Push-to-bottom: a ScrollView whose contentContainer is flexGrow:1 with a flex:1 spacer pins
//     the CTAs to the bottom on tall screens; bottom safe-area replaces the web's trailing margin.
//   • Both "View file" affordances decrypt into a short-lived cache file, invoke the native
//     viewer/share surface, and remove that plaintext cache in `finally`.
//
// STATES (per STATES.md): this file IS the fallback/error branch for the statement reader. All five
// branches render for completeness: populated/offline = the fallback (offline ≡ populated, local-
// first); loading = Melo curious + a line, NEVER a spinner; empty = the calm EmptyState doorway.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Tap targets are >=44px or carry
// hitSlop. Copy is VERBATIM: the headline uses the keyed add.fallback.pdf; the eyebrow / body /
// note / Melo line / CTAs are @copy FROZEN inline literals (the web keeps them inline).

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { IntakeResultHeader, IntakeResultRail } from '@/folio/ui/IntakeResultRail';
import { openEvidenceDocument } from '@/folio/lib/documentVault';
import {
  consumeReaderFallbackEvidenceId,
  consumeReaderFallbackReason,
} from '@/folio/lib/readerFallbackReason';
import { useAppStore } from '@/folio/store';
import type { Nav } from '@/folio/types';

// Optional explicit name for previews. Production resolves the retained evidence metadata.
export type SavedFile = {
  fileName: string;
};

// The render states this screen can occupy (per STATES.md PdfFallback row).
export type PdfFallbackState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PdfFallbackScreenProps = {
  nav: Nav;
  file?: SavedFile;
  state?: PdfFallbackState;
};

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

export function PdfFallbackScreen({ nav, file, state = 'populated' }: PdfFallbackScreenProps) {
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

  const { lead, accent, tail } = useMemo(() => splitAccent(copy.add.fallback.pdf), []);

  // Consumed ONCE on mount — when the reader (IntakeScreen) knew a specific reason the read failed
  // (long export, timeout, gateway trouble), it carries over here via a module-level handoff (see
  // readerFallbackReason.ts) rather than being lost once its toast dismisses. `undefined` when the
  // reader had nothing more specific to say (or on a cold/direct nav here) — the body line below
  // falls back to the honest generic copy in that case, exactly as before.
  const [readerReason] = useState(() => consumeReaderFallbackReason());
  const [readerEvidenceId] = useState(() => consumeReaderFallbackEvidenceId());
  const workspace = useAppStore((current) =>
    current.workspaces.find((candidate) => candidate.id === current.activeWorkspaceId),
  );
  const evidenceDocument = useAppStore((current) => {
    const workspaceId = current.activeWorkspaceId;
    if (readerEvidenceId !== undefined) {
      return current.evidenceDocuments?.find(
        (document) => document.id === readerEvidenceId && document.workspaceId === workspaceId,
      );
    }
    return current.evidenceDocuments?.find(
      (document) => document.workspaceId === workspaceId && document.sourceType === 'document',
    );
  });
  const fileName = file?.fileName ?? evidenceDocument?.filename ?? 'Saved file';

  const openSource = () => {
    // CLAIM: saved source evidence is encrypted by the shipped workspace evidence vault.
    if (workspace === undefined || evidenceDocument === undefined) {
      Alert.alert('Saved file unavailable', 'This encrypted original is no longer on this device.');
      return;
    }
    void openEvidenceDocument(workspace, evidenceDocument).catch((reason: unknown) => {
      Alert.alert(
        'Could not open the saved file',
        reason instanceof Error ? reason.message : 'The encrypted file could not be opened.',
      );
    });
  };

  // empty — n/a in practice; rendered as the calm doorway so the screen never dead-ends.
  if (state === 'empty') {
    return (
      <EmptyState
        mood="calm"
        headline="Nothing to add."
        body="Try a different file, or add one thing yourself."
        cta={{ label: 'Try another file', onPress: () => nav.go('intake') }}
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
        <IntakeResultHeader nav={nav} title="PDF" />

        {/* Intro — italic "Saved" eyebrow, headline with the single accent word "saved.", calm body. */}
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Saved</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {lead}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>{accent}</Text>
            {tail}
          </Text>
          <Text style={[styles.body, { color: t.muted }]}>
            {readerReason ??
              'I could not read this statement clearly enough to show things to check.'}
          </Text>
        </View>

        <IntakeResultRail nav={nav} outcome="needs-help" source="pdf" />

        {/* File card — icon chip + truncating filename + "saved in Melo" + a quiet View. */}
        <View style={[styles.fileCard, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <View style={[styles.iconChip, { backgroundColor: t.inset }]}>
            <FileGlyph color={t.ink} />
          </View>
          <View style={styles.fileMeta}>
            <Text numberOfLines={1} style={[styles.fileName, { color: t.ink }]}>
              {fileName}
            </Text>
            <Text style={[styles.fileSub, { color: t.muted }]}>saved in Melo</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View file"
            accessibilityState={{ disabled: evidenceDocument === undefined }}
            disabled={evidenceDocument === undefined}
            hitSlop={12}
            onPress={openSource}
            style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.viewLink, { color: t.muted }]}>View</Text>
          </Pressable>
        </View>

        {/* Note well — the calm advice block. */}
        <View style={[styles.noteWell, { backgroundColor: t.inset }]}>
          <Text style={[styles.noteText, { color: t.muted }]}>
            Try another copy of the statement first. If that still does not work, you can add one
            thing yourself.
          </Text>
        </View>

        {/* Melo line — the quiet companion, calm mood. MeloLine adds the straight quotes. */}
        <View style={styles.meloBlock}>
          <MeloLine
            mood="calm"
            text="Let's give the file one more try before we ask you to type."
          />
        </View>

        {/* Spacer pins the CTAs to the bottom, mirroring the web flex-1 spacer. */}
        <View style={styles.spacer} />

        {/* Primary CTA — terracotta retry. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try another file"
          onPress={() => nav.go('intake')}
          style={({ pressed: isPressed }) => [
            styles.primary,
            { backgroundColor: t.calm },
            isPressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={[styles.primaryLabel, { color: t.accentInk }]}>Try another file</Text>
        </Pressable>

        {/* Secondary row — encrypted original + the manual last-resort path to Review. */}
        <View style={styles.secondaryRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View file"
            accessibilityState={{ disabled: evidenceDocument === undefined }}
            disabled={evidenceDocument === undefined}
            onPress={openSource}
            style={({ pressed: isPressed }) => [
              styles.secondaryCell,
              { backgroundColor: t.surface, borderColor: t.hairline },
              isPressed ? styles.pressed : undefined,
            ]}
          >
            <Text style={[styles.secondaryLabel, { color: t.ink }]}>View file</Text>
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

// File glyph — the web '▤' (a document with lines), drawn inline. 18×18 user space.
function FileGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        d="M4 2 H11 L14 5 V16 H4 Z"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M11 2 V5 H14" stroke={color} strokeWidth={1.4} strokeLinejoin="round" fill="none" />
      <Path d="M6 9 H12" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M6 12 H10" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
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
  // PDF — uppercase, tracked, 12px, muted (web text-[12px] uppercase tracking-[0.14em]).
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
  // Fraunces italic eyebrow, 13px, muted (web font-display italic text-[13px] --muted-ink).
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
  // 13.5px relaxed body, mt-3 (12 → gap.md), muted, max-width ~300.
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: gap.md,
    maxWidth: 300,
  },
  // File card — surface, hairline, 2xl radius, px-4 py-3, row, gap-3, mt-5.
  fileCard: {
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    columnGap: gap.md,
    flexDirection: 'row',
    marginTop: gap.lg + gap.xs,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  // w-10 h-10 (40) rounded-lg inset chip, centred glyph.
  iconChip: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  fileMeta: {
    flex: 1,
    minWidth: 0,
  },
  // 13.5px medium, truncating.
  fileName: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  // 11px muted.
  fileSub: {
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
