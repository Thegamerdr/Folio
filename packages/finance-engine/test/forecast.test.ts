import { describe, expect, it } from 'vitest';

import {
  buildForecast,
  calculateAvailableBeforeNextIncome,
  calculateScenarioOutflowBoundary,
  consolidateAccounts,
  evaluateOverdueObligation,
  getAllWorkspacesPositionByDefault,
  getWorkspacePosition,
  runScenario,
} from '../src/index.js';

describe('source forecast vectors: boundary and certainty', () => {
  it('F001 calculates available before payday while preserving obligations and floor', () => {
    const forecast = calculateAvailableBeforeNextIncome({
      asOf: '2026-06-20',
      mode: 'expected',
      accounts: { main: 100000 },
      protectedFloorMinor: 10000,
      nextIncomeDate: '2026-06-26',
      occurrences: [
        {
          id: 'rent',
          date: '2026-06-22',
          amountMinor: -73500,
          certainty: 'confirmed',
          protected: true,
        },
        {
          id: 'utility',
          date: '2026-06-24',
          amountMinor: -9500,
          certainty: 'confirmed',
          protected: true,
        },
        { id: 'salary', date: '2026-06-26', amountMinor: 58500, certainty: 'user-confirmed' },
      ],
    });

    expect(forecast.availableBeforeNextIncomeMinor).toBe(7000);
    expect(forecast.minimumBeforeIncomeMinor).toBe(17000);
    expect(forecast.closingOnNextIncomeDateMinor).toBe(75500);
  });

  it('F005 excludes unconfirmed inferred income from an expected forecast', () => {
    const forecast = calculateAvailableBeforeNextIncome({
      asOf: '2026-06-20',
      mode: 'expected',
      accounts: { main: 40000 },
      protectedFloorMinor: 5000,
      nextIncomeDate: '2026-06-27',
      occurrences: [
        {
          id: 'essential',
          date: '2026-06-23',
          amountMinor: -35000,
          certainty: 'confirmed',
          protected: true,
        },
        { id: 'overtime', date: '2026-06-25', amountMinor: 20000, certainty: 'inferred' },
        { id: 'base-pay', date: '2026-06-27', amountMinor: 50000, certainty: 'user-confirmed' },
      ],
    });

    expect(forecast.availableBeforeNextIncomeMinor).toBe(0);
    expect(forecast.minimumBeforeIncomeMinor).toBe(5000);
    expect(forecast.excludedIds).toEqual(['overtime']);
    expect(forecast.closingOnNextIncomeDateMinor).toBe(55000);
  });

  it('F015 and F016 use intraperiod lows and same-day protected-outflow ordering', () => {
    const midPeriod = calculateAvailableBeforeNextIncome({
      accounts: { main: 100000 },
      protectedFloorMinor: 10000,
      nextIncomeDate: '2026-06-30',
      occurrences: [
        { id: 'large-bill', date: '2026-06-22', amountMinor: -85000, protected: true },
        { id: 'refund', date: '2026-06-25', amountMinor: 40000, certainty: 'user-confirmed' },
      ],
    });

    expect(midPeriod.minimumBeforeIncomeMinor).toBe(15000);
    expect(midPeriod.availableBeforeNextIncomeMinor).toBe(5000);
    expect(midPeriod.closingBeforeIncomeMinor).toBe(55000);

    const sameDay = buildForecast({
      accounts: { main: 10000 },
      protectedFloorMinor: 0,
      occurrences: [
        { id: 'rent', date: '2026-06-22', amountMinor: -15000, protected: true },
        { id: 'pay', date: '2026-06-22', amountMinor: 20000, certainty: 'user-confirmed' },
      ],
    });

    expect(sameDay.lowestMinor).toBe(-5000);
    expect(sameDay.closingMinor).toBe(15000);
  });

  it('F017 attributes boundary changes to the user-selected floor', () => {
    const variants = [
      { floorMinor: 0, expectedAvailableMinor: 30000 },
      { floorMinor: 10000, expectedAvailableMinor: 20000 },
      { floorMinor: 25000, expectedAvailableMinor: 5000 },
    ];

    for (const variant of variants) {
      const forecast = calculateAvailableBeforeNextIncome({
        accounts: { main: 60000 },
        protectedFloorMinor: variant.floorMinor,
        nextIncomeDate: '2026-06-24',
        occurrences: [{ id: 'bills', date: '2026-06-23', amountMinor: -30000, protected: true }],
      });

      expect(forecast.availableBeforeNextIncomeMinor).toBe(variant.expectedAvailableMinor);
    }
  });
});

