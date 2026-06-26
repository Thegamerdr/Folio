import {
  acceptMeloProposal,
  buildBadMonthBriefing,
  buildCorrectionLearningRecord,
  createMeloMemoryRecord,
  createMeloProposal,
  defaultMeloTonePreferences,
  describeVoiceToProposalStatus,
  planNextMeloQuestion,
  rankMeloInterventions,
  renderDeterministicMeloBriefing,
  renderMeloToneVariants,
  runNoAiMeloAcceptance,
  validateMeloRenderableOutput,
  visibleMeloMemories,
  type MeloBadMonthBriefing,
  type MeloQuestionPlan,
  type MeloRenderedMessage,
  type MeloToneVariant,
} from '@folio/melo-policy';

export type Phase7Source = Readonly<{
  kind: 'synthetic';
  label: 'Synthetic sample';
  description: string;
}>;

export type Phase7ProofRow = Readonly<{
  label: string;
  value: string;
  state: 'implemented' | 'blocked';
}>;

export type Phase7GateMetadata = Readonly<{
  phase: 'phase7';
  slice: 'melo-deterministic-system';
  sourceLabel: 'Synthetic sample';
  modelRequired: false;
  networkRequired: false;
  realData: false;
  directStorageWrite: false;
  nativeAudioIntegration: false;
  vaultCommitIntegration: false;
  reducedMotionEquivalent: true;
  manualAccessibilityVerified: false;
  evidenceAreas: readonly Phase7EvidenceArea[];
}>;

export type Phase7EvidenceArea =
  | 'intent_registry'
  | 'deterministic_language'
  | 'proposal_lifecycle'
  | 'tone_modes'
  | 'proactive_ranking'
  | 'bad_month_mode'
  | 'memory'
  | 'correction_learning'
  | 'voice_blocker'
  | 'language_policy'
  | 'no_ai_acceptance'
  | 'melo_ui_states';

export type Phase7MeloState = Readonly<{
  title: string;
  expression: 'observing' | 'focused' | 'calm' | 'concerned';
  motionMode: 'static_reduced_motion';
  presenceLabel: string;
  accessibilityLabel: string;
  source: Phase7Source;
}>;

export type Phase7IntentCard = Readonly<{
  id: string;
  title: string;
  body: string;
  maxQuestionsLabel: string;
  resultLabel: string;
  source: Phase7Source;
}>;

export type Phase7QuestionState = Readonly<{
  title: string;
  plan: MeloQuestionPlan;
  summaryLabel: string;
  source: Phase7Source;
}>;

export type Phase7ProposalReview = Readonly<{
  title: string;
  statusLabel: string;
  reviewRequiredLabel: string;
  commandLabel: string;
  directWriteLabel: string;
  auditLabel: string;
  source: Phase7Source;
}>;

export type Phase7ToneRow = Readonly<{
  mode: string;
  text: string;
  invariantLabel: string;
  renderable: boolean;
  source: Phase7Source;
}>;

export type Phase7InterventionRow = Readonly<{
  id: string;
  title: string;
  scoreLabel: string;
  reasonLabel: string;
  source: Phase7Source;
}>;

export type Phase7MemoryRow = Readonly<{
  id: string;
  title: string;
  body: string;
  policyLabel: string;
  source: Phase7Source;
}>;

export type Phase7PolicyRow = Readonly<{
  label: string;
  value: string;
  state: 'implemented' | 'blocked';
  source: Phase7Source;
}>;

export type Phase7MeloShellEvidence = Readonly<{
  metadata: Phase7GateMetadata;
  meloState: Phase7MeloState;
  briefing: MeloRenderedMessage;
  intentCards: readonly Phase7IntentCard[];
  boundedQuestion: Phase7QuestionState;
  proposalReview: Phase7ProposalReview;
  toneRows: readonly Phase7ToneRow[];
  interventions: readonly Phase7InterventionRow[];
  badMonth: MeloBadMonthBriefing;
  memoryRows: readonly Phase7MemoryRow[];
  policyRows: readonly Phase7PolicyRow[];
  proofRows: readonly Phase7ProofRow[];
}>;

const syntheticSource: Phase7Source = {
  kind: 'synthetic',
  label: 'Synthetic sample',
  description: 'Phase 7 mobile shell evidence uses fictional values and deterministic contracts.',
};

export const phase7ProofRows: readonly Phase7ProofRow[] = [
  {
    label: 'Intent registry',
    value: 'bounded slots, max questions and fallback',
    state: 'implemented',
  },
  {
    label: 'Melo proposals',
    value: 'reviewed command envelopes only; no direct write',
    state: 'implemented',
  },
  {
    label: 'No-AI gate',
    value: 'core briefing, intents and proposal contracts are model-off',
    state: 'implemented',
  },
  {
    label: 'Voice path',
    value: 'blocked until native audio, transcript review and vault commit exist',
    state: 'blocked',
  },
  {
    label: 'Manual a11y',
    value: 'TalkBack, large text and reduced-motion recording still required',
    state: 'blocked',
  },
];

