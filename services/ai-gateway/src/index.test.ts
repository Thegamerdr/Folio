import { afterEach, describe, expect, it, vi } from 'vitest';

import worker, { buildProviderRequest, parseSafePhraseEnvelope, type RuntimeEnv } from './index';

const safeEnvelope = {
  version: 'melo-phrase-v1' as const,
  intent: 'check_purchase' as const,
  tone: 'calm' as const,
  outcome: 'fits' as const,
  placeholders: ['<AMOUNT>', '<AVAILABLE>'] as const,
};

function runtimeEnv(): RuntimeEnv {
  const meter = {
    get: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
  } as unknown as KVNamespace;
  return {
    METER_KV: meter,
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_MODEL: 'google/gemini-2.5-flash-lite',
    PHRASE_DAILY_CAP: '2000',
    OPENROUTER_API_KEY: 'provider-test-key',
    GATEWAY_TOKEN: 'gateway-test-token',
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AI gateway privacy envelope', () => {
  it('accepts only the enum-only phrasing contract', () => {
    expect(parseSafePhraseEnvelope(safeEnvelope)).toEqual({ ok: true, value: safeEnvelope });
  });

  it.each([
    { ...safeEnvelope, prompt: 'My account number is 12345678' },
    { ...safeEnvelope, snapshot: { merchant: 'Tesco', amount: 40 } },
    { ...safeEnvelope, messages: [{ role: 'user', content: 'raw chat' }] },
    { ...safeEnvelope, file_data: 'data:application/pdf;base64,secret' },
    { ...safeEnvelope, image_url: 'data:image/jpeg;base64,secret' },
  ])('rejects raw or unsupported payload fields', (value) => {
    expect(parseSafePhraseEnvelope(value)).toMatchObject({ ok: false });
  });

  it('rejects arbitrary placeholder strings and duplicates', () => {
    expect(
      parseSafePhraseEnvelope({ ...safeEnvelope, placeholders: ['<ACCOUNT_NUMBER>'] }),
    ).toMatchObject({ ok: false });
    expect(
      parseSafePhraseEnvelope({ ...safeEnvelope, placeholders: ['<AMOUNT>', '<AMOUNT>'] }),
    ).toMatchObject({ ok: false });
  });

  it('builds provider input from controlled vocabulary without user values', () => {
    const body = JSON.stringify(buildProviderRequest(safeEnvelope, 'google/gemini-2.5-flash-lite'));
    expect(body).toContain('intent=check_purchase');
    expect(body).toContain('<AMOUNT>');
    expect(body).not.toContain('Tesco');
    expect(body).not.toContain('12345678');
    expect(body).not.toContain('data:application/pdf');
  });

  it('retires raw chat before authentication or any provider call', async () => {
    const providerFetch = vi.spyOn(globalThis, 'fetch');
    const response = await worker.fetch(
      new Request('https://gateway.test/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'user', content: 'private' }] }),
      }),
      runtimeEnv(),
    );

    expect(response.status).toBe(410);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('rejects a length-less oversized request without buffering or provider egress', async () => {
    const providerFetch = vi.spyOn(globalThis, 'fetch');
    const response = await worker.fetch(
      new Request('https://gateway.test/v1/phrase', {
        method: 'POST',
        headers: { 'x-folio-gateway-token': 'gateway-test-token' },
        body: 'x'.repeat(2_049),
      }),
      runtimeEnv(),
    );

    expect(response.status).toBe(413);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('stops reading a length-less oversized provider response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x'.repeat(20_001)));
    const response = await worker.fetch(
      new Request('https://gateway.test/v1/phrase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-folio-gateway-token': 'gateway-test-token',
        },
        body: JSON.stringify(safeEnvelope),
      }),
      runtimeEnv(),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'Phrasing provider response was too large.',
    });
  });
});
