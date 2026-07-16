import type { CandidateMoneyItem, CandidateSource } from '@/folio/lib/importSheet';
import { cleanMerchantName } from '../folio/lib/merchantCleaner';

import type { ExtractedText } from './nativeTextExtraction';
import { parseLocalOcrCandidates, type LocalOcrCandidateResult } from './localOcrCandidates';

export type LocalDocumentKind = 'statement' | 'receipt' | 'invoice' | 'unknown';

export type LocalDocumentCandidateResult = LocalOcrCandidateResult &
  Readonly<{
    documentKind: LocalDocumentKind;
  }>;

export function parseLocalDocumentCandidates(
  input: Readonly<{
    text: string;
    source: Extract<CandidateSource, 'pdf' | 'photo'>;
    filename: string;
    extraction?: ExtractedText | undefined;
    now?: Date | undefined;
  }>,
): LocalDocumentCandidateResult {
  const lines = documentLines(input.text, input.extraction);
  const documentKind = classifyLocalDocument(lines);

  if (documentKind === 'receipt') {
    return {
      documentKind,
      candidates: parseReceiptCandidate(lines, input.source, input.filename),
      issueCount: 0,
      closingBalance: null,
      reconciliationState: 'unresolved_mismatch',
    };
  }

  // A paid invoice is evidence of a completed transaction and can safely use the receipt grammar.
  // An unpaid invoice is a dated commitment, not a transaction; keep it out of the ledger until the
  // dedicated invoice-review path can preserve due date, counterparty and payment state.
  if (
    documentKind === 'invoice' &&
    lines.some((line) => /\b(?:paid|payment received)\b/iu.test(line))
  ) {
    return {
      documentKind,
      candidates: parseReceiptCandidate(lines, input.source, input.filename),
      issueCount: 0,
      closingBalance: null,
      reconciliationState: 'unresolved_mismatch',
    };
  }

  const statement = parseLocalOcrCandidates({
    text: input.text,
    source: input.source,
    filename: input.filename,
    ...(input.now === undefined ? {} : { now: input.now }),
  });
  return { documentKind, ...statement };
}

export function classifyLocalDocument(lines: readonly string[]): LocalDocumentKind {
  const text = lines.join('\n');
  const datedMoneyRows = lines.filter(
    (line) =>
      /(?:^|\s)(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{2,4})?)(?:\s|$)/u.test(
        line,
      ) && moneyValues(line).length > 0,
  ).length;
  const statementSignals = [
    /\b(?:opening|closing)\s+balance\b/iu,
    /\bstatement\s+(?:period|date|number)\b/iu,
    /\baccount\s+(?:number|summary)\b/iu,
    /\b(?:money out|money in|debit|credit)\b/iu,
  ].filter((pattern) => pattern.test(text)).length;
  if (datedMoneyRows >= 2 || statementSignals >= 2) return 'statement';

  const invoiceSignals = [
    /\binvoice\b/iu,
    /\b(?:invoice|reference)\s*(?:number|no\.?|#)\b/iu,
    /\b(?:amount|payment)\s+due\b/iu,
    /\bdue\s+date\b/iu,
  ].filter((pattern) => pattern.test(text)).length;
  if (invoiceSignals >= 2) return 'invoice';

  const receiptSignals = [
    /\b(?:receipt|till)\b/iu,
    /\b(?:grand\s+total|amount\s+paid|total\s+paid)\b/iu,
    /\b(?:cash|visa|mastercard|contactless|card)\b/iu,
    /\b(?:vat|tax)\b/iu,
  ].filter((pattern) => pattern.test(text)).length;
  if (receiptSignals >= 2 || lines.some((line) => receiptTotalScore(line) >= 80)) return 'receipt';
  return 'unknown';
}

