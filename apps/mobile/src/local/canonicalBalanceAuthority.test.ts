import {
  createAccount,
  createBalanceObservation,
  createCurrentBalance,
  createEntityVersion,
  createInstantString,
  createProvenanceId,
  createSourceRecordId,
  type BalanceObservation,
  type CurrentBalance,
  type Provenance,
  type SourceRecord,
} from '@folio/domain';
import {
  InMemoryDatabaseDriver,
  migrateCanonicalSnapshotToSqliteRepository,
  openSqliteCanonicalRepository,
  type CanonicalRepositorySnapshot,
} from '@folio/storage';
import { describe, expect, it } from 'vitest';

import { recordCanonicalBalanceCorrection } from './canonicalBalanceAuthority.js';
import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import { createEmptyLocalLedgerState, createInitialLocalLedgerState } from './localLedger.js';
import { buildCanonicalTimelineModel } from './localTimelineAdapter.js';
import { buildCanonicalTodayModel } from './localTodayAdapter.js';

const bannedSurfaceWords = /\bconfidence\b|confidence_|_confidence|\bscore\b|\badvice\b/i;
const version = createEntityVersion({ dataVersion: 'test:canonical-balance-authority' });
const observedAt = createInstantString('2026-06-22T11:00:00.000Z');

describe('canonical balance authority', () => {
  it('rebuilds Today from canonical balances without an opening balance argument', () => {
    const repository = createCanonicalRepositoryForLocalLedgerState(
      createInitialLocalLedgerState('2026-06-22'),
    );
    const snapshot = repository.snapshot();
    const today = buildCanonicalTodayModel(snapshot, { asOfDate: '2026-06-22' });

    expect(today.position.openingBalanceMinor).toBe(
      snapshot.collections.currentBalances[0]?.balance.minorUnits,
    );
    expect(today.balanceEvidence[0]).toMatchObject({
      actionPath: 'inspect',
      authorityState: 'user-confirmed',
      provenanceId: expect.any(String),
      sourceRecordId: expect.any(String),
    });
    expect(JSON.stringify(today)).not.toMatch(bannedSurfaceWords);
  });

  it('survives SQLite reload with balance observations, current balances and position snapshots', async () => {
    const snapshot = createCanonicalRepositoryForLocalLedgerState(
      createInitialLocalLedgerState('2026-06-22'),
    ).snapshot();
    const reloaded = await reloadCanonicalSnapshot(snapshot);

    expect(reloaded.collections.balanceObservations).toEqual(
      snapshot.collections.balanceObservations,
    );
    expect(reloaded.collections.currentBalances).toEqual(snapshot.collections.currentBalances);
    expect(reloaded.collections.availablePositionSnapshots).toEqual(
      snapshot.collections.availablePositionSnapshots,
    );
    expect(
      buildCanonicalTodayModel(reloaded, { asOfDate: '2026-06-22' }).position.openingBalanceMinor,
    ).toBe(snapshot.collections.currentBalances[0]?.balance.minorUnits);
  });

  it('keeps user-entered opening balance provenance-linked', () => {
    const snapshot = createCanonicalRepositoryForLocalLedgerState(
      createInitialLocalLedgerState('2026-06-22'),
    ).snapshot();
    const observation = snapshot.collections.balanceObservations[0];
    const provenance = snapshot.collections.provenance.find(
      (record) => record.id === observation?.provenanceId,
    );

    expect(observation).toMatchObject({
      authorityState: 'user-confirmed',
      observationKind: 'opening-balance',
      reconciliationState: 'provisional',
      reviewState: 'not-required',
      sourceKind: 'user-entered',
    });
    expect(provenance?.sourceRecordIds).toContain(observation?.sourceRecordId);
  });

  it('keeps imported and provider balances distinct from final truth on Timeline', () => {
    const snapshot = withAdditionalBalanceAuthority(
      createCanonicalRepositoryForLocalLedgerState(
        createEmptyLocalLedgerState('2026-06-22'),
      ).snapshot(),
      [
        {
          amountMinor: 101000,
          authorityState: 'provider-reported',
          observationKind: 'provider-balance',
          reviewState: 'not-required',
          sourceKind: 'provider-reported',
          suffix: 'provider',
        },
        {
          amountMinor: 99000,
          authorityState: 'imported-claim',
          observationKind: 'imported-statement-balance',
          reconciliationState: 'unreconciled',
          reviewState: 'needs-review',
          sourceKind: 'imported-statement',
          suffix: 'statement',
        },
      ],
    );
    const timeline = buildCanonicalTimelineModel(snapshot, { asOfDate: '2026-06-22' });
    const provider = timeline.events.find((event) => event.title === 'Provider balance imported');
    const discrepancy = timeline.events.find((event) => event.title === 'Discrepancy detected');

    expect(provider).toMatchObject({
      kind: 'balance-event',
      tone: 'estimated',
    });
    expect(provider?.detail).toContain('reported fact, not final truth');
    expect(discrepancy).toMatchObject({
      evidence: expect.objectContaining({ actionPath: 'review', reviewState: 'needs-review' }),
      kind: 'balance-event',
      tone: 'attention',
    });
  });

  it('labels calculated balances as reviewed local calculations, not final reported truth', () => {
    const snapshot = withCalculatedCurrentBalance(
      createCanonicalRepositoryForLocalLedgerState(
        createEmptyLocalLedgerState('2026-06-22'),
      ).snapshot(),
    );
    const timeline = buildCanonicalTimelineModel(snapshot, { asOfDate: '2026-06-22' });
    const emptyBaseline = timeline.events.find(
      (event) =>
        event.kind === 'balance-event' &&
        event.evidence.sourceLabel === 'Empty workspace baseline for 2026-06-22',
    );
    const calculated = timeline.events.find(
      (event) =>
        event.kind === 'balance-event' &&
        event.detail.includes('Calculated from reviewed local records') &&
        event.evidence.linkedRecords.some(
          (record) =>
            record.kind === 'current balance' && record.id === 'currentbalance_derived_today',
        ),
    );

    expect(emptyBaseline).toMatchObject({
      evidence: expect.objectContaining({
        actionPath: 'review',
        authorityState: 'estimated',
        reviewState: 'needs-review',
      }),
      kindLabel: 'Balance',
      tone: 'attention',
    });
    expect(calculated).toMatchObject({
      kindLabel: 'Balance',
      tone: 'estimated',
    });
    expect(calculated?.evidence.authorityState).toBe('inferred');
  });

  it('records balance corrections as balance, decision and audit records', () => {
    const repository = createCanonicalRepositoryForLocalLedgerState(
      createEmptyLocalLedgerState('2026-06-22'),
    );
    const sourceObservation = repository.balanceObservations.list()[0];

    expect(sourceObservation).toBeDefined();
    const result = recordCanonicalBalanceCorrection(repository, {
      accountId: sourceObservation?.accountId ?? repository.accounts.list()[0]!.id,
      correctedBalanceMinor: 12500,
      decidedAt: '2026-06-22T12:00:00.000Z',
      localDate: '2026-06-22',
      reason: 'Correct opening balance after checking account',
      sourceObservationId: sourceObservation!.id,
    });

    expect(repository.balanceAdjustments.get(result.adjustment.id)).toMatchObject({
      decisionId: result.decision.id,
      kind: 'correction',
    });
    expect(repository.decisions.get(result.decision.id)).toMatchObject({
      kind: 'correct-record',
    });
    expect(repository.auditLog.get(result.auditEntry.id)).toMatchObject({
      action: 'balance_corrected',
      subjectId: String(result.observation.id),
    });
  });

  it('rejects balance records crossing Personal and Business workspace boundaries', () => {
    const repository = createCanonicalRepositoryForLocalLedgerState(
      createEmptyLocalLedgerState('2026-06-22'),
    );
    const businessAccount = createAccount({
      id: 'account_business_cash',
      workspaceId: 'workspace_business_balance',
      name: 'Business cash',
      kind: 'cash',
      currency: 'GBP',
      version,
    });
    const observation = repository.balanceObservations.list()[0]!;

    expect(() =>
      repository.balanceObservations.put({
        ...observation,
        id: createBalanceObservation({
          ...observation,
          id: 'balance_cross_workspace_attempt',
          accountId: businessAccount.id,
        }).id,
        accountId: businessAccount.id,
      }),
    ).toThrow(/accounts|workspace/);
  });

  it('rebuilds available position from canonical repository records only', async () => {
    const snapshot = createCanonicalRepositoryForLocalLedgerState(
      createInitialLocalLedgerState('2026-06-22'),
    ).snapshot();
    const reloaded = await reloadCanonicalSnapshot(snapshot);
    const today = buildCanonicalTodayModel(reloaded, { asOfDate: '2026-06-22' });

    expect(reloaded.collections.availablePositionSnapshots[0]).toMatchObject({
      balanceObservationIds: [reloaded.collections.balanceObservations[0]?.id],
      currentBalanceIds: [reloaded.collections.currentBalances[0]?.id],
    });
    expect(today.position.inputs.sourceIds).toContain(
      String(reloaded.collections.balanceObservations[0]?.provenanceId),
    );
    expect(JSON.stringify({ today })).not.toMatch(/local_ledger_/i);
  });
});

