import { describe, expect, it } from 'vitest';

import {
  deriveBusinessContextAction,
  deriveMeloPresence,
  derivePersonalContextAction,
  resolveMeloAnchor,
} from './companion';

describe('native Melo companion semantics', () => {
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
