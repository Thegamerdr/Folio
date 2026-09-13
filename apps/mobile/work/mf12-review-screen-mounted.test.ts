import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

(globalThis as any).__DEV__ = false;
(globalThis as any).requestAnimationFrame = (callback: () => void) => {
  callback();
  return 1;
};
(globalThis as any).cancelAnimationFrame = () => undefined;

const { dimensions, t, state, focusedInput } = vi.hoisted(() => ({
  dimensions: { height: 800, width: 390, fontScale: 1 },
  focusedInput: {
    measureInWindow: (receive: (x: number, y: number, width: number, height: number) => void) =>
      receive(0, 560, 100, 80),
  },
  t: {
    canvas: '#fff',
    surface: '#fff',
    inset: '#eee',
    ink: '#111',
    muted: '#777',
    calm: '#a44',
    calmSoft: '#f4e8e0',
    inverse: '#fff',
    hairline: '#ccc',
    positive: '#284',
    caution: '#a70',
  },
  state: {
    activeWorkspaceId: 'personal',
    workspaces: [{ id: 'personal', kind: 'personal', name: 'Personal' }],
    reviewQueue: [],
    transactions: [],
    evidenceDocuments: [],
    ignoredReviewSigs: [],
    subs: [],
    edits: [],
    timelineEvents: [],
    incomeSources: [],
    debts: [],
    accounts: [],
    pots: [],
  },
}));

vi.mock('react-native', async () => {
  const R = await import('react');
  const element = (name: string) => (props: any) => R.createElement(name, props, props.children);
  const scroll = R.forwardRef((props: any, ref: any) => {
    R.useImperativeHandle(ref, () => ({
      getNativeScrollRef: () => ({ measureInWindow: () => undefined }),
      scrollTo: vi.fn(),
    }));
    return R.createElement('ScrollView', props, props.children);
  });
  const textInput = Object.assign(element('TextInput'), {
    State: {
      currentlyFocusedInput: () => focusedInput,
    },
  });
  return {
    AccessibilityInfo: {
      isReduceMotionEnabled: vi.fn(async () => false),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Pressable: element('Pressable'),
    ScrollView: scroll,
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Text: element('Text'),
    TextInput: textInput,
    View: element('View'),
    useWindowDimensions: () => dimensions,
  };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('expo-modules-core', () => ({
  EventEmitter: class {},
  NativeModulesProxy: {},
  requireNativeModule: () => ({}),
}));
vi.mock('react-native-svg', async () => {
  const R = await import('react');
  const element = (name: string) => (props: any) => R.createElement(name, props, props.children);
  return { default: element('Svg'), Path: element('Path') };
});
vi.mock('react-native-reanimated', async () => {
  const R = await import('react');
  const View = (props: any) => R.createElement('Animated.View', props, props.children);
  return {
    default: { View },
    Easing: { bezier: () => undefined },
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useSharedValue: (value: number) => ({ value }),
    withSequence: (...values: unknown[]) => values.at(-1),
    withTiming: (value: unknown) => value,
  };
});
vi.mock('@/folio/theme', () => ({
  elevation: { card: {} },
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { md: 12, lg: 16, xl: 24, pill: 999 },
  serif: { display: 'serif', displayItalic: 'serif-italic' },
  useCountUp: (value: number) => value,
  useTheme: () => t,
}));
vi.mock('@/folio/melo/MeloScrollView', async () => {
  const R = await import('react');
  const Scroll = R.forwardRef((props: any, ref: any) => {
    R.useImperativeHandle(ref, () => ({ getNativeScrollRef: () => null, scrollTo: vi.fn() }));
    return R.createElement('ScrollView', props, props.children);
  });
  return { MeloScrollView: Scroll };
});
vi.mock('@/folio/melo/MeloExclusion', async () => {
  const R = await import('react');
  const element = (name: string) => (props: any) => R.createElement(name, props, props.children);
  return { MeloProtectedText: element('Text'), MeloProtectedPressable: element('Pressable') };
});
vi.mock('@/folio/ui/MeloPerch', () => ({ MeloPerch: () => null }));
vi.mock('@/folio/melo/MeloFigure', () => ({
  MeloFigure: (props: any) => React.createElement('MeloFigure', props),
}));
vi.mock('@/folio/melo/MeloLine', () => ({
  MeloLine: (props: any) => React.createElement('MeloLine', props),
}));
vi.mock('@/folio/melo/Melo', () => ({ Melo: () => React.createElement('Melo') }));
vi.mock('@/folio/melo/MeloAtlas', () => ({ getMeloClip: () => null }));
vi.mock('@/folio/melo/MeloPresenceLayer', () => ({ useMeloPresenceLayer: () => null }));
vi.mock('@/folio/melo/MeloVisibility', () => ({
  MeloSuppressedContext: React.createContext(false),
}));
vi.mock('@/folio/copy/copy', () => ({
  copy: { add: { review: { remembered: 'Remembered', forget: 'Forget' } } },
}));
vi.mock('@/folio/store', () => ({
  addIgnoredBankExternalId: vi.fn(),
  addIgnoredReviewSig: vi.fn(),
  addTransaction: vi.fn(),
  forgetMerchantCategory: vi.fn(),
  getState: () => state,
  resolveReviewItem: vi.fn(),
  reviewCandidateSig: vi.fn(() => 'sig'),
  rememberMerchantCategory: vi.fn(),
  useAppStore: (selector: (value: typeof state) => unknown) => selector(state),
}));
vi.mock('@/folio/lib/reviewDedupe', () => ({
  reviewDateToIso: () => null,
  reviewMatch: () => null,
  reviewMatchSubline: () => '',
}));
vi.mock('@/folio/lib/caughtIncome', () => ({ findCaughtIncome: () => [] }));
vi.mock('@/folio/lib/caughtBills', () => ({ findCaughtBills: () => [] }));
vi.mock('@/folio/lib/caughtDrift', () => ({ findDriftCandidates: () => [] }));
vi.mock('@/folio/lib/caughtAnnual', () => ({ findCaughtAnnual: () => [] }));
vi.mock('@/folio/lib/storeRoute', () => ({ isOverspentLanding: () => false }));
vi.mock('@/folio/lib/documentVault', () => ({ openEvidenceDocument: vi.fn() }));
vi.mock('@/folio/ui/statusDialogs', () => ({ showStatusDialog: vi.fn() }));
vi.mock('@/folio/screens/today/format', () => ({ formatGBP: (value: number) => `£${value}` }));
vi.mock('@/folio/screens/reviewFormat', () => ({
  formatEditableAmount: (value: number) => String(value),
}));
vi.mock('@/folio/lib/financialPlan', () => ({
  buildFinancialPlanFromState: () => ({ currentBalanceMinor: 0 }),
}));
vi.mock('@/folio/screens/reviewHistoryPresentation', () => ({
  reviewHistoryPresentation: () => ({
    entry: '£0 spend',
    cash: '£0',
    detail: 'Tracked cash stays £0.',
  }),
}));
vi.mock('@/surfaces/pressureMap/sheetGeometry', () => ({
  resolveSheetFocusedScroll: ({ scrollY, inputTop, inputHeight, bodyTop, bodyHeight }: any) =>
    Math.max(0, scrollY + inputTop + inputHeight - (bodyTop + bodyHeight - 8)),
}));
vi.mock('@/surfaces/pressureMap/Sheet', () => ({
  Sheet: (props: any) => React.createElement('Sheet', props, props.children),
  useSheetOverlayActive: () => false,
}));
vi.mock('@/folio/ui/useUndo', () => ({ useUndo: () => ({ undoVisible: false, undoHeight: 0 }) }));

import { ReviewScreen } from '@/folio/screens/ReviewScreen';

const nav = { go: vi.fn(), back: vi.fn(), openSheet: vi.fn() } as any;

function mount(props: Record<string, unknown>) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(ReviewScreen, { nav, ...props }));
  });
  return tree;
}

