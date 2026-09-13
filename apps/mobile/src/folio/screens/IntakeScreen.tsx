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
// @motion       slide-in-r (whole screen) · press 0.97/120ms (back + every option row) · calm
//               native reading indicator while a local source is being processed
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

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MeloAlert as Alert } from '@/folio/ui/meloAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
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
import { showStatusDialog } from '@/folio/ui/statusDialogs';
import type { CandidateMoneyItem } from '@/folio/lib/importSheet';
import { statementReviewSourceKey } from '@/folio/lib/statementReviewModel';
import { isOnboardingFirstRun } from '@/folio/lib/onboardingMutations';
import {
  addEvidenceDocument,
  getState,
  setReaderCandidates,
  setReaderClosingBalance,
  useAppStore,
  useStatementReviewSessions,
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
import { showToast } from '@/folio/ui/Toast';

import { pickLocalStatementDocument } from '../../local/nativeDocumentImport';
import { captureStatementPhoto, pickStatementImage } from '../../local/nativeImageIntake';
import { parseLocalDocumentCandidates } from '../../local/localDocumentCandidates';
import { readTextImport } from '../../local/textImportCandidates';
import type { ExtractedText } from '../../local/nativeTextExtraction';
import {
  beginPdfImportTransaction,
  createInitialPdfImportTransaction,
  settlePdfImportTransaction,
  type PdfImportAttempt,
  type PdfImportObservation,
  type PdfImportTransactionState,
} from '../../local/pdfImportTransaction';
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
  fastest?: boolean;
  /** A real doorway whose provider is unavailable in this build. It remains navigable so the
   * connections surface can explain the boundary instead of silently swallowing the tap. */
  unavailable?: boolean;
  badge?: string;
  /** When set, the row opens this sheet instead of navigating to `to`. Used by "Add numbers
   *  yourself", which opens the manual log-spend entry rather than the candidate-review screen. */
  sheet?: SheetId;
};

