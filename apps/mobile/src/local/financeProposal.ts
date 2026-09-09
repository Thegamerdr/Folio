import type { MeloLocalIntent } from '@folio/ai-contracts';

import { isMeloToolName, type MeloToolName } from '../folio/lib/melo/toolContract';

export type LocalFinanceProposal = Readonly<{
  name: MeloToolName;
  args: Readonly<Record<string, unknown>>;
  summary: string;
  intent: MeloLocalIntent;
}>;

const MONEY = '(?:£\\s*)?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)';
const MONEY_OR_ZERO = '(?:£\\s*)?(0|[1-9][0-9,]*(?:\\.[0-9]{1,2})?)';
const HYPOTHETICAL =
  /\b(?:can i|could i|should i|what if|what happens if|if i|would|might i|how much can|afford|is it safe|tomorrow|next week|next month|later)\b/i;

function amountOf(value: string, allowZero = false): number | null {
  const amount = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0)) return null;
  return amount;
}

function cleanTarget(value: string | undefined): string | undefined {
  const cleaned = (value ?? '')
    .replace(/[.!?]+$/, '')
    .replace(/\b(?:please|thanks|thank you)\b/gi, '')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : undefined;
}

function cadenceOf(prompt: string): 'weekly' | 'fortnightly' | 'monthly' | 'annual' | undefined {
  if (/\bfortnightly|every two weeks?|\/\s*fortnight\b/i.test(prompt)) return 'fortnightly';
  if (/\bweekly|every week|\/\s*week\b/i.test(prompt)) return 'weekly';
  if (/\bannual|annually|yearly|per year|\/\s*year\b/i.test(prompt)) return 'annual';
  if (/\bmonthly|each month|per month|\/\s*month\b/i.test(prompt)) return 'monthly';
  return undefined;
}

function proposal(
  name: MeloToolName,
  args: Readonly<Record<string, unknown>>,
  summary: string,
  intent: MeloLocalIntent,
): LocalFinanceProposal {
  return { name, args, summary, intent };
}

/**
 * Parse an explicit user-described finance change into a review-only proposal.
 *
 * Questions and scenarios deliberately return null so they continue through the deterministic
 * calculation route. Every returned amount is a positive GBP number except zero-valued balance or
 * buffer corrections, which are valid explicit requests.
 */
