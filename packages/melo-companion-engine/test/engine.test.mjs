import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CompanionEngine,
  EVENTS,
  PRESENCE,
  REACTION_EVENT_TYPES,
  resolveEventVisual,
  resolveScreenProfile,
} from '../src/index.mjs';
import { createMemoryPersistence } from '../src/persistence.mjs';

function harness() {
  let time = 0;
  const engine = new CompanionEngine({
    clock: () => time,
    instanceId: 'fenice-test',
    persistence: createMemoryPersistence(),
    rendererManifest: {
      'idle-calm': 'idle.png',
      peek: 'peek.png',
      'result-acknowledgement': 'ack.png',
      settle: 'settle.png',
      'positive-small': 'positive.png',
    },
  });
  const shell = { x: 0, y: 0, width: 360, height: 740 };
  engine.setShell(shell);
  engine.registerAnchor({
    id: 'today/section',
    screen: 'today',
    placement: 'bottom-right',
    priority: 10,
    rect: { x: 40, y: 330, width: 90, height: 36 },
    shell,
  });
  engine.registerExclusion({
    id: 'today/money',
    screen: 'today',
    rect: { x: 180, y: 210, width: 160, height: 80 },
  });
  return {
    engine,
    advance(ms) {
      time += ms;
      engine.tick();
    },
  };
}

test('route choreography keeps one instance and resolves a safe perch', () => {
  const { engine, advance } = harness();
  engine.navigate('today');
  assert.equal(engine.snapshot().instanceId, 'fenice-test');
  advance(1600);
  assert.equal(engine.snapshot().presence, PRESENCE.ENTERING);
  advance(180);
  assert.equal(engine.snapshot().presence, PRESENCE.PEEKING);
  advance(650);
  assert.equal(engine.snapshot().presence, PRESENCE.PERCHED);
  assert.equal(engine.snapshot().placement.anchorId, 'today/section');
  engine.navigate('today');
  assert.equal(engine.snapshot().instanceId, 'fenice-test');
});

test('safe placement remains inside representative mobile and desktop shells', () => {
  for (const [width, height] of [
    [360, 740],
    [375, 812],
    [390, 844],
    [430, 932],
    [768, 1024],
    [1280, 900],
  ]) {
    let time = 0;
    const engine = new CompanionEngine({
      clock: () => time,
      instanceId: `viewport-${width}`,
      persistence: createMemoryPersistence(),
      timings: { wait: 0, enter: 0, peek: 0, settle: 0 },
      rendererManifest: { 'idle-calm': 'idle.png', peek: 'peek.png', settle: 'settle.png' },
    });
    const shell = { x: 0, y: 0, width, height };
    engine.setShell(shell);
    engine.registerAnchor({
      id: 'viewport/perch',
      screen: 'today',
      placement: 'top-left',
      priority: 10,
      rect: { x: width - 160, y: height - 140, width: 72, height: 36 },
      shell,
    });
    engine.navigate('today');
    engine.tick(time);
    engine.tick(time);
    engine.tick(time);
    const rect = engine.snapshot().placement?.rect;
    assert.ok(rect, `no safe placement at ${width}x${height}`);
    assert.ok(
      rect.x >= shell.x && rect.y >= shell.y,
      `placement escaped top/left at ${width}x${height}`,
    );
    assert.ok(
      rect.x + rect.width <= shell.x + shell.width,
      `placement escaped right at ${width}x${height}`,
    );
    assert.ok(
      rect.y + rect.height <= shell.y + shell.height,
      `placement escaped bottom at ${width}x${height}`,
    );
  }
});

test('a faithful screen perch can preserve the reference mascot footprint', () => {
  const engine = new CompanionEngine({
    persistence: createMemoryPersistence(),
    size: { width: 72, height: 96 },
    timings: { wait: 0, enter: 0, peek: 0, settle: 0 },
  });
  engine.setShell({ x: 0, y: 0, width: 390, height: 844 });
  engine.registerAnchor({
    id: 'today/reference-slot',
    screen: 'today',
    placement: 'top-left',
    priority: 20,
    rect: { x: 32, y: 300, width: 28, height: 28 },
    size: { width: 28, height: 28 },
  });

  engine.navigate('today');
  engine.tick();
  engine.tick();

  assert.deepEqual(engine.snapshot().placement?.rect, {
    x: 32,
    y: 264,
    width: 28,
    height: 28,
  });
});

