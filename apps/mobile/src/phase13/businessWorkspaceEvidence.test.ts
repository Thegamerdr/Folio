import { describe, expect, it } from 'vitest';

import {
  buildPhase13BusinessWorkspaceEvidence,
  defaultPhase13BusinessWorkspaceEvidence,
  phase13ProofRows,
  phase13RowsByState,
} from './businessWorkspaceEvidence';

describe('Phase 13 business workspace evidence', () => {
  it('uses synthetic local-shell metadata without business data, tax advice, direct filing or beta claims', () => {
    expect(defaultPhase13BusinessWorkspaceEvidence.metadata).toMatchObject({
      phase: 'phase13',
      slice: 'business-workspace',
      sourceLabel: 'Synthetic sample',
      realBusinessData: false,
      realTaxAdvice: false,
      directTaxFilingEnabled: false,
      personalWorkspaceDefault: true,
      businessCreationShownDuringPersonalOnboarding: false,
      personalDataInBusinessExport: false,
      personalMeloMemoryIncluded: false,
      isolationSuitePassed: true,
      legalTaxSignoffComplete: false,
      entitlementSeamReady: false,
      businessBetaReady: false,
    });
  });

  it('keeps workspace identity visible without personal onboarding pressure', () => {
    const shell = defaultPhase13BusinessWorkspaceEvidence;

    expect(shell.switcher.activeWorkspace.label).toBe('Northstar Studio');
    expect(shell.switcher.personalDefaultPreserved).toBe(true);
    expect(shell.switcher.visualSeparationComplete).toBe(true);
    expect(shell.switcher.optionalAndNonCoercive).toBe(true);
  });

  it('proves ledger, export and Melo state exclude personal records', () => {
    const shell = defaultPhase13BusinessWorkspaceEvidence;

    expect(shell.ledger.personalQueryLeakage).toBe(false);
    expect(shell.ledger.businessOnlyTransactions).toBe(true);
    expect(shell.exports.personalRecordCount).toBe(0);
    expect(shell.exports.exportReady).toBe(true);
    expect(shell.briefing.noPersonalContext).toBe(true);
  });

  it('builds invoices, matching and tax prep without silent application or final-bill language', () => {
    const shell = defaultPhase13BusinessWorkspaceEvidence;

    expect(shell.invoiceLifecycle.expectedCashFlowMinor).toBe(345000);
    expect(shell.invoiceLifecycle.overdueInvoiceIds).toEqual(['invoice_2']);
    expect(shell.matching.ambiguousCount).toBe(3);
    expect(shell.matching.reviewRequiredCount).toBe(3);
    expect(shell.taxPeriod.everyFigureHasSourceAndPolicy).toBe(true);
    expect(shell.taxReserve.adviceBoundaryPassed).toBe(true);
  });

  it('keeps direct filing, legal review, entitlement and beta blocked', () => {
    const shell = defaultPhase13BusinessWorkspaceEvidence;

    expect(shell.taxLegalReview.signed).toBe(false);
    expect(shell.taxLegalReview.directFilingDisabled).toBe(true);
    expect(shell.betaGate.ready).toBe(false);
    expect(shell.betaGate.blockers).toEqual(
      expect.arrayContaining([
        'UK tax/business claims have not been reviewed',
        'business entitlement seam is not ready',
        'business support runbook is not ready',
      ]),
    );
  });

  it('passes the synthetic isolation attack suite across required surfaces', () => {
    const shell = defaultPhase13BusinessWorkspaceEvidence;

    expect(shell.isolationSuite.passed).toBe(true);
    expect(shell.isolationSuite.leakageCount).toBe(0);
    expect(shell.isolationSuite.surfaceCount).toBe(6);
  });

  it('exports stable Phase 13 proof rows for the gate panel', () => {
    expect(phase13ProofRows).toHaveLength(14);
    expect(phase13ProofRows.map((row) => row.label)).toEqual([
      'T169 Business workspace switcher',
      'T170 Business accounts and transactions',
      'T171 Clients and invoice lifecycle',
      'T172 Payment matching',
      'T173 Receipt/document workflow',
      'T174 Tax-period records',
      'T175 Tax reserve estimate',
      'T176 Business calendar/planner',
      'T177 Business briefing and Melo context',
      'T178 Business reports and exports',
      'T179 Mileage records',
      'T180 Tax/legal review',
      'T181 Workspace isolation attack suite',
      'T182 Business beta gate',
    ]);
    expect(
      phase13RowsByState(defaultPhase13BusinessWorkspaceEvidence.coverageRows, 'blocked'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: 'T180' }),
        expect.objectContaining({ taskId: 'T182' }),
      ]),
    );
  });

  it('records Huashu critique as a blocker-aware UI gate', () => {
    expect(defaultPhase13BusinessWorkspaceEvidence.huashuReview.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Function', state: 'implemented' }),
        expect.objectContaining({ label: 'Remaining review', state: 'blocked' }),
      ]),
    );
    expect(defaultPhase13BusinessWorkspaceEvidence.huashuReview.criticalIssuesFixed).toContain(
      'Kept personal workspace as the default; business setup is not shown during personal onboarding.',
    );
  });

  it('is deterministic', () => {
    expect(buildPhase13BusinessWorkspaceEvidence()).toEqual(
      defaultPhase13BusinessWorkspaceEvidence,
    );
  });
});
