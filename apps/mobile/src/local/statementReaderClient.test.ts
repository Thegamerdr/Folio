// Tests for the LLM statement/photo reader's PURE parser, `parseCandidatesFromModelJson`.
//
// We test ONLY the pure helper. It lives in ./statementReaderParse (no expo / file-system / network
// imports), so importing it here keeps Expo out of the Node test runner — we deliberately do NOT
// import the client module (statementReaderClient.ts), which pulls in expo-file-system.
//
// Coverage: well-formed JSON → candidates with correct sign + shape; ```json fences stripped;
// malformed → []; empty items → []. The reader output is candidates-only (review-before-truth):
// every produced candidate must carry the lowest confidence.

import { describe, expect, it } from 'vitest';

// Relative type import — the apps/**/*.test.ts runner has no `@` alias (mirrors store.test.ts /
// importSheet.test.ts). Type-only, so it is erased before runtime regardless.
import type { CandidateMoneyItem } from '../folio/lib/importSheet';

import { parseCandidatesFromModelJson, parseStatementReaderResult } from './statementReaderParse';

const byMerchant = (
  cands: readonly CandidateMoneyItem[],
  m: string,
): CandidateMoneyItem | undefined => cands.find((c) => c.merchant === m);

describe('parseCandidatesFromModelJson — well-formed JSON', () => {
  const raw = JSON.stringify({
    items: [
      { date: '2026-06-20', merchant: 'Tesco', amount: -42.1, category: 'Groceries' },
      { date: '2026-06-25', merchant: 'Salary', amount: 2180, category: 'Income' },
      { date: null, merchant: 'Pret', amount: -4.2, category: null },
    ],
  });

  it('produces one candidate per item', () => {
    const candidates = parseCandidatesFromModelJson(raw, 'pdf');
    expect(candidates.length).toBe(3);
  });

  it('keeps the model sign: spend negative, income positive', () => {
    const candidates = parseCandidatesFromModelJson(raw, 'pdf');
    expect(byMerchant(candidates, 'Tesco')?.amount).toBe(-42.1);
    expect(byMerchant(candidates, 'Salary')?.amount).toBe(2180);
  });

  it('infers kind from the sign', () => {
    const candidates = parseCandidatesFromModelJson(raw, 'pdf');
    expect(byMerchant(candidates, 'Tesco')?.kind).toBe('spend');
    expect(byMerchant(candidates, 'Salary')?.kind).toBe('income');
  });

  it('stamps the passed source and the lowest (must-review) confidence on every candidate', () => {
    const candidates = parseCandidatesFromModelJson(raw, 'pdf');
    expect(candidates.every((c) => c.source === 'pdf')).toBe(true);
    expect(candidates.every((c) => c.confidence === 'low')).toBe(true);
  });

  it('carries a date when present and omits it when the model returned null', () => {
    const candidates = parseCandidatesFromModelJson(raw, 'pdf');
    expect(byMerchant(candidates, 'Tesco')?.date).toBe('2026-06-20');
    // exactOptionalPropertyTypes ON: an absent date is OMITTED, never set to undefined.
    const pret = byMerchant(candidates, 'Pret');
    expect(pret?.date).toBeUndefined();
    expect(pret !== undefined && 'date' in pret).toBe(false);
  });

  it('carries a category when present and omits it when null', () => {
    const candidates = parseCandidatesFromModelJson(raw, 'pdf');
    expect(byMerchant(candidates, 'Tesco')?.category).toBe('Groceries');
    expect(byMerchant(candidates, 'Pret')?.category).toBeUndefined();
  });

  it('writes an honest provenance note reflecting the source', () => {
    expect(byMerchant(parseCandidatesFromModelJson(raw, 'pdf'), 'Tesco')?.note).toBe(
      'read from your statement',
    );
    expect(byMerchant(parseCandidatesFromModelJson(raw, 'photo'), 'Tesco')?.note).toBe(
      'read from your photo',
    );
  });

  it('uses the passed photo source for a photographed statement', () => {
    const candidates = parseCandidatesFromModelJson(raw, 'photo');
    expect(candidates.every((c) => c.source === 'photo')).toBe(true);
  });

  it('gives every candidate a non-empty id', () => {
    const candidates = parseCandidatesFromModelJson(raw, 'pdf');
    expect(candidates.every((c) => c.id.length > 0)).toBe(true);
  });

  it('is deterministic — re-parsing the same reply yields the same ids', () => {
    const a = parseCandidatesFromModelJson(raw, 'pdf').map((c) => c.id);
    const b = parseCandidatesFromModelJson(raw, 'pdf').map((c) => c.id);
    expect(a).toEqual(b);
  });
});

describe('parseCandidatesFromModelJson — markdown code fences', () => {
  it('strips a ```json … ``` fence before parsing', () => {
    const fenced =
      '```json\n' + JSON.stringify({ items: [{ merchant: 'Uber', amount: -14.3 }] }) + '\n```';
    const candidates = parseCandidatesFromModelJson(fenced, 'photo');
    expect(candidates.length).toBe(1);
    expect(candidates[0]?.merchant).toBe('Uber');
    expect(candidates[0]?.amount).toBe(-14.3);
  });

  it('strips a bare ``` … ``` fence', () => {
    const fenced =
      '```\n' + JSON.stringify({ items: [{ merchant: 'Coffee', amount: -3.2 }] }) + '\n```';
    const candidates = parseCandidatesFromModelJson(fenced, 'pdf');
    expect(candidates.length).toBe(1);
    expect(candidates[0]?.merchant).toBe('Coffee');
  });
});

