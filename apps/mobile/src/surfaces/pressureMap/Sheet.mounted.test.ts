import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { TextInput } from 'react-native';

(globalThis as any).requestAnimationFrame = (callback: () => void) => { callback(); return 1; };
(globalThis as any).cancelAnimationFrame = () => undefined;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const el = (name: string) => (props: any) => ReactModule.createElement(name, props, props.children);
  return {
    Animated: {
      Value: class { setValue(_: number) {} interpolate(_: any) { return 0; } },
      View: el('Animated.View'), timing: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
      parallel: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
      createAnimatedComponent: (component: any) => component,
    },
    BackHandler: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
    Dimensions: { get: vi.fn(() => ({ width: 390, height: 844 })) },
    Easing: { inOut: (x: any) => x, cubic: (x: any) => x, bezier: (...x: any[]) => x },
    Keyboard: { metrics: vi.fn(() => undefined), addListener: vi.fn(() => ({ remove: vi.fn() })) },
    Modal: el('Modal'), Platform: { OS: 'android' }, Pressable: el('Pressable'),
    ScrollView: el('ScrollView'), StyleSheet: { create: (x: any) => x, hairlineWidth: 1 },
    Text: el('Text'), TextInput: Object.assign(el('TextInput'), { State: { currentlyFocusedInput: vi.fn(() => null) } }),
    useWindowDimensions: vi.fn(() => ({ width: 390, height: 844 })), View: el('View'),
  };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
vi.mock('react-native-reanimated', () => ({ useReducedMotion: () => false }));
vi.mock('./kit', () => ({ elevation: { sheet: {} }, gap: { md: 12 }, useTheme: () => ({ paper: '#fff', inset: '#eee', ink: '#111', hairline: '#ccc' }) }));
vi.mock('./sheetRepaint', () => ({ announceSurfaceRepaint: vi.fn() }));
vi.mock('./sheetBack', () => ({ dismissTopSheet: vi.fn(), registerSheetBack: vi.fn(() => vi.fn()) }));

import { Sheet } from './Sheet';

describe('Sheet mounted focus lifecycle', () => {
  it('survives default-off sheet layout after navigation releases focused input', () => {
    let bodyNode: any;
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(
      React.createElement(Sheet, { visible: true, onClose: vi.fn(), scrollable: true, children: React.createElement(TextInput, { accessibilityLabel: 'field' }) }),
      { createNodeMock: (element: any) => {
        if (element.type === 'ScrollView') {
          bodyNode = { getNativeScrollRef: () => bodyNode, measureInWindow: (cb: any) => cb(0, 0, 390, 400), scrollTo: vi.fn() };
          return bodyNode;
        }
        if (element.type === 'View' || element.type === 'Animated.View') return { measure: vi.fn(), measureInWindow: vi.fn() };
        return {};
      } },
    ); });
    const scroll = tree.root.findAll((node) => (node.type as any) === 'ScrollView')[0]!;
    expect(() => act(() => scroll.props.onLayout({ nativeEvent: { layout: { width: 390, height: 400 } } }))).not.toThrow();
    act(() => tree.unmount());
  });
});

