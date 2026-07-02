// The Melo surface store — the user's setup + journey record, encrypted at rest.
// Mirrors the folio persistence pattern exactly (expo-file-system document dir + AES-256-GCM via
// the shared cryptoBlob/vaultKey libs — reused, never modified), with Melo's own blob file, so
// the two surfaces never contend. State is deliberately tiny: what the user told us at
// onboarding, the balance they last confirmed, and the engine's sticky state record.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import type { BillKind, MeloStateRecord, SpendEntry } from '@folio/melo-engine';
import { GCM_NONCE_BYTES, decryptBlob, encryptBlob, isEncryptedBlob } from '@/folio/lib/cryptoBlob';
import { getVaultKey } from '@/folio/lib/vaultKey';

import type { MeloColorway } from '../theme/weather';

const STATE_FILENAME = 'melo.state.v1.json';
const WRITE_DEBOUNCE_MS = 400;

export interface MeloBill {
  readonly id: string;
  readonly name: string;
  readonly amountPence: number;
  readonly dueDay: number; // 1..28
  readonly kind: BillKind;
}

export interface MeloSetup {
  readonly onboarded: boolean;
  readonly colorway: MeloColorway;
  readonly paydayDay: number; // 1..28
  readonly incomePence: number;
  readonly balancePence: number;
  readonly balanceUpdatedAtMs: number;
  readonly bills: readonly MeloBill[];
  readonly essentialsPerDayPence: number;
  readonly savingsPence: number;
  readonly bufferPence: number;
  /** Quiet Mode (§14 item 16): ambient only — no prompts except a danger entry. */
  readonly quietMode: boolean;
  /** WardrobeId from mascot/wardrobe (kept as a plain string here so the store stays
   *  decoupled from the rig); null = nothing worn. */
  readonly wardrobe: string | null;
}

export interface MeloJourney {
  readonly record: MeloStateRecord | null;
  readonly recoveryStartISO: string | null;
  readonly moveDoneISO: string | null;
}

export interface MeloShelfItem {
  readonly amountPence: number;
  readonly atISO: string;
}

export interface MeloState {
  readonly setup: MeloSetup;
  readonly journey: MeloJourney;
  readonly checksThisWeek: number;
  readonly checksWeekStartISO: string | null;
  readonly lastRitualISO: string | null;
  readonly spendLog: readonly SpendEntry[];
  readonly wins: readonly string[];
  /** Dated win history for the weekly review. `wins` stays the one-shot dedupe set —
   *  old blobs without this field load as [] (their win dates are honestly unknown). */
  readonly winLog: readonly { readonly id: string; readonly atISO: string }[];
  readonly shelf: MeloShelfItem | null;
  /** §14 metrics, kept honest and LOCAL: plain on-device counters (never uploaded).
   *  Keys are event names ('check', 'ritualDone', 'importApplied', …). */
  readonly usage: Readonly<Record<string, number>>;
  /** Manual payday trigger (§14: "user taps 'I got paid'") — offers the ritual today
   *  without touching the cycle math. */
  readonly manualPaydayISO: string | null;
  /** Last day the weekly review was opened — drives the once-a-week nudge card. */
  readonly lastReviewISO: string | null;
}

const DEFAULT_SETUP: MeloSetup = {
  onboarded: false,
  colorway: 'ember',
  paydayDay: 28,
  incomePence: 0,
  balancePence: 0,
  balanceUpdatedAtMs: 0,
  bills: [],
  essentialsPerDayPence: 1_400,
  savingsPence: 4_000,
  bufferPence: 2_000,
  quietMode: false,
  wardrobe: null,
};

const DEFAULT_STATE: MeloState = {
  setup: DEFAULT_SETUP,
  journey: { record: null, recoveryStartISO: null, moveDoneISO: null },
  checksThisWeek: 0,
  checksWeekStartISO: null,
  lastRitualISO: null,
  spendLog: [],
  wins: [],
  winLog: [],
  shelf: null,
  usage: {},
  manualPaydayISO: null,
  lastReviewISO: null,
};

/** Everything a statement import can apply, committed as ONE state update (one persist,
 *  no half-applied import if the app dies between steps). */
