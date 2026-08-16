import { describe, expect, it } from 'vitest';

import {
  buildRedactedDogfoodDiagnosticBundle,
  createDogfoodResetState,
  createDogfoodScenarioSeeds,
  dogfoodModeContract,
  findDogfoodScenarioSeed,
} from './dogfoodMode.js';
import { buildLocalRouteSummary } from './localLedger.js';

const AS_OF = '2026-06-23';

describe('owner dogfood safety boundary', () => {
  it('does not add an upload path or require a remote service', () => {
    expect(dogfoodModeContract).toMatchObject({
      localOnly: true,
      uploadAllowed: false,
      requiresAccount: false,
      requiresAi: false,
      requiresCloud: false,
      requiresOpenBanking: false,
    });
  });

  it('keeps every scenario synthetic and resets to a genuinely empty ledger', () => {
    const seeds = createDogfoodScenarioSeeds(AS_OF);
    const reset = createDogfoodResetState(AS_OF);

    expect(dogfoodModeContract.syntheticSeedsOnly).toBe(true);
    expect(seeds.length).toBeGreaterThan(0);
    expect(seeds.every((seed) => seed.synthetic)).toBe(true);
    expect(reset.transactions).toEqual([]);
    expect(reset.importDrafts).toEqual([]);
    expect(reset.documentStages).toEqual([]);
    expect(reset.history).toEqual([]);
  });

  it('exports redacted diagnostics by default without financial rows or source text', () => {
    const seed = findDogfoodScenarioSeed(createDogfoodScenarioSeeds(AS_OF), 'minimal_manual_user');
    const firstTransaction = seed.state.transactions[0];
    expect(firstTransaction).toBeDefined();

    const bundle = buildRedactedDogfoodDiagnosticBundle({
      currentScreen: 'today',
      dogfoodModeEnabled: true,
      route: buildLocalRouteSummary(seed.state),
      state: seed.state,
    });
    const serialized = JSON.stringify(bundle.redacted);

    expect(bundle.safeForExport).toBe(true);
    expect(serialized).toContain('"rawFinancialRowsIncluded":false');
    expect(serialized).toContain('"rawSourceTextIncluded":false');
    expect(serialized).not.toContain(firstTransaction?.title ?? 'missing-title');
    expect(serialized).not.toContain(String(firstTransaction?.amountMinor ?? 'missing-amount'));
    expect(bundle.markdown).toContain(
      'Raw financial rows, source text, account details and personal identifiers are not included.',
    );
  });
});
