import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextInput, View } from 'react-native';

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
    Keyboard: {
      metrics: vi.fn(() => undefined),
      addListener: vi.fn((name: string, callback: (event?: any) => void) => {
        keyboardListeners.set(name, callback);
        return { remove: vi.fn(() => keyboardListeners.delete(name)) };
      }),
    },
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

const keyboardListeners = new Map<string, (event?: any) => void>();

describe('Sheet mounted focus lifecycle', () => {
  afterEach(() => keyboardListeners.clear());
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

  it('keeps terminal content visible when IME dismissal grows the viewport without focus', () => {
    let bodyNode: any;
    const terminalAlignmentEnabledRef = { current: true };
    const terminalRef = { current: { measureLayout: (_relative: any, cb: any) => cb(0, 1200, 390, 80) } as any };
    const scrollTo = vi.fn();
    act(() => { renderer.create(
      React.createElement(Sheet, {
        visible: true,
        onClose: vi.fn(),
        scrollable: true,
        imeOverflowPolicy: 'scrollBodyToFocusedTerminal',
        terminalAlignmentEnabledRef,
        terminalRef,
        children: React.createElement(View, { style: { height: 80 } }),
      }),
      { createNodeMock: (element: any) => {
        if (element.type === 'ScrollView') {
          bodyNode = {
            getNativeScrollRef: () => bodyNode,
            measureInWindow: (cb: any) => cb(0, 0, 390, 400),
            scrollTo,
          };
          return bodyNode;
        }
        if (element.type === 'View' || element.type === 'Animated.View') {
          return {
            measure: vi.fn(),
            measureInWindow: vi.fn(),
            measureLayout: (_relative: any, cb: any) => cb(0, 1200, 390, 80),
          };
        }
        return {};
      } },
    ); });
    act(() => keyboardListeners.get('keyboardDidShow')?.({ endCoordinates: { height: 300 } }));
    act(() => keyboardListeners.get('keyboardDidHide')?.());
    expect(scrollTo).toHaveBeenCalledWith({ y: 880, animated: false });
  });

  it('keeps a deliberate reader drag anchored after IME dismissal', () => {
    let bodyNode: any;
    const terminalAlignmentEnabledRef = { current: true };
    const terminalRef = { current: { measureLayout: (_relative: any, cb: any) => cb(0, 1200, 390, 80) } as any };
    const scrollTo = vi.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(
      React.createElement(Sheet, {
        visible: true, onClose: vi.fn(), scrollable: true,
        imeOverflowPolicy: 'scrollBodyToFocusedTerminal', terminalAlignmentEnabledRef, terminalRef,
        children: React.createElement(View, { style: { height: 80 } }),
      }),
      { createNodeMock: (element: any) => {
        if (element.type === 'ScrollView') {
          bodyNode = { getNativeScrollRef: () => bodyNode, measureInWindow: (cb: any) => cb(0, 0, 390, 400), scrollTo };
          return bodyNode;
        }
        if (element.type === 'View' || element.type === 'Animated.View') return { measure: vi.fn(), measureInWindow: vi.fn(), measureLayout: vi.fn() };
        return {};
      } },
    ); });
    const scroll = tree.root.findAll((node) => (node.type as any) === 'ScrollView')[0]!;
    act(() => keyboardListeners.get('keyboardDidShow')?.({ endCoordinates: { height: 300 } }));
    act(() => scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 240 } } }));
    act(() => scroll.props.onScrollBeginDrag?.());
    act(() => keyboardListeners.get('keyboardDidHide')?.());
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 240, animated: false });
    act(() => tree.unmount());
  });

  it('restores the prior reader anchor when IME dismissal is nonterminal', () => {
    let bodyNode: any;
    const scrollTo = vi.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(
      React.createElement(Sheet, {
          visible: true,
          onClose: vi.fn(),
          scrollable: true,
          imeOverflowPolicy: 'scrollBodyToFocusedTerminal',
          terminalAlignmentEnabled: false,
          children: React.createElement(View, { style: { height: 80 } }),
        }),
        { createNodeMock: (element: any) => {
          if (element.type === 'ScrollView') {
            bodyNode = {
              getNativeScrollRef: () => bodyNode,
              measureInWindow: (cb: any) => cb(0, 0, 390, 400),
              scrollTo,
            };
            return bodyNode;
          }
          if (element.type === 'View' || element.type === 'Animated.View') {
            return { measure: vi.fn(), measureInWindow: vi.fn(), measureLayout: vi.fn() };
          }
          return {};
        } },
      );
    });
    const scroll = tree.root.findAll((node) => (node.type as any) === 'ScrollView')[0]!;
    act(() => scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 240 } } }));
    act(() => keyboardListeners.get('keyboardDidShow')?.({ endCoordinates: { height: 300 } }));
    act(() => keyboardListeners.get('keyboardDidHide')?.());
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 240, animated: false });
    act(() => tree.unmount());
  });

  it('does not force a focused reader to scroll while terminal alignment is disabled', () => {
    const focusedInput = { measureLayout: vi.fn() } as any;
    vi.mocked(TextInput.State.currentlyFocusedInput).mockReturnValue(focusedInput);
    let bodyNode: any;
    const scrollTo = vi.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(
      React.createElement(Sheet, {
        visible: true,
        onClose: vi.fn(),
        scrollable: true,
        imeOverflowPolicy: 'scrollBodyToFocusedTerminal',
        terminalAlignmentEnabled: false,
        children: React.createElement(View, { style: { height: 80 } }),
      }),
      { createNodeMock: (element: any) => {
        if (element.type === 'ScrollView') {
          bodyNode = {
            getNativeScrollRef: () => bodyNode,
            measureInWindow: (cb: any) => cb(0, 0, 390, 304),
            scrollTo,
          };
          return bodyNode;
        }
        if (element.type === 'View' || element.type === 'Animated.View') {
          return { measure: vi.fn(), measureInWindow: vi.fn(), measureLayout: vi.fn() };
        }
        return {};
      } },
    ); });
    act(() => keyboardListeners.get('keyboardDidShow')?.({ endCoordinates: { height: 540 } }));
    scrollTo.mockClear();
    const scroll = tree.root.findAll((node) => (node.type as any) === 'ScrollView')[0]!;
    act(() => scroll.props.onLayout({ nativeEvent: { layout: { width: 390, height: 304 } } }));
    expect(scrollTo).not.toHaveBeenCalled();
    vi.mocked(TextInput.State.currentlyFocusedInput).mockReturnValue(null);
    act(() => tree.unmount());
  });
});

