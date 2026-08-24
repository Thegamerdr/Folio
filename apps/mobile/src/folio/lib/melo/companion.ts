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
