import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCandidate, classifyOutlier, readOption } from './build-owner-signoff-candidate.mjs';

test('reads inline options', () => {
  assert.equal(readOption(['--batch-ledger=one.json,two.json'], 'batch-ledger', ''), 'one.json,two.json');
  assert.equal(readOption([], 'output', 'fallback.json'), 'fallback.json');
});

test('classifies different source and native interaction kinds without approving them', () => {
  assert.deepEqual(
    classifyOutlier({ kind: 'sheet', design: { owners: [{ kind: 'screen', routeKey: 'appearance' }] } }),
    {
      code: 'interaction-kind-divergence',
      explanation: 'Shipping sheet is owned by pinned screen evidence; full-frame pixels include different interaction chrome.',
    },
  );
});

test('builds a deduplicated pending signoff row with exact evidence', () => {
  const pair = {
    fixture: 'confirmed-safe',
    nativeSurfaceKey: 'screen:plans',
    theme: 'light',
    meanAbsoluteRgbDelta: 31,
    rmsRgbDelta: 66,
    materialChangedPixelFraction: 0.61,
    outlier: true,
    outlierReasons: ['mae'],
    source: 'source.png',
    native: 'native.png',
    overlay: 'overlay.png',
    difference: 'difference.png',
  };
  const candidate = buildCandidate(
    {
      counts: { nativeShippingSurfaces: 192, surfacesWithDirectEvidence: 141 },
      entries: [
        {
          stableId: 'screen.plans',
          kind: 'screen',
          native: { routeKey: 'plans', workspace: 'personal' },
          design: { owners: [{ kind: 'screen', routeKey: 'plans' }] },
        },
      ],
    },
    [{ rankedPairs: [pair, pair] }],
    ['ledger.json'],
  );
  assert.equal(candidate.status, 'pending-owner-signoff');
  assert.equal(candidate.evidenceSummary.uniqueMeasuredPairs, 1);
  assert.equal(candidate.evidenceSummary.measuredOutlierPairs, 1);
  assert.equal(candidate.evidenceSummary.measuredOutlierSurfaces, 1);
  assert.equal(candidate.surfaces[0].ownerDecision, null);
  assert.equal(candidate.surfaces[0].classification.code, 'same-owner-content-geometry-or-raster-drift');
  assert.equal(candidate.surfaces[0].comparisons[0].overlay, 'overlay.png');
});

