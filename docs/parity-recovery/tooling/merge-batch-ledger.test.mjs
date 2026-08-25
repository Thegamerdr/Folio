import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { mergeBatchLedgerEvidence, parseBatchLedgerOptions } from './merge-batch-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function emptyEvidence() {
  return {
    lightSource: null,
    darkSource: null,
    lightNative: null,
    darkNative: null,
    lightOverlay: null,
    darkOverlay: null,
    differenceImages: [],
    comparisonCount: 0,
  };
}

function entry(stableId, kind, routeKey, evidence = emptyEvidence()) {
  return {
    stableId,
    kind,
    native: { routeKey },
    evidence,
    finalStatus: 'missing-direct-visual-comparison',
  };
}

function row(overrides) {
  const fixture = overrides.fixture ?? 'confirmed-safe';
  const theme = overrides.theme ?? 'light';
  const screen = overrides.screen;
  const base = `docs/parity-recovery/evidence`;
  return {
    batchId: 'test-batch',
    fixture,
    screen,
    nativeKind: overrides.nativeKind ?? 'screen',
    nativeRoute: overrides.nativeRoute ?? screen,
    nativeStableId: overrides.nativeStableId ?? null,
    nativeScreen: overrides.nativeScreen ?? screen,
    nativeSheet: overrides.nativeSheet ?? null,
    theme,
    meanAbsoluteRgbDelta: 4,
    rmsRgbDelta: 8,
    changedPixelFraction: 0.1,
    materialChangedPixelFraction: 0.04,
    outlier: false,
    outlierReasons: [],
    source: `${base}/design/ad90b4-matched-v1/${fixture}/${theme}/${screen}/source-product-1080x2004.png`,
    native: `${base}/native/harness-abc1234/${fixture}/${theme}/${screen}/native-product-1080x2004.png`,
    overlay: `${base}/comparisons/abc1234/${fixture}/${theme}/${screen}/overlay-50.png`,
    difference: `${base}/comparisons/abc1234/${fixture}/${theme}/${screen}/absolute-difference.png`,
  };
}

test('parses optional CLI and environment batch-ledger controls', () => {
  const root = path.resolve('C:/repo');
  assert.deepEqual(
    parseBatchLedgerOptions(
      ['--batch-ledger', 'evidence/batch-ledger.json', '--expected-direct-count=80'],
      {},
      root,
    ),
    {
      ledgerPath: path.resolve(root, 'evidence/batch-ledger.json'),
      expectedDirectCount: 80,
    },
  );
  assert.equal(
    parseBatchLedgerOptions([], { PARITY_BATCH_LEDGER: 'ledger.json' }, root).ledgerPath,
    path.resolve(root, 'ledger.json'),
  );
  assert.throws(
    () => parseBatchLedgerOptions(['--expected-direct-count=nope'], {}, root),
    /non-negative integer/,
  );
});

