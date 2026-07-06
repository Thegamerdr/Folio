// Tests for the CHUNKED reader path (`extractStatementCandidatesChunked` in statementReaderClient.ts).
//
// Mocks expo-file-system/legacy and meloAiClient exactly like statementExtraction.test.ts /
// billing/entitlements.test.ts do, so this runs in plain Node without any Expo/RN runtime. `fetch`
// is stubbed per-chunk so we can drive progress-callback sequencing and per-chunk failure
// deterministically — the live-gateway behaviour itself was proven separately against the real
// Monzo export (see the reader work's chunk-latency/token measurements); these tests cover the
// CLIENT's own sequencing, coverage-reporting, and de-dupe wiring in isolation.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeloAiProviderConfig } from './meloAiClient';

const { resolveMock } = vi.hoisted(() => ({
  resolveMock: vi.fn<() => MeloAiProviderConfig>(),
}));
vi.mock('./meloAiClient', () => ({
  isMeloAiConfigured: (): boolean => resolveMock().configured,
  resolveMeloAiProviderConfig: (): MeloAiProviderConfig => resolveMock(),
}));

const { getInfoAsync, readAsStringAsync } = vi.hoisted(() => ({
  getInfoAsync: vi.fn<(uri: string) => Promise<{ exists: boolean; size?: number }>>(),
  readAsStringAsync: vi.fn<(uri: string, opts?: unknown) => Promise<string>>(),
}));
vi.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  getInfoAsync,
  readAsStringAsync,
}));

import { extractStatementCandidatesChunked } from './statementReaderClient';
import type { StatementReaderChunkProgress } from './statementReaderClient';

const CONFIGURED = {
  configured: true as const,
  gatewayUrl: 'https://gateway.example',
  token: 'tok-123',
};

/** Build a minimal 2-object-per-page classic-xref PDF with `pageCount` pages (same shape as
 *  pdfChunkSplitter.test.ts's fixture builder) and return it as a base64 string, exactly what
 *  expo-file-system's readAsStringAsync(..., { encoding: Base64 }) would return. */
