// @rn-engine statement-reader|photo-reader|text-reader — produces CandidateMoneyItem[] into Review.
// @rn-engine ocr-extraction — Android PdfRenderer + bundled ML Kit runs on-device.
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
//       — PDF / PHOTO: bundled on-device OCR runs first and its low-confidence candidates are staged
//         locally. If it produces no reliable rows, the app opens the manual fallback.
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
//     routes into the picker so it never dead-ends.
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
  Alert,
  Clipboard,
  Platform,
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
import {
  addEvidenceDocument,
  getState,
  setReaderCandidates,
  setReaderClosingBalance,
  useAppStore,
} from '@/folio/store';
import {
  setReaderFallbackEvidenceId,
  setReaderFallbackReason,
} from '@/folio/lib/readerFallbackReason';
import {
  deleteEvidenceDocumentFile,
  evidenceRetentionFailureCopy,
  retainEvidenceDocument,
} from '@/folio/lib/documentVault';
import { deleteOwnedPickerStage } from '@/folio/lib/pickerCache';
import { showToast } from '@/folio/ui/Toast';

import { pickLocalStatementDocument } from '../../local/nativeDocumentImport';
import { captureStatementPhoto, pickStatementImage } from '../../local/nativeImageIntake';
import { parseLocalDocumentCandidates } from '../../local/localDocumentCandidates';
import { parseLocalOcrCandidates } from '../../local/localOcrCandidates';
import type { ExtractedText } from '../../local/nativeTextExtraction';
import type { Nav, ScreenId, SheetId } from '@/folio/types';

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
  /** Reads copied statement text from the device clipboard and stages parsed rows. */
  paste?: boolean;
  fastest?: boolean;
  /** When set, the row opens this sheet instead of navigating to `to`. Used by "Add numbers
   *  yourself", which opens the manual log-spend entry rather than the candidate-review screen. */
  sheet?: SheetId;
};

// @copy FROZEN — byte-for-byte from the web ScreenIntake `options` array. The titles / hints / icons
// / `fastest` badge are unchanged. Two text-shaped options (Paste transactions + CSV or TXT file)
// both route to 'paste-success', preserved from the source. The two file-shaped options carry a
// `pick` tag so the row opens the real document / photo picker before routing (see runPick below).
const OPTIONS: readonly IntakeOption[] = [
  {
    title: 'PDF statement',
    hint: 'from your bank app',
    icon: '▤',
    to: 'pdf-success',
    pick: 'document',
    fastest: true,
  },
  {
    title: 'Screenshot or photo',
    hint: 'take or choose one',
    icon: '▢',
    to: 'image-success',
    pick: 'photo',
  },
  {
    title: 'Paste from clipboard',
    hint: 'copy transactions first',
    icon: '❝',
    to: 'paste-success',
    paste: true,
  },
  {
    title: 'CSV or TXT file',
    hint: 'if you have one',
    icon: '⌗',
    to: 'paste-success',
    pick: 'document',
  },
  {
    title: 'Add numbers yourself',
    hint: 'type it in',
    icon: '✎',
    to: 'review',
    sheet: 'log-spend',
  },
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

function chooseImageSource(): Promise<'camera' | 'library' | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: 'camera' | 'library' | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    Alert.alert(
      'Add a statement image',
      'Take a new photo or choose one already on this phone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => finish(null) },
        { text: 'Choose image', onPress: () => finish('library') },
        { text: 'Take photo', onPress: () => finish('camera') },
      ],
      { cancelable: true, onDismiss: () => finish(null) },
    );
  });
}

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
type TextCandidateRead =
  | Readonly<{
      kind: 'ready';
      candidates: CandidateMoneyItem[];
      unsupportedCurrencyCount: number;
    }>
  | Readonly<{ kind: 'unsupported-currency' }>
  | Readonly<{ kind: 'unreadable' }>;

