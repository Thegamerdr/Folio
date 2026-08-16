import { describe, expect, it } from 'vitest';

import { lintCopy } from './copy.js';
import { pickNextBestAction, type NextBestActionInputs } from './nextBestAction.js';

const base = (over: Partial<NextBestActionInputs> = {}): NextBestActionInputs => ({
  ritualDue: false,
  fog: false,
  inRecovery: false,
  moveDoneToday: false,
  ladder: 'calm',
  structural: false,
  structuralOptionBody: null,
  keepDryPerDay: '£9',
  paydayLabel: 'Fri the 12th',
  reviewDue: false,
  hasSpendLog: true,
  recoveryMovePence: 800,
  ...over,
});

describe('pickNextBestAction — ritual (top priority)', () => {
  it('fires the ritual card, beating every other signal', () => {
    const action = pickNextBestAction(
      base({ ritualDue: true, fog: true, inRecovery: true, ladder: 'warning' }),
    );
    expect(action).toEqual({
      id: 'ritual',
      title: 'Payday',
      body: 'Two minutes with Melo makes the month safe.',
      cta: 'Start the ritual',
    });
  });
});

describe('pickNextBestAction — fog', () => {
  it('asks for a balance refresh when the picture is stale', () => {
    const action = pickNextBestAction(base({ fog: true, inRecovery: true }));
    expect(action?.id).toBe('refreshBalance');
  });
});

describe('pickNextBestAction — recovery', () => {
  it('says done for today once the move is completed', () => {
    const action = pickNextBestAction(base({ inRecovery: true, moveDoneToday: true }));
    expect(action).toEqual({
      id: 'recovery',
      title: 'Done for today',
      body: 'That was the whole ask. See you tomorrow — I’ll bring the numbers.',
      cta: '',
    });
  });

  it('offers the structural way-through when the cycle does not fit', () => {
    const action = pickNextBestAction(
      base({ inRecovery: true, structural: true, structuralOptionBody: 'Custom structural body.' }),
    );
    expect(action).toEqual({
      id: 'recovery',
      title: 'This cycle doesn’t fit',
      body: 'Custom structural body.',
      cta: 'See the way through',
    });
  });

  it('falls back to the default structural body when none is supplied', () => {
    const action = pickNextBestAction(base({ inRecovery: true, structural: true }));
    expect(action?.body).toBe(
      'Three steps. The first one takes a minute. No lecture in any of them.',
    );
  });

  it('names the exact recovery move amount', () => {
    const action = pickNextBestAction(base({ inRecovery: true, recoveryMovePence: 1_234 }));
    expect(action?.body).toBe('Shift £12 to bills. Then we’re done for today — no second ask.');
  });
});

describe('pickNextBestAction — keepDry (warning ladder)', () => {
  it('names the per-day figure and payday label', () => {
    const action = pickNextBestAction(base({ ladder: 'warning' }));
    expect(action).toEqual({
      id: 'keepDry',
      title: 'Keep it dry',
      body: '£9/day until Fri the 12th keeps the storm off.',
      cta: 'Show the math',
    });
  });

  it('does not fire keepDry outside the warning ladder', () => {
    expect(pickNextBestAction(base({ ladder: 'danger' }))?.id).not.toBe('keepDry');
  });
});

describe('pickNextBestAction — review and log-first-spend', () => {
  it('offers the week review when due, with nothing more urgent', () => {
    const action = pickNextBestAction(base({ reviewDue: true }));
    expect(action?.id).toBe('review');
  });

  it('gently asks for a first spend log when the log is empty', () => {
    const action = pickNextBestAction(base({ hasSpendLog: false }));
    expect(action?.id).toBe('logFirstSpend');
  });

  it('review beats logFirstSpend when both apply', () => {
    const action = pickNextBestAction(base({ reviewDue: true, hasSpendLog: false }));
    expect(action?.id).toBe('review');
  });
});

describe('pickNextBestAction — nothing needed', () => {
  it('returns null on a calm day with nothing due', () => {
    expect(pickNextBestAction(base())).toBeNull();
  });
});

describe('pickNextBestAction — ranking', () => {
  it('fog beats recovery', () => {
    expect(pickNextBestAction(base({ fog: true, inRecovery: true }))?.id).toBe('refreshBalance');
  });

  it('recovery beats keepDry', () => {
    expect(pickNextBestAction(base({ inRecovery: true, ladder: 'warning' }))?.id).toBe('recovery');
  });

  it('keepDry beats review', () => {
    expect(pickNextBestAction(base({ ladder: 'warning', reviewDue: true }))?.id).toBe('keepDry');
  });
});

describe('every produced card obeys the copy law', () => {
  const firing: readonly Partial<NextBestActionInputs>[] = [
    { ritualDue: true },
    { fog: true },
    { inRecovery: true },
    { inRecovery: true, moveDoneToday: true },
    { inRecovery: true, structural: true },
    { ladder: 'warning' },
    { reviewDue: true },
    { hasSpendLog: false },
  ];

  it.each(firing)('renders clean copy for %#', (over) => {
    const action = pickNextBestAction(base(over));
    expect(action).not.toBeNull();
    if (action === null) return;
    expect(lintCopy(action.title)).toEqual([]);
    expect(lintCopy(action.body)).toEqual([]);
  });
});
