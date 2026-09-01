import { afterEach, describe, expect, it } from 'vitest';

import buildAppConfig, { clerkFrontendApiHostForBuild, openBankingUrlForBuild } from './app.config';

const FLAG = 'EXPO_PUBLIC_MELO_OPEN_BANKING_ENABLED';
const URL = 'EXPO_PUBLIC_MELO_OPEN_BANKING_URL';
const originalFlag = process.env[FLAG];
const originalUrl = process.env[URL];
const CLERK_HOST = 'EXPO_PUBLIC_CLERK_FRONTEND_API_HOST';
const originalClerkHost = process.env[CLERK_HOST];

afterEach(() => {
  if (originalFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlag;
  if (originalUrl === undefined) delete process.env[URL];
  else process.env[URL] = originalUrl;
  if (originalClerkHost === undefined) delete process.env[CLERK_HOST];
  else process.env[CLERK_HOST] = originalClerkHost;
});

describe('Clerk passkey build configuration', () => {
  it('binds passkeys to the configured Clerk Frontend API host on both platforms', () => {
    process.env[CLERK_HOST] = 'accounts.example.test';
    const generated = buildAppConfig({ config: { name: 'Base', slug: 'base' } });

    expect(clerkFrontendApiHostForBuild()).toBe('accounts.example.test');
    expect(generated.ios?.associatedDomains).toEqual([
      'applinks:accounts.example.test',
      'webcredentials:accounts.example.test',
    ]);
    expect(generated.android?.intentFilters).toEqual([
      expect.objectContaining({
        autoVerify: true,
        data: [{ scheme: 'https', host: 'accounts.example.test' }],
      }),
    ]);
  });

  it('rejects a scheme, path, port, or credentials in the Clerk host input', () => {
    for (const value of [
      'https://accounts.example.test',
      'accounts.example.test/path',
      'accounts.example.test:8443',
      'user@accounts.example.test',
    ]) {
      process.env[CLERK_HOST] = value;
      expect(() => clerkFrontendApiHostForBuild()).toThrow(/hostname/u);
    }
  });
});

describe('Open Banking build configuration', () => {
  it('omits the endpoint from builds where the explicit flag is off', () => {
    delete process.env[FLAG];
    process.env[URL] = 'https://banking.example.test';
    expect(openBankingUrlForBuild()).toBeUndefined();
  });

  it('normalizes a valid HTTPS endpoint for an enabled build', () => {
    process.env[FLAG] = 'true';
    process.env[URL] = 'https://banking.example.test///';
    expect(openBankingUrlForBuild()).toBe('https://banking.example.test');
  });

  it('fails an enabled build with a missing or unsafe endpoint', () => {
    process.env[FLAG] = 'true';
    for (const value of [
      undefined,
      'http://banking.example.test',
      'https://user:password@banking.example.test',
      'https://banking.example.test?secret=value',
    ]) {
      if (value === undefined) delete process.env[URL];
      else process.env[URL] = value;
      expect(() => openBankingUrlForBuild()).toThrow(/Open Banking|HTTPS/u);
    }
  });
});

describe('native voice build configuration', () => {
  it('allows record-audio only for explicit voice input and configures both platform prompts', () => {
    const generated = buildAppConfig({ config: { name: 'Base', slug: 'base' } });
    expect(generated.android?.blockedPermissions).not.toContain('android.permission.RECORD_AUDIO');

    const plugin = generated.plugins?.find(
      (entry) => Array.isArray(entry) && entry[0] === 'expo-speech-recognition',
    );
    expect(plugin).toEqual([
      'expo-speech-recognition',
      expect.objectContaining({
        microphonePermission: expect.stringMatching(/only after you tap.*not saved/iu),
        speechRecognitionPermission: expect.stringMatching(/review.*edit.*proposal/iu),
      }),
    ]);
  });
});
