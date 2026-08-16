import { describe, expect, it } from 'vitest';

import { resolveLocalMeloSafety } from './localMeloSafety';

describe('local Melo safety routing', () => {
  it('prioritises immediate-needs safety and exposes official, explicit actions', () => {
    const result = resolveLocalMeloSafety('I cannot eat and I need emergency food support');

    expect(result).toMatchObject({
      state: 'escalated',
      intent: 'plan_recovery',
      actions: [
        { kind: 'open_uk_emergency_help' },
        { kind: 'open_free_debt_help' },
        { kind: 'build_recovery_route' },
      ],
    });
    if (result.state === 'escalated') {
      expect(result.reply).toContain('999 or 112');
      expect(result.reply).toContain('Melo has not changed anything');
    }
  });

  it('routes formal debt solutions to qualified free help without choosing one', () => {
    const result = resolveLocalMeloSafety('Should I enter an IVA or declare bankruptcy?');

    expect(result).toMatchObject({
      state: 'escalated',
      intent: 'review_debts',
      actions: [{ kind: 'open_free_debt_help' }],
    });
    if (result.state === 'escalated') expect(result.reply).toContain('will not choose');
  });

  it.each([
    ['Can I claim this as tax deductible?', 'clarify'],
    ['I need help with a legal dispute and court claim', 'explain_changes'],
    ['Which investment should I buy shares in?', 'check_purchase'],
    ['Which loan is best for me?', 'check_purchase'],
  ] as const)('routes %s through the regulated boundary', (prompt, intent) => {
    expect(resolveLocalMeloSafety(prompt)).toMatchObject({ state: 'escalated', intent });
  });

  it('does not turn an ordinary emergency-fund question into a crisis route', () => {
    expect(resolveLocalMeloSafety('How much is in my emergency fund?')).toEqual({ state: 'none' });
  });
});
