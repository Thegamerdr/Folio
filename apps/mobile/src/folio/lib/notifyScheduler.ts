// Store-driven local notification reconciler. It keeps the user's explicit calendar reminders in
// sync with real event dates and emits at most one privacy-policy-aware Melo transition. Scheduling
// is serialized so a burst of store writes cannot race two cancel/rebuild passes.

import { planNotification } from '@folio/melo-engine';
import type { PlannedNotification } from '@folio/melo-engine';

import { getState, subscribeStore } from '../store';
import { buildCalendarReminderRequests } from './calendarReminders';
import { buildInsightNotificationRequest } from './notificationRequests';
import { routeFromStore } from './storeRoute';
import { deriveNotifyInputs, snapshotFromRoute } from './notifyState';
import { loadRemindersSettings } from './notifySettings';
import {
  EMPTY_NOTIFY_RUNTIME_STATE,
  loadNotifyRuntimeState,
  saveNotifyRuntimeState,
  type NotifyRuntimeState,
} from './notifyRuntimeState';
import { cancelAll, replaceOwnedNotifications } from './notifications';

const RESCHEDULE_DEBOUNCE_MS = 600;

function makeDebounced(fn: () => void, ms: number): { run: () => void; cancel: () => void } {
  let handle: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (handle !== null) {
      clearTimeout(handle);
      handle = null;
    }
  };
  const run = () => {
    cancel();
    handle = setTimeout(() => {
      handle = null;
      fn();
    }, ms);
  };
  return { run, cancel };
}

function localDayKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

function rolloverRuntime(runtime: NotifyRuntimeState, now: Date): NotifyRuntimeState {
  const today = localDayKey(now);
  return runtime.localDay === today
    ? runtime
    : { ...runtime, localDay: today, sentToday: 0, dangerSentToday: 0 };
}

function withRecordedDelivery(
  runtime: NotifyRuntimeState,
  plan: PlannedNotification,
): NotifyRuntimeState {
  return {
    ...runtime,
    sentToday: runtime.sentToday + 1,
    dangerSentToday: runtime.dangerSentToday + (plan.key === 'dangerEntered' ? 1 : 0),
  };
}

const runtimeStateByWorkspace = new Map<string, NotifyRuntimeState>();
let recomputeQueue: Promise<void> = Promise.resolve();

async function recomputeAndReschedule(): Promise<void> {
  const appState = getState();
  const workspaceId = appState.activeWorkspaceId;
  const workspaceKey = String(workspaceId);
  const now = new Date();
  const settings = await loadRemindersSettings();
  const route = routeFromStore(appState, now);
  const nextSnapshot = snapshotFromRoute(appState, route, now);

  let runtimeState = rolloverRuntime(
    runtimeStateByWorkspace.get(workspaceKey) ??
      (await loadNotifyRuntimeState(workspaceId)) ??
      EMPTY_NOTIFY_RUNTIME_STATE,
    now,
  );
  const previousSnapshot = runtimeState.lastSnapshot;
  runtimeState = { ...runtimeState, lastSnapshot: nextSnapshot };
  runtimeStateByWorkspace.set(workspaceKey, runtimeState);
  // Save the transition baseline before native scheduling. A process death can lose a delivery
  // count, but it must never replay a sensitive transition simply because the app restarted.
  await saveNotifyRuntimeState(workspaceId, runtimeState);

  if (!settings.remindersEnabled || (appState.melo?.quietMode ?? false)) {
    await cancelAll(workspaceId);
    return;
  }

  const calendarRequests = buildCalendarReminderRequests(
    workspaceId,
    appState.calendarEvents,
    settings,
    now,
  );
  await replaceOwnedNotifications(workspaceId, 'calendar', calendarRequests);

  // A first run establishes a baseline. Current state is not a change and must not become a cold
  // start notification (the old `prev === null` path incorrectly announced danger on restart).
  if (previousSnapshot === null) return;

  const built = deriveNotifyInputs(appState, route, previousSnapshot, nextSnapshot, now, {
    sentToday: runtimeState.sentToday,
    dangerSentToday: runtimeState.dangerSentToday,
  });
  if (built === null) return;

  const planned = planNotification({ ...built.inputs, quietHours: settings.quietHours }, built.ctx);
  if (planned === null) return;
  const request = buildInsightNotificationRequest(workspaceId, planned, settings, now);
  if (request === null) return;

  const scheduled = await replaceOwnedNotifications(workspaceId, 'insight', [request]);
  if (scheduled > 0) {
    runtimeState = withRecordedDelivery(runtimeState, planned);
    runtimeStateByWorkspace.set(workspaceKey, runtimeState);
    await saveNotifyRuntimeState(workspaceId, runtimeState);
  }
}

function queueRecompute(): void {
  recomputeQueue = recomputeQueue.then(recomputeAndReschedule).catch(() => undefined);
}

export function startNotificationScheduler(): () => void {
  const debounced = makeDebounced(queueRecompute, RESCHEDULE_DEBOUNCE_MS);
  queueRecompute();
  const unsubscribe = subscribeStore(debounced.run);
  return () => {
    debounced.cancel();
    unsubscribe();
  };
}

/** Explicit UI seam after a settings change or newly-created reminder. */
export function forceRescheduleNow(): void {
  queueRecompute();
}
