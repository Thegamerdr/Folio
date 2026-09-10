import type { AppState } from '../store';
import { previewDebtPaymentChange } from '../lib/paymentPresentation';
import { formatMoney } from '../lib/financialPresentation';

export type MeloDebtPaymentReview =
  | Readonly<{ kind: 'unavailable'; message: string }>
  | Readonly<{
      kind: 'ready';
      input: Record<string, unknown>;
      workspaceId: string;
      fingerprint: string;
      paymentAmount: number;
      debtName: string;
      cashAccountName: string;
      principalReduction: number;
      excess: number;
      rows: ReturnType<typeof previewDebtPaymentChange>['rows'];
      explanation: string;
    }>;

/** Freeze the exact review shown in chat. Only the shared posting transition computes effects. */
export function prepareMeloDebtPaymentReview(
  state: AppState,
  input: Readonly<Record<string, unknown>>,
  at: string,
  transactionId: string,
): MeloDebtPaymentReview {
  const unavailable = (message: string): MeloDebtPaymentReview => ({
    kind: 'unavailable',
    message,
  });
  const debts = (state.debts ?? []).filter(
    (debt) => debt.workspaceId === undefined || debt.workspaceId === state.activeWorkspaceId,
  );
  const normalise = (value: string) =>
    value
      .toLowerCase()
      .replace(/[+&]/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  const query = normalise(textValue(input.debtName) ?? textValue(input.name) ?? '');
  const exact = debts.filter((debt) => normalise(debt.name) === query);
  const matching = input.debtId
    ? debts.filter((debt) => debt.id === String(input.debtId))
    : !query
      ? debts
      : exact.length > 0
        ? exact
        : debts.filter((debt) => {
            const name = normalise(debt.name);
            return name.includes(query) || query.includes(name);
          });
  if (matching.length !== 1)
    return unavailable(
      matching.length > 1
        ? 'Choose the exact debt in Log a payment before recording this.'
        : 'This debt is unavailable. Review your debts before recording a payment.',
    );
  const debt = matching[0]!;
  if (debt.balance <= 0)
    return unavailable(`${debt.name} is already at £0. No payment was recorded.`);
  const amount = Number(input.amount ?? input.adjustmentAmount ?? NaN);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(Math.round(amount * 100)) ||
    Math.abs(amount - Math.round(amount * 100) / 100) >= 1e-8
  )
    return unavailable('Use a positive payment amount with at most two decimal places.');
  const accounts = (state.accounts ?? []).filter(
    (account) =>
      !account.isLiability &&
      account.closed !== true &&
      (account.workspaceId === undefined || account.workspaceId === state.activeWorkspaceId),
  );
  const requestedAccount = textValue(input.cashAccountId) ?? textValue(input.accountId);
  const account = requestedAccount
    ? accounts.find((item) => item.id === requestedAccount)
    : accounts.length === 1
      ? accounts[0]
      : undefined;
  if (!account)
    return unavailable('Choose which cash account the payment came from in Log a payment.');
  if (state.transactions.some((transaction) => transaction.id === transactionId))
    return unavailable(
      'This payment record already exists. Review its transaction before making another change.',
    );
  try {
    const preview = previewDebtPaymentChange(
      state,
      undefined,
      {
        id: transactionId,
        workspaceId: state.activeWorkspaceId,
        when: at,
        merchant: `Debt payment: ${debt.name}`,
        amount: -amount,
        category: 'bills',
        source: input.source === 'manual' ? 'manual' : 'melo',
        accountId: account.id,
        financialAction: { kind: 'debt-payment', debtId: debt.id, principalAppliedMinor: 0 },
      },
      at,
    );
    const principalReduction =
      (preview.transaction?.financialAction.principalAppliedMinor ?? 0) / 100;
    const excess = Math.round((amount - principalReduction) * 100) / 100;
    const pinnedInput = {
      ...input,
      amount,
      debtId: debt.id,
      debtName: debt.name,
      cashAccountId: account.id,
      transactionId,
      preview: {
        beforeTotalDebtMinor: (state.debts ?? []).reduce(
          (sum, item) => sum + Math.round(item.balance * 100),
          0,
        ),
      },
    };
    return {
      kind: 'ready',
      input: pinnedInput,
      workspaceId: state.activeWorkspaceId,
      fingerprint: JSON.stringify({
        workspaceId: state.activeWorkspaceId,
        day: preview.afterPlan.asOf,
        rows: preview.rows,
        account,
        currentBalance: state.currentBalance,
        debt,
        beforeTotalDebtMinor: pinnedInput.preview.beforeTotalDebtMinor,
        amount,
        principalReduction,
      }),
      paymentAmount: amount,
      debtName: debt.name,
      cashAccountName: account.name,
      principalReduction,
      excess,
      rows: preview.rows,
      explanation: `Records a payment you have already made. This reduces tracked cash by ${formatMoney(amount, true)} and debt by ${formatMoney(principalReduction, true)}. Melo does not send money.${excess > 0 ? ` The ${formatMoney(excess, true)} above the remaining debt still leaves cash; it is not added as spending or a credit balance.` : ''}`,
    };
  } catch (reason) {
    return unavailable(
      reason instanceof Error
        ? reason.message
        : 'Review the debt and cash account before recording this payment.',
    );
  }
}

