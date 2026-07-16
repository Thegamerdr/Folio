import type { PlannedNotification } from '@folio/melo-engine';
import type { WorkspaceId } from '@folio/domain';
import type { MeloNotificationClass, RemindersSettings } from './notifySettings';

export type MeloNotificationOwner = 'calendar' | 'insight';

/** Native-adapter-neutral request. Dates are absolute device instants; copy is already privacy-safe. */
export interface ScheduledLocalNotification {
  readonly workspaceId: WorkspaceId;
  readonly logicalId: string;
  readonly owner: MeloNotificationOwner;
  readonly notificationClass: MeloNotificationClass;
  readonly title: string;
  readonly body: string;
  readonly fireAt: Date;
  readonly eventId?: string;
}

export function notificationClassForPlan(
  key: PlannedNotification['key'],
): Exclude<MeloNotificationClass, 'critical_deadline' | 'marketing'> {
  if (key === 'payday' || key === 'paydayEve' || key === 'recoveryCheckin') return 'ritual';
  if (key === 'milestone') return 'progress';
  return 'meaningful_change';
}

/** Converts an engine transition into one privacy-policy-aware, near-immediate local request. */
export function buildInsightNotificationRequest(
  workspaceId: WorkspaceId,
  plan: PlannedNotification,
  settings: RemindersSettings,
  now = new Date(),
): ScheduledLocalNotification | null {
  const notificationClass = notificationClassForPlan(plan.key);
  if (!settings.remindersEnabled || !settings.classEnabled[notificationClass]) return null;
  return {
    workspaceId,
    logicalId: `insight:${plan.key}:${now.getTime()}`,
    owner: 'insight',
    notificationClass,
    title: settings.sensitivePreviews ? plan.title : 'Melo update',
    body: settings.sensitivePreviews
      ? plan.body
      : 'Something meaningful changed in your money path.',
    fireAt: new Date(now.getTime() + 2_000),
  };
}
