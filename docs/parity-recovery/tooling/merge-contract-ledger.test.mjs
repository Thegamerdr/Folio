import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  mergeContractLedgerEvidence,
  parseContractLedgerOptions,
} from './merge-contract-ledger.mjs';

function entry(stableId, ownerStableId) {
  return {
    stableId,
    kind: 'dialog',
    design: { owners: [{ stableId: ownerStableId }] },
    evidence: { comparisonCount: 0, differenceImages: [] },
    finalStatus: 'missing-direct-visual-comparison',
  };
}

function ledger() {
  return {
    schemaVersion: 1,
    evidenceKind: 'production-contract-capture',
    surfaceCount: 1,
    captureCount: 2,
    surfaces: [
      {
        nativeStableId: 'dialog.example',
        sourceOwnerStableId: 'screen:example',
        familyId: 'status-dialog',
        batchId: 'status',
        fixture: 'confirmed-safe',
        nativeEvidenceMode: 'centralized-production-status-contract',
        captures: [
          { theme: 'light', nativeFull: 'evidence/light.png' },
          { theme: 'dark', nativeFull: 'evidence/dark.png' },
        ],
      },
    ],
  };
}

test('parses contract ledger controls', () => {
  const root = path.resolve('C:/repo');
  assert.deepEqual(
    parseContractLedgerOptions(
      ['--contract-ledger=contract.json', '--expected-direct-evidence-count', '141'],
      {},
      root,
    ),
    {
      ledgerPath: path.resolve(root, 'contract.json'),
      expectedDirectEvidenceCount: 141,
    },
  );
});

test('merges two-theme production contract evidence without claiming a pixel pair', async () => {
  const merged = await mergeContractLedgerEvidence(
    [entry('dialog.example', 'screen:example')],
    ledger(),
    { root: 'C:/repo', assertArtifact: async () => {} },
  );
  assert.equal(merged.stats.contractSurfaceCount, 1);
  assert.equal(merged.stats.contractCaptureCount, 2);
  assert.equal(merged.stats.finalDirectEvidenceSurfaceCount, 1);
  assert.equal(merged.entries[0].evidence.comparisonCount, 0);
  assert.equal(merged.entries[0].evidence.contractCaptures.length, 2);
  assert.equal(
    merged.entries[0].finalStatus,
    'direct-production-contract-evidence-recorded-not-owner-approved',
  );
});

test('rejects owner drift', async () => {
  await assert.rejects(
    mergeContractLedgerEvidence([entry('dialog.example', 'screen:other')], ledger(), {
      root: 'C:/repo',
      assertArtifact: async () => {},
    }),
    /does not own/,
  );
});
