import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '../../..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), 'utf8'));
}

test('decision-dialog capture family is stable, exact-owned, and complete', async () => {
  const [dialogs, archetypes, captures, crosswalk] = await Promise.all([
    readJson('apps/mobile/src/folio/parity/decisionDialogs.json'),
    readJson('docs/parity-recovery/registries/parity-archetypes.json'),
    readJson('docs/parity-recovery/registries/capture-batches.json'),
    readJson('docs/parity-recovery/registries/parity-crosswalk.json'),
  ]);

  const dialogIds = Object.keys(dialogs.entries).sort();
  assert.ok(dialogIds.length >= 20 && dialogIds.length <= 40);
  assert.equal(new Set(dialogIds).size, dialogIds.length);

  const exactOwnedDecisionIds = archetypes.assignments
    .filter(
      (entry) => entry.archetypeId === 'decision-dialog' && entry.designOwnerStatus === 'resolved',
    )
    .map((entry) => entry.stableId)
    .sort();
  assert.deepEqual(dialogIds, exactOwnedDecisionIds);

  const batch = captures.batches.find((entry) => entry.id === 'non-business-decision-dialog');
  assert.ok(batch);
  assert.equal(batch.fixture, 'confirmed-safe');
  assert.equal(batch.familyId, 'decision-dialog');
  assert.equal(captures.scope.includedTriggerOnlyDialogs, dialogIds.length);
  assert.deepEqual(batch.surfaces.map((surface) => surface.id).sort(), dialogIds);

  const crosswalkById = new Map(crosswalk.entries.map((entry) => [entry.stableId, entry]));
  for (const surface of batch.surfaces) {
    const dialog = dialogs.entries[surface.id];
    const entry = crosswalkById.get(surface.id);
    assert.equal(surface.nativeStableId, surface.id);
    assert.equal(surface.nativeDialog, surface.id);
    assert.equal(surface.nativeEvidenceMode, 'capture-only-production-alert-contract');
    assert.equal(surface.sourceEvidenceMode, 'pinned-lovable-owner-context');
    assert.deepEqual(surface.themes, ['light', 'dark']);
    assert.equal(entry.native.componentSource, dialog.componentSource);
    assert.equal(entry.design.ownerStatus, 'resolved');
    assert.ok(entry.design.owners.some((owner) => owner.stableId === surface.sourceOwnerStableId));
    assert.ok(dialog.title.length > 0);
    assert.ok(dialog.buttons.length > 0);
  }
});
