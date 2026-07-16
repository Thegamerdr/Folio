import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gap, radius, serif, useTheme } from '@/folio/theme';
import { Melo } from '@/folio/melo/Melo';
import { useAppStore } from '@/folio/store';
import type { Nav } from '@/folio/types';

const STARTERS = [
  'What needs my review?',
  'What changed recently?',
  'Show my business accounts',
] as const;

export function BusinessMeloScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const workspace = useAppStore(
    (state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId)!,
  );
  const hasMoneyPicture = useAppStore(
    (state) => (state.accounts?.length ?? 0) > 0 || state.transactions.length > 0,
  );

  return (
    <View style={[styles.root, { backgroundColor: t.canvas }]}>
      <ScrollView
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
          <Melo mood={hasMoneyPicture ? 'curious' : 'calm'} size={74} />
          <Text style={[styles.eyebrow, { color: t.muted }]}>{workspace.name}</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: t.ink }]}>
            Melo stays with the business side.
          </Text>
          <Text style={[styles.intro, { color: t.muted }]}>
            Questions here use this workspace's local accounts, activity and review state. Personal
            money and Personal companion context stay out.
          </Text>
        </View>

        {!hasMoneyPicture ? (
          <View style={[styles.emptyWell, { backgroundColor: t.inset }]}>
            <Text style={[styles.emptyTitle, { color: t.ink }]}>Nothing to read yet.</Text>
            <Text style={[styles.emptyBody, { color: t.muted }]}>
              Add a real account or record first. Melo will wait rather than make up a business
              picture.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.go('account')}
              style={({ pressed }) => [styles.emptyAction, { opacity: pressed ? 0.62 : 1 }]}
            >
              <Text style={[styles.emptyActionLabel, { color: t.calmStrong }]}>
                Add an account →
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          accessibilityHint={`Opens the local companion for ${workspace.name}.`}
          accessibilityRole="button"
          onPress={() =>
            nav.openMelo({
              seed: `I'm looking only at ${workspace.name}. What would you like to check?`,
            })
          }
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: t.calmStrong, opacity: pressed ? 0.68 : 1 },
          ]}
        >
          <Text style={[styles.primaryLabel, { color: t.inverse }]}>Ask Melo</Text>
        </Pressable>

        {hasMoneyPicture ? (
          <View style={styles.starters}>
            <Text style={[styles.starterTitle, { color: t.muted }]}>Start with</Text>
            {STARTERS.map((starter) => (
              <Pressable
                accessibilityRole="button"
                key={starter}
                onPress={() => nav.openMelo({ prefill: starter })}
                style={({ pressed }) => [
                  styles.starter,
                  {
                    backgroundColor: t.surface,
                    borderColor: t.hairline,
                    opacity: pressed ? 0.62 : 1,
                  },
                ]}
              >
                <Text style={[styles.starterLabel, { color: t.ink }]}>{starter}</Text>
                <Text accessibilityElementsHidden style={[styles.arrow, { color: t.calmStrong }]}>
                  →
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
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
  hero: { alignItems: 'flex-start', marginTop: gap.xl },
  eyebrow: { fontFamily: serif.displayItalic, fontSize: 13, marginTop: gap.md },
  headline: {
    fontFamily: serif.display,
    fontSize: 31,
    letterSpacing: -0.35,
    lineHeight: 37,
    marginTop: gap.xs,
  },
  intro: { fontSize: 14, lineHeight: 21, marginTop: gap.md, maxWidth: 520 },
  emptyWell: { borderRadius: radius.xl, marginTop: gap.xl, padding: gap.xl },
  emptyTitle: { fontFamily: serif.medium, fontSize: 20, lineHeight: 25 },
  emptyBody: { fontSize: 13.5, lineHeight: 20, marginTop: gap.sm },
  emptyAction: { justifyContent: 'center', marginTop: gap.md, minHeight: 44 },
  emptyActionLabel: { fontSize: 13.5, fontWeight: '600' },
  primary: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: gap.xl,
    minHeight: 52,
    paddingHorizontal: gap.lg,
  },
  primaryLabel: { fontSize: 15, fontWeight: '700' },
  starters: { gap: gap.sm, marginTop: gap.xl },
  starterTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  starter: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: gap.lg,
    paddingVertical: gap.sm,
  },
  starterLabel: { flex: 1, fontSize: 13.5, lineHeight: 18 },
  arrow: { fontSize: 18, marginLeft: gap.md },
});
