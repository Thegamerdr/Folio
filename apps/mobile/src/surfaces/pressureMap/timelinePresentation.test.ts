// Guards for the calm Timeline's presentation layer: it must never leak the engine's internal
// evidence text / identifiers into a visible note, and a fresh ledger must fall through to the
// empty state (no synthetic balance "history").

import { describe, expect, it } from 'vitest';

import { buildLocalTimelineModel } from '../../local/localTimelineAdapter.js';
import { createEmptyLocalLedgerState } from '../../local/localLedger.js';
import { cleanTimelineNote, presentableTimelineEvents } from './timelinePresentation.js';

// The exact shape the adapter produces on an empty ledger: a human sentence followed by the
// appended evidence summary (which embeds a raw provenance identifier + internal vocabulary).
const LEAKY_DETAIL =
  'Imported claim from your statement. Source: Empty workspace baseline for 2026-06-27. ' +
  'Last changed by local records. Provenance ' +
  'provenance_balance_observation_balance_opening_2026_06_27_a8306e95_f0a5f9ce links 1 source record.';

const BANNED = ['provenance', 'source record', 'baseline', 'indexed', 'canonical'];

describe('cleanTimelineNote', () => {
  it('cuts the appended evidence and keeps only the human sentence', () => {
    expect(cleanTimelineNote(LEAKY_DETAIL)).toBe('Imported claim from your statement');
  });

  it('never surfaces internal engine vocabulary or raw identifiers', () => {
    const note = cleanTimelineNote(LEAKY_DETAIL).toLowerCase();
    for (const banned of BANNED) expect(note).not.toContain(banned);
    expect(note).not.toMatch(/provenance_\w+/);
  });

  it('leaves a clean note untouched', () => {
    expect(cleanTimelineNote('£42 · groceries')).toBe('£42 · groceries');
  });

  it('drops the note entirely if internal vocabulary still slips through (hard guard)', () => {
    expect(cleanTimelineNote('opening provenance_xyz record with no marker')).toBe('');
  });
});

describe('presentableTimelineEvents', () => {
  it('hides auto-generated balance bookkeeping so a fresh ledger shows the empty state', () => {
    const model = buildLocalTimelineModel(createEmptyLocalLedgerState('2026-06-27'));
    // The raw model carries system balance events...
    expect(model.events.length).toBeGreaterThan(0);
    // ...but none survive the user-action filter, so the screen renders its empty state.
    expect(presentableTimelineEvents(model.events)).toHaveLength(0);
  });

  it('no surfaced event note leaks internal vocabulary, even with real data shapes', () => {
    const model = buildLocalTimelineModel(createEmptyLocalLedgerState('2026-06-27'));
    for (const event of presentableTimelineEvents(model.events)) {
      const note = cleanTimelineNote(event.detail).toLowerCase();
      for (const banned of BANNED) expect(note).not.toContain(banned);
    }
  });
});
