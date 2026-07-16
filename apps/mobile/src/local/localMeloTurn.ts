import {
  classifyMeloLocalIntent,
  draftMeloLocalAiResponse,
  extractMeloLocalAmountMinor,
  type MeloLocalAiAction,
  type MeloLocalCalculation,
  type MeloLocalFinancialSnapshot,
  type MeloLocalIntent,
} from '@folio/ai-contracts';

import type { MeloToolSuggestion, MeloTone } from './meloAiClient';
import { hasLocalMeloPromptInjectionLanguage, resolveLocalMeloSafety } from './localMeloSafety';

export type LocalMeloTurn = Readonly<{
  reply: string;
  suggestions: readonly MeloToolSuggestion[];
  intent: MeloLocalIntent;
  actions: readonly MeloLocalAiAction[];
  followUpChips: readonly string[];
  context: LocalMeloConversationContext | null;
  control: 'none' | 'cancel' | 'back' | 'account-selected';
}>;

export type LocalMeloConversationContext = Readonly<{
  lastIntent: MeloLocalIntent;
  lastDetectedAmountMinor: number | null;
  lastDebtStrategy?: 'highest-rate-first' | 'lowest-balance-first' | undefined;
  selectedAccountId?: string | undefined;
}>;

export type LocalMeloCalculationBuilder = (
  request: Readonly<{
    intent: MeloLocalIntent;
    prompt: string;
    detectedAmountMinor: number | null;
    selectedAccountId?: string | undefined;
  }>,
) => MeloLocalCalculation | null;

export type LocalMeloAccountResolution =
  | Readonly<{ state: 'not-requested' }>
  | Readonly<{ state: 'selected'; accountId: string; label: string }>
  | Readonly<{
      state: 'needs-selection';
      choices: readonly Readonly<{ accountId: string; label: string }>[];
    }>;

export type LocalMeloAccountSelector = (
  prompt: string,
  currentAccountId?: string | undefined,
) => LocalMeloAccountResolution;

export type LocalMeloSubscriptionActionResolution =
  | Readonly<{ state: 'not-requested' }>
  | Readonly<{
      state: 'needs-selection';
      reply: string;
      choices: readonly Readonly<{ label: string }>[];
      canOpenSubscriptions: boolean;
    }>
  | Readonly<{
      state: 'review';
      reply: string;
      actionLabel: string;
      actionDetail: string;
    }>;

export type LocalMeloSubscriptionActionResolver = (
  prompt: string,
  state: Readonly<{
    subs: readonly Readonly<{
      name: string;
      cost: number;
      nextRenewalDaysAway: number;
      lastUsedDaysAgo: number;
      usesPerMonth: number;
    }>[];
    subPaused: Readonly<Record<string, boolean>>;
  }>,
) => LocalMeloSubscriptionActionResolution;

type ParsedSuggestion = Readonly<{
  name: MeloToolSuggestion['name'];
  args: Readonly<Record<string, unknown>>;
  summary: string;
}>;

const HYPOTHETICAL = /\b(?:can i|could i|what if|might|would|plan|planning|tomorrow|next week)\b/i;
const MONEY = '(?:£\\s*)?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)';

