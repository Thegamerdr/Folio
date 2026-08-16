import { describe, expect, it } from 'vitest';

import {
  BUSINESS_BETA_BLOCKER_ID,
  evaluateBusinessBetaExposure,
  parseBusinessBetaFlag,
} from './check-business-beta-exposure.mjs';

const blocker = (status) => ({ id: BUSINESS_BETA_BLOCKER_ID, status });

describe('business beta release gate', () => {
  it('only enables on the trimmed, exact lowercase value true', () => {
    expect(parseBusinessBetaFlag('true')).toBe(true);
    expect(parseBusinessBetaFlag(' true ')).toBe(true);
    for (const value of ['True', 'TRUE', 'yes', '1', '', 'false', true, undefined]) {
      expect(parseBusinessBetaFlag(value)).toBe(false);
    }
  });

  it('passes immediately while exposure is disabled', () => {
    expect(evaluateBusinessBetaExposure(false, undefined)).toEqual({
      allowed: true,
      state: 'disabled',
      message: 'Business beta exposure is disabled.',
    });
  });

  it('allows the one exact blocker only after it is closed', () => {
    expect(evaluateBusinessBetaExposure(true, { blockers: [blocker('closed')] })).toMatchObject({
      allowed: true,
      state: 'closed',
    });
  });

  it.each(['blocked', 'needs_evidence'])('rejects the blocker status %s', (status) => {
    expect(evaluateBusinessBetaExposure(true, { blockers: [blocker(status)] })).toMatchObject({
      allowed: false,
      state: status,
    });
  });

  it('rejects a missing, duplicated, or malformed blocker', () => {
    expect(evaluateBusinessBetaExposure(true, { blockers: [] })).toMatchObject({
      allowed: false,
      state: 'missing',
    });
    expect(
      evaluateBusinessBetaExposure(true, { blockers: [blocker('closed'), blocker('closed')] }),
    ).toMatchObject({ allowed: false, state: 'duplicated' });
    expect(evaluateBusinessBetaExposure(true, undefined)).toMatchObject({
      allowed: false,
      state: 'malformed',
    });
    expect(evaluateBusinessBetaExposure(true, { blockers: [blocker('')] })).toMatchObject({
      allowed: false,
      state: 'malformed',
    });
  });
});
