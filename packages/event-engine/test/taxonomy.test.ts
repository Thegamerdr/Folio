import { describe, expect, it } from 'vitest';

import {
  deriveEventSeverity,
  getEventTypeDefinition,
  validateEventTaxonomy,
} from '../src/index.js';

describe('event taxonomy validation', () => {
  it('applies default certainty for known event types', () => {
    expect(
      validateEventTaxonomy({
        type: 'bill.due',
        source: 'user',
        workspaceKind: 'personal',
      }),
    ).toMatchObject({
      type: 'bill.due',
      group: 'obligation',
      certainty: 'expected',
      severity: 'normal',
    });
  });

  it('rejects unknown types and invalid constrained sources', () => {
    expect(getEventTypeDefinition('debt.payment_due')).toMatchObject({
      group: 'debt',
      defaultCertainty: 'expected',
    });
    expect(() =>
      validateEventTaxonomy({
        type: 'unknown.event',
        source: 'user',
        workspaceKind: 'personal',
      }),
    ).toThrow(/Unknown event type/);
    expect(() =>
      validateEventTaxonomy({
        type: 'income.received',
        source: 'user',
        workspaceKind: 'personal',
      }),
    ).toThrow(/not allowed/);
  });

  it('blocks business-only events in personal workspaces', () => {
    expect(() =>
      validateEventTaxonomy({
        type: 'tax.deadline',
        source: 'user',
        workspaceKind: 'personal',
      }),
    ).toThrow(/business workspace/);

    expect(
      validateEventTaxonomy({
        type: 'tax.deadline',
        source: 'user',
        workspaceKind: 'business',
        daysUntil: 5,
      }),
    ).toMatchObject({ group: 'business', severity: 'important' });
  });

  it('derives severity from taxonomy severity rules', () => {
    expect(deriveEventSeverity({ type: 'bill.missed', priorityClass: 'essential' })).toBe(
      'critical',
    );
    expect(deriveEventSeverity({ type: 'plan.projected_date_changed' })).toBe('normal');
  });
});
