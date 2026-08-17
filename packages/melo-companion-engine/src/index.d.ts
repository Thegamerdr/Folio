export type CompanionRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type CompanionPlacementName =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'edge-left'
  | 'edge-right'
  | 'perch-top'
  | 'perch-bottom';

export type CompanionAnchor = Readonly<{
  id: string;
  screen?: string;
  rect: CompanionRect;
  placement: CompanionPlacementName;
  size?: Readonly<{ width: number; height: number }>;
  priority?: number;
  disabled?: boolean;
  offset?: Readonly<{ x: number; y: number }>;
  gap?: number;
  /** The anchor occupies a real layout slot, so sibling exclusion boxes cannot invalidate it. */
  reserved?: boolean;
}>;

export type CompanionExclusion = Readonly<{
  id: string;
  screen?: string;
  rect: CompanionRect;
}>;

export type CompanionAction = Readonly<{
  id: string;
  label: string;
  prompt: string;
}>;

export type CompanionEvent = Readonly<{
  type: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  intensity?: 'small' | 'normal' | 'major';
  direction?: 'improved' | 'worsened' | 'left' | 'right';
  source?: unknown;
  screen?: string;
  attentionTarget?: string | CompanionRect | null;
  target?: string | CompanionRect | null;
  contextAction?: CompanionAction | null;
  salience?: number;
  holdMs?: number;
  cooldownMs?: number;
  ttlMs?: number;
  interruptible?: boolean;
  notice?: boolean;
  sessionId?: string;
  greet?: boolean;
}>;

export type CompanionPersistence = Readonly<{
  get<T = unknown>(key: string, fallback?: T): T;
  set(key: string, value: unknown): unknown;
  remove(key: string): unknown;
  dump?: () => Record<string, unknown>;
}>;

export type CompanionSnapshot = Readonly<{
  instanceId: string;
  presence: string;
  visualState: string;
  screen: string | null;
  screenProfile: Readonly<{
    id: string | null;
    domain: string;
    attention: string;
    hidden: boolean;
    action: CompanionAction | null;
  }>;
  placement: Readonly<{
    anchorId: string | null;
    rect: CompanionRect | null;
    rejected: readonly unknown[];
    userPositioned?: boolean;
  }> | null;
  routeMotion: Readonly<{
    phase: string;
    fromRect: CompanionRect | null;
    toRect: CompanionRect | null;
    direction: 'left' | 'right';
  }> | null;
  bubble:
    | (CompanionAction & Readonly<{ expiresAt: number; origin: string; screen?: string }>)
    | null;
  tucked: boolean;
  quiet: boolean;
  reducedMotion: boolean;
  typing: boolean;
  modalOpen: boolean;
  appHidden: boolean;
  transitionUntil: number;
  lastActivity: number;
  idle: Readonly<{ nextAt: number; lastBeatAt: number; lastVisual: string | null }>;
  attentionTarget: unknown;
  gaze: Readonly<{ x: number; y: number; direction: 'left' | 'right' }>;
  lifecycle: Readonly<{ animationPaused: boolean; suppressedBy: readonly string[] }>;
  renderer: Readonly<Record<string, unknown>>;
  behaviorMemory: Readonly<Record<string, unknown>>;
  relationship: Readonly<Record<string, unknown>>;
  accessibility: Readonly<Record<string, unknown>>;
}>;

export const PRESENCE: Readonly<Record<string, string>>;
export const EVENTS: Readonly<Record<string, string>>;
export const PERSISTED_KEYS: Readonly<Record<string, string>>;
export const SCREEN_PROFILES: Readonly<Record<string, unknown>>;
export const VISUAL_STATES: readonly string[];
export const DEFAULT_COMPANION_SIZE: Readonly<{ width: number; height: number }>;

export class CompanionEngine {
  constructor(
    options?: Readonly<{
      clock?: () => number;
      persistence?: CompanionPersistence;
      rendererManifest?: Readonly<Record<string, unknown>>;
      instanceId?: string;
      timings?: Readonly<Record<string, number>>;
      size?: Readonly<{ width: number; height: number }>;
    }>,
  );
  subscribe(listener: (snapshot: CompanionSnapshot) => void): () => void;
  snapshot(): CompanionSnapshot;
  destroy(): void;
  emit(event: CompanionEvent): CompanionSnapshot;
  registerAnchor(anchor: CompanionAnchor): () => void;
  registerExclusion(exclusion: CompanionExclusion): () => void;
  setOptions(
    options?: Readonly<{
      reducedMotion?: boolean;
      typing?: boolean;
      modalOpen?: boolean;
      appHidden?: boolean;
    }>,
  ): void;
  setShell(shell: CompanionRect): void;
  setAttentionTarget(target: unknown): void;
  setPreferredAnchor(anchorId: string | null): void;
  setWardrobe(value: string | null): void;
  setTucked(value: boolean): void;
  setQuiet(value: boolean): void;
  dragStart(options?: Readonly<{ rect?: CompanionRect | null }>): boolean;
  dragMove(rect: CompanionRect): boolean;
  dragEnd(options?: Readonly<{ anchorId?: string | null }>): boolean;
  engage(contextAction?: CompanionAction | null): boolean;
  dismissBubble(): void;
  navigate(screen: string, options?: Readonly<{ attentionTarget?: unknown }>): CompanionSnapshot;
  tick(at?: number): CompanionSnapshot;
}

export function createMemoryPersistence(seed?: Record<string, unknown>): CompanionPersistence & {
  dump(): Record<string, unknown>;
};
export function createJsonStoragePersistence(
  storage: Readonly<{
    getItem?: (key: string) => string | null | undefined;
    setItem?: (key: string, value: string) => unknown;
    removeItem?: (key: string) => unknown;
  }>,
  options?: Readonly<{ prefix?: string }>,
): CompanionPersistence;
export function resolveScreenProfile(screen: string | null): CompanionSnapshot['screenProfile'];
export function resolveEventVisual(event: CompanionEvent): string | null;
export function rectsIntersect(a: CompanionRect, b: CompanionRect, margin?: number): boolean;
export function rectInside(inner: CompanionRect, outer: CompanionRect): boolean;
export function clampRect(
  rect: CompanionRect,
  shell: CompanionRect,
  margin?: number,
): CompanionRect;
