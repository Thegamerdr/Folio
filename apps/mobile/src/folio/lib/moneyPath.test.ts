// Money-path route engine tests — acceptance criteria for `computeRoute`
// (apps/mobile/src/folio/lib/moneyPath.ts), written FIRST (TDD).
//
// The engine is pure and deterministic: it takes `now`, `payday`, the
// starting balance, and dated money items as inputs and never reads
// Date.now() or the store singleton. So these tests pin behaviour by
// constructing explicit scenarios and asserting the exact tight point,
// its date, the earliest-day tie-break, and that pots/borrows/income
// move the curve the way ENGINES.md §6 "Today — path shape" requires.
//
// Node-safe: imports only the pure engine module (no react-native, no DOM),
// so it is collected by the apps/**/*.test.ts vitest runner. Relative
// import like store.test.ts — the runner has no `@` alias.

import { describe, expect, it } from 'vitest';

import {
  computeRoute,
  selectPaydayTightPoint,
  tightPointDayLabel,
  type RouteInput,
} from './moneyPath';

// A fixed "today" so every sampled date is deterministic. Midday UTC keeps
// the per-day ISO slice stable regardless of the host timezone offset.
const NOW = '2026-06-01';

/** Minimal valid input with no money movements — the flat baseline. */
function baseInput(overrides: Partial<RouteInput> = {}): RouteInput {
  return {
    now: NOW,
    payday: '2026-06-11', // 10 days ahead → 11 sampled days (today..payday)
    balance: 1000,
    income: [],
    bills: [],
    subs: [],
    spend: [],
    holds: [],
    pots: [],
    openBorrows: 0,
    ...overrides,
  };
}

describe('computeRoute — sampling shape', () => {
  it('samples once per calendar day from today through payday inclusive', () => {
    const r = computeRoute(baseInput());
    expect(r.points.length).toBe(11); // 2026-06-01 .. 2026-06-11
    expect(r.points[0]!.date).toBe('2026-06-01');
    expect(r.points[r.points.length - 1]!.date).toBe('2026-06-11');
    expect(r.daysToPayday).toBe(10);
  });

  it('a flat cycle (no movements) holds y at the starting balance', () => {
    const r = computeRoute(baseInput());
    expect(r.points.every((p) => p.y === 1000)).toBe(true);
    expect(r.tightPoint.amount).toBe(1000);
    // Earliest day is the tie-break when every day is equal.
    expect(r.tightPoint.date).toBe('2026-06-01');
    expect(r.spare).toBe(1000);
  });
});

describe('computeRoute — known scenario tight point', () => {
  it('finds the lowest projected balance and the day it lands on', () => {
    // balance 1000.
    //  06-03  rent      -600  -> 400
    //  06-05  groceries -120  -> 280  (the low)
    //  06-08  sub        -10  -> 270  ... wait, lower. Make income lift it back.
    //  06-07  side gig  +200  -> 480 before the sub
    // Construct so the explicit minimum is unambiguous on 06-05.
    const r = computeRoute(
      baseInput({
        bills: [{ date: '2026-06-03', amount: 600 }],
        spend: [{ date: '2026-06-05', amount: 120 }],
        income: [{ date: '2026-06-07', amount: 500 }],
      }),
    );
    // Day balances: 06-01..02 = 1000; 06-03..04 = 400; 06-05..06 = 280;
    // 06-07..11 = 780.
    expect(r.tightPoint.amount).toBe(280);
    expect(r.tightPoint.date).toBe('2026-06-05');
    // Spare = balance on payday (end of cycle).
    expect(r.spare).toBe(780);
    // Spot-check a couple of sampled points.
    expect(r.points.find((p) => p.date === '2026-06-03')!.y).toBe(400);
    expect(r.points.find((p) => p.date === '2026-06-07')!.y).toBe(780);
  });
});

describe('computeRoute — earliest-day tie-break', () => {
  it('when two days share the minimum, the tight point is the earlier day', () => {
    // Drop to 200 on 06-04, climb on 06-06 (+50), drop the same 50 on 06-08
    // so 06-04..05 and 06-08..onward both sit at 200. Earliest (06-04) wins.
    const r = computeRoute(
      baseInput({
        balance: 700,
        spend: [
          { date: '2026-06-04', amount: 500 }, // -> 200
          { date: '2026-06-06', amount: -50 }, // refund-style credit -> 250
          { date: '2026-06-08', amount: 50 }, // -> 200 again (tie)
        ],
      }),
    );
    expect(r.tightPoint.amount).toBe(200);
    expect(r.tightPoint.date).toBe('2026-06-04'); // earliest of the two 200s
  });
});