/** Reject stale reviews, including account changes hidden by an unchanged aggregate balance. */
export function isMeloDebtPaymentReviewCurrent(
  state: AppState,
  review: MeloDebtPaymentReview,
  at: string,
): boolean {
  if (review.kind !== 'ready' || review.workspaceId !== state.activeWorkspaceId) return false;
  const current = prepareMeloDebtPaymentReview(
    state,
    review.input,
    at,
    String(review.input.transactionId),
  );
  return current.kind === 'ready' && current.fingerprint === review.fingerprint;
}

export const MELO_TOOL_APPROVAL_REQUESTED = 'approval-requested' as const;
export const MELO_TOOL_APPROVAL_DENIED = 'approval-denied' as const;
export const MELO_TOOL_OUTPUT_AVAILABLE = 'output-available' as const;
export const MELO_TOOL_UNDONE = 'undo-complete' as const;

export type MeloToolSuggestionSnapshot = Readonly<{
  state?: string;
  output?: Readonly<{ ok?: boolean; message?: string }>;
}>;

export type MeloToolSuggestionPhase =
  | 'pending'
  | 'applied'
  | 'failed'
  | 'dismissed'
  | 'undone'
  | 'unavailable';

export type MeloToolSuggestionSettlement =
  | { state: typeof MELO_TOOL_APPROVAL_DENIED }
  | {
      state: typeof MELO_TOOL_UNDONE;
      output: { ok: true; message: string };
    }
  | {
      state: typeof MELO_TOOL_OUTPUT_AVAILABLE;
      output: { ok: boolean; message: string };
    };

export type MeloToolSuggestionCommand =
  | { type: 'apply' }
  | { type: 'settle'; settlement: MeloToolSuggestionSettlement }
  | { type: 'ignore' };

/**
 * Convert the wire-shaped tool part into the small UI state machine used by the
 * chat. Only an explicit approval request is actionable. In particular, a bare
 * `output-available` part is never interpreted as permission to mutate state.
 */
export function getMeloToolSuggestionPhase(
  suggestion: MeloToolSuggestionSnapshot,
): MeloToolSuggestionPhase {
  if (suggestion.state === MELO_TOOL_APPROVAL_REQUESTED && suggestion.output === undefined) {
    return 'pending';
  }
  if (suggestion.state === MELO_TOOL_APPROVAL_DENIED) return 'dismissed';
  if (suggestion.state === MELO_TOOL_UNDONE) return 'undone';
  if (suggestion.state === MELO_TOOL_OUTPUT_AVAILABLE && suggestion.output !== undefined) {
    return suggestion.output.ok === true ? 'applied' : 'failed';
  }
  return 'unavailable';
}

/**
 * Pure decision gate. The component may call the real store only for the
 * `apply` command. Dismissal returns a transcript-only settlement and every
 * already-settled or malformed suggestion is ignored.
 */
export function decideMeloToolSuggestion(
  suggestion: MeloToolSuggestionSnapshot,
  decision: 'confirm' | 'dismiss',
): MeloToolSuggestionCommand {
  if (getMeloToolSuggestionPhase(suggestion) !== 'pending') return { type: 'ignore' };
  if (decision === 'confirm') return { type: 'apply' };
  return {
    type: 'settle',
    settlement: { state: MELO_TOOL_APPROVAL_DENIED },
  };
}

/** Preserve the exact local-store outcome after the user confirms. */
export function settleMeloToolApplication(
  applied: boolean,
  message: string,
): MeloToolSuggestionSettlement {
  return {
    state: MELO_TOOL_OUTPUT_AVAILABLE,
    output: { ok: applied, message },
  };
}

/** Replace an applied result with the truthful transcript state after Undo. */
export function settleMeloToolUndo(): MeloToolSuggestionSettlement {
  return {
    state: MELO_TOOL_UNDONE,
    output: { ok: true, message: 'Undone. Nothing changed.' },
  };
}

