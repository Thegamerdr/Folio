import { validateMeloRenderableOutput } from '@folio/melo-policy';
import { describe, expect, it } from 'vitest';

import {
  addManualTransaction,
  addPlannedCommitment,
  applyMeloImportSuggestion,
  createEmptyLocalLedgerState,
  createInitialLocalLedgerState,
  editImportDraft,
  stageStatementImport,
} from './localLedger.js';
import { buildLocalTimelineModel } from './localTimelineAdapter.js';

const bannedSurfaceWords = /\bconfidence\b|confidence_|_confidence|\bscore\b|\bready\b/i;
const bannedInternalSurfaceCopy =
  /canonical repository|canonical timeline row|canonical current balance|canonical balance observation|canonical records|canonical inputs/i;

describe('local canonical timeline adapter', () => {
  it('projects canonical repository collections into the primary local timeline model', () => {
    const timeline = buildLocalTimelineModel(createInitialLocalLedgerState('2026-06-22'), {
      privateExampleMode: true,
    });

    expect(timeline.sourceLabel).toBe('Private example');
    expect(timeline.factCount).toBe(1);
    expect(timeline.expectationCount).toBe(3);
    expect(timeline.reviewCount).toBeGreaterThanOrEqual(2);
    expect(timeline.events.map((event) => event.kind)).toEqual(
      expect.arrayContaining([
        'confirmed-record',
        'imported-claim',
        'meaning-event',
        'expectation',
        'commitment',
        'planner-item',
        'plan-change',
        'audit-change',
      ]),
    );
    expect(timeline.events.every((event) => event.evidence.provenanceSummary.length > 0)).toBe(
      true,
    );
    expect(timeline.accessibilitySummary).toContain('1 confirmed financial record');
    expect(validateMeloRenderableOutput(timeline.meloBriefingText).renderable).toBe(true);
    expect(JSON.stringify(timeline)).not.toMatch(bannedSurfaceWords);
    expect(JSON.stringify(timeline)).not.toMatch(bannedInternalSurfaceCopy);
  });

  it('renders same-day manual records as confirmed facts without hiding audit context', () => {
    const ledger = addManualTransaction(createEmptyLocalLedgerState('2026-06-22'), {
      amountText: '8.50',
      kind: 'spend',
      title: 'Lunch',
    });
    const timeline = buildLocalTimelineModel(ledger);

    expect(timeline.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: '-\u00a38.50',
          day: 'Today',
          evidence: expect.objectContaining({
            provenanceId: expect.any(String),
            sourceRecordId: expect.any(String),
          }),
          kind: 'confirmed-record',
          title: 'Lunch',
          tone: 'confirmed',
        }),
        expect.objectContaining({
          kind: 'audit-change',
          title: 'manual added',
        }),
      ]),
    );
  });

  it('keeps empty balance timeline rows human and source-aware', () => {
    const timeline = buildLocalTimelineModel(createEmptyLocalLedgerState('2026-06-22'));
    const serialized = JSON.stringify(timeline);

    expect(serialized).toContain('Balance needs source');
    expect(serialized).toContain('Needs a source before this can be treated as a real balance');
    expect(serialized).not.toContain('Calculated balance; derived from canonical inputs');
    expect(serialized).not.toContain('directly reported truth');
    expect(serialized).not.toContain('canonical current balance is available');
    expect(serialized).not.toContain('A canonical balance observation');
    expect(serialized).not.toMatch(bannedInternalSurfaceCopy);
  });

  it('renders future local commitments as expected and obligation timeline items', () => {
    const ledger = addPlannedCommitment(createEmptyLocalLedgerState('2026-06-22'), {
      amountText: '25.00',
      date: '2026-06-24',
      title: 'Dentist',
    });
    const timeline = buildLocalTimelineModel(ledger);

    expect(timeline.factCount).toBe(0);
    expect(timeline.expectationCount).toBe(1);
    expect(timeline.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: '-\u00a325',
          day: 'Wed',
          detail: expect.stringContaining('not a confirmed fact'),
          kind: 'expectation',
          title: 'Dentist',
          tone: 'estimated',
        }),
        expect.objectContaining({
          amount: '-\u00a325',
          kind: 'commitment',
          kindLabel: 'Obligation',
          title: 'Dentist',
        }),
      ]),
    );
    expect(JSON.stringify(timeline)).not.toContain('Money event linked');
    expect(JSON.stringify(timeline)).not.toContain('canonical event');
  });

  it('keeps unconfirmed imports as review items until the user decides', () => {
    const ledger = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const timeline = buildLocalTimelineModel(ledger);
    const importRow = timeline.events.find((event) => event.kind === 'imported-claim');

    expect(timeline.factCount).toBe(0);
    expect(importRow).toMatchObject({
      detail: expect.stringContaining('Imported claim'),
      title: 'Coffee',
      tone: 'attention',
    });
    expect(importRow?.evidence.actionPath).toBe('review');
    expect(importRow?.evidence.reviewState).toBe('needs-review');
    expect(JSON.stringify(timeline)).not.toMatch(bannedSurfaceWords);
  });

  it('turns explicit corrections into decision rows', () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-21,Cfee,-3.25',
    ).state;
    const edited = editImportDraft(staged, staged.importDrafts[0]?.rowId ?? '', {
      amountText: '-4.50',
      date: '2026-06-22',
      interpretation: 'Coffee corrected',
    });
    const timeline = buildLocalTimelineModel(edited);

    expect(timeline.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'decision-record',
          tone: 'confirmed',
        }),
      ]),
    );
  });

  it('models Melo proposals as review-only timeline rows', () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const suggested = applyMeloImportSuggestion(staged, staged.importDrafts[0]?.rowId ?? '');
    const timeline = buildLocalTimelineModel(suggested);

    expect(timeline.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.stringContaining('cannot write directly'),
          evidence: expect.objectContaining({
            actionPath: 'review',
            reviewState: 'needs-review',
          }),
          kind: 'melo-proposal',
          tone: 'attention',
        }),
      ]),
    );
  });
});
