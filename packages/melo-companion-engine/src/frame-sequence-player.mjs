/** Resolve a printf-style PNG pattern such as frame_%02d.png. */
export function formatFramePath(pattern, frameNumber) {
  if (!pattern) return null;
  return String(pattern).replace(/%0?(\d*)d/, (_match, width) => {
    const minimum = Number(width || 1);
    return String(frameNumber).padStart(minimum, '0');
  });
}

function normaliseVisual(visual) {
  const animated = visual?.mode === 'animated' && visual?.asset && Number(visual?.frameCount) > 1;
  if (!animated) {
    return {
      ...visual,
      frameCount: visual?.asset ? 1 : 0,
      durationsMs: visual?.asset ? [Infinity] : [],
      loop: 'hold',
      interruptible: true,
    };
  }

  const frameCount = Number(visual.frameCount);
  const supplied = Array.isArray(visual.durationsMs) ? visual.durationsMs : [];
  const fallback = Math.max(1, Math.round(1000 / 12));
  const durationsMs = Array.from({ length: frameCount }, (_, index) => {
    const value = Number(supplied[index]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  });
  return {
    ...visual,
    frameCount,
    durationsMs,
    loop: visual.loop === 'loop' ? 'loop' : 'once',
    interruptible: visual.interruptible !== false,
  };
}

/**
 * Deterministic portable player for authored PNG frame sequences.
 *
 * Hosts call `tick()` from requestAnimationFrame, a React Native frame clock,
 * or tests. The player owns exact variable-duration timing, interruption rules,
 * lifecycle pause/resume, loop policy, and one-shot completion. It deliberately
 * knows nothing about DOM, Canvas, React, or image loading.
 */
export class FrameSequencePlayer {
  constructor({ clock = () => Date.now(), onFrame = () => {}, onComplete = () => {} } = {}) {
    this.clock = clock;
    this.onFrame = onFrame;
    this.onComplete = onComplete;
    this.visual = null;
    this.startedAt = 0;
    this.pausedAt = null;
    this.frameNumber = 0;
    this.complete = true;
    this.completionReported = false;
  }

  play(visual, { force = false } = {}) {
    if (this.visual && !this.complete && this.visual.interruptible === false && !force)
      return false;
    this.visual = normaliseVisual(visual);
    this.startedAt = this.clock();
    this.pausedAt = null;
    this.frameNumber = this.visual.frameCount > 0 ? 1 : 0;
    this.complete = this.visual.frameCount <= 1;
    this.completionReported = false;
    this.#emitFrame();
    return true;
  }

  pause(now = this.clock()) {
    if (this.pausedAt === null) this.pausedAt = now;
  }

  resume(now = this.clock()) {
    if (this.pausedAt === null) return;
    this.startedAt += now - this.pausedAt;
    this.pausedAt = null;
  }

  tick(now = this.clock()) {
    if (!this.visual || this.visual.frameCount <= 1 || this.pausedAt !== null)
      return this.snapshot();

    const total = this.visual.durationsMs.reduce((sum, duration) => sum + duration, 0);
    const elapsed = Math.max(0, now - this.startedAt);
    let local = elapsed;
    if (this.visual.loop === 'loop') {
      local = total > 0 ? elapsed % total : 0;
    } else if (elapsed >= total) {
      local = Math.max(0, total - 1);
      this.complete = true;
    }

    let cursor = 0;
    let nextFrame = this.visual.frameCount;
    for (let index = 0; index < this.visual.durationsMs.length; index += 1) {
      cursor += this.visual.durationsMs[index];
      if (local < cursor) {
        nextFrame = index + 1;
        break;
      }
    }
    if (nextFrame !== this.frameNumber) {
      this.frameNumber = nextFrame;
      this.#emitFrame();
    }

    if (this.complete && !this.completionReported) {
      this.completionReported = true;
      this.onComplete(this.snapshot());
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      state: this.visual?.resolvedState ?? this.visual?.requestedState ?? null,
      frameNumber: this.frameNumber,
      frameCount: this.visual?.frameCount ?? 0,
      framePath:
        this.frameNumber > 0 ? formatFramePath(this.visual?.asset, this.frameNumber) : null,
      loop: this.visual?.loop ?? 'hold',
      interruptible: this.visual?.interruptible ?? true,
      paused: this.pausedAt !== null,
      complete: this.complete,
      artStatus: this.visual?.artStatus ?? null,
    };
  }

  #emitFrame() {
    if (this.frameNumber > 0) this.onFrame(this.snapshot());
  }
}
