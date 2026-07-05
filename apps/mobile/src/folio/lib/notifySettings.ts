// Reminders settings — a small SELF-CONTAINED persisted module (per the notifications-binding
// brief: "not store.ts"). Follows the same on-disk-JSON shape as `./persist.ts` but far lighter:
// this is a non-sensitive UI preference (one boolean + a cached permission read), so it skips the
// vault-key/AES machinery entirely and just reads/writes a small plaintext JSON file via
// `expo-file-system/legacy` (the same module persist.ts uses), mirroring its "missing file / parse
// failure is always a silent no-op, never blocks launch" tolerance.
//
// Contract:
//   • `remindersEnabled` — the user's own on/off choice for local reminders. Defaults to `true`
//     (opt-out, not opt-in) so a fresh install schedules the engine's already-approved plan
//     copy; the OS permission prompt is the real gate on whether anything actually fires.
//   • This module does NOT touch expo-notifications — permission state lives in
//     `./notifications.ts` (queried live, not cached here) so this file stays a pure settings
//     store, importable and unit-testable without pulling in the native module.

import * as FileSystem from 'expo-file-system/legacy';

const SETTINGS_FILENAME = 'reminders.settings.v1.json';

export interface RemindersSettings {
  readonly remindersEnabled: boolean;
}

export const DEFAULT_REMINDERS_SETTINGS: RemindersSettings = {
  remindersEnabled: true,
};

function settingsFileUri(): string | null {
  const dir = FileSystem.documentDirectory;
  if (dir === null) return null;
  return `${dir}${SETTINGS_FILENAME}`;
}

/** Parse a persisted settings blob defensively — a corrupt or partial file (or a future shape
 *  this version doesn't know about) falls back to the default rather than throwing. */
export function parseRemindersSettings(raw: string): RemindersSettings {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'remindersEnabled' in parsed &&
      typeof (parsed as { remindersEnabled: unknown }).remindersEnabled === 'boolean'
    ) {
      return { remindersEnabled: (parsed as { remindersEnabled: boolean }).remindersEnabled };
    }
  } catch {
    /* fall through to default */
  }
  return DEFAULT_REMINDERS_SETTINGS;
}

/** Read the persisted reminders settings, or the default when unset/unreadable. Never throws. */
export async function loadRemindersSettings(): Promise<RemindersSettings> {
  const uri = settingsFileUri();
  if (uri === null) return DEFAULT_REMINDERS_SETTINGS;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return DEFAULT_REMINDERS_SETTINGS;
    const raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
    return parseRemindersSettings(raw);
  } catch {
    return DEFAULT_REMINDERS_SETTINGS; // corrupt/unreadable — keep the default, never block launch.
  }
}

/** Persist the reminders settings. Fire-and-forget failures are swallowed by the caller's own
 *  try/catch convention (matches `persist.ts` — a disk failure must never crash a settings toggle). */
export async function saveRemindersSettings(settings: RemindersSettings): Promise<void> {
  const uri = settingsFileUri();
  if (uri === null) return;
  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(settings), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    /* disk / quota failure — the in-memory toggle already reflects the user's choice this
     * session; worst case the preference doesn't survive a restart. */
  }
}
