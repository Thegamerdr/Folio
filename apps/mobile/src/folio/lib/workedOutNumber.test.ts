import { describe, expect, it } from 'vitest';
import type { BusinessRunway } from '@folio/business-workspace';
import type { TrustedSafeRangeResult } from '@folio/domain';

import { buildBusinessRunwayBreakdown, buildSafeRangeBreakdown } from './workedOutNumber';

describe('worked-out consequential numbers', () => {
  it('shows the exact business cash, incoming, outgoing and burn arithmetic', () => {
    const runway: BusinessRunway = {
      cashMinor: 100_000,
      incoming30Minor: 30_000,
      outgoing30Minor: 60_000,
      dailyBurnMinor: 1_000,
      daysLeft: 100,
      runsOutOn: '2026-11-25',
      forecast: [],
    };
    const result = buildBusinessRunwayBreakdown(runway, '2026-08-17', {
      accounts: 2,
      invoices: 3,
      obligations: 4,
    });

    expect(result.equation).toContain('£1,000 + £300 − £600 = £700');
    expect(result.inputs.find((line) => line.label === 'Average daily net burn')?.value).toBe(
      '£10',
    );
    expect(result.window).toContain('15 Sept 2026');
    expect(result.sources).toEqual(['2 accounts', '3 invoices', '4 recurring obligations']);
  });

  it('explains the confirmed safe-range movement and exposes source correction routes', () => {
    const money = (minorUnits: number) => ({ minorUnits, currency: 'GBP' });
    const result = {
      calculatedAt: '2026-08-17T10:00:00.000Z',
      horizonStartISO: '2026-08-17',
      horizonEndISO: '2026-09-21',
      currentPosition: { label: 'Latest balance' },
      committedFloor: { label: 'Known path floor' },
      currentKnownPosition: money(100_000),
      knownCommittedFloor: money(70_000),
      expectedSafeMin: money(65_000),
      expectedSafeMax: money(75_000),
      conservativeBoundary: money(65_000),
      expectedRange: {
        min: money(65_000),
        max: money(75_000),
        basis: 'explicit_uncertainty',
        uncertaintySources: [
          {
            label: 'Variable energy bill',
            amount: money(5_000),
            direction: 'widens_down',
          },
        ],
      },
      assumptions: ['Payday remains on the saved date.'],
      contradictions: [],
      missingInputs: [],
      sourceBreakdown: [{ label: 'Main account', truthClass: 'observed', freshness: 'fresh' }],
      freshnessDetail: { summary: 'All material sources are fresh.' },
      relianceDetail: { label: 'Safe to rely on' },
    } as unknown as TrustedSafeRangeResult;

    const breakdown = buildSafeRangeBreakdown(result);

    expect(breakdown.equation).toBe('£1,000 − £300 = £700 known floor');
    expect(breakdown.answer).toBe('£650 to £750');
    expect(breakdown.inputs.some((line) => line.label === 'Variable energy bill')).toBe(true);
    expect(breakdown.corrections.map((item) => item.route)).toEqual([
      'money-sources',
      'calendar',
      'review',
    ]);
  });
});
