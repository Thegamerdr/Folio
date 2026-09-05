import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { delayUntilNextLocalDay } from './dayClock';

/**
 * Shared clock signal for Today, Plan and Calendar. It refreshes on mount, app foreground and local
 * midnight, allowing screens that stay mounted across a background/resume or day rollover to derive
 * a new payday window without requiring navigation/remounting.
 */
export function useDayClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;
    const schedule = () => {
      if (disposed) return;
      if (timer.current !== null) clearTimeout(timer.current);
      const current = new Date();
      setNow(current);
      timer.current = setTimeout(schedule, delayUntilNextLocalDay(current));
    };
    schedule();
    const onAppStateChange = (status: AppStateStatus) => {
      if (status === 'active') schedule();
    };
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => {
      disposed = true;
      if (timer.current !== null) clearTimeout(timer.current);
      subscription.remove();
    };
  }, []);

  return now;
}