test('typing, modal, tuck, and background suppress without destroying state', () => {
  const { engine, advance } = harness();
  engine.navigate('today');
  advance(2400);
  engine.setOptions({ typing: true });
  assert.equal(engine.snapshot().presence, PRESENCE.HIDDEN);
  engine.setOptions({ typing: false });
  engine.setTucked(true);
  assert.equal(engine.snapshot().presence, PRESENCE.TUCKED);
  engine.setTucked(false);
  assert.equal(engine.snapshot().presence, PRESENCE.WAITING);
  engine.setOptions({ appHidden: true });
  assert.equal(engine.snapshot().presence, PRESENCE.HIDDEN);
  engine.setOptions({ appHidden: false });
  engine.emit({ type: EVENTS.TYPING_STARTED });
  assert.equal(engine.snapshot().presence, PRESENCE.HIDDEN);
  engine.emit({ type: EVENTS.TYPING_ENDED });
  assert.notEqual(engine.snapshot().presence, PRESENCE.HIDDEN);
});

test('events prioritize useful reactions and return to stable visuals', () => {
  const { engine } = harness();
  engine.navigate('today');
  engine.emit({
    type: EVENTS.SUCCESS,
    intensity: 'small',
    priority: 'normal',
    source: 'safe-zone',
  });
  const success = engine.snapshot();
  assert.equal(success.visualState, 'positive-small');
  assert.equal(success.renderer.asset, 'positive.png');
  engine.emit({ type: EVENTS.USER_INTERACTION, priority: 'high' });
  assert.equal(engine.snapshot().visualState, 'result-acknowledgement');
  assert.equal(engine.snapshot().renderer.asset, 'ack.png');
});

test('reaction cooldown memory survives a companion remount', () => {
  const persistence = createMemoryPersistence();
  const first = new CompanionEngine({
    clock: () => 1000,
    persistence,
    rendererManifest: { 'idle-calm': 'idle.png', 'positive-small': 'positive.png' },
  });
  first.emit({ type: EVENTS.SUCCESS, intensity: 'small', priority: 'normal' });
  assert.equal(first.snapshot().visualState, 'positive-small');

  const second = new CompanionEngine({
    clock: () => 2000,
    persistence,
    rendererManifest: { 'idle-calm': 'idle.png', 'positive-small': 'positive.png' },
  });
  second.emit({ type: EVENTS.SUCCESS, intensity: 'small', priority: 'normal' });
  assert.equal(second.snapshot().visualState, 'idle-calm');
  assert.deepEqual(Object.keys(persistence.get('melo.companion.reactionHistory')), [
    EVENTS.SUCCESS,
  ]);
});

test('missing assets resolve through deterministic fallback', () => {
  const { engine } = harness();
  engine.emit({ type: EVENTS.BILL_RISK, intensity: 'major' });
  const state = engine.snapshot();
  assert.equal(state.renderer.resolvedState, 'idle-calm');
  assert.equal(state.renderer.isFallback, true);
  assert.equal(state.renderer.asset, 'idle.png');
});

test('transient reactions return to idle and thinking ends explicitly', () => {
  let time = 0;
  const engine = new CompanionEngine({
    clock: () => time,
    rendererManifest: {
      'idle-calm': 'idle.png',
      'thinking-loop': 'thinking.png',
      settle: 'settle.png',
    },
  });
  engine.emit({ type: EVENTS.IMPORT_STARTED, priority: 'normal' });
  assert.equal(engine.snapshot().visualState, 'thinking-loop');
  time += 10000;
  engine.tick();
  assert.equal(engine.snapshot().visualState, 'thinking-loop');
  engine.emit({ type: EVENTS.IMPORT_FINISHED, priority: 'normal' });
  assert.equal(engine.snapshot().visualState, 'settle');
  time += 500;
  engine.tick();
  assert.equal(engine.snapshot().visualState, 'idle-calm');
});

test('screen attention moves gaze without inventing financial reactions', () => {
  const { engine } = harness();
  engine.navigate('today');
  engine.emit({
    type: EVENTS.SCREEN_INTERACTION,
    source: { x: 40, y: 340, width: 90, height: 36 },
    notice: true,
  });
  const state = engine.snapshot();
  assert.equal(state.visualState, 'notice-user');
  assert.equal(state.financialContext, null);
  assert.equal(state.gaze.direction, 'left');
  assert.equal(state.attentionTarget.x, 40);
});

