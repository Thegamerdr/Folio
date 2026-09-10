import { describe, expect, it } from 'vitest';
import type { CycleRecord } from '../store';
import { privacyHistoryPresentation } from './privacyHistoryPresentation';

const review: CycleRecord = {
  closedAt: '2026-09-10',
  label: 'September',
  spare: 1990,
  tightPoint: 200,
  setAside: 0,
  note: '',
};

describe('Privacy saved-review footprint and reset scope', () => {
  it('counts two same-day reviews without claiming two completed periods', () => {
    expect(privacyHistoryPresentation([review, { ...review, spare: 1975 }])).toEqual({
      recordedReviews: 2,
      historySummaries: 0,
      summary: '2 recorded reviews',
    });
  });

  it('preserves imported historical summaries separately from reviews the user recorded', () => {
    const records: CycleRecord[] = [review, { ...review, reconstructed: true }];
    const before = JSON.stringify(records);
    expect(privacyHistoryPresentation(records)).toEqual({
      recordedReviews: 1,
      historySummaries: 1,
      summary: '1 recorded review and 1 history summary',
    });
    expect(JSON.stringify(records)).toBe(before);
  });

  it('does not count reconstructed-only history as recorded reviews', () => {
    expect(
      privacyHistoryPresentation(
        Array.from({ length: 2 }, () => ({ ...review, reconstructed: true })),
      ),
    ).toEqual({
      recordedReviews: 0,
      historySummaries: 2,
      summary: '0 recorded reviews and 2 history summaries',
    });
  });

  it('shows an honest zero count for the empty production profile', () => {
    expect(privacyHistoryPresentation([])).toEqual({
      recordedReviews: 0,
      historySummaries: 0,
      summary: '0 recorded reviews',
    });
  });
});
