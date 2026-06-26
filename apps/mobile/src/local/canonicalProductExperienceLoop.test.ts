import { validateMeloRenderableOutput } from '@folio/melo-policy';
import {
  InMemoryDatabaseDriver,
  migrateCanonicalSnapshotToSqliteRepository,
  openSqliteCanonicalRepository,
  type CanonicalRepositorySnapshot,
} from '@folio/storage';
import { describe, expect, it } from 'vitest';

import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import {
  acceptImportDraftThroughCanonicalRepository,
  createQuickEstimateThroughCanonicalRepository,
  editImportDraftThroughCanonicalRepository,
  recordRecoverySpendThroughCanonicalRepository,
  rejectImportDraftThroughCanonicalRepository,
  stageStatementImportThroughCanonicalRepository,
} from './canonicalLedgerMutations.js';
import {
  buildLocalLedgerExportPayload,
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  searchLocalLedgerEvidenceRecords,
} from './localLedger.js';
import { buildLocalPlansModel } from './localPlansAdapter.js';
import { buildLocalCalendarModel } from './localCalendarAdapter.js';
import {
  buildLocalRecoverySpendScenarioPreview,
  editLocalRecoverySpendScenarioPreview,
} from './localScenarioAdapter.js';
import { buildCanonicalTimelineModel, buildLocalTimelineModel } from './localTimelineAdapter.js';
import { buildLocalTodayModel } from './localTodayAdapter.js';
import {
  dataControlTrustCopy,
  firstMinuteActions,
  firstMinuteMeloBriefing,
  firstMinutePrimaryMessage,
  importEntryTrustCopy,
  importReviewActionCopy,
  productExperienceCopyIsPolicySafe,
  quickEstimateEnoughCopy,
  sampleBriefingCards,
  sampleBriefingMelo,
} from './productExperienceLoop.js';
import {
  productExperienceRouteEvidence,
  productExperienceScreenshotStatus,
} from './productExperienceEvidence.js';

const bannedSurfaceWords =
  /\bconfidence\b|confidence_|_confidence|\bscore\b|\breadiness\b|\badvice\b|\bfailed\b|\bfailure\b/i;

