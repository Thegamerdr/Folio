import { beforeEach, describe, expect, it, vi } from 'vitest';

const getItemAsync = vi.fn();
const setItemAsync = vi.fn().mockResolvedValue(undefined);
const isAvailableAsync = vi.fn().mockResolvedValue(true);
const getEnrolledLevelAsync = vi.fn().mockResolvedValue(1);
const authenticateAsync = vi.fn().mockResolvedValue({ success: true });

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-secure-store', () => ({
  getItemAsync,
  setItemAsync,
  isAvailableAsync,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-device-only',
}));
vi.mock('expo-local-authentication', () => ({
  getEnrolledLevelAsync,
  authenticateAsync,
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));

beforeEach(() => {
  vi.clearAllMocks();
  isAvailableAsync.mockResolvedValue(true);
  getEnrolledLevelAsync.mockResolvedValue(1);
  authenticateAsync.mockResolvedValue({ success: true });
  getItemAsync.mockResolvedValue(null);
});

describe('Melo app lock', () => {
  it('defaults off and treats malformed settings as off', async () => {
    const { loadAppLockSettings } = await import('./appLock');
    await expect(loadAppLockSettings()).resolves.toEqual({ enabled: false });
    getItemAsync.mockResolvedValueOnce('{not-json');
    await expect(loadAppLockSettings()).resolves.toEqual({ enabled: false });
  });

  it('accepts a device PIN/pattern/password even without biometric enrollment', async () => {
    getEnrolledLevelAsync.mockResolvedValueOnce(1);
    const { inspectAppLockCapability } = await import('./appLock');
    await expect(inspectAppLockCapability()).resolves.toEqual(
      expect.objectContaining({ available: true, securityLevel: 1, reason: 'available' }),
    );
  });

  it('authenticates before enabling and persists only after success', async () => {
    const { changeAppLockEnabled } = await import('./appLock');
    await expect(changeAppLockEnabled(true)).resolves.toEqual(
      expect.objectContaining({ changed: true, reason: 'enabled', settings: { enabled: true } }),
    );
    expect(authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: 'Turn on Melo app lock',
        disableDeviceFallback: false,
      }),
    );
    expect(setItemAsync).toHaveBeenCalledWith(
      'melo.appLock.settings.v1',
      JSON.stringify({ enabled: true }),
      expect.objectContaining({ keychainAccessible: 'when-unlocked-device-only' }),
    );
  });

  it('does not enable when the device prompt is cancelled', async () => {
    authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    const { changeAppLockEnabled } = await import('./appLock');
    await expect(changeAppLockEnabled(true)).resolves.toEqual(
      expect.objectContaining({ changed: false, reason: 'cancelled' }),
    );
    expect(setItemAsync).not.toHaveBeenCalled();
  });

  it('refuses to enable when no device screen lock is configured', async () => {
    getEnrolledLevelAsync.mockResolvedValue(0);
    const { changeAppLockEnabled } = await import('./appLock');
    await expect(changeAppLockEnabled(true)).resolves.toEqual(
      expect.objectContaining({ changed: false, reason: 'device-lock-not-set' }),
    );
    expect(authenticateAsync).not.toHaveBeenCalled();
  });

  it('recovers instead of stranding a user when the device credential was removed', async () => {
    getItemAsync.mockResolvedValue(JSON.stringify({ enabled: true }));
    getEnrolledLevelAsync.mockResolvedValue(0);
    const { prepareAppLock } = await import('./appLock');
    await expect(prepareAppLock()).resolves.toEqual(
      expect.objectContaining({
        settings: { enabled: false },
        recoveredAfterDeviceLockRemoval: true,
      }),
    );
    expect(setItemAsync).toHaveBeenCalledWith(
      'melo.appLock.settings.v1',
      JSON.stringify({ enabled: false }),
      expect.any(Object),
    );
  });
});
