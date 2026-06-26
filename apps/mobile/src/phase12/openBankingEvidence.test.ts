import { describe, expect, it } from 'vitest';

import {
  buildPhase12OpenBankingEvidence,
  defaultPhase12OpenBankingEvidence,
  phase12ProofRows,
  phase12RowsByState,
} from './openBankingEvidence';

describe('Phase 12 Open Banking evidence', () => {
  it('uses synthetic local-shell metadata without live provider, token or bank-data claims', () => {
    expect(defaultPhase12OpenBankingEvidence.metadata).toMatchObject({
      phase: 'phase12',
      slice: 'open-banking',
      sourceLabel: 'Synthetic sample',
      networkRequiredForManualMode: false,
      firstLaunchBankPromptShown: false,
      realProviderConnected: false,
      regulatedProviderSelected: false,
      providerTokenInApp: false,
      realBankData: false,
      backendTokenAdapterLive: false,
      directTransactionWrites: false,
      manualImportStillAvailable: true,
      providerSandboxPilotPassed: false,
      providerProductionPilotPassed: false,
      legalSignoffComplete: false,
      openBankingBetaReady: false,
    });
  });

  it('keeps provider procurement and live provider contract gates blocked', () => {
    const shell = defaultPhase12OpenBankingEvidence;

    expect(shell.providerSelection.selectedProviderRegulated).toBe(false);
    expect(shell.providerSelection.securityAndProcessorReviewPassed).toBe(false);
    expect(shell.providerContract.providerNeutral).toBe(true);
    expect(shell.providerContract.fakeContractPassed).toBe(true);
    expect(shell.providerContract.sandboxContractPassed).toBe(false);
    expect(shell.providerContract.productionContractPassed).toBe(false);
  });

  it('requires contextual consent and keeps provider tokens outside the app', () => {
    const shell = defaultPhase12OpenBankingEvidence;

    expect(shell.consentJourney.contextualOnly).toBe(true);
    expect(shell.consentJourney.explanationComplete).toBe(true);
    expect(shell.consentJourney.serverTokenBoundary).toBe(true);
    expect(shell.consentJourney.appHasNoToken).toBe(true);
    expect(shell.dashboard.dashboardComplete).toBe(true);
    expect(shell.dashboard.accountCount).toBe(4);
  });

  it('stages canonical rows through import review and detects reconciliation issues', () => {
    const shell = defaultPhase12OpenBankingEvidence;

    expect(shell.ingestion.routeThroughImportReview).toBe(true);
    expect(shell.ingestion.writeDirectlyToTransactions).toBe(false);
    expect(shell.ingestion.canonicalRows).toHaveLength(4);
    expect(shell.ingestion.canonicalRows.every((row) => row.stageOnly)).toBe(true);
    expect(shell.reconciliation.duplicateProviderIds).toEqual(['bank_txn_1']);
    expect(shell.reconciliation.pendingReplacements).toEqual(['regulated_candidate:row_2']);
    expect(shell.reconciliation.possibleTransferIds).toEqual(['regulated_candidate:row_3']);
  });

  it('shows stale and gapped feed state while manual import remains available', () => {
    const shell = defaultPhase12OpenBankingEvidence;

    expect(shell.feedHealth).toMatchObject({
      stale: true,
      gapped: true,
      status: 'unavailable',
      forecastMustShowStaleData: true,
      localAppContinues: true,
      releaseBlocked: false,
    });
  });

  it('stops future access on revocation and separates local history deletion', () => {
    const shell = defaultPhase12OpenBankingEvidence;

    expect(shell.revocation).toMatchObject({
      consentId: 'consent_demo_revoked',
      futureAccessStopped: true,
      serverTokenDeleted: true,
      localHistorySeparateChoice: true,
      releaseBlocked: false,
    });
  });

  it('exports stable Phase 12 proof rows for the gate panel', () => {
    expect(phase12ProofRows).toHaveLength(9);
    expect(phase12ProofRows.map((row) => row.label)).toEqual([
      'T160 Regulated AISP provider selection',
      'T161 BankDataProvider contract',
      'T162 Consent journey and token store',
      'T163 Consent dashboard',
      'T164 Canonical row ingestion',
      'T165 Refresh, gap and stale state',
      'T166 Revocation and deletion paths',
      'T167 Provider sandbox/production pilot',
      'T168 Staged Open Banking rollout',
    ]);
    expect(phase12RowsByState(defaultPhase12OpenBankingEvidence.coverageRows, 'blocked')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: 'T160' }),
        expect.objectContaining({ taskId: 'T161' }),
        expect.objectContaining({ taskId: 'T167' }),
        expect.objectContaining({ taskId: 'T168' }),
      ]),
    );
  });

  it('records Huashu critique as a blocker-aware UI gate', () => {
    expect(defaultPhase12OpenBankingEvidence.huashuReview.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Function', state: 'implemented' }),
        expect.objectContaining({ label: 'Remaining review', state: 'blocked' }),
      ]),
    );
    expect(defaultPhase12OpenBankingEvidence.huashuReview.criticalIssuesFixed).toContain(
      'Kept Open Banking behind a contextual connect-bank action, never first launch.',
    );
  });

  it('is deterministic', () => {
    expect(buildPhase12OpenBankingEvidence()).toEqual(defaultPhase12OpenBankingEvidence);
  });
});
