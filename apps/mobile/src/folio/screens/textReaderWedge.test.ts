// TEXT-READER WEDGE — the paste/CSV → candidate contract the Paste/Visualizer screens now render.
//
// PasteSuccessScreen.tsx and VisualizerScreen.tsx no longer hold hand-built candidate arrays: their
// found lists are produced by the real pure `parseSheet` engine (apps/mobile/src/folio/lib/
// importSheet.ts, ENGINES.md §6) over the screen's existing sample rows, restated faithfully as
// spreadsheet text. This test pins THAT wiring — the exact sample texts the screens feed the engine
// must parse to the exact rows they render (same merchants, signs, magnitudes, order), with zero
// issues, and the engine must never auto-count (candidates only). The screen `.tsx` files import
// react-native, so they cannot be loaded by this Node runner (vitest collects apps/**/*.test.ts);
// the sample texts are reproduced here verbatim — drift between the screen and this fixture is the
// thing the test is meant to catch, the same shape as store.test.ts / importSheet.test.ts.

import { describe, expect, it } from 'vitest';

import { parseSheet, type CandidateMoneyItem, type ColumnIssue } from '../lib/importSheet';

const byMerchant = (
  cands: readonly CandidateMoneyItem[],
  m: string,
): CandidateMoneyItem | undefined => cands.find((c) => c.merchant === m);

const issueCodes = (issues: readonly ColumnIssue[]): string[] => issues.map((i) => i.code);

