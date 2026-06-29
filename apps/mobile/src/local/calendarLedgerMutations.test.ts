import { describe, expect, it } from 'vitest';

import {
  MAX_SUB_OVERRIDE_DAYS,
  MAX_USER_CALENDAR_EVENTS,
  addCalendarEvent,
  createEmptyLocalLedgerState,
  createSubscription,
  nudgeSub,
  removeCalendarEvent,
  updateCalendarEvent,
  type LocalLedgerState,
} from './localLedger.js';
import {
  addCalendarEventThroughCanonicalRepository,
  nudgeSubThroughCanonicalRepository,
  removeCalendarEventThroughCanonicalRepository,
  updateCalendarEventThroughCanonicalRepository,
} from './canonicalLedgerMutations.js';
import { parseDurableContainersBlob } from './nativeLedgerSnapshotBlob.js';

const ASOF = '2026-06-21';

function ledgerWithSub(): LocalLedgerState {
  return createSubscription(createEmptyLocalLedgerState(ASOF), {
    name: 'Netflix',
    costMinor: 1_099,
    cadence: 'monthly',
    nextChargeInDays: 10,
  });
}

describe('nudgeSub', () => {
  it('records an absolute, clamped override and never mutates the input', () => {
    const before = ledgerWithSub();
    const after = nudgeSub(before, 'Netflix', 3);
    expect(after).not.toBe(before);
    expect(before.subOverrides).toEqual({});
    expect(after.subOverrides).toEqual({ Netflix: 3 });
  });

  it('clamps to ±MAX_SUB_OVERRIDE_DAYS', () => {
    expect(nudgeSub(ledgerWithSub(), 'Netflix', 99).subOverrides.Netflix).toBe(MAX_SUB_OVERRIDE_DAYS);
    expect(nudgeSub(ledgerWithSub(), 'Netflix', -99).subOverrides.Netflix).toBe(-MAX_SUB_OVERRIDE_DAYS);
  });

  it('removes the override when the delta clamps/rounds to zero', () => {
    const nudged = nudgeSub(ledgerWithSub(), 'Netflix', 3);
    const reset = nudgeSub(nudged, 'Netflix', 0);
    expect('Netflix' in reset.subOverrides).toBe(false);
  });

  it('writes a history entry', () => {
    const after = nudgeSub(ledgerWithSub(), 'Netflix', 2);
    expect(after.history[0]?.kind).toBe('sub_nudged');
  });
});

describe('addCalendarEvent / removeCalendarEvent / updateCalendarEvent', () => {
  it('adds an immutable, newest-first user event with a history entry', () => {
    const before = createEmptyLocalLedgerState(ASOF);
    const after = addCalendarEvent(before, {
      dateIso: '2026-06-28',
      title: 'Mum birthday',
      kind: 'manual',
      amountMinor: -2_500,
      note: 'card',
    });
    expect(after).not.toBe(before);
    expect(before.calendarEvents).toEqual([]);
    expect(after.calendarEvents.length).toBe(1);
    const event = after.calendarEvents[0];
    expect(event?.title).toBe('Mum birthday');
    expect(event?.amountMinor).toBe(-2_500);
    expect(event?.note).toBe('card');
    expect(after.history[0]?.kind).toBe('calendar_event_added');
  });

  it('caps the stored events at MAX_USER_CALENDAR_EVENTS, newest first', () => {
    let state = createEmptyLocalLedgerState(ASOF);
    for (let i = 0; i < MAX_USER_CALENDAR_EVENTS + 5; i += 1) {
      state = addCalendarEvent(state, {
        id: `evt_${i}`,
        dateIso: '2026-06-28',
        title: `Event ${i}`,
        kind: 'manual',
      });
    }
    expect(state.calendarEvents.length).toBe(MAX_USER_CALENDAR_EVENTS);
    // Newest (highest index) is first.
    expect(state.calendarEvents[0]?.id).toBe(`evt_${MAX_USER_CALENDAR_EVENTS + 4}`);
  });

  it('removes by id immutably and no-ops on an unknown id', () => {
    const added = addCalendarEvent(createEmptyLocalLedgerState(ASOF), {
      id: 'evt_1',
      dateIso: '2026-06-28',
      title: 'Dentist',
      kind: 'deadline',
    });
    const removed = removeCalendarEvent(added, 'evt_1');
    expect(removed.calendarEvents.length).toBe(0);
    expect(added.calendarEvents.length).toBe(1); // original untouched
    expect(removeCalendarEvent(added, 'missing')).toBe(added);
  });

  it('patches only provided fields and clears optionals with null', () => {
    const added = addCalendarEvent(createEmptyLocalLedgerState(ASOF), {
      id: 'evt_1',
      dateIso: '2026-06-28',
      title: 'Dentist',
      kind: 'deadline',
      amountMinor: -5_000,
      note: 'checkup',
    });
    const nudged = updateCalendarEvent(added, 'evt_1', { dateIso: '2026-06-29' });
    expect(nudged.calendarEvents[0]?.dateIso).toBe('2026-06-29');
    expect(nudged.calendarEvents[0]?.amountMinor).toBe(-5_000); // unchanged

    const cleared = updateCalendarEvent(added, 'evt_1', { amountMinor: null, note: null });
    expect(cleared.calendarEvents[0]?.amountMinor).toBeUndefined();
    expect(cleared.calendarEvents[0]?.note).toBeUndefined();
    expect(cleared.history[0]?.kind).toBe('calendar_event_updated');
  });
});

describe('canonical wrappers + persistence round-trip', () => {
  it('canonical wrappers return validated state for all four mutators', () => {
    let state = ledgerWithSub();
    state = nudgeSubThroughCanonicalRepository(state, 'Netflix', 4);
    state = addCalendarEventThroughCanonicalRepository(state, {
      id: 'evt_1',
      dateIso: '2026-06-28',
      title: 'Trip',
      kind: 'out',
      amountMinor: -12_000,
    });
    state = updateCalendarEventThroughCanonicalRepository(state, 'evt_1', { title: 'Big trip' });
    expect(state.subOverrides.Netflix).toBe(4);
    expect(state.calendarEvents[0]?.title).toBe('Big trip');
    state = removeCalendarEventThroughCanonicalRepository(state, 'evt_1');
    expect(state.calendarEvents.length).toBe(0);
  });

  it('round-trips subOverrides + calendarEvents through the snapshot blob', () => {
    let state = ledgerWithSub();
    state = nudgeSub(state, 'Netflix', 5);
    state = addCalendarEvent(state, {
      id: 'evt_1',
      dateIso: '2026-06-28',
      title: 'Trip',
      kind: 'out',
      amountMinor: -12_000,
    });
    const blob = JSON.stringify(state);
    const load = parseDurableContainersBlob(blob);
    expect(load.corrupt).toBe(false);
    expect(load.containers.subOverrides).toEqual({ Netflix: 5 });
    expect(load.containers.calendarEvents.length).toBe(1);
    expect(load.containers.calendarEvents[0]?.title).toBe('Trip');
  });

  it('defaults missing fields and flags a malformed subOverrides blob', () => {
    const empty = parseDurableContainersBlob(JSON.stringify({ pots: [] }));
    expect(empty.corrupt).toBe(false);
    expect(empty.containers.subOverrides).toEqual({});
    expect(empty.containers.calendarEvents).toEqual([]);

    const malformed = parseDurableContainersBlob(JSON.stringify({ subOverrides: [] }));
    expect(malformed.corrupt).toBe(true);
  });
});