export const defaultPhase7MeloShellEvidence = buildPhase7MeloShellEvidence();

export function buildPhase7MeloShellEvidence(): Phase7MeloShellEvidence {
  const briefing = renderDeterministicMeloBriefing({
    state: 'attention',
    positionLine: 'Rent remains covered under confirmed records.',
    nextImportant: 'Review rent sequence',
    changed: 'the expected rent amount needs review',
    assumptions: ['confirmed records only', 'synthetic shell values'],
    facts: [
      { id: 'rent', label: 'Rent', value: 'covered', certainty: 'confirmed' },
      { id: 'buffer', label: 'Buffer', value: 'GBP 80', certainty: 'partial' },
    ],
    tone: defaultMeloTonePreferences,
    dataAsOf: '2026-06-21',
  });

  const boundedQuestion = planNextMeloQuestion({
    intentId: 'higher_rent_actual',
    knownSlots: {},
    questionsAsked: 0,
  });

  const proposal = createMeloProposal({
    id: 'phase7_proposal_rent',
    workspaceId: 'workspace_personal_synthetic',
    actionType: 'update_recurring_expectation',
    title: 'Update rent expectation',
    summary: 'Review the expected rent amount before committing.',
    payload: { expectationId: 'expectation_rent_synthetic', amountMinor: 73800 },
    now: '2026-06-21T00:00:00Z',
  });
  const acceptedProposal = acceptMeloProposal(proposal, '2026-06-21T00:01:00Z');

  const toneRows = renderMeloToneVariants({
    stableFacts: briefing.facts,
    consequenceLine: 'The repair reduces the buffer to GBP 80.',
    actionLine: 'Rent remains covered under confirmed records.',
  }).map(toToneRow);

  const interventions = rankMeloInterventions(
    [
      {
        id: 'review_rent',
        topic: 'rent',
        title: 'Rent amount needs review',
        severity: 8,
        immediacy: 8,
        evidenceWeight: 9,
        novelty: 6,
        userRelevance: 7,
        activePlanRelevance: 4,
        anxietyCost: 2,
        repetitionCost: 0,
        interruptionCost: 1,
      },
      {
        id: 'quiet_reflection',
        topic: 'reflection',
        title: 'Weekly reflection is optional',
        severity: 3,
        immediacy: 2,
        evidenceWeight: 8,
        novelty: 4,
        userRelevance: 4,
        activePlanRelevance: 0,
        anxietyCost: 1,
        repetitionCost: 1,
        interruptionCost: 3,
      },
    ],
    {
      maxNonUrgent: 3,
      topicCaps: { rent: 1 },
      quietHoursActive: false,
      allowUrgentDuringQuietHours: false,
      minRankWeight: 20,
    },
  ).map((row) => ({
    id: row.id,
    title: row.title,
    scoreLabel: `${row.rankWeight} deterministic rank`,
    reasonLabel: row.reasons.join(' | '),
    source: syntheticSource,
  }));

  const badMonth = buildBadMonthBriefing({
    workspaceId: 'workspace_personal_synthetic',
    eventLabel: 'Vehicle repair',
    amountLabel: 'GBP 420 outflow',
    availableChangeLabel: 'Available cash is GBP 420 lower.',
    affectedItems: ['buffer falls to GBP 80', 'debt-plan range moves by about three weeks'],
    stableItems: ['rent remains covered', 'minimum payments before payday remain covered'],
    recoveryOptions: [
      'review assumptions',
      'compare contribution/date trade-off',
      'leave plan unchanged',
    ],
    supportLinks: ['official support link placeholder'],
    tone: 'balanced',
  });

  const memory = createMeloMemoryRecord({
    id: 'phase7_memory_correction',
    workspaceId: 'workspace_personal_synthetic',
    kind: 'user_correction',
    depth: 'normal',
    scope: 'personal',
    value: 'Coffee shop refund is not salary',
    reasonUseful: 'Downweights equivalent future inference.',
    provenance: 'accepted correction proposal',
    sensitivity: 'medium',
    createdAt: '2026-06-21T00:00:00Z',
    expiresAt: '2026-12-21T00:00:00Z',
  });
  const visibleMemory = visibleMeloMemories([memory], '2026-06-21T12:00:00Z')[0];
  const correction = buildCorrectionLearningRecord({
    id: 'phase7_correction',
    workspaceId: 'workspace_personal_synthetic',
    originalInference: 'salary',
    correctedValue: 'refund',
    accepted: true,
    sourceRecordId: 'txn_synthetic_refund',
    createdAt: '2026-06-21T00:00:00Z',
  });

  const voiceStatus = describeVoiceToProposalStatus({
    nativeAudioAvailable: false,
    transcriptReviewAvailable: false,
    vaultAvailable: false,
  });
  const noAi = runNoAiMeloAcceptance();

  return {
    metadata: {
      phase: 'phase7',
      slice: 'melo-deterministic-system',
      sourceLabel: 'Synthetic sample',
      modelRequired: false,
      networkRequired: false,
      realData: false,
      directStorageWrite: false,
      nativeAudioIntegration: false,
      vaultCommitIntegration: false,
      reducedMotionEquivalent: true,
      manualAccessibilityVerified: false,
      evidenceAreas: [
        'intent_registry',
        'deterministic_language',
        'proposal_lifecycle',
        'tone_modes',
        'proactive_ranking',
        'bad_month_mode',
        'memory',
        'correction_learning',
        'voice_blocker',
        'language_policy',
        'no_ai_acceptance',
        'melo_ui_states',
      ],
    },
    meloState: {
      title: 'Melo deterministic mode',
      expression: 'focused',
      motionMode: 'static_reduced_motion',
      presenceLabel: 'Present as guidance, not a chat gate',
      accessibilityLabel:
        'Melo focused state. Deterministic mode is active. The user can continue with normal controls.',
      source: syntheticSource,
    },
    briefing,
    intentCards: [
      {
        id: 'higher_rent_actual',
        title: 'Higher actual amount',
        body: 'One bounded question creates a reviewed expectation proposal.',
        maxQuestionsLabel: '1 question maximum',
        resultLabel: 'proposal',
        source: syntheticSource,
      },
      {
        id: 'bad_month_event',
        title: 'Bad-month event',
        body: 'Capture facts, show affected/stable items, then offer reviewable options.',
        maxQuestionsLabel: '2 questions maximum',
        resultLabel: 'proposal',
        source: syntheticSource,
      },
      {
        id: 'unknown',
        title: 'Unknown request',
        body: 'Falls back to structured controls instead of unbounded chat.',
        maxQuestionsLabel: '0 questions',
        resultLabel: 'manual review',
        source: syntheticSource,
      },
    ],
    boundedQuestion: {
      title: 'Bounded question',
      plan: boundedQuestion,
      summaryLabel:
        boundedQuestion.state === 'ask'
          ? `${boundedQuestion.question} ${boundedQuestion.remainingQuestions} questions remain.`
          : 'Ready or fallback state reached.',
      source: syntheticSource,
    },
    proposalReview: {
      title: acceptedProposal.title,
      statusLabel: acceptedProposal.status,
      reviewRequiredLabel: String(acceptedProposal.reviewRequired),
      commandLabel: acceptedProposal.commandName,
      directWriteLabel: acceptedProposal.directWrite ? 'direct write' : 'command envelope only',
      auditLabel: `${acceptedProposal.auditTrail.length} audit entries before command handler`,
      source: syntheticSource,
    },
    toneRows,
    interventions,
    badMonth,
    memoryRows: [
      {
        id: memory.id,
        title: 'Inspectable memory',
        body: visibleMemory
          ? `${visibleMemory.value}. ${visibleMemory.reasonUseful}`
          : 'Memory hidden by retention controls.',
        policyLabel: 'visible, inspectable, deletable, not ledger duplicate',
        source: syntheticSource,
      },
      {
        id: correction?.id ?? 'phase7_correction_blocked',
        title: 'Accepted correction learning',
        body: correction
          ? `${correction.originalInference} -> ${correction.correctedValue}; original inference preserved.`
          : 'No learning record without acceptance.',
        policyLabel: 'audit preserved',
        source: syntheticSource,
      },
    ],
    policyRows: [
      {
        label: 'Voice',
        value: voiceStatus.reason,
        state: voiceStatus.available ? 'implemented' : 'blocked',
        source: syntheticSource,
      },
      {
        label: 'No AI',
        value: `${noAi.checked.length} core areas checked without model/network.`,
        state: noAi.ok ? 'implemented' : 'blocked',
        source: syntheticSource,
      },
      {
        label: 'Language',
        value: validateMeloRenderableOutput(briefing.text).renderable
          ? 'briefing copy is renderable'
          : 'briefing copy blocked',
        state: validateMeloRenderableOutput(briefing.text).renderable ? 'implemented' : 'blocked',
        source: syntheticSource,
      },
    ],
    proofRows: phase7ProofRows,
  };
}

function toToneRow(variant: MeloToneVariant): Phase7ToneRow {
  return {
    mode: variant.mode,
    text: variant.text,
    invariantLabel: variant.calculationInvariant ? 'same facts and calculations' : 'changed facts',
    renderable: variant.policy.allowed,
    source: syntheticSource,
  };
}
