// @rn-engine store-migration — wire @folio/storage + op-sqlite persistence later (see BUILD_PLAN §3)
//
// Folio data spine — RN port of the web design store
// (folio-melo/src/lib/store.ts), faithful 1:1.
//
// Single source of truth for things that should survive a refresh on the web:
// pots, sub-paused state, ritual cycle history, onboarding, current balance,
// the pot ledger, transactions and user calendar events.
//
// Differences from the web original — intentional and minimal:
//   • Persistence: the web store read/wrote `window.localStorage`. There are no
//     web storage APIs in RN, so the persistence layer is REPLACED with an
//     in-memory module-level blob (`persistedBlob`). The `migrate()` /
//     `MIGRATIONS` scaffold is kept intact and runs against that in-memory blob
//     so the upgrade pattern is preserved for when @folio/storage + op-sqlite
//     are wired (BUILD_PLAN §3).
//   • Reactivity is identical: a module-level `state` + a `Set` of listeners,
//     surfaced through React `useSyncExternalStore` (same pub/sub pattern).
//   • `applyMeloTool` tool-name matching is normalised (lowercase / trim /
//     strip punctuation) and returns candidates when ambiguous, per
//     ENGINES.md §6 "Melo — tool name matching". The four tools' BEHAVIOUR is
//     byte-for-byte the web original.

import { applyTxnEdit, type TxnEdit, type TxnEditPatch } from './lib/editTxn';
import type { CandidateMoneyItem } from './lib/importSheet';

/** The element type of the persisted `AppState.edits` slot. It is the engine's
 *  full `TxnEdit` with `id` relaxed to optional: every record this store writes
 *  is produced by `applyTxnEdit` and so always carries an `id`, but the export
 *  engine + its tests read the slot tolerantly (older/loose shapes without an
 *  `id`), so the persisted contract must not require it. Runtime values are
 *  always full `TxnEdit`s; the relaxation is purely a structural-compat seam. */
export type StoredTxnEdit = Omit<TxnEdit, 'id'> & { id?: string };

/** Per-pot top-up cadence. Per ENGINES.md § 6 "Pot top-up cadence":
 *  default is `after-payday`. `weekly` is the legacy/prototype shape that
 *  the calendar engine still uses as a fallback for unmigrated pots. */
export type PotCadence =
  | { kind: 'after-payday' }
  | { kind: 'weekly'; weekday: number /* 0..6 */ }
  | { kind: 'monthly'; dayOfMonth: number /* 1..31 */ }
  | { kind: 'custom'; nextDate: string };

export type Pot = {
  id: string;
  name: string;
  saved: number;
  goal: number;
  perWeek: number;
  accent: boolean;
  /** Optional — unmigrated pots fall through to the legacy Friday cadence
   *  in `deriveCalendarEvents`. RN must default new pots to `after-payday`. */
  cadence?: PotCadence;
};

export type Sub = {
  /** Canonical display name — also the key used in `subPaused`. */
  name: string;
  cost: number;
  /** Days until next renewal, relative to "now". Decremented by fastForwardMonth. */
  nextRenewalDaysAway: number;
  /** Last opened/used this many days ago. */
  lastUsedDaysAgo: number;
  /** Rough monthly usage count. 0 = quiet. */
  usesPerMonth: number;
  /** Free trial ends in N days. The single highest-regret category — every
   *  surface that mentions this sub should flag it. Undefined = no trial. */
  trialEndsInDays?: number;
};

const DEFAULT_SUBS: Sub[] = [
  { name: 'Spotify', cost: 11.0, nextRenewalDaysAway: 2, lastUsedDaysAgo: 0, usesPerMonth: 28 },
  { name: 'Netflix', cost: 12.99, nextRenewalDaysAway: 9, lastUsedDaysAgo: 21, usesPerMonth: 2 },
  { name: 'Notion', cost: 8.0, nextRenewalDaysAway: 11, lastUsedDaysAgo: 0, usesPerMonth: 30 },
  {
    name: 'Disney+',
    cost: 8.99,
    nextRenewalDaysAway: 6,
    lastUsedDaysAgo: 42,
    usesPerMonth: 0,
    trialEndsInDays: 6,
  },
  { name: 'iCloud', cost: 2.99, nextRenewalDaysAway: 13, lastUsedDaysAgo: 0, usesPerMonth: 30 },
  { name: 'Strava', cost: 9.99, nextRenewalDaysAway: 17, lastUsedDaysAgo: 18, usesPerMonth: 1 },
];

export type CycleRecord = {
  /** ISO date the ritual was completed */
  closedAt: string;
  /** Free-text label like "June" */
  label: string;
  spare: number;
  tightPoint: number;
  setAside: number;
  note: string;
};

export type Onboarding = {
  done: boolean;
  name: string;
  payday: number; // day of month
  monthlyIncome: number;
};

/** ENGINES.md § 6 "Starting balance — source + confidence".
 *  Every balance on Today/Ritual reads `currentBalance.amount`; the literal
 *  720 fallback has been removed. `sample` is the only source allowed in
 *  demo/sample mode; user-entered always wins. */
export type BalanceSource =
  | 'user-entered'
  | 'statement'
  | 'pdf-derived'
  | 'ocr-derived'
  | 'corrected'
  | 'sample';
export type BalanceConfidence = 'rough' | 'statement-derived' | 'corrected' | 'sample';
export type CurrentBalance = {
  amount: number;
  source: BalanceSource;
  confidence: BalanceConfidence;
  /** ISO timestamp this balance was set. */
  setAt: string;
};

