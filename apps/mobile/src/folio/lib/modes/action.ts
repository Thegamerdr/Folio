/**
 * @rn-lib       modeAction
 * @purpose      Mode-aware copy for the three action screens:
 *               Shortfall (the honest gap), WhatIf (spend preview),
 *               Recovery (something has to move). Each screen keeps its
 *               layout — only strings tint by mode so voice matches how
 *               the user is living with money right now.
 * @copy         COPY_LINT clean. One accent word per headline.
 * @notes        RN port of folio-melo (design-main) `src/lib/modes/action.ts`,
 *               kept verbatim.
 */
import type { MoneyMode } from './types';

export type ShortfallCopy = {
  eyebrow: string;
  intro: string; // italic display line
  headlineLead: string; // e.g. "Short by"
  meloDefault: string; // fallback melo close-line
  pauseLabel: string; // eyebrow on the pause-sub move
  potLabel: string; // eyebrow on the borrow-from-pot move
  holdLabel: string; // eyebrow on the spend-hold move
  leaveIt: string; // bottom quiet CTA
};

export type WhatIfCopy = {
  eyebrow: string;
  intro: string; // italic display line
  headlineTemplate: (amount: number) => { lead: string; accent: string; tail: string };
  lowLabel: string; // "New lowest" style label
  coverLabel: string; // "Days this would last" style
  cta: string; // main CTA button
  cancel: string; // secondary
};

export type RecoveryCopy = {
  eyebrow: string;
  intro: string;
  headlineLead: string; // "Something has to"
  headlineAccent: string; // "move."
  shortfallLabel: string;
  afterLabel: string;
  meloDefault: string;
  cta: string; // "Rebuild the plan" style
};

const S: Record<MoneyMode, ShortfallCopy> = {
  survival: {
    eyebrow: 'A quiet moment',
    intro: 'Honest answer',
    headlineLead: 'Short by',
    meloDefault: 'No move is fine too. Knowing the gap is half the work.',
    pauseLabel: 'Pause one sub',
    potLabel: 'Borrow from a pot',
    holdLabel: 'Spend a little less',
    leaveIt: 'Leave it for now',
  },
  stability: {
    eyebrow: 'A quiet check',
    intro: 'The buffer wobbled',
    headlineLead: 'Buffer short by',
    meloDefault: 'The rhythm still holds. One small move rebuilds it.',
    pauseLabel: 'Pause one sub',
    potLabel: 'Top back up from a pot',
    holdLabel: 'Trim daily by',
    leaveIt: 'Let it settle',
  },
  growth: {
    eyebrow: 'A quiet pause',
    intro: 'The pace pinched',
    headlineLead: 'Behind by',
    meloDefault: 'The pace resumes next cycle. This one just needs air.',
    pauseLabel: 'Pause a feed',
    potLabel: 'Borrow from a slower pot',
    holdLabel: 'Hold daily at',
    leaveIt: 'Skip the feed',
  },
  debt: {
    eyebrow: 'A quiet honest moment',
    intro: 'The chip hurt',
    headlineLead: 'Behind by',
    meloDefault: 'Repayment stands. This gap does not undo it.',
    pauseLabel: 'Pause one sub',
    potLabel: 'Borrow from a pot',
    holdLabel: 'Hold daily at',
    leaveIt: 'Leave it for now',
  },
  irregular: {
    eyebrow: 'A quiet check',
    intro: 'Runway dipped',
    headlineLead: 'Runway short by',
    meloDefault: 'Next inflow lifts the floor. This is the gap to it.',
    pauseLabel: 'Pause a fixed cost',
    potLabel: 'Draw from the runway pot',
    holdLabel: 'Hold daily at',
    leaveIt: 'Ride it out',
  },
  household: {
    eyebrow: 'A quiet check',
    intro: 'Your half slipped',
    headlineLead: 'Your side short by',
    meloDefault: 'The other half is unchanged. Only your side needs a move.',
    pauseLabel: 'Pause your share of a sub',
    potLabel: 'Borrow from your pot',
    holdLabel: 'Hold your side at',
    leaveIt: 'Talk it over first',
  },
  planning: {
    eyebrow: 'A quiet trade-off',
    intro: 'The date drifted',
    headlineLead: 'Behind by',
    meloDefault: 'One later week beats an abandoned goal.',
    pauseLabel: 'Pause one sub',
    potLabel: 'Delay one feed',
    holdLabel: 'Hold daily at',
    leaveIt: 'Let the date slide',
  },
  optimizer: {
    eyebrow: 'A quiet leak',
    intro: 'Something crept back',
    headlineLead: 'Leaking',
    meloDefault: 'Cut one thing you never use. That closes it.',
    pauseLabel: 'Cut a quiet sub',
    potLabel: 'Borrow while you cut',
    holdLabel: 'Cap daily at',
    leaveIt: 'Skip for now',
  },
  reset: {
    eyebrow: 'A quiet moment',
    intro: 'Just this',
    headlineLead: 'Short by',
    meloDefault: 'One move. No plan needed after it.',
    pauseLabel: 'Pause the loudest sub',
    potLabel: 'Borrow, gently',
    holdLabel: 'Hold daily at',
    leaveIt: 'Not today',
  },
  lowVis: {
    eyebrow: 'A quiet guess',
    intro: 'Rough picture',
    headlineLead: 'Maybe short by',
    meloDefault: 'This is a guess. Add a statement and it sharpens.',
    pauseLabel: 'Pause a sub you know of',
    potLabel: 'Borrow from a pot',
    holdLabel: 'Hold daily at',
    leaveIt: "Wait until it's clearer",
  },
};

