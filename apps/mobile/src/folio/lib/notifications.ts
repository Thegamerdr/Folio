// Local-only expo-notifications adapter. Decision logic lives in the pure calendar/Melo planners;
// this module owns Android channels, permission state, precise DATE triggers, and scoped cleanup.
// It never obtains a push token and never sends notification data to a server.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { WorkspaceId } from '@folio/domain';

import type { MeloNotificationOwner, ScheduledLocalNotification } from './notificationRequests';
import { PERSONAL_WORKSPACE_ID } from './workspaceRoot';

export const MELO_CHANNEL_ID = 'melo';
export const MELO_REMINDER_CHANNEL_ID = 'melo-reminders';
export const MELO_UPDATE_CHANNEL_ID = 'melo-updates';

function isMeloOwner(value: unknown): value is MeloNotificationOwner {
  return value === 'calendar' || value === 'insight';
}

/**
 * Expo discards notifications that fire while the app is foregrounded unless a handler answers
 * within three seconds. Keep Melo reminders visible in the notification list, but deliberately
 * avoid a sound, badge or interruptive foreground banner. Notifications not owned by Melo retain
 * Expo's default foreground suppression instead of being globally opted in by this feature.
 */
export function installForegroundNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const show = isMeloOwner(notification.request.content.data?.meloOwner);
      return {
        shouldShowBanner: false,
        shouldShowList: show,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });
}

installForegroundNotificationHandler();

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function toPermissionState(status: Notifications.PermissionStatus): PermissionState {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const common: Omit<Notifications.NotificationChannelInput, 'name'> = {
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: null,
    enableVibrate: false,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  };
  try {
    await Promise.all([
      Notifications.setNotificationChannelAsync(MELO_CHANNEL_ID, {
        ...common,
        name: 'Melo',
      }),
      Notifications.setNotificationChannelAsync(MELO_REMINDER_CHANNEL_ID, {
        ...common,
        name: 'Melo reminders',
        description: 'Deadlines and reminders you explicitly choose in Melo.',
      }),
      Notifications.setNotificationChannelAsync(MELO_UPDATE_CHANNEL_ID, {
        ...common,
        name: 'Melo updates',
        description: 'Quiet, meaningful changes in your money path.',
      }),
    ]);
  } catch {
    // Channel creation failure is non-fatal; scheduling remains best-effort.
  }
}

export async function getPermissionState(): Promise<PermissionState> {
  try {
    return toPermissionState((await Notifications.getPermissionsAsync()).status);
  } catch {
    return 'undetermined';
  }
}

/** Prompt only from an explicit user action. Scheduler/startup code never calls this function. */
export async function requestPermission(): Promise<PermissionState> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === Notifications.PermissionStatus.GRANTED) return 'granted';
    return toPermissionState((await Notifications.requestPermissionsAsync()).status);
  } catch {
    return 'denied';
  }
}

function requestOwner(request: Notifications.NotificationRequest): unknown {
  return request.content.data?.meloOwner;
}

function requestWorkspaceId(request: Notifications.NotificationRequest): unknown {
  return request.content.data?.meloWorkspaceId;
}

function requestBelongsToWorkspace(
  request: Notifications.NotificationRequest,
  workspaceId: WorkspaceId,
): boolean {
  const stored = requestWorkspaceId(request);
  if (stored !== undefined && stored !== null) return String(stored) === String(workspaceId);
  // Requests created before workspace metadata existed can only have come from Personal.
  return String(workspaceId) === String(PERSONAL_WORKSPACE_ID);
}

/** Cancel only notifications scheduled by the requested Melo subsystem, including after restart. */
export async function cancelOwnedNotifications(
  workspaceId: WorkspaceId,
  owner: MeloNotificationOwner,
): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(
          (request) =>
            requestOwner(request) === owner && requestBelongsToWorkspace(request, workspaceId),
        )
        .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
    );
  } catch {
    // Nothing owned is scheduled, or the OS query failed. Never crash the app for cleanup.
  }
}

/** Cancel all Melo-owned groups without touching other notification features in the application. */
export async function cancelAll(workspaceId: WorkspaceId): Promise<void> {
  await Promise.all([
    cancelOwnedNotifications(workspaceId, 'calendar'),
    cancelOwnedNotifications(workspaceId, 'insight'),
  ]);
}

/** Dismiss only already-delivered notifications owned by Melo, leaving other app features alone. */
export async function dismissOwnedNotifications(
  workspaceId: WorkspaceId,
  owner: MeloNotificationOwner,
): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter(
          (notification) =>
            requestOwner(notification.request) === owner &&
            requestBelongsToWorkspace(notification.request, workspaceId),
        )
        .map((notification) =>
          Notifications.dismissNotificationAsync(notification.request.identifier),
        ),
    );
  } catch {
    // Presented-notification cleanup is best-effort and must never block local deletion.
  }
}

export async function clearAllMeloNotifications(workspaceId: WorkspaceId): Promise<void> {
  await Promise.all([
    cancelOwnedNotifications(workspaceId, 'calendar'),
    cancelOwnedNotifications(workspaceId, 'insight'),
    dismissOwnedNotifications(workspaceId, 'calendar'),
    dismissOwnedNotifications(workspaceId, 'insight'),
  ]);
}

function channelFor(request: ScheduledLocalNotification): string {
  return request.owner === 'calendar' ? MELO_REMINDER_CHANNEL_ID : MELO_UPDATE_CHANNEL_ID;
}

async function scheduleRequests(requests: readonly ScheduledLocalNotification[]): Promise<number> {
  if (requests.length === 0 || (await getPermissionState()) !== 'granted') return 0;
  await ensureAndroidChannel();
  let scheduledCount = 0;
  for (const request of requests) {
    if (!Number.isFinite(request.fireAt.getTime()) || request.fireAt.getTime() <= Date.now())
      continue;
    try {
      const trigger: Notifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: request.fireAt,
        ...(Platform.OS === 'android' ? { channelId: channelFor(request) } : {}),
      };
      await Notifications.scheduleNotificationAsync({
        content: {
          title: request.title,
          body: request.body,
          data: {
            meloOwner: request.owner,
            meloWorkspaceId: request.workspaceId,
            logicalId: request.logicalId,
            notificationClass: request.notificationClass,
            ...(request.eventId !== undefined ? { eventId: request.eventId } : {}),
          },
        },
        trigger,
      });
      scheduledCount += 1;
    } catch {
      // One bad request must not block the rest of the batch.
    }
  }
  return scheduledCount;
}

/** Replace one owned schedule atomically enough for app use, leaving every other owner untouched. */
export async function replaceOwnedNotifications(
  workspaceId: WorkspaceId,
  owner: MeloNotificationOwner,
  requests: readonly ScheduledLocalNotification[],
): Promise<number> {
  if (
    requests.some(
      (request) => request.owner !== owner || String(request.workspaceId) !== String(workspaceId),
    )
  ) {
    throw new Error('A notification batch crossed its workspace or owner boundary.');
  }
  await cancelOwnedNotifications(workspaceId, owner);
  return scheduleRequests(requests);
}