test('merges evidence, preserves accepted overlap, replaces prior batches and deduplicates', async () => {
  const acceptedToday = {
    ...emptyEvidence(),
    lightSource:
      'docs/parity-recovery/evidence/design/ad90b4-matched-v1/confirmed-safe/light/today/source-product-1080x2004.png',
    lightNative:
      'docs/parity-recovery/evidence/native/harness-accepted/confirmed-safe/light/today/native-product-1080x2004.png',
    lightOverlay:
      'docs/parity-recovery/evidence/comparisons/accepted/confirmed-safe/light/today/overlay-50.png',
    differenceImages: [
      'docs/parity-recovery/evidence/comparisons/accepted/confirmed-safe/light/today/absolute-difference.png',
    ],
    comparisonCount: 1,
  };
  const todayRow = row({ screen: 'today' });
  const appearanceLight = row({
    screen: 'appearance',
    nativeKind: 'sheet',
    nativeRoute: 'appearance',
    nativeScreen: 'more',
    nativeSheet: 'appearance',
  });
  const appearanceDark = row({
    screen: 'appearance',
    theme: 'dark',
    nativeKind: 'sheet',
    nativeRoute: 'appearance',
    nativeScreen: 'more',
    nativeSheet: 'appearance',
  });
  delete appearanceDark.materialChangedPixelFraction;
  const staleAppearance = {
    ...emptyEvidence(),
    comparisons: [
      {
        provenance: 'batch-ledger',
        fixture: 'confirmed-safe',
        theme: 'light',
        source: appearanceLight.source,
        native: appearanceLight.native.replace('harness-abc1234', 'harness-older'),
        overlay: appearanceLight.overlay.replace('comparisons/abc1234', 'comparisons/older'),
        difference: appearanceLight.difference.replace('comparisons/abc1234', 'comparisons/older'),
        metrics: {
          meanAbsoluteRgbDelta: 12,
          rmsRgbDelta: 24,
          changedPixelFraction: 0.2,
        },
        outlier: true,
        outlierReasons: ['mae'],
        batchId: 'older-batch',
      },
    ],
    comparisonCount: 1,
  };
  const ledger = {
    schemaVersion: 1,
    nativeSha: 'abc1234'.padEnd(40, 'f'),
    nativeRef: 'abc1234',
    pairCount: 4,
    surfaceCount: 2,
    directSurfaceCount: 2,
    rankedPairs: [todayRow, { ...todayRow }, appearanceLight, appearanceDark],
  };
  const checked = [];
  const merged = await mergeBatchLedgerEvidence(
    [
      entry('screen.today', 'screen', 'today', acceptedToday),
      entry('sheet.appearance', 'sheet', 'appearance', staleAppearance),
    ],
    ledger,
    {
      root: path.resolve('C:/repo'),
      assertArtifact: async (artifact) => checked.push(artifact),
    },
  );

  assert.deepEqual(merged.stats, {
    ledgerPairCount: 4,
    uniqueBatchPairCount: 3,
    duplicatePairCount: 1,
    batchStableSurfaceCount: 2,
    preservedOverlapCount: 1,
    replacedComparisonCount: 1,
    addedComparisonCount: 1,
    finalDirectSurfaceCount: 2,
  });
  assert.equal(checked.length, 12);
  const today = merged.entries.find((candidate) => candidate.stableId === 'screen.today');
  assert.equal(today.evidence.lightNative, acceptedToday.lightNative);
  assert.equal(today.evidence.comparisonCount, 1);
  const appearance = merged.entries.find((candidate) => candidate.stableId === 'sheet.appearance');
  assert.equal(appearance.evidence.comparisonCount, 2);
  assert.equal(appearance.evidence.comparisons[0].provenance, 'batch-ledger');
  assert.equal(appearance.evidence.comparisons[0].metrics.materialChangedPixelFraction, 0.04);
  assert.equal(
    Object.hasOwn(appearance.evidence.comparisons[1].metrics, 'materialChangedPixelFraction'),
    false,
  );
  assert.equal(appearance.evidence.lightNative, appearanceLight.native);
  assert.equal(appearance.evidence.darkNative, appearanceDark.native);
  assert.equal(appearance.finalStatus, 'calibration-evidence-recorded-not-owner-approved');
});

