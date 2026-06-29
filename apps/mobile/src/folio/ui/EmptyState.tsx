// EmptyState — the one primitive every "no data yet" screen renders.
//
// Per the design source (folio-melo/.claude/worktrees/design-main/STATES.md): an empty state is
// Melo + a Fraunces line with ONE accent word + body + an optional single CTA. "Empty ≠ broken":
// this is a calm doorway, never an error. One CTA max; refusal is always an option, so the CTA is
// optional.
//
// Faithful 1:1 RN port. Nothing new is defined here — no colour, font, spacing, radius, or shadow
// token, no dependency. It composes only confirmed exports:
//   • Melo            — the folded-document companion (from '@/folio/melo/Melo'); default mood calm,
//                       grounded so he rests on the paper.
//   • Headline        — the Fraunces display line; its `accent` prop is the ONE coloured word.
//   • Body            — the supporting prose line.
//   • PrimaryAction   — the single CTA (already a >=44px tap target with accessibilityRole="button").
//   • PressureScreen  — the calm centred column.
//   • gap             — the spacing scale (no hard-coded spacing).
// Melo and the kit primitives both gate motion to their final state under reduce-motion internally,
// so this composition needs no extra motion handling.

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, gap, Headline, PressureScreen, PrimaryAction } from '@/folio/theme';
import { Melo, type MeloMood } from '@/folio/melo/Melo';

export type EmptyStateCta = {
  label: string;
  onPress: () => void;
};

export type EmptyStateProps = {
  mood?: MeloMood | undefined;
  headline: string;
  body?: string | undefined;
  cta?: EmptyStateCta | undefined;
};

// The Headline primitive colours a single `accent` word. To honour "ONE accent word" from a plain
// headline string, the final word becomes the accent and everything before it is the lead. A
// single-word headline is itself the accent (no lead). Trailing space on the lead is preserved so
// the two Text runs read as one continuous line.
function splitHeadline(headline: string): { lead: string | undefined; accent: string } {
  const trimmed = headline.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) {
    return { lead: undefined, accent: trimmed };
  }
  return {
    lead: trimmed.slice(0, lastSpace + 1),
    accent: trimmed.slice(lastSpace + 1),
  };
}

export function EmptyState({ mood = 'calm', headline, body, cta }: EmptyStateProps) {
  const { lead, accent } = useMemo(() => splitHeadline(headline), [headline]);

  return (
    <PressureScreen centered>
      <View style={styles.column}>
        <Melo mood={mood} grounded size={64} />
        <Headline lead={lead} accent={accent} style={styles.headline} />
        {body !== undefined ? <Body style={styles.body}>{body}</Body> : null}
        {cta !== undefined ? (
          <View style={styles.action}>
            <PrimaryAction label={cta.label} onPress={cta.onPress} />
          </View>
        ) : null}
      </View>
    </PressureScreen>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
    gap: gap.md,
  },
  headline: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
    marginTop: gap.sm,
  },
});
