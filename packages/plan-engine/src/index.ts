import {
  createLocalDate,
  createPlanImpact,
  type CurrentBalance,
  type InstantString,
  type LocalDate,
  type Plan,
  type PlanImpact,
  type PlanImpactId,
  type Scenario,
  type WorkspaceId,
} from '@folio/domain';

export const planEngineBoundary = {
  packageName: '@folio/plan-engine',
  deterministic: true,
  importsNativeOrUiRuntime: false,
} as const;

export type BudgetRolloverPolicy = 'none' | 'positive' | 'negative' | 'all';
export type PlanDraftSource = 'user' | 'melo';
export type PlanPriority = 'low' | 'standard' | 'high';
export type PlanContributionFrequency = 'weekly' | 'payday' | 'monthly';
export type PlanRecoveryMode = 'keep_current_contribution' | 'keep_target_date' | 'pause_first';
export type PlanAccountabilityStyle = 'gentle' | 'balanced' | 'accountability';
export type BudgetExperienceMode = 'simple' | 'pay_cycle' | 'category';
export type MomentumSignalType =
  | 'awareness'
  | 'payment'
  | 'milestone'
  | 'recovery'
  | 'review'
  | 'correction';
export type RetentionMotivation =
  | 'debt_progress'
  | 'budget_remaining'
  | 'future_plan'
  | 'calendar'
  | 'business_cash_flow'
  | 'upcoming_obligations'
  | 'personal_reflection';
export type RitualType = 'payday_review' | 'weekly_reflection' | 'month_close';

export type BudgetRolloverInput = Readonly<{
  allocationMinor: number;
  postedSpendingMinor: number;
  reservedScheduledSpendingMinor?: number;
  explicitAdjustmentMinor?: number;
  rolloverPolicy: BudgetRolloverPolicy;
  nextBaseAllocationMinor?: number;
}>;

export type BudgetRolloverResult = Readonly<{
  currentRemainingMinor: number;
  nextBaseAllocationMinor: number;
  nextEffectiveAllocationMinor: number;
  rolloverAppliedMinor: number;
}>;

export type PlanSnapshot = Readonly<{
  targetMinor: number;
  currentMinor: number;
  monthlyContributionMinor: number;
  startDate: string;
  originalCompletionDate?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  version?: number;
}>;

export type PlanRebaseInput = Readonly<{
  plan: PlanSnapshot;
  unexpected?: Readonly<{
    date: string;
    contributionReductionMinor?: number;
    reducesAugustContributionByMinor?: number;
  }>;
}>;

export type PlanRebaseResult = Readonly<{
  status: 'active' | 'paused' | 'completed';
  newProjectedCompletionDate: LocalDate;
  versionIncrement: 1;
  previousVersion: number;
  newVersion: number;
  label: 'rebased';
  failed: false;
  whatChanged: readonly string[];
  whatRemainsUnchanged: readonly string[];
}>;

export type PlanScenarioResult = Readonly<{
  actual: PlanSnapshot;
  scenario: PlanSnapshot;
  domainPlanMutated: false;
}>;

export type PlanRuleSet = Readonly<{
  priority: PlanPriority;
  contributionMinor: number;
  minContributionMinor: number;
  maxContributionMinor?: number;
  protectedFloorMinor: number;
  frequency: PlanContributionFrequency;
  pauseOnShortfall: boolean;
  recoveryMode: PlanRecoveryMode;
  accountabilityStyle: PlanAccountabilityStyle;
  hierarchyEnabled: boolean;
  parentPlanId?: string;
}>;

export type PlanDraft = Readonly<{
  id: string;
  title: string;
  source: PlanDraftSource;
  targetMinor: number;
  currentMinor: number;
  startDate: LocalDate;
  targetDate?: LocalDate;
  rules: PlanRuleSet;
  linkedRecordIds: readonly string[];
  status: 'draft';
  promptRequiredForCore: false;
  flatByDefault: true;
  hierarchyOptional: true;
  assumptions: readonly string[];
  firstScheduledActions: readonly string[];
  reviewRequiredBeforeCommit: true;
}>;

export type CreatePlanDraftInput = Readonly<{
  id: string;
  title: string;
  source: PlanDraftSource;
  targetMinor: number;
  currentMinor?: number;
  startDate: string;
  targetDate?: string;
  linkedRecordIds?: readonly string[];
  rules?: PartialPlanRuleSet;
  assumptions?: readonly string[];
}>;

export type PartialPlanRuleSet = Readonly<Partial<PlanRuleSet>>;

export type PlanRuleEditResult = Readonly<{
  previousRules: PlanRuleSet;
  nextRules: PlanRuleSet;
  changedFields: readonly (keyof PlanRuleSet)[];
  reversible: true;
  explanation: readonly string[];
  domainPlanMutated: false;
}>;

export type PlanMilestone = Readonly<{
  id: string;
  label: string;
  targetMinor: number;
  reached: boolean;
  percentage: number;
  accessibilityLabel: string;
}>;

