import { useEffect, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useAppStore } from '@/folio/store';
import { Melo, type MeloMood } from './Melo';

// Lovable's native companion specification, pass36. The immutable square master
// has 18% transparent vertical padding; size refers to visible artwork, not PNG canvas.
export const MELO_ROLES = {
  portrait: { visible: 32, box: 44 },
  inline: { visible: 56, box: 72 },
  perch: { visible: 72, box: 88 },
  empty: { visible: 96, box: 112 },
  pressured: { visible: 112, box: 128 },
  home: { visible: 132, box: 152 },
} as const;

export function MeloFigure({
  role,
  mood = 'calm',
  onPress,
  label = 'Melo. Tap for options.',
  hideForKeyboard = false,
}: {
  role: keyof typeof MELO_ROLES;
  mood?: MeloMood;
  onPress?: () => void;
  label?: string;
  hideForKeyboard?: boolean;
}) {
  const quiet = useAppStore((state) => state.melo?.quietMode === true);
  const [keyboardOpen, setKeyboardOpen] = useState(Keyboard.isVisible());
  useEffect(() => {
    if (!hideForKeyboard) return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [hideForKeyboard]);
  const dimensions = MELO_ROLES[role];
  const style = {
    width: dimensions.box,
    height: dimensions.box,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  if (quiet || (hideForKeyboard && keyboardOpen)) return null;
  const content = <Melo mood={mood} size={Math.ceil(dimensions.visible / 0.82)} />;
  return onPress ? (
    <Pressable
      style={style}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <View importantForAccessibility="no-hide-descendants">{content}</View>
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}
