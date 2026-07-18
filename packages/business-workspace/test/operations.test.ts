import { describe, expect, it } from 'vitest';

import {
  UK_BUSINESS_POLICY_2026_27,
  analyseVatSchemes,
  calculateBusinessRunway,
  calculateLateCommercialPaymentClaim,
  calculateVatBoxes,
  corporationTaxMinor,
  distributableReservesMinor,
  dividendTaxMinor,
  emptyBusinessOperationsState,
  generateDueRecurringInvoices,
  homeOfficeConfigMinor,
  homeOfficeFullMinor,
  homeOfficeSimplifiedMinor,
  mileageAllowanceMinor,
  previewPayrollRun,
  basisPeriodTransitionSliceMinor,
  selfAssessmentIncomeTaxMinor,
  selfEmployedNiMinor,
  selectBusinessOneMove,
  studentLoanRepaymentMinor,
  totalOutstandingInvoicesMinor,
} from '../src/index.js';

describe('2026/27 Business operations', () => {
  it('pins the policy pack and official current headline thresholds', () => {
    expect(UK_BUSINESS_POLICY_2026_27).toMatchObject({
      taxYear: '2026/27',
      verifiedOn: '2026-07-18',
      personalAllowanceMinor: 1_257_000,
      dividendAllowanceMinor: 50_000,
      vatRegistrationThresholdMinor: 9_000_000,
    });
    expect(UK_BUSINESS_POLICY_2026_27.studentLoan).toMatchObject({
      '1': { thresholdMinor: 2_690_000, rateBasisPoints: 900 },
      '2': { thresholdMinor: 2_938_500, rateBasisPoints: 900 },
      '4': { thresholdMinor: 3_379_500, rateBasisPoints: 900 },
      '5': { thresholdMinor: 2_500_000, rateBasisPoints: 900 },
      postgrad: { thresholdMinor: 2_100_000, rateBasisPoints: 600 },
    });
  });

  it('calculates Corporation Tax across the small, marginal and main bands', () => {
    expect(corporationTaxMinor(4_000_000)).toBe(760_000);
    expect(corporationTaxMinor(10_000_000)).toBe(2_275_000);
    expect(corporationTaxMinor(30_000_000)).toBe(7_500_000);
  });

  it('keeps invoice cash and recurring obligations in one honest runway', () => {
    const state = {
      ...emptyBusinessOperationsState(),
      invoices: [
        {
          id: 'invoice-1',
          clientId: 'client-1',
          clientName: 'Acme',
          issuedOn: '2026-07-01',
          dueOn: '2026-07-25',
          totalMinor: 200_000,
          paidMinor: 50_000,
          status: 'part-paid' as const,
        },
      ],
      obligations: [
        {
          id: 'obligation-1',
          label: 'Studio',
          amountMinor: 90_000,
          cadence: 'monthly' as const,
          nextDue: '2026-07-20',
          category: 'rent' as const,
        },
      ],
    };
    const runway = calculateBusinessRunway(
      state,
      [{ balanceMinor: 600_000, isLiability: false }],
      new Date('2026-07-18T12:00:00.000Z'),
    );
    expect(totalOutstandingInvoicesMinor(state)).toBe(150_000);
    expect(runway).toMatchObject({
      cashMinor: 600_000,
      incoming30Minor: 150_000,
      outgoing30Minor: 90_000,
      dailyBurnMinor: 0,
      daysLeft: null,
    });
    expect(runway.forecast.find((point) => point.date === '2026-07-20')?.deltaMinor).toBe(-90_000);
    expect(runway.forecast.find((point) => point.date === '2026-07-25')?.deltaMinor).toBe(150_000);
  });

  it('calculates the statutory B2B late-payment working figure without changing the invoice', () => {
    const invoice = {
      id: 'invoice-late',
      clientId: 'client-1',
      clientName: 'Acme',
      issuedOn: '2026-05-01',
      dueOn: '2026-06-01',
      totalMinor: 250_000,
      paidMinor: 50_000,
      status: 'overdue' as const,
    };
    const claim = calculateLateCommercialPaymentClaim(invoice, new Date('2026-07-01T12:00:00Z'));
    expect(claim).toMatchObject({
      eligibleBalanceMinor: 200_000,
      daysLate: 30,
      annualRateBasisPoints: 1_175,
      fixedCompensationMinor: 7_000,
      bankRateReferenceDate: '2026-06-30',
    });
    expect(claim.interestMinor).toBe(1_932);
    expect(claim.totalClaimMinor).toBe(8_932);
    expect(invoice.paidMinor).toBe(50_000);
  });

  it('materialises due recurring invoices once and advances the template', () => {
    const state = {
      ...emptyBusinessOperationsState(),
      recurringInvoices: [
        {
          id: 'retainer',
          clientId: 'client-1',
          clientName: 'Acme',
          amountMinor: 100_000,
          cadence: 'monthly' as const,
          nextIssueOn: '2026-06-01',
          daysToPay: 30,
          active: true,
        },
      ],
    };
    const generated = generateDueRecurringInvoices(state, new Date('2026-07-18T12:00:00Z'));
    expect(generated.invoices).toHaveLength(2);
    expect(generated.invoices.map((invoice) => invoice.id)).toEqual([
      'recurring:retainer:2026-06-01',
      'recurring:retainer:2026-07-01',
    ]);
    expect(generated.recurringInvoices[0]?.nextIssueOn).toBe('2026-08-01');
    expect(generateDueRecurringInvoices(generated, new Date('2026-07-18T12:00:00Z'))).toBe(
      generated,
    );
  });

  it('spreads the remaining basis-period transition profit over the years left', () => {
    const state = {
      ...emptyBusinessOperationsState(),
      basisPeriodTransition: { remainingMinor: 400_000, yearsLeft: 4 as const },
    };
    expect(basisPeriodTransitionSliceMinor(state)).toBe(100_000);
  });

  it('derives VAT boxes and preserves a reclaim as a signed box 5', () => {
    expect(
      calculateVatBoxes({
        id: 'vat-1',
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30',
        dueOn: '2026-08-07',
        box1OutputVatMinor: 100_000,
        box4InputVatMinor: 130_000,
        box6SalesExVatMinor: 500_000,
        box7PurchasesExVatMinor: 650_000,
      }),
    ).toMatchObject({
      box3Minor: 100_000,
      box5Minor: -30_000,
      box6Minor: 500_000,
      box7Minor: 650_000,
    });
  });

  it('compares VAT schemes from reviewed figures without changing the selected scheme', () => {
    const analysis = analyseVatSchemes({
      annualNetSalesMinor: 10_000_000,
      annualOutputVatMinor: 2_000_000,
      annualInputVatMinor: 100_000,
      flatRateBasisPoints: 1_250,
      limitedCostTrader: false,
      firstYear: false,
      unpaidSalesOutputVatMinor: 200_000,
      unpaidPurchasesInputVatMinor: 0,
    });
    expect(analysis.standard).toEqual({
      annualVatDueMinor: 1_900_000,
      effectiveRateBasisPoints: 1_900,
    });
    expect(analysis.flatRate).toMatchObject({
      annualVatDueMinor: 1_500_000,
      appliedRateBasisPoints: 1_250,
      eligible: true,
    });
    expect(analysis.cash).toMatchObject({
      annualVatDueMinor: 1_700_000,
      cashflowLiftMinor: 200_000,
      eligible: true,
    });
    expect(analysis.annual.monthlyInstalmentMinor).toBe(211_111);
    expect(analysis.recommendation).toBe('flat-rate');
  });

  it('applies the limited-cost and first-year Flat Rate rules explicitly', () => {
    const analysis = analyseVatSchemes({
      annualNetSalesMinor: 5_000_000,
      annualOutputVatMinor: 1_000_000,
      annualInputVatMinor: 0,
      limitedCostTrader: true,
      firstYear: true,
      unpaidSalesOutputVatMinor: 0,
      unpaidPurchasesInputVatMinor: 0,
    });
    expect(analysis.flatRate).toMatchObject({
      annualVatDueMinor: 930_000,
      appliedRateBasisPoints: 1_550,
      limitedCostTrader: true,
    });
  });

  it('compares simplified and apportioned home-office amounts in integer minor units', () => {
    const full = {
      roomsBusiness: 1,
      roomsTotal: 4,
      businessHoursPerWeek: 20,
      personalHoursPerWeek: 20,
      councilMinor: 180_000,
      utilitiesMinor: 240_000,
      rentMinor: 600_000,
      mortgageInterestMinor: 0,
      insuranceMinor: 120_000,
      cleaningMinor: 60_000,
    };
    expect(homeOfficeSimplifiedMinor(101, 12)).toBe(31_200);
    expect(homeOfficeFullMinor(full)).toBe(150_000);
    expect(
      homeOfficeConfigMinor(
        {
          taxYear: '2026/27',
          method: 'full',
          simplified: { monthlyHours: 101, months: 12, directorWeeks: 52 },
          full,
        },
        'sole-trader',
      ),
    ).toBe(150_000);
  });

  it('uses the 2026/27 income, NI, dividend and student-loan rates', () => {
    expect(selfAssessmentIncomeTaxMinor(5_027_000, 'england-ni')).toBe(754_000);
    expect(selfEmployedNiMinor(5_027_000)).toBe(226_200);
    expect(studentLoanRepaymentMinor(3_000_000, ['2'])).toBe(5_535);
    expect(studentLoanRepaymentMinor(3_000_000, ['2', 'postgrad'])).toBe(59_535);
    expect(dividendTaxMinor(100_000, 2_500_000)).toBe(5_375);
  });

  it('previews payroll without silently claiming Employment Allowance', () => {
    const employee = {
      id: 'employee-1',
      name: 'Sam',
      grossAnnualMinor: 3_000_000,
      studentLoanPlans: ['2' as const],
    };
    const withoutClaim = previewPayrollRun([employee], '2026-07-31', {
      region: 'england-ni',
      employmentAllowanceClaimed: false,
    });
    const withClaim = previewPayrollRun([employee], '2026-07-31', {
      region: 'england-ni',
      employmentAllowanceClaimed: true,
    });
    expect(withoutClaim.employerNiMinor).toBeGreaterThan(0);
    expect(withoutClaim.employmentAllowanceAppliedMinor).toBe(0);
    expect(withClaim.employmentAllowanceAppliedMinor).toBeGreaterThan(0);
    expect(withClaim.employerNiMinor).toBe(0);
  });

  it('caps dividends at retained profit after Corporation Tax and prior dividends', () => {
    const state = {
      ...emptyBusinessOperationsState(),
      ytdProfitMinor: 10_000_000,
      dividends: [
        {
          id: 'dividend-1',
          shareholderId: 'shareholder-1',
          declaredOn: '2026-06-30',
          totalMinor: 1_000_000,
          amountPerShareMinor: 10_000,
          otherIncomeMinor: 0,
        },
      ],
    };
    expect(distributableReservesMinor(state)).toBe(6_725_000);
  });

  it('applies the 45p then 25p mileage threshold using integer units', () => {
    expect(
      mileageAllowanceMinor([
        {
          id: 'trip-1',
          date: '2026-07-01',
          distanceMilliMiles: 12_000_000,
          vehicle: 'car',
          purpose: 'Client visit',
        },
      ]),
    ).toBe(500_000);
  });

  it('keeps the Business companion to one ranked move and never invents an empty picture', () => {
    const empty = selectBusinessOneMove(emptyBusinessOperationsState(), []);
    expect(empty).toMatchObject({
      kind: 'calm',
      headline: 'Nothing to read yet.',
      action: { target: 'account' },
    });

    const short = selectBusinessOneMove(
      {
        ...emptyBusinessOperationsState(),
        obligations: [
          {
            id: 'rent',
            label: 'Studio rent',
            amountMinor: 300_000,
            cadence: 'monthly',
            nextDue: '2026-07-20',
            category: 'rent',
          },
        ],
      },
      [{ balanceMinor: 100_000, isLiability: false }],
      new Date('2026-07-18T12:00:00.000Z'),
    );
    expect(short).toMatchObject({ kind: 'runway', action: { target: 'runway' } });
  });
});
