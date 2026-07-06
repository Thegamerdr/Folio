// LLM statement / photo reader client — turns a picked statement file or photo into Review
// CANDIDATES.
//
// WHY THIS EXISTS. On-device OCR (src/local/nativeTextExtraction.ts) returns messy text and the
// sheet/import engines only reliably parse tidy CSV or clean "date  merchant  amount" lines — so a
// real PDF statement or a photographed statement yields nothing and the user re-keys every row by
// hand. This client hands the file to a multimodal model (Gemini, via Folio's own keyless gateway)
// which reads the page and returns every money movement. Those flow into the EXISTING "check what
// Folio found" Review screen as `CandidateMoneyItem[]`.
//
// REVIEW-BEFORE-TRUTH (POSITIONING.md). The reader's output is CANDIDATES ONLY — never a posted
// fact, never auto-counted. Every produced candidate carries the LOWEST confidence ('low') so the
// Review screen treats it as tentative and the user confirms each row before it becomes a
// transaction. We never fabricate a row the model did not return.
//
// KEYLESS BY DESIGN. Mirrors meloAiClient.ts / statementExtraction.ts exactly: this holds NO
// provider key. It talks to the same Cloudflare Worker gateway (services/ai-gateway) using the same
// env vars (EXPO_PUBLIC_MELO_GATEWAY_URL + EXPO_PUBLIC_MELO_GATEWAY_TOKEN) and the same
// `x-folio-gateway-token` header. The gateway holds the OpenRouter key server-side and forwards the
// OpenAI-compatible body — including multimodal content arrays and OpenRouter file parts —
// unchanged.
//
// NEVER THROWS for the expected failure modes. No gateway configured -> 'no-provider' (the caller
// falls back to OCR/manual). Network / HTTP / JSON / read failure -> 'error' with a short, honest
// message. Cancellation (the caller's AbortSignal) collapses to 'error' too, so an aborted read
// never rejects.
//
// CHUNKED READING (long PDF exports). `extractStatementCandidates` alone can't finish a long
// multi-page export in one request: ground truth from the live gateway (2026-07-05/06) is that a
// 133-page/1.28MB Monzo export never returns in one pass (the model generates for minutes past any
// sane timeout). Two chunking strategies were tested against the live gateway with that same real
// PDF before picking an approach — see `extractStatementCandidatesChunked` below for the measured
// numbers and the reasoning for why byte-level page splitting (not an instruction like "only pages
// 1-15") is the one that actually works.

import * as FileSystem from 'expo-file-system/legacy';

import type { CandidateMoneyItem, CandidateSource } from '@/folio/lib/importSheet';

import { isMeloAiConfigured, resolveMeloAiProviderConfig } from './meloAiClient';
import {
  PAGES_PER_CHUNK,
  UnsplittablePdfError,
  base64ToBinaryString,
  binaryStringToBase64,
  buildPdfChunkAt,
  planPdfChunks,
} from './pdfChunkSplitter';
import { parseStatementReaderResult, type StatementClosingBalance } from './statementReaderParse';
import { mergeChunkCandidates } from './statementReaderDedup';

// Re-export the PURE parser so callers (and the colocated test) have one public surface. The parser
// itself lives in statementReaderParse.ts — with no expo imports — so it can be unit-tested in plain
// Node WITHOUT loading this module (which pulls in expo-file-system).
export { parseCandidatesFromModelJson, type StatementClosingBalance } from './statementReaderParse';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** What kind of thing the user picked. `image` = a photo / screenshot of a statement (vision part);
 *  `pdf` = a statement document (OpenRouter file part). */
export type StatementReaderKind = 'pdf' | 'image';

export type StatementReaderInput = Readonly<{
  /** File URI of the picked document or image (the copyToCacheDirectory URI from a picker). */
  uri: string;
  /** MIME type reported by the picker (e.g. 'image/jpeg', 'image/png', 'application/pdf'). */
  mediaType: string;
  kind: StatementReaderKind;
  /** Optional abort signal so the caller can cancel an in-flight read. */
  signal?: AbortSignal;
}>;

/** Discriminated result the caller branches on. `ok` carries candidates for Review, plus the
 *  statement's closing balance when the model returned one (`null` otherwise — never fabricated;
 *  see statementReaderParse.ts's `StatementClosingBalance`). `no-provider` means the gateway isn't
 *  configured (fall back to OCR/manual); `error` carries a short message. */