function buildFixturePdfBase64(pageCount: number): string {
  const catalogNum = 1;
  const pagesNum = 2;
  const resourcesNum = 3;
  const firstPageNum = 4;
  const firstContentsNum = firstPageNum + pageCount;
  const pageNums = Array.from({ length: pageCount }, (_, i) => firstPageNum + i);
  const kidsRefs = pageNums.map((n) => `${n} 0 R`).join(' ');

  const objects: Array<{ num: number; body: string }> = [];
  objects.push({ num: catalogNum, body: `<< /Type /Catalog /Pages ${pagesNum} 0 R >>` });
  objects.push({
    num: pagesNum,
    body: `<< /Type /Pages /Count ${pageCount} /Kids [ ${kidsRefs} ] >>`,
  });
  objects.push({ num: resourcesNum, body: '<< /ProcSet [ /PDF /Text ] >>' });
  pageNums.forEach((pageNum, i) => {
    const contentsNum = firstContentsNum + i;
    objects.push({
      num: pageNum,
      body: `<< /Type /Page /Parent ${pagesNum} 0 R /Resources ${resourcesNum} 0 R /Contents ${contentsNum} 0 R >>`,
    });
  });
  pageNums.forEach((_pageNum, i) => {
    const contentsNum = firstContentsNum + i;
    const streamText = `BT (Page ${i + 1}) Tj ET`;
    objects.push({
      num: contentsNum,
      body: `<< /Length ${streamText.length} >>\nstream\n${streamText}\nendstream`,
    });
  });

  let out = '%PDF-1.3\n';
  const offsets = new Map<number, number>();
  for (const obj of objects) {
    offsets.set(obj.num, out.length);
    out += `${obj.num} 0 obj\n${obj.body}\nendobj\n`;
  }
  const maxNum = Math.max(...objects.map((o) => o.num));
  const xrefStart = out.length;
  let xref = `xref\n0 ${maxNum + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= maxNum; n++) {
    const offset = offsets.get(n);
    xref +=
      offset !== undefined
        ? `${String(offset).padStart(10, '0')} 00000 n \n`
        : '0000000000 00000 f \n';
  }
  out += xref;
  out += `trailer\n<< /Size ${maxNum + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  // Node Buffer is fine INSIDE the test (test runs under plain Node) — only the shipped app code
  // avoids it (see pdfChunkSplitter.ts's hand-rolled base64 comment).
  return Buffer.from(out, 'latin1').toString('base64');
}

function chatResponse(content: string, finishReason = 'stop'): Response {
  const body = { choices: [{ message: { content }, finish_reason: finishReason }] };
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

const ITEMS_RESPONSE = (merchant: string, amount: number, date: string): string =>
  JSON.stringify({ items: [{ date, merchant, amount, category: null }] });

beforeEach(() => {
  resolveMock.mockReturnValue(CONFIGURED);
  getInfoAsync.mockResolvedValue({ exists: true, size: 200_000 });
});

afterEach(() => {
  resolveMock.mockReset();
  getInfoAsync.mockReset();
  readAsStringAsync.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('extractStatementCandidatesChunked — progress callback sequencing', () => {
  it('calls onProgress once per chunk, in order, with correct chunkIndex/chunkCount/pages', async () => {
    const pageCount = 17; // -> 3 chunks at PAGES_PER_CHUNK=8: 1-8, 9-16, 17-17
    readAsStringAsync.mockResolvedValue(buildFixturePdfBase64(pageCount));

    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      return chatResponse(ITEMS_RESPONSE(`Merchant${call}`, -1 * call, `2026-0${call}-01`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const progressCalls: StatementReaderChunkProgress[] = [];
    const result = await extractStatementCandidatesChunked({
      uri: 'file://statement.pdf',
      mediaType: 'application/pdf',
      kind: 'pdf',
      onProgress: (p) => progressCalls.push(p),
    });

    expect(result.kind).toBe('ok');
    expect(progressCalls).toHaveLength(3);
    expect(progressCalls.map((p) => p.chunkIndex)).toEqual([0, 1, 2]);
    expect(progressCalls.every((p) => p.chunkCount === 3)).toBe(true);
    expect(progressCalls.every((p) => p.totalPages === pageCount)).toBe(true);
    expect(progressCalls.map((p) => [p.startPage, p.endPage])).toEqual([
      [1, 8],
      [9, 16],
      [17, 17],
    ]);
    expect(progressCalls.every((p) => p.ok)).toBe(true);
  });

  it('sends chunk requests sequentially (never concurrently)', async () => {
    readAsStringAsync.mockResolvedValue(buildFixturePdfBase64(9)); // -> 2 chunks: 1-8, 9-9
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return chatResponse(ITEMS_RESPONSE('X', -1, '2026-01-01'));
    });
    vi.stubGlobal('fetch', fetchMock);

    await extractStatementCandidatesChunked({
      uri: 'file://statement.pdf',
      mediaType: 'application/pdf',
      kind: 'pdf',
    });

    expect(maxInFlight).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('extractStatementCandidatesChunked — partial-failure coverage reporting', () => {
  it('reports kind partial with per-chunk coverage when a middle chunk fails', async () => {
    readAsStringAsync.mockResolvedValue(buildFixturePdfBase64(24)); // -> 3 chunks: 1-8, 9-16, 17-24
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 2) {
        return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
      }
      return chatResponse(ITEMS_RESPONSE(`M${call}`, -call, `2026-0${call}-01`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractStatementCandidatesChunked({
      uri: 'file://statement.pdf',
      mediaType: 'application/pdf',
      kind: 'pdf',
    });

    expect(result.kind).toBe('partial');
    if (result.kind !== 'partial') throw new Error('expected partial');
    expect(result.coverage).toEqual([
      { startPage: 1, endPage: 8, ok: true },
      { startPage: 9, endPage: 16, ok: false, errorMessage: 'The reader gateway returned 500.' },
      { startPage: 17, endPage: 24, ok: true },
    ]);
    // Never silently missing: candidates from the two GOOD chunks are still returned.
    expect(result.candidates).toHaveLength(2);
  });

  it('reports kind partial (never ok) when a cancel stops the run before every chunk is attempted, even if every attempted chunk succeeded', async () => {
    readAsStringAsync.mockResolvedValue(buildFixturePdfBase64(24)); // -> 3 chunks: 1-8, 9-16, 17-24
    const controller = new AbortController();
    // Cancel strictly BETWEEN chunk 1 finishing and chunk 2 starting — onProgress fires exactly
    // once per completed chunk, so aborting inside the first call's onProgress guarantees only
    // chunk 1 was ever attempted before the loop's next-iteration abort check trips.
    let onProgressCalls = 0;
    const fetchMock = vi.fn(async () => chatResponse(ITEMS_RESPONSE('M1', -1, '2026-01-01')));
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractStatementCandidatesChunked({
      uri: 'file://statement.pdf',
      mediaType: 'application/pdf',
      kind: 'pdf',
      signal: controller.signal,
      onProgress: () => {
        onProgressCalls += 1;
        controller.abort();
      },
    });

    expect(onProgressCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Only 1 of 3 planned ranges was ever attempted — this must never report 'ok' even though the
    // one attempted chunk succeeded, because pages 9-24 were never read at all.
    expect(result.kind).toBe('partial');
    if (result.kind !== 'partial') throw new Error('expected partial');
    expect(result.coverage).toEqual([{ startPage: 1, endPage: 8, ok: true }]);
    expect(result.candidates).toHaveLength(1);
  });

  it('reports kind error (not partial) when every chunk fails', async () => {
    readAsStringAsync.mockResolvedValue(buildFixturePdfBase64(9));
    const fetchMock = vi.fn(
      async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractStatementCandidatesChunked({
      uri: 'file://statement.pdf',
      mediaType: 'application/pdf',
      kind: 'pdf',
    });

    expect(result.kind).toBe('error');
  });

  it('reports kind ok with full coverage when every chunk succeeds', async () => {
    readAsStringAsync.mockResolvedValue(buildFixturePdfBase64(9));
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      return chatResponse(ITEMS_RESPONSE(`M${call}`, -call, `2026-0${call}-01`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractStatementCandidatesChunked({
      uri: 'file://statement.pdf',
      mediaType: 'application/pdf',
      kind: 'pdf',
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.coverage.every((c) => c.ok)).toBe(true);
  });
});

describe('extractStatementCandidatesChunked — de-dupe across chunk boundaries', () => {
  it('merges candidates from all chunks and drops an exact duplicate row across chunks', async () => {
    readAsStringAsync.mockResolvedValue(buildFixturePdfBase64(16)); // -> 2 chunks: 1-8, 9-16
    const fetchMock = vi
      .fn()
      // Chunk 1: a boundary transaction re-appears (will also show up in chunk 2's read).
      .mockResolvedValueOnce(chatResponse(ITEMS_RESPONSE('Boundary Co', -5, '2026-03-01')))
      // Chunk 2: same boundary row again, plus one genuinely new row.
      .mockResolvedValueOnce(
        chatResponse(
          JSON.stringify({
            items: [
              { date: '2026-03-01', merchant: 'Boundary Co', amount: -5, category: null },
              { date: '2026-03-02', merchant: 'New Merchant', amount: -12, category: null },
            ],
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractStatementCandidatesChunked({
      uri: 'file://statement.pdf',
      mediaType: 'application/pdf',
      kind: 'pdf',
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((c) => c.merchant)).toEqual(['Boundary Co', 'New Merchant']);
  });
});

describe('extractStatementCandidatesChunked — configuration + guard rails', () => {
  it('returns no-provider without reading the file when the gateway is not configured', async () => {
    resolveMock.mockReturnValue({ configured: false });
    const result = await extractStatementCandidatesChunked({
      uri: 'file://statement.pdf',
      mediaType: 'application/pdf',
      kind: 'pdf',
    });
    expect(result.kind).toBe('no-provider');
    expect(readAsStringAsync).not.toHaveBeenCalled();
  });

  it('declines outright above MAX_CHUNKED_STATEMENT_BYTES without reading the file', async () => {
    getInfoAsync.mockResolvedValue({ exists: true, size: 10 * 1024 * 1024 });
    const result = await extractStatementCandidatesChunked({
      uri: 'file://statement.pdf',
      mediaType: 'application/pdf',
      kind: 'pdf',
    });
    expect(result.kind).toBe('error');
    expect(readAsStringAsync).not.toHaveBeenCalled();
  });

  it('returns an honest error for a PDF that is not splittable (garbage bytes)', async () => {
    readAsStringAsync.mockResolvedValue(Buffer.from('not a real pdf', 'utf8').toString('base64'));
    const result = await extractStatementCandidatesChunked({
      uri: 'file://statement.pdf',
      mediaType: 'application/pdf',
      kind: 'pdf',
    });
    expect(result.kind).toBe('error');
  });
});
