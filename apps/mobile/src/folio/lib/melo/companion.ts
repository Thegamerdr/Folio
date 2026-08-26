/**
 * Companion semantics shared by the personal and business Melo surfaces.
 *
 * This is deliberately small and pure: screen owners provide the real route,
 * financial-derived mood and optional business action. It never creates a
 * second renderer or calculates money facts.
 */

export type MeloPosition = 'auto' | 'left' | 'right';

export type MeloPresence =
  | 'hidden'
  | 'waiting'
  | 'perched'
  | 'offering-help'
  | 'engaged'
  | 'tucked';

export type MeloSurface = 'personal' | 'business';

export type MeloContextAction = {
  id: string;
  label: string;
  prompt: string;
};

export const MELO_DRAG_THRESHOLD_DP = 6;
export const MELO_LONG_GRAB_MS = 250;

/** A release is a tap only when it was both short and still. This keeps the
 * synthetic release after a grab from opening chat or the context sheet. */
export function classifyMeloGesture(
  dx: number,
  dy: number,
  durationMs: number,
): 'tap' | 'drag' {
  return Math.hypot(dx, dy) >= MELO_DRAG_THRESHOLD_DP || durationMs >= MELO_LONG_GRAB_MS
    ? 'drag'
    : 'tap';
}

/** Native releases snap to one of the authored semantic perches. Arbitrary
 * screen coordinates are never persisted because they could cover a CTA,
 * chart or tab bar after a layout change. */
export function meloDropSide(
  x: number,
  companionSize: number,
  viewportWidth: number,
): Exclude<MeloPosition, 'auto'> {
  return x + companionSize / 2 < viewportWidth / 2 ? 'left' : 'right';
}

const SHELL_CONTEXT_ACTIONS: Readonly<Record<string, MeloContextAction>> = {
  today: {
    id: 'today.explain-path',
    label: "Explain today's path",
    prompt: "Explain today's money path and what is driving it.",
  },
  'today-after': {
    id: 'today-after.explain',
    label: 'Explain what just changed',
    prompt: "Explain what changed on today's path just now.",
  },
  plan: {
    id: 'plan.pressure',
    label: 'What could get tight',
    prompt: 'Explain the upcoming pressure in my plan and what could get tight.',
  },
  plans: {
    id: 'plans.pressure',
    label: 'What could get tight',
    prompt: 'Explain the upcoming pressure in my plan and what could get tight.',
  },
  review: {
    id: 'review.changed',
    label: 'Explain what needs checking',
    prompt: 'Explain what is waiting to be checked and why.',
  },
  timeline: {
    id: 'timeline.changed',
    label: 'Explain what changed',
    prompt: 'Explain what changed recently and why.',
  },
  whatif: {
    id: 'whatif.explain',
    label: 'Try this with me',
    prompt: 'Explain what this what-if would do to my path.',
  },
  visualizer: {
    id: 'visualizer.explain',
    label: 'Explain this picture',
    prompt: 'Explain what this view of my money is showing.',
  },
  account: {
    id: 'account.sources',
    label: 'Explain my money sources',
    prompt: 'Explain which money sources are available and what each one shares.',
  },
  privacy: {
    id: 'privacy.explain',
    label: 'Explain what Melo holds',
    prompt: 'Explain what Melo holds about me and how it is used.',
  },
};

export function deriveShellContextAction(screen: string): MeloContextAction | undefined {
  return SHELL_CONTEXT_ACTIONS[screen];
}

export type MeloContextInput = {
  surface: MeloSurface;
  screen: string;
  mood: string;
  quietMode: boolean;
  tucked?: boolean;
  /** A real route the host already owns, kept as metadata for the caller. */
  action?: MeloContextAction;
};

export function deriveMeloPresence(
  input: Pick<MeloContextInput, 'quietMode' | 'tucked' | 'action'>,
): MeloPresence {
  if (input.tucked) return 'tucked';
  if (input.quietMode) return 'hidden';
  return input.action ? 'offering-help' : 'perched';
}

export function derivePersonalContextAction(mood: string): MeloContextAction {
  if (mood === 'concern' || mood === 'protect' || mood === 'think') {
    return {
      id: 'personal-tight-point',
      label: 'Look at the tight point',
      prompt: "I'll show the part of your route that needs the most care.",
    };
  }
  if (mood === 'cheer' || mood === 'celebrate') {
    return {
      id: 'personal-ritual',
      label: 'Take the next small win',
      prompt: 'A quiet look at what changed — then one useful next step.',
    };
  }
  return {
    id: 'personal-route',
    label: 'See your route to payday',
    prompt: 'The route is the useful bit: what lands, what leaves, and where the low point sits.',
  };
}

export function deriveBusinessContextAction(action?: MeloContextAction): MeloContextAction {
  return (
    action ?? {
      id: 'business-cash',
      label: 'Open the business cash view',
      prompt: 'Cash, upcoming commitments and runway in one calm view.',
    }
  );
}

export type MeloAnchorRect = { x: number; y: number; width: number; height: number };

export type MeloSafeBounds = { width: number; height: number; inset?: number };

/**
 * Resolves a semantic anchor into an in-bounds position. The native host uses
 * normal layout, so this helper is primarily for keyboard/position choices and
 * tests; it intentionally refuses unsafe placements instead of parking Melo
 * over a CTA, chart or tab bar.
 */
export function resolveMeloAnchor(
  anchor: MeloAnchorRect,
  size: number,
  position: MeloPosition,
  bounds: MeloSafeBounds,
): { x: number; y: number; side: Exclude<MeloPosition, 'auto'> } | null {
  const inset = bounds.inset ?? 8;
  const preferred = position === 'auto' ? 'right' : position;
  const sides: Array<Exclude<MeloPosition, 'auto'>> = [
    preferred,
    preferred === 'right' ? 'left' : 'right',
  ];
  for (const side of sides) {
    const x = side === 'right' ? anchor.x + anchor.width - size : anchor.x;
    const y = anchor.y + anchor.height / 2 - size / 2;
    if (
      x >= inset &&
      y >= inset &&
      x + size <= bounds.width - inset &&
      y + size <= bounds.height - inset
    ) {
      return { x, y, side };
    }
  }
  return null;
}
