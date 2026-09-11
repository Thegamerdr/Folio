import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MeloContextAction, MeloPosition } from '@/folio/lib/melo/companion';
import { useTheme } from '@/folio/theme';

/** The parent reserves the bubble's measured height in its semantic lane. It
 * never overlays the following money card, navigation or another control.
 */
export function MeloPerchBubble({
  action,
  onExpand,
  onClose,
  onOptions,
  onMove,
  position,
  anchorX,
}: {
  action?: MeloContextAction;
  onExpand: () => void;
  onClose: () => void;
  onOptions: () => void;
  onMove: (side: MeloPosition) => void;
  position: MeloPosition;
  anchorX: number;
}) {
  const t = useTheme();
  const [moving, setMoving] = useState(false);
  return (
    <View style={[styles.bubble, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <View
        pointerEvents="none"
        style={[
          styles.tail,
          { left: anchorX - 6, backgroundColor: t.surface, borderColor: t.hairline },
        ]}
      />
      <View style={styles.heading}>
        <Text style={[styles.title, { color: t.ink }]}>
          {action?.label ?? 'A little help with your numbers'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Melo bubble"
          onPress={onClose}
          style={styles.close}
        >
          <Text style={{ color: t.muted, fontSize: 24 }}>×</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onExpand} style={styles.action}>
          <Text style={[styles.actionLabel, { color: t.calm }]}>Open Melo →</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: moving }}
          onPress={() => setMoving(!moving)}
          style={styles.action}
        >
          <Text style={[styles.actionLabel, { color: t.muted }]}>Move companion</Text>
        </Pressable>
      </View>
      {moving ? (
        <View style={styles.positions}>
          {(
            [
              ['left', 'Left edge'],
              ['right', 'Right edge'],
              ['auto', 'Back to its place'],
            ] as const
          ).map(([side, label]) => (
            <Pressable
              key={side}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected: side === position }}
              onPress={() => onMove(side)}
              style={[
                styles.position,
                {
                  borderColor: t.hairline,
                  backgroundColor: side === position ? t.calmSoft : t.surface,
                },
              ]}
            >
              <Text style={{ color: t.ink, fontSize: 13 }}>{label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onOptions} style={styles.action}>
            <Text style={[styles.actionLabel, { color: t.muted }]}>More Melo options</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  tail: {
    position: 'absolute',
    top: -7,
    width: 12,
    height: 12,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '600' },
  close: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  action: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  actionLabel: { fontSize: 13, fontWeight: '600' },
  positions: { gap: 8, paddingTop: 8 },
  position: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
    padding: 12,
    justifyContent: 'center',
  },
});
