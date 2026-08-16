// AI-read allowance tests — pure logic (readAllowance.ts) plus the store's counter/cache
// mutators (recordAiRead / cacheAiRead / getCachedAiRead — the store is Node-safe, same style as
// entitlements.test.ts exercising it directly).

import { beforeEach, describe, expect, it } from 'vitest';

import {
  allowanceFor,
  canReadNow,
  monthKeyOf,
  READ_ALLOWANCE,
  READ_CACHE_MAX_CANDIDATES,
  READ_CACHE_MAX_ENTRIES,
  readCacheEvictions,
  readsLeft,
  readsUsed,
  statementCacheKey,
} from './readAllowance';
import {
  cacheAiRead,
  getCachedAiRead,
  getState,
  recordAiRead,
  resetAll,
  type AiReadCacheEntry,
} from '../../store';
import type { CandidateMoneyItem } from '../importSheet';
import { PERSONAL_WORKSPACE_ID } from '../workspaceRoot';

const JULY = '2026-07';
const AUGUST = '2026-08';

describe('allowanceFor', () => {
  it('gives Free and Plus their finite monthly allowances', () => {
    expect(allowanceFor('free')).toBe(READ_ALLOWANCE.free);
    expect(allowanceFor('plus')).toBe(READ_ALLOWANCE.plus);
  });

  it('gives Pro unlimited (null)', () => {
    expect(allowanceFor('pro')).toBeNull();
  });

  it('Plus allows strictly more than Free (quantity is the tier difference, never quality)', () => {
    expect(READ_ALLOWANCE.plus).toBeGreaterThan(READ_ALLOWANCE.free);
  });
});

describe('monthKeyOf', () => {
  it('formats a calendar-month key with a zero-padded month', () => {
    expect(monthKeyOf(new Date(2026, 6, 10))).toBe('2026-07');
    expect(monthKeyOf(new Date(2026, 10, 1))).toBe('2026-11');
  });
});

describe('readsUsed / readsLeft / canReadNow — lazy monthly reset', () => {
  it('reads as 0 used when no counter exists yet', () => {
    expect(readsUsed(undefined, JULY)).toBe(0);
    expect(readsLeft(undefined, 'free', JULY)).toBe(READ_ALLOWANCE.free);
    expect(canReadNow(undefined, 'free', JULY)).toBe(true);
  });

  it('counts within the current month', () => {
    const state = { monthKey: JULY, used: 2 };
    expect(readsUsed(state, JULY)).toBe(2);
    expect(readsLeft(state, 'free', JULY)).toBe(READ_ALLOWANCE.free - 2);
  });

  it('a counter from an earlier month reads as 0 — the new month starts fresh', () => {
    const state = { monthKey: JULY, used: READ_ALLOWANCE.free };
    expect(readsUsed(state, AUGUST)).toBe(0);
    expect(canReadNow(state, 'free', AUGUST)).toBe(true);
  });

  it('blocks a new read once the allowance is spent, never going negative', () => {
    const state = { monthKey: JULY, used: READ_ALLOWANCE.free + 5 };
    expect(readsLeft(state, 'free', JULY)).toBe(0);
    expect(canReadNow(state, 'free', JULY)).toBe(false);
  });

  it('never blocks Pro — unlimited means unlimited', () => {
    const state = { monthKey: JULY, used: 10_000 };
    expect(readsLeft(state, 'pro', JULY)).toBeNull();
    expect(canReadNow(state, 'pro', JULY)).toBe(true);
  });

  it('the sentinel empty monthKey (first run) reads as 0 used', () => {
    expect(readsUsed({ monthKey: '', used: 0 }, JULY)).toBe(0);
  });
});

describe('statementCacheKey', () => {
  it('is deterministic for identical content', () => {
    const payload = 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoK'.repeat(50);
    expect(statementCacheKey(payload)).toBe(statementCacheKey(payload));
  });

  it('differs for different content, including single-character changes', () => {
    const a = 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoK'.repeat(50);
    const b = `${a.slice(0, -1)}L`;
    expect(statementCacheKey(a)).not.toBe(statementCacheKey(b));
  });

  it('differs for same-prefix content of different lengths', () => {
    const a = 'AAAA'.repeat(100);
    expect(statementCacheKey(a)).not.toBe(statementCacheKey(a + 'AAAA'));
  });
});

