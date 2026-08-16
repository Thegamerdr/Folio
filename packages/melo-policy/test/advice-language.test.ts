import { describe, expect, it } from 'vitest';

import {
  acceptMeloProposal,
  buildBadMonthBriefing,
  buildCorrectionLearningRecord,
  buildFirstMinuteBriefing,
  buildImportReviewBriefing,
  buildPlanMovementBriefing,
  buildRejectedImportBriefing,
  buildSampleBriefing,
  classifyAdviceLanguage,
  commitAcceptedMeloProposal,
  createMeloMemoryRecord,
  createMeloProposal,
  defaultMeloTonePreferences,
  deleteMeloMemoryRecord,
  describeVoiceToProposalStatus,
  editMeloProposal,
  findEscalationTriggers,
  getMeloIntentDefinition,
  meloPolicyBoundary,
  planNextMeloQuestion,
  rankMeloInterventions,
  rejectMeloProposal,
  renderDeterministicMeloBriefing,
  renderMeloToneVariants,
  runNoAiMeloAcceptance,
  validateMeloRenderableOutput,
  visibleMeloMemories,
} from '../src/index.js';

describe('advice-language blocked-pattern classifier', () => {
  it('allows consequence language under explicit assumptions', () => {
    expect(
      classifyAdviceLanguage(
        'If you add a 30000 minor-unit payment, the modelled consequence is a lower buffer under these assumptions.',
      ),
    ).toEqual({ allowed: true, matches: [] });
  });

  it('blocks personal recommendations', () => {
    const result = classifyAdviceLanguage('You should pay this debt first.');

    expect(result.allowed).toBe(false);
    expect(result.matches).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: 'personal_recommendation' })]),
    );
  });

  it('blocks suitability claims', () => {
    expect(classifyAdviceLanguage('This product is suitable for you.').matches).toEqual([
      expect.objectContaining({ category: 'suitability' }),
    ]);
    expect(classifyAdviceLanguage('You can afford this loan.').matches).toEqual([
      expect.objectContaining({ category: 'suitability' }),
    ]);
  });

  it('blocks final tax/legal certainty and guaranteed outcomes', () => {
    expect(classifyAdviceLanguage('This expense is definitely deductible.').matches).toEqual([
      expect.objectContaining({ category: 'final_tax_or_legal' }),
      expect.objectContaining({ category: 'certainty_overclaim' }),
    ]);
    expect(classifyAdviceLanguage('You will be debt free by June.').matches).toEqual([
      expect.objectContaining({ category: 'guarantee' }),
    ]);
    expect(classifyAdviceLanguage('Everything will be fine.').matches).toEqual([
      expect.objectContaining({ category: 'guarantee' }),
    ]);
  });

  it('blocks shame and false reassurance language', () => {
    expect(classifyAdviceLanguage('You failed this month.').matches).toEqual([
      expect.objectContaining({ category: 'shame' }),
    ]);
    expect(classifyAdviceLanguage('Do not worry, just stay positive.').matches).toEqual([
      expect.objectContaining({ category: 'false_reassurance' }),
    ]);
  });

  it('surfaces escalation triggers for higher-risk routing', () => {
    expect(findEscalationTriggers('I need help with bankruptcy and a legal dispute.')).toEqual([
      'formal_debt_solution',
      'legal_dispute',
    ]);
    expect(findEscalationTriggers('I cannot eat and need emergency food support.')).toContain(
      'immediate_crisis',
    );
    expect(findEscalationTriggers('How much is in my emergency fund?')).not.toContain(
      'immediate_crisis',
    );
  });

  it('prevents blocked copy from rendering', () => {
    expect(validateMeloRenderableOutput('You should invest in X.').renderable).toBe(false);
    expect(
      validateMeloRenderableOutput('This option leaves rent covered under confirmed assumptions.')
        .renderable,
    ).toBe(true);
  });
});

