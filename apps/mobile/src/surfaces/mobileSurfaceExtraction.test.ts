import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoutePath = fileURLToPath(new URL('../../app/index.tsx', import.meta.url).href);
const appRouteSource = readFileSync(appRoutePath, 'utf8');
const mobileShellPath = fileURLToPath(new URL('./mobileShell.tsx', import.meta.url).href);
const mobileShellSource = readFileSync(mobileShellPath, 'utf8');
const productExperienceLoopPath = fileURLToPath(
  new URL('../local/productExperienceLoop.ts', import.meta.url).href,
);
const productExperienceLoopSource = readFileSync(productExperienceLoopPath, 'utf8');
const surfaceFiles = [
  'calendarSurface.tsx',
  'compactMeloNoteSurface.tsx',
  'dataControlSurface.tsx',
  'firstMinuteSurface.tsx',
  'importReviewSurface.tsx',
  'manualPathSurface.tsx',
  'meloSurface.tsx',
  'plansSurface.tsx',
  'recoverySurface.tsx',
  'sampleBriefingSurface.tsx',
  'timelineSurface.tsx',
  'todaySurface.tsx',
] as const;
const namedSurfaceSource = surfaceFiles
  .map((file) => readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url).href), 'utf8'))
  .join('\n');
const extractedSurfaceSource = `${mobileShellSource}\n${namedSurfaceSource}\n${productExperienceLoopSource}`;

describe('mobile shell extracted product surfaces', () => {
  it('keeps app/index as orchestration below the requested line ceiling', () => {
    expect(appRouteSource.split(/\r?\n/u).length).toBeLessThan(4000);
    expect(appRouteSource).toContain("from '../src/surfaces/mobileShell'");
    expect(appRouteSource).not.toContain('function TimelineList');
    expect(appRouteSource).not.toContain('StyleSheet.create');
  });

  it('extracts the requested major surfaces as real rendering components', () => {
    const expectedComponents = [
      'FirstMinuteScreen',
      'StartScreen',
      'SampleBriefingScreen',
      'QuickEstimateScreen',
      'TodayScreen',
      'TimelineScreen',
      'CalendarScreen',
      'PlansScreen',
      'RecoveryScreen',
      'ImportReviewScreen',
      'MeloScreen',
      'DataControlScreen',
      'TimelineList',
      'InteractionRibbon',
      'FolioRevealRow',
      'PrimaryButton',
      'RouteRow',
    ];

    for (const component of expectedComponents) {
      expect(mobileShellSource).toContain(`function ${component}`);
    }

    expect(mobileShellSource).toContain('function groupTimelineEvents');
    expect(mobileShellSource).toContain('function timelineGroupId');
    expect(mobileShellSource).toContain('function timelineEventKey');
    expect(mobileShellSource).toContain(
      'const key = timelineEventKey(group.id, event, eventIndex)',
    );
    expect(mobileShellSource).toContain('StyleSheet.create');
  });

  it('renders the primary copy for the named product surfaces', () => {
    const expectedCopy = [
      'Know where you stand.',
      'Will your money last to payday?',
      'See where you stand',
      'I need to make it to payday',
      'Organise debts',
      'Try fake data',
      'See how Folio works without using your data.',
      'What changed?',
      'Needs review',
      'Money-aware planner',
      'Your plans',
      'Preview a pressure point before recording it.',
      'Recovery saved',
      'Your reviewed update is now part of the plan.',
      'Check these before they count.',
      'Interpreter, not authority',
      'Your data stays inspectable.',
      'Clear deliberately',
      'Now',
      'Plan movement',
      'History',
      'Melo noticed',
      'Why it matters',
      'Your control',
    ];

    for (const copy of expectedCopy) {
      expect(extractedSurfaceSource).toContain(copy);
    }
  });

  it('keeps review-first consequences visible in Import Review', () => {
    expect(extractedSurfaceSource).toContain('Add keeps this payment in your money view.');
    expect(extractedSurfaceSource).toContain('Edit keeps the original and stores your correction.');
    expect(extractedSurfaceSource).toContain('Ignore keeps the original wording');
    expect(extractedSurfaceSource).toContain('What to check');
  });

  it('keeps primary mobile actions accessible after the polish pass', () => {
    const expectedAccessibleActions = [
      'See where you stand',
      'Organise debts',
      'Check bills',
      'Use a bank statement',
      'Try fake data',
      'Test a purchase',
      'See sources',
      'Prepare export file',
      'Ask Melo',
      'Add',
    ];

    for (const label of expectedAccessibleActions) {
      expect(extractedSurfaceSource).toContain(label);
    }
    expect(extractedSurfaceSource).toContain('accessibilityLabel={label}');
    expect(extractedSurfaceSource).toContain('accessibilityRole="button"');
  });

  it('keeps native runtime layout fixes for bottom actions and timeline labels', () => {
    // Bottom-nav clearance is now flex-driven (the nav is a flex sibling below the flex:1
    // ScrollView and carries its own safe-area inset) rather than a device-tuned magic reserve.
    // The old `paddingBottom: 184` left a dead band + cut content on phones whose nav-bar inset
    // differed from the emulator; content now just keeps breathing room above the nav.
    expect(mobileShellSource).toContain('paddingBottom: spacing.xl');
    expect(mobileShellSource).toContain('numberOfLines={1}');
    expect(mobileShellSource).toContain('width: 58');
  });

  it('keeps extracted surfaces free of forbidden product wording', () => {
    expect(extractedSurfaceSource).not.toMatch(
      /\b(?:confidence|score|investment advice|debt advice|shame|streak)\b/iu,
    );
    expect(extractedSurfaceSource).not.toMatch(/cloud\s+(?:required|mandatory)/iu);
    expect(extractedSurfaceSource).not.toMatch(/Open Banking\s+(?:required|mandatory)/iu);
    expect(extractedSurfaceSource).not.toMatch(/This anchors the picture/iu);
    expect(extractedSurfaceSource).not.toMatch(/Folio needs one starting number/iu);
    expect(extractedSurfaceSource).not.toMatch(/Rows wait in Review/iu);
    expect(extractedSurfaceSource).not.toMatch(/Folio asks one thing/iu);
    expect(extractedSurfaceSource).not.toMatch(/Records change after your tap/iu);
    expect(extractedSurfaceSource).not.toMatch(/Route pressure/iu);
  });
});
