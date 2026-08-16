import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ENV_KEY = 'EXPO_PUBLIC_MELO_BUSINESS_BETA';
const originalFlag = process.env[ENV_KEY];
const mockExtra = vi.hoisted(() => ({}) as Record<string, unknown>);

const mocks = vi.hoisted(() => ({
  state: {
    workspaces: [] as Array<Record<string, unknown>>,
    activeWorkspaceId: 'workspace_personal_local',
  },
  archive: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  restore: vi.fn(),
  switchWorkspace: vi.fn(),
}));

vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: mockExtra } } }));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const host = (name: string) =>
    function Host({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) {
      return ReactModule.createElement(name, props, children);
    };

  return {
    Alert: { alert: vi.fn() },
    Pressable: host('Pressable'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
    Text: host('Text'),
    TextInput: host('TextInput'),
    View: host('View'),
  };
});

vi.mock('@/folio/theme', async () => {
  const ReactModule = await import('react');
  return {
    gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radius: { md: 8, lg: 12 },
    serif: { display: 'display', displayItalic: 'displayItalic', medium: 'medium' },
    Sheet: ({ children }: React.PropsWithChildren) =>
      ReactModule.createElement('Sheet', null, children),
    useTheme: () =>
      new Proxy({}, { get: (_target, property) => String(property) }) as Record<string, string>,
  };
});

vi.mock('@/folio/store', () => ({
  useAppStore: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));
vi.mock('@/folio/lib/businessBeta', async () => import('../lib/businessBeta'));
vi.mock('@/folio/lib/persist', () => ({
  archivePersistedBusinessWorkspace: mocks.archive,
  createAndActivatePersistedBusinessWorkspace: mocks.create,
  renamePersistedBusinessWorkspace: mocks.rename,
  restorePersistedBusinessWorkspace: mocks.restore,
  switchPersistedWorkspace: mocks.switchWorkspace,
}));
vi.mock('@/folio/lib/workspaceRoot', () => ({
  PERSONAL_WORKSPACE_ID: 'workspace_personal_local',
}));

import { WorkspaceSheet } from './WorkspaceSheet';

const personal = {
  id: 'workspace_personal_local',
  kind: 'personal',
  name: 'Personal',
  archivedAt: null,
};
const business = {
  id: 'workspace_business_studio',
  kind: 'business',
  name: 'Studio',
  archivedAt: null,
};

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
}

function findButton(root: ReactTestInstance, label: string): ReactTestInstance | undefined {
  return root
    .findAll(
      (node) => String(node.type) === 'Pressable' && typeof node.props.onPress === 'function',
    )
    .find((node) => textOf(node).includes(label));
}

async function renderSheet(): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = TestRenderer.create(
      <WorkspaceSheet visible onActivated={vi.fn()} onClose={vi.fn()} />,
    );
  });
  if (!renderer) throw new Error('WorkspaceSheet did not render.');
  return renderer;
}

async function unmount(renderer: ReactTestRenderer): Promise<void> {
  await act(async () => renderer.unmount());
}

describe('WorkspaceSheet business beta gate', () => {
  beforeEach(() => {
    delete process.env[ENV_KEY];
    delete mockExtra[ENV_KEY];
    mocks.state.workspaces = [personal];
    mocks.state.activeWorkspaceId = personal.id;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalFlag;
    }
  });

  it('hides Business creation for absent, false, or malformed values', async () => {
    for (const value of [undefined, 'false', 'TRUE', 'yes', '1', '']) {
      if (value === undefined) delete process.env[ENV_KEY];
      else process.env[ENV_KEY] = value;
      const disabled = await renderSheet();
      expect(findButton(disabled.root, 'Add a business workspace')).toBeUndefined();
      await unmount(disabled);
    }
  });

  it('shows Business creation for the exact enabled value', async () => {
    process.env[ENV_KEY] = 'true';
    const enabled = await renderSheet();
    expect(findButton(enabled.root, 'Add a business workspace')).toBeDefined();
    await unmount(enabled);
  });

  it('keeps existing Business rename and archive actions available while creation is disabled', async () => {
    mocks.state.workspaces = [personal, business];
    mocks.state.activeWorkspaceId = business.id;
    const renderer = await renderSheet();

    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Studio, business workspace' }),
    ).toBeDefined();
    expect(findButton(renderer.root, 'Rename')).toBeDefined();
    expect(findButton(renderer.root, 'Archive')).toBeDefined();
    expect(findButton(renderer.root, 'Add a business workspace')).toBeUndefined();
    await unmount(renderer);
  });

  it('keeps restore available for an archived Business workspace', async () => {
    mocks.state.workspaces = [personal, { ...business, archivedAt: '2026-08-16T12:00:00.000Z' }];
    const renderer = await renderSheet();

    expect(findButton(renderer.root, 'Restore workspace')).toBeDefined();
    await unmount(renderer);
  });

  it('refuses a stale create screen if exposure is disabled before save', async () => {
    process.env[ENV_KEY] = 'true';
    const renderer = await renderSheet();
    await act(async () => {
      findButton(renderer.root, 'Add a business workspace')?.props.onPress();
    });

    process.env[ENV_KEY] = 'false';
    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Business workspace name' })
        .props.onChangeText('Studio');
    });
    await act(async () => {
      findButton(renderer.root, 'Create empty workspace')?.props.onPress();
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(textOf(renderer.root)).toContain(
      'Business workspace creation is not available in this build.',
    );
    expect(textOf(renderer.root)).toContain('Personal and business stay apart.');
    await unmount(renderer);
  });
});
