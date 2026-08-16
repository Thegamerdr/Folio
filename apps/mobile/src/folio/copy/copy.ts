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

// ---------------------------------------------------------------------------
// Known-state-payer heuristic (income.caught.head copy nuance) — DWP/HMRC/
// pension-provider merchant strings read oddly under "{merchant} pays you"
// ("Melo noticed **DWP** pays you." reads as if DWP were an employer). This
// is copy nuance ONLY: benefits and pension credits ARE income, detection and
// write mechanics are unchanged — this only picks which headline phrasing to
// render. Matching is deliberately loose (substring, case-insensitive) since
// bank-statement merchant strings for state payers vary a lot in practice
// (e.g. "DWP UNIVERSAL CREDIT", "HMRC CHILD BENEFIT", "STATE PENSION").
// ---------------------------------------------------------------------------

const KNOWN_STATE_PAYER_PATTERNS: readonly RegExp[] = [
  /\bdwp\b/iu,
  /\bhmrc\b/iu,
  /universal\s*credit/iu,
  /\bpension\b/iu,
];

/** True when `merchant` looks like a state/benefits/pension payer rather than
 *  an employer — pure, case-insensitive substring match, no I/O. */
export function isKnownStatePayer(merchant: string): boolean {
  return KNOWN_STATE_PAYER_PATTERNS.some((pattern) => pattern.test(merchant));
}

