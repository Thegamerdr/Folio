import { describe, expect, it } from 'vitest';

import { getState, hasConfiguredMoneyPicture } from '../store';
import { deriveCalendarEvents } from '../lib/calendarEvents';
import { findCaughtSubs } from '../lib/caughtSubs';
import { routeFromStore } from '../lib/storeRoute';
import { activateParityHarness, type ParityFixtureId } from './parityHarness';

function activate(fixture: ParityFixtureId) {
  activateParityHarness({
    fixture,
    nowISO: '2026-08-18T08:00:00.000Z',
    screen: 'today',
    sheet: null,
    globalSurface: null,
    theme: 'light',
  });
  return getState();
}

describe('visual parity fixture harness', () => {
  it('builds the confirmed, provisional, pressured and negative personal states', () => {
    expect(activate('confirmed-safe')).toMatchObject({
      currentBalance: { amount: 1480, confidence: 'corrected' },
      onboarding: { done: true, payday: 28, monthlyIncome: 2600 },
    });
    expect(getState().transactions).toHaveLength(4);
    expect(getState().subs).toHaveLength(2);
    expect(getState().calendarEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Octopus Energy', date: '2026-09-01', amount: -118.4 }),
        expect.objectContaining({ title: 'Rent', date: '2026-09-11', amount: -540 }),
        expect.objectContaining({ title: 'Check Klarna · 2 of 3', date: '2026-09-01' }),
      ]),
    );
    expect(getState().calendarEvents).toHaveLength(5);
    expect(getState().incomeSources?.[0]?.dayOfMonth).toBe(28);
    expect(
      findCaughtSubs(
        getState().transactions,
        getState().subs.map((subscription) => subscription.name),
        '2026-08-18',
      ),
    ).toEqual([
      expect.objectContaining({
        name: 'Sound+ Studio',
        amount: 6.99,
        seen: 3,
        lastDateIso: '2026-08-12',
        cadence: 'monthly',
      }),
    ]);

    expect(activate('provisional-low-confidence').currentBalance).toMatchObject({
      amount: 680,
      confidence: 'rough',
    });
    expect(activate('pressured').subs.reduce((sum, item) => sum + item.cost, 0)).toBe(440);
    expect(activate('negative-shortfall').subs.reduce((sum, item) => sum + item.cost, 0)).toBe(730);
  });

  it('builds commitments and pending Review through their public authorities', () => {
    const commitments = activate('populated-commitments');
    expect(commitments.pots).toHaveLength(2);
    expect(commitments.debts).toHaveLength(1);
    expect(commitments.plans).toHaveLength(1);
    expect(commitments.pots[0]).toMatchObject({ id: 'fixture-buffer', saved: 420, goal: 900 });
    expect(commitments.debts?.[0]).toMatchObject({ id: 'fixture-loan', balance: 2400 });
    expect(commitments.plans?.[0]).toMatchObject({ id: 'fixture-plan', target: 1600 });
    const commitmentEvents = deriveCalendarEvents({
      subs: commitments.subs,
      subPaused: commitments.subPaused,
      subOverrides: commitments.subOverrides,
      onboarding: commitments.onboarding,
      manualEvents: commitments.calendarEvents,
      pots: commitments.pots,
      incomeSources: commitments.incomeSources ?? [],
      spendHold: commitments.spendHold ?? null,
      whatIfHolds: commitments.whatIfHolds ?? [],
      windowDays: 35,
      now: new Date('2026-08-18T08:00:00.000Z'),
      includeSampleBills: false,
    });
    const commitmentOut = commitmentEvents.filter(
      (event) => event.kind === 'out' && typeof event.amount === 'number' && event.amount < 0,
    );
    expect(commitmentOut).toHaveLength(16);
    expect(commitmentOut.reduce((sum, event) => sum + Math.abs(event.amount ?? 0), 0)).toBeCloseTo(
      1421.4,
    );

    const pending = activate('pending-review');
    expect(pending.evidenceDocuments).toHaveLength(1);
    expect(pending.reviewQueue).toHaveLength(2);
    expect(pending.reviewQueue?.map((item) => item.merchant)).toEqual([
      'Railcard',
      'Freelance payment',
    ]);
    expect(
      pending.reviewQueue?.map(({ id, addedAt, date, amount, category }) => ({
        id,
        addedAt,
        date,
        amount,
        category,
      })),
    ).toEqual([
      {
        id: 'rv-1787040000000-shsw58',
        addedAt: '2026-08-18T08:00:00.000Z',
        date: '2026-08-17',
        amount: -30,
        category: 'transport',
      },
      {
        id: 'rv-1787040000000-mzt6a4',
        addedAt: '2026-08-18T08:00:00.000Z',
        date: '2026-08-16',
        amount: 480,
        category: 'income',
      },
    ]);
  });

  it('feeds the confirmed fixture through the native calendar and route authorities', () => {
    const state = activate('confirmed-safe');
    const events = deriveCalendarEvents({
      subs: state.subs,
      subPaused: state.subPaused,
      subOverrides: state.subOverrides,
      onboarding: state.onboarding,
      manualEvents: state.calendarEvents,
      pots: state.pots,
      incomeSources: state.incomeSources ?? [],
      spendHold: state.spendHold ?? null,
      whatIfHolds: state.whatIfHolds ?? [],
      windowDays: 35,
      now: new Date('2026-08-18T08:00:00.000Z'),
      includeSampleBills: false,
    });
    expect(events.map(({ date, title, amount }) => ({ date, title, amount }))).toEqual([
      { date: '2026-08-20', title: 'Council tax', amount: -120 },
      { date: '2026-08-22', title: 'Energy', amount: -68 },
      { date: '2026-08-28', title: 'Payday', amount: 2600 },
      { date: '2026-09-01', title: 'Check Klarna · 2 of 3', amount: undefined },
      { date: '2026-09-01', title: 'Council Tax', amount: -162 },
      { date: '2026-09-01', title: 'Octopus Energy', amount: -118.4 },
      { date: '2026-09-03', title: 'BT Broadband', amount: -38 },
      { date: '2026-09-11', title: 'Rent', amount: -540 },
    ]);

    const route = routeFromStore(state, new Date('2026-08-18T08:00:00.000Z'));
    expect(route.daysToPayday).toBe(10);
    expect(route.spare).toBe(3892);
    expect(route.tightPoint).toEqual({ date: '2026-08-22', amount: 1292 });
    expect(route.points.find((point) => point.date === '2026-09-11')?.y).toBeCloseTo(3033.6);
  });

  it('stages exact reader-result evidence only for the requested success screen', () => {
    activateParityHarness({
      fixture: 'confirmed-safe',
      nowISO: '2026-08-18T08:00:00.000Z',
      screen: 'image-success',
      sheet: null,
      globalSurface: null,
      theme: 'light',
    });
    expect(getState().readerCandidates).toMatchObject([
      { merchant: "Sainsbury's", amount: -27.4, source: 'photo' },
      { merchant: 'ATM withdrawal', amount: -40, source: 'photo' },
    ]);
    expect(getState().evidenceDocuments).toMatchObject([{ filename: 'IMG_2643.jpg' }]);

    activateParityHarness({
      fixture: 'confirmed-safe',
      nowISO: '2026-08-18T08:00:00.000Z',
      screen: 'pdf-success',
      sheet: null,
      globalSurface: null,
      theme: 'dark',
    });
    expect(
      getState().readerCandidates.map(({ merchant, amount, source }) => ({
        merchant,
        amount,
        source,
      })),
    ).toEqual([
      { merchant: 'Salary — Whitstone Ltd', amount: 2180, source: 'pdf' },
      { merchant: 'Octopus Energy', amount: -118, source: 'pdf' },
      { merchant: 'Tesco', amount: -42, source: 'pdf' },
    ]);
    expect(getState().evidenceDocuments).toMatchObject([{ filename: 'Statement_June_2025.pdf' }]);

    const ordinary = activate('confirmed-safe');
    expect(ordinary.readerCandidates).toEqual([]);
    expect(ordinary.evidenceDocuments).toEqual([]);
  });

  it('keeps empty and first-run states distinct and unconfigured', () => {
    const empty = activate('empty');
    expect(empty.onboarding.done).toBe(true);
    expect(hasConfiguredMoneyPicture(empty)).toBe(false);

    const firstRun = activate('first-run');
    expect(firstRun.onboarding.done).toBe(false);
    expect(hasConfiguredMoneyPicture(firstRun)).toBe(false);
  });

  it('builds populated Sole Trader and Ltd partitions from business-engine fixtures', () => {
    const sole = activate('business-sole-trader');
    expect(sole.business?.entity?.kind).toBe('sole-trader');
    expect(sole.business?.invoices).toHaveLength(3);
    expect(sole.accounts?.[0]?.balanceMinor).toBe(600_000);

    const ltd = activate('business-ltd');
    expect(ltd.business?.entity?.kind).toBe('ltd');
    expect(ltd.business?.payrollRuns).toHaveLength(1);
    expect(ltd.accounts?.[0]?.balanceMinor).toBe(1_400_000);
  });

  it('builds an active empty Business partition for first-cash-picture capture', () => {
    const state = activate('business-empty');
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);

    expect(workspace).toMatchObject({ kind: 'business', name: 'Business' });
    expect(state.business?.entity).toBeNull();
    expect(state.accounts).toEqual([]);
  });
});
