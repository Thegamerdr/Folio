// Tests for the statement reader (statementExtraction.ts).
//
// We mock global fetch and the gateway-config resolver so we can drive each branch deterministically
// without a network or any Expo runtime. The gateway returns an OpenAI-shaped chat completion whose
// assistant content is the model's JSON array.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeloAiProviderConfig } from './meloAiClient';

// meloAiClient pulls in expo-constants (react-native) at module load, which the node test runner
// cannot parse. Mock the whole module so importing statementExtraction stays expo-free; we only
// need its resolveMeloAiProviderConfig contract here.
const resolveMock = vi.fn<() => MeloAiProviderConfig>();
vi.mock('./meloAiClient', () => ({
  resolveMeloAiProviderConfig: (): MeloAiProviderConfig => resolveMock(),
}));

import { extractStatementTransactions } from './statementExtraction';

// --- helpers ---------------------------------------------------------------

const CONFIGURED = {
  configured: true as const,
  gatewayUrl: 'https://gateway.example',
  token: 'tok-123',
};

function mockConfig(value: MeloAiProviderConfig): void {
  resolveMock.mockReturnValue(value);
}

/** Build a fake gateway response whose assistant content is `content`. */
function chatResponse(content: string): Response {
  const body = { choices: [{ message: { content } }] };
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function mockFetchResolves(response: Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  );
}

function mockFetchRejects(error: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw error;
    }),
  );
}

const IMG = { imageBase64: 'aGVsbG8=', imageMimeType: 'image/png' };

// --- lifecycle -------------------------------------------------------------

beforeEach(() => {
  mockConfig(CONFIGURED);
});