export type StatementReadResult =
  | Readonly<{
      kind: 'ok';
      candidates: CandidateMoneyItem[];
      closingBalance: StatementClosingBalance | null;
    }>
  | Readonly<{ kind: 'no-provider' }>
  | Readonly<{ kind: 'error'; message: string }>;

// ---------------------------------------------------------------------------
// Chunked reading — public types
// ---------------------------------------------------------------------------

/** One progress tick the chunked reader reports after EACH chunk finishes (success or failure), so
 *  the caller can show honest "reading pages… N of M" copy. `chunkIndex` is 0-based; `chunkCount`
 *  is the total planned chunk count (known up front — see planPdfChunks). */
export type StatementReaderChunkProgress = Readonly<{
  chunkIndex: number;
  chunkCount: number;
  startPage: number;
  endPage: number;
  totalPages: number;
  /** Whether THIS chunk's read succeeded. A failed chunk does not stop the run — see
   *  extractStatementCandidatesChunked's per-chunk failure tolerance. */
  ok: boolean;
}>;

/** One chunk's outcome, kept for the final coverage report — which page range read cleanly vs
 *  failed, so a partial result can honestly say what it covers and what it doesn't. */
export type StatementReaderChunkOutcome = Readonly<{
  startPage: number;
  endPage: number;
  ok: boolean;
  /** Present only when ok is false — a short, honest reason for Review-screen / toast copy. */
  errorMessage?: string;
}>;

/**
 * Discriminated result for the CHUNKED reader.
 *  - `ok`: every chunk read cleanly. `candidates` is the de-duplicated merge across all chunks.
 *  - `partial`: at least one chunk failed but at least one other chunk produced candidates — never
 *    silently missing data: `coverage` lists exactly which page ranges succeeded/failed so the
 *    caller can tell the user honestly what was and wasn't read (review-before-truth extends to
 *    coverage, not just to each row).
 *  - `no-provider` / `error`: same meaning as the single-shot result — nothing was read at all.
 */
export type StatementReadChunkedResult =
  | Readonly<{
      kind: 'ok';
      candidates: CandidateMoneyItem[];
      coverage: StatementReaderChunkOutcome[];
    }>
  | Readonly<{
      kind: 'partial';
      candidates: CandidateMoneyItem[];
      coverage: StatementReaderChunkOutcome[];
    }>
  | Readonly<{ kind: 'no-provider' }>
  | Readonly<{ kind: 'error'; message: string }>;

export type StatementReaderChunkedInput = Readonly<{
  uri: string;
  mediaType: string;
  /** Chunked reading is PDF-only — splitting relies on real PDF page structure (see
   *  pdfChunkSplitter.ts). A photographed statement never needs chunking (one photo = one page). */
  kind: 'pdf';
  signal?: AbortSignal;
  /** Called after EACH chunk finishes (success or failure) with running progress. Optional —
   *  callers that only want the final result can omit it. */
  onProgress?: (progress: StatementReaderChunkProgress) => void;
}>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pin a vision-capable model in the body (the gateway forwards it verbatim). */
const VISION_MODEL = 'google/gemini-2.5-flash';
/** Own timeout so a stuck request can't hang the review flow. Applies per-request — a single-shot
 *  read AND each individual chunk request in the chunked path share this same ceiling, since a
 *  well-sized chunk (see PAGES_PER_CHUNK) reads in well under a minute even on a dense account. */
const REQUEST_TIMEOUT_MS = 45_000;
/**
 * Single-shot ceiling for picked PDFs. Ground truth from a real device test (2026-07-05): a
 * one-month statement (~25KB, 1 page) reads perfectly in ~5s; a 133-page/1.28MB full-history
 * export never returns in one request — the model generates for minutes and the request dies
 * long after the 45s timeout. Below this size we still take the simple single-shot path
 * (`extractStatementCandidates`); at or above it the caller should use the CHUNKED path
 * (`extractStatementCandidatesChunked`), which splits the PDF into real page-range chunks instead
 * of pre-flighting the read away. ~500KB ≈ up to roughly 15 text pages — comfortably a month or
 * three, which is the common case and needs no chunking overhead.
 */
export const MAX_STATEMENT_BYTES = 500 * 1024;
/**
 * Hard ceiling for ANY picked PDF, chunked or not. Above this we decline outright rather than
 * chunk indefinitely — an unbounded export (multi-year, hundreds of pages) would mean dozens of
 * sequential gateway round-trips (each ~15-35s, see extractStatementCandidatesChunked's doc
 * comment for measured per-chunk latency) for a single read, which is a bad user experience
 * regardless of whether it would eventually finish. 5MB is roughly 20x the single-shot ceiling —
 * generous headroom for a genuine multi-year history export while still bounding worst-case time.
 */
