import { describe, expect, it } from 'vitest';
import {
  calculateBusinessRunway,
  calculateSelfAssessmentSummary,
  calculateVatBoxes,
  corporationTaxMinor,
  payrollTotals,
  selectBusinessOneMove,
  totalOutstandingInvoicesMinor,
} from '@folio/business-workspace';

import { buildBusinessFilingWorkingCopy } from './businessFilingExport';
import { buildMeloSnapshot } from './meloSnapshot';
import { invoicedInYearMinor } from '../screens/business/businessTodayMetrics';
import {
  BUSINESS_ACCEPTANCE_NOW,
  ltdAcceptanceFixture,
  soleTraderAcceptanceFixture,
} from './fixtures/businessAcceptanceFixture';
import { createEmptyWorkspacePartition } from '../store';
import { createBusinessWorkspace, createPersonalWorkspaceRoot } from './workspaceRoot';

describe('Business acceptance journeys', () => {
  it('keeps Sole Trader Today, runway, invoices, VAT, Self-Assessment and Melo on one fixture', () => {
    const fixture = soleTraderAcceptanceFixture();
    const { state, accounts } = fixture;
    if (state.entity?.kind !== 'sole-trader') throw new Error('Sole Trader fixture is malformed.');
    const runway = calculateBusinessRunway(state, accounts, BUSINESS_ACCEPTANCE_NOW);
    const vat = calculateVatBoxes(state.vatReturns[0]!);
    const selfAssessment = calculateSelfAssessmentSummary(state, state.entity);
    const vatCopy = buildBusinessFilingWorkingCopy(
      'vat',
      state,
      BUSINESS_ACCEPTANCE_NOW.toISOString(),
    );
    const saCopy = buildBusinessFilingWorkingCopy(
      'self-assessment',
      state,
      BUSINESS_ACCEPTANCE_NOW.toISOString(),
    );
    const move = selectBusinessOneMove(state, accounts, BUSINESS_ACCEPTANCE_NOW);

    expect(state.entity?.kind).toBe('sole-trader');
    expect(state.clients).toHaveLength(1);
    expect(state.invoices.some((invoice) => invoice.status === 'paid')).toBe(true);
    expect(state.invoices.some((invoice) => invoice.status === 'overdue')).toBe(true);
    expect(totalOutstandingInvoicesMinor(state)).toBe(630_000);
    expect(invoicedInYearMinor(state.invoices, 2026)).toBe(830_000);
    expect(runway).toMatchObject({
      cashMinor: 600_000,
      incoming30Minor: 180_000,
      outgoing30Minor: 90_000,
    });
    expect(vat.box5Minor).toBe(80_000);
    expect(vatCopy?.amountMinor).toBe(vat.box5Minor);
    expect(saCopy?.amountMinor).toBe(selfAssessment.amountDueMinor);
    expect(saCopy?.rows.map((row) => row.label)).toEqual(
      expect.arrayContaining(['Class 4 National Insurance', 'Student loan']),
    );
    expect(move).toMatchObject({ kind: 'vat', action: { target: 'vat' } });
  });

  it('keeps Ltd Today, runway, invoices, VAT, CT600, payroll and Melo on one fixture', () => {
    const fixture = ltdAcceptanceFixture();
    const { state, accounts } = fixture;
    const runway = calculateBusinessRunway(state, accounts, BUSINESS_ACCEPTANCE_NOW);
    const vat = calculateVatBoxes(state.vatReturns[0]!);
    const payroll = payrollTotals(state.payrollRuns[0]!);
    const vatCopy = buildBusinessFilingWorkingCopy(
      'vat',
      state,
      BUSINESS_ACCEPTANCE_NOW.toISOString(),
    );
    const ctCopy = buildBusinessFilingWorkingCopy(
      'corporation-tax',
      state,
      BUSINESS_ACCEPTANCE_NOW.toISOString(),
    );
    const payrollCopy = buildBusinessFilingWorkingCopy(
      'payroll',
      state,
      BUSINESS_ACCEPTANCE_NOW.toISOString(),
    );
    const move = selectBusinessOneMove(state, accounts, BUSINESS_ACCEPTANCE_NOW);

    expect(state.entity?.kind).toBe('ltd');
    expect(state.clients).toHaveLength(1);
    expect(state.employees[0]?.studentLoanPlans).toEqual(['2']);
    expect(state.dividends[0]?.totalMinor).toBe(100_000);
    expect(state.dla[0]?.amountMinor).toBe(-50_000);
    expect(runway).toMatchObject({
      cashMinor: 1_400_000,
      incoming30Minor: 180_000,
      outgoing30Minor: 90_000,
    });
    expect(vatCopy?.amountMinor).toBe(vat.box5Minor);
    expect(ctCopy?.amountMinor).toBe(corporationTaxMinor(state.ytdProfitMinor));
    expect(payrollCopy?.amountMinor).toBe(payroll.payeMinor);
    expect(payrollCopy?.rows.map((row) => row.label)).toEqual(
      expect.arrayContaining(['PAYE, NI and student loans']),
    );
    expect(move).toMatchObject({ kind: 'vat', action: { target: 'vat' } });
  });

  it('builds a Business-only Melo snapshot without leaking Personal semantics', () => {
    const fixture = ltdAcceptanceFixture();
    const personal = createPersonalWorkspaceRoot().workspaces[0]!;
    const business = createBusinessWorkspace({
      id: 'workspace_business_acceptance',
      name: 'Harbour & Field Ltd',
      encryptedSubkeyId: 'workspace-subkey-business-acceptance-v1',
    });
    const root = {
      workspaces: [personal, business],
      activeWorkspaceId: business.id,
      dataWorkspaceId: business.id,
    } as const;
    const state = {
      ...createEmptyWorkspacePartition(root, business.id, BUSINESS_ACCEPTANCE_NOW.toISOString()),
      accounts: [
        {
          id: 'business-cash',
          workspaceId: business.id,
          name: 'Business current',
          kind: 'bank' as const,
          isLiability: false,
          balanceMinor: 14_000,
          balanceAsOfISO: BUSINESS_ACCEPTANCE_NOW.toISOString(),
          addedAt: BUSINESS_ACCEPTANCE_NOW.toISOString(),
          closed: false,
        },
      ],
      business: fixture.state,
    };
    const snapshot = buildMeloSnapshot(state, null, BUSINESS_ACCEPTANCE_NOW, business.id);
    expect(snapshot.workspaceKind).toBe('business');
    expect(snapshot.businessEntityKind).toBe('ltd');
    expect(snapshot.businessClientCount).toBe(1);
    expect(snapshot.businessOutstandingInvoicesMinor).toBe(630_000);
    expect(snapshot.businessVatDueMinor).toBe(80_000);
    expect(snapshot.subscriptionCount).toBe(0);
    expect(snapshot.debtCount).toBe(0);
  });
});
