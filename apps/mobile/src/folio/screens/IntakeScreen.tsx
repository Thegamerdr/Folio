// @rn-engine statement-reader|photo-reader|text-reader — produces CandidateMoneyItem[] into Review (see BUILD_PLAN §3)
// @rn-engine ocr-extraction — the EXTRACTOR is now the LLM reader (gateway vision model,
//   src/local/statementReaderClient.ts), NOT the native PdfRenderer + ML Kit module. A real PDF /
//   photo is handed to `extractStatementCandidates`, which reads the page through the multimodal
//   gateway and returns money movements as candidates. The unbuilt native module is therefore no
//   longer the blocker for reading a PDF/photo — it only matters for a fully offline OCR path.
//
// IntakeScreen — the faithful 1:1 React Native port of the web "Add what you have" picker
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenIntake.tsx).
//
// @rn-screen    IntakeScreen
// @rn-stack     Onboarding > Add what you have
// @purpose      Pick how to add a statement — PDF, photo, paste, CSV/TXT, or type it in.
// @reads        — (nav only; the web @reads is empty — confirmed in the spec. The web file's many
//                  store imports — setPots/addTransaction/Money/meloHero/… — are DEAD here and are
//                  NOT ported.)
// @writes       — (no store actions; this screen never mutates the path. The downstream *-success
//                  readers produce candidates that the user Accepts in Review — that is the only
//                  write path. This picker only dispatches.)
// @opens-sheet  — (navigation is screen-to-screen via nav.go, never a sheet)
// @copy         FROZEN — no "import" / "OCR" / "parser" wording allowed.
// @tokens       --surface (Surface) · --hairline (Hairline) · --accent (calm) · --muted-ink (muted)
//               · --inset (icon tiles + Melo panel) · --accent-soft (calmSoft, fastest badge)
// @motion       slide-in-r (whole screen) · press 0.97/120ms (back + every option row) · Melo
//               breathe + blink (calm mood, inside MeloLine — the only continuous motion)
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/store sources):
//   • This screen is a NAVIGATION / DISPATCH MENU that now also fires the REAL on-device pickers
//     for the two file-shaped options. PDF / photo / paste / CSV·TXT each lead to a downstream
//     reader-success screen that previews CandidateMoneyItem[] before Review; ONLY "Add numbers
//     yourself" (the failure-only manual path) goes straight to `review`. A reader is NEVER routed
//     to a blank manual form. The two text-shaped options (Paste transactions AND CSV or TXT file)
//     both route to `paste-success`, exactly as the web source does — the text/file reader behind
//     it handles both pasted text and an uploaded file.
//   • WIRED PICKERS (this wave): "PDF statement" opens the real document picker
//     (`pickLocalStatementDocument`, src/local/nativeDocumentImport.ts); "Screenshot or photo"
//     opens the real photo-library picker (`pickStatementImage`, src/local/nativeImageIntake.ts).
//     Two real read paths now run behind those pickers:
//       — TEXT (CSV / TSV / TXT): the adapter returns extracted TEXT, which is run through the pure
//         `parseSheet` engine into CandidateMoneyItem[]. If that produces real candidates they are
//         STAGED via `setReaderCandidates` and the user is routed to the success preview
//         (`pdf-success` / `image-success`), where they review-before-truth.
//       — PDF / PHOTO: the picked file's `uri` + `mediaType` are handed to the LLM reader
//         (`extractStatementCandidates`, src/local/statementReaderClient.ts → the gateway vision
//         model). While that call is in flight the screen shows a calm in-place "reading…" moment
//         (a Melo line, NEVER a spinner). On `ok` with >=1 candidate the candidates are STAGED via
//         `setReaderCandidates` and the user is routed to the success preview. On `no-provider` /
//         `error` / an empty read the file is still saved and the user is routed to the HONEST
//         fallback (`pdf-fallback` / `image-fallback`: "File saved" / "will read later"). We never
//         pretend a read happened — an unread file always lands on the honest fallback.
//     A cancel / permission-refusal leaves the picker exactly where it was.
//   • The accent word in the headline ("**what**") renders terracotta and UPRIGHT (the web uses
//     <em class="not-italic text-[accent]"> — NOT italic). The headline string is read VERBATIM
//     from `copy.add.title` ('Add **what** you have.') and the **…** run is coloured t.calm in the
//     surrounding display face. No literal headline is hand-typed.
//   • The five option titles/hints, the subhead, the MeloLine quote and the footer line are NOT
//     keyed in COPY_DECK (the deck's add.option.* keys describe a different 4-option shape). Per
//     the established StartScreen precedent they are ported as @copy FROZEN inline literals,
//     byte-for-byte from the web source — the render layer never invents or paraphrases copy.
//   • Icon glyphs are shipped as the same Unicode characters the web renders (▤ ▢ ❝ ⌗ ✎) inside an
//     --inset tile, faithful to the source. They are decorative — the Pressable carries the real
//     accessibility label (title + hint) so a screen reader never depends on the glyph.
//   • slide-in-r: translateX 28→0 + fade over 360ms, ease-out-expo — gated to the FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring StartScreen and Melo.
//   • press: every option row + the back glyph carry the kit `pressed` feel (scale 0.97 / lowered
//     opacity) — the token equivalent of the web `press` util. Tap targets clear 44px (rows are
//     tall; the back glyph carries hitSlop).
//   • STATES: the spec declares Intake populated-only (empty/loading/error n/a; offline ≡
//     populated — local-first, nothing fetched). All five branches are rendered for completeness:
//     populated/offline = the picker; loading = Melo curious + a line (NEVER a spinner, max ~4s
//     then fall through to the picker); empty/error = the calm EmptyState doorway that still
//     routes into the picker so it never dead-ends. A sixth, transient READING moment (also Melo
//     curious + a line, NEVER a spinner) shows while the LLM reader reads a picked PDF / photo; it
//     resolves to the success preview or the honest fallback the instant the read returns.
//   • Layout: the web root is a scroll container with a flex-1 spacer before the footer, so the
//     footer pins to the bottom on tall screens and the list scrolls on short ones. RN: a
//     ScrollView with contentContainerStyle flexGrow:1 + a flex:1 spacer View reproduces the
//     pin-to-bottom behaviour. The 20px header spacer balances the 20px back glyph so the "Add"
//     eyebrow stays optically centred.
//
// Tokens only — no new colour, font, spacing, or radius. Copy is VERBATIM (headline from
// '@/folio/copy/copy'; the unkeyed option/subhead/Melo/footer strings are @copy FROZEN literals).

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { parseSheet, type CandidateMoneyItem } from '@/folio/lib/importSheet';
import { setReaderCandidates } from '@/folio/store';
import { pickLocalStatementDocument } from '../../local/nativeDocumentImport';
import { pickStatementImage } from '../../local/nativeImageIntake';
import {
  extractStatementCandidates,
  type StatementReaderKind,
} from '../../local/statementReaderClient';
import type { Nav, ScreenId } from '@/folio/types';

