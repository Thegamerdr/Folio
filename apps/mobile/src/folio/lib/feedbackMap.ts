export type FeedbackHaptic = 'light' | 'medium' | 'heavy' | 'success' | 'error' | null;
export type FeedbackSound = 'bell-warm' | 'chime-soft' | null;

export type FeedbackEvent =
  | 'log-commit'
  | 'undo'
  | 'path-scrub-commit'
  | 'pot-commit'
  | 'ritual-step'
  | 'ritual-complete'
  | 'earn-stamp'
  | 'postcard-shared'
  | 'recovery-confirm'
  | 'shortfall-closed'
  | 'delete-confirm'
  | 'subscription-cancelled'
  | 'error'
  | 'voice-hold-start'
  | 'voice-hold-release'
  | 'melo-intro-step'
  | 'transaction-corrected'
  | 'receipt-attached';

export const FEEDBACK_MAP = {
  'log-commit': { haptic: 'light', sound: null },
  undo: { haptic: 'light', sound: null },
  'path-scrub-commit': { haptic: 'medium', sound: null },
  'pot-commit': { haptic: 'medium', sound: null },
  'ritual-step': { haptic: 'light', sound: null },
  'ritual-complete': { haptic: 'success', sound: 'bell-warm' },
  'earn-stamp': { haptic: 'success', sound: 'chime-soft' },
  'postcard-shared': { haptic: null, sound: 'bell-warm' },
  'recovery-confirm': { haptic: 'medium', sound: null },
  'shortfall-closed': { haptic: 'success', sound: 'chime-soft' },
  'delete-confirm': { haptic: 'heavy', sound: null },
  'subscription-cancelled': { haptic: 'medium', sound: null },
  error: { haptic: 'error', sound: null },
  'voice-hold-start': { haptic: 'light', sound: null },
  'voice-hold-release': { haptic: 'light', sound: null },
  'melo-intro-step': { haptic: 'light', sound: null },
  'transaction-corrected': { haptic: 'light', sound: null },
  'receipt-attached': { haptic: 'light', sound: null },
} as const satisfies Readonly<
  Record<FeedbackEvent, Readonly<{ haptic: FeedbackHaptic; sound: FeedbackSound }>>
>;
