/**
 * Statement import: turns a bank CSV export into the engine's ground truth — rows,
 * closing balance, detected recurring bills, and the recent spend that feeds the
 * run-rate. Deterministic: everything derives from the text (the latest row's date
 * is "now"), no clock, no locale. Money is integer pence throughout; amount strings
 * are parsed textually (never via float multiplication) and rounded half up.
 * Sign convention: row amounts are NEGATIVE for money out; detected bills and recent
 * spend carry POSITIVE magnitudes. Warnings speak in the product voice (copy.ts).
 */

import { assertPence, daysBetween, toEpochDay, type ISODate, type Pence } from './core.js';

export interface StatementRow {
  readonly dateISO: ISODate;
  readonly description: string;
  readonly amountPence: Pence;
  readonly balancePence: Pence | null;
}

export interface DetectedBill {
  readonly name: string;
  readonly amountPence: Pence;
  readonly dueDay: number;
  readonly cadence: 'monthly' | 'weekly';
  readonly occurrences: number;
}

export interface RecentSpend {
  readonly amountPence: Pence;
  readonly atISO: ISODate;
  readonly description: string;
}

export interface StatementParse {
  readonly rows: readonly StatementRow[];
  readonly closingBalancePence: Pence | null;
  readonly detectedBills: readonly DetectedBill[];
  readonly recentSpend: readonly RecentSpend[];
  readonly warnings: readonly string[];
}

// ---------------------------------------------------------------------------
// CSV tokenizer — small and by-the-book: quoted fields, "" escapes, CRLF/LF.
// ---------------------------------------------------------------------------

function tokenizeCSV(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text.charAt(i + 1) === '\n') i++;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records.filter((r) => r.some((f) => f.trim() !== ''));
}

// ---------------------------------------------------------------------------
// Header sniffing — fuzzy, case-insensitive match across UK bank exports.
// ---------------------------------------------------------------------------

const DATE_HEADERS = ['date', 'transaction date', 'posting date', 'date of transaction'];
const DESCRIPTION_HEADERS = [
  'description',
  'details',
  'narrative',
  'merchant',
  'reference',
  'transaction description',
  'name',
  'memo',
];
const AMOUNT_HEADERS = ['amount', 'value', 'transaction amount'];
const DEBIT_HEADERS = ['debit', 'money out', 'paid out', 'out'];
const CREDIT_HEADERS = ['credit', 'money in', 'paid in', 'in'];
const BALANCE_HEADERS = ['balance', 'running balance', 'balance after transaction'];

interface ColumnMap {
  readonly date: number;
  readonly description: number;
  readonly amount: number;
  readonly debit: number;
  readonly credit: number;
  readonly balance: number;
}

