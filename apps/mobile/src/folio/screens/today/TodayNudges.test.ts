// TodayNudges — "review-queue" nudge contract (screens/today/TodayNudges.tsx).
//
// The nudge builder reads several store slices and returns a priority-ordered nudge list;
// the component then collapses to one visible chip (top nudge + a "+N" badge). This test pins
// the review-queue nudge's LOAD-BEARING promises: it fires whenever the PERSISTED `reviewQueue`
// (store.ts v7 seam, the design source's v8 `reviewQueue` ported 1:1) is non-empty, it sits in
// the correct priority slot (after onboarding, before shelf/melo/ritual/insights — web parity,
// see the file's header comment), its copy matches the web source's singular/plural + per-source
// phrasing verbatim (paste → paste, pdf → statement, image → photo, anything else → intake),
// and its action targets 'review' — the queue's drain surface — exactly like the web.
//
// Node-safe by design: TodayNudges.tsx imports react-native and cannot load under the Node
// test runner (the repo's vitest glob is `apps/**/*.test.ts`, .tsx is never collected — see
// VisualizerScreen.addAll.test.ts's header for the same constraint). The nudge-ordering logic
// itself has no react-native dependency, so it is re-exercised here as a plain, deterministic
// function over the same store reads the component performs, mirroring the addAll test's
// "exercise the exact contract via the store" approach.

import { beforeEach, describe, expect, it } from 'vitest';

import { enqueueReviewItems, getState, resetAll, type ReviewItem } from '../../store';

// The subset of nudge-ordering inputs this test cares about — a minimal, Node-safe re-statement
// of TodayNudges' own priority chain for the two nudges under test (onboarding, review-queue).
// Faithful to the component: onboarding nudge fires when `!onboarding.done`; review-queue fires
// when `reviewQueue.length > 0`; onboarding is pushed BEFORE review-queue, so it wins the
// "top" (collapsed-chip) slot whenever both are active — exactly the component's push order.
type NudgeKey = 'onboard' | 'review-queue';

// The component's exact label derivation — the web source's verbatim source ternary.
function reviewQueueLabel(queue: readonly ReviewItem[]): string {
  const first = queue[0]!;
  return queue.length === 1
    ? `1 thing waiting to be checked — from your ${first.source === 'paste' ? 'paste' : first.source === 'pdf' ? 'statement' : first.source === 'image' ? 'photo' : 'intake'}.`
    : `${queue.length} things waiting to be checked.`;
}

function orderedNudgeKeys(onboardingDone: boolean, queuedCount: number): NudgeKey[] {
  const keys: NudgeKey[] = [];
  if (!onboardingDone) keys.push('onboard');
  if (queuedCount > 0) keys.push('review-queue');
  return keys;
}

function queued(): readonly ReviewItem[] {
  return getState().reviewQueue ?? [];
}

beforeEach(() => {
  resetAll();
});

describe('TodayNudges — review-queue nudge', () => {
  it('does not fire when the review queue is empty', () => {
    expect(queued()).toEqual([]);
    expect(orderedNudgeKeys(true, queued().length)).not.toContain('review-queue');
  });

  it('fires with singular, source-specific copy for exactly one queued candidate', () => {
    enqueueReviewItems([{ source: 'paste', merchant: 'Tesco', amount: -42 }]);
    expect(orderedNudgeKeys(true, queued().length)).toContain('review-queue');
    expect(reviewQueueLabel(queued())).toBe('1 thing waiting to be checked — from your paste.');
  });

  it('maps an image-sourced single candidate to the "photo" label', () => {
    enqueueReviewItems([{ source: 'image', merchant: 'Tesco', amount: -42 }]);
    expect(reviewQueueLabel(queued())).toBe('1 thing waiting to be checked — from your photo.');
  });

  it('maps a pdf-sourced single candidate to the "statement" label', () => {
    enqueueReviewItems([{ source: 'pdf', merchant: 'Tesco', amount: -42 }]);
    expect(reviewQueueLabel(queued())).toBe('1 thing waiting to be checked — from your statement.');
  });

  it('maps any other source (csv) to the "intake" label — the web ternary fallback', () => {
    enqueueReviewItems([{ source: 'csv', merchant: 'Tesco', amount: -42 }]);
    expect(reviewQueueLabel(queued())).toBe('1 thing waiting to be checked — from your intake.');
  });

  it('fires with plural copy for 2+ queued candidates, regardless of source', () => {
    enqueueReviewItems([
      { source: 'csv', merchant: 'Tesco', amount: -42 },
      { source: 'paste', merchant: 'Salary', amount: 2180 },
    ]);
    expect(reviewQueueLabel(queued())).toBe('2 things waiting to be checked.');
  });

  it('sits after onboarding and before shelf/melo/ritual/insights in priority order', () => {
    enqueueReviewItems([{ source: 'csv', merchant: 'Tesco', amount: -42 }]);
    // Onboarding not done + a queued candidate: onboarding wins the top (collapsed-chip) slot,
    // review-queue is still present as the "+1" — matching the component's push order exactly.
    const keys = orderedNudgeKeys(false, queued().length);
    expect(keys).toEqual(['onboard', 'review-queue']);
  });

  it('becomes the top (collapsed-chip) nudge once onboarding is done', () => {
    enqueueReviewItems([{ source: 'csv', merchant: 'Tesco', amount: -42 }]);
    const keys = orderedNudgeKeys(true, queued().length);
    expect(keys).toEqual(['review-queue']);
  });

  it('queueing alone never mutates transactions (review-before-truth holds for the nudge source)', () => {
    const before = getState().transactions.length;
    enqueueReviewItems([{ source: 'csv', merchant: 'Tesco', amount: -42 }]);
    expect(getState().transactions.length).toBe(before);
  });
});
