// isKnownStatePayer + income.caught.headStatePayer — pure-logic coverage.
//
// Benefits/pension credits ARE income (detection/mechanics unchanged) — this only
// covers the copy-selection heuristic that picks a headline phrasing that doesn't
// read like Melo mistook a state/benefits/pension payer for an employer.

import { describe, expect, it } from 'vitest';

import { copy, isKnownStatePayer } from './copy';

describe('isKnownStatePayer', () => {
  it.each([
    'DWP',
    'dwp universal credit',
    'HMRC',
    'HMRC CHILD BENEFIT',
    'Universal Credit',
    'UNIVERSAL   CREDIT', // extra whitespace, still matches
    'State Pension',
    'Acme Pension Trust',
  ])('recognises %s as a known state/benefits/pension payer', (merchant) => {
    expect(isKnownStatePayer(merchant)).toBe(true);
  });

  it.each(['Acme Ltd', 'Barclays Bank', 'John Smith Consulting', 'Pensioner Discount Co'])(
    'does not flag an ordinary employer/merchant string like %s',
    (merchant) => {
      // "Pensioner Discount Co" contains "Pension" only as a substring inside a
      // longer word boundary-safe token — the \bpension\b pattern must not fire
      // on "Pensioner" (word boundary after "pension" fails inside "Pensioner").
      expect(isKnownStatePayer(merchant)).toBe(false);
    },
  );

  it('is case-insensitive', () => {
    expect(isKnownStatePayer('dWp')).toBe(true);
    expect(isKnownStatePayer('hMrC')).toBe(true);
  });
});

describe('copy.income.caught.headStatePayer', () => {
  it('reads as money arriving, not an employer paying', () => {
    const head = copy.income.caught.headStatePayer('DWP');
    expect(head).toBe('Melo noticed money arrives from **DWP**.');
    expect(head).not.toMatch(/pays you/iu);
  });

  it('still carries the accent-wrapped merchant for the render layer', () => {
    const head = copy.income.caught.headStatePayer('HMRC Child Benefit');
    expect(head).toContain('**HMRC Child Benefit**');
  });
});