async function reloadCanonicalSnapshot(
  snapshot: CanonicalRepositorySnapshot,
): Promise<CanonicalRepositorySnapshot> {
  const driver = new InMemoryDatabaseDriver();
  await migrateCanonicalSnapshotToSqliteRepository(driver, snapshot);
  const repository = await openSqliteCanonicalRepository(driver, snapshot.workspaceId);
  return repository.snapshot();
}

function withAdditionalBalanceAuthority(
  snapshot: CanonicalRepositorySnapshot,
  records: readonly Readonly<{
    amountMinor: number;
    authorityState: BalanceObservation['authorityState'];
    observationKind: BalanceObservation['observationKind'];
    reconciliationState?: BalanceObservation['reconciliationState'];
    reviewState: BalanceObservation['reviewState'];
    sourceKind: BalanceObservation['sourceKind'];
    suffix: string;
  }>[],
): CanonicalRepositorySnapshot {
  const account = snapshot.collections.accounts[0]!;
  const additions = records.map((record) => createBalanceRecordSet(snapshot, account.id, record));

  return {
    ...snapshot,
    collections: {
      ...snapshot.collections,
      balanceObservations: [
        ...snapshot.collections.balanceObservations,
        ...additions.map((addition) => addition.observation),
      ],
      currentBalances: [
        ...snapshot.collections.currentBalances,
        ...additions.map((addition) => addition.currentBalance),
      ],
      provenance: [
        ...snapshot.collections.provenance,
        ...additions.map((addition) => addition.provenance),
      ],
      sourceRecords: [
        ...snapshot.collections.sourceRecords,
        ...additions.map((addition) => addition.sourceRecord),
      ],
    },
  };
}

