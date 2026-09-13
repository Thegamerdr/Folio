import React, { useEffect, useState } from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = new Set<() => void>();
let sessions: any[] = [];
const state = { activeWorkspaceId: 'workspace-1', accounts: [], transactions: [], evidenceDocuments: [] };

vi.mock('react-native', () => {
  const el = (name: string) => (props: any) => React.createElement(name, props, props.children);
  return {
    AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
    Alert: { alert: vi.fn() },
    FlatList: (props: any) => React.createElement('FlatList', props, props.ListHeaderComponent, props.data.map((item: any) => props.renderItem({ item }))),
    Pressable: el('Pressable'),
    ScrollView: el('ScrollView'),
    StyleSheet: { create: (value: any) => value, hairlineWidth: 1 },
    Text: el('Text'),
    TextInput: el('TextInput'),
    View: el('View'),
    findNodeHandle: () => 1,
    useWindowDimensions: () => ({ fontScale: 1 }),
  };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@/folio/theme', () => ({
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { lg: 12, xl: 16 },
  serif: { display: 'serif' },
  Sheet: ({ children, header, footer }: any) => React.createElement('Sheet', null, header, children, footer),
  useTheme: () => ({ canvas: '#fff', surface: '#fff', inset: '#eee', hairline: '#ccc', ink: '#111', muted: '#777', calm: '#06c', calmSoft: '#def', inverse: '#fff', positiveInk: '#090', repairInk: '#900', repair: '#900' }),
}));
vi.mock('@/folio/melo/Melo', () => ({ Melo: () => React.createElement('Melo') }));
vi.mock('@/folio/screens/reviewFormat', () => ({ formatReviewDate: () => '1 Jan 2025' }));
vi.mock('@/folio/lib/detectAccountName', () => ({ detectAccountName: () => ({ name: '', kind: 'bank' }) }));
vi.mock('@/folio/lib/reviewPersistenceGuard', () => ({ canRestoreReviewSnapshot: () => true }));
vi.mock('@/folio/lib/persist', () => ({ persistCurrentStateNow: vi.fn(), quiescePersistenceWrites: vi.fn(async () => vi.fn()) }));
vi.mock('@/folio/lib/persistenceRuntime', () => ({ persistenceFailureStageOf: () => null }));
vi.mock('@/folio/lib/bulkLanding', () => ({
  acknowledgeStatementReviewSession: vi.fn(),
  nextBulkLandingOffer: () => null,
  statementReviewSessionWithReceipt: vi.fn((session: any, receipt: any) => ({ ...session, receipt })),
}));
vi.mock('@/folio/lib/statementReviewModel', () => ({
  statementReviewSourceKey: (items: any[]) => items.map((item) => item.id).join('|'),
  buildStatementReviewModel: (items: any[]) => ({ rows: items.map((candidate) => ({ candidate, status: 'ready', issue: null, duplicate: false })), counts: { total: items.length, ready: items.length, issues: 0, duplicates: 0, alreadyAdded: 0, transfers: 0, income: 0, bills: 0, debt: 0, uncertain: 0 }, moneyIn: 0, moneyOut: 0 }),
  filterStatementReviewRows: (rows: any[]) => rows,
}));
vi.mock('@/folio/store', () => ({
  DEFAULT_ACCOUNT_ID: 'default',
  addAccount: vi.fn(),
  addStatementAsHistory: vi.fn(),
  getPersistBlob: vi.fn(() => ''),
  getState: () => state,
  hydrateFromBlob: vi.fn(),
  importedTransactionId: (candidate: any) => candidate.id,
  removeStatementReviewSession: vi.fn((sourceKey: string) => { sessions = sessions.filter((session) => session.sourceKey !== sourceKey); }),
  setAccountBalance: vi.fn(),
  upsertStatementReviewSession: vi.fn((session: any) => { sessions = [session]; listeners.forEach((listener) => listener()); }),
  useAppStore: (selector: (value: typeof state) => unknown) => selector(state),
  useStatementReviewSessions: () => {
    const [, rerender] = useState(0);
    useEffect(() => { const notify = () => rerender((value) => value + 1); listeners.add(notify); return () => { listeners.delete(notify); }; }, []);
    return sessions;
  },
}));

import { BulkStatementLanding } from './BulkStatementLanding';

const candidate = { id: 'row-1', merchant: 'Shop', amount: 10, date: '2025-01-01', kind: 'spend', confidence: 'high', source: 'pdf' } as any;
const nav = { go: vi.fn() } as any;

describe('BulkStatementLanding mounted persistence regression', () => {
  beforeEach(() => { sessions = []; listeners.clear(); vi.clearAllMocks(); });

  it('settles when the reader omits sourceIssues', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(React.createElement(BulkStatementLanding, { nav, candidates: [candidate], onAdded: vi.fn() })); });
    expect(tree.root.findByProps({ accessibilityLabel: 'Back' })).toBeTruthy();
    expect(sessions).toHaveLength(1);
    act(() => tree.unmount());
  });

  it('settles when resuming a no-issue persisted session', () => {
    sessions = [{ sourceKey: 'row-1', candidates: [candidate], selectedIds: ['row-1'], asideIds: [], resolvedRepeatIds: [] }];
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(React.createElement(BulkStatementLanding, { nav, candidates: [candidate], sessionKey: 'row-1', onAdded: vi.fn() })); });
    expect(tree.root.findByProps({ accessibilityLabel: 'Back' })).toBeTruthy();
    expect(sessions).toHaveLength(1);
    act(() => tree.unmount());
  });

  it('acknowledges the immutable session source after corrected candidates are added', async () => {
    const bulkLanding = await import('@/folio/lib/bulkLanding');
    vi.mocked(bulkLanding.acknowledgeStatementReviewSession).mockReturnValue(null);
    sessions = [
      { sourceKey: 'corrected-source', candidates: [candidate], selectedIds: [], asideIds: [], resolvedRepeatIds: [], accountId: 'account-1', receipt: { added: 1, duplicatesSkipped: 0, failed: [], totalInPence: 1000, totalOutPence: 0, dateRange: null } },
      { sourceKey: 'other-source', candidates: [candidate], selectedIds: [], asideIds: [], resolvedRepeatIds: [] },
    ];
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(React.createElement(BulkStatementLanding, { nav, candidates: [candidate], sessionKey: 'corrected-source', onAdded: vi.fn() })); });
    const doneButton = tree.root.findAll((node) => (node.type as string) === 'Pressable').find((node) => node.findAll((child) => (child.type as string) === 'Text').some((text) => text.children.join(' ') === 'Done'))!;
    await act(async () => { doneButton.props.onPress(); await Promise.resolve(); });
    expect(vi.mocked((await import('@/folio/store')).removeStatementReviewSession)).toHaveBeenCalledWith('corrected-source', 'workspace-1');
    expect(sessions.map((session) => session.sourceKey)).toEqual(['other-source']);
    act(() => tree.unmount());
  });
});
