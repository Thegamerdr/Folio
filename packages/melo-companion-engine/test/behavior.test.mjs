import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CompanionEngine,
  EVENTS,
  PRESENCE,
  canRunAmbient,
  createAttention,
  deriveBehaviorPolicy,
  normalizeBehaviorMemory,
  normalizeRelationship,
  relationshipStage,
  shouldAcceptAttention,
  shouldOfferBubble,
  createJsonStoragePersistence,
  rectInside,
} from '../src/index.mjs';
import { createMemoryPersistence } from '../src/persistence.mjs';

const shell = { x: 0, y: 0, width: 390, height: 844 };

function makeEngine({
  persistence = createMemoryPersistence(),
  timings = {},
  rendererManifest = {},
} = {}) {
  let time = 1000;
  const engine = new CompanionEngine({
    clock: () => time,
    persistence,
    instanceId: 'fenice-alive-test',
    timings: {
      wait: 0,
      routeLeave: 20,
      enter: 0,
      peek: 0,
      move: 40,
      settle: 20,
      reaction: 100,
      ...timings,
    },
    rendererManifest: {
      'idle-calm': {
        animated: 'idle/frame_%02d.png',
        reducedMotion: 'idle-static.png',
        wardrobe: { scarf: 'idle-scarf.png' },
      },
      'notice-user': 'notice.png',
      peek: 'peek.png',
      settle: 'settle.png',
      'move-short-left': 'left.png',
      'move-short-right': 'right.png',
      'concern-major': 'concern-major.png',
      'positive-small': 'positive-small.png',
      blocked: 'blocked.png',
      'thinking-loop': 'thinking.png',
      ...rendererManifest,
    },
  });
  engine.setShell(shell);
  engine.registerAnchor({
    id: 'today/perch',
    screen: 'today',
    placement: 'bottom-right',
    priority: 10,
    rect: { x: 34, y: 250, width: 110, height: 36 },
  });
  engine.registerAnchor({
    id: 'business-runway/perch',
    screen: 'business-runway',
    placement: 'top-left',
    priority: 10,
    rect: { x: 260, y: 520, width: 90, height: 36 },
  });
  return {
    engine,
    now: () => time,
    advance(ms) {
      time += ms;
      return engine.tick(time);
    },
  };
}

function enterToday(harness) {
  harness.engine.navigate('today');
  harness.advance(0);
  harness.advance(0);
  harness.advance(0);
  assert.equal(harness.engine.snapshot().presence, PRESENCE.PERCHED);
}

test('relationship is non-gamified policy: familiarity makes Fenice quieter, not more powerful', () => {
  const fresh = normalizeRelationship({ sessions: 0, interactions: 0 });
  const familiar = normalizeRelationship({ sessions: 3, interactions: 4 });
  const trusted = normalizeRelationship({ sessions: 8, interactions: 20 });
  assert.equal(relationshipStage(fresh), 'new');
  assert.equal(relationshipStage(familiar), 'familiar');
  assert.equal(relationshipStage(trusted), 'trusted');

  const newPolicy = deriveBehaviorPolicy({ relationship: fresh });
  const trustedPolicy = deriveBehaviorPolicy({ relationship: trusted });
  assert.equal(newPolicy.entryStyle, 'peek');
  assert.equal(trustedPolicy.entryStyle, 'settle');
  assert.ok(trustedPolicy.idleMinMs > newPolicy.idleMinMs);
  assert.ok(trustedPolicy.maxProactiveBubblesPerSession < newPolicy.maxProactiveBubblesPerSession);
  assert.equal('xp' in trustedPolicy, false);
  assert.equal('level' in trustedPolicy, false);
});

test('session identity prevents duplicate greetings and duplicate relationship sessions', () => {
  const harness = makeEngine();
  harness.engine.emit({ type: EVENTS.SESSION_STARTED, sessionId: 'session-a' });
  let state = harness.engine.snapshot();
  assert.equal(state.relationship.sessions, 1);
  assert.equal(state.visualState, 'notice-user');
  harness.engine.emit({ type: EVENTS.SESSION_STARTED, sessionId: 'session-a' });
  state = harness.engine.snapshot();
  assert.equal(state.relationship.sessions, 1);
  harness.engine.emit({ type: EVENTS.SESSION_STARTED, sessionId: 'session-b', greet: false });
  harness.advance(100);
  assert.equal(harness.engine.snapshot().relationship.sessions, 2);
});

