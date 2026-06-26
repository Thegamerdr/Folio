import { StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

export function ManualPathThreeFactsPanel({ copy }: Readonly<{ copy: string }>) {
  return (
    <View
      accessible
      accessibilityLabel={`Add a few numbers. Three facts are enough for a first briefing. ${copy}`}
      style={styles.panel}
    >
      <Text style={styles.kicker}>Add a few numbers</Text>
      <Text style={styles.title}>Three facts. One first picture.</Text>
      <Text style={styles.body}>Enough for a first briefing. Add more later.</Text>
      <View style={styles.factRow}>
        <FactPill label="Money now" />
        <FactPill label="Next income" />
        <FactPill label="Next commitment" />
      </View>
    </View>
  );
}

function FactPill({ label }: Readonly<{ label: string }>) {
  return (
    <View style={styles.factPill}>
      <Text style={styles.factPillText}>{label}</Text>
    </View>
  );
}

const colors = folioTokens.color.role;
const spacing = folioTokens.spacing.scale;
const radius = folioTokens.size.radius;

const styles = StyleSheet.create({
  body: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  factPill: {
    backgroundColor: '#FFFFFF99',
    borderColor: '#FFFFFF00',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  factPillText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  factRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  kicker: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
});
