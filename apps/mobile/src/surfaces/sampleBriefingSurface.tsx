import { Pressable, StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

type SurfaceTone = 'confirmed' | 'estimated' | 'attention';

type SampleCard = Readonly<{
  title: string;
  tone: SurfaceTone;
  value: string;
}>;

type SampleBriefingValueSurfaceProps = Readonly<{
  cards: readonly SampleCard[];
  labels: readonly string[];
  meloSummary: string;
  onAddWhatIKnow: () => void;
  onDismiss: () => void;
  onImportStatement: () => void;
}>;

export function SampleBriefingValueSurface({
  cards,
  labels,
  meloSummary,
  onAddWhatIKnow,
  onDismiss,
  onImportStatement,
}: SampleBriefingValueSurfaceProps) {
  return (
    <View style={styles.stack}>
      <Text style={styles.kicker}>Sample briefing</Text>
      <Text accessibilityRole="header" style={styles.title}>
        See the loop without using your data.
      </Text>
      <View style={styles.labelRow}>
        {labels.map((label) => (
          <View accessible accessibilityLabel={label} key={label} style={styles.sampleLabel}>
            <Text style={styles.sampleLabelText}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.body}>Play through the loop with labelled example data.</Text>

      <View accessible accessibilityLabel={`Melo note. ${meloSummary}`} style={styles.meloBox}>
        <Text style={styles.meloTitle}>Melo note</Text>
        <Text style={styles.meloText}>Nothing here can become your route or export.</Text>
      </View>

      <View style={styles.proofGrid}>
        {cards.map((card) => (
          <View
            accessible
            accessibilityLabel={`${card.title}. ${card.value}.`}
            key={card.title}
            style={[styles.proofCard, toneBorder(card.tone)]}
          >
            <Text style={styles.proofTitle}>{card.title}</Text>
            <Text style={styles.proofValue}>{card.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sourceNote}>
        <Text style={styles.sourceTitle}>Source</Text>
        <Text style={styles.sourceText}>Example evidence stays separate.</Text>
      </View>

      <View style={styles.actionRow}>
        <SurfaceButton
          primary
          accessibilityHint="Leaves the sample and opens statement import."
          label="Use a bank statement"
          onPress={onImportStatement}
        />
        <SurfaceButton
          accessibilityHint="Leaves the sample and opens the three-fact manual path."
          label="Add a few numbers"
          onPress={onAddWhatIKnow}
        />
      </View>
      <SurfaceButton
        accessibilityHint="Dismisses the sample without saving anything."
        label="Dismiss sample"
        onPress={onDismiss}
      />
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

function toneBorder(tone: SurfaceTone) {
  if (tone === 'attention') return styles.attentionBorder;
  if (tone === 'confirmed') return styles.confirmedBorder;
  return styles.estimatedBorder;
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
  attentionBorder: {
    borderColor: colors.accent.warm,
  },
  body: {
    color: colors.text.secondary,
    fontSize: 16,
    lineHeight: 23,
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
  confirmedBorder: {
    borderColor: colors.accent.primary,
  },
  estimatedBorder: {
    borderColor: colors.border.subtle,
  },
  kicker: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  meloBox: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  meloText: {
    color: colors.text.secondary,
    fontSize: 15,
    lineHeight: 22,
  },
  meloTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.74,
  },
  proofCard: {
    backgroundColor: '#FFFFFF99',
    borderRadius: radius,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 142,
    padding: spacing.md,
  },
  proofGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  proofTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  proofValue: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
  sampleLabel: {
    backgroundColor: '#FFFFFF99',
    borderColor: '#FFFFFF00',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sampleLabelText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  sourceNote: {
    backgroundColor: '#FFFFFF80',
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  sourceText: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sourceTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  stack: {
    gap: spacing.lg,
  },
  title: {
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 36,
  },
});
