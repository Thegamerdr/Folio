import { describe, expect, it } from 'vitest';

import {
  addManualTransaction,
  addPlannedCommitment,
  applyMeloImportSuggestion,
  buildLocalLedgerExportPayload,
  buildMeloLocalEvidenceRecords,
  buildMeloLocalRecordLookup,
  buildLocalRouteSummary,
  buildMeloSnapshotFromLocalState,
  confirmImportDraft,
  createEmptyLocalLedgerState,
  createInitialLocalLedgerState,
  createQuickEstimateLocalLedgerState,
  dismissImportDraft,
  editImportDraft,
  isPrivateExampleLedger,
  refreshLocalLedgerAsOfDate,
  restoreRejectedImportForReview,
  searchLocalLedgerEvidenceRecords,
  searchLocalLedgerRecords,
  stageDocumentForManualReview,
  stageStatementImport,
} from './localLedger.js';
import { createLocalLedgerPortableVault, summariseLocalLedgerVault } from './localLedgerVault.js';

describe('mobile local ledger state', () => {
  it('starts from a route that Melo can answer from without cloud state', () => {
    const state = createInitialLocalLedgerState();
    const route = buildLocalRouteSummary(state);
    const snapshot = buildMeloSnapshotFromLocalState(state, route);

    expect(state.lastImportSummary).toMatchObject({
      needsUserReview: 2,
      parsedRows: 6,
      readyForAcceptance: 4,
      skippedRows: 0,
    });
    expect(route.availableNowMinor).toBe(14_200);
    expect(route.pendingReviewCount).toBe(2);
    expect(route.protectedItems).toContain('rent');
    expect(
      route.points.map((point) => [
        point.title,
        point.balanceMinor,
        point.pointKind,
        point.reviewState,
      ]),
    ).toEqual([
      ['Cash after today', 105_700, 'confirmed', 'already real'],
      ['Set aside for bills', 14_200, 'commitment', 'already real'],
      ['Food allowance protected', 14_200, 'commitment', 'already real'],
      ['Payday', 198_200, 'expected', 'already real'],
      ['Rent protected', 198_200, 'commitment', 'already real'],
    ]);
    expect(route.points[1]).toMatchObject({
      actionLabel: 'Reveal protected commitments',
      protectedMinor: 91_500,
      sourceLabel: 'Protected commitments',
    });
    expect(route.tightestBalanceMinor).toBe(14_200);
    expect(route.tightestBalanceMinor).toBe(
      Math.min(...route.points.slice(1).map((point) => point.balanceMinor)),
    );
    expect(snapshot).toMatchObject({
      currency: 'GBP',
      availableNowMinor: 14_200,
      pendingReviewCount: 2,
    });
    expect(isPrivateExampleLedger(state)).toBe(true);
  });

  it('keeps edited example-only rows private and starts user-owned writes without seed rows', () => {
    const exampleSuggested = applyMeloImportSuggestion(
      createInitialLocalLedgerState(),
      'seed_draft_abound',
    );
    const exampleConfirmed = confirmImportDraft(exampleSuggested, 'seed_draft_abound');
    const userLedger = addManualTransaction(createEmptyLocalLedgerState('2026-06-22'), {
      title: 'My real lunch',
      amountText: '8.50',
      kind: 'spend',
    });

    expect(isPrivateExampleLedger(exampleSuggested)).toBe(true);
    expect(isPrivateExampleLedger(exampleConfirmed)).toBe(true);
    expect(userLedger.transactions).toHaveLength(1);
    expect(userLedger.transactions[0]).toMatchObject({
      amountMinor: -850,
      date: '2026-06-22',
      source: 'manual',
      title: 'My real lunch',
    });
    expect(userLedger.transactions.some((transaction) => transaction.id.startsWith('seed_'))).toBe(
      false,
    );
    expect(buildLocalRouteSummary(userLedger).availableNowMinor).toBe(-850);
  });

  it('builds a no-import quick estimate route from three user-entered facts', () => {
    const state = createQuickEstimateLocalLedgerState('2026-06-22', {
      billAmountText: '875',
      billDate: '2026-07-01',
      billTitle: 'Rent',
      cashNowText: '1190.47',
      incomeAmountText: '1840',
      incomeDate: '2026-06-27',
      incomeTitle: 'Payday',
    });
    const route = buildLocalRouteSummary(state);

    expect(isPrivateExampleLedger(state)).toBe(false);
    expect(state.transactions).toHaveLength(2);
    expect(state.transactions.some((transaction) => transaction.id.startsWith('seed_'))).toBe(
      false,
    );
    expect(route.availableNowMinor).toBe(31_547);
    expect(route.points.map((point) => [point.title, point.balanceMinor])).toEqual([
      ['Cash after today', 119_047],
      ['Set aside for bills', 31_547],
      ['Payday', 215_547],
      ['Rent', 215_547],
    ]);
    expect(route.points.at(-1)).toMatchObject({
      pointKind: 'commitment',
      protectedMinor: 87_500,
      reviewState: 'already real',
    });
    expect(route.pendingReviewCount).toBe(0);
    expect(route.lastActionLabel).toBe('Quick estimate saved locally. Route rebuilt.');
  });

  it('searches local route records, transactions, drafts and source history', () => {
    const state = createInitialLocalLedgerState('2026-06-22');
    const route = buildLocalRouteSummary(state);

    expect(searchLocalLedgerRecords(state, route, 'rent').map((record) => record.title)).toContain(
      'Rent protected',
    );
    expect(searchLocalLedgerRecords(state, route, 'aside for bills')[0]).toMatchObject({
      title: 'Set aside for bills',
      tone: 'confirmed',
    });
    expect(searchLocalLedgerRecords(state, route, 'abound')[0]).toMatchObject({
      title: 'Possible debt repayment',
      tone: 'attention',
    });
  });

  it('builds Melo evidence from exact local records with route fallback', () => {
    const planned = addPlannedCommitment(createInitialLocalLedgerState('2026-06-22'), {
      title: 'Dentist',
      amountText: '25.00',
      date: '2026-06-23',
    });
    const route = buildLocalRouteSummary(planned);

    expect(buildMeloLocalEvidenceRecords(planned, route, 'Dentist')[0]).toMatchObject({
      title: 'Dentist',
      amountMinor: -2_500,
      meta: 'Dentist -\u00a325 due 2026-06-23',
    });
    expect(buildMeloLocalEvidenceRecords(planned, route, 'Can I spend 120?')[0]).toMatchObject({
      title: 'Cash after today',
      amountMinor: 105_700,
    });
  });

  it('builds a sanitized local export payload without raw internal digests', () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Debit,Credit,Balance,Transaction ID\n2026-06-22,Train fare,18.40,,100,abc',
      {
        byteSize: 92,
        filename: 'statement.csv',
        mediaType: 'text/csv',
        storageState: 'copied_to_app_cache',
      },
    ).state;
    const payload = buildLocalLedgerExportPayload(staged, buildLocalRouteSummary(staged));
    const serialized = JSON.stringify(payload);

    expect(payload.schema).toBe('folio-local-export-v1');
    expect(payload.documentStages[0]).toMatchObject({
      filename: 'statement.csv',
      mediaType: 'text/csv',
      storageState: 'copied_to_app_cache',
    });
    expect(payload.importDrafts[0]).toMatchObject({
      interpretation: 'Train fare',
      original: '2026-06-22 / Train fare / 18.40 / 100 / abc',
    });
    expect(serialized).not.toContain('local-text:');
    expect(serialized).not.toContain('provenanceHash');
    expect(serialized).not.toContain('textDigest');
  });

  it('keeps an empty cleared ledger honest across route search and export', () => {
    const cleared = createEmptyLocalLedgerState('2026-06-22');
    const route = buildLocalRouteSummary(cleared);
    const search = searchLocalLedgerRecords(cleared, route, '');
    const payload = buildLocalLedgerExportPayload(cleared, route);

    expect(route).toMatchObject({
      availableNowMinor: 0,
      confirmedTransactionCount: 0,
      pendingReviewCount: 0,
      tightestBalanceMinor: 0,
      tightestDay: 'Today',
    });
    expect(search).toEqual([
      expect.objectContaining({
        amountMinor: 0,
        detail: expect.stringContaining('empty local baseline'),
        meta: expect.stringContaining('Empty workspace'),
        title: 'Cash after today',
      }),
    ]);
    expect(search[0]?.detail).toContain('needs source - Empty workspace - No source yet');
    expect(search[0]?.detail).not.toMatch(/confirmed - Empty workspace|user confirmed/i);
    expect(payload.transactions).toEqual([]);
    expect(payload.importDrafts).toEqual([]);
    expect(payload.documentStages).toEqual([]);
    expect(payload.history).toEqual([]);
  });

  it('adds manual spend locally and rebuilds the route', () => {
    const state = addManualTransaction(createInitialLocalLedgerState(), {
      title: 'Groceries',
      amountText: '40.00',
      kind: 'spend',
    });
    const route = buildLocalRouteSummary(state);

    expect(state.transactions[0]).toMatchObject({
      title: 'Groceries',
      amountMinor: -4_000,
      source: 'manual',
      status: 'confirmed',
    });
    expect(route.availableNowMinor).toBe(10_200);
    expect(route.points.map((point) => point.balanceMinor)).toEqual([
      101_700, 10_200, 10_200, 194_200, 194_200,
    ]);
    expect(route.lastActionLabel).toContain('Groceries added locally');
  });

  it('keeps the complete local route timeline and search set as records grow', () => {
    let state = createEmptyLocalLedgerState('2026-06-22');

    for (let index = 1; index <= 8; index += 1) {
      state = addManualTransaction(state, {
        title: `Local item ${index}`,
        amountText: '1.00',
        kind: 'spend',
      });
    }

    const route = buildLocalRouteSummary(state);
    const localTimelineRows = route.timeline.filter(
      (event) => event.detail === 'Added on this device',
    );
    const searchResults = searchLocalLedgerRecords(
      state,
      route,
      'Local item',
      Number.MAX_SAFE_INTEGER,
    );

    expect(localTimelineRows).toHaveLength(8);
    expect(route.timeline.map((event) => event.title)).toContain('Local item 1');
    expect(route.timeline.map((event) => event.title)).toContain('Local item 8');
    expect(searchResults.filter((record) => record.id.startsWith('transaction-'))).toHaveLength(8);
    expect(searchResults.filter((record) => record.id.startsWith('history-'))).toHaveLength(8);
  });

  it('adds a dated protected commitment from the calendar and keeps search/export truthful', () => {
    const state = addPlannedCommitment(createInitialLocalLedgerState(), {
      title: 'Council tax',
      amountText: '25.00',
      date: '2026-06-23',
    });
    const route = buildLocalRouteSummary(state);
    const searchResults = searchLocalLedgerRecords(state, route, 'council');
    const payload = buildLocalLedgerExportPayload(state, route);

    expect(state.transactions[0]).toMatchObject({
      title: 'Council tax',
      amountMinor: -2_500,
      date: '2026-06-23',
      source: 'manual',
      status: 'confirmed',
      protected: true,
    });
    expect(route.availableNowMinor).toBe(11_700);
    expect(route.points.find((point) => point.title === 'Council tax')).toMatchObject({
      balanceMinor: 11_700,
      deltaMinor: 0,
      pointKind: 'commitment',
      protectedMinor: 2_500,
    });
    expect(route.lastActionLabel).toContain('Council tax planned for 2026-06-23');
    expect(searchResults[0]).toMatchObject({
      title: 'Council tax',
      amountMinor: -2_500,
      tone: 'confirmed',
    });
    expect(payload.transactions[0]).toMatchObject({
      title: 'Council tax',
      original: 'Council tax -\u00a325 due 2026-06-23',
    });
  });

  it('grounds Melo direct record lookups in local rows instead of generic chat', () => {
    const state = addPlannedCommitment(createInitialLocalLedgerState(), {
      title: 'Dentist',
      amountText: '25.00',
      date: '2026-06-23',
    });
    const route = buildLocalRouteSummary(state);
    const lookup = buildMeloLocalRecordLookup(state, route, 'Dentist');

    expect(lookup).not.toBeNull();
    expect(lookup?.answer).toContain('I found Dentist in the local records');
    expect(lookup?.answer).toContain('Source wording: Dentist -\u00a325 due 2026-06-23');
    expect(lookup?.financialConclusion).toContain(
      'Dentist is already included locally as -\u00a325',
    );
    expect(lookup?.dataUsed).toContain('1 direct local record match');
    expect(lookup?.records[0]).toMatchObject({
      amountMinor: -2_500,
      detail: 'Manual - confirmed - protected',
      title: 'Dentist',
    });
  });

  it('keeps Melo spend questions on the what-if path even when an amount matches records', () => {
    const state = addPlannedCommitment(createInitialLocalLedgerState(), {
      title: 'Dentist',
      amountText: '25.00',
      date: '2026-06-23',
    });
    const route = buildLocalRouteSummary(state);

    expect(buildMeloLocalRecordLookup(state, route, 'Can I spend 25 before payday?')).toBeNull();
  });

  it('keeps chart-facing route, Melo snapshot and local vault forecast in sync after actions', () => {
    const spent = addManualTransaction(createInitialLocalLedgerState(), {
      title: 'Groceries',
      amountText: '40.00',
      kind: 'spend',
    });
    const suggested = applyMeloImportSuggestion(spent, 'seed_draft_abound');
    const confirmed = confirmImportDraft(suggested, 'seed_draft_abound');
    const route = buildLocalRouteSummary(confirmed);
    const snapshot = buildMeloSnapshotFromLocalState(confirmed, route);
    const vault = createLocalLedgerPortableVault(confirmed);
    const forecast = vault.tables.find((table) => table.name === 'forecast_snapshots')?.rows[0];

    expect(route.availableNowMinor).toBe(10_200);
    expect(route.pendingReviewCount).toBe(2);
    expect(route.points.map((point) => [point.title, point.balanceMinor])).toEqual([
      ['Cash after today', 101_700],
      ['Set aside for bills', 10_200],
      ['Food allowance protected', 10_200],
      ['Payday', 194_200],
      ['Rent protected', 194_200],
    ]);
    expect(snapshot).toMatchObject({
      availableNowMinor: route.availableNowMinor,
      pendingReviewCount: route.pendingReviewCount,
      tightestBalanceMinor: route.tightestBalanceMinor,
      tightestDay: route.tightestDay,
    });
    expect(forecast).toMatchObject({
      available_now_minor: route.availableNowMinor,
      pending_review_count: route.pendingReviewCount,
      tightest_balance_minor: route.tightestBalanceMinor,
      tightest_day: route.tightestDay,
    });
  });

  it('can shift the private example to the device date without changing route math', () => {
    const state = createInitialLocalLedgerState('2026-06-22');
    const route = buildLocalRouteSummary(state);

    expect(state.asOfDate).toBe('2026-06-22');
    expect(state.transactions.map((transaction) => transaction.date)).toEqual([
      '2026-06-22',
      '2026-07-02',
      '2026-06-25',
      '2026-06-27',
    ]);
    expect(route.availableNowMinor).toBe(14_200);
    expect(route.points.map((point) => [point.label, point.date, point.balanceMinor])).toEqual([
      ['Today', '2026-06-22', 105_700],
      ['Today', '2026-06-22', 14_200],
      ['Thu', '2026-06-25', 14_200],
      ['Sat', '2026-06-27', 198_200],
      ['Thu', '2026-07-02', 198_200],
    ]);
    expect(route.points.map((point) => point.label)).not.toEqual(
      expect.arrayContaining(['cash', 'reserved']),
    );
  });

  it('refreshes an unmodified saved example to the requested as-of date', () => {
    const refreshed = refreshLocalLedgerAsOfDate(createInitialLocalLedgerState(), '2026-06-22');

    expect(refreshed.asOfDate).toBe('2026-06-22');
    expect(refreshed.history[0]?.label).toBe('Private example loaded locally.');
    expect(buildLocalRouteSummary(refreshed).availableNowMinor).toBe(14_200);
  });

  it('does not fabricate protected items when no confirmed protected rows exist', () => {
    const initial = createInitialLocalLedgerState();
    const state = {
      ...initial,
      transactions: initial.transactions.map((transaction) => ({
        ...transaction,
        protected: false,
      })),
    };
    const route = buildLocalRouteSummary(state);

    expect(route.protectedItems).toEqual([]);
    expect(route.availableNowMinor).toBe(105_700);
    expect(route.points.some((point) => point.title === 'Set aside for bills')).toBe(false);
    expect(route.points.map((point) => [point.title, point.balanceMinor])).toEqual([
      ['Cash after today', 105_700],
      ['Food allowance protected', 101_700],
      ['Payday', 285_700],
      ['Rent protected', 198_200],
    ]);
    expect(route.tightestBalanceMinor).toBe(101_700);
  });

  it('keeps future route shortfall visible even when cash today is positive', () => {
    const state = {
      ...createEmptyLocalLedgerState('2026-06-22'),
      cashOnHandMinor: 5_000,
      transactions: [
        {
          amountMinor: -10_000,
          date: '2026-06-24',
          id: 'manual_future_repair',
          original: 'Repair -100.00 due 2026-06-24',
          protected: false,
          source: 'manual' as const,
          status: 'confirmed' as const,
          title: 'Repair',
        },
      ],
    };
    const route = buildLocalRouteSummary(state);

    expect(route.availableNowMinor).toBe(5_000);
    expect(route.tightestBalanceMinor).toBe(-5_000);
    expect(route.points.map((point) => [point.title, point.balanceMinor])).toEqual([
      ['Cash after today', 5_000],
      ['Repair', -5_000],
    ]);
  });

  it('excludes needs-review transactions from route points', () => {
    const initial = createInitialLocalLedgerState();
    const state = {
      ...initial,
      transactions: [
        ...initial.transactions,
        {
          amountMinor: -55_000,
          date: '2026-06-23',
          id: 'review_future_repair',
          original: 'GARAGE 550.00',
          protected: false,
          source: 'manual' as const,
          status: 'needs_review' as const,
          title: 'Garage repair to review',
        },
      ],
    };
    const route = buildLocalRouteSummary(state);

    expect(route.pendingReviewCount).toBe(3);
    expect(route.points.some((point) => point.title === 'Garage repair to review')).toBe(false);
    expect(route.tightestBalanceMinor).toBe(14_200);
  });

  it('stages pasted statement text through the import engine without saving rows', () => {
    const result = stageStatementImport(
      createInitialLocalLedgerState(),
      [
        'Date,Description,Debit,Credit,Balance,Transaction ID',
        '2026-06-20,Synthetic corner shop,12.34,,1237.66,fit-1',
        '2026-06-21,Synthetic wages,,585.00,1822.66,fit-2',
        '2026-06-22,Synthetic rent,735.00,,1087.66,fit-3',
      ].join('\n'),
    );

    expect(result.issues).toEqual([]);
    expect(result.packet.counts.parsedRows).toBe(3);
    expect(result.state.importDrafts).toHaveLength(5);
    expect(result.state.transactions).toHaveLength(4);
    expect(result.state.documentStages).toHaveLength(0);
    expect(result.message).toContain('Nothing has been added yet');
  });

  it('records selected local statement document metadata without saving transactions', () => {
    const result = stageStatementImport(
      createInitialLocalLedgerState(),
      'Date,Description,Amount\n2026-06-21,Coffee,-3.25',
      {
        byteSize: 48,
        filename: 'statement-june.csv',
        mediaType: 'text/csv',
        storageState: 'copied_to_app_cache',
      },
    );

    expect(result.documentStage).toMatchObject({
      filename: 'statement-june.csv',
      mediaType: 'text/csv',
      storageState: 'copied_to_app_cache',
      textDigest: expect.stringMatching(/^local-text:/),
    });
    expect(result.state.documentStages).toHaveLength(1);
    expect(result.state.transactions).toHaveLength(4);
    expect(result.state.history[0]).toMatchObject({
      kind: 'document_staged',
    });
  });

  it('adds unsupported files for manual review without creating money rows', () => {
    const result = stageDocumentForManualReview(createInitialLocalLedgerState(), {
      byteSize: 128_000,
      filename: 'statement-photo.png',
      mediaType: 'image/png',
      storageState: 'copied_to_app_cache',
    });

    expect(result.message).toBe(
      'File added for review. Automatic reading is not ready for this file yet. You can still add the important numbers manually.',
    );
    expect(result.documentStage).toMatchObject({
      filename: 'statement-photo.png',
      mediaType: 'image/png',
      storageState: 'copied_to_app_cache',
    });
    expect(result.state.documentStages).toHaveLength(1);
    expect(result.state.importDrafts).toHaveLength(2);
    expect(result.state.transactions).toHaveLength(4);
    expect(result.state.history[0]).toMatchObject({
      kind: 'document_staged',
      label: 'statement-photo.png added for manual review. Nothing was added.',
    });
  });

  it('confirms or dismisses import drafts as explicit user-reviewed actions', () => {
    const staged = stageStatementImport(
      createInitialLocalLedgerState(),
      'Date,Description,Amount\n2026-06-21,Coffee,-3.25',
    ).state;
    const stagedDraft = staged.importDrafts[0];

    expect(stagedDraft).toBeDefined();
    const unchanged = confirmImportDraft(staged, stagedDraft?.rowId ?? '');
    expect(unchanged.importDrafts).toHaveLength(staged.importDrafts.length);
    expect(unchanged.transactions[0]?.title).not.toBe('Coffee');

    const reviewed = editImportDraft(staged, stagedDraft?.rowId ?? '', {
      amountText: '-3.25',
      date: '2026-06-21',
      interpretation: 'Coffee',
    });
    const confirmed = confirmImportDraft(reviewed, stagedDraft?.rowId ?? '');
    expect(confirmed.importDrafts).toHaveLength(staged.importDrafts.length - 1);
    expect(confirmed.transactions[0]).toMatchObject({
      title: 'Coffee',
      amountMinor: -325,
      source: 'import',
    });

    const dismissed = dismissImportDraft(confirmed, confirmed.importDrafts[0]?.rowId ?? '');
    expect(dismissed.importDrafts).toHaveLength(confirmed.importDrafts.length - 1);
    expect(dismissed.history[0]?.label).toContain('No saved record changed');
  });

  it('retains rejected import evidence outside normal financial records and can reopen it', () => {
    const csv = 'Date,Description,Amount\n2026-06-21,Coffee,-3.25';
    const staged = stageStatementImport(createEmptyLocalLedgerState('2026-06-22'), csv).state;
    const draft = staged.importDrafts[0];
    const rejected = dismissImportDraft(staged, draft?.rowId ?? '', { reason: 'duplicate' });
    const route = buildLocalRouteSummary(rejected);

    expect(rejected.importDrafts).toEqual([]);
    expect(rejected.transactions).toEqual([]);
    expect(rejected.rejectedImports).toEqual([
      expect.objectContaining({
        interpretation: 'Coffee',
        rejectionReason: 'duplicate',
        reviewState: 'dismissed',
        status: 'Rejected',
        userConfirmationState: 'rejected',
      }),
    ]);
    expect(route.pendingReviewCount).toBe(0);
    expect(searchLocalLedgerRecords(rejected, route, 'Coffee')).not.toContainEqual(
      expect.objectContaining({ id: expect.stringMatching(/^rejected-import-/) }),
    );
    expect(searchLocalLedgerEvidenceRecords(rejected, route, 'Coffee')).toContainEqual(
      expect.objectContaining({
        detail: 'Rejected import evidence - duplicate',
        id: `rejected-import-${draft?.rowId}`,
        title: 'Coffee',
      }),
    );
    expect(buildLocalLedgerExportPayload(rejected, route).rejectedImports).toEqual([
      expect.objectContaining({
        interpretation: 'Coffee',
        rejectionReason: 'duplicate',
      }),
    ]);

    const restaged = stageStatementImport(rejected, csv).state;
    expect(restaged.importDrafts[0]).toMatchObject({
      reviewState: 'needs-review',
      status: 'Needs review',
    });
    expect(restaged.importDrafts[0]?.reasons.join(' ')).toContain('previously rejected: duplicate');

    const reopened = restoreRejectedImportForReview(rejected, draft?.rowId ?? '');
    const confirmedTooEarly = confirmImportDraft(reopened, draft?.rowId ?? '');

    expect(reopened.importDrafts[0]).toMatchObject({
      reviewState: 'needs-review',
      status: 'Needs review',
      userConfirmationState: 'requested',
    });
    expect(reopened.rejectedImports[0]?.restoreCount).toBe(1);
    expect(confirmedTooEarly.transactions).toEqual([]);
    expect(confirmedTooEarly.importDrafts).toHaveLength(1);
  });

  it('edits a staged import row before confirmation and keeps source wording attached', () => {
    const staged = stageStatementImport(
      createInitialLocalLedgerState(),
      'Date,Description,Amount\n2026-06-21,Cfee,-3.25',
    ).state;
    const stagedDraft = staged.importDrafts[0];

    expect(stagedDraft).toBeDefined();
    const edited = editImportDraft(staged, stagedDraft?.rowId ?? '', {
      amountText: '-4.50',
      date: '2026-06-22',
      interpretation: 'Coffee corrected',
    });
    const editedDraft = edited.importDrafts.find((draft) => draft.rowId === stagedDraft?.rowId);

    expect(editedDraft).toMatchObject({
      amountMinor: -450,
      date: '2026-06-22',
      interpretation: 'Coffee corrected',
      status: 'Ready to confirm',
    });
    expect(editedDraft?.original).toBe(stagedDraft?.original);

    const confirmed = confirmImportDraft(edited, stagedDraft?.rowId ?? '');
    expect(confirmed.transactions[0]).toMatchObject({
      amountMinor: -450,
      date: '2026-06-22',
      original: stagedDraft?.original,
      title: 'Coffee corrected',
    });
  });

  it('does not duplicate review rows when the same statement is staged again', () => {
    const text = [
      'Date,Description,Debit,Credit,Balance,Transaction ID',
      '2026-06-20,Synthetic corner shop,12.34,,1237.66,fit-1',
      '2026-06-21,Synthetic wages,,585.00,1822.66,fit-2',
      '2026-06-22,Synthetic rent,735.00,,1087.66,fit-3',
    ].join('\n');
    const first = stageStatementImport(createInitialLocalLedgerState(), text).state;
    const second = stageStatementImport(first, text).state;

    expect(first.importDrafts).toHaveLength(5);
    expect(second.importDrafts).toHaveLength(5);
    expect(second.lastImportSummary).toMatchObject({
      parsedRows: first.lastImportSummary?.parsedRows,
      skippedRows: 3,
    });
  });

  it('lets Melo suggest an import label without saving it as a transaction', () => {
    const suggested = applyMeloImportSuggestion(
      createInitialLocalLedgerState(),
      'seed_draft_abound',
    );
    const aboundDraft = suggested.importDrafts.find((draft) => draft.rowId === 'seed_draft_abound');

    expect(aboundDraft).toMatchObject({
      interpretation: 'Debt repayment',
      authorityState: 'inferred',
      reviewState: 'needs-review',
      userConfirmationState: 'requested',
      status: 'Needs review',
    });
    expect(suggested.transactions).toHaveLength(4);
    expect(suggested.history[0]?.kind).toBe('import_suggested');
    expect(suggested.history[0]?.label).toContain('Confirm before saving');
  });

  it('builds a mobile-safe local vault envelope from ledger rows', () => {
    const state = createInitialLocalLedgerState();
    const vault = createLocalLedgerPortableVault(state);
    const summary = summariseLocalLedgerVault(state);
    const forecastSnapshot = vault.tables.find((table) => table.name === 'forecast_snapshots')
      ?.rows[0];

    expect(vault.format).toBe('folio.mobile_local_vault');
    expect(vault.dataVersion).toMatch(/^local-hash:/);
    expect(forecastSnapshot).toMatchObject({
      confirmed_transaction_count: 4,
      pending_review_count: 2,
      route_point_count: 5,
    });
    expect(forecastSnapshot).not.toHaveProperty('confidence_percent');
    expect(forecastSnapshot).not.toHaveProperty('score');
    expect(summary.validation).toEqual({ valid: true, issues: [] });
    expect(summary.transactionRows).toBe(4);
    expect(summary.importDraftRows).toBe(2);
    expect(summary.documentStageRows).toBe(0);
    expect(summary.searchRows).toBe(6);
  });

  it('persists debt status, pressure and repeats as fields and lowers available-now', () => {
    const before = { ...createEmptyLocalLedgerState('2026-06-24'), cashOnHandMinor: 50_000 };
    const after = addPlannedCommitment(before, {
      title: 'Card minimum',
      amountText: '100.00',
      date: '2026-06-26',
      protected: true,
      status: 'behind',
      pressure: 'high',
      repeats: 'monthly',
    });
    const savedDebt = after.transactions[0];

    // Status/pressure/repeats are stored as structured fields, not baked into the title.
    expect(savedDebt).toMatchObject({
      title: 'Card minimum',
      amountMinor: -10_000,
      commitmentStatus: 'behind',
      commitmentPressure: 'high',
      repeats: 'monthly',
      protected: true,
    });
    // A saved must-pay debt reduces what is available now.
    expect(buildLocalRouteSummary(after).availableNowMinor).toBeLessThan(
      buildLocalRouteSummary(before).availableNowMinor,
    );
    expect(buildLocalRouteSummary(after).availableNowMinor).toBe(40_000);
  });

  it('keeps a paid bill out of protection so it does not lower available-now like a must-pay', () => {
    const before = { ...createEmptyLocalLedgerState('2026-06-24'), cashOnHandMinor: 50_000 };
    const mustPay = addPlannedCommitment(before, {
      title: 'Energy bill',
      amountText: '120.00',
      date: '2026-06-27',
      protected: true,
      repeats: 'monthly',
    });
    // A paid bill mirrors the bill screen's `protected: mustPay && !paid` => protected:false.
    const paidBill = addPlannedCommitment(before, {
      title: 'Energy bill',
      amountText: '120.00',
      date: '2026-06-27',
      protected: false,
      paid: true,
      repeats: 'monthly',
    });

    expect(mustPay.transactions[0]?.protected).toBe(true);
    expect(paidBill.transactions[0]).toMatchObject({ protected: false, repeats: 'monthly' });
    // The must-pay bill reduces available-now; the paid (unprotected) one does not.
    expect(buildLocalRouteSummary(mustPay).availableNowMinor).toBe(38_000);
    expect(buildLocalRouteSummary(paidBill).availableNowMinor).toBe(50_000);
    expect(buildLocalRouteSummary(paidBill).availableNowMinor).toBeGreaterThan(
      buildLocalRouteSummary(mustPay).availableNowMinor,
    );
  });

  it('stores future-dated quick-estimate income as expected and keeps it out of available-now', () => {
    const state = createQuickEstimateLocalLedgerState('2026-06-22', {
      billAmountText: '0',
      billDate: '2026-07-01',
      billTitle: 'None',
      cashNowText: '100.00',
      incomeAmountText: '500',
      incomeDate: '2026-06-30',
      incomeTitle: 'Payday',
      incomeRepeats: 'monthly',
      incomeCertainty: 'expected',
    });
    const income = state.transactions.find((transaction) => transaction.amountMinor > 0);

    // QuickEstimateInput carries incomeCertainty/incomeRepeats; the stored income reflects them.
    expect(income).toMatchObject({
      title: 'Payday',
      amountMinor: 50_000,
      certainty: 'expected',
      repeats: 'monthly',
    });
    // Future-dated expected income is NOT counted into what's available now (only cash on hand is).
    expect(buildLocalRouteSummary(state).availableNowMinor).toBe(10_000);

    // Even without an explicit certainty, a future income date defaults to 'expected'.
    const inferred = createQuickEstimateLocalLedgerState('2026-06-22', {
      billAmountText: '0',
      billDate: '2026-07-01',
      billTitle: 'None',
      cashNowText: '100.00',
      incomeAmountText: '500',
      incomeDate: '2026-06-30',
      incomeTitle: 'Payday',
    });
    expect(
      inferred.transactions.find((transaction) => transaction.amountMinor > 0)?.certainty,
    ).toBe('expected');
  });
});
