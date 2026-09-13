import React, { useSyncExternalStore } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

const h = vi.hoisted(() => ({
  announce: vi.fn(),
  fontScale: 1,
  listeners: new Set<() => void>(),
  state: {} as any,
}));

vi.mock('react-native', () => ({
  AccessibilityInfo: {
    addEventListener: () => ({ remove: vi.fn() }),
    announceForAccessibility: h.announce,
    isReduceMotionEnabled: () => Promise.resolve(false),
  },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View',
  useWindowDimensions: () => ({ fontScale: h.fontScale }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  Easing: { bezier: () => (value: number) => value, ease: {}, out: (value: unknown) => value },
  useAnimatedProps: (factory: () => unknown) => factory(),
  useAnimatedStyle: (factory: () => unknown) => factory(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));
vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Circle: 'SvgCircle',
  Defs: 'SvgDefs',
  LinearGradient: 'SvgLinearGradient',
  Line: 'SvgLine',
  Path: 'SvgPath',
  Stop: 'SvgStop',
  Text: 'SvgText',
}));
vi.mock('@/folio/theme', () => ({
  gap: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { lg: 16, xxl: 32 },
  serif: { display: 'Fraunces', displayItalic: 'Fraunces Italic' },
  useTheme: () => ({
    canvas: '#fff',
    surface: '#fff',
    ink: '#111',
    muted: '#666',
    hairline: '#ddd',
    calm: '#0a0',
    calmStrong: '#070',
    positive: '#080',
    inverse: '#fff',
  }),
}));
vi.mock('@/folio/melo/MeloLine', () => ({
  MeloLine: ({ text }: { text: string }) => React.createElement('MeloLine', null, text),
}));
vi.mock('@/folio/ui/EmptyState', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));
vi.mock('@/folio/ui/ScreenHeader', () => ({
  ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
}));
vi.mock('@/folio/store', () => ({
  useAppStore: (selector: (state: any) => unknown) =>
    selector(
      useSyncExternalStore(
        (listener) => {
          h.listeners.add(listener);
          return () => h.listeners.delete(listener);
        },
        () => h.state,
        () => h.state,
      ),
    ),
}));
vi.mock('@/folio/lib/workspaceRoot', () => ({ PERSONAL_WORKSPACE_ID: 'workspace_personal_local' }));
vi.mock('@/folio/lib/recordedReviews', () => ({
  selectRecordedReviews: (cycles: any[]) =>
    cycles
      .filter((cycle) => !cycle.reconstructed)
      .slice()
      .sort((a, b) => b.closedAt.localeCompare(a.closedAt)),
}));
vi.mock('@/folio/lib/financialPresentation', () => ({
  formatMoney: (value: number) => `£${value.toFixed(2)}`,
  formatFinancialDate: (value: string) =>
    new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(value)),
}));
vi.mock('@/folio/lib/modes/types', () => ({
  MODE_LABEL: { survival: 'Survival', balanced: 'Balanced' },
}));
vi.mock('@/folio/lib/wins', () => ({ tinyWinMessage: () => 'A tiny win' }));
vi.mock('@/folio/lib/caughtAnnual', () => ({
  expectedMonthLabel: () => 'September',
  useCaughtAnnual: () => [],
}));
vi.mock('@/folio/copy/copy', () => ({
  copy: { annual: { card: { eyebrow: '', body: () => '' } } },
}));

import { InsightsScreen } from './InsightsScreen';

const personal = 'workspace_personal_local';

function cycle(overrides: Record<string, unknown> = {}) {
  return {
    closedAt: '2026-09-13T10:00:00.000Z',
    label: 'September',
    spare: 200,
    tightPoint: 80,
    setAside: 20,
    note: 'canonical note',
    workspaceId: personal,
    ...overrides,
  };
}

function baseState(cycles: any[]) {
  return {
    cycles,
    activeWorkspaceId: personal,
    pots: [],
    moneyMode: 'survival',
    subPaused: {},
    tinyWins: [],
    cancelledSubs: [],
    transactions: [],
  };
}

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-personal',
    workspaceId: personal,
    when: new Date().toISOString(),
    merchant: 'Synthetic spend',
    amount: -20,
    category: 'other',
    source: 'manual',
    ...overrides,
  };
}

function textOf(node: any): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node?.children) return '';
  return node.children.map((child: any) => textOf(child)).join('');
}