export type ForecastChangeSummary = Readonly<{
  id: string;
  label: string;
  previousValue: string;
  currentValue: string;
  reason: string;
}>;

export type PlanProgressJourney = Readonly<{
  planId: string;
  title: string;
  currentMinor: number;
  targetMinor: number;
  progressPercent: number;
  milestones: readonly PlanMilestone[];
  forecastChanges: readonly ForecastChangeSummary[];
  accessibleTextEquivalent: string;
  reducedMotionSafe: true;
}>;

export type DynamicCascadeInput = Readonly<{
  planId: string;
  plan: PlanSnapshot;
  event: Readonly<{
    id: string;
    date: string;
    label: string;
    amountMinor: number;
    contributionReductionMinor: number;
  }>;
}>;

export type DynamicCascadeResult = Readonly<{
  atomic: true;
  historyRetained: true;
  auditEventId: string;
  previousVersion: number;
  newVersion: number;
  invalidatedProjections: readonly ['forecast', 'budget', 'plan', 'calendar', 'briefing'];
  rebase: PlanRebaseResult;
  recoveryBriefing: PlanRecoveryBriefing;
  materialChangeRequiresReview: true;
  directWriteToActualRecords: false;
}>;

export type PlanRecoveryChoice = Readonly<{
  id:
    | 'keep_target_date'
    | 'keep_current_contribution'
    | 'pause_one_cycle'
    | 'edit_event'
    | 'leave_unchanged';
  label: string;
  consequence: string;
  writesImmediately: false;
}>;

export type PlanRecoveryBriefing = Readonly<{
  title: string;
  fact: string;
  immediateEffect: string;
  protectedItemsStillCovered: readonly string[];
  changedDatesOrAmounts: readonly string[];
  nextStep: string;
  forbiddenFailedVerdictPresent: false;
  choices: readonly PlanRecoveryChoice[];
}>;

export type CanonicalPlanImpactDerivationInput = Readonly<{
  id: string | PlanImpactId;
  workspaceId: string | WorkspaceId;
  plan: Plan;
  asOf: string | LocalDate;
  currentBalance: CurrentBalance;
  scenarios?: readonly Scenario[];
  createdAt: string | InstantString;
  version?: Parameters<typeof createPlanImpact>[0]['version'];
}>;

export type BudgetExperienceRecord = Readonly<{
  id: string;
  label: string;
  amountMinor: number;
  kind: 'posted_spending' | 'reserved_scheduled' | 'adjustment' | 'excluded';
  included: boolean;
}>;

export type BudgetRemainingExperience = Readonly<{
  mode: BudgetExperienceMode;
  allocationMinor: number;
  postedSpendingMinor: number;
  reservedScheduledSpendingMinor: number;
  adjustmentsMinor: number;
  remainingMinor: number;
  includedRecords: readonly BudgetExperienceRecord[];
  excludedRecords: readonly BudgetExperienceRecord[];
  formula: string;
  calculationExplainable: true;
  budgetOptional: true;
}>;

export type MomentumSignal = Readonly<{
  id: string;
  type: MomentumSignalType;
  date: string;
  label: string;
  weight?: number;
}>;

export type MomentumState = Readonly<{
  signalCount: number;
  momentumWeight: number;
  state: 'quiet' | 'building' | 'steady' | 'recovering';
  earnedBy: readonly MomentumSignal[];
  missingDayPenalty: false;
  dailyLossStreak: false;
  screenReaderSummary: string;
}>;

export type ControlledFunState = Readonly<{
  requestedEnabled: boolean;
  effectiveState: 'disabled' | 'enabled' | 'softened' | 'suppressed';
  celebrationAllowed: boolean;
  meloAnimationAllowed: boolean;
  journeyAnimationAllowed: boolean;
  miniGameSlotAllowed: boolean;
  miniGameUsesRealFunds: false;
  reasons: readonly string[];
}>;

export type RetentionPreferenceModel = Readonly<{
  emphasizedMotivations: readonly RetentionMotivation[];
  notificationFrequency: 'quiet' | 'normal' | 'high_control';
  celebrationIntensity: 'off' | 'low' | 'standard';
  memoryDepth: 'off' | 'compact' | 'normal';
  inspectable: true;
  resettable: true;
  hiddenSensitiveProfiling: false;
  adaptedFromAcceptedBehaviorOnly: true;
}>;

export type RitualPlanInput = Readonly<{
  enabledRituals: readonly RitualType[];
  quietHours: Readonly<{ startHour: number; endHour: number }>;
  notificationClassesEnabled: Readonly<
    Record<'ritual' | 'progress' | 'meaningful_change', boolean>
  >;
  asOf: string;
}>;

export type RitualPlan = Readonly<{
  rituals: readonly Readonly<{
    type: RitualType;
    enabled: boolean;
    notificationAllowed: boolean;
    lockScreenSensitiveText: false;
    copy: string;
  }>[];
  quietStateValid: true;
  forcedDailyOpen: false;
  notificationPolicyControlled: true;
}>;

