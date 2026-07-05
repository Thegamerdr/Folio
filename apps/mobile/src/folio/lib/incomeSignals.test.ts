import { describe, expect, it } from 'vitest';
import { detectIncomeSources, type IncomeTransaction } from './incomeSignals';

/** Build a transaction with defaults, for terser test tables. */
function tx(merchant: string, amount: number, date: string): IncomeTransaction {
  return { merchant, amount, date };
}

describe('detectIncomeSources', () => {
  it('returns empty array for no transactions', () => {
    expect(detectIncomeSources([])).toEqual([]);
  });

  it('ignores a single credit (not recurring)', () => {
    const result = detectIncomeSources([tx('Acme Ltd', 1500, '2026-01-25')]);
    expect(result).toEqual([]);
  });

  it('ignores debits entirely', () => {
    const result = detectIncomeSources([
      tx('Tesco', -50, '2026-01-01'),
      tx('Tesco', -52, '2026-02-01'),
      tx('Tesco', -49, '2026-03-01'),
    ]);
    expect(result).toEqual([]);
  });

  it('detects monthly salary as strong at 4 occurrences', () => {
    // Gaps: Jan25->Feb24 = 30d, Feb24->Mar26 = 30d, Mar26->Apr25 = 30d — all
    // exactly on the 30-day nominal, well within the +/-2 day strong band.
    const transactions: IncomeTransaction[] = [
      tx('ACME CORP PAYROLL', 2200, '2026-01-25'),
      tx('ACME CORP PAYROLL', 2200, '2026-02-24'),
      tx('ACME CORP PAYROLL', 2200, '2026-03-26'),
      tx('ACME CORP PAYROLL', 2200, '2026-04-25'),
    ];
    const result = detectIncomeSources(transactions);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      merchant: 'ACME CORP PAYROLL',
      cadence: 'monthly',
      medianAmount: 2200,
      occurrences: 4,
      lastSeenISO: '2026-04-25',
      anchorISO: '2026-04-25',
    });
    expect(result[0]?.confidence).toBe('strong');
  });

  it('detects monthly salary at the 3-occurrence floor as possible (below strong floor)', () => {
    const transactions: IncomeTransaction[] = [
      tx('Beta Co Salary', 1800, '2026-01-28'),
      tx('Beta Co Salary', 1800, '2026-02-27'),
      tx('Beta Co Salary', 1800, '2026-03-30'),
    ];
    const result = detectIncomeSources(transactions);
    expect(result).toHaveLength(1);
    expect(result[0]?.occurrences).toBe(3);
    expect(result[0]?.cadence).toBe('monthly');
    expect(result[0]?.confidence).toBe('possible');
  });

  it('does not detect only 2 monthly occurrences (below the 3-occurrence floor)', () => {
    const transactions: IncomeTransaction[] = [
      tx('Gamma Inc', 1900, '2026-01-25'),
      tx('Gamma Inc', 1900, '2026-02-25'),
    ];
    expect(detectIncomeSources(transactions)).toEqual([]);
  });

  it('detects the real-world agency payroll pattern: weekly-ish, amount varying ±20%, as possible', () => {
    // Staffline-type giro: weekly-ish cadence, amount tracks hours worked.
    const transactions: IncomeTransaction[] = [
      tx('STAFFLINE RECRUIT', 215.51, '2026-01-02'),
      tx('STAFFLINE RECRUIT', 230.1, '2026-01-09'),
      tx('STAFFLINE RECRUIT', 198.44, '2026-01-16'),
      tx('STAFFLINE RECRUIT', 224.0, '2026-01-23'),
      tx('STAFFLINE RECRUIT', 210.75, '2026-01-30'),
    ];
    const result = detectIncomeSources(transactions);
    expect(result).toHaveLength(1);
    expect(result[0]?.cadence).toBe('weekly');
    expect(result[0]?.occurrences).toBe(5);
    expect(result[0]?.confidence).toBe('possible');
    // Median of [198.44, 210.75, 215.51, 224.00, 230.10] = 215.51
    expect(result[0]?.medianAmount).toBeCloseTo(215.51, 2);
  });

  it('detects a tight, on-time weekly wage as strong', () => {
    const transactions: IncomeTransaction[] = [
      tx('Retailer Weekly Wage', 310, '2026-01-02'),
      tx('Retailer Weekly Wage', 310, '2026-01-09'),
      tx('Retailer Weekly Wage', 305, '2026-01-16'),
      tx('Retailer Weekly Wage', 312, '2026-01-23'),
      tx('Retailer Weekly Wage', 308, '2026-01-30'),
    ];
    const result = detectIncomeSources(transactions);
    expect(result).toHaveLength(1);
    expect(result[0]?.cadence).toBe('weekly');
    expect(result[0]?.confidence).toBe('strong');
  });

  it('detects fortnightly cadence', () => {
    const transactions: IncomeTransaction[] = [
      tx('Public Sector Payroll', 950, '2026-01-02'),
      tx('Public Sector Payroll', 950, '2026-01-16'),
      tx('Public Sector Payroll', 950, '2026-01-30'),
      tx('Public Sector Payroll', 950, '2026-02-13'),
    ];
    const result = detectIncomeSources(transactions);
    expect(result).toHaveLength(1);
    expect(result[0]?.cadence).toBe('fortnightly');
    expect(result[0]?.confidence).toBe('strong');
  });

  it('detects four-weekly cadence (retail/local-authority drift case)', () => {
    const transactions: IncomeTransaction[] = [
      tx('Council Payroll', 1400, '2026-01-02'),
      tx('Council Payroll', 1400, '2026-01-30'),
      tx('Council Payroll', 1400, '2026-02-27'),
      tx('Council Payroll', 1400, '2026-03-27'),
    ];
    const result = detectIncomeSources(transactions);
    expect(result).toHaveLength(1);
    expect(result[0]?.cadence).toBe('four-weekly');
    expect(result[0]?.confidence).toBe('strong');
  });

  it('does not detect a rent debit + rent-refund credit pair as income', () => {
    const transactions: IncomeTransaction[] = [
      tx('Landlord Properties', -850, '2026-01-01'),
      tx('Landlord Properties', 850, '2026-01-02'), // refund shortly after
      tx('Landlord Properties', -850, '2026-02-01'),
      tx('Landlord Properties', 850, '2026-02-03'),
      tx('Landlord Properties', -850, '2026-03-01'),
      tx('Landlord Properties', 850, '2026-03-02'),
    ];
    expect(detectIncomeSources(transactions)).toEqual([]);
  });

  it('does not exclude a merchant when only SOME credits have a matching nearby debit', () => {
    // Mostly genuine income, one coincidental coincidentally-matched debit —
    // should still surface (conservative: excludes only when EVERY credit matches).
    const transactions: IncomeTransaction[] = [
      tx('Mixed Co', 1200, '2026-01-25'),
      tx('Mixed Co', 1200, '2026-02-25'),
      tx('Mixed Co', 1200, '2026-03-25'),
      tx('Mixed Co', 1200, '2026-04-25'),
      // Unrelated small debit far in time from any credit — should not trip
      // the self-transfer heuristic for the OTHER credits either.
      tx('Mixed Co', -30, '2026-01-10'),
    ];
    const result = detectIncomeSources(transactions);
    expect(result).toHaveLength(1);
    expect(result[0]?.merchant).toBe('Mixed Co');
  });

  it('splits two distinct amount tiers into two separate signals', () => {
    const transactions: IncomeTransaction[] = [
      tx('Two Jobs Ltd', 500, '2026-01-25'),
      tx('Two Jobs Ltd', 500, '2026-02-25'),
      tx('Two Jobs Ltd', 500, '2026-03-25'),
      tx('Two Jobs Ltd', 2000, '2026-01-28'),
      tx('Two Jobs Ltd', 2000, '2026-02-28'),
      tx('Two Jobs Ltd', 2000, '2026-03-28'),
    ];
    const result = detectIncomeSources(transactions);
    expect(result).toHaveLength(2);
    const amounts = result.map((s) => s.medianAmount).sort((a, b) => a - b);
    expect(amounts).toEqual([500, 2000]);
  });

  it('normalises merchant spelling variants into one signal, using the most common raw spelling as label', () => {
    const transactions: IncomeTransaction[] = [
      tx('ACME-CORP', 1000, '2026-01-25'),
      tx('Acme Corp', 1000, '2026-02-25'),
      tx('Acme Corp', 1000, '2026-03-25'),
      tx('Acme Corp', 1000, '2026-04-25'),
    ];
    const result = detectIncomeSources(transactions);
    expect(result).toHaveLength(1);
    expect(result[0]?.merchant).toBe('Acme Corp');
    expect(result[0]?.occurrences).toBe(4);
  });

  it('breaks the run when a gap drifts far outside tolerance, keeping only the longest in-tolerance run', () => {
    const transactions: IncomeTransaction[] = [
      tx('Irregular Employer', 1000, '2026-01-25'),
      tx('Irregular Employer', 1000, '2026-02-25'),
      tx('Irregular Employer', 1000, '2026-03-25'),
      // Big gap here — 90 days later, breaks the monthly run.
      tx('Irregular Employer', 1000, '2026-06-25'),
      tx('Irregular Employer', 1000, '2026-07-25'),
    ];
    const result = detectIncomeSources(transactions);
    expect(result).toHaveLength(1);
    // Longest in-tolerance run is the first 3 (Jan/Feb/Mar), not all 5.
    expect(result[0]?.occurrences).toBe(3);
    expect(result[0]?.lastSeenISO).toBe('2026-03-25');
  });

  it('never includes a usage/value/verdict field on the signal (structural honesty check)', () => {
    const transactions: IncomeTransaction[] = [
      tx('Acme Corp', 1000, '2026-01-25'),
      tx('Acme Corp', 1000, '2026-02-25'),
      tx('Acme Corp', 1000, '2026-03-25'),
    ];
    const result = detectIncomeSources(transactions);
    const keys = Object.keys(result[0] as object);
    expect(keys.sort()).toEqual(
      [
        'anchorISO',
        'cadence',
        'confidence',
        'lastSeenISO',
        'medianAmount',
        'merchant',
        'occurrences',
      ].sort(),
    );
  });
});