test('financial events retain truthful context and action-required becomes attentive', () => {
  const { engine } = harness();
  engine.navigate('today');
  engine.emit({
    type: EVENTS.BILL_RISK,
    intensity: 'major',
    source: 'bill-shield',
    contextAction: { id: 'explain-bill', label: 'Explain this bill' },
  });
  let state = engine.snapshot();
  assert.equal(state.visualState, 'concern-major');
  assert.equal(state.presence, PRESENCE.OFFERING_HELP);
  assert.equal(state.financialContext.source, 'bill-shield');
  assert.equal(state.bubble.id, 'explain-bill');

  engine.emit({ type: EVENTS.ACTION_REQUIRED });
  state = engine.snapshot();
  assert.equal(state.visualState, 'waiting-for-user');
  assert.equal(state.presence, PRESENCE.OFFERING_HELP);
});

test('thinking has an explicit completion event and a safety ceiling', () => {
  let time = 0;
  const engine = new CompanionEngine({
    clock: () => time,
    timings: { thinkingMax: 100, settle: 20 },
    rendererManifest: {
      'idle-calm': 'idle.png',
      'thinking-loop': 'thinking.png',
      settle: 'settle.png',
    },
  });
  engine.emit({ type: EVENTS.ANALYSIS_STARTED });
  assert.equal(engine.snapshot().visualState, 'thinking-loop');
  time += 101;
  engine.tick();
  assert.equal(engine.snapshot().visualState, 'settle');
  time += 20;
  engine.tick();
  assert.equal(engine.snapshot().visualState, 'idle-calm');
});

test('resting remembers the relationship and wakes on interaction', () => {
  const { engine, advance } = (() => {
    let time = 0;
    const instance = new CompanionEngine({
      clock: () => time,
      persistence: createMemoryPersistence(),
      timings: { wait: 0, enter: 0, peek: 0, settle: 0, restAfter: 50 },
    });
    const shell = { x: 0, y: 0, width: 360, height: 740 };
    instance.setShell(shell);
    instance.registerAnchor({
      id: 'rest/perch',
      screen: 'today',
      placement: 'top-right',
      priority: 1,
      rect: { x: 220, y: 120, width: 80, height: 40 },
      shell,
    });
    return {
      engine: instance,
      advance(ms) {
        time += ms;
        instance.tick();
      },
    };
  })();
  engine.navigate('today');
  advance(0);
  advance(0);
  advance(0);
  assert.equal(engine.snapshot().presence, PRESENCE.PERCHED);
  advance(51);
  assert.equal(engine.snapshot().presence, PRESENCE.RESTING);
  assert.ok(engine.snapshot().relationship.visits.today >= 1);
  assert.equal(engine.snapshot().relationship.stage, 'new');
  engine.emit({ type: EVENTS.USER_INTERACTION });
  assert.equal(engine.snapshot().presence, PRESENCE.PERCHED);
  assert.equal(engine.snapshot().visualState, 'result-acknowledgement');
});

test('dragging chooses the nearest safe semantic perch and wardrobe respects one active cosmetic', () => {
  const persistence = createMemoryPersistence();
  let time = 0;
  const engine = new CompanionEngine({
    clock: () => time,
    persistence,
    rendererManifest: {
      'idle-calm': {
        animated: 'idle/frames',
        static: 'idle.png',
        reducedMotion: 'idle-static.png',
        wardrobe: { scarf: 'idle-scarf/frames' },
      },
      'positive-small': {
        animated: 'positive/frames',
        static: 'positive.png',
        reducedMotion: 'positive-static.png',
      },
    },
    timings: { wait: 0, enter: 0, peek: 0, settle: 0 },
  });
  const shell = { x: 0, y: 0, width: 360, height: 740 };
  engine.setShell(shell);
  engine.registerAnchor({
    id: 'today/left-perch',
    screen: 'today',
    placement: 'top-left',
    priority: 10,
    rect: { x: 18, y: 330, width: 72, height: 96 },
  });
  engine.registerAnchor({
    id: 'today/right-perch',
    screen: 'today',
    placement: 'top-left',
    priority: 10,
    rect: { x: 250, y: 330, width: 72, height: 96 },
  });
  engine.navigate('today');
  assert.equal(engine.dragStart(), true);
  engine.dragMove({ x: 252, y: 236, width: 72, height: 96 });
  engine.dragEnd();
  assert.equal(persistence.get('melo.companion.preferredAnchor'), 'today/right-perch');
  assert.equal(persistence.get('melo.companion.preferredPosition'), null);
  assert.equal(engine.snapshot().placement.anchorId, 'today/right-perch');
  engine.setWardrobe(['scarf', 'crown']);
  assert.equal(engine.snapshot().wardrobe, 'scarf');
  assert.equal(engine.snapshot().renderer.mode, 'wardrobe');
  engine.setOptions({ reducedMotion: true });
  engine.emit({ type: EVENTS.SUCCESS, intensity: 'small' });
  assert.equal(engine.snapshot().renderer.mode, 'reduced-motion');
  time += 1;
  engine.tick();
  assert.equal(engine.snapshot().placement.rect.x >= shell.x, true);
});

