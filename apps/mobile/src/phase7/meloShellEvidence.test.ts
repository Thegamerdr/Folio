import { describe, expect, it } from 'vitest';

import {
  buildPhase7MeloShellEvidence,
  defaultPhase7MeloShellEvidence,
  phase7ProofRows,
} from './meloShellEvidence';

describe('Phase 7 Melo shell evidence', () => {
  it('declares synthetic, model-off and no direct-write boundaries', () => {
    expect(defaultPhase7MeloShellEvidence.metadata).toMatchObject({
      phase: 'phase7',
      sourceLabel: 'Synthetic sample',
      modelRequired: false,
      networkRequired: false,
      realData: false,
      directStorageWrite: false,
      nativeAudioIntegration: false,
      vaultCommitIntegration: false,
    });
  });

  it('renders a non-blocking Melo presence with reduced-motion equivalent', () => {
    expect(defaultPhase7MeloShellEvidence.meloState).toMatchObject({
      expression: 'focused',
      motionMode: 'static_reduced_motion',
      presenceLabel: 'Present as guidance, not a chat gate',
    });
    expect(defaultPhase7MeloShellEvidence.metadata.reducedMotionEquivalent).toBe(true);
  });

  it('uses deterministic briefing copy that is renderable under policy', () => {
    expect(defaultPhase7MeloShellEvidence.briefing.modelRequired).toBe(false);
    expect(defaultPhase7MeloShellEvidence.briefing.networkRequired).toBe(false);
    expect(defaultPhase7MeloShellEvidence.briefing.policy.allowed).toBe(true);
  });

  it('surfaces intent cards with bounded question counts', () => {
    expect(defaultPhase7MeloShellEvidence.intentCards.map((card) => card.id)).toEqual([
      'higher_rent_actual',
      'bad_month_event',
      'unknown',
    ]);
    expect(defaultPhase7MeloShellEvidence.intentCards[2]?.maxQuestionsLabel).toBe('0 questions');
  });

  it('shows one bounded question and remaining count', () => {
    expect(defaultPhase7MeloShellEvidence.boundedQuestion.plan).toMatchObject({
      state: 'ask',
      slotId: 'reason',
      remainingQuestions: 0,
    });
    expect(defaultPhase7MeloShellEvidence.boundedQuestion.summaryLabel).toContain(
      'questions remain',
    );
  });

  it('keeps proposal review as command envelope only', () => {
    expect(defaultPhase7MeloShellEvidence.proposalReview).toMatchObject({
      statusLabel: 'accepted',
      commandLabel: 'UpdateRecurringExpectation',
      directWriteLabel: 'command envelope only',
    });
  });

  it('keeps tone variants calculation-invariant and renderable', () => {
    expect(defaultPhase7MeloShellEvidence.toneRows).toHaveLength(3);
    expect(
      defaultPhase7MeloShellEvidence.toneRows.every(
        (row) => row.invariantLabel === 'same facts and calculations',
      ),
    ).toBe(true);
    expect(defaultPhase7MeloShellEvidence.toneRows.every((row) => row.renderable)).toBe(true);
  });

  it('prioritises useful intervention rows', () => {
    expect(defaultPhase7MeloShellEvidence.interventions[0]).toMatchObject({
      id: 'review_rent',
      title: 'Rent amount needs review',
    });
  });

  it('shows bad-month facts without celebration or shame', () => {
    expect(defaultPhase7MeloShellEvidence.badMonth.playfulOutputSuppressed).toBe(true);
    expect(defaultPhase7MeloShellEvidence.badMonth.advicePolicy.allowed).toBe(true);
    expect(defaultPhase7MeloShellEvidence.badMonth.stable).toContain('rent remains covered');
  });

  it('keeps memory visible, inspectable and correction-audited', () => {
    expect(defaultPhase7MeloShellEvidence.memoryRows.map((row) => row.title)).toEqual([
      'Inspectable memory',
      'Accepted correction learning',
    ]);
    expect(defaultPhase7MeloShellEvidence.memoryRows[0]?.policyLabel).toContain('deletable');
    expect(defaultPhase7MeloShellEvidence.memoryRows[1]?.policyLabel).toBe('audit preserved');
  });

  it('keeps voice blocked until native evidence exists', () => {
    const voice = defaultPhase7MeloShellEvidence.policyRows.find((row) => row.label === 'Voice');

    expect(voice).toMatchObject({ state: 'blocked' });
    expect(voice?.value).toContain('blocked');
  });

  it('records no-AI acceptance as implemented', () => {
    expect(defaultPhase7MeloShellEvidence.policyRows.find((row) => row.label === 'No AI')).toEqual(
      expect.objectContaining({ state: 'implemented' }),
    );
  });

  it('exports proof rows for app gate rendering', () => {
    expect(phase7ProofRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Intent registry', state: 'implemented' }),
        expect.objectContaining({ label: 'Voice path', state: 'blocked' }),
      ]),
    );
  });

  it('is deterministic when rebuilt', () => {
    expect(buildPhase7MeloShellEvidence()).toEqual(defaultPhase7MeloShellEvidence);
  });
});
