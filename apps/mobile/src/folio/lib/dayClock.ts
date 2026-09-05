
/** Local calendar key used by date-driven surfaces and tests. */
export function localDayKey(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Delay until the next local midnight. Constructing the next day in local time keeps DST changes
 * correct; the result is clamped to one millisecond so fake/tick-heavy runtimes cannot spin. */
export function delayUntilNextLocalDay(date: Date): number {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return Math.max(1, next.getTime() - date.getTime());
}

/** UTC-midnight representation of the Date's local calendar day. Date-only engines in this app
 * slice UTC ISO strings; this anchor prevents a local midnight from becoming yesterday in BST or
 * another positive-offset timezone. */
export function utcMidnightForLocalDay(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}
