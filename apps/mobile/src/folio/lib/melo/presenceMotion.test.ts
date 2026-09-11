import { describe, expect, it } from 'vitest';
import {
  motionBetween,
  resolvePresenceDrop,
  resolvePresenceTarget,
  safePresenceRect,
} from './presenceMotion';

describe('persistent companion in the S9 content viewport', () => {
  const viewport = { x: 0, y: 70, width: 360, height: 510 };
  const slot = { x: 268, y: 140, width: 76, height: 76 };
  const paragraph = { x: 24, y: 100, width: 236, height: 170 };
  it('uses the standard body beside a wrapped explanation without covering it', () => {
    const result = resolvePresenceTarget(slot, viewport, [paragraph]);
    expect(result?.width).toBe(60);
    expect(result!.x).toBeGreaterThanOrEqual(paragraph.x + paragraph.width + 8);
  });
  it('uses compact art before hiding, and hides before either edge clips', () => {
    expect(resolvePresenceTarget({ ...slot, y: 66 }, viewport, [])?.width).toBe(48);
    expect(resolvePresenceTarget({ ...slot, y: 50 }, viewport, [])).toBeNull();
    expect(resolvePresenceTarget({ ...slot, y: 535 }, viewport, [])).toBeNull();
  });
  it('does not use a shell corner or overlap an action/amount when neither body fits', () => {
    expect(resolvePresenceTarget(slot, viewport, [{ ...slot }])).toBeNull();
    expect(safePresenceRect({ ...slot, x: NaN }, viewport)).toBe(false);
  });
  it('accepts the other semantic edge and rejects a drop into following content', () => {
    expect(resolvePresenceDrop(312, 'right', -236, 0)).toBe('left');
    expect(resolvePresenceDrop(312, 'left', 236, 0)).toBe('right');
    expect(resolvePresenceDrop(312, 'right', -120, 0)).toBeNull();
    expect(resolvePresenceDrop(312, 'right', -236, 80)).toBeNull();
  });
  it('bounds a long route move and preserves leftward direction', () => {
    const move = motionBetween(slot, { ...slot, x: 0, y: 1200 });
    expect(move.duration).toBe(1100);
    expect(move.arc).toBe(80);
    expect(move.faceLeft).toBe(true);
    expect(move.overshoot).toBe(6);
  });
});
