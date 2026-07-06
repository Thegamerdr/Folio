// PURE, minimal PDF page-range splitter — no pdf-lib, no native module, no expo/react-native
// imports. Built because chunking a long statement export by INSTRUCTION ("only read pages 1-15")
// does NOT work: measured against the live gateway with a real 133-page/1.28MB Monzo export, the
// model still tokenizes and re-reads the ENTIRE document on every "windowed" call (prompt_tokens
// stayed ~34.6k regardless of the requested range) and does not reliably respect page boundaries
// (two of three test windows on this account returned truncated/broken JSON, and the ranges
// overlapped). See MELO_PHASE2_PLAN.md / the reader work for the full latency + token comparison.
//
// A REAL byte-level split fixes both problems: splitting monzo-statement.pdf into an 8-page chunk
// shrank the payload from 1.28MB to ~100KB and prompt_tokens from ~34.6k to ~2.3k, at 13-36s per
// chunk with finish_reason 'stop' (no truncation) even on this unusually transaction-dense account.
//
// SCOPE. This is not a general PDF library — it targets the class of PDF a bank/export generator
// produces: a classic (non-compressed) xref table, no object streams, no encryption, and a flat or
// shallow /Kids tree. That covers every export we've tested. If a future statement uses PDF 1.5+
// cross-reference STREAMS (compressed xref) or is encrypted, `splitPdfIntoPageChunks` throws a
// clear, typed error — the caller (statementReaderClient) catches it and falls back to the
// single-shot path (which itself pre-flights on MAX_STATEMENT_BYTES), so an unsplittable PDF never
// silently produces a broken/incomplete result. It never needs to RENDER the PDF — only to
// reproduce a valid, minimal container around a subset of the original page objects, so any
// reader that can parse the original (the gateway's model) can parse the subset.

/** Thrown when the source PDF doesn't match the supported shape (see SCOPE above). The caller
 *  catches this by name and falls back to the single-shot read. */
export class UnsplittablePdfError extends Error {
  constructor(reason: string) {
    super(`PDF not splittable: ${reason}`);
    this.name = 'UnsplittablePdfError';
  }
}

/** One page-range chunk, ready to base64-encode and send to the gateway as its own PDF. */
export type PdfChunk = Readonly<{
  /** 1-based, inclusive page range this chunk covers, for progress copy ("pages 1-8 of 133"). */
  startPage: number;
  endPage: number;
  /** The rebuilt, self-contained PDF bytes for just this page range (binary string — see
   *  `bytesToBinaryString` / `binaryStringToBase64` below for the encoding convention). */
  bytes: string;
}>;

/** Plan the page ranges for a source PDF, WITHOUT building any chunk bytes yet — lets the caller
 *  show "chunk 1 of N" progress before the first (possibly slow) chunk is even built. */
export type PdfChunkPlan = Readonly<{
  totalPages: number;
  /** Inclusive [start, end] 1-based page ranges, in document order, covering every page exactly once. */
  ranges: ReadonlyArray<Readonly<{ startPage: number; endPage: number }>>;
}>;

/** Pages per chunk. Chosen from live-gateway measurement (2026-07-05/06): 8 pages stayed well
 *  under the completion-token budget (max ~10.1k of 16,384 tokens) even on an unusually
 *  transaction-dense real account (Monzo, ~20-25 rows/page); a 15-page chunk on the SAME account
 *  overflowed (finish_reason 'length', broken JSON) twice out of three tries. 8 is the safety
 *  margin, not the max that ever works — it trades a few more sequential round-trips for reading
 *  every account's export without truncation. */
export const PAGES_PER_CHUNK = 8;

