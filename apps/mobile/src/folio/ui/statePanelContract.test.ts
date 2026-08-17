import { describe, expect, it } from 'vitest';

import { PRODUCT_STATE_KINDS, stateVisual } from './statePanelContract';

describe('shared product state contract', () => {
  it('covers every required state family with a non-colour icon affordance', () => {
    expect(PRODUCT_STATE_KINDS).toHaveLength(13);
    for (const kind of PRODUCT_STATE_KINDS) {
      expect(stateVisual(kind).icon.length).toBeGreaterThan(0);
    }
  });

  it('keeps failure, waiting and success visually distinct', () => {
    expect(stateVisual('error')).toEqual({ icon: 'warning', tone: 'repair' });
    expect(stateVisual('offline')).toEqual({ icon: 'offline', tone: 'warm' });
    expect(stateVisual('queued')).toEqual({ icon: 'queued', tone: 'neutral' });
    expect(stateVisual('success')).toEqual({ icon: 'success', tone: 'positive' });
  });
});
