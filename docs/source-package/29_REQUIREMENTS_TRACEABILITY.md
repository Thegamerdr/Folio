# Requirements Traceability

This map prevents the implementation from treating the constitution as aspirational copy. Each product decision has an implementation contract and proof route.

| Product requirement | Primary specification | Machine contract / data | Acceptance proof |
|---|---|---|---|
| Greenfield, V1 donor only | `01`, `26` | backlog Phase 0 | repository dependency audit; donor register |
| Mobile-first hybrid Today/Melo/timeline/calendar | `04`, `05`, `10` | `first_minute_flow.json` | first-minute and daily-loop E2E |
| Melo mandatory presence, chat optional | `04`, `06` | `melo_actions.json` | Today screen + model-off Melo tests |
| No onboarding inquisition | `05`, examples | `first_minute_flow.json` | no permission/account/goal wall; max questions |
| Local-first authoritative vault | `13`, `21` | `database.sql`, sync policy | network-blocked E2E; DB/crypto spike |
| User-owned data/cloud optional | `13`, `14`, `24` | permission and sync policies | export/delete/restore; privacy review |
| Actual transaction is truth | `08` | transaction/event schema | actual-vs-expected vectors |
| Certainty/provenance visible | `08`, `09` | domain schema | forecast vector assertions; explanation view |
| Deterministic finance brain | `09`, `15`, `21` | forecast vectors | pure engine tests with AI disabled |
| No financial advice | `02`, `03`, legal checklist | advice-language policy | static/generated copy tests and legal gate |
| Plans optional/configurable/rebased | `09` | plan tables/schema | unexpected-event and rebase E2E |
| Bad-month truth + path | `04`, `06`, example | Melo proposal/action contracts | bad-month golden conversation |
| Medium money-aware planner | `10` | calendar/task/reminder schema | recurrence/time-zone/notification tests |
| Non-financial life events allowed | `10` | event taxonomy | event-to-plan cascade tests |
| Search and archive core | `12` | FTS5 schema | 250k-row, workspace-scope and grounded-search tests |
| Documents simple/optional | `17` | document/extraction tables | capture/OCR/manual fallback/secure-file tests |
| Personal/business never mixed | `07`, `18` | workspace separation policy/schema | automated isolation and tax-export rejection |
| Business architecture from start, UI later | `07`, `21`, build sequence | business tables behind workspace | schema/repository proof before Phase 13 |
| Open Banking optional/scoped | `16` | permission matrix/provider consent | consent/revoke/stale-feed tests |
| Permissions just in time | `05`, `16`, `17` | permissions matrix | first launch permission audit; denial paths |
| Melo can propose, user accepts | `06`, `21` | Melo action/proposal schema | no direct-write test; review/undo audit |
| Bounded follow-up questions | `06`, AI doc | Melo actions/AI policy | max-three and stop-condition evals |
| User-selected Melo tone/limits | `06`, `19` | workspace preferences | tone parity and proactivity cap tests |
| Fun from real progress | `19` | event/milestone policy | reduced-motion/non-game alternative; no guilt copy |
| Personalized retention, quiet by default | `19` | notification policy | intervention ranking and quiet-state tests |
| Offline import/indexing | `11` | import matrix and vectors | crash/idempotency/malicious-file tests |
| Encrypted backup/recovery | `13`, release runbook | sync conflict policy | server-blind restore/lost-device drills |
| Account auth separate from vault recovery | `13`, `14` | vault/device schema | recovery without server plaintext key |
| AI optional/local/cloud ladder | `15` | AI routing policy | provider-off/manual fallback and cost limits |
| On-device OCR/voice where possible | `17` | permissions/import contracts | capability detection and fallback tests |
| Tax is preparation, direct filing later | `18`, legal checklist | tax policy/version tables | language/policy-pack/isolation tests |
| Accessibility and vulnerability | `20` | acceptance criteria | VoiceOver/TalkBack/large text/reduced motion |
| Store-ready account deletion/privacy | `24`, release checklists | API endpoints/contracts | in-app/web delete and declaration audit |
| No mandatory pricing assumption | `24`, decision log | entitlement abstraction | feature code independent of SKU |
| Scale and cost controls | `15`, `21`, `23` | AI usage/jobs/schema | performance, quota and cost monitoring tests |

## Traceability rule

A task that cannot name its product requirement, contract and acceptance proof is not ready for implementation. A requirement with no executable proof is not complete.
