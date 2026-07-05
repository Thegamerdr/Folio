/**
 * @rn-lib       modeFraming
 * @purpose      One place that maps every mode to the short framing lines
 *               used across secondary surfaces (Pots, Subs, Calendar,
 *               Cycle Close). The Today engines own their own hero copy;
 *               everything else pulls from here so voice doesn't drift.
 * @copy         COPY_LINT clean. One accent word per headline where
 *               present. Never generic saving/spending advice.
 * @notes        RN port of folio-melo (design-main) `src/lib/modes/framing.ts`,
 *               kept verbatim. Consumers pass a mode + a surface, get back
 *               { eyebrow, sublabel }.
 */
import type { MoneyMode } from './types';

export type FramingSurface = 'pots' | 'subs' | 'calendar' | 'cycleClose';

export type Framing = {
  /** Small uppercase eyebrow — reuses the mode label. */
  eyebrow: string;
  /** Plain-language sublabel telling the user how this mode reads this surface. */
  sublabel: string;
};

const F: Record<FramingSurface, Record<MoneyMode, Framing>> = {
  pots: {
    survival: { eyebrow: 'Survival', sublabel: 'Only tap a pot if today needs it.' },
    stability: { eyebrow: 'Stability', sublabel: 'Buffer first, everything else follows.' },
    growth: { eyebrow: 'Growth', sublabel: "Feed the pot that's furthest from its goal." },
    debt: { eyebrow: 'Debt', sublabel: 'Any extra here becomes a repayment chip.' },
    irregular: { eyebrow: 'Irregular', sublabel: 'Overflow weeks feed the runway pot.' },
    household: { eyebrow: 'Household', sublabel: 'Your half only. The other half stays neutral.' },
    planning: { eyebrow: 'Planning', sublabel: 'Every top-up nudges the goal date closer.' },
    optimizer: { eyebrow: 'Optimizer', sublabel: 'Recovered £ from a cut sub can land here.' },
    reset: { eyebrow: 'Reset', sublabel: 'One pot at a time. No pace, no pressure.' },
    lowVis: { eyebrow: 'Looking', sublabel: 'Skim only. Save later once the shape is clear.' },
  },
  subs: {
    survival: { eyebrow: 'Survival', sublabel: 'Quiet ones first — they buy back the tight days.' },
    stability: { eyebrow: 'Stability', sublabel: 'Renewals are the shape of the month.' },
    growth: { eyebrow: 'Growth', sublabel: 'Every cut sub is a top-up somewhere else.' },
    debt: { eyebrow: 'Debt', sublabel: 'Cut one, redirect it straight to a repayment.' },
    irregular: { eyebrow: 'Irregular', sublabel: 'Lower fixed bills = longer runway.' },
    household: { eyebrow: 'Household', sublabel: 'Split each renewal at the source.' },
    planning: { eyebrow: 'Planning', sublabel: 'One less sub buys one more week toward the goal.' },
    optimizer: { eyebrow: 'Optimizer', sublabel: 'The main stage — ranked by £/mo leaking.' },
    reset: { eyebrow: 'Reset', sublabel: "Cancel the smallest one you don't use. That's enough." },
    lowVis: { eyebrow: 'Looking', sublabel: "Just read them. Don't decide yet." },
  },
  calendar: {
    survival: { eyebrow: 'Survival', sublabel: 'The tightest day is the one that matters.' },
    stability: { eyebrow: 'Stability', sublabel: 'Read the rhythm, not the drop.' },
    growth: { eyebrow: 'Growth', sublabel: 'Green days are pot-feed days.' },
    debt: { eyebrow: 'Debt', sublabel: 'Repayment dates are the anchors.' },
    irregular: { eyebrow: 'Irregular', sublabel: 'Invoice dates matter more than paydays.' },
    household: { eyebrow: 'Household', sublabel: 'Shared bills only — your side is halved.' },
    planning: { eyebrow: 'Planning', sublabel: 'The goal date sits ahead of the last payday.' },
    optimizer: {
      eyebrow: 'Optimizer',
      sublabel: 'Renewal marks show what to cancel before it charges.',
    },
    reset: { eyebrow: 'Reset', sublabel: 'Just this week. Nothing further out.' },
    lowVis: { eyebrow: 'Looking', sublabel: "The blank days are what Folio hasn't seen yet." },
  },
  cycleClose: {
    survival: { eyebrow: 'Survival', sublabel: "You made it. That's the whole win." },
    stability: { eyebrow: 'Stability', sublabel: 'The month held. Buffer intact.' },
    growth: { eyebrow: 'Growth', sublabel: "This cycle's set-aside moves the pace." },
    debt: { eyebrow: 'Debt', sublabel: 'Every closed cycle chips the balance down.' },
    irregular: { eyebrow: 'Irregular', sublabel: 'One more month of runway logged.' },
    household: { eyebrow: 'Household', sublabel: 'Both sides met their share. Neutral, honest.' },
    planning: { eyebrow: 'Planning', sublabel: 'One more cycle closer to the target.' },
    optimizer: { eyebrow: 'Optimizer', sublabel: 'Recovered £ is real money you kept.' },
    reset: { eyebrow: 'Reset', sublabel: "Held the essentials. That's enough for now." },
    lowVis: { eyebrow: 'Looking', sublabel: 'Now Folio has a whole cycle to learn from.' },
  },
};

export function getFraming(mode: MoneyMode, surface: FramingSurface): Framing {
  return F[surface][mode] ?? F[surface].survival;
}
