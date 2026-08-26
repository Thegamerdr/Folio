import { beforeEach, describe, expect, it } from 'vitest';

import { addStatementAsHistory, getState, resetToEmpty, setPartial } from '../store';
import { routeFromStore } from './storeRoute';
import { buildScaleFixture } from './scaleFixture.testSupport';

describe('10k+ post-import performance contract', () => {
  beforeEach(() => resetToEmpty());

  it('commits one large statement without truncating it, then derives the route responsively', () => {
    const fixture = buildScaleFixture(10_001);
    const commitStarted = performance.now();
    const result = addStatementAsHistory(fixture.candidates);
    const commitMs = performance.now() - commitStarted;

    expect(result.added).toBe(10_001);
    expect(result.droppedTransactionCount).toBe(0);
    expect(getState().transactions).toHaveLength(10_001);

    setPartial({
      subs: [...fixture.subs],
      debts: [...fixture.debts],
      pots: [...fixture.pots],
      calendarEvents: [...fixture.calendarEvents],
    });
    const routeStarted = performance.now();
    const route = routeFromStore(getState(), '2026-08-26');
    const routeMs = performance.now() - routeStarted;

    expect(route.points.length).toBeGreaterThan(1);
    // Generous cross-platform budgets: regressions such as per-row store writes or quadratic scans
    // exceed these by orders of magnitude; ordinary CI variance does not.
    expect(commitMs).toBeLessThan(8_000);
    expect(routeMs).toBeLessThan(750);
  }, 12_000);
});
