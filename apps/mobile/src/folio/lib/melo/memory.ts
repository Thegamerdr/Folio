import type { CycleRecord } from '../../store';
import type { TinyWin } from '../wins';
import { WIN_COPY } from '../wins';

export type MemoryEvent = Readonly<{
  id: string;
  at: string;
  kind: 'win' | 'cycle-green' | 'cycle-red';
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
    line: WIN_COPY[win.kind] ?? win.message,
  }));
  const cycleEvents: MemoryEvent[] = cycles.map((cycle) => {
    const green = cycle.tightPoint >= 0 && cycle.spare >= 0;
    return {
      id: `cycle-${cycle.closedAt}-${cycle.label}`,
      at: cycle.closedAt,
      kind: green ? 'cycle-green' : 'cycle-red',
      line: green
        ? `Closed ${cycle.label} in the safe zone.`
        : `Closed ${cycle.label} — tight, but closed.`,
    };
  });
  return [...winEvents, ...cycleEvents]
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, Math.max(0, limit));
}
