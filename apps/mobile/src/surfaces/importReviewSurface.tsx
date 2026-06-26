import { StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

import { buildCompactMeloNote } from '../local/localMeloPolicyAdapter';
import { CompactMeloNoteSurface } from './compactMeloNoteSurface';

type ImportReviewAction = Readonly<{
  consequence: string;
  id: string;
  label: string;
}>;

type ImportReviewDecisionGuideProps = Readonly<{
  actions: readonly ImportReviewAction[];
  latestSource?: string;
  trustLines: readonly string[];
}>;

export function ImportReviewDecisionGuide({
  actions,
  latestSource,
  trustLines,
}: ImportReviewDecisionGuideProps) {
  const primaryActions = actions.filter((action) =>
    ['accept', 'edit', 'reject'].includes(action.id),
  );
  const meaningActions = actions.filter((action) =>
    ['income', 'bill', 'debt_payment', 'refund', 'later'].includes(action.id),
  );
  const meloNote = buildCompactMeloNote({
    control: 'Review the original wording, then add, edit or ignore.',
    matters: 'Rows stay here until you choose.',
    noticed:
      latestSource === undefined
        ? 'A statement is waiting for review.'
        : `${latestSource} is waiting for review.`,
  });

  return (
    <View style={styles.stack}>
      <CompactMeloNoteSurface note={meloNote} />
      <View
        accessible
        accessibilityLabel={`Import review guide. ${trustLines.join(' ')} ${actions
          .map((action) => `${action.label}: ${action.consequence}`)
          .join(' ')}`}
        style={styles.panel}
      >
        <Text style={styles.kicker}>Before anything changes</Text>
        <Text style={styles.title}>Check rows before adding them.</Text>
        {latestSource === undefined ? null : (
          <Text style={styles.sourceText}>Current file: {latestSource}</Text>
        )}
        <View style={styles.trustRail}>
          {trustLines.map((line) => (
            <Text key={line} style={styles.trustChip}>
              {line}
            </Text>
          ))}
        </View>
        <View style={styles.actionGrid}>
          {primaryActions.map((action) => (
            <View key={action.id} style={styles.actionCard}>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <Text style={styles.actionValue}>{action.consequence}</Text>
            </View>
          ))}
        </View>
        <View style={styles.meaningPanel}>
          <Text style={styles.kicker}>Label this row</Text>
          <View style={styles.meaningRail}>
            {meaningActions.map((action) => (
              <Text key={action.id} style={styles.meaningChip}>
                {action.label}
              </Text>
            ))}
          </View>
          <Text style={styles.footer}>
            These labels help you sort income, bills, refunds and debt payments before you add
            anything.
          </Text>
        </View>
        <Text style={styles.footer}>
          Add keeps a row in your money view. Edit keeps the original and stores your correction.
          Ignore keeps the original wording but does not affect money.
        </Text>
      </View>
    </View>
  );
}

const colors = folioTokens.color.role;
const spacing = folioTokens.spacing.scale;
const radius = folioTokens.size.radius;

const styles = StyleSheet.create({
  actionCard: {
    backgroundColor: '#FFFFFF99',
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 132,
    padding: spacing.md,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionLabel: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  actionValue: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 18,
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
  meaningChip: {
    backgroundColor: colors.surface.base,
    borderColor: colors.border.subtle,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  meaningPanel: {
    backgroundColor: '#FFFFFF80',
    borderRadius: radius,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  meaningRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sourceText: {
    color: colors.accent.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  stack: {
    gap: spacing.md,
  },
  title: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  trustChip: {
    backgroundColor: '#FFFFFF99',
    borderRadius: 999,
    color: colors.text.primary,
    flexGrow: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  trustRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
