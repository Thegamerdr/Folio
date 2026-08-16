import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { MeloLine } from '@/folio/melo/MeloLine';
import { useAppStore } from '@/folio/store';
import type { OneMoveRecord, OneMoveStatus } from '@/folio/lib/melo/oneMove';
import type { Nav } from '@/folio/types';

const STATUS_LABEL: Readonly<Record<OneMoveStatus, string>> = {
  suggested: 'suggested',
  accepted: 'accepted',
  dismissed: 'dismissed',
  expired: 'passed',
};

export function MeloMovesScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const moves = useAppStore((state) => state.meloMoves ?? []);

  const openMove = (move: OneMoveRecord) => {
    if (move.status !== 'accepted') return;
    const observation = move.outcome ? outcomeSentence(move) : null;
    Alert.alert(
      'You did this.',
      observation
        ? `Here’s what happened. ${observation}`
        : 'Melo will compare the path after seven days.',
      [{ text: 'Done' }],
    );
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
            accessibilityHint="Goes back to Account."
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={16}
            onPress={() => nav.back()}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            <Text style={[styles.back, { color: t.muted }]}>←</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Your moves</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            {'The moves you’ve '}
            <Text style={[styles.headlineAccent, { color: t.calm }]}>seen</Text>
            {'.'}
          </Text>
        </View>

        {moves.length === 0 ? (
          <View style={[styles.empty, { borderColor: t.hairline }]}>
            <Text style={[styles.emptyText, { color: t.muted }]}>
              Nothing yet. Melo speaks when something shifts.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {moves.map((move) => {
              const tappable = move.status === 'accepted';
              const observation = move.outcome ? outcomeSentence(move) : null;
              return (
                <Pressable
                  key={move.id}
                  accessibilityHint={
                    tappable ? 'Shows what happened after you accepted this move.' : undefined
                  }
                  accessibilityLabel={`${move.headline}. ${STATUS_LABEL[move.status]}.`}
                  accessibilityRole={tappable ? 'button' : undefined}
                  disabled={!tappable}
                  onPress={() => openMove(move)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderBottomColor: t.hairline,
                      opacity: move.status === 'dismissed' ? 0.4 : 1,
                    },
                    pressed ? styles.pressed : undefined,
                  ]}
                >
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowHeadline, { color: t.ink }]}>{move.headline}</Text>
                    <View style={[styles.chip, { backgroundColor: t.inset }]}>
                      <Text style={[styles.chipText, { color: t.muted }]}>
                        {STATUS_LABEL[move.status]}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.date, { color: t.muted }]}>
                    {formatDate(move.createdAt)}
                  </Text>
                  {observation ? (
                    <Text style={[styles.outcome, { color: t.calmStrong }]}>{observation}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.meloLine}>
          <MeloLine text="No scores. Just what shifted after a move." />
        </View>
      </ScrollView>
    </View>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function outcomeSentence(move: OneMoveRecord): string {
  if (!move.outcome) return '';
  const delta = move.outcome.tightPointDelta;
  const verdict = delta > 0.5 ? 'lifted' : delta < -0.5 ? 'bent' : 'held';
  if (verdict === 'held') return 'The path held.';
  return `The path ${verdict} by £${Math.abs(delta).toLocaleString('en-GB', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}.`;
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
  list: { paddingTop: gap.md },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 76,
    paddingBottom: gap.md,
    paddingTop: gap.md,
  },
  rowTop: { alignItems: 'flex-start', flexDirection: 'row', gap: gap.sm },
  rowHeadline: {
    flex: 1,
    fontFamily: serif.display,
    fontSize: 15,
    lineHeight: 21,
  },
  chip: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 9.5, letterSpacing: 0.4, textTransform: 'uppercase' },
  date: { fontSize: 10.5, marginTop: gap.xs },
  outcome: {
    fontFamily: serif.displayItalic,
    fontSize: 12.5,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: gap.xs,
  },
  meloLine: { paddingTop: gap.xxl },
  pressed: { opacity: 0.72 },
});