function withCalculatedCurrentBalance(
  snapshot: CanonicalRepositorySnapshot,
): CanonicalRepositorySnapshot {
  const observation = snapshot.collections.balanceObservations[0]!;
  const account = snapshot.collections.accounts[0]!;
  const calculated: CurrentBalance = createCurrentBalance({
    id: 'currentbalance_derived_today',
    workspaceId: snapshot.workspaceId,
    accountId: account.id,
    asOf: '2026-06-22',
    balance: { minorUnits: 0, currency: 'GBP' },
    sourceKind: 'calculated',
    authorityState: 'inferred',
    reviewState: 'not-required',
    sourceObservationId: observation.id,
    updatedAt: observedAt,
    version,
    ...(observation.provenanceId === undefined ? {} : { provenanceId: observation.provenanceId }),
  });

  return {
    ...snapshot,
    collections: {
      ...snapshot.collections,
      currentBalances: [...snapshot.collections.currentBalances, calculated],
    },
  };
}

function createBalanceRecordSet(
  snapshot: CanonicalRepositorySnapshot,
  accountId: CanonicalRepositorySnapshot['collections']['accounts'][number]['id'],
  input: Readonly<{
    amountMinor: number;
    authorityState: BalanceObservation['authorityState'];
    observationKind: BalanceObservation['observationKind'];
    reconciliationState?: BalanceObservation['reconciliationState'];
    reviewState: BalanceObservation['reviewState'];
    sourceKind: BalanceObservation['sourceKind'];
    suffix: string;
  }>,
): Readonly<{
  sourceRecord: SourceRecord;
  provenance: Provenance;
  observation: BalanceObservation;
  currentBalance: CurrentBalance;
}> {
  const sourceRecord: SourceRecord = {
    id: createSourceRecordId(`source_balance_${input.suffix}`),
    workspaceId: snapshot.workspaceId,
    kind: input.sourceKind === 'provider-reported' ? 'open-banking-row' : 'statement-row',
    authorityState: input.authorityState,
    label: `${input.suffix} balance`,
    capturedAt: observedAt,
    sourceHash: `balance:${input.suffix}`,
    version,
  };
  const observationId = `balance_${input.suffix}_observation`;
  const provenance: Provenance = {
    id: createProvenanceId(`provenance_balance_${input.suffix}`),
    workspaceId: snapshot.workspaceId,
    authorityState: input.authorityState,
    sourceRecordIds: [sourceRecord.id],
    links: [
      {
        relationship: 'evidences',
        fromId: sourceRecord.id,
        toId: observationId,
      },
    ],
    createdAt: observedAt,
    version,
  };
  const observation = createBalanceObservation({
    id: observationId,
    workspaceId: snapshot.workspaceId,
    accountId,
    observedOn: '2026-06-22',
    observedAt,
    balance: { minorUnits: input.amountMinor, currency: 'GBP' },
    source: `${input.suffix} balance`,
    sourceKind: input.sourceKind,
    observationKind: input.observationKind,
    authorityState: input.authorityState,
    reviewState: input.reviewState,
    reconciliationState: input.reconciliationState ?? 'provisional',
    sourceRecordId: sourceRecord.id,
    provenanceId: provenance.id,
    version,
  });
  const currentBalance = createCurrentBalance({
    id: `currentbalance_${input.suffix}`,
    workspaceId: snapshot.workspaceId,
    accountId,
    asOf: '2026-06-22',
    balance: observation.balance,
    sourceKind: observation.sourceKind,
    authorityState: observation.authorityState,
    reviewState: observation.reviewState,
    sourceObservationId: observation.id,
    updatedAt: observedAt,
    provenanceId: provenance.id,
    version,
  });

  return {
    sourceRecord,
    provenance,
    observation,
    currentBalance,
  };
}
