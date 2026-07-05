// Premium preview (MELO_BLUEPRINT.md — "the loop comes first"): an honest look at what stays
// free forever and what a future Plus tier might one day cover — nothing here is purchasable.
// No price, no CTA, no paywall theatre. The suppressed-state rule is stated plainly so nobody
// mistakes silence for a locked door.

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Display, GhostButton, Muted, Surface, useTheme } from '@/surfaces/pressureMap/kit';

type Props = {
  onClose: () => void;
};

const FREE_FOREVER: readonly string[] = [
  'The number — your Safe Zone, every day, no limit',
  'Danger warnings before they become a crisis',
  'Recovery — the walkthrough back to steady',
  'The ritual — the two-minute payday check-in',
];

const PLUS_LATER: readonly string[] = [
  'Multiple accounts in one picture',
  'The full leaks view — every quiet drain, not just the loudest one',
  'What-if scenarios — try a decision before you make it',
  'Household — shared money, planned together',
];

export function Premium({ onClose }: Props) {
  const t = useTheme();

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Display>What&rsquo;s next.</Display>
        <Muted style={s.sub}>An honest look ahead — nothing here is for sale.</Muted>

        <Muted style={s.sectionTag}>WHAT IS FREE STAYS FREE</Muted>
        <Surface style={s.list} tone="sunken">
          {FREE_FOREVER.map((line) => (
            <View key={line} style={s.row}>
              <View style={[s.dot, { backgroundColor: t.positive }]} />
              <Text style={[s.rowText, { color: t.ink }]}>{line}</Text>
            </View>
          ))}
        </Surface>

        <Muted style={s.sectionTag}>PLUS — LATER</Muted>
        <Surface style={[s.list, s.greyed]} tone="sunken">
          {PLUS_LATER.map((line) => (
            <View key={line} style={s.row}>
              <View style={[s.dot, { backgroundColor: t.muted }]} />
              <Text style={[s.rowText, { color: t.muted }]}>{line}</Text>
            </View>
          ))}
          <Muted style={s.notForSale}>not for sale yet — the loop comes first</Muted>
        </Surface>

        <Muted style={s.footnote}>
          Melo doesn&rsquo;t hide the free tier behind a countdown or a locked screen. If something
          here ever moves behind Plus, it stays visible and explained — never suppressed to push a
          decision.
        </Muted>

        <View style={s.cta}>
          <GhostButton label="back" onPress={onClose} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 26, paddingTop: 30, paddingBottom: 40 },
  sub: { marginTop: 6, lineHeight: 20 },
  sectionTag: { marginTop: 22, marginBottom: 10, fontSize: 11.5, letterSpacing: 0.8 },
  list: { gap: 12 },
  greyed: { opacity: 0.75 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 999, marginTop: 6 },
  rowText: { fontSize: 14, flexShrink: 1, lineHeight: 19 },
  notForSale: { marginTop: 2, fontSize: 12, fontStyle: 'italic' },
  footnote: { marginTop: 22, lineHeight: 18 },
  cta: { marginTop: 28 },
});
