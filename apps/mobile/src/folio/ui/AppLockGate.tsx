import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Melo } from '@/folio/melo/Melo';
import { gap, pressed, radius, serif, useTheme } from '@/folio/theme';

export function AppLockGate({
  busy,
  message,
  onUnlock,
}: {
  busy: boolean;
  message: string | null;
  onUnlock: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityViewIsModal
      style={[
        styles.root,
        {
          backgroundColor: t.canvas,
          paddingTop: insets.top + gap.xxl,
          paddingBottom: insets.bottom + gap.xxl,
        },
      ]}
    >
      <View style={styles.content}>
        <Melo mood="calm" size={72} />
        <Text style={[styles.eyebrow, { color: t.muted }]}>Private by choice</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
          Melo is locked.
        </Text>
        <Text style={[styles.body, { color: t.muted }]}>
          Use your device PIN, pattern, password or biometric to open your money.
        </Text>

        {message !== null ? (
          <Text accessibilityLiveRegion="polite" style={[styles.message, { color: t.repairInk }]}>
            {message}
          </Text>
        ) : null}

        <Pressable
          accessibilityHint="Opens your device authentication prompt"
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          onPress={onUnlock}
          style={({ pressed: isPressed }) => [
            styles.button,
            { backgroundColor: t.calmStrong, opacity: busy ? 0.6 : 1 },
            isPressed ? pressed : undefined,
          ]}
        >
          <Text style={[styles.buttonLabel, { color: t.inverse }]}>
            {busy ? 'Opening device lock…' : 'Unlock Melo'}
          </Text>
        </Pressable>

        <Text style={[styles.footnote, { color: t.muted }]}>
          Melo never receives your device credential or biometric data.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: gap.xl,
  },
  content: {
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.7,
    marginTop: gap.xl,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: serif.display,
    fontSize: 42,
    lineHeight: 46,
    marginTop: gap.sm,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: gap.md,
    maxWidth: 340,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: gap.lg,
    maxWidth: 340,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: gap.xxl,
    minHeight: 56,
    paddingHorizontal: gap.xxl,
    width: '100%',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: gap.lg,
    maxWidth: 320,
    textAlign: 'center',
  },
});
