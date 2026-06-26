// Melo — the embodied guide. State machine + copy registry (pure, no React Native, so it is
// unit-testable). Melo interprets and reassures; it NEVER writes ledger state — only the user does.
//
// Copy rules (enforced by tests): one primary line, at most one supporting line, no paragraphs,
// no advice, no shame, no fake certainty. The melo.test.ts file holds the concrete banned phrases.

export type MeloState =
  | 'melo_idle'
  | 'melo_start'
  | 'melo_guiding_input'
  | 'melo_review_waiting'
  | 'melo_review_safe_to_add'
  | 'melo_path_explaining'
  | 'melo_uncertainty'
  | 'melo_file_unreadable'
  | 'melo_privacy_trust'
  | 'melo_success_saved'
  | 'melo_reduced_motion';

export type MeloMood = 'calm' | 'attentive' | 'reassuring' | 'soft-concern';

export type MeloCopy = Readonly<{ primary: string; supporting?: string }>;

// One calm line (plus an optional second) for each moment in the core slice.
export const MELO_COPY: Readonly<Record<MeloState, MeloCopy>> = {
  melo_idle: { primary: "I'm right here with you." },
  melo_start: { primary: 'Start rough — you can fix anything later.' },
  melo_guiding_input: {
    primary: 'A rough number is fine.',
    supporting: 'We only need enough to start your path.',
  },
  melo_review_waiting: {
    primary: 'This row is waiting.',
    supporting: 'Add it only if it belongs to you.',
  },
  melo_review_safe_to_add: { primary: 'Nothing changes until you add it.' },
  melo_path_explaining: { primary: 'The tightest point is after bills are set aside.' },
  melo_uncertainty: { primary: 'Some rows still need checking.' },
  melo_file_unreadable: {
    primary: "I couldn't read this one clearly.",
    supporting: 'The file is saved — you can still add the numbers from it.',
  },
  melo_privacy_trust: {
    primary: 'Files and rows stay on this device.',
    supporting: 'Nothing leaves unless you export it.',
  },
  melo_success_saved: { primary: 'Added. Your path just updated.' },
  melo_reduced_motion: { primary: "I'm here when you need me." },
};

// The expressive mood per state — the placeholder figure shifts a little with it, and a future
// 3D/Rive Melo can map these moods to poses.
export const MELO_MOOD: Readonly<Record<MeloState, MeloMood>> = {
  melo_idle: 'calm',
  melo_start: 'calm',
  melo_guiding_input: 'attentive',
  melo_review_waiting: 'attentive',
  melo_review_safe_to_add: 'reassuring',
  melo_path_explaining: 'attentive',
  melo_uncertainty: 'soft-concern',
  melo_file_unreadable: 'soft-concern',
  melo_privacy_trust: 'calm',
  melo_success_saved: 'reassuring',
  melo_reduced_motion: 'calm',
};

/** Resolve Melo's line. A caller may pass a context-specific line (e.g. the tapped route point),
 *  but it still goes through here so the one-line / no-paragraph shape is preserved. */
export function meloLine(state: MeloState, override?: string): MeloCopy {
  if (override && override.trim().length > 0) return { primary: override.trim() };
  return MELO_COPY[state];
}

export function meloMood(state: MeloState): MeloMood {
  return MELO_MOOD[state];
}
