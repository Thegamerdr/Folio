import { describe, expect, it } from 'vitest';

import { buildChatContext, type ChatContextInputs } from './chatContext.js';
import { lintCopy } from './copy.js';

const TONES = ['calm', 'honest', 'dry', 'coachy'] as const;

const base: ChatContextInputs = {
  todayISO: '2026-07-02',
  safeZonePence: 18_400,
  perDayPence: 900,
  daysToPayday: 12,
  paydayLabel: 'Fri the 12th',
  weather: 'rain',
  ladder: 'warning',
  journey: 'none',
  mascotMood: 'concern',
  billsAhead: [
    { name: 'Rent', amountPence: 60_000, dueDate: '2026-07-05' },
    { name: 'Energy', amountPence: 8_000, dueDate: '2026-07-10' },
  ],
  dangerDayLabel: 'Thursday',
  checksThisWeek: 3,
  tone: 'calm',
};

/** Everything before the tone section — the identity/honesty/numbers contract. */
function beforeTone(prompt: string): string {
  const at = prompt.indexOf('Tone flavor');
  expect(at).toBeGreaterThan(0);
  return prompt.slice(0, at);
}

describe('buildChatContext — identity', () => {
  it('establishes Melo as the same being as the on-screen mascot, in character', () => {
    const prompt = buildChatContext(base);
    expect(prompt).toContain('You are Melo');
    expect(prompt).toContain('one and the same being');
    expect(prompt).toContain('never break character');
    expect(prompt).toContain('never describe yourself as an AI assistant');
  });

  it('injects the mascot mood and the on-screen weather', () => {
    const prompt = buildChatContext(base);
    expect(prompt).toContain('feeling concern');
    expect(prompt).toContain('Sky on screen: rain.');
  });
});

describe('buildChatContext — live numbers', () => {
  it('contains the exact formatted figures the user sees', () => {
    const prompt = buildChatContext(base);
    expect(prompt).toContain('Safe Zone until payday: £184.');
    expect(prompt).toContain('Per day: £9.');
    expect(prompt).toContain('Rent £600 (due 2026-07-05)');
    expect(prompt).toContain('Energy £80 (due 2026-07-10)');
    expect(prompt).toContain('Payday: Fri the 12th, 12 days away.');
  });

  it('mirrors the full mascot state: ladder, journey, check-ins, today', () => {
    const prompt = buildChatContext(base);
    expect(prompt).toContain('Ladder state: warning.');
    expect(prompt).toContain('Journey: none.');
    expect(prompt).toContain('Money check-ins this week: 3.');
    expect(prompt).toContain('today is 2026-07-02');
  });

  it('declares the numbers the only money facts and forbids inventing others', () => {
    const prompt = buildChatContext(base);
    expect(prompt).toContain('the only money facts you may state');
    expect(prompt).toContain('never guess, never invent');
  });

  it('includes the danger day when present', () => {
    const prompt = buildChatContext(base);
    expect(prompt).toContain('Danger day: Thursday');
  });

  it('omits the danger line entirely when the label is null', () => {
    const prompt = buildChatContext({ ...base, dangerDayLabel: null });
    expect(prompt).not.toContain('Danger day');
    expect(prompt).not.toContain('Thursday');
  });

  it('says so when no bills are ahead', () => {
    const prompt = buildChatContext({ ...base, billsAhead: [] });
    expect(prompt).toContain('Bills ahead: none before payday.');
  });
});

describe('buildChatContext — tools', () => {
  it('names all four log tools as user-confirmed suggestions, never self-executed', () => {
    const prompt = buildChatContext(base);
    for (const tool of ['log_spend', 'log_income', 'log_refund', 'log_transfer']) {
      expect(prompt).toContain(tool);
    }
    expect(prompt).toContain('confirmed by the user in the app');
    expect(prompt).toContain('never record anything yourself');
  });
});

describe('buildChatContext — tone', () => {
  it('the four tone variants differ pairwise', () => {
    const prompts = TONES.map((tone) => buildChatContext({ ...base, tone }));
    const unique = new Set(prompts);
    expect(unique.size).toBe(TONES.length);
  });

  it('all tones share the identity/honesty/numbers block byte-for-byte', () => {
    const [first, ...rest] = TONES.map((tone) => beforeTone(buildChatContext({ ...base, tone })));
    for (const other of rest) {
      expect(other).toBe(first);
    }
  });

  it('every tone declares itself flavor only — warnings and numbers never soften', () => {
    for (const tone of TONES) {
      const prompt = buildChatContext({ ...base, tone });
      expect(prompt).toContain('flavor only — the warnings and numbers above never soften');
    }
  });
});

describe('buildChatContext — voice and copy lint', () => {
  it('the whole prompt passes lintCopy in every tone', () => {
    for (const tone of TONES) {
      expect(lintCopy(buildChatContext({ ...base, tone }))).toEqual([]);
    }
  });

  it('encodes the voice: calm, honest, adult, no shame, short by default', () => {
    const prompt = buildChatContext(base);
    expect(prompt).toContain('calm, honest, adult');
    expect(prompt).toContain('No shame');
    expect(prompt).toContain('Short replies by default');
  });
});

describe('buildChatContext — engine discipline', () => {
  it('is deterministic: same input twice gives the same string', () => {
    expect(buildChatContext(base)).toBe(buildChatContext({ ...base }));
  });

  it('stays within the 2400-character budget for typical input, in every tone', () => {
    for (const tone of TONES) {
      expect(buildChatContext({ ...base, tone }).length).toBeLessThanOrEqual(2400);
    }
  });

  it('has no trailing-whitespace lines and no leading/trailing blank', () => {
    const prompt = buildChatContext(base);
    expect(prompt).toBe(prompt.trim());
    for (const line of prompt.split('\n')) {
      expect(line).toBe(line.replace(/\s+$/, ''));
    }
  });

  it('rejects fractional pence in the zone, per-day, and bills', () => {
    expect(() => buildChatContext({ ...base, safeZonePence: 10.5 })).toThrow(/integer pence/);
    expect(() => buildChatContext({ ...base, perDayPence: 0.1 })).toThrow(/integer pence/);
    expect(() =>
      buildChatContext({
        ...base,
        billsAhead: [{ name: 'Rent', amountPence: 600.5, dueDate: '2026-07-05' }],
      }),
    ).toThrow(/integer pence/);
  });

  it('grammar edges: payday today and 1 day away read cleanly', () => {
    expect(buildChatContext({ ...base, daysToPayday: 0 })).toContain(
      'Payday: Fri the 12th, today.',
    );
    expect(buildChatContext({ ...base, daysToPayday: 1 })).toContain(
      'Payday: Fri the 12th, 1 day away.',
    );
  });
});
