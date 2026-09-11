// MeloLine — the canonical inline use of Melo: the character beside one quoted thought, set in
// Fraunces italic. A 1:1 port of the web kit's <MeloLine> (folio-melo .../components/folio/kit.tsx).
//
// THE RULE (from the web original): one thought per line, double-quoted. The text is rendered as the
// literal characters " … " so the quotes are part of the typographic voice, not a decoration that a
// screen reader might skip. Reach for raw <Melo> only when you need a different layout.

import { StyleSheet, Text, View } from 'react-native';

import { serif, useTheme } from '@/surfaces/pressureMap/kit';

import { Melo, type MeloMood } from './Melo';
import { MeloFigure } from './MeloFigure';

export type MeloLineProps = {
  text: string;
  mood?: MeloMood;
  size?: number;
  showCompanion?: boolean;
  editorial?: boolean;
};

export function MeloLine({
  text,
  mood = 'calm',
  size = 28,
  showCompanion = true,
  editorial = false,
}: MeloLineProps) {
  const t = useTheme();

  return (
    <View style={styles.row}>
      {showCompanion ? (
        editorial ? (
          <MeloFigure role="inline" mood={mood} />
        ) : (
          <Melo mood={mood} size={size} />
        )
      ) : null}
      <Text style={[styles.line, { color: t.secondary }]}>{`“${text}”`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flex: 1,
    fontFamily: serif.displayItalic,
    fontSize: 13.5,
    lineHeight: 18,
    paddingTop: 4,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
});