async function renderScreen() {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(InsightsScreen, {
        nav: {
          back: vi.fn(),
          go: vi.fn(),
          openSheet: vi.fn(),
          openMelo: vi.fn(),
          setPressure: vi.fn(),
        },
      }),
    );
    await Promise.resolve();
  });
  return renderer;
}

beforeEach(() => {
  h.announce.mockReset();
  h.listeners.clear();
  h.fontScale = 1;
});

describe('InsightsScreen native branch and chart accessibility', () => {
  it('remounts metric measurement when a fitted value changes to a longer token', async () => {
    h.state = baseState([cycle({ spare: 1.23 })]);
    const renderer = await renderScreen();
    const tile = () =>
      renderer.root.find((node) =>
        String(node.props.accessibilityLabel ?? '').startsWith('LATEST PAYDAY CASH FORECAST'),
      );
    const valueText = () =>
      tile().find((node) => typeof node.props.onTextLayout === 'function');

    await act(async () => {
      valueText().props.onTextLayout({ nativeEvent: { lines: [{ width: 120 }] } });
      await Promise.resolve();
    });
    expect(tile().findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(0);

    h.state = baseState([cycle({ spare: 123456789.12 })]);
    act(() => h.listeners.forEach((listener) => listener()));
    expect(tile().findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);

    await act(async () => {
      valueText().props.onTextLayout({ nativeEvent: { lines: [{ width: 420 }] } });
      await Promise.resolve();
    });
    expect(tile().findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);
  });

  it('invalidates fitted metric measurement when font scale changes', async () => {
    h.fontScale = 1;
    h.state = baseState([cycle({ spare: 1.23 })]);
    const renderer = await renderScreen();
    const tile = () =>
      renderer.root.find((node) =>
        String(node.props.accessibilityLabel ?? '').startsWith('LATEST PAYDAY CASH FORECAST'),
      );
    const valueText = () =>
      tile().find((node) => typeof node.props.onTextLayout === 'function');

    await act(async () => {
      valueText().props.onTextLayout({ nativeEvent: { lines: [{ width: 120 }] } });
      await Promise.resolve();
    });
    expect(tile().findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(0);

    h.fontScale = 2;
    act(() => {
      renderer.update(
        React.createElement(InsightsScreen, {
          nav: {
            back: vi.fn(),
            go: vi.fn(),
            openSheet: vi.fn(),
            openMelo: vi.fn(),
            setPressure: vi.fn(),
          },
        }),
      );
    });
    expect(tile().findAll((node) => String(node.type) === 'ScrollView')).toHaveLength(1);
  });

  it('uses the canonical Personal workspace while excluding business and reconstructed records', async () => {
    h.state = baseState([
      cycle(),
      cycle({ workspaceId: 'workspace_business', note: 'business note' }),
      cycle({ reconstructed: true, note: 'approximate note' }),
    ]);
    const renderer = await renderScreen();
    const text = textOf(renderer.root);

    expect(text).toContain('1 recorded review');
    expect(text).toContain('canonical note');
    expect(text).toContain('Approximate record');
    expect(text).not.toContain('business note');
  });

  it('announces each branch transition once without moving focus', async () => {
    h.state = baseState([cycle()]);
    await renderScreen();
    h.state = baseState([cycle({ workspaceId: 'workspace_business' })]);
    act(() => h.listeners.forEach((listener) => listener()));
    act(() => h.listeners.forEach((listener) => listener()));

    expect(h.announce).toHaveBeenCalledTimes(1);
    expect(h.announce).toHaveBeenCalledWith('No reviews recorded yet.');
  });

  it('keeps three same-day points individually focusable and adds the shared recorded-date caption', async () => {
    h.state = baseState([
      cycle({ closedAt: '2026-09-13T12:00:00.000Z', tightPoint: 70 }),
      cycle({ closedAt: '2026-09-13T11:00:00.000Z', tightPoint: 80 }),
      cycle({ closedAt: '2026-09-13T10:00:00.000Z', tightPoint: 90 }),
    ]);
    const renderer = await renderScreen();
    const text = textOf(renderer.root);
    const pointFocus = renderer.root.findAll((node) =>
      node.props.accessibilityLabel?.includes('recorded 13 Sept 2026'),
    );

    expect(text).toContain('Recorded 13 Sept 2026');
    expect(text).toContain('Review 1');
    expect(text).toContain('Review 2');
    expect(text).toContain('Review 3');
    expect(text).toContain('Review average');
    expect(pointFocus).toHaveLength(3);
    expect(renderer.root.findAll((node) => node.props.accessibilityRole === 'image')).toHaveLength(
      0,
    );
  });

  it('keeps the six-review chart mean distinct from the all-review headline mean', async () => {
    h.state = baseState(
      Array.from({ length: 7 }, (_, index) =>
        cycle({
          closedAt: `2026-09-${String(index + 7).padStart(2, '0')}T10:00:00.000Z`,
          tightPoint: (index + 1) * 10,
        }),
      ),
    );
    const renderer = await renderScreen();
    const text = textOf(renderer.root);
    const pointFocus = renderer.root.findAll(
      (node) =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.includes('shown'),
    );

    expect(text).toContain('Latest 6 of 7 reviews');
    expect(text).toContain('Average of these 6 £45.00');
    expect(text).toContain('Across all 7 recorded reviews.');
    expect(pointFocus).toHaveLength(6);
  });

  it('keeps the notes/history window at the latest four while retaining seven recorded reviews', async () => {
    h.state = baseState(
      Array.from({ length: 7 }, (_, index) =>
        cycle({
          closedAt: `2026-09-${String(index + 7).padStart(2, '0')}T10:00:00.000Z`,
          note: `distinct-note-${index + 1}`,
        }),
      ),
    );
    const renderer = await renderScreen();
    const text = textOf(renderer.root);

    expect(text).toContain('distinct-note-7');
    expect(text).toContain('distinct-note-6');
    expect(text).toContain('distinct-note-5');
    expect(text).toContain('distinct-note-4');
    expect(text).not.toContain('distinct-note-3');
    expect(text).not.toContain('distinct-note-2');
    expect(text).not.toContain('distinct-note-1');
  });

  it('uses the measured 312dp plot as the SVG and focus coordinate space at 1x and 2x', async () => {
    for (const fontScale of [1, 2]) {
      h.fontScale = fontScale;
      h.state = baseState(
        Array.from({ length: 6 }, (_, index) =>
          cycle({
            closedAt: `2026-09-${String(index + 7).padStart(2, '0')}T10:00:00.000Z`,
            tightPoint: 20 + index * 10,
          }),
        ),
      );
      const renderer = await renderScreen();
      let canvas = renderer.root.findByProps({ testID: 'insights-chart-canvas' });
      await act(async () => {
        canvas.props.onLayout({ nativeEvent: { layout: { width: 312 } } });
        await Promise.resolve();
      });
      canvas = renderer.root.findByProps({ testID: 'insights-chart-canvas' });
      const circles = renderer.root.findAllByType('SvgCircle' as any);
      const focusTargets = renderer.root.findAll(
        (node) =>
          typeof node.props.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.includes('shown'),
      );

      const plotHeight = fontScale === 2 ? 288 : 232;
      const svg = renderer.root.findByType('Svg' as any);

      expect(canvas.props.style[1]).toMatchObject({ height: plotHeight });
      expect(svg.props.width).toBe(312);
      expect(svg.props.height).toBe(plotHeight);
      expect(svg.props.viewBox).toBe(`0 0 312 ${plotHeight}`);
      expect(circles).toHaveLength(6);
      expect(focusTargets).toHaveLength(6);
      for (const [index, focus] of focusTargets.entries()) {
        const mark = circles[index]!;
        const focusPosition = focus.props.style[1];
        expect(focus.props.style[0]).toMatchObject({ width: 44, height: 44 });
        expect(focusPosition.left).toBe(`${(mark.props.cx / 312) * 100}%`);
        expect(focusPosition.top).toBe(`${(mark.props.cy / plotHeight) * 100}%`);
      }
    }
  });

  it('keeps flat-series endpoints clear of a wrapped guide label at realistic currency widths', async () => {
    for (const { count, fontScale, value } of [
      { count: 2, fontScale: 1, value: 9999.99 },
      { count: 6, fontScale: 2, value: 1234567.89 },
      { count: 7, fontScale: 2, value: 987654.32 },
    ]) {
      h.fontScale = fontScale;
      h.state = baseState(
        Array.from({ length: count }, (_, index) =>
          cycle({
            closedAt: `2026-09-${String(index + 7).padStart(2, '0')}T10:00:00.000Z`,
            tightPoint: value,
          }),
        ),
      );
      const renderer = await renderScreen();
      const canvas = renderer.root.findByProps({ testID: 'insights-chart-canvas' });
      await act(async () => {
        canvas.props.onLayout({ nativeEvent: { layout: { width: 312 } } });
        await Promise.resolve();
      });

      const guide = renderer.root.findByProps({ testID: 'insights-chart-guide' });
      const guideLabel =
        count > 6
          ? `Average of these 6 £${value.toFixed(2)}`
          : `Review average £${value.toFixed(2)}`;
      const svgTexts = renderer.root.findAllByType('SvgText' as any);
      const circles = renderer.root.findAllByType('SvgCircle' as any);

      expect(guide.props.style[1]).toMatchObject({ width: 272, lineHeight: 16 * fontScale });
      expect(guide.props.accessible).toBe(false);
      expect(guide.props.accessibilityLabel).toBeUndefined();
      const chartSummary = renderer.root.find((node) =>
        node.props.accessibilityLabel?.startsWith('Saved forecast low points, '),
      );
      expect(chartSummary.props.accessibilityLabel).toBe(
        `Saved forecast low points, ${
          count > 6
            ? `Latest 6 of ${count} reviews`
            : `${count} reviews · average £${value.toFixed(2)}`
        }`,
      );
      expect(chartSummary.props.accessibilityValue).toEqual({ text: guideLabel });
      expect(textOf(guide)).toBe(guideLabel);
      expect(svgTexts.map((node) => textOf(node))).not.toContain(guideLabel);
      expect(new Set(circles.map((circle) => circle.props.cy)).size).toBe(1);
    }
  });

  it('scopes transaction-derived comparison text to the active Personal workspace', async () => {
    h.state = {
      ...baseState([
        cycle({ closedAt: '2026-09-13T12:00:00.000Z', spare: 200 }),
        cycle({ closedAt: '2026-09-13T11:00:00.000Z', spare: 180 }),
      ]),
      transactions: [
        transaction({ amount: -20 }),
        transaction({ id: 'tx-business', workspaceId: 'workspace_business', amount: -99 }),
      ],
    };
    const renderer = await renderScreen();
    const text = textOf(renderer.root);

    expect(text).toContain('Recorded money out in the past 7 days: £20.');
    expect(text).not.toContain('Recorded money out in the past 7 days: £119.');
  });

  it('omits the headline low average when any review low is unknown', async () => {
    h.state = baseState([
      cycle({ closedAt: '2026-09-13T12:00:00.000Z', tightPoint: 80 }),
      cycle({ closedAt: '2026-09-13T11:00:00.000Z', tightPoint: Number.NaN }),
    ]);
    const partial = await renderScreen();
    const partialText = textOf(partial.root);

    expect(partialText).not.toContain('AVERAGE SAVED FORECAST LOW');
    expect(partialText).not.toContain('SAVED FORECAST LOW POINTS');

    h.state = baseState([
      cycle({ closedAt: '2026-09-13T12:00:00.000Z', tightPoint: Number.NaN }),
      cycle({ closedAt: '2026-09-13T11:00:00.000Z', tightPoint: Number.NaN }),
    ]);
    const allUnknown = await renderScreen();
    const allUnknownText = textOf(allUnknown.root);

    expect(allUnknownText).toContain('Not enough saved information yet.');
    expect(allUnknownText).not.toContain('AVERAGE SAVED FORECAST LOW');
    expect(allUnknownText).not.toContain('SAVED FORECAST LOW POINTS');
  });

  it('scales SVG value labels with the native font scale', async () => {
    h.fontScale = 2;
    h.state = baseState([
      cycle({ closedAt: '2026-09-13T10:00:00.000Z', tightPoint: 70 }),
      cycle({ closedAt: '2026-09-14T10:00:00.000Z', tightPoint: 90 }),
    ]);
    const renderer = await renderScreen();
    const svgLabels = renderer.root.findAllByType('SvgText' as any);

    expect(svgLabels.some((label) => label.props.fontSize === 24)).toBe(true);
  });

  it('keeps the empty branch calm and exposes the existing empty-state primitive', async () => {
    h.state = baseState([]);
    const renderer = await renderScreen();
    const empty = renderer.root.findByType('EmptyState' as any);

    expect(empty.props.mood).toBe('calm');
    expect(empty.props.headline).toBe('No reviews yet');
  });
});
