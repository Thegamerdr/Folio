/**
 * Deterministic Business acceptance data. This module is imported only by QA tests; it is not
 * referenced by the production shell and must never be promoted to an app default or seed.
 * Every tax figure is produced by @folio/business-workspace rather than copied into a fixture.
 */
import {
  emptyBusinessOperationsState,
  previewPayrollRun,
  type BusinessOperationsState,
  type CashAccountInput,
  type LtdEntity,
  type SoleTraderEntity,
} from '@folio/business-workspace';

export const BUSINESS_ACCEPTANCE_NOW = new Date('2026-07-18T12:00:00.000Z');

export type BusinessAcceptanceFixture = Readonly<{
  state: BusinessOperationsState;
  accounts: readonly CashAccountInput[];
}>;

const soleTraderEntity: SoleTraderEntity = {
  kind: 'sole-trader',
  tradingName: 'Northstar Studio',
  utr: '1234567890',
  taxRegion: 'england-ni',
  studentLoanPlans: ['2'],
  vat: {
    registered: true,
    scheme: 'standard',
    number: 'GB123456789',
    registeredAt: '2025-04-06',
  },
  createdAt: '2026-01-10T09:00:00.000Z',
};

const ltdEntity: LtdEntity = {
  kind: 'ltd',
  companyName: 'Harbour & Field Ltd',
  companyNumber: '12345678',
  incorporatedOn: '2022-08-01',
  yearEnd: '2026-03-31',
  taxRegion: 'england-ni',
  directors: [{ id: 'director-1', name: 'Alex Morgan', role: 'Director' }],
  shareholders: [{ id: 'shareholder-1', name: 'Alex Morgan', shares: 100 }],
  vat: {
    registered: true,
    scheme: 'standard',
    number: 'GB987654321',
    registeredAt: '2024-04-01',
  },
  payeRef: '123/AB456',
  accountsOfficeRef: '123PA00012345',
  createdAt: '2022-08-01T09:00:00.000Z',
};

function commonBusinessRows(entity: BusinessOperationsState['entity']): BusinessOperationsState {
  const client = {
    id: 'client-elm',
    name: 'Elm & Co',
    email: 'accounts@elm.example',
    createdAt: '2026-01-12T09:00:00.000Z',
  } as const;
  return {
    ...emptyBusinessOperationsState(),
    entity,
    clients: [client],
    invoices: [
      {
        id: 'invoice-paid',
        clientId: client.id,
        clientName: client.name,
        reference: 'JAN-001',
        issuedOn: '2026-01-10',
        dueOn: '2026-02-10',
        totalMinor: 200_000,
        paidMinor: 200_000,
        paidOn: '2026-02-04',
        status: 'paid',
      },
      {
        id: 'invoice-overdue',
        clientId: client.id,
        clientName: client.name,
        reference: 'JUN-014',
        issuedOn: '2026-06-01',
        dueOn: '2026-07-01',
        totalMinor: 450_000,
        paidMinor: 0,
        status: 'overdue',
      },
      {
        id: 'invoice-current',
        clientId: client.id,
        clientName: client.name,
        reference: 'JUL-015',
        issuedOn: '2026-07-02',
        dueOn: '2026-07-25',
        totalMinor: 180_000,
        paidMinor: 0,
        status: 'issued',
      },
    ],
    obligations: [
      {
        id: 'obligation-studio',
        label: 'Studio rent',
        amountMinor: 90_000,
        cadence: 'monthly',
        nextDue: '2026-07-20',
        category: 'rent',
      },
    ],
    vatReturns: [
      {
        id: 'vat-q1',
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30',
        dueOn: '2026-08-07',
        box1OutputVatMinor: 125_000,
        box4InputVatMinor: 45_000,
        box6SalesExVatMinor: 625_000,
        box7PurchasesExVatMinor: 225_000,
      },
    ],
    ytdProfitMinor: 5_027_000,
    vatPotMinor: 60_000,
    memory: [
      {
        id: 'memory-client',
        at: '2026-01-12T09:00:00.000Z',
        kind: 'first-client',
        summary: 'Elm & Co is the first saved client.',
        reflected: false,
      },
    ],
  };
}

export function soleTraderAcceptanceFixture(): BusinessAcceptanceFixture {
  return {
    state: {
      ...commonBusinessRows(soleTraderEntity),
      taxAdjustments: [
        {
          id: 'adjustment-home-office',
          date: '2026-07-01',
          kind: 'home-office',
          amountMinor: 31_200,
          note: 'Simplified home-office record',
        },
      ],
      filings: [
        {
          id: 'filing-sa-prepared',
          kind: 'self-assessment',
          period: '2025/26',
          preparedAt: '2026-07-10T09:00:00.000Z',
          policyPackVersion: 'uk-business-2026-27.v1',
          status: 'prepared',
        },
      ],
    },
    accounts: [{ balanceMinor: 600_000, isLiability: false, closed: false }],
  };
}

export function ltdAcceptanceFixture(): BusinessAcceptanceFixture {
  const employee = {
    id: 'employee-1',
    name: 'Alex Morgan',
    grossAnnualMinor: 3_000_000,
    studentLoanPlans: ['2' as const],
  };
  const payrollRun = previewPayrollRun([employee], '2026-07-31', {
    region: ltdEntity.taxRegion,
    employmentAllowanceClaimed: false,
    recordedAt: '2026-07-18T12:00:00.000Z',
  });
  return {
    state: {
      ...commonBusinessRows(ltdEntity),
      employees: [employee],
      payrollRuns: [payrollRun],
      dividends: [
        {
          id: 'dividend-1',
          shareholderId: 'shareholder-1',
          declaredOn: '2026-06-30',
          totalMinor: 100_000,
          amountPerShareMinor: 1_000,
          otherIncomeMinor: 0,
        },
      ],
      dla: [
        {
          id: 'dla-1',
          date: '2026-06-30',
          amountMinor: -50_000,
          note: 'Director reimbursed',
        },
      ],
      ctPotMinor: 700_000,
      filings: [
        {
          id: 'filing-ct-prepared',
          kind: 'corporation-tax',
          period: 'Year ending 2026-03-31',
          preparedAt: '2026-07-10T09:00:00.000Z',
          policyPackVersion: 'uk-business-2026-27.v1',
          amountMinor: 0,
          status: 'prepared',
        },
        {
          id: 'filing-payroll-prepared',
          kind: 'payroll',
          period: 'Period ending 2026-07-31',
          preparedAt: '2026-07-18T12:00:00.000Z',
          policyPackVersion: 'uk-business-2026-27.v1',
          amountMinor: payrollRun.employerNiMinor,
          status: 'prepared',
        },
      ],
    },
    accounts: [{ balanceMinor: 1_400_000, isLiability: false, closed: false }],
  };
}
