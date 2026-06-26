# Release Operations

This directory carries the local operations pack for the public-release gate. It does not prove
production readiness by itself. It defines the runbooks, tabletop evidence shape, rotation drill
shape and vulnerability disclosure checklist that must be exercised before `RB-T185` can close.

Current commands:

- `pnpm operations:status`: validate the operations pack and print the blocked state.
- `pnpm check:operations-readiness`: same validation, included in normal lint/CI.
- `pnpm operations:guard`: fail until tabletop, rotation drills and vulnerability disclosure
  readiness are complete.

Current state:

- Incident runbook templates exist for calculation, sync, provider, AI, tax, security and store
  removal incidents.
- Secure support diagnostics and recovery-secret boundaries are defined.
- Breach notification ownership is assigned in the pack.
- Tabletop exercise, rotation drills and vulnerability disclosure readiness remain blocked.
