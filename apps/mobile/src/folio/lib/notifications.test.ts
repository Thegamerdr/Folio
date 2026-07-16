import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERSONAL_WORKSPACE_ID } from './workspaceRoot';

const scheduleNotificationAsync = vi.fn().mockResolvedValue('native-id');
const cancelScheduledNotificationAsync = vi.fn().mockResolvedValue(undefined);
const getAllScheduledNotificationsAsync = vi.fn().mockResolvedValue([]);
const getPresentedNotificationsAsync = vi.fn().mockResolvedValue([]);
const dismissNotificationAsync = vi.fn().mockResolvedValue(undefined);
const getPermissionsAsync = vi.fn();
const requestPermissionsAsync = vi.fn();
const setNotificationChannelAsync = vi.fn().mockResolvedValue(null);
const setNotificationHandler = vi.fn();

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  getPresentedNotificationsAsync,
  dismissNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  AndroidImportance: { DEFAULT: 5 },
  AndroidNotificationVisibility: { PRIVATE: 2 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

beforeEach(() => {
  vi.clearAllMocks();
  getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  getAllScheduledNotificationsAsync.mockResolvedValue([]);
  getPresentedNotificationsAsync.mockResolvedValue([]);
});

afterEach(() => vi.resetModules());

const calendarRequest = {
  workspaceId: PERSONAL_WORKSPACE_ID,
  logicalId: 'calendar:event-1:2026-08-01:09:00:0',
  owner: 'calendar' as const,
  notificationClass: 'critical_deadline' as const,
  title: 'Melo reminder',
  body: 'A reminder you chose is due.',
  fireAt: new Date(Date.now() + 60_000),
  eventId: 'event-1',
};

describe('foreground handling', () => {
  it('keeps Melo-owned reminders in the list without sound, badge, or banner', async () => {
    await import('./notifications');
    expect(setNotificationHandler).toHaveBeenCalledTimes(1);
    const handler = setNotificationHandler.mock.calls[0]?.[0];
    await expect(
      handler.handleNotification({ request: { content: { data: { meloOwner: 'calendar' } } } }),
    ).resolves.toEqual({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });

  it('does not globally opt unrelated notification owners into foreground presentation', async () => {
    await import('./notifications');
    const handler = setNotificationHandler.mock.calls[0]?.[0];
    await expect(
      handler.handleNotification({ request: { content: { data: { owner: 'another-feature' } } } }),
    ).resolves.toEqual(expect.objectContaining({ shouldShowBanner: false, shouldShowList: false }));
  });
});

describe('permission', () => {
  it('reads granted, denied, and undetermined without prompting', async () => {
    const { getPermissionState } = await import('./notifications');
    getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    await expect(getPermissionState()).resolves.toBe('granted');
    getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    await expect(getPermissionState()).resolves.toBe('denied');
    getPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    await expect(getPermissionState()).resolves.toBe('undetermined');
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests only through the explicit request function', async () => {
    const { requestPermission } = await import('./notifications');
    getPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    await expect(requestPermission()).resolves.toBe('granted');
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('owned scheduling', () => {
  it('cancels only the requested Melo owner and leaves unrelated notifications untouched', async () => {
    getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: 'calendar-id', content: { data: { meloOwner: 'calendar' } } },
      {
        identifier: 'business-calendar-id',
        content: {
          data: { meloOwner: 'calendar', meloWorkspaceId: 'workspace_business_test' },
        },
      },
      { identifier: 'insight-id', content: { data: { meloOwner: 'insight' } } },
      { identifier: 'other-id', content: { data: { owner: 'another-feature' } } },
    ]);
    const { cancelOwnedNotifications } = await import('./notifications');
    await cancelOwnedNotifications(PERSONAL_WORKSPACE_ID, 'calendar');
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('calendar-id');
  });

  it('dismisses only presented notifications owned by the requested Melo subsystem', async () => {
    getPresentedNotificationsAsync.mockResolvedValueOnce([
      { request: { identifier: 'calendar-live', content: { data: { meloOwner: 'calendar' } } } },
      { request: { identifier: 'other-live', content: { data: { owner: 'another-feature' } } } },
    ]);
    const { dismissOwnedNotifications } = await import('./notifications');
    await dismissOwnedNotifications(PERSONAL_WORKSPACE_ID, 'calendar');
    expect(dismissNotificationAsync).toHaveBeenCalledTimes(1);
    expect(dismissNotificationAsync).toHaveBeenCalledWith('calendar-live');
  });

  it('uses an absolute date trigger, the reminder channel, and non-sensitive metadata', async () => {
    const { replaceOwnedNotifications } = await import('./notifications');
    await expect(
      replaceOwnedNotifications(PERSONAL_WORKSPACE_ID, 'calendar', [calendarRequest]),
    ).resolves.toBe(1);
    const call = scheduleNotificationAsync.mock.calls[0]?.[0];
    expect(call.trigger.type).toBe('date');
    expect(call.trigger.channelId).toBe('melo-reminders');
    expect(call.content.title).toBe('Melo reminder');
    expect(call.content.data).toEqual({
      meloOwner: 'calendar',
      meloWorkspaceId: PERSONAL_WORKSPACE_ID,
      logicalId: calendarRequest.logicalId,
      notificationClass: 'critical_deadline',
      eventId: 'event-1',
    });
    expect(JSON.stringify(call.content.data)).not.toContain('A reminder you chose');
  });

  it('clears stale owned requests but schedules nothing when permission is denied', async () => {
    getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    const { replaceOwnedNotifications } = await import('./notifications');
    await expect(
      replaceOwnedNotifications(PERSONAL_WORKSPACE_ID, 'calendar', [calendarRequest]),
    ).resolves.toBe(0);
    expect(getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('creates separate private Android channels for reminders and updates', async () => {
    const { ensureAndroidChannel } = await import('./notifications');
    await ensureAndroidChannel();
    expect(setNotificationChannelAsync).toHaveBeenCalledTimes(3);
    expect(setNotificationChannelAsync).toHaveBeenCalledWith(
      'melo-reminders',
      expect.objectContaining({ lockscreenVisibility: 2, sound: null }),
    );
    expect(setNotificationChannelAsync).toHaveBeenCalledWith(
      'melo-updates',
      expect.objectContaining({ lockscreenVisibility: 2, sound: null }),
    );
  });

  it('rejects a cross-workspace batch before canceling or scheduling', async () => {
    const { replaceOwnedNotifications } = await import('./notifications');
    await expect(
      replaceOwnedNotifications(PERSONAL_WORKSPACE_ID, 'calendar', [
        { ...calendarRequest, workspaceId: 'workspace_business_test' as never },
      ]),
    ).rejects.toThrow(/workspace/i);
    expect(getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
