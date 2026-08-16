import { describe, expect, it } from 'vitest';

import {
  MELO_TOOL_APPROVAL_DENIED,
  MELO_TOOL_APPROVAL_REQUESTED,
  MELO_TOOL_OUTPUT_AVAILABLE,
  MELO_TOOL_UNDONE,
  decideMeloToolSuggestion,
  describeMeloToolSuggestion,
  getMeloToolSuggestionPhase,
  settleMeloToolApplication,
  settleMeloToolUndo,
} from './meloToolSuggestion';

describe('Melo tool suggestion approval gate', () => {
  const pending = { state: MELO_TOOL_APPROVAL_REQUESTED };

  it('keeps a new suggestion pending until the user decides', () => {
    expect(getMeloToolSuggestionPhase(pending)).toBe('pending');
  });

  it('allows only Confirm to request a real store application', () => {
    expect(decideMeloToolSuggestion(pending, 'confirm')).toEqual({ type: 'apply' });
  });

  it('settles Dismiss without issuing an apply command', () => {
    expect(decideMeloToolSuggestion(pending, 'dismiss')).toEqual({
      type: 'settle',
      settlement: { state: MELO_TOOL_APPROVAL_DENIED },
    });
  });

  it.each([
    {
      label: 'already applied',
      suggestion: {
        state: MELO_TOOL_OUTPUT_AVAILABLE,
        output: { ok: true, message: 'Logged £12.00 at Market' },
      },
    },
    {
      label: 'failed',
      suggestion: {
        state: MELO_TOOL_OUTPUT_AVAILABLE,
        output: { ok: false, message: 'bad args' },
      },
    },
    { label: 'dismissed', suggestion: { state: MELO_TOOL_APPROVAL_DENIED } },
    { label: 'malformed legacy part', suggestion: { state: MELO_TOOL_OUTPUT_AVAILABLE } },
  ])('never reapplies an $label suggestion', ({ suggestion }) => {
    expect(decideMeloToolSuggestion(suggestion, 'confirm')).toEqual({ type: 'ignore' });
    expect(decideMeloToolSuggestion(suggestion, 'dismiss')).toEqual({ type: 'ignore' });
  });

  it('retains the real result returned after confirmation', () => {
    const success = settleMeloToolApplication(true, 'Logged £12.00 at Market');
    const failure = settleMeloToolApplication(false, 'bad args');

    expect(success).toEqual({
      state: MELO_TOOL_OUTPUT_AVAILABLE,
      output: { ok: true, message: 'Logged £12.00 at Market' },
    });
    expect(getMeloToolSuggestionPhase(success)).toBe('applied');
    expect(getMeloToolSuggestionPhase(failure)).toBe('failed');
  });

  it('settles an undone action as a truthful, non-applied transcript state', () => {
    const undone = settleMeloToolUndo();
    expect(undone).toEqual({
      state: MELO_TOOL_UNDONE,
      output: { ok: true, message: 'Undone. Nothing changed.' },
    });
    expect(getMeloToolSuggestionPhase(undone)).toBe('undone');
  });

  it('describes the exact proposed mutation before confirmation', () => {
    expect(describeMeloToolSuggestion('log_spend', { amount: 3.5, merchant: 'Greggs' })).toBe(
      'Log £3.50 spent at Greggs.',
    );
    expect(
      describeMeloToolSuggestion('log_transfer', {
        amount: 100,
        from: 'Current',
        to: 'Savings',
      }),
    ).toBe('Log a £100.00 transfer from Current to Savings.');
  });
});
