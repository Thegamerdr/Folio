# Melo Compression Notes

Date: 2026-06-23

## Pattern Implemented

Compact Melo notes now use the same three-part shape:

- Melo noticed: one short observation.
- Why it matters: one short consequence.
- Your control: one review/source/decision path.

The shared builder is `buildCompactMeloNote()` in `apps/mobile/src/local/localMeloPolicyAdapter.ts`. It normalizes long lines, limits each line length, and gates the final copy with `@folio/melo-policy` before rendering.

## Before

- First Minute rendered a generic "Melo note" paragraph derived from the first-minute briefing.
- Today rendered the longer `today.meloBriefingText` preview.
- Timeline had no visible compact Melo note in the meaning panel.
- Import Review explained the review model but had no source-aware compact Melo note.
- Recovery rendered a hidden/accessibility-only paragraph and a generic "Preview first" panel.
- Data Control explained ownership but did not summarize stored/rejected/audit state in Melo's bounded pattern.

## After

- First Minute: compact note says no account/cloud/AI is required, why reviewed local records matter, and the user can import/add facts/sample.
- Today: top Melo row and the change note use compact observation/control wording.
- Timeline: meaning surface adds a compact note for fact/expectation/review separation.
- Import Review: decision guide now starts with a source-aware compact note.
- Recovery: preview state uses compact note and says pressure is a consequence, not a judgement.
- Data Control: ownership surface shows visible row counts and control over search/export/clear.
- Rejected import explanation: Data Control compact note switches to evidence-only wording when rejected imports exist.

## Policy Checks

- `localMeloPolicyAdapter.test.ts` verifies compact notes include the three labels, stay short, include review/source control, and fall back when advice-like wording is supplied.
- `androidRecoveryReplayEvidence.test.ts` verifies captured Recovery replay XML avoids shame, advice and fake-score wording.
- Full CI passed after formatting.

## Remaining Melo Gaps

- This is not the final Melo character runtime.
- Calendar still has older compact-ish one-line Melo copy, not the full three-label component.
- Sample Briefing still uses its existing example-only Melo note because this pass targeted the requested surfaces only.
