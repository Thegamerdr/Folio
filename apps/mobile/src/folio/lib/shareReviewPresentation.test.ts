import { describe, expect, it } from 'vitest';
import type { CycleRecord } from '../store';
import { buildShareReviewPresentation } from './shareReviewPresentation';

const review: CycleRecord = {
  closedAt: '2026-09-10',
  label: 'September',
  spare: 1990,
  tightPoint: 200,
  setAside: 120,
  note: 'My review',
};

describe('share a recorded forecast review', () => {
  it('keeps two same-day reviews distinct and shares the latest snapshot without month-end claims', () => {
    const records = [review, { ...review, spare: 1975 }];
    const before = JSON.stringify(records);
    const result = buildShareReviewPresentation(records, 2)!;
    expect(result.recordedDate).toBe('10 Sept 2026');
    expect(result.amount).toBe('£1,990');
    expect(result.amountLabel).toBe('Recorded payday cash forecast');
    expect(result.currentPauses).toBe(
      '2 current forecast pauses. Provider payments are unchanged.',
    );
    for (const field of [
      'amount',
      'recordedDate',
      'amountLabel',
      'forecastScope',
      'currentPauses',
    ] as const)
      expect(result.shareText).toContain(result[field]);
    expect(result.shareText).not.toMatch(
      /Cycle closed|left over|end of the month|£3,965|repaid|safe to spend/i,
    );
    expect(JSON.stringify(records)).toBe(before);
  });

  it('selects the latest recorded date and excludes newer reconstructed history', () => {
    const result = buildShareReviewPresentation(
      [
        { ...review, closedAt: '2026-09-12', spare: 9999, reconstructed: true },
        { ...review, closedAt: '2026-09-09', spare: 100 },
        { ...review, spare: 350.25 },
      ],
      0,
    )!;
    expect(result.recordedDate).toBe('10 Sept 2026');
    expect(result.amount).toBe('£350.25');
    expect(result.shareText).not.toContain('9,999');
  });

  it.each([{ records: [] }, { records: [{ ...review, reconstructed: true as const }] }])(
    'offers no fabricated card when only unrecorded history exists',
    ({ records }) => {
      expect(buildShareReviewPresentation(records, 2)).toBeNull();
    },
  );

  it('keeps signed pennies in the displayed and shared forecast', () => {
    const result = buildShareReviewPresentation([{ ...review, spare: -12.34 }], 1)!;
    expect(result.amount).toBe('−£12.34');
    expect(result.shareText).toContain('Recorded payday cash forecast: −£12.34.');
    expect(result.currentPauses).toBe('1 current forecast pause. Provider payments are unchanged.');
  });

  it('qualifies live forecast pauses without claiming they were recorded in the earlier review', () => {
    const before = buildShareReviewPresentation([review], 2)!;
    const after = buildShareReviewPresentation([review], 0)!;
    expect(after.amount).toBe(before.amount);
    expect(after.recordedDate).toBe(before.recordedDate);
    expect(after.currentPauses).toBe(
      'No current forecast pauses. Provider payments are unchanged.',
    );
    expect(after.shareText).not.toContain('2 current forecast pauses');
  });

  it('does not fabricate zero cash when a recorded forecast is unavailable', () => {
    const result = buildShareReviewPresentation([{ ...review, spare: Number.NaN }], 0)!;
    expect(result.amount).toBe('Not available');
    expect(result.shareText).not.toContain('£0');
  });
});