export const MAX_CHUNKED_STATEMENT_BYTES = 5 * 1024 * 1024;
/** Output budget per request (single-shot AND per-chunk). finish_reason 'length' → that request's
 *  statement/chunk had more rows than one pass can carry; we say so honestly instead of returning
 *  a silently truncated read. */
const MAX_COMPLETION_TOKENS = 16_384;

// EXTENDED (task: READER CLOSING BALANCE) to ALSO return the statement's closing balance + as-of
// date as separate top-level fields — items are unaffected either way. Confirmed live against the
// gateway (2026-07-06, monzo-small.pdf): the model reliably returns `closingBalance: 1.96,
// closingDate: "2021-03-31"` for that statement across repeated calls. `statementReaderParse.ts`'s
// `toClosingBalance` treats both fields as OPTIONAL and never fabricates a value when the model
// omits them (or returns an unusable shape) — see that function's doc.
const SYSTEM_PROMPT = [
  'You are a careful bank-statement reader.',
  'You are shown a bank or card statement (an image or a PDF, possibly several pages).',
  'Read every money movement on every page and return them as structured data.',
  'Return ONLY a JSON object with this exact shape — no commentary, no markdown, no code fences:',
  '{ "items": [ { "date": "YYYY-MM-DD" | null, "merchant": string, "amount": number, "category": string | null } ], "closingBalance": number | null, "closingDate": "YYYY-MM-DD" | null }',
  'Rules for each item:',
  '- "date": the transaction date as a "YYYY-MM-DD" string, or null if the page does not show one.',
  '- "merchant": the merchant or description text, trimmed.',
  '- "amount": a number in pounds (GBP). NEGATIVE for money out (a payment, purchase, debit, or fee)',
  '  and POSITIVE for money in (a credit, refund, deposit, or salary).',
  '- "category": a short category guess as a string, or null if you are unsure.',
  'Do NOT include running balances, opening/closing balances, headers, totals, or interest summaries',
  'inside "items".',
  'Separately, at the top level: "closingBalance" is the statement\'s CLOSING BALANCE (the final',
  'balance shown on the statement, in pounds), and "closingDate" is the ISO date that balance is',
  'as-of (usually the last day of the statement period). Set both to null if the statement does not',
  'clearly show a closing balance — never guess one.',
  'If you cannot find any money movements, return { "items": [] }.',
].join('\n');

const USER_TEXT_INSTRUCTION =
  'Extract every money movement from this statement. Return strictly the JSON object described — nothing else.';

// ---------------------------------------------------------------------------
// Wire types (OpenAI-compatible, multimodal; OpenRouter file part for PDFs)
// ---------------------------------------------------------------------------

type TextContentPart = Readonly<{ type: 'text'; text: string }>;
type ImageContentPart = Readonly<{ type: 'image_url'; image_url: Readonly<{ url: string }> }>;
type FileContentPart = Readonly<{
  type: 'file';
  file: Readonly<{ filename: string; file_data: string }>;
}>;
type UserContentPart = TextContentPart | ImageContentPart | FileContentPart;

// ---------------------------------------------------------------------------
// Shared single-request send (used by BOTH the single-shot path and each chunk of the chunked path)
// ---------------------------------------------------------------------------

/** Same discriminated shape as StatementReadResult, minus 'no-provider' (the caller checks
 *  configuration once, before ever calling this). Shared by the single-shot and per-chunk paths so
 *  both apply the exact same request, timeout, and response-parsing rules. Carries the closing
 *  balance too (see StatementReadResult's doc) — per-chunk reads also parse it, though only the
 *  single-shot caller surfaces it today (a chunked, multi-page read has no single obvious chunk to
 *  trust for a whole-statement closing balance, so extractStatementCandidatesChunked intentionally
 *  does not thread it through — see that function's own doc). */
type SingleRequestResult =
  | Readonly<{
      kind: 'ok';
      candidates: CandidateMoneyItem[];
      closingBalance: StatementClosingBalance | null;
    }>
  | Readonly<{ kind: 'error'; message: string; timedOut: boolean }>;

/** Send ONE gateway request for a base64 PDF/image payload and parse the reply into candidates.
 *  Owns its own timeout merged with the caller's abort signal (whichever fires first wins), exactly
 *  like the original single-shot function did — shared here so the chunked path's per-chunk
 *  requests get identical timeout/cancel/finish-reason handling. */