describe('canonical product experience loop pass 01', () => {
  it('starts from an empty local workspace without financial records', () => {
    const empty = createEmptyLocalLedgerState('2026-06-22');
    const snapshot = createCanonicalRepositoryForLocalLedgerState(empty).snapshot();

    expect(firstMinutePrimaryMessage).toBe(
      'Folio helps you understand where you stand, what changed, and what happens next.',
    );
    expect(firstMinuteActions.map((action) => action.label)).toEqual([
      'Use a bank statement',
      'Add a few numbers',
      'Try fake data',
    ]);
    expect(snapshot.collections.transactions).toEqual([]);
    expect(snapshot.collections.events).toEqual([]);
    expect(snapshot.collections.expectations).toEqual([]);
    expect(snapshot.collections.plans).toEqual([]);
    expect(snapshot.collections.importDrafts).toEqual([]);
    expect(snapshot.collections.sourceRecords).toHaveLength(1);
    expect(firstMinuteMeloBriefing).toMatchObject({
      canWriteDirectly: false,
      advicePolicy: expect.objectContaining({ allowed: true }),
    });
  });

  it('keeps sample briefing as labelled copy instead of canonical records', () => {
    const before = createCanonicalRepositoryForLocalLedgerState(
      createEmptyLocalLedgerState('2026-06-22'),
    ).snapshot();
    const after = createCanonicalRepositoryForLocalLedgerState(
      createEmptyLocalLedgerState('2026-06-22'),
    ).snapshot();

    expect(sampleBriefingMelo.labels).toEqual(['Example only', 'Not your data', 'Nothing saved']);
    expect(sampleBriefingCards.map((card) => card.title)).toEqual([
      'What changed',
      'Coming up',
      'Still protected',
      'Needs review',
    ]);
    expect(sampleBriefingMelo).toMatchObject({
      affectedFinances: false,
      canWriteDirectly: false,
      advicePolicy: expect.objectContaining({ allowed: true }),
    });
    expect(after.collections).toEqual(before.collections);

    const empty = createEmptyLocalLedgerState('2026-06-22');
    const route = buildLocalRouteSummary(empty);
    const emptyTimeline = buildCanonicalTimelineModel(after, { asOfDate: empty.asOfDate });
    const sampleTitles = sampleBriefingCards.map((card) => card.title);
    const exportPayload = buildLocalLedgerExportPayload(empty, route);
    expect(buildLocalTodayModel(empty, route).whatChanged.items).toEqual([]);
    expect(emptyTimeline.events.map((event) => event.title)).not.toEqual(
      expect.arrayContaining(sampleTitles),
    );
    expect(buildLocalPlansModel(empty, route).planRows).toEqual([]);
    expect(buildLocalCalendarModel(empty, route).agenda.map((event) => event.title)).not.toEqual(
      expect.arrayContaining(sampleTitles),
    );
    expect(JSON.stringify(exportPayload)).not.toContain('Example only');
    expect(JSON.stringify(exportPayload)).not.toContain('Not your data');
    expect(JSON.stringify(exportPayload)).not.toContain('Nothing saved');
  });

  it('stages imports without changing Today position or Plans', () => {
    const empty = createEmptyLocalLedgerState('2026-06-22');
    const beforeToday = buildLocalTodayModel(empty, buildLocalRouteSummary(empty));
    const staged = stageStatementImportThroughCanonicalRepository(
      empty,
      'Date,Description,Amount\n2026-06-22,Coffee,-3.25',
    ).state;
    const afterToday = buildLocalTodayModel(staged, buildLocalRouteSummary(staged));
    const plans = buildLocalPlansModel(staged, buildLocalRouteSummary(staged));
    const snapshot = createCanonicalRepositoryForLocalLedgerState(staged).snapshot();

    expect(importEntryTrustCopy).toEqual([
      'Rows wait for review before they are added.',
      'Nothing changes your picture until you accept it.',
    ]);
    expect(importReviewActionCopy.map((action) => action.label)).toEqual([
      'Add',
      'Edit',
      'Ignore',
      'Duplicate',
      'Income',
      'Bill',
      'Debt payment',
      'Refund',
      'Later',
      'Wrong workspace',
      'Not mine',
      'Read wrong',
      'Transfer',
    ]);
    expect(snapshot.collections.importDrafts).toHaveLength(1);
    expect(snapshot.collections.importedClaims).toHaveLength(1);
    expect(snapshot.collections.transactions).toEqual([]);
    expect(snapshot.collections.events).toEqual([]);
    expect(afterToday.position.availableMinor).toBe(beforeToday.position.availableMinor);
    expect(plans.planRows).toEqual([]);
  });

  it('accepts and edits imports as canonical facts with provenance and audit', () => {
    const staged = stageStatementImportThroughCanonicalRepository(
      createEmptyLocalLedgerState('2026-06-22'),
      'Date,Description,Amount\n2026-06-22,Cfee,-3.25',
    ).state;
    const edited = editImportDraftThroughCanonicalRepository(
      staged,
      staged.importDrafts[0]?.rowId ?? '',
      {
        amountText: '-3.25',
        date: '2026-06-22',
        interpretation: 'Coffee',
      },
    );
    const accepted = acceptImportDraftThroughCanonicalRepository(
      edited,
      edited.importDrafts[0]?.rowId ?? '',
    );
    const snapshot = createCanonicalRepositoryForLocalLedgerState(accepted).snapshot();

    expect(snapshot.collections.transactions).toEqual([
      expect.objectContaining({
        description: 'Coffee',
        provenanceId: expect.any(String),
      }),
    ]);
    expect(snapshot.collections.importedClaims).toEqual([
      expect.objectContaining({
        acceptedTransactionId: snapshot.collections.transactions[0]?.id,
        originalText: '2026-06-22 / Cfee / -3.25',
      }),
    ]);
    expect(snapshot.collections.userCorrections).toContainEqual(
      expect.objectContaining({ kind: 'import-row-edit' }),
    );
    expect(snapshot.collections.auditLog).toContainEqual(
      expect.objectContaining({ action: 'import_confirmed' }),
    );
  });

  it('retains rejected imports as searchable evidence only and recognises future duplicates', () => {
    const csv = 'Date,Description,Amount\n2026-06-22,Coffee,-3.25';
    const staged = stageStatementImportThroughCanonicalRepository(
      createEmptyLocalLedgerState('2026-06-22'),
      csv,
    ).state;
    const rejected = rejectImportDraftThroughCanonicalRepository(
      staged,
      staged.importDrafts[0]?.rowId ?? '',
      { reason: 'duplicate' },
    );
    const route = buildLocalRouteSummary(rejected);
    const restaged = stageStatementImportThroughCanonicalRepository(rejected, csv).state;
    const snapshot = createCanonicalRepositoryForLocalLedgerState(rejected).snapshot();

    expect(snapshot.collections.transactions).toEqual([]);
    expect(snapshot.collections.events).toEqual([]);
    expect(snapshot.collections.importedClaims).toEqual([
      expect.objectContaining({
        nonFinancial: true,
        rejectionReason: 'duplicate',
        state: 'rejected',
      }),
    ]);
    expect(searchLocalLedgerEvidenceRecords(rejected, route, 'Coffee')).toContainEqual(
      expect.objectContaining({ id: expect.stringMatching(/^rejected-import-/) }),
    );
    expect(restaged.importDrafts[0]?.reasons.join(' ')).toContain('previously rejected: duplicate');
  });

  it('creates a first real briefing from the three-fact manual path', () => {
    const manual = createQuickEstimateThroughCanonicalRepository('2026-06-22', {
      billAmountText: '875',
      billDate: '2026-07-01',
      billTitle: 'Rent',
      cashNowText: '1190.47',
      incomeAmountText: '1840',
      incomeDate: '2026-06-27',
      incomeTitle: 'Payday',
    });
    const route = buildLocalRouteSummary(manual);
    const today = buildLocalTodayModel(manual, route);
    const snapshot = createCanonicalRepositoryForLocalLedgerState(manual).snapshot();

    expect(quickEstimateEnoughCopy).toBe(
      'This is enough for a first picture. You can add more later.',
    );
    expect(snapshot.collections.sourceRecords.length).toBeGreaterThan(1);
    expect(snapshot.collections.provenance.length).toBeGreaterThan(1);
    expect(snapshot.collections.auditLog).toContainEqual(
      expect.objectContaining({
        action: 'manual_added',
        subjectId: 'history_quick_estimate',
      }),
    );
    expect(snapshot.collections.timelineEntries.length).toBeGreaterThan(0);
    expect(today.headline).toBeTruthy();
    expect(validateMeloRenderableOutput(today.meloBriefingText).renderable).toBe(true);
  });

  it('rebuilds Timeline from canonical SQLite and keeps recovery previews non-mutating', async () => {
    const manual = createQuickEstimateThroughCanonicalRepository('2026-06-22', {
      billAmountText: '875',
      billDate: '2026-07-01',
      billTitle: 'Rent',
      cashNowText: '1190.47',
      incomeAmountText: '1840',
      incomeDate: '2026-06-27',
      incomeTitle: 'Payday',
    });
    const route = buildLocalRouteSummary(manual);
    const preview = buildLocalRecoverySpendScenarioPreview(manual, route, {
      amountMinor: 42000,
      label: 'Repair',
    });
    const editedPreview = editLocalRecoverySpendScenarioPreview(manual, route, preview, {
      amountMinor: 39000,
      label: 'Repair timing',
    });
    const before = createCanonicalRepositoryForLocalLedgerState(manual).snapshot();
    const reloaded = await reloadCanonicalSnapshot(before);
    const timeline = buildCanonicalTimelineModel(reloaded, { asOfDate: manual.asOfDate });
    const afterPreview = createCanonicalRepositoryForLocalLedgerState(manual).snapshot();

    expect(preview.scenario.status).toBe('previewed');
    expect(editedPreview.scenario.title).toContain('edited preview');
    expect(afterPreview.collections).toEqual(before.collections);
    expect(timeline.events.length).toBeGreaterThan(0);
    expect(timeline.events.every((event) => event.evidence.why.length > 0)).toBe(true);
    expect(validateMeloRenderableOutput(timeline.meloBriefingText).renderable).toBe(true);
  });

  it('accepts recovery through user action while preview remains separate first', () => {
    const manual = createQuickEstimateThroughCanonicalRepository('2026-06-22', {
      billAmountText: '875',
      billDate: '2026-07-01',
      billTitle: 'Rent',
      cashNowText: '1190.47',
      incomeAmountText: '1840',
      incomeDate: '2026-06-27',
      incomeTitle: 'Payday',
    });
    const route = buildLocalRouteSummary(manual);
    const preview = buildLocalRecoverySpendScenarioPreview(manual, route, {
      amountMinor: 39000,
      label: 'Repair',
    });
    const beforeAccept = createCanonicalRepositoryForLocalLedgerState(manual).snapshot();
    const accepted = recordRecoverySpendThroughCanonicalRepository(manual, {
      amountText: '390.00',
      kind: 'spend',
      title: 'Repair',
    });
    const afterAccept = createCanonicalRepositoryForLocalLedgerState(accepted).snapshot();

    expect(preview.writesImmediately).toBe(false);
    expect(beforeAccept.collections.scenarios).toEqual([]);
    expect(afterAccept.collections.scenarios).toContainEqual(
      expect.objectContaining({ status: 'accepted' }),
    );
    expect(afterAccept.collections.decisions).toContainEqual(
      expect.objectContaining({ kind: 'accept-scenario' }),
    );
    expect(afterAccept.collections.auditLog).toContainEqual(
      expect.objectContaining({ action: 'recovery_recorded' }),
    );
  });

  it('keeps trust and Melo copy policy-safe without account, cloud, AI, Open Banking or Business mode', () => {
    const recovered = recordRecoverySpendThroughCanonicalRepository(
      createQuickEstimateThroughCanonicalRepository('2026-06-22', {
        billAmountText: '875',
        billDate: '2026-07-01',
        billTitle: 'Rent',
        cashNowText: '1190.47',
        incomeAmountText: '1840',
        incomeDate: '2026-06-27',
        incomeTitle: 'Payday',
      }),
      {
        amountText: '390.00',
        kind: 'spend',
        title: 'Repair',
      },
    );
    const recoveredRoute = buildLocalRouteSummary(recovered);
    const recoveredToday = buildLocalTodayModel(recovered, recoveredRoute);
    const recoveredTimeline = buildLocalTimelineModel(recovered);
    const recoveredPlans = buildLocalPlansModel(recovered, recoveredRoute);
    const copy = [
      firstMinuteMeloBriefing.summary,
      sampleBriefingMelo.summary,
      ...importEntryTrustCopy,
      ...importReviewActionCopy.map((action) => `${action.label}: ${action.consequence}`),
      recoveredToday.meloBriefingText,
      recoveredTimeline.meloBriefingText,
      ...recoveredPlans.meloPlanBriefings.map((briefing) => briefing.summary),
      quickEstimateEnoughCopy,
      ...dataControlTrustCopy,
    ].join(' ');

    expect(productExperienceCopyIsPolicySafe()).toBe(true);
    expect(validateMeloRenderableOutput(recoveredToday.meloBriefingText).renderable).toBe(true);
    expect(validateMeloRenderableOutput(recoveredTimeline.meloBriefingText).renderable).toBe(true);
    expect(
      recoveredPlans.meloPlanBriefings.every(
        (briefing) =>
          briefing.canWriteDirectly === false &&
          validateMeloRenderableOutput(briefing.summary).renderable,
      ),
    ).toBe(true);
    expect(dataControlTrustCopy.join(' ')).toContain(
      'Cloud, AI, Open Banking and Business mode are not required',
    );
    expect(copy).not.toMatch(bannedSurfaceWords);
  });

  it('exports route evidence for the requested product experience captures', () => {
    expect(productExperienceScreenshotStatus).toMatchObject({
      captured: true,
      manifestPath: 'apps/mobile/evidence/mobile-shell-visual-pass/manifest.json',
      method: expect.stringContaining('static HTML render harness'),
      screenshotRoot: 'apps/mobile/evidence/mobile-shell-visual-pass/screenshots',
    });
    expect(productExperienceScreenshotStatus.requiredSurfaceIds).toEqual([
      'empty-first-launch',
      'sample-briefing',
      'import-entry',
      'staged-import-review',
      'rejected-import-state',
      'minimal-manual-path',
      'first-real-today-briefing',
      'timeline',
      'calendar',
      'plans',
      'recovery-preview',
      'data-control',
      'melo-surface',
    ]);
    expect(productExperienceRouteEvidence.map((evidence) => evidence.id)).toEqual([
      'empty-first-launch',
      'sample-briefing',
      'import-entry',
      'staged-import-review',
      'accepted-import',
      'edited-import',
      'rejected-import-state',
      'rejected-duplicate-detection',
      'minimal-manual-entry',
      'first-real-today-briefing',
      'timeline',
      'calendar',
      'plans',
      'recovery-preview',
      'accepted-recovery',
      'data-control',
      'melo-surface',
    ]);
    expect(
      productExperienceRouteEvidence.every(
        (evidence) => evidence.proves.length > 0 && evidence.canonicalGuards.length > 0,
      ),
    ).toBe(true);
    expect(JSON.stringify(productExperienceRouteEvidence)).not.toMatch(bannedSurfaceWords);
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
