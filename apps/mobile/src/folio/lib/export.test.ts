// Export engine — acceptance criteria for ENGINES.md §6 "Export everything —
// free, non-negotiable, day-one" (and §7 @rn-engine export).
//
// Pure, deterministic, Node-safe: this exercises only string building over the
// plain AppState shape (no Date.now, no react-native, no DOM, no I/O), so it is
// a plain `.test.ts` collected by the apps/**/*.test.ts runner. Relative imports
// of the engine module + the store types like the sibling store.test.ts /
// payday.test.ts (the runner has no `@` alias).
//
// Contract under test:
//   buildExport(state: AppState) -> { json: string; csvs: Record<string, string> }
//   (1) json is the COMPLETE AppState as pretty (2-space) JSON, round-trippable;
//   (2) csvs carries one CSV per surface that exists in the store, header row
//       per file, EVERY field quoted, quotes/commas/newlines escaped;
//   (3) every ENGINES §6 category that exists in the store is present in BOTH
//       the json AND a csv (transactions, pots, ledger, subs incl paused/nudge,
//       cycles, calendar/expectations, currentBalance, payday/onboarding,
//       tightPointGoal, settings);
//   (4) corrections.csv appears only when transaction edits exist;
//   (5) empty-state export is still structurally valid (headers, parseable json);
//   (6) pure + deterministic — same input, byte-identical output.

import { describe, expect, it } from 'vitest';

import type { AppState, Transaction } from '../store';
import { buildExport, EXPORT_CSV_FILES } from './export';

// ---------------------------------------------------------------------------
// Fixtures — built by hand (no store import) so the engine stays pure and the
// tests never depend on Date.now / seed timing.
// ---------------------------------------------------------------------------

/** A fully-populated AppState so every surface has at least one row. */
function fullState(): AppState {
  return {
    schemaVersion: 2,
    pots: [
      { id: 'holiday', name: 'Holiday · September', saved: 420, goal: 1200, perWeek: 35, accent: true },
      { id: 'buffer', name: 'Buffer', saved: 140, goal: 500, perWeek: 20, accent: false, cadence: { kind: 'after-payday' } },
    ],
    subs: [
      { name: 'Spotify', cost: 11.0, nextRenewalDaysAway: 2, lastUsedDaysAgo: 0, usesPerMonth: 28 },
      { name: 'Disney+', cost: 8.99, nextRenewalDaysAway: 6, lastUsedDaysAgo: 42, usesPerMonth: 0, trialEndsInDays: 6 },
    ],
    subPaused: { 'Disney+': true },
    subOverrides: { Spotify: 3 },
    cycles: [{ closedAt: '2026-05-25', label: 'May', spare: 142, tightPoint: 38, setAside: 60, note: 'Held the line.' }],
    onboarding: { done: true, name: 'Sam', payday: 25, monthlyIncome: 2180 },
    currentBalance: { amount: 720, source: 'user-entered', confidence: 'rough', setAt: '2026-06-27T00:00:00.000Z' },
    potLedger: [{ id: 'pl-1', potId: 'holiday', at: '2026-06-01T00:00:00.000Z', kind: 'deposit', amount: 35, source: 'ritual' }],
    nextYouNote: 'Watch the takeaways.',
    tightPointGoal: 100,
    transactions: [
      { id: 'txn-1', when: '2026-06-20T00:00:00.000Z', merchant: 'Tesco', amount: -42.1, category: 'food', source: 'manual' },
    ],
    calendarEvents: [{ id: 'evt-1', date: '2026-07-01', kind: 'out', title: 'Rent', amount: -800, note: 'monthly' }],
    calendarFocusDate: null,
    routeFocusDate: null,
    readerCandidates: [],
  };
}

/** A minimal empty-ish AppState — every collection empty / at its zero value. */
function emptyState(): AppState {
  return {
    schemaVersion: 2,
    pots: [],
    subs: [],
    subPaused: {},
    subOverrides: {},
    cycles: [],
    onboarding: { done: false, name: '', payday: 25, monthlyIncome: 0 },
    currentBalance: { amount: 0, source: 'sample', confidence: 'sample', setAt: '2026-06-27T00:00:00.000Z' },
    potLedger: [],
    nextYouNote: '',
    tightPointGoal: null,
    transactions: [],
    calendarEvents: [],
    calendarFocusDate: null,
    routeFocusDate: null,
    readerCandidates: [],
  };
}

