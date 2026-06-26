import {
  createEntityVersion,
  createInstantString,
  createScenarioId,
  type Scenario,
} from '@folio/domain';
import { validateMeloRenderableOutput } from '@folio/melo-policy';
import {
  InMemoryDatabaseDriver,
  migrateCanonicalSnapshotToSqliteRepository,
  openSqliteCanonicalRepository,
  type CanonicalRepositorySnapshot,
} from '@folio/storage';
import { describe, expect, it } from 'vitest';

import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { buildCanonicalTodayModel } from './localTodayAdapter.js';
import { buildCanonicalTimelineModel } from './localTimelineAdapter.js';
import {
  applyMeloImportSuggestion,
  createEmptyLocalLedgerState,
  dismissImportDraft,
  stageStatementImport,
} from './localLedger.js';

const bannedSurfaceWords = /\bconfidence\b|confidence_|_confidence|\bscore\b|\bready\b/i;

describe('canonical Today and Timeline from SQLite repository', () => {
  it('rebuilds Today and Timeline from canonical SQLite after reload', async () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
      {
        byteSize: 64,
        filename: 'statement.csv',
        mediaType: 'text/csv',
        storageState: 'pasted_text',
      },
    ).state;
    const suggested = applyMeloImportSuggestion(staged, staged.importDrafts[0]?.rowId ?? '');
    const reloaded = await reloadCanonicalSnapshot(
      withScenarioPreview(createCanonicalRepositoryForLocalLedgerState(suggested).snapshot()),
    );

    const today = buildCanonicalTodayModel(reloaded, {
      asOfDate: suggested.asOfDate,
    });
    const timeline = buildCanonicalTimelineModel(reloaded, { asOfDate: suggested.asOfDate });

    expect(reloaded.collections.parsedRows).toHaveLength(1);
    expect(reloaded.collections.importedClaims).toHaveLength(1);
    expect(reloaded.collections.documents).toHaveLength(1);
    expect(reloaded.collections.documentAttachments).toHaveLength(1);
    expect(reloaded.collections.documentAttachments[0]).toMatchObject({
      documentId: reloaded.collections.documents[0]?.id,
      targetKind: 'source-record',
    });
    expect(today.timeline.length).toBeGreaterThan(0);
    expect(timeline.events.length).toBeGreaterThan(0);
    expect(today.whatChanged.items.map((item) => item.category)).toEqual(
      expect.arrayContaining(['import', 'document', 'scenario', 'task']),
    );
    expect(timeline.events.map((event) => event.kind)).toEqual(
      expect.arrayContaining([
        'imported-claim',
        'document-attachment',
        'melo-proposal',
        'scenario-preview',
        'audit-change',
      ]),
    );
    expect(validateMeloRenderableOutput(today.meloBriefingText).renderable).toBe(true);
    expect(validateMeloRenderableOutput(timeline.meloBriefingText).renderable).toBe(true);
    expect(JSON.stringify({ today, timeline })).not.toMatch(bannedSurfaceWords);
    expect(JSON.stringify({ today, timeline })).not.toMatch(/local_ledger_/i);
  });

  it('exposes provenance or an explicit absence explanation for every timeline row', async () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const reloaded = await reloadCanonicalSnapshot(
      createCanonicalRepositoryForLocalLedgerState(staged).snapshot(),
    );
    const timeline = buildCanonicalTimelineModel(reloaded, { asOfDate: staged.asOfDate });

    expect(timeline.events.length).toBeGreaterThan(0);
    expect(
      timeline.events.every(
        (event) =>
          event.evidence.provenanceId !== undefined ||
          event.evidence.provenanceSummary.startsWith('No provenance'),
      ),
    ).toBe(true);
  });

  it('does not display imported claims or scenario previews as confirmed reality', async () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const reloaded = await reloadCanonicalSnapshot(
      withScenarioPreview(createCanonicalRepositoryForLocalLedgerState(staged).snapshot()),
    );
    const timeline = buildCanonicalTimelineModel(reloaded, { asOfDate: staged.asOfDate });
    const importedClaim = timeline.events.find((event) => event.kind === 'imported-claim');
    const scenarioPreview = timeline.events.find((event) => event.kind === 'scenario-preview');

    expect(importedClaim).toMatchObject({
      kindLabel: 'Import',
      tone: 'attention',
    });
    expect(importedClaim?.detail).toContain('review before it can become a confirmed fact');
    expect(scenarioPreview).toMatchObject({
      kindLabel: 'Scenario',
      tone: 'estimated',
    });
    expect(scenarioPreview?.detail).toContain('not reality');
    expect(timeline.events.filter((event) => event.kind === 'confirmed-record')).toHaveLength(0);
  });

  it('reloads rejected import evidence without surfacing it as financial reality', async () => {
    const staged = stageStatementImport(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const rejected = dismissImportDraft(staged, staged.importDrafts[0]?.rowId ?? '', {
      reason: 'duplicate',
    });
    const reloaded = await reloadCanonicalSnapshot(
      createCanonicalRepositoryForLocalLedgerState(rejected).snapshot(),
    );
    const today = buildCanonicalTodayModel(reloaded, { asOfDate: rejected.asOfDate });
    const timeline = buildCanonicalTimelineModel(reloaded, { asOfDate: rejected.asOfDate });

    expect(reloaded.collections.importedClaims).toEqual([
      expect.objectContaining({
        nonFinancial: true,
        rejectionReason: 'duplicate',
        state: 'rejected',
      }),
    ]);
    expect(reloaded.collections.importDrafts).toEqual([
      expect.objectContaining({
        nonFinancial: true,
        reviewState: 'dismissed',
        userConfirmationState: 'rejected',
      }),
    ]);
    expect(reloaded.collections.transactions).toEqual([]);
    expect(reloaded.collections.events).toEqual([]);
    expect(reloaded.collections.plans).toEqual([]);
    expect(today.reviewCopy).toBe('No rows are waiting for review right now.');
    expect(today.whatChanged.items.map((item) => item.category)).not.toContain('import');
    expect(today.briefingItems.map((item) => item.category)).not.toContain('import');
    expect(timeline.events.map((event) => event.kind)).not.toContain('imported-claim');
    expect(timeline.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'decision-record' }),
        expect.objectContaining({ kind: 'audit-change' }),
      ]),
    );
    expect(JSON.stringify({ today, timeline })).not.toMatch(bannedSurfaceWords);
  });
});

async function reloadCanonicalSnapshot(
  snapshot: CanonicalRepositorySnapshot,
): Promise<CanonicalRepositorySnapshot> {
  const driver = new InMemoryDatabaseDriver();
  await migrateCanonicalSnapshotToSqliteRepository(driver, snapshot);
  const repository = await openSqliteCanonicalRepository(driver, snapshot.workspaceId);
  return repository.snapshot();
}

function withScenarioPreview(snapshot: CanonicalRepositorySnapshot): CanonicalRepositorySnapshot {
  const scenario: Scenario = {
    id: createScenarioId('scenario_preview_repair'),
    workspaceId: snapshot.workspaceId,
    title: 'Repair recovery preview',
    status: 'previewed',
    authorityState: 'hypothetical',
    createdAt: createInstantString('2026-06-22T12:00:00.000Z'),
    version: createEntityVersion({ dataVersion: 'test:canonical-experience-sqlite' }),
    assumptionIds: [],
    affectedPlanIds: [],
  };

  return {
    ...snapshot,
    collections: {
      ...snapshot.collections,
      scenarios: [...snapshot.collections.scenarios, scenario],
    },
  };
}
