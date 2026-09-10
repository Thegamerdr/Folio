import { describe, expect, it } from 'vitest';
import { getRetrospect } from './retrospect';
import type { MoneyMode } from './types';
const modes: MoneyMode[] = [
  'survival',
  'stability',
  'growth',
  'debt',
  'optimizer',
  'reset',
  'irregular',
  'household',
  'planning',
  'lowVis',
];
const cycle = {
  closedAt: '2026-09-09',
  label: 'September',
  spare: 565,
  tightPoint: 0,
  setAside: 0,
  note: '',
};
describe('first-cycle Insights', () => {
  it.each(modes)('%s labels the first saved forecast as one review', (mode) => {
    const result = getRetrospect(mode, [cycle], 0);
    expect(result.meloNote).toBe('Your first review is recorded. One snapshot is not a trend.');
    expect(result.trendCaption).toBe('Forecast snapshots · 1 review');
    expect(result.meloNote).not.toContain('last month');
  });
  it('does not treat reconstructed history as a completed comparison', () => {
    expect(
      getRetrospect('survival', [cycle, { ...cycle, reconstructed: true }], 0).meloNote,
    ).toContain('Your first review');
    expect(getRetrospect('survival', [cycle], 0).primary.label).toBe('Latest payday cash forecast');
  });
});

// Same-day reviews must not become two elapsed months, payments or duplicate savings.
describe('recorded snapshot semantics in every lens', () => {
  it.each(modes)(
    '%s keeps two same-day reviews and pot deposits separate from repayment claims',
    (mode) => {
      const records = [
        { ...cycle, closedAt: '2026-09-10', spare: 1990, tightPoint: 200, setAside: 120 },
        { ...cycle, closedAt: '2026-09-10', spare: 1975, tightPoint: 185, setAside: 0 },
      ];
      const before = JSON.stringify(records);
      const result = getRetrospect(mode, records, 85);
      expect(result.eyebrow).toContain('2 recorded reviews');
      expect(result.primary).toMatchObject({
        label: 'Latest payday cash forecast',
        value: '£1,990',
      });
      expect(result.secondary).toMatchObject({ label: 'Average forecast low', value: '£192.50' });
      expect(JSON.stringify(result)).not.toMatch(
        /Sent to repayments|Chipped down|2 months|£3,965|Buffer intact|Recovered so far/,
      );
      expect(JSON.stringify(records)).toBe(before);
    },
  );
  it('does not count reconstructed history as a review and preserves negative forecasts', () => {
    const result = getRetrospect(
      'debt',
      [
        { ...cycle, reconstructed: true },
        { ...cycle, spare: -12.34, tightPoint: -35.67 },
      ],
      0,
    );
    expect(result.eyebrow).toContain('1 recorded review');
    expect(result.primary.value).toBe('−£12.34');
    expect(result.secondary.value).toBe('−£35.67');
    expect(getRetrospect('debt', [{ ...cycle, reconstructed: true }], 0).primary.value).toBe(
      'Not recorded',
    );
  });
});
