// errorReporting tests — DSN resolution mirrors the clerkAuth two-tier pattern (env first,
// Constants.expoConfig.extra fallback), so both tiers are mocked the same way. Node env, no DOM.
// @sentry/react-native is mocked because its import touches native modules.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initSpy = vi.fn();
vi.mock('@sentry/react-native', () => ({ init: (...args: unknown[]) => initSpy(...args) }));

const mockExtra: Record<string, unknown> = {};
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: mockExtra } } }));

const ENV_KEY = 'EXPO_PUBLIC_SENTRY_DSN';

describe('errorReporting', () => {
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
    delete mockExtra[ENV_KEY];
    initSpy.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it('no DSN anywhere → init is a no-op and stays inactive', async () => {
    const m = await import('./errorReporting');
    m.initErrorReporting();
    expect(initSpy).not.toHaveBeenCalled();
    expect(m.isErrorReportingActive()).toBe(false);
  });

  it('env DSN wins and initializes with privacy-safe options', async () => {
    process.env[ENV_KEY] = 'https://k@o1.ingest.sentry.io/1';
    const m = await import('./errorReporting');
    m.initErrorReporting();
    expect(initSpy).toHaveBeenCalledTimes(1);
    const opts = initSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(opts['dsn']).toBe('https://k@o1.ingest.sentry.io/1');
    expect(opts['sendDefaultPii']).toBe(false);
    expect(opts['tracesSampleRate']).toBe(0);
    expect(opts['attachScreenshot']).toBe(false);
  });

  it('falls back to extra, and repeat init is idempotent', async () => {
    mockExtra[ENV_KEY] = 'https://k@o2.ingest.sentry.io/2';
    const m = await import('./errorReporting');
    m.initErrorReporting();
    m.initErrorReporting();
    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(m.isErrorReportingActive()).toBe(true);
  });
});
