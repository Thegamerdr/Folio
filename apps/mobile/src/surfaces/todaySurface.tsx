import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

type TodayCalmAnswerSurfaceProps = Readonly<{
  availableLabel: string;
  caption: string;
  children: ReactNode;
  evidenceText: string | undefined;
  headline: string;
  onOpenSources: () => void;
  onOpenWhatIf: () => void;
  reviewState: string;
}>;

export function TodayCalmAnswerSurface({
  availableLabel,
  caption,
  children,
  evidenceText,
  headline,
  onOpenSources,
  onOpenWhatIf,
  reviewState,
}: TodayCalmAnswerSurfaceProps) {
  return (
    <View style={styles.stack}>
      <View
        accessible
        accessibilityLabel={`${headline}. ${availableLabel} ${caption}. ${reviewState}. ${
          evidenceText ?? ''
        }`}
        style={styles.answerPanel}
      >
        <Text accessibilityRole="header" style={styles.title}>
          {headline}
        </Text>
        <Text style={styles.money}>{availableLabel}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.caption}>{caption}</Text>
          <Text style={styles.stateText}>{reviewState}</Text>
        </View>
        {evidenceText === undefined ? null : <Text style={styles.evidence}>{evidenceText}</Text>}
        {children}
      </View>

      <View
        accessible
        accessibilityLabel={`Daily briefing. Position ${availableLabel}. Review state ${reviewState}. Sources are inspectable.`}
        style={styles.briefingPanel}
      >
        <AnswerLine label="Position" value={availableLabel} />
        <AnswerLine label="Review" value={reviewState} />
        <AnswerLine label="Source" value={evidenceText ?? 'Available on tap'} />
      </View>

      <View style={styles.actionRow}>
        <SurfaceButton
          primary
          accessibilityHint="Opens a sheet to test a purchase without saving it."
          label="Test a purchase"
          onPress={onOpenWhatIf}
        />
        <SurfaceButton
          accessibilityHint="Opens the sources used for this answer."
          label="See sources"
          onPress={onOpenSources}
        />
      </View>
    </View>
  );
}

function AnswerLine({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View accessible accessibilityLabel={`${label}. ${value}.`} style={styles.answerLine}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
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
  answerPanel: {
    gap: spacing.md,
  },
  answerLine: {
    alignItems: 'center',
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 42,
    paddingVertical: spacing.xs,
  },
  briefingPanel: {
    backgroundColor: '#FFFFFF99',
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
  caption: {
    color: colors.text.secondary,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  evidence: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  lineLabel: {
    color: colors.text.muted,
    flex: 0.72,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  lineValue: {
    color: colors.text.primary,
    flex: 1.4,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'right',
  },
  money: {
    color: colors.text.primary,
    fontSize: 56,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    lineHeight: 60,
  },
  pressed: {
    opacity: 0.74,
  },
  stack: {
    gap: spacing.md,
  },
  stateText: {
    color: colors.accent.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
  title: {
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 36,
  },
});
