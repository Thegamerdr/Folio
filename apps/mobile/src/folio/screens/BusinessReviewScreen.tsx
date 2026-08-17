import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MeloCompanionPerch,
  useMeloCompanionScrollHandlers,
} from '@/folio/companion/MeloCompanionHost';
import { Melo } from '@/folio/melo/Melo';
import { gap, radius, serif, useTheme } from '@/folio/theme';
import { useAppStore } from '@/folio/store';
import { ReviewJourneyTabs } from '@/folio/ui/ReviewJourneyTabs';
import type { Nav } from '@/folio/types';

/**
 * Permanent Business Review-tab destination.
 *
 * The transient single-candidate ReviewScreen still owns a pending decision.
 * This root owns the calm queue-empty state and confirmed history, so the
 * primary tab never looks like a pushed detail screen with a back arrow.
 */
export function BusinessReviewScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const companionScroll = useMeloCompanionScrollHandlers();
  const queueCount = useAppStore(
    (state) =>
      state.readerCandidates.length +
      (state.reviewQueue?.length ?? 0) +
      (state.reviewQueueSpillover?.length ?? 0),
  );

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
        {...companionScroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + gap.lg, paddingBottom: insets.bottom + gap.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wordmarkRow}>
          <Text style={[styles.wordmark, { color: t.ink }]}>Melo</Text>
          <Text style={[styles.workspaceKind, { color: t.muted }]}>Business</Text>
        </View>

        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Review</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            Waiting for your check.
          </Text>
          <Text style={[styles.intro, { color: t.muted }]}>
            Found items land here first. Nothing counts against this workspace until you confirm it.
          </Text>
        </View>

        <ReviewJourneyTabs active="check" nav={nav} />

        {queueCount === 0 ? (
          <View style={[styles.empty, { backgroundColor: t.inset }]}>
            <MeloCompanionPerch companionSize={48} id="business-review/empty" priority={30}>
              <Melo mood="calm" size={44} />
            </MeloCompanionPerch>
            <View style={styles.emptyCopy}>
              <Text style={[styles.emptyTitle, { color: t.ink }]}>Nothing waiting.</Text>
              <Text style={[styles.emptyBody, { color: t.muted }]}>
                Read a statement or receipt and anything Melo finds will queue here for one calm
                pass.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.go('intake')}
                style={({ pressed }) => [styles.linkAction, { opacity: pressed ? 0.62 : 1 }]}
              >
                <Text style={[styles.linkLabel, { color: t.calmStrong }]}>
                  Add to the business side →
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.go('business-review-item')}
            style={({ pressed }) => [
              styles.queueAction,
              { backgroundColor: t.calm, opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <View style={styles.queueCopy}>
              <Text style={[styles.queueLabel, { color: t.accentInk }]}>
                Check {queueCount} {queueCount === 1 ? 'amount' : 'amounts'}
              </Text>
              <Text style={[styles.queueHint, { color: t.accentInk }]}>One decision at a time</Text>
            </View>
            <Text accessibilityElementsHidden style={[styles.queueArrow, { color: t.accentInk }]}>
              →
            </Text>
          </Pressable>
        )}

        <View style={styles.history}>
          <Text style={[styles.sectionTitle, { color: t.muted }]}>History</Text>
          <Pressable
            accessibilityHint="Opens everything you have confirmed or corrected."
            accessibilityRole="button"
            onPress={() => nav.go('timeline')}
            style={({ pressed }) => [
              styles.historyRow,
              {
                backgroundColor: t.surface,
                borderColor: t.hairline,
                opacity: pressed ? 0.62 : 1,
              },
            ]}
          >
            <View style={styles.historyCopy}>
              <Text style={[styles.historyTitle, { color: t.ink }]}>Business activity</Text>
              <Text style={[styles.historyBody, { color: t.muted }]}>
                everything you've confirmed or corrected
              </Text>
            </View>
            <Text
              accessibilityElementsHidden
              style={[styles.historyArrow, { color: t.calmStrong }]}
            >
              →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  wordmarkRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  wordmark: { fontFamily: serif.displayItalic, fontSize: 14 },
  workspaceKind: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.7 },
  hero: { marginTop: gap.xl },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 13 },
  headline: {
    fontFamily: serif.display,
    fontSize: 30,
    letterSpacing: -0.35,
    lineHeight: 36,
    marginTop: gap.xs,
  },
  intro: { fontSize: 13.5, lineHeight: 20, marginTop: gap.md, maxWidth: 520 },
  empty: {
    alignItems: 'flex-start',
    borderRadius: radius.xl,
    flexDirection: 'row',
    gap: gap.md,
    marginTop: gap.xl,
    padding: gap.xl,
  },
  emptyCopy: { flex: 1 },
  emptyTitle: { fontFamily: serif.medium, fontSize: 20, lineHeight: 25 },
  emptyBody: { fontSize: 13, lineHeight: 19, marginTop: gap.sm },
  linkAction: { justifyContent: 'center', marginTop: gap.sm, minHeight: 44 },
  linkLabel: { fontSize: 13, fontWeight: '600' },
  queueAction: {
    alignItems: 'center',
    borderRadius: radius.lg,
    flexDirection: 'row',
    marginTop: gap.xl,
    minHeight: 64,
    paddingHorizontal: gap.lg,
  },
  queueCopy: { flex: 1 },
  queueLabel: { fontSize: 15, fontWeight: '700' },
  queueHint: { fontSize: 12, marginTop: 2, opacity: 0.82 },
  queueArrow: { fontSize: 19 },
  history: { marginTop: gap.xxl },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  historyRow: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: gap.sm,
    minHeight: 56,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.md,
  },
  historyCopy: { flex: 1, paddingRight: gap.md },
  historyTitle: { fontSize: 14, fontWeight: '600' },
  historyBody: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  historyArrow: { fontSize: 18 },
});
