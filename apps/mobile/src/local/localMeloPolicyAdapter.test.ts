import { describe, expect, it } from 'vitest';

import { draftMeloLocalAiResponse } from '@folio/ai-contracts';

import {
  buildCompactMeloNote,
  gateMeloLocalAiDraft,
  gateMeloText,
} from './localMeloPolicyAdapter.js';

const snapshot = {
  availableNowMinor: 50_000,
  currency: 'GBP',
  nextPaydayLabel: 'Friday payday',
  pendingReviewCount: 0,
  protectedItems: [],
  tightestBalanceMinor: 30_000,
  tightestDay: 'Friday',
} as const;

describe('local Melo policy adapter', () => {
  it('passes a safe deterministic Melo draft unchanged', () => {
    const draft = draftMeloLocalAiResponse({
      cloudAiEnabled: false,
      cloudConsentGranted: false,
      prompt: 'Can I spend 20 before payday?',
      snapshot,
      source: 'typed_prompt',
    });
    const gated = gateMeloLocalAiDraft(draft);

    expect(gated.renderable).toBe(true);
    expect(gated.draft).toBe(draft);
    expect(gated.blockedReasons).toEqual([]);
  });

  it('blocks unsafe wording anywhere in the renderable Melo draft payload', () => {
    const draft = draftMeloLocalAiResponse({
      cloudAiEnabled: false,
      cloudConsentGranted: false,
      prompt: 'Can I spend 20 before payday?',
      snapshot,
      source: 'typed_prompt',
    });
    const gated = gateMeloLocalAiDraft({
      ...draft,
      actions: [
        {
          detail: 'You should invest in this product.',
          kind: 'explain_sources',
          label: 'Unsafe action',
          requiresUserReview: false,
        },
      ],
    });

    expect(gated.renderable).toBe(false);
    expect(gated.blockedReasons).toContain('personal_recommendation');
    expect(gated.draft.actions).toEqual([]);
    expect(gated.draft.requiresUserReview).toBe(true);
    expect(gated.draft.financialConclusion).toBe(
      'No record changed. Confirmed local figures remain the source of truth.',
    );
  });

  it('gates standalone Melo text before display', () => {
    expect(gateMeloText('Everything stays inspectable.', 'Fallback')).toBe(
      'Everything stays inspectable.',
    );
    expect(gateMeloText('You should pay that debt first.', 'Fallback')).toBe('Fallback');
  });

  it('builds compact Melo notes with bounded review/source control', () => {
    const verbose =
      'Melo has noticed a very long local route movement that could otherwise become a paragraph full of explanatory copy and distract from review.';
    const note = buildCompactMeloNote({
      control: 'Review sources before anything changes.',
      matters: 'The plan movement remains linked to source records.',
      noticed: verbose,
    });

    expect(note.text).toContain('Melo noticed:');
    expect(note.text).toContain('Why it matters:');
    expect(note.text).toContain('Your control: Review sources before anything changes.');
    expect(note.noticed.length).toBeLessThan(verbose.length);
    expect(note.accessibilityLabel).not.toContain('\n');
  });

  it('policy-gates compact notes and falls back before unsafe copy renders', () => {
    const note = buildCompactMeloNote({
      control: 'You should pay that debt first.',
      fallback: {
        control: 'Review sources before anything changes.',
        matters: 'Review items stay separate from facts.',
        noticed: 'Melo checked local records.',
      },
      matters: 'This creates a guaranteed outcome.',
      noticed: 'Melo can decide the best financial move.',
    });

    expect(note.text).toBe(
      [
        'Melo noticed: Melo checked local records.',
        'Why it matters: Review items stay separate from facts.',
        'Your control: Review sources before anything changes.',
      ].join('\n'),
    );
    expect(note.text).not.toMatch(/\bshould\b|guaranteed|best financial move/iu);
  });
});