async function sendStatementReadRequest(args: {
  gatewayUrl: string;
  token: string | undefined;
  kind: StatementReaderKind;
  mediaType: string;
  base64: string;
  source: CandidateSource;
  signal: AbortSignal | undefined;
}): Promise<SingleRequestResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onCallerAbort = (): void => controller.abort();
  if (args.signal) {
    if (args.signal.aborted) {
      controller.abort();
    } else {
      args.signal.addEventListener('abort', onCallerAbort);
    }
  }

  try {
    const content = buildUserContent(args.kind, args.mediaType, args.base64);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (args.token !== undefined) {
      headers['x-folio-gateway-token'] = args.token;
    }

    const response = await fetch(`${args.gatewayUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        // Extraction, not creativity.
        temperature: 0,
        stream: false,
        max_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        kind: 'error',
        message: `The reader gateway returned ${response.status}.`,
        timedOut: false,
      };
    }

    const data: unknown = await response.json();
    const rawReply = extractAssistantText(data);
    if (rawReply === null) {
      return { kind: 'error', message: 'The reader sent an unexpected response.', timedOut: false };
    }

    // A 'length' finish means this request had more rows than one pass can return — a silently
    // truncated read would be a lie (missing transactions look like missing spending). Refuse
    // honestly instead.
    if (extractFinishReason(data) === 'length') {
      return {
        kind: 'error',
        message: 'That read had more rows than one pass can carry.',
        timedOut: false,
      };
    }

    const { candidates, closingBalance } = parseStatementReaderResult(rawReply, args.source);
    return { kind: 'ok', candidates, closingBalance };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return timedOut
        ? { kind: 'error', message: 'Reading took too long.', timedOut: true }
        : { kind: 'error', message: 'Cancelled.', timedOut: false };
    }
    return { kind: 'error', message: "Couldn't read that just now.", timedOut: false };
  } finally {
    clearTimeout(timeoutId);
    if (args.signal) {
      args.signal.removeEventListener('abort', onCallerAbort);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read a picked statement file (PDF) or photo (image) into Review candidates via the multimodal
 * gateway. Never throws for the expected failure modes — returns a discriminated `StatementReadResult`.
 *
 * Single-shot only: a PDF above MAX_STATEMENT_BYTES is declined with guidance to use the chunked
 * reader instead (see `extractStatementCandidatesChunked`) rather than pre-flighting it away with
 * no path forward.
 */
export async function extractStatementCandidates(
  input: StatementReaderInput,
): Promise<StatementReadResult> {
  if (!isMeloAiConfigured()) {
    return { kind: 'no-provider' };
  }
  const config = resolveMeloAiProviderConfig();
  if (!config.configured) {
    return { kind: 'no-provider' };
  }

  // The source CandidateSource: a PDF the model read vs a photographed/screenshotted statement.
  const source: CandidateSource = input.kind === 'pdf' ? 'pdf' : 'photo';

  // Pre-flight: a full-history export can't be read in one pass (see MAX_STATEMENT_BYTES). Catch
  // it BEFORE the read/spinner rather than spinning for 45 seconds into a dead timeout. PDFs above
  // this size should go through extractStatementCandidatesChunked instead — this function stays
  // single-shot-only, so it declines rather than silently attempting a doomed read.
  if (input.kind === 'pdf') {
    const info = await FileSystem.getInfoAsync(input.uri);
    if (info.exists && typeof info.size === 'number' && info.size > MAX_STATEMENT_BYTES) {
      return {
        kind: 'error',
        message:
          'That looks like a long export — too much for one read. A one-month statement works best; most banks offer monthly PDFs.',
      };
    }
  }

  // Read the picked file as base64 (legacy expo-file-system API — mirrors nativeDataExport.ts /
  // nativeDocumentImport.ts). The bytes never leave the device except inside this one gateway call.
  const base64 = await FileSystem.readAsStringAsync(input.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (base64.trim().length === 0) {
    return { kind: 'error', message: "Couldn't read that file — it looked empty." };
  }

  const result = await sendStatementReadRequest({
    gatewayUrl: config.gatewayUrl,
    token: config.token,
    kind: input.kind,
    mediaType: input.mediaType,
    base64,
    source,
    signal: input.signal,
  });

  if (result.kind === 'ok') {
    return { kind: 'ok', candidates: result.candidates, closingBalance: result.closingBalance };
  }
  // Recover the single-shot-specific honest guidance for the two cases that most benefit from it
  // (long-export timeout, truncated read); every other error keeps the shared generic message.
  if (result.timedOut) {
    return {
      kind: 'error',
      message:
        'Reading took too long — that usually means a long export. A one-month statement works best.',
    };
  }
  if (result.message === 'That read had more rows than one pass can carry.') {
    return {
      kind: 'error',
      message:
        'That statement has more rows than one read can carry. Try a shorter export — one month works best.',
    };
  }
  if (result.message === "Couldn't read that just now.") {
    return { kind: 'error', message: "Couldn't read that statement just now." };
  }
  return { kind: 'error', message: result.message };
}

/**
 * Read a LONG PDF export by splitting it into real page-range chunks and reading them one at a
 * time. Built to replace the pre-flight-and-decline behaviour of `extractStatementCandidates` for
 * exports above MAX_STATEMENT_BYTES.
 *
 * WHY BYTE-LEVEL SPLITTING, NOT AN INSTRUCTION. Before writing this, two chunking strategies were
 * tested against the LIVE gateway with a real 133-page/1.28MB Monzo export:
 *  1. Send the FULL PDF every time, varying only a text instruction ("only pages 1-15" / "only
 *     pages 60-75" / "only pages 120-133"). Result: every call still cost ~34,600 prompt tokens
 *     (i.e. the model tokenized the WHOLE document regardless of the requested window — no real
 *     narrowing), took 70-100s per call (no faster than one giant read), and two of the three
 *     windows returned truncated/broken JSON (finish_reason 'length') while the third returned
 *     rows dated across a completely different range than requested — the model does not reliably
 *     respect an instructed page window. This approach is strictly worse than a single big read
 *     (same cost, same risk, MORE total latency across N chunks) and was rejected.
 *  2. Split the PDF's actual bytes into real page-range sub-documents (this file's
 *     pdfChunkSplitter.ts) and send EACH one as its own small PDF. Result on the SAME real
 *     document: an 8-page chunk shrank the payload from 1.28MB to ~70-100KB and prompt_tokens from
 *     ~34,600 to ~2,300 (about 15x smaller), reading in 13-36s per chunk with finish_reason 'stop'
 *     (no truncation) — even on this account's unusually dense transaction volume (a 15-page chunk
 *     of the SAME account overflowed the completion-token budget twice out of three tries; 8 pages
 *     never did across 6 chunks spanning the start, middle, and end of the document). This is the
 *     approach implemented below.
 *
 * SEQUENTIAL, NEVER PARALLEL. Chunks are read one at a time, in page order — cost and rate courtesy
 * to the shared gateway, and it lets onProgress report honest "N of M" copy as each one lands.
 *
 * DE-DUPE ACROSS BOUNDARIES. A transaction that visually sits on a page boundary can appear in two
 * adjacent chunks' reads; results are merged through `mergeChunkCandidates` (statementReaderDedup.ts),
 * which drops a later duplicate of the same date+amount+merchant rather than double-counting it.
 *
 * PER-CHUNK FAILURE TOLERANCE. If one chunk fails (network blip, timeout, unexpected reply) the run
 * does NOT abort — it keeps reading the remaining chunks and returns `kind: 'partial'` with a
 * `coverage` list naming exactly which page ranges succeeded and which didn't, so the caller can
 * tell the user honestly what was read instead of silently missing a month's worth of rows.
 */
export async function extractStatementCandidatesChunked(
  input: StatementReaderChunkedInput,
): Promise<StatementReadChunkedResult> {
  if (!isMeloAiConfigured()) {
    return { kind: 'no-provider' };
  }
  const config = resolveMeloAiProviderConfig();
  if (!config.configured) {
    return { kind: 'no-provider' };
  }

  const info = await FileSystem.getInfoAsync(input.uri);
  if (info.exists && typeof info.size === 'number' && info.size > MAX_CHUNKED_STATEMENT_BYTES) {
    return {
      kind: 'error',
      message: 'That export is too large to read, even in parts. A shorter export works best.',
    };
  }

  const base64 = await FileSystem.readAsStringAsync(input.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (base64.trim().length === 0) {
    return { kind: 'error', message: "Couldn't read that file — it looked empty." };
  }

  const binaryPdf = base64ToBinaryString(base64);

  let plan;
  try {
    plan = planPdfChunks(binaryPdf, PAGES_PER_CHUNK);
  } catch (error: unknown) {
    if (error instanceof UnsplittablePdfError) {
      return {
        kind: 'error',
        message: "That PDF isn't in a shape Folio can split. A one-month statement works best.",
      };
    }
    throw error;
  }

  const chunkCandidates: CandidateMoneyItem[][] = [];
  const coverage: StatementReaderChunkOutcome[] = [];
  // Tracks whether every planned range was actually attempted. A caller-triggered cancel
  // (input.signal) breaks the loop early — the chunks attempted so far may ALL have individually
  // succeeded, but that must still surface as 'partial' (not 'ok'), because the un-attempted pages
  // were never read at all. `coverage` only ever lists ATTEMPTED ranges (an un-attempted page isn't
  // a "failure", it's simply not covered), so completeness has to be tracked separately from
  // `coverage.every(ok)`.
  let allRangesAttempted = true;

  for (let chunkIndex = 0; chunkIndex < plan.ranges.length; chunkIndex++) {
    if (input.signal?.aborted) {
      allRangesAttempted = false;
      break;
    }

    const range = plan.ranges[chunkIndex];
    if (range === undefined) continue;

    let chunkResult: SingleRequestResult;
    try {
      const chunk = buildPdfChunkAt(binaryPdf, range.startPage, range.endPage);
      const chunkBase64 = binaryStringToBase64(chunk.bytes);
      chunkResult = await sendStatementReadRequest({
        gatewayUrl: config.gatewayUrl,
        token: config.token,
        kind: 'pdf',
        mediaType: input.mediaType,
        base64: chunkBase64,
        source: 'pdf',
        signal: input.signal,
      });
    } catch (error: unknown) {
      chunkResult = {
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not build that chunk.',
        timedOut: false,
      };
    }

    const ok = chunkResult.kind === 'ok';
    if (chunkResult.kind === 'ok') {
      chunkCandidates.push(chunkResult.candidates);
      coverage.push({ startPage: range.startPage, endPage: range.endPage, ok: true });
    } else {
      coverage.push({
        startPage: range.startPage,
        endPage: range.endPage,
        ok: false,
        errorMessage: chunkResult.message,
      });
    }

    input.onProgress?.({
      chunkIndex,
      chunkCount: plan.ranges.length,
      startPage: range.startPage,
      endPage: range.endPage,
      totalPages: plan.totalPages,
      ok,
    });
  }

  const candidates = mergeChunkCandidates(chunkCandidates);
  // Full coverage requires BOTH: every attempted chunk succeeded, AND every planned range was
  // attempted (a cancel that stops the loop early is incomplete coverage even if every chunk
  // attempted so far came back clean — see allRangesAttempted above).
  const allOk = allRangesAttempted && coverage.every((outcome) => outcome.ok);

  if (candidates.length === 0 && !allOk) {
    // Every chunk failed (or the run was aborted before any succeeded) and nothing was read at
    // all — this is an outright error, not a partial success with zero rows.
    return {
      kind: 'error',
      message: "Couldn't read that statement just now.",
    };
  }

  return { kind: allOk ? 'ok' : 'partial', candidates, coverage };
}

// ---------------------------------------------------------------------------
// Request building
// ---------------------------------------------------------------------------

/** Build the user message content array. An image goes in as an OpenAI `image_url` data URI; a PDF
 *  goes in as an OpenRouter `file` part with a `data:application/pdf;base64,…` payload. Both carry a
 *  text part with the strict-extraction instruction. */
function buildUserContent(
  kind: StatementReaderKind,
  mediaType: string,
  base64: string,
): UserContentPart[] {
  const textPart: TextContentPart = { type: 'text', text: USER_TEXT_INSTRUCTION };

  if (kind === 'pdf') {
    const filePart: FileContentPart = {
      type: 'file',
      file: {
        filename: 'statement.pdf',
        file_data: `data:application/pdf;base64,${base64}`,
      },
    };
    return [textPart, filePart];
  }

  const mime = mediaType.trim().length > 0 ? mediaType.trim() : 'image/jpeg';
  const imagePart: ImageContentPart = {
    type: 'image_url',
    image_url: { url: `data:${mime};base64,${base64}` },
  };
  return [textPart, imagePart];
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

function extractFinishReason(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const reason = (choices[0] as { finish_reason?: unknown } | undefined)?.finish_reason;
  return typeof reason === 'string' ? reason : null;
}

// `parseCandidatesFromModelJson` lives in ./statementReaderParse (pure, no expo imports) and is
// re-exported at the top of this file.
