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

import * as FileSystem from 'expo-file-system/legacy';

import type { CandidateMoneyItem, CandidateSource } from '@/folio/lib/importSheet';

import { isMeloAiConfigured, resolveMeloAiProviderConfig } from './meloAiClient';
import { parseCandidatesFromModelJson } from './statementReaderParse';

// Re-export the PURE parser so callers (and the colocated test) have one public surface. The parser
// itself lives in statementReaderParse.ts — with no expo imports — so it can be unit-tested in plain
// Node WITHOUT loading this module (which pulls in expo-file-system).
export { parseCandidatesFromModelJson } from './statementReaderParse';

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

/** Discriminated result the caller branches on. `ok` carries candidates for Review; `no-provider`
 *  means the gateway isn't configured (fall back to OCR/manual); `error` carries a short message. */
export type StatementReadResult =
  | Readonly<{ kind: 'ok'; candidates: CandidateMoneyItem[] }>
  | Readonly<{ kind: 'no-provider' }>
  | Readonly<{ kind: 'error'; message: string }>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pin a vision-capable model in the body (the gateway forwards it verbatim). */
const VISION_MODEL = 'google/gemini-2.0-flash-001';
/** Own timeout so a stuck request can't hang the review flow. */
const REQUEST_TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = [
  'You are a careful bank-statement reader.',
  'You are shown ONE page of a bank or card statement (an image or a PDF).',
  'Read every money movement on the page and return them as structured data.',
  'Return ONLY a JSON object with this exact shape — no commentary, no markdown, no code fences:',
  '{ "items": [ { "date": "YYYY-MM-DD" | null, "merchant": string, "amount": number, "category": string | null } ] }',
  'Rules for each item:',
  '- "date": the transaction date as a "YYYY-MM-DD" string, or null if the page does not show one.',
  '- "merchant": the merchant or description text, trimmed.',
  '- "amount": a number in pounds (GBP). NEGATIVE for money out (a payment, purchase, debit, or fee)',
  '  and POSITIVE for money in (a credit, refund, deposit, or salary).',
  '- "category": a short category guess as a string, or null if you are unsure.',
  'Do NOT include running balances, opening/closing balances, headers, totals, or interest summaries.',
  'If you cannot find any money movements, return { "items": [] }.',
].join('\n');

const USER_TEXT_INSTRUCTION =
  'Extract every money movement from this statement page. Return strictly the JSON object described — nothing else.';

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
// Public API
// ---------------------------------------------------------------------------

/**
 * Read a picked statement file (PDF) or photo (image) into Review candidates via the multimodal
 * gateway. Never throws for the expected failure modes — returns a discriminated `StatementReadResult`.
 */
export async function extractStatementCandidates(
  input: StatementReaderInput,
): Promise<StatementReadResult> {
  if (!isMeloAiConfigured()) {
    return { kind: 'no-provider' };
  }
  const config = resolveMeloAiProviderConfig();
  if (!config.configured) {
    // Defensive: isMeloAiConfigured() already gated this, but keep the type narrowing honest.
    return { kind: 'no-provider' };
  }

  // The source CandidateSource: a PDF the model read vs a photographed/screenshotted statement.
  const source: CandidateSource = input.kind === 'pdf' ? 'pdf' : 'photo';

  // Own timeout, merged with the caller's abort signal. Whichever fires first wins.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = (): void => controller.abort();
  if (input.signal) {
    if (input.signal.aborted) {
      controller.abort();
    } else {
      input.signal.addEventListener('abort', onCallerAbort);
    }
  }

  try {
    // Read the picked file as base64 (legacy expo-file-system API — mirrors nativeDataExport.ts /
    // nativeDocumentImport.ts). The bytes never leave the device except inside this one gateway call.
    const base64 = await FileSystem.readAsStringAsync(input.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (base64.trim().length === 0) {
      return { kind: 'error', message: "Couldn't read that file — it looked empty." };
    }

    const content = buildUserContent(input.kind, input.mediaType, base64);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.token !== undefined) {
      headers['x-folio-gateway-token'] = config.token;
    }

    const response = await fetch(`${config.gatewayUrl}/chat/completions`, {
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
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { kind: 'error', message: `The reader gateway returned ${response.status}.` };
    }

    const data: unknown = await response.json();
    const rawReply = extractAssistantText(data);
    if (rawReply === null) {
      return { kind: 'error', message: 'The reader sent an unexpected response.' };
    }

    const candidates = parseCandidatesFromModelJson(rawReply, source);
    return { kind: 'ok', candidates };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { kind: 'error', message: 'Cancelled.' };
    }
    return { kind: 'error', message: "Couldn't read that statement just now." };
  } finally {
    clearTimeout(timeoutId);
    if (input.signal) {
      input.signal.removeEventListener('abort', onCallerAbort);
    }
  }
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

// `parseCandidatesFromModelJson` lives in ./statementReaderParse (pure, no expo imports) and is
// re-exported at the top of this file.
