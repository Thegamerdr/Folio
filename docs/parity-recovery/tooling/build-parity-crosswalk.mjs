#!/usr/bin/env node

/**
 * Build the whole-app visual-parity crosswalk from the checked design/native registries.
 *
 * A completed bulk comparison can be merged without changing the checked calibration table:
 *   node docs/parity-recovery/tooling/build-parity-crosswalk.mjs \
 *     --batch-ledger=docs/parity-recovery/evidence/comparisons/<ref>/batch-ledger.json \
 *     --expected-direct-count=<unique-crosswalk-surface-count>
 *
 * PARITY_BATCH_LEDGER and PARITY_EXPECTED_DIRECT_COUNT are equivalent environment controls.
 */
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  combineBatchLedgers,
  comparisonPaths,
  mergeBatchLedgerEvidence,
  parseBatchLedgerOptions,
  readBatchLedger,
} from './merge-batch-ledger.mjs';
import {
  mergeContractLedgerEvidence,
  parseContractLedgerOptions,
  readContractLedger,
} from './merge-contract-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DESIGN_PATH = path.join(ROOT, 'docs/parity-recovery/registries/design-surfaces.json');
const NATIVE_PATH = path.join(ROOT, 'docs/parity-recovery/registries/native-surfaces.json');
const OWNER_RESOLUTIONS_PATH = path.join(
  ROOT,
  'docs/parity-recovery/registries/owner-resolutions.json',
);
const OUTPUT_PATH = path.join(ROOT, 'docs/parity-recovery/registries/parity-crosswalk.json');
const DEVICE_RELATIVE_PATH = 'docs/parity-recovery/evidence/s9/device-configuration.json';
const DEVICE_PATH = path.join(ROOT, DEVICE_RELATIVE_PATH);
const DESIGN_SHA = 'ad90b4fee36c58be156e145e8663d8c6be1bf0eb';
const batchLedgerOptions = parseBatchLedgerOptions(process.argv.slice(2), process.env, ROOT);
const contractLedgerOptions = parseContractLedgerOptions(process.argv.slice(2), process.env, ROOT);

const [design, native, ownerResolutions] = await Promise.all([
  readFile(DESIGN_PATH, 'utf8').then(JSON.parse),
  readFile(NATIVE_PATH, 'utf8').then(JSON.parse),
  readFile(OWNER_RESOLUTIONS_PATH, 'utf8').then(JSON.parse),
]);
await access(DEVICE_PATH);

