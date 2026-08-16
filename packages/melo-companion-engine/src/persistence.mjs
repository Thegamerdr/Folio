export function createMemoryPersistence(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get(key, fallback = null) {
      return values.has(key) ? values.get(key) : fallback;
    },
    set(key, value) {
      values.set(key, value);
    },
    remove(key) {
      values.delete(key);
    },
    dump() {
      return Object.fromEntries(values.entries());
    },
  };
}

/**
 * Synchronous JSON persistence for browser localStorage, a desktop key/value
 * store, or any compatible host adapter. Corrupt or unavailable storage never
 * prevents the companion from running; the supplied fallback is returned.
 */
export function createJsonStoragePersistence(storage, { prefix = '' } = {}) {
  const keyFor = (key) => `${prefix}${key}`;
  return {
    get(key, fallback = null) {
      try {
        const value = storage?.getItem?.(keyFor(key));
        return value === null || value === undefined ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        storage?.setItem?.(keyFor(key), JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        storage?.removeItem?.(keyFor(key));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const PERSISTED_KEYS = Object.freeze({
  tucked: 'melo.companion.tucked',
  quiet: 'melo.companion.quiet',
  preferredAnchor: 'melo.companion.preferredAnchor',
  preferredPosition: 'melo.companion.preferredPosition',
  lastInteraction: 'melo.companion.lastInteraction',
  sessionGreetingShown: 'melo.companion.sessionGreetingShown',
  reactionHistory: 'melo.companion.reactionHistory',
  behaviorMemory: 'melo.companion.behaviorMemory',
  relationship: 'melo.companion.relationship',
  wardrobe: 'melo.companion.wardrobe',
});
