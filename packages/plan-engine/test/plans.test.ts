import { describe, expect, it } from 'vitest';

import {
  createAuditLogId,
  createCommitmentId,
  createCurrentBalance,
  createDecisionRecordId,
  createEntityVersion,
  createEventId,
  createExpectationId,
  createInstantString,
  createLocalDate,
  createMoney,
  createPlanId,
  createScenarioId,
  createTransactionId,
  createWorkspaceId,
  type Plan,
  type Scenario,
} from '@folio/domain';

import {
  applyDynamicPlanCascade,
  buildBudgetRemainingExperience,
  buildControlledFunState,
  buildMomentumState,
  buildPlanProgressJourney,
  buildRecoveryRebaseExperience,
  buildRitualPlan,
  calculateBudgetRollover,
  createPlanDraft,
  createRetentionPreferenceModel,
  derivePlanImpactFromCanonicalRecords,
  editPlanRules,
  projectPlanCompletionDate,
  rebasePlan,
  resetRetentionPreferenceModel,
  runPhase8EmotionalSafetyReview,
  runPlanScenario,
  updateRetentionPreferenceModel,
} from '../src/index.js';

describe('source forecast vectors: budget rollover', () => {
  it('F011 carries positive rollover into the next period', () => {
    expect(
      calculateBudgetRollover({
        allocationMinor: 30000,
        postedSpendingMinor: 25000,
        rolloverPolicy: 'positive',
      }),
    ).toEqual({
      currentRemainingMinor: 5000,
      nextBaseAllocationMinor: 30000,
      nextEffectiveAllocationMinor: 35000,
      rolloverAppliedMinor: 5000,
    });
  });

  it('F012 discards unused allocation when rollover is none', () => {
    expect(
      calculateBudgetRollover({
        allocationMinor: 30000,
        postedSpendingMinor: 25000,
        rolloverPolicy: 'none',
      }),
    ).toMatchObject({
      currentRemainingMinor: 5000,
      nextEffectiveAllocationMinor: 30000,
      rolloverAppliedMinor: 0,
    });
  });
});

describe('Phase 8 optional plan creator and rule editor', () => {
  it('T111 creates an optional draft with flat hierarchy by default', () => {
    const draft = createPlanDraft({
      id: 'plan-reserve',
      title: 'Build a small reserve',
      source: 'melo',
      targetMinor: 100000,
      currentMinor: 25000,
      startDate: '2026-07-01',
      rules: {
        contributionMinor: 10000,
        protectedFloorMinor: 50000,
      },
    });

    expect(draft.promptRequiredForCore).toBe(false);
    expect(draft.flatByDefault).toBe(true);
    expect(draft.hierarchyOptional).toBe(true);
    expect(draft.rules.hierarchyEnabled).toBe(false);
    expect(draft.reviewRequiredBeforeCommit).toBe(true);
    expect(draft.firstScheduledActions[0]).toContain('reviewed');
  });

  it('T112 edits rules with a reversible diff and without mutating the plan', () => {
    const draft = createPlanDraft({
      id: 'plan-tax-pot',
      title: 'Build business tax pot',
      source: 'user',
      targetMinor: 240000,
      startDate: '2026-07-01',
      rules: {
        contributionMinor: 20000,
        minContributionMinor: 10000,
        protectedFloorMinor: 100000,
        accountabilityStyle: 'balanced',
      },
    });

    const edit = editPlanRules({
      currentRules: draft.rules,
      patch: {
        priority: 'high',
        accountabilityStyle: 'accountability',
      },
    });

    expect(edit.domainPlanMutated).toBe(false);
    expect(edit.reversible).toBe(true);
    expect(edit.changedFields).toEqual(['priority', 'accountabilityStyle']);
    expect(edit.previousRules.priority).toBe('standard');
    expect(edit.nextRules.priority).toBe('high');
  });
});

