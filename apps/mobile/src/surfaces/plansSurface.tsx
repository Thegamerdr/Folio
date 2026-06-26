import { StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

export function PlansPathSurface({
  projectionCount,
  reviewCount,
  sourceLabel,
}: Readonly<{
  projectionCount: number;
  reviewCount: number;
  sourceLabel: string;
}>) {
  return (
    <View
      accessible
      accessibilityLabel={`${projectionCount} plan projections and ${reviewCount} review tasks from ${sourceLabel}. Plans show intention, protected money, movement and linked evidence.`}
      style={styles.panel}
    >
      <Text style={styles.kicker}>User-owned plans</Text>
      <Text style={styles.title}>Progress without pressure.</Text>
      <View style={styles.planRail}>
        <PlanChip label="Plans" value={`${projectionCount}`} />
        <PlanChip label="Review" value={`${reviewCount}`} />
        <PlanChip label="Source" value={sourceLabel} />
      </View>
      <Text style={styles.body}>Movement is shown before anything changes.</Text>
    </View>
  );
}

function PlanChip({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View accessible accessibilityLabel={`${label}. ${value}.`} style={styles.planChip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
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
    gap: spacing.md,
    padding: spacing.lg,
  },
  planChip: {
    backgroundColor: '#FFFFFF99',
    borderRadius: radius,
    flex: 1,
    gap: 2,
    minWidth: 88,
    padding: spacing.md,
  },
  planRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipLabel: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  chipValue: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  title: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
});
