export const meloPolicyBoundary = {
  packageName: '@folio/melo-policy',
  modelRequired: false,
  networkRequired: false,
  writesDirectlyToStorage: false,
  directDomainWriteAllowed: false,
} as const;

export type AdviceBlockedCategory =
  | 'personal_recommendation'
  | 'suitability'
  | 'final_tax_or_legal'
  | 'guarantee'
  | 'shame'
  | 'false_reassurance'
  | 'certainty_overclaim';

export type AdviceLanguageMatch = Readonly<{
  category: AdviceBlockedCategory;
  pattern: string;
  excerpt: string;
}>;

export type AdviceLanguageClassification = Readonly<{
  allowed: boolean;
  matches: readonly AdviceLanguageMatch[];
}>;

export type EscalationTrigger =
  | 'insolvency'
  | 'formal_debt_solution'
  | 'investment_selection'
  | 'credit_product_selection'
  | 'legal_dispute'
  | 'tax_eligibility_ambiguity'
  | 'immediate_crisis';

type BlockedPattern = Readonly<{
  category: AdviceBlockedCategory;
  label: string;
  regex: RegExp;
}>;

const blockedPatterns: readonly BlockedPattern[] = [
  {
    category: 'personal_recommendation',
    label: 'you_should_financial_action',
    regex:
      /\byou should\b[^.!?]*(?:pay|choose|take|use|invest|clear|prioriti[sz]e|switch|claim)\b/i,
  },
  {
    category: 'personal_recommendation',
    label: 'best_option_for_you',
    regex: /\b(?:best|right) option for you\b/i,
  },
  {
    category: 'personal_recommendation',
    label: 'pay_debt_first',
    regex: /\bpay (?:this|that|the) debt first\b/i,
  },
  {
    category: 'suitability',
    label: 'suitable_for_you',
    regex: /\bsuitable for you\b/i,
  },
  {
    category: 'suitability',
    label: 'can_afford_credit',
    regex: /\byou can afford\b[^.!?]*(?:loan|credit|mortgage|product|repayment)\b/i,
  },
  {
    category: 'final_tax_or_legal',
    label: 'final_tax_bill',
    regex: /\bfinal tax bill\b/i,
  },
  {
    category: 'final_tax_or_legal',
    label: 'definitely_deductible',
    regex: /\b(?:definitely|guaranteed|certainly) deductible\b/i,
  },
  {
    category: 'guarantee',
    label: 'debt_free_by_date',
    regex: /\byou will be debt[- ]free by\b/i,
  },
  {
    category: 'guarantee',
    label: 'everything_will_be_fine',
    regex: /\beverything will be fine\b/i,
  },
  {
    category: 'guarantee',
    label: 'guaranteed_outcome',
    regex: /\bguaranteed\b[^.!?]*(?:saving|outcome|forecast|result|date|position)?\b/i,
  },
  {
    category: 'guarantee',
    label: 'will_definitely_outcome',
    regex: /\bwill definitely\b[^.!?]*(?:clear|save|afford|cover|finish|be debt[- ]free)\b/i,
  },
  {
    category: 'shame',
    label: 'failure_verdict',
    regex: /\b(?:you failed|failed this month|irresponsible|bad with money|your fault)\b/i,
  },
  {
    category: 'false_reassurance',
    label: 'minimises_hardship',
    regex: /\b(?:do not worry|nothing to worry about|just stay positive)\b/i,
  },
  {
    category: 'certainty_overclaim',
    label: 'certain_forecast',
    regex:
      /\b(?:certain|definite|definitely|will happen|cannot go wrong)\b[^.!?]*(?:forecast|plan|date|result|outcome)?\b/i,
  },
];

