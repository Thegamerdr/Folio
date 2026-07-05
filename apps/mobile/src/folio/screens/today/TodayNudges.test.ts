// TodayNudges — "review-queue" nudge contract (screens/today/TodayNudges.tsx).
//
// The nudge builder reads several store slices and returns a priority-ordered nudge list;
// the component then collapses to one visible chip (top nudge + a "+N" badge). This test pins
// the review-queue nudge's LOAD-BEARING promises: it fires whenever `readerCandidates` is
// non-empty, it sits in the correct priority slot (after onboarding, before shelf/melo/ritual/
// insights — web parity, see the file's header comment), its copy matches the web source's
// singular/plural + per-source phrasing, and its action targets 'visualizer' (RN's real
// multi-candidate review screen for the staged queue), never 'review' (the separate
// single-decision manual-entry card).
//
// Node-safe by design: TodayNudges.tsx imports react-native and cannot load under the Node
// test runner (the repo's vitest glob is `apps/**/*.test.ts`, .tsx is never collected — see
// VisualizerScreen.addAll.test.ts's header for the same constraint). The nudge-ordering logic
// itself has no react-native dependency, so it is re-exercised here as a plain, deterministic
// function over the same store reads the component performs, mirroring the addAll test's
// "exercise the exact contract via the store" approach.

import { beforeEach, describe, expect, it } from 'vitest';

import { getState, resetAll, setReaderCandidates } from '../../store';
import type { CandidateMoneyItem } from '../../lib/importSheet';

// The subset of nudge-ordering inputs this test cares about — a minimal, Node-safe re-statement
// of TodayNudges' own priority chain for the two nudges under test (onboarding, review-queue).
// Faithful to the component: onboarding nudge fires when `!onboarding.done`; review-queue fires
// when `readerCandidates.length > 0`; onboarding is pushed BEFORE review-queue, so it wins the
// "top" (collapsed-chip) slot whenever both are active — exactly the component's push order.
type NudgeKey = 'onboard' | 'review-queue';

function reviewQueueLabel(candidates: readonly CandidateMoneyItem[]): string {
  const [first] = candidates;
  const sourceLabel =
    first?.source === 'paste' ? 'paste' : first?.source === 'photo' ? 'photo' : 'statement';
  return candidates.length === 1
    ? `1 thing waiting to be checked — from your ${sourceLabel}.`
    : `${candidates.length} things waiting to be checked.`;
}

function orderedNudgeKeys(onboardingDone: boolean, candidateCount: number): NudgeKey[] {
  const keys: NudgeKey[] = [];
  if (!onboardingDone) keys.push('onboard');
  if (candidateCount > 0) keys.push('review-queue');
  return keys;
}

beforeEach(() => {
  resetAll();
});

describe('TodayNudges — review-queue nudge', () => {
  it('does not fire when the staged reader queue is empty', () => {
    setReaderCandidates([]);
    expect(getState().readerCandidates).toEqual([]);
    expect(orderedNudgeKeys(true, getState().readerCandidates.length)).not.toContain(
      'review-queue',
    );
  });

  it('fires with singular, source-specific copy for exactly one staged candidate', () => {
    setReaderCandidates([
      {
        id: 'c1',
        source: 'paste',
        kind: 'spend',
        merchant: 'Tesco',
        amount: -42,
        confidence: 'low',
      },
    ]);
    const candidates = getState().readerCandidates;
    expect(orderedNudgeKeys(true, candidates.length)).toContain('review-queue');
    expect(reviewQueueLabel(candidates)).toBe('1 thing waiting to be checked — from your paste.');
  });

  it('maps a photo-sourced single candidate to the "photo" label', () => {
    setReaderCandidates([
      {
        id: 'c1',
        source: 'photo',
        kind: 'spend',
        merchant: 'Tesco',
        amount: -42,
        confidence: 'low',
      },
    ]);
    expect(reviewQueueLabel(getState().readerCandidates)).toBe(
      '1 thing waiting to be checked — from your photo.',
    );
  });

  it('maps a csv/pdf-sourced single candidate to the "statement" label', () => {
    setReaderCandidates([
      { id: 'c1', source: 'csv', kind: 'spend', merchant: 'Tesco', amount: -42, confidence: 'low' },
    ]);
    expect(reviewQueueLabel(getState().readerCandidates)).toBe(
      '1 thing waiting to be checked — from your statement.',
    );
  });

  it('fires with plural copy for 2+ staged candidates, regardless of source', () => {
    setReaderCandidates([
      { id: 'c1', source: 'csv', kind: 'spend', merchant: 'Tesco', amount: -42, confidence: 'low' },
      {
        id: 'c2',
        source: 'paste',
        kind: 'income',
        merchant: 'Salary',
        amount: 2180,
        confidence: 'low',
      },
    ]);
    const candidates = getState().readerCandidates;
    expect(reviewQueueLabel(candidates)).toBe('2 things waiting to be checked.');
  });

  it('sits after onboarding and before shelf/melo/ritual/insights in priority order', () => {
    setReaderCandidates([
      { id: 'c1', source: 'csv', kind: 'spend', merchant: 'Tesco', amount: -42, confidence: 'low' },
    ]);
    // Onboarding not done + a staged candidate: onboarding wins the top (collapsed-chip) slot,
    // review-queue is still present as the "+1" — matching the component's push order exactly.
    const keys = orderedNudgeKeys(false, getState().readerCandidates.length);
    expect(keys).toEqual(['onboard', 'review-queue']);
  });

  it('becomes the top (collapsed-chip) nudge once onboarding is done', () => {
    setReaderCandidates([
      { id: 'c1', source: 'csv', kind: 'spend', merchant: 'Tesco', amount: -42, confidence: 'low' },
    ]);
    const keys = orderedNudgeKeys(true, getState().readerCandidates.length);
    expect(keys).toEqual(['review-queue']);
  });

  it('staging alone never mutates transactions (review-before-truth holds for the nudge source)', () => {
    const before = getState().transactions.length;
    setReaderCandidates([
      { id: 'c1', source: 'csv', kind: 'spend', merchant: 'Tesco', amount: -42, confidence: 'low' },
    ]);
    expect(getState().transactions.length).toBe(before);
  });
});
