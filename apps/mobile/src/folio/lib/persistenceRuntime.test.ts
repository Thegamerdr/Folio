import { beforeEach, describe, expect, it } from 'vitest';

import {
  getPersistenceFailureStage,
  persistenceFailureStageOf,
  resetPersistenceRuntimeState,
  setPersistenceFailureStage,
} from './persistenceRuntime';

describe('persistence attempt failure stages', () => {
  beforeEach(() => resetPersistenceRuntimeState());

  it('uses the stage attached to the failed attempt rather than a later global diagnostic', () => {
    const error = new Error('manifest write failed');
    Object.defineProperty(error, 'persistenceStage', { value: 'workspace-manifest' });
    setPersistenceFailureStage('workspace-state');

    expect(getPersistenceFailureStage()).toBe('workspace-state');
    expect(persistenceFailureStageOf(error)).toBe('workspace-manifest');
    expect(persistenceFailureStageOf(new Error('unrelated attempt'))).toBe('none');
  });
});