// The render states this screen can occupy. Per the spec, Intake is populated-only and offline is
// identical to populated (local-first, no network dependency); loading/empty/error are n/a for a
// pure dispatch menu but are rendered for completeness so every branch is exercised.
export type IntakeState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type IntakeScreenProps = {
  nav: Nav;
  state?: IntakeState;
};

// One row in the picker — a faithful port of the web `options` array (title / hint / icon / route /
// optional `fastest` badge). Route ids are web ScreenId values (typed against ScreenId so a typo is
// a compile error). `pick` tags the two file-shaped rows that now open a REAL on-device picker
// before navigating; the others dispatch straight to their screen via `to`. `to` is the screen a
// successful read routes to (so the route stays declarative + typed).
type IntakeOption = {
  title: string;
  hint: string;
  icon: string;
  to: ScreenId;
  pick?: 'document' | 'photo';
  fastest?: boolean;
};

// @copy FROZEN — byte-for-byte from the web ScreenIntake `options` array. The titles / hints / icons
// / `fastest` badge are unchanged. Two text-shaped options (Paste transactions + CSV or TXT file)
// both route to 'paste-success', preserved from the source. The two file-shaped options carry a
// `pick` tag so the row opens the real document / photo picker before routing (see runPick below).
const OPTIONS: readonly IntakeOption[] = [
  { title: 'PDF statement', hint: 'from your bank app', icon: '▤', to: 'pdf-success', pick: 'document', fastest: true },
  { title: 'Screenshot or photo', hint: 'from your phone', icon: '▢', to: 'image-success', pick: 'photo' },
  { title: 'Paste transactions', hint: 'copy from anywhere', icon: '❝', to: 'paste-success' },
  { title: 'CSV or TXT file', hint: 'if you have one', icon: '⌗', to: 'paste-success' },
  { title: 'Add numbers yourself', hint: 'type it in', icon: '✎', to: 'review' },
] as const;