export type EmotionalSafetyReviewInput = Readonly<{
  journey: 'good_month' | 'bad_month' | 'quiet_month';
  copy: readonly string[];
  funState?: ControlledFunState;
}>;

export type EmotionalSafetyReview = Readonly<{
  passed: boolean;
  journey: EmotionalSafetyReviewInput['journey'];
  issues: readonly string[];
  shameLanguageFound: false | readonly string[];
  manipulativeRetentionFound: false | readonly string[];
  badMonthCelebrationSuppressed: boolean;
}>;

export function calculateBudgetRollover(input: BudgetRolloverInput): BudgetRolloverResult {
  assertSafeInteger(input.allocationMinor, 'Budget allocation');
  assertSafeInteger(input.postedSpendingMinor, 'Budget posted spending');
  const reserved = input.reservedScheduledSpendingMinor ?? 0;
  const adjustment = input.explicitAdjustmentMinor ?? 0;
  assertSafeInteger(reserved, 'Budget reserved spending');
  assertSafeInteger(adjustment, 'Budget adjustment');

  const currentRemainingMinor =
    input.allocationMinor - input.postedSpendingMinor - reserved + adjustment;
  assertSafeInteger(currentRemainingMinor, 'Budget remaining');

  const nextBaseAllocationMinor = input.nextBaseAllocationMinor ?? input.allocationMinor;
  assertSafeInteger(nextBaseAllocationMinor, 'Next budget allocation');

  const rolloverAppliedMinor = calculateRolloverAmount(currentRemainingMinor, input.rolloverPolicy);
  const nextEffectiveAllocationMinor = nextBaseAllocationMinor + rolloverAppliedMinor;
  assertSafeInteger(nextEffectiveAllocationMinor, 'Next effective budget allocation');

  return {
    currentRemainingMinor,
    nextBaseAllocationMinor,
    nextEffectiveAllocationMinor,
    rolloverAppliedMinor,
  };
}

export function rebasePlan(input: PlanRebaseInput): PlanRebaseResult {
  validatePlan(input.plan);
  const previousVersion = input.plan.version ?? 1;
  const contributionReductions = new Map<string, number>();
  if (input.unexpected !== undefined) {
    const date = createLocalDate(input.unexpected.date);
    const reduction =
      input.unexpected.contributionReductionMinor ??
      input.unexpected.reducesAugustContributionByMinor ??
      0;
    assertSafeInteger(reduction, 'Plan contribution reduction');
    contributionReductions.set(date.slice(0, 7), reduction);
  }

  const newProjectedCompletionDate = projectPlanCompletionDate({
    ...input.plan,
    contributionReductions,
  });

  return {
    status: input.plan.status === 'paused' ? 'paused' : 'active',
    newProjectedCompletionDate,
    versionIncrement: 1,
    previousVersion,
    newVersion: previousVersion + 1,
    label: 'rebased',
    failed: false,
    whatChanged: ['projected_completion_date'],
    whatRemainsUnchanged: ['target', 'history', 'user_selected_rules'],
  };
}

export function projectPlanCompletionDate(
  input: PlanSnapshot & {
    contributionReductions?: ReadonlyMap<string, number>;
  },
): LocalDate {
  validatePlan(input);
  const startDate = createLocalDate(input.startDate);
  let savedMinor = input.currentMinor;
  const anchorDay = Number(startDate.slice(8, 10));

  for (let monthIndex = 0; monthIndex < 600; monthIndex += 1) {
    const contributionMonth = addMonthsToLocalDate(startDate, monthIndex, anchorDay);
    const monthKey = contributionMonth.slice(0, 7);
    const reduction = input.contributionReductions?.get(monthKey) ?? 0;
    const contribution = Math.max(0, input.monthlyContributionMinor - reduction);
    savedMinor += contribution;
    assertSafeInteger(savedMinor, 'Plan projected progress');

    if (savedMinor >= input.targetMinor) {
      return endOfMonth(contributionMonth);
    }
  }

  throw new Error('Plan projection did not complete within the bounded 600 month window.');
}

export function runPlanScenario(input: {
  plan: PlanSnapshot;
  monthlyContributionDeltaMinor?: number;
}): PlanScenarioResult {
  validatePlan(input.plan);
  const delta = input.monthlyContributionDeltaMinor ?? 0;
  assertSafeInteger(delta, 'Plan scenario contribution delta');
  const scenarioContribution = input.plan.monthlyContributionMinor + delta;
  assertSafeInteger(scenarioContribution, 'Plan scenario monthly contribution');

  return {
    actual: { ...input.plan },
    scenario: {
      ...input.plan,
      monthlyContributionMinor: scenarioContribution,
    },
    domainPlanMutated: false,
  };
}

