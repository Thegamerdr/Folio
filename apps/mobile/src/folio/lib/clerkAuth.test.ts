// clerkAuth tests — key resolution is env-first then Constants.expoConfig.extra (the meloAiClient
// two-tier pattern), so both tiers are mocked here with a mutable extra bag. Runs plain vitest in
// the default Node environment, matching the vaultKey.test.ts convention. Nothing here touches
// document/window, so no environment override is declared.
//
// Mocks @clerk/clerk-expo/token-cache because that module reaches into expo-secure-store at
// import time, which is not Node-safe — exactly the reason persist.ts itself isn't imported in
// its own test file (see persist.test.ts's header comment).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/clerk-expo/token-cache', () => ({ tokenCache: undefined }));

const mockExtra: Record<string, unknown> = {};
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: mockExtra } } }));

const ENV_KEY = 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY';

describe('isClerkConfigured', () => {
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
    delete mockExtra[ENV_KEY];
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it('is false when no publishable key is set', async () => {
    const { isClerkConfigured, getClerkPublishableKey } = await import('./clerkAuth');
    expect(isClerkConfigured()).toBe(false);
    expect(getClerkPublishableKey()).toBeUndefined();
  });

  it('is false when the publishable key is an empty string', async () => {
    process.env[ENV_KEY] = '';
    const { isClerkConfigured } = await import('./clerkAuth');
    expect(isClerkConfigured()).toBe(false);
  });

  it('is true once a non-empty publishable key is set', async () => {
    process.env[ENV_KEY] = 'pk_test_abc123';
    const { isClerkConfigured, getClerkPublishableKey } = await import('./clerkAuth');
    expect(isClerkConfigured()).toBe(true);
    expect(getClerkPublishableKey()).toBe('pk_test_abc123');
  });

  it('falls back to Constants.expoConfig.extra when env is absent', async () => {
    mockExtra[ENV_KEY] = 'pk_test_from_extra';
    const { isClerkConfigured, getClerkPublishableKey } = await import('./clerkAuth');
    expect(isClerkConfigured()).toBe(true);
    expect(getClerkPublishableKey()).toBe('pk_test_from_extra');
  });

  it('prefers env over extra when both are set', async () => {
    process.env[ENV_KEY] = 'pk_test_env_wins';
    mockExtra[ENV_KEY] = 'pk_test_from_extra';
    const { getClerkPublishableKey } = await import('./clerkAuth');
    expect(getClerkPublishableKey()).toBe('pk_test_env_wins');
  });
});