export interface StatementApply {
  readonly balancePence: number | null;
  readonly newBills: readonly MeloBill[];
  readonly spendEntries: readonly { readonly amountPence: number; readonly atISO: string }[];
}

export interface MeloStoreApi {
  readonly ready: boolean;
  readonly state: MeloState;
  readonly completeOnboarding: (setup: Omit<MeloSetup, 'onboarded'>) => void;
  readonly updateBalance: (balancePence: number) => void;
  readonly setJourney: (journey: MeloJourney) => void;
  readonly setStateRecord: (record: MeloStateRecord) => void;
  readonly markMoveDone: (todayISO: string) => void;
  readonly markRitualDone: (todayISO: string) => void;
  readonly incrementChecks: (todayISO: string) => void;
  readonly setShelf: (item: MeloShelfItem | null) => void;
  /** Log a spend: appended to the log AND deducted from the balance — logging IS fresh data. */
  readonly addSpend: (amountPence: number, atISO: string, note?: string) => void;
  readonly recordWins: (ids: readonly string[], atISO: string) => void;
  /** Apply a parsed statement atomically: balance + new bills + seeded spend log. */
  readonly applyImport: (apply: StatementApply, atISO: string) => void;
  readonly updateSetup: (partial: Partial<Omit<MeloSetup, 'onboarded'>>) => void;
  /** Count a local usage event (§14 metrics — on-device only, never uploaded). */
  readonly bump: (event: string) => void;
  readonly markPaidToday: (todayISO: string) => void;
  readonly markReviewSeen: (todayISO: string) => void;
  readonly resetAll: () => void;
}

const MeloStoreContext = createContext<MeloStoreApi | null>(null);

function weeksApart(fromISO: string, toISO: string): boolean {
  const from = new Date(`${fromISO}T00:00:00`).getTime();
  const to = new Date(`${toISO}T00:00:00`).getTime();
  return to - from >= 7 * 86_400_000;
}

function stateFileUri(): string {
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error('documentDirectory unavailable');
  return `${dir}${STATE_FILENAME}`;
}

async function readPersisted(): Promise<MeloState | null> {
  try {
    const uri = stateFileUri();
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(uri);
    const plaintext = isEncryptedBlob(raw) ? decryptBlob(raw, await getVaultKey()) : raw;
    if (plaintext === null) return null;
    const parsed = JSON.parse(plaintext) as { v: number; state: MeloState };
    if (parsed.v !== 1 || typeof parsed.state !== 'object') return null;
    return {
      ...DEFAULT_STATE,
      ...parsed.state,
      setup: { ...DEFAULT_SETUP, ...parsed.state.setup },
    };
  } catch {
    return null; // unreadable blob → honest fresh start beats a crash loop
  }
}

async function writePersisted(state: MeloState): Promise<void> {
  try {
    const plaintext = JSON.stringify({ v: 1, state });
    const nonce = new Uint8Array(Crypto.getRandomBytes(GCM_NONCE_BYTES));
    const ciphertext = encryptBlob(plaintext, await getVaultKey(), nonce);
    await FileSystem.writeAsStringAsync(stateFileUri(), ciphertext);
  } catch {
    // Persistence is best-effort; the in-memory session stays correct either way.
  }
}

