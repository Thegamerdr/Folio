import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

function readOption(argv, name) {
  const prefix = `--${name}=`;
  const inline = argv.find((value) => value.startsWith(prefix));
  if (inline !== undefined) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`--${name} requires a value.`);
  return value;
}

export function parseContractLedgerOptions(argv, env, root) {
  const ledgerValue = readOption(argv, 'contract-ledger') ?? env.PARITY_CONTRACT_LEDGER;
  const expectedValue =
    readOption(argv, 'expected-direct-evidence-count') ??
    env.PARITY_EXPECTED_DIRECT_EVIDENCE_COUNT;
  if (expectedValue !== undefined && expectedValue !== '' && !/^\d+$/u.test(expectedValue)) {
    throw new Error(`Expected direct evidence count must be a non-negative integer, got ${expectedValue}.`);
  }
  return {
    ledgerPath:
      ledgerValue === undefined || ledgerValue === '' ? null : path.resolve(root, ledgerValue),
    expectedDirectEvidenceCount:
      expectedValue === undefined || expectedValue === '' ? null : Number.parseInt(expectedValue, 10),
  };
}

export async function readContractLedger(ledgerPath) {
  const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
  if (
    ledger.schemaVersion !== 1 ||
    ledger.evidenceKind !== 'production-contract-capture' ||
    !Array.isArray(ledger.surfaces)
  ) {
    throw new Error(`Unsupported production contract ledger: ${ledgerPath}`);
  }
  return ledger;
}

export async function mergeContractLedgerEvidence(
  entries,
  ledger,
  { root, assertArtifact = (absolutePath) => access(absolutePath) },
) {
  if (ledger.surfaceCount !== ledger.surfaces.length) {
    throw new Error(
      `Contract surfaceCount mismatch: declared ${ledger.surfaceCount}, found ${ledger.surfaces.length}.`,
    );
  }
  const byStableId = new Map(entries.map((entry) => [entry.stableId, entry]));
  const seen = new Set();
  let captureCount = 0;

  for (const surface of ledger.surfaces) {
    if (seen.has(surface.nativeStableId)) {
      throw new Error(`Duplicate contract surface ${surface.nativeStableId}.`);
    }
    seen.add(surface.nativeStableId);
    const entry = byStableId.get(surface.nativeStableId);
    if (!entry) throw new Error(`Contract surface ${surface.nativeStableId} is not shipping.`);
    if (entry.kind !== 'dialog') {
      throw new Error(`Contract surface ${surface.nativeStableId} is not a dialog.`);
    }
    if (!entry.design.owners.some((owner) => owner.stableId === surface.sourceOwnerStableId)) {
      throw new Error(
        `Contract owner ${surface.sourceOwnerStableId} does not own ${surface.nativeStableId}.`,
      );
    }
    if (!Array.isArray(surface.captures) || surface.captures.length !== 2) {
      throw new Error(`Contract surface ${surface.nativeStableId} must have light and dark captures.`);
    }
    const themes = new Set(surface.captures.map((capture) => capture.theme));
    if (themes.size !== 2 || !themes.has('light') || !themes.has('dark')) {
      throw new Error(`Contract surface ${surface.nativeStableId} has invalid themes.`);
    }
    await Promise.all(
      surface.captures.map((capture) => assertArtifact(path.join(root, capture.nativeFull))),
    );
    captureCount += surface.captures.length;
    entry.evidence = {
      ...entry.evidence,
      contractCaptures: surface.captures.map((capture) => ({
        provenance: 'production-contract-capture',
        familyId: surface.familyId,
        batchId: surface.batchId,
        fixture: surface.fixture,
        theme: capture.theme,
        nativeFull: capture.nativeFull,
        nativeEvidenceMode: surface.nativeEvidenceMode,
        sourceOwnerStableId: surface.sourceOwnerStableId,
      })),
      contractCaptureCount: surface.captures.length,
    };
    if (entry.evidence.comparisonCount === 0) {
      entry.finalStatus = 'direct-production-contract-evidence-recorded-not-owner-approved';
    }
  }

  if (ledger.captureCount !== captureCount) {
    throw new Error(
      `Contract captureCount mismatch: declared ${ledger.captureCount}, found ${captureCount}.`,
    );
  }
  const finalDirectEvidenceSurfaceCount = entries.filter(
    (entry) =>
      entry.evidence.comparisonCount > 0 || (entry.evidence.contractCaptures?.length ?? 0) > 0,
  ).length;
  return {
    entries,
    stats: {
      contractSurfaceCount: seen.size,
      contractCaptureCount: captureCount,
      finalDirectEvidenceSurfaceCount,
    },
  };
}
