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
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { gap, radius, serif, Sheet, useTheme, type Palette } from '@/folio/theme';
import { copy } from '@/folio/copy/copy';
import { Melo } from '@/folio/melo/Melo';
import {
  applyMeloTool,
  purgeSeedIfReal,
  setMelo,
  useAppStore,
  type MeloTone,
  type Sub,
  type Transaction,
} from '@/folio/store';
import { UNDO_WINDOW_MS } from '@/folio/lib/undoPolicy';
import { buildMeloSnapshot } from '@/folio/lib/meloSnapshot';
import { buildMeloLocalCalculation } from '@/folio/lib/meloCalculations';
import { resolveMeloAccountSelection } from '@/folio/lib/meloAccountSelection';
import { resolveMeloSubscriptionRequest } from '@/folio/lib/meloSubscriptionRequest';
import { DEFAULT_MELO_TONE, describeMeloTone } from '@/folio/lib/meloToneGuidance';
import type { MeloIntent, Nav, Pressure } from '@/folio/types';
import {
  MELO_TOOL_APPROVAL_DENIED,
  MELO_TOOL_APPROVAL_REQUESTED,
  decideMeloToolSuggestion,
  describeMeloToolSuggestion,
  getMeloToolSuggestionPhase,
  settleMeloToolApplication,
  settleMeloToolUndo,
  type MeloToolSuggestionSettlement,
} from '@/folio/sheets/meloToolSuggestion';
import { filterMeloFollowUpChips, resolveMeloLocalAction } from '@/folio/sheets/meloLocalAction';
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

