import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  confirmImportDraft,
  createEmptyLocalLedgerState,
  dismissImportDraft,
  editImportDraft,
  stageStatementImport,
} from './localLedger.js';
import { buildLocalRouteSummary } from './localLedger.js';
import { buildLocalTodayModel } from './localTodayAdapter.js';
import { buildLocalTimelineModel } from './localTimelineAdapter.js';
import { buildLocalPlansModel } from './localPlansAdapter.js';

const fixtureRoot = fileURLToPath(new URL('../../fixtures/bank-inputs/', import.meta.url).href);

function fixture(name: string): string {
  return readFileSync(`${fixtureRoot}${name}`, 'utf8');
}

describe('whole-app import truth chain', () => {
  it('stages pasted bank text without changing Today totals', () => {
    const empty = createEmptyLocalLedgerState('2026-06-24');
    const beforeRoute = buildLocalRouteSummary(empty);
    const staged = stageStatementImport(empty, fixture('pasted-statement.txt'), {
      filename: 'pasted-statement.txt',
      mediaType: 'text/plain',
      byteSize: fixture('pasted-statement.txt').length,
      storageState: 'pasted_text',
    }).state;
    const afterRoute = buildLocalRouteSummary(staged);
    const today = buildLocalTodayModel(staged, afterRoute);

    expect(staged.importDrafts).toHaveLength(3);
    expect(staged.transactions).toHaveLength(0);
    expect(afterRoute.availableNowMinor).toBe(beforeRoute.availableNowMinor);
    expect(afterRoute.pendingReviewCount).toBe(3);
    expect(today.reviewCopy).toContain('3');
    expect(today.reviewCopy).toContain('waiting for review');
  });

  it('keeps rejected rows out of Today, Timeline and Plans', () => {
    const empty = createEmptyLocalLedgerState('2026-06-24');
    const staged = stageStatementImport(empty, fixture('duplicate-rows.csv')).state;
    const rejected = dismissImportDraft(staged, staged.importDrafts[0]?.rowId ?? '', {
      reason: 'duplicate',
    });
    const route = buildLocalRouteSummary(rejected);
    const today = buildLocalTodayModel(rejected, route);
    const timeline = buildLocalTimelineModel(rejected);
    const plans = buildLocalPlansModel(rejected, route);

    expect(rejected.rejectedImports).toHaveLength(1);
    expect(rejected.transactions).toHaveLength(0);
    expect(route.confirmedTransactionCount).toBe(0);
    expect(today.position.actualNetMinor).toBe(0);
    expect(
      timeline.events.some(
        (event) => event.kind === 'confirmed-record' && event.title.includes('Coffee shop'),
      ),
    ).toBe(false);
    expect(plans.planRows.every((row) => !row.title.includes('Coffee shop'))).toBe(true);
  });

  it('updates Today, Timeline and Plans only after reviewed rows are accepted', () => {
    const empty = createEmptyLocalLedgerState('2026-06-24');
    const staged = stageStatementImport(empty, fixture('pasted-statement.txt')).state;
    const incomeDraft = staged.importDrafts.find((draft) => /Payroll/i.test(draft.interpretation));
    const billDraft = staged.importDrafts.find((draft) => /rent/i.test(draft.interpretation));
    if (incomeDraft === undefined || billDraft === undefined) {
      throw new Error('Expected income and rent drafts from pasted-statement fixture.');
    }

    const reviewedIncome = editImportDraft(staged, incomeDraft.rowId, {
      amountText: '1840.00',
      date: '2026-06-24',
      interpretation: 'ACME Payroll',
    });
    const acceptedIncome = confirmImportDraft(reviewedIncome, incomeDraft.rowId);
    const reviewedBill = editImportDraft(acceptedIncome, billDraft.rowId, {
      amountText: '-875.00',
      date: '2026-06-25',
      interpretation: 'Landlord rent',
    });
    const acceptedBill = confirmImportDraft(reviewedBill, billDraft.rowId);
    const route = buildLocalRouteSummary(acceptedBill);
    const today = buildLocalTodayModel(acceptedBill, route);
    const timeline = buildLocalTimelineModel(acceptedBill);
    const plans = buildLocalPlansModel(acceptedBill, route);

    expect(acceptedBill.transactions.map((transaction) => transaction.title)).toEqual(
      expect.arrayContaining(['ACME Payroll', 'Landlord rent']),
    );
    expect(route.confirmedTransactionCount).toBe(2);
    expect(today.position.actualNetMinor).toBe(184_000);
    expect(route.availableNowMinor).toBe(96_500);
    expect(timeline.events.some((event) => event.title === 'ACME Payroll')).toBe(true);
    expect(timeline.events.some((event) => event.title === 'Landlord rent')).toBe(true);
    expect(plans.sourceLabel).toContain('Local');
  });
});
