import { describe, expect, it } from 'vitest';

import {
  canNavigateWorkspaceBack,
  createWorkspaceNavigation,
  currentWorkspaceScreen,
  navigateWorkspace,
  navigateWorkspaceBack,
  selectWorkspaceTab,
} from './workspaceNavigation';

describe('workspace navigation state', () => {
  it('remembers an independent nested destination in every Personal tab', () => {
    let state = createWorkspaceNavigation('personal', 'today');
    state = navigateWorkspace(state, 'calendar');
    state = navigateWorkspace(state, 'subs');
    state = navigateWorkspace(state, 'timeline');
    state = navigateWorkspace(state, 'privacy');

    expect(currentWorkspaceScreen(selectWorkspaceTab(state, 'today'))).toBe('today');
    expect(currentWorkspaceScreen(selectWorkspaceTab(state, 'plan'))).toBe('subs');
    expect(currentWorkspaceScreen(selectWorkspaceTab(state, 'review'))).toBe('timeline');
    expect(currentWorkspaceScreen(selectWorkspaceTab(state, 'more'))).toBe('privacy');
  });

  it('does not let setup and intake routes replace the remembered More destination', () => {
    let state = createWorkspaceNavigation('personal', 'today');
    state = navigateWorkspace(state, 'privacy');
    state = navigateWorkspace(state, 'intake');
    state = navigateWorkspace(state, 'pdf-success');

    expect(currentWorkspaceScreen(state)).toBe('pdf-success');
    state = navigateWorkspaceBack(state);
    expect(currentWorkspaceScreen(state)).toBe('intake');
    state = navigateWorkspaceBack(state);
    expect(currentWorkspaceScreen(state)).toBe('privacy');
    expect(currentWorkspaceScreen(selectWorkspaceTab(state, 'more'))).toBe('privacy');
  });

  it('starts unfinished onboarding as a transient route and does not reopen it from More', () => {
    let state = createWorkspaceNavigation('personal', 'start');
    expect(currentWorkspaceScreen(state)).toBe('start');
    state = navigateWorkspace(state, 'first-answer');
    expect(canNavigateWorkspaceBack(state)).toBe(true);
    state = navigateWorkspace(state, 'today');

    expect(currentWorkspaceScreen(state)).toBe('today');
    expect(currentWorkspaceScreen(selectWorkspaceTab(state, 'more'))).toBe('more');
  });

  it('restores Business Money and Review independently and maps Review to the real shared id', () => {
    let state = createWorkspaceNavigation('business', 'today');
    state = navigateWorkspace(state, 'business-runway');
    state = navigateWorkspace(state, 'timeline');
    state = navigateWorkspace(state, 'business-filings');

    expect(currentWorkspaceScreen(selectWorkspaceTab(state, 'money'))).toBe('business-runway');
    expect(currentWorkspaceScreen(selectWorkspaceTab(state, 'review'))).toBe('timeline');
    expect(currentWorkspaceScreen(selectWorkspaceTab(state, 'more'))).toBe('business-filings');
  });

  it('backs within the active tab, then returns to Today without destroying other tab state', () => {
    let state = createWorkspaceNavigation('personal', 'today');
    state = navigateWorkspace(state, 'plans');
    state = navigateWorkspace(state, 'calendar');
    state = navigateWorkspaceBack(state);
    expect(currentWorkspaceScreen(state)).toBe('plans');
    state = navigateWorkspaceBack(state);
    expect(currentWorkspaceScreen(state)).toBe('today');

    state = selectWorkspaceTab(state, 'plan');
    expect(currentWorkspaceScreen(state)).toBe('plans');
  });

  it('does not duplicate a route when the same destination is selected repeatedly', () => {
    let state = createWorkspaceNavigation('personal', 'today');
    state = navigateWorkspace(state, 'calendar');
    const once = state;
    state = navigateWorkspace(state, 'calendar');
    expect(state).toBe(once);
  });
});
