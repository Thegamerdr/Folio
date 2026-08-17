/**
 * Launch currency boundary.
 *
 * Melo's first public release is GBP-only. Missing account currency is treated as GBP for
 * backwards compatibility, but an explicit foreign or malformed currency must never be converted
 * by deleting its symbol and pretending the number is pounds.
 */
export const LAUNCH_CURRENCY = 'GBP' as const;

const GBP_ALIASES = new Set(['GBP', '£', 'STERLING', 'POUND', 'POUNDS', 'BRITISH POUND']);

const KNOWN_ISO_CURRENCIES = new Set([
  'GBP',
  'EUR',
  'USD',
  'CAD',
  'AUD',
  'NZD',
  'CHF',
  'JPY',
  'CNY',
  'RMB',
  'INR',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'RON',
  'TRY',
  'AED',
  'ZAR',
  'NGN',
]);

const SYMBOL_LABELS: Readonly<Record<string, string>> = {
  $: '$ currency',
  '€': 'EUR',
  '¥': 'yen currency',
  '₹': 'INR',
  '₽': 'RUB',
  '₩': 'KRW',
  '₺': 'TRY',
  '₴': 'UAH',
  '₦': 'NGN',
  '₫': 'VND',
  '฿': 'THB',
};

export class UnsupportedLaunchCurrencyError extends Error {
  readonly currency: string;

  constructor(currency: string) {
    super(
      `Melo launches in GBP only. ${currency} cannot be added until multi-currency support is available.`,
    );
    this.name = 'UnsupportedLaunchCurrencyError';
    this.currency = currency;
  }
}

/** Undefined is the legacy GBP shape. Blank or malformed explicit values are not GBP. */
export function normalizedCurrencyCode(value: unknown): string | null {
  if (value === undefined || value === null) return LAUNCH_CURRENCY;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized.length === 0) return null;
  if (GBP_ALIASES.has(normalized)) return LAUNCH_CURRENCY;
  return normalized;
}

export function isLaunchCurrency(value: unknown): boolean {
  return normalizedCurrencyCode(value) === LAUNCH_CURRENCY;
}

export function assertLaunchCurrency(value: unknown): typeof LAUNCH_CURRENCY {
  const normalized = normalizedCurrencyCode(value);
  if (normalized !== LAUNCH_CURRENCY) {
    throw new UnsupportedLaunchCurrencyError(normalized ?? 'an unknown currency');
  }
  return LAUNCH_CURRENCY;
}

export function displayCurrency(value: unknown): string {
  return normalizedCurrencyCode(value) ?? 'unknown currency';
}

export type UnsupportedCurrencyDetection = Readonly<{
  label: string;
  source: 'currency-column' | 'amount-cell' | 'document';
}>;

/** Detect an explicit foreign currency in one structured import row. Bare numbers remain GBP. */
export function detectUnsupportedRowCurrency(
  input: Readonly<{
    currencyCell?: string;
    amountCells: readonly (string | undefined)[];
  }>,
): UnsupportedCurrencyDetection | null {
  if (input.currencyCell !== undefined) {
    const detected = currencyLabel(input.currencyCell, true);
    if (detected !== null && detected !== LAUNCH_CURRENCY) {
      return { label: detected, source: 'currency-column' };
    }
  }

  for (const cell of input.amountCells) {
    if (cell === undefined) continue;
    const detected = currencyLabel(cell, false);
    if (detected !== null && detected !== LAUNCH_CURRENCY) {
      return { label: detected, source: 'amount-cell' };
    }
  }
  return null;
}

/**
 * Conservative unstructured-document check. An explicit account/statement currency wins. Without
 * one, a foreign symbol must appear on two money-like lines unless the caller knows the document is
 * a receipt/invoice, where one total is enough.
 */
export function detectUnsupportedDocumentCurrency(
  text: string,
  options: Readonly<{ singleMoneySymbolIsEnough?: boolean }> = {},
): UnsupportedCurrencyDetection | null {
  const declaration =
    /\b(?:account\s+currency|statement\s+currency|currency(?:\s+code)?|denominated\s+in|amounts?\s+in)\s*[:\-]?\s*(GBP|EUR|USD|CAD|AUD|NZD|CHF|JPY|CNY|RMB|INR|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|AED|ZAR|NGN|sterling|pounds?)\b/iu.exec(
      text,
    )?.[1];
  if (declaration !== undefined) {
    const label = currencyLabel(declaration, true);
    if (label === LAUNCH_CURRENCY) return null;
    if (label !== null) return { label, source: 'document' };
  }

  const euroWords =
    /\b(?:euros?|US\s+dollars?|Canadian\s+dollars?|Australian\s+dollars?|Swiss\s+francs?|Japanese\s+yen)\b/iu.exec(
      text,
    )?.[0];
  if (euroWords !== undefined) {
    return { label: euroWords, source: 'document' };
  }

  const hits = new Map<string, number>();
  for (const line of text.split(/\r?\n/gu)) {
    if (!/\d[\d,.]*[.,]\d{2}/u.test(line)) continue;
    const label = currencyLabel(line, false);
    if (label === null || label === LAUNCH_CURRENCY) continue;
    hits.set(label, (hits.get(label) ?? 0) + 1);
  }
  const threshold = options.singleMoneySymbolIsEnough === true ? 1 : 2;
  const hit = [...hits.entries()].find(([, count]) => count >= threshold);
  return hit === undefined ? null : { label: hit[0], source: 'document' };
}

function currencyLabel(raw: string, wholeCell: boolean): string | null {
  const normalized = raw.trim().toUpperCase();
  if (normalized.length === 0) return null;
  if (GBP_ALIASES.has(normalized)) return LAUNCH_CURRENCY;

  for (const [symbol, label] of Object.entries(SYMBOL_LABELS)) {
    if (raw.includes(symbol)) return label;
  }

  const iso = /\b([A-Z]{3})\b/giu;
  for (const match of raw.matchAll(iso)) {
    const code = match[1]?.toUpperCase();
    if (code !== undefined && KNOWN_ISO_CURRENCIES.has(code)) {
      return code === LAUNCH_CURRENCY ? LAUNCH_CURRENCY : code;
    }
  }

  if (!wholeCell) return null;
  if (/^(?:EUROS?|EURO)$/iu.test(raw)) return 'EUR';
  if (/^(?:US\s+)?DOLLARS?$/iu.test(raw)) return 'USD';
  return normalized;
}
