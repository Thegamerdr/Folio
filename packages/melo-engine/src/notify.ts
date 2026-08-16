/**
 * The notification dispatcher (MELO_BLUEPRINT.md §7 loops, §16.5 catalog) — pure DECISION logic.
 * It never schedules anything (meloEngineBoundary.schedulesNotifications stays false); the
 * surface binds decisions to expo-notifications once that module ships in a native build.
 *
 * The §4.1/§13 rules, enforced here rather than remembered:
 *   • Notify on TRANSITIONS, never on states.
 *   • Budget: at most one notification per day (danger entry may break it, capped once).
 *   • Quiet hours 21:00–08:00 — nothing useful happens to money at 2am except panic.
 *   • Every notification carries its information IN the notification — no "open to find out".
 *   • Payday and milestone are the only celebration pings; absence is never punished.
 */

import type { CopyContext } from './copy.js';
import type { StateView } from './states.js';

export type NotificationKey =
  | 'payday'
  | 'paydayEve'
  | 'dangerEntered'
  | 'dangerDateMoved'
  | 'stormPassed'
  | 'billWeekAhead'
  | 'recoveryCheckin'
  | 'fogStale'
  | 'milestone';

export interface PlannedNotification {
  readonly key: NotificationKey;
  readonly title: string;
  readonly body: string;
}

export interface NotifyContext extends CopyContext {
  /** "Thu" → "Sun" style deltas for the flagship danger-date-moved ping. */
  readonly previousDangerDay: string;
  readonly shortfallIfUsual: string; // "£38"
}

export interface NotifyInputs {
  readonly prev: StateView | null;
  readonly next: StateView;
  readonly prevDangerDaysAway: number | null;
  readonly nextDangerDaysAway: number | null;
  readonly hour: number; // device-local 0..23
  /** Optional user policy; omitted callers retain the canonical 21:00–08:00 default. */
  readonly quietHours?: Readonly<{ startHour: number; endHour: number }>;
  readonly sentToday: number; // notifications already delivered today
  readonly dangerSentToday: number;
  readonly recoveryCheckinDue: boolean; // surface computes: in recovery, chosen hour reached, not yet sent
  /** §16.5 #19 gates "You made it." on a cycle that was actually hard. */
  readonly hardCycle: boolean;
}

const QUIET_START = 21;
const QUIET_END = 8;
const DAILY_BUDGET = 1;

export function inQuietHours(hour: number, startHour = QUIET_START, endHour = QUIET_END): boolean {
  if (startHour === endHour) return false;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

/** Decide the single notification (if any) this evaluation should produce. */
export function planNotification(i: NotifyInputs, ctx: NotifyContext): PlannedNotification | null {
  if (inQuietHours(i.hour, i.quietHours?.startHour, i.quietHours?.endHour)) return null;

  const prev = i.prev;
  const next = i.next;

  // Danger entry — allowed to break the daily budget exactly once (§4 Warning/Danger).
  const enteredDanger =
    (next.ladder === 'danger' || next.ladder === 'warning') &&
    (prev === null || (prev.ladder !== 'danger' && prev.ladder !== 'warning'));
  if (enteredDanger && i.dangerSentToday === 0) {
    return {
      key: 'dangerEntered',
      title: `Storm ${ctx.dangerDay}`,
      body: `${ctx.shortfallIfUsual} short if spending stays usual. ${ctx.keepDryPerDay}/day til then keeps it dry.`,
    };
  }

  if (i.sentToday >= DAILY_BUDGET) return null;

  // The flagship: the danger date MOVED — change is news, state is noise (§0.6).
  if (
    prev !== null &&
    i.prevDangerDaysAway !== null &&
    i.nextDangerDaysAway !== null &&
    i.nextDangerDaysAway > i.prevDangerDaysAway
  ) {
    return {
      key: 'dangerDateMoved',
      title: `Danger date moved: ${ctx.previousDangerDay} → ${ctx.dangerDay}`,
      body: 'Whatever you did this week — it worked.',
    };
  }

  // Storm passed — the survived-it ping (asks for nothing).
  if (
    prev !== null &&
    (prev.ladder === 'danger' || prev.ladder === 'overspent') &&
    next.ladder !== 'danger' &&
    next.ladder !== 'overspent' &&
    next.ladder !== 'warning'
  ) {
    return {
      key: 'stormPassed',
      title: 'Storm’s passed',
      body: `You got to the other side. Safe Zone: ${ctx.safeZone}.`,
    };
  }

  if (next.overlays.includes('payday') && (prev === null || !prev.overlays.includes('payday'))) {
    return {
      key: 'payday',
      title: 'Payday 🎉',
      body: 'Before it starts disappearing — two minutes with Melo makes it safe.',
    };
  }

  if (
    i.hardCycle &&
    next.overlays.includes('paydayEve') &&
    (prev === null || !prev.overlays.includes('paydayEve'))
  ) {
    return {
      key: 'paydayEve',
      title: 'Payday tomorrow',
      body: 'You made it.',
    };
  }

  if (i.recoveryCheckinDue && next.journey === 'recovery') {
    return {
      key: 'recoveryCheckin',
      title: `Day ${ctx.dayOnPath} on the path`,
      body: `Today’s move: ${ctx.todaysMove}. That’s the whole ask.`,
    };
  }

  if (
    next.overlays.includes('billWeek') &&
    (prev === null || !prev.overlays.includes('billWeek'))
  ) {
    return {
      key: 'billWeekAhead',
      title: 'Big week for bills — all shielded',
      body: `Spending money this week: ${ctx.safeZone}. Nothing to brace for.`,
    };
  }

  if (next.data === 'fog' && (prev === null || prev.data !== 'fog')) {
    return {
      key: 'fogStale',
      title: 'My picture’s gone foggy',
      body: `Last good numbers are from ${ctx.staleLabel} — 30 seconds fixes it.`,
    };
  }

  if (
    next.overlays.includes('milestone') &&
    (prev === null || !prev.overlays.includes('milestone'))
  ) {
    return {
      key: 'milestone',
      title: `${ctx.safeZone} buffer reached`,
      body: 'The boring miracle, on schedule.',
    };
  }

  return null;
}