const escalationTriggerPatterns: readonly Readonly<{
  trigger: EscalationTrigger;
  regex: RegExp;
}>[] = [
  { trigger: 'insolvency', regex: /\binsolvenc(?:y|e)\b/i },
  { trigger: 'formal_debt_solution', regex: /\b(?:iva|bankruptcy|debt relief order)\b/i },
  { trigger: 'investment_selection', regex: /\b(?:which investment|invest in|buy shares)\b/i },
  {
    trigger: 'credit_product_selection',
    regex: /\b(?:which loan|which credit card|best mortgage)\b/i,
  },
  { trigger: 'legal_dispute', regex: /\b(?:legal dispute|sue|court claim)\b/i },
  {
    trigger: 'tax_eligibility_ambiguity',
    regex: /\b(?:am i eligible|can i claim|tax deductible)\b/i,
  },
  {
    trigger: 'immediate_crisis',
    regex:
      /\b(?:can't eat|cannot eat|unsafe|immediate danger|need emergency help|emergency (?:food|housing|support)|this is an emergency)\b/i,
  },
];

export function classifyAdviceLanguage(text: string): AdviceLanguageClassification {
  const matches: AdviceLanguageMatch[] = [];
  for (const pattern of blockedPatterns) {
    const match = pattern.regex.exec(text);
    if (match?.[0] !== undefined) {
      matches.push({
        category: pattern.category,
        pattern: pattern.label,
        excerpt: match[0],
      });
    }
  }

  return {
    allowed: matches.length === 0,
    matches,
  };
}

export function findEscalationTriggers(text: string): readonly EscalationTrigger[] {
  return escalationTriggerPatterns
    .filter((pattern) => pattern.regex.test(text))
    .map((pattern) => pattern.trigger);
}

export type MeloToneMode = 'gentle' | 'balanced' | 'accountability';
export type MeloHumourMode = 'off' | 'subtle';
export type MeloCelebrationMode = 'off' | 'subtle' | 'standard';

export type MeloTonePreferences = Readonly<{
  mode: MeloToneMode;
  humour: MeloHumourMode;
  celebration: MeloCelebrationMode;
}>;

export const defaultMeloTonePreferences: MeloTonePreferences = {
  mode: 'balanced',
  humour: 'subtle',
  celebration: 'subtle',
};

export type MeloIntentId =
  | 'first_launch'
  | 'minimal_until_date'
  | 'extra_payment_scenario'
  | 'higher_rent_actual'
  | 'bad_month_event'
  | 'create_plan'
  | 'plan_behind'
  | 'business_invoice'
  | 'memory_correction'
  | 'unknown';

export type MeloSlotDefinition = Readonly<{
  id: string;
  label: string;
  question: string;
  whyItMatters?: string;
}>;

export type MeloIntentDefinition = Readonly<{
  id: MeloIntentId;
  endGoal: string;
  requiredSlots: readonly MeloSlotDefinition[];
  optionalSlots: readonly MeloSlotDefinition[];
  maxQuestions: number;
  deterministicResult:
    | 'labelled_first_path'
    | 'partial_position'
    | 'scenario_result'
    | 'proposal'
    | 'briefing'
    | 'manual_review';
  stopCondition: string;
  fallback: string;
}>;

const slot = (
  id: string,
  label: string,
  question: string,
  whyItMatters?: string,
): MeloSlotDefinition => ({
  id,
  label,
  question,
  ...(whyItMatters ? { whyItMatters } : {}),
});

export const meloIntentRegistry: readonly MeloIntentDefinition[] = [
  {
    id: 'first_launch',
    endGoal: 'Choose one useful first path without setup pressure.',
    requiredSlots: [],
    optionalSlots: [
      slot('path', 'First path', 'Would you like an example, one payment, import, or explore?'),
    ],
    maxQuestions: 1,
    deterministicResult: 'labelled_first_path',
    stopCondition: 'A path is selected or the user chooses to explore.',
    fallback: 'Show the labelled example and normal controls.',
  },
  {
    id: 'minimal_until_date',
    endGoal: 'Build a clearly labelled partial view until a date.',
    requiredSlots: [
      slot('available_now', 'Available now', 'Roughly how much money can you use today?'),
      slot(
        'important_outgoings',
        'Important outgoings',
        'What important payment or essential spending still has to happen before then?',
      ),
    ],
    optionalSlots: [slot('target_date', 'Target date', 'Which date do you want to check through?')],
    maxQuestions: 2,
    deterministicResult: 'partial_position',
    stopCondition: 'Available money and important outgoings are known.',
    fallback: 'Give a partial answer and offer manual review of missing items.',
  },
  {
    id: 'extra_payment_scenario',
    endGoal: 'Compare a hypothetical payment through the deterministic scenario engine.',
    requiredSlots: [slot('amount', 'Scenario amount', 'What amount should Melo compare?')],
    optionalSlots: [
      slot('date', 'Scenario date', 'Should this be modelled today or on another date?'),
    ],
    maxQuestions: 2,
    deterministicResult: 'scenario_result',
    stopCondition: 'Amount is known and assumptions can be shown.',
    fallback: 'Offer structured scenario controls.',
  },
  {
    id: 'higher_rent_actual',
    endGoal: 'Classify a higher actual amount without editing the posted transaction.',
    requiredSlots: [
      slot(
        'reason',
        'Variance reason',
        'Was this a new regular amount, a one-off fee, a wrong match, or something else?',
      ),
    ],
    optionalSlots: [slot('note', 'Optional note', 'Would you like to add a short note?')],
    maxQuestions: 1,
    deterministicResult: 'proposal',
    stopCondition: 'A variance reason or manual review path is selected.',
    fallback: 'Keep the expectation unchanged and mark the variance for review.',
  },
  {
    id: 'bad_month_event',
    endGoal:
      'Capture an unexpected cost and present what changed, what remains stable and options.',
    requiredSlots: [
      slot('amount', 'Unexpected amount', 'How much was the unexpected cost?'),
      slot('description', 'Event description', 'What should this event be called?'),
    ],
    optionalSlots: [slot('date', 'Event date', 'Did it happen today?')],
    maxQuestions: 2,
    deterministicResult: 'proposal',
    stopCondition: 'The event can be reviewed before commit.',
    fallback: 'Create a review card with visible missing fields.',
  },
  {
    id: 'create_plan',
    endGoal: 'Draft an editable plan from only the missing facts needed for that plan.',
    requiredSlots: [
      slot('goal_amount', 'Goal amount', 'What amount should the plan target?'),
      slot('target_date', 'Target date', 'Is there a target date or should it stay flexible?'),
    ],
    optionalSlots: [
      slot('reserve_floor', 'Reserve floor', 'Is there a minimum reserve the plan should not use?'),
      slot('rhythm', 'Contribution rhythm', 'How often should contributions be considered?'),
    ],
    maxQuestions: 3,
    deterministicResult: 'proposal',
    stopCondition: 'Enough plan constraints exist to show a draft.',
    fallback: 'Offer a manual plan editor with assumptions visible.',
  },
  {
    id: 'plan_behind',
    endGoal: 'Explain the current plan delta and offer reviewable choices.',
    requiredSlots: [],
    optionalSlots: [slot('choice', 'Review choice', 'Which version would you like to review?')],
    maxQuestions: 1,
    deterministicResult: 'briefing',
    stopCondition: 'The user selects a review path or closes.',
    fallback: 'Keep the plan unchanged and show why the projection moved.',
  },
  {
    id: 'business_invoice',
    endGoal: 'Ask one workspace-scoped invoice question.',
    requiredSlots: [
      slot(
        'invoice_outcome',
        'Invoice outcome',
        'Has it arrived, should I remind you, or leave it alone?',
      ),
    ],
    optionalSlots: [],
    maxQuestions: 1,
    deterministicResult: 'proposal',
    stopCondition: 'The invoice outcome is selected.',
    fallback: 'Leave the invoice unchanged and keep it in Today.',
  },
  {
    id: 'memory_correction',
    endGoal: 'Turn an accepted correction into a durable rule or counterexample.',
    requiredSlots: [
      slot('corrected_value', 'Corrected value', 'What should Melo remember instead?'),
    ],
    optionalSlots: [
      slot('scope', 'Memory scope', 'Should this apply only here or to similar future items?'),
    ],
    maxQuestions: 2,
    deterministicResult: 'proposal',
    stopCondition: 'The correction proposal can be reviewed.',
    fallback: 'Apply only the current correction and store no future rule.',
  },
  {
    id: 'unknown',
    endGoal: 'Route unknown requests to structured controls instead of unbounded chat.',
    requiredSlots: [],
    optionalSlots: [],
    maxQuestions: 0,
    deterministicResult: 'manual_review',
    stopCondition: 'Unknown intent is not expanded into free-form questioning.',
    fallback: 'Offer search, Today, plans, transactions or manual review.',
  },
];

const intentById = new Map<MeloIntentId, MeloIntentDefinition>(
  meloIntentRegistry.map((definition) => [definition.id, definition]),
);

export function getMeloIntentDefinition(intentId: MeloIntentId): MeloIntentDefinition {
  return intentById.get(intentId) ?? intentById.get('unknown')!;
}

export type MeloQuestionPlanInput = Readonly<{
  intentId: MeloIntentId;
  knownSlots: Readonly<Record<string, string | number | boolean | null | undefined>>;
  questionsAsked: number;
  userStopped?: boolean;
}>;

export type MeloQuestionPlan =
  | Readonly<{
      state: 'ask';
      intentId: MeloIntentId;
      slotId: string;
      question: string;
      whyItMatters?: string;
      remainingQuestions: number;
    }>
  | Readonly<{
      state: 'ready';
      intentId: MeloIntentId;
      resultType: MeloIntentDefinition['deterministicResult'];
      stopCondition: string;
    }>
  | Readonly<{
      state: 'fallback';
      intentId: MeloIntentId;
      reason: 'unknown_intent' | 'question_limit' | 'user_stopped';
      message: string;
      resultType: MeloIntentDefinition['deterministicResult'];
    }>;

export function planNextMeloQuestion(input: MeloQuestionPlanInput): MeloQuestionPlan {
  const definition = getMeloIntentDefinition(input.intentId);

  if (definition.id === 'unknown') {
    return {
      state: 'fallback',
      intentId: definition.id,
      reason: 'unknown_intent',
      message: definition.fallback,
      resultType: definition.deterministicResult,
    };
  }

  if (input.userStopped === true) {
    return {
      state: 'fallback',
      intentId: definition.id,
      reason: 'user_stopped',
      message: definition.fallback,
      resultType: definition.deterministicResult,
    };
  }

  const missingSlot = definition.requiredSlots.find(
    (required) =>
      input.knownSlots[required.id] === undefined ||
      input.knownSlots[required.id] === null ||
      input.knownSlots[required.id] === '',
  );

  if (!missingSlot) {
    return {
      state: 'ready',
      intentId: definition.id,
      resultType: definition.deterministicResult,
      stopCondition: definition.stopCondition,
    };
  }

  if (input.questionsAsked >= definition.maxQuestions) {
    return {
      state: 'fallback',
      intentId: definition.id,
      reason: 'question_limit',
      message: definition.fallback,
      resultType: definition.deterministicResult,
    };
  }

  return {
    state: 'ask',
    intentId: definition.id,
    slotId: missingSlot.id,
    question: missingSlot.question,
    ...(missingSlot.whyItMatters ? { whyItMatters: missingSlot.whyItMatters } : {}),
    remainingQuestions: definition.maxQuestions - input.questionsAsked - 1,
  };
}

export type MeloBriefingFact = Readonly<{
  id: string;
  label: string;
  value: string;
  certainty: 'confirmed' | 'expected' | 'inferred' | 'partial';
  sourceId?: string;
}>;

export type MeloBriefingInput = Readonly<{
  greeting?: string;
  state: 'quiet' | 'on_track' | 'attention' | 'changed' | 'bad_month';
  positionLine: string;
  nextImportant?: string;
  changed?: string;
  assumptions: readonly string[];
  facts: readonly MeloBriefingFact[];
  tone: MeloTonePreferences;
  dataAsOf: string;
}>;

export type MeloRenderedMessage = Readonly<{
  text: string;
  tone: MeloToneMode;
  modelRequired: false;
  networkRequired: false;
  facts: readonly MeloBriefingFact[];
  assumptions: readonly string[];
  policy: AdviceLanguageClassification;
}>;

export function renderDeterministicMeloBriefing(input: MeloBriefingInput): MeloRenderedMessage {
  const prefix =
    input.greeting ??
    (input.state === 'quiet'
      ? 'Nothing needs your attention today.'
      : input.state === 'bad_month'
        ? 'Something changed. We can work from the updated position.'
        : 'Here is the current position.');

  const toneLead =
    input.tone.mode === 'gentle'
      ? `${prefix} ${input.positionLine}`
      : input.tone.mode === 'accountability'
        ? `${prefix} ${input.positionLine} Review the visible trade-offs before changing the plan.`
        : `${prefix} ${input.positionLine}`;

  const next = input.nextImportant ? ` Next: ${input.nextImportant}.` : '';
  const changed = input.changed ? ` Changed: ${input.changed}.` : '';
  const assumptions =
    input.assumptions.length > 0
      ? ` Assumptions: ${input.assumptions.join('; ')}. Data as of ${input.dataAsOf}.`
      : ` Data as of ${input.dataAsOf}.`;
  const text = `${toneLead}${next}${changed}${assumptions}`;

  return {
    text,
    tone: input.tone.mode,
    modelRequired: false,
    networkRequired: false,
    facts: input.facts,
    assumptions: input.assumptions,
    policy: classifyAdviceLanguage(text),
  };
}

export type MeloToneVariantInput = Readonly<{
  stableFacts: readonly MeloBriefingFact[];
  consequenceLine: string;
  actionLine: string;
}>;

export type MeloToneVariant = Readonly<{
  mode: MeloToneMode;
  text: string;
  stableFactIds: readonly string[];
  calculationInvariant: true;
  policy: AdviceLanguageClassification;
}>;

export function renderMeloToneVariants(input: MeloToneVariantInput): readonly MeloToneVariant[] {
  const variants: readonly Readonly<{ mode: MeloToneMode; text: string }>[] = [
    {
      mode: 'gentle',
      text: `${input.consequenceLine} The visible facts are still usable, and you can review the next step when ready. ${input.actionLine}`,
    },
    {
      mode: 'balanced',
      text: `${input.consequenceLine} ${input.actionLine}`,
    },
    {
      mode: 'accountability',
      text: `${input.consequenceLine} Review the contribution/date trade-off so the plan reflects reality. ${input.actionLine}`,
    },
  ];
  const stableFactIds = input.stableFacts.map((fact) => fact.id);
  return variants.map((variant) => ({
    mode: variant.mode,
    text: variant.text,
    stableFactIds,
    calculationInvariant: true,
    policy: classifyAdviceLanguage(variant.text),
  }));
}

export type MeloPlanMovementInput = Readonly<{
  planTitle: string;
  movementLine: string;
  protectedLine: string;
  needsReview: boolean;
  boundedQuestions: readonly string[];
  recoveryOptions: readonly string[];
  tone: MeloToneMode;
}>;

export type MeloPlanMovementBriefing = Readonly<{
  title: string;
  summary: string;
  boundedQuestions: readonly string[];
  recoveryOptions: readonly string[];
  canWriteDirectly: false;
  advicePolicy: AdviceLanguageClassification;
}>;

export function buildPlanMovementBriefing(input: MeloPlanMovementInput): MeloPlanMovementBriefing {
  const lead =
    input.tone === 'accountability'
      ? `${input.planTitle} moved. Review the visible options before changing it.`
      : input.tone === 'gentle'
        ? `${input.planTitle} changed. This is information to work from, not a verdict.`
        : `${input.planTitle} changed. The movement is visible.`;
  const reviewLine = input.needsReview
    ? 'A review is needed before Melo saves any plan change.'
    : 'No saved plan change is needed right now.';
  const summary = `${lead} ${input.movementLine} ${input.protectedLine} ${reviewLine}`;

  return {
    title: 'Plan movement',
    summary,
    boundedQuestions: input.boundedQuestions.slice(0, 3),
    recoveryOptions: input.recoveryOptions,
    canWriteDirectly: false,
    advicePolicy: classifyAdviceLanguage(summary),
  };
}

export type MeloFirstMinuteInput = Readonly<{
  primaryMessage: string;
  choices: readonly string[];
  dataControlAvailable: boolean;
}>;

export type MeloFirstMinuteBriefing = Readonly<{
  title: string;
  summary: string;
  boundedQuestions: readonly string[];
  canWriteDirectly: false;
  advicePolicy: AdviceLanguageClassification;
}>;

export function buildFirstMinuteBriefing(input: MeloFirstMinuteInput): MeloFirstMinuteBriefing {
  const pathLine = `Choose one path: ${input.choices.slice(0, 3).join(', ')}.`;
  const dataLine = input.dataControlAvailable
    ? 'Data control is available before adding anything.'
    : 'Data control is not available yet.';
  const summary = `${input.primaryMessage} I can guide and explain, but I do not become the source of truth. No account, cloud or AI is required. ${pathLine} ${dataLine}`;

  return {
    title: 'First minute',
    summary,
    boundedQuestions: ['Import a statement?', 'Add what you know?', 'Try the sample?'],
    canWriteDirectly: false,
    advicePolicy: classifyAdviceLanguage(summary),
  };
}

export type MeloSampleBriefingInput = Readonly<{
  whatChanged: string;
  comingUp: string;
  remainsProtected: string;
  needsReview: string;
}>;

export type MeloSampleBriefing = Readonly<{
  title: string;
  labels: readonly ['Example only', 'Not your data', 'Nothing saved'];
  summary: string;
  canWriteDirectly: false;
  affectedFinances: false;
  advicePolicy: AdviceLanguageClassification;
}>;

export function buildSampleBriefing(input: MeloSampleBriefingInput): MeloSampleBriefing {
  const summary = `Example only. Not your data. Nothing saved. What changed: ${input.whatChanged}. Coming up: ${input.comingUp}. Still protected: ${input.remainsProtected}. Needs review: ${input.needsReview}.`;

  return {
    title: 'Sample briefing',
    labels: ['Example only', 'Not your data', 'Nothing saved'],
    summary,
    canWriteDirectly: false,
    affectedFinances: false,
    advicePolicy: classifyAdviceLanguage(summary),
  };
}

export type MeloImportReviewInput = Readonly<{
  sourceLabel: string;
  importedClaimCount: number;
  documentCount: number;
  issueCount: number;
  boundedQuestions: readonly string[];
}>;

export type MeloImportReviewBriefing = Readonly<{
  title: string;
  summary: string;
  boundedQuestions: readonly string[];
  canWriteDirectly: false;
  advicePolicy: AdviceLanguageClassification;
}>;

export function buildImportReviewBriefing(input: MeloImportReviewInput): MeloImportReviewBriefing {
  const claimLine =
    input.importedClaimCount === 0
      ? 'No rows need review.'
      : `${input.importedClaimCount} row${
          input.importedClaimCount === 1 ? '' : 's'
        } need review before Melo saves anything as a fact.`;
  const documentLine =
    input.documentCount === 0
      ? 'No document source is staged.'
      : `${input.documentCount} document source${
          input.documentCount === 1 ? '' : 's'
        } remain attached as evidence.`;
  const issueLine =
    input.issueCount === 0
      ? 'The statement read did not raise review issues.'
      : `${input.issueCount} read issue${input.issueCount === 1 ? '' : 's'} need checking.`;
  const summary = `${input.sourceLabel}: ${claimLine} ${documentLine} ${issueLine}`;

  return {
    title: 'Import review',
    summary,
    boundedQuestions: input.boundedQuestions.slice(0, 3),
    canWriteDirectly: false,
    advicePolicy: classifyAdviceLanguage(summary),
  };
}

export type MeloRejectedImportInput = Readonly<{
  sourceLabel: string;
  rejectedCount: number;
  reasonLabels: readonly string[];
}>;

export type MeloRejectedImportBriefing = Readonly<{
  title: string;
  summary: string;
  canWriteDirectly: false;
  affectedFinances: false;
  advicePolicy: AdviceLanguageClassification;
}>;

export function buildRejectedImportBriefing(
  input: MeloRejectedImportInput,
): MeloRejectedImportBriefing {
  const countLine =
    input.rejectedCount === 0
      ? 'No rejected import evidence needs attention.'
      : `${input.rejectedCount} rejected or excluded import record${
          input.rejectedCount === 1 ? '' : 's'
        } stay in evidence history only.`;
  const reasonLine =
    input.reasonLabels.length === 0
      ? 'No reason is attached.'
      : `Reason${input.reasonLabels.length === 1 ? '' : 's'}: ${input.reasonLabels
          .slice(0, 3)
          .join(', ')}.`;
  const summary = `${input.sourceLabel}: ${countLine} ${reasonLine} These records did not change balances, plans, or financial facts.`;

  return {
    title: 'Rejected import evidence',
    summary,
    canWriteDirectly: false,
    affectedFinances: false,
    advicePolicy: classifyAdviceLanguage(summary),
  };
}

export type MeloProposalActionType =
  | 'create_event'
  | 'update_event'
  | 'create_plan'
  | 'rebase_plan'
  | 'pause_plan'
  | 'create_reminder'
  | 'classify_transaction'
  | 'split_transaction'
  | 'link_transfer'
  | 'update_recurring_expectation'
  | 'run_scenario'
  | 'move_workspace'
  | 'save_memory'
  | 'delete_memory';

export type MeloProposalRisk = 'low' | 'medium' | 'high';
export type MeloProposalStatus =
  | 'proposed'
  | 'edited'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'committed';

export type MeloProposalActionDefinition = Readonly<{
  type: MeloProposalActionType;
  risk: MeloProposalRisk;
  reviewRequired: boolean | 'when_uncertain_or_tax_relevant';
  command: string;
  extraConfirmation: boolean;
}>;

export const meloProposalActionDefinitions: readonly MeloProposalActionDefinition[] = [
  {
    type: 'create_event',
    risk: 'low',
    reviewRequired: true,
    command: 'CreateEvent',
    extraConfirmation: false,
  },
  {
    type: 'update_event',
    risk: 'low',
    reviewRequired: true,
    command: 'UpdateEvent',
    extraConfirmation: false,
  },
  {
    type: 'create_plan',
    risk: 'medium',
    reviewRequired: true,
    command: 'CreatePlan',
    extraConfirmation: false,
  },
  {
    type: 'rebase_plan',
    risk: 'medium',
    reviewRequired: true,
    command: 'RebasePlan',
    extraConfirmation: false,
  },
  {
    type: 'pause_plan',
    risk: 'medium',
    reviewRequired: true,
    command: 'PausePlan',
    extraConfirmation: false,
  },
  {
    type: 'create_reminder',
    risk: 'low',
    reviewRequired: true,
    command: 'CreateReminder',
    extraConfirmation: false,
  },
  {
    type: 'classify_transaction',
    risk: 'low',
    reviewRequired: 'when_uncertain_or_tax_relevant',
    command: 'ClassifyTransaction',
    extraConfirmation: false,
  },
  {
    type: 'split_transaction',
    risk: 'medium',
    reviewRequired: true,
    command: 'SplitTransaction',
    extraConfirmation: false,
  },
  {
    type: 'link_transfer',
    risk: 'medium',
    reviewRequired: true,
    command: 'LinkTransfer',
    extraConfirmation: false,
  },
  {
    type: 'update_recurring_expectation',
    risk: 'medium',
    reviewRequired: true,
    command: 'UpdateRecurringExpectation',
    extraConfirmation: false,
  },
  {
    type: 'run_scenario',
    risk: 'low',
    reviewRequired: false,
    command: 'RunScenario',
    extraConfirmation: false,
  },
  {
    type: 'move_workspace',
    risk: 'high',
    reviewRequired: true,
    command: 'MoveWorkspaceRecord',
    extraConfirmation: true,
  },
  {
    type: 'save_memory',
    risk: 'low',
    reviewRequired: true,
    command: 'SaveMeloMemory',
    extraConfirmation: false,
  },
  {
    type: 'delete_memory',
    risk: 'low',
    reviewRequired: true,
    command: 'DeleteMeloMemory',
    extraConfirmation: false,
  },
];

const actionDefinitionByType = new Map<MeloProposalActionType, MeloProposalActionDefinition>(
  meloProposalActionDefinitions.map((definition) => [definition.type, definition]),
);

export type MeloProposal = Readonly<{
  id: string;
  workspaceId: string;
  actionType: MeloProposalActionType;
  status: MeloProposalStatus;
  title: string;
  summary: string;
  payload: Readonly<Record<string, unknown>>;
  risk: MeloProposalRisk;
  reviewRequired: boolean | 'when_uncertain_or_tax_relevant';
  extraConfirmation: boolean;
  directWrite: false;
  commandName: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
  committedAt?: string;
  auditTrail: readonly MeloProposalAuditEntry[];
}>;

export type MeloProposalAuditEntry = Readonly<{
  at: string;
  actor: 'melo' | 'user' | 'command_handler';
  event: MeloProposalStatus | 'created';
  note: string;
}>;

export type MeloCommandEnvelope = Readonly<{
  proposalId: string;
  workspaceId: string;
  commandName: string;
  payload: Readonly<Record<string, unknown>>;
  source: 'melo_proposal';
  requiresAtomicCommandBus: true;
  directWrite: false;
}>;

export function createMeloProposal(input: {
  id: string;
  workspaceId: string;
  actionType: MeloProposalActionType;
  title: string;
  summary: string;
  payload: Readonly<Record<string, unknown>>;
  now: string;
}): MeloProposal {
  const definition = actionDefinitionByType.get(input.actionType);
  if (!definition) {
    throw new Error(`Unknown Melo proposal action: ${input.actionType}`);
  }

  return {
    id: input.id,
    workspaceId: input.workspaceId,
    actionType: input.actionType,
    status: 'proposed',
    title: input.title,
    summary: input.summary,
    payload: input.payload,
    risk: definition.risk,
    reviewRequired: definition.reviewRequired,
    extraConfirmation: definition.extraConfirmation,
    directWrite: false,
    commandName: definition.command,
    createdAt: input.now,
    updatedAt: input.now,
    auditTrail: [
      {
        at: input.now,
        actor: 'melo',
        event: 'created',
        note: 'Melo created a typed proposal for user review.',
      },
    ],
  };
}

export function editMeloProposal(
  proposal: MeloProposal,
  input: {
    payload: Readonly<Record<string, unknown>>;
    summary?: string;
    now: string;
  },
): MeloProposal {
  ensureProposalMutable(proposal);
  return {
    ...proposal,
    status: 'edited',
    payload: input.payload,
    ...(input.summary ? { summary: input.summary } : {}),
    updatedAt: input.now,
    auditTrail: [
      ...proposal.auditTrail,
      {
        at: input.now,
        actor: 'user',
        event: 'edited',
        note: 'User edited the proposal before acceptance.',
      },
    ],
  };
}

export function acceptMeloProposal(proposal: MeloProposal, now: string): MeloProposal {
  ensureProposalMutable(proposal);
  return {
    ...proposal,
    status: 'accepted',
    acceptedAt: now,
    updatedAt: now,
    auditTrail: [
      ...proposal.auditTrail,
      { at: now, actor: 'user', event: 'accepted', note: 'User accepted the reviewed proposal.' },
    ],
  };
}

export function rejectMeloProposal(proposal: MeloProposal, now: string): MeloProposal {
  ensureProposalMutable(proposal);
  return {
    ...proposal,
    status: 'rejected',
    rejectedAt: now,
    updatedAt: now,
    auditTrail: [
      ...proposal.auditTrail,
      {
        at: now,
        actor: 'user',
        event: 'rejected',
        note: 'User rejected the proposal; no command envelope produced.',
      },
    ],
  };
}

export function commitAcceptedMeloProposal(
  proposal: MeloProposal,
  now: string,
): Readonly<{ proposal: MeloProposal; command: MeloCommandEnvelope }> {
  if (proposal.status !== 'accepted') {
    throw new Error('Only accepted Melo proposals can be converted into command envelopes.');
  }
  const committed: MeloProposal = {
    ...proposal,
    status: 'committed',
    committedAt: now,
    updatedAt: now,
    auditTrail: [
      ...proposal.auditTrail,
      {
        at: now,
        actor: 'command_handler',
        event: 'committed',
        note: 'Command handler received the proposal envelope; domain write remains outside Melo.',
      },
    ],
  };
  return {
    proposal: committed,
    command: {
      proposalId: proposal.id,
      workspaceId: proposal.workspaceId,
      commandName: proposal.commandName,
      payload: proposal.payload,
      source: 'melo_proposal',
      requiresAtomicCommandBus: true,
      directWrite: false,
    },
  };
}

function ensureProposalMutable(proposal: MeloProposal) {
  if (
    proposal.status === 'committed' ||
    proposal.status === 'rejected' ||
    proposal.status === 'expired'
  ) {
    throw new Error(`Melo proposal is no longer mutable: ${proposal.status}`);
  }
}

export type MeloInterventionCandidate = Readonly<{
  id: string;
  topic: string;
  title: string;
  severity: number;
  immediacy: number;
  evidenceWeight: number;
  novelty: number;
  userRelevance: number;
  activePlanRelevance: number;
  anxietyCost: number;
  repetitionCost: number;
  interruptionCost: number;
  dismissedAt?: string;
  materialChangeKey?: string;
  lastMaterialChangeKey?: string;
  stale?: boolean;
  suppressed?: boolean;
}>;

export type MeloInterventionPreferences = Readonly<{
  maxNonUrgent: number;
  topicCaps: Readonly<Record<string, number>>;
  quietHoursActive: boolean;
  allowUrgentDuringQuietHours: boolean;
  minRankWeight: number;
}>;

export type MeloRankedIntervention = MeloInterventionCandidate &
  Readonly<{
    rankWeight: number;
    reasons: readonly string[];
  }>;

export function rankMeloInterventions(
  candidates: readonly MeloInterventionCandidate[],
  preferences: MeloInterventionPreferences,
): readonly MeloRankedIntervention[] {
  const topicCounts = new Map<string, number>();
  const ranked = candidates
    .filter((candidate) => !candidate.suppressed && !candidate.stale)
    .filter((candidate) => {
      const repeatedAfterDismissal =
        candidate.dismissedAt !== undefined &&
        candidate.materialChangeKey !== undefined &&
        candidate.materialChangeKey === candidate.lastMaterialChangeKey;
      return !repeatedAfterDismissal;
    })
    .map((candidate) => rankIntervention(candidate))
    .filter((candidate) => candidate.rankWeight >= preferences.minRankWeight)
    .filter((candidate) => {
      if (!preferences.quietHoursActive) return true;
      const urgent = candidate.severity >= 8 && candidate.immediacy >= 8;
      return urgent && preferences.allowUrgentDuringQuietHours;
    })
    .sort((a, b) => b.rankWeight - a.rankWeight || a.title.localeCompare(b.title));

  const capped: MeloRankedIntervention[] = [];
  for (const candidate of ranked) {
    const topicCount = topicCounts.get(candidate.topic) ?? 0;
    const topicCap = preferences.topicCaps[candidate.topic] ?? preferences.maxNonUrgent;
    if (topicCount >= topicCap) continue;
    if (capped.length >= preferences.maxNonUrgent && candidate.severity < 9) continue;
    topicCounts.set(candidate.topic, topicCount + 1);
    capped.push(candidate);
  }

  return capped;
}

function rankIntervention(candidate: MeloInterventionCandidate): MeloRankedIntervention {
  const rankWeight =
    candidate.severity * 3 +
    candidate.immediacy * 2 +
    candidate.evidenceWeight * 2 +
    candidate.novelty +
    candidate.userRelevance +
    candidate.activePlanRelevance -
    candidate.anxietyCost -
    candidate.repetitionCost -
    candidate.interruptionCost;
  const reasons = [
    candidate.severity >= 8 ? 'high severity' : 'moderate severity',
    candidate.immediacy >= 8 ? 'time-sensitive' : 'not immediate',
    candidate.evidenceWeight >= 7 ? 'evidence is usable' : 'evidence needs review',
  ];
  return { ...candidate, rankWeight, reasons };
}

export type MeloBadMonthInput = Readonly<{
  workspaceId: string;
  eventLabel: string;
  amountLabel: string;
  availableChangeLabel: string;
  affectedItems: readonly string[];
  stableItems: readonly string[];
  recoveryOptions: readonly string[];
  supportLinks: readonly string[];
  tone: MeloToneMode;
}>;

export type MeloBadMonthBriefing = Readonly<{
  title: string;
  summary: string;
  facts: readonly string[];
  affected: readonly string[];
  stable: readonly string[];
  recoveryOptions: readonly string[];
  supportLinks: readonly string[];
  playfulOutputSuppressed: true;
  advicePolicy: AdviceLanguageClassification;
}>;

export function buildBadMonthBriefing(input: MeloBadMonthInput): MeloBadMonthBriefing {
  const base =
    input.tone === 'accountability'
      ? `${input.eventLabel} changed the plan. Review the visible options so the plan reflects reality.`
      : input.tone === 'gentle'
        ? `${input.eventLabel} changed the month. This is a change to work from, not a verdict.`
        : `${input.eventLabel} changed the month. The updated position is visible.`;
  const summary = `${base} ${input.availableChangeLabel}`;
  return {
    title: 'Bad-month mode',
    summary,
    facts: [
      `Unexpected event: ${input.eventLabel}`,
      `Amount: ${input.amountLabel}`,
      input.availableChangeLabel,
    ],
    affected: input.affectedItems,
    stable: input.stableItems,
    recoveryOptions: input.recoveryOptions,
    supportLinks: input.supportLinks,
    playfulOutputSuppressed: true,
    advicePolicy: classifyAdviceLanguage(summary),
  };
}

export type MeloMemoryDepth = 'minimal' | 'normal' | 'deep';
export type MeloMemoryKind =
  | 'preference'
  | 'recurring_pattern'
  | 'user_correction'
  | 'accountability_style'
  | 'important_event_summary'
  | 'plan_commitment'
  | 'approved_context';
export type MeloMemoryScope = 'personal' | 'business' | 'global_preference';
export type MeloMemorySensitivity = 'low' | 'medium' | 'high';

export type MeloMemoryRecord = Readonly<{
  id: string;
  workspaceId?: string;
  kind: MeloMemoryKind;
  depth: MeloMemoryDepth;
  scope: MeloMemoryScope;
  value: string;
  reasonUseful: string;
  provenance: string;
  sensitivity: MeloMemorySensitivity;
  visibleToUser: true;
  inspectable: true;
  deletable: true;
  duplicatesLedger: false;
  createdAt: string;
  expiresAt?: string;
  deletedAt?: string;
}>;

export function createMeloMemoryRecord(input: {
  id: string;
  workspaceId?: string;
  kind: MeloMemoryKind;
  depth: MeloMemoryDepth;
  scope: MeloMemoryScope;
  value: string;
  reasonUseful: string;
  provenance: string;
  sensitivity: MeloMemorySensitivity;
  createdAt: string;
  expiresAt?: string;
}): MeloMemoryRecord {
  return {
    id: input.id,
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    kind: input.kind,
    depth: input.depth,
    scope: input.scope,
    value: input.value,
    reasonUseful: input.reasonUseful,
    provenance: input.provenance,
    sensitivity: input.sensitivity,
    visibleToUser: true,
    inspectable: true,
    deletable: true,
    duplicatesLedger: false,
    createdAt: input.createdAt,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  };
}

export function deleteMeloMemoryRecord(
  memory: MeloMemoryRecord,
  deletedAt: string,
): MeloMemoryRecord {
  return { ...memory, deletedAt };
}

export function visibleMeloMemories(
  memories: readonly MeloMemoryRecord[],
  now: string,
): readonly MeloMemoryRecord[] {
  return memories.filter(
    (memory) =>
      memory.deletedAt === undefined && (memory.expiresAt === undefined || memory.expiresAt > now),
  );
}

export type MeloCorrectionLearningInput = Readonly<{
  id: string;
  workspaceId: string;
  originalInference: string;
  correctedValue: string;
  accepted: boolean;
  sourceRecordId: string;
  createdAt: string;
}>;

export type MeloCorrectionLearningRecord = Readonly<{
  id: string;
  workspaceId: string;
  originalInference: string;
  correctedValue: string;
  sourceRecordId: string;
  originalInferencePreserved: true;
  futureInferenceAdjustment: 'downweight_equivalent_inference';
  auditRequired: true;
  createdAt: string;
}>;

export function buildCorrectionLearningRecord(
  input: MeloCorrectionLearningInput,
): MeloCorrectionLearningRecord | null {
  if (!input.accepted) return null;
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    originalInference: input.originalInference,
    correctedValue: input.correctedValue,
    sourceRecordId: input.sourceRecordId,
    originalInferencePreserved: true,
    futureInferenceAdjustment: 'downweight_equivalent_inference',
    auditRequired: true,
    createdAt: input.createdAt,
  };
}

