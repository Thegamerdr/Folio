import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { gap, radius, useTheme } from '@/folio/theme';

export type ReviewTimelineTabOption<Key extends string> = {
  key: Key;
  label: string;
  count?: number;
};

export function ReviewTimelineTabRail<Key extends string>({
  accessibilityLabel,
  value,
  options,
  onChange,
}: {
  accessibilityLabel: string;
  value: Key;
  options: readonly ReviewTimelineTabOption<Key>[];
  onChange: (value: Key) => void;
}) {
  const t = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef(new Map<Key, { x: number; width: number }>());
  const [layoutRevision, setLayoutRevision] = useState(0);

  useEffect(() => {
    const selected = layouts.current.get(value);
    if (selected === undefined) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, selected.x - gap.lg), animated: false });
  }, [layoutRevision, value]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="tablist"
        style={[styles.rail, { backgroundColor: t.inset }]}
      >
        {options.map((option) => {
          const selected = option.key === value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityLabel={
                option.count === undefined ? option.label : `${option.label}, ${option.count} items`
              }
              accessibilityState={{ selected }}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                layouts.current.set(option.key, { x, width });
                setLayoutRevision((revision) => revision + 1);
              }}
              onPress={() => onChange(option.key)}
              style={({ pressed }) => [
                styles.segment,
                selected
                  ? {
                      backgroundColor: t.surface,
                      borderColor: t.hairline,
                      borderWidth: StyleSheet.hairlineWidth,
                    }
                  : undefined,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={[styles.label, { color: selected ? t.ink : t.muted }]}>
                {option.label}
                {option.count !== undefined ? ` ${option.count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: gap.md,
    paddingHorizontal: gap.lg,
    paddingTop: gap.sm,
  },
  rail: {
    alignItems: 'stretch',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: gap.xs,
    minHeight: 48,
    paddingHorizontal: gap.xs,
    paddingVertical: 2,
  },
  segment: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: gap.lg,
  },
  label: { fontSize: 12.5, lineHeight: 19 },
  pressed: { opacity: 0.72 },
});
