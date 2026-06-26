import { StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

export function CalendarPlannerIntro({
  privateExampleMode,
}: Readonly<{
  privateExampleMode: boolean;
}>) {
  return (
    <View
      accessible
      accessibilityLabel="Calendar is a money-aware planner. It shows commitments, plan dates, reviews and money movement."
      style={styles.panel}
    >
      <Text style={styles.kicker}>Money-aware planner</Text>
      <Text style={styles.title}>
        {privateExampleMode
          ? 'The example week reacts to the money picture.'
          : 'Your week reacts to the money picture.'}
      </Text>
      <Text style={styles.body}>Important dates first. Details stay one tap away.</Text>
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
    gap: spacing.xs,
    padding: spacing.lg,
  },
  title: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
});
