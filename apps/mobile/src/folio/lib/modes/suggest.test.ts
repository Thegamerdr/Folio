// suggestMode tests — pure-logic coverage for
// apps/mobile/src/folio/lib/modes/suggest.ts, focused on the cadence-income fix
// (task: consume-income + empties). Before this fix, `income` was always
// `onboarding.monthlyIncome || 0`, so a weekly earner with declared
// `incomeSources` but no monthly onboarding lump was silently read as £0
// income everywhere `suggestMode` compares against `income`.
//
// Node-safe: touches only engine modules (no react-native runtime, no DOM),
// collected by the apps/**/*.test.ts runner via relative imports.

import { describe, expect, it } from 'vitest';

import { suggestMode } from './suggest';
import type { ModeInputs } from './types';
import type { CurrentBalance, IncomeSource, Onboarding } from '../../store';

function balance(overrides: Partial<CurrentBalance> = {}): CurrentBalance {
  return {
    amount: 1000,
    source: 'statement',
    confidence: 'statement-derived',
    setAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

const ONBOARDING_NO_LUMP: Onboarding = { done: true, name: 'Test', payday: 25, monthlyIncome: 0 };

function baseInputs(overrides: Partial<ModeInputs> = {}): ModeInputs {
  return {
    currentBalance: balance(),
    onboarding: ONBOARDING_NO_LUMP,
    pots: [],
    subs: [],
    subPaused: {},
    tightestSpare: 0,
    tightestDate: null,
    ...overrides,
  };
}

function weeklySource(amount: number): IncomeSource {
  return {
    id: 'staffline',
    label: 'Staffline',
    cadence: 'weekly',
    anchorISO: '2026-06-05',
    amount,
    source: 'inferred',
  };
}

describe('suggestMode — cadence-correct income (task: consume-income fix)', () => {
  it('recognises a weekly earner with no onboarding lump as knowing their income (no lowVis fallback)', () => {
    // Old behaviour: income = onboarding.monthlyIncome || 0 = 0 -> knowsIncome false ->
    // with knowsBalance true (source !== 'sample') the lowVis branch wouldn't fire either, but
    // every income-gated suggestion (growth/stability) would silently never trigger for this user.
    const suggestion = suggestMode('survival', baseInputs({ incomeSources: [weeklySource(299)] }));

    // 299/wk * 4.33 ~= £1295/mo. tightestSpare (0) is not > income * 0.2 (~£259), so no
    // stability suggestion fires here — but critically, it must not read as "no income known".
    expect(suggestion).not.toEqual(
      expect.objectContaining({ reason: expect.stringContaining('Not much to go on yet') }),
    );
  });

  it('suggests stability using the cadence-normalised weekly income, not the raw £0 onboarding lump', () => {
    // tightestSpare must exceed income * 0.2. With the OLD bug (income=0), ANY positive
    // tightestSpare would exceed £0 and wrongly fire stability immediately. Pin the real
    // threshold instead: 299 * 4.33 ~= 1294.67 -> 20% ~= 258.9.
    const inputs = baseInputs({
      incomeSources: [weeklySource(299)],
      tightestSpare: 200, // below the real 20% threshold (~258.9)
    });
    expect(suggestMode('survival', inputs)).toBeNull();

    const inputsAboveThreshold = baseInputs({
      incomeSources: [weeklySource(299)],
      tightestSpare: 300, // above the real 20% threshold (~258.9)
    });
    expect(suggestMode('survival', inputsAboveThreshold)).toEqual(
      expect.objectContaining({ mode: 'stability' }),
    );
  });

  it('falls back to the legacy onboarding.monthlyIncome lump when no incomeSources are declared', () => {
    const inputs = baseInputs({
      onboarding: { ...ONBOARDING_NO_LUMP, monthlyIncome: 2000 },
      tightestSpare: 500, // > 20% of 2000 (400)
    });
    expect(suggestMode('survival', inputs)).toEqual(expect.objectContaining({ mode: 'stability' }));
  });

  it('suggests lowVis only when truly no income, no real balance, and no subs are known', () => {
    const inputs = baseInputs({
      currentBalance: balance({ source: 'sample' }),
      incomeSources: [],
    });
    expect(suggestMode('survival', inputs)).toEqual(expect.objectContaining({ mode: 'lowVis' }));
  });
});
