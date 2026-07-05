// A quiet, presentational summary of what moved since last look (MELO_BLUEPRINT.md §2).
// Pure — no store, no engine calls. Null when there is nothing to say.

import { StyleSheet, Text, View } from 'react-native';

import { Eyebrow, Surface, useTheme } from '@/surfaces/pressureMap/kit';

type ChangedItem = { readonly id: string; readonly line: string };

type Props = {
  items: readonly ChangedItem[];
};

export function WhatChangedCard({ items }: Props) {
  const t = useTheme();
  if (items.length === 0) return null;

  return (
    <Surface style={s.card} tone="sunken">
      <Eyebrow tone="muted">WHAT CHANGED</Eyebrow>
      <View style={s.list}>
        {items.map((item) => (
          <View key={item.id} style={s.row}>
            <View style={[s.dot, { backgroundColor: t.calmStrong }]} />
            <Text style={[s.line, { color: t.ink }]}>{item.line}</Text>
          </View>
        ))}
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  card: { marginTop: 16 },
  list: { marginTop: 8, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  line: { fontSize: 14, lineHeight: 19, flexShrink: 1 },
});
