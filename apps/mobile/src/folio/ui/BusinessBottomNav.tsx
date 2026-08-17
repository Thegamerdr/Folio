import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BusinessPrimaryTab } from '@/folio/lib/navigation/businessNavigation';
import { pressed, useTheme } from '@/folio/theme';
import { ProductIcon, type ProductIconName } from './ProductIcon';

type BusinessBottomNavProps = Readonly<{
  active: BusinessPrimaryTab;
  onChange: (tab: BusinessPrimaryTab) => void;
}>;

const BASE_HEIGHT = 68;
const SAFE_GAP = 6;

const TABS: readonly Readonly<{
  id: BusinessPrimaryTab;
  label: string;
  icon: ProductIconName;
}>[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'money', label: 'Money', icon: 'money' },
  { id: 'review', label: 'Review', icon: 'review' },
  { id: 'more', label: 'More', icon: 'more' },
];

/** Business workspace chrome. Melo remains the companion, not a navigation tab. */
export function BusinessBottomNav({ active, onChange }: BusinessBottomNavProps) {
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
            accessibilityHint={`Switches to Business ${tab.label}.`}
            accessibilityLabel={`${tab.label} tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({ pressed: isPressed }) => [styles.tab, isPressed ? pressed : undefined]}
          >
            <ProductIcon color={selected ? t.calmStrong : t.muted} name={tab.icon} />
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
    minWidth: 0,
    minHeight: 48,
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
