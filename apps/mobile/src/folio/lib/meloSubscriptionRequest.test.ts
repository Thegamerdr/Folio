import { describe, expect, it } from 'vitest';

import type { Sub } from '../store';
import { resolveMeloSubscriptionRequest } from './meloSubscriptionRequest';

const spotify: Sub = {
  name: 'Spotify',
  cost: 10.99,
  nextRenewalDaysAway: 4,
  lastUsedDaysAgo: 2,
  usesPerMonth: 12,
};
const netflix: Sub = {
  name: 'Netflix',
  cost: 15.99,
  nextRenewalDaysAway: 8,
  lastUsedDaysAgo: 3,
  usesPerMonth: 8,
};

describe('Melo subscription request resolver', () => {
  const activeState = { subs: [spotify, netflix], subPaused: {} };

  it('previews an exact pause without mutating state', () => {
    const result = resolveMeloSubscriptionRequest('Pause Spotify', activeState);

    expect(result).toMatchObject({
      state: 'review',
      actionLabel: 'Review Spotify pause',
    });
    if (result.state === 'review') {
      expect(result.reply).toContain('£10.99');
      expect(result.reply).toContain('£26.98 to £15.99');
      expect(result.reply).toContain('Nothing has changed yet');
    }
    expect(activeState.subPaused).toEqual({});
  });

  it('previews an exact resume from the current paused state', () => {
    const result = resolveMeloSubscriptionRequest('please resume my Spotify subscription', {
      subs: [spotify, netflix],
      subPaused: { Spotify: true },
    });

    expect(result).toMatchObject({
      state: 'review',
      actionLabel: 'Review Spotify resume',
    });
    if (result.state === 'review') expect(result.reply).toContain('£15.99 to £26.98');
  });

  it('reports already-applied states without proposing a second change', () => {
    const paused = resolveMeloSubscriptionRequest('Pause Spotify', {
      subs: [spotify],
      subPaused: { Spotify: true },
    });
    const active = resolveMeloSubscriptionRequest('Resume Spotify', {
      subs: [spotify],
      subPaused: {},
    });

    expect(paused.state === 'review' ? paused.reply : '').toContain('already paused');
    expect(active.state === 'review' ? active.reply : '').toContain('already active');
  });

  it('asks for explicit selection instead of guessing a missing or ambiguous target', () => {
    const missing = resolveMeloSubscriptionRequest('Pause a subscription', activeState);
    const ambiguous = resolveMeloSubscriptionRequest('Pause Spot', {
      subs: [spotify, { ...spotify, name: 'Spotify Family', cost: 17.99 }],
      subPaused: {},
    });

    expect(missing).toMatchObject({
      state: 'needs-selection',
      choices: [{ label: 'Pause Spotify' }, { label: 'Pause Netflix' }],
    });
    expect(ambiguous).toMatchObject({ state: 'needs-selection' });
  });

  it('does not treat hypotheticals or advice questions as action requests', () => {
    for (const prompt of [
      'Should I pause Spotify?',
      'What if I pause Spotify?',
      'Talk me out of this Spotify charge',
    ]) {
      expect(resolveMeloSubscriptionRequest(prompt, activeState)).toEqual({
        state: 'not-requested',
      });
    }
  });

  it('keeps an unknown name non-mutating and offers the real subscriptions surface', () => {
    const result = resolveMeloSubscriptionRequest('Pause Disney Plus', activeState);
    expect(result).toMatchObject({
      state: 'needs-selection',
      canOpenSubscriptions: true,
    });
    if (result.state === 'needs-selection') expect(result.reply).toContain('could not find');
  });

  it('refuses to calculate from a corrupt negative stored amount', () => {
    const result = resolveMeloSubscriptionRequest('Pause Spotify', {
      subs: [{ ...spotify, cost: -10.99 }],
      subPaused: {},
    });

    expect(result).toMatchObject({
      state: 'review',
      actionLabel: 'Review subscription amount',
    });
    if (result.state === 'review') {
      expect(result.reply).toContain('needs review');
      expect(result.reply).toContain('Nothing changed');
      expect(result.reply).not.toContain('£-');
    }
  });
});