/** ENGINES.md § 4 "Pot rules — borrow/repay ledger" + § 6 "Ritual cycle
 *  close numbers". A row per real pot mutation, so the ritual's `setAside`
 *  is computed from honest deposit history instead of `perWeek × 4`. */
export type PotLedgerEntry = {
  id: string;
  potId: string;
  /** ISO timestamp */
  at: string;
  kind: 'deposit' | 'borrow' | 'repay' | 'withdraw';
  /** Always positive £. Sign is implied by `kind`. */
  amount: number;
  /** Free-text source — "ritual", "melo", "manual", "shortfall-borrow". */
  source: string;
};

export type Transaction = {
  id: string;
  /** ISO timestamp */
  when: string;
  merchant: string;
  /** Negative = spend, positive = inflow. £ with decimals OK. */
  amount: number;
  category: 'food' | 'transport' | 'fun' | 'bills' | 'shopping' | 'income' | 'other';
  /** Where it came from — manual entry, Melo-logged, or seed/demo. */
  source: 'manual' | 'melo' | 'seed';
};

/** A user-added calendar event. Derived events (paydays, bills, sub renewals,
 *  deadlines) come from `deriveCalendarEvents()` and are NOT stored. */
export type CalendarEvent = {
  id: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  kind: 'in' | 'out' | 'review' | 'deadline';
  title: string;
  note?: string;
  /** Signed pounds — positive = in, negative = out, undefined for review/deadline. */
  amount?: number;
};

export type AppState = {
  /** Bumped on every breaking shape change. Read by `migrate()` on load
   *  so the prototype stops silently falling back to defaults for missing
   *  fields. RN must keep the same scheme (per RN_PORT.md "Store migration"). */
  schemaVersion: number;
  pots: Pot[];
  subs: Sub[];
  subPaused: Record<string, boolean>;
  /** Day-delta nudge per sub renewal. +3 = "I'd rather this hit 3 days later".
   *  The Calendar engine adds this to `nextRenewalDaysAway` when deriving the
   *  next charge, so a flexible bill can be slid around the tight day.
   *  Cleared automatically once a renewal passes. */
  subOverrides: Record<string, number>;
  cycles: CycleRecord[];
  onboarding: Onboarding;
  /** Single source of truth for "what's roughly in your account today".
   *  Replaces the literal £720 the prototype used to anchor Today/Ritual. */
  currentBalance: CurrentBalance;
  /** Per-pot deposit/borrow/repay ledger. Ritual `setAside` sums deposits
   *  inside the cycle window; replaces the old `perWeek × 4` stand-in. */
  potLedger: PotLedgerEntry[];
  /** The "one line for next-you" written at cycle close. Persisted so the
   *  next ritual can show what past-you actually wrote, not a hardcoded
   *  example. Cleared by `addCycle` once it's written into the new cycle. */
  nextYouNote: string;
  /** Floor £ to hold at the tightest point of the month. Set via Melo. */
  tightPointGoal: number | null;
  /** Newest first. Capped at 200 to keep persisted state small. */
  transactions: Transaction[];
  /** Immutable correction history — one record per changed field per edit
   *  (ENGINES.md §6 "Editing existing transactions — required, never
   *  destructive"). The original value of any edited field always survives
   *  inside the oldest `before` here, so an edit is recoverable and never
   *  overwrites the row out of existence. Appended to, never rewritten.
   *  Optional only for shape back-compat with hand-built `AppState` fixtures
   *  predating this field; `DEFAULTS`/`load()` always populate it ([]). The
   *  element is `StoredTxnEdit` (engine `TxnEdit` with `id` relaxed) so the
   *  tolerant export reader's loose shapes still satisfy this slot. */
  edits?: StoredTxnEdit[];
  /** User-added calendar events. Derived events are computed on read. */
  calendarEvents: CalendarEvent[];
  /** Ephemeral — bridge from Route detail to Calendar. ISO YYYY-MM-DD.
   *  Read once by ScreenCalendar to jump to a day, then cleared. */
  calendarFocusDate: string | null;
  /** Ephemeral — bridge from Calendar back to the Route on Today.
   *  Read once by ScreenToday to scrub the path to that date and pulse
   *  the matching point, then cleared. */
  routeFocusDate: string | null;
  /** Transient review queue — candidates the statement reader extracted from a
   *  PDF/image, staged for the Review screen. Review-before-truth: these are
   *  NEVER posted facts and are NEVER auto-counted; the user confirms each one
   *  before it becomes a transaction. Excluded from `getPersistBlob` and reset
   *  by `load()` — it must NOT survive a restart, exactly like the ephemeral
   *  `calendarFocusDate` / `routeFocusDate` bridges. */
  readerCandidates: CandidateMoneyItem[];
};

const KEY = 'folio.state.v1';
/** Current schema version. Bump on every breaking shape change and add
 *  a new entry to `MIGRATIONS` below. Never silently re-key existing data. */
const CURRENT_SCHEMA_VERSION = 3;

const SAMPLE_BALANCE: CurrentBalance = {
  amount: 720,
  source: 'sample',
  confidence: 'sample',
  setAt: '2026-06-27T00:00:00.000Z',
};

