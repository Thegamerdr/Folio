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
}

export interface MeloJourney {
  readonly record: MeloStateRecord | null;
  readonly recoveryStartISO: string | null;
  readonly moveDoneISO: string | null;
}

export interface MeloState {
  readonly setup: MeloSetup;
  readonly journey: MeloJourney;
  readonly checksThisWeek: number;
  readonly lastRitualISO: string | null;
  readonly spendLog: readonly SpendEntry[];
  readonly wins: readonly string[];
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
};

const DEFAULT_STATE: MeloState = {
  setup: DEFAULT_SETUP,
  journey: { record: null, recoveryStartISO: null, moveDoneISO: null },
  checksThisWeek: 0,
  lastRitualISO: null,
  spendLog: [],
  wins: [],
};

export interface MeloStoreApi {
  readonly ready: boolean;
  readonly state: MeloState;
  readonly completeOnboarding: (setup: Omit<MeloSetup, 'onboarded'>) => void;
  readonly updateBalance: (balancePence: number) => void;
  readonly setJourney: (journey: MeloJourney) => void;
  readonly setStateRecord: (record: MeloStateRecord) => void;
  readonly markMoveDone: (todayISO: string) => void;
  readonly markRitualDone: (todayISO: string) => void;
  readonly incrementChecks: () => void;
  /** Log a spend: appended to the log AND deducted from the balance — logging IS fresh data. */
  readonly addSpend: (amountPence: number, atISO: string, note?: string) => void;
  readonly recordWins: (ids: readonly string[]) => void;
  readonly updateSetup: (partial: Partial<Omit<MeloSetup, 'onboarded'>>) => void;
  readonly resetAll: () => void;
}

const MeloStoreContext = createContext<MeloStoreApi | null>(null);

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

  const update = useCallback(
    (fn: (prev: MeloState) => MeloState) => {
      setState((prev) => {
        const next = fn(prev);
        scheduleWrite(next);
        return next;
      });
    },
    [scheduleWrite],
  );

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
      incrementChecks: () =>
        update((prev) => ({ ...prev, checksThisWeek: prev.checksThisWeek + 1 })),
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
      recordWins: (ids) =>
        update((prev) => ({
          ...prev,
          wins: [...prev.wins, ...ids.filter((id) => !prev.wins.includes(id))],
        })),
      updateSetup: (partial) =>
        update((prev) => ({ ...prev, setup: { ...prev.setup, ...partial } })),
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
