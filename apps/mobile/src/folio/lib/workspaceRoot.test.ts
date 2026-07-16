import { evaluateWorkspaceSwitcher } from '@folio/business-workspace';
import { describe, expect, it } from 'vitest';

import {
  createPersonalWorkspaceRoot,
  normalisePersonalWorkspaceRoot,
  PERSONAL_WORKSPACE_ID,
  PERSONAL_WORKSPACE_SUBKEY_ID,
  requireWorkspaceData,
  toWorkspaceSummary,
} from './workspaceRoot';

describe('production mobile workspace root', () => {
  it('creates one immutable Personal data partition with its own subkey identifier', () => {
    const root = createPersonalWorkspaceRoot();

    expect(root).toMatchObject({
      activeWorkspaceId: PERSONAL_WORKSPACE_ID,
      dataWorkspaceId: PERSONAL_WORKSPACE_ID,
    });
    expect(root.workspaces).toEqual([
      expect.objectContaining({
        id: PERSONAL_WORKSPACE_ID,
        kind: 'personal',
        name: 'Personal',
        baseCurrency: 'GBP',
        jurisdiction: 'GB',
        timeZone: 'Europe/London',
        encryptedSubkeyId: PERSONAL_WORKSPACE_SUBKEY_ID,
        archivedAt: null,
      }),
    ]);
  });

  it('connects the production root to the existing Business switcher contract without inventing a Business workspace', () => {
    const root = createPersonalWorkspaceRoot();
    const state = evaluateWorkspaceSwitcher({
      workspaces: root.workspaces.map(toWorkspaceSummary),
      activeWorkspaceId: root.activeWorkspaceId,
      persistentTextLabelVisible: true,
      iconOrSymbolVisible: true,
      distinctNavigationLabels: true,
      screenReaderLabelIncludesWorkspace: true,
      largeTextDoesNotTruncateWorkspace: true,
      businessCreationShownDuringPersonalOnboarding: false,
      optionalCreationAvailable: true,
    });

    expect(state.activeWorkspace.label).toBe('Personal');
    expect(state.businessWorkspaceCount).toBe(0);
    expect(state.personalDefaultPreserved).toBe(true);
    expect(state.optionalAndNonCoercive).toBe(true);
  });

  it('fails closed when a crafted blob tries to activate an unisolated Business workspace', () => {
    const personal = createPersonalWorkspaceRoot().workspaces[0]!;
    const root = normalisePersonalWorkspaceRoot({
      workspaces: [
        personal,
        {
          ...personal,
          id: 'workspace_business_injected',
          kind: 'business',
          name: 'Injected Ltd',
          encryptedSubkeyId: 'workspace-subkey-business-injected',
        },
      ],
      activeWorkspaceId: 'workspace_business_injected',
      dataWorkspaceId: 'workspace_business_injected',
    });

    expect(root.workspaces).toEqual([personal]);
    expect(root.activeWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(root.dataWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
  });

  it('repairs corrupt Personal metadata instead of trusting it', () => {
    const root = normalisePersonalWorkspaceRoot({
      workspaces: [
        {
          id: PERSONAL_WORKSPACE_ID,
          kind: 'personal',
          name: 'Business disguised as Personal',
          encryptedSubkeyId: 'shared-key',
        },
      ],
      activeWorkspaceId: PERSONAL_WORKSPACE_ID,
      dataWorkspaceId: PERSONAL_WORKSPACE_ID,
    });

    expect(root.workspaces[0]).toMatchObject({
      id: PERSONAL_WORKSPACE_ID,
      kind: 'personal',
      name: 'Personal',
      encryptedSubkeyId: PERSONAL_WORKSPACE_SUBKEY_ID,
      archivedAt: null,
    });
  });

  it('guards data reads at the partition boundary instead of filtering a global array', () => {
    const root = createPersonalWorkspaceRoot();
    const state = { ...root, transactions: [{ id: 'personal-row' }] };

    expect(requireWorkspaceData(state, PERSONAL_WORKSPACE_ID)).toBe(state);
    expect(() => requireWorkspaceData(state, 'workspace_business_injected')).toThrow(/unavailable/);
    expect(() =>
      requireWorkspaceData(
        {
          ...state,
          activeWorkspaceId: 'workspace_business_injected' as typeof PERSONAL_WORKSPACE_ID,
        },
        PERSONAL_WORKSPACE_ID,
      ),
    ).toThrow(/not the active workspace/);
  });
});
