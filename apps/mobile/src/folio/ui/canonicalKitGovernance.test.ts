import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const uiDirectory = dirname(fileURLToPath(import.meta.url));

const canonicalSharedControls = [
  'AdjustPathTabs.tsx',
  'AppLockGate.tsx',
  'BulkStatementLanding.tsx',
  'BusinessBottomNav.tsx',
  'IntakeResultRail.tsx',
  'MeloReaction.tsx',
  'ModeFramingBanner.tsx',
  'MoneyModeChip.tsx',
  'PersonalBottomNav.tsx',
  'ReviewJourneyTabs.tsx',
  'ScreenHeader.tsx',
  'StubDisclaimer.tsx',
  'Toast.tsx',
  'TrialCountdownChip.tsx',
  'TrialEndedRow.tsx',
  'TrustedCoreSurfaces.tsx',
  'UndoToast.tsx',
  'WhatChangedRow.tsx',
  'WorkspaceControl.tsx',
] as const;

describe('canonical shared control governance', () => {
  it.each(canonicalSharedControls)('%s uses the fixed semantic type scale', (filename) => {
    const source = readFileSync(join(uiDirectory, filename), 'utf8');
    expect(source).not.toMatch(/fontSize:\s*\d/u);
  });

  it.each(canonicalSharedControls)('%s does not invent a pill radius', (filename) => {
    const source = readFileSync(join(uiDirectory, filename), 'utf8');
    expect(source).not.toMatch(/borderRadius:\s*999/u);
  });
});
