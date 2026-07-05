/**
 * @rn-lib       modeOpeners
 * @purpose      Per-mode opener library for Melo. Each mode picks the first
 *               opener whose predicate matches, then falls through to a
 *               deterministic snapshot-aware line if nothing in the pool
 *               fits. Keeps Melo's voice tinted to the archetype without
 *               ever going generic.
 * @copy         Every line follows COPY_LINT.md — plain, calm, no jargon,
 *               no banned words. Openers use lowercase-first casually so
 *               they read as continuation, not header.
 * @notes        RN port of folio-melo (design-main) `src/lib/modes/openers.ts`,
 *               kept identical — the picker is pure so tests can freeze
 *               ordering and assert coverage.
 */
import type { MoneyMode } from './types';

export type OpenerCtx = {
  name: string; // "Sam, " or "" — always trailing space if present
  liveSubsCount: number;
  // `| undefined` (not just `?`) on these five: callers commonly compute
  // them as `maybe?.field` (e.g. `quiet?.name`), which types as
  // `T | undefined` even when the key is always present in the object
  // literal. Under `exactOptionalPropertyTypes`, a present-but-undefined
  // property is a distinct case from an absent one, so the explicit union
  // keeps both call shapes valid without forcing every caller to `delete`
  // or conditionally spread the key.
  quietSubName?: string | undefined; // sub not used in >21d
  quietSubDays?: number | undefined;
  soonSubName?: string | undefined; // renews ≤3d
  soonSubDays?: number | undefined;
  soonSubCost?: number | undefined;
  totalLeaks: number; // £/mo across unused subs
  potsPace: number; // £/week across active pots
  topCategory?: string | undefined; // largest 14-day spend category
  totalSpend14d: number;
  tightestSpare: number;
};

type Opener = (c: OpenerCtx) => string | null;

const survivalPool: Opener[] = [
  (c) =>
    c.tightestSpare < 0
      ? `${c.name}the middle of the cycle looks tight. want me to walk it with you?`
      : null,
  (c) =>
    c.soonSubName
      ? `${c.name}quick one — ${c.soonSubName} £${(c.soonSubCost ?? 0).toFixed(2)} leaves ${
          c.soonSubDays === 0 ? 'today' : `in ${c.soonSubDays}d`
        }. all good?`
      : null,
  (c) =>
    c.quietSubName
      ? `${c.name}heads up — ${c.quietSubName} renews soon and you haven't opened it in ${c.quietSubDays} days. pause this cycle?`
      : null,
  (c) =>
    c.topCategory
      ? `${c.name}last two weeks it's been mostly ${c.topCategory}. want to look at that?`
      : null,
  (c) => `${c.name}here when you need me. one small move today, or just a look?`,
];

const stabilityPool: Opener[] = [
  (c) => `${c.name}month's holding. anything specific worth checking?`,
  (c) => `${c.name}the shape looks steady. want to lift the buffer, or leave it?`,
  (c) =>
    c.quietSubName
      ? `${c.name}${c.quietSubName} keeps auto-renewing but you rarely open it. worth a look?`
      : null,
  (c) => `${c.name}here if you want to sanity-check anything before it moves.`,
];

const growthPool: Opener[] = [
  (c) =>
    c.potsPace > 0
      ? `${c.name}pace this month is about £${(c.potsPace * 4).toFixed(0)} across your pots. nudge it, or hold?`
      : null,
  (c) =>
    c.potsPace === 0
      ? `${c.name}nothing feeding a pot yet. want to pick one small weekly amount to start?`
      : null,
  (c) => `${c.name}room to build. want the fastest small move, or the safest?`,
  (c) =>
    c.topCategory
      ? `${c.name}the ${c.topCategory} line looks steady — trimming it turns straight into pace.`
      : null,
];

const debtPool: Opener[] = [
  (c) => `${c.name}how's the repayment plan sitting? want me to check what's exposed near payday?`,
  (c) =>
    c.totalLeaks > 0
      ? `${c.name}spotted about £${c.totalLeaks.toFixed(0)}/mo in quiet subs — that could go straight at the balance.`
      : null,
  (c) => `${c.name}one honest question — is the number moving down each month, or holding?`,
  (c) => `${c.name}here. no pressure. pick the smallest chunk that would feel good to kill.`,
];

