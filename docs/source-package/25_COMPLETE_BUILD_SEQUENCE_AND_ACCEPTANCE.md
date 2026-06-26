# Complete Build Sequence and Acceptance

## Principle

This is a greenfield sequence. Do not begin by editing Folio V1. Build a new repository and prove the core architecture before selectively copying donor assets.

Each phase ends with executable evidence. The agent may not declare a phase complete because screens exist.

## Phase 0 — Repository and decision freeze

Deliver:

- new repository/workspaces;
- CI, formatting, type checking, test runner;
- ADRs and dependency rules;
- synthetic data policy;
- V1 donor audit workspace separate from source tree.

Gate: no import from V1 production code yet.

## Phase 1 — Native risk spikes

Prove:

- encrypted SQLite + FTS5;
- key wrapping/unlocking;
- encrypted document storage;
- Expo release builds on iOS/Android;
- accessibility primitives;
- local notification scheduling;
- OCR/voice capability detection;
- OTA/native compatibility policy.

Gate: written spike report and chosen database/crypto stack.

## Phase 2 — Pure domain and finance engines

Build:

- money/date/value objects;
- workspace/fact/expectation model;
- event derivation;
- recurrence;
- forecast/safe-to-spend;
- debts, budgets and plans;
- scenario comparison;
- certainty/provenance.

Gate: all golden vectors/property tests pass with no UI.

## Phase 3 — Local persistence and projections

Build:

- schema/migrations/repositories;
- command/audit/outbox path;
- FTS index;
- derived projection invalidation/rebuild;
- export/import backup.

Gate: crash/migration/250k-row/endurance tests pass.

## Phase 4 — Mobile shell and first 60 seconds

Build:

- vault create/unlock;
- Today/Melo first launch;
- synthetic interactive preview;
- minimal quick-start path;
- import choice;
- visible privacy promise;
- navigation skeleton.

Gate: a new user gets a truthful first value or labelled preview in under 60 seconds without permissions or account.

## Phase 5 — Import/review/indexing

Build:

- CSV/OFX/QFX/QIF;
- PDF/image capture/OCR adapter;
- reconciliation/dedupe/transfers;
- review queue;
- provenance and search.

Gate: import corpus and idempotency pass; first real-data briefing generated.

## Phase 6 — Today, timeline, calendar and transactions

Build:

- briefing candidate engine;
- visual position/remaining budget;
- timeline and transaction detail;
- medium planner/calendar;
- local reminders;
- actual-versus-expected clarification.

Gate: no dashboard dependency; full offline daily loop works.

## Phase 7 — Melo deterministic system

Build:

- bounded intents/slots;
- typed proposals;
- personality modes;
- proactive ranking;
- review/commit flow;
- bad-month mode;
- local templates.

Gate: core Melo works with all model/network access disabled.

## Phase 8 — Plans, progress, fun and recovery

Build:

- optional configurable plan designer;
- dynamic rebase;
- milestones/momentum;
- recovery presentation;
- visual journey and selected fun layer;
- bespoke retention settings.

Gate: unexpected event cascades through forecast/calendar/plan and yields a non-shaming updated path.

## Phase 9 — Security, export and local launch readiness

Build/complete:

- app lock;
- data/privacy centre;
- full export/delete;
- accessibility pass;
- threat model/DPIA;
- support diagnostics;
- app-store synthetic demo.

Gate: independent security and accessibility reviews; local-only beta ready.

## Phase 10 — Cloud account, encrypted backup and sync

Build:

- optional auth;
- key recovery;
- device registry;
- encrypted envelopes/snapshots;
- restore/device migration;
- account deletion web route.

Gate: server cannot decrypt test vault; conflict/restore/lost-device drills pass.

## Phase 11 — Optional AI

Build:

- provider/model registry;
- server-side gateway;
- redaction/context builder;
- on-device adapters;
- quotas/cost controls;
- evaluation pipeline.

Gate: AI off remains complete; model route passes safety/faithfulness thresholds.

## Phase 12 — Open Banking

Build provider adapter, consent dashboard, reconciliation, stale/gap state and revocation.

Gate: regulated partner/legal/store review; manual mode unchanged.

## Phase 13 — Business workspace

Expose already-separated business domain through distinct navigation and visual context. Add invoices, clients, receipts, tax-period prep and exports.

Gate: automated isolation suite proves zero personal leakage.

## Phase 14 — Direct tax/collaboration expansions

Only after product/market/legal readiness:

- HMRC MTD integration;
- accountant collaboration;
- shared household;
- multiple businesses;
- wider jurisdictions.

Each is a separate programme with new threat/privacy/regulatory review.

## Definition of done for every feature

A feature is done only when it has:

- product/constitutional fit;
- typed domain contract;
- offline behavior;
- accessibility behavior;
- privacy/security review;
- error/recovery state;
- tests and telemetry plan;
- documentation;
- no unresolved cross-workspace/advice issue.