// ---------------------------------------------------------------------------
// Binary-string convention
// ---------------------------------------------------------------------------
//
// RN has no built-in Buffer. We represent raw PDF bytes as a "binary string" — one JS UTF-16 code
// unit (0-255) per byte, exactly like Node's `buffer.toString('latin1')` — so the same string
// operations (indexOf, regex, slice) used to prototype this against the real PDF work unchanged
// here. `base64ToBinaryString` / `binaryStringToBase64` convert to/from that representation using
// hand-rolled base64 (no atob/btoa/Buffer dependency — RN's JS engine does not guarantee either).

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decode a base64 string (as returned by expo-file-system's Base64 read) into a binary string. */
export function base64ToBinaryString(base64: string): string {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  let output = '';
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_CHARS.indexOf(clean[i] ?? '=');
    const c1 = BASE64_CHARS.indexOf(clean[i + 1] ?? '=');
    const c2 = BASE64_CHARS.indexOf(clean[i + 2] ?? '=');
    const c3 = BASE64_CHARS.indexOf(clean[i + 3] ?? '=');
    const triple =
      ((c0 < 0 ? 0 : c0) << 18) |
      ((c1 < 0 ? 0 : c1) << 12) |
      ((c2 < 0 ? 0 : c2) << 6) |
      (c3 < 0 ? 0 : c3);
    output += String.fromCharCode((triple >> 16) & 0xff);
    if (c2 >= 0) output += String.fromCharCode((triple >> 8) & 0xff);
    if (c3 >= 0) output += String.fromCharCode(triple & 0xff);
  }
  return output;
}

/** Encode a binary string (one char code per byte) into base64, ready for the gateway's
 *  `data:application/pdf;base64,…` file part. */
export function binaryStringToBase64(binary: string): string {
  let output = '';
  for (let i = 0; i < binary.length; i += 3) {
    const b0 = binary.charCodeAt(i);
    const b1 = i + 1 < binary.length ? binary.charCodeAt(i + 1) : undefined;
    const b2 = i + 2 < binary.length ? binary.charCodeAt(i + 2) : undefined;
    const triple = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    output += BASE64_CHARS[(triple >> 18) & 0x3f];
    output += BASE64_CHARS[(triple >> 12) & 0x3f];
    output += b1 !== undefined ? BASE64_CHARS[(triple >> 6) & 0x3f] : '=';
    output += b2 !== undefined ? BASE64_CHARS[triple & 0x3f] : '=';
  }
  return output;
}

// ---------------------------------------------------------------------------
// Minimal PDF object model (xref-table based; see SCOPE)
// ---------------------------------------------------------------------------

type ParsedPdf = Readonly<{
  text: string;
  offsets: ReadonlyMap<number, number>;
  rootObjNum: number;
}>;

type PdfObject = Readonly<{ body: string }>;

/** Parse the classic (non-stream) xref table + trailer chain into a Map<objNum, byteOffset>, plus
 *  the Catalog's object number. Throws UnsplittablePdfError for anything outside SCOPE. */