describe('MF12 ReviewScreen mounted composition', () => {
  it('uses no inner vertical owner when ReviewHub supplies the parent owner', () => {
    const tree = mount({ embedded: true, embeddedScrollOwner: true, state: 'empty' });
    expect(tree.root.findAll((node) => node.type === 'ScrollView')).toHaveLength(0);
    expect(tree.root.findAll((node) => node.type === 'MeloFigure')).toHaveLength(1);
  });

  it('keeps the standalone candidate review scroll owner intact', () => {
    const tree = mount({
      candidate: { merchant: 'Cafe', amount: 10, flow: 'out', date: '2026-09-01', before: 100 },
      state: 'populated',
    });
    expect(tree.root.findAll((node) => node.type === 'ScrollView')).toHaveLength(1);
    expect(
      tree.root.findAll(
        (node) => typeof node.type === 'string' && node.props.accessibilityLabel === 'Amount out',
      ),
    ).toHaveLength(1);
  });

  it('reveals an embedded editor through the parent owner and preserves its offset ref', () => {
    const scrollTo = vi.fn();
    const embeddedScrollRef = {
      current: {
        getNativeScrollRef: () => ({
          measureInWindow: (
            receive: (x: number, y: number, width: number, height: number) => void,
          ) => {
            receive(0, 0, 390, 600);
          },
        }),
        scrollTo,
      },
    };
    const embeddedScrollYRef = { current: 42 };
    const tree = mount({
      embedded: true,
      embeddedScrollOwner: true,
      embeddedScrollRef,
      embeddedScrollYRef,
      candidate: { merchant: 'Cafe', amount: 10, flow: 'out', date: '2026-09-01', before: 100 },
      state: 'populated',
    });
    const amount = tree.root.findAll(
      (node) => typeof node.type === 'string' && node.props.accessibilityLabel === 'Amount',
    )[0]!;
    act(() => amount.props.onFocus());
    expect(scrollTo).toHaveBeenCalledWith({ y: 90, animated: true });
    expect(embeddedScrollYRef.current).toBe(90);
  });

  it('omits only the companion band below the measured 200dp exclusion threshold', () => {
    const shortTree = mount({
      embedded: true,
      embeddedScrollOwner: true,
      availableViewportHeight: 199,
      state: 'empty',
    });
    expect(shortTree.root.findAll((node) => node.type === 'MeloFigure')).toHaveLength(0);
    const tallTree = mount({
      embedded: true,
      embeddedScrollOwner: true,
      availableViewportHeight: 201,
      state: 'empty',
    });
    expect(tallTree.root.findAll((node) => node.type === 'MeloFigure')).toHaveLength(1);
  });
});
