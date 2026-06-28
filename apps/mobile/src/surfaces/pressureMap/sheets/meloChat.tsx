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

import { useRef } from 'react';
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

import { Body, CheckGlyph, elevation, gap, Hairline, paper, radius, serif } from '../kit';
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
  /** Set when the last turn returned a non-ok result (no-provider / no-key / error). */
  lastResultStatus?: Exclude<MeloChatResult['status'], 'ok'> | undefined;
  /** A short message for the non-ok state (e.g. "No AI provider configured."). */
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
      <View style={styles.header}>
        <MeloFigure mood={props.mood} size={36} reduceMotion={props.reduceMotion} />
        <View style={styles.headerText}>
          <Text style={styles.headerName}>Melo</Text>
          <Text style={styles.headerStatus} numberOfLines={1}>
            {`${shareLabel} · ${toneLabel}`}
          </Text>
        </View>
        <Pressable
          accessibilityHint="Opens Melo's voice and sharing settings."
          accessibilityLabel="Chat settings"
          accessibilityRole="button"
          hitSlop={10}
          onPress={props.onToggleSettings}
          style={({ pressed }) => [styles.tuneButton, pressed ? styles.pressedDim : undefined]}
        >
          <Text style={styles.tuneLabel}>{props.showSettings ? 'Done' : 'Tune'}</Text>
        </Pressable>
      </View>
      <Hairline />

      {/* Financial snapshot strip — the thing the web header implies but states plainly here:
          available now, tightest point, items to review, next payday. Reads only the snapshot. */}
      <SnapshotStrip snapshot={props.snapshot} />

      {/* Tune panel — voice chips + the "let Melo see my money" toggle + start-fresh. */}
      {props.showSettings ? (
        <View style={styles.settings}>
          <View>
            <Text style={styles.settingsLabel}>Voice</Text>
            <View style={styles.toneRow}>
              {TONES.map((tone) => {
                const selected = props.settings.tone === tone.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={tone.id}
                    onPress={() => props.onChangeTone(tone.id)}
                    style={({ pressed }) => [
                      styles.toneChip,
                      selected ? styles.toneChipSelected : undefined,
                      pressed ? styles.pressedDim : undefined,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toneChipLabel,
                        selected ? styles.toneChipLabelSelected : undefined,
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
            style={({ pressed }) => [styles.shareRow, pressed ? styles.pressedDim : undefined]}
          >
            <View style={styles.shareText}>
              <Text style={styles.shareTitle}>Let Melo see my money</Text>
              <Text style={styles.shareHint}>
                Sends a summary of your path, pots and subs to your AI provider so Melo can help.
                Leave it off to keep everything on this device.
              </Text>
            </View>
            <View style={[styles.checkbox, props.settings.share ? styles.checkboxOn : undefined]}>
              {props.settings.share ? <CheckGlyph color={paper.inverse} size={16} /> : null}
            </View>
          </Pressable>

          {props.messages.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={props.onStartFresh}
              style={({ pressed }) => [pressed ? styles.pressedDim : undefined]}
            >
              <Text style={styles.startFresh}>Start fresh</Text>
            </Pressable>
          ) : null}
          <Hairline />
        </View>
      ) : null}

      {/* Transcript. */}
      <View style={styles.transcript}>
        {threadEmpty && !props.isSending ? (
          <View style={styles.empty}>
            <Text style={styles.emptyPrompt}>What's on your mind?</Text>
            <View style={styles.starters}>
              {STARTERS.map((starter) => (
                <Pressable
                  accessibilityRole="button"
                  key={starter}
                  onPress={() => props.onSend(starter)}
                  style={({ pressed }) => [styles.starter, pressed ? styles.pressedDim : undefined]}
                >
                  <Text style={styles.starterText}>{starter}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {props.messages.map((message) =>
          message.role === 'user' ? (
            <View key={message.id} style={styles.userRow}>
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{message.text}</Text>
              </View>
            </View>
          ) : (
            <View key={message.id} style={styles.assistantRow}>
              <Text style={styles.assistantText}>{message.text}</Text>
            </View>
          ),
        )}

        {/* Advisory suggestion chips for the latest reply — user confirms, Melo never auto-applies. */}
        {props.pendingSuggestions && props.pendingSuggestions.length > 0
          ? props.pendingSuggestions.map((suggestion) => (
              <View key={suggestion.id} style={styles.suggestion}>
                <View style={styles.suggestionMark}>
                  <CheckGlyph color={paper.calm} size={18} />
                </View>
                <View style={styles.suggestionBody}>
                  <Text style={styles.suggestionKind}>{suggestion.name.replace(/_/g, ' ')}</Text>
                  <Text style={styles.suggestionSummary}>{suggestion.summary}</Text>
                  <View style={styles.suggestionActions}>
                    <Pressable
                      accessibilityHint="Applies this suggested change."
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => props.onAcceptSuggestion(suggestion)}
                      style={({ pressed }) => [pressed ? styles.pressedDim : undefined]}
                    >
                      <Text style={styles.suggestionAccept}>Do it</Text>
                    </Pressable>
                    <Pressable
                      accessibilityHint="Dismisses this suggestion without changing anything."
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => props.onDismissSuggestion(suggestion)}
                      style={({ pressed }) => [pressed ? styles.pressedDim : undefined]}
                    >
                      <Text style={styles.suggestionDismiss}>Not now</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          : null}

        {props.isSending ? <Text style={styles.thinking}>Melo's thinking…</Text> : null}

        {props.lastResultStatus && props.statusMessage ? (
          <View style={styles.notice}>
            <Body style={styles.noticeText}>{props.statusMessage}</Body>
          </View>
        ) : null}
      </View>

      {/* Composer. */}
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="Message Melo"
          editable={!props.isSending}
          multiline
          onChangeText={props.onChangeInput}
          onSubmitEditing={submitComposer}
          placeholder="Say anything to Melo…"
          placeholderTextColor={paper.muted}
          ref={inputRef}
          returnKeyType="send"
          style={styles.input}
          value={props.input}
        />
        <Pressable
          accessibilityHint="Sends your message to Melo."
          accessibilityLabel="Send"
          accessibilityRole="button"
          disabled={props.input.trim().length === 0 || props.isSending}
          onPress={submitComposer}
          style={({ pressed }) => [
            styles.send,
            props.input.trim().length === 0 || props.isSending ? styles.sendDisabled : undefined,
            pressed ? styles.pressedDim : undefined,
          ]}
        >
          <SendGlyph
            color={props.input.trim().length === 0 || props.isSending ? paper.muted : paper.inverse}
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
  return (
    <View style={styles.snapshot}>
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
  return (
    <View style={[styles.snapshotCell, style]}>
      <Text style={styles.snapshotLabel}>{label}</Text>
      <Text style={[styles.snapshotValue, muted ? styles.snapshotValueMuted : undefined]}>
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
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  pressedDim: { opacity: 0.6 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.md,
    paddingBottom: gap.md,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { color: paper.ink, fontSize: 15, fontWeight: '600' },
  headerStatus: { color: paper.muted, fontSize: 12, marginTop: 1 },
  tuneButton: { paddingVertical: 4, paddingHorizontal: 4 },
  tuneLabel: {
    color: paper.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  snapshot: {
    flexDirection: 'row',
    backgroundColor: paper.inset,
    borderRadius: radius.lg,
    paddingVertical: gap.md,
    paddingHorizontal: gap.lg,
    marginTop: gap.md,
  },
  snapshotCell: { flex: 1, gap: 2 },
  snapshotLabel: {
    color: paper.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  snapshotValue: {
    color: paper.ink,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  snapshotValueMuted: { color: paper.muted },

  settings: { gap: gap.md, paddingTop: gap.md },
  settingsLabel: {
    color: paper.muted,
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
    backgroundColor: paper.inset,
  },
  toneChipSelected: { backgroundColor: paper.ink },
  toneChipLabel: { color: paper.ink, fontSize: 13, fontWeight: '600' },
  toneChipLabelSelected: { color: paper.inverse },

  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap.md,
  },
  shareText: { flex: 1 },
  shareTitle: { color: paper.ink, fontSize: 14, fontWeight: '500' },
  shareHint: { color: paper.muted, fontSize: 12, lineHeight: 17, marginTop: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: paper.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.surface,
  },
  checkboxOn: { backgroundColor: paper.calm, borderColor: paper.calm },
  startFresh: {
    color: paper.muted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  transcript: { paddingTop: gap.md, gap: gap.sm },

  empty: { paddingVertical: gap.lg, gap: gap.lg },
  emptyPrompt: {
    color: paper.ink,
    fontFamily: serif.displayItalic,
    fontSize: 17,
    lineHeight: 23,
  },
  starters: { gap: gap.sm },
  starter: {
    backgroundColor: paper.inset,
    borderRadius: radius.lg,
    paddingVertical: gap.md,
    paddingHorizontal: gap.lg,
  },
  starterText: { color: paper.ink, fontSize: 14, lineHeight: 19 },

  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: paper.ink,
    borderRadius: radius.xl,
    borderBottomRightRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: gap.lg,
  },
  userText: { color: paper.inverse, fontSize: 15, lineHeight: 21 },

  assistantRow: { paddingVertical: 2 },
  assistantText: { color: paper.ink, fontSize: 15, lineHeight: 22 },

  suggestion: {
    flexDirection: 'row',
    gap: gap.sm,
    backgroundColor: paper.inset,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.hairline,
    padding: gap.md,
  },
  suggestionMark: { paddingTop: 1 },
  suggestionBody: { flex: 1, gap: 4 },
  suggestionKind: {
    color: paper.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  suggestionSummary: { color: paper.ink, fontSize: 14, lineHeight: 19 },
  suggestionActions: { flexDirection: 'row', gap: gap.lg, marginTop: 2 },
  suggestionAccept: { color: paper.calmStrong, fontSize: 13, fontWeight: '700' },
  suggestionDismiss: { color: paper.muted, fontSize: 13, fontWeight: '600' },

  thinking: {
    color: paper.muted,
    fontFamily: serif.displayItalic,
    fontSize: 15,
    paddingVertical: gap.sm,
  },

  notice: {
    backgroundColor: paper.caution + '22',
    borderRadius: radius.md,
    paddingVertical: gap.sm,
    paddingHorizontal: gap.md,
  },
  noticeText: { color: paper.warmInk, fontSize: 14 },

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
    backgroundColor: paper.inset,
    borderRadius: radius.lg,
    paddingHorizontal: gap.lg,
    paddingTop: 12,
    paddingBottom: 12,
    color: paper.ink,
    fontSize: 15,
    lineHeight: 20,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.calmStrong,
    ...elevation.cta,
  },
  sendDisabled: {
    backgroundColor: paper.sunken,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
});
