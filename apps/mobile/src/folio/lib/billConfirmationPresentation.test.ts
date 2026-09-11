import { describe, expect, it } from 'vitest';
import { canConfirmBillOccurrence } from './billConfirmationPresentation';

describe('paid bill confirmation actions', () => {
  it('does not offer another confirmation for a paid occurrence or its future successor', () => {
    expect(
      canConfirmBillOccurrence({
        occurrenceDate: '2026-09-12',
        latestPaidDate: '2026-09-12',
        today: '2026-09-13',
      }),
    ).toBe(false);
    expect(
      canConfirmBillOccurrence({
        occurrenceDate: '2026-10-12',
        latestPaidDate: '2026-09-12',
        today: '2026-09-13',
      }),
    ).toBe(false);
    expect(
      canConfirmBillOccurrence({
        occurrenceDate: '2026-09-12',
        occurrenceStatus: 'paid',
        today: '2026-09-13',
      }),
    ).toBe(false);
  });
  it('restores the action for the next due occurrence or after undoing the only confirmation', () => {
    expect(
      canConfirmBillOccurrence({
        occurrenceDate: '2026-10-12',
        latestPaidDate: '2026-09-12',
        today: '2026-10-12',
      }),
    ).toBe(true);
    expect(canConfirmBillOccurrence({ occurrenceDate: '2026-09-12', today: '2026-09-09' })).toBe(
      true,
    );
  });
});
