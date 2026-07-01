import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createCanonicalRepositoryForLocalLedgerState } from './canonicalLedgerRepository.js';
import {
  buildDogfoodStatus,
  buildRedactedDogfoodDiagnosticBundle,
  createDogfoodResetState,
  createDogfoodScenarioSeeds,
  dogfoodModeContract,
  isDogfoodScenarioState,
  prepareDogfoodScenarioState,
} from './dogfoodMode.js';
import { buildLocalRouteSummary } from './localLedger.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url).href);
// The pressure-map app was moved from app/index.tsx to app/home.tsx (reachable at /home) when the
// live route was flipped to the FolioShell; the developer-mode/dogfood gating this asserts lives on
// the (unchanged) pressure-map route, now at home.tsx.
const appRouteSource = readFileSync(`${repoRoot}apps/mobile/app/home.tsx`, 'utf8');
const shellSource = readFileSync(`${repoRoot}apps/mobile/src/surfaces/mobileShell.tsx`, 'utf8');
const dogfoodSource = readFileSync(`${repoRoot}apps/mobile/src/local/dogfoodMode.ts`, 'utf8');
const nativeDiagnosticSource = readFileSync(
  `${repoRoot}apps/mobile/src/local/nativeDogfoodDiagnosticExport.ts`,
  'utf8',
);

const bannedHarnessCopy =
  /\bconfidence\b|confidence_|_confidence|\bscore\b|\badvice\b|\bshame\b|\bfailed\b|\bfailure\b|\byou should\b/i;

