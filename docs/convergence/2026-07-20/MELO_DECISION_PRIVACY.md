# Decision Ledger privacy

Status: Phase D privacy contract.

## Stored

Only decision-relevant context is stored:

- question text
- materiality rule ids/effects
- fact snapshots and fact refs
- unknowns, contradictions and assumptions
- Safe Range / forecast snapshot
- scenarios and proposed moves
- choice, consent, outcome, corrections and learning controls
- audit events

## Not stored

- full chat transcripts
- chain of thought
- semantic embeddings
- vector memory
- inferred personality traits
- shame, motivation or discipline scores
- raw uploaded documents unless already retained by the evidence system
- whole AppState snapshots inside ledger entries
- cross-workspace context

## Learning

Learning is permissioned and reversible. Phase D supports disabling learning for one decision, removing learning refs from a decision, and deleting the receipt. No applied learning is hidden from the user.

## Export and deletion

Full export includes the complete `decisionLedger` entries in the JSON export and a human-readable `decision-ledger.csv` summary. The JSON path preserves facts, assumptions, scenarios, choices, consent, outcomes, forecast evaluations, corrections, audit events and learning controls.

Deleting a decision removes it from durable exportable entries and clears optional learning refs.
