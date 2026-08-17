import { describe, expect, it } from 'vitest';

import { lintCopy } from './copy.js';
import { parseStatementCSV } from './statement.js';

const csv = (...lines: string[]): string => lines.join('\n');

describe('parseStatementCSV — Monzo-style single amount column', () => {
  const text = csv(
    'Date,Description,Amount,Balance',
    '2026-06-28,Tesco Stores 3421,-12.34,500.00',
    '2026-06-30,Payroll Acme Ltd,1500.00,1987.66',
    '2026-07-01,Coffee #1,-3.20,1984.46',
  );

  it('reads every row with the sign convention: out is negative, in is positive', () => {
    const result = parseStatementCSV(text);
    expect(result.rows).toEqual([
      {
        dateISO: '2026-06-28',
        description: 'Tesco Stores 3421',
        amountPence: -1234,
        balancePence: 50000,
      },
      {
        dateISO: '2026-06-30',
        description: 'Payroll Acme Ltd',
        amountPence: 150000,
        balancePence: 198766,
      },
      { dateISO: '2026-07-01', description: 'Coffee #1', amountPence: -320, balancePence: 198446 },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('takes the closing balance from the latest-dated row', () => {
    expect(parseStatementCSV(text).closingBalancePence).toBe(198446);
  });
});

describe('parseStatementCSV — Barclays-style Money Out / Money In columns', () => {
  const text = csv(
    'Date,Description,Money Out,Money In,Balance',
    '28/06/2026,DIRECT DEBIT NETFLIX,9.99,,120.50',
    '30/06/2026,SALARY ACME,,2000.00,2120.50',
    '01/07/2026,CARD ADJUSTMENT,5.00,2.50,2118.00',
  );

  it('maps debit to negative and credit to positive, normalizing dd/mm/yyyy dates', () => {
    const result = parseStatementCSV(text);
    expect(result.rows[0]).toEqual({
      dateISO: '2026-06-28',
      description: 'DIRECT DEBIT NETFLIX',
      amountPence: -999,
      balancePence: 12050,
    });
    expect(result.rows[1]?.dateISO).toBe('2026-06-30');
    expect(result.rows[1]?.amountPence).toBe(200000);
  });

  it('sums a row that has values in both columns', () => {
    expect(parseStatementCSV(text).rows[2]?.amountPence).toBe(-250);
  });
});

describe('parseStatementCSV — CSV tokenizer', () => {
  it('keeps commas inside quoted descriptions intact', () => {
    const result = parseStatementCSV(
      csv('Date,Description,Amount', '2026-07-01,"AMAZON, MARKETPLACE",-10.00'),
    );
    expect(result.rows[0]?.description).toBe('AMAZON, MARKETPLACE');
    expect(result.rows[0]?.amountPence).toBe(-1000);
  });

  it('unescapes doubled double-quotes inside quoted fields', () => {
    const result = parseStatementCSV(
      csv('Date,Description,Amount', '2026-07-01,"BOB""S CAFE",-4.50'),
    );
    expect(result.rows[0]?.description).toBe('BOB"S CAFE');
  });

  it('handles CRLF line endings', () => {
    const result = parseStatementCSV('Date,Description,Amount\r\n2026-07-01,Bakery,-2.00\r\n');
    expect(result.rows).toEqual([
      { dateISO: '2026-07-01', description: 'Bakery', amountPence: -200, balancePence: null },
    ]);
  });
});

describe('parseStatementCSV — date formats', () => {
  it('reads dd-mm-yyyy and dd MMM yyyy (month case-insensitive) as UK day-first', () => {
    const result = parseStatementCSV(
      csv(
        'Date,Description,Amount',
        '02-07-2026,Dashed,-1.00',
        '02 Jul 2026,Named,-1.00',
        '3 jul 2026,LowercaseMonth,-1.00',
      ),
    );
    expect(result.rows.map((r) => r.dateISO)).toEqual(['2026-07-02', '2026-07-02', '2026-07-03']);
  });

  it('skips rows whose date does not exist and says so calmly, in singular', () => {
    const result = parseStatementCSV(
      csv('Date,Description,Amount', '31/02/2026,Ghost Day,-1.00', '01/07/2026,Real Day,-1.00'),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.warnings).toEqual(['1 row skipped — the date would not read.']);
  });
});

describe('parseStatementCSV — amount parsing', () => {
  it('strips £ and thousands commas, and reads parentheses as negative', () => {
    const result = parseStatementCSV(
      csv(
        'Date,Description,Amount',
        '2026-07-01,Big Transfer,"£1,234.56"',
        '2026-07-01,Refund Reversal,(£12.34)',
      ),
    );
    expect(result.rows[0]?.amountPence).toBe(123456);
    expect(result.rows[1]?.amountPence).toBe(-1234);
  });

  it('rounds half up to integer pence', () => {
    const result = parseStatementCSV(
      csv('Date,Description,Amount', '2026-07-01,Interest,0.125', '2026-07-01,Fee,(0.125)'),
    );
    expect(result.rows[0]?.amountPence).toBe(13);
    expect(result.rows[1]?.amountPence).toBe(-13);
  });

  it('skips rows with an unreadable amount and warns in plural', () => {
    const result = parseStatementCSV(
      csv(
        'Date,Description,Amount',
        '2026-07-01,Words Not Numbers,ten pounds',
        '2026-07-01,Blank Amount,',
        '2026-07-01,Fine,-1.00',
      ),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.warnings).toEqual(['2 rows skipped — the amounts would not read.']);
  });

  it('does not strip foreign symbols or explicit currency codes into GBP', () => {
    const result = parseStatementCSV(
      csv(
        'Date,Description,Amount,Currency',
        '2026-07-01,GBP row,GBP 10.00,GBP',
        '2026-07-02,Euro symbol,€12.00,EUR',
        '2026-07-03,Dollar row,$20.00,USD',
      ),
    );

    expect(result.rows).toEqual([
      expect.objectContaining({ description: 'GBP row', amountPence: 1000 }),
    ]);
    expect(result.warnings).toEqual([
      '2 non-GBP rows were left out — Melo will not turn foreign amounts into pounds.',
    ]);
  });
});

describe('parseStatementCSV — bill detection', () => {
  it('detects rent as monthly across 3 months, with dueDay and a Title Case name', () => {
    const result = parseStatementCSV(
      csv(
        'Date,Description,Amount',
        '2026-04-01,ACME PROPERTY RENT 111222,-850.00',
        '2026-04-10,ONE OFF THING,-42.00',
        '2026-05-01,ACME PROPERTY RENT 333444,-850.00',
        '2026-06-01,ACME PROPERTY RENT 555666,-850.00',
      ),
    );
    expect(result.detectedBills).toEqual([
      {
        name: 'Acme Property Rent',
        amountPence: 85000,
        dueDay: 1,
        cadence: 'monthly',
        occurrences: 3,
      },
    ]);
  });

  it('weekly cadence needs 3 occurrences — 2 is not enough', () => {
    const twoWeeks = parseStatementCSV(
      csv('Date,Description,Amount', '2026-06-05,GYM CLASS,-15.00', '2026-06-12,GYM CLASS,-15.00'),
    );
    expect(twoWeeks.detectedBills).toEqual([]);

    const threeWeeks = parseStatementCSV(
      csv(
        'Date,Description,Amount',
        '2026-06-05,GYM CLASS,-15.00',
        '2026-06-12,GYM CLASS,-15.00',
        '2026-06-19,GYM CLASS,-15.00',
      ),
    );
    expect(threeWeeks.detectedBills).toEqual([
      { name: 'Gym Class', amountPence: 1500, dueDay: 19, cadence: 'weekly', occurrences: 3 },
    ]);
  });

  it('accepts amounts within ±15% of the group median and drops the outlier', () => {
    const result = parseStatementCSV(
      csv(
        'Date,Description,Amount',
        '2026-04-15,STREAMFLIX,-9.00',
        '2026-05-15,STREAMFLIX,-10.00',
        '2026-06-15,STREAMFLIX,-11.00',
        '2026-06-20,STREAMFLIX,-20.00',
      ),
    );
    // Median of the qualifying occurrences (900, 1000, 1100) — the 2000 outlier is out.
    expect(result.detectedBills).toEqual([
      { name: 'Streamflix', amountPence: 1000, dueDay: 15, cadence: 'monthly', occurrences: 3 },
    ]);
  });

  it('clamps a month-end dueDay to 28', () => {
    const result = parseStatementCSV(
      csv(
        'Date,Description,Amount',
        '2026-03-31,CITY COUNCIL TAX,-120.00',
        '2026-04-30,CITY COUNCIL TAX,-120.00',
        '2026-05-31,CITY COUNCIL TAX,-120.00',
      ),
    );
    expect(result.detectedBills[0]?.dueDay).toBe(28);
    expect(result.detectedBills[0]?.cadence).toBe('monthly');
  });

  it('does not invent a bill from irregular gaps', () => {
    const result = parseStatementCSV(
      csv(
        'Date,Description,Amount',
        '2026-06-01,CORNER SHOP,-5.00',
        '2026-06-15,CORNER SHOP,-5.00',
      ),
    );
    expect(result.detectedBills).toEqual([]);
  });
});

describe('parseStatementCSV — closing balance', () => {
  it('on a date tie, the row appearing last in the file wins', () => {
    const result = parseStatementCSV(
      csv(
        'Date,Description,Amount,Balance',
        '2026-07-02,Second,-1.00,90.00',
        '2026-07-01,Oldest,-1.00,100.00',
        '2026-07-02,Last In File,-1.00,80.00',
      ),
    );
    expect(result.closingBalancePence).toBe(8000);
  });

  it('is null when the export has no balance column', () => {
    const result = parseStatementCSV(csv('Date,Description,Amount', '2026-07-01,Bakery,-2.00'));
    expect(result.closingBalancePence).toBeNull();
  });
});

describe('parseStatementCSV — recent spend', () => {
  const text = csv(
    'Date,Description,Amount',
    '2026-04-01,ACME PROPERTY RENT,-850.00',
    '2026-05-01,ACME PROPERTY RENT,-850.00',
    '2026-06-01,ACME PROPERTY RENT,-850.00',
    '2026-05-20,OLD COFFEE,-2.80',
    '2026-05-31,COFFEE CORNER,-3.20',
    '2026-06-01,LUNCH SPOT,-7.50',
    '2026-06-01,SALARY ACME,900.00',
  );

  it('keeps debits within 7 days of the latest row, excluding detected-bill rows and credits', () => {
    const result = parseStatementCSV(text);
    expect(result.detectedBills).toHaveLength(1);
    expect(result.recentSpend).toEqual([
      { amountPence: 320, atISO: '2026-05-31', description: 'COFFEE CORNER' },
      { amountPence: 750, atISO: '2026-06-01', description: 'LUNCH SPOT' },
    ]);
  });

  it('reports positive magnitudes', () => {
    const result = parseStatementCSV(text);
    for (const spend of result.recentSpend) expect(spend.amountPence).toBeGreaterThan(0);
  });
});

describe('parseStatementCSV — unreadable and empty input', () => {
  it('garbage input returns empty rows and one warning pointing at the bank CSV export', () => {
    const result = parseStatementCSV('hello world\nthis is not a statement');
    expect(result.rows).toEqual([]);
    expect(result.closingBalancePence).toBeNull();
    expect(result.detectedBills).toEqual([]);
    expect(result.recentSpend).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('CSV export');
  });

  it('empty input gets the same single warning', () => {
    const result = parseStatementCSV('');
    expect(result.rows).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('a header-only file parses cleanly to nothing', () => {
    const result = parseStatementCSV('Date,Description,Amount,Balance\n');
    expect(result.rows).toEqual([]);
    expect(result.closingBalancePence).toBeNull();
    expect(result.detectedBills).toEqual([]);
    expect(result.recentSpend).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('parseStatementCSV — warnings speak the product voice', () => {
  it('every warning passes lintCopy', () => {
    const noisy = parseStatementCSV(
      csv(
        'Date,Description,Amount',
        'not a date,Bad Date,-1.00',
        '2026-07-01,Bad Amount,???',
        '2026-07-01,Fine,-1.00',
      ),
    );
    const unreadable = parseStatementCSV('total nonsense');
    const all = [...noisy.warnings, ...unreadable.warnings];
    expect(all.length).toBeGreaterThan(0);
    for (const warning of all) expect(lintCopy(warning)).toEqual([]);
  });

  it('never emits more than 3 warnings', () => {
    const result = parseStatementCSV(
      csv('Date,Description,Amount', 'bad,BadRow,x', 'worse,WorseRow,y', '2026-07-01,Fine,-1.00'),
    );
    expect(result.warnings.length).toBeLessThanOrEqual(3);
  });
});
