import type { Sub } from '../store';

/**
 * Native subscription identity is carried separately from the user-facing name.
 * Legacy blobs have no id, so every reader keeps a name fallback until the next
 * hydration/setSubs pass assigns one.
 */
export function subscriptionKey(subscription: Pick<Sub, 'id' | 'name'>): string {
  return subscription.id ?? subscription.name;
}

export function subscriptionPaused(
  paused: Readonly<Record<string, boolean>>,
  subscription: Pick<Sub, 'id' | 'name'>,
): boolean {
  const key = subscriptionKey(subscription);
  return paused[key] ?? paused[subscription.name] ?? false;
}

export function subscriptionOverride(
  overrides: Readonly<Record<string, number>>,
  subscription: Pick<Sub, 'id' | 'name'>,
): number {
  const key = subscriptionKey(subscription);
  return overrides[key] ?? overrides[subscription.name] ?? 0;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Assign deterministic ids to old rows without changing their values. */
export function ensureSubscriptionIds(subscriptions: readonly Sub[]): Sub[] {
  const used = new Set<string>();
  return subscriptions.map((subscription, index) => {
    const supplied = subscription.id?.trim();
    if (supplied && !used.has(supplied)) {
      used.add(supplied);
      return subscription;
    }
    const fingerprint = JSON.stringify({
      name: subscription.name,
      cost: subscription.cost,
      nextRenewalISO: subscription.nextRenewalISO,
      obligationAnchorISO: subscription.obligationAnchorISO,
      renewalPeriodDays: subscription.renewalPeriodDays,
      index,
    });
    const base = `sub-legacy-${stableHash(fingerprint)}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return { ...subscription, id };
  });
}

/**
 * Move legacy name-keyed settings to an id only when the name identifies one
 * row. Multiple rows with the same name are intentionally left name-keyed:
 * there is no historical fact that can tell us which row owned the setting.
 * Keeping that ambiguity visible preserves the old behaviour without silently
 * assigning money or history to the wrong subscription.
 */
export function migrateLegacySubscriptionState(
  subscriptions: readonly Pick<Sub, 'id' | 'name'>[],
  paused: Readonly<Record<string, boolean>>,
  overrides: Readonly<Record<string, number>>,
): { paused: Record<string, boolean>; overrides: Record<string, number> } {
  const byName = new Map<string, Pick<Sub, 'id' | 'name'>[]>();
  for (const subscription of subscriptions) {
    const rows = byName.get(subscription.name) ?? [];
    rows.push(subscription);
    byName.set(subscription.name, rows);
  }

  const migrate = <T>(source: Readonly<Record<string, T>>): Record<string, T> => {
    const next = { ...source };
    for (const [name, value] of Object.entries(source)) {
      const rows = byName.get(name);
      if (rows?.length !== 1) continue;
      const id = rows[0]?.id;
      if (id === undefined || Object.prototype.hasOwnProperty.call(next, id)) continue;
      next[id] = value;
      delete next[name];
    }
    return next;
  };

  return { paused: migrate(paused), overrides: migrate(overrides) };
}

/** New records use a process-local unique id; the value is persisted by setSubs. */
export function createSubscriptionIdentity(): string {
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
