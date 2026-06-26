import { describe, expect, it } from 'vitest';

import {
  buildPhase8PlanRecoveryEvidence,
  defaultPhase8PlanRecoveryEvidence,
  phase8ProofRows,
} from './planRecoveryEvidence';

describe('Phase 8 plan recovery evidence', () => {
  it('declares synthetic, model-off and no direct-write boundaries', () => {
    expect(defaultPhase8PlanRecoveryEvidence.metadata).toMatchObject({
      phase: 'phase8',
      sourceLabel: 'Synthetic sample',
      modelRequired: false,
      networkRequired: false,
      realData: false,
      directStorageWrite: false,
      vaultPlanCommitIntegration: false,
      deviceNotificationIntegration: false,
      manualAccessibilityVerified: false,
    });
  });

  it('keeps plan creation optional and flat by default', () => {
    expect(defaultPhase8PlanRecoveryEvidence.planDraft).toMatchObject({
      promptRequiredForCore: false,
      flatByDefault: true,
      hierarchyOptional: true,
      reviewRequiredBeforeCommit: true,
      status: 'draft',
    });
  });

  it('shows a reversible rule edit without mutating domain rows', () => {
    expect(defaultPhase8PlanRecoveryEvidence.ruleEdit).toMatchObject({
      reversible: true,
      domainPlanMutated: false,
    });
    expect(defaultPhase8PlanRecoveryEvidence.ruleRows.map((row) => row.label)).toEqual([
      'Priority',
      'Contribution',
      'Protected floor',
      'Reversible',
    ]);
  });

  it('shows a reduced-motion journey with accessible milestone rows', () => {
    expect(defaultPhase8PlanRecoveryEvidence.journey.reducedMotionSafe).toBe(true);
    expect(defaultPhase8PlanRecoveryEvidence.journey.accessibleTextEquivalent).toContain(
      'Rebuild the reserve buffer',
    );
    expect(defaultPhase8PlanRecoveryEvidence.journeyRows).toHaveLength(4);
    expect(defaultPhase8PlanRecoveryEvidence.journeyRows[1]?.accessibilityLabel).toContain(
      '50% milestone reached',
    );
  });

  it('cascades an unexpected event through derived projections', () => {
    expect(defaultPhase8PlanRecoveryEvidence.cascade).toMatchObject({
      atomic: true,
      historyRetained: true,
      directWriteToActualRecords: false,
      materialChangeRequiresReview: true,
    });
    expect(defaultPhase8PlanRecoveryEvidence.cascade.invalidatedProjections).toEqual([
      'forecast',
      'budget',
      'plan',
      'calendar',
      'briefing',
    ]);
  });

  it('uses non-shaming recovery choices and no immediate writes', () => {
    const visibleCopy = [
      defaultPhase8PlanRecoveryEvidence.recovery.title,
      defaultPhase8PlanRecoveryEvidence.recovery.fact,
      defaultPhase8PlanRecoveryEvidence.recovery.immediateEffect,
      defaultPhase8PlanRecoveryEvidence.recovery.nextStep,
      ...defaultPhase8PlanRecoveryEvidence.recovery.choices.flatMap((choice) => [
        choice.label,
        choice.consequence,
      ]),
    ].join(' ');

    expect(visibleCopy.toLowerCase()).not.toContain('failed');
    expect(
      defaultPhase8PlanRecoveryEvidence.recovery.choices.every(
        (choice) => choice.writesImmediately === false,
      ),
    ).toBe(true);
  });

  it('exposes budget included and excluded rows', () => {
    expect(defaultPhase8PlanRecoveryEvidence.budget.calculationExplainable).toBe(true);
    expect(defaultPhase8PlanRecoveryEvidence.budget.budgetOptional).toBe(true);
    expect(defaultPhase8PlanRecoveryEvidence.budgetRows.map((row) => row.stateLabel)).toEqual([
      'included',
      'included',
      'included',
      'excluded',
    ]);
  });

  it('builds real-progress momentum without daily loss streaks', () => {
    expect(defaultPhase8PlanRecoveryEvidence.momentum).toMatchObject({
      state: 'recovering',
      missingDayPenalty: false,
      dailyLossStreak: false,
    });
    expect(defaultPhase8PlanRecoveryEvidence.momentumRows).toHaveLength(3);
  });

  it('suppresses fun in bad-month mode and keeps preferences resettable', () => {
    expect(defaultPhase8PlanRecoveryEvidence.fun).toMatchObject({
      requestedEnabled: true,
      effectiveState: 'softened',
      celebrationAllowed: false,
      miniGameUsesRealFunds: false,
    });
    expect(defaultPhase8PlanRecoveryEvidence.retention).toMatchObject({
      inspectable: true,
      resettable: true,
      hiddenSensitiveProfiling: false,
    });
    expect(defaultPhase8PlanRecoveryEvidence.resetRetention.emphasizedMotivations).toEqual([
      'upcoming_obligations',
    ]);
  });

  it('keeps rituals optional and native notifications blocked', () => {
    expect(defaultPhase8PlanRecoveryEvidence.rituals).toMatchObject({
      quietStateValid: true,
      forcedDailyOpen: false,
      notificationPolicyControlled: true,
    });
    expect(
      defaultPhase8PlanRecoveryEvidence.policyRows.find((row) => row.label === 'Notifications'),
    ).toMatchObject({ state: 'blocked' });
  });

  it('passes all synthetic emotional safety journeys', () => {
    expect(defaultPhase8PlanRecoveryEvidence.safetyReviews).toHaveLength(3);
    expect(defaultPhase8PlanRecoveryEvidence.safetyReviews.every((review) => review.passed)).toBe(
      true,
    );
    expect(
      defaultPhase8PlanRecoveryEvidence.safetyReviews.find(
        (review) => review.journey === 'bad_month',
      )?.badMonthCelebrationSuppressed,
    ).toBe(true);
  });

  it('exports proof rows for the Phase 8 gate', () => {
    expect(phase8ProofRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Plan creator', state: 'implemented' }),
        expect.objectContaining({ label: 'Native/vault', state: 'blocked' }),
      ]),
    );
  });

  it('is deterministic when rebuilt', () => {
    expect(buildPhase8PlanRecoveryEvidence()).toEqual(defaultPhase8PlanRecoveryEvidence);
  });
});
