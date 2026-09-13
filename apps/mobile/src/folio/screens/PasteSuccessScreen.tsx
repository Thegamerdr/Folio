// PasteSuccessScreen — the faithful 1:1 React Native port of the web pasted-text confirmation gate
// (folio-melo/.claude/worktrees/design-main/src/components/folio/screens/ScreenPasteSuccess.tsx).
//
// @rn-screen    PasteSuccessScreen
// @rn-stack     Intake > Things to check
// @purpose      Show what Folio found in pasted text (or an uploaded CSV/TXT) before the user
//               accepts. A calm preview gate: a hairline-divided list of money-in / money-out items
//               + one Melo line, then a primary path to check them and a quiet "leave for later".
//               Nothing is committed here — the user only chooses to proceed.
// @reads        — (the found list derives from the `pasteText` prop via the pure parseSheet engine).
// @writes       enqueueReviewItems (primary CTA only — what the card showed moves into the PERSISTED
//               review queue with source "csv", then routes to Review; web ScreenPasteSuccess `send`
//               parity. Still no money-path mutation: an Accept in the downstream Review step is
//               what calls store.addTransaction — never here.)
// @opens-sheet  none (candidate correction is owned by Review detail; this screen stages the source.)
// @copy         FROZEN
// @tokens       surface · hairline · positive · calm (accent) · muted · ink · inverse — all from the
//               kit via '@/folio/theme'. No new token.
// @motion       slide-in-r (whole screen) · press 0.97 (kit `pressed`) · Melo breathe + blink
//               (from MeloLine, calm mood — the only continuous motion on this quiet screen).
//
// @rn-engine text-reader — WIRED. The found list is now the real pure `parseSheet` engine
//   (apps/mobile/src/folio/lib/importSheet.ts, ENGINES.md §6) output, not a hand-built array.
// `readTextImport` is the production adapter for the existing parser; parse-only normalization never
// rewrites the visible draft. Only user-pasted text or the real reader staging slot supplies candidates. An empty input
//   remains empty; examples belong in test fixtures. Review still precedes every ledger write.
//
// FIDELITY DECISIONS (each grounded in the spec + the confirmed kit/source):
//   • Accent word "check." is rendered UPRIGHT terracotta inside the Fraunces headline (web
//     <em class="not-italic text-[accent]">). Sourced from the keyed copy.add.success.paste
//     ('Things to **check.**') and split on the **accent** marker so exactly one accent word renders.
//   • Money tone IS sign-derived here (faithful to the web): money-in reads green/positive, money-out
//     reads INK. The dot beside an "in" row is green, an "out" row is terracotta. The sign is carried
//     by the +/− glyph; the amounts are rendered as the web's exact preformatted strings (+£1,200 /
//     −£42 / −£750) with the U+2212 minus, byte-for-byte.
//   • Tailwind divide-y has no RN analog — a manual per-row top hairline; the first row carries none
//     so it never doubles with the card's outer hairline (matches VisualizerScreen).
//   • The web's literal '←' glyph is drawn as a small inline react-native-svg icon (the codebase ships
//     no icon font), matching PdfSuccessScreen's BackArrow.
//   • slide-in-r: translateX 28→0 + fade over 360ms ease-out-expo, gated to FINAL STATE under
//     reduce-motion (resolved layout, never a slower animation), mirroring Melo + StartScreen.
//   • Press feedback is the kit `pressed` feel (scale 0.97 / lowered opacity) via Pressable.
//   • Push-to-bottom: a ScrollView whose contentContainer is flexGrow:1 with a flex:1 spacer pins
//     the CTAs to the bottom; bottom safe-area replaces the web's trailing margin.
//
// STATES (per STATES.md): this file IS the populated/success branch for the text/file reader. All
// five branches render for completeness: populated/offline = the preview (offline ≡ populated, local-
// first); loading = Melo curious + a line, NEVER a spinner; empty/error = the calm EmptyState doorway.
//
// Tokens only — no new colour, font, spacing, radius, or shadow. Tap targets are >=44px or carry
// hitSlop. Copy is VERBATIM: the headline uses the keyed add.success.paste; the eyebrow / subhead /
// row meta / Melo line / CTAs are @copy FROZEN inline literals (the web keeps them inline).

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  ActivityIndicator,
  BackHandler,
  Clipboard,
  findNodeHandle,
  Keyboard,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
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
import { showToast } from '@/folio/ui/Toast';
import { type CandidateMoneyItem, type ColumnIssue } from '@/folio/lib/importSheet';
import { applyMemoryToCandidates } from '@/folio/lib/merchantMemory';
import { readTextImport } from '../../local/textImportCandidates';
import {
  insertClipboardAtSelection,
  resolvePasteBackAction,
  type TextSelection,
} from '../../local/pasteInputState';
import { statementReviewSourceKey } from '@/folio/lib/statementReviewModel';
import {
  clearReaderCandidates,
  enqueueReviewItems,
  getState,
  queueInputFromCandidates,
  useAppStore,
  useReaderCandidates,
  useStatementReviewSessions,
} from '@/folio/store';
import { BulkStatementLanding } from '@/folio/ui/BulkStatementLanding';
import { formatReviewDate } from '@/folio/screens/reviewFormat';
import type { ImportSourceReturn, Nav } from '@/folio/types';

