import type { Subscription } from '@folio/domain';

/** Stable reference used by the native ledger for a subscription row. */
export function localSubscriptionKey(subscription: Pick<Subscription, 'id'>): string {
  return String(subscription.id);
}

/** Read a nudge by id, retaining the name fallback for older snapshot blobs. */
export function localSubscriptionOverride(
  overrides: Readonly<Record<string, number>>,
  subscription: Pick<Subscription, 'id' | 'name'>,
): number {
  return overrides[localSubscriptionKey(subscription)] ?? overrides[subscription.name] ?? 0;
}

/** Migrate a legacy name key only where one row can own it without a guess. */
export function migrateLocalSubscriptionOverrides(
  subscriptions: readonly Pick<Subscription, 'id' | 'name'>[],
  overrides: Readonly<Record<string, number>>,
): Record<string, number> {
  const byName = new Map<string, Pick<Subscription, 'id' | 'name'>[]>();
  for (const subscription of subscriptions) {
    const rows = byName.get(subscription.name) ?? [];
    rows.push(subscription);
    byName.set(subscription.name, rows);
  }
  const next = { ...overrides };
  for (const [name, value] of Object.entries(overrides)) {
    const rows = byName.get(name);
    if (rows?.length !== 1) continue;
    const id = rows[0] === undefined ? undefined : localSubscriptionKey(rows[0]);
    if (id === undefined || Object.prototype.hasOwnProperty.call(next, id)) continue;
    next[id] = value;
    delete next[name];
  }
  return next;
}
