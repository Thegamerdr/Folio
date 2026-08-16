import {
  buildPlanProgressJourney,
  buildRecoveryRebaseExperience,
  createPlanDraft,
  type PlanRecoveryBriefing,
} from '@folio/plan-engine';
import { buildPlanMovementBriefing, type MeloPlanMovementBriefing } from '@folio/melo-policy';
import type { Plan, PlanImpact, PlanRule } from '@folio/domain';

import { formatMinorAmount, type LocalLedgerState, type LocalRouteSummary } from './localLedger.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';

export type LocalPlanTone = 'confirmed' | 'estimated' | 'attention';

export type LocalPlanRow = Readonly<{
  affectedBy: readonly string[];
  assumptions: readonly string[];
  authorityLabel: string;
  id: string;
  intention: string;
  linkedEvidence: readonly string[];
  nextExpectedMovement: string;
  nextReviewDate: string;
  title: string;
  dueDate: string;
  stateLabel: string;
  target: string;
  covered: string;
  progressLabel: string;
  nextStep: string;
  impactSummary: string;
  protectedLabel: string;
  reviewRequired: boolean;
  reviewStateLabel: string;
  ruleLabel: string;
  sourceLabel: string;
  linkedRecordCount: number;
  tone: LocalPlanTone;
}>;

export type LocalPlanReviewRow = Readonly<{
  id: string;
  title: string;
  dueDate: string;
  stateLabel: string;
  tone: LocalPlanTone;
}>;

export type LocalPlansModel = Readonly<{
  sourceLabel: string;
  contractState: 'repository-backed';
  planRows: readonly LocalPlanRow[];
  reviewRows: readonly LocalPlanReviewRow[];
  accessibilitySummary: string;
  meloPlanBriefings: readonly MeloPlanMovementBriefing[];
  recoveryBriefing?: PlanRecoveryBriefing;
  // The total already spoken for before payday — the money figure the Plans summary leads with.
  committedTotalMinor: number;
  committedTotal: string;
}>;

export function buildLocalPlansModel(
  ledger: LocalLedgerState,
  route: LocalRouteSummary,
  options: Readonly<{ privateExampleMode?: boolean }> = {},
): LocalPlansModel {
  const canonical = createCanonicalRepositoryForLocalLedgerState(ledger).snapshot().collections;

  const planRows = canonical.plans.map((plan) =>
    createPlanRowFromPlan({
      asOfDate: ledger.asOfDate,
      plan,
      impact: latestPlanImpactForPlan(canonical.planImpacts, plan),
      rule: firstPlanRuleForPlan(canonical.planRules, plan),
      route,
    }),
  );
  const reviewRows = canonical.plannerItems.map<LocalPlanReviewRow>((item) => ({
    id: String(item.id),
    title: item.title,
    dueDate: item.dueDate,
    stateLabel: item.status.replace(/-/g, ' '),
    tone: item.status === 'open' ? 'attention' : 'confirmed',
  }));
  const recoveryBriefing =
    route.tightestBalanceMinor < 0
      ? buildRecoveryRebaseExperience({
          eventLabel: `Known route reaches ${formatMinorAmount(route.tightestBalanceMinor)} ${
            route.tightestDay
          }.`,
          immediateEffect: 'Plans need a check before anything changes.',
          protectedItemsStillCovered: route.protectedItems,
          changedDatesOrAmounts:
            planRows.length === 0
              ? ['Nothing in your plans has changed yet.']
              : planRows.slice(0, 3).map((row) => `${row.title}: ${row.dueDate}`),
        })
      : undefined;

  const committedTotalMinor = canonical.plans.reduce(
    (sum, plan) => sum + Math.abs(plan.targetAmount?.minorUnits ?? 0),
    0,
  );

  const base = {
    sourceLabel: options.privateExampleMode ? 'Private example' : 'Local personal workspace',
    contractState: 'repository-backed',
    planRows,
    reviewRows,
    committedTotalMinor,
    committedTotal: formatMinorAmount(committedTotalMinor),
    meloPlanBriefings: planRows.map((row) =>
      buildPlanMovementBriefing({
        planTitle: row.title,
        movementLine: row.impactSummary,
        protectedLine: row.protectedLabel,
        needsReview: row.reviewRequired,
        boundedQuestions: [
          'Keep the current date?',
          'Adjust the contribution?',
          'Pause and review later?',
        ],
        recoveryOptions: row.reviewRequired
          ? ['keep-current-plan', 'adjust-contribution', 'pause-and-review']
          : ['inspect-plan'],
        tone: 'balanced',
      }),
    ),
    accessibilitySummary: `${planRows.length} plan object${
      planRows.length === 1 ? '' : 's'
    }, ${reviewRows.length} review task${reviewRows.length === 1 ? '' : 's'}.`,
  } satisfies Omit<LocalPlansModel, 'recoveryBriefing'>;

  return recoveryBriefing === undefined ? base : { ...base, recoveryBriefing };
}

