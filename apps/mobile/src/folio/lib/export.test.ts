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

import {
  createEmptyWorkspacePartition,
  type AppState,
  type DriftCooldownEntry,
  type IncomeSource,
  type Transaction,
} from '../store';
import { buildExport, EXPORT_CSV_FILES } from './export';
import {
  createBusinessWorkspace,
  createPersonalWorkspaceRoot,
  PERSONAL_WORKSPACE_ID,
} from './workspaceRoot';

// ---------------------------------------------------------------------------
// Fixtures — built by hand (no store import) so the engine stays pure and the
// tests never depend on Date.now / seed timing.
// ---------------------------------------------------------------------------

/** A fully-populated AppState so every surface has at least one row. */
function fullState(): AppState {
  return {
    schemaVersion: 2,
    ...createPersonalWorkspaceRoot(),
    pots: [
      {
        id: 'holiday',
        name: 'Holiday · September',
        saved: 420,
        goal: 1200,
        perWeek: 35,
        accent: true,
      },
      {
        id: 'buffer',
        name: 'Buffer',
        saved: 140,
        goal: 500,
        perWeek: 20,
        accent: false,
        cadence: { kind: 'after-payday' },
      },
    ],
    subs: [
      { name: 'Spotify', cost: 11.0, nextRenewalDaysAway: 2, lastUsedDaysAgo: 0, usesPerMonth: 28 },
      {
        name: 'Disney+',
        cost: 8.99,
        nextRenewalDaysAway: 6,
        lastUsedDaysAgo: 42,
        usesPerMonth: 0,
        trialEndsInDays: 6,
      },
    ],
    subPaused: { 'Disney+': true },
    subOverrides: { Spotify: 3 },
    cycles: [
      {
        closedAt: '2026-05-25',
        label: 'May',
        spare: 142,
        tightPoint: 38,
        setAside: 60,
        note: 'Held the line.',
      },
    ],
    onboarding: { done: true, name: 'Sam', payday: 25, monthlyIncome: 2180 },
    currentBalance: {
      amount: 720,
      source: 'user-entered',
      confidence: 'rough',
      setAt: '2026-06-27T00:00:00.000Z',
    },
    potLedger: [
      {
        id: 'pl-1',
        potId: 'holiday',
        at: '2026-06-01T00:00:00.000Z',
        kind: 'deposit',
        amount: 35,
        source: 'ritual',
      },
    ],
    nextYouNote: 'Watch the takeaways.',
    tightPointGoal: 100,
    transactions: [
      {
        id: 'txn-1',
        when: '2026-06-20T00:00:00.000Z',
        merchant: 'Tesco',
        amount: -42.1,
        category: 'food',
        source: 'manual',
        sourceEvidenceId: 'evidence_11111111111111111111111111111111',
      },
    ],
    evidenceDocuments: [
      {
        id: 'evidence_11111111111111111111111111111111',
        workspaceId: PERSONAL_WORKSPACE_ID,
        filename: 'current-account-june.pdf',
        mediaType: 'application/pdf',
        byteSize: 4096,
        addedAtISO: '2026-06-26T00:00:00.000Z',
        sourceType: 'document',
        extractionStatus: 'read',
        storageState: 'encrypted-device-vault',
      },
    ],
    calendarEvents: [
      {
        id: 'evt-1',
        date: '2026-07-01',
        kind: 'out',
        title: 'Rent',
        amount: -800,
        note: 'monthly',
      },
    ],
    calendarFocusDate: null,
    routeFocusDate: null,
    readerCandidates: [],
    reviewQueue: [
      {
        id: 'rv-1',
        source: 'pdf',
        merchant: 'Caffè Nero',
        amount: -4.2,
        date: '2026-06-25',
        hint: 'looks like spending',
        addedAt: '2026-06-26T00:00:00.000Z',
        sourceEvidenceId: 'evidence_11111111111111111111111111111111',
      },
    ],
    ignoredReviewSigs: ['ATM withdrawal|-2000|2026-06-23'],
    incomeSources: [
      {
        id: 'income-1',
        label: 'Employer Ltd',
        cadence: 'monthly',
        dayOfMonth: 25,
        amount: 2180,
        source: 'onboarding',
      },
      {
        id: 'income-2',
        label: 'Side gig',
        cadence: 'weekly',
        anchorISO: '2026-06-05',
        amount: 60,
        source: 'inferred',
      },
    ],
    merchantCategories: {
      tesco: {
        category: 'food',
        correctedAt: '2026-06-20T00:00:00.000Z',
        hits: 3,
      },
      spotify: {
        category: 'subscriptions',
        correctedAt: '2026-06-15T00:00:00.000Z',
        hits: 1,
        pendingCategory: 'entertainment',
        pendingCount: 1,
      },
    },
    dismissedIncomeSignals: ['old employer'],
    dismissedBillSignals: ['gym membership'],
    dismissedAnnualSignals: ['car insurance'],
    dismissedDriftSignals: [{ merchant: 'netflix', at: '2026-06-22T00:00:00.000Z' }],
    reviewQueueSpillover: [
      {
        id: 'rv-spill-1',
        source: 'csv',
        merchant: 'Overflow Merchant',
        amount: -9.5,
        date: '2026-06-24',
        hint: 'looks like a bill',
        addedAt: '2026-06-27T00:00:00.000Z',
      },
    ],
  };
}