function readTextCandidates(
  text: string,
  source: Extract<CandidateMoneyItem['source'], 'csv' | 'paste'>,
  filename: string,
): TextCandidateRead {
  const { candidates, issues } = parseSheet(text, { source });
  const unsupportedCurrencyCount = issues.filter(
    (issue) => issue.code === 'unsupported-currency',
  ).length;
  const hasHardIssue = issues.some(
    (issue) =>
      issue.code === 'missing-amount' ||
      issue.code === 'missing-merchant' ||
      issue.code === 'empty-input',
  );
  if (candidates.length > 0 && !hasHardIssue) {
    return { kind: 'ready', candidates, unsupportedCurrencyCount };
  }
  if (unsupportedCurrencyCount > 0) return { kind: 'unsupported-currency' };

  // Common bank clipboard/TXT exports are line-oriented rather than spreadsheets (for example
  // `25 Jun Tesco -42.00`). The shipping import engine already parses that shape for local OCR.
  // Reuse it as a review-only fallback instead of sending the user to a blank manual form.
  const unstructured = parseLocalOcrCandidates({ text, source, filename });
  if (unstructured.unsupportedCurrency !== null) return { kind: 'unsupported-currency' };
  return unstructured.candidates.length > 0
    ? { kind: 'ready', candidates: unstructured.candidates, unsupportedCurrencyCount: 0 }
    : { kind: 'unreadable' };
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
  const isBusiness = useAppStore(
    (current) =>
      current.workspaces.find((workspace) => workspace.id === current.activeWorkspaceId)?.kind ===
      'business',
  );
  const documentReadFooter =
    Platform.OS === 'android'
      ? isBusiness
        ? 'PDF and photo files are read on this Android device. Found items stay unconfirmed until Business Review.'
        : 'PDF and photo files are read on this Android device. Nothing is added until you confirm it.'
      : 'PDF and photo reading needs native proof for this platform. Paste, CSV and manual entry still work.';

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

  const { lead, accent, tail } = useMemo(() => splitAccent(copy.add.title), []);

  function stageLocalOcrRead(
    text: string,
    source: 'pdf' | 'photo',
    filename: string,
    successScreen: ScreenId,
    sourceEvidenceId: string,
    extraction?: ExtractedText,
  ): boolean {
    const local = parseLocalDocumentCandidates({
      text,
      source,
      filename,
      ...(extraction === undefined ? {} : { extraction }),
    });
    if (local.unsupportedCurrency !== null) {
      setReaderCandidates([]);
      setReaderClosingBalance(null);
      showToast(
        'GBP only for launch',
        `${local.unsupportedCurrency} was not imported. Melo will not turn foreign amounts into pounds.`,
      );
      return true;
    }
    if (local.candidates.length === 0) return false;
    setReaderCandidates(local.candidates.map((candidate) => ({ ...candidate, sourceEvidenceId })));
    setReaderClosingBalance(local.closingBalance);
    setReaderFallbackReason(undefined);
    setReaderFallbackEvidenceId(undefined);
    if (
      extraction?.truncated === true &&
      extraction.pages !== undefined &&
      extraction.totalPages !== undefined
    ) {
      showToast(
        'Read part on this device',
        `Pages 1-${extraction.pages} of ${extraction.totalPages} are ready to check. Later pages are not included.`,
      );
    } else {
      showToast(
        'Read on this device',
        `${local.candidates.length} ${local.candidates.length === 1 ? 'row is' : 'rows are'} ready to check.`,
      );
    }
    nav.go(successScreen);
    return true;
  }

  async function retainSource(
    source: Parameters<typeof retainEvidenceDocument>[0]['source'],
    sourceType: Parameters<typeof retainEvidenceDocument>[0]['sourceType'],
    extractionStatus: Parameters<typeof retainEvidenceDocument>[0]['extractionStatus'],
  ): Promise<string | null> {
    const current = getState();
    const workspace = current.workspaces.find(
      (candidate) => candidate.id === current.activeWorkspaceId,
    );
    let retained: Awaited<ReturnType<typeof retainEvidenceDocument>> | undefined;
    try {
      if (workspace === undefined) return null;
      retained = await retainEvidenceDocument({
        workspace,
        source,
        sourceType,
        extractionStatus,
      });
      addEvidenceDocument(retained);
      return retained.id;
    } catch (reason: unknown) {
      if (retained !== undefined && workspace !== undefined) {
        await deleteEvidenceDocumentFile(workspace, retained).catch(() => undefined);
      }
      const failure = evidenceRetentionFailureCopy(reason);
      Alert.alert(failure.title, failure.body);
      return null;
    } finally {
      await deleteOwnedPickerStage(source.uri).catch(() => false);
    }
  }

  function finishLocalReaderFallback(fallbackScreen: ScreenId, sourceEvidenceId: string): void {
    setReaderFallbackReason(
      'On-device reading could not find reliable rows. You can add the important numbers yourself.',
    );
    setReaderFallbackEvidenceId(sourceEvidenceId);
    nav.go(fallbackScreen);
  }

  // Pick or capture locally and use bundled on-device reading. Nothing is counted here; every
  // found row remains a Review candidate.
  async function runPick(option: IntakeOption) {
    if (option.pick === 'document') {
      const result = await pickLocalStatementDocument();
      if (result.kind === 'cancelled') return;
      const src = result.source;
      const sourceEvidenceId = await retainSource(
        src,
        'document',
        result.kind === 'picked' ? 'read' : 'unreadable',
      );
      if (sourceEvidenceId === null) return;
      const looksDelimited =
        /text\/csv|application\/csv|tab-separated|text\/plain/i.test(src.mediaType) ||
        /\.(csv|tsv|txt)$/i.test(src.filename);
      if (result.kind === 'picked' && looksDelimited) {
        const read = readTextCandidates(result.text, 'csv', src.filename);
        if (read.kind === 'ready') {
          setReaderCandidates(
            read.candidates.map((candidate) => ({ ...candidate, sourceEvidenceId })),
          );
          // A delimited (CSV/TSV/TXT) statement never carries a closing balance — the offline
          // column parser has no such concept — so explicitly clear any balance staged by a
          // prior reader read rather than letting it leak into this landing.
          setReaderClosingBalance(null);
          setReaderFallbackEvidenceId(undefined);
          if (read.unsupportedCurrencyCount > 0) {
            showToast(
              'Some entries left out',
              `${read.unsupportedCurrencyCount} non-GBP ${read.unsupportedCurrencyCount === 1 ? 'entry was' : 'entries were'} not imported.`,
            );
          }
          nav.go('pdf-success');
        } else if (read.kind === 'unsupported-currency') {
          setReaderCandidates([]);
          setReaderClosingBalance(null);
          showToast(
            'GBP only for launch',
            'Those foreign-currency entries were not imported. Melo will not turn them into pounds.',
          );
        } else {
          finishLocalReaderFallback('pdf-fallback', sourceEvidenceId);
        }
        return;
      }
      if (
        result.kind === 'picked' &&
        stageLocalOcrRead(
          result.text,
          'pdf',
          src.filename,
          'pdf-success',
          sourceEvidenceId,
          result.extraction,
        )
      ) {
        return;
      }
      if (src.uri !== undefined) {
        finishLocalReaderFallback('pdf-fallback', sourceEvidenceId);
        return;
      }
      finishLocalReaderFallback('pdf-fallback', sourceEvidenceId);
      return;
    }

    const imageSource = await chooseImageSource();
    if (imageSource === null) return;
    const result =
      imageSource === 'camera' ? await captureStatementPhoto() : await pickStatementImage();
    if (result.kind === 'cancelled') return;
    if (result.kind === 'denied') {
      showToast('Permission is off', result.message);
      return;
    }
    const sourceEvidenceId = await retainSource(
      result.source,
      imageSource === 'camera' ? 'camera' : 'image',
      result.kind === 'picked' ? 'read' : 'unreadable',
    );
    if (sourceEvidenceId === null) return;
    if (
      result.kind === 'picked' &&
      stageLocalOcrRead(
        result.text,
        'photo',
        result.source.filename,
        'image-success',
        sourceEvidenceId,
        result.extraction,
      )
    ) {
      return;
    }
    if (result.source.uri !== undefined) {
      finishLocalReaderFallback('image-fallback', sourceEvidenceId);
      return;
    }
    finishLocalReaderFallback('image-fallback', sourceEvidenceId);
  }

  // A paste row must actually read the clipboard before it claims anything was found. Parsed rows
  // are staged only; Review remains the sole route into financial reality. Empty clipboard input
  // stays on this screen with a useful instruction instead of opening a hollow success page.
  async function runClipboardPaste() {
    const text = await Clipboard.getString();
    if (text.trim().length === 0) {
      showToast(copy.add.clipboard.empty.head, copy.add.clipboard.empty.body);
      return;
    }
    const read = readTextCandidates(text, 'paste', 'pasted transactions');
    if (read.kind === 'unsupported-currency') {
      setReaderCandidates([]);
      setReaderClosingBalance(null);
      showToast(
        'GBP only for launch',
        'Those foreign-currency entries were not imported. Melo will not turn them into pounds.',
      );
      return;
    }
    setReaderCandidates(read.kind === 'ready' ? read.candidates : []);
    setReaderClosingBalance(null);
    if (read.kind === 'ready' && read.unsupportedCurrencyCount > 0) {
      showToast(
        'Some entries left out',
        `${read.unsupportedCurrencyCount} non-GBP ${read.unsupportedCurrencyCount === 1 ? 'entry was' : 'entries were'} not imported.`,
      );
    }
    nav.go('paste-success');
  }

  // Dispatch a row: the two file-shaped rows open the real picker (runPick); every other row keeps the
  // straight, declarative nav.go to its screen (web parity).
  const onSelect = (option: IntakeOption) => {
    if (option.paste === true) {
      void runClipboardPaste();
      return;
    }
    if (option.pick !== undefined) {
      void runPick(option);
      return;
    }
    // A row can open a sheet instead of navigating — "Add numbers yourself" opens the manual
    // log-spend entry (a real typed spend → addTransaction) rather than the candidate-review screen,
    // which has no candidate to review and would only show the empty doorway.
    if (option.sheet !== undefined) {
      nav.openSheet(option.sheet);
      return;
    }
    nav.go(option.to);
  };

  // empty / error — the calm EmptyState doorway (n/a in practice, rendered for completeness). The
  // single CTA still routes into the picker so the doorway never dead-ends.
  if (state === 'empty' || state === 'error') {
    const headline =
      state === 'error'
        ? copy.err.generic
        : isBusiness
          ? 'Add business records.'
          : 'Add what you have.';
    const body =
      state === 'error'
        ? undefined
        : isBusiness
          ? 'Statements and receipts stay in this Business workspace and wait for your review.'
          : 'Melo shows what it finds before anything is added.';
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
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <MeloLine mood="curious" text="One second — getting your options ready." />
      </View>
    );
  }

  // populated / offline (and loading-after-timeout) — the real picker. offline ≡ populated
  // (local-first; nothing on this screen needs the network).
  return (
    <Animated.View style={[styles.screen, enterStyle, { backgroundColor: t.canvas }]}>
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
          <Text style={[styles.eyebrow, { color: t.muted }]}>
            {isBusiness ? 'Business records' : 'Add'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Title block — the one question, with the single accent word ("what") upright + terracotta.
            Headline is VERBATIM from copy.add.title; subhead is a @copy FROZEN inline literal. */}
        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {isBusiness ? (
              <>
                {'Add business '}
                <Text style={[styles.headlineAccent, { color: t.calm }]}>records</Text>
                {'.'}
              </>
            ) : (
              <>
                {lead}
                <Text style={[styles.headlineAccent, { color: t.calm }]}>{accent}</Text>
                {tail}
              </>
            )}
          </Text>
          <Text style={[styles.subhead, { color: t.muted }]}>
            {isBusiness
              ? 'Read a statement or receipt here. Nothing reaches Business activity until you confirm it.'
              : 'Melo shows what it finds before anything is added.'}
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
          <MeloLine
            mood="calm"
            text={
              isBusiness
                ? 'This read stays inside the active Business workspace and waits for your decision.'
                : 'Use what you have. Nothing is added until you say so.'
            }
          />
        </View>

        {/* Spacer pins the footer to the bottom on tall screens, mirroring the web flex-1 spacer. */}
        <View style={styles.spacer} />

        {/* Footer reassurance — @copy FROZEN inline literal. */}
        <Text style={[styles.footer, { color: t.muted }]}>{documentReadFooter}</Text>
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
              <Text style={[styles.badgeLabel, { color: t.calmStrong }]}>fastest</Text>
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
  allowanceLine: {
    fontSize: 11,
    marginTop: gap.sm,
    textAlign: 'center',
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