function parseClassicXref(text: string): ParsedPdf {
  if (/\/Encrypt\b/.test(text)) {
    throw new UnsplittablePdfError('encrypted PDF');
  }

  const startxrefIdx = text.lastIndexOf('startxref');
  if (startxrefIdx === -1) throw new UnsplittablePdfError('no startxref');
  const afterStartxref = text.slice(startxrefIdx + 'startxref'.length);
  const xrefOffsetMatch = /\s*(\d+)/.exec(afterStartxref);
  if (!xrefOffsetMatch || xrefOffsetMatch[1] === undefined) {
    throw new UnsplittablePdfError('malformed startxref');
  }
  const xrefOffset = parseInt(xrefOffsetMatch[1], 10);

  const offsets = new Map<number, number>();
  let cursor: number | undefined = xrefOffset;
  let rootObjNum: number | undefined;
  const visited = new Set<number>();

  while (cursor !== undefined && !visited.has(cursor)) {
    visited.add(cursor);
    const chunk = text.slice(cursor, cursor + 200_000);
    if (!chunk.trimStart().startsWith('xref')) {
      throw new UnsplittablePdfError('cross-reference STREAM (compressed xref) — not supported');
    }
    let pos = chunk.indexOf('xref') + 4;
    while (true) {
      const subsectionHeader = /\s*(\d+)\s+(\d+)\s*\r?\n/y;
      subsectionHeader.lastIndex = pos;
      const headerMatch = subsectionHeader.exec(chunk);
      if (!headerMatch || headerMatch[1] === undefined || headerMatch[2] === undefined) break;
      const startNum = parseInt(headerMatch[1], 10);
      const count = parseInt(headerMatch[2], 10);
      pos = subsectionHeader.lastIndex;
      for (let i = 0; i < count; i++) {
        const entry = chunk.slice(pos, pos + 20);
        const entryMatch = /(\d{10}) (\d{5}) ([nf])/.exec(entry);
        if (entryMatch && entryMatch[3] === 'n' && entryMatch[1] !== undefined) {
          const objNum = startNum + i;
          if (!offsets.has(objNum)) offsets.set(objNum, parseInt(entryMatch[1], 10));
        }
        pos += 20;
      }
      if (chunk.slice(pos, pos + 7) === 'trailer') break;
    }
    const trailerSearchStart = Math.max(pos - 30, 0);
    const trailerDictMatch = /trailer\s*<<([\s\S]*?)>>/.exec(chunk.slice(trailerSearchStart));
    cursor = undefined;
    if (trailerDictMatch && trailerDictMatch[1] !== undefined) {
      const prevMatch = /\/Prev\s+(\d+)/.exec(trailerDictMatch[1]);
      if (prevMatch && prevMatch[1] !== undefined) cursor = parseInt(prevMatch[1], 10);
      if (rootObjNum === undefined) {
        const rootMatch = /\/Root\s+(\d+)\s+\d+\s+R/.exec(trailerDictMatch[1]);
        if (rootMatch && rootMatch[1] !== undefined) rootObjNum = parseInt(rootMatch[1], 10);
      }
    }
  }

  if (rootObjNum === undefined) throw new UnsplittablePdfError('no /Root found in trailer chain');
  if (offsets.size === 0) throw new UnsplittablePdfError('no objects found in xref table');
  return { text, offsets, rootObjNum };
}

function getObject(parsed: ParsedPdf, objNum: number): PdfObject | null {
  const offset = parsed.offsets.get(objNum);
  if (offset === undefined) return null;
  const slice = parsed.text.slice(offset, offset + 5_000_000);
  const headerMatch = /^(\d+)\s+(\d+)\s+obj\s*/.exec(slice);
  if (!headerMatch) return null;
  const afterHeader = slice.slice(headerMatch[0].length);
  const endobjIdx = afterHeader.indexOf('endobj');
  if (endobjIdx === -1) return null;
  return { body: afterHeader.slice(0, endobjIdx) };
}

/** Strip `stream…endstream` binary payload and any `/Parent N 0 R` before scanning a dict for
 *  indirect references. Both matter for correctness, not just cleanliness:
 *   - Compressed/binary stream bytes can coincidentally contain "N 0 R"-shaped sequences that
 *     are not real references — including them causes false-positive fan-out (verified: without
 *     this, walking from 15 real pages pulled in 435 of 437 objects — the entire document).
 *   - A page's /Parent points UP at an intermediate /Pages node; following it pulls that node's
 *     /Kids (the page's siblings) and transitively the whole tree. The split only ever walks
 *     DOWN (Resources, Contents, Fonts, XObjects) from the wanted pages. */
function dictOnlyNoParent(body: string): string {
  const streamIdx = body.indexOf('stream');
  const dict = streamIdx === -1 ? body : body.slice(0, streamIdx);
  return dict.replace(/\/Parent\s+\d+\s+0\s+R/, '');
}

function collectPageOrder(parsed: ParsedPdf, objNum: number, acc: number[]): void {
  const obj = getObject(parsed, objNum);
  if (!obj) return;
  if (/\/Type\s*\/Pages\b/.test(obj.body)) {
    const kidsMatch = /\/Kids\s*\[([^\]]*)\]/.exec(obj.body);
    if (!kidsMatch || kidsMatch[1] === undefined) return;
    const kidNums = [...kidsMatch[1].matchAll(/(\d+)\s+\d+\s+R/g)]
      .map((m) => m[1])
      .filter((n): n is string => n !== undefined)
      .map((n) => parseInt(n, 10));
    for (const kid of kidNums) collectPageOrder(parsed, kid, acc);
  } else if (/\/Type\s*\/Page(?!s)\b/.test(obj.body)) {
    acc.push(objNum);
  }
}

