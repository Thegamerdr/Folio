/** Confirmation actions must identify the actual unpaid occurrence, never the paid one. */
export function canConfirmBillOccurrence(input: {
  occurrenceDate: string;
  occurrenceStatus?: string | undefined;
  latestPaidDate?: string | undefined;
  today: string;
}): boolean {
  if (input.occurrenceStatus === 'paid') return false;
  if (input.latestPaidDate === input.occurrenceDate) return false;
  // Once this cycle is settled, keep the next future bill informational until it is due.
  return input.latestPaidDate === undefined || input.occurrenceDate <= input.today;
}