describe('Phase 8 progress, cascade and recovery', () => {
  it('T113 builds progress milestones with an accessible text equivalent', () => {
    const journey = buildPlanProgressJourney({
      planId: 'plan-reserve',
      title: 'Reserve plan',
      targetMinor: 100000,
      currentMinor: 50000,
      forecastChanges: [
        {
          id: 'date-change',
          label: 'Projected date',
          previousValue: '2026-10-31',
          currentValue: '2026-11-30',
          reason: 'A repair reduced this month contribution.',
        },
      ],
    });

    expect(journey.progressPercent).toBe(50);
    expect(journey.milestones[1]).toMatchObject({
      label: '50%',
      reached: true,
    });
    expect(journey.reducedMotionSafe).toBe(true);
    expect(journey.accessibleTextEquivalent).toContain('Reserve plan is 50% complete');
  });

  it('T114 cascades an unexpected event atomically and keeps plan history', () => {
    const cascade = applyDynamicPlanCascade({
      planId: 'plan-debt',
      plan: {
        targetMinor: 120000,
        currentMinor: 0,
        monthlyContributionMinor: 20000,
        startDate: '2026-07-01',
        originalCompletionDate: '2026-12-31',
        version: 3,
      },
      event: {
        id: 'evt-car-repair',
        date: '2026-08-15',
        label: 'Unexpected car repair',
        amountMinor: -42000,
        contributionReductionMinor: 10000,
      },
    });

    expect(cascade.atomic).toBe(true);
    expect(cascade.historyRetained).toBe(true);
    expect(cascade.directWriteToActualRecords).toBe(false);
    expect(cascade.invalidatedProjections).toEqual([
      'forecast',
      'budget',
      'plan',
      'calendar',
      'briefing',
    ]);
    expect(cascade.rebase).toMatchObject({
      previousVersion: 3,
      newVersion: 4,
      label: 'rebased',
      failed: false,
    });
  });

  it('T115 presents recovery choices without failed verdict language', () => {
    const recovery = buildRecoveryRebaseExperience({
      eventLabel: 'The repair changed available cash by GBP 420.',
      immediateEffect: 'The plan date moves by about three weeks.',
      protectedItemsStillCovered: ['Rent remains covered before payday.'],
      changedDatesOrAmounts: ['Debt plan range moves from 18 October to 8-22 November.'],
    });

    expect(recovery.title).toBe('Plan needs review');
    expect(recovery.forbiddenFailedVerdictPresent).toBe(false);
    expect(recovery.choices.map((choice) => choice.id)).toEqual([
      'keep_target_date',
      'keep_current_contribution',
      'pause_one_cycle',
      'edit_event',
      'leave_unchanged',
    ]);
    expect(recovery.choices.every((choice) => choice.writesImmediately === false)).toBe(true);
    const visibleCopy = [
      recovery.title,
      recovery.fact,
      recovery.immediateEffect,
      recovery.nextStep,
      ...recovery.protectedItemsStillCovered,
      ...recovery.changedDatesOrAmounts,
      ...recovery.choices.flatMap((choice) => [choice.label, choice.consequence]),
    ];
    expect(visibleCopy.join(' ').toLowerCase()).not.toContain('failed');
  });
});

describe('canonical plan impact derivation', () => {
  it('derives movement from canonical plan links, current balance and accepted scenarios', () => {
    const workspaceId = createWorkspaceId('workspace_plan_engine');
    const version = createEntityVersion({ dataVersion: 'test:canonical-plan-impact' });
    const scenarioId = createScenarioId('scenario_plan_engine_recovery');
    const plan: Plan = {
      id: createPlanId('plan_engine_reserve'),
      workspaceId,
      title: 'Reserve',
      status: 'active',
      authorityState: 'user-confirmed',
      reviewState: 'needs-review',
      createdAt: createInstantString('2026-06-22T10:00:00.000Z'),
      version,
      kind: 'build-buffer',
      userIntention: 'Keep a visible reserve without touching protected commitments.',
      targetAmount: createMoney({ minorUnits: 100_000, currency: 'GBP' }),
      targetDate: createLocalDate('2026-09-30'),
      protectedAmount: createMoney({ minorUnits: 25_000, currency: 'GBP' }),
      commitmentIds: [createCommitmentId('commitment_plan_engine_rent')],
      expectationIds: [createExpectationId('expectation_plan_engine_rent')],
      transactionIds: [createTransactionId('transaction_plan_engine_repair')],
      eventIds: [createEventId('event_plan_engine_repair')],
      scenarioIds: [scenarioId],
      decisionIds: [createDecisionRecordId('decision_plan_engine_recovery')],
      auditLogIds: [createAuditLogId('audit_plan_engine_recovery')],
    };
    const currentBalance = createCurrentBalance({
      id: 'currentbalance_plan_engine_today',
      workspaceId,
      accountId: 'account_plan_engine_cash',
      asOf: '2026-06-22',
      balance: { minorUnits: 18_000, currency: 'GBP' },
      sourceKind: 'user-entered',
      authorityState: 'user-confirmed',
      reviewState: 'not-required',
      sourceObservationId: 'balance_plan_engine_today',
      updatedAt: '2026-06-22T10:00:00.000Z',
      version,
    });
    const scenario: Scenario = {
      id: scenarioId,
      workspaceId,
      title: 'Repair recovery accepted',
      status: 'accepted',
      authorityState: 'hypothetical',
      createdAt: createInstantString('2026-06-22T10:00:00.000Z'),
      version,
      assumptionIds: [],
      affectedPlanIds: [plan.id],
    };

    const impact = derivePlanImpactFromCanonicalRecords({
      id: 'planimpact_plan_engine_reserve',
      workspaceId,
      plan,
      asOf: '2026-06-22',
      currentBalance,
      scenarios: [scenario],
      createdAt: '2026-06-22T10:00:00.000Z',
      version,
    });

    expect(impact).toMatchObject({
      direction: 'needs-review',
      needsReview: true,
      protectedAmount: createMoney({ minorUnits: 25_000, currency: 'GBP' }),
      scenarioIds: [scenarioId],
      authorityState: 'hypothetical',
      reviewState: 'needs-review',
    });
    expect(impact.changedRecordIds).toEqual(
      expect.arrayContaining([
        'commitment_plan_engine_rent',
        'expectation_plan_engine_rent',
        'transaction_plan_engine_repair',
        'event_plan_engine_repair',
        'decision_plan_engine_recovery',
        'audit_plan_engine_recovery',
        'currentbalance_plan_engine_today',
        'scenario_plan_engine_recovery',
      ]),
    );
    expect(impact.newProjectedOutcome).toContain('needs review after accepted recovery');
  });
});

