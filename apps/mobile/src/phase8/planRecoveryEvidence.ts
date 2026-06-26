import {
  applyDynamicPlanCascade,
  buildBudgetRemainingExperience,
  buildControlledFunState,
  buildMomentumState,
  buildPlanProgressJourney,
  buildRecoveryRebaseExperience,
  buildRitualPlan,
  createPlanDraft,
  createRetentionPreferenceModel,
  editPlanRules,
  resetRetentionPreferenceModel,
  runPhase8EmotionalSafetyReview,
  type BudgetRemainingExperience,
  type ControlledFunState,
  type DynamicCascadeResult,
  type EmotionalSafetyReview,
  type MomentumState,
  type PlanDraft,
  type PlanProgressJourney,
  type PlanRecoveryBriefing,
  type PlanRuleEditResult,
  type RetentionPreferenceModel,
  type RitualPlan,
} from '@folio/plan-engine';

export type Phase8Source = Readonly<{
  kind: 'synthetic';
  label: 'Synthetic sample';
  description: string;
}>;

export type Phase8ProofRow = Readonly<{
  label: string;
  value: string;
  state: 'implemented' | 'blocked';
}>;

export type Phase8GateMetadata = Readonly<{
  phase: 'phase8';
  slice: 'plans-progress-fun-recovery';
  sourceLabel: 'Synthetic sample';
  modelRequired: false;
  networkRequired: false;
  realData: false;
  directStorageWrite: false;
  vaultPlanCommitIntegration: false;
  deviceNotificationIntegration: false;
  nativeAnimationIntegration: false;
  manualAccessibilityVerified: false;
  funFullyDisableable: true;
  badMonthCelebrationSuppressed: true;
  personalisationResettable: true;
  evidenceAreas: readonly Phase8EvidenceArea[];
}>;

export type Phase8EvidenceArea =
  | 'optional_plan_creator'
  | 'rule_editor'
  | 'progress_journey'
  | 'dynamic_cascade'
  | 'rebase_recovery'
  | 'budget_remaining'
  | 'momentum'
  | 'controlled_fun'
  | 'retention_preferences'
  | 'rituals'
  | 'emotional_safety';

export type Phase8RuleRow = Readonly<{
  label: string;
  value: string;
  source: Phase8Source;
}>;

export type Phase8JourneyMilestoneRow = Readonly<{
  id: string;
  label: string;
  statusLabel: string;
  accessibilityLabel: string;
  source: Phase8Source;
}>;

export type Phase8BudgetRow = Readonly<{
  id: string;
  label: string;
  amountLabel: string;
  stateLabel: 'included' | 'excluded';
  source: Phase8Source;
}>;

export type Phase8MomentumRow = Readonly<{
  id: string;
  label: string;
  typeLabel: string;
  source: Phase8Source;
}>;

export type Phase8PolicyRow = Readonly<{
  label: string;
  value: string;
  state: 'implemented' | 'blocked';
  source: Phase8Source;
}>;

export type Phase8PlanRecoveryEvidence = Readonly<{
  metadata: Phase8GateMetadata;
  planDraft: PlanDraft;
  ruleEdit: PlanRuleEditResult;
  journey: PlanProgressJourney;
  cascade: DynamicCascadeResult;
  recovery: PlanRecoveryBriefing;
  budget: BudgetRemainingExperience;
  momentum: MomentumState;
  fun: ControlledFunState;
  retention: RetentionPreferenceModel;
  resetRetention: RetentionPreferenceModel;
  rituals: RitualPlan;
  safetyReviews: readonly EmotionalSafetyReview[];
  ruleRows: readonly Phase8RuleRow[];
  journeyRows: readonly Phase8JourneyMilestoneRow[];
  budgetRows: readonly Phase8BudgetRow[];
  momentumRows: readonly Phase8MomentumRow[];
  policyRows: readonly Phase8PolicyRow[];
  proofRows: readonly Phase8ProofRow[];
}>;

const syntheticSource: Phase8Source = {
  kind: 'synthetic',
  label: 'Synthetic sample',
  description: 'Phase 8 mobile shell evidence uses fictional plan, budget and recovery values.',
};

export const phase8ProofRows: readonly Phase8ProofRow[] = [
  {
    label: 'Plan creator',
    value: 'optional draft, flat by default, review before commit',
    state: 'implemented',
  },
  {
    label: 'Cascade/rebase',
    value: 'unexpected event invalidates forecast, budget, plan, calendar and briefing',
    state: 'implemented',
  },
  {
    label: 'Recovery copy',
    value: 'choices are keep, alter, pause, edit or leave unchanged; no failed verdict',
    state: 'implemented',
  },
  {
    label: 'Fun/personalisation',
    value: 'fun can be disabled, bad-month output suppressed, preferences resettable',
    state: 'implemented',
  },
  {
    label: 'Native/vault',
    value: 'real plan commits, notifications and animation evidence remain blocked',
    state: 'blocked',
  },
  {
    label: 'Manual a11y',
    value: 'TalkBack, large text and reduced-motion recording still required',
    state: 'blocked',
  },
];

