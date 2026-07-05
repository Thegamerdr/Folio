// expo-notifications wrapper — the native-adapter half of the notifications lane. The DECISION
// logic (what to say, when, budget/quiet-hours) lives in `@folio/melo-engine`'s `notify.ts`
// (`planNotification`); this file only turns an already-decided `PlannedNotification[]` into local
// (device-only, no push/remote) scheduled notifications, exactly like `lib/persist.ts` is the
// native adapter for the pure store.
//
// HARD CONSTRAINTS:
//   • Local only. No push token, no remote server, no `getExpoPushTokenAsync` call — this is
//     purely "the app reminds you of your own numbers," never a server pushing to you.
//   • Content comes from the engine's `PlannedNotification.title`/`.body` — this file NEVER
//     invents copy (§ the brief: "never invent copy").
//   • A denied permission is a graceful, silent no-op everywhere (schedule calls become no-ops) —
//     never a crash, never a repeated nag prompt from this module itself.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PlannedNotification } from '@folio/melo-engine';

/** Android notification channel — one calm channel, default importance (a heads-up banner, not a
 *  high-priority alert with sound), no custom sound. iOS has no channel concept; this is a no-op
 *  there (`setNotificationChannelAsync` doesn't exist on iOS, guarded by `Platform.OS` below). */
export const MELO_CHANNEL_ID = 'melo';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function toPermissionState(status: Notifications.PermissionStatus): PermissionState {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

/** Create (or update) the Android notification channel. Safe to call repeatedly — idempotent on
 *  the OS side. No-op on iOS. Call once at app start, before any scheduling. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(MELO_CHANNEL_ID, {
      name: 'Melo',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null, // no sound spam — a quiet default banner.
      vibrationPattern: null,
    });
  } catch {
    /* channel creation failure — scheduling below will still no-op gracefully. */
  }
}

/** Read the current permission state without prompting. */
export async function getPermissionState(): Promise<PermissionState> {
  try {
    const result = await Notifications.getPermissionsAsync();
    return toPermissionState(result.status);
  } catch {
    return 'undetermined';
  }
}

/** Request permission if not already determined; returns the resulting state. Never throws — a
 *  denied result (or a request failure) is a graceful state the caller renders, not an error. */
export async function requestPermission(): Promise<PermissionState> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === Notifications.PermissionStatus.GRANTED) return 'granted';
    const requested = await Notifications.requestPermissionsAsync();
    return toPermissionState(requested.status);
  } catch {
    return 'denied'; // treat a request failure as denied — the safe, silent default.
  }
}

/** Cancel every currently-scheduled Melo notification. Called before each reschedule so a stale
 *  plan (yesterday's danger date, a since-resolved payday) never lingers alongside a fresh one. */
export async function cancelAll(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* nothing scheduled, or the OS call failed — either way there is nothing further to do. */
  }
}

/** Schedule a plan of `PlannedNotification`s as one-shot local notifications, a small stagger
 *  apart (`STAGGER_SECONDS`) so multiple same-tick plans don't collide into one OS notification
 *  and so they display in the engine's own priority order. No-op (per-item, swallowed) on a denied
 *  permission or scheduling failure — never throws, never partially crashes the batch. */
const STAGGER_SECONDS = 2;

export async function scheduleFromPlan(plan: readonly PlannedNotification[]): Promise<void> {
  if (plan.length === 0) return;
  const permission = await getPermissionState();
  if (permission !== 'granted') return; // graceful denied-state no-op — see module header.

  await ensureAndroidChannel();

  for (const [index, notification] of plan.entries()) {
    try {
      const trigger: Notifications.NotificationTriggerInput =
        Platform.OS === 'android'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: Math.max(1, (index + 1) * STAGGER_SECONDS),
              repeats: false,
              channelId: MELO_CHANNEL_ID,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: Math.max(1, (index + 1) * STAGGER_SECONDS),
              repeats: false,
            };
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: { key: notification.key },
        },
        trigger,
      });
    } catch {
      /* one bad item must never block the rest of the batch. */
    }
  }
}

/** Cancel everything, then schedule the fresh plan — the standard "reschedule" pattern the
 *  scheduler hook calls after every store-derived plan recompute. */
export async function reschedule(plan: readonly PlannedNotification[]): Promise<void> {
  await cancelAll();
  await scheduleFromPlan(plan);
}
