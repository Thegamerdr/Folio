import { describe, expect, it } from 'vitest';

import {
  buildMeloVoiceRecognitionOptions,
  describeMeloVoiceError,
  hasInstalledMeloVoiceLocale,
  resolveMeloVoiceRecognitionRoute,
} from './meloVoiceRecognition';

describe('Melo native voice recognition contract', () => {
  it('prefers a capability-checked on-device route', () => {
    expect(resolveMeloVoiceRecognitionRoute(true, true)).toBe('on-device');
    expect(resolveMeloVoiceRecognitionRoute(true, false)).toBe('phone-service');
    expect(resolveMeloVoiceRecognitionRoute(false, true)).toBe('unavailable');
  });

  it('requires an installed matching locale before Android takes the on-device route', () => {
    expect(hasInstalledMeloVoiceLocale(['en-US', 'fr-FR'])).toBe(true);
    expect(hasInstalledMeloVoiceLocale(['de-DE', 'fr-FR'])).toBe(false);
    expect(hasInstalledMeloVoiceLocale([])).toBe(false);
  });

  it('uses a finite session and never asks the native module to retain raw audio', () => {
    const options = buildMeloVoiceRecognitionOptions('on-device');
    expect(options).toMatchObject({
      continuous: false,
      interimResults: true,
      maxAlternatives: 1,
      requiresOnDeviceRecognition: true,
    });
    expect(options).not.toHaveProperty('recordingOptions');
    expect(options).not.toHaveProperty('audioSource');
  });

  it('marks the phone-service fallback as not on-device', () => {
    expect(buildMeloVoiceRecognitionOptions('phone-service').requiresOnDeviceRecognition).toBe(
      false,
    );
  });

  it('always preserves typing as the recovery path', () => {
    expect(describeMeloVoiceError('not-allowed')).toContain('type instead');
    expect(describeMeloVoiceError('network')).toContain('type instead');
    expect(describeMeloVoiceError('aborted')).toBe('');
  });
});
