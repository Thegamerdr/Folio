import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  BackHandler: { addEventListener: () => ({ remove: () => undefined }) },
  Keyboard: { dismiss: () => undefined },
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View',
  useWindowDimensions: () => ({ width: 360, fontScale: 1 }),
}));
vi.mock('@/surfaces/pressureMap/Sheet', () => ({ Sheet: 'Sheet' }));
vi.mock('@/folio/theme', () => ({
  gap: { lg: 16, sm: 8 },
  radius: { pill: 999 },
  serif: { display: 'display' },
  useTheme: () => ({ calm: '', surface: '', hairline: '', inverse: '', ink: '', muted: '' }),
}));
vi.mock('./meloAlert', () => ({
  dismissMeloAlert: () => undefined,
  getMeloAlert: () => null,
  pressMeloAlert: () => undefined,
  subscribeMeloAlert: () => () => undefined,
}));
import { applyAlertTextLayout, deriveAlertContentMinHeight } from './MeloAlertHost';

describe('deriveAlertContentMinHeight', () => {
  it('waits for a complete frame set and derives the authored terminal extent', () => {
    const frames = {
      title: { x: 0, y: 16, width: 312, height: 140 },
      message: { x: 0, y: 168, width: 312, height: 504 },
    };
    expect(deriveAlertContentMinHeight(frames, true, 16, 16, 8)).toBe(712);
    expect(deriveAlertContentMinHeight({ ...frames, message: null }, true, 16, 16, 8)).toBeNull();
    expect(
      deriveAlertContentMinHeight(
        { title: { x: 0, y: 16, width: 312, height: 35 }, message: null },
        false,
        16,
        16,
        8,
      ),
    ).toBe(75);
  });

  it('recomputes for a changed frame set without retaining the prior height', () => {
    const frames = {
      title: { x: 0, y: 16, width: 312, height: 35 },
      message: { x: 0, y: 63, width: 312, height: 42 },
    };
    expect(deriveAlertContentMinHeight(frames, true, 16, 16, 8)).toBe(145);
  });

  it('rejects a late old-key callback across alert/font changes before accepting new frames', () => {
    const state = {
      key: 'alert-1\u0000360\u00001',
      frames: {
        title: { x: 0, y: 16, width: 312, height: 140 },
        message: { x: 0, y: 168, width: 312, height: 504 },
      },
    };
    const staleFrame = { x: 0, y: 16, width: 624, height: 70 };
    expect(
      applyAlertTextLayout(
        state,
        'alert-1\u0000624\u00002',
        'alert-1\u0000360\u00001',
        'title',
        staleFrame,
        true,
        16,
        16,
        8,
      ),
    ).toBeNull();
    expect(state.key).toBe('alert-1\u0000360\u00001');
    expect(state.frames.title).toEqual({ x: 0, y: 16, width: 312, height: 140 });
    expect(
      applyAlertTextLayout(
        state,
        'alert-1\u0000624\u00002',
        'alert-1\u0000624\u00002',
        'title',
        { x: 0, y: 16, width: 624, height: 70 },
        true,
        16,
        16,
        8,
      ),
    ).toBeNull();
    expect(
      applyAlertTextLayout(
        state,
        'alert-1\u0000624\u00002',
        'alert-1\u0000624\u00002',
        'message',
        { x: 0, y: 86, width: 624, height: 252 },
        true,
        16,
        16,
        8,
      ),
    ).toBe(378);
  });
});
