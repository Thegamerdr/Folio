import { createMoney, createWorkspaceId } from '@folio/domain';

export const syntheticWorkspace = createWorkspaceId('workspace_personal_demo');

export const syntheticOpeningBalance = createMoney({
  minorUnits: 125000,
  currency: 'GBP',
});

export const syntheticDataNotice =
  'All package fixtures are fictional and must not be replaced with real financial records.';

export type SyntheticCsvFixture = Readonly<{
  id: string;
  filename: string;
  importJobId: string;
  sourceFileId: string;
  accountId: string;
  currency: string;
  text: string;
  expectedRows: readonly Readonly<{
    localDate: string;
    description: string;
    amountMinor: number;
  }>[];
}>;

export type SyntheticProjectionFixture = Readonly<{
  id: string;
  asOf: string;
  nextIncomeDate: string;
  protectedFloorMinor: number;
  accounts: readonly Readonly<{
    id: string;
    label: string;
    balanceMinor: number;
  }>[];
  cashflows: readonly Readonly<{
    id: string;
    label: string;
    date: string;
    amountMinor: number;
    state: 'actual' | 'expected' | 'inferred' | 'hypothetical';
    protected?: boolean;
  }>[];
  expected: Readonly<{
    availableBeforeNextIncomeMinor: number;
    minimumBeforeNextIncomeMinor: number;
    closingOnNextIncomeDateMinor: number;
    excludedIds: readonly string[];
  }>;
}>;

export const syntheticStatementCsvFixture: SyntheticCsvFixture = {
  id: 'synthetic_import_review_csv_001',
  filename: 'synthetic-folio-statement.csv',
  importJobId: 'import_job_synthetic_review_001',
  sourceFileId: 'source_file_synthetic_statement_001',
  accountId: 'account_synthetic_current',
  currency: 'GBP',
  text: [
    'Date,Description,Debit,Credit,Balance,Transaction ID',
    '2026-06-20,Synthetic corner shop,12.34,,1237.66,syn-fit-001',
    '2026-06-21,Synthetic wages,,585.00,1822.66,syn-fit-002',
    '2026-06-22,Synthetic rent,735.00,,1087.66,syn-fit-003',
  ].join('\n'),
  expectedRows: [
    { localDate: '2026-06-20', description: 'Synthetic corner shop', amountMinor: -1234 },
    { localDate: '2026-06-21', description: 'Synthetic wages', amountMinor: 58500 },
    { localDate: '2026-06-22', description: 'Synthetic rent', amountMinor: -73500 },
  ],
};

export const syntheticBeforePaydayProjectionFixture: SyntheticProjectionFixture = {
  id: 'synthetic_before_payday_projection_001',
  asOf: '2026-06-20',
  nextIncomeDate: '2026-06-26',
  protectedFloorMinor: 10000,
  accounts: [
    {
      id: 'account_synthetic_current',
      label: 'Synthetic current account',
      balanceMinor: 100000,
    },
  ],
  cashflows: [
    {
      id: 'synthetic_rent',
      label: 'Synthetic rent',
      date: '2026-06-22',
      amountMinor: -73500,
      state: 'expected',
      protected: true,
    },
    {
      id: 'synthetic_utility',
      label: 'Synthetic utility',
      date: '2026-06-24',
      amountMinor: -9500,
      state: 'expected',
      protected: true,
    },
    {
      id: 'synthetic_overtime',
      label: 'Synthetic overtime',
      date: '2026-06-25',
      amountMinor: 20000,
      state: 'inferred',
    },
    {
      id: 'synthetic_salary',
      label: 'Synthetic salary',
      date: '2026-06-26',
      amountMinor: 58500,
      state: 'expected',
    },
  ],
  expected: {
    availableBeforeNextIncomeMinor: 7000,
    minimumBeforeNextIncomeMinor: 17000,
    closingOnNextIncomeDateMinor: 75500,
    excludedIds: ['synthetic_overtime'],
  },
};
