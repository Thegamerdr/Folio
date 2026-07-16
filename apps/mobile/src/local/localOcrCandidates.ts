import { parseTextImport } from '@folio/import-engine';

import type {
  CandidateConfidence,
  CandidateMoneyItem,
  CandidateSource,
} from '@/folio/lib/importSheet';
import type { StatementClosingBalance } from './statementReaderParse';

const READER_CONFIDENCE: CandidateConfidence = 'low';

export type LocalOcrCandidateInput = Readonly<{
  text: string;
  source: CandidateSource;
  filename: string;
  now?: Date;
}>;

export type LocalOcrCandidateResult = Readonly<{
  candidates: CandidateMoneyItem[];
  issueCount: number;
  closingBalance: StatementClosingBalance | null;
  reconciliationState: 'exact_match' | 'explained_mismatch' | 'unresolved_mismatch';
}>;

/**
 * Convert untrusted on-device OCR or unstructured pasted/text-file text into review candidates.
 *
 * The import engine remains the authority for money/date parsing and provenance. This adapter only
 * repairs common OCR substitutions inside date/money tokens and supplies a year when the statement
 * prints one date header for several rows. Every result stays at the lowest confidence and must be
 * reviewed before it becomes money truth.
 */
export function parseLocalOcrCandidates(input: LocalOcrCandidateInput): LocalOcrCandidateResult {
  const now = input.now ?? new Date();
  const normalized = normalizeOcrStatementText(input.text, now);
  const fingerprint = stableFingerprint(`${input.filename}\n${input.text}`);
  const parsed = parseTextImport({
    importJobId: `local-ocr-${fingerprint}`,
    sourceFileId: `local-file-${fingerprint}`,
    accountId: 'main',
    currency: 'GBP',
    dateOrder: 'dmy',
    parsedAt: now.toISOString(),
    text: normalized,
  });

  return {
    candidates: parsed.rows.map((row) => {
      const amount = row.normalized.amount.minorUnits / 100;
      return {
        id: row.canonicalRowId,
        source: input.source,
        kind: amount >= 0 ? 'income' : 'spend',
        merchant: row.normalized.description,
        amount,
        date: String(row.normalized.postedDate),
        confidence: READER_CONFIDENCE,
        note: `Read on this device from ${input.filename} (${row.sourceRowRef}). Check it against the source.`,
      };
    }),
    issueCount: parsed.issues.length,
    closingBalance: statementClosingBalanceFromParsedText(input.text, parsed.reconciliation),
    reconciliationState: parsed.reconciliation?.state ?? 'unresolved_mismatch',
  };
}

function statementClosingBalanceFromParsedText(
  sourceText: string,
  reconciliation:
    | Readonly<{
        state: 'exact_match' | 'explained_mismatch' | 'unresolved_mismatch';
        openingBalance?: Readonly<{ minorUnits: number }>;
        suppliedClosingBalance?: Readonly<{ minorUnits: number }>;
      }>
    | undefined,
): StatementClosingBalance | null {
  if (reconciliation === undefined) return null;
  const closing = reconciliation.suppliedClosingBalance;
  if (closing === undefined) return null;

  // A balance is useful as a dated financial fact only when the source itself exposes its date.
  // Never infer this from the phone clock or the latest row: either would silently turn a partial
  // OCR read into a false current balance.
  const asOfISO = explicitStatementClosingDate(sourceText);
  if (asOfISO === null) return null;

  const result: StatementClosingBalance = {
    amount: closing.minorUnits / 100,
    asOfISO,
  };
  if (reconciliation.openingBalance !== undefined) {
    result.openingAmount = reconciliation.openingBalance.minorUnits / 100;
  }
  return result;
}

