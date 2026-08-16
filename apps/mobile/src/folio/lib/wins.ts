// Tiny Wins — earned, quiet celebrations. No streaks page, no badges page, no gamified push. Each win
// is a single line, awarded once when the user clears a moment that deserves noticing. Insights
// surfaces the recent strip; Melo can drop the line into chat when relevant.
//
// Faithful 1:1 RN port of the web design source
// (folio-melo/.claude/worktrees/design-main/src/lib/wins/index.ts).
//
// Rules the RN port MUST keep:
//   - Never award more than one win per surface interaction.
//   - Never award during a Storm or active Recovery (bad money moments).
//   - `awardedAt` is monotonic — the UI never re-orders older wins to feel "fresh"; that reads
//     dishonest.
//
// @rn-engine tiny-wins — this file ports the pure data shape + one-shot-per-kind guard. Wiring the
// actual award call-sites (danger-date-pushed / first-10-saved / afford-streak-3/7 /
// bill-week-survived / first-green-after-red / first-pot-funded / first-sub-caught) into their real
// trigger points across the app is a separate, larger effort tracked outside this port — until those
// call-sites award a win, `tinyWins` stays honestly empty and the Insights "Tiny wins" section simply
// does not render (matching its own `tinyWins.length > 0` guard), rather than fabricating data.

export type TinyWinKind =
  | 'danger-date-pushed'
  | 'first-10-saved'
  | 'afford-streak-3'
  | 'afford-streak-7'
  | 'bill-week-survived'
  | 'first-green-after-red'
  | 'first-pot-funded'
  | 'first-sub-caught'
  | 'first-postcard-shared'
  | 'first-sub-cancelled'
  | 'first-pot-fully-funded'
  | 'four-week-green-streak';

export type TinyWin = {
  id: string;
  kind: TinyWinKind;
  /** ISO timestamp */
  awardedAt: string;
  /** The single line shown in the strip. Short, warm, never triumphal. */
  message: string;
};

export const WIN_COPY: Record<TinyWinKind, string> = {
  'danger-date-pushed': 'You moved the Danger Date back.',
  'first-10-saved': 'First tenner into a pot. Small, real.',
  'afford-streak-3': "Three afford-checks in a row. That's the muscle.",
  'afford-streak-7': 'A week of checking before spending.',
  'bill-week-survived': 'Bill week held. Nothing dropped.',
  'first-green-after-red': 'First green cycle after a red one.',
  'first-pot-funded': 'You funded a pot on purpose.',
  'first-sub-caught': 'Caught your first sub. Handled it.',
  'first-postcard-shared': 'First postcard shared. Your words, sent.',
  'first-sub-cancelled': 'One subscription stopped. That saving keeps going.',
  'first-pot-fully-funded': 'One pot, fully funded.',
  'four-week-green-streak': 'Four green cycles in a row. Quiet rhythm.',
};

export function makeWin(kind: TinyWinKind): TinyWin {
  return {
    id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    awardedAt: new Date().toISOString(),
    message: WIN_COPY[kind],
  };
}

/** Guard: has this win already been awarded? Idempotent by kind — one award per kind, ever. */
export function hasWin(list: readonly TinyWin[], kind: TinyWinKind): boolean {
  return list.some((w) => w.kind === kind);
}