export function createPlanDraft(input: CreatePlanDraftInput): PlanDraft {
  assertNonEmpty(input.id, 'Plan id');
  assertNonEmpty(input.title, 'Plan title');
  assertSafeInteger(input.targetMinor, 'Plan target');
  const currentMinor = input.currentMinor ?? 0;
  assertSafeInteger(currentMinor, 'Plan current amount');
  if (input.targetMinor <= 0 || currentMinor < 0) {
    throw new Error('Plan target must be positive and current amount cannot be negative.');
  }

  const rules = normalizePlanRules(input.rules);
  const startDate = createLocalDate(input.startDate);
  const targetDate = input.targetDate === undefined ? undefined : createLocalDate(input.targetDate);
  const linkedRecordIds = input.linkedRecordIds ?? [];

  const draftBase = {
    id: input.id,
    title: input.title,
    source: input.source,
    targetMinor: input.targetMinor,
    currentMinor,
    startDate,
    rules,
    linkedRecordIds,
    status: 'draft',
    promptRequiredForCore: false,
    flatByDefault: true,
    hierarchyOptional: true,
    assumptions:
      input.assumptions && input.assumptions.length > 0
        ? [...input.assumptions]
        : ['Plan is optional and can be edited before it writes anything.'],
    firstScheduledActions: buildFirstScheduledActions(rules, startDate),
    reviewRequiredBeforeCommit: true,
  } satisfies Omit<PlanDraft, 'targetDate'>;

  return targetDate === undefined ? draftBase : { ...draftBase, targetDate };
}

export function editPlanRules(input: {
  currentRules: PlanRuleSet;
  patch: PartialPlanRuleSet;
}): PlanRuleEditResult {
  validatePlanRules(input.currentRules);
  const nextRules = normalizePlanRules({ ...input.currentRules, ...input.patch });
  const changedFields = (Object.keys(nextRules) as (keyof PlanRuleSet)[]).filter(
    (field) => input.currentRules[field] !== nextRules[field],
  );

  return {
    previousRules: input.currentRules,
    nextRules,
    changedFields,
    reversible: true,
    explanation:
      changedFields.length === 0
        ? ['No rule changes were applied.']
        : changedFields.map((field) => `${String(field)} changed and can be reverted.`),
    domainPlanMutated: false,
  };
}

export function buildPlanProgressJourney(input: {
  planId: string;
  title: string;
  targetMinor: number;
  currentMinor: number;
  forecastChanges?: readonly ForecastChangeSummary[];
  milestoneFractions?: readonly number[];
}): PlanProgressJourney {
  assertNonEmpty(input.planId, 'Plan id');
  assertNonEmpty(input.title, 'Plan title');
  assertSafeInteger(input.targetMinor, 'Plan target');
  assertSafeInteger(input.currentMinor, 'Plan current amount');
  if (input.targetMinor <= 0 || input.currentMinor < 0) {
    throw new Error('Plan target must be positive and current amount cannot be negative.');
  }

  const progressPercent = clampPercentage((input.currentMinor / input.targetMinor) * 100);
  const fractions = input.milestoneFractions ?? [0.25, 0.5, 0.75, 1];
  const milestones = fractions.map((fraction) => {
    const targetMinor = Math.round(input.targetMinor * fraction);
    const percentage = clampPercentage(fraction * 100);
    return {
      id: `milestone-${percentage}`,
      label: `${percentage}%`,
      targetMinor,
      reached: input.currentMinor >= targetMinor,
      percentage,
      accessibilityLabel: `${percentage}% milestone ${
        input.currentMinor >= targetMinor ? 'reached' : 'not reached yet'
      }`,
    };
  });

  const forecastChanges = input.forecastChanges ?? [];
  const changeText =
    forecastChanges.length === 0
      ? 'No forecast changes are attached to this view.'
      : forecastChanges.map((change) => `${change.label}: ${change.currentValue}`).join(' ');

  return {
    planId: input.planId,
    title: input.title,
    currentMinor: input.currentMinor,
    targetMinor: input.targetMinor,
    progressPercent,
    milestones,
    forecastChanges,
    accessibleTextEquivalent: `${input.title} is ${progressPercent}% complete. ${changeText}`,
    reducedMotionSafe: true,
  };
}

export function applyDynamicPlanCascade(input: DynamicCascadeInput): DynamicCascadeResult {
  assertNonEmpty(input.planId, 'Plan id');
  assertNonEmpty(input.event.id, 'Event id');
  assertNonEmpty(input.event.label, 'Event label');
  createLocalDate(input.event.date);
  assertSafeInteger(input.event.amountMinor, 'Event amount');
  assertSafeInteger(input.event.contributionReductionMinor, 'Event contribution reduction');
  if (input.event.contributionReductionMinor < 0) {
    throw new Error('Contribution reduction cannot be negative.');
  }

  const rebase = rebasePlan({
    plan: input.plan,
    unexpected: {
      date: input.event.date,
      contributionReductionMinor: input.event.contributionReductionMinor,
    },
  });

  return {
    atomic: true,
    historyRetained: true,
    auditEventId: input.event.id,
    previousVersion: rebase.previousVersion,
    newVersion: rebase.newVersion,
    invalidatedProjections: ['forecast', 'budget', 'plan', 'calendar', 'briefing'],
    rebase,
    recoveryBriefing: buildRecoveryBriefing({
      eventLabel: input.event.label,
      effectLabel: `The current plan projection moved to ${rebase.newProjectedCompletionDate}.`,
      protectedItemsStillCovered: ['Known protected obligations remain inspectable.'],
      changedDatesOrAmounts: [`Plan version ${rebase.previousVersion} to ${rebase.newVersion}`],
    }),
    materialChangeRequiresReview: true,
    directWriteToActualRecords: false,
  };
}

