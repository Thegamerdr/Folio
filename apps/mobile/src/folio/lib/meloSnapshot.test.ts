import { beforeEach, describe, expect, it } from 'vitest';

import { buildMeloSnapshot } from './meloSnapshot';
import { routeFromStore } from './storeRoute';
import {
  createEmptyWorkspacePartition,
  getState,
  purgeSeedIfReal,
  resetAll,
  setOnboarding,
  setPartial,
} from '../store';
import { createBusinessWorkspace, createPersonalWorkspaceRoot } from './workspaceRoot';

const NOW = '2026-06-10';

beforeEach(() => {
  resetAll();
});

describe('buildMeloSnapshot privacy boundary', () => {
  it('does not expose rich identity or transaction data', () => {
    setPartial({
      currentBalance: {
        amount: 720,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW,
      },
    });

    const snapshot = buildMeloSnapshot(getState(), 'calm', NOW);
    const serialized = JSON.stringify(snapshot);

    expect(Object.keys(snapshot).sort()).toEqual(
      [
        'accountCount',
        'activeRecurringCount',
        'activeSubscriptionMonthlyMinor',
        'availableNowMinor',
        'currency',
        'debtCount',
        'goalCount',
        'goalSavedMinor',
        'goalTargetMinor',
        'hasMoneyPicture',
        'incomeSourceCount',
        'irregularIncomeMode',
        'liabilityAccountCount',
        'monthlyDebtMinimumMinor',
        'monthlyIncomeMinor',
        'monthlyOutgoingsMinor',
        'nextCalendarDate',
        'nextPaydayLabel',
        'pendingReviewCount',
        'protectedItems',
        'subscriptionCount',
        'tightestBalanceMinor',
        'tightestDay',
        'totalDebtMinor',
        'unseenChangeCount',
        'upcomingCalendarCount',
        'workspaceKind',
      ].sort(),
    );
    for (const forbidden of [
      '"merchant":',
      '"lastFewTransactions":',
      '"recentSpend":',
      '"subscriptions":',
      '"pots":',
      '"name":',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('uses the same live route and converts pound values to integer pence', () => {
    setPartial({
      currentBalance: {
        amount: 720,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW,
      },
    });
    const state = getState();
    const route = routeFromStore(purgeSeedIfReal(state), NOW);
    const snapshot = buildMeloSnapshot(state, 'calm', NOW);

    expect(snapshot.hasMoneyPicture).toBe(true);
    expect(snapshot.tightestBalanceMinor).toBe(Math.round(route.tightPoint.amount * 100));
    expect(Number.isInteger(snapshot.availableNowMinor)).toBe(true);
  });

  it('tracks the live payday instead of a frozen prototype value', () => {
    setPartial({
      currentBalance: {
        amount: 720,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW,
      },
    });
    const before = buildMeloSnapshot(getState(), 'calm', NOW);
    setOnboarding({ payday: 12 });
    const after = buildMeloSnapshot(getState(), 'calm', NOW);

    expect(after.nextPaydayLabel).not.toBe(before.nextPaydayLabel);
    expect(after.nextPaydayLabel).toMatch(/^[A-Z][a-z]+,? \d{1,2} [A-Z][a-z]{2}$/);
    expect(after.nextPaydayLabel).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('never feeds seeded sample money to Melo as user truth', () => {
    const snapshot = buildMeloSnapshot(getState(), 'calm', NOW);

    expect(snapshot.hasMoneyPicture).toBe(false);
    expect(snapshot.availableNowMinor).toBe(0);
    expect(snapshot.tightestBalanceMinor).toBe(0);
    expect(snapshot.monthlyIncomeMinor).toBe(0);
    expect(snapshot.monthlyOutgoingsMinor).toBe(0);
    expect(snapshot.activeSubscriptionMonthlyMinor).toBe(0);
    expect(snapshot.subscriptionCount).toBe(0);
    expect(snapshot.debtCount).toBe(0);
    expect(snapshot.totalDebtMinor).toBe(0);
    expect(snapshot.goalCount).toBe(0);
    expect(snapshot.goalSavedMinor).toBe(0);
    expect(snapshot.goalTargetMinor).toBe(0);
    expect(snapshot.upcomingCalendarCount).toBe(0);
    expect(snapshot.nextPaydayLabel).toBe('not set up yet');
  });

  it('counts every local review queue without exposing its rows', () => {
    setPartial({
      currentBalance: {
        amount: 720,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW,
      },
      readerCandidates: [
        {
          id: 'candidate-private',
          source: 'pdf',
          kind: 'spend',
          date: NOW,
          merchant: 'Private merchant',
          amount: -12,
          category: 'other',
          confidence: 'medium',
        },
      ],
      reviewQueue: [
        {
          id: 'review-private',
          merchant: 'Another private merchant',
          amount: -20,
          category: 'other',
          date: NOW,
          source: 'pdf',
          addedAt: `${NOW}T00:00:00.000Z`,
        },
      ],
      reviewQueueSpillover: [],
    });

    const snapshot = buildMeloSnapshot(getState(), 'calm', NOW);
    expect(snapshot.pendingReviewCount).toBe(2);
    expect(JSON.stringify(snapshot)).not.toContain('Private merchant');
    expect(JSON.stringify(snapshot)).not.toContain('Another private merchant');
  });

  it('derives debt, goal, recurring, calendar and irregular-income aggregates from real rows only', () => {
    setPartial({
      currentBalance: {
        amount: 720,
        source: 'user-entered',
        confidence: 'rough',
        setAt: NOW,
      },
      debts: [
        {
          id: 'debt-real',
          name: 'Private debt name',
          kind: 'loan',
          balance: 4_800,
          apr: 9,
          minPayment: 180,
          dueDom: 18,
          addedAt: `${NOW}T00:00:00.000Z`,
        },
      ],
      pots: [
        {
          id: 'pot-real',
          name: 'Private pot name',
          saved: 750,
          goal: 3_000,
          perWeek: 25,
          accent: true,
        },
      ],
      plans: [],
      subs: [
        {
          name: 'Private recurring name',
          cost: 42,
          nextRenewalDaysAway: 3,
          lastUsedDaysAgo: 0,
          usesPerMonth: 1,
        },
      ],
      subPaused: {},
      incomeSources: [
        {
          id: 'income-real',
          label: 'Private income source',
          cadence: 'weekly',
          anchorISO: '2026-06-05',
          amount: 500,
          source: 'manual',
        },
      ],
      moneyMode: 'irregular',
      calendarEvents: [
        {
          id: 'calendar-real',
          date: '2026-06-12',
          kind: 'out',
          title: 'Private calendar title',
          amount: -30,
        },
      ],
    });

    const snapshot = buildMeloSnapshot(getState(), 'calm', NOW);
    expect(snapshot).toMatchObject({
      activeRecurringCount: 1,
      activeSubscriptionMonthlyMinor: 4_200,
      debtCount: 1,
      totalDebtMinor: 480_000,
      monthlyDebtMinimumMinor: 18_000,
      goalCount: 1,
      goalSavedMinor: 75_000,
      goalTargetMinor: 300_000,
      incomeSourceCount: 1,
      irregularIncomeMode: true,
    });
    expect(snapshot.upcomingCalendarCount).toBeGreaterThan(0);
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('Private debt name');
    expect(serialized).not.toContain('Private pot name');
    expect(serialized).not.toContain('Private recurring name');
    expect(serialized).not.toContain('Private income source');
    expect(serialized).not.toContain('Private calendar title');
  });

  it('is stable for the same state and injected date', () => {
    const state = getState();
    expect(buildMeloSnapshot(state, 'calm', NOW)).toEqual(buildMeloSnapshot(state, 'calm', NOW));
  });

  it('builds Business-only cash aggregates without Personal payday semantics or row details', () => {
    const personal = createPersonalWorkspaceRoot().workspaces[0]!;
    const business = createBusinessWorkspace({
      id: 'workspace_business_snapshot',
      name: 'Private trading name',
      encryptedSubkeyId: 'workspace-subkey-business-snapshot-v1',
    });
    const root = {
      workspaces: [personal, business],
      activeWorkspaceId: business.id,
      dataWorkspaceId: business.id,
    } as const;
    const empty = createEmptyWorkspacePartition(root, business.id, '2026-06-01T00:00:00.000Z');
    const state = {
      ...empty,
      accounts: [
        {
          id: 'business-account-private',
          workspaceId: business.id,
          name: 'Private business account name',
          kind: 'bank' as const,
          isLiability: false,
          balanceMinor: 1_500,
          balanceAsOfISO: '2026-06-10T00:00:00.000Z',
          addedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      transactions: [
        {
          id: 'business-transaction-private',
          workspaceId: business.id,
          when: '2026-06-08T00:00:00.000Z',
          merchant: 'Private client name',
          amount: 400,
          category: 'income' as const,
          source: 'manual' as const,
          accountId: 'business-account-private',
        },
      ],
      calendarEvents: [
        {
          id: 'business-commitment-private',
          workspaceId: business.id,
          date: '2026-06-15',
          kind: 'out' as const,
          title: 'Private supplier name',
          amount: -300,
        },
      ],
    };

    const snapshot = buildMeloSnapshot(state, 'calm', NOW, business.id);
    expect(snapshot).toMatchObject({
      workspaceKind: 'business',
      hasMoneyPicture: true,
      businessCashBalanceMinor: 150_000,
      businessUpcomingCommitmentsMinor: 30_000,
      businessProjectedCashMinor: 120_000,
      businessConfirmedIncome30DaysMinor: 40_000,
      nextPaydayLabel: 'not set up yet',
    });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('Private trading name');
    expect(serialized).not.toContain('Private business account name');
    expect(serialized).not.toContain('Private client name');
    expect(serialized).not.toContain('Private supplier name');
  });

  it('adds aggregate-only invoice, VAT, tax, payroll, client and filing context for local Business Melo', () => {
    const personal = createPersonalWorkspaceRoot().workspaces[0]!;
    const business = createBusinessWorkspace({
      id: 'workspace_business_operations_snapshot',
      name: 'Private operations company',
      encryptedSubkeyId: 'workspace-subkey-business-operations-snapshot-v1',
    });
    const root = {
      workspaces: [personal, business],
      activeWorkspaceId: business.id,
      dataWorkspaceId: business.id,
    } as const;
    const empty = createEmptyWorkspacePartition(root, business.id, '2026-06-01T00:00:00.000Z');
    const state = {
      ...empty,
      accounts: [
        {
          id: 'business-account-operations',
          workspaceId: business.id,
          name: 'Private operating account',
          kind: 'bank' as const,
          isLiability: false,
          balanceMinor: 5_000,
          balanceAsOfISO: '2026-06-10T00:00:00.000Z',
          addedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      business: {
        entity: {
          kind: 'ltd' as const,
          companyName: 'Private Legal Name Ltd',
          yearEnd: '2026-12-31',
          taxRegion: 'england-ni' as const,
          directors: [],
          shareholders: [],
          vat: { registered: true as const, scheme: 'standard' as const },
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        clients: [
          {
            id: 'client-private',
            name: 'Private Client Ltd',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        invoices: [
          {
            id: 'invoice-private',
            clientId: 'client-private',
            clientName: 'Private Client Ltd',
            issuedOn: '2026-04-01',
            dueOn: '2026-05-01',
            totalMinor: 240_000,
            paidMinor: 40_000,
            status: 'overdue' as const,
          },
        ],
        obligations: [
          {
            id: 'obligation-private',
            label: 'Private software supplier',
            amountMinor: 30_000,
            cadence: 'monthly' as const,
            nextDue: '2026-06-20',
            category: 'software' as const,
          },
        ],
        employees: [
          {
            id: 'employee-private',
            name: 'Private employee',
            grossAnnualMinor: 3_000_000,
            studentLoanPlans: [],
          },
        ],
        payrollRuns: [],
        dividends: [],
        dla: [],
        vatReturns: [
          {
            id: 'vat-private',
            periodStart: '2026-04-01',
            periodEnd: '2026-06-30',
            dueOn: '2026-08-07',
            box1OutputVatMinor: 60_000,
            box4InputVatMinor: 10_000,
            box6SalesExVatMinor: 300_000,
            box7PurchasesExVatMinor: 50_000,
          },
        ],
        mileageTrips: [],
        taxAdjustments: [],
        homeOfficeConfigs: [],
        ir35Assessments: [],
        recurringInvoices: [],
        filings: [],
        memory: [],
        basisPeriodTransition: null,
        ytdProfitMinor: 10_000_000,
        ctPotMinor: 1_000_000,
        vatPotMinor: 25_000,
        employmentAllowanceClaimed: false,
        policyPackVersion: 'uk-business-2026-27.v1',
        policyVerifiedOn: '2026-07-18',
      },
    };

    const snapshot = buildMeloSnapshot(state, 'calm', NOW, business.id);
    expect(snapshot).toMatchObject({
      businessEntityKind: 'ltd',
      businessClientCount: 1,
      businessOutstandingInvoicesMinor: 200_000,
      businessOverdueInvoicesMinor: 200_000,
      businessOverdueInvoiceCount: 1,
      businessVatRegistered: true,
      businessVatDueMinor: 50_000,
      businessVatPotMinor: 25_000,
      businessTaxPotMinor: 1_000_000,
      businessEmployeeCount: 1,
    });
    expect(snapshot.businessTaxEstimateMinor).toBeGreaterThan(0);
    expect(snapshot.businessOpenFilingCount).toBeGreaterThan(0);
    expect(snapshot.businessUpcomingCommitmentsMinor).toBe(30_000);
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toMatch(
      /Private (operations company|Legal Name|Client|operating account|software supplier|employee)/,
    );
  });

  it('refuses to build a Personal snapshot after a crafted Business workspace switch', () => {
    const state = {
      ...getState(),
      activeWorkspaceId: 'workspace_business_injected' as ReturnType<
        typeof getState
      >['activeWorkspaceId'],
    };

    expect(() => buildMeloSnapshot(state, 'calm', NOW)).toThrow(/unavailable/);
  });
});