if (ownerResolutions.designSha !== DESIGN_SHA) {
  throw new Error(
    `Owner-resolution design SHA mismatch: ${ownerResolutions.designSha} != ${DESIGN_SHA}.`,
  );
}
const ownerResolutionByNativeId = new Map(
  ownerResolutions.entries.map((entry) => [entry.nativeStableId, entry]),
);
if (ownerResolutionByNativeId.size !== ownerResolutions.entries.length) {
  throw new Error('Owner-resolution registry contains duplicate nativeStableId values.');
}
const registeredExactOwnerCount = ownerResolutions.entries.filter(
  (entry) => entry.disposition === 'exact-owner',
).length;
const registeredTrueExceptionCount = ownerResolutions.entries.filter(
  (entry) => entry.disposition === 'true-exception',
).length;
if (
  registeredExactOwnerCount !== ownerResolutions.counts.exactOwners ||
  registeredTrueExceptionCount !== ownerResolutions.counts.trueExceptions
) {
  throw new Error(
    `Owner-resolution disposition counts do not match the registry declaration: exact=${registeredExactOwnerCount}, exceptions=${registeredTrueExceptionCount}.`,
  );
}

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
  if (
    entry.routeKey === 'business-today' ||
    entry.routeKey === 'business-review' ||
    entry.routeKey === 'business-money' ||
    entry.routeKey === 'business-calendar' ||
    entry.routeKey === 'business-clients' ||
    entry.routeKey === 'business-invoices' ||
    entry.routeKey === 'business-obligations' ||
    entry.routeKey === 'business-vat' ||
    entry.routeKey === 'business-insights' ||
    entry.routeKey === 'business-runway' ||
    entry.routeKey === 'business-filings' ||
    entry.routeKey === 'business-corp-tax' ||
    entry.routeKey === 'business-payroll' ||
    entry.routeKey === 'business-dividends' ||
    entry.routeKey === 'business-dla' ||
    entry.routeKey === 'business-companies-house' ||
    entry.routeKey === 'business-entity-setup' ||
    entry.routeKey === 'business-melo' ||
    entry.routeKey === 'business-more'
  ) {
    return ['business-empty', 'business-sole-trader', 'business-ltd'];
  }
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
  'business-corp-tax': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-corp-tax/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-corp-tax/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-ea08cfa/business-empty/light/business-corp-tax/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-ea08cfa/business-empty/dark/business-corp-tax/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/light/business-corp-tax/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/dark/business-corp-tax/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/light/business-corp-tax/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/dark/business-corp-tax/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after the shared Limited Company setup guard and Business type action restoration.',
      consequence:
        'The compared unconfigured state matches the pinned Limited Company-only guard and routes its primary action to the real native Business Type flow; the pinned synthetic demo-company control remains capture-only and writes no production state. Browser/native shell geometry and fine text rasterisation still require physical-S9 owner review, while the populated Corporation Tax estimate, pot and policy-version engine remain separate captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 8.205,
        darkMeanAbsoluteRgbDelta: 8.2375,
      },
    },
  },
  'business-payroll': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-payroll/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-payroll/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-ea08cfa/business-empty/light/business-payroll/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-ea08cfa/business-empty/dark/business-payroll/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/light/business-payroll/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/dark/business-payroll/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/light/business-payroll/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/dark/business-payroll/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after the shared Limited Company setup guard and Business type action restoration.',
      consequence:
        'The compared unconfigured state matches the pinned Limited Company-only guard and routes its primary action to the real native Business Type flow; the pinned synthetic demo-company control remains capture-only and writes no production state. Browser/native shell geometry and fine text rasterisation still require physical-S9 owner review, while populated employees, payroll runs and liability calculations remain separate captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 8.205,
        darkMeanAbsoluteRgbDelta: 8.2375,
      },
    },
  },
  'business-dividends': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-dividends/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-dividends/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-ea08cfa/business-empty/light/business-dividends/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-ea08cfa/business-empty/dark/business-dividends/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/light/business-dividends/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/dark/business-dividends/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/light/business-dividends/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/dark/business-dividends/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after the shared Limited Company setup guard and Business type action restoration.',
      consequence:
        'The compared unconfigured state matches the pinned Limited Company-only guard and routes its primary action to the real native Business Type flow; the pinned synthetic demo-company control remains capture-only and writes no production state. Browser/native shell geometry and fine text rasterisation still require physical-S9 owner review, while populated distributable reserves, declarations and dividend-tax calculations remain separate captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 8.205,
        darkMeanAbsoluteRgbDelta: 8.2375,
      },
    },
  },
  'business-dla': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-dla/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-dla/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-ea08cfa/business-empty/light/business-dla/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-ea08cfa/business-empty/dark/business-dla/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/light/business-dla/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/dark/business-dla/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/light/business-dla/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/dark/business-dla/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after the shared Limited Company setup guard and Business type action restoration.',
      consequence:
        'The compared unconfigured state matches the pinned Limited Company-only guard and routes its primary action to the real native Business Type flow; the pinned synthetic demo-company control remains capture-only and writes no production state. Browser/native shell geometry and fine text rasterisation still require physical-S9 owner review, while populated director-loan movements, section 455 and benefit-in-kind calculations remain separate captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 8.205,
        darkMeanAbsoluteRgbDelta: 8.2375,
      },
    },
  },
  'business-companies-house': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-companies-house/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-companies-house/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-ea08cfa/business-empty/light/business-companies-house/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-ea08cfa/business-empty/dark/business-companies-house/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/light/business-companies-house/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/dark/business-companies-house/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/light/business-companies-house/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/ea08cfa/business-empty/dark/business-companies-house/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after the Limited Company setup guard, explanation and Business type action restoration.',
      consequence:
        'The compared unconfigured state now matches the pinned Limited Company-only guard and routes its primary action to the real native Business Type flow; the pinned synthetic demo-company control remains capture-only and writes no production state. Browser/native shell geometry and fine text rasterisation still require physical-S9 owner review, while populated Companies House deadlines and their filing working copies remain separate captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 8.205,
        darkMeanAbsoluteRgbDelta: 8.2375,
      },
    },
  },
  'business-filings': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-filings/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-filings/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-be2e0d3/business-empty/light/business-filings/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-be2e0d3/business-empty/dark/business-filings/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/be2e0d3/business-empty/light/business-filings/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/be2e0d3/business-empty/dark/business-filings/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/be2e0d3/business-empty/light/business-filings/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/be2e0d3/business-empty/dark/business-filings/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business Filings empty answer, filing explanation and Business type action restoration.',
      consequence:
        'The compared unconfigured state now matches the pinned filing explanation and routes its action to the real native Business Type flow; the pinned source companion bird/bubble, browser/native shell geometry and fine text rasterisation still require physical-S9 owner review, while configured sole-trader and limited-company filing sets plus working-copy and submission states remain separate captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 9.5073,
        darkMeanAbsoluteRgbDelta: 8.5688,
      },
    },
  },
  'business-runway': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-runway/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-runway/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-7a4dda7/business-empty/light/business-runway/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-7a4dda7/business-empty/dark/business-runway/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/7a4dda7/business-empty/light/business-runway/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/7a4dda7/business-empty/dark/business-runway/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/7a4dda7/business-empty/light/business-runway/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/7a4dda7/business-empty/dark/business-runway/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business Runway disclaimer, answer, account action and empty forecast-card restoration.',
      consequence:
        'The compared no-account state now matches the pinned cash-runway explanation and routes both account actions to the real native account flow; the pinned synthetic demo control remains capture-only and writes no production state. The source companion bird/bubble, browser/native shell geometry and fine text rasterisation still require physical-S9 owner review, while populated forecasts and owner-money transfers remain separate captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 10.507,
        darkMeanAbsoluteRgbDelta: 10.1332,
      },
    },
  },
  'business-insights': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-insights/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-insights/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-5b5a730/business-empty/light/business-insights/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-5b5a730/business-empty/dark/business-insights/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/5b5a730/business-empty/light/business-insights/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/5b5a730/business-empty/dark/business-insights/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/5b5a730/business-empty/light/business-insights/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/5b5a730/business-empty/dark/business-insights/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business Insights answer, invoice action and empty-story hierarchy restoration.',
      consequence:
        'The compared empty state now matches the pinned paid-invoice explanation and both actions route to the real native invoices surface; the pinned source companion bird/bubble, browser/native shell geometry and fine text rasterisation still require physical-S9 owner review, while populated revenue, client and period states remain separate captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 17.3635,
        darkMeanAbsoluteRgbDelta: 17.4121,
      },
    },
  },
  'business-vat': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-vat/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-vat/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-06197fd/business-empty/light/business-vat/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-06197fd/business-empty/dark/business-vat/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/06197fd/business-empty/light/business-vat/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/06197fd/business-empty/dark/business-vat/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/06197fd/business-empty/light/business-vat/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/06197fd/business-empty/dark/business-vat/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business VAT registration answer, threshold explanation and Business type action restoration.',
      consequence:
        'The compared unregistered state now matches the pinned threshold explanation and routes to the real native Business Type screen; the pinned source companion bird/bubble, browser/native shell geometry and fine text rasterisation still require physical-S9 owner review, while registered VAT pot, return and scheme states remain separate captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 7.4247,
        darkMeanAbsoluteRgbDelta: 7.8056,
      },
    },
  },
  'business-obligations': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-obligations/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-obligations/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-86e4715/business-empty/light/business-obligations/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-86e4715/business-empty/dark/business-obligations/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/86e4715/business-empty/light/business-obligations/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/86e4715/business-empty/dark/business-obligations/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/86e4715/business-empty/light/business-obligations/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/86e4715/business-empty/dark/business-obligations/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business Obligations answer, primary move, recurring-cost panel and coming-up hierarchy restoration.',
      consequence:
        'The pinned synthetic demo loader is reproduced only in the isolated parity fixture and never writes production obligations; both visible Add obligation actions open the real native persisted form. The pinned source companion bird/bubble, browser/native shell geometry and fine text rasterisation still require physical-S9 owner review, while populated recurring-cost and dated-deadline states remain separate captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 23.4367,
        darkMeanAbsoluteRgbDelta: 22.0656,
      },
    },
  },
  'business-invoices': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-invoices/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-invoices/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-145bc7c/business-empty/light/business-invoices/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-145bc7c/business-empty/dark/business-invoices/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/145bc7c/business-empty/light/business-invoices/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/145bc7c/business-empty/dark/business-invoices/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/145bc7c/business-empty/light/business-invoices/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/145bc7c/business-empty/dark/business-invoices/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business Invoices answer, empty-state, demo affordance and primary-action restoration.',
      consequence:
        'The pinned synthetic demo loader is reproduced only in the isolated parity fixture and never writes production invoice history; the shipping empty state keeps the real Add invoice flow. The pinned source companion bird/bubble, browser/native shell geometry and fine text rasterisation still require physical-S9 owner review, while populated aging and recurring-invoice states remain separate captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 12.4394,
        darkMeanAbsoluteRgbDelta: 11.8437,
      },
    },
  },
  'business-clients': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-clients/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-clients/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-3e83f5e/business-empty/light/business-clients/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-3e83f5e/business-empty/dark/business-clients/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/3e83f5e/business-empty/light/business-clients/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/3e83f5e/business-empty/dark/business-clients/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/3e83f5e/business-empty/light/business-clients/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/3e83f5e/business-empty/dark/business-clients/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business Clients answer, action, empty panel and statutory-note restoration.',
      consequence:
        'The compared empty state now follows the pinned invoice-derived client flow and opens the real native Log invoice sheet; the pinned source introductory companion bubble/bird and fine browser/Android rasterisation still require physical-S9 owner review, while populated client detail remains a separate state capture.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 15.4903,
        darkMeanAbsoluteRgbDelta: 16.0311,
      },
    },
  },
  'business-entity-setup': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-entity-setup/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-entity-setup/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-e91b580/business-empty/light/business-entity-setup/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-e91b580/business-empty/dark/business-entity-setup/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/e91b580/business-empty/light/business-entity-setup/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/e91b580/business-empty/dark/business-entity-setup/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/e91b580/business-empty/light/business-entity-setup/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/e91b580/business-empty/dark/business-entity-setup/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business Setup answer, choice-row and type-rhythm restoration.',
      consequence:
        'The compared first step now follows the pinned two-question flow; Android/Web text rasterisation and the richer native step-two HMRC, region, student-loan and VAT controls still require owner review and additional state captures.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 11.2742,
        darkMeanAbsoluteRgbDelta: 11.6736,
      },
    },
  },
  'business-calendar': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-calendar/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-calendar/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-d94c05c/business-empty/light/business-calendar/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-d94c05c/business-empty/dark/business-calendar/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/d94c05c/business-empty/light/business-calendar/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/d94c05c/business-empty/dark/business-calendar/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/d94c05c/business-empty/light/business-calendar/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/d94c05c/business-empty/dark/business-calendar/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business Calendar answer, action and companion-perch restoration.',
      consequence:
        'The pinned source capture includes an introductory companion speech bubble and background treatment that the acknowledged native companion does not repeat; fine type, sprite and material rasterisation still require physical-S9 owner review.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 29.7407,
        darkMeanAbsoluteRgbDelta: 28.1077,
      },
    },
  },
  'business-melo': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-melo/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-melo/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-b8bee08/business-empty/light/business-melo/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-b8bee08/business-empty/dark/business-melo/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/b8bee08/business-empty/light/business-melo/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/b8bee08/business-empty/dark/business-melo/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/b8bee08/business-empty/light/business-melo/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/b8bee08/business-empty/dark/business-melo/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business Melo type, rhythm and companion-perch calibration.',
      consequence:
        'The pinned source capture includes an introductory companion speech bubble that the acknowledged native companion does not repeat; fine text, material and sprite rasterisation still require physical-S9 owner review.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 12.3622,
        darkMeanAbsoluteRgbDelta: 12.5449,
      },
    },
  },
  'business-money': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-money/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-money/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-3419ef5/business-empty/light/business-money/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-3419ef5/business-empty/dark/business-money/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/3419ef5/business-empty/light/business-money/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/3419ef5/business-empty/dark/business-money/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/3419ef5/business-empty/light/business-money/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/3419ef5/business-empty/dark/business-money/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business Money answer, value and card calibration.',
      consequence:
        'The source introductory companion speech occupies a large comparison region; fine companion choreography, card material and text rasterisation still require physical-S9 owner review.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 19.5687,
        darkMeanAbsoluteRgbDelta: 19.2551,
      },
    },
  },
  'business-review': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-review/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-review/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-e4faa60/business-empty/light/business-review/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-e4faa60/business-empty/dark/business-review/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/e4faa60/business-empty/light/business-review/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/e4faa60/business-empty/dark/business-review/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/e4faa60/business-empty/light/business-review/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/e4faa60/business-empty/dark/business-review/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after Business Review root, type and geometry calibration.',
      consequence:
        'Companion choreography and fine text/material rasterisation still require physical-S9 owner review; child destinations resolve to real native intake, activity, insights and privacy authorities.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 14.4627,
        darkMeanAbsoluteRgbDelta: 14.2403,
      },
    },
  },
  'business-more': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-more/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-more/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-c5f2438/business-empty/light/business-more/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-c5f2438/business-empty/dark/business-more/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/c5f2438/business-empty/light/business-more/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/c5f2438/business-empty/dark/business-more/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/c5f2438/business-empty/light/business-more/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/c5f2438/business-empty/dark/business-more/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason: 'Measured Light/Dark differences remain after Business More hierarchy calibration.',
      consequence:
        'The source companion perch intentionally remains absent pending a native-owned perch, and several source child routes currently resolve to consolidated real native authorities pending exact child-route ports.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 18.9861,
        darkMeanAbsoluteRgbDelta: 18.7859,
      },
    },
  },
  'business-today': {
    evidence: {
      lightSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/light/business-today/source-product-1080x2004.png',
      darkSource:
        'docs/parity-recovery/evidence/design/ad90b4-matched-v1/business-empty/dark/business-today/source-product-1080x2004.png',
      lightNative:
        'docs/parity-recovery/evidence/native/harness-93862fc/business-empty/light/business-today/native-product-1080x2004.png',
      darkNative:
        'docs/parity-recovery/evidence/native/harness-93862fc/business-empty/dark/business-today/native-product-1080x2004.png',
      lightOverlay:
        'docs/parity-recovery/evidence/comparisons/93862fc/business-empty/light/business-today/overlay-50.png',
      darkOverlay:
        'docs/parity-recovery/evidence/comparisons/93862fc/business-empty/dark/business-today/overlay-50.png',
      differenceImages: [
        'docs/parity-recovery/evidence/comparisons/93862fc/business-empty/light/business-today/absolute-difference.png',
        'docs/parity-recovery/evidence/comparisons/93862fc/business-empty/dark/business-today/absolute-difference.png',
      ],
      comparisonCount: 2,
    },
    deviation: {
      status: 'open',
      reason:
        'Measured Light/Dark differences remain after answer-spine and business-chrome calibration.',
      consequence:
        'The source synthetic example-data action and companion perch intentionally remain absent pending a non-synthetic native equivalent and owner review; fine raster and palette still require physical-S9 review.',
      metrics: {
        lightMeanAbsoluteRgbDelta: 40.7596,
        darkMeanAbsoluteRgbDelta: 36.5989,
      },
    },
  },
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
      reason:
        'Measured Light/Dark pixel differences remain after dedicated Melo composition calibration.',
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