describe('Phase 8 budgets, momentum, fun and personalisation', () => {
  it('T116 explains budget remaining and exposes included records', () => {
    const experience = buildBudgetRemainingExperience({
      mode: 'pay_cycle',
      allocationMinor: 60000,
      records: [
        {
          id: 'txn-grocery',
          label: 'Groceries',
          amountMinor: -12000,
          kind: 'posted_spending',
          included: true,
        },
        {
          id: 'sched-fuel',
          label: 'Fuel before payday',
          amountMinor: -8000,
          kind: 'reserved_scheduled',
          included: true,
        },
        {
          id: 'refund',
          label: 'Refund adjustment',
          amountMinor: 3000,
          kind: 'adjustment',
          included: true,
        },
        {
          id: 'business-row',
          label: 'Business lunch excluded',
          amountMinor: -2500,
          kind: 'excluded',
          included: false,
        },
      ],
    });

    expect(experience.remainingMinor).toBe(43000);
    expect(experience.calculationExplainable).toBe(true);
    expect(experience.budgetOptional).toBe(true);
    expect(experience.includedRecords).toHaveLength(3);
    expect(experience.excludedRecords).toHaveLength(1);
  });

  it('T117 builds momentum from real progress without daily-loss streaks', () => {
    const momentum = buildMomentumState({
      signals: [
        {
          id: 'sig-review',
          type: 'review',
          date: '2026-08-01',
          label: 'Reviewed changed position',
        },
        {
          id: 'sig-recovery',
          type: 'recovery',
          date: '2026-08-02',
          label: 'Rebased the plan after disruption',
          weight: 2,
        },
      ],
    });

    expect(momentum.state).toBe('recovering');
    expect(momentum.momentumWeight).toBe(3);
    expect(momentum.missingDayPenalty).toBe(false);
    expect(momentum.dailyLossStreak).toBe(false);
  });

  it('T118 fully disables fun and suppresses it in bad-month mode', () => {
    expect(buildControlledFunState({ enabled: false })).toMatchObject({
      effectiveState: 'disabled',
      celebrationAllowed: false,
      miniGameUsesRealFunds: false,
    });

    expect(buildControlledFunState({ enabled: true, badMonthMode: true })).toMatchObject({
      effectiveState: 'softened',
      celebrationAllowed: false,
      meloAnimationAllowed: false,
    });
  });

  it('T119 makes retention preferences inspectable, resettable and non-sensitive', () => {
    const initial = createRetentionPreferenceModel();
    const updated = updateRetentionPreferenceModel(initial, {
      emphasizedMotivations: ['debt_progress', 'future_plan'],
      celebrationIntensity: 'off',
    });
    const reset = resetRetentionPreferenceModel();

    expect(updated.inspectable).toBe(true);
    expect(updated.resettable).toBe(true);
    expect(updated.hiddenSensitiveProfiling).toBe(false);
    expect(updated.adaptedFromAcceptedBehaviorOnly).toBe(true);
    expect(updated.emphasizedMotivations).toEqual(['debt_progress', 'future_plan']);
    expect(reset.emphasizedMotivations).toEqual(['upcoming_obligations']);
  });
});

