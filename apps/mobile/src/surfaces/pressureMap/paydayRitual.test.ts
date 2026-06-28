import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  NOTE_SUGGESTION,
  STEP_EDITS_NOTE,
  STEP_EDITS_TIGHT_POINT,
  buildCycleRecordInput,
  poundsToMinor,
  resolveNote,
  statEditorForStep,
} from './paydayRitualLogic.js';

// Payday Ritual guards.
//
// Two kinds of assertion (mirroring the sibling new-direction core-slice guards):
//   - Behavioural: the ritual's pure decisions (which step opens which editor, and that next-you's
//     edited tight point + note reach the closed-cycle record) run through paydayRitualLogic, so they
//     survive any surface refactor. This is the real proof that two of the four "decisions" the
//     ritual claims to capture are no longer hardcoded.
//   - Source pins: the RN wiring that a node test can't render — the tappable stat card opening each
//     sheet, the keypad/note fields feeding wizard state, and the finish path recording it — is pinned
//     on the source text the same way the sibling guards do. The real visual proof is the installed
//     APK; these stop the wiring from silently regressing back to unreachable sheets.

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url).href), 'utf8');
}

describe('payday ritual — the stat card opens the right editor (behavioural)', () => {
  it('the two reflection steps open nothing', () => {
    expect(statEditorForStep(0)).toBeNull();
    expect(statEditorForStep(1)).toBeNull();
  });

  it('the next-tight-point step opens the keypad', () => {
    expect(statEditorForStep(STEP_EDITS_TIGHT_POINT)).toBe('tight');
  });

  it('the note step opens the note sheet', () => {
    expect(statEditorForStep(STEP_EDITS_NOTE)).toBe('note');
  });
});

describe("payday ritual — next-you's edits reach the closed-cycle record (behavioural)", () => {
  it('a user-edited tight point and note flow into the record in MINOR units', () => {
    const input = buildCycleRecordInput({
      label: 'June',
      heldSpareMinor: 12_300,
      nextTightMinor: poundsToMinor('950'),
      setAsideMinor: 5_000,
      note: '  Hold the line on takeaway  ',
    });
    expect(input).toEqual({
      label: 'June',
      spareMinor: 12_300,
      tightPointMinor: 95_000,
      setAsideMinor: 5_000,
      note: 'Hold the line on takeaway',
    });
  });

  it('an untouched note falls back to the suggested line, never empty', () => {
    expect(resolveNote('')).toBe(NOTE_SUGGESTION);
    expect(resolveNote('   ')).toBe(NOTE_SUGGESTION);
    expect(
      buildCycleRecordInput({
        label: 'June',
        heldSpareMinor: 0,
        nextTightMinor: 0,
        setAsideMinor: 0,
        note: '',
      }).note,
    ).toBe(NOTE_SUGGESTION);
  });

  it('whole pounds convert to minor units and stray formatting is ignored', () => {
    expect(poundsToMinor('1200')).toBe(120_000);
    expect(poundsToMinor('£1,200')).toBe(120_000);
    expect(poundsToMinor('')).toBe(0);
  });
});

describe('payday ritual — the surface wires the stat card and sheets to the logic (source pins)', () => {
  const screen = read('./paydayRitual.tsx');

  it('the decision steps make the stat card open the matching sheet', () => {
    expect(screen).toContain('statEditorForStep(step)');
    expect(screen).toContain("statEditor === 'tight'");
    expect(screen).toContain('setTightSheetOpen(true)');
    expect(screen).toContain("statEditor === 'note'");
    expect(screen).toContain('setNoteSheetOpen(true)');
  });

  it('each sheet edits its own value — the note is a real, typeable field', () => {
    // The keypad drives the tight-point pounds; the note TextInput drives the note.
    expect(screen).toContain('onChange={setNextTightPounds}');
    expect(screen).toContain('onChange={setNote}');
    expect(screen).toContain('onChangeText={onChange}');
    // The dead read-only note display is gone — onChange is now actually consumed.
    expect(screen).not.toContain('{value.trim().length > 0 ? value : NOTE_SUGGESTION}');
  });

  it('the finish path records the edited values and the dead spare local is gone', () => {
    expect(screen).toContain('buildCycleRecordInput(');
    expect(screen).toContain('onCloseCycle(');
    expect(screen).not.toContain('const spareMinor =');
  });
});
