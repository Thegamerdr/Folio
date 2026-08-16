import { describe, expect, it } from 'vitest';

import { isUnsupportedProductConfidenceLine } from './scripts/product-canonical-confidence.mjs';

describe('product canonical confidence gate', () => {
  it('rejects aggregate confidence from the trusted contract', () => {
    expect(
      isUnsupportedProductConfidenceLine(
        'packages/domain/src/trustedCore.ts',
        "export const trustedCoreConfidenceLevels = ['high', 'medium', 'low'];",
      ),
    ).toBe(true);
    expect(
      isUnsupportedProductConfidenceLine(
        'packages/domain/src/trustedCore.ts',
        "priority: 'cashflow_confidence',",
      ),
    ).toBe(true);
  });

  it('rejects confidence claims rendered by shipping financial UI', () => {
    expect(
      isUnsupportedProductConfidenceLine(
        'apps/mobile/src/folio/screens/TodayScreen.tsx',
        '<Text>high confidence</Text>',
      ),
    ).toBe(true);
    expect(
      isUnsupportedProductConfidenceLine(
        'apps/mobile/src/folio/screens/TodayScreen.tsx',
        '<Text>{result.confidence}</Text>',
      ),
    ).toBe(true);
  });

  it('allows candidate source quality used to force import review', () => {
    expect(
      isUnsupportedProductConfidenceLine(
        'apps/mobile/src/folio/lib/importSheet.ts',
        "const candidate: CandidateMoneyItem = { confidence: 'low' };",
      ),
    ).toBe(false);
    expect(
      isUnsupportedProductConfidenceLine(
        'apps/mobile/src/folio/store.ts',
        "const balance: CurrentBalance = { confidence: 'rough' };",
      ),
    ).toBe(false);
  });
});
