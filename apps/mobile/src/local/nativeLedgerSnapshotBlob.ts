/**
 * Pure parsing for the local-ledger JSON snapshot blob — the durable copy of the containers the
 * normalized relational tables do NOT model (pots, subscriptions, cycles) plus the Calendar engine's
 * subOverrides + calendarEvents. No native / SQLite imports, so it is unit-testable under vitest;
 * nativeLedgerStore re-exports these and feeds them the raw blob it reads off op-sqlite.
 *
 * The split exists because the blob is the ONLY durable copy of these values, so corruption is
 * unrecoverable data loss: the parse must distinguish "legitimately empty" (no blob yet) from
 * "corrupt" (a blob present but malformed) so the caller can surface it instead of swallowing it.
 */
import type { LocalLedgerState } from './localLedger';

export type DurableContainers = Readonly<{
  pots: LocalLedgerState['pots'];
  subscriptions: LocalLedgerState['subscriptions'];
  cycles: LocalLedgerState['cycles'];
  // subOverrides + calendarEvents share the snapshot-blob round-trip with pots/subscriptions/cycles:
  // the normalized relational tables do not model them, so the JSON blob is their only durable copy.
  subOverrides: LocalLedgerState['subOverrides'];
  calendarEvents: LocalLedgerState['calendarEvents'];
}>;

export const EMPTY_DURABLE_CONTAINERS: DurableContainers = {
  pots: [],
  subscriptions: [],
  cycles: [],
  subOverrides: {},
  calendarEvents: [],
};

export type DurableContainersLoad = Readonly<{
  containers: DurableContainers;
  corrupt: boolean;
}>;

export function parseDurableContainersBlob(rawJson: string | undefined): DurableContainersLoad {
  // No blob persisted yet is a legitimately empty picture, not corruption.
  if (typeof rawJson !== 'string') {
    return { containers: EMPTY_DURABLE_CONTAINERS, corrupt: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { containers: EMPTY_DURABLE_CONTAINERS, corrupt: true };
  }
  if (!isPlainRecord(parsed)) {
    return { containers: EMPTY_DURABLE_CONTAINERS, corrupt: true };
  }
  // A container key that is PRESENT but not an array is malformed data, not a legitimately empty
  // picture — flag it as corrupt so the loss is surfaced (a warning) rather than silently coerced
  // to []. Absent keys are fine (an older blob simply had no pots/subscriptions/cycles yet).
  // subOverrides is a plain object (name -> day-delta), so it is malformed when present-but-not-a-
  // plain-record; calendarEvents follows the same present-but-not-an-array rule as the containers.
  const malformed =
    ('pots' in parsed && !Array.isArray(parsed.pots)) ||
    ('subscriptions' in parsed && !Array.isArray(parsed.subscriptions)) ||
    ('cycles' in parsed && !Array.isArray(parsed.cycles)) ||
    ('calendarEvents' in parsed && !Array.isArray(parsed.calendarEvents)) ||
    ('subOverrides' in parsed && !isPlainRecord(parsed.subOverrides));
  return {
    containers: {
      pots: Array.isArray(parsed.pots) ? (parsed.pots as LocalLedgerState['pots']) : [],
      subscriptions: Array.isArray(parsed.subscriptions)
        ? (parsed.subscriptions as LocalLedgerState['subscriptions'])
        : [],
      cycles: Array.isArray(parsed.cycles) ? (parsed.cycles as LocalLedgerState['cycles']) : [],
      subOverrides: sanitizeSubOverrides(parsed.subOverrides),
      calendarEvents: Array.isArray(parsed.calendarEvents)
        ? (parsed.calendarEvents as LocalLedgerState['calendarEvents'])
        : [],
    },
    corrupt: malformed,
  };
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Keep only name -> finite-number entries; a corrupt blob value still yields a usable (possibly
// empty) override map rather than poisoning the derived calendar.
export function sanitizeSubOverrides(value: unknown): LocalLedgerState['subOverrides'] {
  if (!isPlainRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const key of Object.keys(value)) {
    const entry = value[key];
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      out[key] = Math.round(entry);
    }
  }
  return out;
}
