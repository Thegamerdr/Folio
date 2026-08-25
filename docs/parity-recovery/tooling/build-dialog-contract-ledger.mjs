#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readOption(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const inline = process.argv.slice(2).find((value) => value.startsWith(prefix));
  if (inline !== undefined) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? fallback : process.argv[index + 1];
}

const nativeRef = readOption('native-ref');
if (!nativeRef) throw new Error('--native-ref is required.');
const manifestPath = path.resolve(
  ROOT,
  readOption('manifest', 'docs/parity-recovery/registries/capture-batches.json'),
);
const batchIds = readOption(
  'batch',
  'non-business-decision-dialog,non-business-status-dialog',
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const harnessRelative = `docs/parity-recovery/evidence/native/harness-${nativeRef}`;
const harnessPath = path.join(ROOT, harnessRelative);
const outputPath = path.resolve(
  ROOT,
  readOption('output', `${harnessRelative}/dialog-contract-ledger.json`),
);

const [manifest, captureRun] = await Promise.all([
  readFile(manifestPath, 'utf8').then(JSON.parse),
  readFile(path.join(harnessPath, 'capture-run.json'), 'utf8').then(JSON.parse),
]);
if (captureRun.nativeRef !== nativeRef) {
  throw new Error(`Capture run ref ${captureRun.nativeRef} does not match ${nativeRef}.`);
}

const batchesById = new Map(manifest.batches.map((batch) => [batch.id, batch]));
const surfaces = [];
for (const batchId of batchIds) {
  const batch = batchesById.get(batchId);
  if (!batch) throw new Error(`Unknown capture batch ${batchId}.`);
  for (const surface of batch.surfaces) {
    const captures = [];
    for (const theme of surface.themes) {
      const nativeFull = `${harnessRelative}/${batch.fixture}/${theme}/${surface.id}/native-full-1080x2220.png`;
      await access(path.join(ROOT, nativeFull));
      captures.push({ theme, nativeFull });
    }
    surfaces.push({
      nativeStableId: surface.nativeStableId,
      sourceOwnerStableId: surface.sourceOwnerStableId,
      familyId: batch.familyId,
      batchId,
      fixture: batch.fixture,
      nativeEvidenceMode: surface.nativeEvidenceMode,
      captures,
    });
  }
}

const ledger = {
  schemaVersion: 1,
  evidenceKind: 'production-contract-capture',
  nativeSha: captureRun.nativeSha,
  nativeRef,
  batchIds,
  surfaceCount: surfaces.length,
  captureCount: surfaces.reduce((count, surface) => count + surface.captures.length, 0),
  surfaces,
};
await writeFile(outputPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
console.log(
  `Production contract ledger complete: ${ledger.surfaceCount} surfaces, ${ledger.captureCount} captures.`,
);