describe('parseCandidatesFromModelJson — degenerate input', () => {
  it('returns [] for malformed JSON', () => {
    expect(parseCandidatesFromModelJson('not json at all', 'pdf')).toEqual([]);
    expect(parseCandidatesFromModelJson('{ "items": [ ', 'pdf')).toEqual([]);
  });

  it('returns [] when items is an empty array', () => {
    expect(parseCandidatesFromModelJson(JSON.stringify({ items: [] }), 'pdf')).toEqual([]);
  });

  it('returns [] when items is missing or not an array', () => {
    expect(parseCandidatesFromModelJson(JSON.stringify({}), 'pdf')).toEqual([]);
    expect(parseCandidatesFromModelJson(JSON.stringify({ items: 'nope' }), 'pdf')).toEqual([]);
  });

  it('returns [] for a top-level array (must be the { items } object)', () => {
    expect(
      parseCandidatesFromModelJson(JSON.stringify([{ merchant: 'X', amount: -1 }]), 'pdf'),
    ).toEqual([]);
  });

  it('drops bad items but keeps the good ones — never fabricates a row', () => {
    const raw = JSON.stringify({
      items: [
        { merchant: 'Tesco', amount: -42.1 }, // good
        { merchant: '', amount: -5 }, // empty merchant → dropped
        { merchant: 'Zero', amount: 0 }, // zero amount → dropped (not a movement)
        { merchant: 'NoAmount' }, // missing amount → dropped
        { merchant: 'BadAmount', amount: 'ten' }, // non-number → dropped
      ],
    });
    const candidates = parseCandidatesFromModelJson(raw, 'pdf');
    expect(candidates.map((c) => c.merchant)).toEqual(['Tesco']);
  });
});

// ---------------------------------------------------------------------------
// parseStatementReaderResult — closing balance (task: READER CLOSING BALANCE).
//
// Live gateway confirmation (2026-07-06, google/gemini-2.5-flash via the deployed Cloudflare Worker
// gateway, against .claude-session/monzo-small.pdf, extended SYSTEM_PROMPT): the model reliably
// returned `"closingBalance": 1.96, "closingDate": "2021-03-31"` across two independent live runs —
// see statementReaderClient.ts's SYSTEM_PROMPT doc comment for the full note. These tests cover the
// pure parser's handling of that field pair without hitting the network.
// ---------------------------------------------------------------------------
describe('parseStatementReaderResult — closing balance', () => {
  it('parses the confirmed live-gateway shape (Monzo small statement, 2026-07-06)', () => {
    const raw = JSON.stringify({
      items: [
        { date: '2021-03-03', merchant: 'FPS, Andrea Nsiah', amount: 30, category: 'Transfer' },
      ],
      closingBalance: 1.96,
      closingDate: '2021-03-31',
    });
    const result = parseStatementReaderResult(raw, 'pdf');
    expect(result.candidates.length).toBe(1);
    expect(result.closingBalance).toEqual({ amount: 1.96, asOfISO: '2021-03-31' });
  });

  it('returns closingBalance: null when the model omits both fields', () => {
    const raw = JSON.stringify({ items: [{ merchant: 'Tesco', amount: -10 }] });
    expect(parseStatementReaderResult(raw, 'pdf').closingBalance).toBeNull();
  });

  it('returns closingBalance: null when the model explicitly returns null for both', () => {
    const raw = JSON.stringify({ items: [], closingBalance: null, closingDate: null });
    expect(parseStatementReaderResult(raw, 'pdf').closingBalance).toBeNull();
  });

  it('never fabricates a balance when only one of the pair is present', () => {
    const balanceOnly = JSON.stringify({ items: [], closingBalance: 42, closingDate: null });
    expect(parseStatementReaderResult(balanceOnly, 'pdf').closingBalance).toBeNull();

    const dateOnly = JSON.stringify({ items: [], closingBalance: null, closingDate: '2026-03-31' });
    expect(parseStatementReaderResult(dateOnly, 'pdf').closingBalance).toBeNull();
  });

  it('rejects a non-numeric closingBalance and an unparseable closingDate', () => {
    const badAmount = JSON.stringify({
      items: [],
      closingBalance: 'lots',
      closingDate: '2026-03-31',
    });
    expect(parseStatementReaderResult(badAmount, 'pdf').closingBalance).toBeNull();

    const badDate = JSON.stringify({ items: [], closingBalance: 1.96, closingDate: 'not-a-date' });
    expect(parseStatementReaderResult(badDate, 'pdf').closingBalance).toBeNull();
  });

  it('items are unaffected by the presence or absence of a closing balance', () => {
    const withBalance = parseStatementReaderResult(
      JSON.stringify({
        items: [{ merchant: 'Tesco', amount: -10 }],
        closingBalance: 1.96,
        closingDate: '2021-03-31',
      }),
      'pdf',
    ).candidates;
    const withoutBalance = parseStatementReaderResult(
      JSON.stringify({ items: [{ merchant: 'Tesco', amount: -10 }] }),
      'pdf',
    ).candidates;
    expect(withBalance.map((c) => ({ merchant: c.merchant, amount: c.amount }))).toEqual(
      withoutBalance.map((c) => ({ merchant: c.merchant, amount: c.amount })),
    );
  });

  it('malformed JSON yields no candidates and no closing balance', () => {
    const result = parseStatementReaderResult('not json', 'pdf');
    expect(result.candidates).toEqual([]);
    expect(result.closingBalance).toBeNull();
  });
});