test('dragging cannot create a free-floating overlay when no semantic perch is safe', () => {
  const persistence = createMemoryPersistence({
    'melo.companion.preferredPosition': { x: 0.4, y: 0.4, width: 72, height: 96 },
  });
  const engine = new CompanionEngine({ persistence });
  engine.setShell({ x: 0, y: 0, width: 360, height: 740 });
  engine.navigate('today');
  assert.equal(engine.dragStart(), true);
  assert.equal(engine.dragMove({ x: 140, y: 190, width: 72, height: 96 }), true);
  engine.dragEnd();
  assert.equal(engine.snapshot().presence, PRESENCE.HIDDEN);
  assert.equal(engine.snapshot().placement?.rect ?? null, null);
  assert.equal(persistence.get('melo.companion.preferredPosition'), null);
});

test('dragging rejects protected content and never persists the rejected position', () => {
  const persistence = createMemoryPersistence();
  const engine = new CompanionEngine({ persistence });
  const shell = { x: 0, y: 0, width: 360, height: 740 };
  engine.setShell(shell);
  engine.navigate('today');
  engine.registerExclusion({
    id: 'today/primary-action',
    screen: 'today',
    rect: { x: 120, y: 180, width: 140, height: 80 },
  });
  assert.equal(engine.dragStart(), true);
  assert.equal(engine.dragMove({ x: 140, y: 190, width: 72, height: 96 }), false);
  engine.dragEnd();
  assert.equal(persistence.get('melo.companion.preferredPosition'), null);
});

test('automatic financial reactions do not masquerade as relationship interactions', () => {
  let time = 1000;
  const engine = new CompanionEngine({ clock: () => time, persistence: createMemoryPersistence() });
  const before = engine.snapshot().relationship.interactions;
  engine.emit({ type: EVENTS.BILL_RISK, intensity: 'major', source: 'bill-shield' });
  assert.equal(engine.snapshot().relationship.interactions, before);
  assert.equal(engine.snapshot().lastInteraction, 0);
  time += 7000;
  engine.emit({ type: EVENTS.USER_INTERACTION, source: 'fenice' });
  assert.equal(engine.snapshot().relationship.interactions, before + 1);
  assert.equal(engine.snapshot().lastInteraction, time);
});

test('contextual bubbles expire even after their reaction visual has settled', () => {
  let time = 0;
  const engine = new CompanionEngine({
    clock: () => time,
    timings: { reaction: 100, bubble: 400 },
    rendererManifest: { 'idle-calm': 'idle.png', 'concern-major': 'concern.png' },
  });
  engine.emit({
    type: EVENTS.BILL_RISK,
    intensity: 'major',
    contextAction: { id: 'explain', label: 'Explain this' },
  });
  assert.equal(engine.snapshot().bubble.id, 'explain');
  time = 101;
  engine.tick();
  assert.equal(engine.snapshot().bubble.id, 'explain');
  time = 401;
  engine.tick();
  assert.equal(engine.snapshot().bubble, null);
  assert.notEqual(engine.snapshot().presence, PRESENCE.OFFERING_HELP);
});

test('unregistering an anchor immediately clears a stale perch', () => {
  const engine = new CompanionEngine({ timings: { wait: 0, enter: 0, peek: 0, settle: 0 } });
  const shell = { x: 0, y: 0, width: 360, height: 740 };
  engine.setShell(shell);
  const unregister = engine.registerAnchor({
    id: 'today/temporary',
    screen: 'today',
    placement: 'top-left',
    priority: 1,
    rect: { x: 140, y: 240, width: 80, height: 40 },
  });
  engine.navigate('today');
  engine.tick();
  engine.tick();
  engine.tick();
  assert.equal(engine.snapshot().placement.anchorId, 'today/temporary');
  unregister();
  assert.equal(engine.snapshot().placement.rect, null);
});

test('a screen with no safe perch stays hidden instead of starting an entrance', () => {
  const engine = new CompanionEngine({
    timings: { wait: 0, enter: 0, peek: 0, settle: 0 },
  });
  engine.setShell({ x: 0, y: 0, width: 360, height: 740 });
  engine.navigate('today');
  engine.tick();

  const state = engine.snapshot();
  assert.equal(state.presence, PRESENCE.HIDDEN);
  assert.equal(state.placement?.rect ?? null, null);
  assert.equal(state.visualState, 'idle-calm');
});