function createPlanRowFromPlan({
  asOfDate,
  plan,
  impact,
  rule,
  route,
}: Readonly<{
  asOfDate: string;
  plan: Plan;
  impact: PlanImpact | undefined;
  rule: PlanRule | undefined;
  route: LocalRouteSummary;
}>): LocalPlanRow {
  const targetMinor = Math.abs(plan.targetAmount?.minorUnits ?? 0);
  const coveredMinor = Math.min(targetMinor, Math.max(0, route.availableNowMinor));
  const dueDate = plan.targetDate ?? asOfDate;
  const protectedMinor =
    impact?.protectedAmount.minorUnits ??
    rule?.protectedAmount?.minorUnits ??
    plan.protectedAmount?.minorUnits ??
    targetMinor;
  const draft = createPlanDraft({
    id: String(plan.id),
    title: plan.title,
    source: 'user',
    targetMinor,
    currentMinor: coveredMinor,
    startDate: asOfDate,
    targetDate: dueDate,
    linkedRecordIds: [...plan.commitmentIds.map(String), String(plan.provenanceId)].filter(
      (id) => id !== 'undefined',
    ),
    rules: {
      contributionMinor: targetMinor,
      minContributionMinor: 0,
      protectedFloorMinor: Math.max(0, protectedMinor),
      frequency: 'payday',
    },
    assumptions: [
      impact === undefined
        ? 'Based on something you have confirmed for the future.'
        : 'Based on plan changes you have reviewed.',
    ],
  });
  const journey = buildPlanProgressJourney({
    planId: draft.id,
    title: draft.title,
    targetMinor: draft.targetMinor,
    currentMinor: draft.currentMinor,
    forecastChanges: [
      {
        id: `route-floor-${draft.id}`,
        label: 'Route floor',
        previousValue: 'Not stored as plan history',
        currentValue: `${formatMinorAmount(route.tightestBalanceMinor)} ${route.tightestDay}`,
        reason: 'Your money path as it stands now',
      },
    ],
  });

  return {
    affectedBy: planAffectedByLabels(plan, impact),
    assumptions: draft.assumptions,
    authorityLabel: impact?.authorityState ?? plan.authorityState,
    id: draft.id,
    intention:
      plan.userIntention ??
      `Keep ${plan.title.toLowerCase()} visible without changing reality automatically.`,
    linkedEvidence: planLinkedEvidence(plan, impact, rule),
    nextExpectedMovement:
      impact?.newProjectedOutcome ??
      draft.firstScheduledActions[0] ??
      journey.accessibleTextEquivalent,
    nextReviewDate: impact?.needsReview === true ? impact.asOf : (rule?.deadline ?? dueDate),
    title: draft.title,
    dueDate,
    stateLabel: plan.status,
    target: formatMinorAmount(draft.targetMinor),
    covered: formatMinorAmount(draft.currentMinor),
    progressLabel: `${formatMinorAmount(draft.currentMinor)} visible against ${formatMinorAmount(
      draft.targetMinor,
    )}`,
    nextStep:
      impact?.needsReview === true
        ? 'Review the visible plan options before saving changes'
        : (draft.firstScheduledActions[0] ?? journey.accessibleTextEquivalent),
    impactSummary: impact?.summary ?? journey.accessibleTextEquivalent,
    protectedLabel: `${formatMinorAmount(protectedMinor)} remains protected`,
    reviewRequired: impact?.needsReview ?? false,
    reviewStateLabel: impact?.reviewState ?? plan.reviewState ?? plan.status,
    ruleLabel: ruleLabel(rule, protectedMinor, dueDate),
    sourceLabel: sourceLabel(plan, impact, rule),
    linkedRecordCount: draft.linkedRecordIds.length,
    tone:
      impact?.needsReview === true
        ? 'attention'
        : draft.currentMinor >= draft.targetMinor && route.tightestBalanceMinor >= 0
          ? 'confirmed'
          : 'estimated',
  };
}

