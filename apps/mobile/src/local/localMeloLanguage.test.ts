import { describe, expect, it } from 'vitest';

import {
  acceptLocalMeloRephrase,
  canonicalPromptForLocalIntent,
  parseLocalMeloRoute,
} from './localMeloLanguagePolicy';

describe('local Melo language gates', () => {
  it('accepts only allow-listed route JSON', () => {
    expect(parseLocalMeloRoute('{"intent":"review_debts"}')).toEqual({
      intent: 'review_debts',
    });
    expect(parseLocalMeloRoute('{"intent":"wire_money"}')).toBeNull();
    expect(parseLocalMeloRoute('not json')).toBeNull();
  });

  it('carries only a user-stated purchase amount into the deterministic prompt', () => {
    expect(canonicalPromptForLocalIntent('check_purchase', 'would forty be okay?')).toBeNull();
    expect(canonicalPromptForLocalIntent('check_purchase', 'would £40.50 be okay?')).toBe(
      'Can I afford £40.50?',
    );
  });

  it('rejects invented numbers and write-completion claims in rephrased text', () => {
    expect(
      acceptLocalMeloRephrase('Your Safe Zone is £40.', 'Your Safe Zone is £40.', 'why?'),
    ).toBe('Your Safe Zone is £40.');
    expect(
      acceptLocalMeloRephrase('Your Safe Zone is £45.', 'Your Safe Zone is £40.', 'why?'),
    ).toBeNull();
    expect(
      acceptLocalMeloRephrase(
        'I have recorded that for you.',
        'Check it before confirming.',
        'spent £4',
      ),
    ).toBeNull();
  });
});
