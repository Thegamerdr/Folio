import type { ScreenId } from '@/folio/types';

import {
  isPersonalTransientScreen,
  personalTabForScreen,
  screenForPersonalTab,
  type PersonalPrimaryTab,
} from './personalNavigation';
import {
  businessTabForScreen,
  screenForBusinessTab,
  type BusinessPrimaryTab,
} from './businessNavigation';

export type NavigationWorkspaceKind = 'personal' | 'business';
export type WorkspacePrimaryTab = PersonalPrimaryTab | BusinessPrimaryTab;

export type WorkspaceNavigationState = Readonly<{
  kind: NavigationWorkspaceKind;
  activeTab: WorkspacePrimaryTab;
  /** Independent route stacks are what let every tab remember its own nested destination. */
  tabStacks: Readonly<Record<string, readonly ScreenId[]>>;
  /** Full-focus setup/import routes have an explicit origin but never replace a tab's memory. */
  transientStack: readonly ScreenId[] | null;
}>;

function rootScreens(kind: NavigationWorkspaceKind): Readonly<Record<string, ScreenId>> {
  return kind === 'business'
    ? {
        today: screenForBusinessTab('today'),
        money: screenForBusinessTab('money'),
        review: screenForBusinessTab('review'),
        more: screenForBusinessTab('more'),
      }
    : {
        today: screenForPersonalTab('today'),
        plan: screenForPersonalTab('plan'),
        review: screenForPersonalTab('review'),
        more: screenForPersonalTab('more'),
      };
}

function tabForScreen(kind: NavigationWorkspaceKind, screen: ScreenId): WorkspacePrimaryTab {
  return kind === 'business' ? businessTabForScreen(screen) : personalTabForScreen(screen);
}

function isTransient(kind: NavigationWorkspaceKind, screen: ScreenId): boolean {
  return kind === 'personal' && isPersonalTransientScreen(screen);
}

function appendRoute(stack: readonly ScreenId[], screen: ScreenId): readonly ScreenId[] {
  return stack[stack.length - 1] === screen ? stack : [...stack, screen];
}

export function createWorkspaceNavigation(
  kind: NavigationWorkspaceKind,
  initialScreen?: ScreenId,
): WorkspaceNavigationState {
  const roots = rootScreens(kind);
  const tabStacks = Object.fromEntries(
    Object.entries(roots).map(([tab, screen]) => [tab, [screen] as readonly ScreenId[]]),
  );
  const startingScreen = initialScreen ?? roots.today ?? 'today';

  if (isTransient(kind, startingScreen)) {
    return {
      kind,
      activeTab: 'today',
      tabStacks,
      transientStack: [startingScreen],
    };
  }

  const activeTab = tabForScreen(kind, startingScreen);
  return {
    kind,
    activeTab,
    tabStacks: {
      ...tabStacks,
      [activeTab]: appendRoute(tabStacks[activeTab] ?? [], startingScreen),
    },
    transientStack: null,
  };
}

export function currentWorkspaceScreen(state: WorkspaceNavigationState): ScreenId {
  const transient = state.transientStack;
  if (transient !== null && transient.length > 0) {
    return transient[transient.length - 1]!;
  }
  return state.tabStacks[state.activeTab]?.at(-1) ?? rootScreens(state.kind).today ?? 'today';
}

export function navigateWorkspace(
  state: WorkspaceNavigationState,
  screen: ScreenId,
): WorkspaceNavigationState {
  if (screen === currentWorkspaceScreen(state)) return state;

  if (isTransient(state.kind, screen)) {
    const origin = currentWorkspaceScreen(state);
    return {
      ...state,
      transientStack:
        state.transientStack === null
          ? [origin, screen]
          : appendRoute(state.transientStack, screen),
    };
  }

  const activeTab = tabForScreen(state.kind, screen);
  const stack = state.tabStacks[activeTab] ?? [rootScreens(state.kind)[activeTab] ?? screen];
  return {
    ...state,
    activeTab,
    tabStacks: { ...state.tabStacks, [activeTab]: appendRoute(stack, screen) },
    transientStack: null,
  };
}

export function selectWorkspaceTab(
  state: WorkspaceNavigationState,
  tab: WorkspacePrimaryTab,
): WorkspaceNavigationState {
  const roots = rootScreens(state.kind);
  if (!(tab in roots)) return state;
  return {
    ...state,
    activeTab: tab,
    tabStacks: {
      ...state.tabStacks,
      [tab]: state.tabStacks[tab] ?? [roots[tab]!],
    },
    transientStack: null,
  };
}

export function canNavigateWorkspaceBack(state: WorkspaceNavigationState): boolean {
  if (state.transientStack !== null) return state.transientStack.length > 1;
  const stack = state.tabStacks[state.activeTab] ?? [];
  return stack.length > 1 || state.activeTab !== 'today';
}

export function navigateWorkspaceBack(state: WorkspaceNavigationState): WorkspaceNavigationState {
  if (state.transientStack !== null) {
    if (state.transientStack.length <= 1) return state;
    const nextTransient = state.transientStack.slice(0, -1);
    const destination = nextTransient[nextTransient.length - 1]!;
    return {
      ...state,
      transientStack: isTransient(state.kind, destination) ? nextTransient : null,
    };
  }

  const stack = state.tabStacks[state.activeTab] ?? [];
  if (stack.length > 1) {
    return {
      ...state,
      tabStacks: { ...state.tabStacks, [state.activeTab]: stack.slice(0, -1) },
    };
  }

  if (state.activeTab !== 'today') {
    return selectWorkspaceTab(state, 'today');
  }
  return state;
}
