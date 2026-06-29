// Typed copy module — the single source of truth for every visible string, ported
// 1:1 from the design deck (COPY_DECK.md). If a string isn't here, it doesn't ship.
//
// Strings are VERBATIM from the deck, including the **accent** markers. The render
// layer styles the accent word (terracotta) later — this module never strips them.
// Where the deck string carries a {param} placeholder, the entry is a function that
// takes the param(s) and returns the finished string.
//
// Grouped by deck section: global, today, ritual, add, pots, subs, insights, onb,
// short, nudge, err. Keys mirror the deck's dotted keys exactly (e.g. today.verdict.short).

export const copy = {
  // ## Global
  global: {
    app: {
      name: 'Folio',
      tag: 'Will my money last to payday?',
    },
    melo: {
      name: 'Melo',
    },
    currency: {
      symbol: '£',
    },
  },

  // ## Today screen
  today: {
    greeting: {
      morning: (name: string): string => `Morning, ${name}.`,
      afternoon: (name: string): string => `Afternoon, ${name}.`,
      evening: (name: string): string => `Evening, ${name}.`,
    },
    verdict: {
      safe: 'You **make it** to payday.',
      tight: "It's **tight**, but you make it.",
      short: (amount: string): string => `You're **short** by ${amount}.`,
    },
    days_left: (n: string): string => `${n} days to payday`,
    spend_today: 'Spent today',
    left_today: 'Left for today',
  },

  // ## Payday ritual
  ritual: {
    title: 'Close the **cycle.**',
    subtitle: 'A quiet minute. Just you and the numbers.',
    cta: {
      begin: 'Begin',
    },
    worked: {
      head: 'What **worked.**',
    },
    slipped: {
      head: 'What **slipped.**',
    },
    next: {
      head: 'Set the **next one.**',
    },
    done: {
      head: 'Sealed.',
      body: 'Folio remembers.',
    },
  },

  // ## Add a thing (entry flows)
  add: {
    title: 'Add **what** you have.',
    option: {
      statement: 'A statement (PDF)',
      photo: 'A photo',
      paste: 'Paste text',
      manual: 'Type it in',
    },
    success: {
      pdf: 'Folio **read** your statement.',
      image: 'Folio **read** your image.',
      paste: 'Things to **check.**',
    },
    fallback: {
      pdf: 'File **saved.**',
      image: 'Image **saved.**',
    },
    review: {
      confirm: 'Looks right',
      fix: 'Fix something',
    },
  },

  // ## Pots
  pots: {
    title: 'Pots',
    empty: {
      head: 'No pots **yet.**',
      body: 'A pot is money set aside for one thing. Holiday, buffer, vet bill.',
      cta: 'Start a pot',
    },
    add: {
      title: 'New **pot.**',
    },
    fund: {
      title: 'Move money in',
    },
  },

  // ## Subscriptions
  subs: {
    title: 'Subscriptions',
    empty: {
      head: 'No subs **yet.**',
      body: 'Folio will spot recurring charges as you add statements.',
      cta: 'Add a subscription',
    },
    paused: 'Paused',
    caught: {
      head: (name: string): string => `Folio spotted **${name}.**`,
      body: 'Looks like a monthly charge. Add it to subscriptions so Folio can plan around it?',
    },
  },

  // ## Insights
  insights: {
    empty: {
      head: 'Close one cycle **first.**',
      body: 'Insights need a full payday-to-payday rhythm to mean anything.',
      cta: 'Open the ritual',
    },
  },

  // ## Onboarding (4 steps)
  onb: {
    1: {
      head: 'What should Melo **call you?**',
      placeholder: 'A name, a nickname',
    },
    2: {
      head: 'When does payday **land?**',
    },
    3: {
      head: 'Roughly, what **comes in?**',
      help: 'Take-home, per month. Rough is fine.',
    },
    4: {
      head: 'What are you **saving for?**',
      help: 'Pick any. Skip any. Change later.',
    },
    done: {
      head: 'Ready.',
      body: 'Folio will get quieter as it learns you.',
    },
  },

  // ## Shortfall moment
  short: {
    head: (amount: string): string => `Short by **${amount}.**`,
    body: (days: string): string => `${days} days left. Here's what would close it.`,
    move: {
      pause: (name: string): string => `Pause ${name} this cycle`,
      pot: (pot: string): string => `Borrow from ${pot}`,
      cap: (amount: string): string => `Hold spending at ${amount}/day`,
    },
    refuse: 'Leave it for now',
  },

  // ## Nudges (local notifications)
  nudge: {
    payday: {
      '3d': "Payday in 3 days. You're on track.",
      tight: "Payday in 3 days. It's tight — one quiet minute?",
    },
    ritual: {
      due: 'Payday landed. Ready when you are.',
    },
    sub: {
      caught: 'Folio spotted a recurring charge.',
    },
    pot: {
      filled: (pot: string): string => `${pot} is full.`,
    },
  },

  // ## Errors / empty network
  err: {
    offline: "No connection. Folio works without one — try again when you're back.",
    generic: "Something didn't catch. Try once more?",
    statement: {
      unreadable: 'Folio couldn\'t read this one. Saved as a note.',
    },
  },
} as const;

export type Copy = typeof copy;
