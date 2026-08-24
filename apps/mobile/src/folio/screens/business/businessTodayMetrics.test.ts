import { describe, expect, it } from 'vitest';
import type { BusinessInvoice } from '@folio/business-workspace';

import { invoicedInYearMinor } from './businessTodayMetrics';

function invoice(id: string, issuedOn: string, totalMinor: number): BusinessInvoice {
  return {
    id,
    clientId: `client-${id}`,
    clientName: 'Saved client',
    issuedOn,
    dueOn: issuedOn,
    totalMinor,
    paidMinor: 0,
    status: 'issued',
  };
}

describe('invoicedInYearMinor', () => {
  it('sums only saved invoices issued in the requested year', () => {
    expect(
      invoicedInYearMinor(
        [
          invoice('a', '2026-01-12', 12_500),
          invoice('b', '2026-08-04', 4_250),
          invoice('c', '2025-12-31', 99_000),
        ],
        2026,
      ),
    ).toBe(16_750);
  });

  it('returns zero for an empty or year-mismatched workspace', () => {
    expect(invoicedInYearMinor([], 2026)).toBe(0);
    expect(invoicedInYearMinor([invoice('a', '2025-01-01', 1_000)], 2026)).toBe(0);
  });
});
