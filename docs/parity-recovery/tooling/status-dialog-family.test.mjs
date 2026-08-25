import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '../../..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), 'utf8'));
}

test('all shipping status dialogs use one owner-aware production contract', async () => {
  const [contracts, archetypes, captures, crosswalk, helperSource] = await Promise.all([
    readJson('apps/mobile/src/folio/parity/statusDialogs.json'),
    readJson('docs/parity-recovery/registries/parity-archetypes.json'),
    readJson('docs/parity-recovery/registries/capture-batches.json'),
    readJson('docs/parity-recovery/registries/parity-crosswalk.json'),
    readFile(path.join(ROOT, 'apps/mobile/src/folio/ui/statusDialogs.ts'), 'utf8'),
  ]);
  const ids = Object.keys(contracts.entries).sort();
  const assignmentIds = archetypes.assignments
    .filter((entry) => entry.archetypeId === 'status-dialog')
    .map((entry) => entry.stableId)
    .sort();
  assert.equal(ids.length, 38);
  assert.deepEqual(ids, assignmentIds);
  assert.deepEqual(archetypes.executionPolicy.statusFamilyCapture.sharedAction, {
    text: 'Done',
    style: 'cancel',
    cancelable: true,
  });
  assert.match(helperSource, /\{ text: 'Done', style: 'cancel', onPress: options\.onDone \}/u);
  assert.match(helperSource, /\{ cancelable: true \}/u);

  const crosswalkById = new Map(crosswalk.entries.map((entry) => [entry.stableId, entry]));
  const files = new Set(
    Object.values(contracts.entries).map((contract) => contract.componentSource.split(':')[0]),
  );
  const callCounts = new Map(ids.map((id) => [id, 0]));
  for (const file of files) {
    const source = await readFile(path.join(ROOT, file), 'utf8');
    for (const match of source.matchAll(/showStatusDialog\(\s*['"]([^'"]+)['"]/gu)) {
      if (callCounts.has(match[1])) callCounts.set(match[1], callCounts.get(match[1]) + 1);
    }
  }
  assert.deepEqual(
    [...callCounts.entries()].filter(([, count]) => count !== 1),
    [],
  );

  const resolvedIds = [];
  for (const id of ids) {
    const contract = contracts.entries[id];
    const entry = crosswalkById.get(id);
    assert.ok(contract.title.length > 0);
    assert.ok(contract.message === null || contract.message.length > 0);
    assert.ok(entry);
    if (entry.design.ownerStatus === 'resolved') {
      resolvedIds.push(id);
      const ownerRoute = contract.ownerContext.sourceSheet ?? contract.ownerContext.sourceScreen;
      assert.ok(entry.design.owners.some((owner) => owner.routeKey === ownerRoute));
    } else {
      assert.equal(entry.design.ownerStatus, 'true-exception');
    }
  }

  const batch = captures.batches.find((entry) => entry.id === 'non-business-status-dialog');
  assert.ok(batch);
  assert.equal(batch.familyId, 'status-dialog');
  assert.deepEqual(batch.surfaces.map((surface) => surface.id).sort(), resolvedIds.sort());
  for (const surface of batch.surfaces) {
    assert.equal(surface.nativeStableId, surface.id);
    assert.equal(surface.nativeDialog, surface.id);
    assert.equal(surface.nativeEvidenceMode, 'centralized-production-status-contract');
    assert.ok(surface.sourceOwnerStableId);
    assert.deepEqual(surface.themes, ['light', 'dark']);
  }
});
