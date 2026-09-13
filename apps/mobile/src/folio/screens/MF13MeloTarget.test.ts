import { describe, expect, it } from 'vitest';

import {
  buildMeloVoiceRecognitionOptions,
  describeMeloVoiceError,
  hasInstalledMeloVoiceLocale,
  resolveMeloVoiceRecognitionRoute,
} from '../lib/meloVoiceRecognition';
import { filterMeloFollowUpChips, resolveMeloLocalAction } from '../sheets/meloLocalAction';
import { presentMeloReply } from '../sheets/meloPresentation';
import type { LocalMeloTurn } from '../../local/localMeloTurn';

describe('MF13 Melo native behavior contract', () => {
  it('resolves explicit on-device, disclosed phone-service, and unavailable voice routes', () => {
    expect(resolveMeloVoiceRecognitionRoute(true, true)).toBe('on-device');
    expect(resolveMeloVoiceRecognitionRoute(true, false)).toBe('phone-service');
    expect(resolveMeloVoiceRecognitionRoute(false, true)).toBe('unavailable');
    expect(hasInstalledMeloVoiceLocale(['de-DE', 'en-US'])).toBe(true);
    expect(hasInstalledMeloVoiceLocale(['de-DE'])).toBe(false);
  });

  it('keeps voice finite, reviewable, and recoverable through typing', () => {
    expect(buildMeloVoiceRecognitionOptions('on-device')).toMatchObject({
      lang: 'en-GB',
      continuous: false,
      interimResults: true,
      maxAlternatives: 1,
      requiresOnDeviceRecognition: true,
    });
    expect(buildMeloVoiceRecognitionOptions('on-device')).not.toHaveProperty('recordingOptions');
    expect(describeMeloVoiceError('no-speech')).toBe('No speech detected. Try again or type instead.');
    expect(describeMeloVoiceError('not-allowed')).toContain('keep typing');
    expect(describeMeloVoiceError('language-not-supported')).toContain('Speech isn’t available');
  });

  it('keeps local actions on real native destinations and removes duplicate follow-ups', () => {
    expect(resolveMeloLocalAction('build_recovery_route', 'plan_recovery')).toEqual({
      kind: 'screen',
      screen: 'recovery',
    });
    expect(resolveMeloLocalAction('ask_clarifying_question', 'clarify')).toEqual({
      kind: 'prompt',
      prompt: 'What can I ask you?',
    });
    expect(
      filterMeloFollowUpChips(
        [{ label: 'Show the calendar' }, { label: 'Open payday ritual' }],
        ['Open payday ritual', 'What is safe until then?', 'Show calendar', 'What is safe until then?'],
      ),
    ).toEqual(['What is safe until then?']);
  });

  it('maps supported missing-amount and subscription outcomes without inventing an unavailable branch', () => {
    const turn = (reply: string, intent: LocalMeloTurn['intent'], actions: LocalMeloTurn['actions'] = []): LocalMeloTurn => ({
      reply,
      intent,
      actions,
      suggestions: [],
      followUpChips: [],
      context: null,
      control: 'none',
    });
    expect(
      presentMeloReply(turn('Enter the amount you want to check.', 'check_purchase')),
    ).toBe('I need an amount before I can check that. Type the amount you want to test.');
    expect(
      presentMeloReply(
        turn('There is one subscription.', 'review_subscriptions', [
          {
            kind: 'open_subscriptions',
            label: 'Open subscriptions',
            detail: 'Review local subscriptions.',
            requiresUserReview: false,
          },
        ]),
      ),
    ).toBe('Subscriptions are managed in Plan. Nothing has changed.');
    expect(presentMeloReply(turn('A normal answer.', 'clarify'))).toBe('A normal answer.');
  });
});
