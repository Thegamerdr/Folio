import { describe, expect, it } from 'vitest';

import {
  buildLocalRouteSummary,
  confirmImportDraft,
  createEmptyLocalLedgerState,
  stageStatementTransactions,
  type StagedStatementTransaction,
} from './localLedger.js';
import { buildLocalTodayModel } from './localTodayAdapter.js';

const imageSource = {
  filename: 'statement-photo.jpg',
  mediaType: 'image/jpeg',
  byteSize: 240_000,
  storageState: 'copied_to_app_cache' as const,
  uri: 'file:///cache/statement-photo.jpg',
};

const aiTransactions: readonly StagedStatementTransaction[] = [
  { dateIso: '2026-06-24', merchant: 'Tesco Stores', amountMinor: 4_250, direction: 'spend' },
  { dateIso: '2026-06-25', merchant: 'Marlowe Studios', amountMinor: 185_000, direction: 'income' },
];

describe('stageStatementTransactions — AI-read transactions → review drafts', () => {
  it('builds one ready-to-confirm draft per transaction, keeping the exact pence and sign', () => {
    const empty = createEmptyLocalLedgerState('2026-06-26');
    const { state, addedDraftCount } = stageStatementTransactions(empty, aiTransactions, imageSource);

    expect(addedDraftCount).toBe(2);
    expect(state.importDrafts).toHaveLength(2);

    const spend = state.importDrafts.find((d) => d.interpretation === 'Tesco Stores');
    const income = state.importDrafts.find((d) => d.interpretation === 'Marlowe Studios');
    // Exact amounts preserved, sign applied from direction — never re-parsed from text.
    expect(spend?.amountMinor).toBe(-4_250);
    expect(income?.amountMinor).toBe(185_000);
    expect(spend?.date).toBe('2026-06-24');
    // A glance-to-confirm draft: ready, requested, no parser noise.
    expect(spend?.reviewState).toBe('ready-for-user-confirmation');
    expect(spend?.userConfirmationState).toBe('requested');
    expect(spend?.parserIssues).toHaveLength(0);
  });

  it('adds nothing to Today or the route until the user confirms a draft', () => {
    const empty = createEmptyLocalLedgerState('2026-06-26');
    const before = buildLocalRouteSummary(empty);
    const { state } = stageStatementTransactions(empty, aiTransactions, imageSource);
    const after = buildLocalRouteSummary(state);

    // Staging never commits: zero confirmed records, the money picture is unchanged.
    expect(state.transactions).toHaveLength(0);
    expect(after.confirmedTransactionCount).toBe(0);
    expect(after.availableNowMinor).toBe(before.availableNowMinor);
    expect(buildLocalTodayModel(state, after).position.actualNetMinor).toBe(0);
  });

  it('moves a transaction into Today only once its draft is confirmed', () => {
    const empty = createEmptyLocalLedgerState('2026-06-26');
    const { state } = stageStatementTransactions(empty, aiTransactions, imageSource);
    const spend = state.importDrafts.find((d) => d.interpretation === 'Tesco Stores');
    expect(spend).toBeDefined();

    const confirmed = confirmImportDraft(state, spend!.rowId);
    const route = buildLocalRouteSummary(confirmed);

    expect(confirmed.transactions).toHaveLength(1);
    expect(confirmed.transactions[0]?.amountMinor).toBe(-4_250);
    expect(route.confirmedTransactionCount).toBe(1);
  });

  it('records the read statement as a saved document so it can be reopened', () => {
    const empty = createEmptyLocalLedgerState('2026-06-26');
    const { state, documentStage } = stageStatementTransactions(empty, aiTransactions, imageSource);

    expect(documentStage).toBeDefined();
    expect(state.documentStages).toHaveLength(1);
    expect(state.documentStages[0]?.sourceType).toBe('image');
    expect(state.documentStages[0]?.uri).toBe(imageSource.uri);
  });

  it('drops junk entries (empty merchant, zero amount, unparseable date) silently', () => {
    const empty = createEmptyLocalLedgerState('2026-06-26');
    const junk: readonly StagedStatementTransaction[] = [
      { dateIso: '2026-06-24', merchant: '   ', amountMinor: 1_000, direction: 'spend' },
      { dateIso: '2026-06-24', merchant: 'Zero', amountMinor: 0, direction: 'spend' },
      { dateIso: 'not-a-date', merchant: 'Bad date', amountMinor: 500, direction: 'spend' },
      { dateIso: '2026-06-24', merchant: 'Keep me', amountMinor: 999, direction: 'spend' },
    ];
    const { state, addedDraftCount } = stageStatementTransactions(empty, junk);

    expect(addedDraftCount).toBe(1);
    expect(state.importDrafts[0]?.interpretation).toBe('Keep me');
  });

  it('de-duplicates against drafts already waiting (re-reading the same statement adds nothing)', () => {
    const empty = createEmptyLocalLedgerState('2026-06-26');
    const first = stageStatementTransactions(empty, aiTransactions, imageSource);
    const second = stageStatementTransactions(first.state, aiTransactions, imageSource);

    expect(second.addedDraftCount).toBe(0);
    // Still only the two original drafts — no doubles.
    expect(second.state.importDrafts).toHaveLength(2);
  });

  it('returns an empty result for an empty transaction list without throwing', () => {
    const empty = createEmptyLocalLedgerState('2026-06-26');
    const { state, addedDraftCount } = stageStatementTransactions(empty, []);

    expect(addedDraftCount).toBe(0);
    expect(state.importDrafts).toHaveLength(0);
    expect(state.transactions).toHaveLength(0);
  });
});