afterEach(() => {
  resolveMock.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Read the (url, init) of the first fetch call with a concrete type (the mock's params are loose). */
function firstFetchInit(fetchMock: ReturnType<typeof vi.fn>): RequestInit {
  const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return call[1];
}

// --- tests -----------------------------------------------------------------

describe('extractStatementTransactions', () => {
  it('maps a valid JSON array: major->minor units and sign->direction', async () => {
    const arr = [
      { date: '2026-01-15', merchant: 'Tesco', amount: -12.5 },
      { date: '2026-01-16', merchant: 'Salary', amount: 1800 },
    ];
    mockFetchResolves(chatResponse(JSON.stringify(arr)));

    const result = await extractStatementTransactions(IMG);

    expect(result.status).toBe('ok');
    expect(result.rawCount).toBe(2);
    expect(result.transactions).toEqual([
      { dateIso: '2026-01-15', merchant: 'Tesco', amountMinor: 1250, direction: 'spend' },
      { dateIso: '2026-01-16', merchant: 'Salary', amountMinor: 180000, direction: 'income' },
    ]);
  });

  it('parses a response wrapped in markdown code fences', async () => {
    const fenced = '```json\n[{"date":"2026-02-01","merchant":"Spotify","amount":-9.99}]\n```';
    mockFetchResolves(chatResponse(fenced));

    const result = await extractStatementTransactions(IMG);

    expect(result.status).toBe('ok');
    expect(result.transactions).toEqual([
      { dateIso: '2026-02-01', merchant: 'Spotify', amountMinor: 999, direction: 'spend' },
    ]);
  });

  it('parses a bare (no language tag) fenced block', async () => {
    const fenced = '```\n[{"date":"2026-03-03","merchant":"Refund","amount":4.2}]\n```';
    mockFetchResolves(chatResponse(fenced));

    const result = await extractStatementTransactions(IMG);

    expect(result.status).toBe('ok');
    expect(result.transactions).toEqual([
      { dateIso: '2026-03-03', merchant: 'Refund', amountMinor: 420, direction: 'income' },
    ]);
  });

  it('drops invalid items but keeps the good ones; rawCount is the pre-validation length', async () => {
    const arr = [
      { date: 'not-a-date', merchant: 'Bad date', amount: -5 }, // bad date -> drop
      { date: '2026-01-10', merchant: 'NaN amount', amount: Number.NaN }, // NaN -> drop (serialises to null)
      { date: '2026-01-11', merchant: '', amount: -7 }, // empty merchant -> drop
      { date: '2026-01-12', merchant: 'Zero', amount: 0 }, // zero amount -> drop
      { date: '2026-01-13', merchant: 'Good', amount: -3.33 }, // keeper
    ];
    mockFetchResolves(chatResponse(JSON.stringify(arr)));

    const result = await extractStatementTransactions(IMG);

    expect(result.status).toBe('ok');
    expect(result.rawCount).toBe(5);
    expect(result.transactions).toEqual([
      { dateIso: '2026-01-13', merchant: 'Good', amountMinor: 333, direction: 'spend' },
    ]);
  });

  it('returns ok with zero transactions for an empty array', async () => {
    mockFetchResolves(chatResponse('[]'));

    const result = await extractStatementTransactions(IMG);

    expect(result.status).toBe('ok');
    expect(result.rawCount).toBe(0);
    expect(result.transactions).toEqual([]);
  });

  it('returns no-provider when the gateway is not configured', async () => {
    mockConfig({ configured: false });
    mockFetchResolves(chatResponse('[]'));

    const result = await extractStatementTransactions(IMG);

    expect(result.status).toBe('no-provider');
    expect(result.transactions).toEqual([]);
    expect(result.rawCount).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 'error' when fetch rejects", async () => {
    mockFetchRejects(new Error('network down'));

    const result = await extractStatementTransactions(IMG);

    expect(result.status).toBe('error');
    expect(result.transactions).toEqual([]);
    expect(result.rawCount).toBe(0);
  });

  it("returns 'error' on a non-ok HTTP status", async () => {
    mockFetchResolves({ ok: false, status: 500, json: async () => ({}) } as unknown as Response);

    const result = await extractStatementTransactions(IMG);

    expect(result.status).toBe('error');
  });

  it("returns 'error' when the reply is not valid JSON", async () => {
    mockFetchResolves(chatResponse('here are your transactions: none really'));

    const result = await extractStatementTransactions(IMG);

    expect(result.status).toBe('error');
  });

  it('uses the text path when no image is supplied, embedding the OCR text', async () => {
    const fetchMock = vi.fn(async () => chatResponse('[]'));
    vi.stubGlobal('fetch', fetchMock);

    await extractStatementTransactions({ text: '15 JAN  TESCO  -12.50' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = firstFetchInit(fetchMock);
    const sent = JSON.parse(init.body as string) as {
      messages: Array<{ role: string; content: unknown }>;
    };
    expect(typeof sent.messages[0]?.content).toBe('string');
    expect(sent.messages[0]?.content as string).toContain('15 JAN  TESCO  -12.50');
  });

  it('uses the vision path with a data URI when an image is supplied', async () => {
    const fetchMock = vi.fn(async () => chatResponse('[]'));
    vi.stubGlobal('fetch', fetchMock);

    await extractStatementTransactions({ imageBase64: 'AAAA', imageMimeType: 'image/jpeg' });

    const init = firstFetchInit(fetchMock);
    const sent = JSON.parse(init.body as string) as {
      messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>;
    };
    const parts = sent.messages[0]?.content ?? [];
    expect(Array.isArray(parts)).toBe(true);
    const imagePart = parts.find((p) => p.type === 'image_url');
    expect(imagePart?.image_url?.url).toBe('data:image/jpeg;base64,AAAA');
  });

  it('sends the gateway token header when configured', async () => {
    const fetchMock = vi.fn(async () => chatResponse('[]'));
    vi.stubGlobal('fetch', fetchMock);

    await extractStatementTransactions(IMG);

    const init = firstFetchInit(fetchMock);
    const headers = init.headers as Record<string, string>;
    expect(headers['x-folio-gateway-token']).toBe('tok-123');
  });

  it('returns ok empty when neither image nor text is supplied (no fetch)', async () => {
    const fetchMock = vi.fn(async () => chatResponse('[]'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractStatementTransactions({});

    expect(result.status).toBe('ok');
    expect(result.transactions).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
