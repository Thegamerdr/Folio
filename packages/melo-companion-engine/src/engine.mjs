import {
  DEFAULT_COMPANION_SIZE,
  clampRect,
  rectsIntersect,
  resolvePlacement,
} from './placement.mjs';
import { createMemoryPersistence, PERSISTED_KEYS } from './persistence.mjs';
import { resolveVisualAsset } from './renderer-adapter.mjs';
import { resolveScreenProfile, resolveScreenReaction } from './screen-profiles.mjs';
import {
  PERSONALITY,
  canInterrupt,
  canRunAmbient,
  createAttention,
  deriveBehaviorPolicy,
  eventPolicy,
  nextIdleDelay,
  normalizeBehaviorMemory,
  normalizeRelationship,
  relationshipStage,
  rememberBubble,
  rememberBubbleOutcome,
  rememberReaction,
  rememberScreen,
  resetAmbientWindow,
  selectIdleBeat,
  shouldAcceptAttention,
  shouldOfferBubble,
} from './behavior.mjs';

export const PRESENCE = Object.freeze({
  HIDDEN: 'hidden',
  WAITING: 'waiting',
  ENTERING: 'entering',
  PEEKING: 'peeking',
  MOVING: 'moving',
  PERCHED: 'perched',
  OFFERING_HELP: 'offering-help',
  ENGAGED: 'engaged',
  LEAVING: 'leaving',
  RESTING: 'resting',
  DRAGGING: 'dragging',
  TUCKED: 'tucked',
});

export const EVENTS = Object.freeze({
  // Portable aliases used by the host's FeniceEvent union.
  APP_RESUMED: 'APP_RESUMED',
  BEFORE_SPEND_ASKED: 'BEFORE_SPEND_ASKED',
  BEFORE_SPEND_RESULT: 'BEFORE_SPEND_RESULT',
  BILL_SHIELD_ARMED: 'BILL_SHIELD_ARMED',
  BLOCKED: 'BLOCKED',
  BUSINESS_FILING_DUE: 'BUSINESS_FILING_DUE',
  CYCLE_CLOSED: 'CYCLE_CLOSED',
  DEBT_CLEARED: 'DEBT_CLEARED',
  FILING_COMPLETED: 'FILING_COMPLETED',
  FILING_FAILED: 'FILING_FAILED',
  FILING_STARTED: 'FILING_STARTED',
  FIRST_ANSWER: 'FIRST_ANSWER',
  GUIDE: 'GUIDE',
  IDLE_TIMEOUT: 'IDLE_TIMEOUT',
  IMPORTANT_BILL_COVERED: 'IMPORTANT_BILL_COVERED',
  IMPORT_FAILED: 'IMPORT_FAILED',
  INVOICE_CREATED: 'INVOICE_CREATED',
  INVOICE_OVERDUE: 'INVOICE_OVERDUE',
  INVOICE_PAID: 'INVOICE_PAID',
  INVOICE_SENT: 'INVOICE_SENT',
  ONLINE: 'ONLINE',
  PAYDAY: 'PAYDAY',
  POT_ADDED: 'POT_ADDED',
  POT_BORROWED: 'POT_BORROWED',
  POT_GOAL_HIT: 'POT_GOAL_HIT',
  POT_HALFWAY: 'POT_HALFWAY',
  RECALCULATION_END: 'RECALCULATION_END',
  RECALCULATION_START: 'RECALCULATION_START',
  RECOVERY_ENTER: 'RECOVERY_ENTER',
  RECOVERY_EXIT: 'RECOVERY_EXIT',
  REVIEWED: 'REVIEWED',
  REVIEW_COMPLETED: 'REVIEW_COMPLETED',
  RITUAL_COMPLETED: 'RITUAL_COMPLETED',
  RITUAL_STEP_CONFIRMED: 'RITUAL_STEP_CONFIRMED',
  ROUTE_CHANGED: 'ROUTE_CHANGED',
  RUNWAY_CHANGED: 'RUNWAY_CHANGED',
  SHORTFALL_OPENED: 'SHORTFALL_OPENED',
  SHORTFALL_RESOLVED: 'SHORTFALL_RESOLVED',
  STATEMENT_IMPORTED: 'STATEMENT_IMPORTED',
  SUB_CAUGHT: 'SUB_CAUGHT',
  SUB_PAUSED: 'SUB_PAUSED',
  SUB_RESUMED: 'SUB_RESUMED',
  TAX_OBLIGATION_RESOLVED: 'TAX_OBLIGATION_RESOLVED',
  THINKING_START: 'THINKING_START',
  THINKING_END: 'THINKING_END',
  TIGHT_POINT_REACHED: 'TIGHT_POINT_REACHED',
  TUCK: 'TUCK',
  UNTUCK: 'UNTUCK',
  USER_INTERACT: 'USER_INTERACT',
  VAT_DUE: 'VAT_DUE',
  WAITING_INPUT: 'WAITING_INPUT',
  WHAT_CHANGED: 'WHAT_CHANGED',
  NAVIGATE: 'NAVIGATE',
  USER_INTERACTION: 'USER_INTERACTION',
  SCREEN_INTERACTION: 'SCREEN_INTERACTION',
  SAFE_ZONE_CHANGED: 'SAFE_ZONE_CHANGED',
  BILL_RISK: 'BILL_RISK',
  SPEND_CHECK: 'SPEND_CHECK',
  PLAN_RECALCULATED: 'PLAN_RECALCULATED',
  ANALYSIS_STARTED: 'ANALYSIS_STARTED',
  ANALYSIS_ENDED: 'ANALYSIS_ENDED',
  IMPORT_STARTED: 'IMPORT_STARTED',
  IMPORT_FINISHED: 'IMPORT_FINISHED',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  SUCCESS: 'SUCCESS',
  GOAL_PROGRESS: 'GOAL_PROGRESS',
  DEBT_MILESTONE: 'DEBT_MILESTONE',
  RECOVERY: 'RECOVERY',
  ERROR: 'ERROR',
  OFFLINE: 'OFFLINE',
  EMPTY_STATE: 'EMPTY_STATE',
  TYPING_STARTED: 'TYPING_STARTED',
  TYPING_ENDED: 'TYPING_ENDED',
  MODAL_OPENED: 'MODAL_OPENED',
  MODAL_CLOSED: 'MODAL_CLOSED',
  APP_HIDDEN: 'APP_HIDDEN',
  APP_VISIBLE: 'APP_VISIBLE',
  WAKE: 'WAKE',
  SESSION_STARTED: 'SESSION_STARTED',
});

