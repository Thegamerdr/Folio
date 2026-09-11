import type { AlertButton, AlertOptions } from 'react-native';

export type MeloAlertRequest = {
  id: number;
  title: string;
  message?: string | undefined;
  buttons: AlertButton[];
  options?: AlertOptions | undefined;
};

let sequence = 0;
let pending: MeloAlertRequest[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export const subscribeMeloAlert = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getMeloAlert = () => pending[0] ?? null;

/** Product confirmations retain their existing callbacks and explicit commit boundary. */
export const MeloAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    pending = [
      ...pending,
      {
        id: ++sequence,
        title,
        message,
        buttons: buttons?.length ? buttons : [{ text: 'Done' }],
        options,
      },
    ];
    notify();
  },
};

export function pressMeloAlert(id: number, index: number): void {
  const current = getMeloAlert();
  const button = current?.buttons[index];
  if (!current || current.id !== id || !button) return;
  pending = pending.slice(1);
  notify();
  button.onPress?.();
}

export function dismissMeloAlert(id: number): void {
  const current = getMeloAlert();
  if (!current || current.id !== id || current.options?.cancelable === false) return;
  pending = pending.slice(1);
  notify();
  if (current.options?.onDismiss) current.options.onDismiss();
  else current.buttons.find((button) => button.style === 'cancel')?.onPress?.();
}
