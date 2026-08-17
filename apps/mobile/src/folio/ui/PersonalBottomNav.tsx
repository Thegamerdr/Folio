import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PersonalPrimaryTab } from '@/folio/lib/navigation/personalNavigation';
import { pressed, useTheme } from '@/folio/theme';
import { ProductIcon, type ProductIconName } from './ProductIcon';

type PersonalBottomNavProps = Readonly<{
  active: PersonalPrimaryTab;
  onChange: (tab: PersonalPrimaryTab) => void;
}>;

const BASE_HEIGHT = 68;
const SAFE_GAP = 6;

const TABS: readonly Readonly<{
  id: PersonalPrimaryTab;
  label: string;
  icon: ProductIconName;
}>[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'plan', label: 'Plan', icon: 'plan' },
  { id: 'review', label: 'Review', icon: 'review' },
  { id: 'more', label: 'More', icon: 'more' },
];

/** Personal workspace chrome. Melo remains the contextual companion, not a navigation tab. */
export function PersonalBottomNav({ active, onChange }: PersonalBottomNavProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottom = (insets.bottom > 0 ? insets.bottom : 12) + SAFE_GAP;

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.nav,
        {
          backgroundColor: t.surface,
          borderTopColor: t.hairline,
          minHeight: BASE_HEIGHT + safeBottom,
          paddingBottom: safeBottom,
        },
      ]}
    >
      {TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            accessibilityHint={`Switches to ${tab.label}.`}
            accessibilityLabel={`${tab.label} tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({ pressed: isPressed }) => [styles.tab, isPressed ? pressed : undefined]}
          >
            <ProductIcon color={selected ? t.calm : t.muted} name={tab.icon} />
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                {
                  color: selected ? t.ink : t.muted,
                  fontWeight: selected ? '600' : '400',
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.2,
    lineHeight: 13,
    textAlign: 'center',
    width: '100%',
  },
});
