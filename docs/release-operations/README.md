# Melo Release Operations

This directory carries the current operations evidence pack for the Melo release gate. It records
internal readiness truth; it does not self-approve independent security, privacy, legal or
accessibility review and it does not invent a support or disclosure address.

Current commands:

- `pnpm operations:status`: validate the operations pack and print the blocked state.
- `pnpm check:operations-readiness`: same validation, included in normal lint/CI.
- `pnpm operations:guard`: fail until tabletop, rotation drills and vulnerability disclosure
  readiness are complete.

Current state (2026-08-24):

- Incident runbook templates exist for calculation, sync, provider, AI, tax, security and store
  removal incidents.
- Secure support diagnostics and recovery-secret boundaries are defined.
- Breach notification ownership is assigned in the pack.
- The internal tabletop is executed and closed in `tabletop-exercise-record.md`.
- Safe rotation dry-runs are recorded in `rotation-drill-record.md`; production rotations remain
  an owner/provider action.
- The vulnerability-disclosure process is prepared, but the public contact route is an explicit
  `OWNER INPUT REQUIRED` decision in `vulnerability-disclosure-readiness.md`.
