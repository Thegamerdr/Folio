import { Pressable, StyleSheet, Text, View } from 'react-native';

import { folioTokens } from '@folio/ui';

import { buildCompactMeloNote } from '../local/localMeloPolicyAdapter';
import { FolioBrandMark } from './brandMark';
import { CompactMeloNoteSurface } from './compactMeloNoteSurface';

type FirstMinuteAction = Readonly<{
  detail: string;
  hint?: string;
  id: string;
  label: string;
}>;

type FirstMinuteWelcomeSurfaceProps = Readonly<{
  actions: readonly FirstMinuteAction[];
  body: string;
  meloSummary: string;
  onOpenSampleBriefing: () => void;
  onStartImportDiscovery: () => void;
  onStartQuickEstimate: () => void;
  title: string;
}>;

export function FirstMinuteWelcomeSurface({
  actions,
  body,
  meloSummary,
  onOpenSampleBriefing,
  onStartImportDiscovery,
  onStartQuickEstimate,
  title,
}: FirstMinuteWelcomeSurfaceProps) {
  const pressAction = (id: string) => {
    if (id === 'import_statement') return onStartImportDiscovery;
    if (id === 'add_what_i_know') return onStartQuickEstimate;
    return onOpenSampleBriefing;
  };
  const displayTitle = compactFirstMinuteTitle(title);
  const displayBody = compactFirstMinuteBody(body);
  const displayMelo = buildCompactMeloNote({
    control: 'Import, add three facts, or open the sample.',
    matters: 'Your first picture comes from what you check and add.',
    noticed: meloSummary.includes('No account, cloud or AI is required')
      ? 'No account, cloud or AI is required to start.'
      : meloSummary,
  });

  return (
    <View style={styles.canvas}>
      <View style={styles.topRow}>
        <View style={styles.brandLockup}>
          <FolioBrandMark size={34} />
          <Text style={styles.kicker}>Folio</Text>
        </View>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.meloMark}
        >
          M
        </Text>
      </View>

      <Text accessibilityRole="header" style={styles.title}>
        {displayTitle}
      </Text>
      <Text style={styles.body}>{displayBody}</Text>

      <CompactMeloNoteSurface note={displayMelo} />

      <View
        accessible
        accessibilityLabel="Folio works locally. Nothing is added until review. Cloud and AI are optional."
        style={styles.promisePanel}
      >
        <PromiseChip label="Local first" value="Works on this device" />
        <PromiseChip label="Review first" value="You confirm meaning" />
        <PromiseChip label="No gate" value="No account needed" />
      </View>

      <View style={styles.actionStack}>
        {actions.map((action, index) => (
          <SurfaceAction
            detail={action.detail}
            hint={action.hint}
            key={action.id}
            primary={index === 0}
            title={action.label}
            onPress={pressAction(action.id)}
          />
        ))}
      </View>
    </View>
  );
}

function compactFirstMinuteTitle(title: string): string {
  return title.includes('where you stand') ? 'Know where you stand.' : title;
}

function compactFirstMinuteBody(body: string): string {
  return body.includes('local-first') ? 'Start local. Review first. No account needed.' : body;
}

function PromiseChip({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View style={styles.promiseChip}>
      <Text style={styles.promiseLabel}>{label}</Text>
      <Text style={styles.promiseValue}>{value}</Text>
    </View>
  );
}

function SurfaceAction({
  detail,
  hint,
  onPress,
  primary,
  title,
}: Readonly<{
  detail: string;
  hint: string | undefined;
  onPress: () => void;
  primary: boolean;
  title: string;
}>) {
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, primary ? styles.actionTitlePrimary : undefined]}>
          {title}
        </Text>
        <Text style={[styles.actionDetail, primary ? styles.actionDetailPrimary : undefined]}>
          {detail}
        </Text>
      </View>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.actionArrow, primary ? styles.actionArrowPrimary : undefined]}
      >
        {'>'}
      </Text>
    </Pressable>
  );
}

const colors = folioTokens.color.role;
const spacing = folioTokens.spacing.scale;
const radius = folioTokens.size.radius;

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    backgroundColor: '#FFFFFFD9',
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 74,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  actionArrow: {
    color: colors.text.muted,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  actionArrowPrimary: {
    color: colors.text.inverse,
  },
  actionDetail: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  actionDetailPrimary: {
    color: '#E4EEE8',
  },
  actionPrimary: {
    backgroundColor: colors.surface.inverse,
    borderColor: colors.surface.inverse,
  },
  actionStack: {
    gap: spacing.sm,
  },
  actionText: {
    flex: 1,
    gap: 3,
  },
  actionTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  actionTitlePrimary: {
    color: colors.text.inverse,
  },
  body: {
    color: colors.text.secondary,
    fontSize: 16,
    lineHeight: 23,
  },
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  canvas: {
    gap: spacing.xl,
    minHeight: 680,
    paddingTop: spacing.sm,
  },
  kicker: {
    color: colors.text.muted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  meloLabel: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  meloMark: {
    backgroundColor: colors.surface.inverse,
    borderRadius: 18,
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '900',
    height: 36,
    lineHeight: 36,
    overflow: 'hidden',
    textAlign: 'center',
    width: 36,
  },
  meloPanel: {
    backgroundColor: colors.accent.primarySoft,
    borderColor: '#FFFFFF00',
    borderRadius: radius,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  meloText: {
    color: colors.text.primary,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.74,
  },
  promiseChip: {
    backgroundColor: '#FFFFFF80',
    borderRadius: 999,
    flex: 1,
    gap: 2,
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  promiseLabel: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  promisePanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  promiseValue: {
    color: colors.text.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  title: {
    color: colors.text.primary,
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 42,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