export const copy = {
  // ## Global
  global: {
    app: {
      // D4 (owner "do all", 2026-07-11): the app IS Melo — the phoenix, the paywall tiers, and
      // the direction docs already said so; the chrome now agrees. 'Folio' survives only in
      // internal code identifiers and paths.
      name: 'Melo',
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
      body: 'Melo remembers.',
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
      pdf: 'Melo **read** your statement.',
      image: 'Melo **read** your image.',
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
    clipboard: {
      empty: {
        head: 'Nothing copied yet',
        body: 'Copy the transactions, then tap Paste from clipboard.',
      },
    },
    statement: {
      reconciled: 'These transactions add up to your statement.',
    },
  },

  // ## Bank connection
  bank: {
    empty: 'The bank returned nothing new for this period. Your local data is unchanged.',
    review: {
      duplicate: 'Those bank items are already accepted, ignored, or waiting in Review.',
      body: 'Nothing below counts yet. Choose a Melo account, then send the bank items into the normal Review queue.',
      non_gbp: (n: string, noun: string): string => `${n} non-GBP ${noun} left out`,
    },
    disconnect: {
      body: 'Melo will delete its server-side connection identifier and stop future refreshes. Already accepted bank items on this phone are a separate choice. TrueLayer Data v3 does not currently give Melo an API that can claim the bank-side consent itself was revoked.',
      keep: 'The bank is disconnected from Melo. Bank items already accepted on this phone can stay, or be removed separately now.',
    },
    check: 'Check for bank items',
  },

  // ## Hidden — the un-hide list for Review candidates the user told Melo to ignore
  // (SheetHiddenReview / HiddenReviewSheet). Plain "Hidden", never "ignored"/"blacklisted".
  hidden: {
    title: 'Hidden **from Review.**',
    body: "Items you told Melo to ignore. Future intakes with the exact same merchant, amount, and date won't nag you. Un-hide to let them surface again.",
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
      body: 'Melo will spot recurring charges as you add statements.',
      cta: 'Add a subscription',
    },
    paused: 'Paused',
    caught: {
      head: (name: string): string => `Melo spotted **${name}.**`,
      // Cadence-aware (DATA_INTELLIGENCE.md phase ⑤(A) "weekly-cadence unlock") — mirrors
      // income.caught.body's cadence param exactly so the two sibling sheets read consistently.
      // Defaults to 'monthly' when omitted so every existing call site (and its copy/fixture
      // tests) keeps its exact prior string, byte-for-byte.
      body: (cadence: string = 'monthly'): string =>
        `Looks like a ${cadence} charge. Add it to subscriptions so Melo can plan around it?`,
    },
  },

  // ## Bills (bill-signal detection, DATA_INTELLIGENCE.md phase ⑤(B))
  // Same catalog write target as subs (`setSubs` — see lib/caughtBills.ts's module-header decision
  // note: there is no separate bill entity in the live spine, so a caught bill also becomes a Sub).
  // Distinct copy voice from subs.caught: "Melo noticed X going out" (money leaving) vs "Melo
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
        `Looks like a ${cadence} bill. Add it so Melo can plan around it?`,
    },
  },

  // ## Income (income-signal detection, DATA_INTELLIGENCE.md phase ②)
  income: {
    caught: {
      head: (merchant: string): string => `Melo noticed **${merchant}** pays you.`,
      // Known-state-payer variant (see isKnownStatePayer above) — same
      // detection, same confidence, just a headline that doesn't read like
      // Melo mistook a benefits/pension provider for an employer.
      headStatePayer: (merchant: string): string =>
        `Melo noticed money arrives from **${merchant}**.`,
      body: {
        strong: (cadence: string): string =>
          `Looks like a ${cadence} payment. Add it so Melo can plan around it?`,
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

  // ## Drift (income/bill drift-signal detection, DATA_INTELLIGENCE.md phase ⑥)
  // One generic pattern, two flavours (task brief). Every string hedges — "around", "usually",
  // "lately" — never a bare number presented as settled fact, since a drift observation is a
  // history-fed ESTIMATE (see lib/historyStats.ts / lib/driftSignals.ts module headers).
  drift: {
    caught: {
      income: {
        head: (): string => `Pay looks **different.**`,
        body: (merchant: string, amount: string, cadence: string): string =>
          `Pay looks different — ${merchant} has been arriving around ${amount} ${cadence} lately; update?`,
      },
      bill: {
        head: (merchant: string): string => `**${merchant}** looks higher.`,
        body: (merchant: string, amount: string): string =>
          `${merchant} looks higher lately — around ${amount}; update the stored amount?`,
      },
      cta: 'Yes, update it',
    },
  },

  // ## Annual radar (annual-candidate detection, DATA_INTELLIGENCE.md phase ⑥ item 5)
  annual: {
    card: {
      // eyebrow shown on the Insights quiet card that opens the confirm sheet.
      eyebrow: 'Once a year',
      head: (merchant: string): string => `**${merchant}** — once a year.`,
      body: (amount: string, month: string): string => `Around ${amount}, usually ${month}.`,
    },
    caught: {
      head: (merchant: string): string => `**${merchant}** — once a year.`,
      body: (amount: string, month: string): string =>
        `Melo noticed this most years — around ${amount}, usually ${month}. Add it to your calendar?`,
    },
    empty: {
      head: 'Nothing yearly **spotted yet.**',
      body: 'When Melo notices a bill that repeats about once a year, it shows up here.',
      cta: 'Not yet',
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
      body: 'Melo will get quieter as it learns you.',
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

  // ## Lenses
  lens: {
    picker: {
      title: 'Choose a lens',
      head: 'Pick a **lens.**',
      counts: '2 free · 4 plus · 4 pro',
      body: "Reshapes Today's verdict and Melo's voice. Switch back any time.",
    },
    line: {
      survival: 'Make it to payday.',
      stability: 'Bills covered — hold the line.',
      growth: 'Push the buffer, keep momentum.',
      reset: 'Soft landing, then rebuild.',
      optimizer: 'Trim the quiet leaks.',
      planning: 'Line it up without breaking today.',
      lowVis: 'Not enough to say yet.',
      irregular: 'Even out the peaks and dips.',
      debt: 'Chip away without slipping.',
      household: 'Share the shape, not the stress.',
    },
    badge: {
      free: 'Free',
      plus: 'Plus',
      pro: 'Pro',
      plus_trial: 'Plus · trial',
      pro_trial: 'Pro · trial',
    },
    action: {
      switch: (lens: string): string => `Switch to ${lens}`,
      start_trial: 'Start trial',
      see_plans: 'See plans',
    },
  },

  // ## Plans and entitlements
  plans: {
    title: 'Melo plans',
    restore: 'Restore',
    restore_a11y: 'Restore a previous purchase',
    current: (tier: string): string => `You're on ${tier}.`,
    eyebrow: 'Pick what fits this month',
    head: 'Look at your money **your** way.',
    body: `Melo always answers "will my money last to payday?" for free. Plus adds everyday clarity. Pro handles the harder shapes — irregular income, debt, shared money.`,
    cadence: {
      monthly: 'Monthly',
      yearly: 'Yearly',
      saving: 'save ~33%',
      month: 'month',
      year: 'year',
    },
    tier: {
      free: {
        name: 'Free',
        price: '£0',
        tagline: 'Basic money weather.',
        bullets: [
          'Will my money last to payday?',
          'Survival + Stability lenses',
          'Safe Zone, Recovery, Reset',
          '1 goal · 3 spend checks / week',
        ],
      },
      plus: {
        name: 'Melo Plus',
        price: '£4.99 / month',
        yearly_price: '£39.99 / year',
        yearly_note: '≈ £3.33/mo · save £20',
        tagline: 'Full daily clarity.',
        bullets: [
          'Everything in Free',
          'Growth, Reset, Optimizer, Planning lenses',
          'Unlimited spend checks',
          'Bill shield · Calendar · What changed',
          'Widgets · Leak detection',
          'Premium Fenice customisation',
        ],
      },
      pro: {
        name: 'Melo Pro',
        price: '£8.99 / month',
        yearly_price: '£69.99 / year',
        yearly_note: '≈ £5.83/mo · save £38',
        tagline: 'Advanced forecasting + shared money.',
        includes: 'Everything in Plus',
        bullets: [
          'Everything in Plus',
          'Irregular income · Debt / BNPL',
          'Low-visibility lens',
          'Household (shared setup)',
          'Money Time Machine',
          'Custom rules · Exports',
        ],
      },
      current: 'Current',
      most_picked: 'Most picked',
      soon: 'soon',
      price_hidden: 'price hidden',
    },
    compare: {
      title: 'Compare',
      rows: [
        'Will my money last to payday?',
        'Safe Zone · Recovery · Reset',
        'Growth · Optimizer · Planning',
        'Bill shield · Calendar',
        'Premium Fenice looks',
        'Widgets · Leak detection',
        'Low visibility lens',
        'Irregular income · runway',
        'Debt / BNPL payoff',
        'Household (shared money)',
        'Money Time Machine',
      ],
    },
    affordability: {
      spare: (amount: string): string => `Your spare this cycle: ${amount}`,
      tight: 'Tight — maybe not this week.',
    },
    action: {
      manage: 'Manage plan',
      subscribe: (tier: string): string => `Subscribe to ${tier}`,
      connecting: 'Connecting to the store…',
    },
    guard: {
      head: 'Not the right moment',
      negative: "Your spare is under zero. Don't subscribe this week.",
      recovery: "You're mid-recovery. Stay focused on that first.",
      quiet: 'Quiet Mode is on. Turn it off if you want to see plans.',
      fog: 'Not enough to say yet — add a statement first.',
      weather: "Storm outside. Let's talk about this when it clears.",
    },
    trial: {
      offer: {
        head: 'Try every paid lens · one cycle',
        body: 'No card. Locks when you close the cycle. Never a silent renewal.',
      },
      started: {
        head: 'Trial started · one cycle',
        body: 'Every paid lens is unlocked until you close this cycle. Nothing renews.',
      },
      active: 'Trial active',
      active_until: (date: string): string => `Every lens unlocked until ${date}.`,
      no_renew: "No auto-renew — we'll ask again at payday.",
      try_plus: (date: string): string => `Try Plus free — until ${date}`,
      no_card: "One cycle · no card · we don't charge when it ends.",
      last_day: 'Last day · trial',
      days_left: (n: string): string => `${n} days left · trial`,
      ended: {
        head: 'Trial ended',
        body: 'Paid lenses are locked. Everything Free keeps working.',
      },
    },
    promise: {
      head: 'Our promise',
      path: 'The money-path question stays free. Always.',
      ownership: 'Your history, exports, local data and files are yours.',
      core: 'Today, the Money Path, Review, manual entry, corrections and Start fresh are never behind a tier.',
      safety: 'Bills Shield, Before You Spend, 24-Hour Shelf and Recovery are never behind a tier.',
      upsell:
        'No upsell during a storm, in Recovery, in Quiet Mode, or when your spare is under zero.',
      trial: 'No auto-charge after a trial. You choose whether to subscribe.',
    },
    billing: {
      pending_head: 'Store unavailable',
      pending_body:
        "Melo couldn't find an available Plus or Pro plan on this device. Restore still works.",
      checking: 'Checking the store…',
      processing: 'Google Play is still processing this purchase.',
      save_failed: 'Melo could not save the verified purchase on this device.',
    },
    restore_result: {
      active: (tier: string): string => `${tier} is active on this device.`,
      none: 'No purchase found on this device.',
    },
  },

  // ## Account and legal links
  legal: {
    privacy: 'Privacy',
    terms: 'Terms',
    support: 'Support',
    privacy_url: 'https://melo-money.com/privacy',
    terms_url: 'https://melo-money.com/terms',
    support_url: 'https://melo-money.com/support',
    support_email: 'support@melo-money.com',
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
      caught: 'Melo spotted a recurring charge.',
    },
    pot: {
      filled: (pot: string): string => `${pot} is full.`,
    },
  },

  // ## Errors / empty network
  err: {
    offline: "No connection. Melo works without one — try again when you're back.",
    generic: "Something didn't catch. Try once more?",
    statement: {
      unreadable: "Melo couldn't read this one. Saved as a note.",
    },
  },
} as const;

export type Copy = typeof copy;