/** A genuinely empty, honest starting balance for a CLEAN-EMPTY reset. £0 with a
 *  `user-entered` source + `rough` confidence — NOT `sample` (sample implies demo
 *  data the user never entered). A returning clean user has chosen to start from
 *  nothing, so the source label tells the truth: this is their own zero, not a
 *  seeded placeholder. `setAt` is stamped at reset time by `resetToEmpty`. */
const EMPTY_BALANCE: Omit<CurrentBalance, 'setAt'> = {
  amount: 0,
  source: 'user-entered',
  confidence: 'rough',
};

const DEFAULTS: AppState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  pots: [
    {
      id: 'holiday',
      name: 'Holiday · September',
      saved: 420,
      goal: 1200,
      perWeek: 35,
      accent: true,
    },
    { id: 'buffer', name: 'Buffer', saved: 140, goal: 500, perWeek: 20, accent: false },
    { id: 'christmas', name: 'Christmas', saved: 60, goal: 300, perWeek: 15, accent: false },
  ],
  subs: DEFAULT_SUBS,
  subPaused: {},
  subOverrides: {},
  cycles: [
    // Seed two prior cycles so Insights has something to show on first run.
    {
      closedAt: '2026-05-25',
      label: 'May',
      spare: 142,
      tightPoint: 38,
      setAside: 60,
      note: 'Held the line on takeaway.',
    },
    {
      closedAt: '2026-04-25',
      label: 'April',
      spare: 88,
      tightPoint: 24,
      setAside: 50,
      note: 'Tight one — buffer saved it.',
    },
  ],
  onboarding: { done: false, name: '', payday: 25, monthlyIncome: 2180 },
  currentBalance: SAMPLE_BALANCE,
  potLedger: [],
  nextYouNote: '',
  tightPointGoal: null,
  transactions: [],
  edits: [],
  calendarEvents: [],
  calendarFocusDate: null,
  routeFocusDate: null,
  readerCandidates: [],
};

/** Seed ~10 days of recent activity so Today/Insights have something honest to render.
 *  Called only when there is no persisted blob (uses Date.now). */
function seedTransactions(): Transaction[] {
  const now = Date.now();
  const day = 86_400_000;
  const t = (
    d: number,
    merchant: string,
    amount: number,
    category: Transaction['category'],
  ): Transaction => ({
    id: `seed-${merchant}-${d}`.toLowerCase().replace(/\s+/g, '-'),
    when: new Date(now - d * day).toISOString(),
    merchant,
    amount,
    category,
    source: 'seed',
  });
  return [
    t(0, 'Pret', -4.2, 'food'),
    t(0, 'Tube', -2.8, 'transport'),
    t(1, 'Tesco', -42.1, 'food'),
    t(2, 'Pub', -18.5, 'fun'),
    t(3, 'Coffee', -3.2, 'food'),
    t(4, 'Amazon', -27.99, 'shopping'),
    t(5, 'Spotify', -11.0, 'bills'),
    t(6, 'Uber', -14.3, 'transport'),
    t(7, 'Tesco', -36.4, 'food'),
    t(8, 'Cinema', -16.0, 'fun'),
    t(11, 'Salary', 1840.0, 'income'),
  ];
}

/** Per-version migration steps. Each function receives the previously-
 *  migrated blob and returns the next-version blob. Never mutate in place.
 *  Add a new entry for every `CURRENT_SCHEMA_VERSION` bump. */
const MIGRATIONS: Record<number, (prev: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 → v2: introduce currentBalance, potLedger, nextYouNote, schemaVersion.
  // Pre-existing installs become "sample"-source balance so the user sees the
  // honest source label and can correct it from onboarding/More.
  // Backfill potLedger from existing pot.saved as a single synthetic deposit
  // per pot dated 30 days ago, so the first ritual after upgrade reads honest
  // recent savings instead of £0 for a month. Source labelled "backfill" so
  // it's traceable in the ledger.
  2: (prev) => {
    const prior = prev as Partial<AppState>;
    const existingLedger = prior.potLedger ?? [];
    const seedAt = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const backfill: PotLedgerEntry[] =
      existingLedger.length === 0 && Array.isArray(prior.pots)
        ? prior.pots
            .filter((p) => p && p.saved > 0)
            .map((p) => ({
              id: `pl-backfill-${p.id}`,
              potId: p.id,
              at: seedAt,
              kind: 'deposit' as const,
              amount: p.saved,
              source: 'backfill',
            }))
        : [];
    return {
      ...prev,
      schemaVersion: 2,
      currentBalance: prior.currentBalance ?? SAMPLE_BALANCE,
      potLedger: existingLedger.length > 0 ? existingLedger : backfill,
      nextYouNote: prior.nextYouNote ?? '',
    };
  },
  // v2 → v3: introduce the transaction correction history (`edits`). Pre-v3
  // installs have no edits, so default to an empty array. Existing edits (none
  // before v3) are preserved if somehow present. See ENGINES.md §6 "Editing
  // existing transactions" — the edit chain is what makes a correction
  // recoverable rather than destructive.
  3: (prev) => {
    const prior = prev as Partial<AppState>;
    return {
      ...prev,
      schemaVersion: 3,
      edits: prior.edits ?? [],
    };
  },
};

