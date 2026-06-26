# Implementation Research Coverage

## What this pass researched

The plan covers the implementation questions that remained after the product constitution was corrected:

- native mobile platform and dependency strategy;
- encrypted local database, search and key storage;
- local-first write/read architecture;
- optional encrypted sync, backup and recovery;
- deterministic forecasting, debt, budget and plan engines;
- truth/provenance/reconciliation rules;
- event generation and internal calendar/planner;
- bank/file/document/OCR/voice imports;
- Melo policy, memory, actions and AI routing;
- personal/business workspace isolation;
- UK advice/tax/Open Banking boundaries;
- notifications, retention, gamification and vulnerable-user behavior;
- accessibility, internationalisation and multi-currency;
- testing, observability, security and incident response;
- App Store/Play Store release, deletion and entitlement architecture;
- cloud-model cost controls for early scale;
- V1 donor extraction without architectural inheritance;
- phased greenfield delivery and acceptance gates.

## Decisions made from research

### Local source of truth

Encrypted native SQLite provides durable offline state, relational constraints, transactions and full-text search. It is abstracted because native driver compatibility must be proven rather than assumed.

### Deterministic core

Financial calculations, forecasts, event matching and plan rebasing are pure functions with golden/property tests. Models only parse/explain/propose.

### Internal calendar first

The app stores its own events/tasks/reminders because mobile background execution and system-calendar permission are not reliable foundations for core behavior. Optional system-calendar integration is an adapter.

### Proposal/command boundary

Every semi-automatic source—Melo, OCR, bank feed, import or AI—stages or proposes data. Accepted changes pass through one audited command path.

### Separate workspaces

Personal and business use shared engine packages but separate data scope, keys, search, calendar, reports and memory. This is stronger than a UI filter and supports later multiple businesses/households.

### Recovery separated from login

Apple/Google/email authentication identifies the cloud account; a separate recovery wrapping design protects the encrypted vault. This avoids pretending identity login can recover an end-to-end encrypted key by itself.

### Provider registries

AI, bank, storage and tax integrations sit behind adapters and versioned policy/provider registries because prices, model availability, APIs and regulatory rules change.

### Store-safe local core

The app works without login, and account/cloud deletion is supported if cloud features are enabled. Pricing is expressed as capabilities/entitlements rather than baked into domain logic.

## What remains evidence-based rather than pre-decided

Some choices cannot be honestly finalised through desk research alone:

- final database driver after real iOS/Android spike;
- exact cloud/AI/Open Banking vendors after procurement and trials;
- final first-minute animation/copy after usability testing;
- final visual navigation after prototypes with V1 donor assets;
- monetisation after willingness-to-pay evidence;
- whether business UI ships in the first binary;
- jurisdiction-specific legal/tax release claims.

The architecture includes seams and release gates for these unknowns. Agents must not fill them with accidental defaults.

## Why the package is not a feature dump

The destination is complete, but implementation is staged. Core complexity remains hidden behind a simple experience. Optional cloud, AI, business and direct-tax expansions cannot contaminate the local personal product. The backlog is a construction graph, not a requirement to expose every capability at once.