const W: Record<MoneyMode, WhatIfCopy> = {
  survival: {
    eyebrow: 'Preview',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if I spend', accent: `£${a}`, tail: 'today?' }),
    lowLabel: 'New lowest',
    coverLabel: 'Days this would last',
    cta: 'See it on your money path',
    cancel: 'Close — nothing was added',
  },
  stability: {
    eyebrow: 'Rhythm check',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if I break rhythm by', accent: `£${a}`, tail: '?' }),
    lowLabel: 'Buffer after',
    coverLabel: 'Days this would last',
    cta: 'See it on the rhythm',
    cancel: 'Close — nothing was added',
  },
  growth: {
    eyebrow: 'Pace check',
    intro: 'A quiet trade-off',
    headlineTemplate: (a) => ({ lead: 'What if', accent: `£${a}`, tail: 'skips a feed?' }),
    lowLabel: 'Pace after',
    coverLabel: 'Days lost from pace',
    cta: 'See it on the pace',
    cancel: 'Close — pace unchanged',
  },
  debt: {
    eyebrow: 'Chip check',
    intro: 'A quiet trade-off',
    headlineTemplate: (a) => ({ lead: 'What if', accent: `£${a}`, tail: 'misses a chip?' }),
    lowLabel: 'Balance after',
    coverLabel: 'Days added to debt',
    cta: 'See it on the chip-down',
    cancel: 'Close — chip unchanged',
  },
  irregular: {
    eyebrow: 'Runway check',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if', accent: `£${a}`, tail: 'leaves the runway?' }),
    lowLabel: 'Runway after',
    coverLabel: 'Days of runway left',
    cta: 'See it on the runway',
    cancel: 'Close — runway unchanged',
  },
  household: {
    eyebrow: 'Side check',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if your side spends', accent: `£${a}`, tail: '?' }),
    lowLabel: 'Your side after',
    coverLabel: 'Days your side lasts',
    cta: 'See it on your side',
    cancel: 'Close — nothing was added',
  },
  planning: {
    eyebrow: 'Date check',
    intro: 'A quiet trade-off',
    headlineTemplate: (a) => ({ lead: 'What if', accent: `£${a}`, tail: 'moves the date?' }),
    lowLabel: 'Date after',
    coverLabel: 'Days pushed back',
    cta: 'See it on the date',
    cancel: 'Close — date unchanged',
  },
  optimizer: {
    eyebrow: 'Leak check',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if', accent: `£${a}`, tail: 'leaks again?' }),
    lowLabel: 'Recovered after',
    coverLabel: 'Days of leak allowed',
    cta: 'See it on the leaks',
    cancel: 'Close — nothing was cut',
  },
  reset: {
    eyebrow: 'Just this',
    intro: 'A quiet experiment',
    headlineTemplate: (a) => ({ lead: 'What if I use', accent: `£${a}`, tail: 'today?' }),
    lowLabel: 'Left after',
    coverLabel: 'Days this would last',
    cta: 'Hold this one',
    cancel: 'Close — nothing changed',
  },
  lowVis: {
    eyebrow: 'Rough preview',
    intro: 'A quiet guess',
    headlineTemplate: (a) => ({ lead: 'Roughly, if', accent: `£${a}`, tail: 'goes today?' }),
    lowLabel: 'Rough low',
    coverLabel: 'Rough days left',
    cta: 'Keep as a rough guide',
    cancel: 'Close — just looking',
  },
};

