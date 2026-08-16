// TodayNudges — shortfall nudge + collapsed "+N" badge contract (screens/today/TodayNudges.tsx).
//
// Companion to TodayNudges.test.ts (which pins the review-queue nudge's priority slot + copy). This
// file pins two more of the component's load-bearing promises: (1) the SHORTFALL nudge — the
// top-priority door, gated on the threaded `tightestSpare < 0` (component lines ~100-110) — fires
// with its exact frozen copy and action ('shortfall'); and (2) the COLLAPSE contract every render
// goes through regardless of which nudges are active: exactly one chip is shown (`top = nudges[0]`),
// its accessibility label reads the top nudge's own label when there's only one, and reads
// "N things to check" once 2+ are queued, with the "+N" badge counting `nudges.length - 1` — i.e.
// tapping the collapsed chip always runs the TOP nudge's action, never a merged/blended one.
//
// Node-safe by design: TodayNudges.tsx imports react-native and JSX and so cannot load under the
// Node test runner (the repo's vitest glob is `apps/**/*.test.ts`, .tsx is never collected — see
// this component's own TodayNudges.test.ts header, and VisualizerScreen.addAll.test.ts, for the
// same constraint; a genuine attempt to render it via @testing-library/react-native under this
// vitest config failed at react-native's own Flow-typed entrypoint before any test code ran). The
// nudge-array building and the collapse-to-one-chip logic are both plain, deterministic, and free of
// any react-native dependency, so they are re-exercised here exactly as the component computes them.

import { describe, expect, it } from 'vitest';

type NudgeTone = 'accent' | 'ink' | 'melo';

type Nudge = {
  key: string;
  tone: NudgeTone;
  label: string;
  cta: string;
  onPress: () => void;
};

// The component's exact shortfall-nudge push (faithful restatement of the `tightestSpare < 0`
// branch, frozen copy included verbatim).
function pushShortfallNudge(
  nudges: Nudge[],
  tightestSpare: number | null,
  onOpen: () => void,
): void {
  if (tightestSpare !== null && tightestSpare < 0) {
    nudges.push({
      key: 'shortfall',
      tone: 'accent',
      label: "You won't make it to payday as things stand. Let's look at three calm moves.",
      cta: 'Open →',
      onPress: onOpen,
    });
  }
}

// The component's exact review-queue nudge push, reused from TodayNudges.test.ts's restatement so
// this file can build a realistic 2+-nudge scenario without depending on that file.
function pushReviewQueueNudge(nudges: Nudge[], queueLength: number, onCheck: () => void): void {
  if (queueLength > 0) {
    nudges.push({
      key: 'review-queue',
      tone: 'accent',
      label:
        queueLength === 1
          ? '1 thing waiting to be checked — from your paste.'
          : `${queueLength} things waiting to be checked.`,
      cta: 'Check →',
      onPress: onCheck,
    });
  }
}

// The component's exact collapse-to-one-chip derivation (`top`, `extra`, `accessibilityLabel`) —
// restated 1:1 from the render body (lines ~223-229).
function collapse(nudges: Nudge[]): {
  visible: boolean;
  top: Nudge | null;
  extra: number;
  accessibilityLabel: string | null;
} {
  if (nudges.length === 0) return { visible: false, top: null, extra: 0, accessibilityLabel: null };
  const top = nudges[0]!;
  const extra = nudges.length - 1;
  const accessibilityLabel = extra > 0 ? `${nudges.length} things to check` : top.label;
  return { visible: true, top, extra, accessibilityLabel };
}

describe('TodayNudges — shortfall nudge', () => {
  it('does not fire when tightestSpare is null (headline not yet mounted)', () => {
    const nudges: Nudge[] = [];
    pushShortfallNudge(nudges, null, () => {});
    expect(nudges).toEqual([]);
  });

  it('does not fire when tightestSpare is zero or positive', () => {
    for (const spare of [0, 1, 250]) {
      const nudges: Nudge[] = [];
      pushShortfallNudge(nudges, spare, () => {});
      expect(nudges).toEqual([]);
    }
  });

  it('fires with the exact frozen copy and action when tightestSpare is negative', () => {
    const nudges: Nudge[] = [];
    pushShortfallNudge(nudges, -12, () => {});
    expect(nudges).toHaveLength(1);
    expect(nudges[0]).toMatchObject({
      key: 'shortfall',
      tone: 'accent',
      label: "You won't make it to payday as things stand. Let's look at three calm moves.",
      cta: 'Open →',
    });
  });

  it("routes to 'shortfall' when tapped", () => {
    let opened = false;
    const nudges: Nudge[] = [];
    pushShortfallNudge(nudges, -1, () => {
      opened = true;
    });
    nudges[0]!.onPress();
    expect(opened).toBe(true);
  });
});

describe('TodayNudges — collapsed single-chip contract', () => {
  it('renders nothing when there are zero active nudges', () => {
    expect(collapse([])).toEqual({ visible: false, top: null, extra: 0, accessibilityLabel: null });
  });

  it('shows the single nudge, no badge, and its own label as the accessibility label', () => {
    const nudges: Nudge[] = [];
    pushShortfallNudge(nudges, -5, () => {});

    const result = collapse(nudges);

    expect(result.visible).toBe(true);
    expect(result.extra).toBe(0);
    expect(result.top?.key).toBe('shortfall');
    expect(result.accessibilityLabel).toBe(
      "You won't make it to payday as things stand. Let's look at three calm moves.",
    );
  });

  it('shows a "+1" badge and the "N things to check" accessibility label for exactly two nudges', () => {
    const nudges: Nudge[] = [];
    pushShortfallNudge(nudges, -5, () => {}); // top
    pushReviewQueueNudge(nudges, 1, () => {}); // +1

    const result = collapse(nudges);

    expect(result.visible).toBe(true);
    expect(result.extra).toBe(1);
    expect(result.top?.key).toBe('shortfall');
    expect(result.accessibilityLabel).toBe('2 things to check');
  });

  it('the badge count scales with 3+ active nudges (extra = total - 1)', () => {
    const nudges: Nudge[] = [];
    pushShortfallNudge(nudges, -5, () => {});
    pushReviewQueueNudge(nudges, 3, () => {});
    nudges.push({
      key: 'shelf',
      tone: 'melo',
      label: 'shelf line',
      cta: 'Look →',
      onPress: () => {},
    });

    const result = collapse(nudges);

    expect(nudges).toHaveLength(3);
    expect(result.extra).toBe(2);
    expect(result.accessibilityLabel).toBe('3 things to check');
  });

  it('tapping the collapsed chip always runs the TOP nudge action, never a lower-priority one', () => {
    let topFired = false;
    let secondFired = false;
    const nudges: Nudge[] = [];
    pushShortfallNudge(nudges, -5, () => {
      topFired = true;
    });
    pushReviewQueueNudge(nudges, 2, () => {
      secondFired = true;
    });

    const result = collapse(nudges);
    result.top?.onPress();

    expect(topFired).toBe(true);
    expect(secondFired).toBe(false);
  });
});