export function derivePlanImpactFromCanonicalRecords(
  input: CanonicalPlanImpactDerivationInput,
): PlanImpact {
  const relevantScenarioIds = (input.scenarios ?? [])
    .filter((scenario) => scenario.affectedPlanIds.includes(input.plan.id))
    .map((scenario) => scenario.id);
  const protectedAmount = input.plan.protectedAmount ??
    input.plan.targetAmount ?? {
      minorUnits: 0,
      currency: input.currentBalance.balance.currency,
    };
  const needsReview =
    relevantScenarioIds.length > 0 ||
    input.currentBalance.balance.minorUnits < protectedAmount.minorUnits;
  const direction =
    relevantScenarioIds.length > 0
      ? 'needs-review'
      : input.currentBalance.balance.minorUnits < protectedAmount.minorUnits
        ? 'behind'
        : 'unchanged';
  const changedRecordIds = Array.from(
    new Set([
      ...input.plan.commitmentIds.map(String),
      ...(input.plan.expectationIds ?? []).map(String),
      ...(input.plan.transactionIds ?? []).map(String),
      ...(input.plan.eventIds ?? []).map(String),
      ...(input.plan.decisionIds ?? []).map(String),
      ...(input.plan.auditLogIds ?? []).map(String),
      String(input.currentBalance.id),
      ...relevantScenarioIds.map(String),
    ]),
  );

  return createPlanImpact({
    id: input.id,
    workspaceId: input.workspaceId,
    planId: input.plan.id,
    asOf: input.asOf,
    summary:
      relevantScenarioIds.length > 0
        ? `${input.plan.title} is affected by an accepted recovery scenario.`
        : `${input.plan.title} is checked against the current canonical position.`,
    changedRecordIds,
    direction,
    newProjectedOutcome:
      relevantScenarioIds.length > 0 && input.plan.targetDate !== undefined
        ? `${input.plan.title} remains linked to ${input.plan.targetDate} and needs review after accepted recovery.`
        : input.plan.targetDate === undefined
          ? `${input.plan.title} remains visible for review.`
          : `${input.plan.title} remains linked to ${input.plan.targetDate}.`,
    protectedAmount,
    needsReview,
    reviewReasons: needsReview
      ? ['Review the visible plan trade-off before changing the plan.']
      : [],
    optionIds: needsReview
      ? ['keep-current-plan', 'adjust-contribution', 'pause-and-review']
      : ['inspect-plan'],
    scenarioIds: relevantScenarioIds,
    authorityState: relevantScenarioIds.length > 0 ? 'hypothetical' : 'inferred',
    reviewState: needsReview ? 'needs-review' : 'not-required',
    createdAt: input.createdAt,
    ...(input.version === undefined ? {} : { version: input.version }),
    ...(input.plan.targetDate === undefined ? {} : { newProjectedDate: input.plan.targetDate }),
    ...(input.plan.targetAmount === undefined
      ? {}
      : { newProjectedAmount: input.plan.targetAmount }),
    ...(input.plan.sourceRecordId === undefined
      ? {}
      : { sourceRecordId: input.plan.sourceRecordId }),
    ...(input.plan.provenanceId === undefined ? {} : { provenanceId: input.plan.provenanceId }),
  });
}

export function buildRecoveryRebaseExperience(input: {
  eventLabel: string;
  immediateEffect: string;
  protectedItemsStillCovered?: readonly string[];
  changedDatesOrAmounts: readonly string[];
}): PlanRecoveryBriefing {
  return buildRecoveryBriefing({
    eventLabel: input.eventLabel,
    effectLabel: input.immediateEffect,
    protectedItemsStillCovered: input.protectedItemsStillCovered ?? [],
    changedDatesOrAmounts: input.changedDatesOrAmounts,
  });
}

