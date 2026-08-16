/**
 * Pure behaviour policy for Fenice. This module intentionally knows nothing
 * about React, DOM nodes or a particular renderer. It turns durable memory and
 * truthful product events into calm, bounded companion behaviour.
 */

export const PERSONALITY = Object.freeze({
  temperament: 'calm-observant-supportive',
  principles: Object.freeze([
    'finance-remains-primary',
    'notice-before-reacting',
    'celebrate-the-user-not-the-companion',
    'concern-without-shame',
    'silence-is-a-valid-response',
    'familiarity-reduces-noise',
  ]),
});

export const RELATIONSHIP_STAGE = Object.freeze({
  NEW: 'new',
  FAMILIAR: 'familiar',
  TRUSTED: 'trusted',
});

export const EVENT_CHANNEL = Object.freeze({
  LIFECYCLE: 'lifecycle',
  ROUTE: 'route',
  ATTENTION: 'attention',
  TASK: 'task',
  FINANCIAL: 'financial',
  USER: 'user',
  AMBIENT: 'ambient',
});

const STAGE_POLICY = Object.freeze({
  [RELATIONSHIP_STAGE.NEW]: Object.freeze({
    entryStyle: 'peek',
    waitFactor: 1,
    attentionHoldMs: 3600,
    idleMinMs: 18000,
    idleMaxMs: 30000,
    maxAmbientPerWindow: 2,
    ambientWindowMs: 90000,
    bubbleCooldownMs: 45000,
    maxProactiveBubblesPerSession: 3,
    restFactor: 1,
  }),
  [RELATIONSHIP_STAGE.FAMILIAR]: Object.freeze({
    entryStyle: 'contextual',
    waitFactor: 0.78,
    attentionHoldMs: 3000,
    idleMinMs: 22000,
    idleMaxMs: 38000,
    maxAmbientPerWindow: 2,
    ambientWindowMs: 110000,
    bubbleCooldownMs: 65000,
    maxProactiveBubblesPerSession: 2,
    restFactor: 0.92,
  }),
  [RELATIONSHIP_STAGE.TRUSTED]: Object.freeze({
    entryStyle: 'settle',
    waitFactor: 0.58,
    attentionHoldMs: 2600,
    idleMinMs: 28000,
    idleMaxMs: 48000,
    maxAmbientPerWindow: 1,
    ambientWindowMs: 120000,
    bubbleCooldownMs: 90000,
    maxProactiveBubblesPerSession: 1,
    restFactor: 0.85,
  }),
});

export function relationshipStage(relationship = {}) {
  if (
    (Number(relationship.sessions) >= 5 && Number(relationship.interactions) >= 10) ||
    Number(relationship.familiarity) >= 0.75
  ) {
    return RELATIONSHIP_STAGE.TRUSTED;
  }
  if (
    (Number(relationship.sessions) >= 2 && Number(relationship.interactions) >= 3) ||
    Number(relationship.familiarity) >= 0.25
  ) {
    return RELATIONSHIP_STAGE.FAMILIAR;
  }
  return RELATIONSHIP_STAGE.NEW;
}

export function normalizeRelationship(value) {
  const relationship = value && typeof value === 'object' ? value : {};
  const normalized = {
    sessions: Number.isFinite(relationship.sessions) ? relationship.sessions : 0,
    interactions: Number.isFinite(relationship.interactions) ? relationship.interactions : 0,
    familiarity: Math.max(0, Math.min(1, Number(relationship.familiarity) || 0)),
    visits: { ...(relationship.visits ?? {}) },
    lastScreen: relationship.lastScreen ?? null,
    lastSeen: Number.isFinite(relationship.lastSeen) ? relationship.lastSeen : 0,
  };
  normalized.stage = relationshipStage(normalized);
  return normalized;
}

export function deriveBehaviorPolicy({ relationship, quiet = false, reducedMotion = false } = {}) {
  const stage = relationshipStage(relationship);
  const base = STAGE_POLICY[stage];
  return {
    ...base,
    stage,
    entryStyle: reducedMotion ? 'settle' : base.entryStyle,
    maxAmbientPerWindow: quiet || reducedMotion ? 0 : base.maxAmbientPerWindow,
    maxProactiveBubblesPerSession: quiet ? 0 : base.maxProactiveBubblesPerSession,
    animationEnabled: !reducedMotion,
    proactiveSpeechEnabled: !quiet,
  };
}