// Shared ease-out-expo — the web's cubic-bezier(.16, 1, .3, 1).
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// slide-in-r geometry (from the spec @motion): the whole screen enters from +28px on X with a fade.
const SLIDE_FROM_X = 28;
const SLIDE_MS = 360;

// The loading branch is a holding moment, never a permanent state: after this it falls through to
// the picker. Mirrors the hard rule "loading = Melo curious + a line, NEVER a spinner (max 4s then
// fallback)".
const LOADING_FALLBACK_MS = 4000;

// Local reduce-motion read, mirroring Melo.tsx / StartScreen exactly: read once, then subscribe to
// changes. Kept self-contained so this screen pulls no heavy module graph.
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

// A picked text file (CSV / TSV / TXT) only routes to the success preview when the reader actually
// produced money to review. `parseSheet` is the pure candidate engine (importSheet.ts): it returns
// CandidateMoneyItem[] + honest issues, and NEVER auto-counts. A hard column issue (no amount / no
// name column, or empty input) means the text could not be read as a statement at all — that is the
// "read failed" case, so it falls to the honest fallback rather than a hollow preview. Row-level
// issues are not hard; a single bad row still lets the good rows through to the preview. Returns the
// candidate list to STAGE when the read succeeded, or `null` when it did not — so the caller stages
// the real candidates before routing to the preview, never an empty list.
function readTextCandidates(text: string): CandidateMoneyItem[] | null {
  const { candidates, issues } = parseSheet(text);
  const hasHardIssue = issues.some(
    (issue) =>
      issue.code === 'missing-amount' ||
      issue.code === 'missing-merchant' ||
      issue.code === 'empty-input',
  );
  if (candidates.length === 0 || hasHardIssue) return null;
  return candidates;
}

// Split a deck string carrying a single **accent** run into its three parts. The headline is read
// VERBATIM from copy (copy.add.title = 'Add **what** you have.'); the render layer colours the
// accent run terracotta and strips only the ** markers (never the words). A string with no markers
// returns the whole string as `lead` so it still renders.
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

