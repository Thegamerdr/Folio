import { describe, expect, it } from 'vitest';

import {
  buildPhase10CloudSyncEvidence,
  defaultPhase10CloudSyncEvidence,
  phase10ProofRows,
  phase10RowsByState,
} from './cloudSyncEvidence';

describe('Phase 10 cloud sync evidence', () => {
  it('uses synthetic local-shell metadata without real account or cloud claims', () => {
    expect(defaultPhase10CloudSyncEvidence.metadata).toMatchObject({
      phase: 'phase10',
      slice: 'cloud-account-encrypted-backup-sync',
      sourceLabel: 'Synthetic sample',
      modelRequired: false,
      networkRequiredForShell: false,
      cloudRequiredForLocalCore: false,
      accountRequiredForLocalCore: false,
      realCloudConnected: false,
      realAccountSession: false,
      realData: false,
      serverBlindRestoreProven: false,
      externalDeletionRouteLive: false,
      independentPenTestPassed: false,
      encryptedBackupSyncBetaReady: false,
    });
  });

  it('proves local opt-in shape while carrying real provider and recovery blockers', () => {
    const shell = defaultPhase10CloudSyncEvidence;

    expect(shell.account.localVaultUsableSignedOut).toBe(true);
    expect(shell.account.accountOnlyWhenCloudSelected).toBe(true);
    expect(shell.account.releaseBlocked).toBe(true);
    expect(shell.keyHierarchy.serverReceivesUnwrappedKey).toBe(false);
    expect(shell.recovery.blockers).toEqual(['clean-device restore test has not passed']);
    expect(shell.metadata.passkeyProviderConnected).toBe(false);
  });

  it('keeps server-visible sync payloads ciphertext-only', () => {
    const shell = defaultPhase10CloudSyncEvidence;

    expect(shell.outbox.uploadContractAccepted).toBe(true);
    expect(shell.outbox.backendPayloadCiphertextOnly).toBe(true);
    expect(shell.inbox.acceptedCount).toBe(1);
    expect(shell.inbox.duplicateCount).toBe(1);
    expect(shell.inbox.malformedCount).toBe(1);
  });

  it('models deterministic conflicts and safe compaction before real drills', () => {
    const shell = defaultPhase10CloudSyncEvidence;

    expect(shell.conflicts.noUniversalLastWriteWins).toBe(true);
    expect(shell.conflicts.noSilentFinancialLoss).toBe(true);
    expect(shell.compaction.canCompact).toBe(true);
    expect(shell.conflictSuite.releaseBlocked).toBe(true);
    expect(shell.conflictSuite.blockers).toContain('encrypted_restore_clean_device is blocked');
  });

  it('keeps account deletion, pen-test and beta release blocked', () => {
    const shell = defaultPhase10CloudSyncEvidence;

    expect(shell.deletionPortal.releaseBlocked).toBe(true);
    expect(shell.deletionPortal.blockers).toContain(
      'required web account-deletion route is not configured',
    );
    expect(shell.securityReview.releaseBlocked).toBe(true);
    expect(shell.beta.ready).toBe(false);
    expect(shell.blockerRows.length).toBeGreaterThan(8);
  });

  it('exports stable Phase 10 proof rows for the gate panel', () => {
    expect(phase10ProofRows).toHaveLength(15);
    expect(phase10ProofRows.map((row) => row.label)).toEqual([
      'T134 Optional account/auth',
      'T135 Crypto key hierarchy',
      'T136 Recovery setup',
      'T137 Cloud device registry',
      'T138 Encrypted outbox envelopes',
      'T139 Inbox apply pipeline',
      'T140 Conflict policies',
      'T141 Encrypted backup snapshots',
      'T142 Compaction ack cursors',
      'T143 Device/recovery manager UI',
      'T144 Web account-deletion portal',
      'T145 Cloud data inventory/status',
      'T146 Multi-device offline conflict suite',
      'T147 Cloud vault/auth/sync pen-test',
      'T148 Encrypted backup/sync beta',
    ]);
    expect(phase10RowsByState(defaultPhase10CloudSyncEvidence.coverageRows, 'blocked')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: 'T147' }),
        expect.objectContaining({ taskId: 'T148' }),
      ]),
    );
  });

  it('is deterministic', () => {
    expect(buildPhase10CloudSyncEvidence()).toEqual(defaultPhase10CloudSyncEvidence);
  });
});
