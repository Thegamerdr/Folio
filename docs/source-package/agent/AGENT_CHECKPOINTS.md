# Agent Checkpoints and Evidence Contract

The implementation agent works in phases and must not compress them into a single unreviewable code dump.

## Checkpoint format

At every checkpoint produce:

```text
Phase / task IDs
What was built
Files changed
Contracts implemented
Tests run and results
Offline evidence
Accessibility evidence
Security/privacy impact
V1 donor items used and approval reference
Screenshots/recording where visible
Known limitations/risks
Next exact step
```

## Mandatory checkpoints

### C0 — Greenfield proof

- new repository path;
- dependency graph contains no V1 runtime dependency;
- CI baseline passes;
- V1 donor audit exists but no donor code is imported.

### C1 — Native feasibility

- encrypted DB/FTS/key/document spike on iOS and Android;
- performance figures;
- build/OTA compatibility matrix;
- ADR selecting/rejecting driver.

### C2 — Finance engine

- all golden forecast/import vectors pass;
- property tests;
- no UI/native/cloud dependency.

### C3 — Local truth system

- schema/migrations/commands/audit/projections;
- crash/restart and large-data proof;
- workspace isolation suite.

### C4 — First minute

- real-device recording of all three paths;
- no permission/account wall;
- under-60-second measured result;
- labelled synthetic data.

### C5 — Daily loop

- Today/timeline/calendar/search/import flow offline;
- explainability/provenance;
- screen-reader recording.

### C6 — Melo

- network/model disabled demo;
- question limit and proposal review;
- advice-language tests;
- tone modes do not alter numbers.

### C7 — Plans/recovery

- unexpected-event cascade;
- plan rebase diff;
- bad-month UX;
- progress/celebration controls.

### C8 — Local beta

- security/accessibility/DPIA/store checklist;
- export/restore/lost-device plan;
- no critical defects.

### C9+ — Optional services

Cloud, AI, Open Banking and business each require their own checkpoint and cannot weaken local-only behavior.

## Stop conditions

Stop implementation and record a decision when:

- database encryption/FTS cannot be proven;
- a design requires cloud for core;
- an AI route would write financial state directly;
- personal/business isolation cannot be demonstrated;
- wording/behavior risks regulated advice;
- an unresolved founder sign-off would materially alter UX/domain architecture;
- data loss/corruption is observed.

Do not stop for ordinary engineering choices that can be made reversibly within the constitution; record them in an ADR.