const nativeRows = collections.flatMap(([kind, rows]) => rows.map((entry) => ({ kind, entry })));
const nativeStableIds = new Set(nativeRows.map(({ entry }) => entry.stableId));
for (const resolution of ownerResolutions.entries) {
  if (!nativeStableIds.has(resolution.nativeStableId)) {
    throw new Error(
      `Owner-resolution registry references unknown native surface ${resolution.nativeStableId}.`,
    );
  }
  if (!['exact-owner', 'true-exception'].includes(resolution.disposition)) {
    throw new Error(
      `Unsupported owner disposition ${resolution.disposition} for ${resolution.nativeStableId}.`,
    );
  }
  if (resolution.disposition === 'exact-owner') {
    if (!resolution.designOwner?.stableId || !resolution.designOwner?.sourceReference) {
      throw new Error(`Exact owner ${resolution.nativeStableId} is missing its design owner.`);
    }
    await access(
      path.join(
        ownerResolutions.designCheckout,
        sourcePath(resolution.designOwner.sourceReference),
      ),
    );
  } else if (
    !resolution.reasonCode ||
    !resolution.evidence ||
    !Array.isArray(resolution.searchedAuthorities) ||
    resolution.searchedAuthorities.length === 0
  ) {
    throw new Error(`True exception ${resolution.nativeStableId} lacks auditable evidence.`);
  }
}

