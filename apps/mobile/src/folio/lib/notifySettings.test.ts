import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: null,
  EncodingType: { UTF8: 'utf8' },
}));

import { DEFAULT_REMINDERS_SETTINGS, parseRemindersSettings } from './notifySettings';

describe('parseRemindersSettings', () => {
  it('is quiet and privacy-safe by default', () => {
    expect(parseRemindersSettings('{}')).toEqual(DEFAULT_REMINDERS_SETTINGS);
    expect(DEFAULT_REMINDERS_SETTINGS.remindersEnabled).toBe(false);
    expect(DEFAULT_REMINDERS_SETTINGS.sensitivePreviews).toBe(false);
    expect(DEFAULT_REMINDERS_SETTINGS.classEnabled.ritual).toBe(false);
    expect(DEFAULT_REMINDERS_SETTINGS.classEnabled.marketing).toBe(false);
  });

  it('migrates the old one-boolean file without enabling new sensitive behavior', () => {
    const parsed = parseRemindersSettings('{"remindersEnabled":true}');
    expect(parsed.remindersEnabled).toBe(true);
    expect(parsed.sensitivePreviews).toBe(false);
    expect(parsed.version).toBe(2);
  });

  it('keeps marketing fail-closed and repairs malformed fields', () => {
    const parsed = parseRemindersSettings(
      JSON.stringify({
        remindersEnabled: true,
        sensitivePreviews: true,
        quietHours: { startHour: 99, endHour: 7 },
        classEnabled: { meaningful_change: false, marketing: 'yes' },
      }),
    );
    expect(parsed.quietHours).toEqual({ startHour: 21, endHour: 7 });
    expect(parsed.classEnabled.meaningful_change).toBe(false);
    expect(parsed.classEnabled.marketing).toBe(false);
  });
});