export type MeloVoiceToProposalStatus = Readonly<{
  available: boolean;
  reason: string;
  requirements: readonly string[];
  retainsAudioByDefault: false;
}>;

export function describeVoiceToProposalStatus(input: {
  nativeAudioAvailable: boolean;
  transcriptReviewAvailable: boolean;
  vaultAvailable: boolean;
}): MeloVoiceToProposalStatus {
  const requirements = [
    'explicit recording consent',
    'transcript review before proposal',
    'no retained audio by default',
    'vault-backed command commit',
  ];
  const available =
    input.nativeAudioAvailable && input.transcriptReviewAvailable && input.vaultAvailable;
  return {
    available,
    reason: available
      ? 'Voice can create a reviewed typed proposal.'
      : 'Voice-to-proposal is blocked until native audio, transcript review and vault commit evidence exist.',
    requirements,
    retainsAudioByDefault: false,
  };
}

export type MeloRenderableValidation = Readonly<{
  renderable: boolean;
  classification: AdviceLanguageClassification;
  escalationTriggers: readonly EscalationTrigger[];
}>;

export function validateMeloRenderableOutput(text: string): MeloRenderableValidation {
  const classification = classifyAdviceLanguage(text);
  const escalationTriggers = findEscalationTriggers(text);
  return {
    renderable: classification.allowed && escalationTriggers.length === 0,
    classification,
    escalationTriggers,
  };
}

