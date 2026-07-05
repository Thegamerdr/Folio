// The reschedule loop — subscribes to store changes (via `subscribeStore`, the store's own
// non-React change seam, exactly like `lib/persist.ts` does) and, on every change, re-derives the
// notification plan and reschedules local notifications. Self-contained: does not edit `store.ts`,
// only reads it (`getState`, `subscribeStore` — both already exported for this purpose).
//
// Respects:
//   • `state.melo.quietMode` (store, read-only) — the Melo companion's own "quiet mode" setting.
//     When on, this bridge treats it the same as the reminders toggle being off: no scheduling.
//   • `remindersEnabled` (./notifySettings, this lane's own persisted setting) — the user's
//     explicit reminders on/off choice, surfaced on MoreScreen.
//   • The engine's own quiet-hours + daily budget (`inQuietHours`, `DAILY_BUDGET` inside
//     `planNotification` itself) — this hook does not duplicate that logic, it only supplies
//     `hour`/`sentToday`/`dangerSentToday` and lets the engine decide.
//
// Debounced like `persist.ts`'s write-on-change (a burst of store writes recomputes the route once,
// not once per write) — reuses the exact same pure debounce helper.

import { planNotification } from '@folio/melo-engine';
import type { PlannedNotification } from '@folio/melo-engine';

import { getState, subscribeStore } from '../store';
import { routeFromStore } from './storeRoute';
import { deriveNotifyInputs, snapshotFromRoute, type NotifySnapshot } from './notifyState';
import { loadRemindersSettings } from './notifySettings';
import { reschedule } from './notifications';

const RESCHEDULE_DEBOUNCE_MS = 600;

// Mirrors `lib/persist.ts` `makeDebounced` exactly (kept as its own copy — see that file's own
// comment on why this one small helper is duplicated rather than shared: it is trivial, pure, and
// each caller owns its own cancel lifecycle without an extra shared-module dependency).
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

/** Day-scoped counters for the engine's daily budget. Reset whenever the local calendar day
 *  changes. This process-lifetime-only counter is intentionally simple: the engine's budget is a
 *  soft "don't spam today" rule, not a hard cross-restart guarantee. */
let countersDay = '';
let sentToday = 0;
let dangerSentToday = 0;

function rolloverCountersIfNewDay(now: Date): void {
  const today = now.toISOString().slice(0, 10);
  if (today !== countersDay) {
    countersDay = today;
    sentToday = 0;
    dangerSentToday = 0;
  }
}

function recordSent(plan: PlannedNotification | null): void {
  if (plan === null) return;
  sentToday += 1;
  if (plan.key === 'dangerEntered') dangerSentToday += 1;
}

let lastSnapshot: NotifySnapshot | null = null;

async function recomputeAndReschedule(): Promise<void> {
  const state = getState();
  const quietMode = state.melo?.quietMode ?? false;
  if (quietMode) {
    await reschedule([]);
    return;
  }

  const settings = await loadRemindersSettings();
  if (!settings.remindersEnabled) {
    await reschedule([]);
    return;
  }

  const now = new Date();
  rolloverCountersIfNewDay(now);

  const route = routeFromStore(state, now);
  const nextSnapshot = snapshotFromRoute(route, now);
  const built = deriveNotifyInputs(state, route, lastSnapshot, nextSnapshot, now, {
    sentToday,
    dangerSentToday,
  });
  lastSnapshot = nextSnapshot;

  if (built === null) {
    await reschedule([]);
    return;
  }

  const planned = planNotification(built.inputs, built.ctx);
  recordSent(planned);
  await reschedule(planned ? [planned] : []);
}

/**
 * Start the scheduler: recomputes once immediately, then again on every debounced store change.
 * Returns an unsubscribe function that cancels any pending recompute. Call once, at app mount
 * (alongside `startPersisting()` in `app/index.tsx`), AFTER `loadPersisted()` so the first
 * recompute sees the user's real hydrated state, not fresh defaults.
 */
export function startNotificationScheduler(): () => void {
  const debounced = makeDebounced(() => {
    void recomputeAndReschedule();
  }, RESCHEDULE_DEBOUNCE_MS);

  void recomputeAndReschedule(); // initial plan, un-debounced.
  const unsubscribe = subscribeStore(debounced.run);

  return () => {
    debounced.cancel();
    unsubscribe();
  };
}

/** Exposed for MoreScreen's Reminders row: force an immediate recompute after the user flips the
 *  reminders toggle or grants permission, so the UI/state feels responsive rather than waiting for
 *  the next store write. */
export function forceRescheduleNow(): void {
  void recomputeAndReschedule();
}