/** Transitively collect every object reachable from `startObjNums` via dictionary references
 *  (never through /Parent — see dictOnlyNoParent). Populates `cache` with every body fetched, so
 *  the caller never re-reads an object from `parsed.text`. */
function collectReachable(
  parsed: ParsedPdf,
  startObjNums: readonly number[],
  cache: Map<number, PdfObject>,
): Set<number> {
  const toVisit = [...startObjNums];
  const seen = new Set<number>();
  while (toVisit.length > 0) {
    const objNum = toVisit.pop();
    if (objNum === undefined || seen.has(objNum)) continue;
    seen.add(objNum);
    const obj = cache.get(objNum) ?? getObject(parsed, objNum);
    if (!obj) continue;
    cache.set(objNum, obj);
    const refs = [...dictOnlyNoParent(obj.body).matchAll(/(\d+)\s+0\s+R/g)]
      .map((m) => m[1])
      .filter((n): n is string => n !== undefined)
      .map((n) => parseInt(n, 10));
    for (const ref of refs) if (!seen.has(ref)) toVisit.push(ref);
  }
  return seen;
}

/** Build a brand-new, minimal, valid PDF containing only the given page objects (in order) plus
 *  everything they transitively reference. Reuses original object numbers (a valid PDF need not
 *  renumber or use contiguous numbers); adds two fresh numbers for a new Catalog + Pages node;
 *  rewrites each reused page's `/Parent` to point at the new Pages node; emits a fresh classic
 *  xref + trailer computed from the new file's own byte offsets. */
