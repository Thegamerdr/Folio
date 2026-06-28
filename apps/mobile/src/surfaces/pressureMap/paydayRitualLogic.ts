// Pure decision + record-assembly logic for the Payday Ritual — no React Native imports, so the
// ritual's behaviour (which step's stat card opens which editor sheet, and that next-you's edited
// values reach the closed-cycle record) is unit-testable under vitest without rendering the surface,
// the same way routeMath / timelinePresentation are. The .tsx screen owns the wizard state +
// presentation and delegates these decisions here.

import type { CreateCycleRecordInput } from '../../local/localLedger';

// The web hardcodes a note string; the RN port lets next-you actually write the line. This is the
// suggested text, shown as the placeholder so the screen reads identically until the user types.
export const NOTE_SUGGESTION = "Don't move Octopus this time. Hold the line on takeaway.";

// Two of the four steps are decisions next-you makes by tapping the stat card to open an editor:
// step three (index 2) shows the "Next tight point" stat and opens the keypad; step four (index 3)
// shows the "Note" stat and opens the note sheet. Steps one and two are read-only reflections of
// engine figures, so their card never opens anything.
export const STEP_EDITS_TIGHT_POINT = 2;
export const STEP_EDITS_NOTE = 3;

// Which editor sheet (if any) this step's stat card opens. null = a read-only step.
export type StatEditor = 'tight' | 'note';

export function statEditorForStep(step: number): StatEditor | null {
  if (step === STEP_EDITS_TIGHT_POINT) return 'tight';
  if (step === STEP_EDITS_NOTE) return 'note';
  return null;
}

// The keypad collects whole pounds (matching the MoneyPad); the record stores MINOR units. Strays
// like a currency symbol or grouping commas are stripped so only the digits drive the figure.
export function poundsToMinor(pounds: string): number {
  const clean = pounds.replace(/[^0-9]/g, '');
  return clean.length === 0 ? 0 : Number(clean) * 100;
}

// next-you's note. An empty (or whitespace-only) line falls back to the suggested text so the
// recorded line always reads well rather than being blank.
export function resolveNote(note: string): string {
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : NOTE_SUGGESTION;
}

// Assemble the closed-cycle record in MINOR units from the ritual's wizard state. The spare it held
// and the set-aside come straight from the engine view-models; the tight point and the note are the
// two things next-you sets here, so they flow in from wizard state.
export function buildCycleRecordInput(state: {
  label: string;
  heldSpareMinor: number;
  nextTightMinor: number;
  setAsideMinor: number;
  note: string;
}): CreateCycleRecordInput {
  return {
    label: state.label,
    spareMinor: state.heldSpareMinor,
    tightPointMinor: state.nextTightMinor,
    setAsideMinor: state.setAsideMinor,
    note: resolveNote(state.note),
  };
}
