// The one-entity moment (MELO_BLUEPRINT.md): the mascot on the money screen IS the companion
// you talk to. The header renders the SAME rig in the SAME live emotion the money screen shows,
// and every turn's system prompt is built from the SAME derived numbers via buildChatContext —
// so Melo-the-conversation can never contradict Melo-the-screen. Advisory only: tool suggestions
// come back as display-only chips (v1), nothing is executed and nothing writes to the store.
//
// The gateway client (src/local/meloAiClient.ts) is reused for config resolution and reply
// parsing; the chat POST itself is made here because this surface pins the buildChatContext
// system prompt, which sendMeloChat (web-persona prompt baked in) cannot take.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { buildChatContext, type StateView } from '@folio/melo-engine';
import { Muted, Surface, useTheme } from '@/surfaces/pressureMap/kit';

import {
  resolveMeloAiProviderConfig,
  splitReplyAndSuggestions,
  type MeloToolSuggestion,
} from '../../local/meloAiClient';
import { MeloMascot } from '../mascot/MeloMascot';
import type { LiveDerived } from '../state/derive';
import type { MeloColorway } from '../theme/weather';

// Same cheap text model the client pins for chat — the gateway only allows the approved set,
// so this literal is a mirror of meloAiClient's CHAT_MODEL, never a new capability.
const CHAT_MODEL = 'google/gemini-2.5-flash-lite';

// The one calm failure line — the words can drop out, the numbers never do.
const CALM_ERROR = "Melo can't reach the words right now — the numbers above are still exact.";

const QUICK_ASKS = ['Can I afford £40?', "When's my next bill?", "How's my week looking?"] as const;

type ThreadItem = Readonly<{
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestions: readonly MeloToolSuggestion[];
}>;

type Props = {
  derived: LiveDerived;
  view: StateView;
  colorway: MeloColorway;
  wardrobe: string | null;
  form: string | null;
  checksThisWeek: number;
  onClose: () => void;
};

