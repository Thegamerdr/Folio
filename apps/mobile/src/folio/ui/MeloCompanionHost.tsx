/**
 * Native companion host.
 *
 * This owns semantic layout and accessibility only. The canonical `Melo`
 * sprite/atlas component remains the sole renderer; the host never paints a
 * substitute avatar or absolute overlay. A caller supplies the real action
 * and route context so Melo stays useful without becoming a floating CTA.
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Melo, type MeloMood, type MeloPose } from '@/folio/melo/Melo';
import { gap } from '@/folio/theme';
import type { MeloPosition, MeloPresence } from '@/folio/lib/melo/companion';

export type MeloCompanionHostProps = {
  mood: MeloMood;
  pose?: MeloPose;
  size?: number;
  position?: MeloPosition;
  presence?: MeloPresence;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function MeloCompanionHost({
  mood,
  pose = 'none',
  size = 76,
  position = 'auto',
  presence = 'perched',
  onPress,
  accessibilityLabel,
  style,
}: MeloCompanionHostProps) {
  const alignSelf =
    position === 'left' ? 'flex-start' : position === 'right' ? 'flex-end' : 'center';
  const label = accessibilityLabel ?? `Melo, ${presence}`;
  // Keep one touch target. Melo's own `onTap` wrapper is intentionally not
  // used here because the host owns the semantic action and accessibility
  // label for this placement.
  const content = <Melo mood={mood} pose={pose} size={size} grounded />;

  return (
    <View
      accessibilityLabel={`${label}. Presence: ${presence}.`}
      accessibilityRole="image"
      style={[styles.host, { alignSelf }, style]}
    >
      {onPress ? (
        <Pressable
          accessibilityLabel={label}
          accessibilityHint="Opens Melo's contextual options"
          accessibilityRole="button"
          onPress={onPress}
          hitSlop={8}
          style={({ pressed }) => [pressed ? styles.pressed : undefined]}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 76,
    paddingHorizontal: gap.xs,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