function normalizeHeaderCell(cell: string): string {
  return cell
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapColumns(record: readonly string[]): ColumnMap {
  let date = -1;
  let description = -1;
  let amount = -1;
  let debit = -1;
  let credit = -1;
  let balance = -1;
  record.forEach((cell, idx) => {
    const h = normalizeHeaderCell(cell);
    if (date === -1 && DATE_HEADERS.includes(h)) date = idx;
    else if (description === -1 && DESCRIPTION_HEADERS.includes(h)) description = idx;
    else if (amount === -1 && AMOUNT_HEADERS.includes(h)) amount = idx;
    else if (debit === -1 && DEBIT_HEADERS.includes(h)) debit = idx;
    else if (credit === -1 && CREDIT_HEADERS.includes(h)) credit = idx;
    else if (balance === -1 && BALANCE_HEADERS.includes(h)) balance = idx;
  });
  return { date, description, amount, debit, credit, balance };
}

function findHeader(records: readonly (readonly string[])[]): {
  readonly index: number;
  readonly cols: ColumnMap;
} | null {
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    const cols = mapColumns(record);
    const hasAmount = cols.amount !== -1 || (cols.debit !== -1 && cols.credit !== -1);
    if (cols.date !== -1 && hasAmount) return { index: i, cols };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Field parsers — dates normalize to ISO, amounts parse textually to pence.
// ---------------------------------------------------------------------------

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const ISO_DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const UK_SLASHED_RE = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/;
const UK_NAMED_RE = /^(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})$/i;

/** UK day-first for slashed/dashed forms; returns normalized YYYY-MM-DD or null. */
function parseStatementDate(raw: string): ISODate | null {
  const s = raw.trim();
  let year: number;
  let month: number;
  let day: number;
  let m: RegExpExecArray | null;
  if ((m = ISO_DATE_RE.exec(s))) {
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  } else if ((m = UK_SLASHED_RE.exec(s))) {
    day = Number(m[1]);
    month = Number(m[3]);
    year = Number(m[4]);
  } else if ((m = UK_NAMED_RE.exec(s))) {
    day = Number(m[1]);
    month = MONTHS[(m[2] ?? '').slice(0, 3).toLowerCase()] ?? 0;
    year = Number(m[3]);
    if (month === 0) return null;
  } else {
    return null;
  }
  // Round-trip through UTC calendar math (no clock) to reject 31 Feb and friends.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

const AMOUNT_RE = /^(\d*)(?:\.(\d*))?$/;

/**
 * '£1,234.56' → 123456; '(12.34)' → -1234. Parsed textually so 0.125 rounds
 * half up to 13 without float drift. Returns null when the cell is not a number.
 */
function parseStatementAmount(raw: string): Pence | null {
  let s = raw.trim();
  if (s === '') return null;
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[£$€\s,]/g, '');
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  const m = AMOUNT_RE.exec(s);
  if (!m) return null;
  const poundsPart = m[1] ?? '';
  const fracPart = m[2] ?? '';
  if (poundsPart === '' && fracPart === '') return null;
  const pounds = poundsPart === '' ? 0 : Number(poundsPart);
  let pence = pounds * 100 + Number((fracPart + '00').slice(0, 2));
  if (fracPart.length > 2 && Number(fracPart.charAt(2)) >= 5) pence += 1; // half up
  return negative ? -pence : pence;
}

function fieldAt(record: readonly string[], index: number): string {
  return index === -1 ? '' : (record[index] ?? '');
}

function readAmount(record: readonly string[], cols: ColumnMap): Pence | null {
  if (cols.amount !== -1) return parseStatementAmount(fieldAt(record, cols.amount));
  const debit = parseStatementAmount(fieldAt(record, cols.debit));
  const credit = parseStatementAmount(fieldAt(record, cols.credit));
  if (debit === null && credit === null) return null;
  const out = debit === null ? 0 : -Math.abs(debit);
  const inn = credit === null ? 0 : Math.abs(credit);
  return out + inn;
}

// ---------------------------------------------------------------------------
// Bill detection — grouped debits with a steady amount and a steady rhythm.
// ---------------------------------------------------------------------------

const MERCHANT_KEY_LENGTH = 24;
const AMOUNT_TOLERANCE = 0.15;
const MONTHLY_MIN_GAP = 25;
const MONTHLY_MAX_GAP = 35;
const WEEKLY_MIN_GAP = 6;
const WEEKLY_MAX_GAP = 8;
const WEEKLY_MIN_OCCURRENCES = 3;
const DUE_DAY_CEILING = 28;

/** Uppercase, drop standalone digit-runs of 3+ (references), collapse, first 24 chars. */
function normalizeMerchant(description: string): string {
  return description
    .toUpperCase()
    .replace(/\b\d{3,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MERCHANT_KEY_LENGTH)
    .trim();
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Median rounded half up to integer pence. */
function medianPence(values: readonly Pence[]): Pence {
  const sorted = [...values].sort((a, b) => a - b);
  const upper = sorted[Math.floor(sorted.length / 2)];
  const lower = sorted[Math.floor((sorted.length - 1) / 2)];
  if (upper === undefined || lower === undefined) {
    throw new Error('median needs at least one value');
  }
  return Math.floor((lower + upper) / 2 + 0.5);
}

function cadenceOf(dates: readonly ISODate[]): 'monthly' | 'weekly' | null {
  if (dates.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const prev = dates[i - 1];
    const curr = dates[i];
    if (prev !== undefined && curr !== undefined) intervals.push(daysBetween(prev, curr));
  }
  if (intervals.every((g) => g >= MONTHLY_MIN_GAP && g <= MONTHLY_MAX_GAP)) return 'monthly';
  if (
    dates.length >= WEEKLY_MIN_OCCURRENCES &&
    intervals.every((g) => g >= WEEKLY_MIN_GAP && g <= WEEKLY_MAX_GAP)
  ) {
    return 'weekly';
  }
  return null;
}

interface DebitOccurrence {
  readonly index: number;
  readonly magnitudePence: Pence;
  readonly dateISO: ISODate;
}

interface BillDetection {
  readonly bills: readonly DetectedBill[];
  readonly billRowIndices: ReadonlySet<number>;
}

function detectBills(rows: readonly StatementRow[]): BillDetection {
  const groups = new Map<string, DebitOccurrence[]>();
  rows.forEach((row, index) => {
    if (row.amountPence >= 0) return;
    const key = normalizeMerchant(row.description);
    const occurrence: DebitOccurrence = {
      index,
      magnitudePence: -row.amountPence,
      dateISO: row.dateISO,
    };
    const existing = groups.get(key);
    if (existing) existing.push(occurrence);
    else groups.set(key, [occurrence]);
  });

  const bills: DetectedBill[] = [];
  const billRowIndices = new Set<number>();
  for (const [key, occurrences] of groups) {
    if (occurrences.length < 2) continue;
    const groupMedian = medianPence(occurrences.map((o) => o.magnitudePence));
    const qualifying = occurrences
      .filter((o) => Math.abs(o.magnitudePence - groupMedian) <= groupMedian * AMOUNT_TOLERANCE)
      .sort((a, b) => toEpochDay(a.dateISO) - toEpochDay(b.dateISO) || a.index - b.index);
    const cadence = cadenceOf(qualifying.map((o) => o.dateISO));
    if (!cadence) continue;
    const latest = qualifying[qualifying.length - 1];
    if (!latest) continue;
    const amountPence = medianPence(qualifying.map((o) => o.magnitudePence));
    assertPence(amountPence, `detected bill "${key}" amountPence`);
    const dayOfMonth = Number(latest.dateISO.slice(8, 10));
    bills.push({
      name: titleCase(key),
      amountPence,
      dueDay: Math.max(1, Math.min(dayOfMonth, DUE_DAY_CEILING)),
      cadence,
      occurrences: qualifying.length,
    });
    for (const o of qualifying) billRowIndices.add(o.index);
  }
  return { bills, billRowIndices };
}

// ---------------------------------------------------------------------------
// Warnings — calm, specific, and they always pass lintCopy.
// ---------------------------------------------------------------------------

const MAX_WARNINGS = 3;
const UNREADABLE_WARNING =
  'That file did not read as a statement. A CSV export from the bank app usually works best.';

function skippedWarning(count: number, what: 'date' | 'amount'): string {
  const rowWord = count === 1 ? 'row' : 'rows';
  const subject =
    what === 'date'
      ? count === 1
        ? 'the date'
        : 'the dates'
      : count === 1
        ? 'the amount'
        : 'the amounts';
  return `${count} ${rowWord} skipped — ${subject} would not read.`;
}

// ---------------------------------------------------------------------------
// The parser.
// ---------------------------------------------------------------------------

const RECENT_SPEND_WINDOW_DAYS = 7;

const EMPTY_PARSE: StatementParse = {
  rows: [],
  closingBalancePence: null,
  detectedBills: [],
  recentSpend: [],
  warnings: [UNREADABLE_WARNING],
};

export function parseStatementCSV(text: string): StatementParse {
  const records = tokenizeCSV(text);
  const header = findHeader(records);
  if (!header) return EMPTY_PARSE;
  const cols = header.cols;

  const rows: StatementRow[] = [];
  let dateSkips = 0;
  let amountSkips = 0;
  for (const record of records.slice(header.index + 1)) {
    const dateISO = parseStatementDate(fieldAt(record, cols.date));
    if (dateISO === null) {
      dateSkips += 1;
      continue;
    }
    const amountPence = readAmount(record, cols);
    if (amountPence === null) {
      amountSkips += 1;
      continue;
    }
    assertPence(amountPence, 'statement row amountPence');
    const balancePence =
      cols.balance === -1 ? null : parseStatementAmount(fieldAt(record, cols.balance));
    if (balancePence !== null) assertPence(balancePence, 'statement row balancePence');
    rows.push({
      dateISO,
      description: fieldAt(record, cols.description).trim(),
      amountPence,
      balancePence,
    });
  }

  let closingBalancePence: Pence | null = null;
  if (cols.balance !== -1) {
    let best: StatementRow | null = null;
    let bestEpoch = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const epoch = toEpochDay(row.dateISO);
      if (epoch >= bestEpoch) {
        bestEpoch = epoch;
        best = row; // >= keeps the last row in file order on a date tie
      }
    }
    closingBalancePence = best ? best.balancePence : null;
  }

  const { bills, billRowIndices } = detectBills(rows);

  const recentSpend: RecentSpend[] = [];
  if (rows.length > 0) {
    const latestEpoch = Math.max(...rows.map((r) => toEpochDay(r.dateISO)));
    rows.forEach((row, index) => {
      if (row.amountPence >= 0 || billRowIndices.has(index)) return;
      const age = latestEpoch - toEpochDay(row.dateISO);
      if (age >= 0 && age <= RECENT_SPEND_WINDOW_DAYS) {
        recentSpend.push({
          amountPence: -row.amountPence,
          atISO: row.dateISO,
          description: row.description,
        });
      }
    });
  }

  const warnings: string[] = [];
  if (dateSkips > 0) warnings.push(skippedWarning(dateSkips, 'date'));
  if (amountSkips > 0) warnings.push(skippedWarning(amountSkips, 'amount'));

  return {
    rows,
    closingBalancePence,
    detectedBills: bills,
    recentSpend,
    warnings: warnings.slice(0, MAX_WARNINGS),
  };
}
