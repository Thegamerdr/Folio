import { describe, expect, it } from 'vitest';

import {
  addMoney,
  createCurrencyCode,
  createMoney,
  createWorkspaceId,
  negateMoney,
  subtractMoney,
  sumMoney,
} from '../src/index.js';

describe('Money value object', () => {
  it('stores money as integer minor units with explicit currency', () => {
    expect(createMoney({ minorUnits: 12345, currency: 'gbp' })).toEqual({
      minorUnits: 12345,
      currency: createCurrencyCode('GBP'),
    });
  });

  it('rejects fractional or unsafe money amounts', () => {
    expect(() => createMoney({ minorUnits: 12.34, currency: 'GBP' })).toThrow(/safe integer/);
    expect(() => createMoney({ minorUnits: Number.MAX_SAFE_INTEGER + 1, currency: 'GBP' })).toThrow(
      /safe integer/,
    );
  });

  it('performs safe integer arithmetic and catches overflow', () => {
    const pounds = createCurrencyCode('GBP');

    expect(
      addMoney(
        createMoney({ minorUnits: 1200, currency: pounds }),
        createMoney({ minorUnits: 300, currency: pounds }),
      ),
    ).toEqual(createMoney({ minorUnits: 1500, currency: pounds }));
    expect(
      subtractMoney(
        createMoney({ minorUnits: 1200, currency: pounds }),
        createMoney({ minorUnits: 300, currency: pounds }),
      ),
    ).toEqual(createMoney({ minorUnits: 900, currency: pounds }));
    expect(negateMoney(createMoney({ minorUnits: 450, currency: pounds }))).toEqual(
      createMoney({ minorUnits: -450, currency: pounds }),
    );
    expect(
      sumMoney(
        [
          createMoney({ minorUnits: 100, currency: pounds }),
          createMoney({ minorUnits: 200, currency: pounds }),
        ],
        pounds,
      ),
    ).toEqual(createMoney({ minorUnits: 300, currency: pounds }));

    expect(() =>
      addMoney(
        createMoney({ minorUnits: Number.MAX_SAFE_INTEGER, currency: pounds }),
        createMoney({ minorUnits: 1, currency: pounds }),
      ),
    ).toThrow(/safe integer/);
  });

  it('rejects cross-currency arithmetic', () => {
    const pounds = createMoney({ minorUnits: 100, currency: 'GBP' });
    const euros = createMoney({ minorUnits: 100, currency: 'EUR' });

    expect(() => addMoney(pounds, euros)).toThrow(/Currency mismatch/);
    expect(() => subtractMoney(pounds, euros)).toThrow(/Currency mismatch/);
  });

  it('creates stable internal workspace IDs', () => {
    expect(createWorkspaceId('workspace_personal_demo')).toBe('workspace_personal_demo');
    expect(() => createWorkspaceId('personal')).toThrow(/workspace_/);
  });
});