const initiallyUnresolved = nativeRows.filter(({ kind, entry }) => {
  const owners = resolveDesignOwners(kind, entry);
  return !owners.some((owner) =>
    ['exact-route-key', 'exact-source-hint'].includes(owner.resolution),
  );
});
const initiallyUnresolvedIds = new Set(initiallyUnresolved.map(({ entry }) => entry.stableId));
for (const nativeStableId of initiallyUnresolvedIds) {
  if (!ownerResolutionByNativeId.has(nativeStableId)) {
    throw new Error(`Unresolved native design owner lacks disposition: ${nativeStableId}.`);
  }
}
for (const nativeStableId of ownerResolutionByNativeId.keys()) {
  if (!initiallyUnresolvedIds.has(nativeStableId)) {
    throw new Error(
      `Owner override is not needed because the surface already resolves: ${nativeStableId}.`,
    );
  }
}
if (
  initiallyUnresolvedIds.size !== ownerResolutions.counts.previouslyUnresolved ||
  ownerResolutionByNativeId.size !== ownerResolutions.counts.previouslyUnresolved
) {
  throw new Error(
    `Owner-resolution coverage mismatch: registry=${ownerResolutionByNativeId.size}, initially unresolved=${initiallyUnresolvedIds.size}, declared=${ownerResolutions.counts.previouslyUnresolved}.`,
  );
}

