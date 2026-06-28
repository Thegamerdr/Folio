import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoutePath = fileURLToPath(new URL('../../app/index.tsx', import.meta.url).href);
const appRouteSource = readFileSync(appRoutePath, 'utf8');
const mobileShellPath = fileURLToPath(new URL('./mobileShell.tsx', import.meta.url).href);
const mobileShellSource = readFileSync(mobileShellPath, 'utf8');
const firstMinuteSurfacePath = fileURLToPath(
  new URL('./firstMinuteSurface.tsx', import.meta.url).href,
);
const firstMinuteSurfaceSource = readFileSync(firstMinuteSurfacePath, 'utf8');
const nativeDocumentImportPath = fileURLToPath(
  new URL('../local/nativeDocumentImport.ts', import.meta.url).href,
);
const nativeDocumentImportSource = readFileSync(nativeDocumentImportPath, 'utf8');
const localLedgerPath = fileURLToPath(new URL('../local/localLedger.ts', import.meta.url).href);
const localLedgerSource = readFileSync(localLedgerPath, 'utf8');

const startScreenSource = sourceBetween(
  mobileShellSource,
  'function StartScreen',
  'function QuickEstimateScreen',
);
const reviewScreenSource = sourceBetween(
  mobileShellSource,
  'function ImportReviewScreen',
  'function MeloScreen',
);
const moreScreenSource = sourceBetween(
  mobileShellSource,
  'function MoreScreen',
  'function DogfoodModeScreen',
);
const hydrationSource = sourceBetween(
  appRouteSource,
  'loadCanonicalLocalLedgerState()',
  'const subscription = AppState.addEventListener',
);

describe('cold-user usability rescue surface guard', () => {
  it('opens a new or reset local install on Start', () => {
    expect(hydrationSource).toMatch(/else \{[\s\S]*setScreen\('start'\)/);
    expect(hydrationSource).toMatch(
      /isPrivateExampleLedger\(refreshedLedger\)[\s\S]*setScreen\('start'\)/,
    );
    expect(hydrationSource).not.toContain("setScreen('firstMinute')");
  });

  it('keeps Start to direct job choices and no technical secondary actions', () => {
    const choices = [
      'See where you stand',
      'Use a bank statement',
      'Sort out a debt',
      'Check a bill fits',
      'Have a look with example numbers first',
    ];

    for (const choice of choices) {
      expect(startScreenSource).toContain(choice);
    }

    expect(startScreenSource).toContain('onStartDebtFlow');
    expect(startScreenSource).toContain('onStartBillFlow');
    expect(startScreenSource).not.toContain('Screenshot');
    expect(startScreenSource).not.toContain('Manual quick start');
    expect(firstMinuteSurfaceSource).not.toContain('onOpenData');
    expect(firstMinuteSurfaceSource).not.toContain('onTalkToMelo');
  });

  it('states import truth without adding rows before review', () => {
    expect(reviewScreenSource).toContain('CSV or copied text can create payments to check.');
    // The PDF/screenshot caveat wraps across two source lines in the paste panel, so match the
    // two halves rather than the line-broken whole.
    expect(reviewScreenSource).toContain('PDF and screenshots can be added for');
    expect(reviewScreenSource).toContain('automatic reading is not ready for those files yet');
    expect(reviewScreenSource).toContain('Found — check before saving.');
    expect(localLedgerSource).toContain('Nothing has been added yet. Keep the ones you want.');
    expect(localLedgerSource).toContain(
      'File added for review. Automatic reading is not ready for this file yet. You can still add the important numbers manually.',
    );
    expect(nativeDocumentImportSource).toContain("type: '*/*'");
  });

  it('keeps Today honest when review rows are pending', () => {
    expect(mobileShellSource).toMatch(
      /route\.pendingReviewCount > 0\s*\?\s*'Open details or check what is waiting for you\.'/u,
    );
    expect(mobileShellSource).toContain('Check these before they count.');
    expect(mobileShellSource).toContain("Nothing's saved until you say so. Have a look first.");
  });

  it('keeps user surfaces in More and hides developer tools behind explicit developer mode', () => {
    expect(mobileShellSource).toContain("{ id: 'start', label: 'Start'");
    expect(mobileShellSource).toContain("{ id: 'import', label: 'Review'");
    expect(mobileShellSource).toContain("{ id: 'today', label: 'Today'");
    expect(mobileShellSource).toContain("{ id: 'more', label: 'More'");

    // Normal, user-facing surfaces stay in More.
    expect(moreScreenSource).toContain('title="Timeline"');
    expect(moreScreenSource).toContain('title="Calendar"');
    expect(moreScreenSource).toContain('title="Plans"');
    expect(moreScreenSource).toContain('title="Data and privacy"');

    // Internal / developer language must never be shown unconditionally in normal mode.
    expect(moreScreenSource).not.toContain('Owner-only fake seeds');
    expect(moreScreenSource).not.toContain('title="Try recovery spend"');

    // Developer/test tools are gated behind an explicit developerModeEnabled flag and never
    // render in normal mode.
    expect(moreScreenSource).toMatch(/developerModeEnabled \?[\s\S]*title="Internal test mode"/u);
    expect(moreScreenSource).toMatch(/developerModeEnabled \?[\s\S]*title="Replay first minute"/u);

    // The top-bar "Dev" chip is gated behind developer mode, and developer mode itself is only
    // available in development builds (never in a released app).
    expect(appRouteSource).toContain('const DEVELOPER_MODE_AVAILABLE = __DEV__;');
    expect(appRouteSource).toMatch(/developerModeEnabled \?[\s\S]*contextChipText[\s\S]*Dev/u);
  });
});

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Could not find source range from ${start} to ${end}`);
  }

  return source.slice(startIndex, endIndex);
}