const irregularPool: Opener[] = [
  (c) => `${c.name}since income moves, want to look at what's already committed this cycle?`,
  (c) =>
    `${c.name}runway's the honest number here. want to see how far the current balance stretches?`,
  (c) =>
    c.soonSubName
      ? `${c.name}${c.soonSubName} £${(c.soonSubCost ?? 0).toFixed(2)} lands in ${c.soonSubDays}d — worth timing against the next inflow?`
      : null,
  (c) => `${c.name}quiet week or busy week — either way we can look at the shape.`,
];

const householdPool: Opener[] = [
  (c) => `${c.name}want to look at what's yours vs what's shared this cycle?`,
  (c) => `${c.name}anything shared that feels off? we can just look — no blame.`,
  (c) =>
    c.soonSubName
      ? `${c.name}${c.soonSubName} renews in ${c.soonSubDays}d — is that on the shared list or yours?`
      : null,
  (c) => `${c.name}the ledger's neutral. tap anything and we'll walk it.`,
];

const planningPool: Opener[] = [
  (c) =>
    c.potsPace > 0
      ? `${c.name}at this pace the goal keeps moving closer. want to see the date?`
      : null,
  (c) =>
    c.potsPace === 0
      ? `${c.name}no pace on the goal yet. even £5/week would put a date on it.`
      : null,
  (c) => `${c.name}sanity-check the plan against real spend? we can be honest about it.`,
  (c) => `${c.name}the goal's real. what would speed it up without hurting the week?`,
];

const optimizerPool: Opener[] = [
  (c) =>
    c.totalLeaks > 0
      ? `${c.name}spotted about £${c.totalLeaks.toFixed(0)}/mo sitting in subs you barely open. want me to name the top one?`
      : null,
  (c) =>
    c.totalLeaks === 0
      ? `${c.name}clean run. nothing obvious leaking — want to sweep once more anyway?`
      : null,
  (c) =>
    c.quietSubName
      ? `${c.name}${c.quietSubName} — ${c.quietSubDays}d since you opened it. cut, pause, or keep?`
      : null,
  (c) => `${c.name}one per surface. pick a leak and we'll close it properly.`,
];

const resetPool: Opener[] = [
  (c) => `${c.name}here — no rush. want to look at what's essential this week, or something else?`,
  (c) => `${c.name}one small step. what feels doable today?`,
  (c) =>
    c.quietSubName
      ? `${c.name}if you want a gentle first move: ${c.quietSubName} is unused. cancel or pause?`
      : null,
  (c) => `${c.name}no plan longer than this week. what would be a small win?`,
];

const lowVisPool: Opener[] = [
  (c) =>
    `${c.name}we're still learning your pattern. want to add a statement, or just talk it through?`,
  (c) => `${c.name}the picture's rough right now — one small input sharpens it a lot.`,
  (c) => `${c.name}happy to guess and check with you. what do you already know is coming?`,
  (c) => `${c.name}no pressure to be precise. what's roughly true right now?`,
];

const POOLS: Record<MoneyMode, Opener[]> = {
  survival: survivalPool,
  stability: stabilityPool,
  growth: growthPool,
  debt: debtPool,
  irregular: irregularPool,
  household: householdPool,
  planning: planningPool,
  optimizer: optimizerPool,
  reset: resetPool,
  lowVis: lowVisPool,
};

/**
 * Pick the first opener that returns a non-null string. Deterministic —
 * order in the pool is intentional (most-specific first, gentle fallback
 * last). Callers can shuffle the pool if they want variety per-open.
 */
export function pickOpener(mode: MoneyMode, ctx: OpenerCtx): string {
  const pool = POOLS[mode] ?? survivalPool;
  for (const opener of pool) {
    const line = opener(ctx);
    if (line) return line;
  }
  return `${ctx.name}here when you need me.`;
}