/** Parse a CSV string into rows of cells, honouring RFC-4180 quoting so the
 *  test verifies escaping the same way a real reader would. */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\r') {
      // skip — newlines are normalised to \n by the engine
    } else {
      cell += ch;
    }
  }
  // flush trailing cell/row (files may or may not end with a newline)
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// (1) JSON completeness + round-trip
// ---------------------------------------------------------------------------
describe('buildExport — json completeness', () => {
  it('json is the complete AppState, round-trippable and equal to the input', () => {
    const state = fullState();
    const { json } = buildExport(state);
    const parsed = JSON.parse(json) as AppState;
    expect(parsed).toEqual(state);
  });

  it('json is pretty-printed with 2-space indentation', () => {
    const { json } = buildExport(fullState());
    expect(json).toContain('\n  "schemaVersion"');
    expect(json).toBe(JSON.stringify(fullState(), null, 2));
  });

  it('every ENGINES §6 category is present as a key in the json', () => {
    const { json } = buildExport(fullState());
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const key of [
      'transactions',
      'pots',
      'potLedger',
      'subs',
      'subPaused',
      'subOverrides',
      'cycles',
      'calendarEvents',
      'currentBalance',
      'onboarding',
      'tightPointGoal',
      'schemaVersion',
      'nextYouNote',
    ]) {
      expect(parsed).toHaveProperty(key);
    }
  });
});