function migrate(parsed: Record<string, unknown>): Record<string, unknown> {
  const startVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;
  if (startVersion > CURRENT_SCHEMA_VERSION) {
    // Safe failure mode: persisted state is newer than this binary. Warn,
    // keep the raw blob in a parking slot, and load defaults rather than
    // silently dropping fields. In-memory port: park into `futureBlobs`
    // instead of window.localStorage (web original parked under a
    // `${KEY}.future.${v}` storage key).
    try {
      futureBlobs[`${KEY}.future.${startVersion}`] = parsed;
      // eslint-disable-next-line no-console
      console.warn(
        `[folio] persisted schema v${startVersion} is newer than code v${CURRENT_SCHEMA_VERSION}; parked and ignored.`,
      );
    } catch {
      /* ignore */
    }
    return { ...DEFAULTS };
  }
  let current = parsed;
  for (let v = startVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) continue;
    current = step(current);
  }
  return current;
}

// ---------- In-memory persistence (replaces window.localStorage) ----------
// `persistedBlob` is the single in-memory record the web original kept in
// localStorage under `KEY`. `null` = nothing persisted yet (first run).
// `futureBlobs` mirrors the web original's `${KEY}.future.${v}` parking slots.
// Wire @folio/storage + op-sqlite over these two later (BUILD_PLAN §3).
let persistedBlob: Record<string, unknown> | null = null;
const futureBlobs: Record<string, Record<string, unknown>> = {};

function load(): AppState {
  try {
    if (!persistedBlob) {
      // First run on this device — seed transactions now.
      return { ...DEFAULTS, transactions: seedTransactions() };
    }
    // Deep-clone the persisted blob so migrate/load never mutate the stored copy.
    const parsedRaw = JSON.parse(JSON.stringify(persistedBlob)) as Record<string, unknown>;
    const migrated = migrate(parsedRaw) as Partial<AppState>;
    const loaded: AppState = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      pots: migrated.pots ?? DEFAULTS.pots,
      subs: migrated.subs ?? DEFAULTS.subs,
      subPaused: migrated.subPaused ?? {},
      subOverrides: migrated.subOverrides ?? {},
      cycles: migrated.cycles ?? DEFAULTS.cycles,
      onboarding: { ...DEFAULTS.onboarding, ...(migrated.onboarding ?? {}) },
      currentBalance: migrated.currentBalance ?? SAMPLE_BALANCE,
      potLedger: migrated.potLedger ?? [],
      nextYouNote: migrated.nextYouNote ?? '',
      tightPointGoal: migrated.tightPointGoal ?? null,
      transactions: migrated.transactions ?? seedTransactions(),
      edits: migrated.edits ?? [],
      calendarEvents: migrated.calendarEvents ?? [],
      calendarFocusDate: null,
      routeFocusDate: null,
      // Transient review queue — never restored from a persisted blob (it is
      // excluded from getPersistBlob), so a load always starts it empty.
      readerCandidates: [],
    };
    // Sweep stale sub-nudges on load — an override whose nudged renewal
    // date has already passed is consumed and deleted. Matches ENGINES.md
    // § 6 "sub-nudge clears the day after nudgedDate".
    return { ...loaded, subOverrides: sweepStaleOverrides(loaded.subs, loaded.subOverrides) };
  } catch {
    return DEFAULTS;
  }
}

/** Drop overrides whose effective renewal has already passed
 *  (`nextRenewalDaysAway + delta < 0`), or whose sub no longer exists.
 *  Pure — call from load and from the Today mount sweep. */
function sweepStaleOverrides(
  subs: Sub[],
  overrides: Record<string, number>,
): Record<string, number> {
  const byName = new Map(subs.map((s) => [s.name, s] as const));
  const next: Record<string, number> = {};
  for (const [name, delta] of Object.entries(overrides)) {
    const sub = byName.get(name);
    if (!sub) continue;
    if (sub.nextRenewalDaysAway + delta < 0) continue;
    next[name] = delta;
  }
  return next;
}

/** Public sweep — Today calls this on mount so an override that aged
 *  out between sessions is dropped before any reads. */
export function sweepSubOverrides() {
  const next = sweepStaleOverrides(state.subs, state.subOverrides);
  const changed =
    Object.keys(next).length !== Object.keys(state.subOverrides).length ||
    Object.entries(next).some(([k, v]) => state.subOverrides[k] !== v);
  if (changed) setPartial({ subOverrides: next });
}

let state: AppState = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  // In-memory port: snapshot the current state into the persisted blob.
  // Web original wrote JSON to window.localStorage; here we keep a structural
  // copy so a later migrate() never aliases live state.
  try {
    persistedBlob = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  } catch {
    /* serialization failure — ignore, matches web quota/private-mode swallow */
  }
}

export function getState(): AppState {
  return state;
}

/** Serialize the current state to a JSON string for native persistence.
 *  Pure + Node-safe — the native adapter (lib/persist.ts) writes the returned
 *  string to disk. Excludes the ephemeral cross-screen bridges
 *  (`calendarFocusDate` / `routeFocusDate`) and the transient statement-reader
 *  review queue (`readerCandidates`): they are read-once / review-before-truth
 *  hand-offs that `load()` already resets, so persisting them would be noise
 *  and — for `readerCandidates` — would let unreviewed candidates survive a
 *  restart, which the review-before-truth rule forbids.
 *  Per ENGINES §7 store-migration / RN_PORT "Store migration". */
export function getPersistBlob(): string {
  const {
    calendarFocusDate: _f,
    routeFocusDate: _r,
    readerCandidates: _rc,
    ...persistable
  } = state;
  return JSON.stringify(persistable);
}

/** Hydrate the store from a persisted JSON blob (read off disk by the native
 *  adapter). Runs the SAME path as `load()`: park the raw blob into
 *  `persistedBlob`, then `setPartial` the loaded+migrated state so listeners
 *  fire and the round-trip is identical to a first-run load. A malformed blob
 *  is a safe no-op (matches `load()`'s catch). Pure + Node-safe. */