const PRIORITY = Object.freeze({ low: 1, normal: 2, high: 3, critical: 4 });
const TRANSIENT_VISUALS = new Set([
  'idle-curious',
  'gaze-left',
  'gaze-right',
  'gaze-up',
  'gaze-down',
  'notice-user',
  'peek',
  'settle',
  'concern-small',
  'concern-major',
  'reassurance',
  'positive-small',
  'positive-major',
  'result-acknowledgement',
  'blocked',
  'waiting-for-user',
]);
const REACTION_EVENT_TYPES = Object.freeze([
  EVENTS.SAFE_ZONE_CHANGED,
  EVENTS.BILL_RISK,
  EVENTS.SPEND_CHECK,
  EVENTS.SUCCESS,
  EVENTS.GOAL_PROGRESS,
  EVENTS.DEBT_MILESTONE,
  EVENTS.RECOVERY,
  EVENTS.ERROR,
  EVENTS.OFFLINE,
  EVENTS.ACTION_REQUIRED,
  EVENTS.USER_INTERACTION,
  EVENTS.USER_INTERACT,
  EVENTS.BEFORE_SPEND_ASKED,
  EVENTS.BEFORE_SPEND_RESULT,
  EVENTS.BILL_SHIELD_ARMED,
  EVENTS.BLOCKED,
  EVENTS.BUSINESS_FILING_DUE,
  EVENTS.CYCLE_CLOSED,
  EVENTS.DEBT_CLEARED,
  EVENTS.FILING_COMPLETED,
  EVENTS.FILING_FAILED,
  EVENTS.FILING_STARTED,
  EVENTS.FIRST_ANSWER,
  EVENTS.GUIDE,
  EVENTS.IMPORTANT_BILL_COVERED,
  EVENTS.IMPORT_FAILED,
  EVENTS.INVOICE_CREATED,
  EVENTS.INVOICE_OVERDUE,
  EVENTS.INVOICE_PAID,
  EVENTS.INVOICE_SENT,
  EVENTS.PAYDAY,
  EVENTS.POT_ADDED,
  EVENTS.POT_BORROWED,
  EVENTS.POT_GOAL_HIT,
  EVENTS.POT_HALFWAY,
  EVENTS.RECALCULATION_START,
  EVENTS.RECALCULATION_END,
  EVENTS.RECOVERY_ENTER,
  EVENTS.RECOVERY_EXIT,
  EVENTS.REVIEWED,
  EVENTS.REVIEW_COMPLETED,
  EVENTS.RITUAL_COMPLETED,
  EVENTS.RITUAL_STEP_CONFIRMED,
  EVENTS.ROUTE_CHANGED,
  EVENTS.RUNWAY_CHANGED,
  EVENTS.SHORTFALL_OPENED,
  EVENTS.SHORTFALL_RESOLVED,
  EVENTS.STATEMENT_IMPORTED,
  EVENTS.SUB_CAUGHT,
  EVENTS.SUB_PAUSED,
  EVENTS.SUB_RESUMED,
  EVENTS.TAX_OBLIGATION_RESOLVED,
  EVENTS.THINKING_START,
  EVENTS.THINKING_END,
  EVENTS.TIGHT_POINT_REACHED,
  EVENTS.VAT_DUE,
  EVENTS.WAITING_INPUT,
  EVENTS.WHAT_CHANGED,
  EVENTS.EMPTY_STATE,
  EVENTS.APP_RESUMED,
  EVENTS.ONLINE,
]);
const REACTION_EVENTS = new Set(REACTION_EVENT_TYPES);
const ATTENTION_EVENTS = new Set([
  EVENTS.SCREEN_INTERACTION,
  EVENTS.USER_INTERACTION,
  EVENTS.USER_INTERACT,
  EVENTS.GUIDE,
]);
const USER_RELATIONSHIP_EVENTS = new Set([EVENTS.USER_INTERACTION, EVENTS.USER_INTERACT]);
const FINANCIAL_EVENTS = new Set([
  EVENTS.SAFE_ZONE_CHANGED,
  EVENTS.BILL_RISK,
  EVENTS.SPEND_CHECK,
  EVENTS.SUCCESS,
  EVENTS.GOAL_PROGRESS,
  EVENTS.DEBT_MILESTONE,
  EVENTS.DEBT_CLEARED,
  EVENTS.RECOVERY,
  EVENTS.RECOVERY_ENTER,
  EVENTS.RECOVERY_EXIT,
  EVENTS.ERROR,
  EVENTS.OFFLINE,
  EVENTS.RUNWAY_CHANGED,
  EVENTS.TIGHT_POINT_REACHED,
  EVENTS.SHORTFALL_OPENED,
  EVENTS.SHORTFALL_RESOLVED,
  EVENTS.PAYDAY,
  EVENTS.POT_ADDED,
  EVENTS.POT_BORROWED,
  EVENTS.POT_GOAL_HIT,
  EVENTS.POT_HALFWAY,
  EVENTS.SUB_CAUGHT,
  EVENTS.SUB_PAUSED,
  EVENTS.SUB_RESUMED,
  EVENTS.INVOICE_CREATED,
  EVENTS.INVOICE_SENT,
  EVENTS.INVOICE_PAID,
  EVENTS.INVOICE_OVERDUE,
  EVENTS.VAT_DUE,
  EVENTS.TAX_OBLIGATION_RESOLVED,
  EVENTS.BUSINESS_FILING_DUE,
  EVENTS.FILING_COMPLETED,
  EVENTS.FILING_FAILED,
  EVENTS.IMPORTANT_BILL_COVERED,
  EVENTS.BILL_SHIELD_ARMED,
  EVENTS.BEFORE_SPEND_ASKED,
  EVENTS.BEFORE_SPEND_RESULT,
  EVENTS.WHAT_CHANGED,
]);

function nowMs(clock) {
  return typeof clock === 'function' ? clock() : Date.now();
}

function priorityValue(priority) {
  return PRIORITY[priority] ?? PRIORITY.normal;
}

function normalizeWardrobe(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean)[0] ?? null;
  if (typeof value === 'object') return value.active ?? null;
  return null;
}

function visualFor(event) {
  switch (event.type) {
    case EVENTS.APP_RESUMED:
    case EVENTS.ONLINE:
      return 'notice-user';
    case EVENTS.EMPTY_STATE:
      return 'idle-curious';
    case EVENTS.GUIDE:
      return 'notice-user';
    case EVENTS.THINKING_START:
    case EVENTS.RECALCULATION_START:
    case EVENTS.FILING_STARTED:
    case EVENTS.IMPORT_STARTED:
    case EVENTS.PLAN_RECALCULATED:
    case EVENTS.ANALYSIS_STARTED:
      return 'thinking-loop';
    case EVENTS.THINKING_END:
    case EVENTS.RECALCULATION_END:
    case EVENTS.STATEMENT_IMPORTED:
    case EVENTS.REVIEW_COMPLETED:
    case EVENTS.IMPORT_FINISHED:
    case EVENTS.ANALYSIS_ENDED:
      return 'settle';
    case EVENTS.RUNWAY_CHANGED:
    case EVENTS.TIGHT_POINT_REACHED:
    case EVENTS.SAFE_ZONE_CHANGED:
      return event.direction === 'improved' ? 'positive-small' : 'concern-small';
    case EVENTS.ROUTE_CHANGED:
      return event.direction === 'left' ? 'move-short-left' : 'move-short-right';
    case EVENTS.SHORTFALL_OPENED:
    case EVENTS.BUSINESS_FILING_DUE:
    case EVENTS.VAT_DUE:
    case EVENTS.INVOICE_OVERDUE:
    case EVENTS.BILL_RISK:
      return event.intensity === 'major' ? 'concern-major' : 'concern-small';
    case EVENTS.SHORTFALL_RESOLVED:
    case EVENTS.RECOVERY_ENTER:
    case EVENTS.RECOVERY_EXIT:
    case EVENTS.RECOVERY:
    case EVENTS.BILL_SHIELD_ARMED:
    case EVENTS.IMPORTANT_BILL_COVERED:
      return 'reassurance';
    case EVENTS.POT_GOAL_HIT:
    case EVENTS.DEBT_CLEARED:
    case EVENTS.PAYDAY:
    case EVENTS.CYCLE_CLOSED:
    case EVENTS.RITUAL_COMPLETED:
    case EVENTS.FILING_COMPLETED:
      return 'positive-major';
    case EVENTS.POT_ADDED:
    case EVENTS.POT_BORROWED:
    case EVENTS.POT_HALFWAY:
    case EVENTS.SUB_PAUSED:
    case EVENTS.SUB_RESUMED:
    case EVENTS.RITUAL_STEP_CONFIRMED:
    case EVENTS.INVOICE_PAID:
    case EVENTS.TAX_OBLIGATION_RESOLVED:
    case EVENTS.BEFORE_SPEND_RESULT:
    case EVENTS.SPEND_CHECK:
      return event.outcome === 'safe' || event.direction === 'improved'
        ? 'positive-small'
        : 'concern-small';
    case EVENTS.INVOICE_CREATED:
    case EVENTS.INVOICE_SENT:
      return 'result-acknowledgement';
    case EVENTS.BEFORE_SPEND_ASKED:
    case EVENTS.SUB_CAUGHT:
    case EVENTS.WAITING_INPUT:
      return 'waiting-for-user';
    case EVENTS.IMPORT_FAILED:
    case EVENTS.FILING_FAILED:
    case EVENTS.BLOCKED:
      return 'blocked';
    case EVENTS.REVIEWED:
    case EVENTS.FIRST_ANSWER:
    case EVENTS.WHAT_CHANGED:
    case EVENTS.USER_INTERACT:
      return 'result-acknowledgement';
    case EVENTS.SUCCESS:
    case EVENTS.GOAL_PROGRESS:
      return event.intensity === 'major' ? 'positive-major' : 'positive-small';
    case EVENTS.DEBT_MILESTONE:
      return event.intensity === 'small' ? 'positive-small' : 'positive-major';
    case EVENTS.ACTION_REQUIRED:
      return 'waiting-for-user';
    case EVENTS.ERROR:
    case EVENTS.OFFLINE:
      return 'blocked';
    case EVENTS.USER_INTERACTION:
      return 'result-acknowledgement';
    default:
      return null;
  }
}