// The four empty-state starter chips (web STARTERS — verbatim).
const STARTERS: readonly string[] = [
  'Why is my tight point so low?',
  'Can I afford £40 on Friday?',
  'Talk me out of this Spotify charge',
  "How's the month going?",
];
const BUSINESS_STARTERS: readonly string[] = [
  'Explain my business cash position',
  'What needs my review?',
  'Show my business accounts',
  'How has the last 30 days gone?',
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
};
type ChatPart = TextPart | ToolPart;
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: ChatPart[];
  intent?: MeloLocalIntent;
  actions?: readonly MeloLocalAiAction[];
  followUpChips?: readonly string[];
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
    const liveSubs = subs.filter((s) => !subPaused[s.name]);
    const soon = [...liveSubs].sort((a, b) => a.nextRenewalDaysAway - b.nextRenewalDaysAway)[0] as
      | Sub
      | undefined;
    const name = onboarding.name ? `${onboarding.name}, ` : '';
    // Payment-TIMING openers only. Bank/seed data proves a charge RECURS, it cannot prove the product
    // was used (SUBSCRIPTION_SIGNAL_RESEARCH §2/§5), so Melo never opens with a usage / "you haven't
    // opened it" claim or a "pause/cancel it" directive — she surfaces the upcoming charge and asks a
    // neutral question; the user decides. Both branches key on the renewal date, never on usage.
    if (soon && soon.nextRenewalDaysAway <= 3) {
      return `${name}quick one — ${soon.name} £${soon.cost.toFixed(2)} leaves ${soon.nextRenewalDaysAway === 0 ? 'today' : `in ${soon.nextRenewalDaysAway}d`}. all good with that?`;
    }
    if (soon && soon.nextRenewalDaysAway <= 7) {
      return `${name}heads up — ${soon.name} (£${soon.cost.toFixed(2)}) renews in ${soon.nextRenewalDaysAway} day${soon.nextRenewalDaysAway === 1 ? '' : 's'}. want a look before it goes out?`;
    }
    if (snapshot.hasMoneyPicture) {
      return `${name}your latest money picture is ready here. what do you want to check?`;
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
    <Sheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <MeloChat
        snapshot={snapshot}
        prefill={prefill}
        seed={seedIntent ?? autoSeed}
        reduceMotion={reduceMotion}
        nav={nav}
        calculate={calculate}
        selectAccount={selectAccount}
        subscriptionState={subscriptionState}
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
}: {
  snapshot: MeloLocalFinancialSnapshot;
  prefill?: string | undefined;
  seed?: string | undefined;
  reduceMotion: boolean;
  nav: Nav;
  calculate: LocalMeloCalculationBuilder;
  selectAccount: LocalMeloAccountSelector;
  subscriptionState: Parameters<LocalMeloSubscriptionActionResolver>[1];
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  // Tone is a global companion preference, not throwaway sheet state. Chat phrasing and the narrow
  // proactive-money gate on Today both read this same persisted Melo settings slice.
  const savedTone = useAppStore((s) => s.melo?.tone ?? DEFAULT_MELO_TONE);
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState(prefill ?? '');
  useEffect(() => {
    if (prefill) setInput(prefill);
  }, [prefill]);

  // Seed an opening assistant message when the chat is empty (web seededMessages).
  const seededMessages = useMemo<ChatMessage[]>(() => {
    if (!seed) return [];
    return [{ id: `seed-${Date.now()}`, role: 'assistant', parts: [{ type: 'text', text: seed }] }];
  }, [seed]);

  const [messages, setMessages] = useState<ChatMessage[]>(seededMessages);
  const [conversationContext, setConversationContext] =
    useState<LocalMeloConversationContext | null>(null);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [languagePackState, setLanguagePackState] = useState<
    LocalLanguagePackState | Readonly<{ kind: 'checking' | 'installing'; fraction?: number }>
  >({ kind: 'checking' });
  const isLoading = status === 'submitted' || status === 'streaming';
  const toneLabel = TONES.find((tn) => tn.id === savedTone)?.label ?? 'Calm';
  const starters = snapshot.workspaceKind === 'business' ? BUSINESS_STARTERS : STARTERS;

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
    setLanguagePackState({ kind: 'unavailable', message: result.message });
  }

  // --- Tool approval gate -------------------------------------------------------------------------
  // Suggestions remain transcript-only until Confirm. Dismiss only settles the visible part.
  // `decidedRef` protects against double taps; a confirmed write keeps the existing 30s Undo window.
  const decidedRef = useRef<Set<string>>(new Set());
  const turnRequestRef = useRef(0);
  const undoTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [undoMap, setUndoMap] = useState<Record<string, { undo: () => void }>>({});

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

    const name = suggestion.type.replace(/^tool-/, '');
    const result = applyMeloTool(name, suggestion.input ?? {});
    const outputMessage = result.applied ? result.summary : result.reason;
    recordToolSettlement(callId, settleMeloToolApplication(result.applied, outputMessage));

    if (!result.applied) return;
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
    const entry = undoMap[id];
    if (!entry) return;
    entry.undo();
    recordToolSettlement(id, settleMeloToolUndo(), 'applied');
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
    setMessages((prev) => [...prev, assistantMessageFromResult(result)]);
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
    setConversationContext(null);
    setMessages([]);
  }

  function startFresh() {
    Alert.alert('Clear this conversation?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: performClear },
    ]);
  }

  // --- Stick-to-bottom transcript + scroll-to-bottom affordance. ----------------------------------
  const scrollRef = useRef<ScrollView>(null);
  const [atBottom, setAtBottom] = useState(true);
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
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setAtBottom(distanceFromBottom <= SCROLL_BOTTOM_EPSILON);
  }

  const showEmpty = messages.length === 0 && !isLoading;

  return (
    <View style={s.body}>
      {/* Header */}
      <View style={s.header}>
        <Melo mood="calm" size={36} grounded={false} />
        <View style={s.headerText}>
          <Text style={s.headerTitle}>{copy.global.melo.name}</Text>
          <Text style={s.headerSub} numberOfLines={1}>
            {`On this phone · ${toneLabel}`}
          </Text>
        </View>
        <PressText
          label={showSettings ? 'Done' : 'Tune'}
          onPress={() => setShowSettings((v) => !v)}
          style={s.tune}
          labelStyle={s.tuneLabel}
          reduceMotion={reduceMotion}
          accessibilityLabel="Chat settings"
        />
      </View>

      {/* Settings panel */}
      {showSettings ? (
        <View style={s.settings}>
          <View>
            <Text style={s.sectionLabel}>Melo style</Text>
            <View style={s.toneRow}>
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
              <Text style={s.languagePackBody}>{describeLanguagePackState(languagePackState)}</Text>
            </View>
            {languagePackState.kind === 'not-installed' ||
            languagePackState.kind === 'invalid' ||
            languagePackState.kind === 'unavailable' ? (
              <PressText
                label="Install · 648 MB"
                onPress={() => void installLanguagePack()}
                style={s.languagePackAction}
                labelStyle={s.languagePackActionLabel}
                reduceMotion={reduceMotion}
                accessibilityLabel="Install local language pack, 648 megabytes"
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

      {/* Transcript */}
      <View style={s.transcript}>
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onContentSizeChange={(_w, h) => {
            contentHeight.current = h;
            if (atBottom) scrollToEnd(false);
          }}
          onLayout={(e: LayoutChangeEvent) => {
            viewportHeight.current = e.nativeEvent.layout.height;
          }}
        >
          {/* Empty — Fraunces-italic prompt + 4 tappable starter chips. */}
          {showEmpty ? (
            <View style={s.empty}>
              <Text style={s.emptyHeadline}>What's on your mind?</Text>
              <View style={s.starters}>
                {starters.map((starter) => (
                  <StarterChip
                    key={starter}
                    label={starter}
                    onPress={() => send(starter)}
                    styles={s}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {messages.map((m) => {
            const text = partsToText(m);
            const followUpChips = filterMeloFollowUpChips(m.actions ?? [], m.followUpChips ?? []);
            if (m.role === 'user') {
              return (
                <FadeIn key={m.id} reduceMotion={reduceMotion} style={s.userRow}>
                  <View style={s.userBubble}>
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
                {toolParts.map((tp, i) => {
                  const toolName = tp.type.replace(/^tool-/, '');
                  const name = toolName.replace(/_/g, ' ');
                  const callId = tp.toolCallId ?? `${m.id}-${tp.type}`;
                  const phase = getMeloToolSuggestionPhase(tp);
                  const isPending = phase === 'pending';
                  const canUndo = phase === 'applied' && !!undoMap[callId];
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
                    ? describeMeloToolSuggestion(toolName, tp.input ?? {})
                    : phase === 'dismissed'
                      ? 'Dismissed. Nothing changed.'
                      : phase === 'unavailable'
                        ? 'This suggestion is unavailable.'
                        : (tp.output?.message ?? 'No change was made.');
                  return (
                    <View key={`${callId}-${i}`} style={s.toolPill}>
                      <Text style={s.toolTick}>{glyph}</Text>
                      <View style={s.toolTextCol}>
                        <Text style={s.toolName}>{name}</Text>
                        <Text style={s.toolResult} accessibilityLiveRegion="polite">
                          {resultText}
                        </Text>
                        {isPending ? (
                          <>
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
                              />
                              <PressText
                                label="Confirm"
                                onPress={() => confirmToolSuggestion(callId, tp)}
                                style={s.toolConfirm}
                                labelStyle={s.toolConfirmLabel}
                                reduceMotion={reduceMotion}
                                accessibilityLabel={`Confirm ${name} suggestion`}
                                accessibilityHint="Records this change in Melo"
                              />
                            </View>
                          </>
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
                        onPress={() => send(chip)}
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
              <Shimmer text="Melo's thinking…" palette={t} reduceMotion={reduceMotion} />
            </View>
          ) : null}

          {/* Error — accent-coloured line. */}
        </ScrollView>

        {/* Scroll-to-bottom FAB — only when not already at the bottom. */}
        {!atBottom ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scroll to latest"
            onPress={() => {
              setAtBottom(true);
              scrollToEnd(true);
            }}
            style={s.scrollFab}
            hitSlop={8}
          >
            <Text style={s.scrollFabGlyph}>↓</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Composer */}
      <View style={s.composer}>
        <View style={s.inputWrap}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Say anything to Melo…"
            placeholderTextColor={t.muted}
            editable={!isLoading}
            multiline
            autoFocus
            style={s.input}
            accessibilityLabel="Say anything to Melo"
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            submitBehavior="submit"
          />
        </View>
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
      </View>
    </View>
  );
}

function describeLanguagePackState(
  state: LocalLanguagePackState | Readonly<{ kind: 'checking' | 'installing'; fraction?: number }>,
): string {
  switch (state.kind) {
    case 'checking':
      return 'Checking this phone…';
    case 'installing':
      return `Installing on this phone · ${Math.round((state.fraction ?? 0) * 100)}%`;
    case 'installed':
      return 'Ready on this phone for broader wording and more natural replies.';
    case 'not-installed':
      return 'Add the private language pack for broader wording and more natural replies.';
    case 'invalid':
      return 'The saved pack did not pass verification. Install a clean copy.';
    case 'unavailable':
      return state.message;
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
    parts.push({
      type: `tool-${suggestion.name}`,
      state: MELO_TOOL_APPROVAL_REQUESTED,
      toolCallId: suggestion.id,
      input: suggestion.args as Record<string, unknown>,
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
      accessibilityRole="button"
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
}: {
  label: string;
  onPress: () => void;
  style: object;
  labelStyle: object;
  reduceMotion: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
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
      onPress={onPress}
      onPressIn={() => press(PRESS_SCALE)}
      onPressOut={() => press(1)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
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
      accessibilityLabel={isLoading ? 'Stop' : 'Send'}
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
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
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
    assistant: {
      gap: gap.sm,
      marginVertical: gap.sm,
    },
    assistantText: {
      color: t.ink,
      fontSize: 13.5,
      lineHeight: 21,
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
      minHeight: 36,
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
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 360,
    },
    composer: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: gap.sm,
      paddingTop: gap.sm,
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
      borderBottomColor: t.hairline,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: gap.md,
      paddingBottom: gap.md,
    },
    headerSub: {
      color: t.muted,
      fontSize: 11.5,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    headerTitle: {
      color: t.ink,
      fontSize: 14,
      fontWeight: '500',
    },
    input: {
      color: t.ink,
      fontSize: 14,
      lineHeight: 20,
      maxHeight: 120,
      minHeight: 24,
      paddingVertical: 0,
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
      paddingVertical: gap.md,
    },
    scrollFab: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderColor: t.hairline,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      bottom: gap.sm,
      elevation: 3,
      height: 32,
      justifyContent: 'center',
      position: 'absolute',
      right: gap.sm,
      shadowColor: '#2A2018',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      width: 32,
    },
    scrollFabGlyph: {
      color: t.ink,
      fontSize: 16,
      lineHeight: 18,
    },
    sectionLabel: {
      color: t.muted,
      fontSize: 11.5,
      letterSpacing: 1.6, // tracking-[0.14em] on an 11.5px label
      marginBottom: gap.sm,
      textTransform: 'uppercase',
    },
    languagePackAction: {
      alignItems: 'center',
      backgroundColor: t.inset,
      borderRadius: radius.pill,
      minHeight: 34,
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
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: 2,
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
      fontSize: 13,
      fontWeight: '600',
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
      backgroundColor: t.inset,
      borderRadius: radius.md,
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
      paddingBottom: gap.xxs,
    },
    thinking: {
      marginVertical: gap.sm,
    },
    tone: {
      alignItems: 'center',
      borderRadius: radius.md,
      height: 32,
      justifyContent: 'center',
    },
    toneCell: {
      flex: 1,
    },
    toneDescription: {
      color: t.muted,
      fontSize: 11.5,
      lineHeight: 16,
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
    toneSelected: {
      backgroundColor: t.ink,
    },
    toneUnselected: {
      backgroundColor: t.inset,
    },
    toolName: {
      color: t.muted,
      fontSize: 10.5,
      letterSpacing: 1.3, // tracking-[0.12em] on a 10.5px label
      textTransform: 'uppercase',
    },
    toolActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: gap.sm,
      marginTop: gap.md,
    },
    toolConfirm: {
      alignItems: 'center',
      backgroundColor: t.ink,
      borderRadius: radius.sm,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: gap.md,
    },
    toolConfirmLabel: {
      color: t.canvas,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    toolDismiss: {
      alignItems: 'center',
      borderColor: t.hairlineStrong,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: gap.md,
    },
    toolDismissLabel: {
      color: t.muted,
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    toolHint: {
      color: t.muted,
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: gap.xs,
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
      fontSize: 12.5,
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
      flexGrow: 1,
      flexShrink: 1,
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
  });
}
