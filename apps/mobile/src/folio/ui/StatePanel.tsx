import { StyleSheet, Text, View } from 'react-native';

import {
  GhostButton,
  gap,
  PressureScreen,
  PrimaryAction,
  radius,
  serif,
  typeScale,
  useTheme,
} from '@/folio/theme';
import { ProductIcon } from './ProductIcon';
import { stateVisual, type ProductStateKind } from './statePanelContract';

export type { ProductStateKind } from './statePanelContract';

type StateAction = Readonly<{ label: string; onPress: () => void }>;

export type StatePanelProps = Readonly<{
  kind: ProductStateKind;
  title: string;
  body?: string;
  primaryAction?: StateAction;
  secondaryAction?: StateAction;
  fullScreen?: boolean;
}>;

/** Shared honest state composition for hubs, details and sheets. */
export function StatePanel({
  kind,
  title,
  body,
  primaryAction,
  secondaryAction,
  fullScreen = false,
}: StatePanelProps) {
  const t = useTheme();
  const visual = stateVisual(kind);
  const foreground =
    visual.tone === 'repair'
      ? t.repairInk
      : visual.tone === 'warm'
        ? t.warmInk
        : visual.tone === 'positive'
          ? t.positiveInk
          : t.muted;
  const background =
    visual.tone === 'repair'
      ? t.repairSoft
      : visual.tone === 'warm'
        ? t.warmSoft
        : visual.tone === 'positive'
          ? t.positiveSoft
          : t.inset;

  const panel = (
    <View
      accessibilityLiveRegion={kind === 'error' || kind === 'conflict' ? 'assertive' : 'polite'}
      accessibilityRole={kind === 'error' || kind === 'conflict' ? 'alert' : 'summary'}
      style={[styles.panel, { backgroundColor: t.surface, borderColor: t.hairline }]}
    >
      <View style={[styles.iconWell, { backgroundColor: background }]}>
        <ProductIcon color={foreground} name={visual.icon} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
        {title}
      </Text>
      {body ? <Text style={[styles.body, { color: t.muted }]}>{body}</Text> : null}
      {kind === 'loading' ? (
        <View accessibilityLabel="Loading" style={styles.skeleton}>
          <View style={[styles.skeletonLong, { backgroundColor: t.inset }]} />
          <View style={[styles.skeletonShort, { backgroundColor: t.inset }]} />
        </View>
      ) : null}
      {primaryAction || secondaryAction ? (
        <View style={styles.actions}>
          {primaryAction ? (
            <PrimaryAction label={primaryAction.label} onPress={primaryAction.onPress} />
          ) : null}
          {secondaryAction ? (
            <GhostButton label={secondaryAction.label} onPress={secondaryAction.onPress} />
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return fullScreen ? <PressureScreen centered>{panel}</PressureScreen> : panel;
}

const styles = StyleSheet.create({
  panel: {
    alignSelf: 'stretch',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: gap.xl,
  },
  iconWell: {
    alignItems: 'center',
    borderRadius: radius.row,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  title: {
    fontFamily: serif.display,
    fontSize: typeScale.title,
    lineHeight: 26,
    marginTop: gap.md,
  },
  body: { fontSize: typeScale.bodySmall, lineHeight: 20, marginTop: gap.sm },
  skeleton: { gap: gap.sm, marginTop: gap.lg },
  skeletonLong: { borderRadius: radius.row, height: 14, width: '92%' },
  skeletonShort: { borderRadius: radius.row, height: 14, width: '64%' },
  actions: { gap: gap.sm, marginTop: gap.lg },
});
