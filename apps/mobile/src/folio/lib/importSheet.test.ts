// IMPORT-SHEET engine tests — the spreadsheet-returner wedge.
// ENGINES.md §6 "Import from a Sheet" + §0 "Candidate item contract".
//
// Pure-logic coverage for `parseSheet` (apps/mobile/src/folio/lib/importSheet.ts):
// CSV + TSV + pasted rows, delimiter detection, header-row auto-detection,
// manual columnMapping override, amount sign/format, quoted fields with commas,
// and the honest-issues contract (bad/missing columns surface fix prompts,
// never silent guesses). Never auto-counts — produces candidates for Review.
//
// Node-safe: touches only the engine module (no react-native runtime, no DOM,
// no file/network I/O), so it is a plain `.test.ts` collected by the
// apps/**/*.test.ts runner. RELATIVE imports — the runner has no @ alias
// (mirrors store.test.ts).

import { describe, expect, it } from 'vitest';

import {
  FOLIO_CSV_TEMPLATE,
  parseSheet,
  type CandidateMoneyItem,
  type ColumnIssue,
} from './importSheet';

// ---------------------------------------------------------------------------
// Helpers — find a candidate by merchant, and pull issue codes.
// ---------------------------------------------------------------------------
const byMerchant = (
  cands: readonly CandidateMoneyItem[],
  m: string,
): CandidateMoneyItem | undefined => cands.find((c) => c.merchant === m);

const issueCodes = (issues: readonly ColumnIssue[]): string[] => issues.map((i) => i.code);