// @copy FROZEN — byte-for-byte from the web ScreenIntake `options` array. The titles / hints / icons
// / `fastest` badge are unchanged. Two text-shaped options (Paste transactions + CSV or TXT file)
// both route to 'paste-success', preserved from the source. The two file-shaped options carry a
// `pick` tag so the row opens the real document / photo picker before routing (see runPick below).
export const INTAKE_OPTIONS: readonly IntakeOption[] = [
  {
    title: 'Statement or sheet',
    hint: 'PDF, CSV or TXT from your bank',
    icon: '▤',
    to: 'pdf-success',
    pick: 'document',
    badge: 'MOST COMPLETE',
  },
  {
    title: 'Log a spend',
    hint: 'add one spend yourself',
    icon: '✎',
    to: 'review',
    sheet: 'log-spend',
  },
  {
    title: 'Photo or screenshot',
    hint: 'a receipt, transaction list or paper statement',
    icon: '▢',
    to: 'image-success',
    pick: 'photo',
  },
  {
    title: 'Paste transactions',
    hint: 'copy from a spreadsheet or anywhere else',
    icon: '❝',
    to: 'paste-success',
  },

  {
    title: 'Connect an account',
    hint: 'a read-only feed from your bank — not available in this build',
    icon: '↗',
    to: 'connections',
    unavailable: true,
    badge: 'NOT YET',
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
function readTextCandidates(
  text: string,
  source: Extract<CandidateMoneyItem['source'], 'csv' | 'paste'>,
  filename: string,
  sourceFormat: 'csv' | 'tsv' | 'txt' = 'csv',
): CandidateMoneyItem[] | null {
  const result = readTextImport(text, source, filename);
  return result.candidates.length > 0
    ? result.candidates.map((candidate) => ({ ...candidate, sourceFormat }))
    : null;
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
  const waiting = useAppStore((current) => current.reviewQueue ?? []);
  const statementSessions = useStatementReviewSessions();
  const waitingStatementSessions = useMemo(
    () => statementSessions.filter((session) => session.candidates.length > 0 || session.receipt !== undefined),
    [statementSessions],
  );
  const waitingRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const waitingAnnouncedRef = useRef(false);
  const needsInitialSetup = useAppStore(isOnboardingFirstRun);
  const bySource = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of waiting) counts[item.source] = (counts[item.source] ?? 0) + 1;
    return counts;
  }, [waiting]);

  useEffect(() => {
    if (waitingAnnouncedRef.current || (waiting.length === 0 && waitingStatementSessions.length === 0)) return;
    waitingAnnouncedRef.current = true;
    AccessibilityInfo.announceForAccessibility(
      "An earlier statement is still waiting for you. Open what's waiting, button.",
    );
  }, [waiting.length, waitingStatementSessions.length]);

  function openStatementReview(session: (typeof waitingStatementSessions)[number]) {
    const source = session.candidates[0]?.source ?? session.sourceKey?.split(':')[0] ?? 'pdf';
    const screen: ScreenId = source === 'paste' || source === 'csv' || source === 'txt' ? 'paste-success' : source === 'photo' ? 'image-success' : 'pdf-success';
    const sourceKey = session.sourceKey ?? statementReviewSourceKey(session.candidates);
    const label = session.sourceLabel ?? waitingSourceLabel(source);
    AccessibilityInfo.announceForAccessibility(
      `${label}. ${session.candidates.length} suggested. ${session.receipt === undefined ? 'Not added yet.' : 'Result not seen yet.'}`,
    );
    nav.go(screen, { reviewSourceKey: sourceKey });
  }

  // The picker, evidence vault and on-device parser are asynchronous, but the reader staging slot
  // is singular. Keep one transaction authority for this intake session so a double tap or a late
  // parser result cannot replace a successful read with an empty/fallback result.
  const pdfImportTransaction = useRef<PdfImportTransactionState>(
    createInitialPdfImportTransaction(),
  );

  function beginPdfImport(): PdfImportAttempt | null {
    const begun = beginPdfImportTransaction(pdfImportTransaction.current);
    pdfImportTransaction.current = begun.state;
    return begun.attempt;
  }

  function settlePdfImport(attempt: PdfImportAttempt, observation: PdfImportObservation): boolean {
    const settled = settlePdfImportTransaction(pdfImportTransaction.current, attempt, observation);
    pdfImportTransaction.current = settled.state;
    return settled.settlement.accepted;
  }

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
  const [readerPhase, setReaderPhase] = useState<'idle' | 'statement' | 'photo'>('idle');
  const [readerName, setReaderName] = useState<string>('');
  const activeReaderAttempt = useRef<PdfImportAttempt | null>(null);
  useEffect(() => {
    if (state !== 'loading') return;
    const id = setTimeout(() => setLoadingTimedOut(true), LOADING_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [state]);

  function stageLocalOcrRead(
    text: string,
    source: 'pdf' | 'photo',
    filename: string,
    successScreen: ScreenId,
    sourceEvidenceId: string,
    attempt: PdfImportAttempt,
    extraction?: ExtractedText,
  ): boolean {
    const local = parseLocalDocumentCandidates({
      text,
      source,
      filename,
      ...(extraction === undefined ? {} : { extraction }),
    });
    if (local.candidates.length === 0) return false;
    // Publish the terminal classification before touching the shared staging slot. If a parser
    // callback arrives after another result has already won, this returns false and nothing from
    // the stale callback can overwrite the winning read.
    if (!settlePdfImport(attempt, { kind: 'parsed', reviewItemCount: local.candidates.length })) {
      return true;
    }
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
    isActive: () => boolean,
  ): Promise<string | null> {
    if (!isActive()) return null;
    const current = getState();
    const workspace = current.workspaces.find(
      (candidate) => candidate.id === current.activeWorkspaceId,
    );
    if (workspace === undefined) return null;
    let retained: Awaited<ReturnType<typeof retainEvidenceDocument>> | undefined;
    try {
      retained = await retainEvidenceDocument({
        workspace,
        source,
        sourceType,
        extractionStatus,
      });
      if (!isActive()) {
        await deleteEvidenceDocumentFile(workspace, retained).catch(() => undefined);
        return null;
      }
      addEvidenceDocument(retained);
      return retained.id;
    } catch (reason: unknown) {
      if (retained !== undefined) {
        await deleteEvidenceDocumentFile(workspace, retained).catch(() => undefined);
      }
      const failure = evidenceRetentionFailureCopy(reason);
      showStatusDialog('dialog.intake-reader-failed', {
        title: failure.title,
        message: failure.body,
      });
      return null;
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
    const attempt = beginPdfImport();
    if (attempt === null) return;
    activeReaderAttempt.current = attempt;

    if (option.pick === 'document') {
      let result: Awaited<ReturnType<typeof pickLocalStatementDocument>>;
      try {
        result = await pickLocalStatementDocument();
      } catch {
        if (settlePdfImport(attempt, { kind: 'failed-recoverably' })) {
          showToast(
            'Could not read that file',
            'You can try another statement or add one number yourself.',
          );
        }
        return;
      }
      if (result.kind === 'cancelled') {
        settlePdfImport(attempt, { kind: 'cancelled' });
        activeReaderAttempt.current = null;
        return;
      }
      const src = result.source;
      setReaderPhase('statement');
      setReaderName(src.filename);
      const sourceEvidenceId = await retainSource(
        src,
        'document',
        result.kind === 'picked' ? 'read' : 'unreadable',
        () =>
          activeReaderAttempt.current?.attemptId === attempt.attemptId &&
          pdfImportTransaction.current.phase === 'reading',
      );
      if (sourceEvidenceId === null) {
        settlePdfImport(attempt, { kind: 'failed-recoverably' });
        setReaderPhase('idle');
        return;
      }
      if (
        activeReaderAttempt.current?.attemptId !== attempt.attemptId ||
        pdfImportTransaction.current.phase !== 'reading'
      )
        return;
      const isPdf = /application\/pdf/i.test(src.mediaType) || /\.pdf$/i.test(src.filename);
      if (result.kind === 'unsupported') {
        if (
          settlePdfImport(attempt, { kind: isPdf ? 'unreadable/manual-fallback' : 'unsupported' })
        ) {
          finishLocalReaderFallback('pdf-fallback', sourceEvidenceId);
        }
        return;
      }
      const looksDelimited =
        /text\/csv|application\/csv|tab-separated|text\/plain/i.test(src.mediaType) ||
        /\.(csv|tsv|txt)$/i.test(src.filename);
      if (result.kind === 'picked' && looksDelimited) {
        const sourceFormat: 'csv' | 'tsv' | 'txt' = /\.tsv$/i.test(src.filename)
          ? 'tsv'
          : /\.txt$/i.test(src.filename)
            ? 'txt'
            : 'csv';
        const candidates = readTextCandidates(result.text, 'csv', src.filename, sourceFormat);
        if (candidates !== null) {
          if (!settlePdfImport(attempt, { kind: 'parsed', reviewItemCount: candidates.length }))
            return;
          setReaderCandidates(candidates.map((candidate) => ({ ...candidate, sourceEvidenceId })));
          // A delimited (CSV/TSV/TXT) statement never carries a closing balance — the offline
          // column parser has no such concept — so explicitly clear any balance staged by a
          // prior reader read rather than letting it leak into this landing.
          setReaderClosingBalance(null);
          setReaderFallbackEvidenceId(undefined);
          // CSV/TXT is the text doorway. Keep the PDF statement preview reserved for a PDF read so
          // the next screen can explain the right kind of evidence and preserve the source label.
          nav.go(option.to);
        } else {
          if (settlePdfImport(attempt, { kind: 'failed-recoverably' })) {
            finishLocalReaderFallback('pdf-fallback', sourceEvidenceId);
          }
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
          attempt,
          result.extraction,
        )
      ) {
        return;
      }
      if (settlePdfImport(attempt, { kind: 'unreadable/manual-fallback' })) {
        finishLocalReaderFallback('pdf-fallback', sourceEvidenceId);
      }
      return;
    }

    let imageSource: 'camera' | 'library' | null;
    try {
      imageSource = await chooseImageSource();
    } catch {
      settlePdfImport(attempt, { kind: 'failed-recoverably' });
      return;
    }
    if (imageSource === null) {
      settlePdfImport(attempt, { kind: 'cancelled' });
      activeReaderAttempt.current = null;
      return;
    }
    const result =
      imageSource === 'camera' ? await captureStatementPhoto() : await pickStatementImage();
    if (result.kind === 'cancelled') {
      settlePdfImport(attempt, { kind: 'cancelled' });
      activeReaderAttempt.current = null;
      return;
    }
    if (result.kind === 'denied') {
      if (settlePdfImport(attempt, { kind: 'failed-recoverably' })) {
        showToast('Permission is off', result.message);
      }
      setReaderPhase('idle');
      return;
    }
    setReaderPhase('photo');
    setReaderName(result.source.filename || 'Selected photo');
    const sourceEvidenceId = await retainSource(
      result.source,
      imageSource === 'camera' ? 'camera' : 'image',
      result.kind === 'picked' ? 'read' : 'unreadable',
      () =>
        activeReaderAttempt.current?.attemptId === attempt.attemptId &&
        pdfImportTransaction.current.phase === 'reading',
    );
    if (sourceEvidenceId === null) {
      settlePdfImport(attempt, { kind: 'failed-recoverably' });
      setReaderPhase('idle');
      return;
    }
    if (
      activeReaderAttempt.current?.attemptId !== attempt.attemptId ||
      pdfImportTransaction.current.phase !== 'reading'
    )
      return;
    if (
      result.kind === 'picked' &&
      stageLocalOcrRead(
        result.text,
        'photo',
        result.source.filename,
        'image-success',
        sourceEvidenceId,
        attempt,
        result.extraction,
      )
    ) {
      return;
    }
    if (settlePdfImport(attempt, { kind: 'unreadable/manual-fallback' })) {
      finishLocalReaderFallback('image-fallback', sourceEvidenceId);
    }
  }

  if (readerPhase !== 'idle') {
    const isPhoto = readerPhase === 'photo';
    return (
      <View style={[styles.readerProgress, { backgroundColor: t.canvas, paddingTop: insets.top }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>{isPhoto ? 'PHOTO' : 'STATEMENT'}</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.progressHeadline, { color: t.ink }]}>
          {isPhoto ? 'Reading your photo.' : 'Reading your statement.'}
        </Text>
        <View style={[styles.progressEvidence, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          <Text style={[styles.progressName, { color: t.ink }]}>{readerName}</Text>
          <Text style={[styles.progressBody, { color: t.muted }]}>Melo is looking for dates, names and amounts.</Text>
        </View>
        <View accessibilityLiveRegion="polite" style={styles.progressIndicator}>
          <ActivityIndicator
            color={t.calm}
            accessibilityLabel={isPhoto ? 'Reading your photo' : 'Reading your statement'}
          />
          <Text style={[styles.progressBody, { color: t.muted }]}>
            {isPhoto ? 'Melo is reading your photo.' : 'Melo is reading your statement.'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel reading"
          onPress={() => {
            const active = activeReaderAttempt.current;
            if (active !== null) settlePdfImport(active, { kind: 'cancelled' });
            activeReaderAttempt.current = null;
            setReaderPhase('idle');
          }}
          style={({ pressed }) => [styles.cancelReading, { borderColor: t.hairline }, pressed ? styles.pressed : undefined]}
        >
          <Text style={[styles.cancelReadingLabel, { color: t.muted }]}>Cancel reading</Text>
        </Pressable>
      </View>
    );
  }

  // Dispatch a row: the two file-shaped rows open the real picker (runPick); every other row keeps the
  // straight, declarative nav.go to its screen (web parity).
  const onSelect = (option: IntakeOption) => {
    if (option.title === 'Paste transactions') {
      // Entering the editor is intentionally side-effect free. Clipboard access belongs to the
      // explicit action on PasteSuccessScreen, never to this navigation event.
      nav.go('paste-success');
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
      nav.openSheet(
        option.sheet === 'log-spend' && !isBusiness && needsInitialSetup
          ? 'onboarding'
          : option.sheet,
      );
      return;
    }
    if (option.unavailable) return;
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
        cta={{ label: 'Add a statement', onPress: () => void runPick(INTAKE_OPTIONS[0]!) }}
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
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xl },
        ]}
      >
        {/* Header — back glyph · canonical "Plan · Your money" eyebrow · a 20px spacer that balances the glyph so the
            eyebrow stays optically centred (web <span class="w-5" />). */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={16}
            onPress={nav.back}
            style={({ pressed: isPressed }) => [styles.backTarget, isPressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.back, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>
            {isBusiness ? 'Business records' : 'Plan · Your money'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Title block — the one question, with the single accent word upright + terracotta.
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
                {'Let Melo '}
                <Text style={[styles.headlineAccent, { color: t.calm }]}>understand</Text>
                {' your money.'}
              </>
            )}
          </Text>
          <Text style={[styles.subhead, { color: t.muted }]}>
            {isBusiness
              ? 'Read a statement or receipt here. Nothing reaches Business activity until you confirm it.'
              : 'Melo shows you what it finds, then waits for your decision. Nothing is added until you say so.'}
          </Text>
        </View>

        {/* Options list — the canonical acquisition hierarchy, including the truthful account
            connection doorway. */}
        <View style={styles.options}>
          <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Every way in</Text>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>How do you want to add it?</Text>
          <View style={styles.optionRows}>
            {INTAKE_OPTIONS.map((option) => (
              <OptionRow key={option.title} option={option} onPress={() => onSelect(option)} />
            ))}
          </View>
          <Text style={[styles.explainer, { color: t.muted }]}>
            Reading starts only after you choose a file, photo, or Paste from clipboard. Melo does
            not keep checking your clipboard. Nothing is added until you review and confirm it.
          </Text>
        </View>

        {waitingStatementSessions.length > 0 ? (
          <View style={[styles.waitingNotice, { backgroundColor: t.calmSoft, borderColor: t.hairline }]}>
            <Text accessibilityLiveRegion="polite" style={[styles.waitingNoticeBody, { color: t.ink }]}>An earlier statement is still waiting for you.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open what's waiting"
              onPress={() => {
                scrollRef.current?.scrollToEnd({ animated: true });
                const node = findNodeHandle(waitingRef.current);
                if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
              }}
              style={[styles.waitingNoticeAction, { backgroundColor: t.calm }]}
            >
              <Text style={[styles.waitingLabel, { color: t.inverse }]}>Open what's waiting</Text>
            </Pressable>
          </View>
        ) : null}

        <View ref={waitingRef} style={styles.waitingSection}>
          <Text style={[styles.sectionEyebrow, { color: t.muted }]}>Waiting</Text>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Things to check</Text>
          {waiting.length > 0 || waitingStatementSessions.length > 0 ? (
            <View
              style={[styles.waitingList, { backgroundColor: t.surface, borderColor: t.hairline }]}
            >
              {waitingStatementSessions.map((session, index) => {
                const source = session.candidates[0]?.source ?? session.sourceKey?.split(':')[0] ?? 'pdf';
                const count = session.candidates.length;
                const label = session.sourceLabel ?? waitingSourceLabel(source);
                return (
                  <View key={`statement:${session.workspaceId ?? ''}:${session.sourceKey ?? index}`}>
                    {index > 0 ? <View style={[styles.divider, { backgroundColor: t.hairline }]} /> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${label}. ${count} suggested. ${session.receipt === undefined ? 'Not added yet.' : 'Result not seen yet.'}`}
                      onPress={() => openStatementReview(session)}
                      style={({ pressed: isPressed }) => [styles.waitingRow, isPressed ? styles.pressed : undefined]}
                    >
                      <View style={styles.waitingCopy}>
                        <Text style={[styles.waitingLabel, { color: t.ink }]}>{label}</Text>
                        <Text style={[styles.waitingMeta, { color: t.muted }]}>
                          {session.receipt === undefined ? 'not added yet' : 'result not seen yet'}
                        </Text>
                      </View>
                      <Text style={[styles.waitingCount, { color: t.calm }]}>{count}</Text>
                    </Pressable>
                  </View>
                );
              })}
              {Object.entries(bySource).map(([source, count], index) => (
                <View key={source}>
                  {index + waitingStatementSessions.length > 0 ? (
                    <View style={[styles.divider, { backgroundColor: t.hairline }]} />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${waitingSourceLabel(source)}. ${count} suggested. Not added.`}
                    onPress={() => nav.go('review')}
                    style={({ pressed: isPressed }) => [
                      styles.waitingRow,
                      isPressed ? styles.pressed : undefined,
                    ]}
                  >
                    <View style={styles.waitingCopy}>
                      <Text style={[styles.waitingLabel, { color: t.ink }]}>
                        {waitingSourceLabel(source)}
                      </Text>
                      <Text style={[styles.waitingMeta, { color: t.muted }]}>
                        suggested · not added
                      </Text>
                    </View>
                    <Text style={[styles.waitingCount, { color: t.calm }]}>{count}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View
              style={[styles.waitingEmpty, { backgroundColor: t.inset, borderColor: t.hairline }]}
            >
              <Text style={[styles.waitingEmptyTitle, { color: t.ink }]}>Nothing waiting</Text>
              <Text style={[styles.waitingEmptyBody, { color: t.muted }]}>
                Anything you add stays here until you keep, correct or ignore it.
              </Text>
            </View>
          )}
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
        <Text style={[styles.footer, { color: t.muted }]}>
          {isBusiness
            ? 'PDF and photo files are read on this device. Found items stay unconfirmed until Business Review.'
            : 'PDF and photo files are read on this device. Nothing is added until you confirm it.'}
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
  const accessibilityLabel = `${option.title}. ${option.hint}${option.fastest ? '. Fastest' : ''}${option.unavailable ? '. Not yet available' : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: option.unavailable === true }}
      disabled={option.unavailable === true}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.row,
        { backgroundColor: t.surface, borderColor: t.hairline },
        option.unavailable ? styles.unavailable : undefined,
        isPressed ? styles.pressed : undefined,
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: t.inset }]}>
        {option.icon === '▢' ? (
          <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
            <Path
              d="M3 6h4l2-3h6l2 3h4v15H3z"
              fill="none"
              stroke={t.ink}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
            <Circle cx={12} cy={13} r={4} fill="none" stroke={t.ink} strokeWidth={1.6} />
          </Svg>
        ) : (
          <Text style={[styles.icon, { color: t.ink }]}>{option.icon}</Text>
        )}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.titleRow}>
          <Text style={[styles.rowTitle, { color: t.ink }]}>{option.title}</Text>
          {option.badge !== undefined ? (
            <View
              style={[styles.badge, { backgroundColor: option.unavailable ? t.inset : t.calmSoft }]}
            >
              <Text style={[styles.badgeLabel, { color: option.unavailable ? t.muted : t.calm }]}>
                {option.badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.rowHint, { color: t.muted }]}>{option.hint}</Text>
      </View>
      {option.unavailable ? null : <Text style={[styles.forward, { color: t.muted }]}>→</Text>}
    </Pressable>
  );
}

function waitingSourceLabel(source: string): string {
  if (source === 'csv' || source === 'txt' || source === 'paste') return 'Sheet or pasted text';
  if (source === 'pdf') return 'Statement';
  if (source === 'image' || source === 'photo') return 'Photo';
  if (source === 'bank') return 'Connected account';
  return 'Manual entry';
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
    minHeight: 56,
  },
  // The back glyph — 20px muted (web text-[20px] text-muted-ink press).
  backTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  readerProgress: {
    flex: 1,
    gap: gap.lg,
    paddingHorizontal: gap.xl,
    paddingBottom: gap.xl,
  },
  progressHeader: {
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  progressHeadline: {
    fontFamily: serif.display,
    fontSize: 28,
    lineHeight: 34,
    marginTop: gap.xl,
  },
  progressEvidence: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: gap.lg,
  },
  progressName: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBody: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: gap.sm,
  },
  progressIndicator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: gap.sm,
  },
  cancelReading: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 'auto',
  },
  cancelReadingLabel: {
    fontSize: 13,
  },
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
    width: 48,
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
    marginTop: gap.xxl,
  },
  sectionEyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.45,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: serif.display,
    fontSize: 20,
    lineHeight: 25,
    marginTop: gap.xs,
  },
  optionRows: {
    gap: gap.md,
    marginTop: gap.md,
  },
  explainer: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: gap.md,
  },
  waitingNotice: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: gap.sm,
    marginTop: gap.xxl,
    padding: gap.lg,
  },
  waitingNoticeBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  waitingNoticeAction: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.lg,
  },
  unavailable: {
    opacity: 0.78,
  },
  waitingSection: {
    marginTop: gap.xxl,
  },
  waitingList: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: gap.lg,
  },
  waitingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 68,
    padding: gap.lg,
  },
  waitingCopy: {
    flex: 1,
    minWidth: 0,
  },
  waitingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  waitingMeta: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: gap.xxs,
  },
  waitingCount: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: gap.md,
  },
  waitingEmpty: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.md,
    padding: gap.lg,
  },
  waitingEmptyTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  waitingEmptyBody: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: gap.xxs,
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
    minHeight: 72,
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
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    columnGap: gap.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // 14.5px medium (web text-[14.5px] font-medium).
  rowTitle: {
    fontSize: 14.5,
    fontWeight: '500',
  },
  // The "fastest" pill — accent-soft fill, rounded-full, px-1.5 py-0.5 (web).
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
