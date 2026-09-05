import { useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildMoreSearchResults } from '@/folio/lib/moreSearchModel';
import { useAppStore } from '@/folio/store';
import { ChevronRight, gap, radius, serif, useTheme, weightFamily } from '@/folio/theme';
import type { MoreSearchResult } from '@/folio/lib/moreSearchModel';
import type { Nav } from '@/folio/types';

export function MoreSearchScreen({ nav }: { nav: Nav }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const pots = useAppStore((state) => state.pots);
  const subscriptions = useAppStore((state) => state.subs);
  const debts = useAppStore((state) => state.debts);
  const results = useMemo(
    () =>
      buildMoreSearchResults(query, {
        pots: pots.map((pot) => pot.name),
        subscriptions: subscriptions.map((sub) => sub.name),
        debts: (debts ?? []).map((debt) => debt.name),
      }),
    [debts, pots, query, subscriptions],
  );

  function openResult(result: MoreSearchResult) {
    Keyboard.dismiss();
    if (result.target.kind === 'screen') nav.go(result.target.screen);
    else nav.openSheet(result.target.sheet);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.canvas, paddingTop: insets.top }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + gap.xl, paddingTop: gap.sm }}
      >
        <View style={styles.content}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to More"
            onPress={nav.back}
            style={styles.back}
          >
            <Text style={[styles.backLabel, { color: t.muted }]}>‹ More</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: t.muted }]}>Find</Text>
          <Text accessibilityRole="header" style={[styles.heading, { color: t.ink }]}>
            Search <Text style={{ color: t.calm }}>Melo</Text>.
          </Text>
          <Text style={[styles.subhead, { color: t.muted }]}>
            Jump to a place, a record, or a safe next action.
          </Text>
          <TextInput
            accessibilityLabel="Search Melo"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            placeholder="Search your workspace"
            placeholderTextColor={t.muted}
            returnKeyType="search"
            style={[
              styles.input,
              { backgroundColor: t.surface, borderColor: t.hairline, color: t.ink },
            ]}
            value={query}
          />
          <View style={styles.results}>
            {results.length === 0 ? (
              <Text style={[styles.empty, { color: t.muted }]}>
                No matching place or record yet.
              </Text>
            ) : (
              results.map((result) => (
                <Pressable
                  key={result.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${result.label}, ${result.meta}`}
                  onPress={() => openResult(result)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomColor: t.hairline },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={[styles.label, { color: t.ink }]} numberOfLines={1}>
                      {result.label}
                    </Text>
                    <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
                      {result.meta}
                    </Text>
                  </View>
                  <ChevronRight color={t.muted} />
                </Pressable>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gap.xl },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backLabel: { fontFamily: weightFamily(500), fontSize: 14 },
  eyebrow: {
    fontFamily: weightFamily(400),
    fontSize: 11,
    letterSpacing: 1.54,
    lineHeight: 16,
    marginTop: gap.lg,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: serif.display,
    fontSize: 28,
    letterSpacing: -0.56,
    lineHeight: 32,
    marginTop: gap.xs,
  },
  subhead: { fontFamily: weightFamily(400), fontSize: 14, lineHeight: 22, marginTop: gap.sm },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontFamily: weightFamily(400),
    fontSize: 15,
    minHeight: 48,
    marginTop: gap.xl,
    paddingHorizontal: gap.md,
    paddingVertical: gap.sm,
  },
  results: { marginTop: gap.lg },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
    paddingVertical: gap.sm,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  label: { fontFamily: weightFamily(500), fontSize: 14, lineHeight: 21 },
  meta: { fontFamily: weightFamily(400), fontSize: 12.5, lineHeight: 19, marginTop: 2 },
  empty: { fontFamily: weightFamily(400), fontSize: 14, lineHeight: 22, paddingVertical: gap.xl },
  pressed: { opacity: 0.72 },
});