test('attention has dwell and salience so low-value movement cannot steal meaningful focus', () => {
  const important = createAttention({ x: 300, y: 200 }, { at: 1000, salience: 0.9, holdMs: 3000 });
  const incidental = createAttention({ x: 20, y: 200 }, { at: 1100, salience: 0.2, holdMs: 500 });
  assert.equal(shouldAcceptAttention(important, incidental, 1100), false);
  assert.equal(shouldAcceptAttention(important, incidental, 4001), true);

  const { engine, advance } = makeEngine();
  enterToday({ engine, advance });
  engine.emit({
    type: EVENTS.GUIDE,
    target: { x: 310, y: 220, width: 20, height: 20 },
    salience: 0.9,
    notice: false,
  });
  assert.equal(engine.snapshot().gaze.direction, 'right');
  engine.emit({
    type: EVENTS.SCREEN_INTERACTION,
    target: { x: 10, y: 220, width: 20, height: 20 },
    salience: 0.2,
    notice: false,
  });
  assert.equal(engine.snapshot().gaze.direction, 'right');
  advance(4000);
  engine.emit({
    type: EVENTS.SCREEN_INTERACTION,
    target: { x: 10, y: 220, width: 20, height: 20 },
    salience: 0.2,
    notice: false,
  });
  assert.equal(engine.snapshot().gaze.direction, 'left');
});

test('ambient repertoire is bounded and quiet/reduced-motion policies silence it', () => {
  const relationship = normalizeRelationship({});
  const memory = normalizeBehaviorMemory({ ambientWindowStartedAt: 1000, ambientCount: 0 });
  const policy = deriveBehaviorPolicy({ relationship });
  assert.equal(canRunAmbient(memory, policy, 1001), true);
  memory.ambientCount = policy.maxAmbientPerWindow;
  assert.equal(canRunAmbient(memory, policy, 1002), false);
  assert.equal(deriveBehaviorPolicy({ relationship, quiet: true }).maxAmbientPerWindow, 0);
  assert.equal(deriveBehaviorPolicy({ relationship, reducedMotion: true }).maxAmbientPerWindow, 0);
});

test('a perched companion performs a bounded silent idle beat then returns to calm', () => {
  const harness = makeEngine({ timings: { ambient: 80, restAfter: 120000 } });
  enterToday(harness);
  const due = harness.engine.snapshot().idle.nextAt;
  harness.advance(due - harness.now());
  let state = harness.engine.snapshot();
  assert.ok(
    ['idle-curious', 'gaze-left', 'gaze-right', 'gaze-up', 'gaze-down', 'idle-calm'].includes(
      state.visualState,
    ),
  );
  assert.equal(state.bubble, null);
  assert.equal(state.behaviorMemory.ambientCount, 1);
  if (state.visualState !== 'idle-calm') {
    harness.advance(80);
    state = harness.engine.snapshot();
    assert.equal(state.visualState, 'idle-calm');
  }
  harness.engine.setQuiet(true);
  const nextDue = harness.engine.snapshot().idle.nextAt;
  harness.advance(nextDue - harness.now());
  assert.equal(harness.engine.snapshot().visualState, 'idle-calm');
});

test('major financial concern is not overwritten by a minor success; critical failure interrupts', () => {
  const { engine } = makeEngine();
  engine.navigate('today');
  engine.emit({ type: EVENTS.BILL_RISK, intensity: 'major', source: 'bill-shield' });
  assert.equal(engine.snapshot().visualState, 'concern-major');
  engine.emit({ type: EVENTS.SUCCESS, intensity: 'small', priority: 'low', source: 'sync' });
  assert.equal(engine.snapshot().visualState, 'concern-major');
  assert.equal(engine.queue.length, 1);
  engine.emit({ type: EVENTS.ERROR, priority: 'critical', source: 'sync' });
  assert.equal(engine.snapshot().visualState, 'blocked');
  assert.equal(engine.snapshot().activeReaction.severity, 4);
});

test('bursty duplicate events coalesce instead of producing repeated reactions', () => {
  const { engine } = makeEngine();
  engine.emit({ type: EVENTS.BILL_RISK, intensity: 'major', source: 'bill' });
  engine.emit({
    type: EVENTS.SUCCESS,
    intensity: 'small',
    priority: 'low',
    source: 'import',
    context: 1,
  });
  engine.emit({
    type: EVENTS.SUCCESS,
    intensity: 'small',
    priority: 'low',
    source: 'import',
    context: 2,
  });
  assert.equal(engine.queue.length, 1);
  assert.equal(engine.queue[0].context, 2);
});

test('stale minor reactions expire instead of replaying after the moment has passed', () => {
  const harness = makeEngine();
  harness.engine.emit({ type: EVENTS.ERROR, priority: 'critical', source: 'sync' });
  harness.engine.emit({
    type: EVENTS.SUCCESS,
    priority: 'low',
    intensity: 'small',
    ttlMs: 10,
    source: 'sync',
  });
  assert.equal(harness.engine.queue.length, 1);
  harness.advance(101);
  assert.equal(harness.engine.queue.length, 0);
  assert.notEqual(harness.engine.snapshot().visualState, 'positive-small');
});