/** Resolve the visual reaction for a declared event without mutating engine state. */
export function resolveEventVisual(event) {
  return visualFor(event);
}

export { REACTION_EVENT_TYPES };

function reactionDuration(event, timings) {
  if (event.type === EVENTS.IMPORT_FINISHED || event.type === EVENTS.ANALYSIS_ENDED) {
    return timings.settle;
  }
  if (event.type === EVENTS.ACTION_REQUIRED) return timings.bubble;
  return timings.reaction;
}

function directionForPlacement(placement, shell) {
  if (!placement?.rect || !shell) return 'right';
  const center = placement.rect.x + placement.rect.width / 2;
  const shellCenter = shell.x + shell.width / 2;
  return center < shellCenter ? 'right' : 'left';
}

export class CompanionEngine {
  constructor({
    clock,
    persistence = createMemoryPersistence(),
    rendererManifest = {},
    instanceId = `melo-${Math.random().toString(36).slice(2)}`,
    timings = {},
    size = DEFAULT_COMPANION_SIZE,
  } = {}) {
    this.clock = clock;
    this.persistence = persistence;
    this.rendererManifest = rendererManifest;
    this.instanceId = instanceId;
    this.size = size;
    this.timings = {
      wait: 1600,
      routeLeave: 160,
      enter: 180,
      peek: 650,
      move: 520,
      settle: 480,
      reaction: 1800,
      ambient: 900,
      reducedHold: 800,
      bubble: 4000,
      restAfter: 45000,
      thinkingMax: 12000,
      ...timings,
    };
    this.listeners = new Set();
    this.anchors = new Map();
    this.exclusions = new Map();
    const reactionHistory = this.persistence.get(PERSISTED_KEYS.reactionHistory, {});
    this.cooldowns = new Map(
      Object.entries(
        reactionHistory && typeof reactionHistory === 'object' ? reactionHistory : {},
      ).filter(([, value]) => Number.isFinite(value)),
    );
    this.queue = [];
    this.thinkingActive = false;
    this.thinkingUntil = 0;
    this.pendingNavigation = null;
    this.resumePresence = null;
    this.drag = null;
    this.activeReaction = null;
    this.routeTransition = null;
    this.suspension = null;

    // Older prototypes persisted arbitrary viewport coordinates after dragging. Those coordinates
    // cannot remain safe when a screen, keyboard, or financial card changes size. The production
    // companion persists a semantic perch instead and deliberately drops the unsafe legacy value.
    this.persistence.remove(PERSISTED_KEYS.preferredPosition);

    const at = nowMs(this.clock);
    const relationship = normalizeRelationship(
      this.persistence.get(PERSISTED_KEYS.relationship, null),
    );
    const behaviorMemory = normalizeBehaviorMemory(
      this.persistence.get(PERSISTED_KEYS.behaviorMemory, null),
    );
    const tucked = Boolean(this.persistence.get(PERSISTED_KEYS.tucked, false));
    const quiet = Boolean(this.persistence.get(PERSISTED_KEYS.quiet, false));
    const wardrobe = normalizeWardrobe(this.persistence.get(PERSISTED_KEYS.wardrobe, null));
    const behaviorPolicy = deriveBehaviorPolicy({ relationship, quiet, reducedMotion: false });

    this.state = {
      instanceId,
      personality: PERSONALITY,
      behaviorPolicy,
      behaviorMemory,
      presence: tucked ? PRESENCE.TUCKED : PRESENCE.HIDDEN,
      visualState: 'idle-calm',
      screen: null,
      screenProfile: resolveScreenProfile(null),
      attentionTarget: null,
      attention: null,
      gaze: { x: 0, y: 0, direction: 'right' },
      placement: null,
      routeMotion: null,
      bubble: null,
      tucked,
      quiet,
      reducedMotion: false,
      typing: false,
      modalOpen: false,
      appHidden: false,
      transitionUntil: 0,
      lastInteraction: this.persistence.get(PERSISTED_KEYS.lastInteraction, 0),
      lastActivity: at,
      financialContext: null,
      wardrobe,
      relationship,
      shell: null,
      idle: {
        nextAt: at + nextIdleDelay(behaviorPolicy, `${instanceId}:initial`),
        lastBeatAt: 0,
        lastVisual: null,
      },
      lifecycle: {
        animationPaused: false,
        suppressedBy: [],
      },
      activeReaction: null,
      accessibility: {
        role: 'button',
        label: 'Melo companion',
        hint: 'Open contextual Melo help',
      },
      renderer: resolveVisualAsset('idle-calm', rendererManifest, { wardrobe }),
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot() {
    return structuredClone(this.state);
  }

  destroy() {
    this.listeners.clear();
    this.anchors.clear();
    this.exclusions.clear();
    this.queue.length = 0;
    this.drag = null;
    this.activeReaction = null;
    this.routeTransition = null;
    this.suspension = null;
  }

  emit(event) {
    if (!event?.type) return this.snapshot();
    const at = nowMs(this.clock);
    const normalized = {
      ...event,
      priority: event.priority ?? (event.intensity === 'major' ? 'high' : 'normal'),
      queuedAt: at,
    };
    normalized.policy = eventPolicy(normalized);
    const duplicateIndex = this.queue.findIndex(
      (queued) => queued.policy?.coalesceKey === normalized.policy.coalesceKey,
    );
    if (duplicateIndex >= 0) {
      const previous = this.queue[duplicateIndex];
      normalized.priority =
        priorityValue(previous.priority) > priorityValue(normalized.priority)
          ? previous.priority
          : normalized.priority;
      normalized.policy = eventPolicy(normalized);
      this.queue.splice(duplicateIndex, 1, normalized);
    } else {
      this.queue.push(normalized);
    }
    this.queue.sort(
      (a, b) => priorityValue(b.priority) - priorityValue(a.priority) || a.queuedAt - b.queuedAt,
    );
    if (this.queue.length > 24) this.queue.length = 24;
    return this.tick(at);
  }

  registerAnchor(anchor) {
    if (!anchor?.id) return () => {};
    this.anchors.set(anchor.id, anchor);
    this.reconcilePerch();
    this.tick();
    return () => {
      this.anchors.delete(anchor.id);
      this.reconcilePerch();
      this.tick();
    };
  }

  registerExclusion(zone) {
    if (!zone?.id) return () => {};
    this.exclusions.set(zone.id, zone);
    this.reconcilePerch();
    this.tick();
    return () => {
      this.exclusions.delete(zone.id);
      this.reconcilePerch();
      this.tick();
    };
  }

  setOptions({ reducedMotion, typing, modalOpen, appHidden } = {}) {
    const at = nowMs(this.clock);
    if (reducedMotion !== undefined) {
      const nextReducedMotion = Boolean(reducedMotion);
      if (nextReducedMotion && !this.state.reducedMotion && this.state.transitionUntil > at) {
        this.state.transitionUntil = at;
      }
      this.state.reducedMotion = nextReducedMotion;
      this.refreshBehaviorPolicy();
    }
    if (typing !== undefined) this.state.typing = Boolean(typing);
    if (modalOpen !== undefined) this.state.modalOpen = Boolean(modalOpen);
    if (appHidden !== undefined) this.state.appHidden = Boolean(appHidden);
    this.tick(at);
  }

  setShell(shell) {
    this.state.shell = shell;
    this.reconcilePerch();
    this.tick();
  }

  setAttentionTarget(target) {
    const at = nowMs(this.clock);
    if (!target) {
      this.state.attention = null;
      this.state.attentionTarget = null;
    } else {
      this.acquireAttention(target, { at, reason: 'direct', salience: 0.7 });
    }
    this.state.lastActivity = at;
    this.tick(at);
  }

  setPreferredAnchor(anchorId) {
    if (anchorId) this.persistence.set(PERSISTED_KEYS.preferredAnchor, anchorId);
    else this.persistence.remove(PERSISTED_KEYS.preferredAnchor);
    this.persistence.remove(PERSISTED_KEYS.preferredPosition);
    this.resolvePerch();
    this.tick();
  }

  setWardrobe(value) {
    const wardrobe = normalizeWardrobe(value);
    this.state.wardrobe = wardrobe;
    if (wardrobe) this.persistence.set(PERSISTED_KEYS.wardrobe, wardrobe);
    else this.persistence.remove(PERSISTED_KEYS.wardrobe);
    this.tick();
  }

  setTucked(value) {
    this.state.tucked = Boolean(value);
    this.persistence.set(PERSISTED_KEYS.tucked, this.state.tucked);
    this.state.bubble = null;
    this.activeReaction = null;
    this.state.activeReaction = null;
    this.routeTransition = null;
    this.state.routeMotion = null;
    this.state.lastActivity = nowMs(this.clock);
    this.state.presence = this.state.tucked
      ? PRESENCE.TUCKED
      : this.state.screenProfile?.hidden
        ? PRESENCE.HIDDEN
        : PRESENCE.WAITING;
    this.state.visualState = 'idle-calm';
    this.state.placement = this.state.screenProfile?.hidden ? null : this.state.placement;
    this.state.transitionUntil =
      this.state.tucked || this.state.screenProfile?.hidden
        ? 0
        : this.state.lastActivity + (this.state.reducedMotion ? 0 : this.timings.wait);
    if (!this.state.tucked) this.scheduleIdle(this.state.lastActivity);
    this.tick(this.state.lastActivity);
  }

  setQuiet(value) {
    this.state.quiet = Boolean(value);
    this.persistence.set(PERSISTED_KEYS.quiet, this.state.quiet);
    if (this.state.quiet) this.state.bubble = null;
    this.refreshBehaviorPolicy();
    this.scheduleIdle(nowMs(this.clock));
    this.tick();
  }

  dragStart({ rect = null } = {}) {
    if (this.state.tucked || this.state.typing || this.state.modalOpen || this.state.appHidden)
      return false;
    const at = nowMs(this.clock);
    this.drag = { startedAt: at };
    this.state.presence = PRESENCE.DRAGGING;
    this.state.bubble = null;
    this.state.visualState = 'idle-calm';
    this.state.lastActivity = at;
    if (rect) this.dragMove(rect);
    this.tick(at);
    return true;
  }

  dragMove(rect) {
    if (!this.drag || !rect || !this.state.shell) return false;
    const safe = clampRect(
      { ...rect, width: rect.width ?? this.size.width, height: rect.height ?? this.size.height },
      this.state.shell,
      4,
    );
    const collision = [...this.exclusions.values()]
      .filter((zone) => !zone.screen || zone.screen === this.state.screen)
      .find((zone) => zone?.rect && rectsIntersect(safe, zone.rect, 12));
    if (collision) {
      this.drag.lastRejected = {
        id: collision.id,
        reason: `collision:${collision.id}`,
        rect: safe,
      };
      return false;
    }
    this.state.placement = { anchorId: null, rect: safe, rejected: [], userPositioned: true };
    this.state.lastActivity = nowMs(this.clock);
    this.updateGaze(safe);
    this.tick(this.state.lastActivity);
    return true;
  }

  dragEnd({ anchorId = null } = {}) {
    if (!this.drag) return false;
    const droppedRect = this.state.placement?.rect ?? null;
    this.drag = null;

    let destination = null;
    if (anchorId) {
      this.persistence.set(PERSISTED_KEYS.preferredAnchor, anchorId);
      this.persistence.remove(PERSISTED_KEYS.preferredPosition);
      destination = this.computePerch();
    } else if (droppedRect) {
      const nearest = this.nearestSafeAnchor(droppedRect);
      if (nearest) {
        this.persistence.set(PERSISTED_KEYS.preferredAnchor, nearest.anchorId);
        this.persistence.remove(PERSISTED_KEYS.preferredPosition);
        destination = nearest.placement;
      } else {
        // A free coordinate is never retained as a fallback. If the screen exposes no safe semantic
        // perch, Melo hides instead of becoming a movable obstruction over money or controls.
        this.persistence.remove(PERSISTED_KEYS.preferredPosition);
        destination = this.computePerch();
      }
    }

    this.state.placement = destination;
    this.state.presence = destination?.rect ? PRESENCE.PERCHED : PRESENCE.HIDDEN;
    this.state.visualState = destination?.rect ? 'settle' : 'idle-calm';
    this.state.transitionUntil =
      nowMs(this.clock) + (this.state.reducedMotion ? 0 : this.timings.settle);
    this.state.lastActivity = nowMs(this.clock);
    this.tick(this.state.lastActivity);
    return true;
  }

  engage(contextAction = null) {
    if (this.state.tucked || this.state.typing || this.state.modalOpen || this.state.appHidden)
      return false;
    const at = nowMs(this.clock);
    this.state.presence = PRESENCE.ENGAGED;
    this.state.visualState = 'result-acknowledgement';
    this.state.lastActivity = at;
    this.state.lastInteraction = at;
    this.state.transitionUntil = at + (this.state.reducedMotion ? 0 : this.timings.reaction);
    const action = contextAction ?? this.state.screenProfile?.action ?? null;
    if (action) {
      this.state.bubble = { ...action, origin: 'user', expiresAt: at + this.timings.bubble };
      rememberBubble(this.state.behaviorMemory, {
        actionId: action.id,
        screen: this.state.screen,
        at,
        userInitiated: true,
      });
      rememberBubbleOutcome(this.state.behaviorMemory, action.id, 'engaged');
      this.persistBehaviorMemory();
    }
    this.beginReaction({
      visualState: 'result-acknowledgement',
      event: { type: EVENTS.USER_INTERACT, priority: 'high', source: 'fenice' },
      at,
      duration: this.timings.reaction,
    });
    this.recordInteraction(at);
    this.tick(at);
    return true;
  }

  dismissBubble() {
    const actionId = this.state.bubble?.id;
    if (actionId && this.state.bubble?.origin !== 'user') {
      rememberBubbleOutcome(this.state.behaviorMemory, actionId, 'dismissed');
      this.persistBehaviorMemory();
    }
    this.state.bubble = null;
    if (this.state.presence === PRESENCE.OFFERING_HELP) this.state.presence = PRESENCE.PERCHED;
    this.tick();
  }

  navigate(screen, { attentionTarget = null } = {}) {
    const at = nowMs(this.clock);
    const previousScreen = this.state.screen;
    const previousPlacement = this.state.placement ? structuredClone(this.state.placement) : null;
    const wasVisible = [
      PRESENCE.PERCHED,
      PRESENCE.OFFERING_HELP,
      PRESENCE.ENGAGED,
      PRESENCE.RESTING,
    ].includes(this.state.presence);
    this.state.screen = screen;
    this.state.screenProfile = resolveScreenProfile(screen);
    this.state.attention = null;
    this.state.attentionTarget = null;
    if (attentionTarget)
      this.acquireAttention(attentionTarget, { at, reason: 'route', salience: 0.8 });
    this.state.bubble = null;
    this.state.lastActivity = at;
    this.recordVisit(screen, at);
    rememberScreen(this.state.behaviorMemory, screen, at);
    this.persistBehaviorMemory();
    if (this.state.screenProfile.hidden) {
      this.pendingNavigation = null;
      this.routeTransition = null;
      this.state.routeMotion = null;
      this.state.presence = this.state.tucked ? PRESENCE.TUCKED : PRESENCE.HIDDEN;
      this.state.placement = null;
      this.state.visualState = 'idle-calm';
      this.state.transitionUntil = 0;
      return this.tick(at);
    }
    this.pendingNavigation = { screen, attentionTarget, previousScreen };

    if (
      !this.state.tucked &&
      !this.isSuppressed() &&
      wasVisible &&
      previousScreen !== null &&
      previousScreen !== screen
    ) {
      const destination = this.computePerch();
      const fromRect = previousPlacement?.rect ?? null;
      const toRect = destination?.rect ?? null;
      const direction = fromRect && toRect && toRect.x < fromRect.x ? 'left' : 'right';
      this.routeTransition = {
        fromScreen: previousScreen,
        toScreen: screen,
        fromPlacement: previousPlacement,
        destination,
        direction,
        startedAt: at,
      };
      this.state.routeMotion = {
        phase: this.state.reducedMotion ? 'settle' : 'leaving',
        fromRect,
        toRect,
        direction,
      };
      if (this.state.reducedMotion) {
        this.state.placement = destination;
        this.state.presence = destination?.rect ? PRESENCE.PERCHED : PRESENCE.HIDDEN;
        this.state.visualState = destination?.rect ? 'settle' : 'idle-calm';
        this.state.transitionUntil = 0;
        this.routeTransition = null;
        this.pendingNavigation = null;
      } else {
        this.state.placement = previousPlacement;
        this.state.presence = PRESENCE.LEAVING;
        this.state.visualState = direction === 'left' ? 'move-short-left' : 'move-short-right';
        this.state.transitionUntil = at + this.timings.routeLeave;
      }
    } else if (previousScreen === screen && wasVisible) {
      this.pendingNavigation = null;
      this.reconcilePerch();
    } else {
      this.startWaiting(at);
    }
    return this.tick(at);
  }

  startWaiting(at = nowMs(this.clock), immediate = false) {
    if (this.state.tucked) {
      this.state.presence = PRESENCE.TUCKED;
      return;
    }
    if (this.state.screenProfile?.hidden) {
      this.state.presence = PRESENCE.HIDDEN;
      this.state.placement = null;
      this.state.visualState = 'idle-calm';
      this.state.transitionUntil = 0;
      this.pendingNavigation = null;
      return;
    }
    this.state.presence = PRESENCE.WAITING;
    this.state.visualState = 'idle-calm';
    const wait = Math.round(this.timings.wait * this.state.behaviorPolicy.waitFactor);
    this.state.transitionUntil = at + (this.state.reducedMotion || immediate ? 0 : wait);
    if (!this.routeTransition) this.pendingNavigation = null;
  }

  tick(at = nowMs(this.clock)) {
    this.applyLifecycle(at);

    if (this.state.attention && at >= this.state.attention.expiresAt) {
      this.state.attention = null;
      this.state.attentionTarget = null;
    }

    if (!this.state.tucked && !this.isSuppressed()) {
      if (this.thinkingActive && this.thinkingUntil > 0 && at >= this.thinkingUntil) {
        this.thinkingActive = false;
        this.thinkingUntil = 0;
        this.beginReaction({
          visualState: 'settle',
          event: { type: 'THINKING_WATCHDOG', priority: 'high' },
          at,
          duration: this.timings.settle,
        });
      }
      if (this.state.presence === PRESENCE.LEAVING && at >= this.state.transitionUntil) {
        const destination = this.computePerch();
        if (destination?.rect) {
          const fromRect =
            this.routeTransition?.fromPlacement?.rect ?? this.state.placement?.rect ?? null;
          const direction = fromRect && destination.rect.x < fromRect.x ? 'left' : 'right';
          if (this.routeTransition) {
            this.routeTransition.destination = destination;
            this.routeTransition.direction = direction;
          }
          this.state.routeMotion = {
            phase: 'moving',
            fromRect,
            toRect: destination.rect,
            direction,
          };
          this.state.presence = PRESENCE.MOVING;
          this.state.visualState = direction === 'left' ? 'move-short-left' : 'move-short-right';
          this.state.transitionUntil = at + this.timings.move;
        } else {
          this.routeTransition = null;
          this.state.routeMotion = null;
          this.startWaiting(at);
        }
      } else if (this.state.presence === PRESENCE.WAITING && at >= this.state.transitionUntil) {
        // Entry and peek are rendered at the destination perch. Resolve it before starting the
        // authored entrance so the character never spends those states at an undefined position.
        // If the screen has no safe semantic perch, hiding is preferable to floating over content.
        this.resolvePerch();
        if (!this.state.placement?.rect) {
          this.state.presence = PRESENCE.HIDDEN;
          this.state.visualState = 'idle-calm';
          this.state.transitionUntil = 0;
          this.pendingNavigation = null;
          this.scheduleIdle(at);
        } else {
          const visits = this.state.relationship.visits[this.state.screen] ?? 0;
          const settleDirectly =
            this.state.reducedMotion ||
            this.state.behaviorPolicy.entryStyle === 'settle' ||
            (this.state.behaviorPolicy.entryStyle === 'contextual' && visits > 2);
          if (settleDirectly) {
            this.state.presence = PRESENCE.PERCHED;
            this.state.visualState = 'settle';
            this.state.transitionUntil = at + (this.state.reducedMotion ? 0 : this.timings.settle);
            this.scheduleIdle(at);
          } else {
            this.state.presence = PRESENCE.ENTERING;
            this.state.visualState = 'notice-user';
            this.state.transitionUntil = at + this.timings.enter;
          }
        }
      } else if (this.state.presence === PRESENCE.ENTERING && at >= this.state.transitionUntil) {
        this.state.presence = PRESENCE.PEEKING;
        this.state.visualState = 'peek';
        this.state.transitionUntil = at + (this.state.reducedMotion ? 0 : this.timings.peek);
      } else if (this.state.presence === PRESENCE.PEEKING && at >= this.state.transitionUntil) {
        this.resolvePerch();
        this.state.presence = this.state.placement?.rect ? PRESENCE.PERCHED : PRESENCE.HIDDEN;
        this.state.visualState = this.state.placement?.rect ? 'settle' : 'idle-calm';
        this.state.transitionUntil = at + (this.state.reducedMotion ? 0 : this.timings.settle);
        this.scheduleIdle(at);
      } else if (this.state.presence === PRESENCE.MOVING && at >= this.state.transitionUntil) {
        this.state.placement = this.routeTransition?.destination ?? this.computePerch();
        this.state.presence = this.state.placement?.rect ? PRESENCE.PERCHED : PRESENCE.HIDDEN;
        this.state.visualState = this.state.placement?.rect ? 'settle' : 'idle-calm';
        this.state.transitionUntil = at + (this.state.reducedMotion ? 0 : this.timings.settle);
        if (this.state.routeMotion) this.state.routeMotion.phase = 'settle';
        this.routeTransition = null;
        this.pendingNavigation = null;
        this.scheduleIdle(at);
      } else if (
        this.state.presence === PRESENCE.PERCHED &&
        !this.state.quiet &&
        at - this.state.lastActivity >=
          this.timings.restAfter * this.state.behaviorPolicy.restFactor
      ) {
        this.state.presence = PRESENCE.RESTING;
        this.state.visualState = 'sleeping';
        this.state.transitionUntil = 0;
        this.activeReaction = null;
        this.state.activeReaction = null;
      } else if (
        this.state.presence === PRESENCE.PERCHED &&
        !this.activeReaction &&
        at >= this.state.idle.nextAt
      ) {
        this.runIdleBeat(at);
      }
    }

    this.consumeEvent(at);
    // Events such as TYPING_STARTED and MODAL_OPENED change suppression
    // synchronously. Re-apply lifecycle rules after consuming the event so
    // callers never observe one frame of visible companion UI over a field
    // or blocking sheet.
    this.applyLifecycle(at);

    if (
      TRANSIENT_VISUALS.has(this.state.visualState) &&
      this.state.transitionUntil > 0 &&
      at >= this.state.transitionUntil &&
      !this.thinkingActive
    ) {
      this.state.visualState = this.state.presence === PRESENCE.RESTING ? 'sleeping' : 'idle-calm';
      this.state.transitionUntil = 0;
      this.activeReaction = null;
      this.state.activeReaction = null;
      if (this.state.routeMotion?.phase === 'settle') this.state.routeMotion = null;
      if (
        this.state.presence === PRESENCE.OFFERING_HELP ||
        this.state.presence === PRESENCE.ENGAGED
      ) {
        this.state.presence = this.state.placement?.rect ? PRESENCE.PERCHED : PRESENCE.HIDDEN;
      }
      this.scheduleIdle(at);
    }

    if (this.state.bubble?.expiresAt <= at) {
      this.state.bubble = null;
      if (
        this.state.presence === PRESENCE.OFFERING_HELP ||
        this.state.presence === PRESENCE.ENGAGED
      ) {
        this.state.presence = this.state.placement?.rect ? PRESENCE.PERCHED : PRESENCE.HIDDEN;
      }
    }

    this.updateGaze();
    this.state.renderer = resolveVisualAsset(this.state.visualState, this.rendererManifest, {
      reducedMotion: this.state.reducedMotion,
      wardrobe: this.state.wardrobe,
      animationPaused: this.state.lifecycle.animationPaused,
    });
    this.updateAccessibility();
    for (const listener of this.listeners) listener(this.snapshot());
    return this.snapshot();
  }

  applyLifecycle(at) {
    const suppressed = this.isSuppressed();
    const suppressedBy = [
      this.state.typing ? 'typing' : null,
      this.state.modalOpen ? 'modal' : null,
      this.state.appHidden ? 'background' : null,
    ].filter(Boolean);
    this.state.lifecycle = {
      animationPaused: suppressed || this.state.tucked || Boolean(this.state.screenProfile?.hidden),
      suppressedBy,
    };
    if (this.state.tucked) {
      this.state.presence = PRESENCE.TUCKED;
      this.state.bubble = null;
      this.suspension = null;
      return;
    }
    if (this.state.screenProfile?.hidden) {
      this.state.presence = PRESENCE.HIDDEN;
      this.state.placement = null;
      this.state.bubble = null;
      this.state.visualState = 'idle-calm';
      this.state.transitionUntil = 0;
      this.resumePresence = null;
      this.suspension = null;
      return;
    }
    if (suppressed) {
      if (!this.suspension && this.state.presence !== PRESENCE.HIDDEN) {
        this.suspension = {
          presence: this.state.presence,
          visualState: this.state.visualState,
          at,
        };
      }
      this.state.presence = PRESENCE.HIDDEN;
      this.state.bubble = null;
      return;
    }
    if (this.state.presence === PRESENCE.HIDDEN && this.suspension) {
      const previous = this.suspension;
      this.suspension = null;
      if (this.thinkingActive) {
        this.state.presence = this.state.placement?.rect ? PRESENCE.PERCHED : PRESENCE.WAITING;
        this.state.visualState = 'thinking-loop';
        this.state.transitionUntil = 0;
      } else if (previous.presence === PRESENCE.RESTING && this.state.placement?.rect) {
        this.state.presence = PRESENCE.RESTING;
        this.state.visualState = 'sleeping';
        this.state.transitionUntil = 0;
      } else if (this.state.placement?.rect) {
        this.state.presence = PRESENCE.PERCHED;
        this.state.visualState = 'idle-calm';
        this.state.transitionUntil = 0;
        this.scheduleIdle(at);
      } else {
        this.startWaiting(at, true);
      }
    }
  }

  isSuppressed() {
    return this.state.typing || this.state.modalOpen || this.state.appHidden;
  }

  computePerch() {
    if (this.state.screenProfile?.hidden) {
      return null;
    }
    const screenAnchors = [...this.anchors.values()].filter(
      (anchor) => !anchor.screen || anchor.screen === this.state.screen,
    );
    const zones = [...this.exclusions.values()].filter(
      (zone) => !zone.screen || zone.screen === this.state.screen,
    );
    const shell = screenAnchors.find((anchor) => anchor.shell)?.shell ?? this.state.shell;
    if (!shell) {
      return null;
    }
    const preferredAnchor = this.persistence.get(PERSISTED_KEYS.preferredAnchor, null);
    return resolvePlacement({
      anchors: screenAnchors,
      exclusions: zones,
      shell,
      size: this.size,
      preferredAnchor,
    });
  }

  nearestSafeAnchor(rect) {
    if (!rect || this.state.screenProfile?.hidden) return null;
    const anchors = [...this.anchors.values()].filter(
      (anchor) => !anchor.screen || anchor.screen === this.state.screen,
    );
    const exclusions = [...this.exclusions.values()].filter(
      (zone) => !zone.screen || zone.screen === this.state.screen,
    );
    const shell = anchors.find((anchor) => anchor.shell)?.shell ?? this.state.shell;
    if (!shell) return null;

    const dropCenter = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    let best = null;
    for (const anchor of anchors) {
      const placement = resolvePlacement({
        anchors: [anchor],
        exclusions,
        shell,
        size: this.size,
        preferredAnchor: anchor.id,
      });
      if (!placement?.rect) continue;
      const center = {
        x: placement.rect.x + placement.rect.width / 2,
        y: placement.rect.y + placement.rect.height / 2,
      };
      const distance = (center.x - dropCenter.x) ** 2 + (center.y - dropCenter.y) ** 2;
      const priority = anchor.priority ?? 0;
      if (
        !best ||
        distance < best.distance ||
        (distance === best.distance && priority > best.priority)
      ) {
        best = { anchorId: anchor.id, placement, distance, priority };
      }
    }
    return best;
  }

  resolvePerch() {
    this.state.placement = this.computePerch();
    return this.state.placement;
  }

  reconcilePerch() {
    if ([PRESENCE.LEAVING, PRESENCE.MOVING, PRESENCE.DRAGGING].includes(this.state.presence)) {
      return this.state.placement;
    }
    const next = this.computePerch();
    const current = this.state.placement;
    if (!next?.rect) {
      this.state.placement = next;
      if (this.state.presence === PRESENCE.PERCHED) this.state.presence = PRESENCE.HIDDEN;
      return next;
    }
    const moved =
      current?.rect &&
      (Math.abs(current.rect.x - next.rect.x) > 1 || Math.abs(current.rect.y - next.rect.y) > 1);
    if (
      moved &&
      this.state.presence === PRESENCE.PERCHED &&
      !this.state.reducedMotion &&
      !this.isSuppressed()
    ) {
      const direction = next.rect.x < current.rect.x ? 'left' : 'right';
      this.routeTransition = {
        fromScreen: this.state.screen,
        toScreen: this.state.screen,
        fromPlacement: current,
        destination: next,
        direction,
        startedAt: nowMs(this.clock),
      };
      this.state.routeMotion = {
        phase: 'moving',
        fromRect: current.rect,
        toRect: next.rect,
        direction,
      };
      this.state.presence = PRESENCE.MOVING;
      this.state.visualState = direction === 'left' ? 'move-short-left' : 'move-short-right';
      this.state.transitionUntil = nowMs(this.clock) + this.timings.move;
      return current;
    }
    this.state.placement = next;
    // A semantic perch can become safe after the initial route entrance has already resolved to
    // hidden (for example, when the user scrolls a screen-owned perch into view). Recover through
    // the normal bounded entrance instead of leaving the persistent companion hidden forever.
    // Lifecycle suppression owns its own restoration path, so do not interfere with it here.
    if (
      this.state.presence === PRESENCE.HIDDEN &&
      !this.state.tucked &&
      !this.state.screenProfile?.hidden &&
      !this.isSuppressed() &&
      !this.suspension
    ) {
      this.startWaiting(nowMs(this.clock));
    }
    return next;
  }

  refreshBehaviorPolicy() {
    this.state.behaviorPolicy = deriveBehaviorPolicy({
      relationship: this.state.relationship,
      quiet: this.state.quiet,
      reducedMotion: this.state.reducedMotion,
    });
    return this.state.behaviorPolicy;
  }

  persistBehaviorMemory() {
    this.persistence.set(PERSISTED_KEYS.behaviorMemory, this.state.behaviorMemory);
  }

  scheduleIdle(at = nowMs(this.clock)) {
    const memory = this.state.behaviorMemory;
    memory.idleSequence += 1;
    this.state.idle.nextAt =
      at +
      nextIdleDelay(
        this.state.behaviorPolicy,
        `${this.instanceId}:${this.state.screen}:${memory.idleSequence}`,
      );
    this.persistBehaviorMemory();
  }

  runIdleBeat(at = nowMs(this.clock)) {
    const memory = this.state.behaviorMemory;
    resetAmbientWindow(memory, this.state.behaviorPolicy, at);
    if (!canRunAmbient(memory, this.state.behaviorPolicy, at)) {
      this.scheduleIdle(at);
      return false;
    }
    const visualState = selectIdleBeat({
      sequence: memory.idleSequence,
      gazeDirection: this.state.gaze.direction,
      recentReactions: memory.recentReactions,
    });
    memory.ambientCount += 1;
    this.state.idle.lastBeatAt = at;
    this.state.idle.lastVisual = visualState;
    rememberReaction(memory, { visualState, type: 'AMBIENT_IDLE', at, meaningful: false });
    if (visualState !== 'idle-calm') {
      this.beginReaction({
        visualState,
        event: { type: 'AMBIENT_IDLE', priority: 'low', interruptible: true },
        at,
        duration: this.timings.ambient,
      });
    }
    this.scheduleIdle(at);
    return true;
  }

  acquireAttention(
    target,
    {
      at = nowMs(this.clock),
      reason = 'context',
      salience = 0.5,
      holdMs = this.state.behaviorPolicy.attentionHoldMs,
      source = null,
    } = {},
  ) {
    const next = createAttention(target, { at, reason, salience, holdMs, source });
    if (!shouldAcceptAttention(this.state.attention, next, at)) return false;
    this.state.attention = next;
    this.state.attentionTarget = target;
    this.updateGaze(target);
    return true;
  }

  beginReaction({ visualState, event, at = nowMs(this.clock), duration = this.timings.reaction }) {
    const policy = event?.policy ?? eventPolicy(event);
    const effectiveDuration = this.state.reducedMotion
      ? Math.min(Math.max(0, duration), this.timings.reducedHold)
      : Math.max(0, duration);
    this.activeReaction = {
      type: event?.type ?? visualState,
      visualState,
      priority: event?.priority ?? 'normal',
      severity: policy.severity,
      interruptible: policy.interruptible,
      startedAt: at,
      until: duration === 0 ? Number.POSITIVE_INFINITY : at + effectiveDuration,
    };
    this.state.activeReaction = { ...this.activeReaction };
    this.state.visualState = visualState;
    this.state.transitionUntil = duration === 0 ? 0 : at + effectiveDuration;
    return this.activeReaction;
  }

  updateGaze(target = this.state.attentionTarget) {
    const shell = this.state.shell;
    if (!shell) return;
    let point = target;
    if (typeof target === 'string') {
      const anchor = this.anchors.get(target);
      point = anchor?.rect ?? null;
    }
    if (point?.rect) point = point.rect;
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      const x = point.x + (point.width ?? 0) / 2;
      const y = point.y + (point.height ?? 0) / 2;
      this.state.gaze = {
        x: Math.max(-1, Math.min(1, ((x - shell.x) / shell.width) * 2 - 1)),
        y: Math.max(-1, Math.min(1, ((y - shell.y) / shell.height) * 2 - 1)),
        direction: x < shell.x + shell.width / 2 ? 'left' : 'right',
      };
      return;
    }
    if (this.state.placement?.rect) {
      this.state.gaze = {
        ...this.state.gaze,
        direction: directionForPlacement(this.state.placement, shell),
      };
    }
  }

  directionForRoute() {
    const current = this.state.placement?.rect;
    const target = this.state.attentionTarget?.rect ?? this.state.attentionTarget;
    if (current && target && Number.isFinite(target.x)) {
      return target.x < current.x ? 'left' : 'right';
    }
    return this.state.gaze.direction;
  }

  consumeEvent(at) {
    this.queue = this.queue.filter((queued) => {
      const policy = queued.policy ?? eventPolicy(queued);
      queued.policy = policy;
      return policy.forceInterrupt || at - queued.queuedAt <= policy.ttlMs;
    });
    const index = this.queue.findIndex((queued) =>
      canInterrupt(this.activeReaction, queued.policy, at),
    );
    if (index < 0) return;
    const [event] = this.queue.splice(index, 1);
    if (!event || event.type === EVENTS.NAVIGATE) return;
    const policy = event.policy ?? eventPolicy(event);

    if (event.type === EVENTS.TYPING_STARTED) this.state.typing = true;
    if (event.type === EVENTS.TYPING_ENDED) this.state.typing = false;
    if (event.type === EVENTS.MODAL_OPENED) this.state.modalOpen = true;
    if (event.type === EVENTS.MODAL_CLOSED) this.state.modalOpen = false;
    if (event.type === EVENTS.APP_HIDDEN) this.state.appHidden = true;
    if ([EVENTS.APP_VISIBLE, EVENTS.APP_RESUMED, EVENTS.ONLINE].includes(event.type))
      this.state.appHidden = false;
    if (event.type === EVENTS.TUCK) {
      this.state.tucked = true;
      this.state.presence = PRESENCE.TUCKED;
      this.state.bubble = null;
      this.activeReaction = null;
      this.state.activeReaction = null;
      this.persistence.set(PERSISTED_KEYS.tucked, true);
    }
    if (event.type === EVENTS.UNTUCK) {
      this.state.tucked = false;
      this.state.presence = PRESENCE.WAITING;
      this.state.visualState = 'idle-calm';
      this.state.transitionUntil =
        at +
        (this.state.reducedMotion
          ? 0
          : Math.round(this.timings.wait * this.state.behaviorPolicy.waitFactor));
      this.persistence.set(PERSISTED_KEYS.tucked, false);
    }

    if (ATTENTION_EVENTS.has(event.type)) {
      this.state.lastActivity = at;
      const target = event.attentionTarget ?? event.target ?? event.source ?? null;
      if (target) {
        const salience = Number.isFinite(event.salience)
          ? event.salience
          : event.type === EVENTS.GUIDE
            ? 0.9
            : event.type === EVENTS.SCREEN_INTERACTION
              ? 0.35
              : 0.75;
        this.acquireAttention(target, {
          at,
          reason: event.reason ?? event.type.toLowerCase(),
          salience,
          holdMs: event.holdMs ?? this.state.behaviorPolicy.attentionHoldMs,
          source: event.source ?? null,
        });
      }
    }

    if ([EVENTS.USER_INTERACTION, EVENTS.USER_INTERACT, EVENTS.WAKE].includes(event.type)) {
      this.state.lastActivity = at;
      if (
        this.state.presence === PRESENCE.RESTING ||
        (this.state.presence === PRESENCE.HIDDEN && !this.isSuppressed())
      ) {
        this.state.presence = this.state.placement?.rect ? PRESENCE.PERCHED : PRESENCE.WAITING;
        this.state.visualState = 'idle-calm';
      }
    }

    if (REACTION_EVENTS.has(event.type)) {
      const last = this.cooldowns.get(policy.cooldownKey);
      if (last !== undefined && at - last < policy.cooldownMs && !policy.forceInterrupt) return;
    }

    const screenReaction = resolveScreenReaction(this.state.screen, event);
    let visualState = screenReaction.visualState ?? visualFor(event);
    if (
      event.type === EVENTS.APP_RESUMED &&
      event.notice !== true &&
      this.suspension &&
      at - this.suspension.at < 60000
    ) {
      visualState = null;
    }
    const contextualEvent = new Set([
      EVENTS.USER_INTERACT,
      EVENTS.ACTION_REQUIRED,
      EVENTS.GUIDE,
      EVENTS.FIRST_ANSWER,
      EVENTS.WAITING_INPUT,
    ]).has(event.type);
    const contextAction =
      event.contextAction ?? (contextualEvent ? screenReaction.contextAction : null);

    if (
      visualState &&
      this.state.presence === PRESENCE.RESTING &&
      event.type !== EVENTS.SCREEN_INTERACTION
    ) {
      this.state.presence = this.state.placement?.rect ? PRESENCE.PERCHED : PRESENCE.WAITING;
    }
    const startsThinking = [
      EVENTS.IMPORT_STARTED,
      EVENTS.PLAN_RECALCULATED,
      EVENTS.ANALYSIS_STARTED,
      EVENTS.THINKING_START,
      EVENTS.RECALCULATION_START,
      EVENTS.FILING_STARTED,
    ].includes(event.type);
    const endsThinking = [
      EVENTS.IMPORT_FINISHED,
      EVENTS.ANALYSIS_ENDED,
      EVENTS.THINKING_END,
      EVENTS.RECALCULATION_END,
      EVENTS.STATEMENT_IMPORTED,
      EVENTS.REVIEW_COMPLETED,
    ].includes(event.type);
    if (startsThinking) {
      this.thinkingActive = true;
      this.thinkingUntil = at + this.timings.thinkingMax;
    }
    if (endsThinking) {
      this.thinkingActive = false;
      this.thinkingUntil = 0;
    }

    if (event.type === EVENTS.SCREEN_INTERACTION) {
      visualState = event.notice === false ? null : 'notice-user';
    }

    if (event.type === EVENTS.SESSION_STARTED) {
      const relationship = this.state.relationship;
      const sessionId = event.sessionId ?? `session-${at}`;
      const isNewSession = this.state.behaviorMemory.sessionId !== sessionId;
      const timeAway = relationship.lastSeen
        ? Math.max(0, at - relationship.lastSeen)
        : Number.POSITIVE_INFINITY;
      const shouldGreet =
        isNewSession &&
        event.greet !== false &&
        !this.state.quiet &&
        (relationship.stage === 'new' || timeAway >= 4 * 60 * 60 * 1000);
      if (isNewSession) {
        relationship.sessions += 1;
        relationship.familiarity = Math.min(1, relationship.familiarity + 0.02);
        this.state.behaviorMemory.proactiveBubblesThisSession = 0;
      }
      relationship.stage = relationshipStage(relationship);
      this.state.behaviorMemory.sessionId = sessionId;
      this.state.behaviorMemory.greetingShownInSession = true;
      this.persistence.set(PERSISTED_KEYS.sessionGreetingShown, true);
      if (shouldGreet) visualState = 'notice-user';
      this.refreshBehaviorPolicy();
      this.persistRelationship(at);
      this.persistBehaviorMemory();
    }

    if (REACTION_EVENTS.has(event.type)) this.state.lastActivity = at;
    if (USER_RELATIONSHIP_EVENTS.has(event.type)) {
      this.state.lastInteraction = at;
      this.recordInteraction(at);
    }

    if (visualState) {
      const duration = startsThinking ? 0 : reactionDuration(event, this.timings);
      this.beginReaction({ visualState, event, at, duration });
      const target =
        event.attentionTarget ?? (typeof event.source === 'object' ? event.source : null);
      if (target) {
        this.acquireAttention(target, {
          at,
          reason: 'reaction',
          salience: policy.severity / 4,
          source: event.source ?? null,
        });
      }
      if (contextAction) {
        const userInitiated = event.type === EVENTS.USER_INTERACT;
        const critical = event.priority === 'critical' || event.type === EVENTS.ACTION_REQUIRED;
        const canSpeak = shouldOfferBubble(this.state.behaviorMemory, this.state.behaviorPolicy, {
          at,
          screen: event.screen ?? this.state.screen,
          actionId: contextAction.id,
          userInitiated,
          critical,
        });
        if (canSpeak && !this.state.tucked && !this.isSuppressed()) {
          if (!this.state.placement?.rect) this.resolvePerch();
          this.state.presence = userInitiated ? PRESENCE.ENGAGED : PRESENCE.OFFERING_HELP;
          this.state.bubble = {
            ...contextAction,
            origin: userInitiated ? 'user' : 'proactive',
            screen: event.screen ?? this.state.screen,
            visualState,
            expiresAt: at + this.timings.bubble,
          };
          rememberBubble(this.state.behaviorMemory, {
            actionId: contextAction.id,
            screen: event.screen ?? this.state.screen,
            at,
            userInitiated,
          });
        }
      }
      if (event.type === EVENTS.ACTION_REQUIRED && !this.state.tucked && !this.isSuppressed()) {
        this.state.presence = this.state.bubble
          ? PRESENCE.OFFERING_HELP
          : this.state.placement?.rect
            ? PRESENCE.PERCHED
            : PRESENCE.HIDDEN;
      }
      if (REACTION_EVENTS.has(event.type)) {
        this.cooldowns.set(policy.cooldownKey, at);
        this.persistence.set(PERSISTED_KEYS.reactionHistory, Object.fromEntries(this.cooldowns));
      }
      rememberReaction(this.state.behaviorMemory, {
        type: event.type,
        visualState,
        screen: event.screen ?? this.state.screen,
        at,
        meaningful: FINANCIAL_EVENTS.has(event.type),
      });
      this.persistBehaviorMemory();
    }

    if (FINANCIAL_EVENTS.has(event.type)) {
      this.state.financialContext = {
        type: event.type,
        source: event.source ?? null,
        screen: event.screen ?? this.state.screen,
        intensity: event.intensity ?? 'normal',
        direction: event.direction ?? null,
        at,
      };
    }

    if ([EVENTS.TYPING_STARTED, EVENTS.MODAL_OPENED, EVENTS.APP_HIDDEN].includes(event.type))
      this.state.bubble = null;
    if ([EVENTS.TYPING_ENDED, EVENTS.MODAL_CLOSED, EVENTS.APP_VISIBLE].includes(event.type))
      this.state.lastActivity = at;
  }

  recordVisit(screen, at = nowMs(this.clock)) {
    if (!screen) return;
    const relationship = this.state.relationship;
    relationship.visits[screen] = (relationship.visits[screen] ?? 0) + 1;
    relationship.lastScreen = screen;
    relationship.lastSeen = at;
    relationship.familiarity = Math.min(1, relationship.familiarity + 0.005);
    relationship.stage = relationshipStage(relationship);
    this.refreshBehaviorPolicy();
    this.persistRelationship(at);
  }

  recordInteraction(at = nowMs(this.clock)) {
    const relationship = this.state.relationship;
    relationship.interactions += 1;
    relationship.familiarity = Math.min(1, relationship.familiarity + 0.01);
    relationship.stage = relationshipStage(relationship);
    relationship.lastSeen = at;
    this.refreshBehaviorPolicy();
    this.persistRelationship(at);
    this.persistence.set(PERSISTED_KEYS.lastInteraction, at);
  }

  persistRelationship(at) {
    this.state.relationship.lastSeen = at;
    this.persistence.set(PERSISTED_KEYS.relationship, this.state.relationship);
  }

  updateAccessibility() {
    const visible = ![PRESENCE.HIDDEN, PRESENCE.TUCKED].includes(this.state.presence);
    const stateLabel = this.state.visualState.replaceAll('-', ' ');
    this.state.accessibility = {
      role: 'button',
      label: visible ? `Melo companion, ${stateLabel}` : 'Melo companion hidden',
      hint: visible
        ? 'Tap to open contextual Melo help; drag to reposition'
        : 'Restore Melo from companion settings',
      liveMessage: this.state.bubble?.label ?? null,
      tabStop: visible && !this.state.tucked,
    };
  }
}