test('a late safe semantic perch restarts the bounded entrance after no-perch hiding', () => {
  let time = 0;
  const engine = new CompanionEngine({
    clock: () => time,
    timings: { wait: 100, enter: 50, peek: 50, settle: 50 },
  });
  const shell = { x: 0, y: 0, width: 360, height: 740 };
  engine.setShell(shell);
  engine.navigate('today');
  time = 100;
  engine.tick();
  assert.equal(engine.snapshot().presence, PRESENCE.HIDDEN);

  engine.registerAnchor({
    id: 'today/late-perch',
    screen: 'today',
    placement: 'top-left',
    priority: 20,
    rect: { x: 40, y: 320, width: 70, height: 36 },
    shell,
  });
  assert.equal(engine.snapshot().presence, PRESENCE.WAITING);

  time = 200;
  engine.tick();
  assert.equal(engine.snapshot().presence, PRESENCE.ENTERING);
  assert.equal(engine.snapshot().placement.anchorId, 'today/late-perch');
});

test('screen profiles provide useful context without fabricating a money reaction', () => {
  const { engine } = harness();
  engine.navigate('business-runway');
  assert.equal(engine.snapshot().screenProfile.domain, 'business');
  assert.equal(engine.snapshot().screenProfile.attention, 'runway');
  engine.emit({ type: EVENTS.USER_INTERACT, priority: 'high' });
  const state = engine.snapshot();
  assert.equal(state.presence, PRESENCE.ENGAGED);
  assert.equal(state.bubble.id, 'business-runway.explain');
  assert.equal(state.financialContext, null);
  assert.equal(resolveScreenProfile('unknown').domain, 'unknown');
});

test('full personal and business screen profile coverage hides blocking flows', () => {
  const { engine } = harness();
  for (const screen of [
    'start',
    'guided',
    'intake',
    'review',
    'ritual',
    'shortfall',
    'business-intake',
    'business-entity-setup',
    'business-workspace-create',
  ]) {
    engine.navigate(screen);
    const state = engine.snapshot();
    assert.equal(state.screenProfile.hidden, true, `screen should be hidden: ${screen}`);
    assert.equal(state.presence, PRESENCE.HIDDEN, `companion should be hidden: ${screen}`);
    assert.equal(state.placement, null, `hidden screen retained placement: ${screen}`);
    engine.setShell({ x: 0, y: 0, width: 360, height: 740 });
    assert.equal(
      engine.snapshot().placement,
      null,
      `shell update revived hidden companion: ${screen}`,
    );
    engine.emit({ type: EVENTS.SUCCESS, intensity: 'major', priority: 'critical', source: screen });
    assert.equal(
      engine.snapshot().presence,
      PRESENCE.HIDDEN,
      `event revived hidden companion: ${screen}`,
    );
    assert.equal(engine.snapshot().bubble, null, `event added bubble on hidden screen: ${screen}`);
  }
  engine.navigate('business-corp-tax');
  assert.equal(engine.snapshot().screenProfile.domain, 'business');
  assert.equal(engine.snapshot().screenProfile.hidden, false);
});

test('the portable event vocabulary drives truthful visual states and lifecycle controls', () => {
  const { engine } = harness();
  engine.navigate('business-filings');
  engine.emit({ type: EVENTS.FILING_STARTED, priority: 'normal' });
  assert.equal(engine.snapshot().visualState, 'thinking-loop');
  engine.emit({ type: EVENTS.FILING_FAILED, priority: 'high', source: 'filings' });
  assert.equal(engine.snapshot().visualState, 'blocked');
  assert.equal(engine.snapshot().financialContext.source, 'filings');
  engine.emit({ type: EVENTS.TUCK, priority: 'high' });
  assert.equal(engine.snapshot().presence, PRESENCE.TUCKED);
  engine.emit({ type: EVENTS.UNTUCK, priority: 'high' });
  assert.equal(engine.snapshot().presence, PRESENCE.WAITING);
});

test('every declared reaction event resolves to a visual state', () => {
  for (const type of REACTION_EVENT_TYPES) {
    const visual = resolveEventVisual({
      type,
      priority: 'normal',
      direction: 'improved',
      outcome: 'safe',
    });
    assert.ok(visual, `event has no visual reaction: ${type}`);
  }
});
