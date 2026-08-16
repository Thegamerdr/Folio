import { describe, expect, it } from 'vitest';

import { COPY, SAMPLE_CONTEXT, lintCopy } from './copy.js';

describe('the copy system obeys its own law (§10.3 as CI, not guideline)', () => {
  it.each(Object.entries(COPY))('"%s" renders clean of every banned pattern', (_key, render) => {
    const text = render(SAMPLE_CONTEXT);
    expect(lintCopy(text)).toEqual([]);
  });

  it('keeps the blueprint-fixed calm line verbatim', () => {
    expect(COPY.calm(SAMPLE_CONTEXT)).toBe(
      '£184 safe until Fri the 12th. Nothing needs you today.',
    );
  });

  it('every warning carries its way out', () => {
    expect(COPY.warning(SAMPLE_CONTEXT)).toContain('£9/day keeps it dry');
  });

  it('recovery counts forward — days on the path, never days since failure', () => {
    const text = COPY.recovery(SAMPLE_CONTEXT);
    expect(text).toContain('Day 2 of the way back');
    expect(text.toLowerCase()).not.toContain('since');
    expect(text.toLowerCase()).not.toContain('failure');
  });

  it('fog admits what it does not know', () => {
    expect(COPY.affordFog(SAMPLE_CONTEXT)).toContain('my numbers are from Tuesday');
  });
});

describe('lintCopy', () => {
  it('catches shame, shouting and panic in one shot', () => {
    const violations = lintCopy('Oops, you failed AGAIN!!');
    expect(violations).toContain('oops');
    expect(violations).toContain('you-failed');
    expect(violations).toContain('again-negative');
    expect(violations).toContain('shouting-caps');
    expect(violations).toContain('double-exclaim');
  });

  it('catches alarm emoji', () => {
    expect(lintCopy('Storm coming 🚨')).toContain('alarm-emoji');
  });

  it('enforces the single-exclamation ceiling even without doubling', () => {
    expect(lintCopy('Payday! You made it! Great!')).toContain('exclaim-ceiling');
  });

  it('passes calm, honest copy untouched', () => {
    expect(lintCopy('Storm Thursday. £9/day until Friday keeps it dry.')).toEqual([]);
  });
});
