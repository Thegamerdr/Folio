import { describe, expect, it } from 'vitest';

import {
  classifyMeloGesture,
  deriveBusinessContextAction,
  deriveMeloPresence,
  derivePersonalContextAction,
  deriveShellContextAction,
  meloDropSide,
  resolveMeloAnchor,
} from './companion';

describe('native Melo companion semantics', () => {
  it('keeps a short still touch distinct from a grab or drag', () => {
    expect(classifyMeloGesture(2, 2, 120)).toBe('tap');
    expect(classifyMeloGesture(7, 0, 80)).toBe('drag');
    expect(classifyMeloGesture(0, 0, 300)).toBe('drag');
  });

  it('snaps releases to a semantic side instead of persisting arbitrary coordinates', () => {
    expect(meloDropSide(20, 64, 360)).toBe('left');
    expect(meloDropSide(260, 64, 360)).toBe('right');
  });

  it('opens a contextual action before the deeper chat action', () => {
    expect(deriveShellContextAction('today')).toEqual(
      expect.objectContaining({ id: 'today.explain-path' }),
    );
    expect(deriveShellContextAction('review')).toEqual(
      expect.objectContaining({ id: 'review.changed' }),
    );
    expect(deriveShellContextAction('start')).toBeUndefined();
  });

  it('keeps quiet and tucked states stronger than an offered action', () => {
    expect(
      deriveMeloPresence({ quietMode: true, action: { id: 'x', label: 'x', prompt: 'x' } }),
    ).toBe('hidden');
    expect(deriveMeloPresence({ quietMode: false, tucked: true })).toBe('tucked');
    expect(
      deriveMeloPresence({ quietMode: false, action: { id: 'x', label: 'x', prompt: 'x' } }),
    ).toBe('offering-help');
  });

  it('offers a personal action that follows the derived mood', () => {
    expect(derivePersonalContextAction('concern').id).toBe('personal-tight-point');
    expect(derivePersonalContextAction('calm').id).toBe('personal-route');
  });

  it('preserves a real business action instead of inventing a new destination', () => {
    const action = { id: 'invoice', label: 'Review invoices', prompt: 'One useful look.' };
    expect(deriveBusinessContextAction(action)).toBe(action);
  });

  it('uses a preferred side only when the semantic anchor is safe', () => {
    expect(
      resolveMeloAnchor({ x: 70, y: 40, width: 100, height: 40 }, 60, 'right', {
        width: 240,
        height: 160,
      }),
    ).toEqual({
      x: 110,
      y: 30,
      side: 'right',
    });
    expect(
      resolveMeloAnchor({ x: -12, y: 40, width: 80, height: 40 }, 60, 'left', {
        width: 240,
        height: 160,
      }),
    ).toEqual({
      x: 8,
      y: 30,
      side: 'right',
    });
    expect(
      resolveMeloAnchor({ x: 0, y: 0, width: 20, height: 20 }, 60, 'left', {
        width: 70,
        height: 70,
      }),
    ).toBeNull();
  });
});
