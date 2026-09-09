import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDayKey } from './dayClock';

const mounted = vi.hoisted(() => ({
  setNow: vi.fn<(now: Date) => void>(),
  cleanup: null as (() => void) | null,
  onAppState: null as ((status: string) => void) | null,
  remove: vi.fn(),
}));

vi.mock('react', () => ({
  useState: () => [null, mounted.setNow],
  useRef: () => ({ current: null }),
  useEffect: (effect: () => () => void) => {
    mounted.cleanup = effect();
  },
}));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, callback: (status: string) => void) => {
      mounted.onAppState = callback;
      return { remove: mounted.remove };
    },
  },
}));

import { useDayClock } from './useDayClock';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mounted.cleanup = null;
  mounted.onAppState = null;
});

afterEach(() => {
  mounted.cleanup?.();
  vi.useRealTimers();
});

function latestDay(): string {
  return localDayKey(mounted.setNow.mock.calls.at(-1)![0]);
}

describe('mounted financial screen day clock', () => {
  it('refreshes at local midnight across payday without a remount or store mutation', () => {
    vi.setSystemTime(new Date(2026, 8, 27, 23, 59, 59, 500));
    useDayClock();
    expect(latestDay()).toBe('2026-09-27');
    vi.advanceTimersByTime(500);
    expect(latestDay()).toBe('2026-09-28');
    expect(mounted.setNow).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('refreshes immediately after a background date change and reschedules midnight', () => {
    vi.setSystemTime(new Date(2026, 8, 12, 9));
    useDayClock();
    mounted.onAppState?.('background');
    vi.setSystemTime(new Date(2026, 8, 13, 23, 59, 59));
    expect(latestDay()).toBe('2026-09-12');
    mounted.onAppState?.('active');
    expect(latestDay()).toBe('2026-09-13');
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(latestDay()).toBe('2026-09-14');
  });

  it('removes the foreground listener and timer when the financial screen unmounts', () => {
    vi.setSystemTime(new Date(2026, 8, 28, 9));
    useDayClock();
    mounted.cleanup?.();
    expect(mounted.remove).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    mounted.onAppState?.('active');
    expect(mounted.setNow).toHaveBeenCalledOnce();
    mounted.cleanup = null;
  });
});