export function normalizeBehaviorMemory(value) {
  const memory = value && typeof value === 'object' ? value : {};
  return {
    recentReactions: Array.isArray(memory.recentReactions) ? memory.recentReactions.slice(-8) : [],
    recentScreens: Array.isArray(memory.recentScreens) ? memory.recentScreens.slice(-8) : [],
    dismissedOffers: { ...(memory.dismissedOffers ?? {}) },
    engagedOffers: { ...(memory.engagedOffers ?? {}) },
    lastOfferByScreen: { ...(memory.lastOfferByScreen ?? {}) },
    lastBubbleAt: Number.isFinite(memory.lastBubbleAt) ? memory.lastBubbleAt : 0,
    proactiveBubblesThisSession: Number.isFinite(memory.proactiveBubblesThisSession)
      ? Math.max(0, memory.proactiveBubblesThisSession)
      : 0,
    sessionId: memory.sessionId ?? null,
    greetingShownInSession: Boolean(memory.greetingShownInSession),
    ambientWindowStartedAt: Number.isFinite(memory.ambientWindowStartedAt)
      ? memory.ambientWindowStartedAt
      : 0,
    ambientCount: Number.isFinite(memory.ambientCount) ? Math.max(0, memory.ambientCount) : 0,
    idleSequence: Number.isFinite(memory.idleSequence) ? Math.max(0, memory.idleSequence) : 0,
    lastMeaningfulEvent: memory.lastMeaningfulEvent ?? null,
  };
}

export function eventPolicy(event = {}) {
  const type = String(event.type ?? '');
  const priority = event.priority ?? 'normal';
  const completion =
    /(_END|_ENDED|_FINISHED|_COMPLETED|_RESOLVED)$/.test(type) ||
    ['THINKING_END', 'RECALCULATION_END', 'ANALYSIS_ENDED', 'IMPORT_FINISHED'].includes(type);
  const lifecycle = [
    'TYPING_STARTED',
    'TYPING_ENDED',
    'MODAL_OPENED',
    'MODAL_CLOSED',
    'APP_HIDDEN',
    'APP_VISIBLE',
    'APP_RESUMED',
    'TUCK',
    'UNTUCK',
    'WAKE',
  ].includes(type);
  const requiresImmediateAttention = ['ACTION_REQUIRED', 'WAITING_INPUT'].includes(type);
  const user = ['USER_INTERACTION', 'USER_INTERACT', 'SCREEN_INTERACTION'].includes(type);
  const route = ['NAVIGATE', 'ROUTE_CHANGED'].includes(type);
  const task = /(START|STARTED|THINKING|RECALCULATION|IMPORT|FILING)/.test(type);
  const channel = lifecycle
    ? EVENT_CHANNEL.LIFECYCLE
    : route
      ? EVENT_CHANNEL.ROUTE
      : user
        ? EVENT_CHANNEL.USER
        : task
          ? EVENT_CHANNEL.TASK
          : EVENT_CHANNEL.FINANCIAL;
  const prioritySeverity =
    priority === 'critical' ? 4 : priority === 'high' ? 3 : priority === 'low' ? 1 : 2;
  const intensitySeverity = event.intensity === 'major' ? 3 : event.intensity === 'small' ? 1 : 2;
  const severity = Math.max(prioritySeverity, intensitySeverity);
  const family = type
    .replace(/_(START|STARTED|END|ENDED|FINISHED|COMPLETED|OPENED|CLOSED|RESOLVED)$/, '')
    .replace(/_(IMPROVED|WORSENED)$/, '');
  return {
    channel,
    severity,
    completion,
    forceInterrupt:
      lifecycle || completion || requiresImmediateAttention || priority === 'critical',
    interruptible: event.interruptible !== false,
    cooldownMs: Number.isFinite(event.cooldownMs)
      ? Math.max(0, event.cooldownMs)
      : severity >= 3
        ? 12000
        : severity === 2
          ? 8000
          : 15000,
    ttlMs: Number.isFinite(event.ttlMs)
      ? Math.max(0, event.ttlMs)
      : lifecycle
        ? 30000
        : severity >= 3
          ? 15000
          : 7000,
    // Events in the same semantic family are combined even when several cards
    // or accounts emit them at once. Hosts can opt out with an explicit key.
    coalesceKey: event.coalesceKey ?? family,
    cooldownKey: event.cooldownKey ?? family,
  };
}