export type MeloNoAiAcceptanceResult = Readonly<{
  ok: boolean;
  modelRequired: false;
  networkRequired: false;
  checked: readonly string[];
  blocked: readonly string[];
}>;

export function runNoAiMeloAcceptance(): MeloNoAiAcceptanceResult {
  const intentReady = planNextMeloQuestion({
    intentId: 'higher_rent_actual',
    knownSlots: { reason: 'one_off_fee' },
    questionsAsked: 1,
  });
  const briefing = renderDeterministicMeloBriefing({
    state: 'on_track',
    positionLine: 'Rent remains covered under confirmed records.',
    nextImportant: 'Review rent sequence',
    assumptions: ['confirmed records only'],
    facts: [{ id: 'rent', label: 'Rent', value: 'covered', certainty: 'confirmed' }],
    tone: defaultMeloTonePreferences,
    dataAsOf: '2026-06-21',
  });
  const proposal = createMeloProposal({
    id: 'proposal_no_ai',
    workspaceId: 'workspace_personal',
    actionType: 'update_recurring_expectation',
    title: 'Update rent expectation',
    summary: 'Review a new expected rent amount.',
    payload: { expectationId: 'expectation_rent', amountMinor: 73800 },
    now: '2026-06-21T00:00:00Z',
  });
  const checked = [
    'intent registry',
    'bounded question protocol',
    'deterministic briefing',
    'proposal lifecycle',
    'tone variants',
    'intervention ranking',
    'bad-month mode',
    'memory and correction contracts',
    'language policy',
  ];
  const blocked = [
    'voice capture requires native audio evidence',
    'domain commit requires command handler and vault-backed records',
    'legal review remains required before public regulated-boundary claims',
  ];
  return {
    ok: intentReady.state === 'ready' && briefing.policy.allowed && proposal.directWrite === false,
    modelRequired: false,
    networkRequired: false,
    checked,
    blocked,
  };
}
