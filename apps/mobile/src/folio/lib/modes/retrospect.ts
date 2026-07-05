/**
 * @rn-lib       modeRetrospect
 * @purpose      Per-mode framing for the Cycle Close / Insights screen.
 *               Same underlying `CycleRecord[]` — different meaning per
 *               archetype. Growth reads it as pace; Debt as chip-down;
 *               Reset as steps held; Optimizer as leaks closed.
 * @copy         COPY_LINT clean. One accent word per headline. Retrospective
 *               only — never predicts the next month.
 * @notes        RN port of folio-melo (design-main)
 *               `src/lib/modes/retrospect.ts`, kept pure. Insights, Payday
 *               close-summary, and the share card should all read from the
 *               same shape so voice stays synced.
 */
import type { CycleRecord } from '../../store';
import type { MoneyMode } from './types';

export type Kpi = {
  label: string;
  value: string;
  tone?: 'ink' | 'positive' | 'accent' | 'negative';
};

export type Retrospect = {
  /** Small uppercase eyebrow. e.g. "3 months held" */
  eyebrow: string;
  /** Verdict headline. `accent` is the single accent word to em. */
  title: { lead: string; accent: string; tail: string };
  /** Two KPI cards. First is the hero, second is context. */
  primary: Kpi;
  secondary: Kpi;
  /** Sub-caption under the trend chart. Retrospective, calm. */
  trendCaption: string;
  /** Melo line rendered under the chart. One sentence. */
  meloNote: string;
  /** Title for the share card (Insights → Share). */
  shareTitle: string;
};

// ─── helpers ────────────────────────────────────────────────────
const pounds = (n: number) => `£${Math.abs(Math.round(n)).toLocaleString('en-GB')}`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${pounds(n)}`;

type Ctx = {
  cycles: CycleRecord[];
  totalSpare: number;
  avgTight: number;
  avgSetAside: number;
  spareDelta: number;
  potsTotal: number;
  monthsWord: string; // "months" | "month"
};

function makeCtx(cycles: CycleRecord[], potsTotal: number): Ctx {
  const totalSpare = cycles.reduce((s, c) => s + c.spare, 0);
  const avgTight = cycles.length
    ? Math.round(cycles.reduce((s, c) => s + c.tightPoint, 0) / cycles.length)
    : 0;
  const avgSetAside = cycles.length
    ? Math.round(cycles.reduce((s, c) => s + c.setAside, 0) / cycles.length)
    : 0;
  const latest = cycles[0];
  const prior = cycles[1];
  // `latest`/`prior` feed only `spareDelta` below — matching the design
  // source, no builder reads them directly, so `Ctx` doesn't carry them
  // (avoids an exactOptionalPropertyTypes fight over two write-only fields).
  const spareDelta = latest && prior ? latest.spare - prior.spare : 0;
  return {
    cycles,
    totalSpare,
    avgTight,
    avgSetAside,
    spareDelta,
    potsTotal,
    monthsWord: cycles.length === 1 ? 'month' : 'months',
  };
}

// ─── per-mode builders ──────────────────────────────────────────
type Builder = (c: Ctx) => Retrospect;

const survival: Builder = (c) => ({
  eyebrow: `${c.cycles.length} ${c.monthsWord} done`,
  title: { lead: 'The ', accent: 'shape', tail: ' of your months.' },
  primary: { label: 'Saved across all months', value: pounds(c.totalSpare), tone: 'positive' },
  secondary: { label: 'Average low balance', value: pounds(c.avgTight), tone: 'accent' },
  trendCaption: `Lowest balance, last ${Math.min(6, c.cycles.length)}`,
  meloNote:
    c.spareDelta >= 0
      ? "You landed a little higher than last month. That's the shape holding."
      : "A quieter month. The floor's still the honest number to watch.",
  shareTitle: 'Shape of my months',
});

const stability: Builder = (c) => ({
  eyebrow: `${c.cycles.length} ${c.monthsWord} steady`,
  title: { lead: 'The shape ', accent: 'held', tail: '.' },
  primary: {
    label: 'Buffer intact',
    value: pounds(c.potsTotal + Math.max(0, c.avgTight)),
    tone: 'ink',
  },
  secondary: { label: 'Average low balance', value: pounds(c.avgTight), tone: 'accent' },
  trendCaption: `Buffer floor, last ${Math.min(6, c.cycles.length)}`,
  meloNote:
    c.spareDelta >= 0
      ? "Nothing dramatic — and that's the point. Steady shape."
      : 'A softer floor than last month. Still inside the buffer.',
  shareTitle: 'Steady months',
});

const growth: Builder = (c) => {
  const paceMo = Math.max(0, c.avgSetAside);
  return {
    eyebrow: `${c.cycles.length} ${c.monthsWord} of pace`,
    title: { lead: 'The ', accent: 'pace', tail: ' you built.' },
    primary: { label: 'Saved to pots', value: pounds(c.potsTotal), tone: 'positive' },
    secondary: { label: 'Average pace / month', value: pounds(paceMo), tone: 'accent' },
    trendCaption: `Pace floor, last ${Math.min(6, c.cycles.length)}`,
    meloNote:
      paceMo > 0
        ? `About ${pounds(paceMo)} finds a pot most months. That's real.`
        : "Pace hasn't set yet. Even a small weekly amount changes the shape.",
    shareTitle: 'The pace I built',
  };
};