// ---------------------------------------------------------------------------
// CSV parse — header row + basic mapping
// ---------------------------------------------------------------------------
describe('parseSheet — CSV', () => {
  const csv = [
    'date,description,amount,category,note',
    '2026-06-20,Tesco,-42.00,Groceries,weekly shop',
    '2026-06-25,Salary,2180.00,Income,',
  ].join('\n');

  it('parses a clean CSV with a header row into candidates', () => {
    const { candidates, issues } = parseSheet(csv);
    expect(issues).toHaveLength(0);
    expect(candidates).toHaveLength(2);
  });

  it('maps description → merchant and preserves the row note', () => {
    const { candidates } = parseSheet(csv);
    const tesco = byMerchant(candidates, 'Tesco');
    expect(tesco).toBeDefined();
    expect(tesco?.note).toBe('weekly shop');
  });

  it('tags candidates with the csv source', () => {
    const { candidates } = parseSheet(csv, { source: 'csv' });
    expect(candidates.every((c) => c.source === 'csv')).toBe(true);
  });

  it('keeps a negative amount negative (spend) and a positive one positive (income)', () => {
    const { candidates } = parseSheet(csv);
    expect(byMerchant(candidates, 'Tesco')?.amount).toBe(-42);
    expect(byMerchant(candidates, 'Salary')?.amount).toBe(2180);
  });

  it('infers income kind from a positive amount, spend from a negative', () => {
    const { candidates } = parseSheet(csv);
    expect(byMerchant(candidates, 'Salary')?.kind).toBe('income');
    expect(byMerchant(candidates, 'Tesco')?.kind).toBe('spend');
  });

  it('carries the ISO date through when present', () => {
    const { candidates } = parseSheet(csv);
    expect(byMerchant(candidates, 'Tesco')?.date).toBe('2026-06-20');
  });

  it('gives every candidate a stable, unique id', () => {
    const { candidates } = parseSheet(csv);
    const ids = candidates.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TSV parse — tab delimiter auto-detection
// ---------------------------------------------------------------------------
describe('parseSheet — TSV', () => {
  const tsv = [
    'date\tdescription\tamount',
    '2026-06-20\tTesco\t-42.00',
    '2026-06-21\tPret\t-6.85',
  ].join('\n');

  it('detects the tab delimiter and parses TSV', () => {
    const { candidates, issues } = parseSheet(tsv);
    expect(issues).toHaveLength(0);
    expect(candidates).toHaveLength(2);
    expect(byMerchant(candidates, 'Pret')?.amount).toBe(-6.85);
  });
});

// ---------------------------------------------------------------------------
// Paste parse — pasted rows from a spreadsheet (tabs), paste source default
// ---------------------------------------------------------------------------
describe('parseSheet — pasted rows', () => {
  it('parses tab-separated pasted rows and defaults to the paste source', () => {
    const pasted = ['Tesco\t-42.00\t2026-06-20', 'Pret\t-6.85\t2026-06-21'].join('\n');
    // No header row here → headerless body, explicit mapping by index.
    const { candidates, issues } = parseSheet(pasted, {
      source: 'paste',
      columnMapping: { merchant: 0, amount: 1, date: 2 },
      hasHeader: false,
    });
    expect(issues).toHaveLength(0);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.source === 'paste')).toBe(true);
    expect(byMerchant(candidates, 'Tesco')?.date).toBe('2026-06-20');
  });
});

// ---------------------------------------------------------------------------
// Header-row auto-detection
// ---------------------------------------------------------------------------
describe('parseSheet — header detection', () => {
  it('auto-detects a header row from known column names', () => {
    const csv = ['Date,Merchant,Amount', '2026-06-20,Tesco,-42.00'].join('\n');
    const { candidates, issues } = parseSheet(csv);
    expect(issues).toHaveLength(0);
    expect(candidates).toHaveLength(1);
    // The header row must NOT become a candidate.
    expect(byMerchant(candidates, 'Merchant')).toBeUndefined();
    expect(byMerchant(candidates, 'Tesco')).toBeDefined();
  });

  it('treats a first row with no known headers + numeric-looking amount as data, not a header', () => {
    const csv = ['Tesco,-42.00,2026-06-20', 'Pret,-6.85,2026-06-21'].join('\n');
    const { candidates } = parseSheet(csv, {
      columnMapping: { merchant: 0, amount: 1, date: 2 },
    });
    // Both rows are data — auto-detection must not eat the first.
    expect(candidates).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Amount formats — currency symbols, thousands separators, parens-negatives
// ---------------------------------------------------------------------------
describe('parseSheet — amount format', () => {
  it('strips a leading currency symbol and thousands separators (magnitude preserved)', () => {
    // No sign glyph and no type column → the amount is ambiguous in/out, so the
    // engine keeps the magnitude and does NOT silently flip the sign. Review
    // confirms the direction. Here we assert the numbers are read correctly.
    const csv = ['description,amount,type', 'Rent,"£1,250.00",spend', 'Coffee,£3.50,spend'].join(
      '\n',
    );
    const { candidates, issues } = parseSheet(csv);
    expect(issues).toHaveLength(0);
    expect(byMerchant(candidates, 'Rent')?.amount).toBe(-1250);
    expect(byMerchant(candidates, 'Coffee')?.amount).toBe(-3.5);
  });

  it('keeps a bare unsigned amount positive (ambiguous) rather than guessing spend', () => {
    // £-glyph + thousands separator, but no sign and no type column.
    const csv = ['description,amount', 'Rent,"£1,250.00"'].join('\n');
    const { candidates } = parseSheet(csv);
    const rent = byMerchant(candidates, 'Rent');
    expect(rent?.amount).toBe(1250); // magnitude correct, sign not invented
    expect(rent?.confidence).not.toBe('high'); // ambiguity is reflected honestly
  });

  it('reads accountant-style parentheses as a negative (spend)', () => {
    const csv = ['description,amount', 'Tesco,(42.00)'].join('\n');
    const { candidates } = parseSheet(csv);
    expect(byMerchant(candidates, 'Tesco')?.amount).toBe(-42);
  });

  it('uses an explicit type column to sign an unsigned amount', () => {
    const csv = ['description,amount,type', 'Tesco,42.00,spend', 'Salary,2180.00,income'].join(
      '\n',
    );
    const { candidates } = parseSheet(csv);
    expect(byMerchant(candidates, 'Tesco')?.amount).toBe(-42);
    expect(byMerchant(candidates, 'Salary')?.amount).toBe(2180);
    expect(byMerchant(candidates, 'Salary')?.kind).toBe('income');
  });
});

// ---------------------------------------------------------------------------
// Missing / bad columns → honest issues, NOT silent guesses
// ---------------------------------------------------------------------------
describe('parseSheet — honest issues', () => {
  it('returns a missing-amount issue and zero candidates when no amount column exists', () => {
    const csv = ['date,description', '2026-06-20,Tesco'].join('\n');
    const { candidates, issues } = parseSheet(csv);
    expect(candidates).toHaveLength(0);
    expect(issueCodes(issues)).toContain('missing-amount');
    // The issue carries a human fix prompt, not a silent failure.
    const amountIssue = issues.find((i) => i.code === 'missing-amount');
    expect(amountIssue?.message.length).toBeGreaterThan(0);
  });

  it('returns a missing-merchant issue when no description/merchant column exists', () => {
    const csv = ['date,amount', '2026-06-20,-42.00'].join('\n');
    const { issues } = parseSheet(csv);
    expect(issueCodes(issues)).toContain('missing-merchant');
  });

  it('flags an unparseable amount on a specific row without guessing a value', () => {
    const csv = ['description,amount', 'Tesco,-42.00', 'Mystery,not-a-number'].join('\n');
    const { candidates, issues } = parseSheet(csv);
    // The good row still comes through.
    expect(byMerchant(candidates, 'Tesco')?.amount).toBe(-42);
    // The bad row is NOT silently coerced to 0 — it is reported and skipped.
    expect(byMerchant(candidates, 'Mystery')).toBeUndefined();
    const badRow = issues.find((i) => i.code === 'bad-amount');
    expect(badRow).toBeDefined();
    expect(badRow?.row).toBe(2);
  });

  it('returns an empty-input issue for blank text', () => {
    const { candidates, issues } = parseSheet('   \n  \n');
    expect(candidates).toHaveLength(0);
    expect(issueCodes(issues)).toContain('empty-input');
  });
});

// ---------------------------------------------------------------------------
// Manual columnMapping override
// ---------------------------------------------------------------------------
describe('parseSheet — columnMapping override', () => {
  it('honours an explicit column mapping over auto-detection', () => {
    // Headers are deliberately ambiguous / wrong; mapping pins the columns.
    const csv = ['col_a,col_b,col_c', 'Tesco,-42.00,2026-06-20'].join('\n');
    const { candidates, issues } = parseSheet(csv, {
      columnMapping: { merchant: 0, amount: 1, date: 2 },
      hasHeader: true,
    });
    expect(issues).toHaveLength(0);
    const tesco = byMerchant(candidates, 'Tesco');
    expect(tesco?.amount).toBe(-42);
    expect(tesco?.date).toBe('2026-06-20');
  });

  it('maps account/source and note columns when provided', () => {
    const csv = ['merchant,amount,acct,memo', 'Tesco,-42.00,Monzo,weekly'].join('\n');
    const { candidates } = parseSheet(csv, {
      columnMapping: { merchant: 0, amount: 1, account: 2, note: 3 },
      hasHeader: true,
    });
    const tesco = byMerchant(candidates, 'Tesco');
    // account folds into the human note so Review keeps the source context.
    expect(tesco?.note).toContain('Monzo');
    expect(tesco?.note).toContain('weekly');
  });
});

// ---------------------------------------------------------------------------
// Quoted fields with commas (RFC-4180-ish) — must not split inside quotes
// ---------------------------------------------------------------------------
describe('parseSheet — quoted fields', () => {
  it('keeps commas inside double-quoted fields', () => {
    const csv = ['description,amount,note', '"Tesco, Bristol",-42.00,"big, weekly shop"'].join(
      '\n',
    );
    const { candidates, issues } = parseSheet(csv);
    expect(issues).toHaveLength(0);
    const tesco = byMerchant(candidates, 'Tesco, Bristol');
    expect(tesco).toBeDefined();
    expect(tesco?.amount).toBe(-42);
    expect(tesco?.note).toBe('big, weekly shop');
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    const csv = ['description,amount', '"He said ""hi""",-5.00'].join('\n');
    const { candidates } = parseSheet(csv);
    expect(byMerchant(candidates, 'He said "hi"')?.amount).toBe(-5);
  });
});

// ---------------------------------------------------------------------------
// Confidence + never-auto-count guarantees
// ---------------------------------------------------------------------------
describe('parseSheet — confidence + candidate-only', () => {
  it('lowers confidence when the date is missing', () => {
    const csv = ['description,amount', 'Tesco,-42.00'].join('\n');
    const { candidates } = parseSheet(csv);
    const tesco = byMerchant(candidates, 'Tesco');
    expect(tesco?.confidence).not.toBe('high');
  });

  it('marks a fully-specified, well-signed row as high confidence', () => {
    const csv = ['date,description,amount,type', '2026-06-20,Tesco,-42.00,spend'].join('\n');
    const { candidates } = parseSheet(csv);
    expect(byMerchant(candidates, 'Tesco')?.confidence).toBe('high');
  });

  it('only ever returns candidates (kind is never silently "counted")', () => {
    const csv = ['description,amount', 'Tesco,-42.00'].join('\n');
    const { candidates } = parseSheet(csv);
    // Every item is a candidate shape with a confidence — nothing is a posted fact.
    expect(candidates.every((c) => ['high', 'medium', 'low'].includes(c.confidence))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Folio CSV template
// ---------------------------------------------------------------------------
describe('FOLIO_CSV_TEMPLATE', () => {
  it('exports a header line covering the documented columns', () => {
    const header = FOLIO_CSV_TEMPLATE.split('\n')[0]!.toLowerCase();
    for (const col of ['date', 'amount', 'merchant', 'category', 'note', 'kind']) {
      expect(header).toContain(col);
    }
  });

  it('round-trips: the template parses back into candidates with no issues', () => {
    const { candidates, issues } = parseSheet(FOLIO_CSV_TEMPLATE);
    expect(issues).toHaveLength(0);
    expect(candidates.length).toBeGreaterThan(0);
  });
});
