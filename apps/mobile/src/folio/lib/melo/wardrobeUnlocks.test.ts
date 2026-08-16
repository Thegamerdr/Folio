import { describe, expect, it } from 'vitest';

import type { CycleRecord } from '../../store';
import { evaluateWardrobe } from './wardrobeUnlocks';

const cycle = (label: string, safe = true): CycleRecord => ({
  closedAt: `2026-0${label}-01`,
  label,
  spare: safe ? 10 : -10,
  tightPoint: safe ? 5 : -5,
  setAside: 0,
  note: '',
});

describe('evaluateWardrobe', () => {
  it('equips only one earned touch at a time', () => {
    expect(evaluateWardrobe([cycle('1')], [])).toEqual(['scarf']);
    expect(evaluateWardrobe([cycle('1'), cycle('2'), cycle('3')], [])).toEqual(['scarf']);
  });

  it('preserves only the currently equipped item', () => {
    expect(
      evaluateWardrobe([cycle('1'), cycle('2'), cycle('3')], ['headphones', 'keepsake', 'scarf']),
    ).toEqual(['headphones']);
  });
});
