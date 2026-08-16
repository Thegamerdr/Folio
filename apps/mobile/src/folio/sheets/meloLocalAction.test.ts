import { describe, expect, it } from 'vitest';

import { filterMeloFollowUpChips, resolveMeloLocalAction } from './meloLocalAction';

describe('Melo local action navigation', () => {
  it('removes action-label duplicates and repeated follow-up chips', () => {
    expect(
      filterMeloFollowUpChips(
        [{ label: 'Show the calendar' }, { label: 'Open payday ritual' }],
        [
          'Open payday ritual',
          'What is safe until then?',
          'Show calendar',
          'What is safe until then?',
        ],
      ),
    ).toEqual(['What is safe until then?']);
  });

  it('never renders more than three combined actions and follow-up chips', () => {
    expect(
      filterMeloFollowUpChips([{ label: 'One' }, { label: 'Two' }], ['Three', 'Four', 'Five']),
    ).toEqual(['Three']);
    expect(
      filterMeloFollowUpChips([{ label: 'One' }, { label: 'Two' }, { label: 'Three' }], ['Four']),
    ).toEqual([]);
  });

  it.each([
    ['open_what_if', 'check_purchase', { kind: 'screen', screen: 'whatif' }],
    ['review_imports', 'review_import', { kind: 'screen', screen: 'review' }],
    ['build_recovery_route', 'plan_recovery', { kind: 'screen', screen: 'recovery' }],
    ['open_payday_ritual', 'check_payday', { kind: 'screen', screen: 'ritual' }],
    ['open_subscriptions', 'review_subscriptions', { kind: 'screen', screen: 'subs' }],
    ['open_goals', 'review_goals', { kind: 'screen', screen: 'pots' }],
    ['open_calendar', 'review_calendar', { kind: 'screen', screen: 'calendar' }],
    ['open_timeline', 'explain_changes', { kind: 'screen', screen: 'timeline' }],
    ['open_account', 'review_accounts', { kind: 'screen', screen: 'account' }],
  ] as const)('routes %s to a real native surface', (action, intent, expected) => {
    expect(resolveMeloLocalAction(action, intent)).toEqual(expected);
  });

  it('routes source explanation to the relevant existing surface', () => {
    expect(resolveMeloLocalAction('explain_sources', 'review_subscriptions')).toEqual({
      kind: 'screen',
      screen: 'subs',
    });
    expect(resolveMeloLocalAction('explain_sources', 'review_import')).toEqual({
      kind: 'screen',
      screen: 'review',
    });
    expect(resolveMeloLocalAction('explain_sources', 'check_purchase')).toEqual({
      kind: 'sheet',
      sheet: 'safe-zone',
    });
  });

  it('keeps question help inside the local conversation', () => {
    expect(resolveMeloLocalAction('ask_clarifying_question', 'clarify')).toEqual({
      kind: 'prompt',
      prompt: 'What can I ask you?',
    });
  });

  it('routes explicit higher-risk help actions to official HTTPS resources', () => {
    expect(resolveMeloLocalAction('open_free_debt_help', 'review_debts')).toEqual({
      kind: 'external',
      url: 'https://www.moneyhelper.org.uk/en/money-troubles/dealing-with-debt/debt-advice-locator',
    });
    expect(resolveMeloLocalAction('open_uk_emergency_help', 'plan_recovery')).toEqual({
      kind: 'external',
      url: 'https://www.gov.uk/guidance/999-and-112-the-uks-national-emergency-numbers',
    });
  });
});
