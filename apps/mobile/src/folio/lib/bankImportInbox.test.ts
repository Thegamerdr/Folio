import { beforeEach, describe, expect, it } from 'vitest';
import { createWorkspaceId } from '@folio/domain';
import {
  addIgnoredBankExternalId,
  DEFAULT_ACCOUNT_ID,
  deleteBankImportedHistory,
  discardBankImportBatch,
  getPersistBlob,
  getState,
  hydrateFromBlob,
  resetToEmpty,
  setBankImportBatchMappings,
  stageBankImportBatch,
} from '../store';
import { PERSONAL_WORKSPACE_ID } from './workspaceRoot';
import { parseBankImportInbox, type BankImportBatch } from './bankImportInbox';

function receipt(id = 'delivery-1', externalId = 'provider-transaction-1'): BankImportBatch {
  return {
    id,
    workspaceId: PERSONAL_WORKSPACE_ID,
    receivedAt: '2026-09-05T12:00:00.000Z',
    accountMappings: {},
    sync: {
      connection: {
        id: 'connection-1',
        provider: 'truelayer-data-v3',
        providerLabel: 'Test Bank',
        status: 'active',
        scopes: ['accounts', 'transactions'],
        createdAt: '2026-09-05T11:00:00.000Z',
        grantedAt: '2026-09-05T11:00:00.000Z',
        expiresAt: null,
        disconnectedAt: null,
        lastSuccessfulRefreshAt: null,
        lastErrorCode: null,
        accounts: [
          {
            accountRef: 'account-1',
            label: 'Current',
            currency: 'GBP',
            kind: 'personal',
            accountType: 'current',
            lastSuccessfulRefreshAt: null,
          },
        ],
        futureAccessStopped: false,
        providerRevocationSupported: false,
      },
      candidates: [
        {
          externalId,
          connectionId: 'connection-1',
          accountRef: 'account-1',
          bookingStatus: 'posted',
          occurredAt: '2026-09-04',
          amountMinor: -12345,
          currency: 'GBP',
          description: 'Synthetic grocer',
        },
      ],
      pending: false,
      moreAvailable: false,
      directLedgerWrites: false,
    },
  };
}

beforeEach(() => resetToEmpty());

describe('durable unreviewed bank inbox', () => {
  it('round-trips a receipt and mapping without posting money, and handles exact delivery retries', () => {
    const before = getState();
    stageBankImportBatch(receipt());
    setBankImportBatchMappings('delivery-1', { 'account-1': DEFAULT_ACCOUNT_ID });
    stageBankImportBatch(receipt());
    const blob = getPersistBlob(PERSONAL_WORKSPACE_ID);
    resetToEmpty();
    hydrateFromBlob(blob, PERSONAL_WORKSPACE_ID);
    expect(getState().bankImportInbox).toHaveLength(1);
    expect(getState().bankImportInbox?.[0]?.accountMappings).toEqual({
      'account-1': DEFAULT_ACCOUNT_ID,
    });
    expect(getState().transactions).toEqual(before.transactions);
    expect(getState().accounts).toEqual(before.accounts);
    expect(getState().reviewQueue).toEqual([]);
    expect(() => stageBankImportBatch(receipt('delivery-1', 'changed-content'))).toThrow(
      /different/i,
    );
  });

  it('keeps undecided batches across refreshes but prunes only accepted or ignored receipts', () => {
    stageBankImportBatch(receipt());
    stageBankImportBatch(receipt('delivery-2', 'provider-transaction-2'));
    expect(getState().bankImportInbox).toHaveLength(2);
    addIgnoredBankExternalId('provider-transaction-1');
    stageBankImportBatch(receipt('delivery-3', 'provider-transaction-3'));
    expect(getState().bankImportInbox?.map((batch) => batch.id)).toEqual([
      'delivery-2',
      'delivery-3',
    ]);
    discardBankImportBatch('delivery-2');
    expect(getState().ignoredBankExternalIds).toContain('provider-transaction-2');
    deleteBankImportedHistory('connection-1');
    expect(getState().bankImportInbox).toEqual([]);
  });

  it('rejects wrong-workspace, invalid account mapping and oversized receipts without partial staging', () => {
    expect(() =>
      stageBankImportBatch({ ...receipt(), workspaceId: createWorkspaceId('workspace_foreign') }),
    ).toThrow(/workspace/i);
    stageBankImportBatch(receipt());
    expect(() =>
      setBankImportBatchMappings('delivery-1', { 'account-1': 'foreign-account' }),
    ).toThrow();
    const oversized = receipt('large');
    expect(() =>
      parseBankImportInbox(
        [
          {
            ...oversized,
            sync: {
              ...oversized.sync,
              candidates: [
                { ...oversized.sync.candidates[0], description: 'x'.repeat(1024 * 1024) },
              ],
            },
          },
        ],
        PERSONAL_WORKSPACE_ID,
      ),
    ).toThrow();
    expect(getState().bankImportInbox).toHaveLength(1);
    expect(getState().transactions).toHaveLength(0);
  });

  it('rejects a provider receipt above the 500-candidate delivery contract', () => {
    const base = receipt();
    const candidates = Array.from({ length: 501 }, (_, index) => ({
      ...base.sync.candidates[0],
      externalId: `provider-transaction-${index}`,
    }));
    expect(() =>
      parseBankImportInbox(
        [{ ...base, sync: { ...base.sync, candidates } }],
        PERSONAL_WORKSPACE_ID,
      ),
    ).toThrow(/delivery contract|receipt/i);
  });
});
