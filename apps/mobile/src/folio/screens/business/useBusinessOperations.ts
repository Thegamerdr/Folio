import { useMemo } from 'react';
import {
  emptyBusinessOperationsState,
  normaliseBusinessOperationsState,
} from '@folio/business-workspace';

import { useAppStore } from '@/folio/store';

export function useBusinessOperations() {
  const stored = useAppStore((state) => state.business);
  return useMemo(
    () => normaliseBusinessOperationsState(stored ?? emptyBusinessOperationsState()),
    [stored],
  );
}
