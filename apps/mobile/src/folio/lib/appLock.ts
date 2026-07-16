// Native Melo app-lock boundary. The local vault is encrypted separately; this module adds the
// optional foreground privacy gate the More/Privacy UI promises. Settings live in SecureStore and
// authentication is always delegated to the device PIN/pattern/password/biometric prompt.

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const APP_LOCK_SETTINGS_KEY = 'melo.appLock.settings.v1';

export type AppLockSettings = Readonly<{ enabled: boolean }>;

export type AppLockCapability = Readonly<{
  available: boolean;
  secureStoreAvailable: boolean;
  securityLevel: LocalAuthentication.SecurityLevel;
  reason: 'available' | 'web' | 'secure-store-unavailable' | 'device-lock-not-set' | 'unavailable';
}>;

export type AppLockAuthenticationResult = Readonly<{
  success: boolean;
  reason: 'authenticated' | 'cancelled' | 'device-lock-not-set' | 'unavailable' | 'failed';
}>;

export type AppLockChangeResult = Readonly<{
  changed: boolean;
  settings: AppLockSettings;
  reason: 'enabled' | 'disabled' | 'cancelled' | 'device-lock-not-set' | 'unavailable' | 'failed';
}>;

export type PreparedAppLock = Readonly<{
  settings: AppLockSettings;
  capability: AppLockCapability;
  recoveredAfterDeviceLockRemoval: boolean;
}>;

const DEFAULT_SETTINGS: AppLockSettings = Object.freeze({ enabled: false });
let cachedSettings: AppLockSettings = DEFAULT_SETTINGS;
const listeners = new Set<(settings: AppLockSettings) => void>();

function parseSettings(raw: string | null): AppLockSettings {
  if (raw === null) return DEFAULT_SETTINGS;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('enabled' in value)) {
      return DEFAULT_SETTINGS;
    }
    return { enabled: (value as { enabled?: unknown }).enabled === true };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function publish(settings: AppLockSettings): void {
  cachedSettings = settings;
  for (const listener of listeners) listener(settings);
}

async function persist(settings: AppLockSettings): Promise<boolean> {
  try {
    if (!(await SecureStore.isAvailableAsync())) return false;
    await SecureStore.setItemAsync(APP_LOCK_SETTINGS_KEY, JSON.stringify(settings), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    publish(settings);
    return true;
  } catch {
    return false;
  }
}

export async function loadAppLockSettings(): Promise<AppLockSettings> {
  try {
    if (Platform.OS === 'web' || !(await SecureStore.isAvailableAsync())) {
      publish(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const settings = parseSettings(await SecureStore.getItemAsync(APP_LOCK_SETTINGS_KEY));
    publish(settings);
    return settings;
  } catch {
    publish(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
}

export function getCachedAppLockSettings(): AppLockSettings {
  return cachedSettings;
}

export function subscribeAppLockSettings(
  listener: (settings: AppLockSettings) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function inspectAppLockCapability(): Promise<AppLockCapability> {
  if (Platform.OS === 'web') {
    return {
      available: false,
      secureStoreAvailable: false,
      securityLevel: LocalAuthentication.SecurityLevel.NONE,
      reason: 'web',
    };
  }

  let secureStoreAvailable = false;
  try {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  } catch {
    // The result below remains an honest unavailable state.
  }
  if (!secureStoreAvailable) {
    return {
      available: false,
      secureStoreAvailable: false,
      securityLevel: LocalAuthentication.SecurityLevel.NONE,
      reason: 'secure-store-unavailable',
    };
  }

  try {
    const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
    const available = securityLevel !== LocalAuthentication.SecurityLevel.NONE;
    return {
      available,
      secureStoreAvailable: true,
      securityLevel,
      reason: available ? 'available' : 'device-lock-not-set',
    };
  } catch {
    return {
      available: false,
      secureStoreAvailable: true,
      securityLevel: LocalAuthentication.SecurityLevel.NONE,
      reason: 'unavailable',
    };
  }
}

export async function authenticateAppLock(
  promptMessage = 'Unlock Melo',
): Promise<AppLockAuthenticationResult> {
  const capability = await inspectAppLockCapability();
  if (!capability.available) {
    return {
      success: false,
      reason: capability.reason === 'device-lock-not-set' ? 'device-lock-not-set' : 'unavailable',
    };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      promptSubtitle: 'Use your device screen lock',
      promptDescription: 'Melo never receives your PIN, pattern, password or biometric data.',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      requireConfirmation: true,
    });
    if (result.success) return { success: true, reason: 'authenticated' };
    if (
      result.error === 'user_cancel' ||
      result.error === 'app_cancel' ||
      result.error === 'system_cancel'
    ) {
      return { success: false, reason: 'cancelled' };
    }
    if (result.error === 'not_enrolled' || result.error === 'passcode_not_set') {
      return { success: false, reason: 'device-lock-not-set' };
    }
    if (result.error === 'not_available') return { success: false, reason: 'unavailable' };
    return { success: false, reason: 'failed' };
  } catch {
    return { success: false, reason: 'failed' };
  }
}

export async function changeAppLockEnabled(enabled: boolean): Promise<AppLockChangeResult> {
  const current = await loadAppLockSettings();
  if (current.enabled === enabled) {
    return {
      changed: false,
      settings: current,
      reason: enabled ? 'enabled' : 'disabled',
    };
  }

  const capability = await inspectAppLockCapability();
  // A removed device credential must never strand the user behind a gate they can no longer pass.
  // Disabling remains possible from an already-open session; enabling always requires a live gate.
  if (!capability.available && !enabled) {
    const settings = { enabled: false };
    return (await persist(settings))
      ? { changed: true, settings, reason: 'disabled' }
      : { changed: false, settings: current, reason: 'unavailable' };
  }
  if (!capability.available) {
    return {
      changed: false,
      settings: current,
      reason: capability.reason === 'device-lock-not-set' ? 'device-lock-not-set' : 'unavailable',
    };
  }

  const authentication = await authenticateAppLock(
    enabled ? 'Turn on Melo app lock' : 'Turn off Melo app lock',
  );
  if (!authentication.success) {
    return {
      changed: false,
      settings: current,
      reason: authentication.reason === 'authenticated' ? 'failed' : authentication.reason,
    };
  }

  const settings = { enabled };
  if (!(await persist(settings))) {
    return { changed: false, settings: current, reason: 'unavailable' };
  }
  return { changed: true, settings, reason: enabled ? 'enabled' : 'disabled' };
}

/**
 * Load the persisted lock before first paint. If the user removed every device credential since
 * enabling it, disable only this optional UI gate so Melo remains recoverable; vault encryption is
 * unaffected and the caller can explain the recovery once the app opens.
 */
export async function prepareAppLock(): Promise<PreparedAppLock> {
  const settings = await loadAppLockSettings();
  const capability = await inspectAppLockCapability();
  if (!settings.enabled || capability.available) {
    return { settings, capability, recoveredAfterDeviceLockRemoval: false };
  }

  const disabled = { enabled: false };
  const persisted = await persist(disabled);
  return {
    settings: persisted ? disabled : settings,
    capability,
    recoveredAfterDeviceLockRemoval: persisted,
  };
}