describe('Phase 7 deterministic Melo contracts', () => {
  it('declares no model, network or direct storage dependency', () => {
    expect(meloPolicyBoundary).toMatchObject({
      modelRequired: false,
      networkRequired: false,
      writesDirectlyToStorage: false,
      directDomainWriteAllowed: false,
    });
  });

  it('returns bounded intent definitions with max questions', () => {
    const intent = getMeloIntentDefinition('create_plan');

    expect(intent.maxQuestions).toBe(3);
    expect(intent.requiredSlots.map((slot) => slot.id)).toEqual(['goal_amount', 'target_date']);
  });

  it('routes unknown intent to fallback instead of unbounded chat', () => {
    expect(
      planNextMeloQuestion({ intentId: 'unknown', knownSlots: {}, questionsAsked: 0 }),
    ).toMatchObject({
      state: 'fallback',
      reason: 'unknown_intent',
    });
  });

  it('asks one high-information question at a time', () => {
    const plan = planNextMeloQuestion({
      intentId: 'minimal_until_date',
      knownSlots: {},
      questionsAsked: 0,
    });

    expect(plan).toMatchObject({
      state: 'ask',
      slotId: 'available_now',
      remainingQuestions: 1,
    });
  });

  it('stops when enough required slots exist', () => {
    expect(
      planNextMeloQuestion({
        intentId: 'minimal_until_date',
        knownSlots: { available_now: 'GBP 220', important_outgoings: 'rent' },
        questionsAsked: 2,
      }),
    ).toMatchObject({
      state: 'ready',
      resultType: 'partial_position',
    });
  });

  it('falls back when the question limit is reached', () => {
    expect(
      planNextMeloQuestion({
        intentId: 'create_plan',
        knownSlots: { goal_amount: 'GBP 1000' },
        questionsAsked: 3,
      }),
    ).toMatchObject({
      state: 'fallback',
      reason: 'question_limit',
    });
  });

  it('renders deterministic briefing without model access', () => {
    const briefing = renderDeterministicMeloBriefing({
      state: 'on_track',
      positionLine: 'Rent remains covered under confirmed records.',
      nextImportant: 'Review rent sequence',
      assumptions: ['confirmed records only'],
      facts: [{ id: 'rent', label: 'Rent', value: 'covered', certainty: 'confirmed' }],
      tone: defaultMeloTonePreferences,
      dataAsOf: '2026-06-21',
    });

    expect(briefing.modelRequired).toBe(false);
    expect(briefing.networkRequired).toBe(false);
    expect(briefing.policy.allowed).toBe(true);
    expect(briefing.text).toContain('Assumptions: confirmed records only.');
  });

  it('keeps financial facts invariant across tone modes', () => {
    const variants = renderMeloToneVariants({
      stableFacts: [{ id: 'buffer', label: 'Buffer', value: 'GBP 80', certainty: 'confirmed' }],
      consequenceLine: 'The repair reduces the buffer to GBP 80.',
      actionLine: 'Rent remains covered under confirmed records.',
    });

    expect(variants).toHaveLength(3);
    expect(new Set(variants.map((variant) => variant.stableFactIds.join(','))).size).toBe(1);
    expect(variants.every((variant) => variant.policy.allowed)).toBe(true);
  });

  it('creates typed proposals that cannot write directly', () => {
    const proposal = createMeloProposal({
      id: 'proposal_1',
      workspaceId: 'workspace_personal',
      actionType: 'update_recurring_expectation',
      title: 'Update rent expectation',
      summary: 'Review a new expected rent amount.',
      payload: { amountMinor: 73800 },
      now: '2026-06-21T00:00:00Z',
    });

    expect(proposal).toMatchObject({
      status: 'proposed',
      risk: 'medium',
      reviewRequired: true,
      directWrite: false,
      commandName: 'UpdateRecurringExpectation',
    });
  });

  it('supports edit, accept and command-envelope commit lifecycle', () => {
    const proposal = createMeloProposal({
      id: 'proposal_2',
      workspaceId: 'workspace_personal',
      actionType: 'create_event',
      title: 'Unexpected repair',
      summary: 'Review event before commit.',
      payload: { amountMinor: -42000 },
      now: '2026-06-21T00:00:00Z',
    });
    const edited = editMeloProposal(proposal, {
      payload: { amountMinor: -42000, label: 'Vehicle repair' },
      now: '2026-06-21T00:01:00Z',
    });
    const accepted = acceptMeloProposal(edited, '2026-06-21T00:02:00Z');
    const committed = commitAcceptedMeloProposal(accepted, '2026-06-21T00:03:00Z');

    expect(committed.proposal.status).toBe('committed');
    expect(committed.command).toEqual(
      expect.objectContaining({
        source: 'melo_proposal',
        requiresAtomicCommandBus: true,
        directWrite: false,
        commandName: 'CreateEvent',
      }),
    );
  });

  it('does not produce command envelopes for rejected proposals', () => {
    const proposal = createMeloProposal({
      id: 'proposal_3',
      workspaceId: 'workspace_personal',
      actionType: 'create_reminder',
      title: 'Review invoice',
      summary: 'Review reminder before commit.',
      payload: { dueDate: '2026-06-22' },
      now: '2026-06-21T00:00:00Z',
    });
    const rejected = rejectMeloProposal(proposal, '2026-06-21T00:01:00Z');

    expect(rejected.status).toBe('rejected');
    expect(() => commitAcceptedMeloProposal(rejected, '2026-06-21T00:02:00Z')).toThrow();
  });

  it('ranks proactive interventions with caps and dismissal suppression', () => {
    const ranked = rankMeloInterventions(
      [
        {
          id: 'rent',
          topic: 'rent',
          title: 'Rent comes first',
          severity: 9,
          immediacy: 9,
          evidenceWeight: 9,
          novelty: 6,
          userRelevance: 6,
          activePlanRelevance: 4,
          anxietyCost: 2,
          repetitionCost: 0,
          interruptionCost: 1,
        },
        {
          id: 'dismissed',
          topic: 'card',
          title: 'Dismissed card item',
          severity: 7,
          immediacy: 7,
          evidenceWeight: 9,
          novelty: 5,
          userRelevance: 5,
          activePlanRelevance: 5,
          anxietyCost: 2,
          repetitionCost: 4,
          interruptionCost: 2,
          dismissedAt: '2026-06-20T09:00:00Z',
          materialChangeKey: 'same',
          lastMaterialChangeKey: 'same',
        },
      ],
      {
        maxNonUrgent: 3,
        topicCaps: { rent: 1 },
        quietHoursActive: false,
        allowUrgentDuringQuietHours: false,
        minRankWeight: 10,
      },
    );

    expect(ranked.map((candidate) => candidate.id)).toEqual(['rent']);
    expect(ranked[0]?.rankWeight).toBeGreaterThan(40);
  });

  it('keeps quiet hours unless urgent override is explicitly allowed', () => {
    const candidates = [
      {
        id: 'nonurgent',
        topic: 'habit',
        title: 'Weekly reflection',
        severity: 4,
        immediacy: 4,
        evidenceWeight: 8,
        novelty: 6,
        userRelevance: 6,
        activePlanRelevance: 0,
        anxietyCost: 1,
        repetitionCost: 0,
        interruptionCost: 1,
      },
    ];

    expect(
      rankMeloInterventions(candidates, {
        maxNonUrgent: 3,
        topicCaps: {},
        quietHoursActive: true,
        allowUrgentDuringQuietHours: false,
        minRankWeight: 10,
      }),
    ).toEqual([]);
  });

  it('builds bad-month mode without shame or false reassurance', () => {
    const briefing = buildBadMonthBriefing({
      workspaceId: 'workspace_personal',
      eventLabel: 'Vehicle repair',
      amountLabel: 'GBP 420 outflow',
      availableChangeLabel: 'Available cash is GBP 420 lower.',
      affectedItems: ['buffer falls to GBP 80'],
      stableItems: ['rent remains covered'],
      recoveryOptions: ['review assumptions', 'compare current contribution'],
      supportLinks: ['official support link placeholder'],
      tone: 'balanced',
    });

    expect(briefing.playfulOutputSuppressed).toBe(true);
    expect(briefing.advicePolicy.allowed).toBe(true);
    expect(briefing.stable).toEqual(['rent remains covered']);
  });

  it('explains plan movement with bounded review-only recovery options', () => {
    const briefing = buildPlanMovementBriefing({
      planTitle: 'Emergency fund',
      movementLine: 'A repair moved the visible date.',
      protectedLine: 'Rent remains protected.',
      needsReview: true,
      boundedQuestions: [
        'Keep the date?',
        'Change the contribution?',
        'Pause and review?',
        'Should this extra question be hidden?',
      ],
      recoveryOptions: ['keep-current-plan', 'adjust-contribution'],
      tone: 'balanced',
    });

    expect(briefing).toMatchObject({
      canWriteDirectly: false,
      recoveryOptions: ['keep-current-plan', 'adjust-contribution'],
      advicePolicy: expect.objectContaining({ allowed: true }),
    });
    expect(briefing.boundedQuestions).toHaveLength(3);
    expect(briefing.summary).not.toMatch(/\bfailed\b|\bfailure\b|\bshould\b/i);
  });

  it('explains the first minute without requiring account, cloud, AI or direct writes', () => {
    const briefing = buildFirstMinuteBriefing({
      primaryMessage:
        'Folio helps you understand where you stand, what changed, and what happens next.',
      choices: ['Import a statement', 'Add what I know', 'Try a sample briefing'],
      dataControlAvailable: true,
    });

    expect(briefing).toMatchObject({
      canWriteDirectly: false,
      advicePolicy: expect.objectContaining({ allowed: true }),
    });
    expect(briefing.boundedQuestions).toHaveLength(3);
    expect(briefing.summary).toContain('No account, cloud or AI is required');
    expect(briefing.summary).not.toMatch(
      /\bconfidence\b|confidence_|_confidence|\bscore\b|\badvice\b|\bshould\b/i,
    );
    expect(validateMeloRenderableOutput(briefing.summary).renderable).toBe(true);
  });

  it('explains sample briefing as not user data and not saved', () => {
    const briefing = buildSampleBriefing({
      whatChanged: 'income arrived',
      comingUp: 'rent is due',
      remainsProtected: 'rent remains protected',
      needsReview: 'one import needs review',
    });

    expect(briefing).toMatchObject({
      affectedFinances: false,
      canWriteDirectly: false,
      labels: ['Example only', 'Not your data', 'Nothing saved'],
      advicePolicy: expect.objectContaining({ allowed: true }),
    });
    expect(briefing.summary).toContain('Example only');
    expect(briefing.summary).toContain('Not your data');
    expect(briefing.summary).toContain('Nothing saved');
    expect(briefing.summary).not.toMatch(
      /\bconfidence\b|confidence_|_confidence|\bscore\b|\badvice\b|\bshould\b/i,
    );
    expect(validateMeloRenderableOutput(briefing.summary).renderable).toBe(true);
  });

  it('explains import review without direct writes, advice language or fake scores', () => {
    const briefing = buildImportReviewBriefing({
      sourceLabel: 'Statement import',
      importedClaimCount: 2,
      documentCount: 1,
      issueCount: 1,
      boundedQuestions: [
        'Is this the right date?',
        'Is this the right amount?',
        'Is this a duplicate?',
        'This question should not render.',
      ],
    });

    expect(briefing).toMatchObject({
      canWriteDirectly: false,
      advicePolicy: expect.objectContaining({ allowed: true }),
    });
    expect(briefing.boundedQuestions).toHaveLength(3);
    expect(briefing.summary).toContain('review before Melo saves anything as a fact');
    expect(briefing.summary).not.toMatch(/\bconfidence\b|confidence_|_confidence|\bscore\b/i);
    expect(validateMeloRenderableOutput(briefing.summary).renderable).toBe(true);
  });

  it('explains rejected import evidence without implying finance changes', () => {
    const briefing = buildRejectedImportBriefing({
      sourceLabel: 'Rejected import evidence',
      rejectedCount: 1,
      reasonLabels: ['duplicate'],
    });

    expect(briefing).toMatchObject({
      affectedFinances: false,
      canWriteDirectly: false,
      advicePolicy: expect.objectContaining({ allowed: true }),
    });
    expect(briefing.summary).toContain('evidence history only');
    expect(briefing.summary).toContain('did not change balances, plans, or financial facts');
    expect(briefing.summary).not.toMatch(
      /\bconfidence\b|confidence_|_confidence|\bscore\b|\badvice\b|\bshould\b/i,
    );
    expect(validateMeloRenderableOutput(briefing.summary).renderable).toBe(true);
  });

  it('creates inspectable compact memory records that do not duplicate the ledger', () => {
    const memory = createMeloMemoryRecord({
      id: 'memory_1',
      workspaceId: 'workspace_personal',
      kind: 'user_correction',
      depth: 'normal',
      scope: 'personal',
      value: 'Grocer refund is not salary',
      reasonUseful: 'Downweights equivalent future inference.',
      provenance: 'accepted correction proposal',
      sensitivity: 'medium',
      createdAt: '2026-06-21T00:00:00Z',
      expiresAt: '2026-12-21T00:00:00Z',
    });

    expect(memory).toMatchObject({
      inspectable: true,
      deletable: true,
      visibleToUser: true,
      duplicatesLedger: false,
    });
  });

  it('filters deleted and expired memories', () => {
    const active = createMeloMemoryRecord({
      id: 'memory_active',
      kind: 'preference',
      depth: 'minimal',
      scope: 'global_preference',
      value: 'balanced tone',
      reasonUseful: 'Sets default tone.',
      provenance: 'settings',
      sensitivity: 'low',
      createdAt: '2026-06-21T00:00:00Z',
    });
    const deleted = deleteMeloMemoryRecord(active, '2026-06-22T00:00:00Z');
    const expired = createMeloMemoryRecord({
      id: 'memory_expired',
      kind: 'approved_context',
      depth: 'deep',
      scope: 'personal',
      value: 'old context',
      reasonUseful: 'Historical context.',
      provenance: 'user approved',
      sensitivity: 'medium',
      createdAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-02-01T00:00:00Z',
    });

    expect(visibleMeloMemories([active, deleted, expired], '2026-06-21T12:00:00Z')).toEqual([
      active,
    ]);
  });

  it('stores correction learning only after acceptance and preserves the original inference', () => {
    expect(
      buildCorrectionLearningRecord({
        id: 'correction_rejected',
        workspaceId: 'workspace_personal',
        originalInference: 'salary',
        correctedValue: 'refund',
        accepted: false,
        sourceRecordId: 'txn_1',
        createdAt: '2026-06-21T00:00:00Z',
      }),
    ).toBeNull();

    expect(
      buildCorrectionLearningRecord({
        id: 'correction_accepted',
        workspaceId: 'workspace_personal',
        originalInference: 'salary',
        correctedValue: 'refund',
        accepted: true,
        sourceRecordId: 'txn_1',
        createdAt: '2026-06-21T00:00:00Z',
      }),
    ).toMatchObject({
      originalInferencePreserved: true,
      futureInferenceAdjustment: 'downweight_equivalent_inference',
      auditRequired: true,
    });
  });

  it('keeps voice-to-proposal blocked until native evidence exists', () => {
    expect(
      describeVoiceToProposalStatus({
        nativeAudioAvailable: false,
        transcriptReviewAvailable: true,
        vaultAvailable: true,
      }),
    ).toMatchObject({
      available: false,
      retainsAudioByDefault: false,
    });
  });

  it('passes no-AI acceptance for core deterministic paths', () => {
    expect(runNoAiMeloAcceptance()).toMatchObject({
      ok: true,
      modelRequired: false,
      networkRequired: false,
    });
  });
});
