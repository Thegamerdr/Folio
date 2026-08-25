#!/usr/bin/env node

/** Build the whole-app visual-parity crosswalk from the checked design/native registries. */
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DESIGN_PATH = path.join(ROOT, 'docs/parity-recovery/registries/design-surfaces.json');
const NATIVE_PATH = path.join(ROOT, 'docs/parity-recovery/registries/native-surfaces.json');
const OUTPUT_PATH = path.join(ROOT, 'docs/parity-recovery/registries/parity-crosswalk.json');
const DEVICE_RELATIVE_PATH = 'docs/parity-recovery/evidence/s9/device-configuration.json';
const DEVICE_PATH = path.join(ROOT, DEVICE_RELATIVE_PATH);
const DESIGN_SHA = 'ad90b4fee36c58be156e145e8663d8c6be1bf0eb';

const [design, native] = await Promise.all([
  readFile(DESIGN_PATH, 'utf8').then(JSON.parse),
  readFile(NATIVE_PATH, 'utf8').then(JSON.parse),
]);
await access(DEVICE_PATH);

const designScreens = new Map(design.phone_screens.map((entry) => [entry.screen_id, entry]));
const designSheets = new Map(design.sheets.map((entry) => [entry.sheet_id, entry]));
const designEntries = [
  ...design.phone_screens.map((entry) => ({ ...entry, kind: 'screen' })),
  ...design.sheets.map((entry) => ({ ...entry, kind: 'sheet' })),
  ...design.global_overlays_and_tools.map((entry) => ({ ...entry, kind: 'global' })),
];

function sourcePath(sourceRef) {
  return typeof sourceRef === 'string' ? sourceRef.split('#')[0].replaceAll('\\', '/') : '';
}

function resolveDesignOwners(kind, entry) {
  const exact =
    kind === 'screen'
      ? designScreens.get(entry.routeKey)
      : kind === 'sheet'
        ? designSheets.get(entry.routeKey)
        : undefined;
  if (exact) return [{ ...exact, kind, resolution: 'exact-route-key' }];

  const hints = entry.designOwnerHints ?? [];
  const matches = designEntries.filter((candidate) => {
    const candidatePath = sourcePath(candidate.source_ref);
    return (
      candidatePath.length > 0 &&
      hints.some((hint) => {
        const hintPath = sourcePath(hint);
        return hintPath.length > 0 && candidatePath.endsWith(hintPath);
      })
    );
  });
  if (matches.length > 0) {
    return matches.map((match) => ({ ...match, resolution: 'exact-source-hint' }));
  }
  return hints.map((hint) => ({
    stable_id: null,
    kind: 'hint',
    source_ref: hint,
    resolution: 'unverified-source-hint',
  }));
}

function fixturesFor(entry) {
  if (entry.workspace === 'business' || entry.routeKey?.startsWith('business-')) {
    return ['business-sole-trader', 'business-ltd'];
  }
  if (entry.routeKey === 'start') return ['first-run', 'empty'];
  if (entry.routeKey === 'review' || entry.routeKey === 'review-item') return ['pending-review'];
  if (entry.routeKey === 'plan') {
    return entry.states?.some((state) => state.includes('empty'))
      ? ['confirmed-safe', 'empty', 'populated-commitments']
      : ['confirmed-safe', 'populated-commitments'];
  }
  if (entry.states?.some((state) => state.includes('empty'))) return ['confirmed-safe', 'empty'];
  return ['confirmed-safe'];
}

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

