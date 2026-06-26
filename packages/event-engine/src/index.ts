import type { WorkspaceKind } from '@folio/domain';

export const eventEngineBoundary = {
  packageName: '@folio/event-engine',
  deterministic: true,
  importsNativeOrUiRuntime: false,
} as const;

export type EventCertainty = 'confirmed' | 'expected' | 'inferred' | 'hypothetical';
export type EventSeverity = 'low' | 'normal' | 'important' | 'critical';
export type EventGroup = 'income' | 'obligation' | 'debt' | 'plan' | 'life' | 'business' | 'system';

export type EventTypeDefinition = Readonly<{
  key: string;
  group: EventGroup;
  defaultCertainty: EventCertainty;
  sources: readonly string[];
  businessOnly: boolean;
}>;

export type ValidatedEventTaxonomy = Readonly<{
  type: string;
  group: EventGroup;
  certainty: EventCertainty;
  source: string;
  severity: EventSeverity;
}>;

const eventTypeDefinitions = [
  definition('income', 'income.expected', 'expected', ['recurring_rule', 'user']),
  definition('income', 'income.received', 'confirmed', ['transaction', 'import', 'open_banking']),
  definition('income', 'income.changed', 'confirmed', ['user', 'transaction_pattern']),
  definition('income', 'income.missed', 'expected', ['system']),
  definition('income', 'refund.received', 'confirmed', ['transaction']),
  definition('obligation', 'bill.due', 'expected'),
  definition('obligation', 'bill.paid', 'confirmed'),
  definition('obligation', 'bill.amount_changed', 'confirmed'),
  definition('obligation', 'bill.missed', 'confirmed'),
  definition('obligation', 'renewal.upcoming', 'expected'),
  definition('obligation', 'subscription.changed', 'confirmed'),
  definition('debt', 'debt.payment_due', 'expected'),
  definition('debt', 'debt.payment_made', 'confirmed'),
  definition('debt', 'debt.balance_changed', 'confirmed'),
  definition('debt', 'debt.cleared', 'confirmed'),
  definition('debt', 'debt.rate_changed', 'confirmed'),
  definition('plan', 'plan.created', 'confirmed'),
  definition('plan', 'plan.milestone_reached', 'confirmed'),
  definition('plan', 'plan.projected_date_changed', 'expected'),
  definition('plan', 'plan.rebased', 'confirmed'),
  definition('plan', 'plan.completed', 'confirmed'),
  definition('plan', 'budget.period_started', 'confirmed'),
  definition('plan', 'budget.boundary_approaching', 'expected'),
  definition('life', 'unexpected.expense', 'confirmed'),
  definition('life', 'unexpected.income', 'confirmed'),
  definition('life', 'life.event', 'confirmed'),
  definition('life', 'work.shift', 'confirmed'),
  definition('life', 'overtime.expected', 'expected'),
  definition('life', 'overtime.confirmed', 'confirmed'),
  definition('business', 'invoice.issued', 'confirmed', [], true),
  definition('business', 'invoice.due', 'expected', [], true),
  definition('business', 'invoice.paid', 'confirmed', [], true),
  definition('business', 'invoice.overdue', 'confirmed', [], true),
  definition('business', 'tax.deadline', 'expected', [], true),
  definition('business', 'tax.exported', 'confirmed', [], true),
  definition('business', 'receipt.captured', 'confirmed', [], true),
  definition('system', 'import.completed', 'confirmed'),
  definition('system', 'import.needs_review', 'confirmed'),
  definition('system', 'sync.stale', 'confirmed'),
  definition('system', 'backup.verified', 'confirmed'),
  definition('system', 'document.added', 'confirmed'),
] as const;

export const eventTaxonomy = eventTypeDefinitions;

export function getEventTypeDefinition(type: string): EventTypeDefinition | undefined {
  return eventTypeDefinitions.find((definition) => definition.key === type);
}

export function validateEventTaxonomy(input: {
  type: string;
  source: string;
  workspaceKind: WorkspaceKind;
  certainty?: EventCertainty;
  priorityClass?: string;
  daysUntil?: number;
}): ValidatedEventTaxonomy {
  const type = input.type.trim();
  const source = input.source.trim();
  const match = getEventTypeDefinition(type);

  if (match === undefined) {
    throw new Error(`Unknown event type: ${input.type}`);
  }
  if (source.length === 0) {
    throw new Error('Event source is required.');
  }
  if (match.businessOnly && input.workspaceKind !== 'business') {
    throw new Error(`Event type ${type} is only valid in a business workspace.`);
  }
  if (match.sources.length > 0 && !match.sources.includes(source)) {
    throw new Error(`Source ${source} is not allowed for event type ${type}.`);
  }

  const severityInput: {
    type: string;
    priorityClass?: string;
    daysUntil?: number;
  } = { type };
  if (input.priorityClass !== undefined) severityInput.priorityClass = input.priorityClass;
  if (input.daysUntil !== undefined) severityInput.daysUntil = input.daysUntil;

  return {
    type,
    group: match.group,
    certainty: input.certainty ?? match.defaultCertainty,
    source,
    severity: deriveEventSeverity(severityInput),
  };
}

export function deriveEventSeverity(input: {
  type: string;
  priorityClass?: string;
  daysUntil?: number;
}): EventSeverity {
  if (input.type === 'bill.missed' && input.priorityClass === 'essential') {
    return 'critical';
  }
  if (input.type === 'tax.deadline' && input.daysUntil !== undefined && input.daysUntil <= 7) {
    return 'important';
  }
  if (input.type === 'plan.projected_date_changed') {
    return 'normal';
  }
  return 'normal';
}

function definition(
  group: EventGroup,
  key: string,
  defaultCertainty: EventCertainty,
  sources: readonly string[] = [],
  businessOnly = false,
): EventTypeDefinition {
  return { group, key, defaultCertainty, sources, businessOnly };
}
