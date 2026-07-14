// Tests for the Melo AI client's pure seams:
//   • resolveNamedTarget — the tolerant name matcher that lets a "Do it" chip resolve a subscription
//     or pot even when the model's echoed name is slightly off ("Net flix" → "Netflix").
//   • buildMeloSystemPrompt — must hand the model the user's own subscription + pot names so it can
//     echo them back exactly (the precondition for the matcher to find a target at all).
//
// meloAiClient imports expo-constants at module load, which the node test runner can't parse, so we
// mock it to an empty config. The pure functions under test never touch it.

import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));

import type { MeloLocalFinancialSnapshot } from '@folio/ai-contracts';

import {
  buildMeloSystemPrompt,
  guardBlindMeloReply,
  resolveNamedTarget,
  splitReplyAndSuggestions,
  windowChatHistory,
  type MeloChatMessage,
  type NamedTarget,
} from './meloAiClient';

const subs: readonly NamedTarget[] = [
  { id: 'sub_1', name: 'Netflix' },
  { id: 'sub_2', name: 'Spotify Premium' },
  { id: 'sub_3', name: 'Amazon Prime' },
];

const baseSnapshot: MeloLocalFinancialSnapshot = {
  currency: 'GBP',
  availableNowMinor: 14_200,
  tightestDay: 'Tuesday',
  tightestBalanceMinor: 8_300,
  protectedItems: ['rent'],
  pendingReviewCount: 0,
  nextPaydayLabel: 'next payday',
};

describe('resolveNamedTarget — tolerant matching', () => {
  it('matches an exact name', () => {
    expect(resolveNamedTarget('Netflix', subs)?.id).toBe('sub_1');
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(resolveNamedTarget('  netflix ', subs)?.id).toBe('sub_1');
  });

  it('tolerates internal spacing and punctuation noise', () => {
    expect(resolveNamedTarget('Net flix', subs)?.id).toBe('sub_1');
    expect(resolveNamedTarget('NETFLIX!', subs)?.id).toBe('sub_1');
  });

  it('matches when the model adds an extra word the stored name omits', () => {
    // "Spotify" should resolve the stored "Spotify Premium"; "Netflix subscription" → "Netflix".
    expect(resolveNamedTarget('Spotify', subs)?.id).toBe('sub_2');
    expect(resolveNamedTarget('Netflix subscription', subs)?.id).toBe('sub_1');
  });

  it('returns undefined when nothing is close enough', () => {
    expect(resolveNamedTarget('Disney Plus', subs)).toBeUndefined();
    expect(resolveNamedTarget('', subs)).toBeUndefined();
  });

  it('prefers the most specific (shortest) matching stored name', () => {
    const candidates: readonly NamedTarget[] = [
      { id: 'a', name: 'Holiday fund 2026' },
      { id: 'b', name: 'Holiday' },
    ];
    expect(resolveNamedTarget('holiday', candidates)?.id).toBe('b');
  });
});

describe('buildMeloSystemPrompt — names reach the model', () => {
  it('names the user’s subscriptions and pots when the snapshot carries them', () => {
    const prompt = buildMeloSystemPrompt('calm', {
      ...baseSnapshot,
      subscriptionNames: ['Netflix', 'Spotify'],
      potNames: ['Holiday'],
    });
    expect(prompt).toContain('Netflix');
    expect(prompt).toContain('Spotify');
    expect(prompt).toContain('Holiday');
    expect(prompt).toContain('use the user’s exact names');
  });

  it('omits the names instruction when there are no subscriptions or pots', () => {
    const prompt = buildMeloSystemPrompt('calm', {
      ...baseSnapshot,
      subscriptionNames: [],
      potNames: [],
    });
    expect(prompt).not.toContain('use the user’s exact names');
  });

  it('tells the model it has no money data when given no snapshot', () => {
    const prompt = buildMeloSystemPrompt('calm');
    expect(prompt).toContain('do not have access');
    expect(prompt).toContain('do not calculate or claim any effect');
    expect(prompt).not.toContain('tight point down to around £42');
  });
});

describe('guardBlindMeloReply — no invented money claims when sharing is off', () => {
  const thread: readonly MeloChatMessage[] = [
    { id: 'u1', role: 'user', text: 'log 5 pounds at Cafe' },
  ];

  it('keeps an amount already stated in the conversation', () => {
    expect(guardBlindMeloReply('I can prepare the £5 spend.', thread, true)).toBe(
      'I can prepare the £5 spend.',
    );
  });

  it('replaces an ungrounded projection while retaining the confirmation flow', () => {
    expect(
      guardBlindMeloReply('that pulls your tight point down to around £17.', thread, true),
    ).toBe('I can prepare that for you. Check the details below before you confirm.');
  });

  it('uses a no-data explanation when there is no suggestion to inspect', () => {
    expect(guardBlindMeloReply('your balance will be £17.', thread, false)).toBe(
      "I don't have enough confirmed information to put a number on that yet.",
    );
  });
});

describe('windowChatHistory — outbound cost bound', () => {
  const msg = (id: number, text: string): MeloChatMessage => ({
    id: `m-${id}`,
    role: id % 2 === 0 ? 'user' : 'assistant',
    text,
  });

  it('passes a short thread through untouched', () => {
    const thread = [msg(1, 'hello'), msg(2, 'hi there')];
    expect(windowChatHistory(thread)).toEqual(thread);
  });

  it('keeps only the newest 24 messages of a long thread', () => {
    const thread = Array.from({ length: 60 }, (_, i) => msg(i, `turn ${i}`));
    const windowed = windowChatHistory(thread);
    expect(windowed).toHaveLength(24);
    expect(windowed[0]!.text).toBe('turn 36'); // oldest kept = 60 - 24
    expect(windowed[23]!.text).toBe('turn 59'); // newest always survives
  });

  it('caps one pasted wall of text at 4,000 chars, keeping the tail', () => {
    const wall = `${'x'.repeat(5_000)}what should I do?`;
    const [windowed] = windowChatHistory([msg(0, wall)]);
    expect(windowed!.text).toHaveLength(4_000);
    expect(windowed!.text.endsWith('what should I do?')).toBe(true);
  });

  it('never mutates the caller’s messages', () => {
    const wall = msg(0, 'y'.repeat(5_000));
    windowChatHistory([wall]);
    expect(wall.text).toHaveLength(5_000);
  });
});

describe('splitReplyAndSuggestions — gateway fence tolerance', () => {
  it('turns an allow-listed tool array in a generic json fence into a confirmation suggestion', () => {
    const result = splitReplyAndSuggestions(`i can help with that.\n\n\`\`\`json
[
  {"name":"log_spend","args":{"merchant":"Tesco","amount":10,"category":"food"},"summary":"log a £10 spend at Tesco"}
]
\`\`\``);

    expect(result.prose).toBe('i can help with that.');
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      name: 'log_spend',
      args: { merchant: 'Tesco', amount: 10, category: 'food' },
      summary: 'log a £10 spend at Tesco',
    });
  });

  it('leaves an ordinary json block visible when it contains no allow-listed tool', () => {
    const reply = 'Here is the breakdown.\n\n```json\n{"total":10}\n```';
    expect(splitReplyAndSuggestions(reply)).toEqual({ prose: reply, suggestions: [] });
  });
});
