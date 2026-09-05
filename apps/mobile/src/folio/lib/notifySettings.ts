// Persisted, local-only notification policy. This is deliberately separate from the financial
// store: it contains preferences only, never money data, merchant names, notification copy, or
// push tokens. The v2 shape mirrors docs/source-package/schemas/notification_policy.json while the
// parser still accepts the previous `{ remindersEnabled: boolean }` file without losing intent.

import * as FileSystem from 'expo-file-system/legacy';

const SETTINGS_FILENAME = 'reminders.settings.v1.json';

export type MeloNotificationClass =
  | 'critical_deadline'
  | 'meaningful_change'
  | 'ritual'
  | 'progress'
  | 'marketing';

export type NotificationClassSettings = Readonly<Record<MeloNotificationClass, boolean>>;

export interface QuietHoursSettings {
  readonly startHour: number;
  readonly endHour: number;
}

export interface RemindersSettings {
  readonly version: 2;
  /** Master switch. False on a fresh install: permission is requested only after a user action. */
  readonly remindersEnabled: boolean;
  /** False hides titles, merchants, amounts, and exact states from notification previews. */
  readonly sensitivePreviews: boolean;
  readonly quietHours: QuietHoursSettings;
  readonly classEnabled: NotificationClassSettings;
}

export const DEFAULT_REMINDERS_SETTINGS: RemindersSettings = {
  version: 2,
  remindersEnabled: false,
  sensitivePreviews: false,
  quietHours: { startHour: 21, endHour: 8 },
  classEnabled: {
    critical_deadline: true,
    meaningful_change: true,
    ritual: false,
    progress: true,
    marketing: false,
  },
};

function settingsFileUri(): string | null {
  const dir = FileSystem.documentDirectory;
  if (dir === null) return null;
  return `${dir}${SETTINGS_FILENAME}`;
}

function isHour(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 23;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Defensive parser and v1-to-v2 migration. Unknown or malformed fields fail to quiet defaults. */
export function parseRemindersSettings(raw: string): RemindersSettings {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return DEFAULT_REMINDERS_SETTINGS;
    const source = parsed as Record<string, unknown>;
    const quiet =
      source.quietHours !== null && typeof source.quietHours === 'object'
        ? (source.quietHours as Record<string, unknown>)
        : {};
    const classes =
      source.classEnabled !== null && typeof source.classEnabled === 'object'
        ? (source.classEnabled as Record<string, unknown>)
        : {};
    return {
      version: 2,
      // The only field in the old v1 file is intentionally preserved. Missing no longer means on.
      remindersEnabled: booleanOr(
        source.remindersEnabled,
        DEFAULT_REMINDERS_SETTINGS.remindersEnabled,
      ),
      sensitivePreviews: booleanOr(
        source.sensitivePreviews,
        DEFAULT_REMINDERS_SETTINGS.sensitivePreviews,
      ),
      quietHours: {
        startHour: isHour(quiet.startHour)
          ? quiet.startHour
          : DEFAULT_REMINDERS_SETTINGS.quietHours.startHour,
        endHour: isHour(quiet.endHour)
          ? quiet.endHour
          : DEFAULT_REMINDERS_SETTINGS.quietHours.endHour,
      },
      classEnabled: {
        critical_deadline: booleanOr(
          classes.critical_deadline,
          DEFAULT_REMINDERS_SETTINGS.classEnabled.critical_deadline,
        ),
        meaningful_change: booleanOr(
          classes.meaningful_change,
          DEFAULT_REMINDERS_SETTINGS.classEnabled.meaningful_change,
        ),
        ritual: booleanOr(classes.ritual, DEFAULT_REMINDERS_SETTINGS.classEnabled.ritual),
        progress: booleanOr(classes.progress, DEFAULT_REMINDERS_SETTINGS.classEnabled.progress),
        // Marketing remains fail-closed even if a malformed/missing field is encountered.
        marketing: booleanOr(classes.marketing, false),
      },
    };
  } catch {
    return DEFAULT_REMINDERS_SETTINGS;
  }
}

export async function loadRemindersSettings(): Promise<RemindersSettings> {
  const uri = settingsFileUri();
  if (uri === null) return DEFAULT_REMINDERS_SETTINGS;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return DEFAULT_REMINDERS_SETTINGS;
    const raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
    return parseRemindersSettings(raw);
  } catch {
    return DEFAULT_REMINDERS_SETTINGS;
  }
}

export async function saveRemindersSettings(settings: RemindersSettings): Promise<boolean> {
  const uri = settingsFileUri();
  if (uri === null) return false;
  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(settings), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return true;
  } catch {
    // Let explicit controls report failure without creating an unhandled native exception.
    return false;
  }
}
