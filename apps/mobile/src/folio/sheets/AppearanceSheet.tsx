// AppearanceSheet — native picker for the canonical pressure-map theme authority.
// @rn-sheet     AppearanceSheet
// @purpose      Persist the user's System / Light / Dark choice; System follows the OS.
// @reads        useThemeMode() from the single theme authority.
// @writes       useThemeMode().setMode() (SecureStore persistence stays in kitTheme).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  gap,
  pressed,
  radius,
  serif,
  Sheet,
  useTheme,
  useThemeMode,
  type Palette,
  type ThemeMode,
} from '@/folio/theme';

const MODES: readonly { mode: ThemeMode; label: string; detail: string }[] = [
  { mode: 'system', label: 'System', detail: 'Follow your phone setting' },
  { mode: 'light', label: 'Light', detail: 'Warm paper, always' },
  { mode: 'dark', label: 'Dark', detail: 'Deep warm paper, always' },
];

export type AppearanceSheetProps = { visible: boolean; onClose: () => void };

export function AppearanceSheet({ visible, onClose }: AppearanceSheetProps) {
  const t = useTheme();
  const s = makeStyles(t);
  const { mode, setMode } = useThemeMode();

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.body}>
        <Text accessibilityRole="header" style={s.headline}>
          Choose your <Text style={s.accent}>ground</Text>.
        </Text>
        <Text style={s.subline}>Melo keeps this choice on this device.</Text>
        <View style={s.list}>
          {MODES.map((option) => {
            const selected = option.mode === mode;
            return (
              <Pressable
                key={option.mode}
                accessibilityRole="radio"
                accessibilityLabel={`${option.label} — ${option.detail}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  setMode(option.mode);
                  onClose();
                }}
                style={({ pressed: isPressed }) => [
                  s.row,
                  selected ? s.rowSelected : s.rowIdle,
                  isPressed ? pressed : undefined,
                ]}
              >
                <View style={s.rowCopy}>
                  <Text style={s.label}>{option.label}</Text>
                  <Text style={s.detail}>{option.detail}</Text>
                </View>
                <View style={[s.radio, selected ? s.radioSelected : undefined]}>
                  {selected ? <View style={s.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Sheet>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    body: { paddingTop: gap.sm, paddingBottom: gap.lg },
    headline: { color: t.ink, fontFamily: serif.display, fontSize: 22, lineHeight: 27 },
    accent: { color: t.calm },
    subline: { color: t.muted, fontSize: 12, marginTop: 4 },
    list: { gap: gap.sm, marginTop: gap.lg },
    row: {
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 64,
      paddingHorizontal: gap.lg,
      paddingVertical: gap.md,
    },
    rowIdle: { backgroundColor: t.surface, borderColor: t.hairline },
    rowSelected: { backgroundColor: t.calmSoft, borderColor: t.calm },
    rowCopy: { flex: 1, paddingRight: gap.md },
    label: { color: t.ink, fontSize: 15, fontWeight: '600' },
    detail: { color: t.muted, fontSize: 12, marginTop: 3 },
    radio: {
      alignItems: 'center',
      borderColor: t.hairlineStrong,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 22,
      justifyContent: 'center',
      width: 22,
    },
    radioSelected: { borderColor: t.calm },
    radioDot: { backgroundColor: t.calm, borderRadius: radius.pill, height: 10, width: 10 },
  });
}
