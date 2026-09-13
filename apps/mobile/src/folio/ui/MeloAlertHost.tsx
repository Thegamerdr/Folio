import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Sheet } from '@/surfaces/pressureMap/Sheet';
import { gap, radius, serif, useTheme } from '@/folio/theme';
import { dismissMeloAlert, getMeloAlert, pressMeloAlert, subscribeMeloAlert } from './meloAlert';

export type AlertTextLayout = { x: number; y: number; width: number; height: number };

export type AlertTextFrames = {
  title: AlertTextLayout | null;
  message: AlertTextLayout | null;
};

export type AlertTextMeasurementState = {
  key: string;
  frames: AlertTextFrames;
};

/**
 * Derive the smallest authored content floor that contains the measured alert text and its
 * existing trailing rhythm. The title/message y coordinates already include the top spacer.
 */
export function deriveAlertContentMinHeight(
  frames: AlertTextFrames,
  hasMessage: boolean,
  bodyContentInset: number,
  messageMarginBottom: number,
  scrollContentPaddingBottom: number,
): number | null {
  if (!frames.title || (hasMessage && !frames.message)) return null;
  const descendantEnd = Math.max(
    frames.title.y + frames.title.height,
    frames.message ? frames.message.y + frames.message.height : 0,
  );
  const trailingRhythm =
    (hasMessage ? messageMarginBottom : 0) + bodyContentInset + scrollContentPaddingBottom;
  return Math.max(0, Math.ceil(descendantEnd + trailingRhythm));
}

/** Apply one layout callback only when it belongs to the currently mounted measurement key. */
export function applyAlertTextLayout(
  state: AlertTextMeasurementState,
  activeKey: string,
  callbackKey: string,
  role: 'title' | 'message',
  frame: AlertTextLayout,
  hasMessage: boolean,
  bodyContentInset: number,
  messageMarginBottom: number,
  scrollContentPaddingBottom: number,
): number | null {
  if (activeKey !== callbackKey) return null;
  if (state.key !== activeKey) {
    state.key = activeKey;
    state.frames = { title: null, message: null };
  }
  state.frames[role] = frame;
  return deriveAlertContentMinHeight(
    state.frames,
    hasMessage,
    bodyContentInset,
    messageMarginBottom,
    scrollContentPaddingBottom,
  );
}

export function MeloAlertHost() {
  const current = useSyncExternalStore(subscribeMeloAlert, getMeloAlert, getMeloAlert);
  const t = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const captureMode = process.env.EXPO_PUBLIC_MELO_PARITY_CAPTURE === 'true';
  const geometryDiagnostics =
    captureMode || process.env.EXPO_PUBLIC_MELO_ALERT_GEOMETRY_DIAGNOSTIC === 'true';
  const measurementKey = current
    ? [current.id, current.title, current.message ?? '', width, fontScale].join('\u0000')
    : 'none';
  const activeMeasurementKeyRef = useRef(measurementKey);
  activeMeasurementKeyRef.current = measurementKey;
  const framesRef = useRef<AlertTextMeasurementState>({
    key: '',
    frames: { title: null, message: null },
  });
  const [measuredContent, setMeasuredContent] = useState<{
    key: string;
    minHeight: number;
  } | null>(null);
  useEffect(() => {
    if (framesRef.current.key !== measurementKey) {
      framesRef.current = { key: measurementKey, frames: { title: null, message: null } };
    }
    setMeasuredContent((previous) => (previous?.key === measurementKey ? previous : null));
  }, [measurementKey]);
  const captureTextLayout = (
    role: 'title' | 'message',
    event: { nativeEvent: { layout: AlertTextLayout } },
  ) => {
    const frame = event.nativeEvent.layout;
    if (geometryDiagnostics) {
      console.info(
        'MeloSheetGeometry',
        JSON.stringify({ event: 'alert-text-layout', step: 'melo-alert', role, ...frame }),
      );
    }
    const minHeight = applyAlertTextLayout(
      framesRef.current,
      activeMeasurementKeyRef.current,
      measurementKey,
      role,
      frame,
      Boolean(current?.message),
      gap.lg,
      gap.lg,
      gap.sm,
    );
    if (minHeight == null) return;
    setMeasuredContent((previous) => {
      if (previous?.key === measurementKey && Math.abs(previous.minHeight - minHeight) < 0.5) {
        return previous;
      }
      return { key: measurementKey, minHeight };
    });
  };
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
      bodyContentInset={gap.lg}
      directScrollContent
      contentMinHeight={
        measuredContent?.key === measurementKey ? measuredContent.minHeight : undefined
      }
      {...(geometryDiagnostics ? { scrollKey: 'melo-alert' } : {})}
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
      <Text
        accessibilityRole="header"
        onLayout={(event) => captureTextLayout('title', event)}
        style={[styles.title, { color: t.ink }]}
      >
        {current.title}
      </Text>
      {current.message ? (
        <Text
          onLayout={(event) => captureTextLayout('message', event)}
          style={[styles.message, { color: t.muted }]}
        >
          {current.message}
        </Text>
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
