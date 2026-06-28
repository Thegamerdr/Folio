import { Pressable, StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

import { buildCompactMeloNote } from '../local/localMeloPolicyAdapter';
import { CompactMeloNoteSurface } from './compactMeloNoteSurface';

type TimelineMeaningSurfaceProps = Readonly<{
  briefing: string;
  expectationCount: number;
  factCount: number;
  onOpenCalendar: () => void;
  onOpenSources: () => void;
  reviewCount: number;
}>;

export function TimelineMeaningSurface({
  briefing,
  expectationCount,
  factCount,
  onOpenCalendar,
  onOpenSources,
  reviewCount,
}: TimelineMeaningSurfaceProps) {
  const meloNote = buildCompactMeloNote({
    control:
      reviewCount > 0 ? 'Open sources before anything changes.' : 'Open sources or calendar.',
    matters: 'What happened, what is coming and what needs checking stay separated.',
    noticed: reviewCount > 0 ? `${reviewCount} to check on your timeline.` : briefing,
  });

  return (
    <View style={styles.stack}>
      <View
        accessible
        accessibilityLabel={`${factCount} confirmed facts, ${expectationCount} expected items and ${reviewCount} review items. ${briefing}`}
        style={styles.panel}
      >
        <Text style={styles.kicker}>Timeline</Text>
        <Text style={styles.title}>What changed, what is next.</Text>
        <Text style={styles.body}>
          {factCount} known, {expectationCount} coming up, {reviewCount} to review.
        </Text>
      </View>

      <CompactMeloNoteSurface note={meloNote} />

      <View style={styles.legendGrid}>
        <LegendPill label="Now" value="Current position" />
        <LegendPill label="Needs review" value="Waiting on you" />
        <LegendPill label="Coming up" value="Future money" />
      </View>

      <View style={styles.actionRow}>
        <SurfaceButton
          primary
          accessibilityHint="Opens the money-aware calendar."
          label="Open calendar"
          onPress={onOpenCalendar}
        />
        <SurfaceButton
          accessibilityHint="Opens the sources behind your timeline."
          label="See sources"
          onPress={onOpenSources}
        />
      </View>
    </View>
  );
}

function LegendPill({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View accessible accessibilityLabel={`${label}. ${value}.`} style={styles.legendPill}>
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

function SurfaceButton({
  accessibilityHint,
  label,
  onPress,
  primary,
}: Readonly<{
  accessibilityHint: string;
  label: string;
  onPress: () => void;
  primary?: boolean;
}>) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <Text style={[styles.buttonText, primary ? styles.buttonTextPrimary : undefined]}>
        {label}
      </Text>
    </Pressable>
  );
}

const colors = folioTokens.color.role;
const spacing = folioTokens.spacing.scale;
const radius = folioTokens.size.radius;
const hitTarget = folioTokens.hitTarget.minimumDp;

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  body: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: radius,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: hitTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonPrimary: {
    backgroundColor: colors.surface.inverse,
    borderColor: colors.surface.inverse,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  buttonTextPrimary: {
    color: colors.text.inverse,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendLabel: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  legendPill: {
    backgroundColor: '#FFFFFF99',
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 96,
    padding: spacing.md,
  },
  legendValue: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  panel: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.74,
  },
  stack: {
    gap: spacing.md,
  },
  title: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  kicker: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
});
