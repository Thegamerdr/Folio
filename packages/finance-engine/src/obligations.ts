import { createLocalDate, type ObligationResolution } from '@folio/domain';

/** A resolution belongs to exactly one dated occurrence, never to the whole recurrence. */
export type { ObligationResolution } from '@folio/domain';

export function remainingObligationMinor(
  amountMinor: number,
  resolution?: ObligationResolution,
): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0)
    throw new Error('Obligation amount must be a non-negative safe integer.');
  const faceAmount = resolution?.amountMinor ?? amountMinor;
  if (!Number.isSafeInteger(faceAmount) || faceAmount < 0)
    throw new Error('Original obligation amount must be a non-negative safe integer.');
  const paid = resolution?.paidMinor ?? 0;
  if (!Number.isSafeInteger(paid) || paid < 0)
    throw new Error('Paid obligation amount must be a non-negative safe integer.');
  if (
    resolution?.status &&
    !['unpaid', 'partial', 'paid', 'settled', 'cancelled'].includes(resolution.status)
  )
    throw new Error('Unknown obligation resolution.');
  if (
    resolution?.status === 'paid' ||
    resolution?.status === 'settled' ||
    resolution?.status === 'cancelled'
  )
    return 0;
  return Math.max(0, faceAmount - paid);
}

/**
 * Expand from the durable first tracked due date, preserving every unresolved occurrence.
 * Calendar passage never supplies evidence of payment. `through` limits future forecasting;
 * deliberately no `from` filter can discard an older unpaid occurrence.
 */
export function expandObligationOccurrences(
  input: Readonly<{
    anchor: string;
    through: string;
    amountMinor: number;
    periodDays?: number;
    dayOfMonth?: number;
    resolutions?: Readonly<Record<string, ObligationResolution>>;
  }>,
): Readonly<{ date: string; amountMinor: number }>[] {
  const anchor = createLocalDate(input.anchor);
  const through = createLocalDate(input.through);
  remainingObligationMinor(input.amountMinor);
  const period = input.periodDays;
  if (period !== undefined && (!Number.isSafeInteger(period) || period <= 0))
    throw new Error('Obligation recurrence must have a positive whole-day period.');
  const originalDay = input.dayOfMonth ?? Number(anchor.slice(8, 10));
  if (!Number.isSafeInteger(originalDay) || originalDay < 1 || originalDay > 31)
    throw new Error('Obligation monthly day must be between 1 and 31.');
  const result: { date: string; amountMinor: number }[] = [];
  // A schedule correction can move its future anchor. Explicit older occurrences retain their
  // original dates/amounts and remain due until the corresponding resolution says otherwise.
  for (const [date, resolution] of Object.entries(input.resolutions ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    createLocalDate(date);
    if (date >= anchor || date > through) continue;
    const remaining = remainingObligationMinor(input.amountMinor, resolution);
    if (remaining > 0) result.push({ date, amountMinor: remaining });
  }
  for (let occurrence = 0; occurrence <= 36_600; occurrence += 1) {
    let date: string;
    if (occurrence === 0) {
      date = anchor;
    } else if (period !== undefined) {
      date = new Date(Date.parse(`${anchor}T00:00:00Z`) + occurrence * period * 86_400_000)
        .toISOString()
        .slice(0, 10);
    } else {
      const month = Number(anchor.slice(5, 7)) - 1 + occurrence;
      const year = Number(anchor.slice(0, 4)) + Math.floor(month / 12);
      const targetMonth = month % 12;
      const day = Math.min(originalDay, new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate());
      date = `${year}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    if (date > through) return result;
    const remaining = remainingObligationMinor(input.amountMinor, input.resolutions?.[date]);
    if (remaining > 0) result.push({ date, amountMinor: remaining });
  }
  throw new Error('Obligation recurrence exceeds the supported 100-year daily history.');
}