function buildSubsetPdf(parsed: ParsedPdf, pageObjNums: readonly number[]): string {
  const objCache = new Map<number, PdfObject>();
  const reachable = collectReachable(parsed, pageObjNums, objCache);

  const maxOrig = Math.max(...parsed.offsets.keys());
  const newPagesNum = maxOrig + 1;
  const newCatalogNum = maxOrig + 2;

  let out = '%PDF-1.3\n';
  const objOffsets = new Map<number, number>();

  function writeObj(num: number, body: string): void {
    objOffsets.set(num, out.length);
    out += `${num} 0 obj\n${body}\nendobj\n`;
  }

  for (const pageNum of pageObjNums) {
    const obj = objCache.get(pageNum);
    if (!obj) throw new UnsplittablePdfError(`missing page object ${pageNum}`);
    const rewritten = obj.body.replace(/\/Parent\s+\d+\s+0\s+R/, `/Parent ${newPagesNum} 0 R`);
    writeObj(pageNum, rewritten);
  }
  for (const objNum of reachable) {
    if (pageObjNums.includes(objNum)) continue;
    const obj = objCache.get(objNum);
    if (!obj) continue;
    writeObj(objNum, obj.body);
  }

  const kidsRefs = pageObjNums.map((n) => `${n} 0 R`).join(' ');
  writeObj(newPagesNum, `<< /Type /Pages /Count ${pageObjNums.length} /Kids [ ${kidsRefs} ] >>`);
  writeObj(newCatalogNum, `<< /Type /Catalog /Pages ${newPagesNum} 0 R >>`);

  const allNums = [...objOffsets.keys()].sort((a, b) => a - b);
  const maxNum = allNums[allNums.length - 1] ?? 0;
  const xrefStart = out.length;
  let xref = `xref\n0 ${maxNum + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let n = 1; n <= maxNum; n++) {
    const offset = objOffsets.get(n);
    xref +=
      offset !== undefined
        ? `${String(offset).padStart(10, '0')} 00000 n \n`
        : '0000000000 00000 f \n';
  }
  out += xref;
  out += `trailer\n<< /Size ${maxNum + 1} /Root ${newCatalogNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Parse a source PDF (as a binary string) and plan its page-range chunks WITHOUT building any
 *  chunk bytes yet, so the caller can show "chunk 1 of N" before the (possibly slow) first build.
 *  Throws UnsplittablePdfError if the PDF is outside SCOPE (encrypted, compressed xref, malformed) —
 *  the caller should catch this and fall back to the single-shot read. */
export function planPdfChunks(
  binaryPdf: string,
  pagesPerChunk: number = PAGES_PER_CHUNK,
): PdfChunkPlan {
  const parsed = parseClassicXref(binaryPdf);
  const rootObj = getObject(parsed, parsed.rootObjNum);
  if (!rootObj) throw new UnsplittablePdfError('Catalog object missing');
  const pagesRefMatch = /\/Pages\s+(\d+)\s+\d+\s+R/.exec(rootObj.body);
  if (!pagesRefMatch || pagesRefMatch[1] === undefined) {
    throw new UnsplittablePdfError('Catalog has no /Pages reference');
  }
  const pagesObjNum = parseInt(pagesRefMatch[1], 10);

  const pageOrder: number[] = [];
  collectPageOrder(parsed, pagesObjNum, pageOrder);
  if (pageOrder.length === 0) throw new UnsplittablePdfError('no pages found');

  const ranges: Array<{ startPage: number; endPage: number }> = [];
  for (let i = 0; i < pageOrder.length; i += pagesPerChunk) {
    ranges.push({ startPage: i + 1, endPage: Math.min(i + pagesPerChunk, pageOrder.length) });
  }
  return { totalPages: pageOrder.length, ranges };
}

/** Build every page-range chunk's PDF bytes for the given source. Callers that want per-chunk
 *  progress before each (possibly slow) chunk finishes should prefer building chunks ONE AT A TIME
 *  via `buildPdfChunk` after `planPdfChunks`, but this whole-plan builder is here for simple/small
 *  cases and tests. */
export function splitPdfIntoPageChunks(
  binaryPdf: string,
  pagesPerChunk: number = PAGES_PER_CHUNK,
): PdfChunk[] {
  const parsed = parseClassicXref(binaryPdf);
  const rootObj = getObject(parsed, parsed.rootObjNum);
  if (!rootObj) throw new UnsplittablePdfError('Catalog object missing');
  const pagesRefMatch = /\/Pages\s+(\d+)\s+\d+\s+R/.exec(rootObj.body);
  if (!pagesRefMatch || pagesRefMatch[1] === undefined) {
    throw new UnsplittablePdfError('Catalog has no /Pages reference');
  }
  const pagesObjNum = parseInt(pagesRefMatch[1], 10);

  const pageOrder: number[] = [];
  collectPageOrder(parsed, pagesObjNum, pageOrder);
  if (pageOrder.length === 0) throw new UnsplittablePdfError('no pages found');

  const chunks: PdfChunk[] = [];
  for (let i = 0; i < pageOrder.length; i += pagesPerChunk) {
    const pageNums = pageOrder.slice(i, i + pagesPerChunk);
    chunks.push({
      startPage: i + 1,
      endPage: i + pageNums.length,
      bytes: buildSubsetPdf(parsed, pageNums),
    });
  }
  return chunks;
}

/** Build ONE page-range chunk (1-based, inclusive `startPage`/`endPage`) from an already-parsed
 *  page order, so a sequential caller can build+send chunk N before building chunk N+1 (never
 *  holding every chunk's bytes in memory at once). Internal helper exposed for
 *  `extractStatementCandidatesChunked`'s sequential loop. */
export function buildPdfChunkAt(binaryPdf: string, startPage: number, endPage: number): PdfChunk {
  const parsed = parseClassicXref(binaryPdf);
  const rootObj = getObject(parsed, parsed.rootObjNum);
  if (!rootObj) throw new UnsplittablePdfError('Catalog object missing');
  const pagesRefMatch = /\/Pages\s+(\d+)\s+\d+\s+R/.exec(rootObj.body);
  if (!pagesRefMatch || pagesRefMatch[1] === undefined) {
    throw new UnsplittablePdfError('Catalog has no /Pages reference');
  }
  const pagesObjNum = parseInt(pagesRefMatch[1], 10);
  const pageOrder: number[] = [];
  collectPageOrder(parsed, pagesObjNum, pageOrder);
  const pageNums = pageOrder.slice(startPage - 1, endPage);
  if (pageNums.length === 0) {
    throw new UnsplittablePdfError(`page range ${startPage}-${endPage} out of bounds`);
  }
  return {
    startPage,
    endPage: startPage + pageNums.length - 1,
    bytes: buildSubsetPdf(parsed, pageNums),
  };
}
