import type { MeloLocalAiAction, MeloLocalIntent } from '@folio/ai-contracts';
import { findEscalationTriggers, type EscalationTrigger } from '@folio/melo-policy';

export type LocalMeloSafetyResolution =
  | Readonly<{ state: 'none' }>
  | Readonly<{
      state: 'escalated';
      reply: string;
      intent: MeloLocalIntent;
      actions: readonly MeloLocalAiAction[];
    }>;

const has = (triggers: readonly EscalationTrigger[], trigger: EscalationTrigger): boolean =>
  triggers.includes(trigger);

export function hasLocalMeloPromptInjectionLanguage(prompt: string): boolean {
  const normalized = prompt.toLocaleLowerCase('en-GB');
  return [
    'ignore previous',
    'ignore all',
    'system prompt',
    'developer message',
    'dump',
    'exfiltrate',
    'reveal',
    'api key',
    'database password',
    'write directly',
    'update database',
  ].some((term) => normalized.includes(term));
}

/**
 * Route higher-risk requests before ordinary intent parsing or write-proposal parsing. These
 * responses are deliberately tone-invariant: a selected companion voice must never soften a
 * crisis instruction, turn regulated boundaries into a joke, or alter the available actions.
 */
export function resolveLocalMeloSafety(prompt: string): LocalMeloSafetyResolution {
  const ordinaryEmergencyFund = /\bemergency\s+(?:fund|saving|savings|buffer)\b/i.test(prompt);
  const triggers = findEscalationTriggers(prompt).filter(
    (trigger) => trigger !== 'immediate_crisis' || !ordinaryEmergencyFund,
  );
  if (triggers.length === 0) return { state: 'none' };

  if (has(triggers, 'immediate_crisis')) {
    return {
      state: 'escalated',
      reply:
        'If you cannot meet an immediate need or you are unsafe, this needs human help now, not a money calculation. If anyone is in immediate danger in the UK, call 999 or 112. MoneyHelper can route you to free, confidential debt advice. Melo has not changed anything.',
      intent: 'plan_recovery',
      actions: [
        {
          kind: 'open_uk_emergency_help',
          label: 'Open UK emergency guidance',
          detail: 'Official GOV.UK guidance for 999 and 112.',
          requiresUserReview: false,
        },
        {
          kind: 'open_free_debt_help',
          label: 'Find free debt help',
          detail: "Open MoneyHelper's free debt-advice locator.",
          requiresUserReview: false,
        },
        {
          kind: 'build_recovery_route',
          label: 'Open local recovery plan',
          detail: 'Review what can move in the local money picture while you seek human help.',
          requiresUserReview: false,
        },
      ],
    };
  }

  if (has(triggers, 'insolvency') || has(triggers, 'formal_debt_solution')) {
    return {
      state: 'escalated',
      reply:
        'Bankruptcy, an IVA, a debt relief order or insolvency needs qualified debt advice. I can show recorded balances and neutral scenarios, but I will not choose a formal debt solution. MoneyHelper can route you to free, confidential debt advice. Nothing changed.',
      intent: 'review_debts',
      actions: [
        {
          kind: 'open_free_debt_help',
          label: 'Find free debt help',
          detail: "Open MoneyHelper's free debt-advice locator.",
          requiresUserReview: false,
        },
      ],
    };
  }

  if (has(triggers, 'tax_eligibility_ambiguity')) {
    return {
      state: 'escalated',
      reply:
        'I can organise the amounts, dates and evidence you recorded, but I cannot decide whether an expense is tax deductible or whether you can claim it. Check the current HMRC rules or ask a qualified tax professional. Nothing changed.',
      intent: 'clarify',
      actions: [],
    };
  }

  if (has(triggers, 'legal_dispute')) {
    return {
      state: 'escalated',
      reply:
        'I can help you find the local dates, payments and source records, but I cannot decide a legal dispute or tell you whether to bring a court claim. Use qualified legal help for that decision. Nothing changed.',
      intent: 'explain_changes',
      actions: [
        {
          kind: 'open_timeline',
          label: 'Open local timeline',
          detail: 'Review the dated records and their local source trail.',
          requiresUserReview: false,
        },
      ],
    };
  }

  if (has(triggers, 'investment_selection') || has(triggers, 'credit_product_selection')) {
    const subject = has(triggers, 'investment_selection') ? 'investment' : 'credit product';
    return {
      state: 'escalated',
      reply: `I can compare a hypothetical amount against your local money picture, but I do not select an ${subject}. Product selection needs a regulated adviser. Nothing changed.`,
      intent: 'check_purchase',
      actions: [
        {
          kind: 'open_what_if',
          label: 'Compare an amount locally',
          detail: 'Open What if without selecting or recommending a product.',
          requiresUserReview: false,
        },
      ],
    };
  }

  return { state: 'none' };
}