export function MeloChat({
  derived,
  view,
  colorway,
  wardrobe,
  form,
  checksThisWeek,
  onClose,
}: Props) {
  const t = useTheme();
  const [thread, setThread] = useState<readonly ThreadItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);

  // Cancel any in-flight turn when the sheet closes — no setState on an unmounted screen.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const nextId = () => {
    idRef.current += 1;
    return `melo-chat-${idRef.current}`;
  };

  /** The one-entity bridge: the system prompt is built from the SAME derived numbers and the
   *  SAME mascot emotion the user is looking at. Throws only on non-integer pence (engine
   *  invariant), which the caller catches into the calm line. */
  const buildSystem = (): string =>
    buildChatContext({
      todayISO: derived.today,
      safeZonePence: derived.safeZone.safeZonePence,
      perDayPence: Math.max(0, derived.safeZone.perDayPence),
      daysToPayday: derived.safeZone.daysToPayday,
      paydayLabel: derived.paydayLabel,
      weather: view.weather,
      ladder: view.ladder,
      journey: view.journey,
      mascotMood: view.mascot.family,
      billsAhead: derived.shield.bills
        .filter((b) => b.status !== 'landed')
        .map((b) => ({ name: b.name, amountPence: b.amountPence, dueDate: b.dueDate })),
      dangerDayLabel: derived.ctx.dangerDay === 'the week' ? null : derived.ctx.dangerDay,
      checksThisWeek,
      tone: 'calm',
    });

  /** One turn against the gateway with the full visible history. Never throws — every failure
   *  mode lands on the calm inline line, and retry stays available. */
  const runTurn = async (currentThread: readonly ThreadItem[]) => {
    let system: string;
    try {
      system = buildSystem();
    } catch {
      setErrorLine(CALM_ERROR);
      setSending(false);
      return;
    }

    const config = resolveMeloAiProviderConfig();
    if (!config.configured) {
      setErrorLine(CALM_ERROR);
      setSending(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.token !== undefined) headers['x-folio-gateway-token'] = config.token;

    try {
      const response = await fetch(`${config.gatewayUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages: [
            { role: 'system', content: system },
            ...currentThread.map((item) => ({ role: item.role, content: item.text })),
          ],
          temperature: 0.6,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        setErrorLine(CALM_ERROR);
        return;
      }

      const data: unknown = await response.json();
      const raw = extractAssistantText(data);
      if (raw === null) {
        setErrorLine(CALM_ERROR);
        return;
      }

      const { prose, suggestions } = splitReplyAndSuggestions(raw);
      setThread((prev) => [...prev, { id: nextId(), role: 'assistant', text: prose, suggestions }]);
    } catch (error: unknown) {
      // An abort means the screen is closing — say nothing. Everything else: the calm line.
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setErrorLine(CALM_ERROR);
      }
    } finally {
      setSending(false);
    }
  };

  const send = () => {
    const text = input.trim();
    if (text.length === 0 || sending) return;
    const userItem: ThreadItem = { id: nextId(), role: 'user', text, suggestions: [] };
    const nextThread = [...thread, userItem];
    setThread(nextThread);
    setInput('');
    setErrorLine(null);
    setSending(true);
    void runTurn(nextThread);
  };

  const retry = () => {
    if (sending || thread.length === 0) return;
    setErrorLine(null);
    setSending(true);
    void runTurn(thread);
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: t.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header — the mascot from the money screen, same emotion, same wardrobe. */}
      <View style={[s.header, { borderBottomColor: t.hairline }]}>
        <MeloMascot
          emotion={view.mascot.family}
          colorway={colorway}
          wardrobe={wardrobe}
          form={form}
          size={72}
          breathe
        />
        <View style={s.headerText}>
          <Text style={[s.name, { color: t.ink }]}>Melo</Text>
          <Muted style={s.contextLine}>
            {derived.ctx.safeZone} in the Safe Zone · payday {derived.ctx.paydayLabel}
          </Muted>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close the chat"
          hitSlop={12}
          style={s.close}
        >
          <Text style={[s.closeLabel, { color: t.muted }]}>close</Text>
        </Pressable>
      </View>

      {/* Thread — Melo left on paper, you right on the warm accent-soft. No chat-app blue. */}
      <ScrollView
        ref={scrollRef}
        style={s.thread}
        contentContainerStyle={s.threadContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {thread.length === 0 ? (
          <Surface style={s.emptyWell} tone="sunken">
            <Muted style={s.emptyLine}>
              Same Melo as the money screen — it can see the numbers above. Ask about the week, a
              bill, or a maybe-spend.
            </Muted>
          </Surface>
        ) : null}

        {thread.map((item) =>
          item.role === 'user' ? (
            <View key={item.id} style={[s.bubble, s.bubbleUser, { backgroundColor: t.calmSoft }]}>
              <Text style={[s.bubbleText, { color: t.ink }]}>{item.text}</Text>
            </View>
          ) : (
            <View key={item.id} style={s.meloTurn}>
              <View
                style={[
                  s.bubble,
                  s.bubbleMelo,
                  { backgroundColor: t.inset, borderColor: t.hairline },
                ]}
              >
                <Text style={[s.bubbleText, { color: t.ink }]}>{item.text}</Text>
              </View>
              {item.suggestions.length > 0 ? (
                <View style={s.suggestWrap}>
                  {item.suggestions.map((suggestion) => (
                    <View
                      key={suggestion.id}
                      style={[
                        s.suggestChip,
                        { borderColor: t.hairlineStrong, backgroundColor: t.inset },
                      ]}
                    >
                      <Text style={[s.suggestLabel, { color: t.secondary }]}>
                        {suggestion.summary}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ),
        )}

        {sending ? <ThinkingRow colorway={colorway} wardrobe={wardrobe} form={form} /> : null}

        {errorLine !== null ? (
          <View style={s.errorRow}>
            <Muted style={s.errorLine}>{errorLine}</Muted>
            <Pressable onPress={retry} accessibilityRole="button" hitSlop={10}>
              <Text style={[s.retryLabel, { color: t.calmStrong }]}>try once more</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* Quick asks — tapping fills the input, sending stays a deliberate act. */}
      <View style={s.quickRow}>
        {QUICK_ASKS.map((ask) => (
          <Pressable
            key={ask}
            onPress={() => setInput(ask)}
            accessibilityRole="button"
            style={[s.quickChip, { borderColor: t.hairline, backgroundColor: t.inset }]}
          >
            <Text style={[s.quickLabel, { color: t.secondary }]}>{ask}</Text>
          </Pressable>
        ))}
      </View>

      {/* Input row. */}
      <View style={[s.inputRow, { borderTopColor: t.hairline, backgroundColor: t.canvas }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          placeholder="Talk to Melo"
          placeholderTextColor={t.muted}
          returnKeyType="send"
          multiline
          accessibilityLabel="Message for Melo"
          style={[s.input, { color: t.ink, backgroundColor: t.inset, borderColor: t.hairline }]}
        />
        <Pressable
          onPress={send}
          disabled={sending || input.trim().length === 0}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={[
            s.sendButton,
            {
              backgroundColor: sending || input.trim().length === 0 ? t.sunken : t.calmStrong,
            },
          ]}
        >
          <Text
            style={[
              s.sendLabel,
              { color: sending || input.trim().length === 0 ? t.muted : t.inverse },
            ]}
          >
            Send
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/** While Melo thinks: the mini mascot with a slow pulsing glow behind it — the same being,
 *  quietly working. Deliberately not a three-dot typing indicator. */
function ThinkingRow({
  colorway,
  wardrobe,
  form,
}: {
  colorway: MeloColorway;
  wardrobe: string | null;
  form: string | null;
}) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={s.thinkingRow} accessibilityLabel="Melo is thinking">
      <View style={s.thinkingMascot}>
        <Animated.View style={[s.thinkingGlow, { backgroundColor: t.calmSoft, opacity: pulse }]} />
        <MeloMascot emotion="calm" colorway={colorway} wardrobe={wardrobe} form={form} size={34} />
      </View>
      <Muted style={s.thinkingLine}>thinking</Muted>
    </View>
  );
}

/** Minimal OpenAI-shape reader (mirror of the client's private extractor). */
function extractAssistantText(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  const content = first?.message?.content;
  return typeof content === 'string' ? content : null;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: 2 },
  name: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  contextLine: { fontSize: 13, lineHeight: 18 },
  close: { paddingVertical: 6, paddingHorizontal: 4 },
  closeLabel: { fontSize: 14, fontWeight: '600' },

  thread: { flex: 1 },
  threadContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 10 },
  emptyWell: { padding: 16 },
  emptyLine: { lineHeight: 20 },

  bubble: {
    maxWidth: '84%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  bubbleMelo: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  meloTurn: { gap: 6 },

  suggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxWidth: '84%' },
  suggestChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  suggestLabel: { fontSize: 12, fontWeight: '500' },

  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  thinkingMascot: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  thinkingGlow: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
  thinkingLine: { fontSize: 13 },

  errorRow: { gap: 4, paddingVertical: 4 },
  errorLine: { lineHeight: 19 },
  retryLabel: { fontSize: 13.5, fontWeight: '600' },

  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  quickChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  quickLabel: { fontSize: 13, fontWeight: '500' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 110,
  },
  sendButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendLabel: { fontSize: 15, fontWeight: '700' },
});
