import { afterEach, describe, expect, it } from 'vitest';

import { openBankingUrlForBuild } from './app.config';

const FLAG = 'EXPO_PUBLIC_MELO_OPEN_BANKING_ENABLED';
const URL = 'EXPO_PUBLIC_MELO_OPEN_BANKING_URL';
const originalFlag = process.env[FLAG];
const originalUrl = process.env[URL];

afterEach(() => {
  if (originalFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlag;
  if (originalUrl === undefined) delete process.env[URL];
  else process.env[URL] = originalUrl;
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
