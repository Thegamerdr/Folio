import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url).href);
const evidenceRoot = `${repoRoot}apps/mobile/evidence/android-dogfood-pack-2026-06-23/`;

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function evidence(path: string): string {
  return read(`${evidenceRoot}${path}`);
}

describe('Android dogfood pack evidence', () => {
  it('provides owner-facing install, scenario and scorecard docs', () => {
    const install = read(`${repoRoot}ANDROID_DOGFOOD_INSTALL.md`);
    const scenarios = read(`${repoRoot}ANDROID_DOGFOOD_SCENARIOS.md`);
    const scorecard = read(`${repoRoot}ANDROID_DOGFOOD_SCORECARD.md`);

    expect(install).toContain('pnpm --filter @folio/mobile native:apk:android');
    expect(install).toContain(
      'adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk',
    );
    expect(install).toContain('More -> Data control -> Clear data -> Arm clear -> Clear records');
    expect(install).toContain('adb logcat -d -t 2000');
    expect(install).toContain('pnpm --filter @folio/mobile eas:android:tester');
    expect(scenarios).toContain('Scenario 1 - Empty First Launch');
    expect(scenarios).toContain('Scenario 8 - Stress / Bad Month');
    expect(scenarios).toContain('2026-06-21, Tesco, -42.18');
    expect(scorecard).toContain('Ready for continued owner dogfood');
    expect(scorecard).toContain('Needs fixes before owner dogfood');
    expect(scorecard).toContain('Blocked');
  });

  it('records build, install and runtime evidence for the local APK dogfood path', () => {
    const build = evidence('BUILD_COMMANDS_ATTEMPTED.md');
    const runtime = evidence('RUNTIME_NOTES.md');
    const commandSummary = evidence('logs/command-summary.md');
    const apkArtifact = evidence('logs/apk-artifact.txt');
    const firstLaunch = evidence('xml/01-clean-first-launch.xml');
    const persisted = evidence('xml/07-after-restart-persistence.xml');
    const exportPrepared = evidence('xml/11-data-control-export-prepared.xml');
    const clearArmed = evidence('xml/15-data-control-clear-armed.xml');
    const afterClear = evidence('xml/16-data-control-after-clear.xml');
    const offline = evidence('xml/17-offline-today-after-clear.xml');

    expect(build).toContain('Result: passed');
    expect(build).toContain('Not logged in');
    expect(commandSummary).toContain('21/21 checks passed');
    expect(commandSummary).toContain('Install exit code: 0');
    expect(apkArtifact).toContain('app-release.apk');
    expect(firstLaunch).toContain('First minute screen');
    expect(firstLaunch).toContain('No account, cloud or AI is required to start');
    expect(persisted).toContain('Today screen');
    expect(persisted).toContain('Local mode. Saved on this device');
    expect(exportPrepared).toContain('folio-local-export-2026-06-23.json');
    expect(clearArmed).toContain('Cancel clear');
    expect(clearArmed).toContain('Clear records');
    expect(afterClear).toContain('Local records were cleared');
    expect(afterClear).toContain('not a confirmed zero bank balance');
    expect(offline).toContain('Today screen');
    expect(offline).toContain('empty local baseline');
    expect(runtime).toContain('Persistence after restart');
    expect(runtime).toContain('Offline local Today');
  });

  it('keeps dogfood safety checks explicit and supported by evidence', () => {
    const readme = evidence('README.md');
    const checklist = evidence('SCENARIO_CHECKLIST.md');
    const limitations = evidence('KNOWN_LIMITATIONS.md');
    const runtimeXml = [
      evidence('xml/01-clean-first-launch.xml'),
      evidence('xml/06-today-after-save.xml'),
      evidence('xml/09-data-control.xml'),
      evidence('xml/16-data-control-after-clear.xml'),
      evidence('xml/17-offline-today-after-clear.xml'),
    ].join('\n');

    for (const phrase of [
      'local-first',
      'account-free at first launch',
      'cloud optional',
      'AI optional',
      'Open Banking optional',
      'review-before-reality',
      'no fake scores',
      'no advice language',
      'no shame language',
      'rejected evidence outside financial reality',
      'Melo as interpreter, not direct writer',
      'Business explicitly separate',
    ]) {
      expect(readme).toContain(phrase);
    }

    expect(checklist).toContain('empty baseline is explicitly not a confirmed zero bank balance');
    expect(limitations).toContain('No Play Store release');
    expect(runtimeXml).not.toMatch(
      /\b(?:shame|streak|score|guaranteed|investment advice|financial advice|best decision|best choice|failed|failure)\b|\byou should\b/iu,
    );
  });
});