// ---------------------------------------------------------------------------
// PasteSuccessScreen — the web source's exact three pasted rows (tab-separated,
// header auto-detected, type column signs each amount). Mirrors SAMPLE_PASTE_TEXT.
// ---------------------------------------------------------------------------
describe('PasteSuccessScreen sample text → engine candidates', () => {
  const PASTE_TEXT = [
    'date\tmerchant\tamount\ttype',
    '2026-06-26\tTesco\t42\tspend',
    '2026-06-25\tSalary\t1200\tincome',
    '2026-07-01\tRent\t750\tspend',
  ].join('\n');

  // The bare-GBP magnitude formatter the screen renders (whole pounds grouped, pence only when
  // present): 42 → "£42", 1200 → "£1,200", 750 → "£750".
  const formatMagnitude = (amount: number): string => {
    const magnitude = Math.abs(amount);
    const grouped = magnitude.toLocaleString('en-GB', {
      minimumFractionDigits: Number.isInteger(magnitude) ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return `£${grouped}`;
  };

  it('parses the three rows cleanly with no issues, in order', () => {
    const { candidates, issues } = parseSheet(PASTE_TEXT, { source: 'paste' });
    expect(issues).toHaveLength(0);
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.merchant)).toEqual(['Tesco', 'Salary', 'Rent']);
  });

  it('signs each amount from the type column (spend negative, income positive)', () => {
    const { candidates } = parseSheet(PASTE_TEXT, { source: 'paste' });
    expect(byMerchant(candidates, 'Tesco')?.amount).toBe(-42);
    expect(byMerchant(candidates, 'Salary')?.amount).toBe(1200);
    expect(byMerchant(candidates, 'Rent')?.amount).toBe(-750);
  });

  it('reproduces the exact money-in / money-out flow the row renders', () => {
    const { candidates } = parseSheet(PASTE_TEXT, { source: 'paste' });
    const flow = (m: string): 'in' | 'out' =>
      (byMerchant(candidates, m)?.amount ?? 0) >= 0 ? 'in' : 'out';
    expect(flow('Tesco')).toBe('out');
    expect(flow('Salary')).toBe('in');
    expect(flow('Rent')).toBe('out');
  });

  it('reformats to the web’s exact preformatted magnitude strings', () => {
    const { candidates } = parseSheet(PASTE_TEXT, { source: 'paste' });
    expect(formatMagnitude(byMerchant(candidates, 'Tesco')!.amount)).toBe('£42');
    expect(formatMagnitude(byMerchant(candidates, 'Salary')!.amount)).toBe('£1,200');
    expect(formatMagnitude(byMerchant(candidates, 'Rent')!.amount)).toBe('£750');
  });

  it('tags candidates with the paste source (never auto-counted)', () => {
    const { candidates } = parseSheet(PASTE_TEXT, { source: 'paste' });
    expect(candidates.every((c) => c.source === 'paste')).toBe(true);
    expect(candidates.every((c) => ['high', 'medium', 'low'].includes(c.confidence))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// VisualizerScreen — the web source's exact eight rows (comma CSV, header auto-
// detected, amounts explicitly signed). Mirrors SAMPLE_CSV_TEXT.
// ---------------------------------------------------------------------------
describe('VisualizerScreen sample text → engine candidates', () => {
  const CSV_TEXT = [
    'date,merchant,amount',
    '2026-06-26,"Tesco",-42.00',
    '2026-06-25,"Salary — Whitstone Ltd",+2180.00',
    '2026-06-24,"Octopus Energy",-118.40',
    '2026-06-24,"Transfer to Sarah",-85.00',
    '2026-06-23,"Pret a Manger",-6.85',
    '2026-06-22,"Klarna",-31.50',
    '2026-06-22,"Spotify",-11.99',
    '2026-06-21,"Refund — ASOS",+28.50',
  ].join('\n');

  // The eight rows the screen renders, in order, with the signed amount it shows.
  const EXPECTED: ReadonlyArray<readonly [string, number]> = [
    ['Tesco', -42],
    ['Salary — Whitstone Ltd', 2180],
    ['Octopus Energy', -118.4],
    ['Transfer to Sarah', -85],
    ['Pret a Manger', -6.85],
    ['Klarna', -31.5],
    ['Spotify', -11.99],
    ['Refund — ASOS', 28.5],
  ];

  it('parses all eight rows cleanly with no issues, in order', () => {
    const { candidates, issues } = parseSheet(CSV_TEXT, { source: 'csv' });
    expect(issues).toHaveLength(0);
    expect(candidates).toHaveLength(8);
    expect(candidates.map((c) => c.merchant)).toEqual(EXPECTED.map(([m]) => m));
  });

  it('keeps every explicitly-signed amount exactly (spend negative, inflow positive)', () => {
    const { candidates } = parseSheet(CSV_TEXT, { source: 'csv' });
    EXPECTED.forEach(([merchant, amount]) => {
      expect(byMerchant(candidates, merchant)?.amount).toBe(amount);
    });
  });

  it('reproduces the exact two-decimal magnitude each row renders via toFixed(2)', () => {
    const { candidates } = parseSheet(CSV_TEXT, { source: 'csv' });
    const shown = (m: string): string => Math.abs(byMerchant(candidates, m)!.amount).toFixed(2);
    expect(shown('Octopus Energy')).toBe('118.40');
    expect(shown('Klarna')).toBe('31.50');
    expect(shown('Refund — ASOS')).toBe('28.50');
    expect(shown('Spotify')).toBe('11.99');
  });

  it('produces only candidates with a confidence — nothing is silently counted', () => {
    const { candidates } = parseSheet(CSV_TEXT, { source: 'csv' });
    expect(candidates.every((c) => ['high', 'medium', 'low'].includes(c.confidence))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Honest-issue routing — a malformed paste yields a hard column issue + zero
// candidates, which both screens fold into their existing calm error/empty
// branch (review-before-truth: nothing is fabricated to fill the card).
// ---------------------------------------------------------------------------
describe('text-reader wedge — honest hard-issue routing', () => {
  const HARD_CODES = ['missing-amount', 'missing-merchant', 'empty-input'];
  const isHard = (issues: readonly ColumnIssue[]): boolean =>
    issues.some((i) => HARD_CODES.includes(i.code));

  it('a paste with no amount column yields a hard issue and zero candidates', () => {
    const { candidates, issues } = parseSheet(['date\tmerchant', '2026-06-26\tTesco'].join('\n'), {
      source: 'paste',
    });
    expect(candidates).toHaveLength(0);
    expect(issueCodes(issues)).toContain('missing-amount');
    expect(isHard(issues) && candidates.length === 0).toBe(true);
  });

  it('a single bad-amount row is NOT hard — the good rows still come through', () => {
    const { candidates, issues } = parseSheet(
      ['date,merchant,amount', '2026-06-26,Tesco,-42.00', '2026-06-25,Mystery,not-a-number'].join(
        '\n',
      ),
      { source: 'csv' },
    );
    expect(byMerchant(candidates, 'Tesco')?.amount).toBe(-42);
    expect(byMerchant(candidates, 'Mystery')).toBeUndefined();
    expect(isHard(issues)).toBe(false);
    expect(candidates.length).toBeGreaterThan(0);
  });
});
