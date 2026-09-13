import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => {
  const el = (name: string) => (props: any) => React.createElement(name, props, props.children);
  return {
    AccessibilityInfo: { isReduceMotionEnabled: vi.fn(async () => false), addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
    Pressable: el('Pressable'), ScrollView: el('ScrollView'), Text: el('Text'), View: el('View'),
    StyleSheet: { create: (value: any) => value, hairlineWidth: 1 },
  };
});
vi.mock('react-native-svg', () => ({
  Circle: (p: any) => React.createElement('Circle', p), Defs: (p: any) => React.createElement('Defs', p),
  LinearGradient: (p: any) => React.createElement('LinearGradient', p), Path: (p: any) => React.createElement('Path', p),
  Stop: (p: any) => React.createElement('Stop', p), Text: (p: any) => React.createElement('SvgText', p),
  default: (p: any) => React.createElement('Svg', p),
}));
vi.mock('react-native-reanimated', () => ({
  cancelAnimation: vi.fn(), Easing: { bezier: (...v: any[]) => v, out: (v: any) => v, cubic: (v: any) => v },
  useAnimatedProps: (fn: any) => fn(), useAnimatedStyle: (fn: any) => fn(),
  useSharedValue: (value: number) => ({ value }), withTiming: (value: number) => value,
  default: { View: (p: any) => React.createElement('Animated.View', p, p.children), createAnimatedComponent: (component: any) => component },
}));
vi.mock('@/folio/theme', () => ({
  PressureScreen: ({ children }: any) => React.createElement('PressureScreen', null, children),
  elevation: {}, gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }, pressed: {}, radius: { xl: 16 },
  serif: { display: 'serif', displayItalic: 'serif' }, useTheme: () => ({ ink: '#111', muted: '#777', surface: '#fff', hairline: '#ccc', positive: '#090', repair: '#900', calm: '#06c' }),
}));
vi.mock('@/folio/lib/storeRoute', () => ({ useRoute: () => ({ points: [{ y: 100 }, { y: 80 }], daysToPayday: 1 }) }));
vi.mock('@/folio/store', () => ({ useAppStore: (selector: any) => selector({ activeWorkspaceId: 'w1' }) }));
vi.mock('@/folio/lib/financialPlan', () => ({ buildFinancialPlanFromState: () => ({}) }));
vi.mock('@/folio/lib/financialPresentation', () => ({ formatMoney: (value: number) => `£${value.toFixed(2)}` }));
vi.mock('@/folio/lib/recoveryReceipt', () => ({
  selectAfterChangePresentation: () => ({ receipt: { action: { kind: 'hold-spend', dailyCap: 20, days: 3 } }, canReassure: true, headline: 'Forecast updated.', amount: 0, amountLabel: 'after recorded costs', changeTitle: 'Saved change', changeDetail: 'The plan was rebuilt.', message: 'Your plan is ready.', rows: [{ label: 'After recorded costs', before: 500, after: 0 }] }),
}));
vi.mock('@/folio/melo/Melo', () => ({ Melo: () => React.createElement('Melo') }));
vi.mock('@/folio/melo/MeloLine', () => ({ MeloLine: (p: any) => React.createElement('MeloLine', p) }));

import { TodayAfterScreen } from './TodayAfterScreen';

describe('TodayAfterScreen mounted result visibility', () => {
  it('renders saved receipt feedback and return action even when entrance timing is frozen', async () => {
    const nav = { go: vi.fn(), openMelo: vi.fn() } as any;
    const recovery = { workspaceId: 'w1', at: new Date().toISOString(), action: { kind: 'hold-spend', dailyCap: 20, days: 3 }, before: { cashMinor: 100000, safeMinor: -50000, gapMinor: 50000 }, after: { cashMinor: 100000, safeMinor: 0, gapMinor: 0 } } as any;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(React.createElement(TodayAfterScreen, { nav, recovery })); await Promise.resolve(); });
    const text = tree.root.findAll((node) => (node.type as any) === 'Text').map((node) => node.children.join(' ')).join('|');
    expect(text).toContain('Change saved');
    expect(text).toContain('£500.00');
    expect(text).toContain('£0.00');
    const back = tree.root.findByProps({ accessibilityLabel: 'Back to Today' });
    act(() => back.props.onPress());
    expect(nav.go).toHaveBeenCalledWith('today');
    const root = tree.root.findAll((node) => (node.type as any) === 'Animated.View' || (node.type as any) === 'View')[0]!;
    expect(JSON.stringify(root.props.style)).not.toContain('opacity');
    act(() => tree.unmount());
  });
});
