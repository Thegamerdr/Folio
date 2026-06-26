import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const evidenceRoot = fileURLToPath(
  new URL(
    '../../evidence/recovery-replay-melo-ios-readiness-2026-06-23/android-recovery-replay/xml/',
    import.meta.url,
  ).href,
);

function xml(name: string): string {
  return readFileSync(`${evidenceRoot}${name}`, 'utf8');
}

const replayXml = [
  '08-recovery-preview-before-input.xml',
  '09-recovery-preview-filled-before-acceptance.xml',
  '10-recovery-preview-impact-before-acceptance.xml',
  '12-recovery-record-locally-button-visible.xml',
  '13-today-after-accepted-recovery.xml',
  '14-timeline-after-accepted-recovery.xml',
  '15-plans-after-accepted-recovery.xml',
  '17-calendar-agenda-after-accepted-recovery.xml',
  '19-data-control-after-accepted-recovery.xml',
  '22-data-control-record-rows-after-accepted-recovery.xml',
].map(xml);

describe('accepted recovery Android replay evidence', () => {
  it('captures recovery preview before acceptance without presenting it as saved reality', () => {
    const beforeInput = xml('08-recovery-preview-before-input.xml');
    const filledPreview = xml('09-recovery-preview-filled-before-acceptance.xml');
    const impactPreview = xml('10-recovery-preview-impact-before-acceptance.xml');
    const acceptanceTarget = xml('12-recovery-record-locally-button-visible.xml');

    expect(beforeInput).toContain('Melo noticed: This recovery item is still a preview');
    expect(beforeInput).toContain(
      'Your control: Review the preview, then record locally or go back',
    );
    expect(filledPreview).toContain('Repair changes the preview route');
    expect(filledPreview).toContain('The pressure is shown as a consequence, not a judgement');
    expect(impactPreview).toContain('Nothing has changed yet');
    expect(impactPreview).toContain('Source: hypothetical');
    expect(impactPreview).toContain('Scenario preview');
    expect(impactPreview).toContain('Plan projections');
    expect(impactPreview).toContain('1 draft');
    expect(acceptanceTarget).toContain('Nothing is saved yet');
    expect(acceptanceTarget).toContain('Record locally');
    expect(acceptanceTarget).toContain('Back without saving');
  });

  it('captures Today, Timeline, Plans, Calendar and audit state after acceptance', () => {
    const today = xml('13-today-after-accepted-recovery.xml');
    const timeline = xml('14-timeline-after-accepted-recovery.xml');
    const plans = xml('15-plans-after-accepted-recovery.xml');
    const calendar = xml('17-calendar-agenda-after-accepted-recovery.xml');
    const dataControl = xml('19-data-control-after-accepted-recovery.xml');
    const auditRows = xml('22-data-control-record-rows-after-accepted-recovery.xml');

    expect(today).toContain('4 changes are visible');
    expect(today).toContain('not a verdict');
    expect(timeline).toContain('Repair recorded from recovery preview');
    expect(timeline).toContain('Scenario decision recorded');
    expect(timeline).toContain('hypothetical - accepted');
    expect(plans).toContain('Protect Rent');
    expect(plans).toContain('2 linked local records');
    expect(calendar).toContain('Repair');
    expect(calendar).toContain('Money event');
    expect(dataControl).toContain('3 records');
    expect(dataControl).toContain('2 audit items');
    expect(auditRows).toContain('recovery recorded');
    expect(auditRows).toContain('Repair recorded from recovery preview');
    expect(auditRows).toContain('Repair');
    expect(auditRows).toContain('390');
  });

  it('keeps captured replay wording free of shame, advice and fake-score language', () => {
    const combined = replayXml.join('\n');

    expect(combined).not.toMatch(/\b(?:shame|streak|score|guaranteed|investment advice)\b/iu);
    expect(combined).not.toMatch(/\byou should\b/iu);
    expect(combined).not.toMatch(/\b(?:failed|failure)\b/iu);
  });
});