const R: Record<MoneyMode, RecoveryCopy> = {
  survival: {
    eyebrow: 'Recovery',
    intro: "It happens. Let's repair calmly.",
    headlineLead: 'Something has to',
    headlineAccent: 'move.',
    shortfallLabel: 'Shortfall',
    afterLabel: 'After this move',
    meloDefault: 'No shame here. One small move can rebuild the week.',
    cta: 'Rebuild the plan',
  },
  stability: {
    eyebrow: 'Rebalance',
    intro: "The rhythm wobbled. Let's re-set it.",
    headlineLead: 'Rhythm needs a',
    headlineAccent: 'nudge.',
    shortfallLabel: 'Off-rhythm',
    afterLabel: 'After the nudge',
    meloDefault: 'A small nudge is enough. The shape returns on its own.',
    cta: 'Rebalance',
  },
  growth: {
    eyebrow: 'Reset the pace',
    intro: "The pace pinched. That's fine.",
    headlineLead: 'The pace needs a',
    headlineAccent: 'breath.',
    shortfallLabel: 'Behind pace',
    afterLabel: 'After the breath',
    meloDefault: "One skipped feed doesn't unmake the pace.",
    cta: 'Reset the pace',
  },
  debt: {
    eyebrow: 'Protect the chip',
    intro: 'The chip stands. This just clears space.',
    headlineLead: 'One thing has to',
    headlineAccent: 'give.',
    shortfallLabel: 'Blocking chip',
    afterLabel: 'After the give',
    meloDefault: 'The chip goes through. That’s what matters this cycle.',
    cta: 'Protect the chip',
  },
  irregular: {
    eyebrow: 'Extend runway',
    intro: "Runway dipped. Let's stretch it back.",
    headlineLead: 'The runway needs a',
    headlineAccent: 'stretch.',
    shortfallLabel: 'Runway gap',
    afterLabel: 'After the stretch',
    meloDefault: 'One held cost buys real days.',
    cta: 'Stretch it back',
  },
  household: {
    eyebrow: 'Your side',
    intro: 'Only your half. The other stays neutral.',
    headlineLead: 'Your side needs a',
    headlineAccent: 'move.',
    shortfallLabel: 'Your gap',
    afterLabel: 'After your move',
    meloDefault: 'This is yours to handle. One small move is enough.',
    cta: 'Move your side',
  },
  planning: {
    eyebrow: 'Protect the date',
    intro: "The date drifted. Let's pull it back.",
    headlineLead: 'One thing has to',
    headlineAccent: 'shift.',
    shortfallLabel: 'Off-date',
    afterLabel: 'After the shift',
    meloDefault: 'A held goal is worth a small trade.',
    cta: 'Pull the date back',
  },
  optimizer: {
    eyebrow: 'Close a leak',
    intro: 'Something crept back in. Close it.',
    headlineLead: 'Close one',
    headlineAccent: 'leak.',
    shortfallLabel: 'Leaking',
    afterLabel: 'After the cut',
    meloDefault: 'One clean cut usually does it.',
    cta: 'Close it',
  },
  reset: {
    eyebrow: 'One thing',
    intro: "Just one thing. That's enough today.",
    headlineLead: 'Move one',
    headlineAccent: 'thing.',
    shortfallLabel: 'Short',
    afterLabel: 'After the one',
    meloDefault: 'One move. That’s the whole task.',
    cta: 'Do the one thing',
  },
  lowVis: {
    eyebrow: 'Rough recovery',
    intro: 'Rough picture. Try one gentle move.',
    headlineLead: 'Maybe move',
    headlineAccent: 'one.',
    shortfallLabel: 'Maybe short',
    afterLabel: 'Rough after',
    meloDefault: 'This is a guess. A statement would sharpen it.',
    cta: 'Try one gentle move',
  },
};

export function getShortfallCopy(mode: MoneyMode): ShortfallCopy {
  return S[mode] ?? S.survival;
}
export function getWhatIfCopy(mode: MoneyMode): WhatIfCopy {
  return W[mode] ?? W.survival;
}
export function getRecoveryCopy(mode: MoneyMode): RecoveryCopy {
  return R[mode] ?? R.survival;
}
