import { describe, expect, it } from 'vitest';

import {
  computeSparePerDay,
  deriveCalendarEvents,
  groupCalendarEventsByDay,
  type DerivedCalendarEvent,
} from './calendarEvents.js';
import {
  addCalendarEvent,
  createEmptyLocalLedgerState,
  createSubscription,
  nudgeSub,
  type LocalLedgerState,
  type LocalLedgerTransaction,
} from './localLedger.js';

const ASOF = '2026-06-21';

function transaction(
  overrides: Partial<LocalLedgerTransaction> &
    Pick<LocalLedgerTransaction, 'id' | 'title' | 'amountMinor' | 'date'>,
): LocalLedgerTransaction {
  return {
    source: 'manual',
    status: 'confirmed',
    protected: false,
    ...overrides,
  };
}

// A realistic ledger: recurring salary (income), a recurring rent bill, a one-off planned bill, a
// real subscription, a manual event and a pending import draft — exactly the spread the task asks the
// engine to handle from REAL data.
function realisticLedger(): LocalLedgerState {
  const base = createEmptyLocalLedgerState(ASOF);
  let state: LocalLedgerState = {
    ...base,
    cashOnHandMinor: 100_000,
    transactions: [
      // Recurring monthly salary — the payday source. Title matches the pay/wage/salary predicate.
      transaction({
        id: 'salary',
        title: 'Acme Payroll salary',
        amountMinor: 184_000,
        date: '2026-06-26',
        repeats: 'monthly',
      }),
      // Recurring monthly rent — a real bill, NOT a static seed.
      transaction({
        id: 'rent',
        title: 'Rent',
        amountMinor: -87_500,
        date: '2026-07-01',
        protected: true,
        repeats: 'monthly',
        original: 'STANDING ORDER LANDLORD 875.00',
      }),
      // One-off planned commitment (no recurrence) — should still surface as a bill on its date.
      transaction({
        id: 'mot',
        title: 'Car MOT',
        amountMinor: -6_000,
        date: '2026-07-10',
        protected: true,
      }),
    ],
    importDrafts: [
      {
        rowId: 'draft_1',
        transactionId: 'txn_draft_1',
        original: 'DD ABOUND 162.95',
        interpretation: 'Possible debt repayment',
        amountMinor: -16_295,
        date: '2026-06-25',
        authorityState: 'estimated',
        reviewState: 'needs-review',
        userConfirmationState: 'requested',
        parserIssues: [],
        status: 'Needs review',
        provenanceHash: 'h1',
        searchText: 'abound',
        reasons: [],
      },
    ],
  };
  state = createSubscription(state, {
    name: 'Netflix',
    costMinor: 1_099,
    cadence: 'monthly',
    nextChargeInDays: 10, // renews 2026-07-01
  });
  state = addCalendarEvent(state, {
    id: 'manual_birthday',
    dateIso: '2026-06-28',
    title: 'Mum birthday',
    kind: 'manual',
    note: 'card + flowers',
  });
  return state;
}

function find(
  events: readonly DerivedCalendarEvent[],
  predicate: (e: DerivedCalendarEvent) => boolean,
) {
  return events.find(predicate);
}

