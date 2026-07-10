// Pure entitlement-record logic tests. Mirrors the Node-safe testing boundary persist.test.ts
// uses: only ./entitlementsLogic is imported here (no expo-file-system), exactly like
// persist.test.ts only imports the store's pure blob helpers, not persist.ts itself.

import { describe, expect, it } from 'vitest';

import {
  isEntitlementActive,
  parseEntitlement,
  serializeEntitlement,
  type EntitlementRecord,
} from './entitlementsLogic';

describe('entitlement record round-trip', () => {
  it('serializes then parses a preview-tier record faithfully', () => {
    const record: EntitlementRecord = { source: 'preview', tier: 'full' };
    const blob = serializeEntitlement(record);
    expect(parseEntitlement(blob)).toEqual(record);
  });

  it('serializes then parses a store-tier record with an expiry faithfully', () => {
    const record: EntitlementRecord = {
      source: 'store',
      tier: 'live',
      expiresAt: '2026-08-01T00:00:00.000Z',
    };
    const blob = serializeEntitlement(record);
    expect(parseEntitlement(blob)).toEqual(record);
  });

  it('still parses legacy plus/pro records from disk (grandfather rule reads them as-is)', () => {
    for (const tier of ['plus', 'pro'] as const) {
      const record: EntitlementRecord = { source: 'store', tier };
      expect(parseEntitlement(serializeEntitlement(record))).toEqual(record);
    }
  });

  it('serializes then parses "no entitlement" (null) faithfully', () => {
    const blob = serializeEntitlement(null);
    expect(parseEntitlement(blob)).toBeNull();
  });

  it('a missing/empty raw string parses to null, never throws', () => {
    expect(parseEntitlement(null)).toBeNull();
    expect(parseEntitlement('')).toBeNull();
  });

  it('a malformed blob is a safe no-op (parses to null, never throws)', () => {
    expect(parseEntitlement('}{ not json')).toBeNull();
  });

  it('a record missing required fields is rejected as null (defensive shape guard)', () => {
    expect(parseEntitlement(JSON.stringify({ v: 1, record: { tier: 'plus' } }))).toBeNull();
    expect(parseEntitlement(JSON.stringify({ v: 1, record: { source: 'store' } }))).toBeNull();
    expect(
      parseEntitlement(JSON.stringify({ v: 1, record: { source: 'bogus', tier: 'plus' } })),
    ).toBeNull();
  });
});

describe('isEntitlementActive', () => {
  const now = new Date('2026-07-05T12:00:00.000Z');

  it('is false when there is no record', () => {
    expect(isEntitlementActive(null, now)).toBe(false);
  });

  it('is true for a record with no expiresAt (preview/trial — governed elsewhere)', () => {
    expect(isEntitlementActive({ source: 'preview', tier: 'plus' }, now)).toBe(true);
  });

  it('is true for a store record whose expiry is still in the future', () => {
    const record: EntitlementRecord = {
      source: 'store',
      tier: 'pro',
      expiresAt: '2026-08-01T00:00:00.000Z',
    };
    expect(isEntitlementActive(record, now)).toBe(true);
  });

  it('is false for a store record whose expiry has passed', () => {
    const record: EntitlementRecord = {
      source: 'store',
      tier: 'pro',
      expiresAt: '2026-06-01T00:00:00.000Z',
    };
    expect(isEntitlementActive(record, now)).toBe(false);
  });

  it('fails open (true) on an unparsable expiresAt rather than punishing the user', () => {
    const record = { source: 'store', tier: 'plus', expiresAt: 'not-a-date' } as EntitlementRecord;
    expect(isEntitlementActive(record, now)).toBe(true);
  });
});