test('route choreography exposes old and new bounds and moves without remounting', () => {
  const harness = makeEngine();
  enterToday(harness);
  const before = harness.engine.snapshot();
  harness.engine.navigate('business-runway');
  let state = harness.engine.snapshot();
  assert.equal(state.instanceId, before.instanceId);
  assert.equal(state.presence, PRESENCE.LEAVING);
  assert.equal(state.routeMotion.phase, 'leaving');
  assert.deepEqual(state.routeMotion.fromRect, before.placement.rect);
  assert.ok(state.routeMotion.toRect);
  harness.advance(20);
  state = harness.engine.snapshot();
  assert.equal(state.presence, PRESENCE.MOVING);
  assert.equal(state.routeMotion.phase, 'moving');
  assert.deepEqual(state.placement.rect, before.placement.rect);
  harness.advance(40);
  state = harness.engine.snapshot();
  assert.equal(state.presence, PRESENCE.PERCHED);
  assert.equal(state.placement.anchorId, 'business-runway/perch');
  assert.equal(state.routeMotion.phase, 'settle');
});

test('trusted repeat visits skip the performative peek and settle quietly', () => {
  const persistence = createMemoryPersistence({
    'melo.companion.relationship': {
      sessions: 8,
      interactions: 20,
      familiarity: 0.9,
      visits: { today: 5 },
      lastScreen: 'today',
      lastSeen: 900,
    },
  });
  const harness = makeEngine({ persistence, timings: { wait: 1000 } });
  harness.engine.navigate('today');
  assert.equal(harness.engine.snapshot().behaviorPolicy.stage, 'trusted');
  harness.advance(580);
  const state = harness.engine.snapshot();
  assert.equal(state.presence, PRESENCE.PERCHED);
  assert.equal(state.visualState, 'settle');
});

test('quiet mode blocks proactive chatter but a deliberate tap still opens contextual help', () => {
  const harness = makeEngine();
  enterToday(harness);
  harness.engine.setQuiet(true);
  harness.engine.emit({ type: EVENTS.GUIDE, priority: 'high' });
  assert.equal(harness.engine.snapshot().bubble, null);
  harness.engine.emit({ type: EVENTS.ACTION_REQUIRED, priority: 'critical' });
  assert.equal(harness.engine.snapshot().bubble, null);
  harness.engine.engage();
  const state = harness.engine.snapshot();
  assert.equal(state.presence, PRESENCE.ENGAGED);
  assert.equal(state.bubble.id, 'today.explain');
  assert.equal(state.bubble.origin, 'user');
});

test('dismissal memory suppresses a repeatedly ignored proactive offer and survives remount', () => {
  const persistence = createMemoryPersistence();
  const first = makeEngine({ persistence });
  enterToday(first);
  const action = { id: 'offer', label: 'Explain this' };
  first.engine.emit({ type: EVENTS.GUIDE, priority: 'high', contextAction: action });
  assert.equal(first.engine.snapshot().bubble.id, 'offer');
  first.engine.dismissBubble();
  const memory = persistence.get('melo.companion.behaviorMemory');
  assert.equal(memory.dismissedOffers.offer, 1);

  const policy = first.engine.snapshot().behaviorPolicy;
  assert.equal(
    shouldOfferBubble(memory, policy, {
      at: first.now() + policy.bubbleCooldownMs + 1,
      screen: 'other',
      actionId: 'offer',
    }),
    true,
  );
  memory.dismissedOffers.offer = 2;
  persistence.set('melo.companion.behaviorMemory', memory);
  const second = makeEngine({ persistence });
  assert.equal(second.engine.snapshot().behaviorMemory.dismissedOffers.offer, 2);
  assert.equal(
    shouldOfferBubble(
      second.engine.snapshot().behaviorMemory,
      second.engine.snapshot().behaviorPolicy,
      {
        at: first.now() + policy.bubbleCooldownMs * 3,
        screen: 'other',
        actionId: 'offer',
      },
    ),
    false,
  );
});

test('background lifecycle pauses rendering and restores calmly without replaying entrance', () => {
  const harness = makeEngine();
  enterToday(harness);
  harness.engine.emit({ type: EVENTS.APP_HIDDEN });
  let state = harness.engine.snapshot();
  assert.equal(state.presence, PRESENCE.HIDDEN);
  assert.equal(state.lifecycle.animationPaused, true);
  assert.equal(state.renderer.animationPaused, true);
  harness.engine.emit({ type: EVENTS.APP_VISIBLE });
  state = harness.engine.snapshot();
  assert.equal(state.presence, PRESENCE.PERCHED);
  assert.equal(state.visualState, 'idle-calm');
  assert.equal(state.lifecycle.animationPaused, false);
});

