import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPersistBlob,
  getState,
  hydrateFromBlob,
  nudgeSub,
  removeSub,
  resetSubOverrides,
  setPartial,
  setSubs,
  togglePaused,
} from '../store';
import { toFinancialPlanInput } from './financialPlan';
import { subscriptionSchedulePresentation } from './subscriptionSchedulePresentation';
import { subscriptionKey, subscriptionPaused } from './subscriptionIdentity';
import { resetSampleFixture } from '../test/sampleFixture';

const NOW = new Date('2026-09-12T00:00:00Z');

function bill(id: string, date: string) {
  return {
    id,
    name: 'Council Tax',
    cost: 12,
    nextRenewalDaysAway: 19,
    nextRenewalISO: date,
    obligationAnchorISO: date,
    lastUsedDaysAgo: 0,
    usesPerMonth: 1,
  };
}

beforeEach(() => resetSampleFixture());

describe('durable subscription identity', () => {
  it('uses immutable ids for plan commitments and per-row pause state', () => {
    const first = bill('sub-first', '2026-10-01');
    const second = bill('sub-second', '2026-10-01');
    setPartial({ subs: [first, second], subPaused: {}, subOverrides: {} });

    const before = toFinancialPlanInput(getState(), { now: NOW, horizonDays: 60 });
    expect(
      (before.commitments ?? [])
        .filter((item) => item.category === 'subscription' && item.date === '2026-10-01')
        .map((item) => item.id),
    ).toEqual(['subscription:sub-first:2026-10-01', 'subscription:sub-second:2026-10-01']);

    togglePaused('sub-first', true);
    const after = toFinancialPlanInput(getState(), { now: NOW, horizonDays: 60 });
    expect(subscriptionPaused(getState().subPaused, first)).toBe(true);
    expect(subscriptionPaused(getState().subPaused, second)).toBe(false);
    expect(
      (after.commitments ?? [])
        .filter((item) => item.category === 'subscription' && item.date === '2026-10-01')
        .map((item) => item.id),
    ).toEqual(['subscription:sub-second:2026-10-01']);
  });

  it('assigns ids at the write boundary and preserves them in the persisted blob', () => {
    setSubs([bill('', '2026-10-01'), bill('', '2026-10-01')]);
    const ids = getState().subs.map(subscriptionKey);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id.startsWith('sub-'))).toBe(true);
    const persisted = JSON.parse(getPersistBlob()) as { subs: Array<{ id?: string }> };
    expect(persisted.subs.map((subscription) => subscription.id)).toEqual(ids);
    hydrateFromBlob(getPersistBlob(), getState().activeWorkspaceId);
    expect(getState().subs.map(subscriptionKey)).toEqual(ids);
  });

  it('reanchors persisted renewal dates during hydration before publishing state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const persisted = JSON.parse(getPersistBlob()) as { subs: Array<Record<string, unknown>> };
      persisted.subs = [
        {
          ...bill('sub-anchored', '2026-09-01'),
          nextRenewalDaysAway: 1,
          obligationAnchorISO: '2026-09-01',
        },
      ];
      hydrateFromBlob(JSON.stringify(persisted), getState().activeWorkspaceId);

      const hydrated = getState().subs[0];
      expect(hydrated?.id).toBe('sub-anchored');
      expect(hydrated?.obligationAnchorISO).toBe('2026-09-01');
      expect(hydrated?.nextRenewalISO).toBe('2026-10-01');
      expect(hydrated?.nextRenewalDaysAway).toBe(19);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pairs a same-name row with its own schedule after a temporary move', () => {
    const first = { ...bill('sub-first', '2026-10-01'), nextRenewalDaysAway: 19 };
    const second = { ...bill('sub-second', '2026-11-01'), nextRenewalDaysAway: 50 };
    setPartial({ subs: [first, second], subPaused: {}, subOverrides: { 'sub-first': 3 } });
    const commitments =
      toFinancialPlanInput(getState(), { now: NOW, horizonDays: 90 }).commitments ?? [];
    expect(subscriptionSchedulePresentation(first, '2026-09-12', commitments).dateLabel).toBe(
      'Next scheduled 1 Oct 2026',
    );
    expect(subscriptionSchedulePresentation(second, '2026-09-12', commitments).dateLabel).toBe(
      'Next scheduled 1 Nov 2026',
    );
  });

  it('migrates a unique legacy name setting and lets an id-based reset clear it', () => {
    const only = bill('sub-only', '2026-10-01');
    setPartial({ subs: [only], subPaused: { 'Council Tax': true }, subOverrides: { 'Council Tax': 2 } });
    setSubs((previous) => previous);

    expect(getState().subPaused).toEqual({ 'sub-only': true });
    expect(getState().subOverrides).toEqual({ 'sub-only': 2 });
    nudgeSub('sub-only', 1);
    resetSubOverrides('sub-only');
    expect(getState().subOverrides).toEqual({});
  });

  it('keeps an ambiguous legacy name setting shared instead of guessing a row', () => {
    const first = bill('sub-first', '2026-10-01');
    const second = bill('sub-second', '2026-10-01');
    setPartial({
      subs: [first, second],
      subPaused: {},
      subOverrides: { 'Council Tax': 2 },
    });
    setSubs((previous) => previous);

    expect(getState().subOverrides).toEqual({ 'Council Tax': 2 });
    resetSubOverrides('sub-first');
    expect(getState().subOverrides).toEqual({ 'Council Tax': 2 });
  });

  it('sweeps an ambiguous legacy nudge by group, independent of duplicate row order', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const base = JSON.parse(getPersistBlob()) as Record<string, unknown>;
      const rows = [
        { ...bill('sub-early', '2026-10-01'), nextRenewalDaysAway: 1 },
        { ...bill('sub-late', '2026-10-01'), nextRenewalDaysAway: 10 },
      ].map((row) => {
        const { nextRenewalISO: _next, obligationAnchorISO: _anchor, ...legacy } = row;
        return legacy;
      });
      for (const ordered of [rows, [...rows].reverse()]) {
        hydrateFromBlob(
          JSON.stringify({ ...base, subs: ordered, subOverrides: { 'Council Tax': -3 } }),
          getState().activeWorkspaceId,
        );
        expect(getState().subOverrides).toEqual({ 'Council Tax': -3 });
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('archives each exact row independently and keeps cancellation identity on round-trip', () => {
    const first = bill('sub-first', '2026-10-01');
    const second = bill('sub-second', '2026-10-01');
    setPartial({ subs: [first, second], subPaused: {}, subOverrides: {}, cancelledSubs: [] });

    removeSub('sub-first');
    expect(getState().cancelledSubs?.map((subscription) => subscription.id)).toEqual(['sub-first']);
    removeSub('sub-second');
    expect(getState().cancelledSubs?.map((subscription) => subscription.id)).toEqual([
      'sub-second',
      'sub-first',
    ]);
  });
});
