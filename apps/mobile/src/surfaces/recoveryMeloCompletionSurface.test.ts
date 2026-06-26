import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoutePath = fileURLToPath(new URL('../../app/index.tsx', import.meta.url).href);
const appRouteSource = readFileSync(appRoutePath, 'utf8');
const mobileShellPath = fileURLToPath(new URL('./mobileShell.tsx', import.meta.url).href);
const mobileShellSource = readFileSync(mobileShellPath, 'utf8');

const calendarSource = sourceBetween(
  mobileShellSource,
  'function CalendarScreen',
  'function PlansScreen',
);
const recoverySource = sourceBetween(
  mobileShellSource,
  'function RecoveryScreen',
  'function MoreScreen',
);

describe('Recovery and Calendar Melo completion surfaces', () => {
  it('uses the compact policy-gated Melo note pattern on Calendar', () => {
    expect(calendarSource).toContain('const calendarMeloNote = buildCompactMeloNote({');
    expect(calendarSource).toContain('tightest day');
    expect(calendarSource).toContain('Selected days show route impact before any new save.');
    expect(calendarSource).toContain('Open Review imports or inspect the selected day.');
    expect(calendarSource).toContain('<CompactMeloNoteSurface note={calendarMeloNote} />');
    expect(calendarSource).not.toContain('Melo note. Tightest point');
  });

  it('renders the Recovery saved confirmation only after acceptance', () => {
    const acceptedBranch = sourceBetween(
      recoverySource,
      'if (acceptedConfirmation !== null)',
      'Preview a pressure point before recording it.',
    );
    const previewBranch = sourceBetween(
      recoverySource,
      'Preview a pressure point before recording it.',
      'label="Back without saving"',
    );

    expect(acceptedBranch).toContain('Recovery saved');
    expect(acceptedBranch).toContain('Your reviewed update is now part of the plan.');
    expect(acceptedBranch).toContain('What changed');
    expect(acceptedBranch).toContain('Still protected');
    expect(acceptedBranch).toContain('Decision evidence');
    expect(acceptedBranch).toContain('Next review');
    expect(acceptedBranch).toContain('acceptedConfirmation.evidencePath');
    expect(mobileShellSource).toContain(
      'Timeline decision entry and Data and privacy audit history',
    );
    expect(previewBranch).not.toContain('Recovery saved');
    expect(previewBranch).not.toContain('Your reviewed update is now part of the plan.');
  });

  it('keeps Recovery acceptance behind a successful user write', () => {
    const recordButtonBlock = sourceBetween(
      recoverySource,
      'label="Record locally"',
      'label="Back without saving"',
    );

    expect(recordButtonBlock).toContain('const saved = onRecordRecoverySpend({');
    expect(recordButtonBlock).toContain('if (!saved) return;');
    expect(recordButtonBlock).toContain('setAcceptedConfirmation(');
    expect(recordButtonBlock).toContain('onRecoveryAccepted();');
    expect(recordButtonBlock).not.toContain('onReturnToday()');
    expect(appRouteSource).toContain('const primaryScrollRef = useRef<ScrollView | null>(null);');
    expect(appRouteSource).toContain(
      'primaryScrollRef.current?.scrollTo({ animated: false, y: 0 });',
    );
    expect(appRouteSource).toContain('return true;');
    expect(appRouteSource).toContain('return false;');
  });

  it('keeps new Calendar and Recovery copy free of advice, shame and fake certainty', () => {
    const passCopy = [calendarSource, recoverySource].join('\n');

    expect(passCopy).not.toMatch(
      /\b(?:guaranteed|score|streak|shame|investment advice|financial advice|best decision|best choice|failed|failure)\b|\byou should\b/iu,
    );
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
