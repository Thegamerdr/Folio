import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const evidenceRoot = fileURLToPath(
  new URL('../../evidence/recovery-melo-completion-pass-2026-06-23/android/xml/', import.meta.url)
    .href,
);

function xml(name: string): string {
  return readFileSync(`${evidenceRoot}${name}`, 'utf8');
}

const selectedEvidence = [
  '23-recovery-preview-patched.xml',
  '26-recovery-filled-patched.xml',
  '29-recovery-record-button-patched.xml',
  '30-recovery-accepted-confirmation-patched.xml',
  '31-today-after-recovery-patched.xml',
  '34-calendar-compact-melo-note-patched.xml',
  '35-timeline-decision-audit-patched.xml',
].map(xml);

describe('Recovery and Calendar Melo completion Android evidence', () => {
  it('captures preview-only Recovery before acceptance', () => {
    const preview = xml('23-recovery-preview-patched.xml');
    const filled = xml('26-recovery-filled-patched.xml');
    const recordTarget = xml('29-recovery-record-button-patched.xml');

    expect(preview).toContain('Recovery spend preview screen');
    expect(preview).toContain('This recovery item is still a preview');
    expect(preview).toContain('Nothing is saved until you name it and tap record');
    expect(preview).not.toContain('Recovery saved');
    expect(filled).toContain('Tyre changes the preview route');
    expect(filled).toContain('The pressure is shown as a consequence, not a judgement');
    expect(filled).toContain('Nothing has changed yet');
    expect(filled).toContain('Source: hypothetical');
    expect(recordTarget).toContain('Record locally');
    expect(recordTarget).toContain('Back without saving');
  });

  it('captures the accepted Recovery confirmation before returning to Today', () => {
    const confirmation = xml('30-recovery-accepted-confirmation-patched.xml');

    expect(confirmation).toContain('Recovery saved');
    expect(confirmation).toContain('Your reviewed update is now part of the plan.');
    expect(confirmation).toContain('What changed');
    expect(confirmation).toContain('Tyre is recorded as');
    expect(confirmation).toContain('Still protected');
    expect(confirmation).toContain('Decision evidence');
    expect(confirmation).toContain('Timeline decision entry and Data Control audit history');
    expect(confirmation).toContain('Next review');
    expect(confirmation).toContain('Return to Today');
  });

  it('captures Today, Calendar and Timeline after accepted Recovery', () => {
    const today = xml('31-today-after-recovery-patched.xml');
    const calendar = xml('34-calendar-compact-melo-note-patched.xml');
    const timeline = xml('35-timeline-decision-audit-patched.xml');

    expect(today).toContain('Today screen');
    expect(today).toContain('Route needs attention');
    expect(today).toContain('already real');
    expect(today).toContain('Source: Local ledger');
    expect(calendar).toContain('Calendar screen');
    expect(calendar).toContain('MELO NOTICED');
    expect(calendar).toContain('WHY IT MATTERS');
    expect(calendar).toContain('YOUR CONTROL');
    expect(calendar).toContain('tightest route point');
    expect(calendar).toContain('route items stay source-linked');
    expect(calendar).toContain('Tap a day, inspect sources, or add a reviewed commitment');
    expect(calendar).toContain('Tyre');
    expect(timeline).toContain('Timeline screen');
    expect(timeline).toContain('accept scenario');
    expect(timeline).toContain('Scenario decision recorded');
    expect(timeline).toContain('Tyre recorded from recovery preview');
    expect(timeline).toContain('recovery recorded');
    expect(timeline).toContain('Audit');
  });

  it('keeps captured completion wording free of shame, advice and fake-score language', () => {
    const combined = selectedEvidence.join('\n');

    expect(combined).not.toMatch(/\b(?:shame|streak|score|guaranteed|investment advice)\b/iu);
    expect(combined).not.toMatch(/\byou should\b/iu);
    expect(combined).not.toMatch(/\b(?:failed|failure)\b/iu);
  });
});