export const defaultPhase8PlanRecoveryEvidence = buildPhase8PlanRecoveryEvidence();

export function buildPhase8PlanRecoveryEvidence(): Phase8PlanRecoveryEvidence {
  const planDraft = createPlanDraft({
    id: 'phase8-plan-reserve',
    title: 'Rebuild the reserve buffer',
    source: 'melo',
    targetMinor: 100000,
    currentMinor: 50000,
    startDate: '2026-08-01',
    targetDate: '2026-11-30',
    linkedRecordIds: ['evt-car-repair', 'budget-pay-cycle'],
    rules: {
      contributionMinor: 20000,
      minContributionMinor: 5000,
      protectedFloorMinor: 50000,
      priority: 'standard',
      frequency: 'monthly',
      recoveryMode: 'keep_current_contribution',
      accountabilityStyle: 'balanced',
    },
    assumptions: [
      'Synthetic weekly-pay timeline',
      'Rent and minimum payments remain covered before payday',
    ],
  });

  const ruleEdit = editPlanRules({
    currentRules: planDraft.rules,
    patch: {
      priority: 'high',
      accountabilityStyle: 'accountability',
      pauseOnShortfall: true,
    },
  });

  const journey = buildPlanProgressJourney({
    planId: planDraft.id,
    title: planDraft.title,
    targetMinor: planDraft.targetMinor,
    currentMinor: planDraft.currentMinor,
    forecastChanges: [
      {
        id: 'plan-date',
        label: 'Plan date',
        previousValue: '2026-10-18',
        currentValue: '2026-11-08 to 2026-11-22',
        reason: 'The synthetic car repair reduces one contribution.',
      },
      {
        id: 'calendar-review',
        label: 'Calendar',
        previousValue: 'Friday check-in',
        currentValue: 'Friday recovery review',
        reason: 'A material plan change creates a review moment.',
      },
    ],
  });

  const cascade = applyDynamicPlanCascade({
    planId: planDraft.id,
    plan: {
      targetMinor: 120000,
      currentMinor: 0,
      monthlyContributionMinor: 20000,
      startDate: '2026-07-01',
      originalCompletionDate: '2026-12-31',
      version: 2,
    },
    event: {
      id: 'evt-car-repair',
      date: '2026-08-15',
      label: 'Unexpected car repair',
      amountMinor: -42000,
      contributionReductionMinor: 10000,
    },
  });

  const recovery = buildRecoveryRebaseExperience({
    eventLabel: 'Unexpected car repair recorded as a synthetic GBP 420 outflow.',
    immediateEffect:
      'The protected buffer falls to GBP 80 and the current debt-plan range moves by about three weeks.',
    protectedItemsStillCovered: [
      'Rent remains covered',
      'Minimum payments before payday remain covered',
    ],
    changedDatesOrAmounts: [
      'Available cash is GBP 420 lower',
      'Current plan range moves from 18 October to 8-22 November',
    ],
  });

  const budget = buildBudgetRemainingExperience({
    mode: 'pay_cycle',
    allocationMinor: 62000,
    records: [
      {
        id: 'rent-reserved',
        label: 'Rent already reserved',
        amountMinor: -50000,
        kind: 'reserved_scheduled',
        included: true,
      },
      {
        id: 'car-repair',
        label: 'Vehicle repair',
        amountMinor: -42000,
        kind: 'posted_spending',
        included: true,
      },
      {
        id: 'refund',
        label: 'Refund adjustment',
        amountMinor: 10000,
        kind: 'adjustment',
        included: true,
      },
      {
        id: 'business-lunch',
        label: 'Business lunch excluded',
        amountMinor: -2400,
        kind: 'excluded',
        included: false,
      },
    ],
  });

  const momentum = buildMomentumState({
    signals: [
      {
        id: 'recorded-event',
        type: 'awareness',
        date: '2026-08-15',
        label: 'Recorded the unexpected repair instead of avoiding it',
      },
      {
        id: 'reviewed-rebase',
        type: 'recovery',
        date: '2026-08-16',
        label: 'Reviewed the changed plan path',
        weight: 2,
      },
      {
        id: 'covered-obligation',
        type: 'payment',
        date: '2026-08-17',
        label: 'Kept essential obligations covered',
      },
    ],
    badMonthMode: true,
  });

  const fun = buildControlledFunState({
    enabled: true,
    badMonthMode: true,
    miniGameEnabled: true,
    journeyAnimationEnabled: true,
  });

  const retention = createRetentionPreferenceModel({
    emphasizedMotivations: ['debt_progress', 'upcoming_obligations'],
    notificationFrequency: 'quiet',
    celebrationIntensity: 'low',
    memoryDepth: 'compact',
  });
  const resetRetention = resetRetentionPreferenceModel();

  const rituals = buildRitualPlan({
    enabledRituals: ['payday_review', 'weekly_reflection'],
    quietHours: { startHour: 22, endHour: 7 },
    notificationClassesEnabled: {
      ritual: false,
      progress: true,
      meaningful_change: true,
    },
    asOf: '2026-08-16',
  });

  const safetyReviews = [
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
      funState: fun,
    }),
    runPhase8EmotionalSafetyReview({
      journey: 'quiet_month',
      copy: ['Nothing needs attention today. Your next planned check is Friday.'],
    }),
  ];

  return {
    metadata: {
      phase: 'phase8',
      slice: 'plans-progress-fun-recovery',
      sourceLabel: 'Synthetic sample',
      modelRequired: false,
      networkRequired: false,
      realData: false,
      directStorageWrite: false,
      vaultPlanCommitIntegration: false,
      deviceNotificationIntegration: false,
      nativeAnimationIntegration: false,
      manualAccessibilityVerified: false,
      funFullyDisableable: true,
      badMonthCelebrationSuppressed: true,
      personalisationResettable: true,
      evidenceAreas: [
        'optional_plan_creator',
        'rule_editor',
        'progress_journey',
        'dynamic_cascade',
        'rebase_recovery',
        'budget_remaining',
        'momentum',
        'controlled_fun',
        'retention_preferences',
        'rituals',
        'emotional_safety',
      ],
    },
    planDraft,
    ruleEdit,
    journey,
    cascade,
    recovery,
    budget,
    momentum,
    fun,
    retention,
    resetRetention,
    rituals,
    safetyReviews,
    ruleRows: [
      {
        label: 'Priority',
        value: `${ruleEdit.previousRules.priority} to ${ruleEdit.nextRules.priority}`,
        source: syntheticSource,
      },
      {
        label: 'Contribution',
        value: formatMinor(ruleEdit.nextRules.contributionMinor),
        source: syntheticSource,
      },
      {
        label: 'Protected floor',
        value: formatMinor(ruleEdit.nextRules.protectedFloorMinor),
        source: syntheticSource,
      },
      {
        label: 'Reversible',
        value: ruleEdit.reversible ? 'yes, no domain write' : 'no',
        source: syntheticSource,
      },
    ],
    journeyRows: journey.milestones.map((milestone) => ({
      id: milestone.id,
      label: milestone.label,
      statusLabel: milestone.reached ? 'reached' : 'not reached',
      accessibilityLabel: milestone.accessibilityLabel,
      source: syntheticSource,
    })),
    budgetRows: [
      ...budget.includedRecords.map((record) => ({
        id: record.id,
        label: record.label,
        amountLabel: formatMinor(record.amountMinor),
        stateLabel: 'included' as const,
        source: syntheticSource,
      })),
      ...budget.excludedRecords.map((record) => ({
        id: record.id,
        label: record.label,
        amountLabel: formatMinor(record.amountMinor),
        stateLabel: 'excluded' as const,
        source: syntheticSource,
      })),
    ],
    momentumRows: momentum.earnedBy.map((signal) => ({
      id: signal.id,
      label: signal.label,
      typeLabel: signal.type.replace('_', ' '),
      source: syntheticSource,
    })),
    policyRows: [
      {
        label: 'Vault commits',
        value: 'blocked until plan command adapters write vault-backed rows',
        state: 'blocked',
        source: syntheticSource,
      },
      {
        label: 'Notifications',
        value: 'ritual policy only; native scheduling remains blocked',
        state: 'blocked',
        source: syntheticSource,
      },
      {
        label: 'Safety review',
        value: `${safetyReviews.filter((review) => review.passed).length} of ${
          safetyReviews.length
        } synthetic journeys passed`,
        state: safetyReviews.every((review) => review.passed) ? 'implemented' : 'blocked',
        source: syntheticSource,
      },
      {
        label: 'No daily-loss streak',
        value: momentum.dailyLossStreak ? 'streak loss present' : 'absence does not erase progress',
        state: momentum.dailyLossStreak ? 'blocked' : 'implemented',
        source: syntheticSource,
      },
    ],
    proofRows: phase8ProofRows,
  };
}

function formatMinor(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(minor);
  const pounds = Math.floor(absolute / 100);
  const pence = String(absolute % 100).padStart(2, '0');
  return `${sign}GBP ${pounds}.${pence}`;
}
