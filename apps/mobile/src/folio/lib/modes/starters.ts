/**
 * @rn-lib       modeStarters
 * @purpose      Quick-prompt chips shown in an empty Melo chat, tinted
 *               per lens. Six per archetype so Melo's "What's on your
 *               mind?" screen always matches how the user is living with
 *               money right now — not the same handful for a
 *               Debt-payer, a Runway-freelancer and a Reset-week user.
 * @copy         COPY_LINT clean. Written first-person as the user would
 *               ask them, so tapping feels like sending your own line.
 * @notes        RN port of folio-melo (design-main) `src/lib/modes/starters.ts`,
 *               kept verbatim.
 */
import type { MoneyMode } from './types';

const STARTERS: Record<MoneyMode, string[]> = {
  survival: [
    'Why is my Danger Date so close?',
    'Can I afford £40 on Friday?',
    'Talk me out of this Spotify charge',
    "How's the month going?",
    "What's the smallest move that helps today?",
    'Show me what Bills Shield is holding',
  ],
  stability: [
    'Is the rhythm still holding?',
    'What could I lift the buffer to?',
    "Anything renewing that I'd forget?",
    'Sanity-check the month for me',
    "Where's the quietest week to top up a pot?",
    'What would break the shape this cycle?',
  ],
  growth: [
    "How's the pace this month?",
    "What's the fastest small nudge?",
    'Which pot is furthest from its goal?',
    'Trim one thing to feed the pace?',
    "Where's next month's pace coming from?",
    'What would the pace look like if I skipped one sub?',
  ],
  debt: [
    'Is the balance moving down?',
    "What's exposed near payday?",
    'Any quiet subs I could redirect?',
    'Smallest chunk I could kill this week?',
    'Would £10 more a week finish it sooner?',
    "What's a fair repayment I could actually hold?",
  ],
  irregular: [
    'How far does the current balance stretch?',
    "What's already committed this cycle?",
    'When would that next inflow need to land?',
    'Which fixed costs cost me the most runway?',
    "What's a safe weekly draw from here?",
    'Which weeks would run tight if nothing lands?',
  ],
  household: [
    "What's mine vs what's shared?",
    'Anything shared that feels off?',
    'Is my side on track this cycle?',
    'Fair split on the next renewal?',
    'Which renewals should we split at source?',
    'What did the shared side actually cost this month?',
  ],
  planning: [
    "What's the goal date at this pace?",
    'What would move the date closer?',
    'Sanity-check the plan against real spend',
    'Speed it up without hurting the week?',
    "What breaks the plan if I don't top up?",
    'Show me the next three milestones',
  ],
  optimizer: [
    "What's the biggest leak right now?",
    "Any sub I haven't opened lately?",
    'Sweep once more for anything quiet',
    'One clean cut this week — pick it',
    'Rank the leaks by £/mo',
    'What did I recover this month?',
  ],
  reset: [
    "What's essential this week?",
    'One small doable move for today?',
    'Something gentle I could cancel?',
    'Just this week — what matters?',
    'How many days of essentials do I hold?',
    "Nothing bigger yet — what's the one step?",
  ],
  lowVis: [
    'What do you actually know so far?',
    "What's roughly true right now?",
    'One input that would sharpen the picture?',
    "Talk it through — I'll add stuff as we go",
    'What would a rough estimate look like?',
    'Which number would you like me to fill in first?',
  ],
};

export function getStarters(mode: MoneyMode): string[] {
  return STARTERS[mode] ?? STARTERS.survival;
}
