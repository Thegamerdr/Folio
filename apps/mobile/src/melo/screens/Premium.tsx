// Premium (PRICING.md): the real three-tier shape — Free / Melo Plus / Melo Pro — shown honestly
// before the store build exists. No price is purchasable yet: every CTA is a quiet "arrives with
// the store build" line, not a buy button. The never-sell rules and the one-cycle trial (no
// auto-renew) are stated plainly so nobody mistakes silence for a locked door.

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Display, GhostButton, Muted, Surface, useTheme } from '@/surfaces/pressureMap/kit';

type Props = {
  onClose: () => void;
};

type Tier = {
  readonly name: string;
  readonly price: string;
  readonly tagline: string;
  readonly lenses: readonly string[];
  readonly features: readonly string[];
};

const FREE: Tier = {
  name: 'Free',
  price: '£0 · forever',
  tagline: 'The money-path question, answered honestly, no card needed.',
  lenses: ['Survival', 'Stability'],
  features: [
    'Today, Calendar, Pots, Subscriptions',
    'Payday Review, Weekly and Monthly Review, Recovery',
    'Before You Spend, the 24-Hour Shelf, Bills Shield',
    'Safe Zone math, Danger Date, Money Weather',
  ],
};

const PLUS: Tier = {
  name: 'Melo Plus',
  price: '£4.99/mo · £39.99/yr',
  tagline: 'Everyday clarity once the basics are steady.',
  lenses: ['Growth', 'Reset', 'Optimizer', 'Planning'],
  features: [
    'Bill Shield across the full calendar',
    'What changed, cycle to cycle',
    'Extra wardrobe items for Melo',
  ],
};

const PRO: Tier = {
  name: 'Melo Pro',
  price: '£8.99/mo · £69.99/yr',
  tagline: 'Everything in Plus, plus the harder, shared, uneven money.',
  lenses: ['Low-visibility', 'Irregular income', 'Debt / BNPL', 'Household'],
  features: ['Household — a shared lens across two people', 'Everything Melo Plus includes'],
};

const NEVER_SELL: readonly string[] = [
  'The payday question — will my money last?',
  'Bills Shield',
  'Before You Spend',
  'The 24-Hour Shelf',
  'Recovery',
];

function TierCard({ tier }: { tier: Tier }) {
  const t = useTheme();
  return (
    <Surface style={s.card} tone="sunken">
      <View style={s.cardHeader}>
        <Text style={[s.tierName, { color: t.ink }]}>{tier.name}</Text>
        <Text style={[s.tierPrice, { color: t.muted }]}>{tier.price}</Text>
      </View>
      <Body style={s.tagline}>{tier.tagline}</Body>

      <Muted style={s.subTag}>LENSES</Muted>
      <View style={s.chipRow}>
        {tier.lenses.map((lens) => (
          <View key={lens} style={[s.chip, { borderColor: t.hairline, backgroundColor: t.inset }]}>
            <Text style={[s.chipLabel, { color: t.ink }]}>{lens}</Text>
          </View>
        ))}
      </View>

      <Muted style={s.subTag}>ALSO INCLUDES</Muted>
      {tier.features.map((line) => (
        <View key={line} style={s.row}>
          <View style={[s.dot, { backgroundColor: t.calm }]} />
          <Text style={[s.rowText, { color: t.ink }]}>{line}</Text>
        </View>
      ))}
    </Surface>
  );
}

export function Premium({ onClose }: Props) {
  const t = useTheme();

  return (
    <View style={[s.root, { backgroundColor: t.canvas }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Display>Free, Plus, and Pro.</Display>
        <Muted style={s.sub}>
          Ten lenses, three tiers. Nothing here is purchasable yet — an honest look at the shape
          before the store build arrives.
        </Muted>

        <TierCard tier={FREE} />
        <TierCard tier={PLUS} />
        <TierCard tier={PRO} />

        <Muted style={s.sectionTag}>ONE-CYCLE FREE TRIAL</Muted>
        <Surface style={s.list} tone="sunken">
          <Text style={[s.rowText, { color: t.ink }]}>
            One full cycle unlocks every lens across Plus and Pro. No auto-renew — the trial ends on
            its own, and moving to a paid tier is a second, separate choice.
          </Text>
        </Surface>

        <Muted style={s.sectionTag}>WHAT WE WILL NEVER CHARGE FOR</Muted>
        <Surface style={s.list} tone="sunken">
          {NEVER_SELL.map((line) => (
            <View key={line} style={s.row}>
              <View style={[s.dot, { backgroundColor: t.positive }]} />
              <Text style={[s.rowText, { color: t.ink }]}>{line}</Text>
            </View>
          ))}
          <Muted style={s.notForSale}>
            and never an upsell during Recovery, a storm, a negative Safe Zone, or Quiet Mode
          </Muted>
        </Surface>

        <Muted style={s.footnote}>
          Nothing on this screen is for sale today. When the store build lands, upgrading is a plain
          choice you make on purpose — never a countdown, never a locked screen.
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
  card: { marginTop: 20, gap: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tierName: { fontSize: 17, fontWeight: '600' },
  tierPrice: { fontSize: 13 },
  tagline: { marginTop: 2, marginBottom: 8, lineHeight: 19 },
  subTag: { marginTop: 10, marginBottom: 6, fontSize: 11, letterSpacing: 0.6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipLabel: { fontSize: 12.5, fontWeight: '500' },
  sectionTag: { marginTop: 24, marginBottom: 10, fontSize: 11.5, letterSpacing: 0.8 },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 999, marginTop: 6 },
  rowText: { fontSize: 14, flexShrink: 1, lineHeight: 19 },
  notForSale: { marginTop: 2, fontSize: 12, fontStyle: 'italic' },
  footnote: { marginTop: 22, lineHeight: 18 },
  cta: { marginTop: 28 },
});
