import type { LocalMeloTurn } from '@/local/localMeloTurn';

/**
 * Maps supported deterministic outcomes to the exact conversation copy. The local engine remains
 * the owner of classification, calculations and destination actions.
 */
export function presentMeloReply(result: LocalMeloTurn): string {
  if (
    result.intent === 'check_purchase' &&
    /(?:need one amount|Enter the amount you want to check)/i.test(result.reply)
  ) {
    return 'I need an amount before I can check that. Type the amount you want to test.';
  }
  if (result.intent === 'review_subscriptions' && /(?:could not|couldn’t|couldn't|can’t|can't) find/i.test(result.reply)) {
    const quoted = result.reply.match(/[“‘']([^”’']+)[”’']/)?.[1] ?? 'that subscription';
    return `I can’t find one clear match for ‘${quoted}’. Nothing has changed.`;
  }
  if (
    (result.intent === 'review_subscriptions' || result.intent === 'review_recurring') &&
    result.actions?.some((action) => action.kind === 'open_subscriptions')
  ) {
    return 'Subscriptions are managed in Plan. Nothing has changed.';
  }
  if (result.intent === 'check_payday' && /next income date is not set up/i.test(result.reply)) {
    const destination = result.actions?.find(
      (action) => action.kind === 'open_calendar' || action.kind === 'open_manual_setup',
    );
    if (destination?.kind === 'open_manual_setup') {
      return `This needs to be added in ${destination.label}. I’ll leave your money unchanged.`;
    }
    if (destination?.kind === 'open_calendar') {
      return 'This needs to be added in Calendar. I’ll leave your money unchanged.';
    }
  }
  if (/Your money picture is not complete yet\. Add or confirm your /i.test(result.reply)) {
    return 'I can’t work that out from what’s recorded yet. Add or review the missing amount, then ask again.';
  }
  return result.reply;
}
