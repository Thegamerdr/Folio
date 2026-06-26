import { describe, expect, it } from 'vitest';

import { buildLocalRouteSummary, createEmptyLocalLedgerState } from './localLedger.js';
import {
  buildLocalPurchaseScenarioPreview,
  buildLocalRecoverySpendScenarioPreview,
} from './localScenarioAdapter.js';

describe('local scenario adapter', () => {
  it('creates a hypothetical purchase scenario without mutating local reality', () => {
    const ledger = {
      ...createEmptyLocalLedgerState('2026-06-22'),
      cashOnHandMinor: 50_000,
    };
    const route = buildLocalRouteSummary(ledger);
    const preview = buildLocalPurchaseScenarioPreview(ledger, route, 120);
    const serialized = JSON.stringify(preview);

    expect(preview.scenario).toMatchObject({
      authorityState: 'hypothetical',
      status: 'previewed',
      title: 'Test purchase',
      workspaceId: expect.stringMatching(/^workspace_/),
    });
    expect(preview.writesImmediately).toBe(false);
    expect(preview.confirmationRequired).toBe(true);
    expect(preview.realityTransactionCount).toBe(0);
    expect(ledger.transactions).toEqual([]);
    expect(preview.previewRoute.availableNowMinor).toBe(38_000);
    expect(preview.previewRoute.timeline[0]).toMatchObject({
      amountMinor: -12_000,
      detail: 'Preview only - not saved',
      title: 'Test purchase',
      tone: 'estimated',
    });
    expect(serialized).not.toMatch(/\bconfidence\b|confidence_|_confidence|\bscore\b/i);
  });

  it('creates a recovery spend preview as a scenario before the user records anything', () => {
    const ledger = {
      ...createEmptyLocalLedgerState('2026-06-22'),
      cashOnHandMinor: 5_000,
    };
    const route = buildLocalRouteSummary(ledger);
    const preview = buildLocalRecoverySpendScenarioPreview(ledger, route, {
      amountMinor: 8_000,
      label: 'Repair',
    });

    expect(preview.scenario.id).toMatch(/^scenario_/);
    expect(preview.scenario.authorityState).toBe('hypothetical');
    expect(preview.impact).toMatchObject({
      remainingMinor: -3_000,
      tightestPoint: 'Short by \u00a330',
      tone: 'attention',
    });
    expect(preview.previewRoute.lastActionLabel).toBe('Repair preview. Nothing saved yet.');
    expect(preview.realityTransactionCount).toBe(0);
  });
});
