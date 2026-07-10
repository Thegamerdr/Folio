// Statement reader — turns a photographed/scanned statement into clean structured transactions.
//
// WHY THIS EXISTS. On-device ML Kit OCR (src/local/nativeTextExtraction.ts) returns messy text,
// and parseImportFile only reliably handles tidy CSV/OFX/QIF or clean "date  merchant  amount"
// lines — so real photos and PDFs yield nothing and the user ends up typing every line by hand.
// This client hands the statement to a multimodal model (Gemini, via Folio's own keyless gateway)
// which reads the image (or, for PDFs, the OCR text) and returns clean transactions. Those flow
// into the EXISTING "check what Folio found" review screen for a one-glance confirm — never
// auto-committed, because reviewing AI-read money is the honest design.
//
// KEYLESS BY DESIGN. Mirrors meloAiClient.ts exactly: this holds NO provider key. It talks to the
// same Cloudflare Worker gateway (services/ai-gateway) using the same env vars
// (EXPO_PUBLIC_MELO_GATEWAY_URL + EXPO_PUBLIC_MELO_GATEWAY_TOKEN) and the same
// x-folio-gateway-token header. The gateway holds the OpenRouter key server-side and forwards the
// OpenAI-compatible body — including multimodal content arrays — unchanged.
//
// NEVER THROWS for the expected failure modes. No gateway configured -> 'no-provider' (the caller
// falls back to OCR-text parsing or manual entry). Network/HTTP/JSON failure -> 'error'. Money is
// returned in INTEGER MINOR units (pence); the model is asked for major units and we convert.

import { resolveMeloAiProviderConfig } from './meloAiClient';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** One transaction the model read off the statement. amountMinor is INTEGER pence, always > 0;
 *  the sign lives in `direction` so callers never have to re-derive it. */
export type ExtractedStatementTxn = Readonly<{
  /** Normalised calendar date, YYYY-MM-DD. */
  dateIso: string;
  /** Merchant / description text, trimmed and non-empty. */
  merchant: string;
  /** Absolute amount in integer minor units (pence). Always positive. */
  amountMinor: number;
  /** 'spend' = money out (model returned a negative), 'income' = money in (positive). */
  direction: 'spend' | 'income';
}>;

export type StatementExtractionResult = Readonly<{
  status: 'ok' | 'no-provider' | 'error';
  transactions: readonly ExtractedStatementTxn[];
  /** Length of the model's parsed array BEFORE per-item validation. Lets the review screen say
   *  "Folio read N lines, kept M" honestly when some were dropped. 0 for non-ok results. */
  rawCount: number;
}>;

export type StatementExtractionInput = Readonly<{
  /** Base64 of the statement image (no data: prefix). When present, the vision path is used. */
  imageBase64?: string;
  /** MIME type for the image (e.g. 'image/jpeg', 'image/png'). Defaults to image/jpeg. */
  imageMimeType?: string;
  /** Pre-extracted text (e.g. OCR of a PDF). Used only when imageBase64 is absent. */
  text?: string;
}>;

export type StatementExtractionOptions = Readonly<{
  signal?: AbortSignal;
}>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MINOR_UNITS_PER_MAJOR = 100;
const REQUEST_TIMEOUT_MS = 30_000;
/** Cap how much OCR text we send so a huge multi-page dump can't blow the request up. */
const MAX_TEXT_CHARS = 24_000;
const DEFAULT_IMAGE_MIME = 'image/jpeg';

const PROMPT = [
  'You are reading a single bank or card statement.',
  'Extract every transaction line you can see.',
  'Return ONLY a strict JSON array — no prose, no explanation, no markdown code fences.',
  'Each array item is an object with EXACTLY these keys:',
  '  "date": the transaction date as a "YYYY-MM-DD" string,',
  '  "merchant": the merchant or description as a string,',
  '  "amount": a number in major currency units (pounds), NEGATIVE for money out (a payment,',
  '            purchase, or debit) and POSITIVE for money in (a credit, refund, or deposit).',
  'Do not include running balances, headers, totals, or interest summaries as transactions.',
  'If you cannot find any transactions, return an empty array: []',
].join('\n');

// ---------------------------------------------------------------------------
// Wire types (OpenAI-compatible, multimodal)
// ---------------------------------------------------------------------------

type TextContentPart = Readonly<{ type: 'text'; text: string }>;
type ImageContentPart = Readonly<{ type: 'image_url'; image_url: Readonly<{ url: string }> }>;
type VisionUserMessage = Readonly<{
  role: 'user';
  content: ReadonlyArray<TextContentPart | ImageContentPart>;
}>;
type TextUserMessage = Readonly<{ role: 'user'; content: string }>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read a statement (image or OCR text) into clean transactions via the multimodal gateway.
 *  Never throws for expected failures — returns a discriminated status the caller branches on. */
