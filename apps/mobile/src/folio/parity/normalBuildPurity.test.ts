import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Linking: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    getInitialURL: vi.fn(async () => null),
  },
}));
vi.mock('../ui/statusDialogs', () => ({ getParityStatusDialog: vi.fn(() => undefined) }));
vi.mock('./decisionDialogs', () => ({ getParityDecisionDialog: vi.fn(() => undefined) }));

import { getPersistBlob, getState, resetToEmpty } from '../store';
import {
  getParityHarnessConfig,
  getParityRuntimeControl,
  startParityRuntimeControl,
} from './parityHarness';

describe('normal owner build purity', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the capture harness and capture navigation inert without the explicit build flag', () => {
    vi.stubEnv('EXPO_PUBLIC_MELO_PARITY_CAPTURE', '');
    vi.stubEnv('EXPO_PUBLIC_MELO_PARITY_FIXTURE', 'confirmed-safe');

    expect(getParityHarnessConfig()).toBeNull();
    const before = getParityRuntimeControl();
    const stop = startParityRuntimeControl();
    stop();
    expect(getParityRuntimeControl()).toBe(before);
    expect(getParityRuntimeControl()).toBeNull();
  });

  it('never places parity fixtures or demo money in the normal persistence partition', () => {
    vi.stubEnv('EXPO_PUBLIC_MELO_PARITY_CAPTURE', '');
    resetToEmpty({ onboardingDone: false });

    const state = getState();
    const blob = getPersistBlob();

    expect(state.currentBalance.amount).toBe(0);
    expect(state.transactions).toEqual([]);
    expect(state.pots).toEqual([]);
    expect(state.subs).toEqual([]);
    expect(state.readerCandidates).toEqual([]);
    expect(blob).not.toContain('fixture-');
    expect(blob).not.toContain('parity-statement');
    expect(blob).not.toContain('confirmed-safe');
  });
});
