// notifications.ts tests — the plan → schedule mapping, with expo-notifications and react-native
// mocked (this file imports both directly, by relative path — no `@/` alias needed, no expo/RN
// runtime required — matching the clerkAuth.test.ts convention of mocking the native-touching
// import before importing the module under test).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scheduleNotificationAsync = vi.fn().mockResolvedValue('id');
const cancelAllScheduledNotificationsAsync = vi.fn().mockResolvedValue(undefined);
const getPermissionsAsync = vi.fn();
const requestPermissionsAsync = vi.fn();
const setNotificationChannelAsync = vi.fn().mockResolvedValue(null);

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync,
  cancelAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

beforeEach(() => {
  vi.clearAllMocks();
  getPermissionsAsync.mockResolvedValue({ status: 'granted' });
});

afterEach(() => {
  vi.resetModules();
});

describe('getPermissionState / requestPermission', () => {
  it('maps the granted status through', async () => {
    const { getPermissionState } = await import('./notifications');
    getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    await expect(getPermissionState()).resolves.toBe('granted');
  });

  it('maps denied and undetermined', async () => {
    const { getPermissionState } = await import('./notifications');
    getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    await expect(getPermissionState()).resolves.toBe('denied');
    getPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    await expect(getPermissionState()).resolves.toBe('undetermined');
  });

  it('does not re-prompt when already granted', async () => {
    const { requestPermission } = await import('./notifications');
    getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    await expect(requestPermission()).resolves.toBe('granted');
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('prompts when undetermined and returns the result', async () => {
    const { requestPermission } = await import('./notifications');
    getPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    await expect(requestPermission()).resolves.toBe('granted');
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('treats a request failure as denied, never throws', async () => {
    const { requestPermission } = await import('./notifications');
    getPermissionsAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(requestPermission()).resolves.toBe('denied');
  });
});

describe('scheduleFromPlan', () => {
  it('schedules nothing for an empty plan', async () => {
    const { scheduleFromPlan } = await import('./notifications');
    await scheduleFromPlan([]);
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('is a graceful no-op when permission is not granted', async () => {
    const { scheduleFromPlan } = await import('./notifications');
    getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    await scheduleFromPlan([{ key: 'payday', title: 'Payday', body: 'Two minutes.' }]);
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('maps each planned notification to a scheduleNotificationAsync call with engine copy verbatim', async () => {
    const { scheduleFromPlan } = await import('./notifications');
    await scheduleFromPlan([
      { key: 'dangerEntered', title: 'Storm Thursday', body: '£38 short if usual.' },
    ]);
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const call = scheduleNotificationAsync.mock.calls[0]?.[0];
    expect(call.content.title).toBe('Storm Thursday');
    expect(call.content.body).toBe('£38 short if usual.');
    expect(call.content.data).toEqual({ key: 'dangerEntered' });
    expect(call.trigger.type).toBe('timeInterval');
    expect(call.trigger.channelId).toBe('melo');
  });

  it('stages multiple items apart and never blocks the batch on one failure', async () => {
    const { scheduleFromPlan } = await import('./notifications');
    scheduleNotificationAsync.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('id2');
    await scheduleFromPlan([
      { key: 'payday', title: 'Payday', body: 'a' },
      { key: 'milestone', title: 'Milestone', body: 'b' },
    ]);
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    const seconds = scheduleNotificationAsync.mock.calls.map((c) => c[0].trigger.seconds);
    expect(seconds[1]).toBeGreaterThan(seconds[0]);
  });

  it('creates the Android channel before scheduling', async () => {
    const { scheduleFromPlan } = await import('./notifications');
    await scheduleFromPlan([{ key: 'payday', title: 'Payday', body: 'a' }]);
    expect(setNotificationChannelAsync).toHaveBeenCalledWith(
      'melo',
      expect.objectContaining({ name: 'Melo' }),
    );
  });
});

describe('reschedule', () => {
  it('cancels everything before scheduling the fresh plan', async () => {
    const { reschedule } = await import('./notifications');
    await reschedule([{ key: 'payday', title: 'Payday', body: 'a' }]);
    expect(cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('cancelling with an empty plan clears everything and schedules nothing', async () => {
    const { reschedule } = await import('./notifications');
    await reschedule([]);
    expect(cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
