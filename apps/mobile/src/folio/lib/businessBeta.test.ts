import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockExtra: Record<string, unknown> = {};
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: mockExtra } } }));

const ENV_KEY = 'EXPO_PUBLIC_MELO_BUSINESS_BETA';

describe('business beta exposure flag', () => {
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

  it('only accepts the trimmed, exact lowercase value true', async () => {
    const { parseBusinessBetaFlag } = await import('./businessBeta');

    expect(parseBusinessBetaFlag('true')).toBe(true);
    expect(parseBusinessBetaFlag('  true\n')).toBe(true);
    for (const value of ['True', 'TRUE', 'yes', '1', '', 'false', true, 1, null, undefined]) {
      expect(parseBusinessBetaFlag(value)).toBe(false);
    }
  });

  it('prefers an explicitly supplied env value over Expo extra', async () => {
    const { resolveBusinessBetaFlag } = await import('./businessBeta');

    expect(resolveBusinessBetaFlag('true', 'false')).toBe(true);
    expect(resolveBusinessBetaFlag('false', 'true')).toBe(false);
    expect(resolveBusinessBetaFlag('', 'true')).toBe(false);
    expect(resolveBusinessBetaFlag('TRUE', 'true')).toBe(false);
  });

  it('falls back to Expo extra only when env is absent', async () => {
    const { resolveBusinessBetaFlag } = await import('./businessBeta');

    expect(resolveBusinessBetaFlag(undefined, 'true')).toBe(true);
    expect(resolveBusinessBetaFlag(undefined, 'TRUE')).toBe(false);
    expect(resolveBusinessBetaFlag(undefined, undefined)).toBe(false);
  });

  it('resolves the build-distributed value at call time', async () => {
    const { isBusinessWorkspaceCreationEnabled } = await import('./businessBeta');

    expect(isBusinessWorkspaceCreationEnabled()).toBe(false);
    mockExtra[ENV_KEY] = 'true';
    expect(isBusinessWorkspaceCreationEnabled()).toBe(true);
    process.env[ENV_KEY] = 'false';
    expect(isBusinessWorkspaceCreationEnabled()).toBe(false);
  });
});
