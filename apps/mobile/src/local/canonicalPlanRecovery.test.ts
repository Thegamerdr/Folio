import { validateMeloRenderableOutput } from '@folio/melo-policy';
import {
  InMemoryDatabaseDriver,
  migrateCanonicalSnapshotToSqliteRepository,
  openSqliteCanonicalRepository,
  type CanonicalRepositorySnapshot,
} from '@folio/storage';
import { describe, expect, it } from 'vitest';

import {
  addManualTransaction,
  addPlannedCommitment,
  addRecoverySpend,
  buildLocalRouteSummary,
  createEmptyLocalLedgerState,
  type LocalLedgerState,
} from './localLedger.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { buildLocalCalendarModel } from './localCalendarAdapter.js';
import { buildLocalPlansModel } from './localPlansAdapter.js';
import {
  buildLocalRecoverySpendScenarioPreview,
  editLocalRecoverySpendScenarioPreview,
} from './localScenarioAdapter.js';
import { buildLocalTimelineModel } from './localTimelineAdapter.js';
import { buildLocalTodayModel } from './localTodayAdapter.js';

const bannedSurfaceWords =
  /\bconfidence\b|confidence_|_confidence|\bscore\b|\bfailed\b|\bfailure\b|\badvice\b/i;

describe('canonical plans and recovery', () => {
  it('persists plans, plan rules and plan impacts after SQLite reload', async () => {
    const state = plannedState();
    const snapshot = createCanonicalRepositoryForLocalLedgerState(state).snapshot();
    const reloaded = await reloadCanonicalSnapshot(snapshot);

    expect(reloaded.collections.plans).toHaveLength(1);
    expect(reloaded.collections.planRules).toEqual([
      expect.objectContaining({
        planId: reloaded.collections.plans[0]?.id,
        minimumBuffer: reloaded.collections.plans[0]?.protectedAmount,
        mode: 'flexible',
        reviewRequiredWhen: expect.arrayContaining(['unexpected-change']),
      }),
    ]);
    expect(reloaded.collections.planImpacts).toEqual([
      expect.objectContaining({
        planId: reloaded.collections.plans[0]?.id,
        changedRecordIds: expect.arrayContaining([
          String(reloaded.collections.currentBalances[0]?.id),
        ]),
      }),
    ]);
  });

  it('derives plan impact from canonical transactions, events and balance records', () => {
    const state = addManualTransaction(plannedState(), {
      amountText: '8.50',
      kind: 'spend',
      title: 'Lunch',
    });
    const snapshot = createCanonicalRepositoryForLocalLedgerState(state).snapshot();
    const impact = snapshot.collections.planImpacts[0];

    expect(impact).toMatchObject({
      authorityState: 'inferred',
      newProjectedOutcome: expect.stringContaining('linked to 2026-06-24'),
    });
    expect(impact?.changedRecordIds).toEqual(
      expect.arrayContaining([
        String(snapshot.collections.transactions[0]?.id),
        String(snapshot.collections.events[0]?.id),
        String(snapshot.collections.currentBalances[0]?.id),
      ]),
    );
  });

  it('previews, edits and rejects recovery scenarios without mutating plan reality', () => {
    const state = plannedState();
    const route = buildLocalRouteSummary(state);
    const before = createCanonicalRepositoryForLocalLedgerState(state).snapshot();
    const preview = buildLocalRecoverySpendScenarioPreview(state, route, {
      amountMinor: 8000,
      label: 'Repair',
    });
    const edited = editLocalRecoverySpendScenarioPreview(state, route, preview, {
      amountMinor: 6500,
      label: 'Repair timing',
    });
    const afterReject = createCanonicalRepositoryForLocalLedgerState(state).snapshot();

    expect(preview.scenario).toMatchObject({
      authorityState: 'hypothetical',
      status: 'previewed',
    });
    expect(edited.scenario).toMatchObject({
      authorityState: 'hypothetical',
      status: 'previewed',
      title: 'Repair timing edited preview',
    });
    expect(edited.amountMinor).toBe(6500);
    expect(afterReject.collections.plans).toEqual(before.collections.plans);
    expect(afterReject.collections.decisions).toEqual(before.collections.decisions);
    expect(afterReject.collections.auditLog).toEqual(before.collections.auditLog);
  });

  it('accepts recovery as decision and audit records and updates plan state', () => {
    const recovered = addRecoverySpend(plannedState(), {
      amountText: '80.00',
      kind: 'spend',
      title: 'Repair',
    });
    const snapshot = createCanonicalRepositoryForLocalLedgerState(recovered).snapshot();
    const plan = snapshot.collections.plans[0];
    const scenario = snapshot.collections.scenarios[0];
    const impact = snapshot.collections.planImpacts[0];

    expect(snapshot.collections.decisions).toContainEqual(
      expect.objectContaining({ kind: 'accept-scenario' }),
    );
    expect(snapshot.collections.auditLog).toContainEqual(
      expect.objectContaining({ action: 'recovery_recorded' }),
    );
    expect(scenario).toMatchObject({
      status: 'accepted',
      affectedPlanIds: [plan?.id],
    });
    expect(plan).toMatchObject({
      reviewState: 'needs-review',
      scenarioIds: [scenario?.id],
      decisionIds: [snapshot.collections.decisions[0]?.id],
      auditLogIds: [snapshot.collections.auditLog[0]?.id],
      expectationIds: expect.arrayContaining([String(snapshot.collections.expectations[0]?.id)]),
      transactionIds: expect.arrayContaining([String(snapshot.collections.transactions[0]?.id)]),
      eventIds: expect.arrayContaining([String(snapshot.collections.events[0]?.id)]),
    });
    expect(impact).toMatchObject({
      needsReview: true,
      scenarioIds: [scenario?.id],
      changedRecordIds: expect.arrayContaining([
        String(snapshot.collections.decisions[0]?.id),
        String(snapshot.collections.auditLog[0]?.id),
      ]),
    });
  });

  it('reflects canonical plan movement in Today, Timeline and Calendar', () => {
    const recovered = addRecoverySpend(plannedState(), {
      amountText: '80.00',
      kind: 'spend',
      title: 'Repair',
    });
    const route = buildLocalRouteSummary(recovered);
    const today = buildLocalTodayModel(recovered, route);
    const timeline = buildLocalTimelineModel(recovered);
    const calendar = buildLocalCalendarModel(recovered, route);

    expect(today.whatChanged.items).toContainEqual(
      expect.objectContaining({
        category: 'plan',
        summary: expect.stringContaining('accepted recovery scenario'),
      }),
    );
    expect(timeline.events).toContainEqual(
      expect.objectContaining({
        kind: 'plan-change',
        title: expect.stringContaining('needs review'),
      }),
    );
    expect(calendar.agenda).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ detail: 'Plan deadline', title: 'Protect Dentist deadline' }),
        expect.objectContaining({ detail: 'Planned contribution' }),
        expect.objectContaining({ detail: 'Plan review date' }),
        expect.objectContaining({ detail: 'Recovery follow-up' }),
      ]),
    );
  });

  it('keeps Melo plan explanations policy-gated and review-only', () => {
    const recovered = addRecoverySpend(plannedState(), {
      amountText: '80.00',
      kind: 'spend',
      title: 'Repair',
    });
    const plans = buildLocalPlansModel(recovered, buildLocalRouteSummary(recovered));
    const briefing = plans.meloPlanBriefings[0];

    expect(briefing).toMatchObject({
      canWriteDirectly: false,
      advicePolicy: expect.objectContaining({ allowed: true }),
    });
    expect(validateMeloRenderableOutput(briefing?.summary ?? '').renderable).toBe(true);
    expect(
      [
        briefing?.summary,
        ...(briefing?.boundedQuestions ?? []),
        ...(briefing?.recoveryOptions ?? []),
      ].join(' '),
    ).not.toMatch(bannedSurfaceWords);
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

function plannedState(): LocalLedgerState {
  return addPlannedCommitment(
    {
      ...createEmptyLocalLedgerState('2026-06-22'),
      cashOnHandMinor: 20_000,
    },
    {
      amountText: '25.00',
      date: '2026-06-24',
      title: 'Dentist',
    },
  );
}