export function parseLocalFinanceProposal(prompt: string): LocalFinanceProposal | null {
  const text = prompt.trim();
  if (text.length === 0 || HYPOTHETICAL.test(text)) return null;

  // "I got paid £300 less" is an adjustment to an expected pay record, not £300 of new
  // income. Keep the direction explicit so the confirmation surface can ask for the actual
  // received amount before committing the correction.
  const incomeVariance = text.match(
    new RegExp(
      `\\b(?:i\\s+)?(?:got|was)\\s+paid\\s+${MONEY}\\s+(less|more)(?:\\s+than\\s+(.+?))?(?:[.!?]|$)`,
      'i',
    ),
  );
  if (incomeVariance) {
    const amount = amountOf(incomeVariance[1] ?? '');
    if (amount === null) return null;
    const direction = incomeVariance[2]?.toLowerCase() === 'more' ? 'increase' : 'decrease';
    const comparison = cleanTarget(incomeVariance[3]);
    return proposal(
      'correct_income',
      {
        adjustmentAmount: amount,
        direction,
        ...(comparison === undefined ? {} : { comparison }),
      },
      `Review a £${amount.toFixed(2)} ${direction} to recorded income before saving the correction.`,
      'check_payday',
    );
  }

  const paydayDate = text.match(
    /\b(?:i\s+)?(?:get\s+paid|am\s+paid|payday)\s+(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i,
  );
  if (paydayDate) {
    const day = Number(paydayDate[1]);
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;
    return proposal(
      'set_income_schedule',
      { payDayOfMonth: day },
      `Set payday to the ${day}${day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} for review.`,
      'check_payday',
    );
  }

  // A debt payment is proposed only when the wording states that it happened. A named debt is
  // optional; the store approval step must ask the user to choose one when it is absent.
  const debtPayment = text.match(
    new RegExp(
      `\\b(?:i\\s+)?(?:just\\s+)?(?:paid|sent|put|made)\\s+${MONEY}\\s+(?:towards?|toward|off|on|to)\\s+(?:my\\s+)?(.+?)(?:[.!?]|$)`,
      'i',
    ),
  );
  const genericDebtPayment = text.match(
    new RegExp(
      `\\b(?:i\\s+)?(?:just\\s+)?made\\s+(?:a\\s+)?${MONEY}\\s+(?:debt\\s+)?payment(?:[.!?]|$)`,
      'i',
    ),
  );
  if (debtPayment || genericDebtPayment) {
    const match = debtPayment ?? genericDebtPayment;
    const amount = amountOf(match?.[1] ?? '');
    if (amount === null) return null;
    const debtName = cleanTarget(debtPayment?.[2]);
    return proposal(
      'log_debt_payment',
      debtName === undefined ? { amount } : { amount, debtName },
      debtName === undefined
        ? `Record the completed £${amount.toFixed(2)} debt payment for review.`
        : `Record the completed £${amount.toFixed(2)} payment towards ${debtName} for review.`,
      'review_debts',
    );
  }

  // Marking a debt paid off is a balance correction, not a transaction guess.
  const paidOff = text.match(
    /\b(?:(?:mark|set|change|update|correct)\s+(?:my\s+)?(.+?)\s+(?:as\s+)?(?:paid\s+off|cleared|settled)|only\s+clear\s+(.+?))(?:[.!?]|$)/i,
  );
  if (paidOff) {
    const debtName = cleanTarget(paidOff[1] ?? paidOff[2]);
    if (debtName === undefined) return null;
    return proposal(
      'set_debt_balance',
      { debtName, balance: 0 },
      `Set ${debtName}'s balance to £0.00 for review.`,
      'review_debts',
    );
  }

  const arrears = text.match(
    /\b(?:i['’]?m|i\s+am|we['’]?re|we\s+are)\s+(?:behind|in arrears)\s+(?:on|with)\s+(?:my\s+)?(.+?)(?:[.!?]|$)/i,
  );
  if (arrears) {
    const debtName = cleanTarget(arrears[1]);
    if (debtName !== undefined && !/^(?:this|that|this one|that one|it)$/i.test(debtName)) {
      return proposal(
        'set_debt_arrears',
        { debtName, arrears: true },
        `Mark ${debtName} as behind for review.`,
        'review_debts',
      );
    }
  }

  const debtBalance = text.match(
    new RegExp(
      `\\b(?:change|update|correct|set|make)\\s+(?:my\\s+)?(.+?)\\s+(?:debt\\s+)?balance\\s+(?:to|at|as)\\s+${MONEY_OR_ZERO}(?:[.!?]|$)`,
      'i',
    ),
  );
  if (debtBalance) {
    const amount = amountOf(debtBalance[2] ?? '', true);
    const debtName = cleanTarget(debtBalance[1]);
    if (amount === null || debtName === undefined) return null;
    return proposal(
      'set_debt_balance',
      { debtName, balance: amount },
      `Change ${debtName}'s balance to £${amount.toFixed(2)} for review.`,
      'review_debts',
    );
  }

  const buffer = text.match(
    new RegExp(
      `\\b(?:set|change|update|correct|keep|raise|lower|make)\\s+(?:my\\s+)?(?:safety\\s+)?(?:buffer|reserve|safety\\s+net)\\s+(?:to|at)\\s+${MONEY_OR_ZERO}(?:[.!?]|$)`,
      'i',
    ),
  );
  if (buffer) {
    const amount = amountOf(buffer[1] ?? '', true);
    if (amount === null) return null;
    return proposal(
      'set_buffer_amount',
      { amount },
      `Set your protected buffer to £${amount.toFixed(2)} for review.`,
      'explain_position',
    );
  }

  const incomeCorrection = text.match(
    new RegExp(
      `\\b(?:actual\\s+pay|pay|income|salary|wage|payday)\\s+(?:was|is|should\\s+be|needs\\s+to\\s+be)\\s+${MONEY}(?:\\s+(?:from|by)\\s+(.+?))?(?:[.!?]|$)`,
      'i',
    ),
  );
  const explicitIncomeCorrection =
    /\b(?:correct|change|update|fix|amend)\b/i.test(text) &&
    /\b(?:income|pay|salary|wage|payday)\b/i.test(text)
      ? text.match(new RegExp(`${MONEY}(?:\\s+(?:from|by)\\s+(.+?))?(?:[.!?]|$)`, 'i'))
      : null;
  if (incomeCorrection || explicitIncomeCorrection) {
    const match = incomeCorrection ?? explicitIncomeCorrection;
    const amount = amountOf(match?.[1] ?? '');
    if (amount === null) return null;
    const source = cleanTarget(match?.[2]);
    return proposal(
      'correct_income',
      source === undefined ? { amount } : { amount, source },
      source === undefined
        ? `Update the recorded income to £${amount.toFixed(2)} for review.`
        : `Update ${source} income to £${amount.toFixed(2)} for review.`,
      'check_payday',
    );
  }

  const livingCost = text.match(
    new RegExp(
      `\\b(?:set|change|update|correct|allow|budget)\\s+(?:my\\s+)?(.+?)\\s+(?:allowance|budget|cost|spending)\\s+(?:to|at)\\s+${MONEY}(?:\\s*(?:/\\s*(?:week|month|fortnight|year)|weekly|monthly|fortnightly|annual|yearly))?(?:[.!?]|$)`,
      'i',
    ),
  );
  const livedSpend = text.match(
    new RegExp(
      `\\b(?:i\\s+)?(?:actually\\s+)?spend(?:ing)?\\s+(?:about\\s+)?${MONEY}\\s+(?:a|per)\\s+(week|month|fortnight|year)\\s+on\\s+(.+?)(?:[.!?]|$)`,
      'i',
    ),
  );
  if (livingCost || livedSpend) {
    const amount = amountOf(livingCost?.[2] ?? livedSpend?.[1] ?? '');
    const category = cleanTarget(livingCost?.[1] ?? livedSpend?.[3]);
    if (amount === null || category === undefined) return null;
    const livedCadence = livedSpend?.[2]
      ? livedSpend[2].toLowerCase() === 'week'
        ? 'weekly'
        : livedSpend[2].toLowerCase() === 'fortnight'
          ? 'fortnightly'
          : livedSpend[2].toLowerCase() === 'year'
            ? 'annual'
            : 'monthly'
      : cadenceOf(text);
    return proposal(
      'set_living_cost',
      { category, amount, ...(livedCadence ? { cadence: livedCadence } : {}) },
      `Set the ${category} allowance to £${amount.toFixed(2)} for review.`,
      'explain_position',
    );
  }

  const commitment = text.match(
    new RegExp(
      `\\b(?:set|change|update|correct|make)\\s+(?:my\\s+)?(.+?)\\s+(?:payment|bill|rent|commitment)\\s+(?:to|at)\\s+${MONEY}(?:\\s*(?:/\\s*(?:week|month|fortnight|year)|weekly|monthly|fortnightly|annual|yearly))?(?:[.!?]|$)`,
      'i',
    ),
  );
  const simpleCommitment = text.match(
    new RegExp(
      `\\b(?:set|change|update|correct|make)\\s+(?:my\\s+)?(rent|bills?|utilities|council\\s+tax|insurance|childcare|subscription|commitment)\\s+(?:to|at)\\s+${MONEY}(?:\\s*(?:/\\s*(?:week|month|fortnight|year)|weekly|monthly|fortnightly|annual|yearly))?(?:[.!?]|$)`,
      'i',
    ),
  );
  const bundledLabelCommitment = text.match(
    new RegExp(
      `\\b(?:set|change|update|correct|make)\\s+(?:my\\s+)?(rent\\s+(?:and|&)\\s+bills?|bills?\\s+(?:and|&)\\s+rent)\\s+(?:payment|bill|commitment)?\\s*(?:to|at)\\s+${MONEY}(?:\\s*(?:/\\s*(?:week|month|fortnight|year)|weekly|monthly|fortnightly|annual|yearly))?(?:[.!?]|$)`,
      'i',
    ),
  );
  const bundledCommitment = text.match(
    new RegExp(`\\b(?:my\\s+)?(.+?)\\s+are\\s+all\\s+one\\s+${MONEY}\\s+payment(?:[.!?]|$)`, 'i'),
  );
  const recurringAmount = text.match(
    new RegExp(
      `\\b(?:my\\s+)?(.+?)\\s+(?:is|will be|comes to)\\s+${MONEY}(?:\\s+(?:each|every)\\s+(?:month|week|fortnight|year))?(?:[.!?]|$)`,
      'i',
    ),
  );
  if (
    bundledLabelCommitment ||
    commitment ||
    simpleCommitment ||
    bundledCommitment ||
    (recurringAmount && /rent|bill|utility|insurance|childcare|subscription|commitment/i.test(text))
  ) {
    const match =
      bundledLabelCommitment ??
      simpleCommitment ??
      commitment ??
      bundledCommitment ??
      recurringAmount;
    const amount = amountOf(match?.[2] ?? match?.[1] ?? '');
    const rawName = cleanTarget(
      bundledLabelCommitment?.[1] ??
        simpleCommitment?.[1] ??
        commitment?.[1] ??
        bundledCommitment?.[1] ??
        recurringAmount?.[1],
    );
    const name = rawName;
    if (amount === null || name === undefined) return null;
    const cadence = cadenceOf(text);
    return proposal(
      'set_commitment',
      { name, amount, ...(cadence ? { cadence } : {}) },
      `Set ${name} at £${amount.toFixed(2)}${cadence ? ` ${cadence}` : ''} for review.`,
      'review_recurring',
    );
  }

  // Keep the guard useful to callers that assemble contracts dynamically.
  return null;
}

/** A clearance statement does not tell us whether the bank outflow is already recorded. */
export function isAmbiguousDebtClearanceRequest(prompt: string): boolean {
  return /\b(?:i\s+)?(?:just\s+)?(?:cleared|paid\s+off|settled)\s+(?:my\s+)?[a-z0-9][^.!?]*$/i.test(
    prompt.trim(),
  );
}

export function ambiguousDebtName(prompt: string): string | undefined {
  const match = prompt
    .trim()
    .match(
      /^\b(?:i\s+)?(?:just\s+)?(?:cleared|paid\s+off|settled)\s+(?:my\s+)?([a-z0-9][^.!?]*)$/i,
    );
  const name = cleanTarget(match?.[1]);
  return name;
}

export function isFinanceProposalToolName(name: string): name is MeloToolName {
  return isMeloToolName(name);
}
