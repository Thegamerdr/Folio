import { useEffect, useSyncExternalStore } from 'react';
import { BackHandler, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/surfaces/pressureMap/Sheet';
import { gap, radius, serif, useTheme } from '@/folio/theme';
import { dismissMeloAlert, getMeloAlert, pressMeloAlert, subscribeMeloAlert } from './meloAlert';

export function MeloAlertHost() {
  const current = useSyncExternalStore(subscribeMeloAlert, getMeloAlert, getMeloAlert);
  const t = useTheme();
  useEffect(() => {
    if (!current) return;
    Keyboard.dismiss();
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissMeloAlert(current.id);
      return true;
    });
    return () => listener.remove();
  }, [current]);
  if (!current) return null;
  const primary = current.buttons.findIndex((button) => button.style !== 'cancel');
  return (
    <Sheet
      key={current.id}
      visible
      dismissible={current.options?.cancelable !== false}
      onClose={() => dismissMeloAlert(current.id)}
      footer={
        <View style={styles.actions}>
          {current.buttons.map((button, index) => (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={button.text ?? 'Done'}
              onPress={() => pressMeloAlert(current.id, index)}
              style={[
                styles.button,
                {
                  backgroundColor: index === primary ? t.calm : t.surface,
                  borderColor: t.hairline,
                },
              ]}
            >
              <Text style={[styles.buttonLabel, { color: index === primary ? t.inverse : t.ink }]}>
                {button.text ?? 'Done'}
              </Text>
            </Pressable>
          ))}
        </View>
      }
    >
      <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
        {current.title}
      </Text>
      {current.message ? (
        <Text style={[styles.message, { color: t.muted }]}>{current.message}</Text>
      ) : null}
    </Sheet>
  );
}
const styles = StyleSheet.create({
  title: { fontFamily: serif.display, fontSize: 28, lineHeight: 35 },
  message: { fontSize: 14, lineHeight: 21, marginTop: gap.md, marginBottom: gap.lg },
  actions: { gap: gap.sm },
  button: {
    minHeight: 48,
    padding: gap.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
});
