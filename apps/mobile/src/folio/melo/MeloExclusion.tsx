import { createContext, forwardRef, useContext, useId, useLayoutEffect, useRef } from 'react';
import {
  Pressable,
  Text,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from 'react-native';
import { useMeloPresenceLayer, type PresenceMeasurable } from './MeloPresenceLayer';

const InsideText = createContext(false);

function useExclusion<T extends PresenceMeasurable>(enabled = true) {
  const presence = useMeloPresenceLayer();
  const id = useId();
  const node = useRef<T | null>(null);
  const publish = () => {
    if (enabled && node.current) presence?.exclude(id, node.current);
  };
  useLayoutEffect(() => {
    publish();
    return () => presence?.removeExclusion(id);
  }, [presence, id, enabled]);
  return { node, publish };
}

/** Register actual native geometry without adding a layout box or changing type,
 * spacing, accessibility, or press behaviour. Nested spans share the outer text box. */
export const MeloProtectedText = forwardRef<Text, TextProps>((props, forwarded) => {
  const nested = useContext(InsideText);
  const { node, publish } = useExclusion<Text>(!nested);
  return (
    <Text
      {...props}
      ref={(value) => {
        node.current = value;
        if (typeof forwarded === 'function') forwarded(value);
        else if (forwarded) forwarded.current = value;
      }}
      onLayout={(event) => {
        props.onLayout?.(event);
        publish();
      }}
    >
      <InsideText.Provider value>{props.children}</InsideText.Provider>
    </Text>
  );
});

export const MeloProtectedPressable = forwardRef<View, PressableProps>((props, forwarded) => {
  const { node, publish } = useExclusion<View>();
  return (
    <Pressable
      {...props}
      ref={(value) => {
        node.current = value;
        if (typeof forwarded === 'function') forwarded(value);
        else if (forwarded) forwarded.current = value;
      }}
      onLayout={(event) => {
        props.onLayout?.(event);
        publish();
      }}
    />
  );
});

/** Use on an existing box when a child draws values with SVG or owns its controls. */
export function MeloExclusionView(props: ViewProps) {
  const { node, publish } = useExclusion<View>();
  return (
    <View
      {...props}
      ref={node}
      collapsable={false}
      onLayout={(event) => {
        props.onLayout?.(event);
        publish();
      }}
    />
  );
}
