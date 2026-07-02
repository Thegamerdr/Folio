import { describe, expect, it } from 'vitest';

import { detectWins, WIN_LINES, type WinSnapshot } from './wins.js';
import { lintCopy } from './copy.js';

const snap = (over: Partial<WinSnapshot> = {}): WinSnapshot => ({
  onboarded: false,
  checksThisWeek: 0,
  ritualDone: false,
  spendCount: 0,
  ladder: 'calm',
  journey: 'none',
  safeZonePence: 18_400,
  ...over,
});

describe('detectWins', () => {
  it('onboarding is the guaranteed day-one win', () => {
    const wins = detectWins(null, snap({ onboarded: true }), []);
    expect(wins.map((w) => w.id)).toContain('first-safe-zone');
  });

  it('each win fires exactly once — already-won ids stay silent', () => {
    const next = snap({ onboarded: true, checksThisWeek: 6 });
    const first = detectWins(null, next, []);
    expect(first.map((w) => w.id)).toEqual(
      expect.arrayContaining(['first-safe-zone', 'first-check', 'five-checks-week']),
    );
    const again = detectWins(
      null,
      next,
      first.map((w) => w.id),
    );
    expect(again).toEqual([]);
  });

  it('the check habit is celebrated at one and again at five', () => {
    expect(detectWins(null, snap({ checksThisWeek: 1 }), []).map((w) => w.id)).toContain(
      'first-check',
    );
    expect(detectWins(null, snap({ checksThisWeek: 5 }), []).map((w) => w.id)).toContain(
      'five-checks-week',
    );
  });

  it('surviving a storm needs a storm to have happened', () => {
    const calmToCalm = detectWins(snap(), snap(), []);
    expect(calmToCalm.map((w) => w.id)).not.toContain('storm-passed');

    const out = detectWins(snap({ ladder: 'danger' }), snap({ ladder: 'calm' }), []);
    expect(out.map((w) => w.id)).toContain('storm-passed');
  });

  it('recovery completes only from rebuilding → none', () => {
    const done = detectWins(snap({ journey: 'rebuilding' }), snap({ journey: 'none' }), []);
    expect(done.map((w) => w.id)).toContain('recovery-completed');

    const abandoned = detectWins(snap({ journey: 'recovery' }), snap({ journey: 'none' }), []);
    expect(abandoned.map((w) => w.id)).not.toContain('recovery-completed');
  });

  it('the boring miracle lands at £500 spare', () => {
    const wins = detectWins(null, snap({ safeZonePence: 50_000 }), []);
    expect(wins.map((w) => w.id)).toContain('buffer-500');
  });
});

describe('win copy obeys the law', () => {
  it.each(Object.entries(WIN_LINES))('"%s" renders clean', (_id, line) => {
    expect(lintCopy(line)).toEqual([]);
  });
});