describe('computeRoute — pots tie to cash and lower the path', () => {
  it('Σ pots.saved is subtracted from every sampled day', () => {
    const withoutPots = computeRoute(baseInput());
    const withPots = computeRoute(baseInput({ pots: [{ saved: 300 }, { saved: 120 }] }));

    // Every point drops by Σ saved (420), tight point and spare follow.
    for (const p of withPots.points) {
      const before = withoutPots.points.find((q) => q.date === p.date)!;
      expect(p.y).toBe(before.y - 420);
    }
    expect(withPots.tightPoint.amount).toBe(withoutPots.tightPoint.amount - 420);
    expect(withPots.spare).toBe(withoutPots.spare - 420);
  });
});

describe('computeRoute — a borrow lifts the path', () => {
  it('Σ open-borrows is added back to every sampled day', () => {
    // Pots pull the path down; an open borrow against a pot lifts it back up.
    const earmarked = computeRoute(baseInput({ pots: [{ saved: 300 }] }));
    const borrowed = computeRoute(baseInput({ pots: [{ saved: 300 }], openBorrows: 100 }));

    for (const p of borrowed.points) {
      const before = earmarked.points.find((q) => q.date === p.date)!;
      expect(p.y).toBe(before.y + 100);
    }
    expect(borrowed.tightPoint.amount).toBe(earmarked.tightPoint.amount + 100);
    expect(borrowed.spare).toBe(earmarked.spare + 100);
  });
});

describe('computeRoute — income raises y on and after payday', () => {
  it('income on payday lifts the final day, not the days before it', () => {
    const r = computeRoute(
      baseInput({
        income: [{ date: '2026-06-11', amount: 1840 }], // lands on payday
      }),
    );
    // Days before payday stay at 1000; payday itself jumps to 2840.
    expect(r.points.find((p) => p.date === '2026-06-10')!.y).toBe(1000);
    expect(r.points.find((p) => p.date === '2026-06-11')!.y).toBe(2840);
    // The low is the pre-payday plateau, not the payday spike.
    expect(r.tightPoint.amount).toBe(1000);
    expect(r.tightPoint.date).toBe('2026-06-01');
    // Spare is the balance after payday income lands.
    expect(r.spare).toBe(2840);
  });
});

describe('computeRoute — active holds and subs deduct cumulatively', () => {
  it('subs and holds reduce y from their date forward', () => {
    const r = computeRoute(
      baseInput({
        subs: [{ date: '2026-06-02', amount: 12 }],
        holds: [{ date: '2026-06-04', amount: 50 }],
      }),
    );
    expect(r.points.find((p) => p.date === '2026-06-01')!.y).toBe(1000);
    expect(r.points.find((p) => p.date === '2026-06-02')!.y).toBe(988); // -12
    expect(r.points.find((p) => p.date === '2026-06-03')!.y).toBe(988);
    expect(r.points.find((p) => p.date === '2026-06-04')!.y).toBe(938); // -12 -50
    expect(r.tightPoint.amount).toBe(938);
    expect(r.tightPoint.date).toBe('2026-06-04');
  });
});

describe('computeRoute — determinism + guards', () => {
  it('is pure: identical input yields byte-identical output across calls', () => {
    const input = baseInput({
      bills: [{ date: '2026-06-03', amount: 600 }],
      spend: [{ date: '2026-06-05', amount: 120 }],
    });
    expect(computeRoute(input)).toEqual(computeRoute(input));
  });

  it('a same-day payday yields a single sampled point', () => {
    const r = computeRoute(baseInput({ payday: NOW }));
    expect(r.points.length).toBe(1);
    expect(r.daysToPayday).toBe(0);
    expect(r.points[0]!.date).toBe(NOW);
    expect(r.tightPoint.date).toBe(NOW);
  });

  it('items dated outside [today, payday] do not bend the curve', () => {
    const r = computeRoute(
      baseInput({
        spend: [
          { date: '2026-05-20', amount: 500 }, // before today — ignored
          { date: '2026-07-01', amount: 500 }, // after payday — ignored
        ],
      }),
    );
    expect(r.points.every((p) => p.y === 1000)).toBe(true);
    expect(r.tightPoint.amount).toBe(1000);
  });
});

describe('payday-window presentation helpers', () => {
  it('selects the payday-window low without changing the full route', () => {
    const route = computeRoute(
      baseInput({
        windowDays: 15,
        bills: [{ date: '2026-06-04', amount: 100 }],
        spend: [{ date: '2026-06-13', amount: 500 }],
      }),
    );
    const routeBeforeSelection = structuredClone(route);

    const paydayLow = selectPaydayTightPoint(route);

    expect(paydayLow).toEqual({ date: '2026-06-04', amount: 900 });
    expect(route).toEqual(routeBeforeSelection);
    expect(route.points).toHaveLength(16);
    expect(route.tightPoint).toEqual({ date: '2026-06-13', amount: 400 });
  });

  it('uses today, tomorrow, then the weekday and day for honest tight-point copy', () => {
    const now = new Date(2026, 7, 18, 23, 30);

    expect(tightPointDayLabel('2026-08-18', now)).toBe('today');
    expect(tightPointDayLabel('2026-08-19', now)).toBe('tomorrow');
    expect(tightPointDayLabel('2026-08-21', now)).toBe('Friday 21');
  });
});
