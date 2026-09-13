import { beforeEach, describe, expect, it } from 'vitest';

import {
  getPersistenceFailureStage,
  PersistenceAttemptError,
  persistenceFailureStageOf,
  resetPersistenceRuntimeState,
  setPersistenceFailureStage,
} from './persistenceRuntime';

describe('persistence attempt failure stages', () => {
  beforeEach(() => resetPersistenceRuntimeState());

  it('uses immutable attempt stages even for frozen or reused causes', () => {
    const error = Object.freeze(new Error('manifest write failed'));
    const first = new PersistenceAttemptError('workspace-manifest', error);
    const second = new PersistenceAttemptError('workspace-state', error);
    setPersistenceFailureStage('workspace-state');

    expect(getPersistenceFailureStage()).toBe('workspace-state');
    expect(persistenceFailureStageOf(first)).toBe('workspace-manifest');
    expect(persistenceFailureStageOf(second)).toBe('workspace-state');
    expect(first.cause).toBe(error);
    expect(Object.isFrozen(first)).toBe(true);
    expect(persistenceFailureStageOf(new Error('unrelated attempt'))).toBe('none');
  });
});
