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
  const merchant = textValue(input.merchant);

  switch (name) {
    case 'log_spend':
      if (amount && merchant) return `Log ${amount} spent at ${merchant}.`;
      break;
    case 'log_income': {
      const source = merchant ?? textValue(input.source);
      if (amount && source) return `Log ${amount} received from ${source}.`;
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
    case 'addToPot': {
      const pot = textValue(input.pot) ?? textValue(input.potName) ?? textValue(input.name);
      if (amount && pot) return `Add ${amount} to ${pot}.`;
      break;
    }
    case 'borrowFromPot': {
      const pot = textValue(input.pot) ?? textValue(input.potName) ?? textValue(input.name);
      if (amount && pot) return `Borrow ${amount} from ${pot}.`;
      break;
    }
    case 'log_business_expense': {
      const payee = merchant ?? textValue(input.payee) ?? textValue(input.label);
      if (amount && payee) return `Log ${amount} paid to ${payee}.`;
      break;
    }
    case 'log_business_income': {
      const source = textValue(input.source) ?? merchant ?? textValue(input.payer);
      if (amount && source) return `Log ${amount} received from ${source}.`;
      break;
    }
    case 'log_invoice_sent': {
      const client = textValue(input.client) ?? textValue(input.clientName);
      if (amount && client) return `Record a ${amount} invoice sent to ${client}.`;
      break;
    }
    case 'log_invoice_paid': {
      const invoice =
        textValue(input.invoice) ?? textValue(input.reference) ?? textValue(input.client);
      if (invoice) return `Record payment for ${invoice}.`;
      break;
    }
    case 'log_owner_draw':
      if (amount) return `Record an owner draw of ${amount}.`;
      break;
    case 'log_dividend': {
      const shareholder = textValue(input.shareholder) ?? textValue(input.recipient);
      if (amount && shareholder) return `Record a ${amount} dividend for ${shareholder}.`;
      if (amount) return `Record a ${amount} dividend.`;
      break;
    }
    default:
      break;
  }

  return 'Review this suggested change.';
}

function formatAmount(value: unknown): string | undefined {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? `£${amount.toFixed(2)}` : undefined;
}

function textValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
