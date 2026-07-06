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
      // DATA_INTELLIGENCE.md phase ③ — the merchant-memory provenance caption. Shown only when a
      // candidate's category chip was pre-filled from a remembered correction, never for a fresh
      // model guess (honesty discipline — see lib/merchantMemory.ts). Tappable — see `forget` below.
      remembered: 'remembered from your last fix',
      // The forget affordance on the caption above — tapping it calls `forgetMerchantCategory` and
      // clears the caption, leaving the chip selection untouched so the user can keep editing freely.
      forget: 'forget this',
    },
  },

  // ## Hidden — the un-hide list for Review candidates the user told Folio to ignore
  // (SheetHiddenReview / HiddenReviewSheet). Plain "Hidden", never "ignored"/"blacklisted".
  hidden: {
    title: 'Hidden **from Review.**',
    body: "Items you told Folio to ignore. Future intakes with the exact same merchant, amount, and date won't nag you. Un-hide to let them surface again.",
    empty: 'Nothing hidden yet.',
    unhide: 'Un-hide',
    done: 'Done',
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
      // Cadence-aware (DATA_INTELLIGENCE.md phase ⑤(A) "weekly-cadence unlock") — mirrors
      // income.caught.body's cadence param exactly so the two sibling sheets read consistently.
      // Defaults to 'monthly' when omitted so every existing call site (and its copy/fixture
      // tests) keeps its exact prior string, byte-for-byte.
      body: (cadence: string = 'monthly'): string =>
        `Looks like a ${cadence} charge. Add it to subscriptions so Folio can plan around it?`,
    },
  },

  // ## Bills (bill-signal detection, DATA_INTELLIGENCE.md phase ⑤(B))
  // Same catalog write target as subs (`setSubs` — see lib/caughtBills.ts's module-header decision
  // note: there is no separate bill entity in the live spine, so a caught bill also becomes a Sub).
  // Distinct copy voice from subs.caught: "Melo noticed X going out" (money leaving) vs "Folio
  // spotted X" (a subscription-shaped charge) — the two sheets read as siblings, not duplicates.
  bills: {
    empty: {
      head: 'No bills **caught yet.**',
      body: 'Melo will spot recurring money going out as you add statements.',
      cta: 'Not yet',
    },
    caught: {
      head: (merchant: string): string => `Melo noticed **${merchant}** going out.`,
      body: (cadence: string): string =>
        `Looks like a ${cadence} bill. Add it so Folio can plan around it?`,
    },
  },

  // ## Income (income-signal detection, DATA_INTELLIGENCE.md phase ②)
  income: {
    caught: {
      head: (merchant: string): string => `Melo noticed **${merchant}** pays you.`,
      body: {
        strong: (cadence: string): string =>
          `Looks like a ${cadence} payment. Add it so Folio can plan around it?`,
        possible: (cadence: string): string =>
          `Looks like a ${cadence} payment — amounts vary, so check this before adding it.`,
      },
      // Same-income UPDATE proposal — the detected merchant looks like the
      // same real income as an already-declared source under a different
      // cadence/label (e.g. onboarding's generic "Pay"). Never framed as a
      // new income; always an offer to correct the existing one.
      update: {
        head: (): string => `Pay looks **different.**`,
        body: {
          strong: (merchant: string, cadence: string): string =>
            `Melo noticed ${merchant} arriving ${cadence}. Update your Pay to match?`,
          possible: (merchant: string, cadence: string): string =>
            `Melo noticed ${merchant} arriving ${cadence} — amounts vary, so check this before updating.`,
        },
        cta: 'Update Pay',
      },
    },
  },

  // ## Insights
  insights: {
    empty: {
      head: 'Close one cycle **first.**',
      body: 'Insights need a full payday-to-payday rhythm to mean anything.',
      cta: 'Open the ritual',
    },
    // DATA_INTELLIGENCE.md phase ④ — the honest provenance caption shown on a cycle card that was
    // reconstructed from bulk-imported statement history rather than a lived, ritual-sealed month.
    // Deliberately muted and small (never the same visual weight as a lived cycle's note) so the
    // distinction reads at a glance, not just to assistive tech.
    reconstructed: {
      caption: 'from your statement',
    },
    // DATA_INTELLIGENCE.md phase ④ — shown once beneath the summary tiles whenever the cycles
    // window includes a reconstructed (bulk-import synthesized) month, so the averages disclose
    // that they are computed from lived months only, not blended with an estimate.
    averages: {
      livedOnlyCaption: 'averages use your lived months',
    },
  },

  // ## Timeline
  timeline: {
    // DATA_INTELLIGENCE.md phase ④(A) — the honest line shown where the list is cut short by the
    // rolling retention cap, so a bulk-imported history's trimmed tail is disclosed rather than
    // silently vanishing. Only shown when `droppedTransactionCount > 0`.
    trimmed: 'Older items were trimmed to keep the app fast — your export keeps everything.',
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
      unreadable: "Folio couldn't read this one. Saved as a note.",
    },
  },
} as const;

export type Copy = typeof copy;
