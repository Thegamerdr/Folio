import { beforeEach, describe, expect, it, vi } from 'vitest';

const filesystem = vi.hoisted(() => ({
  directory: 'file:///notification-test/' as string | null,
  write: vi.fn<(...args: unknown[]) => Promise<void>>(),
}));

vi.mock('expo-file-system/legacy', () => ({
  get documentDirectory() {
    return filesystem.directory;
  },
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: filesystem.write,
}));

import {
  DEFAULT_REMINDERS_SETTINGS,
  parseRemindersSettings,
  saveRemindersSettings,
} from './notifySettings';

beforeEach(() => {
  filesystem.directory = 'file:///notification-test/';
  filesystem.write.mockReset().mockResolvedValue(undefined);
});

describe('saveRemindersSettings', () => {
  it('reports success only after the native preference write completes', async () => {
    expect(await saveRemindersSettings(DEFAULT_REMINDERS_SETTINGS)).toBe(true);
    expect(filesystem.write).toHaveBeenCalledWith(
      'file:///notification-test/reminders.settings.v1.json',
      JSON.stringify(DEFAULT_REMINDERS_SETTINGS),
      { encoding: 'utf8' },
    );
  });

  it('reports failed storage so the switch cannot claim an unsaved setting', async () => {
    filesystem.write.mockRejectedValueOnce(new Error('disk full'));
    expect(await saveRemindersSettings(DEFAULT_REMINDERS_SETTINGS)).toBe(false);
  });

  it('reports unavailable storage without trying a write', async () => {
    filesystem.directory = null;
    expect(await saveRemindersSettings(DEFAULT_REMINDERS_SETTINGS)).toBe(false);
    expect(filesystem.write).not.toHaveBeenCalled();
  });
});

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
