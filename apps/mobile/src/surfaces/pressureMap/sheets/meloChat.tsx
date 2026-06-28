// Melo chat sheet — the RN port of the web SheetMeloChat + MeloChat.
//
// Faithful to the accepted web design (src/components/folio/sheets/SheetMeloChat.tsx and
// src/components/melo/MeloChat.tsx): a thread + composer in a bottom sheet, a financial-snapshot
// header strip, Melo's mood avatar (reusing the RN MeloFigure), a "Tune" panel for voice + the
// "let Melo see my money" toggle, and seed openers when the thread is empty.
//
// PRESENTATION ONLY. This file holds NO chat/network state and never talks to the engine. The
// container owns the thread, the in-flight flag, the settings, and the API key, and passes them in
// as props. Sending, tuning, sharing, clearing, and accepting a suggestion are all on* callbacks.
//
// ADVISORY MELO. Suggestions the model proposes arrive on the model as `pendingSuggestions` and are
// surfaced as confirm chips; tapping one calls onAcceptSuggestion. Melo never mutates state here —
// the user decides. (See meloAiClient for the suggestion seam.)

import { useMemo, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { MeloLocalFinancialSnapshot } from '@folio/ai-contracts';

import {
  Body,
  CheckGlyph,
  elevation,
  gap,
  Hairline,
  radius,
  serif,
  useTheme,
  type Palette,
} from '../kit';
import { Sheet } from '../Sheet';
import { MeloFigure } from '../melo/MeloFigure';
import type { MeloMood } from '../melo/meloStates';
import { formatMinorAmount } from '../../../local/localLedger';
import type {
  MeloChatMessage,
  MeloChatResult,
  MeloTone,
  MeloToolSuggestion,
} from '../../../local/meloAiClient';

// The four voices (verbatim from the web MeloChat TONES).
const TONES: readonly { id: MeloTone; label: string }[] = [
  { id: 'calm', label: 'Calm' },
  { id: 'honest', label: 'Honest' },
  { id: 'dry', label: 'Dry' },
  { id: 'coachy', label: 'Coachy' },
];

// The empty-thread seed openers (verbatim from the web MeloChat STARTERS).
const STARTERS: readonly string[] = [
  'Why is my tight point so low?',
  'Can I afford £40 on Friday?',
  'Talk me out of this Spotify charge',
  "How's the month going?",
];

export type MeloChatSettings = Readonly<{
  tone: MeloTone;
  /** "Let Melo see my money" — when true the container passes the snapshot to the AI client. */
  share: boolean;
}>;

export type MeloChatSheetProps = Readonly<{
  /** Sheet visibility + close (composes the shared Sheet primitive). */
  visible: boolean;
  onClose: () => void;
  reduceMotion?: boolean | undefined;

  /** The visible thread (most recent last). Seed the opener as the first assistant message. */
  messages: readonly MeloChatMessage[];
  /** True while a turn is in flight — disables the composer + shows the thinking line. */
  isSending: boolean;
  /** Set when the last turn returned a non-ok result (no-provider / error). */
  lastResultStatus?: Exclude<MeloChatResult['status'], 'ok'> | undefined;
  /** A short message for the non-ok state (e.g. "Melo isn't configured yet."). */
  statusMessage?: string | undefined;

  /** Tune panel state, lifted to the container. */
  settings: MeloChatSettings;
  showSettings: boolean;
  onToggleSettings: () => void;
  onChangeTone: (tone: MeloTone) => void;
  onToggleShare: (next: boolean) => void;
  onStartFresh: () => void;

  /** Composer state, lifted to the container. */
  input: string;
  onChangeInput: (next: string) => void;
  /** Send the given text (a starter tap or the composer submit). Container trims + guards. */
  onSend: (text: string) => void;

  /** The financial snapshot for the header strip. The avatar mood is derived from its pressure. */
  snapshot: MeloLocalFinancialSnapshot;
  /** Pre-derived avatar mood (the container reads it from the route, same source as Today). */
  mood: MeloMood;

  /** Advisory suggestions Melo proposed for the latest reply (user-confirmed, never auto-applied). */
  pendingSuggestions?: readonly MeloToolSuggestion[] | undefined;
  /** The user accepted a suggestion — the container validates + applies it (or opens a confirm). */
  onAcceptSuggestion: (suggestion: MeloToolSuggestion) => void;
  /** The user dismissed a suggestion without applying it. */
  onDismissSuggestion: (suggestion: MeloToolSuggestion) => void;
}>;

export function MeloChatSheet(props: MeloChatSheetProps) {
  const inputRef = useRef<TextInput | null>(null);
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const shareLabel = props.settings.share ? 'Knows your money' : 'Just listening';
  const toneLabel = TONES.find((t) => t.id === props.settings.tone)?.label ?? 'Calm';
  const threadEmpty = props.messages.length === 0;

  function submitComposer() {
    const trimmed = props.input.trim();
    if (trimmed.length === 0 || props.isSending) return;
    props.onSend(trimmed);
  }

  return (
    <Sheet visible={props.visible} onClose={props.onClose} reduceMotion={props.reduceMotion}>
      {/* Header — Melo's avatar, name, and the share/voice status line + the Tune toggle. */}
      <View style={s.header}>
        <MeloFigure mood={props.mood} size={36} reduceMotion={props.reduceMotion} />
        <View style={s.headerText}>
          <Text style={s.headerName}>Melo</Text>
          <Text style={s.headerStatus} numberOfLines={1}>
            {`${shareLabel} · ${toneLabel}`}
          </Text>
        </View>
        <Pressable
          accessibilityHint="Opens Melo's voice and sharing settings."
          accessibilityLabel="Chat settings"
          accessibilityRole="button"
          hitSlop={10}
          onPress={props.onToggleSettings}
          style={({ pressed }) => [s.tuneButton, pressed ? s.pressedDim : undefined]}
        >
          <Text style={s.tuneLabel}>{props.showSettings ? 'Done' : 'Tune'}</Text>
        </Pressable>
      </View>
      <Hairline />

      {/* Financial snapshot strip — the thing the web header implies but states plainly here:
          available now, tightest point, items to review, next payday. Reads only the snapshot. */}
      <SnapshotStrip snapshot={props.snapshot} />

      {/* Tune panel — voice chips + the "let Melo see my money" toggle + start-fresh. */}
      {props.showSettings ? (
        <View style={s.settings}>
          <View>
            <Text style={s.settingsLabel}>Voice</Text>
            <View style={s.toneRow}>
              {TONES.map((tone) => {
                const selected = props.settings.tone === tone.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={tone.id}
                    onPress={() => props.onChangeTone(tone.id)}
                    style={({ pressed }) => [
                      s.toneChip,
                      selected ? s.toneChipSelected : undefined,
                      pressed ? s.pressedDim : undefined,
                    ]}
                  >
                    <Text
                      style={[
                        s.toneChipLabel,
                        selected ? s.toneChipLabelSelected : undefined,
                      ]}
                    >
                      {tone.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: props.settings.share }}
            onPress={() => props.onToggleShare(!props.settings.share)}
            style={({ pressed }) => [s.shareRow, pressed ? s.pressedDim : undefined]}
          >
            <View style={s.shareText}>
              <Text style={s.shareTitle}>Let Melo see my money</Text>
              <Text style={s.shareHint}>
                Sends a summary of your path, pots and subs to your AI provider so Melo can help.
                Leave it off to keep everything on this device.
              </Text>
            </View>
            <View style={[s.checkbox, props.settings.share ? s.checkboxOn : undefined]}>
              {props.settings.share ? <CheckGlyph color={t.inverse} size={16} /> : null}
            </View>
          </Pressable>

          {props.messages.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={props.onStartFresh}
              style={({ pressed }) => [pressed ? s.pressedDim : undefined]}
            >
              <Text style={s.startFresh}>Start fresh</Text>
            </Pressable>
          ) : null}
          <Hairline />
        </View>
      ) : null}

      {/* Transcript. */}
      <View style={s.transcript}>
        {threadEmpty && !props.isSending ? (
          <View style={s.empty}>
            <Text style={s.emptyPrompt}>What's on your mind?</Text>
            <View style={s.starters}>
              {STARTERS.map((starter) => (
                <Pressable
                  accessibilityRole="button"
                  key={starter}
                  onPress={() => props.onSend(starter)}
                  style={({ pressed }) => [s.starter, pressed ? s.pressedDim : undefined]}
                >
                  <Text style={s.starterText}>{starter}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {props.messages.map((message) =>
          message.role === 'user' ? (
            <View key={message.id} style={s.userRow}>
              <View style={s.userBubble}>
                <Text style={s.userText}>{message.text}</Text>
              </View>
            </View>
          ) : (
            <View key={message.id} style={s.assistantRow}>
              <Text style={s.assistantText}>{message.text}</Text>
            </View>
          ),
        )}

        {/* Advisory suggestion chips for the latest reply — user confirms, Melo never auto-applies. */}
        {props.pendingSuggestions && props.pendingSuggestions.length > 0
          ? props.pendingSuggestions.map((suggestion) => (
              <View key={suggestion.id} style={s.suggestion}>
                <View style={s.suggestionMark}>
                  <CheckGlyph color={t.calm} size={18} />
                </View>
                <View style={s.suggestionBody}>
                  <Text style={s.suggestionKind}>{suggestion.name.replace(/_/g, ' ')}</Text>
                  <Text style={s.suggestionSummary}>{suggestion.summary}</Text>
                  <View style={s.suggestionActions}>
                    <Pressable
                      accessibilityHint="Applies this suggested change."
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => props.onAcceptSuggestion(suggestion)}
                      style={({ pressed }) => [pressed ? s.pressedDim : undefined]}
                    >
                      <Text style={s.suggestionAccept}>Do it</Text>
                    </Pressable>
                    <Pressable
                      accessibilityHint="Dismisses this suggestion without changing anything."
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => props.onDismissSuggestion(suggestion)}
                      style={({ pressed }) => [pressed ? s.pressedDim : undefined]}
                    >
                      <Text style={s.suggestionDismiss}>Not now</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          : null}

        {props.isSending ? <Text style={s.thinking}>Melo's thinking…</Text> : null}

        {props.lastResultStatus && props.statusMessage ? (
          <View style={s.notice}>
            <Body style={s.noticeText}>{props.statusMessage}</Body>
          </View>
        ) : null}
      </View>

      {/* Composer. */}
      <View style={s.composer}>
        <TextInput
          accessibilityLabel="Message Melo"
          editable={!props.isSending}
          multiline
          onChangeText={props.onChangeInput}
          onSubmitEditing={submitComposer}
          placeholder="Say anything to Melo…"
          placeholderTextColor={t.muted}
          ref={inputRef}
          returnKeyType="send"
          style={s.input}
          value={props.input}
        />
        <Pressable
          accessibilityHint="Sends your message to Melo."
          accessibilityLabel="Send"
          accessibilityRole="button"
          disabled={props.input.trim().length === 0 || props.isSending}
          onPress={submitComposer}
          style={({ pressed }) => [
            s.send,
            props.input.trim().length === 0 || props.isSending ? s.sendDisabled : undefined,
            pressed ? s.pressedDim : undefined,
          ]}
        >
          <SendGlyph
            color={props.input.trim().length === 0 || props.isSending ? t.muted : t.inverse}
          />
        </Pressable>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Snapshot strip — the calm financial header. Reads the snapshot only.
// ---------------------------------------------------------------------------

function SnapshotStrip({ snapshot }: { snapshot: MeloLocalFinancialSnapshot }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={s.snapshot}>
      <SnapshotCell label="Available now" value={formatMinorAmount(snapshot.availableNowMinor)} />
      <SnapshotCell
        label="Tightest point"
        value={formatMinorAmount(snapshot.tightestBalanceMinor)}
      />
      <SnapshotCell
        label="To review"
        value={String(snapshot.pendingReviewCount)}
        muted={snapshot.pendingReviewCount === 0}
      />
    </View>
  );
}

function SnapshotCell({
  label,
  value,
  muted,
  style,
}: {
  label: string;
  value: string;
  muted?: boolean | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={[s.snapshotCell, style]}>
      <Text style={s.snapshotLabel}>{label}</Text>
      <Text style={[s.snapshotValue, muted ? s.snapshotValueMuted : undefined]}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Send glyph — a small paper-plane, in the accent family.
// ---------------------------------------------------------------------------

function SendGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M4 12L20 4l-6 16-3-7-7-1z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — paper tokens, radius scale, kit elevation. Matches the web colours.
// Resolved against the active palette `t` (light or dark) via makeStyles(t).
// ---------------------------------------------------------------------------

function makeStyles(t: Palette) {
  return StyleSheet.create({
  pressedDim: { opacity: 0.6 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.md,
    paddingBottom: gap.md,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { color: t.ink, fontSize: 15, fontWeight: '600' },
  headerStatus: { color: t.muted, fontSize: 12, marginTop: 1 },
  tuneButton: { paddingVertical: 4, paddingHorizontal: 4 },
  tuneLabel: {
    color: t.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  snapshot: {
    flexDirection: 'row',
    backgroundColor: t.inset,
    borderRadius: radius.lg,
    paddingVertical: gap.md,
    paddingHorizontal: gap.lg,
    marginTop: gap.md,
  },
  snapshotCell: { flex: 1, gap: 2 },
  snapshotLabel: {
    color: t.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  snapshotValue: {
    color: t.ink,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  snapshotValueMuted: { color: t.muted },

  settings: { gap: gap.md, paddingTop: gap.md },
  settingsLabel: {
    color: t.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: gap.sm,
  },
  toneRow: { flexDirection: 'row', gap: gap.sm },
  toneChip: {
    flex: 1,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.inset,
  },
  toneChipSelected: { backgroundColor: t.ink },
  toneChipLabel: { color: t.ink, fontSize: 13, fontWeight: '600' },
  toneChipLabelSelected: { color: t.inverse },

  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.md,
  },
  shareText: { flex: 1 },
  shareTitle: { color: t.ink, fontSize: 14, fontWeight: '500' },
  shareHint: { color: t.muted, fontSize: 12, lineHeight: 17, marginTop: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: t.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surface,
  },
  checkboxOn: { backgroundColor: t.calm, borderColor: t.calm },
  startFresh: {
    color: t.muted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  transcript: { paddingTop: gap.md, gap: gap.sm },

  empty: { paddingVertical: gap.lg, gap: gap.lg },
  emptyPrompt: {
    color: t.ink,
    fontFamily: serif.displayItalic,
    fontSize: 17,
    lineHeight: 23,
  },
  starters: { gap: gap.sm },
  starter: {
    backgroundColor: t.inset,
    borderRadius: radius.lg,
    paddingVertical: gap.md,
    paddingHorizontal: gap.lg,
  },
  starterText: { color: t.ink, fontSize: 14, lineHeight: 19 },

  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: t.ink,
    borderRadius: radius.xl,
    borderBottomRightRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: gap.lg,
  },
  userText: { color: t.inverse, fontSize: 15, lineHeight: 21 },

  assistantRow: { paddingVertical: 2 },
  assistantText: { color: t.ink, fontSize: 15, lineHeight: 22 },

  suggestion: {
    flexDirection: 'row',
    gap: gap.sm,
    backgroundColor: t.inset,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.hairline,
    padding: gap.md,
  },
  suggestionMark: { paddingTop: 1 },
  suggestionBody: { flex: 1, gap: 4 },
  suggestionKind: {
    color: t.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  suggestionSummary: { color: t.ink, fontSize: 14, lineHeight: 19 },
  suggestionActions: { flexDirection: 'row', gap: gap.lg, marginTop: 2 },
  suggestionAccept: { color: t.calmStrong, fontSize: 13, fontWeight: '700' },
  suggestionDismiss: { color: t.muted, fontSize: 13, fontWeight: '600' },

  thinking: {
    color: t.muted,
    fontFamily: serif.displayItalic,
    fontSize: 15,
    paddingVertical: gap.sm,
  },

  notice: {
    backgroundColor: t.caution + '22',
    borderRadius: radius.md,
    paddingVertical: gap.sm,
    paddingHorizontal: gap.md,
  },
  noticeText: { color: t.warmInk, fontSize: 14 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: gap.sm,
    marginTop: gap.lg,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    backgroundColor: t.inset,
    borderRadius: radius.lg,
    paddingHorizontal: gap.lg,
    paddingTop: 12,
    paddingBottom: 12,
    color: t.ink,
    fontSize: 15,
    lineHeight: 20,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.calmStrong,
    ...elevation.cta,
  },
  sendDisabled: {
    backgroundColor: t.sunken,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  });
}
