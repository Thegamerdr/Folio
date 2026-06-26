# Testing, Quality and Observability

## Quality strategy

Folio handles emotionally and financially sensitive information. “Looks right” is not enough. The project uses executable contracts, deterministic fixtures, property tests and real-device testing.

## Test pyramid

### Pure unit/property tests

For:

- money arithmetic;
- recurrence expansion;
- forecast ordering;
- safe-to-spend constraints;
- debt interest/payment schedules;
- plan rebase;
- budget rollover;
- confidence/certainty labels;
- advice-language rules;
- intervention ranking.

Properties include:

- no float rounding drift;
- transfers do not change net position;
- posted replacement of pending does not double count;
- adding an outgoing cannot increase projected cash at the same date;
- forecasts are deterministic for identical inputs;
- personal records never appear in business queries.

### SQLite integration tests

- migrations and constraints;
- import atomicity/idempotency;
- FTS index/rebuild;
- outbox/tombstones;
- encrypted open/close/copy;
- concurrent readers/writers;
- corruption/recovery behavior.

### Adapter contract tests

Every database, OCR, AI, bank, notification, calendar and cloud adapter has a fake plus contract suite.

### Mobile component and accessibility tests

- large text;
- screen-reader labels/focus;
- reduced motion;
- offline/loading/error states;
- sensitive notification previews;
- workspace identity.

### End-to-end flows

- first 60 seconds with no data;
- CSV import to Today briefing;
- pending-to-posted reconciliation;
- higher rent clarification;
- create and rebase debt plan;
- bad-month unexpected expense;
- document capture and link;
- local-only export/restore;
- cloud encrypted restore;
- business workspace tax export isolation;
- account/cloud deletion.

## Golden financial cases

Machine-readable vectors are the source of truth. Every engine implementation must pass them before UI integration. Add regression vectors for every production financial defect.

## AI evaluation

Separate model quality from finance correctness.

Metrics:

- structured schema validity;
- intent accuracy;
- faithful inclusion of supplied figures;
- no invented amount/date;
- no personal recommendation language;
- correct uncertainty;
- appropriate bad-month tone;
- no workspace leakage;
- prompt-injection resistance;
- questions stop within limit.

Run evaluations against every model/prompt version. Keep deterministic template fallback.

## Import corpus

Build a licensed/synthetic corpus of:

- common UK bank CSV variants;
- debit/credit sign conventions;
- OFX/QFX;
- QIF;
- multi-page statements;
- OCR noise;
- duplicate files;
- transfers/refunds/chargebacks;
- pending and posted rows;
- foreign currency;
- malicious formulas/oversized fields.

Never put real user statements in the repository.

## Performance and endurance

Test:

- 250k records;
- 20k document metadata rows;
- 10-year recurrence expansion;
- multi-hour import/index job interruption;
- low-memory Android device;
- app kill during transaction/migration/sync;
- time-zone and DST transitions;
- device clock changes;
- full disk/low storage.

## Observability

### On-device

- local health screen: DB integrity, last backup/sync/import, index state, job errors;
- rotating sanitised logs with no finance content;
- performance counters;
- user-readable sync/import history.

### Cloud

- service availability/latency;
- envelope failures;
- consent/token errors;
- model usage/cost;
- aggregate error codes;
- no merchant/amount/document content.

Diagnostic upload is explicit and previewable.

## Release gates

A build cannot advance if:

- golden vector fails;
- migration restore fails;
- high/critical security issue remains;
- core offline E2E fails;
- accessibility critical path fails;
- app crash-free threshold is below target;
- AI route exceeds advice/hallucination threshold;
- store privacy declarations do not match code.

## Incident response

Maintain runbooks for:

- calculation defect;
- sync data loss/duplication;
- compromised token/provider;
- key/recovery issue;
- model unsafe output;
- backend breach;
- bad tax policy pack;
- store removal.

Calculation defects require affected-version detection, transparent user notice, corrected recomputation and no silent history rewrite.