function parseReceiptCandidate(
  lines: readonly string[],
  source: Extract<CandidateSource, 'pdf' | 'photo'>,
  filename: string,
): CandidateMoneyItem[] {
  const total = lines
    .map((line, index) => ({
      line,
      index,
      score: receiptTotalScore(line),
      values: moneyValues(line),
    }))
    .filter((row) => row.score > 0 && row.values.length > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index)[0];
  const amount = total?.values.at(-1);
  if (amount === undefined || !Number.isFinite(amount) || amount <= 0) return [];

  const merchant = receiptMerchant(lines);
  if (merchant === null) return [];
  const date = explicitReceiptDate(lines);
  const candidate: CandidateMoneyItem = {
    id: `local-receipt-${stableFingerprint(`${filename}\n${lines.join('\n')}`)}`,
    source,
    kind: 'spend',
    merchant,
    amount: -amount,
    confidence: 'low',
    note: `Read on this device from ${filename}. Check the merchant, total and date against the source.`,
  };
  if (date !== null) candidate.date = date;
  return [candidate];
}

function documentLines(text: string, extraction?: ExtractedText): string[] {
  const spatialLines = extraction?.layout
    ?.slice()
    .sort((a, b) => a.pageIndex - b.pageIndex)
    .flatMap((page) =>
      page.lines.slice().sort((a, b) => {
        const aTop = a.boundingBox?.top ?? 0;
        const bTop = b.boundingBox?.top ?? 0;
        return aTop - bTop;
      }),
    )
    .map((line) => line.text.trim())
    .filter((line) => line.length > 0);
  const source = spatialLines && spatialLines.length > 0 ? spatialLines : text.split(/\r?\n/u);
  return source.map((line) => line.replace(/\s+/gu, ' ').trim()).filter((line) => line.length > 0);
}

function receiptTotalScore(line: string): number {
  const normalized = line
    .toLowerCase()
    .replace(/[^a-z]+/gu, ' ')
    .trim();
  if (
    /\b(?:subtotal|sub total|total savings?|total discount|total vat|tax total)\b/u.test(normalized)
  ) {
    return 0;
  }
  if (/\b(?:change|cash tendered|cash received|tip|gratuity)\b/u.test(normalized)) return 0;
  if (/\b(?:grand total|amount paid|total paid|card total)\b/u.test(normalized)) return 100;
  if (/^(?:total|balance due|amount due)\b/u.test(normalized)) return 80;
  if (/\btotal\b/u.test(normalized)) return 60;
  return 0;
}

function moneyValues(line: string): number[] {
  const matches = line.matchAll(/(?:GBP\s*|Â£\s*|£\s*)?(-?\d[\d,]*(?:[.,]\d{2}))(?!\d)/giu);
  const values: number[] = [];
  for (const match of matches) {
    const raw = match[1];
    if (raw === undefined) continue;
    const normalized = raw.includes('.')
      ? raw.replace(/,/gu, '')
      : raw.replace(/\.(?=\d{3}(?:\D|$))/gu, '').replace(',', '.');
    const value = Math.abs(Number(normalized));
    if (Number.isFinite(value)) values.push(value);
  }
  return values;
}

function receiptMerchant(lines: readonly string[]): string | null {
  for (const line of lines.slice(0, 10)) {
    if (!/[A-Za-z]{2}/u.test(line) || moneyValues(line).length > 0) continue;
    if (
      /\b(?:receipt|invoice|tax|vat|date|time|tel|phone|www|http|cashier|served by|transaction|merchant id|terminal|store no)\b/iu.test(
        line,
      )
    ) {
      continue;
    }
    if (/^\d+[\s,].*(?:road|street|lane|avenue|way|drive|postcode)\b/iu.test(line)) continue;
    const cleaned = cleanMerchantName(line.replace(/[^\p{L}\p{N}&' .-]+/gu, ' ').trim());
    if (cleaned.length >= 2) return cleaned.slice(0, 80);
  }
  return null;
}

function explicitReceiptDate(lines: readonly string[]): string | null {
  const text = lines.join(' ');
  const candidates = [
    /\b(\d{4})-(\d{2})-(\d{2})\b/u.exec(text),
    /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/u.exec(text),
  ];
  const iso = candidates[0];
  if (iso?.[1] !== undefined && iso[2] !== undefined && iso[3] !== undefined) {
    return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const dmy = candidates[1];
  if (dmy?.[1] !== undefined && dmy[2] !== undefined && dmy[3] !== undefined) {
    const year = Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return validDate(year, Number(dmy[2]), Number(dmy[1]));
  }
  return null;
}

function validDate(year: number, month: number, day: number): string | null {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}

function stableFingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
