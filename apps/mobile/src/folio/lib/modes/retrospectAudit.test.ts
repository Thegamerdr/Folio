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
  it.each(modes)('%s earns comparisons only from two completed cycles', (mode) => {
    const result = getRetrospect(mode, [cycle], 0);
    expect(result.meloNote).toBe(
      'Your first cycle is recorded. Another completed cycle will show what changes.',
    );
    expect(result.trendCaption).toBe('Lowest balance · 1 completed cycle');
    expect(result.meloNote).not.toContain('last month');
  });
  it('does not treat reconstructed history as a completed comparison', () => {
    expect(
      getRetrospect('survival', [cycle, { ...cycle, reconstructed: true }], 0).meloNote,
    ).toContain('Your first cycle');
    expect(getRetrospect('survival', [cycle], 0).primary.label).toBe('Total left at cycle close');
  });
});