test('rejects ledger count drift and unmapped native routes', async () => {
  const oneRow = row({ screen: 'missing' });
  const baseLedger = {
    schemaVersion: 1,
    nativeSha: 'abc1234'.padEnd(40, 'f'),
    nativeRef: 'abc1234',
    pairCount: 1,
    surfaceCount: 1,
    rankedPairs: [oneRow],
  };
  await assert.rejects(
    mergeBatchLedgerEvidence([], { ...baseLedger, pairCount: 2 }, { root: 'C:/repo' }),
    /pairCount mismatch/,
  );
  await assert.rejects(
    mergeBatchLedgerEvidence(
      [],
      { ...baseLedger, rankedPairs: [{ ...oneRow, materialChangedPixelFraction: -0.01 }] },
      { root: 'C:/repo' },
    ),
    /invalid materialChangedPixelFraction/,
  );
  await assert.rejects(
    mergeBatchLedgerEvidence([], baseLedger, { root: 'C:/repo' }),
    /does not map/,
  );
  await assert.rejects(
    mergeBatchLedgerEvidence(
      [entry('screen.missing', 'screen', 'missing')],
      { ...baseLedger, directSurfaceCount: 2 },
      { root: 'C:/repo', assertArtifact: async () => {} },
    ),
    /directSurfaceCount mismatch/,
  );
});

test('maps every declared capture-batch surface to one shipping crosswalk entry', async () => {
  const [manifest, crosswalk] = await Promise.all(
    [
      'docs/parity-recovery/registries/capture-batches.json',
      'docs/parity-recovery/registries/parity-crosswalk.json',
    ].map((relativePath) => readFile(path.join(ROOT, relativePath), 'utf8').then(JSON.parse)),
  );
  const rankedPairs = manifest.batches.flatMap((batch) =>
    batch.surfaces.flatMap((surface) => {
      const screen = surface.id ?? surface.screen;
      const nativeSheet = surface.nativeSheet ?? surface.sheet ?? null;
      const nativeKind = nativeSheet ? 'sheet' : 'screen';
      const nativeRoute = nativeSheet ?? surface.nativeScreen ?? surface.screen;
      return (surface.themes ?? ['light', 'dark']).map((theme) =>
        row({
          fixture: batch.fixture,
          screen,
          theme,
          nativeKind,
          nativeRoute,
          nativeStableId: surface.nativeStableId ?? null,
          nativeScreen: surface.nativeScreen ?? surface.screen,
          nativeSheet,
        }),
      );
    }),
  );
  const nativeSurfaceKeys = new Set(
    rankedPairs.map(
      (candidate) => candidate.nativeStableId ?? `${candidate.nativeKind}:${candidate.nativeRoute}`,
    ),
  );
  const ledger = {
    schemaVersion: 1,
    nativeSha: 'abc1234'.padEnd(40, 'f'),
    nativeRef: 'abc1234',
    pairCount: rankedPairs.length,
    surfaceCount: new Set(
      rankedPairs.map((candidate) => `${candidate.fixture}\u0000${candidate.screen}`),
    ).size,
    directSurfaceCount: nativeSurfaceKeys.size,
    directSurfaceKeys: [...nativeSurfaceKeys].sort(),
    rankedPairs: rankedPairs.map((candidate) => ({
      ...candidate,
      nativeSurfaceKey:
        candidate.nativeStableId ?? `${candidate.nativeKind}:${candidate.nativeRoute}`,
    })),
  };

  const merged = await mergeBatchLedgerEvidence(crosswalk.entries, ledger, {
    root: ROOT,
    assertArtifact: async () => {},
  });
  assert.equal(
    merged.stats.batchStableSurfaceCount,
    manifest.scope.includedNonBusinessSurfaces + manifest.scope.includedBusinessFamilySurfaces,
  );
  assert.equal(merged.stats.batchStableSurfaceCount, nativeSurfaceKeys.size);
  const previouslyEvidenced = new Set(
    crosswalk.entries
      .filter((candidate) => candidate.evidence.comparisonCount > 0)
      .map((candidate) => candidate.stableId),
  );
  const expectedMergedSurfaceCount = new Set([
    ...previouslyEvidenced,
    ...merged.entries
      .filter((candidate) =>
        candidate.evidence.comparisons?.some((pair) => pair.provenance === 'batch-ledger'),
      )
      .map((candidate) => candidate.stableId),
  ]).size;
  assert.equal(merged.stats.finalDirectSurfaceCount, expectedMergedSurfaceCount);
});