/** A minimal empty-ish AppState — every collection empty / at its zero value. */
function emptyState(): AppState {
  return {
    schemaVersion: 2,
    ...createPersonalWorkspaceRoot(),
    pots: [],
    subs: [],
    subPaused: {},
    subOverrides: {},
    cycles: [],
    onboarding: { done: false, name: '', payday: 25, monthlyIncome: 0 },
    currentBalance: {
      amount: 0,
      source: 'sample',
      confidence: 'sample',
      setAt: '2026-06-27T00:00:00.000Z',
    },
    potLedger: [],
    nextYouNote: '',
    tightPointGoal: null,
    transactions: [],
    calendarEvents: [],
    calendarFocusDate: null,
    routeFocusDate: null,
    readerCandidates: [],
    reviewQueue: [],
    ignoredReviewSigs: [],
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
    expect(csvs).toHaveProperty('reviewQueue.csv');
    expect(csvs).toHaveProperty('ignored-review.csv');
    // Tonight's additions — one file per new slice.
    expect(csvs).toHaveProperty('incomeSources.csv');
    expect(csvs).toHaveProperty('merchant-categories.csv');
    expect(csvs).toHaveProperty('dismissed-signals.csv');
    expect(csvs).toHaveProperty('review-spillover.csv');
    expect(csvs).toHaveProperty('evidence-documents.csv');
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
      ['reviewQueue', 'reviewQueue.csv'],
      ['ignoredReviewSigs', 'ignored-review.csv'],
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

  it('reviewQueue.csv carries the queued intake candidates (design-source column set)', () => {
    const { csvs } = buildExport(fullState());
    const rows = parseCsv(csvs['reviewQueue.csv'] as string);
    expect(rows[0]).toEqual([
      'id',
      'source',
      'merchant',
      'amount',
      'date',
      'hint',
      'addedAt',
      'sourceEvidenceId',
    ]);
    expect(rows).toHaveLength(2); // header + 1 queued candidate
    const header = rows[0] as string[];
    const row = rows[1] as string[];
    expect(row[header.indexOf('merchant')]).toBe('Caffè Nero');
    expect(row[header.indexOf('source')]).toBe('pdf');
    expect(row[header.indexOf('amount')]).toBe('-4.2');
    expect(row[header.indexOf('hint')]).toBe('looks like spending');
    expect(row[header.indexOf('sourceEvidenceId')]).toBe(
      'evidence_11111111111111111111111111111111',
    );
  });

  it('ignored-review.csv carries one signature per row (design-source shape)', () => {
    const { csvs } = buildExport(fullState());
    const rows = parseCsv(csvs['ignored-review.csv'] as string);
    expect(rows[0]).toEqual(['signature']);
    expect(rows).toHaveLength(2); // header + 1 ignored signature
    expect(rows[1]).toEqual(['ATM withdrawal|-2000|2026-06-23']);
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
// New slices — incomeSources / merchant-categories / dismissed-signals / review-spillover
// ---------------------------------------------------------------------------
describe('buildExport — incomeSources.csv', () => {
  it('carries one row per declared income source, incl. cadence-specific fields', () => {
    const { csvs } = buildExport(fullState());
    const rows = parseCsv(csvs['incomeSources.csv'] as string);
    expect(rows).toHaveLength(3); // header + 2 sources
    const header = rows[0] as string[];
    const idIdx = header.indexOf('id');
    const monthly = rows.find((r) => r[idIdx] === 'income-1');
    const weekly = rows.find((r) => r[idIdx] === 'income-2');
    expect(monthly?.[header.indexOf('cadence')]).toBe('monthly');
    expect(monthly?.[header.indexOf('dayOfMonth')]).toBe('25');
    expect(monthly?.[header.indexOf('anchorISO')]).toBe('');
    expect(weekly?.[header.indexOf('cadence')]).toBe('weekly');
    expect(weekly?.[header.indexOf('anchorISO')]).toBe('2026-06-05');
    expect(weekly?.[header.indexOf('dayOfMonth')]).toBe('');
  });

  it('is header-only when no income sources are declared', () => {
    const { csvs } = buildExport(emptyState());
    const rows = parseCsv(csvs['incomeSources.csv'] as string);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      'id',
      'label',
      'cadence',
      'dayOfMonth',
      'anchorISO',
      'amount',
      'source',
    ]);
  });
});

describe('buildExport — merchant-categories.csv', () => {
  it('carries one row per remembered merchant, incl. pending-flip fields when present', () => {
    const { csvs } = buildExport(fullState());
    const rows = parseCsv(csvs['merchant-categories.csv'] as string);
    expect(rows).toHaveLength(3); // header + 2 merchants
    const header = rows[0] as string[];
    const merchantIdx = header.indexOf('merchant');
    const tesco = rows.find((r) => r[merchantIdx] === 'tesco');
    const spotify = rows.find((r) => r[merchantIdx] === 'spotify');
    expect(tesco?.[header.indexOf('category')]).toBe('food');
    expect(tesco?.[header.indexOf('pendingCategory')]).toBe('');
    expect(spotify?.[header.indexOf('pendingCategory')]).toBe('entertainment');
    expect(spotify?.[header.indexOf('pendingCount')]).toBe('1');
  });

  it('is header-only when no merchant memory exists', () => {
    const { csvs } = buildExport(emptyState());
    const rows = parseCsv(csvs['merchant-categories.csv'] as string);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      'merchant',
      'category',
      'correctedAt',
      'hits',
      'pendingCategory',
      'pendingCount',
    ]);
  });
});