function amountOf(value: string): number | null {
  const amount = Number(value.replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function cleanName(value: string | undefined, fallback: string): string {
  const cleaned = (value ?? '')
    .replace(/[.!?]+$/, '')
    .replace(/\b(?:today|yesterday|just now)\b$/i, '')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : fallback;
}

function categoryFor(name: string): 'food' | 'transport' | 'fun' | 'bills' | 'shopping' | 'other' {
  const normalized = name.toLowerCase();
  if (/tesco|aldi|lidl|asda|sainsbury|food|lunch|dinner|coffee|cafe/.test(normalized))
    return 'food';
  if (/uber|train|bus|petrol|fuel|taxi|transport/.test(normalized)) return 'transport';
  if (/rent|energy|water|council|broadband|phone|bill/.test(normalized)) return 'bills';
  if (/cinema|game|concert|pub|spotify|netflix/.test(normalized)) return 'fun';
  if (/amazon|shop|store|clothes/.test(normalized)) return 'shopping';
  return 'other';
}

/**
 * Recognise only explicit, completed money events. Ambiguous or hypothetical wording produces no
 * suggestion, so a local parser can never turn a planning question into a ledger write proposal.
 */
export function parseLocalMoneySuggestion(prompt: string): ParsedSuggestion | null {
  const text = prompt.trim();
  if (text.length === 0 || HYPOTHETICAL.test(text)) return null;

  const transfer = text.match(
    new RegExp(
      `\\b(?:moved|transferred)\\s+${MONEY}\\s+from\\s+(.+?)\\s+to\\s+(.+?)(?:[.!?]|$)`,
      'i',
    ),
  );
  if (transfer) {
    const amount = amountOf(transfer[1] ?? '');
    if (amount === null) return null;
    const from = cleanName(transfer[2], 'one account');
    const to = cleanName(transfer[3], 'another account');
    return {
      name: 'log_transfer',
      args: { amount, from, to },
      summary: `Log £${amount.toFixed(2)} moved from ${from} to ${to}.`,
    };
  }

  const refund =
    text.match(
      new RegExp(
        `\\b(?:got|received)\\s+(?:a\\s+)?${MONEY}\\s+refund\\s+from\\s+(.+?)(?:[.!?]|$)`,
        'i',
      ),
    ) ??
    text.match(
      new RegExp(
        `\\b(?:got|received)\\s+(?:a\\s+)?refund\\s+(?:of\\s+)?${MONEY}\\s+from\\s+(.+?)(?:[.!?]|$)`,
        'i',
      ),
    );
  if (refund) {
    const amount = amountOf(refund[1] ?? '');
    if (amount === null) return null;
    const merchant = cleanName(refund[2], 'refund');
    return {
      name: 'log_refund',
      args: { amount, merchant },
      summary: `Log a £${amount.toFixed(2)} refund from ${merchant}.`,
    };
  }

  const income = text.match(
    new RegExp(
      `\\b(?:got paid|was paid|received|earned)\\s+${MONEY}(?:\\s+from\\s+(.+?))?(?:[.!?]|$)`,
      'i',
    ),
  );
  if (income) {
    const amount = amountOf(income[1] ?? '');
    if (amount === null) return null;
    const merchant = cleanName(income[2], 'income');
    return {
      name: 'log_income',
      args: { amount, merchant, category: 'income' },
      summary: `Log £${amount.toFixed(2)} received from ${merchant}.`,
    };
  }

  const spend = text.match(
    new RegExp(`\\b(?:spent|paid)\\s+${MONEY}(?:\\s+(?:at|to|on)\\s+(.+?))?(?:[.!?]|$)`, 'i'),
  );
  if (spend) {
    const amount = amountOf(spend[1] ?? '');
    if (amount === null) return null;
    const merchant = cleanName(spend[2], 'purchase');
    return {
      name: 'log_spend',
      args: { amount, merchant, category: categoryFor(merchant) },
      summary: `Log £${amount.toFixed(2)} spent at ${merchant}.`,
    };
  }

  return null;
}

function suggestionId(prompt: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < prompt.length; index += 1) {
    hash ^= prompt.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `local-${(hash >>> 0).toString(36)}`;
}

/**
 * Recognise a request to correct an already-posted transaction without trying to resolve the row.
 * Melo's aggregate snapshot intentionally contains no merchants, transaction ids or transaction
 * rows, so any direct target inference here would be guesswork. The safe outcome is a handoff to the
 * real Timeline selector and its review-before-commit editor.
 */
export function isExistingTransactionCorrectionRequest(prompt: string): boolean {
  const normalized = prompt.trim().toLocaleLowerCase('en-GB');
  if (!/\b(?:change|edit|update|correct|fix|amend)\b/.test(normalized)) return false;

  const explicitRecord =
    /\b(?:transaction|payment|purchase|spend|refund|transfer|ledger entry|money entry)\b/.test(
      normalized,
    );
  const changedValue =
    /\bfrom\b.+\bto\b/.test(normalized) &&
    /(?:£\s*)?\d[\d,]*(?:\.\d{1,2})?|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(
      normalized,
    );
  const namedField = /\b(?:amount|date)\b/.test(normalized) && /\b(?:on|for|of)\b/.test(normalized);

  // Dedicated subscription, account, debt and goal surfaces own their records. Do not steal a
  // domain-level change request unless the user explicitly called it a posted transaction/payment.
  const dedicatedDomain =
    /\b(?:subscription|renewal|recurring|account|balance|debt|loan|goal|pot|payday|income source)\b/.test(
      normalized,
    );
  if (dedicatedDomain && !explicitRecord) return false;
  return explicitRecord || changedValue || namedField;
}

function withTone(answer: string, tone: MeloTone): string {
  switch (tone) {
    case 'honest':
      return `Straight answer: ${answer}`;
    case 'dry':
      return `${answer} No theatre, just the local numbers.`;
    case 'coachy':
      return `${answer} What would be the most useful next check?`;
    case 'calm':
      return answer;
  }
}

function hasNonFiniteNumber(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasNonFiniteNumber(item, seen));
  return Object.values(value).some((item) => hasNonFiniteNumber(item, seen));
}

function hasInvalidSnapshotValue(snapshot: MeloLocalFinancialSnapshot): boolean {
  const counts = [
    snapshot.pendingReviewCount,
    snapshot.subscriptionCount,
    snapshot.activeRecurringCount,
    snapshot.debtCount,
    snapshot.goalCount,
    snapshot.upcomingCalendarCount,
    snapshot.unseenChangeCount,
    snapshot.incomeSourceCount,
    snapshot.accountCount,
    snapshot.liabilityAccountCount,
  ].filter((value): value is number => value !== undefined);
  const nonNegativeAmounts = [
    snapshot.activeSubscriptionMonthlyMinor,
    snapshot.monthlyIncomeMinor,
    snapshot.monthlyOutgoingsMinor,
    snapshot.totalDebtMinor,
    snapshot.monthlyDebtMinimumMinor,
    snapshot.goalSavedMinor,
    snapshot.goalTargetMinor,
    snapshot.businessLiabilityBalanceMinor,
    snapshot.businessUpcomingIncomeMinor,
    snapshot.businessUpcomingCommitmentsMinor,
    snapshot.businessConfirmedIncome30DaysMinor,
    snapshot.businessConfirmedExpense30DaysMinor,
    snapshot.businessRunwayHistoryDays,
  ].filter((value): value is number => value !== undefined);
  const businessRunwayDays = snapshot.businessRunwayDays;
  return (
    hasNonFiniteNumber(snapshot) ||
    counts.some((value) => !Number.isInteger(value) || value < 0) ||
    nonNegativeAmounts.some((value) => value < 0) ||
    (businessRunwayDays !== undefined &&
      businessRunwayDays !== null &&
      (!Number.isInteger(businessRunwayDays) || businessRunwayDays < 0))
  );
}

function invalidLocalDataTurn(): LocalMeloTurn {
  return {
    reply:
      'I found an invalid local money value, so I will not calculate or propose a change from it. Open Account or Review to correct the source. Nothing changed.',
    suggestions: [],
    intent: 'clarify',
    actions: [
      {
        kind: 'open_account',
        label: 'Open accounts',
        detail: 'Review the current local balances and their dates.',
        requiresUserReview: false,
      },
      {
        kind: 'review_imports',
        label: 'Open Review',
        detail: 'Inspect unconfirmed imported values before they become truth.',
        requiresUserReview: false,
      },
    ],
    followUpChips: [],
    context: null,
    control: 'none',
  };
}

/**
 * Resolve only bounded follow-ups from typed prior context. No transcript, merchant, record or raw
 * previous prompt is retained. Unknown wording passes through unchanged and the normal classifier
 * asks for clarification rather than guessing.
 */
export function resolveLocalMeloFollowUp(
  prompt: string,
  context: LocalMeloConversationContext | null | undefined,
): string {
  const trimmed = prompt.trim();
  if (!context) return trimmed;
  const normalized = trimmed
    .toLowerCase()
    .replace(/[?.!]+$/, '')
    .trim();

  const correctedAmount = normalized.match(
    /^(?:no\s*,?\s*)?(?:actually|i meant|make that|change (?:that|it) to)\s+(?:£\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)$/i,
  );
  if (correctedAmount?.[1]) {
    if (context.lastIntent === 'check_purchase') {
      return `Can I afford £${correctedAmount[1]}?`;
    }
    if (context.lastIntent === 'review_debts') {
      const strategy = context.lastDebtStrategy ? ` using ${context.lastDebtStrategy}` : '';
      return `Can I overpay £${correctedAmount[1]} on my debts${strategy}?`;
    }
    if (context.lastIntent === 'review_goals') {
      return `What if I add £${correctedAmount[1]} to my savings goal?`;
    }
  }

  const isSourceFollowUp =
    [
      'explain tightest point',
      'explain safe zone',
      'explain my safe zone',
      'explain protected money',
      'explain my current position',
      'show the source figures',
      'show sources',
    ].includes(normalized) ||
    /^(?:where did (?:that|this) come from|where (?:does|did) (?:that|this) come from|what (?:is|was) (?:that|this) based on|how did you (?:get|calculate) (?:that|this))$/.test(
      normalized,
    );

  if (isSourceFollowUp) {
    switch (context.lastIntent) {
      case 'review_subscriptions':
      case 'review_recurring':
        return 'Explain my recurring payment figures';
      case 'summarise_month':
        return 'Explain the sources behind my monthly summary';
      case 'review_import':
        return 'Explain my import review';
      case 'check_payday':
        return 'Explain my payday route';
      case 'review_debts':
        return 'Explain my debt figures';
      case 'review_goals':
        return 'Explain my savings goal figures';
      case 'review_calendar':
        return 'Explain my money calendar';
      case 'explain_changes':
        return 'Explain what changed';
      case 'review_irregular_income':
        return 'Explain my irregular income';
      case 'review_accounts':
        return 'Explain the selected account balance';
      default:
        break;
    }
    return 'Why is my available amount calculated that way?';
  }

  if (context.lastIntent === 'review_subscriptions' || context.lastIntent === 'review_recurring') {
    if (/subscription|renewal|monthly total|recurring|next bill/.test(normalized)) {
      return 'Review my recurring payments';
    }
  }

  if (context.lastIntent === 'review_import' && /review|source|wording/.test(normalized)) {
    return 'Review imports needing my eye';
  }

  if (context.lastIntent === 'plan_recovery' && /pressure|protect|what changes/.test(normalized)) {
    return 'Preview my recovery route';
  }

  if (context.lastIntent === 'check_payday') {
    if (/payday|ritual|next income/.test(normalized)) return 'When is my next payday?';
    if (/calendar/.test(normalized)) return 'Show my calendar';
    if (/safe until then/.test(normalized)) {
      return 'Why is my available amount calculated that way?';
    }
  }

  if (context.lastIntent === 'review_debts') {
    if (
      context.lastDetectedAmountMinor !== null &&
      /(?:highest[- ]rate|avalanche)/.test(normalized)
    ) {
      return `Add Â£${(context.lastDetectedAmountMinor / 100).toFixed(2)} extra to my debts using highest-rate-first`;
    }
    if (
      context.lastDetectedAmountMinor !== null &&
      /(?:lowest[- ]balance|smallest[- ]balance|snowball)/.test(normalized)
    ) {
      return `Add Â£${(context.lastDetectedAmountMinor / 100).toFixed(2)} extra to my debts using lowest-balance-first`;
    }
    if (/minimum|overpay|debt|loan|credit card/.test(normalized)) return 'Review my debts';
  }

  if (context.lastIntent === 'review_goals') {
    if (/goal|pace|contribution|pot|saving/.test(normalized)) return 'Review my savings goals';
  }

  if (context.lastIntent === 'review_calendar') {
    if (/calendar|tightest date|coming up/.test(normalized)) return 'Show my calendar';
  }

  if (context.lastIntent === 'explain_changes') {
    if (/timeline|what changed/.test(normalized)) return 'What changed?';
    if (/what is next/.test(normalized)) return 'What is coming up?';
  }

  if (context.lastIntent === 'review_irregular_income') {
    if (/next income/.test(normalized)) return 'When is my next income?';
    if (/low month|irregular|variable income/.test(normalized)) {
      return 'Review my irregular income';
    }
  }

  if (context.lastIntent === 'check_purchase') {
    const amount = trimmed.match(
      /^(?:(?:what|how) about|and|instead|try)\s+(?:£\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)\??$/i,
    );
    if (amount?.[1]) return `Can I afford £${amount[1]}?`;
    if (/^(?:why|why not|show me why|how come)\??$/i.test(trimmed)) {
      return 'Why is my available amount calculated that way?';
    }
  }

  if (/^(?:and|what about) (?:my )?(?:bills|recurring payments)\??$/i.test(trimmed)) {
    return 'Review my recurring bills';
  }
  if (/^(?:and|what about) (?:my )?(?:debts|loans|credit cards)\??$/i.test(trimmed)) {
    return 'Review my debts';
  }
  if (/^(?:and|what about) (?:my )?(?:goals|pots|savings)\??$/i.test(trimmed)) {
    return 'Review my savings goals';
  }

  return trimmed;
}

export function buildLocalMeloTurn(
  input: Readonly<{
    prompt: string;
    snapshot: MeloLocalFinancialSnapshot;
    tone: MeloTone;
    context?: LocalMeloConversationContext | null;
    calculate?: LocalMeloCalculationBuilder | undefined;
    selectAccount?: LocalMeloAccountSelector | undefined;
    resolveSubscriptionAction?: LocalMeloSubscriptionActionResolver | undefined;
    subscriptionState?: Parameters<LocalMeloSubscriptionActionResolver>[1] | undefined;
  }>,
): LocalMeloTurn {
  const normalizedControl = input.prompt
    .trim()
    .toLocaleLowerCase('en-GB')
    .replace(/[.!?]+$/, '')
    .trim();
  if (/^(?:cancel|cancel that|never mind|nevermind|forget it|stop)$/.test(normalizedControl)) {
    return {
      reply: withTone('Cancelled. Nothing changed.', input.tone),
      suggestions: [],
      intent: input.context?.lastIntent ?? 'clarify',
      actions: [],
      followUpChips: [],
      context: null,
      control: 'cancel',
    };
  }
  if (/^(?:back|go back|start over|new question)$/.test(normalizedControl)) {
    return {
      reply: withTone('Back to a fresh question. Nothing changed.', input.tone),
      suggestions: [],
      intent: 'clarify',
      actions: [],
      followUpChips:
        input.snapshot.workspaceKind === 'business'
          ? ['Explain my business cash position', 'What needs my review?']
          : ['Can I spend 120?', 'When is my next payday?'],
      context: null,
      control: 'back',
    };
  }

  const safety = resolveLocalMeloSafety(input.prompt);
  if (safety.state === 'escalated') {
    return {
      reply: safety.reply,
      suggestions: [],
      intent: safety.intent,
      actions: safety.actions,
      followUpChips: [],
      context: null,
      control: 'none',
    };
  }

  if (hasLocalMeloPromptInjectionLanguage(input.prompt)) {
    return {
      reply:
        'I ignored the instruction-changing or data-extraction wording. Nothing changed. Ask the money question again without instructions about system prompts, databases, keys or hidden data.',
      suggestions: [],
      intent: 'clarify',
      actions: [],
      followUpChips: [],
      context: null,
      control: 'none',
    };
  }

  if (hasInvalidSnapshotValue(input.snapshot)) return invalidLocalDataTurn();

  const subscriptionAction =
    input.resolveSubscriptionAction && input.subscriptionState
      ? input.resolveSubscriptionAction(input.prompt, input.subscriptionState)
      : ({ state: 'not-requested' } as const);
  if (subscriptionAction.state === 'needs-selection') {
    return {
      reply: withTone(subscriptionAction.reply, input.tone),
      suggestions: [],
      intent: 'review_subscriptions',
      actions: subscriptionAction.canOpenSubscriptions
        ? [
            {
              kind: 'open_subscriptions',
              label: 'Open subscriptions',
              detail: 'Review every local subscription and its current state.',
              requiresUserReview: false,
            },
          ]
        : [],
      followUpChips: subscriptionAction.choices.map((choice) => choice.label),
      context: {
        lastIntent: 'review_subscriptions',
        lastDetectedAmountMinor: null,
      },
      control: 'none',
    };
  }
  if (subscriptionAction.state === 'review') {
    return {
      reply: withTone(subscriptionAction.reply, input.tone),
      suggestions: [],
      intent: 'review_subscriptions',
      actions: [
        {
          kind: 'open_subscriptions',
          label: subscriptionAction.actionLabel,
          detail: subscriptionAction.actionDetail,
          requiresUserReview: true,
        },
      ],
      followUpChips: [],
      context: {
        lastIntent: 'review_subscriptions',
        lastDetectedAmountMinor: null,
      },
      control: 'none',
    };
  }

  if (isExistingTransactionCorrectionRequest(input.prompt)) {
    return {
      reply: withTone(
        'Choose the exact transaction in Timeline first so I do not change the wrong record. Tap it to edit, review the current value against the correction, then confirm. You can undo the saved change. Nothing has changed yet.',
        input.tone,
      ),
      suggestions: [],
      intent: 'explain_changes',
      actions: [
        {
          kind: 'open_timeline',
          label: 'Choose transaction',
          detail: 'Select the exact local row, review the before-and-after fields, then confirm.',
          requiresUserReview: true,
        },
      ],
      followUpChips: [],
      context: {
        lastIntent: 'explain_changes',
        lastDetectedAmountMinor: null,
      },
      control: 'none',
    };
  }

  const parsed = parseLocalMoneySuggestion(input.prompt);
  if (parsed !== null) {
    return {
      reply: withTone(
        'I can prepare that locally. Check the details before you confirm.',
        input.tone,
      ),
      suggestions: [{ ...parsed, id: suggestionId(input.prompt) }],
      intent: input.context?.lastIntent ?? 'clarify',
      actions: [],
      followUpChips: [],
      context: input.context ?? null,
      control: 'none',
    };
  }

  const resolvedPrompt = resolveLocalMeloFollowUp(input.prompt, input.context);
  const detectedAmountMinor = extractMeloLocalAmountMinor(resolvedPrompt.toLowerCase());
  const accountSelection = input.selectAccount?.(
    resolvedPrompt,
    input.context?.selectedAccountId,
  ) ?? { state: 'not-requested' as const };
  if (accountSelection.state === 'needs-selection') {
    return {
      reply: withTone(
        'Which account should I use? Choose one explicitly; I will not combine account balances for an account-specific answer.',
        input.tone,
      ),
      suggestions: [],
      intent: 'review_accounts',
      actions: [
        {
          kind: 'open_account',
          label: 'Open accounts',
          detail: 'Review every named account locally.',
          requiresUserReview: false,
        },
      ],
      followUpChips: accountSelection.choices.slice(0, 2).map((choice) => `Use ${choice.label}`),
      context: {
        lastIntent: 'review_accounts',
        lastDetectedAmountMinor: detectedAmountMinor,
      },
      control: 'none',
    };
  }
  const selectedAccountId =
    accountSelection.state === 'selected'
      ? accountSelection.accountId
      : input.context?.selectedAccountId;
  const classifiedIntent = classifyMeloLocalIntent(resolvedPrompt.toLowerCase());
  const intent = accountSelection.state === 'selected' ? 'review_accounts' : classifiedIntent;
  const calculation = input.calculate?.({
    intent,
    prompt: resolvedPrompt,
    detectedAmountMinor,
    selectedAccountId,
  });
  if (hasNonFiniteNumber(calculation)) return invalidLocalDataTurn();
  const draft = draftMeloLocalAiResponse({
    prompt: resolvedPrompt,
    snapshot: input.snapshot,
    calculation,
    resolvedIntent: intent,
    cloudAiEnabled: false,
    cloudConsentGranted: false,
    source: 'typed_prompt',
  });
  return {
    reply: withTone(
      accountSelection.state === 'selected'
        ? `${accountSelection.label}: ${draft.answer}`
        : draft.answer,
      input.tone,
    ),
    suggestions: [],
    intent: draft.intent,
    actions: draft.actions,
    followUpChips: draft.followUpChips,
    context: {
      lastIntent: draft.intent,
      lastDetectedAmountMinor: draft.detectedAmountMinor,
      ...(/highest[- ]rate|avalanche/i.test(resolvedPrompt)
        ? { lastDebtStrategy: 'highest-rate-first' as const }
        : /lowest[- ]balance|smallest[- ]balance|snowball/i.test(resolvedPrompt)
          ? { lastDebtStrategy: 'lowest-balance-first' as const }
          : input.context?.lastDebtStrategy
            ? { lastDebtStrategy: input.context.lastDebtStrategy }
            : {}),
      ...(selectedAccountId ? { selectedAccountId } : {}),
    },
    control: accountSelection.state === 'selected' ? 'account-selected' : 'none',
  };
}