const debt: Builder = (c) => {
  const chipped = c.cycles.reduce((s, x) => s + Math.max(0, x.setAside), 0);
  return {
    eyebrow: `${c.cycles.length} ${c.monthsWord} of the plan`,
    title: { lead: 'Chipped ', accent: 'down', tail: '.' },
    primary: { label: 'Sent to repayments', value: pounds(chipped), tone: 'accent' },
    secondary: { label: 'Average low balance', value: pounds(c.avgTight), tone: 'ink' },
    trendCaption: `Cushion after payments, last ${Math.min(6, c.cycles.length)}`,
    meloNote:
      chipped > 0
        ? "Every month a chip lands. That's the balance moving in the right direction."
        : "The plan's paused. Even a small chunk keeps momentum honest.",
    shareTitle: 'The chip-down',
  };
};

const optimizer: Builder = (c) => {
  const recovered = c.cycles.reduce((s, x) => s + Math.max(0, x.setAside), 0);
  return {
    eyebrow: `${c.cycles.length} ${c.monthsWord} of trim`,
    title: { lead: 'Leaks ', accent: 'closed', tail: '.' },
    primary: { label: 'Recovered so far', value: pounds(recovered), tone: 'positive' },
    secondary: { label: 'Average low balance', value: pounds(c.avgTight), tone: 'accent' },
    trendCaption: `Recovered / month, last ${Math.min(6, c.cycles.length)}`,
    meloNote:
      recovered > 0
        ? "Small trims add up quietly. That's what a clean shape looks like."
        : 'No trims banked yet. Pick one leak — even the smallest counts.',
    shareTitle: 'What I trimmed',
  };
};

const reset: Builder = (c) => ({
  eyebrow: `${c.cycles.length} ${c.monthsWord} held`,
  title: { lead: 'You ', accent: 'held', tail: ' the plan.' },
  primary: { label: 'Months in a row', value: `${c.cycles.length}`, tone: 'ink' },
  secondary: { label: 'Average low balance', value: pounds(c.avgTight), tone: 'accent' },
  trendCaption: `Held floor, last ${Math.min(6, c.cycles.length)}`,
  meloNote:
    c.cycles.length >= 2
      ? "One month at a time. That's the whole plan — and you're doing it."
      : 'First one down. That’s the hardest one. Rest.',
  shareTitle: 'One month at a time',
});

const irregular: Builder = (c) => {
  const runwayAvg = Math.max(0, Math.round(c.avgTight / 250)); // rough weeks proxy
  return {
    eyebrow: `${c.cycles.length} ${c.monthsWord} of runway`,
    title: { lead: 'The ', accent: 'runway', tail: ' you kept.' },
    primary: { label: 'In pots right now', value: pounds(c.potsTotal), tone: 'positive' },
    secondary: { label: 'Avg runway floor', value: `${runwayAvg} wk`, tone: 'accent' },
    trendCaption: `Runway floor, last ${Math.min(6, c.cycles.length)}`,
    meloNote:
      c.potsTotal > 0
        ? "Runway carries between the quiet weeks. That's what it's for."
        : "Runway's thin — one small saved week changes a lot.",
    shareTitle: 'The runway',
  };
};

const household: Builder = (c) => ({
  eyebrow: `${c.cycles.length} ${c.monthsWord} square`,
  title: { lead: 'Your share ', accent: 'held', tail: '.' },
  primary: { label: 'Your side saved', value: pounds(c.totalSpare), tone: 'positive' },
  secondary: { label: 'Average low balance', value: pounds(c.avgTight), tone: 'accent' },
  trendCaption: `Your side floor, last ${Math.min(6, c.cycles.length)}`,
  meloNote: 'Neutral ledger. Nothing to argue about — just the numbers you both kept.',
  shareTitle: 'Our square months',
});

const planning: Builder = (c) => ({
  eyebrow: `${c.cycles.length} ${c.monthsWord} closer`,
  title: { lead: 'The date moved ', accent: 'closer', tail: '.' },
  primary: { label: 'Toward the goal', value: pounds(c.potsTotal), tone: 'positive' },
  secondary: { label: 'Average pace / month', value: pounds(c.avgSetAside), tone: 'accent' },
  trendCaption: `Goal pace, last ${Math.min(6, c.cycles.length)}`,
  meloNote:
    c.avgSetAside > 0
      ? 'Steady months move the date. This is what that looks like.'
      : "The date's still where it was. One small monthly nudge shifts it.",
  shareTitle: 'Toward the goal',
});

const lowVis: Builder = (c) => ({
  eyebrow: `${c.cycles.length} ${c.monthsWord} on record`,
  title: { lead: 'The picture ', accent: 'sharpened', tail: '.' },
  primary: { label: 'Months logged', value: `${c.cycles.length}`, tone: 'ink' },
  secondary: { label: 'Average low balance', value: pounds(c.avgTight), tone: 'accent' },
  trendCaption: `Rough floor, last ${Math.min(6, c.cycles.length)}`,
  meloNote: 'Every month adds detail. The shape gets truer as we go.',
  shareTitle: 'The shape so far',
});

const BUILDERS: Record<MoneyMode, Builder> = {
  survival,
  stability,
  growth,
  debt,
  optimizer,
  reset,
  irregular,
  household,
  planning,
  lowVis,
};

/** Compute per-mode retrospective framing from the cycle history. */
export function getRetrospect(
  mode: MoneyMode,
  cycles: CycleRecord[],
  potsTotal: number,
): Retrospect {
  const ctx = makeCtx(cycles, potsTotal);
  return (BUILDERS[mode] ?? survival)(ctx);
}

/** Format a signed £ delta for the "vs last month" pill. */
export function formatDelta(delta: number): string {
  return signed(delta);
}