// One thing Folio found in the pasted text — `id` is the candidate's own identity (the list keys on
// THIS, never `merchant`, so two rows for the same merchant never collapse into one — phase ⑦
// "preview key collapse" fix). `flow` distinguishes money-in from money-out, `amount` is the bare
// preformatted magnitude (the screen prepends the +/− glyph), `date` is the short date.
export type PastedItem = {
  id: string;
  merchant: string;
  flow: 'in' | 'out';
  amount: string;
  date: string;
};

// The render states this screen can occupy (per STATES.md PasteSuccess row).
export type PasteSuccessState = 'populated' | 'loading' | 'empty' | 'error' | 'offline';

export type PasteSuccessScreenProps = {
  nav: Nav;
  /** Live pasted/CSV text. When present it is read by the real `parseSheet` engine into the found
   *  list (+ honest issues). Omitted on a cold open — the screen then shows the empty doorway. */
  pasteText?: string;
  /** Pre-derived found list. Overrides the engine derivation when supplied (e.g. for a fixture). */
  items?: readonly PastedItem[];
  state?: PasteSuccessState;
  /** Raw editor state returned by a review flow. This is an in-memory nav handoff only. */
  sourceReturn?: ImportSourceReturn | undefined;
  reviewSourceKey?: string;
};

// Format a bare GBP magnitude the way the web preformatted it: whole pounds, thousands grouped, no
// pence (42 → "£42", 1200 → "£1,200", 750 → "£750"). Pence are shown only when the magnitude isn't
// whole, so a real pasted "12.50" never silently loses its decimals.
function formatMagnitude(amount: number): string {
  const magnitude = Math.abs(amount);
  const grouped = magnitude.toLocaleString('en-GB', {
    minimumFractionDigits: Number.isInteger(magnitude) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `£${grouped}`;
}

// Map the engine's CandidateMoneyItem[] (the real `parseSheet` output) into this screen's render
// shape. The sign carries money-in vs money-out; the magnitude is reformatted to the web's exact
// preformatted string; the short date label is restated from the same day. Faithful, no new data.
// Carrying the candidate's own `id` through is what lets the list key on a stable per-row identity
// instead of collapsing same-merchant rows (phase ⑦ "preview key collapse" fix).
function toPastedItems(candidates: readonly CandidateMoneyItem[]): PastedItem[] {
  return candidates.map((candidate) => ({
    id: candidate.id,
    merchant: candidate.merchant,
    flow: candidate.amount >= 0 ? 'in' : 'out',
    amount: formatMagnitude(candidate.amount),
    date: candidate.date ?? '',
  }));
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

export function PasteSuccessScreen({
  nav,
  pasteText,
  items: itemsOverride,
  state = 'populated',
  sourceReturn,
  reviewSourceKey,
}: PasteSuccessScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  // Intake stages clipboard and CSV reads in the transient reader slot before navigating here.
  // Read that slot when no prop/fixture is supplied; otherwise the native paste path appeared to
  // succeed and then rendered a misleading empty doorway. The slot is still review-only and is
  // cleared only after the candidates move into the persisted review queue.
  const staged = useReaderCandidates();
  const reviewSessions = useStatementReviewSessions();
  const activeWorkspaceId = useAppStore((current) => current.activeWorkspaceId);
  const canResumeReview =
    sourceReturn === undefined &&
    reviewSourceKey !== undefined &&
    reviewSessions.some(
      (session) =>
        session.sourceKey === reviewSourceKey &&
        session.candidates.length > 0 &&
        (session.workspaceId === undefined || String(session.workspaceId) === String(activeWorkspaceId)),
    );
  const initialDraft = sourceReturn?.rawText ?? pasteText ?? '';
  const [draft, setDraft] = useState(initialDraft);
  const [submittedDraft, setSubmittedDraft] = useState(pasteText ?? '');
  const [previewed, setPreviewed] = useState(Boolean(pasteText?.trim()));
  const [previewing, setPreviewing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selection, setSelection] = useState<TextSelection>(
    sourceReturn?.selection ?? { start: initialDraft.length, end: initialDraft.length },
  );
  const [focused, setFocused] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(() => sourceReturn?.scrollOffset ?? 0);
  const [keyboardHeight, setKeyboardHeight] = useState(() => Keyboard.metrics()?.height ?? 0);
  const [clipboardReading, setClipboardReading] = useState(false);
  const [sourceReturnActive, setSourceReturnActive] = useState(sourceReturn !== undefined);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const headingRef = useRef<Text>(null);
  const draftRef = useRef(draft);
  const selectionRef = useRef(selection);
  const scrollOffsetRef = useRef(sourceReturn?.scrollOffset ?? 0);
  const pasteSourceIdentityRef = useRef<string | undefined>(undefined);
  const clipboardRequestRef = useRef(0);
  const previewRequestRef = useRef(0);
  const keyboardVisibleRef = useRef(false);
  const itemsLengthRef = useRef(0);
  const editorBackRef = useRef<() => boolean>(() => false);

  const updateDraft = (next: string) => {
    draftRef.current = next;
    setDraft(next);
  };
  const updateSelection = (next: TextSelection) => {
    selectionRef.current = next;
    setSelection(next);
  };

  useEffect(() => {
    if (pasteText !== undefined) {
      updateDraft(pasteText);
      setSubmittedDraft(pasteText);
      setPreviewed(true);
      setSourceReturnActive(false);
    }
  }, [pasteText]);

  useEffect(() => {
    if (sourceReturn === undefined) return;
    updateDraft(sourceReturn.rawText);
    draftRef.current = sourceReturn.rawText;
    updateSelection(sourceReturn.selection);
    scrollOffsetRef.current = sourceReturn.scrollOffset;
    setScrollOffset(sourceReturn.scrollOffset);
    setSubmittedDraft('');
    setPreviewed(false);
    setStatusMessage(null);
    setSourceReturnActive(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, sourceReturn.scrollOffset), animated: false });
      const node = findNodeHandle(headingRef.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }, [sourceReturn]);

  useEffect(() => {
    if (sourceReturn !== undefined) return;
    const frame = requestAnimationFrame(() => {
      const node = findNodeHandle(headingRef.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [sourceReturn]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      keyboardVisibleRef.current = true;
      setKeyboardHeight(Keyboard.metrics()?.height ?? 0);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisibleRef.current = false;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (itemsOverride !== undefined || itemsLengthRef.current > 0) return false;
      if (resolvePasteBackAction({ draftNonEmpty: true, keyboardVisible: keyboardVisibleRef.current }) === 'dismiss-keyboard') {
        Keyboard.dismiss();
        return true;
      }
      return editorBackRef.current();
    });
    return () => subscription.remove();
  }, [itemsOverride]);

  useEffect(() => () => {
    clipboardRequestRef.current += 1;
    previewRequestRef.current += 1;
  }, []);

  // The real engine derivation. User-pasted text is read by `parseSheet`. An
  // explicit `items` prop still wins for fixtures. `issues` are the engine's honest fix prompts.
  // `candidates` keeps the raw parse output so the primary CTA can enqueue exactly what the card
  // showed (an `items` fixture carries no raw candidates, so it enqueues nothing — tests only).
  const { items, issues, candidates, parseError } = useMemo(() => {
    if (sourceReturnActive) {
      return {
        items: [] as readonly PastedItem[],
        issues: [] as readonly ColumnIssue[],
        candidates: [] as readonly CandidateMoneyItem[],
        parseError: false,
      };
    }
    if (itemsOverride) {
      return {
        items: itemsOverride,
        issues: [] as readonly ColumnIssue[],
        candidates: [] as readonly CandidateMoneyItem[],
        parseError: false,
      };
    }
    if (submittedDraft.trim()) {
      let parsed: ReturnType<typeof readTextImport>;
      try {
        parsed = readTextImport(submittedDraft, 'paste', 'pasted transactions');
      } catch {
        return {
          items: [] as readonly PastedItem[],
          issues: [] as readonly ColumnIssue[],
          candidates: [] as readonly CandidateMoneyItem[],
          parseError: true,
        };
      }
      // RECALL (lib/merchantMemory.ts, DATA_INTELLIGENCE.md phase ③): this is the
      // one paste path that never touches setReaderCandidates (the file/photo
      // reader's choke point), so a remembered merchant category is applied here
      // directly before the candidates reach the card / the queue. Category only.
      const withMemory = applyMemoryToCandidates(parsed.candidates, getState().merchantCategories);
      return {
        items: toPastedItems(withMemory),
        issues: parsed.issues,
        candidates: withMemory,
        parseError: false,
      };
    }
    if (staged.length > 0) {
      return {
        items: toPastedItems(staged),
        issues: [] as readonly ColumnIssue[],
        candidates: staged,
        parseError: false,
      };
    }
    // Nothing pasted (a cold open from the nav): show the empty doorway below, never a fabricated
    // sample list. The SAMPLE_* consts are gone — a real paste is the only source of rows here.
    return {
      items: [] as readonly PastedItem[],
      issues: [] as readonly ColumnIssue[],
      candidates: [] as readonly CandidateMoneyItem[],
      parseError: false,
    };
  }, [submittedDraft, itemsOverride, staged, sourceReturnActive]);

  itemsLengthRef.current = items.length;


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

  const { lead, accent, tail } = useMemo(() => splitAccent(copy.add.success.paste), []);

  // BULK ADD-AS-HISTORY (task): a multi-candidate paste/CSV read (a real statement pasted or
  // uploaded) swaps the ordinary single-item CTA pair for the bulk landing surface. A
  // single-candidate read, or a fixture-driven `items` prop, is unchanged — same
  // enqueue-then-Review path (`candidates` is already [] for an `items` fixture, so
  // `isBulkStatement` reads false there too).
  // Every real candidate, including a one-row read, belongs to the same D2 review contract. The
  // old singleton shortcut bypassed line uncertainty and the durable provisional session.
  const isBulk = canResumeReview || candidates.length > 0;
  const isPasteSource =
    candidates[0]?.source === 'paste' ||
    (canResumeReview &&
      reviewSessions.some(
        (session) =>
          session.sourceKey === reviewSourceKey &&
          session.candidates[0]?.source === 'paste' &&
          (session.workspaceId === undefined || String(session.workspaceId) === String(activeWorkspaceId)),
      ));
  if (isPasteSource && reviewSourceKey === undefined && pasteSourceIdentityRef.current === undefined) {
    pasteSourceIdentityRef.current = `paste:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
  }
  const activeReviewSourceKey = reviewSourceKey ?? (isPasteSource ? pasteSourceIdentityRef.current : undefined);
  const reviewSourceReturn = useMemo<ImportSourceReturn | undefined>(
    () =>
      isPasteSource
        ? {
            sourceKey: activeReviewSourceKey ?? statementReviewSourceKey(candidates),
            rawText: submittedDraft || draft,
            selection: selectionRef.current,
            scrollOffset: scrollOffsetRef.current,
          }
        : undefined,
    [activeReviewSourceKey, candidates, draft, scrollOffset, selection.end, selection.start, submittedDraft],
  );
  const returnToSource = (returnedSource?: ImportSourceReturn) => {
    const restored = returnedSource ?? sourceReturn;
    nav.go('paste-success', {
      importSource: {
        sourceKey:
          restored?.sourceKey ??
          activeReviewSourceKey ??
          (candidates.length > 0 ? statementReviewSourceKey(candidates) : 'paste-editor'),
        rawText: restored?.rawText ?? draftRef.current,
        selection: restored?.selection ?? selectionRef.current,
        scrollOffset: restored?.scrollOffset ?? scrollOffsetRef.current,
      },
    });
  };

  // A hard column issue means the engine could not understand the paste at all (no amount/name
  // column, or empty input) — that IS the "read failed" case, so it resolves to the same calm error
  // doorway below rather than a hollow card. Row-level issues (a single bad amount) are not hard;
  // the good rows still render.
  const hasHardIssue = issues.some(
    (issue) =>
      issue.code === 'missing-amount' ||
      issue.code === 'missing-merchant' ||
      issue.code === 'empty-input',
  );

  // loading — the native reader is still settling. This must precede the empty guard: a waiting
  // screen has no candidates yet by definition, but should never read as "nothing found".
  if (state === 'loading') {
    return (
      <View
        style={[styles.loading, { backgroundColor: t.canvas, paddingTop: insets.top + gap.xxl }]}
      >
        <ActivityIndicator color={t.calm} accessibilityLabel="Melo is reading the pasted text" />
        <Text style={[styles.progressLabel, { color: t.muted }]}>Melo is reading the pasted text</Text>
      </View>
    );
  }

  if (!canResumeReview && items.length === 0) {
    const hasDraft = draft.trim().length > 0;
    const editorStatus = state === 'error' || parseError
      ? 'Melo couldn\'t read this text just now. Your draft is still here.'
      : previewed && (hasHardIssue || submittedDraft.trim().length > 0)
        ? 'Melo couldn\'t find a complete transaction yet. Check the date, name and amount, then preview again.'
        : statusMessage;
    const goBack = () => {
      if (resolvePasteBackAction({ draftNonEmpty: hasDraft, keyboardVisible: false }) === 'go-to-intake') {
        nav.go('intake');
        return;
      }
      Alert.alert('Leave this draft?', 'Discard this text and go back?', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard draft', style: 'destructive', onPress: () => nav.go('intake') },
      ]);
    };
    editorBackRef.current = () => {
      goBack();
      return true;
    };
    const pasteFromClipboard = async () => {
      if (clipboardReading) return;
      const requestId = clipboardRequestRef.current + 1;
      clipboardRequestRef.current = requestId;
      setClipboardReading(true);
      try {
        const clip = await Clipboard.getString();
        if (clipboardRequestRef.current !== requestId) return;
        if (clip.trim().length === 0) {
          setStatusMessage('Nothing copied yet. Copy the transactions, then try again.');
          inputRef.current?.focus();
          return;
        }
        const inserted = insertClipboardAtSelection(draftRef.current, clip, selectionRef.current);
        updateDraft(inserted.text);
        updateSelection(inserted.selection);
        setStatusMessage(null);
        inputRef.current?.focus();
      } catch {
        if (clipboardRequestRef.current === requestId) {
          setStatusMessage("Melo couldn't paste from the clipboard. Touch and hold in the box to paste, or type here.");
        }
      } finally {
        if (clipboardRequestRef.current === requestId) setClipboardReading(false);
      }
    };
    const previewDraft = () => {
      if (!hasDraft || previewing) return;
      Keyboard.dismiss();
      setStatusMessage(null);
      setPreviewing(true);
      const requestId = previewRequestRef.current + 1;
      previewRequestRef.current = requestId;
      const draftAtPreview = draftRef.current;
      // Keep the editor mounted while the existing local parser runs. No candidates or money
      // state are changed by this operation; valid output is handed to the existing D2 route.
      setTimeout(() => {
        if (previewRequestRef.current !== requestId) return;
        setSubmittedDraft(draftAtPreview);
        setSourceReturnActive(false);
        setPreviewed(true);
        setPreviewing(false);
      }, 0);
    };
    const editorMinHeight = PixelRatio.getFontScale() >= 1.5 ? 192 : 160;
    const keyboardReducedViewport = Math.max(
      editorMinHeight,
      dimensions.height - insets.top - insets.bottom - keyboardHeight,
    );
    const editorMaxHeight = Math.max(editorMinHeight, Math.round(keyboardReducedViewport * 0.4));
    return (
      <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            const nextOffset = event.nativeEvent.contentOffset.y;
            scrollOffsetRef.current = nextOffset;
            setScrollOffset(nextOffset);
          }}
          scrollEventThrottle={16}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={goBack}
            style={({ pressed }) => [styles.pressIcon, pressed ? styles.pressed : undefined]}
            >
              <BackArrow color={t.muted} />
            </Pressable>
            <Text ref={headingRef} accessibilityRole="header" style={[styles.headerLabel, { color: t.muted }]}>BRING MY SHEET ACROSS</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.intro}>
            <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
              Paste your <Text style={[styles.headlineAccent, { color: t.calm }]}>sheet.</Text>
            </Text>
            <Text style={[styles.entryBody, { color: t.muted }]}>
              Paste dates, names and amounts. You can change the text before Melo reads it.
            </Text>
          </View>

          <Text style={[styles.pasteLabel, { color: t.muted }]}>PASTE AREA</Text>
          <TextInput
            ref={inputRef}
            accessibilityLabel="Pasted transaction text"
            accessibilityHint="Paste dates, names and amounts, separated by commas, tabs or new lines."
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChangeText={updateDraft}
            onSelectionChange={(event) => updateSelection(event.nativeEvent.selection)}
            placeholder="Paste dates, names and amounts, separated by commas, tabs or new lines."
            placeholderTextColor={t.muted}
            selectionColor={t.calm}
            spellCheck={false}
            editable={!previewing}
            selection={selection}
            style={[
              styles.pasteInput,
              {
                backgroundColor: t.inset,
                borderColor: focused ? t.calm : t.hairline,
                color: t.ink,
                maxHeight: editorMaxHeight,
                minHeight: editorMinHeight,
              },
            ]}
            textAlignVertical="top"
            value={draft}
          />
          {editorStatus ? (
            <Text accessibilityLiveRegion="polite" style={[styles.editorStatus, { color: t.muted }]}>
              {editorStatus}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paste from clipboard"
            accessibilityState={{ disabled: previewing || clipboardReading, busy: clipboardReading }}
            disabled={previewing || clipboardReading}
            onPress={() => void pasteFromClipboard()}
            style={({ pressed }) => [styles.secondary, { marginTop: gap.lg, borderColor: t.hairline }, pressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.secondaryLabel, { color: t.ink }]}>Paste from clipboard</Text>
          </Pressable>
          {!previewed ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Preview sheet"
              accessibilityState={{ disabled: !hasDraft || previewing, busy: previewing }}
              disabled={!hasDraft || previewing}
              onPress={previewDraft}
              style={({ pressed: isPressed }) => [
                styles.primary,
                { marginTop: gap.md, backgroundColor: t.calm, opacity: hasDraft && !previewing ? 1 : 0.45 },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.primaryLabel, { color: t.inverse }]}>{previewing ? 'Reading…' : 'Preview sheet'}</Text>
            </Pressable>
          ) : null}
          <Text accessibilityLiveRegion={previewing ? 'polite' : 'none'} style={[styles.progressLabel, { color: t.muted }]}>
            {previewing ? 'Melo is reading the pasted text' : ''}
          </Text>
          {previewed && items.length === 0 && !previewing ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={state === 'error' || parseError ? 'Try again' : 'Preview again'}
                onPress={previewDraft}
                style={({ pressed }) => [styles.secondary, { marginTop: gap.md, borderColor: t.hairline }, pressed ? styles.pressed : undefined]}
              >
                <Text style={[styles.secondaryLabel, { color: t.ink }]}>{state === 'error' || parseError ? 'Try again' : 'Preview again'}</Text>
              </Pressable>
              {state !== 'error' && !parseError ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear text"
                  onPress={() => Alert.alert('Clear this text?', "You won't be able to bring it back here.", [
                    { text: 'Keep editing', style: 'cancel' },
                    { text: 'Clear text', style: 'destructive', onPress: () => { updateDraft(''); setSubmittedDraft(''); setPreviewed(false); setStatusMessage('Text cleared'); updateSelection({ start: 0, end: 0 }); inputRef.current?.focus(); } },
                  ])}
                  style={({ pressed }) => [styles.secondary, { marginTop: gap.md, borderColor: t.hairline }, pressed ? styles.pressed : undefined]}
                >
                  <Text style={[styles.secondaryLabel, { color: t.muted }]}>Clear text</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
          {previewed && items.length === 0 && (state === 'error' || parseError) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to ways to add"
              onPress={() => nav.go('intake')}
              style={({ pressed }) => [styles.secondary, { marginTop: gap.md, borderColor: t.hairline }, pressed ? styles.pressed : undefined]}
            >
              <Text style={[styles.secondaryLabel, { color: t.muted }]}>Back to ways to add</Text>
            </Pressable>
          ) : !previewed ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={goBack}
              style={({ pressed }) => [styles.secondary, { marginTop: gap.md, borderColor: t.hairline }, pressed ? styles.pressed : undefined]}
            >
              <Text style={[styles.secondaryLabel, { color: t.muted }]}>Cancel</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </Animated.View>
    );
  }

  // populated / offline — the real preview. offline ≡ populated (the read already happened upstream).
  const count = items.length;
  const eyebrow = `${count} thing${count === 1 ? '' : 's'} to check`;
  const reviewSource = candidates[0]?.source === 'paste' ? 'paste' : 'csv';

  // The scalable review workspace is full-screen so its virtualized list is never nested in this
  // legacy success ScrollView and its action area is immediately reachable at every statement size.
  if (isBulk) {
    return (
      // The account picker and review list must stay visible even if a native entrance
      // animation is interrupted by keyboard dismissal or an account-selection rerender.
      <View style={[styles.root, { backgroundColor: t.canvas }]}>
        <BulkStatementLanding
          nav={nav}
          candidates={canResumeReview ? [] : candidates}
          {...(canResumeReview ? { sessionKey: reviewSourceKey } : {})}
          {...(activeReviewSourceKey !== undefined && !canResumeReview ? { sourceKey: activeReviewSourceKey } : {})}
          {...(reviewSourceReturn === undefined ? {} : { sourceReturn: reviewSourceReturn })}
          sourceIssues={issues}
          onAdded={() => clearReaderCandidates()}
          {...(isPasteSource ? { onSourceReturn: returnToSource } : {})}
        />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.root, enterStyle, { backgroundColor: t.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back glyph · Pasted label · balancing spacer. */}
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
          <Text style={[styles.headerLabel, { color: t.muted }]}>Pasted</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Intro — italic count eyebrow, the headline with the single accent word "check.", subhead. */}
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>{eyebrow}</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {lead}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>{accent}</Text>
            {tail}
          </Text>
          <Text style={[styles.body, { color: t.muted }]}>
            Melo found possible money in and money out. Nothing has been added yet.
          </Text>
        </View>

        {/* Items card — one calm row per pasted item on a single surface card, hairline-divided. */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }]}>
          {items.map((item, index) => {
            const isIn = item.flow === 'in';
            return (
              <View
                key={item.id}
                style={[
                  styles.row,
                  index > 0 ? { borderTopColor: t.hairline, ...styles.rowDivider } : undefined,
                ]}
              >
                <View style={[styles.dot, { backgroundColor: isIn ? t.positive : t.calm }]} />
                <View style={styles.rowMeta}>
                  <Text style={[styles.merchant, { color: t.ink }]}>
                    {item.merchant}
                  </Text>
                  <Text style={[styles.rowSub, { color: t.muted }]}>
                    {`${formatReviewDate(item.date)} · money ${item.flow}`}
                  </Text>
                </View>
                {/* Money — money-in green/positive, money-out INK; sign carried by the +/− glyph. */}
                <Text style={[styles.amount, { color: isIn ? t.positive : t.ink }]}>
                  {`${isIn ? '+' : '−'}${item.amount}`}
                </Text>
              </View>
            );
          })}
        </View>
        {issues.length > 0 ? (
          <Text accessibilityLiveRegion="polite" style={[styles.issueLine, { color: t.muted }]}>
            {issues.length === 1
              ? 'One line needs a quick check before it counts.'
              : `${issues.length} lines need a quick check before they count.`}
          </Text>
        ) : null}

        {/* BULK ADD-AS-HISTORY (task): a multi-candidate paste/CSV read (a real statement) swaps
            the ordinary single-item CTA pair for the bulk landing surface — summary + "Add all as
            history" / "Review one by one" + the post-import offer sequencer. A single-candidate
            read is unchanged — same enqueue-then-Review path as before. */}
        {isBulk ? (
          <BulkStatementLanding
            nav={nav}
            candidates={candidates}
            sourceIssues={issues}
            {...(activeReviewSourceKey !== undefined && !canResumeReview ? { sourceKey: activeReviewSourceKey } : {})}
            {...(reviewSourceReturn === undefined ? {} : { sourceReturn: reviewSourceReturn })}
            onAdded={() => clearReaderCandidates()}
            {...(isPasteSource ? { onSourceReturn: returnToSource } : {})}
            onReviewOneByOne={(accountId) => {
              const { dropped } = enqueueReviewItems(
                queueInputFromCandidates(candidates, reviewSource, accountId),
              );
              if (dropped > 0) {
                showToast(
                  'Showing the newest 60 to check first',
                  `${dropped} more will follow as you clear them.`,
                );
              }
              clearReaderCandidates();
              nav.go('review');
            }}
          />
        ) : (
          <>
            {/* Melo line — the quiet companion, calm mood. MeloLine adds the straight quotes. */}
            <View style={styles.meloBlock}>
              <MeloLine mood="calm" text="Use what you have. You choose what counts." />
            </View>

            {/* Spacer pins the CTAs to the bottom, mirroring the web flex-1 spacer. */}
            <View style={styles.spacer} />

            {/* Primary CTA — terracotta fill; enqueues what the card showed into the persisted review
                queue and routes to Review, faithful to the web source (ScreenPasteSuccess.tsx `send`:
                enqueueReviewItems with source "csv", then nav.go("review")). Review-before-truth holds —
                queued items are candidates, never posted facts. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Check these"
              accessibilityHint="Opens the review of what was found"
              onPress={() => {
                const { dropped } = enqueueReviewItems(
                  queueInputFromCandidates(candidates, reviewSource),
                );
                if (dropped > 0) {
                  showToast(
                    'Showing the newest 60 to check first',
                    `${dropped} more will follow as you clear them.`,
                  );
                }
                clearReaderCandidates();
                nav.go('review');
              }}
              style={({ pressed: isPressed }) => [
                styles.primary,
                { backgroundColor: t.calm },
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.primaryLabel, { color: t.inverse }]}>Check these</Text>
            </Pressable>

            {/* Secondary CTA — quiet "leave for later" (backs out, nothing added). */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Leave for later"
              onPress={nav.back}
              style={({ pressed: isPressed }) => [
                styles.secondary,
                isPressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.secondaryLabel, { color: t.muted }]}>Leave for later</Text>
            </Pressable>
          </>
        )}
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
    minHeight: 56,
  },
  pressIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  // Pasted — uppercase, tracked, 12px, muted.
  headerLabel: {
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  headerSpacer: {
    width: 48,
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
  // 13.5px relaxed body, mt-3, muted.
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: gap.md,
  },
  entryBody: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: gap.sm,
  },
  pasteLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.35,
    marginBottom: 6,
    marginTop: gap.lg,
    textTransform: 'uppercase',
  },
  pasteInput: {
    borderRadius: radius.md,
    borderStyle: 'dashed',
    borderWidth: StyleSheet.hairlineWidth,
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 160,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  // Items card — surface bg, 1px hairline border, 2xl radius, mt-6, rows divided.
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
  },
  // Row — px-4 py-3.5, row, gap-3. The first row carries no top hairline.
  row: {
    alignItems: 'center',
    columnGap: gap.md,
    flexDirection: 'row',
    paddingHorizontal: gap.lg,
    paddingVertical: 14,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // w-1.5 h-1.5 (6) rounded-full dot — green on "in", terracotta on "out".
  dot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  rowMeta: {
    flex: 1,
    minWidth: 0,
  },
  // 14px medium, truncating.
  merchant: {
    fontSize: 14,
    fontWeight: '500',
  },
  // 11.5px muted, mt-0.5.
  rowSub: {
    fontSize: 11.5,
    marginTop: gap.xxs,
  },
  issueLine: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: gap.sm,
  },
  editorStatus: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: gap.sm,
  },
  progressLabel: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: gap.sm,
    minHeight: 17,
  },
  // Money — the web <Money size="sm"> is Fraunces display, tabular, medium, 15px.
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
    minHeight: 56,
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
    minHeight: 48,
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
