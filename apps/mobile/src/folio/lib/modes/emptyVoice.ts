/**
 * Mode-tinted empty-state copy for secondary surfaces (Pots, Subs).
 *
 * RN port of folio-melo (design-main) `src/lib/modes/emptyVoice.ts`, kept
 * verbatim. Same layout, same CTAs — ten voices. Every string obeys
 * COPY_LINT (no banned words, one terracotta accent word per headline).
 * Ports as a pure lookup.
 *
 * Shape:
 *   headlineLead + <em>accent</em> + headlineTail
 *   body
 *
 * Consumers assemble the headline with the terracotta accent span so the
 * one-accent-word rule is preserved consistently.
 */
import type { MoneyMode } from './types';

export type EmptyVoiceCopy = {
  headlineLead: string;
  headlineAccent: string;
  headlineTail: string;
  body: string;
};

type Surface = 'pots' | 'subs';

const POTS: Record<MoneyMode, EmptyVoiceCopy> = {
  survival: {
    headlineLead: 'No ',
    headlineAccent: 'pots',
    headlineTail: ' yet.',
    body: "A pot is a small set-aside for one thing. Add the first one and Folio will quietly set it aside from what's left over.",
  },
  stability: {
    headlineLead: 'Room for a ',
    headlineAccent: 'pot',
    headlineTail: '.',
    body: 'Bills are covered. A pot turns steady months into something you can point at.',
  },
  growth: {
    headlineLead: 'First ',
    headlineAccent: 'pot',
    headlineTail: ' starts the pace.',
    body: 'Growth is easier when it has a name. Add a pot and every payday quietly feeds it.',
  },
  debt: {
    headlineLead: 'One ',
    headlineAccent: 'pot',
    headlineTail: ' — a small buffer.',
    body: 'Not everything spare should chase the balance. A tiny buffer stops one bad week undoing a month.',
  },
  irregular: {
    headlineLead: 'A ',
    headlineAccent: 'runway',
    headlineTail: ' pot first.',
    body: 'Irregular months need a cushion. One pot for bills, everything else can breathe.',
  },
  household: {
    headlineLead: 'A ',
    headlineAccent: 'shared',
    headlineTail: ' pot.',
    body: 'Pots make shared plans concrete — a trip, a bill fund, a Christmas. Name one and start it small.',
  },
  planning: {
    headlineLead: 'The ',
    headlineAccent: 'goal',
    headlineTail: ' lives in a pot.',
    body: 'Give the thing a name and a number. Folio will draw a line from today to there.',
  },
  optimizer: {
    headlineLead: 'A pot for the ',
    headlineAccent: 'recovered',
    headlineTail: ' money.',
    body: 'The leaks you close should land somewhere visible. One pot, one purpose.',
  },
  reset: {
    headlineLead: 'One tiny ',
    headlineAccent: 'pot',
    headlineTail: '.',
    body: 'Nothing ambitious yet. A small essentials cushion is enough for this week.',
  },
  lowVis: {
    headlineLead: 'Pots ',
    headlineAccent: 'later',
    headlineTail: '.',
    body: "Once there's enough signal to trust the number, a pot will make more sense. Add a statement first.",
  },
};

const SUBS: Record<MoneyMode, EmptyVoiceCopy> = {
  survival: {
    headlineLead: 'No ',
    headlineAccent: 'subs',
    headlineTail: ' yet.',
    body: "Add a streaming service, gym, or anything that comes out every month. You'll see what still earns its place.",
  },
  stability: {
    headlineLead: 'Nothing ',
    headlineAccent: 'recurring',
    headlineTail: ' tracked.',
    body: 'Add a sub and Folio will keep an eye on renewals so nothing surprises the buffer.',
  },
  growth: {
    headlineLead: 'Every sub is a ',
    headlineAccent: 'pace',
    headlineTail: ' question.',
    body: 'Add what comes out monthly. The list makes room for the goal visible.',
  },
  debt: {
    headlineLead: 'Every sub is a ',
    headlineAccent: 'leak',
    headlineTail: '.',
    body: 'Add what renews each month. The smallest cut can be the first repayment.',
  },
  irregular: {
    headlineLead: 'Fixed costs first — ',
    headlineAccent: 'add',
    headlineTail: ' one.',
    body: 'Runway is easier to plan when the recurring bills are named. Start with the biggest one.',
  },
  household: {
    headlineLead: 'Shared ',
    headlineAccent: 'subs',
    headlineTail: ' belong here.',
    body: 'Add the household streamers, utilities, memberships. Splits come later.',
  },
  planning: {
    headlineLead: 'Cost of ',
    headlineAccent: 'waiting',
    headlineTail: '.',
    body: 'Add each recurring cost — every one delays the goal a little. Best to see them.',
  },
  optimizer: {
    headlineLead: 'Where the ',
    headlineAccent: 'leaks',
    headlineTail: ' live.',
    body: 'Add every recurring charge, even the tiny ones. The list is the map.',
  },
  reset: {
    headlineLead: 'Just the ',
    headlineAccent: 'essentials',
    headlineTail: '.',
    body: 'Add only what has to keep running this month. Everything else can wait.',
  },
  lowVis: {
    headlineLead: 'Roughly, what ',
    headlineAccent: 'recurs',
    headlineTail: '?',
    body: 'Add the ones you know off the top of your head. Folio will sharpen the rest from a statement.',
  },
};

const REGISTRY: Record<Surface, Record<MoneyMode, EmptyVoiceCopy>> = {
  pots: POTS,
  subs: SUBS,
};

export function getEmptyVoice(mode: MoneyMode, surface: Surface): EmptyVoiceCopy {
  return REGISTRY[surface][mode] ?? REGISTRY[surface].survival;
}
