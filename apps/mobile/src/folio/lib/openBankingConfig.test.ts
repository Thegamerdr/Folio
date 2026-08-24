import { afterEach, describe, expect, it, vi } from 'vitest';

const extra: Record<string, unknown> = {};
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra } } }));

const FLAG = 'EXPO_PUBLIC_MELO_OPEN_BANKING_ENABLED';
const URL = 'EXPO_PUBLIC_MELO_OPEN_BANKING_URL';

describe('Open Banking release gate', () => {
  const originalFlag = process.env[FLAG];
  const originalUrl = process.env[URL];

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[FLAG];
    else process.env[FLAG] = originalFlag;
    if (originalUrl === undefined) delete process.env[URL];
    else process.env[URL] = originalUrl;
    delete extra[FLAG];
    delete extra[URL];
    vi.resetModules();
  });

  it('fails closed when no explicit release flag is present', async () => {
    delete process.env[FLAG];
    process.env[URL] = 'https://bank.example.test';
    const { getOpenBankingUrl, isOpenBankingEnabled } = await import('./openBankingConfig');
    expect(isOpenBankingEnabled()).toBe(false);
    expect(getOpenBankingUrl()).toBeUndefined();
  });

  it('requires both the explicit flag and endpoint', async () => {
    process.env[FLAG] = 'true';
    delete process.env[URL];
    const first = await import('./openBankingConfig');
    expect(first.isOpenBankingEnabled()).toBe(false);

    process.env[URL] = 'https://bank.example.test///';
    vi.resetModules();
    const second = await import('./openBankingConfig');
    expect(second.isOpenBankingEnabled()).toBe(true);
    expect(second.getOpenBankingUrl()).toBe('https://bank.example.test');
  });

  it('allows a build-time extra value only when the flag is explicit', async () => {
    extra[FLAG] = 'true';
    extra[URL] = 'https://bank.extra.test/';
    const { getOpenBankingUrl } = await import('./openBankingConfig');
    expect(getOpenBankingUrl()).toBe('https://bank.extra.test');
  });
});