export function hydrateFromBlob(raw: string): void {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return; // malformed blob — leave current state untouched.
  }
  if (parsed === null || typeof parsed !== 'object') return;
  // Route through the persisted-blob slot so load() applies migrate() + the
  // same field defaulting as a cold start, then publish via setPartial.
  persistedBlob = parsed;
  setPartial(load());
}

export function setPartial(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  persist();
  emit();
}

export function setPots(pots: Pot[] | ((prev: Pot[]) => Pot[])) {
  const next = typeof pots === 'function' ? pots(state.pots) : pots;
  setPartial({ pots: next });
}

export function setSubs(subs: Sub[] | ((prev: Sub[]) => Sub[])) {
  const next = typeof subs === 'function' ? subs(state.subs) : subs;
  setPartial({ subs: next });
}

export function removeSub(name: string) {
  const { [name]: _gone, ...restPaused } = state.subPaused;
  const { [name]: _gone2, ...restOverrides } = state.subOverrides;
  setPartial({
    subs: state.subs.filter((s) => s.name !== name),
    subPaused: restPaused,
    subOverrides: restOverrides,
  });
}

export function addToPot(id: string, amount: number, source: string = 'manual') {
  if (!(amount > 0)) return;
  const entry: PotLedgerEntry = {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    potId: id,
    at: new Date().toISOString(),
    kind: 'deposit',
    amount,
    source,
  };
  setPartial({
    pots: state.pots.map((p) => (p.id === id ? { ...p, saved: p.saved + amount } : p)),
    potLedger: [entry, ...state.potLedger].slice(0, 500),
  });
}

/** Mark a sub as "just used" — resets lastUsedDaysAgo to 0 and nudges
 *  the monthly count up by one, so the Subs screen pulse turns green. */
export function markSubUsed(name: string) {
  setSubs((prev) =>
    prev.map((s) =>
      s.name === name ? { ...s, lastUsedDaysAgo: 0, usesPerMonth: s.usesPerMonth + 1 } : s,
    ),
  );
}

export function togglePaused(name: string, value?: boolean) {
  const current = !!state.subPaused[name];
  setPartial({ subPaused: { ...state.subPaused, [name]: value ?? !current } });
}

export function pauseMany(names: string[], value: boolean) {
  const next = { ...state.subPaused };
  for (const n of names) next[n] = value;
  setPartial({ subPaused: next });
}

export function addCycle(c: CycleRecord) {
  // The note the user just wrote at cycle close becomes "past-you's line"
  // for the next ritual. Clearing it here means the next cycle starts with
  // a blank input rather than echoing the same note forever.
  setPartial({ cycles: [c, ...state.cycles].slice(0, 24), nextYouNote: '' });
}

export function setOnboarding(o: Partial<Onboarding>) {
  setPartial({ onboarding: { ...state.onboarding, ...o } });
}

/** ENGINES.md § 6 "Starting balance — source + confidence". The single
 *  write path for the user's current account position. Always stamps
 *  `setAt` so the source label can show "you set this 2 days ago" later. */
export function setCurrentBalance(next: Omit<CurrentBalance, 'setAt'>) {
  setPartial({ currentBalance: { ...next, setAt: new Date().toISOString() } });
}

/** Written by ScreenPaydayRitual step 4 — the line for next-you. */
export function setNextYouNote(note: string) {
  setPartial({ nextYouNote: note });
}

export function setTightPointGoal(amount: number | null) {
  setPartial({ tightPointGoal: amount });
}