describe('source forecast vectors: fact reconciliation and transfers', () => {
  it('F002 replaces a pending item with the posted transaction', () => {
    const forecast = buildForecast({
      asOf: '2026-06-20',
      mode: 'known',
      accounts: { main: 100000 },
      occurrences: [
        {
          id: 'pending-grocery',
          date: '2026-06-20',
          amountMinor: -5000,
          status: 'pending',
          replacedBy: 'posted-grocery',
          certainty: 'provider-reported',
        },
        {
          id: 'posted-grocery',
          date: '2026-06-21',
          amountMinor: -5000,
          status: 'posted',
          replaces: 'pending-grocery',
          certainty: 'confirmed',
        },
      ],
    });

    expect(forecast.countedIds).toEqual(['posted-grocery']);
    expect(forecast.closingMinor).toBe(95000);
  });

  it('F003 keeps linked account transfers neutral in consolidated cash flow', () => {
    const forecast = buildForecast({
      asOf: '2026-06-20',
      accounts: { current: 100000, savings: 20000 },
      occurrences: [
        {
          id: 'transfer-out',
          account: 'current',
          date: '2026-06-21',
          amountMinor: -30000,
          transferLink: 't1',
        },
        {
          id: 'transfer-in',
          account: 'savings',
          date: '2026-06-21',
          amountMinor: 30000,
          transferLink: 't1',
        },
      ],
    });

    expect(forecast.accountClosing).toEqual({ current: 70000, savings: 50000 });
    expect(forecast.consolidatedClosingMinor).toBe(120000);
    expect(forecast.incomeMinor).toBe(0);
    expect(forecast.spendingMinor).toBe(0);
  });

  it('F004 counts the actual transaction and exposes expectation variance', () => {
    const forecast = buildForecast({
      asOf: '2026-06-22',
      accounts: { main: 100000 },
      expectations: [
        {
          id: 'rent-rule-occurrence',
          date: '2026-06-22',
          amountMinor: -73500,
          reference: 'RENT',
        },
      ],
      occurrences: [
        {
          id: 'rent-actual',
          date: '2026-06-22',
          amountMinor: -73800,
          status: 'posted',
          reference: 'RENT',
          certainty: 'confirmed',
          fulfils: 'rent-rule-occurrence',
        },
      ],
    });

    expect(forecast.countedIds).toEqual(['rent-actual']);
    expect(forecast.closingMinor).toBe(26200);
    expect(forecast.varianceMinor).toBe(-300);
    expect(forecast.questionType).toBe('recurring_amount_variance');
  });

  it('F014 keeps both reversal rows while neutralising the net movement', () => {
    const forecast = buildForecast({
      accounts: { main: 100000 },
      occurrences: [
        { id: 'charge', date: '2026-06-20', amountMinor: -12000, status: 'posted' },
        {
          id: 'reversal',
          date: '2026-06-22',
          amountMinor: 12000,
          status: 'posted',
          reversalOf: 'charge',
        },
      ],
    });

    expect(forecast.closingMinor).toBe(100000);
    expect(forecast.spendingNetMinor).toBe(0);
    expect(forecast.countedIds).toEqual(['charge', 'reversal']);
  });
});

describe('source forecast vectors: workspace, FX, overdue, and scenarios', () => {
  it('F007 keeps an overdue unpaid obligation visible', () => {
    expect(
      evaluateOverdueObligation({
        asOf: '2026-06-20',
        accounts: { main: 30000 },
        protectedFloorMinor: 5000,
        expectations: [
          {
            id: 'bill',
            date: '2026-06-18',
            amountMinor: -10000,
            certainty: 'confirmed',
            protected: true,
            fulfilled: false,
          },
        ],
      }),
    ).toEqual({
      eventState: 'missed',
      effectiveForecastDate: '2026-06-20',
      availableMinor: 15000,
      severity: 'important',
    });
  });

  it('requires the adapter to supply the financial as-of date', () => {
    expect(() =>
      evaluateOverdueObligation({
        accounts: { main: 30000 },
        expectations: [],
      } as unknown as Parameters<typeof evaluateOverdueObligation>[0]),
    ).toThrow(/explicit asOf date/);
  });

  it('F008 keeps workspace positions isolated by default', () => {
    const workspaces = {
      personal: { accounts: { p: 100000 } },
      business: { accounts: { b: 200000 } },
    };

    expect(getWorkspacePosition({ workspaces, workspaceId: 'personal' })).toBe(100000);
    expect(getWorkspacePosition({ workspaces, workspaceId: 'business' })).toBe(200000);
    expect(getAllWorkspacesPositionByDefault()).toEqual({
      available: false,
      reason: 'workspace_scope_required',
    });
  });

  it('F009 refuses silent multi-currency sums and converts only with an explicit rate', () => {
    const accounts = {
      gbp: { minor: 100000, currency: 'GBP' },
      eur: { minor: 50000, currency: 'EUR' },
    };

    expect(consolidateAccounts({ accounts, baseCurrency: 'GBP' })).toEqual({
      consolidated: null,
      reason: 'conversion_required',
      currencies: ['GBP', 'EUR'],
    });
    expect(
      consolidateAccounts({
        accounts,
        baseCurrency: 'GBP',
        rates: [{ from: 'EUR', to: 'GBP', rate: '0.850000', rateAt: '2026-06-20T12:00:00Z' }],
      }),
    ).toEqual({
      consolidated: 142500,
      currency: 'GBP',
      rateAt: '2026-06-20T12:00:00Z',
    });
  });

  it('F006 finds a maximum debt-payment outflow without choosing for the user', () => {
    expect(
      calculateScenarioOutflowBoundary({
        asOf: '2026-06-20',
        accounts: { main: 80000 },
        protectedFloorMinor: 20000,
        nextIncomeDate: '2026-06-27',
        occurrences: [
          {
            id: 'known-bills',
            date: '2026-06-24',
            amountMinor: -40000,
            certainty: 'confirmed',
            protected: true,
          },
        ],
        scenario: {
          date: '2026-06-20',
          amountMinor: -30000,
        },
      }),
    ).toEqual({
      scenarioSafe: false,
      shortfallToFloorMinor: 10000,
      maximumScenarioOutflowMinor: 20000,
    });
  });

  it('F018 keeps hypothetical changes isolated from the actual forecast', () => {
    const result = runScenario({
      base: { accounts: { main: 100000 } },
      changes: [{ id: 's1-change', date: '2026-06-21', amountMinor: -25000 }],
    });

    expect(result.actual.closingMinor).toBe(100000);
    expect(result.scenario.closingMinor).toBe(75000);
    expect(result.closingDeltaMinor).toBe(-25000);
    expect(result.domainTransactionCreated).toBe(false);
  });
});