const CALIBRATIONS = {
  today: {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/confirmed-safe/light/today/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/confirmed-safe/dark/today/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-104a279/confirmed-safe/light/today/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-9c8b5e3/confirmed-safe/dark/today/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/104a279/confirmed-safe/light/today/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/9c8b5e3/confirmed-safe/dark/today/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/104a279/confirmed-safe/light/today/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/9c8b5e3/confirmed-safe/dark/today/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason: 'Measured Light/Dark pixel differences remain after gross composition calibration.',
      consequence: 'Fine material, typography and geometry still require physical-S9 calibration.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 12.5244,
        darkMeanAbsoluteRgbDelta: 12.8249,
      },
    },
  },
  melo: {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/confirmed-safe/light/melo/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/confirmed-safe/dark/melo/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-3a99592/confirmed-safe/light/melo/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-3a99592/confirmed-safe/dark/melo/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/3a99592/confirmed-safe/light/melo/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/3a99592/confirmed-safe/dark/melo/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/3a99592/confirmed-safe/light/melo/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/3a99592/confirmed-safe/dark/melo/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason: 'Measured Light/Dark pixel differences remain after dedicated Melo composition calibration.',
      consequence:
        'Fine typography, Fenice halo/scale and lower-route content still require physical-S9 review.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 8.799,
        darkMeanAbsoluteRgbDelta: 8.8246,
      },
    },
  },
  more: {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/confirmed-safe/light/more/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/confirmed-safe/dark/more/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-4a8f20f/confirmed-safe/light/more/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-4a8f20f/confirmed-safe/dark/more/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/4a8f20f/confirmed-safe/light/more/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/4a8f20f/confirmed-safe/dark/more/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/4a8f20f/confirmed-safe/light/more/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/4a8f20f/confirmed-safe/dark/more/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason: 'Measured Light/Dark pixel differences remain after root hierarchy calibration.',
      consequence:
        'Fine text rasterisation, material and child-route coverage still require physical-S9 review.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 6.8695,
        darkMeanAbsoluteRgbDelta: 6.4871,
      },
    },
  },
  plan: {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/populated-commitments/light/plan/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/populated-commitments/dark/plan/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-9a52e34/populated-commitments/light/plan/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-e2fb76f/populated-commitments/dark/plan/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/9a52e34/populated-commitments/light/plan/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/e2fb76f/populated-commitments/dark/plan/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/9a52e34/populated-commitments/light/plan/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/e2fb76f/populated-commitments/dark/plan/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark pixel differences remain after companion and root composition calibration.',
      consequence: 'Fine material, typography and geometry still require physical-S9 review.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 7.4944,
        darkMeanAbsoluteRgbDelta: 7.2708,
      },
    },
  },
  review: {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/pending-review/light/review/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/pending-review/dark/review/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-c6535dd/pending-review/light/review/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-e2fb76f/pending-review/dark/review/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/c6535dd/pending-review/light/review/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/e2fb76f/pending-review/dark/review/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/c6535dd/pending-review/light/review/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/e2fb76f/pending-review/dark/review/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason: 'Measured Light/Dark pixel differences remain after companion perch calibration.',
      consequence:
        'Category-chip and card vertical composition plus fine rasterisation still require physical-S9 review.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 14.4519,
        darkMeanAbsoluteRgbDelta: 14.3463,
      },
    },
  },
};

const collections = [
  ['stack-route', native.stackRoutes],
  ['tab', native.tabs],
  ['screen', native.screens],
  ['sheet', native.sheets],
  ['dialog', native.dialogs],
  ['global-state', native.globalStates],
];

const entries = collections
  .flatMap(([kind, rows]) =>
    rows.map((entry) => {
      const designOwners = resolveDesignOwners(kind, entry);
      const calibration = CALIBRATIONS[entry.routeKey];
      const evidence = calibration?.evidence ?? emptyEvidence();
      const hasExactOwner = designOwners.some((owner) =>
        ['exact-route-key', 'exact-source-hint'].includes(owner.resolution),
      );
      return {
        stableId: entry.stableId,
        kind,
        native: {
          routeKey: entry.routeKey,
          componentSource: entry.componentSource,
          workspace: entry.workspace,
          states: entry.states,
        },
        design: {
          owners: designOwners.map((owner) => ({
            stableId: owner.stable_id ?? null,
            kind: owner.kind,
            routeKey: owner.screen_id ?? owner.sheet_id ?? null,
            sourceReference: owner.source_ref,
            keyStates: owner.key_states ?? [],
            resolution: owner.resolution,
          })),
          ownerStatus: hasExactOwner ? 'resolved' : 'unresolved',
        },
        matchedFixtures: fixturesFor(entry),
        evidence,
        deviations: calibration ? [calibration.deviation] : [],
        finalStatus:
          evidence.comparisonCount > 0
            ? 'calibration-evidence-recorded-not-owner-approved'
            : 'missing-direct-visual-comparison',
      };
    }),
  )
  .sort((a, b) => a.stableId.localeCompare(b.stableId));

