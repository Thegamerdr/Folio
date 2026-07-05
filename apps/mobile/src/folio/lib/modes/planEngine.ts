/**
 * planEngine — pure helpers for the Planning lens.
 *
 * RN port of folio-melo (design-main) `src/lib/modes/planEngine.ts`, verbatim.
 *
 * The Planning lens compares two things per Plan:
 *   • how many weeks the user has until `byDate` (weeksAvailable), and
 *   • how many weeks the current cadence needs to finish (weeksAtPace).
 *
 * A plan is `onTrack` when `weeksAtPace <= weeksAvailable`. Required
 * per-week is `remaining / weeksAvailable` — the honest number the UI
 * shows when the user is short.
 */
import type { Plan } from '../../store';

export type PlanProgress = {
  plan: Plan;
  remaining: number;
  /** Whole weeks between now and byDate. Never negative. */
  weeksAvailable: number;
  /** Weeks needed at current cadence. Null when cadence is 0. */
  weeksAtPace: number | null;
  /** £/week needed to hit the target by `byDate`. Infinity if 0 weeks left. */
  requiredPerWeek: number;
  /** True when current cadence finishes on or before `byDate`. */
  onTrack: boolean;
  /** Whole days until byDate. Negative when in the past. */
  daysUntil: number;
  /** Progress ratio 0..1. */
  progress: number;
};

export type PlansSummary = {
  progresses: PlanProgress[];
  /** Most urgent plan (soonest byDate that isn't already funded).
   *  Null when the user has no active plans. */
  focus: PlanProgress | null;
  totalTarget: number;
  totalSaved: number;
};

const DAY = 86_400_000;

export function planProgress(plan: Plan, now: Date = new Date()): PlanProgress {
  const remaining = Math.max(0, plan.target - plan.saved);
  const byMs = new Date(plan.byDate + 'T00:00:00').getTime();
  const daysUntil = Math.ceil((byMs - now.getTime()) / DAY);
  const weeksAvailable = Math.max(0, Math.ceil(daysUntil / 7));
  const weeksAtPace =
    plan.perWeek > 0 && remaining > 0
      ? Math.ceil(remaining / plan.perWeek)
      : plan.perWeek > 0
        ? 0
        : null;
  const requiredPerWeek = weeksAvailable > 0 ? remaining / weeksAvailable : Infinity;
  const onTrack = weeksAtPace !== null && weeksAtPace <= weeksAvailable;
  const progress = plan.target > 0 ? Math.max(0, Math.min(1, plan.saved / plan.target)) : 0;
  return {
    plan,
    remaining,
    weeksAvailable,
    weeksAtPace,
    requiredPerWeek,
    onTrack,
    daysUntil,
    progress,
  };
}

export function summarisePlans(plans: Plan[], now: Date = new Date()): PlansSummary {
  const progresses = plans.map((p) => planProgress(p, now));
  const active = progresses.filter((p) => p.remaining > 0);
  const focus =
    active.slice().sort((a, b) => a.daysUntil - b.daysUntil)[0] ?? progresses[0] ?? null;
  const totalTarget = plans.reduce((s, p) => s + Math.max(0, p.target), 0);
  const totalSaved = plans.reduce((s, p) => s + Math.max(0, p.saved), 0);
  return { progresses, focus, totalTarget, totalSaved };
}

/** Short "in N d / N w / N mo" caption for a plan due date. */
export function daysUntilLabel(days: number): string {
  if (days < 0) return 'past';
  if (days === 0) return 'today';
  if (days === 1) return '1 d';
  if (days < 14) return `${days} d`;
  const weeks = Math.round(days / 7);
  if (weeks < 10) return `${weeks} wk`;
  const months = Math.round(days / 30);
  return `${months} mo`;
}
