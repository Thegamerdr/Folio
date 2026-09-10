import type { CycleRecord } from '../../store';
import type { TinyWin } from '../wins';
import { tinyWinMessage } from '../wins';

export type MemoryEvent = Readonly<{
  id: string;
  at: string;
  kind: 'win' | 'cycle-review';
  line: string;
}>;

/** A read-only thread derived only from events Melo can prove from local state. */
export function deriveMeloMemory(
  tinyWins: readonly TinyWin[],
  cycles: readonly CycleRecord[],
  limit = 10,
): MemoryEvent[] {
  const winEvents: MemoryEvent[] = tinyWins.map((win) => ({
    id: `win-${win.id}`,
    at: win.awardedAt,
    kind: 'win',
    line: tinyWinMessage(win),
  }));
  // Existing cycle records contain forecast cash, not proof that a month or its bills were safe.
  // Derive neutral copy on every read, including restored records from older app versions.
  const cycleEvents: MemoryEvent[] = cycles
    .filter((cycle) => !cycle.reconstructed)
    .map((cycle) => ({
      id: `cycle-${cycle.closedAt}-${cycle.label}`,
      at: cycle.closedAt,
      kind: 'cycle-review',
      line: `Recorded ${cycle.label} review.`,
    }));
  return [...winEvents, ...cycleEvents]
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, Math.max(0, limit));
}

/** A date-only review has no known hour. Never turn its implied midnight into elapsed time. */
export function formatMeloMemoryTime(iso: string, now: Date): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const days = Math.round((today.getTime() - then) / 86_400_000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return new Date(then).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  const minutes = Math.max(0, Math.round((now.getTime() - then) / 60_000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}