export function MeloStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<MeloState>(DEFAULT_STATE);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    void readPersisted().then((persisted) => {
      if (!mounted) return;
      if (persisted) setState(persisted);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const scheduleWrite = useCallback((next: MeloState) => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      void writePersisted(next);
    }, WRITE_DEBOUNCE_MS);
  }, []);

  // Persist via an effect, not inside the setState updater — updaters must stay pure (they can
  // be re-invoked), and this way the LAST state always wins the debounce.
  const update = useCallback((fn: (prev: MeloState) => MeloState) => {
    setState(fn);
  }, []);

  useEffect(() => {
    if (!ready) return;
    scheduleWrite(state);
  }, [ready, state, scheduleWrite]);

  const api = useMemo<MeloStoreApi>(
    () => ({
      ready,
      state,
      completeOnboarding: (setup) =>
        update((prev) => ({ ...prev, setup: { ...setup, onboarded: true } })),
      updateBalance: (balancePence) =>
        update((prev) => ({
          ...prev,
          setup: { ...prev.setup, balancePence, balanceUpdatedAtMs: Date.now() },
        })),
      setJourney: (journey) => update((prev) => ({ ...prev, journey })),
      setStateRecord: (record) =>
        update((prev) => ({ ...prev, journey: { ...prev.journey, record } })),
      markMoveDone: (todayISO) =>
        update((prev) => ({ ...prev, journey: { ...prev.journey, moveDoneISO: todayISO } })),
      markRitualDone: (todayISO) => update((prev) => ({ ...prev, lastRitualISO: todayISO })),
      incrementChecks: (todayISO) =>
        update((prev) => {
          // "this week" means this week: the counter resets after seven days (audit: the
          // all-time counter made the ticker lie within a fortnight).
          const stale = !prev.checksWeekStartISO || weeksApart(prev.checksWeekStartISO, todayISO);
          return stale
            ? { ...prev, checksThisWeek: 1, checksWeekStartISO: todayISO }
            : { ...prev, checksThisWeek: prev.checksThisWeek + 1 };
        }),
      setShelf: (item) => update((prev) => ({ ...prev, shelf: item })),
      addSpend: (amountPence, atISO, note) =>
        update((prev) => ({
          ...prev,
          spendLog: [
            ...prev.spendLog,
            {
              id: `${atISO}-${prev.spendLog.length}`,
              amountPence,
              atISO,
              ...(note ? { note } : {}),
            },
          ],
          setup: {
            ...prev.setup,
            balancePence: prev.setup.balancePence - amountPence,
            balanceUpdatedAtMs: Date.now(),
          },
        })),
      recordWins: (ids, atISO) =>
        update((prev) => {
          const fresh = ids.filter((id) => !prev.wins.includes(id));
          if (fresh.length === 0) return prev;
          return {
            ...prev,
            wins: [...prev.wins, ...fresh],
            winLog: [...prev.winLog, ...fresh.map((id) => ({ id, atISO }))],
          };
        }),
      applyImport: (apply, atISO) =>
        update((prev) => {
          // Dedupe against what's already there: bills by case-insensitive name, spends by
          // (day, amount) — re-importing the same statement must be a no-op, not a double-count.
          const known = new Set(prev.setup.bills.map((b) => b.name.toLowerCase()));
          const bills = apply.newBills.filter((b) => !known.has(b.name.toLowerCase()));
          const seen = new Set(prev.spendLog.map((s) => `${s.atISO}:${s.amountPence}`));
          const spends = apply.spendEntries
            .filter((s) => !seen.has(`${s.atISO}:${s.amountPence}`))
            .map((s, i) => ({
              id: `import-${atISO}-${i}`,
              amountPence: s.amountPence,
              atISO: s.atISO,
            }));
          return {
            ...prev,
            setup: {
              ...prev.setup,
              bills: [...prev.setup.bills, ...bills],
              ...(apply.balancePence !== null
                ? { balancePence: apply.balancePence, balanceUpdatedAtMs: Date.now() }
                : {}),
            },
            spendLog: [...prev.spendLog, ...spends],
          };
        }),
      updateSetup: (partial) =>
        update((prev) => ({ ...prev, setup: { ...prev.setup, ...partial } })),
      bump: (event) =>
        update((prev) => ({
          ...prev,
          usage: { ...prev.usage, [event]: (prev.usage[event] ?? 0) + 1 },
        })),
      markPaidToday: (todayISO) => update((prev) => ({ ...prev, manualPaydayISO: todayISO })),
      markReviewSeen: (todayISO) => update((prev) => ({ ...prev, lastReviewISO: todayISO })),
      resetAll: () => update(() => DEFAULT_STATE),
    }),
    [ready, state, update],
  );

  return <MeloStoreContext.Provider value={api}>{children}</MeloStoreContext.Provider>;
}

export function useMeloStore(): MeloStoreApi {
  const ctx = useContext(MeloStoreContext);
  if (!ctx) throw new Error('useMeloStore must be used inside MeloStoreProvider');
  return ctx;
}
