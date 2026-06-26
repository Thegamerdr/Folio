import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const databaseKeyName = 'folio.localLedger.sqlcipherKey.v1';
const secureStoreService = 'folio.localLedger.v1';

export type LocalDatabaseKeyState =
  | 'secure_store_reused'
  | 'secure_store_generated'
  | 'secure_store_unavailable_fallback';

export type LocalSecurityPosture = Readonly<{
  platform: string;
  secureStoreAvailable: boolean;
  databaseKeyState: LocalDatabaseKeyState;
  biometricHardwareAvailable: boolean;
  biometricEnrolled: boolean;
  enrolledSecurityLevel: string;
  appLockMode: 'device_auth' | 'tester_unlocked_no_biometric' | 'secure_store_only';
  independentSecurityReviewReady: false;
  note: string;
}>;

export type LocalUnlockResult = Readonly<{
  unlocked: boolean;
  method: 'device_auth' | 'tester_no_biometric' | 'secure_store_probe' | 'failed';
  message: string;
  posture: LocalSecurityPosture;
}>;

let lastDatabaseKeyState: LocalDatabaseKeyState = 'secure_store_unavailable_fallback';

export function getLastLocalDatabaseKeyState(): LocalDatabaseKeyState {
  return lastDatabaseKeyState;
}

export async function resolveLocalLedgerEncryptionKey(): Promise<string> {
  if (Platform.OS === 'web') {
    lastDatabaseKeyState = 'secure_store_unavailable_fallback';
    return 'folio-v2-web-disabled-local-ledger-key';
  }

  const available = await safeSecureStoreAvailable();
  if (!available) {
    lastDatabaseKeyState = 'secure_store_unavailable_fallback';
    return sessionOnlyLedgerKey();
  }

  const existing = await SecureStore.getItemAsync(databaseKeyName, secureStoreOptions());
  if (existing !== null && existing.length >= 64) {
    lastDatabaseKeyState = 'secure_store_reused';
    return existing;
  }

  const generated = bytesToHex(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(databaseKeyName, generated, secureStoreOptions());
  lastDatabaseKeyState = 'secure_store_generated';
  return generated;
}

export async function inspectLocalSecurityPosture(): Promise<LocalSecurityPosture> {
  const secureStoreAvailable = await safeSecureStoreAvailable();
  const [biometricHardwareAvailable, biometricEnrolled, enrolledSecurityLevel] = await Promise.all([
    safeBoolean(() => LocalAuthentication.hasHardwareAsync()),
    safeBoolean(() => LocalAuthentication.isEnrolledAsync()),
    safeSecurityLevel(),
  ]);
  const appLockMode =
    biometricHardwareAvailable && biometricEnrolled
      ? 'device_auth'
      : secureStoreAvailable
        ? 'secure_store_only'
        : 'tester_unlocked_no_biometric';

  const note =
    appLockMode === 'device_auth'
      ? 'Device authentication is available for the app-lock gate.'
      : appLockMode === 'secure_store_only'
        ? 'The local ledger key is stored on this device. Device app lock is not available here.'
        : 'Device key storage and device authentication are unavailable, so local records stay in memory on this device.';

  return {
    platform: Platform.OS,
    secureStoreAvailable,
    databaseKeyState: lastDatabaseKeyState,
    biometricHardwareAvailable,
    biometricEnrolled,
    enrolledSecurityLevel,
    appLockMode,
    independentSecurityReviewReady: false,
    note,
  };
}

export async function unlockLocalAppGate(): Promise<LocalUnlockResult> {
  const posture = await inspectLocalSecurityPosture();

  if (posture.biometricHardwareAvailable && posture.biometricEnrolled) {
    const result = await LocalAuthentication.authenticateAsync({
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      fallbackLabel: 'Use device passcode',
      promptMessage: 'Unlock Folio',
    });

    return {
      unlocked: result.success,
      method: result.success ? 'device_auth' : 'failed',
      message: result.success
        ? 'Folio unlocked with device authentication.'
        : 'Folio stayed locked.',
      posture,
    };
  }

  if (posture.secureStoreAvailable) {
    await resolveLocalLedgerEncryptionKey();
    return {
      unlocked: true,
      method: 'secure_store_probe',
      message: 'Folio unlocked with the device-protected local key.',
      posture: await inspectLocalSecurityPosture(),
    };
  }

  return {
    unlocked: true,
    method: 'tester_no_biometric',
    message: 'Folio unlocked without device authentication. Local records stay in memory only.',
    posture,
  };
}

let sessionLedgerKey: string | null = null;

function sessionOnlyLedgerKey(): string {
  sessionLedgerKey ??= `folio-v2-memory-only-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return sessionLedgerKey;
}

function secureStoreOptions(): SecureStore.SecureStoreOptions {
  return {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    keychainService: secureStoreService,
  };
}

async function safeSecureStoreAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function safeSecurityLevel(): Promise<string> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return String(level);
  } catch {
    return 'unknown';
  }
}

async function safeBoolean(action: () => Promise<boolean>): Promise<boolean> {
  try {
    return await action();
  } catch {
    return false;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
