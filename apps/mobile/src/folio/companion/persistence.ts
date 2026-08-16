import * as SecureStore from 'expo-secure-store';

const COMPANION_BEHAVIOR_KEY = 'melo.companion.behavior.v1';

let hydratedSeed: Record<string, unknown> = {};
let lastSerialized = '{}';
let writeChain: Promise<void> = Promise.resolve();

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Hydrate the small, non-financial companion-behaviour record before the shell mounts. */
export async function hydrateMeloCompanionBehavior(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(COMPANION_BEHAVIOR_KEY);
    if (!raw) {
      hydratedSeed = {};
      lastSerialized = '{}';
      return;
    }
    const parsed: unknown = JSON.parse(raw);
    hydratedSeed = isPlainRecord(parsed) ? parsed : {};
    lastSerialized = JSON.stringify(hydratedSeed);
  } catch {
    hydratedSeed = {};
    lastSerialized = '{}';
  }
}

export function meloCompanionBehaviorSeed(): Record<string, unknown> {
  return structuredClone(hydratedSeed);
}

/**
 * Persist bounded relationship/cooldown/preferences only. Financial facts remain in the canonical
 * workspace store and are never duplicated into this record.
 */
export function persistMeloCompanionBehavior(value: Record<string, unknown>): void {
  const serialized = JSON.stringify(value);
  if (serialized === lastSerialized) return;
  lastSerialized = serialized;
  hydratedSeed = structuredClone(value);
  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      await SecureStore.setItemAsync(COMPANION_BEHAVIOR_KEY, serialized);
    })
    .catch(() => undefined);
}
