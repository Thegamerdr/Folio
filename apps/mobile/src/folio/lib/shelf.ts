/**
 * @rn-lib shelf — 24-Hour Shelf. Faithful 1:1 port of the pure engine in the web design source
 * (folio-melo/.claude/worktrees/design-main/src/lib/shelf/index.ts): park a want, let it sit for a
 * day, and re-see it with fresh eyes. Melo doesn't judge the purchase — it just remembers so the
 * user can decide tomorrow whether it still feels like the right move.
 *
 * `ShelfItem` / `makeShelfItem` / `isRipe` / `sweepShelf` / `shelfBadgeCopy` below are byte-faithful
 * to the web engine (same fields, same 24h/7d constants, same copy).
 *
 * STORE-SEAM DEVIATION (flagged per instructions — do not silently "fix"): the web engine's state
 * (`shelf: ShelfItem[]`) lives in the shared app store (`src/lib/store.ts`), which already has a
 * documented `shelf` slot ready for it (RN `apps/mobile/src/folio/store.ts` does NOT — grepped, no
 * `shelf` field, no `addShelfItem`/`resolveShelfItem`/`awardTinyWin`, and `store.ts` is outside this
 * batch's file list per PORT_BIBLE's file-disjoint discipline). Rather than leave ShelfSheet
 * unbuildable, this module also exports a SELF-CONTAINED, module-scoped store
 * (`useShelf`/`addShelfItem`/`resolveShelfItem`/`sweepShelfNow`) using the exact same
 * `useSyncExternalStore` pub/sub idiom the real store uses (see store.ts `subscribeStore`/
 * `useAppStore`), so ShelfSheet is fully functional today. It is PROVISIONAL: this state does not
 * persist across app restarts (no store.ts migration slot) and is not visible to any other surface.
 * When store.ts's `shelf` slice is added (its migration comment is already staged — store.ts lines
 * ~287-289 reference `./shelf` and a `ShelfItem` type import), this module's local store should be
 * deleted and its call sites re-pointed at the real store exports of the same names — the function
 * signatures below were deliberately kept identical to the real store's documented shape so that
 * swap is a pure import-path change with no call-site edits.
 */

export type ShelfStatus = 'pending' | 'kept' | 'let-go' | 'expired';

export type ShelfItem = {
  id: string;
  label: string;
  amount: number;
  /** ISO timestamp added. */
  addedAt: string;
  /** ISO timestamp when the shelf re-surfaces the item — always addedAt + 24h. */
  dueAt: string;
  status: ShelfStatus;
  /** The verdict at the moment the user shelved it, kept for context. */
  verdictAtAdd?: 'safe' | 'tight' | 'not-now' | 'safe-later' | undefined;
};

const DAY_MS = 24 * 3_600_000;
const SWEEP_CUTOFF_DAYS = 7;
const MAX_SHELF_ITEMS = 40;

export function makeShelfItem(
  label: string,
  amount: number,
  verdictAtAdd?: ShelfItem['verdictAtAdd'],
): ShelfItem {
  const now = new Date();
  return {
    id: `sh-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    label: label.trim() || 'Something',
    amount: Math.max(0, Math.round(amount)),
    addedAt: now.toISOString(),
    dueAt: new Date(now.getTime() + DAY_MS).toISOString(),
    status: 'pending',
    verdictAtAdd,
  };
}

/** True once the 24 hours are up — the shelf then re-surfaces the item. */
export function isRipe(item: ShelfItem, now: Date = new Date()): boolean {
  return item.status === 'pending' && new Date(item.dueAt).getTime() <= now.getTime();
}

/** Sweep old items — anything pending past +7d becomes `expired`, so the list never grows
 *  unbounded when the user ignores it. */
export function sweepShelf(items: readonly ShelfItem[], now: Date = new Date()): ShelfItem[] {
  const cutoff = now.getTime() - SWEEP_CUTOFF_DAYS * DAY_MS;
  return items.map((it) =>
    it.status === 'pending' && new Date(it.addedAt).getTime() < cutoff
      ? { ...it, status: 'expired' as const }
      : it,
  );
}

export function shelfBadgeCopy(item: ShelfItem, now: Date = new Date()): string {
  if (item.status === 'kept') return 'kept';
  if (item.status === 'let-go') return 'let go';
  if (item.status === 'expired') return 'faded';
  const msLeft = new Date(item.dueAt).getTime() - now.getTime();
  if (msLeft <= 0) return 'ready to re-see';
  const hoursLeft = Math.ceil(msLeft / 3_600_000);
  return hoursLeft > 1 ? `${hoursLeft}h to go` : 'under an hour';
}

// ---------------------------------------------------------------------------
// Provisional module-scoped store — see the STORE-SEAM DEVIATION note above.
// Same `useSyncExternalStore` pub/sub idiom as apps/mobile/src/folio/store.ts.
// ---------------------------------------------------------------------------

import { useSyncExternalStore } from 'react';

let shelfState: ShelfItem[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ShelfItem[] {
  return shelfState;
}

/** Reactive read of the shelf list — the thin hook ShelfSheet uses (mirrors useAppStore's shape). */
export function useShelf(): ShelfItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Add a want to the shelf; auto-resurfaces in 24h. Mirrors the real store's documented signature. */
export function addShelfItem(
  label: string,
  amount: number,
  verdictAtAdd?: ShelfItem['verdictAtAdd'],
): void {
  const item = makeShelfItem(label, amount, verdictAtAdd);
  shelfState = [item, ...shelfState].slice(0, MAX_SHELF_ITEMS);
  notify();
}

/** Resolve a shelf item — the user came back and decided. */
export function resolveShelfItem(id: string, status: 'kept' | 'let-go'): void {
  shelfState = shelfState.map((it) => (it.id === id ? { ...it, status } : it));
  notify();
}

/** Sweep expired items now (called on mount by ShelfSheet, mirrors the real store's sweep hook). */
export function sweepShelfNow(): void {
  const next = sweepShelf(shelfState);
  const changed = next.some((it, i) => it.status !== shelfState[i]?.status);
  if (changed) {
    shelfState = next;
    notify();
  }
}