// ---------------------------------------------------------------------------
// (2)+(3) Per-surface CSVs — every listed category has a csv with a header row
// ---------------------------------------------------------------------------
describe('buildExport — per-surface csvs', () => {
  it('always emits the named per-surface CSV files', () => {
    const { csvs } = buildExport(fullState());
    for (const file of EXPORT_CSV_FILES) {
      expect(csvs).toHaveProperty(file);
    }
    // The ENGINES §6 named set, explicitly.
    expect(csvs).toHaveProperty('transactions.csv');
    expect(csvs).toHaveProperty('subs.csv');
    expect(csvs).toHaveProperty('pots.csv');
    expect(csvs).toHaveProperty('cycles.csv');
    expect(csvs).toHaveProperty('ledger.csv');
    expect(csvs).toHaveProperty('calendarEvents.csv');
  });

  it('every category that exists in the store is present in BOTH json and a csv', () => {
    const { json, csvs } = buildExport(fullState());
    const parsed = JSON.parse(json) as AppState;
    // category -> the csv file that carries it
    const map: Array<[keyof AppState, string]> = [
      ['transactions', 'transactions.csv'],
      ['subs', 'subs.csv'],
      ['pots', 'pots.csv'],
      ['cycles', 'cycles.csv'],
      ['potLedger', 'ledger.csv'],
      ['calendarEvents', 'calendarEvents.csv'],
      ['onboarding', 'onboarding.csv'],
      ['currentBalance', 'balance.csv'],
      ['tightPointGoal', 'settings.csv'],
    ];
    for (const [cat, file] of map) {
      expect(parsed[cat]).toBeDefined();
      expect(csvs[file]).toBeDefined();
      // header row + at least one data row for the populated state
      const rows = parseCsv(csvs[file] as string);
      expect(rows.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('each CSV has a header row and one data row per item', () => {
    const { csvs } = buildExport(fullState());
    const txns = parseCsv(csvs['transactions.csv'] as string);
    expect(txns[0]).toContain('id');
    expect(txns[0]).toContain('merchant');
    expect(txns).toHaveLength(2); // header + 1 txn

    const subs = parseCsv(csvs['subs.csv'] as string);
    expect(subs).toHaveLength(3); // header + 2 subs
    // paused + nudge state folded into the subs csv (incl paused/cancelled)
    expect(subs[0]).toContain('paused');
    expect(subs[0]).toContain('nudgeDays');

    const pots = parseCsv(csvs['pots.csv'] as string);
    expect(pots).toHaveLength(3); // header + 2 pots

    const ledger = parseCsv(csvs['ledger.csv'] as string);
    expect(ledger).toHaveLength(2); // header + 1 entry
  });

  it('subs.csv reflects paused + nudge state from subPaused/subOverrides', () => {
    const { csvs } = buildExport(fullState());
    const rows = parseCsv(csvs['subs.csv'] as string);
    const header = rows[0] as string[];
    const nameIdx = header.indexOf('name');
    const pausedIdx = header.indexOf('paused');
    const nudgeIdx = header.indexOf('nudgeDays');
    const disney = rows.find((r) => r[nameIdx] === 'Disney+');
    const spotify = rows.find((r) => r[nameIdx] === 'Spotify');
    expect(disney?.[pausedIdx]).toBe('true');
    expect(spotify?.[pausedIdx]).toBe('false');
    expect(spotify?.[nudgeIdx]).toBe('3');
  });

  it('pots.csv carries the per-pot cadence kind', () => {
    const { csvs } = buildExport(fullState());
    const rows = parseCsv(csvs['pots.csv'] as string);
    const header = rows[0] as string[];
    const idIdx = header.indexOf('id');
    const cadenceIdx = header.indexOf('cadence');
    expect(cadenceIdx).toBeGreaterThanOrEqual(0);
    const buffer = rows.find((r) => r[idIdx] === 'buffer');
    expect(buffer?.[cadenceIdx]).toBe('after-payday');
  });
});

// ---------------------------------------------------------------------------
// (2) CSV escaping — commas / quotes / newlines in a merchant name
// ---------------------------------------------------------------------------
describe('buildExport — csv escaping', () => {
  it('escapes commas, double-quotes and newlines in a merchant name', () => {
    const state = fullState();
    const nasty: Transaction = {
      id: 'txn-nasty',
      when: '2026-06-21T00:00:00.000Z',
      merchant: 'Bob\'s "Diner", Café\nLtd',
      amount: -12.5,
      category: 'food',
      source: 'manual',
    };
    state.transactions = [nasty];
    const { csvs } = buildExport(state);
    const raw = csvs['transactions.csv'] as string;

    // The doubled-quote escape must be present literally.
    expect(raw).toContain('""Diner""');
    // Round-trips back to the exact original value.
    const rows = parseCsv(raw);
    const header = rows[0] as string[];
    const merchantIdx = header.indexOf('merchant');
    expect(rows[1]?.[merchantIdx]).toBe('Bob\'s "Diner", Café\nLtd');
  });

  it('quotes EVERY field, even simple ones', () => {
    const { csvs } = buildExport(fullState());
    const lines = (csvs['transactions.csv'] as string).split('\n');
    // header line: every cell wrapped in double quotes
    const header = lines[0] as string;
    expect(header.startsWith('"')).toBe(true);
    expect(header.endsWith('"')).toBe(true);
    // no bare unquoted comma-separated tokens (every value is "..."-wrapped)
    for (const seg of header.split('","')) {
      expect(seg.replace(/^"|"$/g, '')).not.toContain('","');
    }
  });
});

// ---------------------------------------------------------------------------
// (4) corrections.csv — present only when edits exist
// ---------------------------------------------------------------------------
describe('buildExport — corrections', () => {
  it('omits corrections.csv when no transaction edits exist', () => {
    const { csvs } = buildExport(fullState());
    expect(csvs).not.toHaveProperty('corrections.csv');
  });

  it('emits corrections.csv when edits exist on the state', () => {
    const state = fullState() as AppState & {
      edits: Array<{ txnId: string; field: string; before: string; after: string; at: string; by: string }>;
    };
    state.edits = [
      { txnId: 'txn-1', field: 'merchant', before: 'Tesco', after: 'Tesco Metro', at: '2026-06-21T00:00:00.000Z', by: 'user' },
    ];
    const { csvs } = buildExport(state);
    expect(csvs).toHaveProperty('corrections.csv');
    const rows = parseCsv(csvs['corrections.csv'] as string);
    expect(rows).toHaveLength(2); // header + 1 edit
    expect(rows[0]).toContain('field');
    expect(rows[0]).toContain('before');
    expect(rows[0]).toContain('after');
  });
});

// ---------------------------------------------------------------------------
// (5) Empty-state export — still structurally valid
// ---------------------------------------------------------------------------
describe('buildExport — empty state', () => {
  it('produces parseable json for an empty state', () => {
    const state = emptyState();
    const { json } = buildExport(state);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual(state);
  });

  it('every CSV is still present with a header row in the empty state', () => {
    const { csvs } = buildExport(emptyState());
    // Collection surfaces collapse to a header-only file when empty.
    const collections = ['transactions.csv', 'subs.csv', 'pots.csv', 'cycles.csv', 'ledger.csv', 'calendarEvents.csv'];
    // Singleton surfaces always carry the one row that describes the scalar.
    const singletons = ['onboarding.csv', 'balance.csv', 'settings.csv'];
    for (const file of EXPORT_CSV_FILES) {
      const rows = parseCsv(csvs[file] as string);
      expect((rows[0] as string[]).length).toBeGreaterThan(0); // non-empty header
      if (collections.includes(file)) {
        expect(rows).toHaveLength(1); // header only — no data rows
      } else if (singletons.includes(file)) {
        expect(rows).toHaveLength(2); // header + the singleton row
      }
    }
  });

  it('no corrections.csv in the empty state', () => {
    const { csvs } = buildExport(emptyState());
    expect(csvs).not.toHaveProperty('corrections.csv');
  });
});

// ---------------------------------------------------------------------------
// (6) Purity / determinism
// ---------------------------------------------------------------------------
describe('buildExport — deterministic', () => {
  it('same input yields byte-identical output across runs', () => {
    const a = buildExport(fullState());
    const b = buildExport(fullState());
    expect(a.json).toBe(b.json);
    expect(a.csvs).toEqual(b.csvs);
  });

  it('does not mutate the input state', () => {
    const state = fullState();
    const snapshot = JSON.parse(JSON.stringify(state)) as AppState;
    buildExport(state);
    expect(state).toEqual(snapshot);
  });
});
