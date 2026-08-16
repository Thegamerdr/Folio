// Merchant-name cleaner for imported statement/photo rows.
//
// PURE module — NO react-native / expo / store imports — so it is unit-testable in plain Node and
// safe to call from the parse core (`statementReaderParse.ts`). It turns a raw bank transaction
// string into a human-readable merchant name for DISPLAY, WITHOUT changing the amount, date, or sign.
//
// It only ever REMOVES bank noise (transaction-type prefixes, trailing reference/account codes,
// duplicated payee names) — it never invents a name. If cleaning would empty the string, the original
// (trimmed) input is returned, so a row can never lose its identity. This is display polish, not
// truth: the review-before-truth discipline is unchanged (the user still confirms every row).
//
// Grounded in REAL strings seen on-device (2026-07-06): "Mb Andrea Nsiah", "FPS, Andrea Nsiah,
// Andrea Nsiah", "Fintern Ltd Abound Vwr5Ojsd 60000149034405", "TESCO STORES 3829",
// "STANDING ORDER LANDLORD".

/** Multi-word transaction-type phrases banks prepend (checked before the single-token codes so the
 *  longer match wins). Lower-case; matched case-insensitively as a leading phrase. */
const LEAD_PHRASES: readonly string[] = [
  'standing order',
  'direct debit',
  'faster payment',
  'card payment',
  'bill payment',
  'bank giro credit',
  'payment to',
  'payment from',
  'transfer to',
  'transfer from',
];

/** STRONG transaction-type codes — these are never a real merchant's first word, so they are safe to
 *  strip even when only a SPACE separates them from the payee (e.g. "FPS Andrea Nsiah", "Mb Andrea"). */
const STRONG_CODES: readonly string[] = [
  'fps',
  'fpo',
  'fpi',
  'bacs',
  'bgc',
  'chaps',
  'tfr',
  'trf',
  'sto',
  'pmt',
  'crd',
  'mb',
];

/** WEAK codes that ALSO collide with real short brand names ("BP" fuel, "So Energy", "DD", "POS…").
 *  Only stripped when a bank DELIMITER (comma/colon/slash/asterisk) proves it's a prefix — a plain
 *  space is too ambiguous to risk mangling a brand (e.g. "BP Garage London" must survive verbatim). */
const WEAK_CODES: readonly string[] = ['bp', 'so', 'dd', 'dr', 'cr', 'pos', 'atm', 'mob', 'fp'];

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Strip one leading transaction-type phrase or code if present. Returns the input unchanged when
 *  nothing matches, or when stripping would leave nothing (a bare code IS the whole string).
 *
 *  Brand-safety: a WEAK code (BP/So/DD…) is only stripped when a bank DELIMITER (`,` `:` `/` `*`)
 *  separates it from the payee — a plain space is left alone so "BP Garage London" / "So Energy"
 *  survive verbatim. STRONG codes (FPS/BACS/Mb…) strip on a space too, since they never name a real
 *  business. Codes never match inside a real word ("Sofa"/"Doddle" survive — a separator or space is
 *  required after the code). */
function stripLeadingCode(input: string): string {
  for (const phrase of LEAD_PHRASES) {
    const re = new RegExp(`^${escapeRe(phrase)}\\b[\\s,:/*-]*`, 'i');
    if (re.test(input)) {
      const next = input.replace(re, '').trim();
      if (next.length > 0) return next;
    }
  }
  // Any code (strong OR weak) followed by a bank delimiter is an unambiguous prefix.
  for (const code of [...STRONG_CODES, ...WEAK_CODES]) {
    const re = new RegExp(`^${escapeRe(code)}\\s*[,:/*]\\s*`, 'i');
    if (re.test(input)) {
      const next = input.replace(re, '').trim();
      if (next.length > 0) return next;
    }
  }
  // Strong codes only: also strip when just whitespace separates the code from the payee.
  for (const code of STRONG_CODES) {
    const re = new RegExp(`^${escapeRe(code)}\\s+`, 'i');
    if (re.test(input)) {
      const next = input.replace(re, '').trim();
      if (next.length > 0) return next;
    }
  }
  return input;
}

/** Strip one trailing reference/account token if present: a pure-digit run (≥4) or a random-looking
 *  mixed alphanumeric reference (≥5 chars containing at least one digit AND one letter, e.g.
 *  "Vwr5Ojsd"). Conservative: a plain word (no digit) is never stripped, so real names survive. */
function stripTrailingRef(input: string): string {
  const pureDigits = input.replace(/[\s,]+\d{4,}$/, '').trim();
  if (pureDigits !== input && pureDigits.length > 0) return pureDigits;

  const mixed = input.match(/[\s,]+([A-Za-z0-9]{5,})$/);
  if (mixed) {
    const token = mixed[1];
    if (token !== undefined && /\d/.test(token) && /[A-Za-z]/.test(token)) {
      const next = input.slice(0, mixed.index).trim();
      if (next.length > 0) return next;
    }
  }
  return input;
}

/** Collapse a payee name the bank duplicated (comma-separated), e.g. "Andrea Nsiah, Andrea Nsiah" →
 *  "Andrea Nsiah". Only collapses consecutive parts that are equal ignoring case. */
function collapseRepeatedName(input: string): string {
  if (!input.includes(',')) return input;
  const parts = input
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const deduped: string[] = [];
  for (const part of parts) {
    const prev = deduped[deduped.length - 1];
    if (prev === undefined || prev.toLowerCase() !== part.toLowerCase()) deduped.push(part);
  }
  return deduped.join(', ');
}

/** Title-case a string that is ALL-CAPS bank text (e.g. "TESCO STORES" → "Tesco Stores",
 *  "UTILITY CO" → "Utility Co"). Leaves already-mixed-case names untouched (so "Andrea Nsiah",
 *  "iCloud", "Fintern Ltd Abound" survive). Only runs when the whole string is caps/digits — a real
 *  row merchant is never a bare acronym, so the minor cost ("BP" → "Bp") is not worth special-casing. */
function normaliseCase(input: string): string {
  const hasLower = /[a-z]/.test(input);
  if (hasLower) return input;
  return input
    .split(' ')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

/**
 * Clean a raw bank merchant string into a human-readable display name.
 *
 * Pipeline (each step only REMOVES noise): normalise whitespace → strip leading transaction-type
 * codes/phrases (looped, ≤3) → strip trailing reference/account tokens (looped, ≤3) → collapse a
 * duplicated payee name → trim stray separators → title-case ALL-CAPS text. If the result is empty
 * or a single character, the original trimmed input is returned — a row never loses its name.
 */
export function cleanMerchantName(raw: string): string {
  if (typeof raw !== 'string') return '';
  const original = raw.trim();
  if (original.length === 0) return '';

  let s = original.replace(/\s+/g, ' ');

  for (let i = 0; i < 3; i++) {
    const next = stripLeadingCode(s);
    if (next === s) break;
    s = next;
  }
  for (let i = 0; i < 3; i++) {
    const next = stripTrailingRef(s);
    if (next === s) break;
    s = next;
  }

  s = collapseRepeatedName(s);
  s = s
    .replace(/^[\s,:/*-]+/, '')
    .replace(/[\s,:/*-]+$/, '')
    .trim();
  s = normaliseCase(s);

  return s.length >= 2 ? s : original;
}
