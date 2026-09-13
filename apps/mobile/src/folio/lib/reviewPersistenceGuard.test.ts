import { describe, expect, it } from 'vitest';

import { canRestoreReviewSnapshot } from './reviewPersistenceGuard';

describe('review persistence rollback guard', () => {
  it('rejects a same-workspace rollback after an unrelated mutation', () => {
    expect(
      canRestoreReviewSnapshot({
        currentWorkspaceId: 'personal',
        expectedWorkspaceId: 'personal',
        currentBlob: '{"transactions":["newer"]}',
        expectedAttemptBlob: '{"transactions":["review"]}',
      }),
    ).toBe(false);
  });

  it('rejects a rollback after switching workspaces even when blobs happen to match', () => {
    expect(
      canRestoreReviewSnapshot({
        currentWorkspaceId: 'business',
        expectedWorkspaceId: 'personal',
        currentBlob: '{"transactions":[]}',
        expectedAttemptBlob: '{"transactions":[]}',
      }),
    ).toBe(false);
  });

  it('allows restoring the exact captured attempt in the same workspace', () => {
    expect(
      canRestoreReviewSnapshot({
        currentWorkspaceId: 'personal',
        expectedWorkspaceId: 'personal',
        currentBlob: '{"transactions":["review"]}',
        expectedAttemptBlob: '{"transactions":["review"]}',
      }),
    ).toBe(true);
  });
});