if (entries.length !== native.counts.totalRegisteredSurfaces) {
  throw new Error(
    `Native registry count mismatch: built ${entries.length}, declared ${native.counts.totalRegisteredSurfaces}.`,
  );
}

const evidencePaths = new Set(
  entries
    .flatMap((entry) => [
      entry.evidence.lightSource,
      entry.evidence.darkSource,
      entry.evidence.lightNative,
      entry.evidence.darkNative,
      entry.evidence.lightOverlay,
      entry.evidence.darkOverlay,
      ...entry.evidence.differenceImages,
    ])
    .filter(Boolean),
);
await Promise.all([...evidencePaths].map((relativePath) => access(path.join(ROOT, relativePath))));

const mappedDesignIds = new Set(
  entries.flatMap((entry) => entry.design.owners.map((owner) => owner.stableId).filter(Boolean)),
);
const unmappedDesign = designEntries
  .filter((entry) => entry.stable_id && !mappedDesignIds.has(entry.stable_id))
  .map((entry) => ({
    stableId: entry.stable_id,
    kind: entry.kind,
    routeKey: entry.screen_id ?? entry.sheet_id ?? null,
    sourceReference: entry.source_ref,
  }));

const ownerResolvedCount = entries.filter(
  (entry) => entry.design.ownerStatus === 'resolved',
).length;
const comparedSurfaceCount = entries.filter((entry) => entry.evidence.comparisonCount > 0).length;
const lightComparisons = new Set(
  entries.map((entry) => entry.evidence.lightNative).filter(Boolean),
);
const darkComparisons = new Set(entries.map((entry) => entry.evidence.darkNative).filter(Boolean));
const comparisonCount = lightComparisons.size + darkComparisons.size;

const output = {
  $schema: 'melo-true-visual-parity-crosswalk/v1',
  generatedFrom: {
    designRepository: 'Thegamerdr/private-money-pilot',
    designSha: DESIGN_SHA,
    nativeRepository: 'Thegamerdr/Folio',
    nativeBranch: 'codex/melo-native-true-parity-2026-08-25',
    designRegistry: path.relative(ROOT, DESIGN_PATH).replaceAll('\\', '/'),
    nativeRegistry: path.relative(ROOT, NATIVE_PATH).replaceAll('\\', '/'),
    primaryAcceptanceDevice: DEVICE_RELATIVE_PATH,
  },
  statusPolicy: {
    passingTestsDoNotImplyVisualParity: true,
    ownerApprovalRequired: true,
    missingEvidenceIsNotAPass: true,
  },
  counts: {
    nativeShippingSurfaces: entries.length,
    exactDesignOwnersResolved: ownerResolvedCount,
    unresolvedDesignOwners: entries.length - ownerResolvedCount,
    surfacesWithDirectComparison: comparedSurfaceCount,
    surfacesMissingDirectComparison: entries.length - comparedSurfaceCount,
    comparisonCount,
    lightComparisonCount: lightComparisons.size,
    darkComparisonCount: darkComparisons.size,
    designSurfacesNotMappedToNativeShippingSurface: unmappedDesign.length,
  },
  entries,
  unmappedDesignSurfaces: unmappedDesign,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output.counts, null, 2));
