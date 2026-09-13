import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as any).requestAnimationFrame = (callback: () => void) => {
  callback();
  return 1;
};
(globalThis as any).cancelAnimationFrame = () => undefined;

const { state, scrollCalls, scrollOffsetCalls, a11y, overlay, t } = vi.hoisted(() => ({
  state: {
    activeWorkspaceId: 'personal',
    workspaces: [{ id: 'personal', kind: 'personal', name: 'Personal' }],
    reviewQueue: [],
    reviewQueueSpillover: [],
    ignoredReviewSigs: [],
    transactions: [],
    edits: [],
    timelineEvents: [],
    subs: [],
    mockHistory: [] as unknown[],
  },
  scrollCalls: [] as unknown[],
  scrollOffsetCalls: [] as unknown[],
  a11y: { announce: vi.fn(), focus: vi.fn() },
  overlay: { active: false },
  t: {
    canvas: '#fff',
    surface: '#fff',
    inset: '#eee',
    ink: '#111',
    muted: '#777',
    calm: '#a44',
    hairline: '#ccc',
  },
}));

vi.mock('react-native', async () => {
  const R = await import('react');
  const element = (name: string) => (props: any) => R.createElement(name, props, props.children);
  const view = R.forwardRef((props: any, ref: any) => {
    R.useImperativeHandle(ref, () => ({}));
    return R.createElement('View', props, props.children);
  });
  const scroll = R.forwardRef((props: any, ref: any) => {
    R.useImperativeHandle(ref, () => ({
      scrollTo: (value: unknown) => scrollCalls.push(value),
      scrollToOffset: (value: unknown) => scrollOffsetCalls.push(value),
    }));
    return R.createElement('ScrollView', props, props.children);
  });
  const flatList = R.forwardRef((props: any, ref: any) => {
    R.useImperativeHandle(ref, () => ({
      scrollToOffset: (value: unknown) => scrollOffsetCalls.push(value),
    }));
    const rows = R.Children.toArray(
      (props.data ?? []).map((item: unknown, index: number) => props.renderItem?.({ item, index })),
    );
    return R.createElement('ScrollView', props, rows);
  });
  return {
    AccessibilityInfo: {
      announceForAccessibility: a11y.announce,
      setAccessibilityFocus: a11y.focus,
    },
    FlatList: flatList,
    findNodeHandle: vi.fn(() => 1),
    Pressable: element('Pressable'),
    ScrollView: scroll,
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Text: element('Text'),
    View: view,
  };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('@/surfaces/pressureMap/Sheet', () => ({
  useSheetOverlayActive: () => overlay.active,
}));
vi.mock('react-native-svg', async () => {
  const R = await import('react');
  const element = (name: string) => (props: any) => R.createElement(name, props, props.children);
  return { default: element('Svg'), Path: element('Path') };
});
vi.mock('@/folio/theme', () => ({
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { md: 12 },
  serif: { display: 'serif', displayItalic: 'serif-italic' },
  useTheme: () => t,
}));
vi.mock('@/folio/store', () => ({
  useAppStore: (selector: (value: typeof state) => unknown) => selector(state),
  useStatementReviewSessions: () => (state as any).statementReviewSessions ?? [],
}));
vi.mock('@/folio/lib/caughtSubs', () => ({ useCaughtSubs: () => [null] }));
vi.mock('@/folio/screens/today/format', () => ({ formatGBP: (value: number) => `£${value}` }));
vi.mock('@/folio/screens/reviewFormat', () => ({ formatGBPExact: (value: number) => `£${value}` }));
vi.mock('@/folio/lib/reviewHistory', () => ({
  HISTORY_SCOPE: {
    activity: { title: 'What you added and corrected.', description: 'Activity', empty: 'Empty' },
    decisions: { title: 'Choices you confirmed.', description: 'Decisions', empty: 'Empty' },
  },
  buildDecisionHistoryRows: () => (state as any).mockHistory,
  historyDestination: (row: any, transactions: readonly { id: string }[]) =>
    row.transactionId && transactions.some((item) => item.id === row.transactionId)
      ? { kind: 'transaction', id: row.transactionId, label: 'View details and correct' }
      : null,
}));
vi.mock('@/folio/screens/ReviewScreen', () => ({
  ReviewScreen: (props: any) =>
    React.createElement(
      'ReviewScreen',
      props,
      props.embedded && !(state as any).reviewQueue?.length
        ? React.createElement('Pressable', {
            accessibilityRole: 'button',
            accessibilityLabel: 'Add a statement',
          })
        : null,
    ),
}));

import { ReviewHubScreen } from '@/folio/screens/ReviewHubScreen';

const nav = {
  go: vi.fn(),
  back: vi.fn(),
  openSheet: vi.fn(),
  openMelo: vi.fn(),
} as any;

function mountHub() {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(ReviewHubScreen, { nav }));
  });
  return tree;
}

function labelled(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root.findAll(
    (node) => typeof node.type === 'string' && node.props.accessibilityLabel === label,
  );
}

