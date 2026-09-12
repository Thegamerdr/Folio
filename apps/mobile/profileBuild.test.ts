import { afterEach, describe, expect, it, vi } from 'vitest';
import buildAppConfig from './app.config';

afterEach(() => vi.unstubAllEnvs());

describe('production and QA profile separation', () => {
  it('keeps the normal app identity and new release version without a fixture flag', () => {
    vi.stubEnv('EXPO_PUBLIC_MELO_PARITY_CAPTURE', '');
    const config = buildAppConfig({ config: { name: 'Base', slug: 'base' } });
    expect(config.android?.package).toBe('com.folio.v2.greenfield');
    expect(config.ios?.bundleIdentifier).toBe('com.folio.v2.greenfield');
    expect(config.scheme).toBe('folio');
    expect(config.version).toBe('0.0.6');
    expect(config.android?.versionCode).toBe(6);
  });
  it('puts explicit fixture builds in another OS canonical storage and update namespace', () => {
    vi.stubEnv('EXPO_PUBLIC_MELO_PARITY_CAPTURE', 'true');
    const config = buildAppConfig({ config: { name: 'Base', slug: 'base' } });
    expect(config.android?.package).toBe('com.folio.v2.greenfield.capture');
    expect(config.ios?.bundleIdentifier).toBe('com.folio.v2.greenfield.capture');
    expect(config.scheme).toBe('folio-qa');
    expect(config.updates?.enabled).toBe(false);
  });
  it('puts release validation in a distinct package and disables OTA without fixture mode', () => {
    vi.stubEnv('EXPO_PUBLIC_MELO_PARITY_CAPTURE', '');
    vi.stubEnv('MELO_RELEASE_VALIDATION', 'true');
    const config = buildAppConfig({ config: { name: 'Base', slug: 'base' } });
    expect(config.android?.package).toBe('com.folio.v2.greenfield.validation');
    expect(config.ios?.bundleIdentifier).toBe('com.folio.v2.greenfield.validation');
    expect(config.scheme).toBe('folio-validation');
    expect(config.name).toBe('Melo Validation');
    expect(config.updates?.enabled).toBe(false);
  });
  it('rejects fixture and release validation flags together', () => {
    vi.stubEnv('EXPO_PUBLIC_MELO_PARITY_CAPTURE', 'true');
    vi.stubEnv('MELO_RELEASE_VALIDATION', 'true');
    expect(() => buildAppConfig({ config: { name: 'Base', slug: 'base' } })).toThrow(
      'MELO_RELEASE_VALIDATION cannot be combined',
    );
  });
});