/** A compact, user-readable summary of the state change awaiting approval. */
export function describeMeloToolSuggestion(
  name: string,
  input: Readonly<Record<string, unknown>>,
): string {
  const amount = formatAmount(input.amount);
  const preview = previewText(input.preview);
  const merchant = textValue(input.merchant);

  switch (name) {
    case 'log_spend':
      if (amount && merchant) return `Log ${amount} spent at ${merchant}.${preview}`;
      break;
    case 'log_income': {
      const source = merchant ?? textValue(input.source);
      if (amount && source) return `Log ${amount} received from ${source}.${preview}`;
      break;
    }
    case 'log_refund':
      if (amount && merchant) return `Log a ${amount} refund from ${merchant}.`;
      break;
    case 'log_transfer': {
      const from = textValue(input.from);
      const to = textValue(input.to);
      if (amount && from && to) return `Log a ${amount} transfer from ${from} to ${to}.`;
      break;
    }
    case 'log_debt_payment': {
      const debt = textValue(input.debtName) ?? textValue(input.name);
      if (amount && debt)
        return `Record the completed ${amount} payment to ${debt}. Review the cash and debt changes before confirming.`;
      if (amount)
        return `Record the completed ${amount} debt payment. Review the cash and debt changes before confirming.`;
      break;
    }
    case 'set_debt_balance': {
      const debt = textValue(input.debtName) ?? textValue(input.name);
      const balance = formatNonNegativeAmount(input.balance);
      if (debt && balance) return `Set ${debt}'s balance to ${balance}.${preview}`;
      break;
    }
    case 'set_debt_arrears': {
      const debt = textValue(input.debtName) ?? textValue(input.name);
      if (debt) {
        return `Mark ${debt} as ${input.arrears === false ? 'current' : 'behind'} for review.`;
      }
      break;
    }
    case 'set_commitment': {
      const commitment = textValue(input.name) ?? textValue(input.label);
      if (amount && commitment)
        return `Set ${commitment} to ${amount}${textValue(input.cadence) ? ` ${textValue(input.cadence)}` : ''}.${preview}`;
      break;
    }
    case 'set_living_cost': {
      const category = textValue(input.category);
      const cadence = textValue(input.cadence) ?? 'weekly';
      if (amount)
        return `Set total essential spending to ${amount} ${cadence}${category ? `, including ${category}` : ''}.${preview}`;
      break;
    }
    case 'set_buffer_amount':
      if (formatNonNegativeAmount(input.amount))
        return `Set your safety buffer to ${formatNonNegativeAmount(input.amount)}.${preview}`;
      break;
    case 'correct_income': {
      const source = textValue(input.source) ?? textValue(input.label);
      if (amount && source) return `Correct ${source} income to ${amount}.${preview}`;
      if (amount) return `Correct received income to ${amount}.${preview}`;
      break;
    }
    case 'set_income_schedule': {
      const day = Number(input.payDayOfMonth ?? input.dayOfMonth);
      if (Number.isInteger(day) && day >= 1 && day <= 31)
        return `Set payday to the ${ordinal(day)} of each month.`;
      break;
    }
    default:
      break;
  }

  return 'Review this suggested change.';
}

function formatAmount(value: unknown): string | undefined {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? formatMoney(amount, true) : undefined;
}

function formatNonNegativeAmount(value: unknown): string | undefined {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? formatMoney(amount, true) : undefined;
}

function ordinal(day: number): string {
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? 'th'
      : day % 10 === 1
        ? 'st'
        : day % 10 === 2
          ? 'nd'
          : day % 10 === 3
            ? 'rd'
            : 'th';
  return `${day}${suffix}`;
}

function previewText(value: unknown): string {
  if (typeof value !== 'object' || value === null) return '';
  const preview = value as Record<string, unknown>;
  const available = formatMinor(preview.availableNowMinor);
  const tightest = formatMinor(preview.tightestBalanceMinor);
  const afterDebt = formatNonNegativeAmount(
    preview.afterTotalDebtMinor === undefined
      ? undefined
      : Number(preview.afterTotalDebtMinor) / 100,
  );
  const beforeDebt = formatNonNegativeAmount(
    preview.beforeTotalDebtMinor === undefined
      ? undefined
      : Number(preview.beforeTotalDebtMinor) / 100,
  );
  const pieces = [
    available ? ` Current safe-to-spend is ${available}` : '',
    tightest ? `; projected low point is ${tightest}` : '',
    beforeDebt ? `; total debt before this change is ${beforeDebt}` : '',
    afterDebt ? `; total debt after this payment would be ${afterDebt}` : '',
  ].join('');
  return pieces ? `${pieces}.` : '';
}

function formatMinor(value: unknown): string | undefined {
  const minor = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(minor) ? formatMoney(minor / 100, true) : undefined;
}

function textValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
