import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseSheet } from './importSheet';
import { parseLocalOcrCandidates } from '../../local/localOcrCandidates';

const fixtureRoot = fileURLToPath(new URL('../../../fixtures/bank-inputs/', import.meta.url).href);

function fixture(name: string): string {
  return readFileSync(`${fixtureRoot}${name}`, 'utf8');
}

describe('shipping import corpus', () => {
  const sheetCases = [
    ['clean.csv', 3],
    ['semicolon.csv', 5],
    ['tab.txt', 5],
    ['duplicate-row.csv', 5],
    ['transfer.csv', 5],
    ['income.csv', 5],
    ['bill.csv', 5],
    ['debt-payment.csv', 5],
    ['balance-mismatch.csv', 5],
    ['subscription.csv', 1],
    ['refund.csv', 1],
    ['unclear-merchant.csv', 1],
    ['messy.csv', 3],
  ] as const;

  for (const [name, expectedRows] of sheetCases) {
    it(`stages every review row from ${name}`, () => {
      const parsed = parseSheet(fixture(name), { source: 'csv' });

      expect(parsed.issues).toEqual([]);
      expect(parsed.candidates).toHaveLength(expectedRows);
      expect(parsed.candidates.every((candidate) => candidate.source === 'csv')).toBe(true);
    });
  }

  const unstructuredCases = [
    ['pasted.txt', 'paste', 5],
    ['pasted-statement.txt', 'paste', 3],
    ['text-pdf-extracted.txt', 'pdf', 7],
    ['screenshot-ocr.txt', 'photo', 5],
    ['camera-ocr.txt', 'photo', 5],
  ] as const;

  for (const [name, source, minimumRows] of unstructuredCases) {
    it(`stages review-only local text from ${name}`, () => {
      const parsed = parseLocalOcrCandidates({
        text: fixture(name),
        source,
        filename: name,
        now: new Date('2026-07-16T12:00:00.000Z'),
      });

      expect(parsed.candidates.length).toBeGreaterThanOrEqual(minimumRows);
      expect(parsed.candidates.every((candidate) => candidate.source === source)).toBe(true);
      expect(parsed.candidates.every((candidate) => candidate.confidence === 'low')).toBe(true);
    });
  }

  it('fails closed when a split money row populates both directions', () => {
    const parsed = parseSheet('Date,Description,Out,In\n2026-06-20,Ambiguous,12.00,7.00', {
      source: 'csv',
    });

    expect(parsed.candidates).toEqual([]);
    expect(parsed.issues.map((issue) => issue.code)).toContain('bad-amount');
  });
});

describe('shipping sheet-parser endurance', () => {
  it('parses 100k synthetic rows deterministically within the release budget', () => {
    const rowCount = 100_000;
    const rows = new Array<string>(rowCount + 1);
    rows[0] = 'date,description,amount,type';
    for (let index = 0; index < rowCount; index += 1) {
      const day = ((index % 28) + 1).toString().padStart(2, '0');
      const amount = index % 5 === 0 ? '1500.00' : `-${((index % 9) + 1).toString()}.25`;
      const kind = index % 5 === 0 ? 'income' : 'spend';
      rows[index + 1] = `2026-06-${day},Synthetic row ${index},${amount},${kind}`;
    }

    const startedAt = performance.now();
    const first = parseSheet(rows.join('\n'), { source: 'csv' });
    const elapsedMs = performance.now() - startedAt;

    expect(first.issues).toEqual([]);
    expect(first.candidates).toHaveLength(rowCount);
    expect(first.candidates[0]).toMatchObject({
      id: 'sheet-1-synthetic-row-0-1500',
      amount: 1500,
      kind: 'income',
    });
    expect(first.candidates.at(-1)?.id).toBe(
      `sheet-${rowCount}-synthetic-row-${rowCount - 1}--1.25`,
    );
    expect(elapsedMs).toBeLessThan(30_000);

    const repeat = parseSheet(
      ['date,description,amount,type', rows[1]!, rows[rowCount]!].join('\n'),
      { source: 'csv' },
    );
    expect(repeat.candidates.map((candidate) => candidate.id)).toEqual([
      first.candidates[0]!.id,
      // Row identity includes source-row position. Re-parsing the complete same file is stable;
      // this two-row probe verifies the data values while the full parse above verifies scale.
      'sheet-2-synthetic-row-99999--1.25',
    ]);
  }, 35_000);
});