export function IntakeScreen({ nav, state = 'populated' }: IntakeScreenProps) {
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

  // loading — a brief holding moment (Melo curious + a line). It never persists: after
  // LOADING_FALLBACK_MS it resolves to the picker, so the screen can never sit on "loading".
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (state !== 'loading') return;
    const id = setTimeout(() => setLoadingTimedOut(true), LOADING_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [state]);

  // reading — the calm in-place moment while the LLM reader is reading a picked PDF / photo. It is
  // driven by the real in-flight read (not a timer): the read either lands candidates (→ success),
  // or honestly falls back (→ fallback), and either way clears this state before routing. It is a
  // Melo line, NEVER a spinner — the same "no spinner" hard rule the loading branch obeys.
  const [reading, setReading] = useState(false);

  const { lead, accent, tail } = useMemo(() => splitAccent(copy.add.title), []);

  // Run the LLM reader over a picked PDF / photo and route honestly. The picked file's `uri` +
  // `mediaType` go to `extractStatementCandidates` (the gateway vision model). While the call is in
  // flight the screen shows the calm "reading…" Melo moment (reading=true). On `ok` with >=1
  // candidate the candidates are STAGED via setReaderCandidates and we route to the success preview
  // (review-before-truth — they are staged, not counted). On `no-provider` / `error` / an empty read
  // we route to the honest fallback (the file is already saved on-device by the adapter; we never
  // fake a parse). Always clears `reading` before routing.
  async function runReader(
    uri: string,
    mediaType: string,
    kind: StatementReaderKind,
    successScreen: ScreenId,
    fallbackScreen: ScreenId,
  ) {
    setReading(true);
    try {
      const result = await extractStatementCandidates({ uri, mediaType, kind });
      if (result.kind === 'ok' && result.candidates.length > 0) {
        setReaderCandidates(result.candidates);
        nav.go(successScreen);
        return;
      }
      // no-provider / error / empty read → the file is saved, but nothing was read. Honest fallback.
      nav.go(fallbackScreen);
    } finally {
      setReading(false);
    }
  }

  // Fire the real on-device picker for a file-shaped option, then route honestly:
  //   • document (PDF statement): pickLocalStatementDocument copies the chosen file to the app cache.
  //     A CSV / TSV / TXT statement comes back as extracted TEXT (`picked`) — parseSheet reads it into
  //     candidates, which are STAGED before routing to the success preview ('pdf-success'); a hollow /
  //     hard-issue read falls to the honest 'pdf-fallback'. A real PDF comes back `unsupported` (the
  //     adapter saved it but read no text) — its `uri` + `mediaType` go to the LLM reader (runReader),
  //     which stages the model's candidates → 'pdf-success' or honestly falls back → 'pdf-fallback'.
  //     Cancel = no nav.
  //   • photo (screenshot / camera-roll image): pickStatementImage saves the image on-device only.
  //     Extracted TEXT (`picked`) → parseSheet → staged → 'image-success'. A real photo comes back
  //     `saved` (no text extracted) — its `uri` + `mediaType` go to the LLM reader → staged →
  //     'image-success', or honest 'image-fallback'. `denied` / `cancelled` = no nav.
  // The pick never throws (the adapters swallow + report). Nothing is counted here — review-before-truth.
  async function runPick(option: IntakeOption) {
    if (option.pick === 'document') {
      const result = await pickLocalStatementDocument();
      if (result.kind === 'cancelled') return;
      const src = result.source;
      // ROUTE BY FILE TYPE, not by whether text was extracted. Only a genuinely DELIMITED statement
      // (CSV / TSV / TXT) goes to the offline column parser. A PDF — even one whose embedded text
      // layer the picker read — is unstructured prose, NOT CSV columns, so parseSheet always fails on
      // it; the LLM vision reader is the right tool and handles arbitrary statement layouts.
      const looksDelimited =
        /text\/csv|application\/csv|tab-separated|text\/plain/i.test(src.mediaType) ||
        /\.(csv|tsv|txt)$/i.test(src.filename);
      if (result.kind === 'picked' && looksDelimited) {
        const candidates = readTextCandidates(result.text);
        if (candidates !== null) {
          setReaderCandidates(candidates);
          nav.go('pdf-success');
        } else {
          nav.go('pdf-fallback');
        }
      } else if (src.uri !== undefined) {
        await runReader(src.uri, src.mediaType, 'pdf', 'pdf-success', 'pdf-fallback');
      } else {
        nav.go('pdf-fallback');
      }
      return;
    }
    // option.pick === 'photo' — a photographed/screenshotted statement is an image. OCR-text → CSV
    // parser is wrong for a photo, so route the image itself to the LLM reader. Cancelled/denied stop.
    const result = await pickStatementImage();
    if ('source' in result && result.source.uri !== undefined) {
      await runReader(result.source.uri, result.source.mediaType, 'image', 'image-success', 'image-fallback');
    } else if (result.kind === 'picked' || result.kind === 'saved') {
      nav.go('image-fallback');
    }
  }

  // Dispatch a row: the two file-shaped rows open the real picker (runPick); every other row keeps the
  // straight, declarative nav.go to its screen (web parity).
  const onSelect = (option: IntakeOption) => {
    if (option.pick !== undefined) {
      void runPick(option);
      return;
    }
    nav.go(option.to);
  };

  // empty / error — the calm EmptyState doorway (n/a in practice, rendered for completeness). The
  // single CTA still routes into the picker so the doorway never dead-ends.
  if (state === 'empty' || state === 'error') {
    const headline = state === 'error' ? copy.err.generic : 'Add what you have.';
    const body =
      state === 'error' ? undefined : 'Folio shows what it finds before anything is added.';
    return (
      <EmptyState
        mood="calm"
        headline={headline}
        body={body}
        cta={{ label: 'Add a statement', onPress: () => nav.go('pdf-success') }}
      />
    );
  }

  // loading — Melo curious + a line, never a spinner (per the hard rule + STATES.md). A calm,
  // centred holding moment while the picker settles; it falls through to the picker after the cap.
  if (state === 'loading' && !loadingTimedOut) {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl },
        ]}
      >
        <MeloLine mood="curious" text="One second — getting your options ready." />
      </View>
    );
  }

  // reading — the LLM reader is reading the picked PDF / photo. A calm Melo line, NEVER a spinner
  // (the same hard rule). Driven by the real in-flight read, not a timer: it resolves the moment the
  // read lands candidates (→ success) or honestly falls back (→ fallback). Curious is the reading
  // mood (MELO_MOODS.md), matching the success screens' own "Folio is reading…" line.
  if (reading) {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl },
        ]}
      >
        <MeloLine mood="curious" text="Reading what's here…" />
      </View>
    );
  }

  // populated / offline (and loading-after-timeout) — the real picker. offline ≡ populated
  // (local-first; nothing on this screen needs the network).
  return (
    <Animated.View
      style={[
        styles.screen,
        enterStyle,
        { backgroundColor: t.canvas },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xl },
        ]}
      >
        {/* Header — back glyph · "Add" eyebrow · a 20px spacer that balances the glyph so the
            eyebrow stays optically centred (web <span class="w-5" />). */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={16}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.back, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Add</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Title block — the one question, with the single accent word ("what") upright + terracotta.
            Headline is VERBATIM from copy.add.title; subhead is a @copy FROZEN inline literal. */}
        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {lead}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>{accent}</Text>
            {tail}
          </Text>
          <Text style={[styles.subhead, { color: t.muted }]}>
            Folio shows what it finds before anything is added.
          </Text>
        </View>

        {/* Options list — the five dispatch rows (web space-y-2.5 = gap.md between rows). */}
        <View style={styles.options}>
          {OPTIONS.map((option) => (
            <OptionRow key={option.title} option={option} onPress={() => onSelect(option)} />
          ))}
        </View>

        {/* Melo reassurance — the only Melo on this screen, calm mood (the resting state, not the
            curious reading state). The quote is a @copy FROZEN inline literal; MeloLine adds the
            straight quotes, so we pass the raw text. */}
        <View style={[styles.meloBox, { backgroundColor: t.inset }]}>
          <MeloLine mood="calm" text="Use what you have. Nothing is added until you say so." />
        </View>

        {/* Spacer pins the footer to the bottom on tall screens, mirroring the web flex-1 spacer. */}
        <View style={styles.spacer} />

        {/* Footer reassurance — @copy FROZEN inline literal. */}
        <Text style={[styles.footer, { color: t.muted }]}>
          Nothing is shared unless you choose to export it.
        </Text>
      </ScrollView>
    </Animated.View>
  );
}

