import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gap, pressed, serif, useTheme } from '@/folio/theme';
import type { PersistedWorkspace } from '@/folio/lib/workspaceRoot';

export type WorkspaceControlProps = Readonly<{
  workspace: PersistedWorkspace;
  expanded: boolean;
  onPress: () => void;
}>;

/** Quiet workspace context above primary navigation; Melo remains a full primary tab. */
export function WorkspaceControl({ workspace, expanded, onPress }: WorkspaceControlProps) {
  const t = useTheme();
  const kindLabel = workspace.kind === 'personal' ? 'Personal workspace' : 'Business workspace';
  const visibleLabel =
    workspace.name.toLocaleLowerCase('en-GB') === workspace.kind
      ? workspace.kind === 'personal'
        ? 'Personal'
        : 'Business'
      : workspace.name;

  return (
    <View style={[styles.rail, { backgroundColor: t.canvas }]}>
      <Pressable
        accessibilityHint="Opens workspace switching and business workspace controls."
        accessibilityLabel={`${kindLabel}: ${workspace.name}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={({ pressed: isPressed }) => [styles.control, isPressed ? pressed : undefined]}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.dot, { backgroundColor: workspace.kind === 'business' ? t.calm : t.ink }]}
        />
        <Text numberOfLines={1} style={[styles.name, { color: t.ink }]}>
          {visibleLabel}
        </Text>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.action, { color: t.calmStrong }]}
        >
          {expanded ? '↑' : '↓'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    alignItems: 'center',
    minHeight: 34,
    paddingHorizontal: gap.xl,
    paddingVertical: 2,
  },
  control: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: gap.sm,
    paddingVertical: 4,
  },
  dot: { borderRadius: 3, height: 5, marginRight: gap.sm, width: 5 },
  name: {
    fontFamily: serif.displayItalic,
    fontSize: 12.5,
    lineHeight: 16,
    maxWidth: 180,
  },
  action: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: gap.sm,
  },
});
