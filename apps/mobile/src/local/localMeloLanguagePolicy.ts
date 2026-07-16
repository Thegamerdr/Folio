import type { MeloLocalIntent } from '@folio/ai-contracts';

import type { LocalMeloTurn } from './localMeloTurn';

export const ROUTABLE_LOCAL_MELO_INTENTS: ReadonlySet<MeloLocalIntent> = new Set([
  'check_purchase',
  'explain_position',
  'review_subscriptions',
  'review_recurring',
  'summarise_month',
  'review_import',
  'plan_recovery',
  'check_payday',
  'review_debts',
  'review_goals',
  'review_calendar',
  'explain_changes',
  'review_irregular_income',
  'review_accounts',
]);

const CANONICAL_PROMPTS: Readonly<
  Record<Exclude<MeloLocalIntent, 'check_purchase' | 'clarify'>, string>
> = {
  explain_position: 'Explain my current position and Safe Zone',
  review_subscriptions: 'Review my subscriptions',
  review_recurring: 'Review my recurring payments',
  summarise_month: 'Summarise my month',
  review_import: 'Review imports needing my eye',
  plan_recovery: 'Preview my recovery route',
  check_payday: 'When is my next payday?',
  review_debts: 'Review my debts',
  review_goals: 'Review my savings goals',
  review_calendar: 'Show my money calendar',
  explain_changes: 'What changed?',
  review_irregular_income: 'Review my irregular income',
  review_accounts: 'Review my accounts',
};

export type LocalMeloRoute = Readonly<{ intent: MeloLocalIntent }>;

export function canonicalPromptForLocalIntent(
  intent: MeloLocalIntent,
  originalPrompt: string,
): string | null {
  if (intent === 'clarify') return null;
  if (intent !== 'check_purchase') return CANONICAL_PROMPTS[intent];
  const amount = originalPrompt.match(/(?:£\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/)?.[1];
  return amount ? `Can I afford £${amount}?` : null;
}

export function parseLocalMeloRoute(text: string): LocalMeloRoute | null {
  const match = text.match(/\{[^{}]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { intent?: unknown };
    return typeof parsed.intent === 'string' &&
      ROUTABLE_LOCAL_MELO_INTENTS.has(parsed.intent as MeloLocalIntent)
      ? { intent: parsed.intent as MeloLocalIntent }
      : null;
  } catch {
    return null;
  }
}

export function acceptLocalMeloRephrase(
  candidateRaw: string,
  authoritativeReply: string,
  userPrompt: string,
): string | null {
  const candidate = candidateRaw.trim();
  if (candidate.length < 2 || candidate.length > 900) return null;
  if (
    /```|<\|[^>]+\|>|https?:\/\/|www\.|\b(?:log_spend|log_income|log_refund|log_transfer)\b/i.test(
      candidate,
    )
  ) {
    return null;
  }
  if (
    /\b(?:i (?:have|'ve) (?:saved|recorded|changed|moved|transferred)|done,? that|already updated)\b/i.test(
      candidate,
    )
  ) {
    return null;
  }

  const groundedNumbers = new Set(numberTokens(`${authoritativeReply}\n${userPrompt}`));
  if (numberTokens(candidate).some((number) => !groundedNumbers.has(number))) return null;

  const groundedMoney = new Set(moneyTokens(`${authoritativeReply}\n${userPrompt}`));
  if (moneyTokens(candidate).some((number) => !groundedMoney.has(number))) return null;
  return candidate;
}

export function isLocalMeloRoutingCandidate(turn: LocalMeloTurn): boolean {
  return turn.intent === 'clarify' && turn.actions.length === 0 && turn.suggestions.length === 0;
}

export function mustKeepLocalMeloAuthoritativeReply(turn: LocalMeloTurn): boolean {
  if (turn.control !== 'none' || turn.suggestions.length > 0) return true;
  if (turn.actions.some((action) => action.requiresUserReview)) return true;
  return /\b(?:999|112|MoneyHelper|HMRC|bankruptcy|insolvency|regulated adviser|legal dispute)\b/i.test(
    turn.reply,
  );
}

function numberTokens(text: string): string[] {
  return [...text.matchAll(/\b\d+(?:[,.]\d+)*\b/g)].map((match) =>
    (match[0] ?? '').replace(/,/g, ''),
  );
}

function moneyTokens(text: string): string[] {
  return [...text.matchAll(/£\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g)].map((match) =>
    String(Math.round(Number((match[1] ?? '').replace(/,/g, '')) * 100)),
  );
}