export function buildBudgetRemainingExperience(input: {
  mode: BudgetExperienceMode;
  allocationMinor: number;
  records: readonly BudgetExperienceRecord[];
}): BudgetRemainingExperience {
  assertSafeInteger(input.allocationMinor, 'Budget allocation');
  const includedRecords = input.records.filter((record) => record.included);
  const excludedRecords = input.records.filter((record) => !record.included);

  let postedSpendingMinor = 0;
  let reservedScheduledSpendingMinor = 0;
  let adjustmentsMinor = 0;

  for (const record of includedRecords) {
    assertBudgetExperienceRecord(record);
    if (record.kind === 'posted_spending') postedSpendingMinor += Math.abs(record.amountMinor);
    if (record.kind === 'reserved_scheduled') {
      reservedScheduledSpendingMinor += Math.abs(record.amountMinor);
    }
    if (record.kind === 'adjustment') adjustmentsMinor += record.amountMinor;
  }
  for (const record of excludedRecords) assertBudgetExperienceRecord(record);

  const remainingMinor =
    input.allocationMinor - postedSpendingMinor - reservedScheduledSpendingMinor + adjustmentsMinor;
  assertSafeInteger(remainingMinor, 'Budget remaining');

  return {
    mode: input.mode,
    allocationMinor: input.allocationMinor,
    postedSpendingMinor,
    reservedScheduledSpendingMinor,
    adjustmentsMinor,
    remainingMinor,
    includedRecords,
    excludedRecords,
    formula: 'allocation - posted spending - reserved scheduled spending +/- explicit adjustments',
    calculationExplainable: true,
    budgetOptional: true,
  };
}

export function buildMomentumState(input: {
  signals: readonly MomentumSignal[];
  badMonthMode?: boolean;
}): MomentumState {
  const earnedBy = input.signals.map((signal) => {
    assertNonEmpty(signal.id, 'Momentum signal id');
    assertNonEmpty(signal.label, 'Momentum signal label');
    createLocalDate(signal.date);
    if (signal.weight !== undefined) assertSafeInteger(signal.weight, 'Momentum signal weight');
    return signal;
  });
  const momentumWeight = earnedBy.reduce((sum, signal) => sum + (signal.weight ?? 1), 0);
  const state =
    earnedBy.some((signal) => signal.type === 'recovery') || input.badMonthMode
      ? 'recovering'
      : momentumWeight >= 6
        ? 'steady'
        : momentumWeight > 0
          ? 'building'
          : 'quiet';

  return {
    signalCount: earnedBy.length,
    momentumWeight,
    state,
    earnedBy,
    missingDayPenalty: false,
    dailyLossStreak: false,
    screenReaderSummary:
      earnedBy.length === 0
        ? 'No momentum signals are required today.'
        : `Momentum is ${state} from ${earnedBy.length} real progress signals.`,
  };
}

export function buildControlledFunState(input: {
  enabled: boolean;
  badMonthMode?: boolean;
  hardshipContext?: boolean;
  miniGameEnabled?: boolean;
  journeyAnimationEnabled?: boolean;
}): ControlledFunState {
  if (!input.enabled) {
    return {
      requestedEnabled: false,
      effectiveState: 'disabled',
      celebrationAllowed: false,
      meloAnimationAllowed: false,
      journeyAnimationAllowed: false,
      miniGameSlotAllowed: false,
      miniGameUsesRealFunds: false,
      reasons: ['Fun layer is disabled by preference.'],
    };
  }

  if (input.badMonthMode || input.hardshipContext) {
    return {
      requestedEnabled: true,
      effectiveState: input.hardshipContext ? 'suppressed' : 'softened',
      celebrationAllowed: false,
      meloAnimationAllowed: false,
      journeyAnimationAllowed: false,
      miniGameSlotAllowed: false,
      miniGameUsesRealFunds: false,
      reasons: ['Bad-month or hardship context suppresses playful output.'],
    };
  }

  return {
    requestedEnabled: true,
    effectiveState: 'enabled',
    celebrationAllowed: true,
    meloAnimationAllowed: true,
    journeyAnimationAllowed: input.journeyAnimationEnabled ?? true,
    miniGameSlotAllowed: input.miniGameEnabled ?? false,
    miniGameUsesRealFunds: false,
    reasons: ['Enabled only for real progress, never for comparison or product choice.'],
  };
}

export function createRetentionPreferenceModel(
  input: Partial<RetentionPreferenceModel> = {},
): RetentionPreferenceModel {
  return {
    emphasizedMotivations: input.emphasizedMotivations ?? ['upcoming_obligations'],
    notificationFrequency: input.notificationFrequency ?? 'quiet',
    celebrationIntensity: input.celebrationIntensity ?? 'low',
    memoryDepth: input.memoryDepth ?? 'compact',
    inspectable: true,
    resettable: true,
    hiddenSensitiveProfiling: false,
    adaptedFromAcceptedBehaviorOnly: true,
  };
}

export function updateRetentionPreferenceModel(
  current: RetentionPreferenceModel,
  patch: Partial<RetentionPreferenceModel>,
): RetentionPreferenceModel {
  return createRetentionPreferenceModel({ ...current, ...patch });
}

export function resetRetentionPreferenceModel(): RetentionPreferenceModel {
  return createRetentionPreferenceModel({
    emphasizedMotivations: ['upcoming_obligations'],
    notificationFrequency: 'quiet',
    celebrationIntensity: 'low',
    memoryDepth: 'compact',
  });
}

