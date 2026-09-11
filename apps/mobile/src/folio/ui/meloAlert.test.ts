import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeloAlert, dismissMeloAlert, getMeloAlert, pressMeloAlert } from './meloAlert';
afterEach(() => {
  while (getMeloAlert()) pressMeloAlert(getMeloAlert()!.id, 0);
});
describe('product confirmation boundaries', () => {
  it('never performs the commit when dismissed and settles cancellation once', () => {
    const commit = vi.fn();
    const cancel = vi.fn();
    MeloAlert.alert('Record payment?', 'No bank transfer.', [
      { text: 'Back', style: 'cancel', onPress: cancel },
      { text: 'Record', onPress: commit },
    ]);
    const id = getMeloAlert()!.id;
    dismissMeloAlert(id);
    dismissMeloAlert(id);
    expect(commit).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('runs an explicit action once even after duplicate taps and preserves a follow-up dialog', () => {
    const commit = vi.fn(() => MeloAlert.alert('Recorded'));
    MeloAlert.alert('Record?', '', [{ text: 'Record', onPress: commit }]);
    const id = getMeloAlert()!.id;
    pressMeloAlert(id, 0);
    pressMeloAlert(id, 0);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(getMeloAlert()?.title).toBe('Recorded');
  });
  it('respects non-dismissible workflows and invokes their chosen action', () => {
    const action = vi.fn();
    MeloAlert.alert('Resolve this', '', [{ text: 'Continue', onPress: action }], {
      cancelable: false,
    });
    const id = getMeloAlert()!.id;
    dismissMeloAlert(id);
    expect(getMeloAlert()?.id).toBe(id);
    expect(action).not.toHaveBeenCalled();
    pressMeloAlert(id, 0);
    expect(action).toHaveBeenCalledTimes(1);
  });
  it('uses the caller dismissal handler without firing a second cancellation callback', () => {
    const dismiss = vi.fn();
    const cancel = vi.fn();
    MeloAlert.alert('Review', '', [{ text: 'Back', style: 'cancel', onPress: cancel }], {
      onDismiss: dismiss,
    });
    dismissMeloAlert(getMeloAlert()!.id);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });
});