describe('buildExport — dismissed-signals.csv', () => {
  it('unifies income/bill/drift/annual dismissals into one file with family/merchant/at columns', () => {
    const { csvs } = buildExport(fullState());
    const rows = parseCsv(csvs['dismissed-signals.csv'] as string);
    expect(rows[0]).toEqual(['family', 'merchant', 'at']);
    // header + 1 income + 1 bill + 1 drift + 1 annual = 5
    expect(rows).toHaveLength(5);
    const byFamily = (family: string) => rows.filter((r) => r[0] === family);
    expect(byFamily('income')).toHaveLength(1);
    expect(byFamily('bill')).toHaveLength(1);
    expect(byFamily('drift')).toHaveLength(1);
    expect(byFamily('annual')).toHaveLength(1);
  });

  it('income/bill/annual rows carry an honestly-empty "at" (no timestamp exists for those families)', () => {
    const { csvs } = buildExport(fullState());
    const rows = parseCsv(csvs['dismissed-signals.csv'] as string);
    const income = rows.find((r) => r[0] === 'income' && r[1] === 'old employer');
    expect(income?.[2]).toBe('');
  });

  it('drift rows carry the real cooldown timestamp', () => {
    const { csvs } = buildExport(fullState());
    const rows = parseCsv(csvs['dismissed-signals.csv'] as string);
    const drift = rows.find((r) => r[0] === 'drift' && r[1] === 'netflix');
    expect(drift?.[2]).toBe('2026-06-22T00:00:00.000Z');
  });

  it('is header-only when nothing has been dismissed', () => {
    const { csvs } = buildExport(emptyState());
    const rows = parseCsv(csvs['dismissed-signals.csv'] as string);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(['family', 'merchant', 'at']);
  });
});