export function buildRitualPlan(input: RitualPlanInput): RitualPlan {
  validateQuietHours(input.quietHours);
  createLocalDate(input.asOf);
  const ritualTypes: readonly RitualType[] = ['payday_review', 'weekly_reflection', 'month_close'];
  const rituals = ritualTypes.map((type) => {
    const enabled = input.enabledRituals.includes(type);
    const notificationAllowed = enabled && input.notificationClassesEnabled.ritual;
    return {
      type,
      enabled,
      notificationAllowed,
      lockScreenSensitiveText: false as const,
      copy: enabled ? ritualCopyFor(type) : `${ritualLabel(type)} is off.`,
    };
  });

  return {
    rituals,
    quietStateValid: true,
    forcedDailyOpen: false,
    notificationPolicyControlled: true,
  };
}

export function runPhase8EmotionalSafetyReview(
  input: EmotionalSafetyReviewInput,
): EmotionalSafetyReview {
  const shameLanguageFound = findForbiddenCopy(input.copy, [
    'failed',
    'failure',
    'lazy',
    'irresponsible',
    'bad with money',
  ]);
  const manipulativeRetentionFound = findForbiddenCopy(input.copy, [
    'streak is dying',
    'lose progress',
    'open now',
    'come back now',
  ]);
  const issues = [
    ...shameLanguageFound.map((phrase) => `Shame language: ${phrase}`),
    ...manipulativeRetentionFound.map((phrase) => `Manipulative retention: ${phrase}`),
  ];
  const badMonthCelebrationSuppressed =
    input.journey !== 'bad_month' ||
    input.funState === undefined ||
    input.funState.celebrationAllowed === false;

  if (!badMonthCelebrationSuppressed) {
    issues.push('Bad-month journey still allows celebration.');
  }

  return {
    passed: issues.length === 0,
    journey: input.journey,
    issues,
    shameLanguageFound: shameLanguageFound.length === 0 ? false : shameLanguageFound,
    manipulativeRetentionFound:
      manipulativeRetentionFound.length === 0 ? false : manipulativeRetentionFound,
    badMonthCelebrationSuppressed,
  };
}

function calculateRolloverAmount(
  currentRemainingMinor: number,
  policy: BudgetRolloverPolicy,
): number {
  if (policy === 'none') return 0;
  if (policy === 'positive') return Math.max(0, currentRemainingMinor);
  if (policy === 'negative') return Math.min(0, currentRemainingMinor);
  return currentRemainingMinor;
}

function validatePlan(plan: PlanSnapshot): void {
  assertSafeInteger(plan.targetMinor, 'Plan target');
  assertSafeInteger(plan.currentMinor, 'Plan current amount');
  assertSafeInteger(plan.monthlyContributionMinor, 'Plan monthly contribution');
  if (plan.targetMinor <= 0 || plan.currentMinor < 0 || plan.monthlyContributionMinor <= 0) {
    throw new Error('Plan target and monthly contribution must be positive.');
  }
  createLocalDate(plan.startDate);
  if (plan.originalCompletionDate !== undefined) createLocalDate(plan.originalCompletionDate);
}

function addMonthsToLocalDate(date: LocalDate, months: number, anchorDay: number): LocalDate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return createLocalDate(
    `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(
      Math.min(anchorDay, daysInMonth),
    ).padStart(2, '0')}`,
  );
}

