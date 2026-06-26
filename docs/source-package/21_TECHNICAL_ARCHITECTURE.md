# Technical Architecture

## Reference stack at research date

Freeze exact versions in the lockfile when implementation begins and re-check compatibility before upgrading.

- **Mobile:** Expo SDK 56 development build, bundled React Native version, TypeScript strict, Expo Router.
- **Runtime/tooling:** Node.js 24 LTS, pnpm workspaces, Turborepo or equivalent task runner.
- **Local database:** OP-SQLite with SQLCipher and FTS5 behind a `DatabaseDriver` abstraction, subject to a mandatory native spike.
- **UI state:** database-backed queries for domain state; small local UI store only for transient navigation/editor state.
- **Validation:** shared runtime schemas (for example Zod/JSON Schema generated contracts).
- **Cloud services:** provider-neutral TypeScript services over Postgres/object storage, storing only encrypted vault payloads where possible.
- **Testing:** unit/property tests for pure engines, SQLite integration tests, native device tests, end-to-end mobile tests.

Do not run the production app in Expo Go. The encrypted database, native OCR, key management and calendar integrations require development builds.

## Mandatory database spike

Before feature work, prove on iOS and Android:

- OP-SQLite opens a SQLCipher database with a runtime key;
- FTS5 is enabled;
- WAL/checkpoint behavior is stable;
- migrations survive crash/relaunch;
- 100k-row queries meet targets;
- Expo development/release builds work;
- OTA/update configuration does not load conflicting SQLite binaries;
- document and backup copies are consistent.

If the spike fails, select another maintained native SQLite driver that supports SQLCipher and FTS5. The domain must not depend on driver-specific APIs.

## Repository layout

```text
folio-v2/
├── apps/
│   └── mobile/                    # Expo mobile app
├── packages/
│   ├── domain/                    # entities, value objects, commands
│   ├── finance-engine/            # forecast, debt, budget, allocation
│   ├── event-engine/              # transaction→event derivation
│   ├── plan-engine/               # dynamic optional plans
│   ├── calendar-engine/           # recurrence, tasks, reminders
│   ├── melo-policy/               # interventions, tone, proposals
│   ├── import-engine/             # parsers, provenance, reconciliation
│   ├── search-engine/             # FTS/query compiler
│   ├── storage/                   # DatabaseDriver and repositories
│   ├── crypto/                    # native key/file encryption adapters
│   ├── sync/                      # outbox, envelopes, conflict policy
│   ├── ai-contracts/              # typed tasks/provider routing
│   ├── policy-packs/              # jurisdiction/effective-date rules
│   ├── ui/                        # accessible primitives/design system
│   └── testing/                   # fixtures, factories, test vectors
├── services/
│   ├── cloud-vault/               # auth, encrypted blobs, device registry
│   ├── ai-gateway/                # provider registry, quotas, redaction
│   ├── open-banking/              # regulated provider adapter
│   └── web-account/               # deletion/recovery/privacy portal
├── tooling/
├── docs/
└── infra/
```

## Dependency rule

Dependencies point inward:

```text
UI/adapters → application services → domain/engines
```

Pure engines know nothing about Expo, React, SQLite, AI providers, bank providers or cloud SDKs.

## Domain command architecture

All writes flow through typed commands:

```text
UI/Melo/import/sync
→ command
→ authorization + workspace check
→ invariant validation
→ transaction
→ domain rows + audit + outbox
→ derived invalidation
→ query refresh
```

No screen or model writes SQL directly.

## Local data flow

```text
input/import/provider
→ staging/provenance
→ review/command
→ local encrypted SQLite
→ derived event/forecast/search projections
→ Today/Timeline/Calendar/Melo
```

Derived projections are rebuildable. Authoritative facts are not.

## State boundaries

- **Authoritative:** domain tables and accepted commands.
- **Derived:** forecast snapshots, search index, generated briefing candidates.
- **Ephemeral:** editor draft, animation, temporary conversation state.
- **Remote:** encrypted backup/sync envelope, consent/entitlement metadata.

## Performance budgets

On a representative mid-range supported device:

- cold start to usable local shell: <2 seconds target;
- Today query after unlock: <300 ms p95;
- common write + affected projection: <200 ms p95;
- 10k-row import parse streams without jank;
- search common query: <300 ms p95;
- forecast 365 days/2,000 scheduled events: <150 ms target in pure engine;
- animation holds 60 fps where hardware permits;
- no network dependency in first local render.

## Background work

Mobile OS background execution is opportunistic. Therefore:

- schedule local notifications when facts change;
- persist job checkpoints;
- resume import/indexing on foreground;
- never require an exact background wake for financial correctness;
- refresh cloud/bank adapters when permitted, while showing last-updated state.

## Cloud reference implementation

The cloud control plane may use managed Postgres, object storage and serverless/container TypeScript services. A launch implementation can use Supabase or an equivalent, but domain packages and mobile code must depend on Folio interfaces, not vendor SDK semantics.

Cloud components:

- passkey/Apple/Google account authentication;
- encrypted vault object storage;
- device and sequence metadata;
- entitlement service;
- AI gateway;
- Open Banking token adapter;
- web account deletion/recovery portal.

## OTA policy

Financial schema, native database and crypto changes are high risk. OTA updates must be disabled or tightly limited until compatibility is proven. Never ship an OTA JavaScript bundle that expects a schema/native capability absent from the installed binary.

Use a native/runtime compatibility version and staged rollout with rollback.

## Architecture acceptance gates

- App works after blocking all network requests.
- Domain engines run in Node tests with no mobile dependencies.
- Database driver can be replaced through contract tests.
- A full vault can be exported, restored and searched.
- Personal/business isolation is enforced below the UI.
- No AI/provider SDK appears in deterministic finance packages.