describe('readCacheEvictions', () => {
  it('drops nothing while there is room for one more', () => {
    expect(readCacheEvictions({ a: { at: '2026-07-01' } }, 4)).toEqual([]);
  });

  it('drops the OLDEST entries to make room for one more', () => {
    const entries = {
      newest: { at: '2026-07-09' },
      middle: { at: '2026-07-05' },
      oldest: { at: '2026-07-01' },
      older: { at: '2026-07-02' },
    };
    expect(readCacheEvictions(entries, 4)).toEqual(['oldest']);
  });
});

describe('store — recordAiRead / cacheAiRead / getCachedAiRead', () => {
  beforeEach(() => {
    resetAll();
  });

  it('records reads within a month and rolls over to 1 on a new month', () => {
    recordAiRead(PERSONAL_WORKSPACE_ID, JULY);
    recordAiRead(PERSONAL_WORKSPACE_ID, JULY);
    expect(getState().aiReads).toEqual({ monthKey: JULY, used: 2 });

    recordAiRead(PERSONAL_WORKSPACE_ID, AUGUST);
    expect(getState().aiReads).toEqual({ monthKey: AUGUST, used: 1 });
  });

  it('caches and retrieves a read by key', () => {
    const entry = makeEntry('2026-07-01T00:00:00.000Z', 2);
    cacheAiRead(PERSONAL_WORKSPACE_ID, 'key-1', entry);
    expect(getCachedAiRead(PERSONAL_WORKSPACE_ID, 'key-1')).toEqual(entry);
    expect(getCachedAiRead(PERSONAL_WORKSPACE_ID, 'missing')).toBeNull();
  });

  it('evicts the oldest entry once the cache is full', () => {
    for (let i = 0; i < READ_CACHE_MAX_ENTRIES; i++) {
      cacheAiRead(
        PERSONAL_WORKSPACE_ID,
        `key-${i}`,
        makeEntry(`2026-07-0${i + 1}T00:00:00.000Z`, 1),
      );
    }
    cacheAiRead(PERSONAL_WORKSPACE_ID, 'key-new', makeEntry('2026-07-09T00:00:00.000Z', 1));

    expect(getCachedAiRead(PERSONAL_WORKSPACE_ID, 'key-0')).toBeNull(); // oldest evicted
    expect(getCachedAiRead(PERSONAL_WORKSPACE_ID, 'key-new')).not.toBeNull();
    expect(Object.keys(getState().aiReadCache ?? {}).length).toBe(READ_CACHE_MAX_ENTRIES);
  });

  it('refuses to cache an oversized read rather than bloating the persist blob', () => {
    cacheAiRead(
      PERSONAL_WORKSPACE_ID,
      'huge',
      makeEntry('2026-07-01T00:00:00.000Z', READ_CACHE_MAX_CANDIDATES + 1),
    );
    expect(getCachedAiRead(PERSONAL_WORKSPACE_ID, 'huge')).toBeNull();
  });

  it('rejects cache reads and writes for an unprovisioned workspace', () => {
    const business = 'workspace_business_injected' as typeof PERSONAL_WORKSPACE_ID;
    expect(() => getCachedAiRead(business, 'key')).toThrow(/unavailable/i);
    expect(() => cacheAiRead(business, 'key', makeEntry('2026-07-01T00:00:00.000Z', 1))).toThrow(
      /unavailable/i,
    );
  });
});

function makeEntry(at: string, candidateCount: number): AiReadCacheEntry {
  const candidates: CandidateMoneyItem[] = Array.from({ length: candidateCount }, (_, i) => ({
    id: `cand-${i}`,
    source: 'pdf',
    kind: 'spend',
    merchant: `Merchant ${i}`,
    amount: -1 - i,
    date: '2026-07-01',
    confidence: 'low',
  }));
  return { candidates, closingBalance: null, at };
}