function explicitStatementClosingDate(text: string): string | null {
  const compact = text.replace(/\r\n?/gu, '\n').replace(/\s+/gu, ' ');
  const dateToken =
    '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}|\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{2,4})';
  const patterns = [
    new RegExp(`closing\\s+balance(?:\\s+(?:on|as\\s+(?:at|of)))?\\s+(${dateToken})`, 'iu'),
    new RegExp(
      `statement\\s+(?:period|date|ending)[^\\n]{0,80}?(?:to|through|[-â€“â€”])\\s*(${dateToken})`,
      'iu',
    ),
    new RegExp(
      `(?:period|from)\\s+${dateToken}\\s+(?:to|through|[-â€“â€”])\\s*(${dateToken})`,
      'iu',
    ),
  ];
  for (const pattern of patterns) {
    const value = pattern.exec(compact)?.[1];
    if (value !== undefined) {
      const parsed = parseExplicitDate(value);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function parseExplicitDate(value: string): string | null {
  const source = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(source);
  if (iso?.[1] !== undefined && iso[2] !== undefined && iso[3] !== undefined) {
    return validIsoParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const numeric = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/u.exec(source);
  if (numeric?.[1] !== undefined && numeric[2] !== undefined && numeric[3] !== undefined) {
    return validIsoParts(normalizeYear(Number(numeric[3])), Number(numeric[2]), Number(numeric[1]));
  }
  const words = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/u.exec(source);
  if (words?.[1] === undefined || words[2] === undefined || words[3] === undefined) return null;
  const month = MONTHS[words[2].toLowerCase()];
  if (month === undefined) return null;
  return validIsoParts(normalizeYear(Number(words[3])), month, Number(words[1]));
}

function normalizeYear(value: number): number {
  return value < 100 ? 2000 + value : value;
}

function validIsoParts(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}

export function normalizeOcrStatementText(text: string, now: Date): string {
  const lines = coalesceOcrTableLines(
    text
      .replace(/\r\n?/gu, '\n')
      .replace(/[−–—]/gu, '-')
      .replace(/([+\-£])\s+(?=[0-9OoIlL])/gu, '$1')
      .split('\n')
      .map((line) => line.replace(/\s+/gu, ' ').trim())
      .filter((line) => line.length > 0),
  );
  const statementYear = inferStatementYear(lines, now.getFullYear());
  let sectionDate: string | null = null;
  const normalized: string[] = [];

  for (const rawLine of lines) {
    const line = normalizeMoneyTokens(rawLine);
    const lower = line.toLowerCase();
    if (lower === 'today') {
      sectionDate = isoDate(now);
      continue;
    }
    if (lower === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      sectionDate = isoDate(yesterday);
      continue;
    }

    const section =
      /^(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\s+([0-3OoIlL][0-9OoIlL]|[0-9OoIlL])\s+([A-Za-z]{3,9})$/iu.exec(
        line,
      );
    if (section?.[1] !== undefined && section[2] !== undefined) {
      sectionDate = `${normalizeDayToken(section[1])} ${section[2]} ${statementYear}`;
      continue;
    }

    if (/^(?:balance|available|opening\s+balance|cl[o0]sing\s+balance)\b/iu.test(line)) {
      normalized.push(line);
      continue;
    }

    const dated =
      /^([0-3OoIlL][0-9OoIlL]|[0-9OoIlL])\s+([A-Za-z]{3,9})(?!\s+\d{2,4}\b)\s+(.+)$/u.exec(line);
    if (dated?.[1] !== undefined && dated[2] !== undefined && dated[3] !== undefined) {
      normalized.push(`${normalizeDayToken(dated[1])} ${dated[2]} ${statementYear} ${dated[3]}`);
      continue;
    }

    if (sectionDate !== null && containsMoneyToken(line)) {
      normalized.push(`${sectionDate} ${line}`);
      continue;
    }
    normalized.push(line);
  }

  return normalized.join('\n');
}

function normalizeMoneyTokens(line: string): string {
  return line
    .split(' ')
    .map((token) => normalizeMoneyToken(token))
    .join(' ');
}

function normalizeMoneyToken(token: string): string {
  const trailingMinus = /^(.+[.,][0-9OoIlL]{2})-$/u.exec(token)?.[1];
  if (trailingMinus !== undefined) return normalizeMoneyToken(`-${trailingMinus}`);
  const prefix = /^([+(\-£]*)(.*?)([)]?)$/u.exec(token);
  if (prefix?.[2] === undefined) return token;
  const body = prefix[2];
  if (!/[.,][0-9OoIlL]{2}$/u.test(body) || !/^[0-9OoIlL,\.]+$/u.test(body)) return token;
  let normalized = body.replace(/[Oo]/gu, '0').replace(/[IlL]/gu, '1');
  if (normalized.includes('.') && normalized.includes(',')) {
    normalized = normalized.replace(/,/gu, '');
  } else if (!normalized.includes('.') && /,[0-9]{2}$/u.test(normalized)) {
    normalized = `${normalized.slice(0, -3).replace(/,/gu, '')}.${normalized.slice(-2)}`;
  }
  return `${prefix[1] ?? ''}${normalized}${prefix[3] ?? ''}`;
}

function coalesceOcrTableLines(lines: readonly string[]): string[] {
  const output: string[] = [];
  let pending: string | null = null;
  const month = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
  const startsWithDate = (line: string) =>
    new RegExp(`^(?:[0-3OoIlL][0-9OoIlL]|[0-9OoIlL])\\s*${month}\\b`, 'iu').test(line);

  for (const line of lines) {
    const spacedDate = line.replace(
      new RegExp(`^([0-3OoIlL][0-9OoIlL]|[0-9OoIlL])(${month})\\b`, 'iu'),
      '$1 $2',
    );
    if (startsWithDate(spacedDate)) {
      if (pending !== null) output.push(pending);
      if (containsMoneyToken(spacedDate)) {
        output.push(spacedDate);
        pending = null;
      } else {
        pending = spacedDate;
      }
      continue;
    }
    if (pending !== null) {
      pending = `${pending} ${spacedDate}`;
      if (containsMoneyToken(spacedDate)) {
        output.push(pending);
        pending = null;
      }
      continue;
    }
    output.push(spacedDate);
  }
  if (pending !== null) output.push(pending);
  return output;
}

function containsMoneyToken(line: string): boolean {
  return line
    .split(' ')
    .some((token) => normalizeMoneyToken(token) !== token || /[.,]\d{2}\)?$/u.test(token));
}

function normalizeDayToken(value: string): string {
  return value.replace(/[Oo]/gu, '0').replace(/[IlL]/gu, '1').padStart(2, '0');
}

function inferStatementYear(lines: readonly string[], fallback: number): number {
  for (const line of lines) {
    if (!/(?:statement|period|from|to)/iu.test(line)) continue;
    const year = /\b(20\d{2})\b/u.exec(line)?.[1];
    if (year !== undefined) return Number(year);
  }
  return fallback;
}

function isoDate(value: Date): string {
  return `${value.getFullYear().toString().padStart(4, '0')}-${(value.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${value.getDate().toString().padStart(2, '0')}`;
}

function stableFingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
