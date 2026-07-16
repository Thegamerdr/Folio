import type { Sub } from '../store';

type SubscriptionState = Readonly<{
  subs: readonly Sub[];
  subPaused: Readonly<Record<string, boolean>>;
}>;

export type MeloSubscriptionRequestResolution =
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

type RequestedChange = 'pause' | 'resume';

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en-GB')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function poundsFromMinor(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function monthlyMinor(subs: readonly Sub[], paused: Readonly<Record<string, boolean>>): number {
  return subs.reduce((total, subscription) => {
    if (paused[subscription.name] || !Number.isFinite(subscription.cost) || subscription.cost < 0) {
      return total;
    }
    return total + Math.round(subscription.cost * 100);
  }, 0);
}

function parseRequest(
  prompt: string,
): Readonly<{ change: RequestedChange; target: string }> | null {
  const normalized = prompt
    .trim()
    .replace(/[.!]+$/, '')
    .trim();
  const match = normalized.match(
    /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(pause|resume|unpause)\s+(?:my\s+)?(.+)$/i,
  );
  if (!match?.[1] || !match[2]) return null;

  const change: RequestedChange = /^pause$/i.test(match[1]) ? 'pause' : 'resume';
  const target = normalize(
    match[2]
      .replace(/\b(?:subscription|payment)\b/gi, ' ')
      .replace(/\b(?:for\s+)?(?:this|the)\s+(?:month|cycle)\b/gi, ' ')
      .replace(/\bfor\s+(?:a|one)\s+month\b/gi, ' '),
  );
  return { change, target };
}

function matchesTarget(subscriptions: readonly Sub[], target: string): readonly Sub[] {
  if (!target || /^(?:one|a|it|that|this)$/.test(target)) return [];
  const exact = subscriptions.filter((subscription) => normalize(subscription.name) === target);
  if (exact.length > 0) return exact;
  return subscriptions.filter((subscription) => {
    const name = normalize(subscription.name);
    return name.includes(target) || target.includes(name);
  });
}

function selectionReply(change: RequestedChange, count: number): string {
  if (count === 0) {
    return change === 'pause'
      ? 'There are no active subscriptions to pause.'
      : 'There are no paused subscriptions to resume.';
  }
  return change === 'pause'
    ? 'Which subscription do you want to pause? Nothing changes until you review it in Subscriptions.'
    : 'Which subscription do you want to resume? Nothing changes until you review it in Subscriptions.';
}

/**
 * Resolve a narrowly-scoped subscription command from local state. This never writes. It only
 * names an existing row, calculates the exact active-recurring-total delta, and routes the user to
 * the dedicated Subscriptions surface where the reversible change already belongs.
 */
export function resolveMeloSubscriptionRequest(
  prompt: string,
  state: SubscriptionState,
): MeloSubscriptionRequestResolution {
  const request = parseRequest(prompt);
  if (!request) return { state: 'not-requested' };

  const eligible = state.subs.filter((subscription) =>
    request.change === 'pause'
      ? !state.subPaused[subscription.name]
      : !!state.subPaused[subscription.name],
  );

  if (!request.target || /^(?:one|a|it|that|this)$/.test(request.target)) {
    return {
      state: 'needs-selection',
      reply: selectionReply(request.change, eligible.length),
      choices: eligible.slice(0, 3).map((subscription) => ({
        label: `${request.change === 'pause' ? 'Pause' : 'Resume'} ${subscription.name}`,
      })),
      canOpenSubscriptions: eligible.length === 0,
    };
  }

  const matches = matchesTarget(state.subs, request.target);
  if (matches.length !== 1) {
    const candidates = matches.length > 1 ? matches : eligible;
    return {
      state: 'needs-selection',
      reply:
        matches.length > 1
          ? `I found ${matches.length} matching subscriptions. Choose the exact one; nothing has changed.`
          : `I could not find “${request.target}” in your subscriptions. Nothing has changed.`,
      choices: candidates.slice(0, 3).map((subscription) => ({
        label: `${request.change === 'pause' ? 'Pause' : 'Resume'} ${subscription.name}`,
      })),
      canOpenSubscriptions: true,
    };
  }

  const subscription = matches[0]!;
  const isPaused = !!state.subPaused[subscription.name];
  if (!Number.isFinite(subscription.cost) || subscription.cost < 0) {
    return {
      state: 'review',
      reply: `I found ${subscription.name}, but its stored monthly amount needs review before I can calculate a change. Nothing changed.`,
      actionLabel: 'Review subscription amount',
      actionDetail: `Open Subscriptions and correct ${subscription.name} before pausing or resuming it.`,
    };
  }
  const currentMonthlyMinor = monthlyMinor(state.subs, state.subPaused);
  const subscriptionMinor = Math.round(subscription.cost * 100);

  if (request.change === 'pause' && isPaused) {
    return {
      state: 'review',
      reply: `${subscription.name} is already paused, so its ${poundsFromMinor(subscriptionMinor)} monthly charge is already excluded from your active recurring total. Nothing changed.`,
      actionLabel: 'Open subscriptions',
      actionDetail: `Review ${subscription.name} and its current paused state locally.`,
    };
  }
  if (request.change === 'resume' && !isPaused) {
    return {
      state: 'review',
      reply: `${subscription.name} is already active at ${poundsFromMinor(subscriptionMinor)} a month. Nothing changed.`,
      actionLabel: 'Open subscriptions',
      actionDetail: `Review ${subscription.name} and its current active state locally.`,
    };
  }

  const nextMonthlyMinor =
    request.change === 'pause'
      ? currentMonthlyMinor - subscriptionMinor
      : currentMonthlyMinor + subscriptionMinor;
  const verb = request.change === 'pause' ? 'Pausing' : 'Resuming';
  return {
    state: 'review',
    reply: `${subscription.name} is ${isPaused ? 'paused' : 'active'} at ${poundsFromMinor(subscriptionMinor)} a month. ${verb} it would change your active recurring total from ${poundsFromMinor(currentMonthlyMinor)} to ${poundsFromMinor(nextMonthlyMinor)}. Nothing has changed yet.`,
    actionLabel:
      request.change === 'pause'
        ? `Review ${subscription.name} pause`
        : `Review ${subscription.name} resume`,
    actionDetail: `Open Subscriptions to review and apply the ${request.change}; the dedicated surface keeps the change reversible.`,
  };
}
