import type { TimelineEvent } from '../store';

/** Keep recent history plus the last un-restored removal receipt for every tracked debt.
 * Without that receipt a removed debt would eventually become indistinguishable from never added.
 */
export function retainTimelineEvents(
  events: readonly TimelineEvent[],
  recentLimit = 200,
): TimelineEvent[] {
  const recent = events.slice(0, recentLimit);
  const included = new Set(recent.map((event) => event.id));
  const seenDebtIds = new Set<string>();
  for (const event of events) {
    if (
      (event.kind !== 'debt-removed' && event.kind !== 'debt-restored') ||
      !event.entityId ||
      seenDebtIds.has(event.entityId)
    )
      continue;
    seenDebtIds.add(event.entityId);
    if (event.kind === 'debt-removed' && !included.has(event.id)) recent.push(event);
  }
  return recent;
}
