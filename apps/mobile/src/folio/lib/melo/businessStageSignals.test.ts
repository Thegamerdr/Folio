import { describe, expect, it } from 'vitest';

import { emptyBusinessOperationsState } from '@folio/business-workspace';

import { deriveBusinessMeloSignals } from './businessStageSignals';

describe('Business Melo stage signals', () => {
  it('keeps statutory filings separate from invoices and self-set obligations', () => {
    const business = {
      ...emptyBusinessOperationsState(),
      entity: {
        kind: 'ltd' as const,
        companyName: 'Melo Test Ltd',
        yearEnd: '2026-03-31',
        taxRegion: 'england-ni' as const,
        directors: [],
        shareholders: [],
        vat: { registered: false as const },
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      invoices: [
        {
          id: 'invoice-old',
          clientId: 'client',
          clientName: 'Client',
          issuedOn: '2026-05-01',
          dueOn: '2026-06-01',
          totalMinor: 100_000,
          paidMinor: 0,
          status: 'overdue' as const,
        },
      ],
      obligations: [
        {
          id: 'reminder',
          label: 'Self-set reminder',
          amountMinor: 1_000,
          cadence: 'monthly' as const,
          nextDue: '2026-07-18',
          category: 'other' as const,
        },
      ],
    };

    const result = deriveBusinessMeloSignals({
      business,
      runwayDays: 200,
      quietMode: false,
      cleanStreakWeeks: 4,
      now: new Date('2026-07-19T12:00:00.000Z'),
    });

    expect(result.stageInput.overdueInvoiceCount).toBe(1);
    expect(result.stageInput.overdueInvoice30DayCount).toBe(1);
    expect(result.stageInput.nextDeadlineDaysAway).toBeGreaterThan(100);
  });

  it('uses the next accrued VAT and CT liabilities for coverage', () => {
    const business = {
      ...emptyBusinessOperationsState(),
      entity: {
        kind: 'ltd' as const,
        companyName: 'Melo Test Ltd',
        yearEnd: '2026-03-31',
        taxRegion: 'england-ni' as const,
        directors: [],
        shareholders: [],
        vat: { registered: true as const, scheme: 'standard' as const },
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      ytdProfitMinor: 1_000_000,
      ctPotMinor: 190_000,
      vatPotMinor: 100_000,
      vatReturns: [
        {
          id: 'vat-current',
          periodStart: '2026-04-01',
          periodEnd: '2026-06-30',
          dueOn: '2026-08-07',
          box1OutputVatMinor: 120_000,
          box4InputVatMinor: 20_000,
          box6SalesExVatMinor: 600_000,
          box7PurchasesExVatMinor: 100_000,
        },
      ],
    };

    const result = deriveBusinessMeloSignals({
      business,
      runwayDays: 100,
      quietMode: false,
      cleanStreakWeeks: 0,
      now: new Date('2026-07-19T12:00:00.000Z'),
    });

    expect(result.stageInput.setAsideCoverage).toBe(1);
  });

  it('uses the current statutory MTD ITSA quarterly deadlines', () => {
    const business = {
      ...emptyBusinessOperationsState(),
      entity: {
        kind: 'sole-trader' as const,
        tradingName: 'Melo Test',
        taxRegion: 'england-ni' as const,
        studentLoanPlans: [],
        vat: { registered: false as const },
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    };

    const result = deriveBusinessMeloSignals({
      business,
      runwayDays: 100,
      quietMode: false,
      cleanStreakWeeks: 0,
      now: new Date('2026-07-19T12:00:00.000Z'),
    });

    expect(result.stageInput.nextDeadlineDaysAway).toBe(19);
  });
});