function ruleLabel(rule: PlanRule | undefined, protectedMinor: number, dueDate: string): string {
  if (rule === undefined) {
    return `${formatMinorAmount(protectedMinor)} protected until ${dueDate}`;
  }

  const contribution =
    rule.targetContribution === undefined
      ? 'no fixed contribution'
      : `${formatMinorAmount(rule.targetContribution.minorUnits)} target contribution`;
  const buffer =
    rule.minimumBuffer === undefined
      ? `${formatMinorAmount(protectedMinor)} protected`
      : `${formatMinorAmount(rule.minimumBuffer.minorUnits)} minimum buffer`;
  return `${rule.mode} rule; ${buffer}; ${contribution}; review on ${rule.deadline ?? dueDate}`;
}

function sourceLabel(
  plan: Plan,
  impact: PlanImpact | undefined,
  rule: PlanRule | undefined,
): string {
  if (impact !== undefined) return 'Plan impact';
  if (rule !== undefined) return 'Plan rule';
  return plan.provenanceId === undefined ? 'Plan' : 'Plan provenance';
}

function planAffectedByLabels(plan: Plan, impact: PlanImpact | undefined): readonly string[] {
  const changedRecords = impact?.changedRecordIds ?? [];
  const labels = [
    ...changedRecords.map((id) => `changed record ${id}`),
    ...plan.commitmentIds.map((id) => `commitment ${String(id)}`),
    ...(plan.expectationIds ?? []).map((id) => `expectation ${String(id)}`),
    ...(plan.transactionIds ?? []).map((id) => `transaction ${String(id)}`),
    ...(plan.eventIds ?? []).map((id) => `event ${String(id)}`),
    ...plan.scenarioIds.map((id) => `scenario ${String(id)}`),
  ];
  return labels.length === 0 ? ['current route'] : labels;
}

function planLinkedEvidence(
  plan: Plan,
  impact: PlanImpact | undefined,
  rule: PlanRule | undefined,
): readonly string[] {
  return [
    `plan ${String(plan.id)}`,
    ...(rule === undefined ? [] : [`rule ${String(rule.id)}`]),
    ...(impact === undefined ? [] : [`impact ${String(impact.id)}`]),
    ...(plan.provenanceId === undefined ? [] : [`provenance ${String(plan.provenanceId)}`]),
    ...(impact?.provenanceId === undefined
      ? []
      : [`impact provenance ${String(impact.provenanceId)}`]),
  ];
}

function firstPlanRuleForPlan(rules: readonly PlanRule[], plan: Plan): PlanRule | undefined {
  return rules.find((rule) => rule.id === plan.ruleIds?.[0] || rule.planId === plan.id);
}

function latestPlanImpactForPlan(
  impacts: readonly PlanImpact[],
  plan: Plan,
): PlanImpact | undefined {
  return impacts
    .filter((impact) => impact.planId === plan.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}
