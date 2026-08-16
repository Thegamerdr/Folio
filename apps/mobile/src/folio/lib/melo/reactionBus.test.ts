// reactionBus tests — pure pub/sub logic (no RN runtime, no DOM), matching the
// project's `.test.ts`-only collection convention (see vitest.config.ts).

import { describe, expect, it, vi } from 'vitest';

import {
  emitMeloReaction,
  subscribeAllMeloReactions,
  subscribeMeloReaction,
  type MeloReactionPayload,
} from './reactionBus';

function payload(overrides: Partial<MeloReactionPayload> = {}): MeloReactionPayload {
  return {
    mood: 'calm',
    pose: 'none',
    line: 'quietly working',
    durationMs: 3000,
    ...overrides,
  };
}

describe('reactionBus', () => {
  it('delivers an emitted payload to a subscriber on the same channel', () => {
    const cb = vi.fn();
    subscribeMeloReaction('pots-inline', cb);

    const p = payload({ key: 'holiday' });
    emitMeloReaction('pots-inline', p);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(p);
  });

  it('does not deliver to a subscriber on a different channel', () => {
    const cb = vi.fn();
    subscribeMeloReaction('pots-inline', cb);

    emitMeloReaction('subs-inline', payload());

    expect(cb).not.toHaveBeenCalled();
  });

  it('fans out to every subscriber on the channel', () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeMeloReaction('today-header', a);
    subscribeMeloReaction('today-header', b);

    emitMeloReaction('today-header', payload());

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops delivering once unsubscribed', () => {
    const cb = vi.fn();
    const unsub = subscribeMeloReaction('pots-inline', cb);

    unsub();
    emitMeloReaction('pots-inline', payload());

    expect(cb).not.toHaveBeenCalled();
  });

  it('unsubscribing one listener does not affect another on the same channel', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeMeloReaction('subs-inline', a);
    subscribeMeloReaction('subs-inline', b);

    unsubA();
    emitMeloReaction('subs-inline', payload());

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('emitting on a channel with no subscribers is a safe no-op', () => {
    expect(() => emitMeloReaction('nobody-listening', payload())).not.toThrow();
  });

  it('does not dedupe or debounce — every emit reaches the subscriber', () => {
    // Per the doc comment: this bus has no cooldown/queue/dedupe (that is the separate
    // `meloReactions` engine). Two emits on the same channel must both arrive.
    const cb = vi.fn();
    subscribeMeloReaction('pots-inline', cb);

    emitMeloReaction('pots-inline', payload({ key: 'a' }));
    emitMeloReaction('pots-inline', payload({ key: 'b' }));

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('delivers semantic product reactions to the persistent root subscriber', () => {
    const cb = vi.fn();
    const unsubscribe = subscribeAllMeloReactions(cb);
    const p = payload({ eventType: 'POT_GOAL_HIT', eventIntensity: 'major' });

    emitMeloReaction('pots-inline', p);

    expect(cb).toHaveBeenCalledWith('pots-inline', p);
    unsubscribe();
  });
});