export function canInterrupt(activeReaction, nextPolicy, at) {
  if (!activeReaction || at >= activeReaction.until) return true;
  if (nextPolicy.forceInterrupt) return true;
  if (activeReaction.interruptible === false) return false;
  return nextPolicy.severity > activeReaction.severity;
}

export function createAttention(
  target,
  { at = 0, reason = 'context', salience = 0.5, holdMs = 3000, source = null } = {},
) {
  if (!target) return null;
  return {
    target,
    reason,
    source,
    salience: Math.max(0, Math.min(1, Number(salience) || 0)),
    acquiredAt: at,
    expiresAt: at + Math.max(0, holdMs),
  };
}

export function shouldAcceptAttention(current, next, at) {
  if (!next) return false;
  if (!current || at >= current.expiresAt) return true;
  return next.salience >= current.salience;
}

function stableUnit(seed) {
  let hash = 2166136261;
  const text = String(seed);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function nextIdleDelay(policy, seed) {
  const span = Math.max(0, policy.idleMaxMs - policy.idleMinMs);
  return Math.round(policy.idleMinMs + stableUnit(seed) * span);
}

export function selectIdleBeat({
  sequence = 0,
  gazeDirection = 'right',
  recentReactions = [],
} = {}) {
  const choices =
    gazeDirection === 'left'
      ? ['gaze-left', 'idle-curious', 'gaze-up', 'idle-calm']
      : ['gaze-right', 'idle-curious', 'gaze-up', 'idle-calm'];
  const recent = new Set(recentReactions.slice(-2).map((entry) => entry.visualState ?? entry));
  const start = sequence % choices.length;
  for (let offset = 0; offset < choices.length; offset += 1) {
    const candidate = choices[(start + offset) % choices.length];
    if (!recent.has(candidate)) return candidate;
  }
  return 'idle-calm';
}

export function resetAmbientWindow(memory, policy, at) {
  if (
    !memory.ambientWindowStartedAt ||
    at - memory.ambientWindowStartedAt >= policy.ambientWindowMs
  ) {
    memory.ambientWindowStartedAt = at;
    memory.ambientCount = 0;
  }
  return memory;
}

export function canRunAmbient(memory, policy, at) {
  resetAmbientWindow(memory, policy, at);
  return policy.maxAmbientPerWindow > 0 && memory.ambientCount < policy.maxAmbientPerWindow;
}

export function shouldOfferBubble(
  memory,
  policy,
  { at, screen, actionId, userInitiated = false, critical = false } = {},
) {
  if (userInitiated) return true;
  if (!policy.proactiveSpeechEnabled) return false;
  if (critical) return true;
  if (memory.proactiveBubblesThisSession >= policy.maxProactiveBubblesPerSession) return false;
  if (memory.lastBubbleAt && at - memory.lastBubbleAt < policy.bubbleCooldownMs) return false;
  const screenLast = memory.lastOfferByScreen[screen] ?? 0;
  if (screenLast && at - screenLast < policy.bubbleCooldownMs * 2) return false;
  if ((memory.dismissedOffers[actionId] ?? 0) >= 2 && !(memory.engagedOffers[actionId] > 0))
    return false;
  return true;
}

export function rememberReaction(memory, entry) {
  memory.recentReactions = [...memory.recentReactions, entry].slice(-8);
  if (entry.meaningful) memory.lastMeaningfulEvent = entry;
  return memory;
}

export function rememberScreen(memory, screen, at) {
  if (!screen) return memory;
  memory.recentScreens = [...memory.recentScreens, { screen, at }].slice(-8);
  return memory;
}

export function rememberBubble(memory, { actionId, screen, at, userInitiated = false } = {}) {
  memory.lastBubbleAt = at;
  if (screen) memory.lastOfferByScreen[screen] = at;
  if (!userInitiated) memory.proactiveBubblesThisSession += 1;
  return memory;
}

export function rememberBubbleOutcome(memory, actionId, outcome) {
  if (!actionId) return memory;
  const bucket = outcome === 'engaged' ? memory.engagedOffers : memory.dismissedOffers;
  bucket[actionId] = (bucket[actionId] ?? 0) + 1;
  return memory;
}
