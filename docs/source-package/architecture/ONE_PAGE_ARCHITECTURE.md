# Folio V2 — One-Page Architecture

## Product shell

```text
Today briefing + Melo + Timeline + Calendar/Planner + Visual Progress
                                  |
                          typed intents/commands
                                  v
                        Application orchestration
                                  |
        +-------------------------+-------------------------+
        |                         |                         |
        v                         v                         v
Financial truth engine      Event/plan engine       Melo policy engine
forecast, budgets, debt     calendar, progress      interventions, proposals
        |                         |                         |
        +-------------------------+-------------------------+
                                  |
                     encrypted local SQLite vault
                                  |
           +----------------------+----------------------+
           |                      |                      |
 optional encrypted sync   optional bank/imports   optional AI/OCR/voice
```

## Source of truth

The encrypted local vault is authoritative. Posted transactions, confirmed balances and accepted user commands are facts. Forecasts, briefings, plan dates, event interpretations and search indexes are derived and rebuildable.

## Write path

```text
UI / import / Melo / sync
→ typed proposal or command
→ workspace + permission check
→ invariant validation
→ atomic local transaction
→ authoritative rows + audit log + sync outbox
→ invalidate/rebuild affected projections
→ refresh Today, Timeline, Calendar, Plans and Melo candidates
```

No model, screen or provider writes financial tables directly.

## Read path

```text
local queries
→ workspace-scoped projections
→ certainty/provenance metadata
→ accessible visual presentation
→ optional plain-language Melo explanation
```

## Workspace boundary

Personal and business data use the same engine contracts but separate workspace IDs, keys, navigation, search, calendar, reports, exports, tax context and Melo retrieval. Cross-workspace movement is an explicit reviewed command with an audit trail.

## Offline contract

Without network, account, bank access or AI, users can still:

- unlock/create the vault;
- import files and add data manually;
- see Today, Timeline and Calendar;
- track transactions, bills, income, debt, savings and budgets;
- create/rebase plans and run scenarios;
- search, attach documents and export/restore locally;
- receive deterministic Melo briefings and local notifications.

## Cloud contract

Cloud is an optional service layer for encrypted backup/sync, account recovery support, device registry, Open Banking transport, cloud AI, entitlements and future collaboration. The server should store opaque encrypted payloads wherever practical and must never become required for local calculations.

## Security roots

- random vault master key;
- platform-backed key wrapping via Keychain/Keystore;
- separate recovery wrapping using a user-controlled recovery secret;
- per-workspace/document/sync subkeys;
- encrypted database and documents;
- no financial content in default telemetry;
- explicit diagnostic upload with preview.

## Implementation order

1. Native database/crypto spike.
2. Pure deterministic engines and golden vectors.
3. Local persistence, command path and projections.
4. First minute and mobile shell.
5. Imports/reconciliation/search.
6. Today/timeline/calendar/transactions.
7. Melo deterministic layer.
8. Plans/progress/recovery/fun.
9. Local launch hardening.
10. Optional cloud, AI, Open Banking and business UI.
