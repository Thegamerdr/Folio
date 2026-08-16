// Melo reaction bus — faithful 1:1 RN port of the web prototype
// (folio-melo/.claude/worktrees/design-main/src/lib/melo/reactionBus.ts).
//
// MELO_EMOTIONAL_ENGINE.md § 3 defines the reaction catalogue. The queue, cooldown table, and
// "strongest wins" resolution are a SEPARATE, larger engine (`meloReactions`, ENGINES.md § 9.4) —
// this file is only the tiny pub/sub transport the web original shipped: it does NOT persist, does
// NOT enforce cooldowns, and does NOT dedupe. No new dependency — a Map<string, Set<fn>>.
//
// A trigger fires via `emitMeloReaction(channel, payload)`. Components subscribe with
// `subscribeMeloReaction(channel, cb)`. Channels are ad-hoc string keys — "today-header",
// "pots-inline", "subs-inline" — matching the web's channel names exactly so a future store-level
// emit (e.g. a pot crossing its goal) reaches the same RN screens with zero renaming.

import type { MeloMood, MeloPose } from '@/folio/melo/Melo';

export type MeloReactionPayload = {
  mood: MeloMood;
  pose: MeloPose;
  line: string;
  durationMs: number;
  /** Optional key to scope inline previews (e.g. a pot id or sub name). */
  key?: string;
  /** Optional semantic event consumed by the one persistent companion engine. */
  eventType?: string;
  eventPriority?: 'low' | 'normal' | 'high' | 'critical';
  eventIntensity?: 'small' | 'normal' | 'major';
  eventDirection?: 'improved' | 'worsened' | 'left' | 'right';
};

type Channel = string;
type Listener = (p: MeloReactionPayload) => void;
type AllListener = (channel: Channel, payload: MeloReactionPayload) => void;

const listeners: Map<Channel, Set<Listener>> = new Map();
const allListeners = new Set<AllListener>();

export function subscribeMeloReaction(channel: Channel, cb: Listener): () => void {
  const set = listeners.get(channel) ?? new Set<Listener>();
  set.add(cb);
  listeners.set(channel, set);
  return () => {
    set.delete(cb);
  };
}

export function emitMeloReaction(channel: Channel, payload: MeloReactionPayload): void {
  const set = listeners.get(channel);
  if (set) for (const cb of set) cb(payload);
  for (const cb of allListeners) cb(channel, payload);
}

/** Subscribe the single root companion to truthful reactions from every product surface. */
export function subscribeAllMeloReactions(cb: AllListener): () => void {
  allListeners.add(cb);
  return () => {
    allListeners.delete(cb);
  };
}
