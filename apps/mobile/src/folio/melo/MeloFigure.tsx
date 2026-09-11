import { useEffect, useId, useLayoutEffect, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useAppStore } from '@/folio/store';
import { Melo, type MeloMood } from './Melo';
import { useMeloScrollAnchor } from './MeloScrollView';
import { useMeloPresenceLayer } from './MeloPresenceLayer';

// Lovable's native companion specification, pass36. The immutable square master
// has 18% transparent vertical padding; size refers to visible artwork, not PNG canvas.
export const MELO_ROLES = {
  portrait: { visible: 32, box: 44 },
  small: { visible: 28, box: 44 },
  inline: { visible: 56, box: 72 },
  perch: { visible: 72, box: 88 },
  empty: { visible: 96, box: 112 },
  pressured: { visible: 112, box: 128 },
  home: { visible: 132, box: 156 },
} as const;

export function MeloFigure({
  role,
  mood = 'calm',
  onPress,
  label = 'Melo. Tap for options.',
  hideForKeyboard = true,
  scrollOwner = false,
  maxBoxSize,
}: {
  role: keyof typeof MELO_ROLES;
  mood?: MeloMood;
  onPress?: () => void;
  label?: string;
  hideForKeyboard?: boolean;
  scrollOwner?: boolean;
  maxBoxSize?: number;
}) {
  const anchor = useMeloScrollAnchor(scrollOwner);
  const presence = useMeloPresenceLayer();
  const identity = useId();
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
  const scale = maxBoxSize === undefined ? 1 : Math.min(1, maxBoxSize / dimensions.box);
  const style = {
    width: dimensions.box * scale,
    height: dimensions.box * scale,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const hidden = anchor.tucked || (hideForKeyboard && keyboardOpen);
  useLayoutEffect(() => {
    presence?.authored(identity, !quiet && !hidden);
    return () => presence?.authored(identity, false);
  }, [presence, identity, quiet, hidden]);
  if (quiet) return null;
  const content = hidden ? null : (
    <Melo mood={mood} size={Math.ceil((dimensions.visible * scale) / 0.82)} frozen />
  );
  return onPress ? (
    <Pressable
      ref={anchor.ref}
      onLayout={anchor.onLayout}
      collapsable={false}
      disabled={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <View importantForAccessibility="no-hide-descendants">{content}</View>
    </Pressable>
  ) : (
    <View ref={anchor.ref} onLayout={anchor.onLayout} collapsable={false} style={style}>
      {content}
    </View>
  );
}
