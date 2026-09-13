import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const element = (name: string) => (props: Record<string, unknown>) =>
    ReactModule.createElement(name, props, props.children as React.ReactNode);
  return {
    Pressable: element('Pressable'),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    View: element('View'),
  };
});
vi.mock('@/folio/melo/Melo', () => ({ Melo: () => React.createElement('Melo') }));
vi.mock('@/folio/theme', () => ({ gap: { xs: 4 } }));

import { MeloCompanionHost } from './MeloCompanionHost';

describe('MeloCompanionHost mounted semantics', () => {
  it('mounts one named semantic control and invokes only the host action', () => {
    const onPress = vi.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        React.createElement(MeloCompanionHost, {
          mood: 'calm',
          presence: 'perched',
          onPress,
        }),
      );
    });
    const root = tree!.root;
    const pressable = root.findByProps({ accessibilityLabel: 'Melo companion' });
    expect(pressable.props.accessibilityRole).toBe('button');
    act(() => pressable.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('mounts decorative art as hidden descendants when the host is not actionable', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        React.createElement(MeloCompanionHost, { mood: 'calm', presence: 'perched' }),
      );
    });
    const root = tree!.root;
    const host = root.findByProps({ accessibilityLabel: 'Melo companion' });
    expect(host.props.accessibilityRole).toBe('image');
    expect(root.findByProps({ importantForAccessibility: 'no-hide-descendants' })).toBeTruthy();
  });
});
