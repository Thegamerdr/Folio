// Tests for the Melo AI client's pure seams:
//   • resolveNamedTarget — the tolerant name matcher that lets a "Do it" chip resolve a subscription
//     or pot even when the model's echoed name is slightly off ("Net flix" → "Netflix").
//   • buildMeloSystemPrompt — must hand the model the user's own subscription + pot names so it can
//     echo them back exactly (the precondition for the matcher to find a target at all).
//
// meloAiClient imports expo-constants at module load, which the node test runner can't parse, so we
// mock it to an empty config. The pure functions under test never touch it.

import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));

import type { MeloLocalFinancialSnapshot } from '@folio/ai-contracts';

import { buildMeloSystemPrompt, resolveNamedTarget, type NamedTarget } from './meloAiClient';

const subs: readonly NamedTarget[] = [
  { id: 'sub_1', name: 'Netflix' },
  { id: 'sub_2', name: 'Spotify Premium' },
  { id: 'sub_3', name: 'Amazon Prime' },
];

const baseSnapshot: MeloLocalFinancialSnapshot = {
  currency: 'GBP',
  availableNowMinor: 14_200,
  tightestDay: 'Tuesday',
  tightestBalanceMinor: 8_300,
  protectedItems: ['rent'],
  pendingReviewCount: 0,
  nextPaydayLabel: 'next payday',
};

describe('resolveNamedTarget — tolerant matching', () => {
  it('matches an exact name', () => {
    expect(resolveNamedTarget('Netflix', subs)?.id).toBe('sub_1');
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(resolveNamedTarget('  netflix ', subs)?.id).toBe('sub_1');
  });

  it('tolerates internal spacing and punctuation noise', () => {
    expect(resolveNamedTarget('Net flix', subs)?.id).toBe('sub_1');
    expect(resolveNamedTarget('NETFLIX!', subs)?.id).toBe('sub_1');
  });

  it('matches when the model adds an extra word the stored name omits', () => {
    // "Spotify" should resolve the stored "Spotify Premium"; "Netflix subscription" → "Netflix".
    expect(resolveNamedTarget('Spotify', subs)?.id).toBe('sub_2');
    expect(resolveNamedTarget('Netflix subscription', subs)?.id).toBe('sub_1');
  });

  it('returns undefined when nothing is close enough', () => {
    expect(resolveNamedTarget('Disney Plus', subs)).toBeUndefined();
    expect(resolveNamedTarget('', subs)).toBeUndefined();
  });

  it('prefers the most specific (shortest) matching stored name', () => {
    const candidates: readonly NamedTarget[] = [
      { id: 'a', name: 'Holiday fund 2026' },
      { id: 'b', name: 'Holiday' },
    ];
    expect(resolveNamedTarget('holiday', candidates)?.id).toBe('b');
  });
});

describe('buildMeloSystemPrompt — names reach the model', () => {
  it('names the user’s subscriptions and pots when the snapshot carries them', () => {
    const prompt = buildMeloSystemPrompt('calm', {
      ...baseSnapshot,
      subscriptionNames: ['Netflix', 'Spotify'],
      potNames: ['Holiday'],
    });
    expect(prompt).toContain('Netflix');
    expect(prompt).toContain('Spotify');
    expect(prompt).toContain('Holiday');
    expect(prompt).toContain('use the user’s exact names');
  });

  it('omits the names instruction when there are no subscriptions or pots', () => {
    const prompt = buildMeloSystemPrompt('calm', {
      ...baseSnapshot,
      subscriptionNames: [],
      potNames: [],
    });
    expect(prompt).not.toContain('use the user’s exact names');
  });

  it('tells the model it has no money data when given no snapshot', () => {
    const prompt = buildMeloSystemPrompt('calm');
    expect(prompt).toContain('do not have access');
  });
});