// One dispatch row — an --inset icon tile, the title (with the optional "fastest" badge) over a
// muted hint, and a right-pinned forward glyph. The whole row is the Pressable; its accessibility
// label is the title + hint so the decorative glyph is never load-bearing for a screen reader.
function OptionRow({ option, onPress }: { option: IntakeOption; onPress: () => void }) {
  const t = useTheme();
  const accessibilityLabel = `${option.title}. ${option.hint}${option.fastest ? '. Fastest' : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.row,
        { backgroundColor: t.surface, borderColor: t.hairline },
        isPressed ? styles.pressed : undefined,
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: t.inset }]}>
        <Text style={[styles.icon, { color: t.ink }]}>{option.icon}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.titleRow}>
          <Text style={[styles.rowTitle, { color: t.ink }]}>{option.title}</Text>
          {option.fastest ? (
            <View style={[styles.badge, { backgroundColor: t.calmSoft }]}>
              <Text style={[styles.badgeLabel, { color: t.calm }]}>fastest</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.rowHint, { color: t.muted }]}>{option.hint}</Text>
      </View>
      <Text style={[styles.forward, { color: t.muted }]}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // px-7 ≈ screen inset (gap.xl = 24). The screen colour is the warm canvas.
  screen: {
    flex: 1,
  },
  loading: {
    flex: 1,
    paddingHorizontal: gap.xl,
  },
  // flexGrow:1 lets the flex-1 spacer pin the footer to the bottom on tall screens while the list
  // still scrolls on short ones (web overflow-y-auto + flex-1 spacer).
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: gap.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // The back glyph — 20px muted (web text-[20px] text-muted-ink press).
  back: {
    fontSize: 20,
  },
  // "Add" eyebrow — 12px, uppercase, tracked (web tracking-[0.14em]; RN letterSpacing is absolute
  // px, so 12 * 0.14 ≈ 1.68).
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.68,
    textTransform: 'uppercase',
  },
  // 20px spacer to balance the 20px back glyph (web <span class="w-5" />).
  headerSpacer: {
    width: 20,
  },
  // mt-6 (24px) = gap.xl.
  titleBlock: {
    marginTop: gap.xl,
  },
  // Fraunces display headline, 28px, tight line-height (web font-display text-[28px] leading-tight).
  headline: {
    fontFamily: serif.display,
    fontSize: 28,
    lineHeight: 32,
  },
  // The accent word stays UPRIGHT (web em.not-italic) — same display face, normal style.
  headlineAccent: {
    fontFamily: serif.display,
    fontStyle: 'normal',
  },
  // mt-3 (12px) = gap.md; 13.5px relaxed, muted (web text-[13.5px] mt-3 leading-relaxed).
  subhead: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: gap.md,
  },
  // mt-6 (24px) = gap.xl; space-y-2.5 (10px) = gap.md row gap (web rounds 2.5 → 10px).
  options: {
    gap: gap.md,
    marginTop: gap.xl,
  },
  // bg-surface · hairline border · rounded-xl (radius.md = 12) · px-4 py-4 (16) · row · gap-4 (16).
  row: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    columnGap: gap.lg,
    flexDirection: 'row',
    paddingHorizontal: gap.lg,
    paddingVertical: gap.lg,
  },
  // w-11 h-11 (44px) · rounded-lg (radius.sm = 8) · centred · --inset bg.
  iconTile: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  // Unicode glyph at 20px (web text-[20px]).
  icon: {
    fontSize: 20,
  },
  rowBody: {
    flex: 1,
  },
  titleRow: {
    alignItems: 'center',
    columnGap: gap.sm,
    flexDirection: 'row',
  },
  // 14.5px medium (web text-[14.5px] font-medium).
  rowTitle: {
    fontSize: 14.5,
    fontWeight: '500',
  },
  // The "fastest" pill — accent-soft fill, rounded-full, px-1.5 py-0.5 (web).
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  // 9px, uppercase, tracked, accent, medium (web text-[9px] uppercase tracking-wider).
  badgeLabel: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // mt-0.5 (2px) · 12px muted (web text-[12px] mt-0.5).
  rowHint: {
    fontSize: 12,
    marginTop: 2,
  },
  // The right-pinned forward glyph — muted (web text-muted-ink "→").
  forward: {
    fontSize: 16,
  },
  // mt-6 (24px) = gap.xl; --inset bg, rounded-xl (radius.md = 12), p-4 (gap.lg = 16).
  meloBox: {
    borderRadius: radius.md,
    marginTop: gap.xl,
    padding: gap.lg,
  },
  spacer: {
    flex: 1,
  },
  // text-center · 11px muted · mt-6 mb-6 (web). The bottom margin is folded into the scroll content
  // bottom padding so it never collides with the safe-area inset.
  footer: {
    fontSize: 11,
    marginTop: gap.xl,
    textAlign: 'center',
  },
  // The kit press feel applied to tappables (web `press` util — scale 0.97 / lowered opacity).
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
