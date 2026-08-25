import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const THEMES = new Set(['light', 'dark']);

function readOption(argv, name) {
  const prefix = `--${name}=`;
  const inline = argv.find((value) => value.startsWith(prefix));
  if (inline !== undefined) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`--${name} requires a value.`);
  }
  return value;
}

export function parseBatchLedgerOptions(argv, env, root) {
  const ledgerValue = readOption(argv, 'batch-ledger') ?? env.PARITY_BATCH_LEDGER;
  const expectedValue =
    readOption(argv, 'expected-direct-count') ?? env.PARITY_EXPECTED_DIRECT_COUNT;
  if (expectedValue !== undefined && expectedValue !== '' && !/^\d+$/u.test(expectedValue)) {
    throw new Error(`Expected direct count must be a non-negative integer, got ${expectedValue}.`);
  }
  const expectedDirectCount =
    expectedValue === undefined || expectedValue === '' ? null : Number.parseInt(expectedValue, 10);
  if (
    expectedDirectCount !== null &&
    (!Number.isSafeInteger(expectedDirectCount) || expectedDirectCount < 0)
  ) {
    throw new Error(`Expected direct count must be a non-negative integer, got ${expectedValue}.`);
  }
  return {
    ledgerPath:
      ledgerValue === undefined || ledgerValue === '' ? null : path.resolve(root, ledgerValue),
    expectedDirectCount,
  };
}

export async function readBatchLedger(ledgerPath) {
  const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
  if (ledger.schemaVersion !== 1 || !Array.isArray(ledger.rankedPairs)) {
    throw new Error(`Unsupported batch comparison ledger: ${ledgerPath}`);
  }
  return ledger;
}

