// @rn-sheet     MeloChatSheet
// @purpose      Melo conversation surface — an aggregate local snapshot + a proactive opener,
//               hosting Melo chat (transcript, tone settings, approval-gated store suggestions
//               with a 30s undo window after confirmation, composer).
// @reads        Aggregate local snapshot only; no names, merchants, transaction rows or identifiers.
// @writes       applyMeloTool only after the user confirms a pending suggestion — the log_* family
//               (log spend / log income / log refund / log transfer), each recorded as a Transaction
//               with a captured undo closure. Subscription requests remain read-only here and route
//               to the dedicated reversible Subscriptions surface. Dismiss never writes.
// @copy         FROZEN — assistant lines come from deterministic local contracts. Keyed strings
//               (Melo name, currency) read VERBATIM from '@/folio/copy/copy'.
// @tokens       --paper(canvas) --surface --inset --ink --muted-ink(muted) --hairline
//               --accent(calm) --hairlineStrong (grip) — all via '@/folio/theme'.
// @motion       sheet-rise + scrim-in (inherited from the kit Sheet) · press (scale 0.97) on every
//               tappable (Tune, tone buttons, starter chips, Confirm, Dismiss, Undo, Start fresh,
//               submit) · message
//               fade-in on each bubble · Melo's-thinking shimmer (2s) · undo-pill 30s timer. Every
//               motion collapses to its final state under reduce-motion (MOTION.md).
// @moods        calm — the only mood used here. MELO_MOODS.md fixes the chat sheet at calm; the web
//               passed pressureMood[pressure] (soft/alert aliases). RN drops the aliases and renders
//               calm, per the spec's `moods` row + fidelity note.
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/components/folio/sheets/SheetMeloChat.tsx, which is a
// logic-only wrapper, + .../src/components/melo/MeloChat.tsx, where the visible UI lives) and the
// spec (plans/rn-port/specs/MeloChatSheet.spec.md). Layout, copy, every STATES branch, the named
// motions and the calm Melo mood are reproduced unit-for-unit.
//
// ENGINE — `buildLocalMeloTurn` drafts replies and completed-event suggestions on-device. The
// retired `meloAiClient` cannot perform network I/O; confirmation and undo remain the only write path.
//
// Design-system discipline: every colour/font/spacing/radius token comes from '@/folio/theme' (which
// re-exports the pressure-map kit). Nothing new is defined — no colour, no font, no spacing value, no
// dependency. The assistant body is rendered as plain prose Text on --ink (no markdown library is
// added; adding a dependency is out of scope and the persona lines are short prose).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  findNodeHandle,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { MeloAlert as Alert } from '@/folio/ui/meloAlert';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { copy } from '@/folio/copy/copy';
import { Melo } from '@/folio/melo/Melo';
import {
  applyMeloTool,
  getState,
  purgeSeedIfReal,
  setMelo,
  useAppStore,
  type MeloTone,
  type Sub,
  type Transaction,
} from '@/folio/store';
import { UNDO_WINDOW_MS } from '@/folio/lib/undoPolicy';
import { formatMoney } from '@/folio/lib/financialPresentation';
import { buildMeloSnapshot } from '@/folio/lib/meloSnapshot';
import { buildMeloLocalCalculation } from '@/folio/lib/meloCalculations';
import { subscriptionPaused } from '@/folio/lib/subscriptionIdentity';
import { buildMeloSourceFigures, meloChatStarters } from '@/folio/lib/meloSourceFigures';
import { resolveMeloAccountSelection } from '@/folio/lib/meloAccountSelection';
import { resolveMeloSubscriptionRequest } from '@/folio/lib/meloSubscriptionRequest';
import { DEFAULT_MELO_TONE, describeMeloTone } from '@/folio/lib/meloToneGuidance';
import { useMeloVoiceTranscript } from '@/folio/lib/useMeloVoiceTranscript';
import type { MeloIntent, Nav, Pressure } from '@/folio/types';
import {
  MELO_TOOL_APPROVAL_DENIED,
  MELO_TOOL_APPROVAL_REQUESTED,
  decideMeloToolSuggestion,
  describeMeloToolSuggestion,
  prepareMeloDebtPaymentReview,
  isMeloDebtPaymentReviewCurrent,
  getMeloToolSuggestionPhase,
  settleMeloToolApplication,
  settleMeloToolUndo,
  type MeloToolSuggestionSettlement,
  type MeloDebtPaymentReview,
} from '@/folio/sheets/meloToolSuggestion';
import { filterMeloFollowUpChips, resolveMeloLocalAction } from '@/folio/sheets/meloLocalAction';
import { presentMeloReply } from '@/folio/sheets/meloPresentation';
import {
  buildLocalMeloTurn,
  type LocalMeloCalculationBuilder,
  type LocalMeloAccountSelector,
  type LocalMeloConversationContext,
  type LocalMeloSubscriptionActionResolver,
  type LocalMeloTurn,
} from '@/local/localMeloTurn';
import { enrichLocalMeloTurn } from '@/local/localMeloLanguage';
import {
  getLocalLanguagePackState,
  installLocalLanguagePack,
  type LocalLanguagePackState,
} from '@/local/localLanguagePack';
import type {
  MeloLocalAiAction,
  MeloLocalFinancialSnapshot,
  MeloLocalIntent,
} from '@folio/ai-contracts';

// ---------------------------------------------------------------------------
// Constants — mirrored from the web original
// ---------------------------------------------------------------------------

// The four tones (web TONES). `id` is the local drafting tone key; `label` is the visible word.
type Tone = MeloTone;
const TONES: readonly { id: Tone; label: string }[] = [
  { id: 'calm', label: 'Calm' },
  { id: 'honest', label: 'Honest' },
  { id: 'dry', label: 'Dry' },
  { id: 'coachy', label: 'Coachy' },
];

// pressureLow (the web's tightPoint-by-pressure table) now lives in lib/meloSnapshot.ts, next to the
// rest of the pure snapshot-building logic it only ever fed.

// UNDO_WINDOW_MS — the Tier-1 undo window — is imported from the policy engine (lib/undoPolicy),
// which is now the canonical 30s (ENGINES §6 D3 >= 30s floor). The prior local 8000 shadowed it
// and sat below the decided minimum; it is removed so every undo affordance shares one window.
const PRESS_SCALE = 0.97; // .press — scale 0.97 on :active
const SHIMMER_MS = 2000; // Melo's-thinking shimmer cycle (web 2s linear infinite)
const FADE_IN_MS = 260; // message fade-in
const SCROLL_BOTTOM_EPSILON = 24; // px from the bottom still counted as "at the bottom"

// The chat message model — a faithful subset of the web UIMessage `parts[]` shape, kept so persisted
// history and rendered tool pills round-trip identically. A part is either rendered text or a tool
// call that finished with an output message.
type TextPart = { type: 'text'; text: string };
type ToolPart = {
  type: `tool-${string}`;
  state?: 'output-available' | string;
  toolCallId?: string;
  input?: Record<string, unknown>;
  output?: { ok?: boolean; message?: string };
  paymentReview?: MeloDebtPaymentReview;
};
type ChatPart = TextPart | ToolPart;
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: ChatPart[];
  intent?: MeloLocalIntent;
  actions?: readonly MeloLocalAiAction[];
  followUpChips?: readonly string[];
  sourceRows?: ReturnType<typeof buildMeloSourceFigures>['rows'];
  sourcePrompt?: string;
};

// status mirrors the web useChat status union the UI branches on.
type ChatStatus = 'ready' | 'submitted' | 'streaming';

function isToolPart(part: ChatPart): part is ToolPart {
  return part.type.startsWith('tool-');
}

function partsToText(message: ChatMessage): string {
  return message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
}

// ---------------------------------------------------------------------------
// Reduced-motion hook (AccessibilityInfo-backed — mirrors LogSpendSheet / Melo)
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
// Public API
// ---------------------------------------------------------------------------

export type MeloChatSheetProps = {
  // Whether the sheet is mounted/visible — wired straight to the kit Sheet primitive.
  visible: boolean;
  onClose: () => void;
  // The shell's nav + landing pressure (threaded the same way RouteDetailSheet receives them — the
  // RN Nav contract carries no `.pressure`, so the shell passes it alongside).
  nav: Nav;
  pressure: Pressure;
  // Carried when a flow opens Melo with a prefilled draft / seed (web intent.prefill / intent.seed).
  intent?: MeloIntent | undefined;
};

// ---------------------------------------------------------------------------
// MeloChatSheet — the logic-only wrapper (web SheetMeloChat): builds the last-14-day snapshot and the
// proactive opener, then hosts the embedded chat. Mounts the kit Sheet itself (self-hosting, like
// RouteDetailSheet / LogSpendSheet), so the route file only needs to render it.
// ---------------------------------------------------------------------------