function hosts(tree: renderer.ReactTestRenderer, type: string) {
  return tree.root.findAll((node) => node.type === type);
}

describe('MF12 ReviewHub mounted composition', () => {
  beforeEach(() => {
    scrollCalls.length = 0;
    scrollOffsetCalls.length = 0;
    nav.go.mockReset();
    nav.openMelo.mockReset();
    a11y.announce.mockReset();
    a11y.focus.mockReset();
    overlay.active = false;
    (state as any).reviewQueue = [];
    (state as any).statementReviewSessions = [];
    (state as any).transactions = [];
    (state as any).mockHistory = [];
  });

  it('mounts the true empty doorway and keeps the embedded Review surface on the parent owner', () => {
    const tree = mountHub();
    expect(hosts(tree, 'ReviewScreen')).toHaveLength(1);
    expect(hosts(tree, 'ReviewScreen')[0]!.props.embeddedScrollOwner).toBe(true);
    expect(hosts(tree, 'ScrollView')).toHaveLength(2);
    expect(labelled(tree, 'Add a statement')).toHaveLength(1);
  });

  it('mounts the warranted notice and source action without hiding waiting state', () => {
    (state as any).statementReviewSessions = [
      {
        workspaceId: 'personal',
        sourceKey: 'paste:one',
        sourceLabel: 'Pasted transactions',
        candidates: [{ source: 'paste' }],
      },
    ];
    const tree = mountHub();
    expect(labelled(tree, "Open what's waiting")).toHaveLength(1);
    act(() => labelled(tree, "Open what's waiting")[0]!.props.onPress());
    expect(nav.go).not.toHaveBeenCalled();
    act(() =>
      labelled(tree, 'Pasted transactions. 1 suggested · not added yet')[0]!.props.onPress(),
    );
    expect(nav.go).toHaveBeenCalledWith('paste-success', { reviewSourceKey: 'paste:one' });
    expect(hosts(tree, 'ReviewScreen')).toHaveLength(0);
  });

  it('keeps a receipt-only source session visible instead of showing the empty doorway', () => {
    (state as any).statementReviewSessions = [
      {
        workspaceId: 'personal',
        sourceKey: 'paste:receipt-only',
        sourceLabel: 'Statement PDF',
        candidates: [],
        receipt: { result: 'saved' },
      },
    ];
    const tree = mountHub();
    expect(labelled(tree, 'Statement PDF. 0 suggested · result not seen yet')).toHaveLength(1);
    expect(hosts(tree, 'ReviewScreen')).toHaveLength(0);
    act(() =>
      labelled(tree, 'Statement PDF. 0 suggested · result not seen yet')[0]!.props.onPress(),
    );
    expect(nav.go).toHaveBeenCalledWith('paste-success', { reviewSourceKey: 'paste:receipt-only' });
  });

  it('retains independent Activity and Decisions scroll offsets across tab changes', () => {
    const tree = mountHub();
    const tabs = tree.root.findAll(
      (node) => typeof node.type === 'string' && node.props.accessibilityRole === 'tab',
    );
    const activity = tabs.find((node) => node.props.accessibilityLabel === 'Activity')!;
    act(() => activity.props.onPress());
    const lists = tree.root.findAll((node) => node.type === 'ScrollView');
    const history = lists[1]!;
    act(() => history.props.onScroll?.({ nativeEvent: { contentOffset: { y: 73 } } }));
    const decisions = tabs.find((node) => node.props.accessibilityLabel === 'Decisions')!;
    act(() => decisions.props.onPress());
    const activityAgain = tabs.find((node) => node.props.accessibilityLabel === 'Activity')!;
    act(() => activityAgain.props.onPress());
    expect(scrollOffsetCalls).toContainEqual({ offset: 73, animated: false });
  });

  it('returns focus to the originating history row after its edit sheet closes', () => {
    (state as any).transactions = [{ id: 'tx-1' }];
    (state as any).mockHistory = [
      {
        id: 'added:tx-1',
        at: '2026-06-24T12:00:00.000Z',
        kind: 'added',
        title: 'Coffee shop',
        transactionId: 'tx-1',
        amount: -3.2,
      },
    ];
    const tree = mountHub();
    const activity = tree.root
      .findAll((node) => typeof node.type === 'string' && node.props.accessibilityRole === 'tab')
      .find((node) => node.props.accessibilityLabel === 'Activity')!;
    act(() => activity.props.onPress());
    const action = labelled(tree, 'View details and correct')[0]!;
    act(() => action.props.onPress());
    expect(nav.openSheet).toHaveBeenCalledWith('edit-txn', { id: 'tx-1' });
    act(() => {
      overlay.active = true;
      tree.update(React.createElement(ReviewHubScreen, { nav }));
    });
    act(() => {
      overlay.active = false;
      tree.update(React.createElement(ReviewHubScreen, { nav }));
    });
    expect(a11y.focus).toHaveBeenCalledWith(1);
  });
});
