import { describe, expect, it } from 'vitest';

import {
  appStateAuthorityManifest,
  appStateFieldsWithAuthority,
} from './appStateAuthorityManifest';

describe('AppState authority manifest', () => {
  it('keeps the current 48-field shipping contract explicitly classified', () => {
    expect(Object.keys(appStateAuthorityManifest)).toHaveLength(48);
    expect(appStateFieldsWithAuthority('workspace-root')).toEqual([
      'schemaVersion',
      'workspaces',
      'activeWorkspaceId',
      'dataWorkspaceId',
    ]);
    expect(appStateFieldsWithAuthority('canonical-ledger-authority')).toEqual([
      'pots',
      'subs',
      'subPaused',
      'subOverrides',
      'cycles',
      'currentBalance',
      'potLedger',
      'transactions',
      'debts',
      'accounts',
    ]);
    expect(appStateFieldsWithAuthority('canonical-financial-context-authority')).toEqual([
      'onboarding',
      'nextYouNote',
      'tightPointGoal',
      'droppedTransactionCount',
      'moneyMode',
      'bufferAmount',
      'modeExtras',
      'household',
    ]);
    expect(appStateFieldsWithAuthority('canonical-route-planning-authority')).toEqual([
      'calendarEvents',
      'plans',
      'incomeSources',
    ]);
    expect(appStateFieldsWithAuthority('canonical-transaction-intelligence-authority')).toEqual([
      'timelineEvents',
      'reviewQueue',
      'reviewQueueSpillover',
      'edits',
      'ignoredReviewSigs',
      'ignoredBankExternalIds',
      'dismissedIncomeSignals',
      'dismissedBillSignals',
      'dismissedDriftSignals',
      'dismissedAnnualSignals',
      'merchantCategories',
      'statementImports',
      'evidenceDocuments',
    ]);
    expect(appStateFieldsWithAuthority('canonical-companion-runtime-authority')).toEqual([
      'aiReads',
      'aiReadCache',
      'whatChangedSeenISO',
      'lens',
      'melo',
      'tinyWins',
    ]);
  });

  it('keeps read-once navigation and unreviewed reader staging out of persistence', () => {
    expect(appStateFieldsWithAuthority('transient-not-persisted')).toEqual([
      'calendarFocusDate',
      'routeFocusDate',
      'readerCandidates',
      'readerClosingBalance',
    ]);
  });

  it('does not mislabel sidecar mirrors as shipping read authority', () => {
    expect(appStateFieldsWithAuthority('canonical-route-planning-authority')).toContain(
      'calendarEvents',
    );
    expect(appStateFieldsWithAuthority('canonical-companion-runtime-authority')).toContain('melo');
    expect(appStateFieldsWithAuthority('exact-encrypted-authority')).toEqual([]);
  });
});
