import { describe, expect, it } from 'vitest';

import {
  syntheticBeforePaydayProjectionFixture,
  syntheticDataNotice,
  syntheticStatementCsvFixture,
} from '../src/index.js';

describe('synthetic contract fixtures', () => {
  it('keeps package fixtures fictional and deterministic', () => {
    expect(syntheticDataNotice).toContain('fictional');
    expect(syntheticStatementCsvFixture.text).toContain('Synthetic');
    expect(syntheticStatementCsvFixture.text).not.toMatch(/\b(real|private|customer)\b/i);
    expect(syntheticStatementCsvFixture.expectedRows.map((row) => row.amountMinor)).toEqual([
      -1234, 58500, -73500,
    ]);
  });

  it('describes before-payday projection expectations in minor units', () => {
    expect(syntheticBeforePaydayProjectionFixture.expected).toEqual({
      availableBeforeNextIncomeMinor: 7000,
      minimumBeforeNextIncomeMinor: 17000,
      closingOnNextIncomeDateMinor: 75500,
      excludedIds: ['synthetic_overtime'],
    });
  });
});