test('reduced motion keeps stable reaction poses and removes route travel', () => {
  const harness = makeEngine({
    rendererManifest: {
      'positive-small': {
        animated: 'positive/frame_%02d.png',
        reducedMotion: 'positive-static.png',
      },
    },
  });
  enterToday(harness);
  harness.engine.setOptions({ reducedMotion: true });
  harness.engine.navigate('business-runway');
  let state = harness.engine.snapshot();
  assert.equal(state.presence, PRESENCE.PERCHED);
  assert.equal(state.routeMotion.phase, 'settle');
  harness.engine.emit({ type: EVENTS.SUCCESS, intensity: 'small', source: 'goal' });
  state = harness.engine.snapshot();
  assert.equal(state.visualState, 'positive-small');
  assert.equal(state.renderer.mode, 'reduced-motion');
  assert.ok(state.transitionUntil > harness.now());
});

test('renderer reports wardrobe continuity truth instead of silently claiming support', () => {
  const harness = makeEngine();
  harness.engine.setWardrobe('scarf');
  assert.equal(harness.engine.snapshot().renderer.wardrobeSupported, true);
  harness.engine.emit({ type: EVENTS.SUCCESS, intensity: 'small', source: 'goal' });
  const state = harness.engine.snapshot();
  assert.equal(state.renderer.wardrobeRequested, 'scarf');
  assert.equal(state.renderer.wardrobeApplied, null);
  assert.equal(state.renderer.wardrobeSupported, false);
});

test('JSON storage adapter persists durable companion memory and survives corrupt host data', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const persistence = createJsonStoragePersistence(storage, { prefix: 'melo:' });
  assert.equal(persistence.set('melo.companion.tucked', true), true);
  assert.equal(persistence.get('melo.companion.tucked', false), true);
  values.set('melo:broken', '{not-json');
  assert.deepEqual(persistence.get('broken', { safe: true }), { safe: true });
  persistence.remove('melo.companion.tucked');
  assert.equal(persistence.get('melo.companion.tucked', false), false);
});

test('long mixed Personal/Business simulation keeps state bounded and placement safe', () => {
  let time = 0;
  const engine = new CompanionEngine({
    clock: () => time,
    instanceId: 'fenice-long-run',
    persistence: createMemoryPersistence(),
    timings: {
      wait: 0,
      routeLeave: 5,
      enter: 0,
      peek: 0,
      move: 10,
      settle: 5,
      reaction: 30,
      bubble: 40,
    },
    rendererManifest: { 'idle-calm': 'idle.png' },
  });
  engine.setShell(shell);
  const screens = ['today', 'subscriptions', 'business-runway', 'business-filings'];
  screens.forEach((screen, index) => {
    engine.registerAnchor({
      id: `${screen}/perch`,
      screen,
      placement: index % 2 ? 'bottom-left' : 'top-right',
      priority: 10,
      rect: { x: 90 + index * 55, y: 210 + index * 90, width: 82, height: 34 },
    });
  });
  engine.registerExclusion({ id: 'global/nav', rect: { x: 0, y: 780, width: 390, height: 64 } });
  const events = [
    {
      type: EVENTS.SCREEN_INTERACTION,
      notice: false,
      target: { x: 50, y: 180, width: 30, height: 30 },
    },
    { type: EVENTS.SAFE_ZONE_CHANGED, direction: 'improved', intensity: 'small' },
    { type: EVENTS.BILL_RISK, intensity: 'major' },
    { type: EVENTS.ANALYSIS_STARTED },
    { type: EVENTS.ANALYSIS_ENDED },
    { type: EVENTS.USER_INTERACTION },
    { type: EVENTS.SUCCESS, intensity: 'small' },
  ];
  for (let index = 0; index < 320; index += 1) {
    if (index % 20 === 0) engine.navigate(screens[(index / 20) % screens.length]);
    engine.emit({ ...events[index % events.length], source: `source-${index % 3}` });
    time += 17;
    const state = engine.tick(time);
    assert.equal(state.instanceId, 'fenice-long-run');
    assert.ok(Object.values(PRESENCE).includes(state.presence));
    assert.ok(engine.queue.length <= 24);
    if (state.placement?.rect) assert.equal(rectInside(state.placement.rect, shell), true);
    assert.equal(Number.isFinite(state.gaze.x), true);
    assert.equal(Number.isFinite(state.gaze.y), true);
  }
});
