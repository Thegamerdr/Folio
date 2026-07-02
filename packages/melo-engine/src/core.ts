/**
 * Melo engine core primitives — deterministic, dependency-free.
 * Money is integer pence. Dates are ISO `YYYY-MM-DD` strings compared via epoch-day math,
 * so the engine has no clock, no timezone, and no randomness: same inputs, same answer, forever.
 * Spec: MELO_BLUEPRINT.md §2 P1 (Safe Zone), §4 (states). Display rounding is always in the
 * user's favour: safe amounts round DOWN, shortfalls round UP (Math.floor does both).
 */

export const meloEngineBoundary = {
  packageName: '@folio/melo-engine',
  deterministic: true,
  importsNativeOrUiRuntime: false,
  importsDatabaseDriver: false,
  schedulesNotifications: false,
} as const;

export type Pence = number;
export type ISODate = string; // YYYY-MM-DD

export function assertPence(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} must be integer pence, got ${value}`);
  }
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function toEpochDay(date: ISODate): number {
  const m = ISO_RE.exec(date);
  if (!m) throw new Error(`invalid ISO date: ${date}`);
  const epochMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return epochMs / MS_PER_DAY;
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = new Date((toEpochDay(date) + days) * MS_PER_DAY);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Whole pounds, rounded down (negative amounts round away from zero — conservatively worse). */
export function floorToPounds(pence: Pence): number {
  return Math.floor(pence / 100);
}

/** "£184" / "−£24" — the display convention: under-promise, never over-promise. */
export function formatPounds(pence: Pence): string {
  const pounds = floorToPounds(pence);
  return pounds < 0 ? `−£${Math.abs(pounds)}` : `£${pounds}`;
}
