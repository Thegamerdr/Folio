import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import {
  forgetAllMeloMemory,
  forgetMeloMemoryLine,
  syncMeloMemoryThread,
  upsertMeloMemoryLine,
  useAppStore,
} from '@/folio/store';
import { observedMemoryLines, type MemoryLine, type MemoryLineKind } from '@/folio/lib/melo/memory';
import type { Nav } from '@/folio/types';

type MemoryGroup = Readonly<{
  title: string;
  kinds: readonly MemoryLineKind[];
  toldOnly?: boolean;
}>;

const GROUPS: readonly MemoryGroup[] = [
  { title: 'Cadence', kinds: ['cadence'] },
  { title: 'Moves that worked', kinds: ['move'] },
  { title: 'Moments', kinds: ['moment', 'postcard', 'whisper'] },
  { title: 'You told me', kinds: ['preference'], toldOnly: true },
];

export function MeloMemoryScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tinyWins = useAppStore((state) => state.tinyWins ?? []);
  const cycles = useAppStore((state) => state.cycles);
  const thread = useAppStore((state) => state.meloMemoryThread ?? []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [undoLine, setUndoLine] = useState<MemoryLine | null>(null);

  const observed = useMemo(() => observedMemoryLines(tinyWins, cycles), [tinyWins, cycles]);
  useEffect(() => {
    syncMeloMemoryThread(observed);
  }, [observed]);

  const beginEdit = (line: MemoryLine) => {
    setEditingId(line.id);
    setDraft(line.text);
  };

  const saveEdit = (line: MemoryLine) => {
    const text = draft.trim();
    if (!text) {
      Alert.alert('Keep one clear line', 'Melo cannot remember a blank note.');
      return;
    }
    upsertMeloMemoryLine({ ...line, text, source: 'toldByYou' });
    setEditingId(null);
    setDraft('');
  };

  const forget = (id: string) => {
    const removed = forgetMeloMemoryLine(id);
    if (removed) setUndoLine(removed);
    if (editingId === id) {
      setEditingId(null);
      setDraft('');
    }
  };

  const forgetEverything = () => {
    Alert.alert('Forget everything Melo remembers?', 'Every line on this page will be removed.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Forget everything now?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Forget everything',
              style: 'destructive',
              onPress: () => {
                forgetAllMeloMemory();
                setUndoLine(null);
              },
            },
          ]),
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxl },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityHint="Goes back to Melo."
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={16}
            onPress={() => nav.back()}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            <Text style={[styles.back, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>What I remember</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'Just what you’ve '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>shown</Text>
            {' me.'}
          </Text>
          <Text style={[styles.intro, { color: t.muted }]}>
            Every line is here. Change one, forget one, or clear the whole thread.
          </Text>
        </View>

        {thread.length === 0 ? (
          <View style={[styles.empty, { borderColor: t.hairline }]}>
            <Text style={[styles.emptyText, { color: t.muted }]}>
              Nothing yet. Melo learns as you use Melo.
            </Text>
          </View>
        ) : (
          GROUPS.map((group) => {
            const lines = thread.filter(
              (line) =>
                group.kinds.includes(line.kind) &&
                (group.toldOnly !== true || line.source === 'toldByYou'),
            );
            if (lines.length === 0) return null;
            return (
              <View key={group.title} style={styles.group}>
                <Text style={[styles.groupTitle, { color: t.muted }]}>{group.title}</Text>
                {lines.map((line) => {
                  const editing = editingId === line.id;
                  return (
                    <View
                      key={line.id}
                      style={[styles.memoryRow, { borderBottomColor: t.hairline }]}
                    >
                      {editing ? (
                        <TextInput
                          accessibilityLabel={`Edit memory: ${line.text}`}
                          autoFocus
                          multiline
                          onChangeText={setDraft}
                          style={[styles.input, { backgroundColor: t.inset, color: t.ink }]}
                          value={draft}
                        />
                      ) : (
                        <Text style={[styles.memoryText, { color: t.ink }]}>{line.text}</Text>
                      )}
                      <Text style={[styles.memoryDate, { color: t.muted }]}>
                        {formatMemoryDate(line.at)}
                      </Text>
                      <View style={styles.actions}>
                        {editing ? (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => {
                                setEditingId(null);
                                setDraft('');
                              }}
                              style={({ pressed }) => [
                                styles.action,
                                pressed ? styles.pressed : undefined,
                              ]}
                            >
                              <Text style={[styles.actionText, { color: t.muted }]}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => saveEdit(line)}
                              style={({ pressed }) => [
                                styles.action,
                                pressed ? styles.pressed : undefined,
                              ]}
                            >
                              <Text style={[styles.actionText, { color: t.calmStrong }]}>Save</Text>
                            </Pressable>
                          </>
                        ) : (
                          <>
                            {line.editable ? (
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => beginEdit(line)}
                                style={({ pressed }) => [
                                  styles.action,
                                  pressed ? styles.pressed : undefined,
                                ]}
                              >
                                <Text style={[styles.actionText, { color: t.muted }]}>Edit</Text>
                              </Pressable>
                            ) : null}
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => forget(line.id)}
                              style={({ pressed }) => [
                                styles.action,
                                pressed ? styles.pressed : undefined,
                              ]}
                            >
                              <Text style={[styles.actionText, { color: t.repairInk }]}>
                                Forget
                              </Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}

        {thread.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={forgetEverything}
            style={({ pressed }) => [styles.forgetAll, pressed ? styles.pressed : undefined]}
          >
            <Text style={[styles.forgetAllText, { color: t.repairInk }]}>Forget everything</Text>
          </Pressable>
        ) : null}

        <View style={styles.meloLine}>
          <MeloLine text="You decide what stays in the thread." />
        </View>
      </ScrollView>

      {undoLine ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.undo,
            {
              backgroundColor: t.ink,
              bottom: insets.bottom + gap.md,
            },
          ]}
        >
          <Text numberOfLines={1} style={[styles.undoText, { color: t.canvas }]}>
            Forgotten
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              upsertMeloMemoryLine(undoLine);
              setUndoLine(null);
            }}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            <Text style={[styles.undoAction, { color: t.calmSoft }]}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function formatMemoryDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  back: { fontSize: 20, lineHeight: 24 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerSpacer: { width: 20 },
  titleBlock: { paddingBottom: gap.xl, paddingTop: gap.xl },
  headline: {
    fontFamily: serif.displayItalic,
    fontSize: 30,
    fontStyle: 'italic',
    letterSpacing: -0.35,
    lineHeight: 33,
  },
  headlineAccent: { fontFamily: serif.display, fontStyle: 'normal' },
  intro: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
    marginTop: gap.sm,
  },
  empty: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: gap.xl,
    padding: gap.lg,
  },
  emptyText: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  group: { paddingTop: gap.xl },
  groupTitle: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    paddingBottom: gap.xxs,
    textTransform: 'uppercase',
  },
  memoryRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: gap.md,
    paddingTop: gap.md,
  },
  memoryText: {
    fontFamily: serif.display,
    fontSize: 15,
    lineHeight: 21,
  },
  memoryDate: { fontSize: 10.5, marginTop: gap.xs },
  input: {
    borderRadius: radius.md,
    fontFamily: serif.display,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 76,
    padding: gap.md,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: gap.lg,
    marginTop: gap.sm,
  },
  action: {
    justifyContent: 'center',
    minHeight: 44,
    paddingRight: gap.sm,
  },
  actionText: { fontSize: 12, fontWeight: '500' },
  forgetAll: {
    alignItems: 'center',
    marginTop: gap.huge,
    minHeight: 48,
    paddingVertical: gap.md,
  },
  forgetAllText: {
    fontFamily: serif.displayItalic,
    fontSize: 13,
    fontStyle: 'italic',
  },
  meloLine: { marginTop: gap.xl },
  undo: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: gap.md,
    justifyContent: 'space-between',
    left: gap.xl,
    minHeight: 48,
    paddingHorizontal: gap.lg,
    position: 'absolute',
    right: gap.xl,
  },
  undoText: { flex: 1, fontSize: 12 },
  undoAction: { fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.6, transform: [{ scale: 0.97 }] },
});
