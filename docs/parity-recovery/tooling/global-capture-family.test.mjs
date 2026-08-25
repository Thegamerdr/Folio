import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '../../..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), 'utf8'));
}

test('resolved global, screen and stack outliers have deterministic capture definitions', async () => {
  const [registry, manifest, crosswalk, nativeDriver, sourceDriver, sourceBatchDriver] =
    await Promise.all([
      readJson('apps/mobile/src/folio/parity/globalSurfaces.json'),
      readJson('docs/parity-recovery/registries/capture-batches.json'),
      readJson('docs/parity-recovery/registries/parity-crosswalk.json'),
      readFile(path.join(ROOT, 'docs/parity-recovery/tooling/capture-native-batch.mjs'), 'utf8'),
      readFile(path.join(ROOT, 'docs/parity-recovery/tooling/capture-pinned-source.mjs'), 'utf8'),
      readFile(
        path.join(ROOT, 'docs/parity-recovery/tooling/capture-pinned-source-batch.mjs'),
        'utf8',
      ),
    ]);
  const entries = Object.entries(registry.entries);
  const ids = entries.map(([id]) => id).sort();
  const expectedIds = crosswalk.entries
    .filter(
      (entry) =>
        ['global-state', 'screen', 'stack-route'].includes(entry.kind) &&
        entry.design.ownerStatus === 'resolved' &&
        entry.native.workspace !== 'business' &&
        (entry.kind !== 'screen' ||
          ['screen.start', 'screen.review-item'].includes(entry.stableId)),
    )
    .map((entry) => entry.stableId)
    .sort();
  assert.equal(ids.length, 11);
  assert.deepEqual(ids, expectedIds);

  const crosswalkById = new Map(crosswalk.entries.map((entry) => [entry.stableId, entry]));
  for (const [id, definition] of entries) {
    const entry = crosswalkById.get(id);
    assert.ok(entry);
    assert.equal(entry.evidence.comparisonCount, 0);
    assert.equal(entry.finalStatus, 'missing-direct-visual-comparison');
    assert.equal(definition.componentSource, entry.native.componentSource);
    assert.ok(definition.ownerContext.sourceScreen);
    assert.ok(definition.ownerContext.nativeScreen);
  }

  const globalBatch = manifest.batches.find(
    (batch) => batch.id === 'non-business-global-and-stack',
  );
  assert.ok(globalBatch);
  assert.equal(globalBatch.surfaces.length, 9);
  assert.equal(manifest.scope.includedGlobalAndStackSurfaces, 9);
  assert.deepEqual(
    globalBatch.surfaces.map((surface) => surface.id).sort(),
    ids.filter((id) => !id.startsWith('screen.')),
  );
  for (const surface of globalBatch.surfaces) {
    assert.equal(surface.nativeStableId, surface.id);
    assert.ok(surface.sourceOwnerStableId);
    assert.deepEqual(surface.themes, ['light', 'dark']);
  }

  const allSurfaces = manifest.batches.flatMap((batch) => batch.surfaces);
  for (const id of ['screen.start', 'screen.review-item']) {
    assert.ok(allSurfaces.some((surface) => surface.nativeStableId === id));
  }

  assert.match(nativeDriver, /EXPO_PUBLIC_MELO_PARITY_GLOBAL/u);
  assert.match(nativeDriver, /global=\$\{encodeURIComponent\(globalSurface\)\}/u);
  assert.match(nativeDriver, /"globalSurface":\$\{expectedGlobal\}/u);
  assert.match(sourceBatchDriver, /--global=\$\{job\.globalSurface\}/u);
  assert.match(sourceBatchDriver, /readArg\('batch', ''\)/u);
  assert.match(sourceBatchDriver, /batchFilters\.has\(batch\.id\)/u);
  for (const sourceGlobal of [
    'boot-splash',
    'persistence-degraded',
    'screen-error',
    'toast',
    'undo-toast',
    'stack-index',
  ]) {
    assert.match(sourceDriver, new RegExp(`captureGlobal === '${sourceGlobal}'`, 'u'));
  }
});
