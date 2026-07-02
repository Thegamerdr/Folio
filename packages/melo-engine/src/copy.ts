/**
 * The copy system (MELO_BLUEPRINT.md §10). Two exports:
 * 1. COPY — state-keyed templates. Blueprint-fixed strings are verbatim; every warning
 *    carries its way out; celebration is understated.
 * 2. BANNED_PATTERNS + lintCopy — §10.3 as an enforced test, not a guideline. The banned
 *    list runs against every rendered template in CI (copy.test.ts); a violating string
 *    cannot ship because it cannot pass.
 */

export interface CopyContext {
  readonly safeZone: string; // "£184" — pre-formatted, floor-rounded
  readonly perDay: string; // "£9"
  readonly keepDryPerDay: string; // the per-day figure that dissolves the danger
  readonly dangerDay: string; // "Thursday"
  readonly paydayLabel: string; // "Fri the 12th"
  readonly daysToPayday: number;
  readonly dayOnPath: number; // recovery day counter — always counted forward
  readonly todaysMove: string; // "shift £8"
  readonly staleLabel: string; // "Tuesday"
}

export const COPY = {
  calm: (c) => `${c.safeZone} safe until ${c.paydayLabel}. Nothing needs you today.`,
  protected: () => `Bills covered, buffer intact. This is a good place.`,
  winning: (c) => `Another green month. The buffer's real now — ${c.safeZone}.`,
  tight: (c) =>
    `${c.safeZone} to ${c.paydayLabel} — ${c.perDay}/day. Doable, needs a little steering.`,
  warning: (c) =>
    `Heads up — around ${c.dangerDay}, money runs out before payday. ${c.keepDryPerDay}/day keeps it dry.`,
  danger: (c) =>
    `Honest numbers: ${c.safeZone} to ${c.dangerDay}. Bills are safe — this is about getting to ${c.paydayLabel}. Plan's ready.`,
  overspent: () =>
    `It went over. No lecture — here's the way back: three steps, the first one takes a minute.`,
  recovery: (c) =>
    `Day ${c.dayOnPath} of the way back. Today's move: ${c.todaysMove}. That's the whole ask.`,
  rebuilding: () => `Back on solid ground. Rebuilding the buffer, a little a day.`,
  fog: (c) =>
    `I can't see clearly right now — last good numbers are from ${c.staleLabel}. 30 seconds fixes it.`,
  payday: () => `Payday. Before it starts disappearing — two minutes to make it safe?`,
  paydayEve: () => `Tomorrow's payday. You made it.`,
  billWeek: (c) => `Big week for bills — all shielded. Spending money this week: ${c.safeZone}.`,
  affordSafe: (c) => `Safe — ${c.safeZone} left after, and ${c.dangerDay} stays on plan.`,
  affordTight: (c) => `Tight. It'd leave ${c.safeZone} until ${c.paydayLabel} — doable, not comfy.`,
  affordNotNow: (c) => `Not this side of payday. On ${c.paydayLabel} it's a yes.`,
  affordFog: (c) =>
    `Can't call it — my numbers are from ${c.staleLabel}. Update today's balance and I'll give you a straight answer.`,
  shelf: () =>
    `On the shelf. I'll re-run the numbers tomorrow — if it's still safe, it's still there.`,
  return: () => `Hey. No guilt — money kept moving, I kept notes. 60-second catch-up?`,
} satisfies Record<string, (c: CopyContext) => string>;

export type CopyKey = keyof typeof COPY;

export const SAMPLE_CONTEXT: CopyContext = {
  safeZone: '£184',
  perDay: '£6',
  keepDryPerDay: '£9',
  dangerDay: 'Thursday',
  paydayLabel: 'Fri the 12th',
  daysToPayday: 12,
  dayOnPath: 2,
  todaysMove: 'shift £8',
  staleLabel: 'Tuesday',
};

export interface BannedPattern {
  readonly name: string;
  readonly re: RegExp;
}

/** §10.3 — the machine-checkable subset. Each entry names the crime for the failing test. */
export const BANNED_PATTERNS: readonly BannedPattern[] = [
  { name: 'oops', re: /\boops\b/i },
  { name: 'yikes', re: /\byikes\b/i },
  { name: 'uh-oh', re: /\buh[\s-]?oh\b/i },
  { name: 'you-failed', re: /you failed/i },
  { name: 'blew-it', re: /blew it/i },
  { name: 'naughty', re: /\bnaughty\b/i },
  { name: 'treat-yourself', re: /treat yourself/i },
  { name: 'guilt-free', re: /guilt[\s-]?free/i },
  { name: 'again-negative', re: /\bagain\b/i }, // the cruelest word in fintech — banned in all copy
  { name: 'insufficient-funds', re: /insufficient funds/i },
  { name: 'streak-guilt', re: /break your streak/i },
  { name: 'shouting-caps', re: /\b[A-Z]{4,}\b/ },
  { name: 'alarm-emoji', re: /[\u{1F6A8}\u{1F480}\u{1F62C}\u{1F525}\u{26A0}]/u }, // 🚨💀😬🔥⚠
  { name: 'double-exclaim', re: /!{2,}/ },
];

export function lintCopy(text: string): string[] {
  const violations = BANNED_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
  const exclaims = (text.match(/!/g) ?? []).length;
  if (exclaims > 1) violations.push('exclaim-ceiling');
  return violations;
}