let entries = collections
  .flatMap(([kind, rows]) =>
    rows.map((entry) => {
      const ownerResolution = ownerResolutionByNativeId.get(entry.stableId);
      const designOwners =
        ownerResolution?.disposition === 'exact-owner'
          ? [
              {
                stable_id: ownerResolution.designOwner.stableId,
                kind: ownerResolution.designOwner.kind,
                screen_id: ownerResolution.designOwner.routeKey,
                source_ref: ownerResolution.designOwner.sourceReference,
                key_states: ownerResolution.designOwner.keyStates ?? [],
                resolution: 'exact-owner-registry',
                evidence: ownerResolution.evidence,
              },
            ]
          : resolveDesignOwners(kind, entry);
      const calibration = CALIBRATIONS[entry.routeKey];
      const evidence = calibration?.evidence ?? emptyEvidence();
      const hasExactOwner = designOwners.some((owner) =>
        ['exact-route-key', 'exact-source-hint', 'exact-owner-registry'].includes(owner.resolution),
      );
      const trueException =
        ownerResolution?.disposition === 'true-exception'
          ? {
              reasonCode: ownerResolution.reasonCode,
              evidence: ownerResolution.evidence,
              searchedAuthorities: ownerResolution.searchedAuthorities,
            }
          : null;
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
            ...(owner.evidence ? { evidence: owner.evidence } : {}),
          })),
          ownerStatus: trueException ? 'true-exception' : hasExactOwner ? 'resolved' : 'unresolved',
          ...(trueException ? { trueException } : {}),
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

