import { describe, expect, it } from 'vitest';

import { buildSupportDiagnosticBundle } from './supportDiagnostic';

function state() {
  return {
    schemaVersion: 13,
    workspaces: [
      {
        id: 'personal-private-id',
        kind: 'personal',
        name: 'Private household name',
        archivedAt: null,
      },
    ],
    activeWorkspaceId: 'personal-private-id',
    dataWorkspaceId: 'personal-private-id',
    accounts: [{ id: 'secret-account', name: 'Daily account', balanceMinor: 123_45 }],
    calendarEvents: [{ id: 'calendar-secret', title: 'Rent £900' }],
    correctionImpacts: [{ id: 'correction-secret' }],
    cycles: [{ id: 'cycle-secret' }],
    debts: [{ id: 'debt-secret', name: 'Private card' }],
    decisionLedger: [{ id: 'decision-secret' }],
    droppedTransactionCount: 4,
    evidenceDocuments: [{ id: 'document-secret', filename: 'statement.pdf' }],
    incomeSources: [{ id: 'income-secret', label: 'Employer name' }],
    materialChanges: [{ id: 'change-secret' }],
    meloMemoryThread: [{ id: 'memory-secret', text: 'Sensitive conversation' }],
    onboarding: { done: true, monthlyIncome: 3_200, payday: 25 },
    plans: [{ id: 'plan-secret', name: 'Private plan' }],
    pots: [{ id: 'pot-secret', name: 'Holiday', saved: 1_000 }],
    readerCandidates: [{ id: 'reader-secret', merchant: 'Private merchant', amount: 44 }],
    reviewQueue: [{ id: 'review-secret', merchant: 'Private merchant' }],
    reviewQueueSpillover: [{ id: 'spill-secret', merchant: 'Other merchant' }],
    statementImports: [{ id: 'import-secret', filename: 'bank.csv' }],
    subs: [{ id: 'sub-secret', name: 'Private subscription', amount: 20 }],
    transactions: [{ id: 'transaction-secret', merchant: 'Private merchant', amount: 99 }],
  } as never;
}

const environment = {
  appLockEnabled: true,
  appVersion: '1.0.0',
  buildVersion: '42',
  currentScreen: 'privacy',
  executionEnvironment: 'standalone',
  isDevice: true,
  platform: 'android',
  platformVersion: '35',
} as const;

describe('support diagnostic bundle', () => {
  it('exports only counts and health states, never the source rows used to derive them', () => {
    const bundle = buildSupportDiagnosticBundle(
      state(),
      environment,
      new Date('2026-08-17T09:30:00.000Z'),
    );

    expect(bundle.safeForExport).toBe(true);
    expect(bundle.redactedPaths).toEqual([]);
    expect(bundle.redacted).toMatchObject({
      schema: 'melo-support-diagnostic-v1',
      recordCounts: {
        accounts: 1,
        calendarItems: 1,
        companionMemoryLines: 1,
        savedSources: 1,
        transactions: 1,
      },
      redactionPolicy: {
        exactPreviewBeforeShare: true,
        rawFinancialRowsIncluded: false,
        recoverySecretsIncluded: false,
        uploadAutomatic: false,
      },
    });
    for (const forbidden of [
      'personal-private-id',
      'Private household name',
      'secret-account',
      'Daily account',
      'Rent £900',
      'Private merchant',
      'Sensitive conversation',
      'statement.pdf',
      'bank.csv',
      '3200',
    ]) {
      expect(bundle.jsonText).not.toContain(forbidden);
    }
  });

  it('does not mutate or depend on a financial value when only counts stay the same', () => {
    const first = buildSupportDiagnosticBundle(state(), environment, new Date(0));
    const changed = state() as Record<string, unknown>;
    changed['transactions'] = [
      { id: 'another-id', merchant: 'Different merchant', amount: 999_999 },
    ];
    const second = buildSupportDiagnosticBundle(changed as never, environment, new Date(0));

    expect(second.jsonText).toBe(first.jsonText);
  });
});
