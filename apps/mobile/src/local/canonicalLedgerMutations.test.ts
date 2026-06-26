import { describe, expect, it } from 'vitest';

import { buildLocalRouteSummary, createEmptyLocalLedgerState } from './localLedger.js';
import { buildLocalCalendarModel } from './localCalendarAdapter.js';
import {
  acceptImportDraftThroughCanonicalRepository,
  createPlannedCommitmentThroughCanonicalRepository,
  createQuickEstimateThroughCanonicalRepository,
  editImportDraftThroughCanonicalRepository,
  recordManualTransactionThroughCanonicalRepository,
  rejectImportDraftThroughCanonicalRepository,
  restoreRejectedImportThroughCanonicalRepository,
  reviewMeloImportSuggestionThroughCanonicalRepository,
  stageStatementImportThroughCanonicalRepository,
} from './canonicalLedgerMutations.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { buildLocalPlansModel } from './localPlansAdapter.js';
import { buildLocalTimelineModel } from './localTimelineAdapter.js';
import { buildLocalTodayModel } from './localTodayAdapter.js';

describe('canonical repository-backed mobile mutations', () => {
  it('migrates local shell state into canonical repository collections', () => {
    const state = recordManualTransactionThroughCanonicalRepository(
      createEmptyLocalLedgerState('2026-06-22'),
      {
        amountText: '8.50',
        kind: 'spend',
        title: 'Lunch',
      },
    );
    const repository = createCanonicalRepositoryForLocalLedgerState(state);

    expect(repository.transactions.count()).toBe(1);
    expect(repository.sourceRecords.count()).toBe(2);
    expect(repository.provenance.count()).toBe(2);
    expect(repository.balanceObservations.list()).toEqual([
      expect.objectContaining({
        observationKind: 'opening-balance',
        sourceKind: 'user-entered',
      }),
    ]);
    expect(repository.currentBalances.count()).toBe(1);
    expect(repository.timelineEntries.count()).toBeGreaterThan(0);
    expect(repository.auditLog.count()).toBe(1);
  });

  it('routes quick estimate creation through canonical repository validation', () => {
    const estimate = createQuickEstimateThroughCanonicalRepository('2026-06-22', {
      billAmountText: '100.00',
      billDate: '2026-06-24',
      billTitle: 'Repair',
      cashNowText: '250.00',
      incomeAmountText: '800.00',
      incomeDate: '2026-06-28',
      incomeTitle: 'Payday',
    });
    const repository = createCanonicalRepositoryForLocalLedgerState(estimate);

    expect(repository.expectations.count()).toBe(2);
    expect(repository.plans.count()).toBe(1);
    expect(repository.forecastSnapshots.count()).toBe(1);
  });

  it('keeps import rows review-gated before canonical transaction commit', () => {
    const staged = stageStatementImportThroughCanonicalRepository(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-21,Cfee,-3.25',
    ).state;
    const draftId = staged.importDrafts[0]?.rowId ?? '';
    const unchanged = acceptImportDraftThroughCanonicalRepository(staged, draftId);
    const unchangedRepository = createCanonicalRepositoryForLocalLedgerState(unchanged);

    expect(unchangedRepository.transactions.count()).toBe(0);
    expect(unchangedRepository.importDrafts.count()).toBe(1);

    const edited = editImportDraftThroughCanonicalRepository(staged, draftId, {
      amountText: '-3.25',
      date: '2026-06-21',
      interpretation: 'Coffee',
    });
    const accepted = acceptImportDraftThroughCanonicalRepository(edited, draftId);
    const acceptedRepository = createCanonicalRepositoryForLocalLedgerState(accepted);

    expect(acceptedRepository.transactions.count()).toBe(1);
    expect(acceptedRepository.importDrafts.count()).toBe(0);
    expect(acceptedRepository.decisions.list()).toContainEqual(
      expect.objectContaining({
        kind: 'confirm-import',
      }),
    );
  });

  it('records import rejection as a decision without creating a transaction', () => {
    const staged = stageStatementImportThroughCanonicalRepository(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-21,Cfee,-3.25',
    ).state;
    const rejected = rejectImportDraftThroughCanonicalRepository(
      staged,
      staged.importDrafts[0]?.rowId ?? '',
    );
    const repository = createCanonicalRepositoryForLocalLedgerState(rejected);

    expect(repository.transactions.count()).toBe(0);
    expect(repository.events.count()).toBe(0);
    expect(repository.importDrafts.list()).toEqual([
      expect.objectContaining({
        nonFinancial: true,
        rejectionReason: 'other',
        reviewState: 'dismissed',
        userConfirmationState: 'rejected',
      }),
    ]);
    expect(repository.importedClaims.list()).toEqual([
      expect.objectContaining({
        nonFinancial: true,
        rejectionReason: 'other',
        state: 'rejected',
      }),
    ]);
    expect(repository.decisions.list()).toEqual([
      expect.objectContaining({
        kind: 'dismiss-proposal',
      }),
    ]);

    const reopened = restoreRejectedImportThroughCanonicalRepository(
      rejected,
      rejected.rejectedImports[0]?.rowId ?? '',
    );
    const reopenedRepository = createCanonicalRepositoryForLocalLedgerState(reopened);

    expect(reopened.importDrafts[0]).toMatchObject({
      reviewState: 'needs-review',
      userConfirmationState: 'requested',
    });
    expect(reopenedRepository.importDrafts.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reviewState: 'needs-review',
          userConfirmationState: 'requested',
        }),
        expect.objectContaining({
          nonFinancial: true,
          reviewState: 'dismissed',
          userConfirmationState: 'rejected',
        }),
      ]),
    );
  });

  it('keeps Melo suggestions as reviewable proposal and memory records only', () => {
    const staged = stageStatementImportThroughCanonicalRepository(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-21,Cfee,-3.25',
    ).state;
    const suggested = reviewMeloImportSuggestionThroughCanonicalRepository(
      staged,
      staged.importDrafts[0]?.rowId ?? '',
    );
    const repository = createCanonicalRepositoryForLocalLedgerState(suggested);

    expect(repository.transactions.count()).toBe(0);
    expect(repository.meloProposals.list()).toEqual([
      expect.objectContaining({
        canWriteDirectly: false,
        status: 'needs-review',
      }),
    ]);
    expect(repository.meloMemory.count()).toBe(1);
  });

  it('persists plans and derives Today, Timeline and Calendar from canonical repository data', () => {
    const planned = createPlannedCommitmentThroughCanonicalRepository(
      {
        ...createEmptyLocalLedgerState('2026-06-22'),
        cashOnHandMinor: 20_000,
      },
      {
        amountText: '100.00',
        date: '2026-06-24',
        title: 'Repair',
      },
    );
    const route = buildLocalRouteSummary(planned);
    const repository = createCanonicalRepositoryForLocalLedgerState(planned);
    const today = buildLocalTodayModel(planned, route);
    const timeline = buildLocalTimelineModel(planned);
    const calendar = buildLocalCalendarModel(planned, route);
    const plans = buildLocalPlansModel(planned, route);

    expect(repository.plans.list()).toEqual([
      expect.objectContaining({
        status: 'active',
        title: 'Protect Repair',
      }),
    ]);
    expect(today.position.inputs.cashflowIds.length).toBeGreaterThan(0);
    expect(timeline.expectationCount).toBe(1);
    expect(calendar.calendarItemCount).toBeGreaterThan(0);
    expect(plans.contractState).toBe('repository-backed');
    expect(plans.planRows).toEqual([
      expect.objectContaining({
        title: 'Protect Repair',
      }),
    ]);
  });
});
