# Melo Decision Ledger

Status: superseded by Phase D implementation docs. This file remains the Phase B rationale, but the executable Phase D contract is now `MELO_PHASE_D_DECISION_LEDGER_IMPLEMENTATION.md`, `MELO_DECISION_MATERIALITY_RULES.md`, `MELO_DECISION_LEDGER_STORAGE.md`, `MELO_DECISION_OUTCOMES.md`, `MELO_FORECAST_EVALUATION.md`, `MELO_DECISION_PRIVACY.md`, `MELO_DECISION_UI_STATES.md` and `MELO_PHASE_D_MIGRATION.md`.

Phase B executable interface: `DecisionLedgerRecord` in `packages/domain/src/trustedCore.ts`.

## Purpose

The Decision Ledger records material financial decisions so Melo can explain what was known, what was assumed, what the user chose, and whether the forecast later proved wrong. It exists for accountability, correction, learning with permission, and user trust.

## Material decision definition

A decision is material when it can affect a user's ability to meet commitments, avoid shortfall, change debt/cashflow, change recurring obligations, or rely on a forecast. Examples: "Can I spend £80?", "Move this bill?", "Pause/cancel a subscription?", "Borrow from a pot?", "Accept a recovery plan?", "Use this statement balance?", "Commit to this scenario?".

Non-material events are not ledger entries by default: opening a screen, reading a tip, changing a theme, dismissing a non-financial nudge, or viewing historical charts.

## Domain model

```ts
type MeloDecisionRecord = {
  id: string;
  workspaceId: 'personal' | `business.${string}`;
  createdAt: string;
  userQuestion: string;
  userPriority:
    | 'avoid_shortfall'
    | 'protect_commitments'
    | 'spend_decision'
    | 'recover'
    | 'plan'
    | 'correct'
    | 'other';
  contextRoute: string;
  factRefs: string[];
  truthClasses: Record<string, string>;
  missingInformation: string[];
  assumptions: string[];
  scenarios: { id: string; label: string; forecastVersionId: string; summary: string }[];
  chosenScenarioId: string | null;
  forecastVersionId: string;
  meloExplanation: string | null;
  proposedMoves: { id: string; label: string; reversible: boolean; risk: string }[];
  userChoice: 'accepted' | 'rejected' | 'saved' | 'deferred' | 'corrected' | 'unknown';
  consent: { required: boolean; capturedAt: string | null; label: string | null };
  outcome: {
    checkedAt: string | null;
    result: 'worked' | 'missed' | 'unknown';
    note: string | null;
  };
  forecastErrorMinor: number | null;
  userCorrectionRefs: string[];
  learningPermitted: boolean;
  audit: { at: string; action: string; actor: 'user' | 'melo' | 'system'; ref?: string }[];
};
```

## Storage model

- Short term: add a bounded decision table/repository alongside existing local persistence; do not repurpose the full `AppState` blob as the only ledger.
- Existing anchors: `apps/mobile/src/folio/store.ts`, `apps/mobile/src/folio/lib/persist.ts`, `packages/storage`, and SQLCipher-related local storage.
- Ledger records reference facts, forecast versions, and source records; they do not duplicate every transaction or file.
- Keep per-workspace isolation. Personal records never read Business records and Business records never read Personal records.

## Privacy model

- Store only decision-relevant context.
- Do not store unnecessary emotional detail, therapy-like labels, or inferred personality traits.
- Melo memory may remember product-use preferences and permitted financial corrections; it must not silently convert personal disclosures into durable profiling.
- Learning from a decision requires explicit permission when it goes beyond deterministic correction.

## Retention model

| Record                   | Default retention                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Decision record          | Retain locally until user deletes/export-resets.                                                      |
| Forecast version summary | Retain with decision record; compact underlying detail after retention window if source facts remain. |
| Melo explanation         | Retain only decision-relevant text.                                                                   |
| Raw import files         | Separate evidence storage policy; not required inside ledger.                                         |
| Demo/sample decisions    | Never stored in real workspace.                                                                       |

## Export format

Export as JSON plus human-readable CSV summary:

- JSON preserves IDs, fact refs, truth classes, scenarios, consent, and audit trail.
- CSV contains date, question, chosen move, outcome, confidence, source count, and correction status.
- Native export must stage in cache and delete after sharing, as contained in `apps/mobile/src/folio/lib/exportNative.ts`.

## Correction flow

1. User challenges a number or decision.
2. Melo shows source breakdown and truth classes.
3. User edits, confirms, or discards the underlying fact.
4. A correction record points back to the original fact/decision.
5. Affected Safe Range, scenario, and decision records are recomputed or marked superseded.
6. Audit remains visible and exportable.

## Forgetting/deletion flow

- User can delete a decision record without deleting underlying financial facts.
- User can delete source facts; affected decisions become redacted and marked incomplete.
- User can clear Melo learning permission; future explanations cannot rely on that learned preference.
- Full workspace deletion must remove ledger, local facts, companion memory, and evidence refs.

## UI surfaces

- Today: recent material decision receipt and changed-answer explanation.
- Safe Range source drawer: decision history link when answer depends on a prior choice.
- Review/correction: "this changed these answers".
- Melo chat: confirm chip creates a decision record only for material tools/questions.
- Account/Data/Trust: export/delete Decision Ledger.

## Melo tool boundaries

- Melo may propose a move.
- Melo may explain a deterministic result.
- Melo may ask for missing information.
- Melo may compare validated scenarios.
- Melo may not write material state until the user confirms.
- `apps/mobile/src/folio/sheets/MeloChatSheet.tsx` and `apps/mobile/src/folio/store.ts` are current confirmation anchors.

## Outcome follow-up

For material predictions, Melo should later ask or infer whether the decision worked only when the outcome can be checked without shame or surveillance. Follow-up copy must be neutral: forecast missed, assumption changed, or source went stale.