export function addTransaction(
  t: Omit<Transaction, 'id' | 'when'> & { id?: string; when?: string },
): Transaction {
  const full: Transaction = {
    id: t.id ?? `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    when: t.when ?? new Date().toISOString(),
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    source: t.source,
  };
  setPartial({ transactions: [full, ...state.transactions].slice(0, 200) });
  return full;
}

export function removeTransaction(id: string) {
  setPartial({ transactions: state.transactions.filter((t) => t.id !== id) });
}

/** ENGINES.md §6 "Editing existing transactions — required, never destructive".
 *  Apply a correction to the transaction with `txnId`: run the pure `applyTxnEdit`
 *  engine (stamping `at = now`), REPLACE the matching row in place (same id, so
 *  the row is never duplicated and counts stay honest), and append the engine's
 *  immutable `TxnEdit` records to `edits`. The original values survive inside
 *  the edit chain, so an edit is fully recoverable — nothing is overwritten out
 *  of existence. A no-op patch (every field already at its current value)
 *  produces no records and leaves state untouched. */
export function editTransaction(txnId: string, patch: TxnEditPatch, by: 'user' | 'melo') {
  const target = state.transactions.find((t) => t.id === txnId);
  if (!target) return;
  const at = new Date().toISOString();
  const { txn: edited, edits } = applyTxnEdit(target, patch, { at, by });
  if (edits.length === 0) return; // no-op edit records nothing and writes nothing.
  setPartial({
    transactions: state.transactions.map((t) => (t.id === txnId ? edited : t)),
    edits: [...(state.edits ?? []), ...edits],
  });
}

export function addCalendarEvent(e: Omit<CalendarEvent, 'id'> & { id?: string }): CalendarEvent {
  const full: CalendarEvent = {
    id: e.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: e.date,
    kind: e.kind,
    title: e.title,
    // exactOptionalPropertyTypes: only set optional fields when present (never explicit undefined).
    ...(e.note !== undefined ? { note: e.note } : {}),
    ...(e.amount !== undefined ? { amount: e.amount } : {}),
  };
  setPartial({ calendarEvents: [full, ...state.calendarEvents].slice(0, 100) });
  return full;
}

export function removeCalendarEvent(id: string) {
  setPartial({ calendarEvents: state.calendarEvents.filter((e) => e.id !== id) });
}

/** Patch a manual calendar event (date nudge / edits). */
export function updateCalendarEvent(id: string, patch: Partial<Omit<CalendarEvent, 'id'>>) {
  setPartial({
    calendarEvents: state.calendarEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  });
}

/** Bridge from Route detail → Calendar. Calendar consumes and clears. */
export function setCalendarFocusDate(date: string | null) {
  setPartial({ calendarFocusDate: date });
}

/** Bridge from Calendar back to the Route (Today screen). Today consumes
 *  and clears, scrubbing its path to that date. */
export function setRouteFocusDate(date: string | null) {
  setPartial({ routeFocusDate: date });
}

/** Stage the candidates the statement reader extracted from a PDF/image for the
 *  Review screen. Review-before-truth: these are candidates only — NEVER posted
 *  facts, NEVER auto-counted. The Review screen confirms each one before it
 *  becomes a transaction. Excluded from `getPersistBlob`, so the queue does not
 *  survive a restart (an unreviewed candidate must never be silently kept). */
export function setReaderCandidates(items: CandidateMoneyItem[]) {
  setPartial({ readerCandidates: items });
}

/** Clear the staged statement-reader review queue — call once Review has
 *  consumed the candidates (confirmed or discarded) so the staging slot is
 *  empty again. */
export function clearReaderCandidates() {
  setPartial({ readerCandidates: [] });
}

/** Read path for the staged statement-reader review queue. A thin selector over
 *  `useAppStore` (the store's one reactive seam) so the Review surface subscribes
 *  to just this slice. Defined down with the other `use*` hooks so it sits after
 *  `useAppStore` is declared. */
export function useReaderCandidates(): CandidateMoneyItem[] {
  return useAppStore((s) => s.readerCandidates);
}

/** Nudge a flexible bill (subscription renewal) by `deltaDays`. This is
 *  the "what if I move this?" affordance — additive so repeated taps stack,
 *  clamped to ±7 days so we don't pretend bills are fully discretionary. */
export function nudgeSub(name: string, deltaDays: number) {
  const current = state.subOverrides[name] ?? 0;
  const next = Math.max(-7, Math.min(7, current + deltaDays));
  setPartial({ subOverrides: { ...state.subOverrides, [name]: next } });
}

/** Reset all "what if" nudges on flexible bills. */
export function resetSubOverrides(name?: string) {
  if (name) {
    const { [name]: _gone, ...rest } = state.subOverrides;
    setPartial({ subOverrides: rest });
  } else {
    setPartial({ subOverrides: {} });
  }
}

export function resetAll() {
  state = { ...DEFAULTS, transactions: seedTransactions(), calendarEvents: [] };
  persist();
  emit();
}

/** CLEAN-EMPTY reset — wipe the user's data to a genuinely empty state, with NO
 *  sample/demo reseed (the opposite of `resetAll`, which reseeds the demo set).
 *  Every user-data slot is cleared: transactions, pots, subs, the sub
 *  paused/override maps, ritual cycles, the correction-edit history, calendar
 *  events, the pot ledger, and the staged statement-reader review queue. The
 *  balance becomes a neutral, honest empty (£0, `user-entered`/`rough` — NOT
 *  `sample`), and `onboarding.done` is forced true so a returning clean user is
 *  NOT re-onboarded. `schemaVersion` is preserved so the empty state still loads
 *  through the same migration contract. Pure + immutable — builds a brand-new
 *  state object, never mutates the previous one. */
export function resetToEmpty() {
  const empty: AppState = {
    schemaVersion: state.schemaVersion,
    pots: [],
    subs: [],
    subPaused: {},
    subOverrides: {},
    cycles: [],
    onboarding: { ...state.onboarding, done: true },
    currentBalance: { ...EMPTY_BALANCE, setAt: new Date().toISOString() },
    potLedger: [],
    nextYouNote: '',
    tightPointGoal: null,
    transactions: [],
    edits: [],
    calendarEvents: [],
    calendarFocusDate: null,
    routeFocusDate: null,
    readerCandidates: [],
  };
  state = empty;
  persist();
  emit();
}

/** Pure selector — true when the app holds any real user data (transactions,
 *  pots, subs, or ritual cycles). Lets a surface tell a genuinely-used app from
 *  a fresh/demo one (e.g. after `resetToEmpty`, this is false). No state read of
 *  its own — operates only on the snapshot it's given, so it's safe to call from
 *  selectors, `load()`, or tests. */
export function hasAnyUserData(s: AppState): boolean {
  return s.transactions.length > 0 || s.pots.length > 0 || s.subs.length > 0 || s.cycles.length > 0;
}

/** Debug: shift every dated thing backwards by ~30 days and add a synthetic
 *  closed cycle. Lets us demo Insights without waiting a month. */
export function fastForwardMonth() {
  const day = 86_400_000;
  const shift = 30 * day;
  const newCycle: CycleRecord = {
    closedAt: new Date().toISOString().slice(0, 10),
    label: new Date().toLocaleString('en-GB', { month: 'long' }),
    spare: 80 + Math.round(Math.random() * 120),
    tightPoint: 30 + Math.round(Math.random() * 60),
    setAside: 50 + Math.round(Math.random() * 40),
    note: 'Auto-closed via fast-forward.',
  };
  const agedCycles = state.cycles.map((c) => ({
    ...c,
    closedAt: new Date(new Date(c.closedAt).getTime() - shift).toISOString().slice(0, 10),
  }));
  const agedTxns = state.transactions.map((t) => ({
    ...t,
    when: new Date(new Date(t.when).getTime() - shift).toISOString(),
  }));
  // Roll every sub forward into its next cycle; bump lastUsed if it was recent.
  const agedSubs = state.subs.map((s) => ({
    ...s,
    nextRenewalDaysAway: s.nextRenewalDaysAway <= 0 ? 30 : s.nextRenewalDaysAway,
    lastUsedDaysAgo: s.lastUsedDaysAgo + 30,
  }));
  setPartial({
    cycles: [newCycle, ...agedCycles].slice(0, 24),
    transactions: agedTxns,
    subs: agedSubs,
  });
}

/* ---------- Melo tool bridge ----------
 * Melo's server-side tools return a friendly message; the actual app state
 * change happens here on the client when a tool part finishes streaming.
 * Each tool returns an `undo` closure so the chat can offer a one-tap revert.
 * The Melo tool set is the log_* family (record money as transactions). Pot
 * moves are NOT a Melo tool — addToPot / borrowFromPot are called directly.
 */
export type MeloToolName = 'log_spend' | 'log_income' | 'log_refund' | 'log_transfer';

const MELO_TOOL_NAMES: MeloToolName[] = ['log_spend', 'log_income', 'log_refund', 'log_transfer'];

export type MeloToolResult =
  | { applied: true; summary: string; undo: () => void }
  | { applied: false; reason: string }
  | { applied: false; reason: string; candidates: MeloToolName[] };

/** ENGINES.md § 6 "Melo — tool name matching". Normalise a tool name the
 *  model emitted (lowercase / trim / strip punctuation → single spaces) so a
 *  loosely-named tool still resolves. Used by both `matchMeloTool` and
 *  `applyMeloTool`. Pure. */
export function normaliseMeloToolName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Resolve a (possibly loosely-named) tool to a canonical `MeloToolName`.
 *  Returns `{ ok: true, name }` on an exact-normalised or unambiguous
 *  substring match; `{ ok: false, candidates }` when more than one canonical
 *  tool matches (ENGINES §6 "returning candidates when ambiguous"); and
 *  `{ ok: false, candidates: [] }` when nothing matches. Pure — no state. */
export function matchMeloTool(
  raw: string,
): { ok: true; name: MeloToolName } | { ok: false; candidates: MeloToolName[] } {
  const norm = normaliseMeloToolName(raw);
  if (!norm) return { ok: false, candidates: [] };
  // Canonical names compared in the same normalised space ('_' → ' ').
  const normalised = MELO_TOOL_NAMES.map((n) => [n, normaliseMeloToolName(n)] as const);
  // 1. Exact normalised match wins outright (unambiguous by construction).
  const exact = normalised.find(([, n]) => n === norm);
  if (exact) return { ok: true, name: exact[0] };
  // 2. Substring either direction — collect every canonical tool that matches.
  const hits = normalised
    .filter(([, n]) => n.includes(norm) || norm.includes(n))
    .map(([name]) => name);
  const [only] = hits;
  if (hits.length === 1 && only !== undefined) return { ok: true, name: only };
  // 0 or >1 → ambiguous / no match; hand back the candidate set.
  return { ok: false, candidates: hits };
}

/** The Transaction.category union, as a runtime list for validating a
 *  model-proposed category. Anything off this list falls back to 'other'. */
const TXN_CATEGORIES: Transaction['category'][] = [
  'food',
  'transport',
  'fun',
  'bills',
  'shopping',
  'income',
  'other',
];

/** Coerce a model-proposed category to a valid Transaction['category'], else
 *  the honest fallback `'other'`. Never invents a category that isn't real. */
function coerceCategory(raw: unknown): Transaction['category'] {
  const value = String(raw ?? 'other') as Transaction['category'];
  return TXN_CATEGORIES.includes(value) ? value : 'other';
}

/* ---------- Melo log_* tool family — chosen params + behaviour ----------
 * SPEC NOTE for Lovable / owner to confirm. The exact param shapes for
 * log_income / log_refund / log_transfer live in Lovable's project-knowledge,
 * NOT in the design code, so these are a reasonable, documented implementation
 * built ONLY on the existing Transaction model (no new fields, no new category
 * values). Every tool is candidate/honest: Melo proposes, the user confirms in
 * the chat, and each result carries an `undo` closure for the 30s revert.
 *
 *   log_spend({ merchant, amount>0, category? })
 *     → one NEGATIVE transaction (a spend). `category` is best-fit or 'other'.
 *       Source 'melo'. (Unchanged from the prior design — kept verbatim.)
 *
 *   log_income({ merchant/source, amount>0, category? })
 *     → one POSITIVE transaction (an inflow). The payer name is read from
 *       `merchant` OR `source` (the model may use either). `category` defaults
 *       to 'income' but any valid category the model gives is respected.
 *       Source 'melo'.
 *
 *   log_refund({ merchant, amount>0, original?, category? })
 *     → one POSITIVE transaction tagged as a refund and "linked" to the
 *       original spend WITHOUT auto-deciding a verdict. There is no free-text
 *       note field on Transaction, so the link is recorded honestly in the
 *       `merchant` string as "<merchant> · refund" (and "· re <original>" when
 *       the model passes the original merchant/txn it relates to). Category
 *       stays the honest, non-judgemental 'other' unless the model supplies a
 *       valid one — a refund is NOT income, so it is never silently filed as
 *       income. Source 'melo'.
 *
 *   log_transfer({ from, to, amount>0 })
 *     → a PAIRED move recorded as TWO neutral transactions on one timestamp:
 *       a negative "out" leg ("<from> → <to> · transfer") and a positive "in"
 *       leg ("<to> ← <from> · transfer"), both category 'other'. A transfer is
 *       money you still own moving between accounts, so the pair nets to £0 and
 *       never reads as a spend or an inflow. Undo removes BOTH legs. Source
 *       'melo'. (A single transfer-tagged record was the alternative; the
 *       paired shape is used so each side is visible where the money lands.)
 *
 * Pot moves are NO LONGER a Melo tool — addToPot / borrowFromPot are called
 * directly by the app, not through applyMeloTool.
 */
export function applyMeloTool(name: string, input: Record<string, unknown>): MeloToolResult {
  // Normalise the tool name first (ENGINES §6). An unknown / ambiguous name
  // returns candidates instead of silently no-op'ing on the exact-switch miss.
  const matched = matchMeloTool(name);
  if (!matched.ok) {
    return matched.candidates.length > 0
      ? { applied: false, reason: 'ambiguous tool', candidates: matched.candidates }
      : { applied: false, reason: 'unknown tool', candidates: [] };
  }
  switch (matched.name) {
    case 'log_spend': {
      const merchant = String(input.merchant ?? '').trim();
      const amount = Number(input.amount ?? 0);
      const category = coerceCategory(input.category);
      if (!merchant || !(amount > 0)) return { applied: false, reason: 'bad args' };
      const created = addTransaction({ merchant, amount: -amount, category, source: 'melo' });
      return {
        applied: true,
        summary: `Logged £${amount.toFixed(2)} at ${merchant}`,
        undo: () => removeTransaction(created.id),
      };
    }
    case 'log_income': {
      // The payer/source name may arrive as `merchant` or `source`.
      const merchant = String(input.merchant ?? input.source ?? '').trim();
      const amount = Number(input.amount ?? 0);
      // Default to the 'income' category; honour any valid category the model gives.
      const category = input.category === undefined ? 'income' : coerceCategory(input.category);
      if (!merchant || !(amount > 0)) return { applied: false, reason: 'bad args' };
      const created = addTransaction({ merchant, amount: amount, category, source: 'melo' });
      return {
        applied: true,
        summary: `Logged £${amount.toFixed(2)} in from ${merchant}`,
        undo: () => removeTransaction(created.id),
      };
    }
    case 'log_refund': {
      const merchant = String(input.merchant ?? '').trim();
      const amount = Number(input.amount ?? 0);
      if (!merchant || !(amount > 0)) return { applied: false, reason: 'bad args' };
      // Tag it as a refund and (optionally) "link" it to the original spend in the
      // merchant string — the only free-text field we have. Honest, not a verdict.
      const original = String(input.original ?? '').trim();
      const label = original ? `${merchant} · refund · re ${original}` : `${merchant} · refund`;
      // A refund is an inflow but NOT income; keep 'other' unless the model gives a real category.
      const category = input.category === undefined ? 'other' : coerceCategory(input.category);
      const created = addTransaction({ merchant: label, amount: amount, category, source: 'melo' });
      return {
        applied: true,
        summary: `Logged £${amount.toFixed(2)} refund from ${merchant}`,
        undo: () => removeTransaction(created.id),
      };
    }
    case 'log_transfer': {
      const from = String(input.from ?? '').trim();
      const to = String(input.to ?? '').trim();
      const amount = Number(input.amount ?? 0);
      if (!from || !to || !(amount > 0)) return { applied: false, reason: 'bad args' };
      // A neutral, paired move: one negative "out" leg + one positive "in" leg on a
      // shared timestamp, so it nets to £0 and never reads as a spend or an inflow.
      const when = new Date().toISOString();
      const outLeg = addTransaction({
        merchant: `${from} → ${to} · transfer`,
        amount: -amount,
        category: 'other',
        source: 'melo',
        when,
      });
      const inLeg = addTransaction({
        merchant: `${to} ← ${from} · transfer`,
        amount: amount,
        category: 'other',
        source: 'melo',
        when,
      });
      return {
        applied: true,
        summary: `Logged £${amount.toFixed(2)} transfer ${from} → ${to}`,
        undo: () => {
          removeTransaction(outLeg.id);
          removeTransaction(inLeg.id);
        },
      };
    }
    default:
      return { applied: false, reason: 'unknown tool' };
  }
}

import { useSyncExternalStore } from 'react';

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Public, non-React subscription to store changes — the same listener seam
 *  `useAppStore` drives through `useSyncExternalStore`, exposed so the native
 *  persistence adapter (lib/persist.ts) can debounce-write the blob on change
 *  without mounting a hook. Returns an unsubscribe. Node-safe (no RN/expo). */
export function subscribeStore(cb: () => void): () => void {
  return subscribe(cb);
}

export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(DEFAULTS),
  );
}
