import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const linking = vi.hoisted(() => ({
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  getInitialURL: vi.fn(async (): Promise<string | null> => null),
}));
vi.mock('react-native', () => ({ Linking: linking }));
vi.mock('../ui/statusDialogs', () => ({ getParityStatusDialog: vi.fn(() => null) }));
vi.mock('./decisionDialogs', () => ({ getParityDecisionDialog: vi.fn(() => null) }));

describe('normal owner build purity', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('EXPO_PUBLIC_MELO_PARITY_CAPTURE', '');
    vi.stubEnv('EXPO_PUBLIC_MELO_PARITY_FIXTURE', 'confirmed-safe');
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(['folio://parity?screen=pdf-success', 'folio-qa://parity?screen=image-success'])(
    'ignores the initial capture deep link %s in a production process',
    async (url) => {
      linking.getInitialURL.mockResolvedValue(url);
      const store = await import('../store');
      const parity = await import('./parityHarness');
      store.resetToEmpty({ onboardingDone: false });
      const before = store.getPersistBlob();

      expect(parity.getParityHarnessConfig()).toBeNull();
      parity.startParityRuntimeControl()();
      await Promise.resolve();

      expect(linking.addEventListener).not.toHaveBeenCalled();
      expect(linking.getInitialURL).not.toHaveBeenCalled();
      expect(parity.getParityRuntimeControl()).toBeNull();
      expect(store.getPersistBlob()).toBe(before);
    },
  );

  it('cannot replace a real profile or its clock through direct fixture/runtime activation', async () => {
    const store = await import('../store');
    const parity = await import('./parityHarness');
    store.resetToEmpty({ onboardingDone: true });
    store.setCurrentBalance({ amount: 123.45, source: 'user-entered', confidence: 'corrected' });
    const before = store.getPersistBlob();
    const realDate = globalThis.Date;

    parity.activateParityHarness({
      fixture: 'confirmed-safe',
      nowISO: '2026-08-18T08:00:00.000Z',
      screen: 'pdf-success',
      sheet: null,
      theme: 'light',
      globalSurface: null,
    });
    parity.applyParityRuntimeControl({ screen: 'image-success', sheet: undefined, theme: 'dark' });

    expect(store.getPersistBlob()).toBe(before);
    expect(store.getState().currentBalance.amount).toBe(123.45);
    expect(globalThis.Date).toBe(realDate);
    expect(parity.getParityRuntimeControl()).toBeNull();
  });

  it('never places parity fixtures or demo money in the normal persistence partition', async () => {
    const store = await import('../store');
    store.resetToEmpty({ onboardingDone: false });
    const state = store.getState();
    const blob = store.getPersistBlob();

    expect(state.currentBalance.amount).toBe(0);
    expect(state.transactions).toEqual([]);
    expect(state.pots).toEqual([]);
    expect(state.subs).toEqual([]);
    expect(state.readerCandidates).toEqual([]);
    expect(blob).not.toContain('fixture-');
    expect(blob).not.toContain('parity-statement');
    expect(blob).not.toContain('confirmed-safe');
  });

  it('accepts the separate QA scheme only in an explicitly configured capture process', async () => {
    vi.stubEnv('EXPO_PUBLIC_MELO_PARITY_CAPTURE', 'true');
    linking.getInitialURL.mockResolvedValue('folio-qa://parity?screen=plan&theme=dark');
    const parity = await import('./parityHarness');

    parity.startParityRuntimeControl();
    await Promise.resolve();

    expect(linking.addEventListener).toHaveBeenCalledWith('url', expect.any(Function));
    expect(parity.getParityRuntimeControl()).toMatchObject({ screen: 'plan', theme: 'dark' });
  });
});
