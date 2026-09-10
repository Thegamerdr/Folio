import { beforeEach, describe, expect, it } from 'vitest';
import { draftMeloLocalAiResponse } from '@folio/ai-contracts';
import { getState, resetToEmpty, type AppState } from '../store';
import { buildMeloSnapshot } from './meloSnapshot';
import { buildMeloLocalCalculation } from './meloCalculations';
import { buildMeloSourceFigures, meloChatStarters } from './meloSourceFigures';
import { resolveMeloLocalAction } from '../sheets/meloLocalAction';
import { getStarters } from './modes/starters';

const now = new Date('2026-09-09T12:00:00Z');
function fixture(): AppState {
  const base = getState();
  return {
    ...base,
    accounts: [],
    currentBalance: { ...base.currentBalance, amount: 1800, provided: true },
    onboarding: {
      ...base.onboarding,
      done: true,
      financialSetupConfirmed: true,
      payday: 9,
      monthlyIncome: 1800,
    },
    incomeSources: [
      {
        id: 'pay',
        label: 'Private salary',
        amount: 1800,
        cadence: 'monthly',
        dayOfMonth: 9,
        source: 'manual',
      },
    ],
    subs: [
      {
        name: 'Private rent and bills',
        cost: 950,
        obligationAnchorISO: '2026-09-12',
        nextRenewalISO: '2026-09-12',
        nextRenewalDaysAway: 3,
        lastUsedDaysAgo: 0,
        usesPerMonth: 0,
      },
    ],
    bufferAmount: 200,
    modeExtras: { reset: 70 },
  };
}
function explain(state: AppState) {
  const snapshot = buildMeloSnapshot(state, 'calm', now);
  const calculation = buildMeloLocalCalculation({
    state,
    snapshot,
    now,
    request: {
      intent: 'explain_position',
      prompt: 'Why is my tight point so low?',
      detectedAmountMinor: null,
    },
  });
  return {
    snapshot,
    calculation,
    draft: draftMeloLocalAiResponse({
      prompt: 'Why is my tight point so low?',
      resolvedIntent: 'explain_position',
      snapshot,
      calculation,
      cloudAiEnabled: false,
      cloudConsentGranted: false,
      source: 'typed_prompt',
    }),
  };
}
beforeEach(() => resetToEmpty());
describe('Melo audit explanation and draft affordances', () => {
  it('preserves the £350 payday result and distinguishes £1800 cash, reserves, essentials and buffer', () => {
    const state = fixture();
    const { calculation, draft } = explain(state);
    expect(calculation).toMatchObject({
      position: {
        cashMinor: 180000,
        reservedCostsMinor: 125000,
        essentialsMinor: 30000,
        bufferMinor: 20000,
        safeToSpendMinor: 35000,
      },
    });
    expect(draft.answer).toContain('£1,800 cash now');
    expect(draft.answer).toContain('£1,250 is reserved');
    expect(draft.answer).toContain('£300 for everyday essentials');
    expect(draft.answer).toContain('£350 is left after your protected buffer');
    expect(draft.answer).toContain('9 Oct 2026');
    expect(draft.answer).not.toMatch(
      /forecast engine|current balance setting|row-level|relevant surface/,
    );
    expect(JSON.stringify(calculation)).not.toContain('Private');
    expect(buildMeloSourceFigures(state, now).rows[0]).toMatchObject({
      label: 'Private rent and bills',
      amount: '£950.00',
      detail: '12 Sept 2026',
      destination: 'calendar',
    });
  });
  it('describes a shortfall as a gap without relabeling it as cash', () => {
    const state = fixture();
    state.currentBalance.amount = 200;
    const { draft } = explain(state);
    expect(draft.answer).toContain('£200 cash now');
    expect(draft.answer).toContain('£1,250 gap');
    expect(draft.answer).not.toMatch(/−£1,250 available now|safe to spend/);
  });
  it('keeps overdue costs visible by name and does not treat them as paid', () => {
    const state = fixture();
    state.subs = [
      { ...state.subs[0]!, obligationAnchorISO: '2026-09-06', nextRenewalISO: '2026-09-06' },
    ];
    expect(explain(state).draft.answer).toContain('overdue commitment is still reserved');
    expect(buildMeloSourceFigures(state, now).rows[0]?.detail).toContain('Overdue');
  });
  it('offers full manual setup for fresh and partial states without unavailable bank advice', () => {
    for (const partial of [false, true]) {
      const state = getState();
      if (partial) state.currentBalance = { ...state.currentBalance, provided: true, amount: 1800 };
      const { draft } = explain(state);
      expect(draft.answer).toContain('payday');
      expect(draft.answer).toContain('regular costs');
      expect(draft.answer).toContain('essentials and buffer');
      expect(draft.answer).not.toMatch(/connect an account|bank|safe to spend/);
      expect(draft.actions[0]).toMatchObject({
        kind: 'open_manual_setup',
        label: partial ? 'Resume setup' : 'Add my numbers',
      });
      expect(resolveMeloLocalAction('open_manual_setup', 'explain_position')).toEqual({
        kind: 'sheet',
        sheet: 'onboarding',
      });
    }
  });
  it('does not imply sample merchant facts in personal or business suggestions', () => {
    expect(meloChatStarters('personal').join(' ')).not.toMatch(/Spotify|Netflix|Tesco/);
    expect(getStarters('survival').join(' ')).not.toMatch(/Spotify|Netflix|Tesco/);
    expect(meloChatStarters('personal')).toContain('Help me review a regular charge');
    expect(meloChatStarters('business')).toContain('Explain my business cash position');
  });
});
