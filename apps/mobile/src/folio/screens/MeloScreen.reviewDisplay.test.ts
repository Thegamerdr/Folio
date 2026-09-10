import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatFinancialDate } from '../lib/financialPresentation';

const source = readFileSync(new URL('./MeloScreen.tsx', import.meta.url), 'utf8');

describe('Melo ritual entry describes the saved review', () => {
  it('uses the shared readable date for the recorded review instead of raw ISO', () => {
    expect(formatFinancialDate('2026-09-10')).toBe('10 Sept 2026');
    expect(source).toContain('formatFinancialDate(lastCycle)');
    expect(source).not.toContain('`last · ${lastCycle}`');
    expect(source).toContain('no recorded review');
  });

  it('labels the existing ritual and Insights destinations without completed-month claims', () => {
    expect(source).toContain('review your forecast together');
    expect(source).toContain('your recorded forecast reviews');
    expect(source).not.toContain('close the cycle together');
    expect(source).toContain('style={styles.ritualHeader}');
    expect(source).toContain("nav.go('ritual')");
    expect(source).toContain("nav.go('insights')");
  });
});
