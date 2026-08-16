import { createWorkspaceId } from '@folio/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  acknowledgePendingAppStateCommands,
  clearPendingAppStateCommands,
  createPendingAppStateCommand,
  enqueuePendingAppStateCommand,
  snapshotPendingAppStateCommands,
} from './typedCommandBridge.js';

const personal = createWorkspaceId('workspace_personal_typed_command_test');
const business = createWorkspaceId('workspace_business_typed_command_test');

beforeEach(() => clearPendingAppStateCommands());

describe('AppState typed-command bridge', () => {
  it('retains only compact checksums and command metadata, never raw financial values', () => {
    const receipt = createPendingAppStateCommand({
      commandType: 'folio.transaction.record.v1',
      workspaceId: personal,
      actorKind: 'user',
      entityRefs: [{ type: 'transaction', id: 'txn-private-test' }],
      before: {},
      after: {
        transaction: {
          merchant: 'Coffee House Private',
          amount: -42.15,
          category: 'food',
        },
      },
      invalidatedProjectionKinds: ['cashflow'],
      occurredAt: '2026-07-16T12:00:00.000Z',
    });

    const serialized = JSON.stringify(receipt);
    expect(serialized).not.toContain('Coffee House Private');
    expect(serialized).not.toContain('-42.15');
    expect(serialized).not.toContain('food');
    expect(receipt.audit.delta).toMatchObject({
      fields: [{ field: 'transaction', state: 'added' }],
    });
  });

  it('isolates workspace queues and acknowledges only the exact durable snapshot', () => {
    const first = createPendingAppStateCommand({
      commandType: 'folio.balance.set_current.v1',
      workspaceId: personal,
      actorKind: 'user',
      entityRefs: [{ type: 'account', id: 'account-one' }],
    });
    const later = createPendingAppStateCommand({
      commandType: 'folio.transaction.record.v1',
      workspaceId: personal,
      actorKind: 'melo',
      entityRefs: [{ type: 'transaction', id: 'transaction-later' }],
    });
    const otherWorkspace = createPendingAppStateCommand({
      commandType: 'folio.balance.set_current.v1',
      workspaceId: business,
      actorKind: 'user',
      entityRefs: [{ type: 'account', id: 'business-account' }],
    });
    enqueuePendingAppStateCommand(first);
    const saveSnapshot = snapshotPendingAppStateCommands(personal);
    enqueuePendingAppStateCommand(later);
    enqueuePendingAppStateCommand(otherWorkspace);

    acknowledgePendingAppStateCommands(
      personal,
      saveSnapshot.map((receipt) => receipt.id),
    );

    expect(snapshotPendingAppStateCommands(personal).map((receipt) => receipt.id)).toEqual([
      later.id,
    ]);
    expect(snapshotPendingAppStateCommands(business).map((receipt) => receipt.id)).toEqual([
      otherWorkspace.id,
    ]);
  });

  it('rejects duplicate receipt enqueueing', () => {
    const receipt = createPendingAppStateCommand({
      commandType: 'folio.transaction.remove.v1',
      workspaceId: personal,
      actorKind: 'user',
      entityRefs: [{ type: 'transaction', id: 'transaction-one' }],
    });
    enqueuePendingAppStateCommand(receipt);
    expect(() => enqueuePendingAppStateCommand(receipt)).toThrow(/already queued/i);
  });
});
