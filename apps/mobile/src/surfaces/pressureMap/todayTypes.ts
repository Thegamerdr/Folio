// Shared presentation types for the Today rich-home surface.
//
// These are the small, surface-shaped records the container maps its canonical/local data into
// before handing them to the Today sub-components. Keeping them here (no React Native imports) lets
// the sub-components share one contract without re-deriving it, and lets the container map once.
//
// IMPORTANT: these are PRESENTATION shapes, not engine records. The container is responsible for
// mapping LocalLedgerTransaction → TodayTransaction (deriving merchant/category/relative-day from
// the underlying record). Nothing here talks to the engine.

/** A single spend/income row as Today renders it. Money is in minor units (pence). */
export type TodayTransaction = Readonly<{
  id: string;
  /** Display name of the merchant/payee, e.g. "Tesco". */
  merchant: string;
  /** Lower-cased category key the spend strip colours by, e.g. "food" | "bills" | "other". */
  category: string;
  /** Signed minor units — negative for a spend, positive for money in. */
  amountMinor: number;
  /** ISO date (yyyy-mm-dd) of the row, used to render a relative "today / yesterday / Nd ago". */
  date: string;
}>;

/** Which window the money path is framed to. Mirrors the web band toggle. */
export type TodayPathBand = 'week' | 'next' | 'payday';

/** The three-figure summary under the path (coming in / going out / lowest), in minor units. */
export type TodayPathSummary = Readonly<{
  comingInMinor: number;
  goingOutMinor: number;
  lowestMinor: number;
}>;