function normaliseRelativePath(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Batch ledger ${field} must be a non-empty repository-relative path.`);
  }
  const normalised = value.replaceAll('\\', '/');
  if (
    path.posix.isAbsolute(normalised) ||
    /^[A-Za-z]:\//u.test(normalised) ||
    normalised.split('/').includes('..')
  ) {
    throw new Error(`Batch ledger ${field} must stay inside the repository: ${value}`);
  }
  return normalised;
}

function fixtureFromSource(source, theme) {
  const marker = '/evidence/design/ad90b4-matched-v1/';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;
  const tail = source.slice(markerIndex + marker.length).split('/');
  const themeIndex = tail.indexOf(theme);
  return themeIndex > 0 ? tail.slice(0, themeIndex).join('/') : null;
}

function existingComparisons(entry) {
  if (Array.isArray(entry.evidence.comparisons)) {
    return entry.evidence.comparisons.map((comparison) => ({ ...comparison }));
  }
  const comparisons = [];
  for (const theme of THEMES) {
    const title = theme[0].toUpperCase() + theme.slice(1);
    const source = entry.evidence[`${theme}Source`];
    const native = entry.evidence[`${theme}Native`];
    const overlay = entry.evidence[`${theme}Overlay`];
    if (source === null && native === null && overlay === null) continue;
    if (![source, native, overlay].every((value) => typeof value === 'string' && value !== '')) {
      throw new Error(`Existing evidence for ${entry.stableId}/${theme} is incomplete.`);
    }
    const fixture = fixtureFromSource(source, theme) ?? `accepted-${theme}`;
    const overlayDir = path.posix.dirname(overlay);
    const difference = entry.evidence.differenceImages.find(
      (candidate) => path.posix.dirname(candidate) === overlayDir,
    );
    comparisons.push({
      provenance: 'accepted-crosswalk-calibration',
      fixture,
      theme,
      source,
      native,
      overlay,
      difference: difference ?? null,
      label: `${title} accepted calibration`,
    });
  }
  return comparisons;
}

function nativeLocator(row) {
  if (typeof row.nativeStableId === 'string' && row.nativeStableId !== '') {
    return { stableId: row.nativeStableId, kind: null, route: null };
  }
  const kind = row.nativeKind ?? (row.nativeSheet ? 'sheet' : 'screen');
  const route = row.nativeRoute ?? row.nativeSheet ?? row.nativeScreen;
  if (!['screen', 'sheet'].includes(kind) || typeof route !== 'string' || route === '') {
    throw new Error(
      `Batch row ${row.fixture ?? '?'} / ${row.screen ?? '?'} lacks a valid native surface locator.`,
    );
  }
  return { stableId: null, kind, route };
}

function resolveArtifacts(row, ledger) {
  const fixture = row.fixture;
  const theme = row.theme;
  const surface = row.screen;
  const overlay = normaliseRelativePath(row.overlay, 'overlay');
  const comparisonDir = path.posix.dirname(overlay);
  return {
    source: normaliseRelativePath(
      row.source ??
        `docs/parity-recovery/evidence/design/ad90b4-matched-v1/${fixture}/${theme}/${surface}/source-product-1080x2004.png`,
      'source',
    ),
    native: normaliseRelativePath(
      row.native ??
        `docs/parity-recovery/evidence/native/harness-${ledger.nativeRef}/${fixture}/${theme}/${surface}/native-product-1080x2004.png`,
      'native',
    ),
    overlay,
    difference: normaliseRelativePath(
      row.difference ?? `${comparisonDir}/absolute-difference.png`,
      'difference',
    ),
  };
}

function comparisonKey(stableId, fixture, theme) {
  return `${stableId}\u0000${fixture}\u0000${theme}`;
}

function sameComparison(left, right) {
  return (
    ['source', 'native', 'overlay', 'difference'].every((field) => left[field] === right[field]) &&
    JSON.stringify(left.metrics) === JSON.stringify(right.metrics) &&
    left.outlier === right.outlier &&
    JSON.stringify(left.outlierReasons) === JSON.stringify(right.outlierReasons)
  );
}

function ledgerSurfaceKey(row) {
  return `${row.fixture}\u0000${row.screen}`;
}

export async function mergeBatchLedgerEvidence(
  entries,
  ledger,
  { root, assertArtifact = (absolutePath) => access(absolutePath) },
) {
  if (ledger.schemaVersion !== 1 || !Array.isArray(ledger.rankedPairs)) {
    throw new Error('Unsupported batch comparison ledger object.');
  }
  if (typeof ledger.nativeRef !== 'string' || ledger.nativeRef === '') {
    throw new Error('Batch comparison ledger is missing nativeRef.');
  }
  if (typeof ledger.nativeSha !== 'string' || !/^[0-9a-f]{40}$/iu.test(ledger.nativeSha)) {
    throw new Error('Batch comparison ledger nativeSha must be a full 40-character Git SHA.');
  }
  if (!ledger.nativeSha.toLowerCase().startsWith(ledger.nativeRef.toLowerCase())) {
    throw new Error(`Batch nativeRef ${ledger.nativeRef} does not match ${ledger.nativeSha}.`);
  }
  if (ledger.pairCount !== ledger.rankedPairs.length) {
    throw new Error(
      `Batch pairCount mismatch: declared ${ledger.pairCount}, found ${ledger.rankedPairs.length}.`,
    );
  }
  const ledgerSurfaceCount = new Set(ledger.rankedPairs.map(ledgerSurfaceKey)).size;
  if (ledger.surfaceCount !== ledgerSurfaceCount) {
    throw new Error(
      `Batch surfaceCount mismatch: declared ${ledger.surfaceCount}, found ${ledgerSurfaceCount}.`,
    );
  }

  const byStableId = new Map(entries.map((entry) => [entry.stableId, entry]));
  const byKindAndRoute = new Map();
  for (const entry of entries) {
    const key = `${entry.kind}:${entry.native.routeKey}`;
    const matches = byKindAndRoute.get(key) ?? [];
    matches.push(entry);
    byKindAndRoute.set(key, matches);
  }
  const comparisonsByStableId = new Map(
    entries.map((entry) => [entry.stableId, existingComparisons(entry)]),
  );
  const existingKeys = new Set();
  for (const [stableId, comparisons] of comparisonsByStableId) {
    for (const comparison of comparisons) {
      existingKeys.add(comparisonKey(stableId, comparison.fixture, comparison.theme));
    }
  }

  const uniqueBatchRows = new Map();
  const batchStableIds = new Set();
  const batchNativeSurfaceKeys = new Set();
  let duplicatePairCount = 0;
  for (const row of ledger.rankedPairs) {
    if (
      typeof row.fixture !== 'string' ||
      row.fixture === '' ||
      typeof row.screen !== 'string' ||
      row.screen === '' ||
      !THEMES.has(row.theme)
    ) {
      throw new Error('Batch ledger row lacks fixture, screen or supported theme.');
    }
    for (const metric of ['meanAbsoluteRgbDelta', 'rmsRgbDelta', 'changedPixelFraction']) {
      if (typeof row[metric] !== 'number' || !Number.isFinite(row[metric]) || row[metric] < 0) {
        throw new Error(
          `Batch ledger row ${row.fixture}/${row.screen}/${row.theme} has invalid ${metric}.`,
        );
      }
    }
    if (
      row.materialChangedPixelFraction !== undefined &&
      (typeof row.materialChangedPixelFraction !== 'number' ||
        !Number.isFinite(row.materialChangedPixelFraction) ||
        row.materialChangedPixelFraction < 0)
    ) {
      throw new Error(
        `Batch ledger row ${row.fixture}/${row.screen}/${row.theme} has invalid materialChangedPixelFraction.`,
      );
    }
    const locator = nativeLocator(row);
    batchNativeSurfaceKeys.add(
      row.nativeSurfaceKey ?? locator.stableId ?? `${locator.kind}:${locator.route}`,
    );
    let entry;
    if (locator.stableId) {
      entry = byStableId.get(locator.stableId);
    } else {
      const matches = byKindAndRoute.get(`${locator.kind}:${locator.route}`) ?? [];
      if (matches.length > 1) {
        throw new Error(`Ambiguous native route ${locator.kind}:${locator.route}.`);
      }
      entry = matches[0];
    }
    if (!entry) {
      throw new Error(
        `Batch row ${row.fixture}/${row.screen} does not map to a native crosswalk surface.`,
      );
    }
    const artifacts = resolveArtifacts(row, ledger);
    const key = comparisonKey(entry.stableId, row.fixture, row.theme);
    const comparison = {
      provenance: 'batch-ledger',
      fixture: row.fixture,
      theme: row.theme,
      source: artifacts.source,
      native: artifacts.native,
      overlay: artifacts.overlay,
      difference: artifacts.difference,
      metrics: {
        meanAbsoluteRgbDelta: row.meanAbsoluteRgbDelta,
        rmsRgbDelta: row.rmsRgbDelta,
        changedPixelFraction: row.changedPixelFraction,
        ...(row.materialChangedPixelFraction === undefined
          ? {}
          : { materialChangedPixelFraction: row.materialChangedPixelFraction }),
      },
      outlier: Boolean(row.outlier),
      outlierReasons: Array.isArray(row.outlierReasons) ? row.outlierReasons : [],
      batchId: row.batchId ?? null,
    };
    const previous = uniqueBatchRows.get(key);
    if (previous) {
      if (!sameComparison(previous.comparison, comparison)) {
        throw new Error(
          `Conflicting duplicate batch evidence for ${entry.stableId}/${row.fixture}/${row.theme}.`,
        );
      }
      duplicatePairCount += 1;
      continue;
    }
    uniqueBatchRows.set(key, { entry, comparison });
    batchStableIds.add(entry.stableId);
  }

  if (
    ledger.directSurfaceCount !== undefined &&
    (ledger.directSurfaceCount !== batchNativeSurfaceKeys.size ||
      ledger.directSurfaceCount !== batchStableIds.size)
  ) {
    throw new Error(
      `Batch directSurfaceCount mismatch: declared ${ledger.directSurfaceCount}, ledger keys ${batchNativeSurfaceKeys.size}, mapped ${batchStableIds.size}.`,
    );
  }
  if (Array.isArray(ledger.directSurfaceKeys)) {
    const declaredKeys = [...new Set(ledger.directSurfaceKeys)].sort();
    const observedKeys = [...batchNativeSurfaceKeys].sort();
    if (JSON.stringify(declaredKeys) !== JSON.stringify(observedKeys)) {
      throw new Error('Batch directSurfaceKeys do not match the ranked pair locators.');
    }
  }

  let preservedOverlapCount = 0;
  let addedComparisonCount = 0;
  for (const [key, { entry, comparison }] of uniqueBatchRows) {
    await Promise.all(
      ['source', 'native', 'overlay', 'difference'].map((field) =>
        assertArtifact(path.join(root, comparison[field])),
      ),
    );
    if (existingKeys.has(key)) {
      preservedOverlapCount += 1;
      continue;
    }
    comparisonsByStableId.get(entry.stableId).push(comparison);
    existingKeys.add(key);
    addedComparisonCount += 1;
  }

  const mergedEntries = entries.map((entry) => {
    const comparisons = comparisonsByStableId.get(entry.stableId);
    if (comparisons.length === 0) return entry;
    const evidence = {
      ...entry.evidence,
      comparisons,
      comparisonCount: comparisons.length,
      differenceImages: [...new Set(comparisons.map((row) => row.difference).filter(Boolean))],
    };
    for (const theme of THEMES) {
      const selected = comparisons.find((comparison) => comparison.theme === theme);
      if (!selected) continue;
      evidence[`${theme}Source`] ??= selected.source;
      evidence[`${theme}Native`] ??= selected.native;
      evidence[`${theme}Overlay`] ??= selected.overlay;
    }
    return {
      ...entry,
      evidence,
      finalStatus: 'calibration-evidence-recorded-not-owner-approved',
    };
  });
  const finalDirectSurfaceCount = mergedEntries.filter(
    (entry) => entry.evidence.comparisonCount > 0,
  ).length;
  const recomputedDirectSurfaceCount = new Set(
    mergedEntries
      .filter((entry) => entry.evidence.comparisonCount > 0)
      .map((entry) => entry.stableId),
  ).size;
  if (finalDirectSurfaceCount !== recomputedDirectSurfaceCount) {
    throw new Error('Directly evidenced unique-surface count is internally inconsistent.');
  }

  return {
    entries: mergedEntries,
    stats: {
      ledgerPairCount: ledger.rankedPairs.length,
      uniqueBatchPairCount: uniqueBatchRows.size,
      duplicatePairCount,
      batchStableSurfaceCount: batchStableIds.size,
      preservedOverlapCount,
      addedComparisonCount,
      finalDirectSurfaceCount,
    },
  };
}

export function comparisonPaths(entries, theme) {
  const paths = [];
  for (const entry of entries) {
    if (Array.isArray(entry.evidence.comparisons)) {
      paths.push(
        ...entry.evidence.comparisons
          .filter((comparison) => comparison.theme === theme)
          .map((comparison) => comparison.native),
      );
    } else if (entry.evidence[`${theme}Native`]) {
      paths.push(entry.evidence[`${theme}Native`]);
    }
  }
  return paths;
}