export function MeloChatSheet({ visible, onClose, nav, pressure, intent }: MeloChatSheetProps) {
  const reduceMotion = useReduceMotion();
  const bodyScrollRef = useRef<ScrollView>(null);
  const terminalRef = useRef<View>(null);
  const terminalAlignmentRef = useRef(true);
  const bodyHandlersRef = useRef<{
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onContentSizeChange?: (width: number, height: number) => void;
    onLayout?: (event: LayoutChangeEvent) => void;
  }>({});

  const state = useAppStore((s) => s);
  const subs = useAppStore((s) => s.subs);
  const subPaused = useAppStore((s) => s.subPaused);
  const onboarding = useAppStore((s) => s.onboarding);
  const activeWorkspace = useAppStore(
    (s) => s.workspaces.find((workspace) => workspace.id === s.activeWorkspaceId)!,
  );

  const prefill = intent?.prefill;
  const seedIntent = intent?.seed;

  // Snapshot — the pure builder (lib/meloSnapshot.ts) exposes aggregate, live-derived values only.
  // It excludes names, merchants, transaction rows, identifiers and seeded/sample money.
  // live. `now` is read fresh on every snapshot build (not memoised across renders) so a chat opened on
  // a different day gets a current count.
  const snapshot = useMemo(
    () => buildMeloSnapshot(state, pressure, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `state` (the whole store snapshot) is the
    // only reactive input buildMeloSnapshot reads; `pressure` is a prop. Depending on the whole `state`
    // (not a slice list) mirrors useRoute's own convention for a store-wide pure builder.
    [state, pressure],
  );

  // Proactive opener — only when the user opens Melo with no specific intent. Pick the most useful
  // thing to say first, based on real state. Ported as-is from the web autoSeed heuristic.
  const autoSeed = useMemo(() => {
    if (prefill || seedIntent) return undefined;
    if (activeWorkspace.kind === 'business') {
      return `I'm looking only at ${activeWorkspace.name}. What would you like to check?`;
    }
    const liveSubs = subs.filter((s) => !subscriptionPaused(subPaused, s));
    const soon = [...liveSubs].sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway)[0] as
      | Sub
      | undefined;
    const name = onboarding.name ? `${onboarding.name}, ` : '';
    // Payment-TIMING openers only. Bank/seed data proves a charge RECURS, it cannot prove the product
    // was used (SUBSCRIPTION_SIGNAL_RESEARCH §2/§5), so Melo never opens with a usage / "you haven't
    // opened it" claim or a "pause/cancel it" directive — she surfaces the upcoming charge and asks a
    // neutral question; the user decides. Both branches key on the renewal date, never on usage.
    if (soon && soon.nextRenewalDaysAway <= 3) {
      return `${name}quick one — ${soon.name} ${formatMoney(soon.cost)} leaves ${soon.nextRenewalDaysAway === 0 ? 'today' : `in ${soon.nextRenewalDaysAway} ${soon.nextRenewalDaysAway === 1 ? 'day' : 'days'}`}. All good with that?`;
    }
    if (soon && soon.nextRenewalDaysAway <= 7) {
      return `${name}heads up — ${soon.name} (${formatMoney(soon.cost)}) renews in ${soon.nextRenewalDaysAway} day${soon.nextRenewalDaysAway === 1 ? '' : 's'}. Want a look before it goes out?`;
    }
    if (snapshot.setupComplete === false) {
      return `${name}your money picture still needs ${snapshot.setupNeeds?.join(', ') || 'your numbers'}. You can add or confirm them in setup.`;
    }
    if (snapshot.hasMoneyPicture) {
      return `${name}your latest money picture is ready here. What do you want to check?`;
    }
    return `${name}here when you need me. what's on your mind?`;
  }, [prefill, seedIntent, activeWorkspace, subs, subPaused, onboarding, snapshot]);

  const calculate = useCallback<LocalMeloCalculationBuilder>(
    (request) =>
      buildMeloLocalCalculation({
        state,
        snapshot,
        request,
        now: new Date(),
        workspaceId: state.activeWorkspaceId,
      }),
    [snapshot, state],
  );
  const selectAccount = useCallback<LocalMeloAccountSelector>(
    (prompt, currentAccountId) =>
      resolveMeloAccountSelection(state, prompt, currentAccountId, state.activeWorkspaceId),
    [state],
  );
  const subscriptionState = useMemo(() => purgeSeedIfReal(state), [state]);

  // Avatar mood is canonically calm for the chat sheet (MELO_MOODS.md); the web's pressureMood alias
  // is intentionally dropped (spec `moods` row + fidelity note). One avatar instance, re-keyed on
  // visible so it remounts fresh each open (matches the web mount lifecycle).
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      reduceMotion={reduceMotion}
      scrollRef={bodyScrollRef}
      directScrollContent
      imeOverflowPolicy="scrollBodyToFocusedTerminal"
      onBodyScroll={(event) => bodyHandlersRef.current.onScroll?.(event)}
      onBodyContentSizeChange={(widthValue, heightValue) =>
        bodyHandlersRef.current.onContentSizeChange?.(widthValue, heightValue)
      }
      onBodyLayout={(event) => bodyHandlersRef.current.onLayout?.(event)}
      terminalRef={terminalRef}
      terminalAlignmentEnabledRef={terminalAlignmentRef}
    >
      <MeloChat
        snapshot={snapshot}
        prefill={prefill}
        seed={seedIntent ?? autoSeed}
        reduceMotion={reduceMotion}
        nav={nav}
        calculate={calculate}
        selectAccount={selectAccount}
        subscriptionState={subscriptionState}
        sourceRows={buildMeloSourceFigures(state).rows}
        voiceActive={visible}
        bodyScrollRef={bodyScrollRef}
        bodyHandlersRef={bodyHandlersRef}
        terminalAlignmentRef={terminalAlignmentRef}
        terminalRef={terminalRef}
      />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// MeloChat — the visible chat UI (web src/components/melo/MeloChat.tsx), ported 1:1.
// ---------------------------------------------------------------------------

function MeloChat({
  snapshot,
  prefill,
  seed,
  reduceMotion,
  nav,
  calculate,
  selectAccount,
  subscriptionState,
  sourceRows,
  voiceActive,
  bodyScrollRef,
  bodyHandlersRef,
  terminalAlignmentRef,
  terminalRef,
}: {
  snapshot: MeloLocalFinancialSnapshot;
  prefill?: string | undefined;
  seed?: string | undefined;
  reduceMotion: boolean;
  nav: Nav;
  calculate: LocalMeloCalculationBuilder;
  selectAccount: LocalMeloAccountSelector;
  subscriptionState: Parameters<LocalMeloSubscriptionActionResolver>[1];
  sourceRows: ReturnType<typeof buildMeloSourceFigures>['rows'];
  voiceActive: boolean;
  bodyScrollRef: React.RefObject<ScrollView | null>;
  bodyHandlersRef: React.MutableRefObject<{
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onContentSizeChange?: (width: number, height: number) => void;
    onLayout?: (event: LayoutChangeEvent) => void;
  }>;
  terminalAlignmentRef: React.MutableRefObject<boolean>;
  terminalRef: React.RefObject<View | null>;
}) {
  const t = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const stackComposer = fontScale >= 1.3 || width < 360;
  const s = useMemo(() => makeStyles(t), [t]);

  // Tone is a global companion preference, not throwaway sheet state. Chat phrasing and the narrow
  // proactive-money gate on Today both read this same persisted Melo settings slice.
  const savedTone = useAppStore((s) => s.melo?.tone ?? DEFAULT_MELO_TONE);
  const [showSettings, setShowSettings] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [composerHeight, setComposerHeight] = useState(0);
  const [draftHeight, setDraftHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const [input, setInput] = useState(prefill ?? '');
  const inputRef = useRef<TextInput>(null);
  const [expandedSources, setExpandedSources] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (prefill) setInput(prefill);
  }, [prefill]);

  // Seed an opening assistant message when the chat is empty (web seededMessages).
  const seededMessages = useMemo<ChatMessage[]>(() => {
    if (!seed) return [];
    return [{ id: `seed-${Date.now()}`, role: 'assistant', parts: [{ type: 'text', text: seed }] }];
  }, [seed]);

  const [messages, setMessages] = useState<ChatMessage[]>(seededMessages);
  const [dismissedFailureIds, setDismissedFailureIds] = useState<ReadonlySet<string>>(new Set());
  const [confirmingIds, setConfirmingIds] = useState<ReadonlySet<string>>(new Set());
  const [conversationContext, setConversationContext] =
    useState<LocalMeloConversationContext | null>(null);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const voice = useMeloVoiceTranscript(voiceActive);
  const voiceErrorRef = useRef<Text>(null);
  useEffect(() => {
    if (!voice.permissionDenied) return;
    const frame = requestAnimationFrame(() => {
      const node = findNodeHandle(voiceErrorRef.current);
      if (node != null) AccessibilityInfo.setAccessibilityFocus?.(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [voice.permissionDenied]);
  const [languagePackState, setLanguagePackState] = useState<
    | LocalLanguagePackState
    | Readonly<{ kind: 'checking' | 'installing'; fraction?: number }>
    | Readonly<{ kind: 'download-failed'; message: string }>
  >({ kind: 'checking' });
  const announcedLanguagePackState = useRef<string | null>(null);
  useEffect(() => {
    const kind = languagePackState.kind;
    if (kind === 'checking' || kind === 'installing' || announcedLanguagePackState.current === kind) return;
    announcedLanguagePackState.current = kind;
    AccessibilityInfo.announceForAccessibility?.(describeLanguagePackState(languagePackState));
  }, [languagePackState]);
  const isLoading = status === 'submitted' || status === 'streaming';
  useEffect(() => {
    if (status === 'submitted') AccessibilityInfo.announceForAccessibility?.('Melo is thinking.');
  }, [status]);
  const toneLabel = TONES.find((tn) => tn.id === savedTone)?.label ?? 'Calm';
  const starters = meloChatStarters(snapshot.workspaceKind ?? 'personal');
  function replaceDraft(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  async function startVoiceInput() {
    if (isLoading || voice.phase !== 'idle') return;
    Keyboard.dismiss();
    const result = await voice.requestStart();
    if (!voiceActive || result !== 'needs-phone-service-consent') return;
    Alert.alert(
      'Use your phone’s speech service?',
      'Your phone may send audio to its speech provider. Nothing is added or changed until you review the transcript and choose Create proposal.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void voice.startWithPhoneService();
          },
        },
      ],
    );
  }

  useEffect(() => {
    if (!showSettings) return;
    let active = true;
    setLanguagePackState({ kind: 'checking' });
    void getLocalLanguagePackState()
      .then((state) => {
        if (active) setLanguagePackState(state);
      })
      .catch(() => {
        if (active) {
          setLanguagePackState({
            kind: 'unavailable',
            message: 'The local language pack status could not be checked.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [showSettings]);

  async function installLanguagePack() {
    if (languagePackState.kind === 'installing') return;
    setLanguagePackState({ kind: 'installing', fraction: 0 });
    const result = await installLocalLanguagePack((progress) => {
      setLanguagePackState({ kind: 'installing', fraction: progress.fraction });
    });
    if (result.kind === 'ready') {
      setLanguagePackState({
        kind: 'installed',
        uri: result.uri,
        bytes: result.bytes,
        initialized: true,
      });
      return;
    }
    setLanguagePackState({ kind: 'download-failed', message: result.message });
  }

  // --- Tool approval gate -------------------------------------------------------------------------
  // Suggestions remain transcript-only until Confirm. Dismiss only settles the visible part.
  // `decidedRef` protects against double taps; a confirmed write keeps the existing 30s Undo window.
  const decidedRef = useRef<Set<string>>(new Set());
  const undoClaimedRef = useRef<Set<string>>(new Set());
  const turnRequestRef = useRef(0);
  const undoTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [undoMap, setUndoMap] = useState<Record<string, { undo: () => boolean | void }>>({});

  // Settle one still-pending part immutably. Dismissal deliberately carries no fake tool output;
  // confirmation carries the exact summary/reason returned by applyMeloTool.
  function recordToolSettlement(
    callId: string,
    settlement: MeloToolSuggestionSettlement,
    expectedPhase: 'pending' | 'applied' = 'pending',
  ) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.role !== 'assistant') return m;
        let changed = false;
        const parts = m.parts.map((p) => {
          if (!isToolPart(p)) return p;
          const id = p.toolCallId ?? `${m.id}-${p.type}`;
          if (id !== callId || getMeloToolSuggestionPhase(p) !== expectedPhase) return p;
          changed = true;
          if (settlement.state === MELO_TOOL_APPROVAL_DENIED) {
            const { output: _discardedOutput, ...withoutOutput } = p;
            return { ...withoutOutput, state: settlement.state };
          }
          return { ...p, state: settlement.state, output: settlement.output };
        });
        return changed ? { ...m, parts } : m;
      }),
    );
  }

  function dismissToolSuggestion(callId: string, suggestion: ToolPart) {
    if (decidedRef.current.has(callId)) return;
    const command = decideMeloToolSuggestion(suggestion, 'dismiss');
    if (command.type !== 'settle') return;
    decidedRef.current.add(callId);
    recordToolSettlement(callId, command.settlement);
  }

  function confirmToolSuggestion(callId: string, suggestion: ToolPart) {
    if (decidedRef.current.has(callId)) return;
    const command = decideMeloToolSuggestion(suggestion, 'confirm');
    if (command.type !== 'apply') return;
    decidedRef.current.add(callId);
    setConfirmingIds((prev) => new Set(prev).add(callId));
    AccessibilityInfo.announceForAccessibility?.('Recording change.');

    const name = suggestion.type.replace(/^tool-/, '');
    const paymentReview = suggestion.paymentReview;
    if (
      name === 'log_debt_payment' &&
      (!paymentReview ||
        !isMeloDebtPaymentReviewCurrent(getState(), paymentReview, new Date().toISOString()))
    ) {
      recordToolSettlement(
        callId,
        settleMeloToolApplication(
          false,
          'That wasn’t recorded. Your money picture is unchanged.',
        ),
      );
      setConfirmingIds((prev) => {
        const next = new Set(prev);
        next.delete(callId);
        return next;
      });
      return;
    }
    let result: ReturnType<typeof applyMeloTool>;
    try {
      result = applyMeloTool(
        name,
        paymentReview?.kind === 'ready' ? paymentReview.input : (suggestion.input ?? {}),
      );
    } catch {
      recordToolSettlement(
        callId,
        settleMeloToolApplication(
          false,
          'That wasn’t recorded. Your money picture is unchanged.',
        ),
      );
      setConfirmingIds((prev) => {
        const next = new Set(prev);
        next.delete(callId);
        return next;
      });
      return;
    }
    const outputMessage = result.applied
      ? `Recorded.\n${
          paymentReview?.kind === 'ready'
            ? `Payment recorded: ${formatMoney(paymentReview.paymentAmount, true)} to ${paymentReview.debtName}.\n${paymentReview.rows.map((row) => `${row.label}: ${formatMoney(row.before, true)} → ${formatMoney(row.after, true)}`).join('\n')}`
            : result.summary
        }`
      : 'That wasn’t recorded. Your money picture is unchanged.';
    recordToolSettlement(callId, settleMeloToolApplication(result.applied, outputMessage));
    setConfirmingIds((prev) => {
      const next = new Set(prev);
      next.delete(callId);
      return next;
    });

    if (!result.applied) {
      AccessibilityInfo.announceForAccessibility?.('Change was not recorded.');
      return;
    }
    AccessibilityInfo.announceForAccessibility?.('Change recorded. Undo available.');
    setUndoMap((prev) => ({ ...prev, [callId]: { undo: result.undo } }));
    undoTimers.current[callId] = setTimeout(() => {
      setUndoMap((prev) => {
        const { [callId]: _gone, ...rest } = prev;
        return rest;
      });
      delete undoTimers.current[callId];
    }, UNDO_WINDOW_MS);
  }

  // Clear any pending undo timers on unmount (no leaked timeouts when the sheet closes).
  useEffect(() => {
    const timers = undoTimers.current;
    return () => {
      for (const id of Object.keys(timers)) clearTimeout(timers[id]);
    };
  }, []);

  function runUndo(id: string) {
    if (undoClaimedRef.current.has(id)) return;
    const entry = undoMap[id];
    if (!entry) return;
    // Claim before invoking the store callback: a stale accessibility/onPress closure can fire
    // twice before React commits the state update that removes the Undo affordance.
    undoClaimedRef.current.add(id);
    try {
      if (entry.undo() === false) {
        undoClaimedRef.current.delete(id);
        Alert.alert(
          'Change kept',
          'The affected records changed after this action. Nothing was undone.',
        );
        return;
      }
    } catch (reason) {
      undoClaimedRef.current.delete(id);
      Alert.alert(
        'Change kept',
        reason instanceof Error ? reason.message : 'The action could not be undone safely.',
      );
      return;
    }
    recordToolSettlement(id, settleMeloToolUndo(), 'applied');
    AccessibilityInfo.announceForAccessibility?.('Change undone.');
    const timer = undoTimers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete undoTimers.current[id];
    }
    setUndoMap((prev) => {
      const { [id]: _gone, ...rest } = prev;
      return rest;
    });
  }

  // Deterministic finance first, with an optional on-device language pass. Neither the typed prompt
  // nor the aggregate result crosses a network boundary; any model output is gated before display.
  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    const requestId = turnRequestRef.current + 1;
    turnRequestRef.current = requestId;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      parts: [{ type: 'text', text: trimmed }],
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');

    setStatus('submitted');
    const buildTurn = (prompt: string): LocalMeloTurn =>
      buildLocalMeloTurn({
        prompt,
        snapshot,
        tone: savedTone,
        context: conversationContext,
        calculate,
        selectAccount,
        resolveSubscriptionAction: resolveMeloSubscriptionRequest,
        subscriptionState,
      });
    const deterministic = buildTurn(trimmed);
    let result = deterministic;
    try {
      result = await enrichLocalMeloTurn({
        prompt: trimmed,
        turn: deterministic,
        tone: savedTone,
        workspaceKind: snapshot.workspaceKind ?? 'personal',
        rerun: buildTurn,
      });
    } catch {
      // Local model installation, initialization or inference can fail without weakening the
      // deterministic Companion. The original authoritative turn remains the answer.
      result = deterministic;
    }
    if (turnRequestRef.current !== requestId) return;
    if (result.control === 'cancel' || result.control === 'back') {
      for (const message of messages) {
        for (const part of message.parts) {
          if (!isToolPart(part) || getMeloToolSuggestionPhase(part) !== 'pending') continue;
          decidedRef.current.add(part.toolCallId ?? `${message.id}-${part.type}`);
        }
      }
      setMessages((prev) =>
        prev.map((message) => ({
          ...message,
          parts: message.parts.map((part) => {
            if (!isToolPart(part) || getMeloToolSuggestionPhase(part) !== 'pending') return part;
            const { output: _discardedOutput, ...withoutOutput } = part;
            return { ...withoutOutput, state: MELO_TOOL_APPROVAL_DENIED };
          }),
        })),
      );
    }
    setConversationContext(result.context);
    const presentedResult = { ...result, reply: presentMeloReply(result) };
    setMessages((prev) => [
      ...prev,
      {
        ...assistantMessageFromResult(presentedResult),
        sourcePrompt: trimmed,
        ...(presentedResult.intent === 'explain_position' &&
        snapshot.workspaceKind !== 'business' &&
        snapshot.setupComplete !== false
          ? { sourceRows }
          : {}),
      },
    ]);
    if (presentedResult.suggestions.length > 0) {
      AccessibilityInfo.announceForAccessibility?.('Proposal ready. Nothing has changed.');
    }
    setStatus('ready');
}

function runAssistantAction(action: MeloLocalAiAction, intent: MeloLocalIntent) {
    const destination = resolveMeloLocalAction(action.kind, intent);
    if (destination.kind === 'screen') {
      nav.go(destination.screen);
      return;
    }
    if (destination.kind === 'sheet') {
      nav.openSheet(destination.sheet);
      return;
    }
    if (destination.kind === 'external') {
      void Linking.openURL(destination.url).catch(() => undefined);
      return;
    }
    void send(destination.prompt);
  }

  // Kept for the shared submit-button contract; local turns settle immediately.
  function stop() {
    turnRequestRef.current += 1;
    setStatus('ready');
  }

  // Clear the transcript. The web design guarded this behind window.confirm("Clear this
  // conversation?"); the RN equivalent is Alert.alert with a confirm button, so the clear only
  // happens once the user taps "Clear". This is the low-stakes CONVERSATION clear (the seed
  // re-appears next open) — NOT the data wipe — so the dialog is light, with a plain Cancel.
  function performClear() {
    turnRequestRef.current += 1;
    setStatus('ready');
    for (const id of Object.keys(undoTimers.current)) clearTimeout(undoTimers.current[id]);
    undoTimers.current = {};
    decidedRef.current = new Set();
    setUndoMap({});
    setDismissedFailureIds(new Set());
    setConfirmingIds(new Set());
    setConversationContext(null);
    setMessages([]);
  }

  function startFresh() {
    Alert.alert(
      'Start a fresh conversation?',
      'This clears this conversation only. Your money, settings and recorded changes stay as they are.',
      [
        { text: 'Keep conversation', style: 'cancel' },
        { text: 'Start fresh', style: 'destructive', onPress: performClear },
      ],
    );
  }

  // --- Stick-to-bottom transcript + scroll-to-bottom affordance. ----------------------------------
  const scrollRef = bodyScrollRef;
  const hasDraft = input.length > 0;
  const [atBottom, setAtBottom] = useState(true);
  const scrollOffsetRef = useRef(0);
  const settingsReturnOffsetRef = useRef(0);
  function toggleSettings() {
    if (!showSettings) settingsReturnOffsetRef.current = scrollOffsetRef.current;
    setShowSettings((open) => !open);
  }
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: showSettings ? 0 : settingsReturnOffsetRef.current,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [showSettings]);
  useEffect(() => {
    if (!keyboardVisible || !atBottom || showSettings) return;
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [keyboardVisible, composerHeight, draftHeight, hasDraft, atBottom, showSettings]);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);

  function scrollToEnd(animated: boolean) {
    scrollRef.current?.scrollToEnd({ animated: animated && !reduceMotion });
  }

  // New message or loading state arrives → stick to the bottom if we were already there.
  useEffect(() => {
    if (atBottom) scrollToEnd(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status]);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    scrollOffsetRef.current = contentOffset.y;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setAtBottom(distanceFromBottom <= SCROLL_BOTTOM_EPSILON);
  }

  bodyHandlersRef.current = {
    onScroll,
    onContentSizeChange: (_w, h) => {
      contentHeight.current = h;
      if (atBottom && !showSettings) scrollToEnd(false);
    },
    onLayout: (e) => {
      viewportHeight.current = e.nativeEvent.layout.height;
    },
  };
  terminalAlignmentRef.current = atBottom || hasDraft || isLoading || voice.phase !== 'idle';

  const showEmpty = messages.length === 0 && !isLoading;
  // The opening money question remains readable while its first reply is being typed.
  const typingContext =
    keyboardVisible && messages.length === 1 && messages[0]?.id.startsWith('seed-')
      ? partsToText(messages[0])
      : null;

  const voiceTrigger = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Use voice"
      accessibilityHint="Starts one voice transcription after checking this phone"
      disabled={isLoading || voice.phase !== 'idle'}
      onPress={() => void startVoiceInput()}
      style={({ pressed }) => [
        s.voiceTrigger,
        (isLoading || voice.phase !== 'idle') && s.voiceTriggerDisabled,
        pressed && s.voiceTriggerPressed,
      ]}
      hitSlop={4}
    >
      <Text style={s.voiceTriggerGlyph}>●</Text>
      <Text style={s.voiceTriggerLabel}>Voice</Text>
    </Pressable>
  );
  const inputField = (
    <View style={[s.inputWrap, stackComposer ? s.inputWrapStacked : undefined]}>
      <TextInput
        ref={inputRef}
        value={input}
        onChangeText={setInput}
        placeholder="Say anything to Melo…"
        placeholderTextColor={t.muted}
        editable={!isLoading && voice.phase === 'idle'}
        multiline
        selectTextOnFocus={Boolean(prefill && input === prefill)}
        autoFocus={process.env.EXPO_PUBLIC_MELO_PARITY_CAPTURE !== 'true'}
        style={s.input}
        accessibilityLabel="Message Melo"
        onSubmitEditing={() => send(input)}
        returnKeyType="send"
        submitBehavior="submit"
      />
    </View>
  );
  const submitButton = (
    <View style={s.submitRow}>
      <SubmitButton
        onPress={() => send(input)}
        isLoading={isLoading}
        disabled={!input.trim() && !isLoading}
        palette={t}
        reduceMotion={reduceMotion}
        onStop={stop}
      />
    </View>
  );

  return (
    <View style={s.body}>
      {/* Header */}
      <View style={s.header}>
        <Melo mood="calm" size={36} grounded={false} />
        <View style={s.headerText}>
          <Text style={s.headerTitle}>{copy.global.melo.name}</Text>
          <Text style={s.headerSub}>{`On this phone · ${toneLabel}`}</Text>
        </View>
        <PressText
          label={showSettings ? 'Done' : 'Tune'}
          onPress={toggleSettings}
          style={s.tune}
          labelStyle={s.tuneLabel}
          reduceMotion={reduceMotion}
          accessibilityLabel="Chat settings"
          accessibilityState={{ expanded: showSettings }}
        />
      </View>

      {/* Transcript */}
      <View
        style={[
          s.transcript,
          showEmpty && keyboardVisible && !showSettings
            ? { flex: 0 }
            : undefined,
        ]}
      >
        <View style={s.scrollContent}>
      {typingContext ? (
        <View style={{ flexShrink: 0, paddingVertical: gap.sm }}>
          <Text style={{ color: t.ink, fontSize: 14, lineHeight: 20 }}>{typingContext}</Text>
        </View>
      ) : null}
      {/* Settings panel */}
      {showSettings ? (
        <View style={s.settings}>
          <View>
            <Text style={s.sectionLabel}>Tone</Text>
            <View style={[s.toneRow, stackComposer ? s.toneRowStacked : undefined]}>
              {TONES.map((tn) => (
                <ToneButton
                  key={tn.id}
                  label={tn.label}
                  selected={savedTone === tn.id}
                  onPress={() => setMelo({ tone: tn.id })}
                  styles={s}
                  reduceMotion={reduceMotion}
                />
              ))}
            </View>
            <Text style={s.toneDescription}>{describeMeloTone(savedTone)}</Text>
          </View>

          <View style={s.languagePackRow}>
            <View style={s.languagePackCopy}>
              <Text style={s.languagePackTitle}>Natural conversation</Text>
              <Text style={s.languagePackHelper}>
                An optional on-device language pack lets Melo talk more naturally. Your money answers don't depend on it.
              </Text>
              <Text style={s.languagePackBody}>{describeLanguagePackState(languagePackState)}</Text>
            </View>
            {languagePackState.kind === 'not-installed' ||
            languagePackState.kind === 'invalid' ||
            languagePackState.kind === 'download-failed' ? (
              <PressText
                label={
                  languagePackState.kind === 'invalid'
                    ? 'Download again'
                    : languagePackState.kind === 'download-failed'
                      ? 'Try download again'
                      : 'Download pack'
                }
                onPress={() =>
                  Alert.alert(
                    'Download this language pack?',
                    'This downloads a 647 MB language pack from the model host.\n\nOnly the public pack file is downloaded. Your messages, transcripts, money and identifiers are not sent.',
                    [
                      { text: 'Not now', style: 'cancel' },
                      { text: 'Download', onPress: () => void installLanguagePack() },
                    ],
                  )
                }
                style={s.languagePackAction}
                labelStyle={s.languagePackActionLabel}
                reduceMotion={reduceMotion}
                accessibilityLabel="Download language pack"
              />
            ) : null}
          </View>

          {messages.length > 0 && Object.keys(undoMap).length === 0 ? (
            <PressText
              label="Start fresh"
              onPress={startFresh}
              style={s.startFresh}
              labelStyle={s.startFreshLabel}
              reduceMotion={reduceMotion}
              accessibilityLabel="Start fresh"
            />
          ) : null}
        </View>
      ) : null}


          {/* Empty — Fraunces-italic prompt + 4 tappable starter chips. */}
          {showEmpty && !keyboardVisible ? (
            <View style={s.empty}>
              <Text style={s.emptyHeadline}>What's on your mind?</Text>
              <View style={s.starters}>
                {starters.map((starter) => (
                  <StarterChip
                    key={starter}
                    label={starter}
                    onPress={() => replaceDraft(starter)}
                    styles={s}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {(typingContext ? [] : messages).map((m) => {
            const text = partsToText(m);
            const followUpChips = filterMeloFollowUpChips(m.actions ?? [], m.followUpChips ?? []);
            if (m.role === 'user') {
              return (
                <FadeIn key={m.id} reduceMotion={reduceMotion} style={s.userRow}>
                  <View style={[s.userBubble, { maxWidth: stackComposer ? '92%' : '82%' }]}>
                    <Text style={s.userText}>{text}</Text>
                  </View>
                </FadeIn>
              );
            }
            // Assistant: prose text + any tool calls as inline pills.
            const toolParts = m.parts.filter(isToolPart);
            return (
              <FadeIn key={m.id} reduceMotion={reduceMotion} style={s.assistant}>
                {text ? <Text style={s.assistantText}>{text}</Text> : null}
                {m.sourceRows && m.sourceRows.length > 0 ? (
                  <View style={s.sourceFigures}>
                    <PressText
                      label={
                        expandedSources.has(m.id)
                          ? 'Hide named costs'
                          : `See named costs · ${m.sourceRows.length}`
                      }
                      onPress={() =>
                        setExpandedSources((previous) => {
                          const next = new Set(previous);
                          if (next.has(m.id)) next.delete(m.id);
                          else next.add(m.id);
                          return next;
                        })
                      }
                      style={s.sourceToggle}
                      labelStyle={s.sourceToggleLabel}
                      reduceMotion={reduceMotion}
                      accessibilityLabel={
                        expandedSources.has(m.id)
                          ? 'Hide named costs'
                          : 'Show named costs and due dates'
                      }
                    />
                    {expandedSources.has(m.id)
                      ? m.sourceRows.map((row) => (
                          <Pressable
                            key={row.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${row.label}, ${row.amount}, ${row.detail}. Open details`}
                            onPress={() => nav.go(row.destination)}
                            style={s.sourceFigureRow}
                          >
                            <View style={s.sourceFigureCopy}>
                              <Text style={s.sourceFigureName}>{row.label}</Text>
                              <Text style={s.sourceFigureDetail}>
                                {row.detail} · Open details ›
                              </Text>
                            </View>
                            <Text style={s.sourceFigureAmount}>{row.amount}</Text>
                          </Pressable>
                        ))
                      : null}
                  </View>
                ) : null}
                {toolParts.map((tp, i) => {
                  const toolName = tp.type.replace(/^tool-/, '');
                  const name = toolName.replace(/_/g, ' ');
                  const callId = tp.toolCallId ?? `${m.id}-${tp.type}`;
                  const phase = getMeloToolSuggestionPhase(tp);
                  const isPending = phase === 'pending';
                  const paymentReview = tp.paymentReview;
                  const paymentUnavailable =
                    toolName === 'log_debt_payment' && paymentReview?.kind !== 'ready';
                  const canUndo = phase === 'applied' && !!undoMap[callId];
                  const failureDismissed = dismissedFailureIds.has(callId);
                  const confirming = confirmingIds.has(callId);
                  const glyph =
                    phase === 'applied'
                      ? '✓'
                      : phase === 'undone'
                        ? '↶'
                        : phase === 'failed' || phase === 'unavailable'
                          ? '!'
                          : phase === 'dismissed'
                            ? '–'
                            : '→';
                  const resultText = isPending
                    ? paymentReview?.kind === 'ready'
                      ? 'Review this completed payment'
                      : paymentReview?.kind === 'unavailable'
                        ? paymentReview.message
                        : describeMeloToolSuggestion(toolName, tp.input ?? {})
                    : phase === 'dismissed'
                      ? 'Not changed.'
                      : phase === 'unavailable'
                        ? 'This suggestion is unavailable.'
                        : (tp.output?.message ?? 'No change was made.');
                  return (
                    failureDismissed ? null :
                    <View key={`${callId}-${i}`} style={s.toolPill}>
                      <Text style={s.toolTick}>{glyph}</Text>
                      <View style={s.toolTextCol}>
                        <Text style={s.toolName}>{isPending ? 'Proposed change' : name}</Text>
          <Text style={s.toolResult} accessibilityLiveRegion="polite">
                          {resultText}
                        </Text>
                        {isPending ? (
                          <>
                            {paymentReview?.kind === 'ready' ? (
                              <View style={s.paymentReview}>
                                <Text style={s.paymentDetail}>
                                  Payment amount: {formatMoney(paymentReview.paymentAmount, true)}
                                </Text>
                                <Text style={s.paymentDetail}>
                                  Linked debt: {paymentReview.debtName}
                                </Text>
                                <Text style={s.paymentDetail}>
                                  Paid from: {paymentReview.cashAccountName}
                                </Text>
                                {paymentReview.rows.map((row) => (
                                  <View key={row.label} style={s.paymentRow}>
                                    <Text style={s.paymentRowLabel}>{row.label}</Text>
                                    <Text style={s.paymentRowAmount}>
                                      {formatMoney(row.before, true)} →{' '}
                                      {formatMoney(row.after, true)}
                                    </Text>
                                  </View>
                                ))}
                                <Text style={s.paymentDetail}>{paymentReview.explanation}</Text>
                              </View>
                            ) : null}
                            <Text style={s.toolHint}>Nothing changes until you confirm.</Text>
                            <View style={s.toolActions}>
                              <PressText
                                label="Dismiss"
                                onPress={() => dismissToolSuggestion(callId, tp)}
                                style={s.toolDismiss}
                                labelStyle={s.toolDismissLabel}
                                reduceMotion={reduceMotion}
                                accessibilityLabel={`Dismiss ${name} suggestion`}
                                accessibilityHint="Leaves your money records unchanged"
                                disabled={confirming}
                              />
                              <PressText
                                label={
                                  paymentUnavailable
                                    ? 'Log a payment'
                                    : paymentReview?.kind === 'ready'
                                      ? paymentReview.excess > 0
                                        ? 'Record overpayment'
                                        : 'Record payment'
                                      : 'Confirm'
                                }
                                onPress={() =>
                                  paymentUnavailable
                                    ? nav.openSheet('log-payment')
                                    : confirmToolSuggestion(callId, tp)
                                }
                                style={s.toolConfirm}
                                labelStyle={s.toolConfirmLabel}
                                reduceMotion={reduceMotion}
                                accessibilityLabel={
                                  paymentUnavailable
                                    ? 'Open Log a payment to review details'
                                    : paymentReview?.kind === 'ready'
                                      ? paymentReview.excess > 0
                                        ? 'Confirm and record this overpayment'
                                        : 'Confirm and record this payment'
                                      : `Confirm ${name} suggestion`
                                }
                                accessibilityHint="Records this change in Melo"
                                disabled={confirming}
                              />
                            </View>
                          </>
                        ) : null}
                        {phase === 'failed' && !failureDismissed ? (
                          <View style={s.toolActions}>
                            <PressText
                              label="Dismiss"
                              onPress={() =>
                                setDismissedFailureIds((prev) => new Set(prev).add(callId))
                              }
                              style={s.toolDismiss}
                              labelStyle={s.toolDismissLabel}
                              reduceMotion={reduceMotion}
                              accessibilityLabel="Dismiss failed change"
                            />
                            <PressText
                              label="Try again"
                              onPress={() => replaceDraft(m.sourcePrompt ?? '')}
                              style={s.toolConfirm}
                              labelStyle={s.toolConfirmLabel}
                              reduceMotion={reduceMotion}
                              accessibilityLabel="Try this change again"
                            />
                          </View>
                        ) : null}
                      </View>
                      {canUndo ? (
                        <PressText
                          label="Undo"
                          onPress={() => runUndo(callId)}
                          style={s.undo}
                          labelStyle={s.undoLabel}
                          reduceMotion={reduceMotion}
                          accessibilityLabel="Undo this change"
                        />
                      ) : null}
                    </View>
                  );
                })}
                {m.role === 'assistant' && m.intent && (m.actions?.length ?? 0) > 0 ? (
                  <View style={s.localActionList}>
                    {m.actions?.map((action) => (
                      <PressText
                        key={`${m.id}-${action.kind}-${action.label}`}
                        label={action.label}
                        onPress={() => runAssistantAction(action, m.intent!)}
                        style={s.localAction}
                        labelStyle={s.localActionLabel}
                        reduceMotion={reduceMotion}
                        accessibilityLabel={action.label}
                        accessibilityHint={action.detail}
                      />
                    ))}
                  </View>
                ) : null}
                {m.role === 'assistant' && followUpChips.length > 0 ? (
                  <View style={s.followUpList}>
                    {followUpChips.map((chip) => (
                      <StarterChip
                        key={`${m.id}-${chip}`}
                        label={chip}
                        onPress={() => replaceDraft(chip)}
                        styles={s}
                        reduceMotion={reduceMotion}
                      />
                    ))}
                  </View>
                ) : null}
              </FadeIn>
            );
          })}

          {/* Loading — Shimmer text only, never a spinner (STATES.md). */}
          {status === 'submitted' ? (
            <View style={s.thinking}>
              <Shimmer text="Melo is thinking…" palette={t} reduceMotion={reduceMotion} />
            </View>
          ) : null}

          {/* Error — accent-coloured line. */}
        </View>

      </View>

      {showEmpty && keyboardVisible ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => Keyboard.dismiss()}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={{ color: t.calmStrong }}>Show suggested questions</Text>
        </Pressable>
      ) : null}
      {voice.phase === 'starting' || voice.phase === 'listening' || voice.phase === 'processing' ? (
        <View
          style={s.voiceListening}
          accessibilityRole="summary"
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            voice.phase === 'listening'
              ? 'Listening for voice input'
              : voice.phase === 'processing'
                ? 'Finishing voice transcript'
                : 'Starting voice input'
          }
        >
          <View style={s.voiceListeningHeader}>
            <View style={s.voiceRecordingDot} />
            <View style={s.voiceListeningCopy}>
              <Text style={s.voiceListeningTitle}>
                {voice.phase === 'listening'
                  ? 'Listening…'
                  : voice.phase === 'processing'
                    ? 'Processing…'
                    : 'Starting…'}
              </Text>
              <Text style={s.voicePrivacyLine}>
                {voice.route === 'on-device'
                  ? 'On this phone · audio is not saved'
                  : 'Phone speech service · audio is not saved by Melo'}
              </Text>
            </View>
            {voice.phase === 'listening' ? (
              <PressText
                label="Stop"
                onPress={voice.stop}
                style={s.voiceStop}
                labelStyle={s.voiceStopLabel}
                reduceMotion={reduceMotion}
                accessibilityLabel="Stop listening"
              />
            ) : null}
          </View>
          {voice.transcript ? (
            <Text style={s.voiceLiveTranscript}>{voice.transcript}</Text>
          ) : (
            <Text style={s.voiceListeningHint}>
              Speak now. Melo will not send this automatically.
            </Text>
          )}
        </View>
      ) : null}

      {voice.phase === 'review' ? (
        <View style={s.voiceReview} accessibilityLiveRegion="polite">
          <Text style={s.voiceReviewTitle}>Review what Melo heard</Text>
          <Text style={s.voiceReviewBody}>
            Edit anything before creating a proposal. Nothing has been sent or changed.
          </Text>
          <TextInput
            value={voice.transcript}
            onChangeText={voice.setTranscript}
            multiline
            autoFocus
            style={s.voiceReviewInput}
            accessibilityLabel="Editable voice transcript"
          />
          <View style={s.voiceReviewActions}>
            <PressText
              label="Discard"
              onPress={voice.discard}
              style={s.voiceDiscard}
              labelStyle={s.voiceDiscardLabel}
              reduceMotion={reduceMotion}
              accessibilityLabel="Discard voice transcript"
              accessibilityHint="Deletes the transcript draft and makes no change"
            />
            <PressText
              label="Create proposal"
              onPress={() => {
                const reviewedTranscript = voice.transcript.trim();
                if (!reviewedTranscript) return;
                voice.discard();
                void send(reviewedTranscript);
              }}
              style={s.voiceCreateProposal}
              labelStyle={s.voiceCreateProposalLabel}
              reduceMotion={reduceMotion}
              accessibilityLabel="Create proposal from reviewed transcript"
              accessibilityHint="Sends the edited words to Melo; you must review and confirm any suggestion separately"
            />
          </View>
        </View>
      ) : null}

      {voice.error ? (
        <View
          style={s.voiceErrorBlock}
        >
          <Text ref={voiceErrorRef} style={s.voiceError} accessibilityRole="alert" accessibilityLiveRegion="polite">{voice.error}</Text>
          {voice.permissionDenied ? (
            <View style={s.voiceErrorActions}>
              <PressText
                label="Not now"
                onPress={voice.discard}
                style={s.voiceErrorSecondary}
                labelStyle={s.voiceErrorSecondaryLabel}
                reduceMotion={reduceMotion}
                accessibilityLabel="Not now"
              />
              <PressText
                label="Open settings"
                onPress={() => void Linking.openSettings()}
                style={s.voiceErrorPrimary}
                labelStyle={s.voiceErrorPrimaryLabel}
                reduceMotion={reduceMotion}
                accessibilityLabel="Open microphone settings"
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Composer */}
      {input.length > 0 ? (
        <View
          style={s.draftActions}
          onLayout={(event) => setDraftHeight(event.nativeEvent.layout.height)}
        >
          <Text style={s.draftHint}>Draft · edit or clear before sending</Text>
          <PressText
            label="Clear"
            onPress={() => replaceDraft('')}
            style={s.sourceToggle}
            labelStyle={s.sourceToggleLabel}
            reduceMotion={reduceMotion}
            accessibilityLabel="Clear the message draft"
          />
        </View>
      ) : null}
      <View
        style={[s.composer, stackComposer ? s.composerStacked : undefined]}
        onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
      >
        {stackComposer ? (
          <>
            {inputField}
            <View style={s.composerControls}>
              {voiceTrigger}
              {submitButton}
            </View>
          </>
        ) : (
          <>
            {voiceTrigger}
            {inputField}
            {submitButton}
          </>
        )}
      </View>
      <View ref={terminalRef} collapsable={false} style={s.terminalSpacer} />
    </View>
  );
}

function describeLanguagePackState(
  state:
    | LocalLanguagePackState
    | Readonly<{ kind: 'checking' | 'installing'; fraction?: number }>
    | Readonly<{ kind: 'download-failed'; message: string }>,
): string {
  switch (state.kind) {
    case 'checking':
      return 'Checking this phone…';
    case 'installing':
      return `Downloading… ${Math.round((state.fraction ?? 0) * 100)}%`;
    case 'installed':
      return 'Installed on this phone';
    case 'not-installed':
      return 'Not installed · 647 MB download';
    case 'invalid':
      return "The downloaded pack didn't check out. Nothing was changed.";
    case 'download-failed':
      return state.message;
    case 'unavailable':
      return 'Not available in this build.';
  }
}

// Turn an ok result into one assistant message: the prose text part (when non-empty) plus one explicit
// approval request per advisory suggestion. These are transcript-only until the user presses Confirm.
function assistantMessageFromResult(result: LocalMeloTurn): ChatMessage {
  const baseId = `a-${Date.now()}`;
  const parts: ChatPart[] = [];
  const prose = result.reply.trim();
  if (prose.length > 0) parts.push({ type: 'text', text: prose });
  result.suggestions.forEach((suggestion) => {
    const callId = `${baseId}-${suggestion.id}`;
    const input = suggestion.args as Record<string, unknown>;
    parts.push({
      type: `tool-${suggestion.name}`,
      state: MELO_TOOL_APPROVAL_REQUESTED,
      toolCallId: callId,
      input,
      ...(suggestion.name === 'log_debt_payment'
        ? {
            paymentReview: prepareMeloDebtPaymentReview(
              getState(),
              input,
              new Date().toISOString(),
              `chat-payment-${callId}`,
            ),
          }
        : {}),
    });
  });
  return {
    id: baseId,
    role: 'assistant',
    parts,
    intent: result.intent,
    actions: result.actions,
    followUpChips: result.followUpChips,
  };
}

// ---------------------------------------------------------------------------
// Tone button — grid cell, selected = --ink fill / --paper text; else --inset / --ink.
// ---------------------------------------------------------------------------

function ToneButton({
  label,
  selected,
  onPress,
  styles: s,
  reduceMotion,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  reduceMotion: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  function press(to: number) {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, { toValue: to, duration: 120, useNativeDriver: true }).start();
  }
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => press(PRESS_SCALE)}
      onPressOut={() => press(1)}
      style={s.toneCell}
    >
      <Animated.View
        style={[s.tone, selected ? s.toneSelected : s.toneUnselected, { transform: [{ scale }] }]}
      >
        <Text style={selected ? s.toneLabelSelected : s.toneLabelUnselected}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Starter chip — full-width left-aligned inset row; .press scale.
// ---------------------------------------------------------------------------

function StarterChip({
  label,
  onPress,
  styles: s,
  reduceMotion,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  reduceMotion: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  function press(to: number) {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, { toValue: to, duration: 120, useNativeDriver: true }).start();
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => press(PRESS_SCALE)}
      onPressOut={() => press(1)}
    >
      <Animated.View style={[s.starter, { transform: [{ scale }] }]}>
        <Text style={s.starterText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// PressText — a compact tappable with the .press scale (Tune, decisions, Undo, Start fresh).
// ---------------------------------------------------------------------------

function PressText({
  label,
  onPress,
  style,
  labelStyle,
  reduceMotion,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  accessibilityState,
}: {
  label: string;
  onPress: () => void;
  style: object;
  labelStyle: object;
  reduceMotion: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  accessibilityState?: { disabled?: boolean; expanded?: boolean; selected?: boolean };
}) {
  const scale = useRef(new Animated.Value(1)).current;
  function press(to: number) {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, { toValue: to, duration: 120, useNativeDriver: true }).start();
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      accessibilityState={{ disabled, ...accessibilityState }}
      onPress={onPress}
      onPressIn={() => press(PRESS_SCALE)}
      onPressOut={() => press(1)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View
        style={[
          style,
          { minHeight: 44, minWidth: 44, justifyContent: 'center' },
          disabled && { opacity: 0.55 },
          { transform: [{ scale }] },
        ]}
      >
        <Text style={labelStyle}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Submit button — circular send; loading shows a stop square (web SubmitButton status='streaming').
// ---------------------------------------------------------------------------

function SubmitButton({
  onPress,
  isLoading,
  disabled,
  palette: t,
  reduceMotion,
  onStop,
}: {
  onPress: () => void;
  isLoading: boolean;
  disabled: boolean;
  palette: Palette;
  reduceMotion: boolean;
  onStop: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  function press(to: number) {
    if (reduceMotion || disabled) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, { toValue: to, duration: 120, useNativeDriver: true }).start();
  }
  const idleFill = disabled ? `${t.muted}4D` : t.ink; // disabled = --muted-ink @ 30%
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isLoading ? 'Stop' : 'Send message'}
      accessibilityState={{ disabled }}
      disabled={disabled && !isLoading}
      onPress={isLoading ? onStop : onPress}
      onPressIn={() => press(PRESS_SCALE)}
      onPressOut={() => press(1)}
    >
      <Animated.View
        style={[
          submitStyles.button,
          { backgroundColor: isLoading ? t.calm : idleFill, transform: [{ scale }] },
        ]}
      >
        {isLoading ? (
          <View style={[submitStyles.stop, { backgroundColor: t.inverse }]} />
        ) : (
          <Text style={[submitStyles.arrow, { color: t.inverse }]}>↑</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const submitStyles = StyleSheet.create({
  arrow: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  button: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stop: {
    borderRadius: 2,
    height: 10,
    width: 10,
  },
});

// ---------------------------------------------------------------------------
// Shimmer — the "Melo's thinking…" loading line (web Shimmer: a moving highlight over the text).
// A muted base with a calm-tinted highlight Text sweeping left→right on a 2s loop; reduce-motion
// collapses to the resolved muted line (MOTION.md).
// ---------------------------------------------------------------------------

function Shimmer({
  text,
  palette: t,
  reduceMotion,
}: {
  text: string;
  palette: Palette;
  reduceMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SHIMMER_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View
      style={shimmerStyles.wrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={text}
    >
      <Text style={[shimmerStyles.base, { color: t.muted }]}>{text}</Text>
      {!reduceMotion && width > 0 ? (
        <Animated.Text
          style={[
            shimmerStyles.base,
            shimmerStyles.highlight,
            { color: t.ink, transform: [{ translateX }] },
          ]}
          numberOfLines={1}
        >
          {text}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const shimmerStyles = StyleSheet.create({
  base: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  highlight: {
    bottom: 0,
    left: 0,
    opacity: 0.9,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  wrap: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
});

// ---------------------------------------------------------------------------
// FadeIn — the per-bubble message fade-in (web @motion 'message fade-in'). Reduce-motion = at rest.
// ---------------------------------------------------------------------------

function FadeIn({
  children,
  reduceMotion,
  style,
}: {
  children: React.ReactNode;
  reduceMotion: boolean;
  style: object;
}) {
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 6)).current;
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: FADE_IN_MS, useNativeDriver: true }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: FADE_IN_MS,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, reduceMotion]);
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles — colour-bearing, resolved against the active palette. Spacing/radius from kit tokens only.
// Web → kit token map (web px → kit): pb-3=md(12) · gap-3=md(12) · py-3=md(12) · space-y-3=md(12) ·
// mb-2=sm(8) · gap-1.5=xs+xxs(6) · h-8=32 · rounded-lg≈radius.md(12) · px-3.5≈14 · py-2.5≈10 ·
// rounded-xl=radius.md(12) · px-3=md(12) · py-2=sm(8) · rounded-2xl=radius.xl(24) (bubble) ·
// rounded-br-md → square the bottom-right (radius.md) · pt-2=sm(8) · p-1.5≈6. The web --paper maps
// to the kit `canvas`, --inset to `inset`, --muted-ink to `muted`, --accent to `calm`.
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
    sourceFigures: {
      marginTop: gap.md,
      borderColor: t.hairline,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    sourceToggle: { minHeight: 48, justifyContent: 'center', paddingHorizontal: gap.md },
    sourceToggleLabel: { color: t.calm, fontSize: 14, fontWeight: '500' },
    sourceFigureRow: {
      minHeight: 56,
      padding: gap.md,
      flexDirection: 'row',
      gap: gap.sm,
      alignItems: 'flex-start',
      borderTopColor: t.hairline,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    sourceFigureCopy: { flex: 1, minWidth: 0 },
    sourceFigureName: { color: t.ink, fontSize: 14, lineHeight: 20 },
    sourceFigureDetail: { color: t.muted, fontSize: 12, lineHeight: 18 },
    sourceFigureAmount: { color: t.ink, fontSize: 14, fontVariant: ['tabular-nums'] },
    draftActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: gap.sm,
    },
    draftHint: { flex: 1, color: t.muted, fontSize: 12, lineHeight: 17 },
    assistant: {
      gap: gap.sm,
      marginVertical: gap.sm,
    },
    assistantText: {
      color: t.ink,
      fontSize: 16,
      lineHeight: 23,
    },
    followUpList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.xs + gap.xxs,
    },
    localAction: {
      backgroundColor: t.calmSoft,
      borderColor: t.calm,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      minHeight: 44,
      paddingHorizontal: gap.md,
      paddingVertical: gap.sm,
    },
    localActionLabel: {
      color: t.ink,
      fontSize: 12,
      fontWeight: '600',
    },
    localActionList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.xs + gap.xxs,
    },
    body: {
      // The web sheet is h-[640px] max-h-[78vh]; the kit Sheet already caps height (85% window) and
      // scrolls inside, so the body fills the available column rather than pinning a px height.
      // Use a zero flex basis so the transcript is the part that yields when the measured
      // keyboard viewport gets shorter. With an auto basis, the draft/header content can make the
      // body shrink while its stacked composer keeps its natural position below the IME.
      flexGrow: 1,
      minHeight: 0,
    },
    composer: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      // The composer is a sibling of the transcript. Keep its controls in the measured body and
      // let only the transcript yield to the keyboard rather than shrinking Voice/Send children.
      flexShrink: 0,
      gap: gap.md,
      paddingTop: gap.sm,
    },
    composerStacked: {
      alignItems: 'stretch',
      flexDirection: 'column',
    },
    composerControls: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
    },
    emptyHeadline: {
      color: t.ink,
      fontFamily: serif.displayItalic,
      fontSize: 16,
      fontStyle: 'italic',
      lineHeight: 21,
    },
    empty: {
      gap: gap.lg,
      paddingVertical: gap.xl,
    },
    errorText: {
      color: t.calm,
      fontSize: 12,
      marginVertical: gap.sm,
    },
    header: {
      alignItems: 'center',
      minHeight: 72,
      borderBottomColor: t.hairline,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: gap.md,
      paddingBottom: gap.md,
    },
    headerSub: {
      color: t.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    headerTitle: {
      color: t.ink,
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 23,
    },
    input: {
      color: t.ink,
      fontSize: 16,
      lineHeight: 23,
      maxHeight: 144,
      minHeight: 56,
      paddingVertical: 0,
    },
    inputWrapStacked: {
      alignSelf: 'stretch',
      flex: 0,
      width: '100%',
    },
    inputWrap: {
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      paddingHorizontal: gap.md,
      paddingVertical: gap.sm,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: gap.xs,
      paddingVertical: gap.lg,
    },
    terminalSpacer: { height: gap.md, flexShrink: 0 },
    sectionLabel: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: 1.6, // tracking-[0.14em] on an 11.5px label
      lineHeight: 16,
      marginBottom: gap.sm,
      textTransform: 'uppercase',
    },
    languagePackAction: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.pill,
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: gap.md,
    },
    languagePackActionLabel: {
      color: t.ink,
      fontSize: 11.5,
      fontWeight: '600',
    },
    languagePackBody: {
      color: t.muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 2,
    },
    languagePackHelper: {
      color: t.muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: gap.xs,
    },
    languagePackCopy: {
      flex: 1,
      paddingRight: gap.md,
    },
    languagePackRow: {
      alignItems: 'center',
      borderTopColor: t.hairline,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      paddingTop: gap.md,
    },
    languagePackTitle: {
      color: t.ink,
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 23,
    },
    settings: {
      borderBottomColor: t.hairline,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: gap.md,
      paddingVertical: gap.md,
    },
    shareBody: {
      color: t.muted,
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: 2,
    },
    shareRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.md,
      justifyContent: 'space-between',
    },
    shareText: {
      flex: 1,
    },
    shareTitle: {
      color: t.ink,
      fontSize: 13,
    },
    starter: {
      alignItems: 'flex-start',
      backgroundColor: t.inset,
      borderRadius: radius.md,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    starterText: {
      color: t.ink,
      fontSize: 13,
    },
    starters: {
      gap: gap.xs + gap.xxs, // gap-1.5 = 6
    },
    startFresh: {
      alignSelf: 'flex-start',
    },
    startFreshLabel: {
      color: t.muted,
      fontSize: 12,
      textDecorationLine: 'underline',
    },
    submitRow: {
      alignItems: 'flex-end',
      minHeight: 44,
      paddingBottom: gap.xxs,
    },
    thinking: {
      marginVertical: gap.sm,
    },
    tone: {
      alignItems: 'center',
      borderRadius: radius.md,
      justifyContent: 'center',
      minHeight: 44,
    },
    toneCell: {
      flex: 1,
    },
    toneCellStacked: {
      alignSelf: 'stretch',
      flex: 0,
    },
    toneDescription: {
      color: t.muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: gap.sm,
    },
    toneLabelSelected: {
      color: t.canvas, // --paper → the canvas ground (selected label knocks out on --ink)
      fontSize: 12,
    },
    toneLabelUnselected: {
      color: t.ink,
      fontSize: 12,
    },
    toneRow: {
      flexDirection: 'row',
      gap: gap.xs + gap.xxs, // gap-1.5 = 6
    },
    toneRowStacked: {
      flexDirection: 'column',
    },
    toneSelected: {
      backgroundColor: t.calm,
    },
    toneUnselected: {
      backgroundColor: t.inset,
    },
    toolName: {
      color: t.muted,
      fontSize: 12,
      letterSpacing: 1.2,
      lineHeight: 16,
      textTransform: 'uppercase',
    },
    toolActions: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gap.sm,
      marginTop: gap.md,
    },
    toolConfirm: {
      alignItems: 'center',
      backgroundColor: t.calm,
      borderRadius: radius.sm,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: gap.md,
    },
    toolConfirmLabel: {
      color: t.inverse,
      fontSize: 13,
      fontWeight: '600',
    },
    toolDismiss: {
      alignItems: 'center',
      borderColor: t.hairlineStrong,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: gap.md,
    },
    toolDismissLabel: {
      color: t.muted,
      fontSize: 13,
      fontWeight: '500',
    },
    toolHint: {
      color: t.muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: gap.xs,
    },
    paymentReview: {
      gap: gap.sm,
      marginTop: gap.sm,
    },
    paymentDetail: {
      color: t.ink,
      fontSize: 13,
      lineHeight: 19,
    },
    paymentRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.hairlineStrong,
      paddingTop: gap.xs,
      gap: gap.xxs,
    },
    paymentRowLabel: {
      color: t.muted,
      fontSize: 12,
    },
    paymentRowAmount: {
      color: t.ink,
      fontSize: 14,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    toolPill: {
      alignItems: 'flex-start',
      backgroundColor: t.inset,
      borderColor: t.hairline,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: gap.sm,
      paddingHorizontal: gap.md,
      paddingVertical: gap.sm,
    },
    toolResult: {
      color: t.ink,
      fontSize: 16,
      lineHeight: 23,
      marginTop: 2,
    },
    toolTextCol: {
      flex: 1,
      minWidth: 0,
    },
    toolTick: {
      color: t.calm,
      fontSize: 12.5,
      marginTop: 2,
    },
    transcript: {
      overflow: 'hidden',
      flexGrow: 1,
      minHeight: 0,
    },
    tune: {
      paddingHorizontal: gap.xs,
    },
    tuneLabel: {
      color: t.muted,
      fontSize: 11.5,
      letterSpacing: 1.6, // tracking-[0.14em]
      textTransform: 'uppercase',
    },
    undo: {
      flexShrink: 0,
    },
    undoLabel: {
      color: t.muted,
      fontSize: 11,
      letterSpacing: 1.3, // tracking-[0.12em]
      textDecorationLine: 'underline',
      textTransform: 'uppercase',
    },
    userBubble: {
      backgroundColor: t.ink,
      borderBottomRightRadius: radius.md, // rounded-br-md — the squared corner
      borderRadius: radius.xl, // rounded-2xl
      maxWidth: '80%',
      paddingHorizontal: 14,
      paddingVertical: gap.sm,
    },
    userRow: {
      alignItems: 'flex-end',
      marginVertical: gap.xs + gap.xxs, // my-1.5 = 6
    },
    userText: {
      color: t.canvas, // --paper knockout on the --ink bubble
      fontSize: 13.5,
      lineHeight: 20,
    },
    voiceCreateProposal: {
      alignItems: 'center',
      backgroundColor: t.ink,
      borderRadius: radius.sm,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: gap.md,
    },
    voiceCreateProposalLabel: {
      color: t.canvas,
      fontSize: 12,
      fontWeight: '600',
    },
    voiceDiscard: {
      alignItems: 'center',
      borderColor: t.hairlineStrong,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: gap.md,
    },
    voiceDiscardLabel: {
      color: t.muted,
      fontSize: 12,
      fontWeight: '500',
    },
    voiceError: {
      color: t.repairInk,
      fontSize: 12,
      lineHeight: 17,
    },
    voiceErrorActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.sm,
      paddingTop: gap.sm,
    },
    voiceErrorBlock: {
      paddingTop: gap.sm,
    },
    voiceErrorPrimary: {
      backgroundColor: t.repair,
      borderRadius: radius.sm,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: gap.md,
    },
    voiceErrorPrimaryLabel: {
      color: t.inverse,
      fontSize: 12,
      fontWeight: '600',
    },
    voiceErrorSecondary: {
      borderColor: t.hairlineStrong,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: gap.md,
    },
    voiceErrorSecondaryLabel: {
      color: t.muted,
      fontSize: 12,
      fontWeight: '500',
    },
    voiceListening: {
      backgroundColor: t.repairSoft,
      borderColor: t.repair,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      gap: gap.sm,
      marginTop: gap.sm,
      padding: gap.md,
    },
    voiceListeningCopy: {
      flex: 1,
      minWidth: 0,
    },
    voiceListeningHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.sm,
    },
    voiceListeningHint: {
      color: t.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    voiceListeningTitle: {
      color: t.repairInk,
      fontSize: 14,
      fontWeight: '700',
    },
    voiceLiveTranscript: {
      color: t.ink,
      fontSize: 13,
      fontStyle: 'italic',
      lineHeight: 19,
    },
    voicePrivacyLine: {
      color: t.muted,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
    },
    voiceRecordingDot: {
      backgroundColor: t.repair,
      borderRadius: radius.pill,
      height: 12,
      width: 12,
    },
    voiceReview: {
      backgroundColor: t.inset,
      borderColor: t.hairlineStrong,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      gap: gap.sm,
      marginTop: gap.sm,
      padding: gap.md,
    },
    voiceReviewActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.sm,
      justifyContent: 'flex-end',
    },
    voiceReviewBody: {
      color: t.muted,
      fontSize: 11.5,
      lineHeight: 16,
    },
    voiceReviewInput: {
      backgroundColor: t.surface,
      borderColor: t.hairlineStrong,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      color: t.ink,
      fontSize: 14,
      lineHeight: 20,
      maxHeight: 112,
      minHeight: 64,
      paddingHorizontal: gap.md,
      paddingVertical: gap.sm,
      textAlignVertical: 'top',
    },
    voiceReviewTitle: {
      color: t.ink,
      fontSize: 13,
      fontWeight: '700',
    },
    voiceStop: {
      alignItems: 'center',
      backgroundColor: t.repair,
      borderRadius: radius.pill,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: gap.md,
    },
    voiceStopLabel: {
      color: t.inverse,
      fontSize: 12,
      fontWeight: '700',
    },
    voiceTrigger: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderColor: t.hairlineStrong,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      height: 56,
      justifyContent: 'center',
      paddingHorizontal: gap.sm,
    },
    voiceTriggerDisabled: {
      opacity: 0.45,
    },
    voiceTriggerGlyph: {
      color: t.repair,
      fontSize: 10,
      lineHeight: 12,
    },
    voiceTriggerLabel: {
      color: t.ink,
      fontSize: 10.5,
      fontWeight: '600',
      lineHeight: 14,
    },
    voiceTriggerPressed: {
      transform: [{ scale: PRESS_SCALE }],
    },
  });
}