describe('Phase 8 rituals and emotional safety quality', () => {
  it('T120 keeps rituals optional and notification-policy controlled', () => {
    const rituals = buildRitualPlan({
      enabledRituals: ['payday_review'],
      quietHours: { startHour: 22, endHour: 7 },
      notificationClassesEnabled: {
        ritual: false,
        progress: true,
        meaningful_change: true,
      },
      asOf: '2026-08-01',
    });

    expect(rituals.quietStateValid).toBe(true);
    expect(rituals.forcedDailyOpen).toBe(false);
    expect(rituals.notificationPolicyControlled).toBe(true);
    expect(rituals.rituals.at(0)).toMatchObject({
      type: 'payday_review',
      enabled: true,
      notificationAllowed: false,
      lockScreenSensitiveText: false,
    });
  });

  it('T121 passes good, bad and quiet month safety reviews', () => {
    const badMonthFun = buildControlledFunState({
      enabled: true,
      badMonthMode: true,
    });

    const reviews = [
      runPhase8EmotionalSafetyReview({
        journey: 'good_month',
        copy: ['Milestone reached because a real payment cleared.'],
        funState: buildControlledFunState({ enabled: true }),
      }),
      runPhase8EmotionalSafetyReview({
        journey: 'bad_month',
        copy: [
          'This is a setback, not a verdict.',
          'The updated timeline is visible and ready for review.',
        ],
        funState: badMonthFun,
      }),
      runPhase8EmotionalSafetyReview({
        journey: 'quiet_month',
        copy: ['Nothing needs attention today. Your next planned check is Friday.'],
      }),
    ];

    expect(reviews.every((review) => review.passed)).toBe(true);
    const badMonthReview = reviews.find((review) => review.journey === 'bad_month');
    expect(badMonthReview?.badMonthCelebrationSuppressed).toBe(true);
  });

  it('T121 rejects shame and manipulative retention copy', () => {
    const review = runPhase8EmotionalSafetyReview({
      journey: 'bad_month',
      copy: ['You failed your budget. Open now or lose progress.'],
      funState: buildControlledFunState({ enabled: true, badMonthMode: true }),
    });

    expect(review.passed).toBe(false);
    expect(review.shameLanguageFound).toEqual(['failed']);
    expect(review.manipulativeRetentionFound).toEqual(['lose progress', 'open now']);
  });
});

describe('plan rebase and scenario isolation', () => {
  it('projects the original completion date before an unexpected reduction', () => {
    expect(
      projectPlanCompletionDate({
        targetMinor: 120000,
        currentMinor: 0,
        monthlyContributionMinor: 20000,
        startDate: '2026-07-01',
      }),
    ).toBe('2026-12-31');
  });

  it('F013 rebases history without marking the plan as failed', () => {
    expect(
      rebasePlan({
        plan: {
          targetMinor: 120000,
          currentMinor: 0,
          monthlyContributionMinor: 20000,
          startDate: '2026-07-01',
          originalCompletionDate: '2026-12-31',
        },
        unexpected: {
          date: '2026-08-15',
          reducesAugustContributionByMinor: 10000,
        },
      }),
    ).toMatchObject({
      status: 'active',
      newProjectedCompletionDate: '2027-01-31',
      versionIncrement: 1,
      label: 'rebased',
      failed: false,
    });
  });

  it('runs a plan scenario without mutating the actual plan snapshot', () => {
    const plan = {
      targetMinor: 120000,
      currentMinor: 20000,
      monthlyContributionMinor: 20000,
      startDate: '2026-07-01',
    };
    const scenario = runPlanScenario({ plan, monthlyContributionDeltaMinor: 5000 });

    expect(scenario.actual.monthlyContributionMinor).toBe(20000);
    expect(scenario.scenario.monthlyContributionMinor).toBe(25000);
    expect(scenario.domainPlanMutated).toBe(false);
    expect(plan.monthlyContributionMinor).toBe(20000);
  });
});
