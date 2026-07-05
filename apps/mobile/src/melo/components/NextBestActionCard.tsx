// Presentational one-action card, mirroring the action card look in MeloGlance
// (Surface + Eyebrow + Body + PrimaryAction, ink tone). Null-safe: no action, no card.

import { StyleSheet, View } from 'react-native';

import { Body, Eyebrow, PrimaryAction, Surface } from '@/surfaces/pressureMap/kit';

type NextBestAction = { readonly title: string; readonly body: string; readonly cta: string };

type Props = {
  action: NextBestAction | null;
  onPress: () => void;
};

export function NextBestActionCard({ action, onPress }: Props) {
  if (!action) return null;

  return (
    <Surface style={s.card}>
      <Eyebrow tone="muted">{action.title}</Eyebrow>
      <Body style={s.body}>{action.body}</Body>
      <View style={s.cta}>
        <PrimaryAction label={action.cta} tone="ink" onPress={onPress} />
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  card: { marginTop: 16 },
  body: { marginTop: 4, lineHeight: 20 },
  cta: { marginTop: 12 },
});
