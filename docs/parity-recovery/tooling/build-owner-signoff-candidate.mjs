#!/usr/bin/env node

/**
 * Turn measured comparison ledgers into an owner-reviewable sign-off candidate.
 *
 * This intentionally does not approve a visual deviation. It proves that every measured outlier
 * is accounted for, links the exact source/native/difference artifacts, and records whether the
 * native surface and its pinned design owner use the same interaction kind.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../../..');

export function readOption(argv, name, fallback) {
  const prefix = `--${name}=`;
  const value = argv.find((argument) => argument.startsWith(prefix));
  return value === undefined ? fallback : value.slice(prefix.length);
}

function stableIdForPair(pair) {
  if (typeof pair.nativeStableId === 'string' && pair.nativeStableId.length > 0) {
    return pair.nativeStableId;
  }
  const key = pair.nativeSurfaceKey;
  if (typeof key !== 'string' || !key.includes(':')) {
    throw new Error(`Comparison pair has no stable native identity: ${JSON.stringify(pair)}`);
  }
  const separator = key.indexOf(':');
  return `${key.slice(0, separator)}.${key.slice(separator + 1)}`;
}

export function classifyOutlier(entry) {
  const ownerKinds = [...new Set((entry.design?.owners ?? []).map((owner) => owner.kind))];
  const ownerRouteKeys = [
    ...new Set((entry.design?.owners ?? []).map((owner) => owner.routeKey).filter(Boolean)),
  ];
  if (ownerKinds.length > 0 && !ownerKinds.includes(entry.kind)) {
    return {
      code: 'interaction-kind-divergence',
      explanation: `Shipping ${entry.kind} is owned by pinned ${ownerKinds.join('/')} evidence; full-frame pixels include different interaction chrome.`,
    };
  }
  if (ownerRouteKeys.length > 0 && !ownerRouteKeys.includes(entry.native?.routeKey)) {
    return {
      code: 'family-owner-route-divergence',
      explanation: `Shipping route ${entry.native?.routeKey ?? entry.stableId} uses family-owner evidence from ${ownerRouteKeys.join(', ')}.`,
    };
  }
  return {
    code: 'same-owner-content-geometry-or-raster-drift',
    explanation:
      'Shipping surface and pinned design owner share an identity; the artifacts require owner review for content, geometry, material, typography, or platform raster differences.',
  };
}

export function buildCandidate(crosswalk, ledgers, ledgerPaths) {
  if (!Array.isArray(crosswalk.entries)) throw new Error('Crosswalk entries are missing.');
  const byStableId = new Map(crosswalk.entries.map((entry) => [entry.stableId, entry]));
  const uniquePairs = new Map();

  for (const ledger of ledgers) {
    if (!Array.isArray(ledger.rankedPairs)) throw new Error('Batch ledger rankedPairs are missing.');
    for (const pair of ledger.rankedPairs) {
      const stableId = stableIdForPair(pair);
      const key = `${stableId}:${pair.fixture}:${pair.theme}`;
      uniquePairs.set(key, { ...pair, stableId });
    }
  }

  const outlierPairs = [...uniquePairs.values()].filter((pair) => pair.outlier === true);
  const grouped = new Map();
  for (const pair of outlierPairs) {
    const entry = byStableId.get(pair.stableId);
    if (entry === undefined) throw new Error(`Outlier does not map to crosswalk: ${pair.stableId}.`);
    const row = grouped.get(pair.stableId) ?? {
      stableId: pair.stableId,
      kind: entry.kind,
      routeKey: entry.native?.routeKey ?? null,
      workspace: entry.native?.workspace ?? null,
      designOwners: entry.design?.owners ?? [],
      classification: classifyOutlier(entry),
      status: 'pending-owner-signoff',
      ownerDecision: null,
      comparisons: [],
    };
    row.comparisons.push({
      fixture: pair.fixture,
      theme: pair.theme,
      metrics: {
        meanAbsoluteRgbDelta: pair.meanAbsoluteRgbDelta,
        rmsRgbDelta: pair.rmsRgbDelta,
        materialChangedPixelFraction: pair.materialChangedPixelFraction,
      },
      reasons: pair.outlierReasons ?? [],
      source: pair.source,
      native: pair.native,
      overlay: pair.overlay,
      difference: pair.difference,
    });
    grouped.set(pair.stableId, row);
  }

  const surfaces = [...grouped.values()].sort((left, right) =>
    left.stableId.localeCompare(right.stableId),
  );
  const byKind = Object.fromEntries(
    [...new Set(surfaces.map((surface) => surface.kind))]
      .sort()
      .map((kind) => [kind, surfaces.filter((surface) => surface.kind === kind).length]),
  );
  const byClassification = Object.fromEntries(
    [...new Set(surfaces.map((surface) => surface.classification.code))]
      .sort()
      .map((code) => [
        code,
        surfaces.filter((surface) => surface.classification.code === code).length,
      ]),
  );

  return {
    schemaVersion: 1,
    status: outlierPairs.length === 0 ? 'no-measured-outliers' : 'pending-owner-signoff',
    source: {
      crosswalk: 'docs/parity-recovery/registries/parity-crosswalk.json',
      batchLedgers: ledgerPaths,
    },
    evidenceSummary: {
      shippingSurfaces: crosswalk.counts?.nativeShippingSurfaces ?? crosswalk.entries.length,
      surfacesWithDirectEvidence: crosswalk.counts?.surfacesWithDirectEvidence ?? null,
      uniqueMeasuredPairs: uniquePairs.size,
      measuredOutlierPairs: outlierPairs.length,
      measuredOutlierSurfaces: surfaces.length,
      measuredCleanPairs: uniquePairs.size - outlierPairs.length,
      outlierSurfacesByKind: byKind,
      outlierSurfacesByClassification: byClassification,
    },
    signoffPolicy: {
      automatedPixelThresholdIsDiagnosticNotApproval: true,
      pendingDoesNotMeanAccepted: true,
      ownerMustInspectLinkedArtifacts: true,
      allowedOwnerDecisions: ['accept-measured-deviation', 'reject-and-return-for-fix'],
    },
    surfaces,
  };
}

export function renderMarkdown(candidate) {
  const lines = [
    '# Melo visual owner-signoff candidate',
    '',
    `Status: **${candidate.status}**`,
    '',
    `Direct evidence: ${candidate.evidenceSummary.surfacesWithDirectEvidence}/${candidate.evidenceSummary.shippingSurfaces} shipping surfaces.`,
    '',
    `Measured comparisons: ${candidate.evidenceSummary.uniqueMeasuredPairs}; clean: ${candidate.evidenceSummary.measuredCleanPairs}; outlier theme-pairs: ${candidate.evidenceSummary.measuredOutlierPairs}; outlier surfaces: ${candidate.evidenceSummary.measuredOutlierSurfaces}.`,
    '',
    'No deviation is approved by this document. For each row, inspect the linked overlay and absolute difference, then record either `accept-measured-deviation` or `reject-and-return-for-fix` in the JSON candidate.',
    '',
    '| Surface | Classification | Themes | Evidence |',
    '| --- | --- | --- | --- |',
  ];
  for (const surface of candidate.surfaces) {
    const themes = surface.comparisons.map((comparison) => comparison.theme).join(', ');
    const evidence = surface.comparisons
      .map((comparison) => `[${comparison.theme} overlay](../../${comparison.overlay.replace(/^docs\/parity-recovery\//u, '')})`)
      .join(' · ');
    lines.push(
      `| \`${surface.stableId}\` | ${surface.classification.code} | ${themes} | ${evidence} |`,
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const crosswalkPath = path.resolve(
    ROOT,
    readOption(process.argv.slice(2), 'crosswalk', 'docs/parity-recovery/registries/parity-crosswalk.json'),
  );
  const ledgerPaths = readOption(process.argv.slice(2), 'batch-ledger', '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (ledgerPaths.length === 0) throw new Error('At least one --batch-ledger path is required.');
  const outputPath = path.resolve(
    ROOT,
    readOption(
      process.argv.slice(2),
      'output',
      'docs/parity-recovery/evidence/owner-signoff-candidate.json',
    ),
  );
  const markdownPath = path.resolve(
    ROOT,
    readOption(
      process.argv.slice(2),
      'markdown-output',
      'docs/parity-recovery/evidence/OWNER_SIGNOFF_CANDIDATE.md',
    ),
  );
  const crosswalk = JSON.parse(await readFile(crosswalkPath, 'utf8'));
  const ledgers = await Promise.all(
    ledgerPaths.map(async (ledgerPath) =>
      JSON.parse(await readFile(path.resolve(ROOT, ledgerPath), 'utf8')),
    ),
  );
  const candidate = buildCandidate(crosswalk, ledgers, ledgerPaths);
  await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`);
  await writeFile(markdownPath, renderMarkdown(candidate));
  process.stdout.write(
    `Owner-signoff candidate: ${candidate.evidenceSummary.measuredOutlierSurfaces} surfaces / ${candidate.evidenceSummary.measuredOutlierPairs} theme-pairs.\n`,
  );
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

