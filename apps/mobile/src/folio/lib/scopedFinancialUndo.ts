import { getFinancialResetGeneration, getState, setPartial, type AppState } from '../store';

/** Capture immediately after a save. Undo restores only its fields in the same unchanged profile. */
export function createScopedFinancialUndo(before: AppState, keys: readonly (keyof AppState)[]) {
  const after = getState();
  const generation = getFinancialResetGeneration();
  const pick = (state: AppState): Partial<AppState> =>
    Object.fromEntries(keys.map((key) => [key, state[key]]));
  const expected = JSON.stringify(pick(after));
  const restore = pick(before);
  let used = false;
  return (): boolean => {
    const current = getState();
    if (
      used ||
      generation !== getFinancialResetGeneration() ||
      before.activeWorkspaceId !== after.activeWorkspaceId ||
      current.activeWorkspaceId !== after.activeWorkspaceId ||
      JSON.stringify(pick(current)) !== expected
    )
      return false;
    used = true;
    setPartial(restore);
    return true;
  };
}
