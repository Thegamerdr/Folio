import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Melo, type MeloMood, type MeloPose } from '@/folio/melo/Melo';
import { elevation, pressed, useTheme } from '@/folio/theme';

type PersonalBottomNavProps = Readonly<{
  todayActive: boolean;
  moreActive: boolean;
  meloMood: MeloMood;
  meloPose?: MeloPose;
  onToday: () => void;
  onMelo: () => void;
  onMore: () => void;
}>;

const BASE_HEIGHT = 68;
const SAFE_GAP = 6;

/** Frozen Personal chrome: Today + an elevated Melo chat entry + More.
 *  Review and the standalone Melo settings surface live inside More. */
export function PersonalBottomNav({
  todayActive,
  moreActive,
  meloMood,
  meloPose = 'none',
  onToday,
  onMelo,
  onMore,
}: PersonalBottomNavProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottom = (insets.bottom > 0 ? insets.bottom : 12) + SAFE_GAP;

  return (
    <View
      collapsable={false}
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
      <NavButton
        active={todayActive}
        accessibilityLabel="Today tab"
        glyph="◐"
        label="Today"
        onPress={onToday}
      />

      <Pressable
        accessibilityHint="Opens the Melo companion."
        accessibilityLabel="Talk to Melo"
        accessibilityRole="button"
        onPress={onMelo}
        style={({ pressed: isPressed }) => [styles.meloButton, isPressed ? pressed : undefined]}
      >
        <View
          style={[
            styles.meloOrb,
            {
              backgroundColor: t.canvas,
              borderColor: t.hairline,
            },
            elevation.card,
          ]}
        >
          <Melo size={28} mood={meloMood} pose={meloPose} />
        </View>
        <Text style={[styles.meloLabel, { color: t.ink }]}>Talk to Melo</Text>
      </Pressable>

      <NavButton
        active={moreActive}
        accessibilityLabel="More tab"
        glyph="⋯"
        label="More"
        onPress={onMore}
      />
    </View>
  );
}

function NavButton({
  active,
  accessibilityLabel,
  glyph,
  label,
  onPress,
}: Readonly<{
  active: boolean;
  accessibilityLabel: string;
  glyph: string;
  label: string;
  onPress: () => void;
}>) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityHint={`Switches to ${label}.`}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed: isPressed }) => [styles.tab, isPressed ? pressed : undefined]}
    >
      <Text style={[styles.glyph, { color: active ? t.calm : t.muted }]}>{glyph}</Text>
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: active ? t.ink : t.muted,
            fontWeight: active ? '600' : '400',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  glyph: {
    fontSize: 14,
    lineHeight: 17,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.2,
    lineHeight: 13,
    textAlign: 'center',
    width: '100%',
  },
  meloButton: {
    alignItems: 'center',
    flex: 1.25,
    marginTop: -20,
    minHeight: 64,
    paddingHorizontal: 4,
  },
  meloOrb: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  meloLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 13,
    marginTop: 2,
  },
});