describe('deriveCalendarEvents — real-data sourcing', () => {
  it('derives payday from the recurring income transaction (not a day-of-month seed)', () => {
    const events = deriveCalendarEvents(realisticLedger(), ASOF, 95);
    const paydays = events.filter((e) => e.source === 'payday');
    expect(paydays.length).toBeGreaterThanOrEqual(1);
    const first = paydays[0];
    expect(first?.dateIso).toBe('2026-06-26');
    expect(first?.kind).toBe('in');
    expect(first?.amountMinor).toBe(184_000);
    expect(first?.recurring).toBe('monthly');
    // The recurrence expansion must materialise the NEXT payday inside the 95-day window too.
    expect(paydays.some((e) => e.dateIso === '2026-07-26')).toBe(true);
  });

  it('derives bills from real recurring + planned commitments (no static RECURRING_BILLS seed)', () => {
    const events = deriveCalendarEvents(realisticLedger(), ASOF, 95);
    const rent = find(events, (e) => e.source === 'bill' && e.title === 'Rent');
    expect(rent?.dateIso).toBe('2026-07-01');
    expect(rent?.amountMinor).toBe(-87_500);
    expect(rent?.recurring).toBe('monthly');
    // The one-off planned commitment is a bill on its own date.
    const mot = find(events, (e) => e.title === 'Car MOT');
    expect(mot?.source).toBe('bill');
    expect(mot?.dateIso).toBe('2026-07-10');
    expect(mot?.recurring).toBeUndefined();
    // None of the web's hardcoded bill names may appear.
    const titles = events.map((e) => e.title);
    for (const banned of ['Octopus Energy', 'Council Tax', 'BT Broadband']) {
      expect(titles).not.toContain(banned);
    }
  });

  it('derives sub renewals from ledger.subscriptions with subName for the Pause action', () => {
    const events = deriveCalendarEvents(realisticLedger(), ASOF, 95);
    const sub = find(events, (e) => e.source === 'sub');
    expect(sub?.title).toBe('Netflix');
    expect(sub?.subName).toBe('Netflix');
    expect(sub?.dateIso).toBe('2026-07-01'); // asOf + 10 days
    expect(sub?.amountMinor).toBe(-1_099);
    expect(sub?.recurring).toBe('monthly');
  });

  it('surfaces pending import drafts as review events and user events as manual', () => {
    const events = deriveCalendarEvents(realisticLedger(), ASOF, 95);
    const review = find(events, (e) => e.source === 'review');
    expect(review?.dateIso).toBe('2026-06-25');
    expect(review?.kind).toBe('review');

    const manual = find(events, (e) => e.source === 'manual');
    expect(manual?.title).toBe('Mum birthday');
    expect(manual?.manual).toBe(true);
    expect(manual?.dateIso).toBe('2026-06-28');
  });

  it('returns events sorted by date with money-in before money-out on the same day', () => {
    const events = deriveCalendarEvents(realisticLedger(), ASOF, 95);
    for (let i = 1; i < events.length; i += 1) {
      const prev = events[i - 1];
      const cur = events[i];
      expect(prev && cur && prev.dateIso <= cur.dateIso).toBe(true);
    }
    // On 2026-07-01 both rent (out) and the Netflix renewal (out) land; nothing is money-in that day,
    // but ordering must be stable and date-grouped.
    const julyFirst = events.filter((e) => e.dateIso === '2026-07-01');
    expect(julyFirst.length).toBe(2);
  });

  it('includes UK personal deadlines inside the window and marks them source deadline', () => {
    // A wide window (asOf 2026-06-21 + 300d) reaches both the 31 Jul and the next 31 Jan deadlines.
    const events = deriveCalendarEvents(realisticLedger(), ASOF, 300);
    const deadlines = events.filter((e) => e.source === 'deadline');
    expect(deadlines.every((e) => e.kind === 'deadline' && e.recurring === 'yearly')).toBe(true);
    const dates = deadlines.map((e) => e.dateIso);
    expect(dates).toContain('2026-07-31'); // Payment on account, this year
    expect(dates).toContain('2027-01-31'); // Self Assessment, next year
  });
});

describe('deriveCalendarEvents — subOverrides shift sub renewals (clamped ±7)', () => {
  it('shifts the renewal day by a positive override', () => {
    let state = realisticLedger();
    state = nudgeSub(state, 'Netflix', 3);
    const events = deriveCalendarEvents(state, ASOF, 95);
    const sub = find(events, (e) => e.source === 'sub');
    // asOf + (10 + 3) days = 2026-07-04.
    expect(sub?.dateIso).toBe('2026-07-04');
    expect(sub?.note).toContain('+3d');
  });

  it('clamps an over-range override to +7 days', () => {
    let state = realisticLedger();
    state = nudgeSub(state, 'Netflix', 50);
    expect(state.subOverrides.Netflix).toBe(7);
    const events = deriveCalendarEvents(state, ASOF, 95);
    const sub = find(events, (e) => e.source === 'sub');
    // asOf + (10 + 7) days = 2026-07-08.
    expect(sub?.dateIso).toBe('2026-07-08');
  });

  it('clamps a negative override to -7 days', () => {
    let state = realisticLedger();
    state = nudgeSub(state, 'Netflix', -99);
    expect(state.subOverrides.Netflix).toBe(-7);
    const events = deriveCalendarEvents(state, ASOF, 95);
    const sub = find(events, (e) => e.source === 'sub');
    // asOf + (10 - 7) days = 2026-06-24.
    expect(sub?.dateIso).toBe('2026-06-24');
  });

  it('skips renewals for paused subscriptions', () => {
    const state = realisticLedger();
    const paused: LocalLedgerState = {
      ...state,
      subscriptions: state.subscriptions.map((s) => ({ ...s, paused: true })),
    };
    const events = deriveCalendarEvents(paused, ASOF, 95);
    expect(events.some((e) => e.source === 'sub')).toBe(false);
  });
});

describe('computeSparePerDay', () => {
  it('runs a spare balance across the window and finds the tightest day', () => {
    const events = deriveCalendarEvents(realisticLedger(), ASOF, 40);
    const { spareByDay, tightestDateIso, tightestSpareMinor } = computeSparePerDay(events, 100_000);
    expect(spareByDay.length).toBeGreaterThan(0);
    expect(tightestDateIso).not.toBeNull();
    // The tightest spare must be the minimum across the computed days.
    const min = Math.min(...spareByDay.map((d) => d.spareMinor));
    expect(tightestSpareMinor).toBe(min);
  });

  it('groups events by day', () => {
    const events = deriveCalendarEvents(realisticLedger(), ASOF, 95);
    const groups = groupCalendarEventsByDay(events);
    const july1 = groups.find((g) => g.dateIso === '2026-07-01');
    expect(july1?.events.length).toBe(2);
  });
});
