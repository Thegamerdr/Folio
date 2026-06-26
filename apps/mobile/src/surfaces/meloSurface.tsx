import { StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

export function MeloBoundarySurface() {
  return (
    <View
      accessible
      accessibilityLabel="Melo explains local records, asks bounded questions, shows sources and waits for your review before anything changes."
      style={styles.panel}
    >
      <Text style={styles.kicker}>Interpreter, not authority</Text>
      <Text style={styles.title}>Melo explains. You decide.</Text>
      <Text style={styles.body}>Sources stay visible. Changes still need your tap.</Text>
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
