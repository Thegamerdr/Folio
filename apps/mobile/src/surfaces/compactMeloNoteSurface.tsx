import { StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

import { type CompactMeloNote } from '../local/localMeloPolicyAdapter';

type CompactMeloNoteSurfaceProps = Readonly<{
  note: CompactMeloNote;
  tone?: 'primary' | 'warm';
}>;

export function CompactMeloNoteSurface({ note, tone = 'primary' }: CompactMeloNoteSurfaceProps) {
  return (
    <View
      accessible
      accessibilityLabel={note.accessibilityLabel}
      style={[styles.panel, tone === 'warm' ? styles.panelWarm : undefined]}
    >
      <Text style={styles.label}>Melo noticed</Text>
      <Text style={styles.title}>{note.noticed}</Text>
      <Text style={styles.label}>Why it matters</Text>
      <Text style={styles.body}>{note.matters}</Text>
      <Text style={styles.label}>Your control</Text>
      <Text style={styles.body}>{note.control}</Text>
    </View>
  );
}

const colors = folioTokens.color.role;
const spacing = folioTokens.spacing.scale;
const radius = folioTokens.size.radius;

const styles = StyleSheet.create({
  body: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  panelWarm: {
    backgroundColor: colors.accent.warmSoft,
  },
  title: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
});