export async function extractStatementTransactions(
  input: StatementExtractionInput,
  opts?: StatementExtractionOptions,
): Promise<StatementExtractionResult> {
  const config = resolveMeloAiProviderConfig();
  if (!config.configured) {
    return { status: 'no-provider', transactions: [], rawCount: 0 };
  }

  const message = buildUserMessage(input);
  if (message === null) {
    // Nothing to read (neither an image nor any text). Treat as a clean empty result, not an error.
    return { status: 'ok', transactions: [], rawCount: 0 };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.token !== undefined) {
    headers['x-folio-gateway-token'] = config.token;
  }
  // Anonymous install id for the gateway's abuse metering. Lazily imported so this module stays
  // Node-safe for its tests (deviceId pulls expo modules); any failure omits the header and the
  // gateway falls back to its coarser IP backstop.
  try {
    const { getDeviceId } = await import('./deviceId');
    const deviceId = await getDeviceId();
    if (deviceId !== null) headers['x-folio-device'] = deviceId;
  } catch {
    /* header omitted. */
  }

  // Own timeout so a stuck request can't hang the review flow, while still honouring a
  // caller-supplied abort signal. Whichever fires first wins.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = (): void => controller.abort();
  if (opts?.signal) {
    if (opts.signal.aborted) {
      controller.abort();
    } else {
      opts.signal.addEventListener('abort', onCallerAbort);
    }
  }

  try {
    const response = await fetch(`${config.gatewayUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [message],
        // Low temperature: this is extraction, not creativity.
        temperature: 0,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { status: 'error', transactions: [], rawCount: 0 };
    }

    const data: unknown = await response.json();
    const rawReply = extractAssistantText(data);
    if (rawReply === null) {
      return { status: 'error', transactions: [], rawCount: 0 };
    }

    const parsedArray = parseJsonArray(rawReply);
    if (parsedArray === null) {
      return { status: 'error', transactions: [], rawCount: 0 };
    }

    const transactions = parsedArray
      .map(toExtractedTxn)
      .filter((txn): txn is ExtractedStatementTxn => txn !== null);

    return { status: 'ok', transactions, rawCount: parsedArray.length };
  } catch {
    // Network failure, abort, or anything unexpected — all collapse to a non-fatal 'error'.
    return { status: 'error', transactions: [], rawCount: 0 };
  } finally {
    clearTimeout(timeoutId);
    if (opts?.signal) {
      opts.signal.removeEventListener('abort', onCallerAbort);
    }
  }
}

// ---------------------------------------------------------------------------
// Request building
// ---------------------------------------------------------------------------

function buildUserMessage(
  input: StatementExtractionInput,
): VisionUserMessage | TextUserMessage | null {
  const imageBase64 = input.imageBase64?.trim();
  if (imageBase64 !== undefined && imageBase64.length > 0) {
    const mime = input.imageMimeType?.trim() || DEFAULT_IMAGE_MIME;
    const dataUri = 'data:' + mime + ';base64,' + imageBase64;
    return {
      role: 'user',
      content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: dataUri } },
      ],
    };
  }

  const text = input.text?.trim();
  if (text !== undefined && text.length > 0) {
    const capped = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
    return { role: 'user', content: PROMPT + '\n\n' + capped };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function extractAssistantText(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  const content = first?.message?.content;
  return typeof content === 'string' ? content : null;
}

/** Strip any leading/trailing markdown code fences, then JSON.parse and require an array. */
function parseJsonArray(reply: string): unknown[] | null {
  const cleaned = stripCodeFences(reply);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  return Array.isArray(parsed) ? parsed : null;
}

/** Remove a wrapping ```json … ``` (or bare ``` … ```) fence if the model added one. */
function stripCodeFences(reply: string): string {
  const trimmed = reply.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  // Drop the opening fence line (``` or ```json) and the closing fence.
  const withoutOpen = trimmed.replace(/^```[a-zA-Z0-9]*\s*\n?/, '');
  const withoutClose = withoutOpen.replace(/\n?```\s*$/, '');
  return withoutClose.trim();
}

/** Validate one parsed entry into an ExtractedStatementTxn, or null to drop it. */
function toExtractedTxn(entry: unknown): ExtractedStatementTxn | null {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null;
  const candidate = entry as { date?: unknown; merchant?: unknown; amount?: unknown };

  const dateIso = normaliseDate(candidate.date);
  if (dateIso === null) return null;

  const merchant = typeof candidate.merchant === 'string' ? candidate.merchant.trim() : '';
  if (merchant.length === 0) return null;

  const amount = candidate.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) return null;

  const amountMinor = Math.round(Math.abs(amount) * MINOR_UNITS_PER_MAJOR);
  if (amountMinor === 0) return null;

  return {
    dateIso,
    merchant,
    amountMinor,
    direction: amount < 0 ? 'spend' : 'income',
  };
}

/** Accept a date the model returned and normalise it to YYYY-MM-DD, or null if unparseable. */
function normaliseDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Fast path: already a clean YYYY-MM-DD. Validate it is a real calendar date.
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const parsed = new Date(trimmed + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime())) return null;
    // Reject roll-overs like 2026-02-31 -> March by round-tripping.
    return toIsoDate(parsed) === trimmed ? trimmed : null;
  }

  // Fallback: let Date try, then re-emit canonical YYYY-MM-DD.
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toIsoDate(parsed);
}

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