describe('internal dogfood mode harness', () => {
  it('is internal/test, local-only and gated behind explicit developer mode', () => {
    expect(dogfoodModeContract).toMatchObject({
      label: 'Internal test mode',
      localOnly: true,
      uploadAllowed: false,
      requiresAccount: false,
      requiresAi: false,
      requiresCloud: false,
      requiresOpenBanking: false,
      syntheticSeedsOnly: true,
    });
    expect(shellSource).toContain('DogfoodModeScreen');

    // The internal-test surface still exists for developers, but it is gated behind an explicit
    // developerModeEnabled flag and is never rendered in normal user UI. Its "fake seeds" wording
    // only appears inside that gate.
    expect(shellSource).toMatch(/developerModeEnabled \?[\s\S]*title="Internal test mode"/u);
    expect(shellSource).toMatch(/developerModeEnabled \?[\s\S]*[Ff]ake seeds/u);

    // Developer mode itself is only available in development builds, never in a released app.
    expect(appRouteSource).toContain('const DEVELOPER_MODE_AVAILABLE = __DEV__;');
    expect(appRouteSource).toContain('onOpenDogfood={openDogfoodMode}');
    expect(appRouteSource).toContain("setScreen('dogfood')");
  });

  it('does not add an upload path for diagnostics or dogfood mode', () => {
    const implementation = `${dogfoodSource}\n${nativeDiagnosticSource}\n${appRouteSource}`;

    expect(dogfoodSource).toContain('uploadAllowed: false');
    expect(nativeDiagnosticSource).toContain('FileSystem.writeAsStringAsync');
    expect(nativeDiagnosticSource).not.toMatch(
      /\b(fetch|XMLHttpRequest|axios|uploadAsync|https?:\/\/|FormData)\b/,
    );
    expect(implementation).not.toMatch(/dogfood[\s\S]{0,120}\.(?:post|put|send)\(/i);
  });

  it('provides the requested synthetic scenario seeds and keeps sample mode out of records', () => {
    const seeds = createDogfoodScenarioSeeds('2026-06-23');

    expect(seeds.map((seed) => seed.id)).toEqual([
      'empty_first_launch',
      'sample_briefing',
      'minimal_manual_user',
      'one_upcoming_bill',
      'rejected_import',
      'duplicate_rejected_import',
      'accepted_import',
      'edited_import',
      'active_plan',
      'bad_month_recovery_preview',
      'accepted_recovery',
      'document_attachment',
      'calendar_planner_items',
      'data_control_export',
    ]);
    expect(seeds.every((seed) => seed.synthetic)).toBe(true);
    expect(seeds.find((seed) => seed.id === 'sample_briefing')).toMatchObject({
      sampleOnly: true,
      canonicalRecordCounts: expect.objectContaining({
        importDrafts: 0,
        plans: 0,
        scenarios: 0,
        transactions: 0,
      }),
      targetScreen: 'sampleBriefing',
    });
    expect(seeds.find((seed) => seed.id === 'accepted_import')).toMatchObject({
      sampleOnly: false,
      targetScreen: 'import',
    });
    expect(seeds.find((seed) => seed.id === 'bad_month_recovery_preview')).toMatchObject({
      sampleOnly: false,
      targetScreen: 'recovery',
    });
  });

  it('marks non-empty loaded seeds as internal/test data across restart', () => {
    const seeds = createDogfoodScenarioSeeds('2026-06-23');
    const minimal = seeds.find((seed) => seed.id === 'minimal_manual_user');
    const empty = seeds.find((seed) => seed.id === 'empty_first_launch');

    expect(minimal).toBeDefined();
    expect(empty).toBeDefined();

    const marked = prepareDogfoodScenarioState(minimal!);
    const stillEmpty = prepareDogfoodScenarioState(empty!);

    expect(isDogfoodScenarioState(marked)).toBe(true);
    expect(marked.history[0]).toMatchObject({
      id: 'history_dogfood_seed_minimal_manual_user',
      label: 'Internal test fake seed loaded: Minimal manual user.',
    });
    expect(isDogfoodScenarioState(stillEmpty)).toBe(false);
    expect(stillEmpty.history).toEqual([]);
  });

  it('resets to empty canonical local data and reports object counts from the repository', () => {
    const reset = createDogfoodResetState('2026-06-23');
    const route = buildLocalRouteSummary(reset);
    const status = buildDogfoodStatus(reset, route);

    expect(status.workspaceState).toMatchObject({
      empty: true,
      privateExample: false,
      workspaceKind: 'personal',
    });
    expect(status.canonicalObjectCounts.transactions).toBe(0);
    expect(status.canonicalObjectCounts.events).toBe(0);
    expect(status.canonicalObjectCounts.importDrafts).toBe(0);
    expect(status.canonicalObjectCounts.plans).toBe(0);
    expect(status.canonicalObjectCounts.scenarios).toBe(0);
    expect(status.canonicalObjectCounts.auditLog).toBe(0);
    expect(status.routeState).toMatchObject({
      confirmedRecords: 0,
      pendingReview: 0,
      routePoints: 1,
    });
  });

  it('exports redacted diagnostics by default without raw financial rows or source wording', () => {
    const acceptedImport = createDogfoodScenarioSeeds('2026-06-23').find(
      (seed) => seed.id === 'accepted_import',
    );
    expect(acceptedImport).toBeDefined();

    const state = acceptedImport!.state;
    const bundle = buildRedactedDogfoodDiagnosticBundle({
      currentScreen: 'dogfood',
      dogfoodModeEnabled: true,
      lastAction: 'Coffee source row accepted locally.',
      route: buildLocalRouteSummary(state),
      state,
    });
    const serialized = JSON.stringify(bundle.redacted);

    expect(bundle.safeForExport).toBe(true);
    expect(bundle.redactedPaths).toEqual([]);
    expect(bundle.redacted).toMatchObject({
      schema: 'folio-dogfood-diagnostic-v1',
      appBuild: expect.any(Object),
      canonicalObjectCounts: expect.any(Object),
      currentRoute: expect.any(Object),
      importReviewState: expect.any(Object),
      planRecoveryState: expect.any(Object),
      rejectedEvidenceCount: expect.any(Number),
      workspaceState: expect.any(Object),
    });
    expect(serialized).not.toContain('Coffee');
    expect(serialized).not.toContain('Rent');
    expect(serialized).not.toContain('875');
    expect(serialized).not.toContain('DD ABOUND');
    expect(bundle.markdown).toContain('Raw financial rows, source text, account details');
  });

  it('keeps rejected evidence non-financial and recovery previews non-mutating', () => {
    const seeds = createDogfoodScenarioSeeds('2026-06-23');
    const rejected = seeds.find((seed) => seed.id === 'rejected_import');
    const preview = seeds.find((seed) => seed.id === 'bad_month_recovery_preview');
    const acceptedRecovery = seeds.find((seed) => seed.id === 'accepted_recovery');

    expect(rejected).toBeDefined();
    expect(preview).toBeDefined();
    expect(acceptedRecovery).toBeDefined();

    const rejectedSnapshot = createCanonicalRepositoryForLocalLedgerState(
      rejected!.state,
    ).snapshot();
    const previewSnapshot = createCanonicalRepositoryForLocalLedgerState(preview!.state).snapshot();
    const acceptedRecoverySnapshot = createCanonicalRepositoryForLocalLedgerState(
      acceptedRecovery!.state,
    ).snapshot();

    expect(rejectedSnapshot.collections.transactions).toEqual([]);
    expect(rejectedSnapshot.collections.importedClaims).toContainEqual(
      expect.objectContaining({ nonFinancial: true, state: 'rejected' }),
    );
    expect(previewSnapshot.collections.scenarios).toEqual([]);
    expect(acceptedRecoverySnapshot.collections.scenarios).toContainEqual(
      expect.objectContaining({ status: 'accepted' }),
    );
    expect(acceptedRecoverySnapshot.collections.decisions).toContainEqual(
      expect.objectContaining({ kind: 'accept-scenario' }),
    );
  });

  it('keeps dogfood harness copy free of fake scores, advice and shame wording', () => {
    const seeds = createDogfoodScenarioSeeds('2026-06-23');
    const reset = createDogfoodResetState('2026-06-23');
    const bundle = buildRedactedDogfoodDiagnosticBundle({
      currentScreen: 'dogfood',
      dogfoodModeEnabled: true,
      route: buildLocalRouteSummary(reset),
      state: reset,
    });
    const harnessCopy = [
      dogfoodModeContract.label,
      ...seeds.flatMap((seed) => [seed.title, seed.description]),
      bundle.markdown,
    ].join(' ');

    expect(harnessCopy).not.toMatch(bannedHarnessCopy);
  });

  it('ships the owner dogfood documents and dated evidence folder', () => {
    const install = readFileSync(`${repoRoot}ANDROID_INSTALL_FOR_OWNER.md`, 'utf8');
    const script = readFileSync(`${repoRoot}ANDROID_OWNER_DOGFOOD_SCRIPT.md`, 'utf8');
    const template = readFileSync(`${repoRoot}DOGFOOD_BUG_REPORT_TEMPLATE.md`, 'utf8');
    const evidenceRoot = `${repoRoot}apps/mobile/evidence/owner-dogfood-prep-2026-06-23/`;
    const evidenceReadme = readFileSync(`${evidenceRoot}README.md`, 'utf8');
    const diagnostic = readFileSync(`${evidenceRoot}DIAGNOSTIC_BUNDLE.md`, 'utf8');
    const seeds = readFileSync(`${evidenceRoot}SCENARIO_SEED_LIST.md`, 'utf8');
    const limitations = readFileSync(`${evidenceRoot}KNOWN_LIMITATIONS.md`, 'utf8');
    const ciResult = readFileSync(`${evidenceRoot}CI_RESULT.md`, 'utf8');

    expect(install).toContain('pnpm --filter @folio/mobile native:apk:android');
    expect(install).toContain(
      'adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk',
    );
    expect(install).toContain('adb shell pm clear com.folio.v2.greenfield');
    expect(install).toContain('adb shell screenrecord');
    expect(install).toContain('folio-dogfood-diagnostic-YYYY-MM-DD.json');
    expect(script).toContain('1. Install APK');
    expect(script).toContain('18. Record bugs');
    expect(script).toContain('Did I understand what was real vs preview?');
    expect(template).toContain('P0 data/reality/trust issue');
    expect(template).toContain('Did this affect data/reality?');
    expect(evidenceReadme).toContain('pre-dogfood instrumentation pass');
    expect(diagnostic).toContain('raw financial rows');
    expect(diagnostic).toContain('last 20 non-sensitive app events');
    expect(seeds).toContain('bad_month_recovery_preview');
    expect(seeds).toContain('accepted_recovery');
    expect(limitations).toContain('Physical Android owner testing has not been performed');
    expect(ciResult).toContain('pnpm --filter @folio/mobile typecheck');
  });
});
