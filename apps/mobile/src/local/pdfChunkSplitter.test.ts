// Tests for the PURE PDF page-range splitter (pdfChunkSplitter.ts). No expo/react-native imports —
// runs in plain Node.
//
// Fixture: a hand-built minimal multi-page PDF using a classic (non-stream) xref table — the same
// shape the live-gateway prototype confirmed a real bank export PDF uses (PDF 1.3, uncompressed
// xref, no encryption, flat /Kids array). Building it in-test (rather than shipping a binary
// fixture file) keeps the test self-contained and lets us vary page count/shared-resource shape
// per test.

import { describe, expect, it } from 'vitest';

import {
  PAGES_PER_CHUNK,
  UnsplittablePdfError,
  base64ToBinaryString,
  binaryStringToBase64,
  buildPdfChunkAt,
  planPdfChunks,
  splitPdfIntoPageChunks,
} from './pdfChunkSplitter';

/** Build a minimal, valid classic-xref PDF with `pageCount` pages, all sharing ONE Resources
 *  object (mirrors a real statement export, where every page shares the same fonts) and each with
 *  its own tiny Contents stream (so a rebuilt subset can be told apart by size/count, not content —
 *  the reader model is what actually reads content; these tests only prove structural splitting). */
function buildFixturePdf(pageCount: number): string {
  // Object numbering: 1 = Catalog, 2 = Pages, 3 = Resources (shared), 4..(4+pageCount-1) = Page
  // objects, then one Contents object per page.
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
    // A plain (uncompressed) content stream — small, page-numbered so distinct pages differ.
    const streamText = `BT /F1 12 Tf (Page ${i + 1} of ${pageCount}) Tj ET`;
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
  let xref = `xref\n0 ${maxNum + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let n = 1; n <= maxNum; n++) {
    const offset = offsets.get(n);
    xref +=
      offset !== undefined
        ? `${String(offset).padStart(10, '0')} 00000 n \n`
        : '0000000000 00000 f \n';
  }
  out += xref;
  out += `trailer\n<< /Size ${maxNum + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return out;
}

describe('base64ToBinaryString / binaryStringToBase64', () => {
  it('round-trips arbitrary bytes (0-255) through base64 and back', () => {
    let binary = '';
    for (let i = 0; i < 256; i++) binary += String.fromCharCode(i);
    const base64 = binaryStringToBase64(binary);
    const decoded = base64ToBinaryString(base64);
    expect(decoded).toBe(binary);
  });

  it('round-trips a small ASCII PDF fixture byte-for-byte', () => {
    const pdf = buildFixturePdf(3);
    const decoded = base64ToBinaryString(binaryStringToBase64(pdf));
    expect(decoded).toBe(pdf);
  });
});

describe('planPdfChunks', () => {
  it('plans one chunk when the page count fits within PAGES_PER_CHUNK', () => {
    const pdf = buildFixturePdf(3);
    const plan = planPdfChunks(pdf);
    expect(plan.totalPages).toBe(3);
    expect(plan.ranges).toEqual([{ startPage: 1, endPage: 3 }]);
  });

  it('plans multiple chunks for a document longer than PAGES_PER_CHUNK', () => {
    const pageCount = PAGES_PER_CHUNK * 2 + 3; // two full chunks + one partial
    const pdf = buildFixturePdf(pageCount);
    const plan = planPdfChunks(pdf);
    expect(plan.totalPages).toBe(pageCount);
    expect(plan.ranges).toEqual([
      { startPage: 1, endPage: PAGES_PER_CHUNK },
      { startPage: PAGES_PER_CHUNK + 1, endPage: PAGES_PER_CHUNK * 2 },
      { startPage: PAGES_PER_CHUNK * 2 + 1, endPage: pageCount },
    ]);
  });

  it('covers every page exactly once across all ranges, in order', () => {
    const pageCount = 21;
    const pdf = buildFixturePdf(pageCount);
    const plan = planPdfChunks(pdf, 8);
    const coveredPages = plan.ranges.flatMap((r) =>
      Array.from({ length: r.endPage - r.startPage + 1 }, (_, i) => r.startPage + i),
    );
    expect(coveredPages).toEqual(Array.from({ length: pageCount }, (_, i) => i + 1));
  });

  it('throws UnsplittablePdfError for a non-PDF / garbage input', () => {
    expect(() => planPdfChunks('not a pdf at all')).toThrow(UnsplittablePdfError);
  });

  it('throws UnsplittablePdfError for an encrypted PDF', () => {
    const pdf = buildFixturePdf(2).replace('trailer\n<<', 'trailer\n<< /Encrypt 99 0 R ');
    expect(() => planPdfChunks(pdf)).toThrow(UnsplittablePdfError);
  });
});

describe('splitPdfIntoPageChunks / buildPdfChunkAt', () => {
  it('builds a chunk whose page count matches the requested range', () => {
    const pdf = buildFixturePdf(10);
    const chunk = buildPdfChunkAt(pdf, 3, 6);
    expect(chunk.startPage).toBe(3);
    expect(chunk.endPage).toBe(6);
  });

  it('produces a chunk that is itself a valid, re-splittable PDF (structural round-trip)', () => {
    const pdf = buildFixturePdf(10);
    const chunk = buildPdfChunkAt(pdf, 1, 4);
    // The rebuilt chunk must itself parse cleanly and report exactly 4 pages.
    const rePlanned = planPdfChunks(chunk.bytes, 100);
    expect(rePlanned.totalPages).toBe(4);
  });

  it('produces a materially smaller PDF for a small page-range of a larger document', () => {
    const pdf = buildFixturePdf(60);
    const chunk = buildPdfChunkAt(pdf, 1, 8);
    expect(chunk.bytes.length).toBeLessThan(pdf.length);
  });

  it('splitPdfIntoPageChunks produces the same ranges as planPdfChunks', () => {
    const pdf = buildFixturePdf(17);
    const plan = planPdfChunks(pdf, 8);
    const chunks = splitPdfIntoPageChunks(pdf, 8);
    expect(chunks.map((c) => ({ startPage: c.startPage, endPage: c.endPage }))).toEqual(
      plan.ranges,
    );
  });

  it('throws UnsplittablePdfError when the requested range is out of bounds', () => {
    const pdf = buildFixturePdf(3);
    expect(() => buildPdfChunkAt(pdf, 5, 8)).toThrow(UnsplittablePdfError);
  });
});