function endOfMonth(date: LocalDate): LocalDate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return createLocalDate(`${date.slice(0, 8)}${String(daysInMonth).padStart(2, '0')}`);
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer.`);
  }
}

function normalizePlanRules(input: PartialPlanRuleSet = {}): PlanRuleSet {
  const contributionMinor = input.contributionMinor ?? 0;
  const minContributionMinor = input.minContributionMinor ?? Math.max(0, contributionMinor);
  const rulesBase = {
    priority: input.priority ?? 'standard',
    contributionMinor,
    minContributionMinor,
    protectedFloorMinor: input.protectedFloorMinor ?? 0,
    frequency: input.frequency ?? 'monthly',
    pauseOnShortfall: input.pauseOnShortfall ?? true,
    recoveryMode: input.recoveryMode ?? 'keep_current_contribution',
    accountabilityStyle: input.accountabilityStyle ?? 'balanced',
    hierarchyEnabled: input.hierarchyEnabled ?? false,
  } satisfies Omit<PlanRuleSet, 'maxContributionMinor' | 'parentPlanId'>;
  const rules: PlanRuleSet = {
    ...rulesBase,
    ...(input.maxContributionMinor === undefined
      ? {}
      : { maxContributionMinor: input.maxContributionMinor }),
    ...(input.hierarchyEnabled && input.parentPlanId !== undefined
      ? { parentPlanId: input.parentPlanId }
      : {}),
  };
  validatePlanRules(rules);
  return rules;
}

function validatePlanRules(rules: PlanRuleSet): void {
  assertSafeInteger(rules.contributionMinor, 'Plan contribution');
  assertSafeInteger(rules.minContributionMinor, 'Plan minimum contribution');
  assertSafeInteger(rules.protectedFloorMinor, 'Plan protected floor');
  if (rules.maxContributionMinor !== undefined) {
    assertSafeInteger(rules.maxContributionMinor, 'Plan maximum contribution');
  }
  if (
    rules.contributionMinor < 0 ||
    rules.minContributionMinor < 0 ||
    rules.protectedFloorMinor < 0
  ) {
    throw new Error('Plan rule amounts cannot be negative.');
  }
  if (
    rules.maxContributionMinor !== undefined &&
    rules.maxContributionMinor < rules.minContributionMinor
  ) {
    throw new Error('Plan maximum contribution cannot be below the minimum contribution.');
  }
  if (!rules.hierarchyEnabled && rules.parentPlanId !== undefined) {
    throw new Error('Parent plan requires hierarchy to be enabled.');
  }
}

function buildFirstScheduledActions(rules: PlanRuleSet, startDate: LocalDate): readonly string[] {
  if (rules.contributionMinor <= 0) return ['Review the draft before scheduling contributions.'];
  return [`First ${rules.frequency} contribution can be reviewed from ${startDate}.`];
}

function buildRecoveryBriefing(input: {
  eventLabel: string;
  effectLabel: string;
  protectedItemsStillCovered: readonly string[];
  changedDatesOrAmounts: readonly string[];
}): PlanRecoveryBriefing {
  assertNonEmpty(input.eventLabel, 'Recovery event label');
  assertNonEmpty(input.effectLabel, 'Recovery effect label');
  const briefing = {
    title: 'Plan needs review',
    fact: input.eventLabel,
    immediateEffect: input.effectLabel,
    protectedItemsStillCovered:
      input.protectedItemsStillCovered.length > 0
        ? input.protectedItemsStillCovered
        : ['Protected items are listed when the forecast provides them.'],
    changedDatesOrAmounts: input.changedDatesOrAmounts,
    nextStep: 'Choose whether to keep, alter, pause or leave the plan unchanged for now.',
    forbiddenFailedVerdictPresent: false,
    choices: defaultRecoveryChoices(),
  } satisfies PlanRecoveryBriefing;

  assertNoForbiddenCopy([
    briefing.title,
    briefing.fact,
    briefing.immediateEffect,
    briefing.nextStep,
    ...briefing.protectedItemsStillCovered,
    ...briefing.changedDatesOrAmounts,
    ...briefing.choices.flatMap((choice) => [choice.label, choice.consequence]),
  ]);
  return briefing;
}

function defaultRecoveryChoices(): readonly PlanRecoveryChoice[] {
  return [
    {
      id: 'keep_target_date',
      label: 'Keep the target date',
      consequence: 'Review the contribution needed to preserve the date.',
      writesImmediately: false,
    },
    {
      id: 'keep_current_contribution',
      label: 'Keep current contributions',
      consequence: 'Accept a later projected date before saving a new version.',
      writesImmediately: false,
    },
    {
      id: 'pause_one_cycle',
      label: 'Pause for one cycle',
      consequence: 'Protect near-term cash flow and review the plan after the pause.',
      writesImmediately: false,
    },
    {
      id: 'edit_event',
      label: 'Edit the event',
      consequence: 'Correct the fact first if the amount, date or label is wrong.',
      writesImmediately: false,
    },
    {
      id: 'leave_unchanged',
      label: 'Leave it for now',
      consequence: 'Keep the current plan version visible without saving a new one.',
      writesImmediately: false,
    },
  ];
}

function assertBudgetExperienceRecord(record: BudgetExperienceRecord): void {
  assertNonEmpty(record.id, 'Budget record id');
  assertNonEmpty(record.label, 'Budget record label');
  assertSafeInteger(record.amountMinor, 'Budget record amount');
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
}

function validateQuietHours(quietHours: { startHour: number; endHour: number }): void {
  assertSafeInteger(quietHours.startHour, 'Quiet-hours start');
  assertSafeInteger(quietHours.endHour, 'Quiet-hours end');
  if (
    quietHours.startHour < 0 ||
    quietHours.startHour > 23 ||
    quietHours.endHour < 0 ||
    quietHours.endHour > 23
  ) {
    throw new Error('Quiet hours must use hours from 0 to 23.');
  }
}

function ritualLabel(type: RitualType): string {
  if (type === 'payday_review') return 'Payday review';
  if (type === 'weekly_reflection') return 'Weekly reflection';
  return 'Month close';
}

function ritualCopyFor(type: RitualType): string {
  if (type === 'payday_review') return 'Payday review is ready when useful.';
  if (type === 'weekly_reflection') return 'Weekly reflection can wait until you choose it.';
  return 'Month close can summarise records without forcing a daily open.';
}

function findForbiddenCopy(copy: readonly string[], phrases: readonly string[]): readonly string[] {
  const joined = copy.join('\n').toLowerCase();
  return phrases.filter((phrase) => joined.includes(phrase));
}

function assertNoForbiddenCopy(copy: readonly string[]): void {
  const forbidden = findForbiddenCopy(copy, ['failed', 'streak is dying', 'lose progress']);
  if (forbidden.length > 0) {
    throw new Error(`Forbidden recovery copy: ${forbidden.join(', ')}`);
  }
}
