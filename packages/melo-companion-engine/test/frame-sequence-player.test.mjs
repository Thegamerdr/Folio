import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameSequencePlayer, formatFramePath } from '../src/index.mjs';

function animated(overrides = {}) {
  return {
    requestedState: 'notice-user',
    resolvedState: 'notice-user',
    mode: 'animated',
    asset: 'notice-user/frame_%02d.png',
    frameCount: 3,
    durationsMs: [100, 50, 200],
    loop: 'once',
    interruptible: true,
    artStatus: 'authored-semantic-performance',
    ...overrides,
  };
}

test('frame paths use one-based padded authored filenames', () => {
  assert.equal(formatFramePath('frames/frame_%02d.png', 4), 'frames/frame_04.png');
  assert.equal(formatFramePath('idle.png', 1), 'idle.png');
});

test('player honours exact variable per-pose durations and completes once', () => {
  let time = 0;
  const frames = [];
  let completions = 0;
  const player = new FrameSequencePlayer({
    clock: () => time,
    onFrame: (state) => frames.push(state.frameNumber),
    onComplete: () => {
      completions += 1;
    },
  });
  assert.equal(player.play(animated()), true);
  assert.equal(player.snapshot().frameNumber, 1);
  time = 99;
  assert.equal(player.tick().frameNumber, 1);
  time = 100;
  assert.equal(player.tick().frameNumber, 2);
  time = 150;
  assert.equal(player.tick().frameNumber, 3);
  time = 350;
  assert.equal(player.tick().complete, true);
  time = 500;
  player.tick();
  assert.equal(completions, 1);
  assert.deepEqual(frames, [1, 2, 3]);
});

test('looping, pause/resume and non-interruptible clips remain deterministic', () => {
  let time = 0;
  const player = new FrameSequencePlayer({ clock: () => time });
  player.play(animated({ loop: 'loop', interruptible: false }));
  time = 150;
  assert.equal(player.tick().frameNumber, 3);
  player.pause();
  time = 1000;
  assert.equal(player.tick().frameNumber, 3);
  player.resume();
  time = 1200;
  assert.equal(player.tick().frameNumber, 1);
  assert.equal(player.play(animated({ requestedState: 'peek' })), false);
  assert.equal(player.play(animated({ requestedState: 'peek' }), { force: true }), true);
});

test('static and reduced-motion visuals become stable one-frame holds', () => {
  const player = new FrameSequencePlayer();
  player.play({
    requestedState: 'idle-calm',
    resolvedState: 'idle-calm',
    mode: 'reduced-motion',
    asset: 'idle.png',
  });
  assert.deepEqual(player.snapshot(), {
    state: 'idle-calm',
    frameNumber: 1,
    frameCount: 1,
    framePath: 'idle.png',
    loop: 'hold',
    interruptible: true,
    paused: false,
    complete: true,
    artStatus: null,
  });
});