describe('buildExport — review-spillover.csv', () => {
  it('carries the same column set as reviewQueue.csv (design-source shape)', () => {
    const { csvs } = buildExport(fullState());
    const rows = parseCsv(csvs['review-spillover.csv'] as string);
    expect(rows[0]).toEqual([
      'id',
      'source',
      'merchant',
      'amount',
      'date',
      'hint',
      'addedAt',
      'sourceEvidenceId',
    ]);
    expect(rows).toHaveLength(2); // header + 1 spillover row
    const header = rows[0] as string[];
    const row = rows[1] as string[];
    expect(row[header.indexOf('merchant')]).toBe('Overflow Merchant');
    expect(row[header.indexOf('source')]).toBe('csv');
  });

  it('is header-only when nothing has spilled over', () => {
    const { csvs } = buildExport(emptyState());
    const rows = parseCsv(csvs['review-spillover.csv'] as string);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      'id',
      'source',
      'merchant',
      'amount',
      'date',
      'hint',
      'addedAt',
      'sourceEvidenceId',
    ]);
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

  it('neutralizes formula-like imported labels in CSV while JSON keeps the exact value', () => {
    const state = fullState();
    state.transactions = [
      {
        id: 'txn-formula',
        when: '2026-06-21T00:00:00.000Z',
        merchant: '=HYPERLINK("https://example.invalid","click")',
        amount: -12.5,
        category: 'other',
        source: 'manual',
      },
    ];

    const exported = buildExport(state);
    const rows = parseCsv(exported.csvs['transactions.csv'] as string);
    const header = rows[0] as string[];
    expect(rows[1]?.[header.indexOf('merchant')]).toBe(
      `'=HYPERLINK("https://example.invalid","click")`,
    );
    expect(JSON.parse(exported.json).transactions[0].merchant).toBe(
      '=HYPERLINK("https://example.invalid","click")',
    );
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
      edits: Array<{
        txnId: string;
        field: string;
        before: string;
        after: string;
        at: string;
        by: string;
      }>;
    };
    state.edits = [
      {
        txnId: 'txn-1',
        field: 'merchant',
        before: 'Tesco',
        after: 'Tesco Metro',
        at: '2026-06-21T00:00:00.000Z',
        by: 'user',
      },
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
    const collections = [
      'transactions.csv',
      'subs.csv',
      'pots.csv',
      'cycles.csv',
      'ledger.csv',
      'calendarEvents.csv',
      'reviewQueue.csv',
      'ignored-review.csv',
      'incomeSources.csv',
      'merchant-categories.csv',
      'dismissed-signals.csv',
      'review-spillover.csv',
      'evidence-documents.csv',
    ];
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

  it('refuses export after a crafted Business switch instead of exporting the Personal partition', () => {
    const state = {
      ...fullState(),
      activeWorkspaceId: 'workspace_business_injected' as AppState['activeWorkspaceId'],
    };

    expect(() => buildExport(state)).toThrow(/unavailable/);
  });
});

describe('buildExport — Business accountant handoff', () => {
  function businessState(): AppState {
    const personal = createPersonalWorkspaceRoot().workspaces[0]!;
    const business = createBusinessWorkspace({
      id: 'workspace_business_export',
      name: 'North Star Studio',
      encryptedSubkeyId: 'workspace-subkey-business-export-v1',
    });
    const root = {
      workspaces: [personal, business],
      activeWorkspaceId: business.id,
      dataWorkspaceId: business.id,
    } as const;
    const empty = createEmptyWorkspacePartition(root, business.id, '2026-07-01T00:00:00.000Z');

    return {
      ...empty,
      evidenceDocuments: [
        {
          id: 'evidence_22222222222222222222222222222222',
          workspaceId: business.id,
          filename: 'july-statement.pdf',
          mediaType: 'application/pdf',
          byteSize: 8192,
          addedAtISO: '2026-07-15T08:55:00.000Z',
          sourceType: 'document',
          extractionStatus: 'read',
          storageState: 'encrypted-device-vault',
        },
      ],
      accounts: [
        {
          id: 'business-current',
          workspaceId: business.id,
          name: 'Business current',
          kind: 'bank',
          isLiability: false,
          balanceMinor: 2_400,
          currency: 'GBP',
          balanceAsOfISO: '2026-07-15T00:00:00.000Z',
          addedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      transactions: [
        {
          id: 'business-txn-1',
          workspaceId: business.id,
          accountId: 'business-current',
          when: '2026-07-12T00:00:00.000Z',
          merchant: 'Confirmed supplier',
          amount: -125,
          category: 'shopping',
          source: 'manual',
          sourceEvidenceId: 'evidence_22222222222222222222222222222222',
        },
      ],
      statementImports: [
        {
          id: 'business-import-1',
          workspaceId: business.id,
          source: 'pdf',
          accountId: 'business-current',
          rowCount: 1,
          filename: 'july-statement.pdf',
          sourceEvidenceId: 'evidence_22222222222222222222222222222222',
          atISO: '2026-07-15T09:00:00.000Z',
        },
      ],
      reviewQueue: [
        {
          id: 'business-review-1',
          workspaceId: business.id,
          source: 'image',
          merchant: 'Unconfirmed receipt',
          amount: -10,
          accountId: 'business-current',
          addedAt: '2026-07-15T09:30:00.000Z',
          sourceEvidenceId: 'evidence_22222222222222222222222222222222',
        },
      ],
    };
  }

  it('emits scoped workspace, account, statement, manifest and accountant rows', () => {
    const state = businessState();
    const { json, csvs } = buildExport(state, state.activeWorkspaceId, '2026-07-15T10:00:00.000Z');

    expect(JSON.parse(json)).toEqual(state);
    expect(parseCsv(csvs['workspace.csv'] as string)[1]).toEqual(
      expect.arrayContaining(['North Star Studio', 'business']),
    );
    expect(parseCsv(csvs['accounts.csv'] as string)[1]).toEqual(
      expect.arrayContaining(['business-current', 'Business current']),
    );
    expect(parseCsv(csvs['statement-imports.csv'] as string)[1]).toEqual(
      expect.arrayContaining(['business-import-1', 'july-statement.pdf']),
    );
    expect(parseCsv(csvs['evidence-documents.csv'] as string)[1]).toEqual(
      expect.arrayContaining([
        'evidence_22222222222222222222222222222222',
        'july-statement.pdf',
        'application/pdf',
        '8192',
        'encrypted-device-vault',
      ]),
    );

    const accountantRows = parseCsv(csvs['accountant-records.csv'] as string);
    expect(accountantRows).toHaveLength(2);
    expect(accountantRows[1]).toEqual(
      expect.arrayContaining([
        'North Star Studio',
        'business',
        'business-txn-1',
        'Confirmed supplier',
        '-125',
        'Business current',
        'evidence_22222222222222222222222222222222',
        'july-statement.pdf',
      ]),
    );

    const manifestRows = parseCsv(csvs['export-manifest.csv'] as string);
    expect(manifestRows[1]).toEqual(
      expect.arrayContaining([
        'North Star Studio',
        'business',
        '2026-07-12',
        '2026-07-15T10:00:00.000Z',
        'melo-business-alpha-v1',
        '1',
      ]),
    );
  });

  it('fails closed instead of exporting a row owned by another workspace', () => {
    const state = businessState();
    const personalWorkspaceId = state.workspaces.find(
      (workspace) => workspace.kind === 'personal',
    )!.id;
    const corrupted: AppState = {
      ...state,
      transactions: [
        ...state.transactions,
        {
          ...state.transactions[0]!,
          id: 'personal-row-injected',
          workspaceId: personalWorkspaceId,
          merchant: 'Personal Merchant Sentinel',
        },
      ],
    };

    expect(() => buildExport(corrupted)).toThrow(/not owned by workspace/);
  });

  it('fails closed instead of emitting a dangling source-evidence link', () => {
    const state = businessState();
    const corrupted: AppState = { ...state, evidenceDocuments: [] };

    expect(() => buildExport(corrupted)).toThrow(/unavailable for export/);
  });
});