let batchLedgerStats = null;
if (batchLedgerOptions.ledgerPaths.length > 0) {
  const batchLedgers = await Promise.all(batchLedgerOptions.ledgerPaths.map(readBatchLedger));
  const batchLedger = combineBatchLedgers(batchLedgers);
  const merged = await mergeBatchLedgerEvidence(entries, batchLedger, { root: ROOT });
  entries = merged.entries;
  batchLedgerStats = merged.stats;
}

let contractLedgerStats = null;
if (contractLedgerOptions.ledgerPath) {
  const contractLedger = await readContractLedger(contractLedgerOptions.ledgerPath);
  const merged = await mergeContractLedgerEvidence(entries, contractLedger, { root: ROOT });
  entries = merged.entries;
  contractLedgerStats = merged.stats;
}

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
      ...(entry.evidence.comparisons ?? []).flatMap((comparison) => [
        comparison.source,
        comparison.native,
        comparison.overlay,
        comparison.difference,
      ]),
      ...(entry.evidence.contractCaptures ?? []).map((capture) => capture.nativeFull),
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
const trueExceptionCount = entries.filter(
  (entry) => entry.design.ownerStatus === 'true-exception',
).length;
const unresolvedOwnerCount = entries.filter(
  (entry) => entry.design.ownerStatus === 'unresolved',
).length;
if (
  trueExceptionCount !== ownerResolutions.counts.trueExceptions ||
  ownerResolvedCount !== entries.length - trueExceptionCount ||
  unresolvedOwnerCount !== ownerResolutions.counts.remainingUnresolved
) {
  throw new Error(
    `Resolved-owner count mismatch: exact=${ownerResolvedCount}, exceptions=${trueExceptionCount}, unresolved=${unresolvedOwnerCount}.`,
  );
}
const comparedSurfaceCount = entries.filter((entry) => entry.evidence.comparisonCount > 0).length;
const contractSurfaceCount = entries.filter(
  (entry) => (entry.evidence.contractCaptures?.length ?? 0) > 0,
).length;
const directEvidenceSurfaceCount = entries.filter(
  (entry) =>
    entry.evidence.comparisonCount > 0 || (entry.evidence.contractCaptures?.length ?? 0) > 0,
).length;
if (
  batchLedgerOptions.expectedDirectCount !== null &&
  comparedSurfaceCount !== batchLedgerOptions.expectedDirectCount
) {
  throw new Error(
    `Directly evidenced unique count mismatch: expected ${batchLedgerOptions.expectedDirectCount}, found ${comparedSurfaceCount}.`,
  );
}
if (batchLedgerStats && batchLedgerStats.finalDirectSurfaceCount !== comparedSurfaceCount) {
  throw new Error(
    `Batch merge direct count mismatch: merge=${batchLedgerStats.finalDirectSurfaceCount}, crosswalk=${comparedSurfaceCount}.`,
  );
}
if (
  contractLedgerOptions.expectedDirectEvidenceCount !== null &&
  directEvidenceSurfaceCount !== contractLedgerOptions.expectedDirectEvidenceCount
) {
  throw new Error(
    `Direct evidence count mismatch: expected ${contractLedgerOptions.expectedDirectEvidenceCount}, found ${directEvidenceSurfaceCount}.`,
  );
}
if (
  contractLedgerStats &&
  contractLedgerStats.finalDirectEvidenceSurfaceCount !== directEvidenceSurfaceCount
) {
  throw new Error(
    `Contract merge direct count mismatch: merge=${contractLedgerStats.finalDirectEvidenceSurfaceCount}, crosswalk=${directEvidenceSurfaceCount}.`,
  );
}
const lightComparisons = new Set(comparisonPaths(entries, 'light').filter(Boolean));
const darkComparisons = new Set(comparisonPaths(entries, 'dark').filter(Boolean));
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
    ownerResolutionRegistry: path.relative(ROOT, OWNER_RESOLUTIONS_PATH).replaceAll('\\', '/'),
    ...(batchLedgerOptions.ledgerPaths.length > 0
      ? {
          ...(batchLedgerOptions.ledgerPaths.length === 1
            ? {
                batchLedger: path
                  .relative(ROOT, batchLedgerOptions.ledgerPaths[0])
                  .replaceAll('\\', '/'),
              }
            : {
                batchLedgers: batchLedgerOptions.ledgerPaths.map((ledgerPath) =>
                  path.relative(ROOT, ledgerPath).replaceAll('\\', '/'),
                ),
              }),
        }
      : {}),
    ...(contractLedgerOptions.ledgerPath
      ? {
          contractLedger: path
            .relative(ROOT, contractLedgerOptions.ledgerPath)
            .replaceAll('\\', '/'),
        }
      : {}),
    primaryAcceptanceDevice: DEVICE_RELATIVE_PATH,
  },
  statusPolicy: {
    passingTestsDoNotImplyVisualParity: true,
    ownerApprovalRequired: true,
    missingEvidenceIsNotAPass: true,
    contractCaptureIsDirectEvidenceButNotAPixelPair: true,
  },
  counts: {
    nativeShippingSurfaces: entries.length,
    exactDesignOwnersResolved: ownerResolvedCount,
    explicitTrueExceptions: trueExceptionCount,
    resolvedOrExplicitException: ownerResolvedCount + trueExceptionCount,
    unresolvedDesignOwners: unresolvedOwnerCount,
    surfacesWithDirectComparison: comparedSurfaceCount,
    surfacesMissingDirectComparison: entries.length - comparedSurfaceCount,
    surfacesWithDirectContractCapture: contractSurfaceCount,
    surfacesWithDirectEvidence: directEvidenceSurfaceCount,
    surfacesMissingDirectEvidence: entries.length - directEvidenceSurfaceCount,
    comparisonCount,
    lightComparisonCount: lightComparisons.size,
    darkComparisonCount: darkComparisons.size,
    designSurfacesNotMappedToNativeShippingSurface: unmappedDesign.length,
    ...(batchLedgerStats
      ? {
          batchLedgerPairs: batchLedgerStats.ledgerPairCount,
          batchLedgerUniquePairs: batchLedgerStats.uniqueBatchPairCount,
          batchLedgerDuplicatePairs: batchLedgerStats.duplicatePairCount,
          batchLedgerStableSurfaces: batchLedgerStats.batchStableSurfaceCount,
          batchLedgerPreservedOverlaps: batchLedgerStats.preservedOverlapCount,
          batchLedgerComparisonsReplaced: batchLedgerStats.replacedComparisonCount,
          batchLedgerComparisonsAdded: batchLedgerStats.addedComparisonCount,
        }
      : {}),
    ...(contractLedgerStats
      ? {
          contractLedgerSurfaces: contractLedgerStats.contractSurfaceCount,
          contractLedgerCaptures: contractLedgerStats.contractCaptureCount,
        }
      : {}),
  },
  entries,
  unmappedDesignSurfaces: unmappedDesign,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output.counts, null, 2));
