import { describe, expect, it } from 'vitest';

import {
  buildPhase11OptionalAiEvidence,
  defaultPhase11OptionalAiEvidence,
  phase11ProofRows,
  phase11RowsByState,
} from './optionalAiEvidence';

describe('Phase 11 optional AI evidence', () => {
  it('uses synthetic local-shell metadata without real model, provider, network or data claims', () => {
    expect(defaultPhase11OptionalAiEvidence.metadata).toMatchObject({
      phase: 'phase11',
      slice: 'optional-ai',
      sourceLabel: 'Synthetic sample',
      modelRequiredForLocalCore: false,
      networkRequiredForShell: false,
      realProviderConnected: false,
      providerKeyInApp: false,
      realModelCall: false,
      realData: false,
      localMeloAiFunctionAvailable: true,
      meloPromptPanelAvailable: true,
      aiOffComplete: true,
      fullDatabaseRouteAvailable: false,
      directAiDomainWrites: false,
      gatewayDeployed: false,
      evaluationDeployable: false,
      aiBetaReady: false,
    });
  });

  it('exposes a usable local Melo draft function without cloud or writes', () => {
    expect(defaultPhase11OptionalAiEvidence.localMeloDraft).toMatchObject({
      routeKind: 'deterministic_local',
      intent: 'check_purchase',
      detectedAmountMinor: 12000,
      usedCloud: false,
      canWriteRecords: false,
      requiresUserReview: true,
      financialConclusion: 'Would leave £22.',
    });
    expect(defaultPhase11OptionalAiEvidence.localMeloDraft.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'open_what_if' }),
        expect.objectContaining({ kind: 'explain_sources' }),
      ]),
    );
    expect(defaultPhase11OptionalAiEvidence.localMeloDraft.dataUsed).toContain(
      '£142 available now',
    );
  });

  it('proves registry, gateway and context boundaries without provider leakage', () => {
    const shell = defaultPhase11OptionalAiEvidence;

    expect(shell.registry.canChangeProviderWithoutMobileRelease).toBe(true);
    expect(shell.gateway.noProviderKeyInApp).toBe(true);
    expect(shell.gateway.noDatabaseCredential).toBe(true);
    expect(shell.context.fullDatabaseRouteAvailable).toBe(false);
    expect(shell.context.redactedIdentifierCount).toBe(2);
    expect(shell.context.records).toHaveLength(1);
    expect(shell.context.records[0]?.fields).toMatchObject({
      accountId: 'local_alias_1',
      merchantName: 'local_alias_2',
    });
  });

  it('models the route ladder and rejects regulated strong-model use', () => {
    const shell = defaultPhase11OptionalAiEvidence;

    expect(shell.onDevice.fallbackWorks).toBe(true);
    expect(shell.smallRoute).toMatchObject({
      routeKind: 'cloud_small',
      providerId: 'provider_small_configured',
      cloudRequestAllowed: true,
      aiOffComplete: true,
    });
    expect(shell.strongRoute).toMatchObject({
      routeKind: 'deterministic',
      regulatedOrWriteTaskRejected: true,
      cloudRequestAllowed: false,
    });
  });

  it('keeps quotas visible and does not charge system-failure retries', () => {
    const shell = defaultPhase11OptionalAiEvidence;

    expect(shell.quota).toMatchObject({
      capUnits: 30,
      usedUnits: 3,
      remainingUnits: 27,
      cloudConvenienceOnly: true,
      visibleBeforeUse: true,
      releaseBlocked: false,
    });
    expect(shell.operatorScenario).toMatchObject({
      userCount: 1000,
      monthlyInputUnits: 60_000_000,
      monthlyOutputUnits: 18_000_000,
      operatorOnly: true,
      notUserFinanceDashboard: true,
    });
  });

  it('keeps model deployment and beta blocked until evaluation and operations pass', () => {
    const shell = defaultPhase11OptionalAiEvidence;

    expect(shell.evaluation.deployable).toBe(false);
    expect(shell.evaluation.blockers).toContain('1 evaluation cases failed safety checks');
    expect(shell.melo.aiOffSameFinancialConclusion).toBe(true);
    expect(shell.melo.modelCannotWriteRecords).toBe(true);
    expect(shell.consent.cloudAllowed).toBe(false);
    expect(shell.consent.denialUsesLocalManualPath).toBe(true);
    expect(shell.beta.ready).toBe(false);
    expect(shell.blockerRows.length).toBeGreaterThan(3);
  });

  it('exports stable Phase 11 proof rows for the gate panel', () => {
    expect(phase11ProofRows).toHaveLength(11);
    expect(phase11ProofRows.map((row) => row.label)).toEqual([
      'T149 AI task schemas/provider registry',
      'T150 AI gateway',
      'T151 Minimal context builder',
      'T152 On-device model adapters',
      'T153 Cloud small-model route',
      'T154 Rare strong-model route',
      'T155 Quota and cost ledger',
      'T156 Model evaluation pipeline',
      'T157 Optional AI in Melo',
      'T158 First-cloud-AI consent',
      'T159 AI beta strict quotas',
    ]);
    expect(phase11RowsByState(defaultPhase11OptionalAiEvidence.coverageRows, 'blocked')).toEqual(
      expect.arrayContaining([expect.objectContaining({ taskId: 'T159' })]),
    );
  });

  it('records the Huashu critique as a blocker-aware UI gate', () => {
    expect(defaultPhase11OptionalAiEvidence.huashuReview.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Function', state: 'implemented' }),
        expect.objectContaining({ label: 'Remaining review', state: 'blocked' }),
      ]),
    );
    expect(defaultPhase11OptionalAiEvidence.huashuReview.criticalIssuesFixed).toContain(
      'Kept the top state as AI off complete instead of model ready.',
    );
  });

  it('is deterministic', () => {
    expect(buildPhase11OptionalAiEvidence()).toEqual(defaultPhase11OptionalAiEvidence);
  });
});
