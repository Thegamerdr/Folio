import { validateMeloRenderableOutput } from '@folio/melo-policy';
import { describe, expect, it } from 'vitest';

import {
  addManualTransaction,
  addPlannedCommitment,
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  createInitialLocalLedgerState,
  stageStatementImport,
} from './localLedger.js';
import { buildLocalTodayModel } from './localTodayAdapter.js';

const bannedSurfaceWords = /\bconfidence\b|confidence_|_confidence|\bscore\b|\bready\b/i;
const bannedInternalSurfaceCopy =
  /canonical repository|canonical current balance|canonical balance observation|canonical balance data|canonical records/i;

describe('local Today engine adapter', () => {
  it('builds Today from canonical position, projection, briefing and evidence models', () => {
    const ledger = createInitialLocalLedgerState('2026-06-22');
    const route = buildLocalRouteSummary(ledger);
    const today = buildLocalTodayModel(ledger, route, { privateExampleMode: true });

    expect(today.sourceLabel).toBe('Private example');
    expect(today.headline).toBe("You're covered through Sat 27 Jun.");
    expect(today.position.assumptions).toContain(
      'Confirmed records, imported claims and future expectations are separated before Today is built.',
    );
    expect(today.projection.countedIds).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^transaction_/),
        expect.stringMatching(/^expectation_/),
      ]),
    );
    expect(today.projection.protectedFloorMinor).toBe(91_500);
    expect(today.briefingItems.map((item) => item.id)).toContain('today_review_queue');
    expect(today.whatChanged.items.length).toBeGreaterThan(0);
    expect(today.timeline.map((item) => item.title)).toContain('Payday');
    expect(today.timeline.every((item) => item.evidence.provenanceSummary.length > 0)).toBe(true);
    expect(validateMeloRenderableOutput(today.meloBriefingText).renderable).toBe(true);
    expect(JSON.stringify(today)).not.toMatch(bannedSurfaceWords);
    expect(JSON.stringify(today)).not.toMatch(bannedInternalSurfaceCopy);
  });

  it('keeps future commitments as expected rows instead of same-day facts', () => {
    const ledger = addPlannedCommitment(createEmptyLocalLedgerState('2026-06-22'), {
      amountText: '25.00',
      date: '2026-06-24',
      title: 'Dentist',
    });
    const today = buildLocalTodayModel(ledger);

    expect(today.position.actualNetMinor).toBe(0);
    expect(today.position.expectedNetMinor).toBe(-2_500);
    expect(today.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          day: 'Wed',
          detail: expect.stringContaining('Protected expected payment'),
          evidence: expect.objectContaining({
            authorityState: 'user-confirmed',
            provenanceId: expect.any(String),
          }),
          title: 'Dentist',
          tone: 'estimated',
        }),
      ]),
    );
  });

  it('keeps a cleared empty workspace from looking like a user-confirmed zero balance', () => {
    const today = buildLocalTodayModel(createEmptyLocalLedgerState('2026-06-23'));
    const serialized = JSON.stringify(today);

    expect(today.balanceEvidence[0]).toMatchObject({
      authorityState: 'estimated',
      reviewState: 'needs-review',
      sourceKind: 'system-derived',
      sourceLabel: 'Empty workspace baseline for 2026-06-23',
    });
    expect(serialized).toContain('Empty workspace baseline');
    expect(serialized).not.toContain('Opening balance for 2026-06-23');
    expect(serialized).not.toMatch(/Opening balance for 2026-06-23.*user confirmed/iu);
    expect(serialized).not.toMatch(bannedInternalSurfaceCopy);
  });

  it('builds bad-month recovery copy from canonical route consequences', () => {
    const ledger = {
      ...createEmptyLocalLedgerState('2026-06-22'),
      cashOnHandMinor: 5_000,
      transactions: [
        {
          amountMinor: -10_000,
          date: '2026-06-24',
          id: 'manual_future_repair',
          original: 'Repair -100.00 due 2026-06-24',
          protected: true,
          source: 'manual' as const,
          status: 'confirmed' as const,
          title: 'Repair',
        },
      ],
    };
    const today = buildLocalTodayModel(ledger);

    expect(today.headline).toBe('This route needs attention.');
    expect(today.projection.riskDetected).toBe(true);
    expect(today.recovery.active).toBe(true);
    expect(today.recovery.summary).toContain('changed');
    expect(today.recovery.pathForward).toContain(
      'Preview a recovery scenario before saving changes',
    );
    expect(today.recovery.scenarioPreviewRequired).toBe(true);
  });

  it('keeps import review in the briefing without saving it as a fact', () => {
    const ledger = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const today = buildLocalTodayModel(ledger);

    expect(today.position.actualNetMinor).toBe(0);
    expect(today.briefingItems[0]).toMatchObject({
      id: 'today_review_queue',
      urgency: 'urgent',
    });
    expect(today.timeline[0]).toMatchObject({
      detail: expect.stringContaining('Imported claim'),
      title: 'Coffee',
      tone: 'attention',
    });
    expect(today.timeline[0]?.evidence.actionPath).toBe('review');
    expect(JSON.stringify(today)).not.toMatch(bannedSurfaceWords);
  });

  it('includes same-day manual records in actual movement with provenance', () => {
    const ledger = addManualTransaction(createEmptyLocalLedgerState('2026-06-22'), {
      amountText: '8.50',
      kind: 'spend',
      title: 'Lunch',
    });
    const today = buildLocalTodayModel(ledger);

    expect(today.position.actualNetMinor).toBe(-850);
    expect(today.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          day: 'Today',
          detail: expect.stringContaining('Lunch -\u00a38.50'),
          evidence: expect.objectContaining({
            provenanceId: expect.any(String),
            sourceRecordId: expect.any(String),
          }),
          title: 'Lunch',
          tone: 'confirmed',
        }),
      ]),
    );
  });
});
