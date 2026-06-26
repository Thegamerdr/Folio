# Folio V2 — Greenfield Complete Product and Implementation Plan

**Plan date:** 20 June 2026  
**Status:** implementation source of truth  
**Product posture:** mobile-first, local-first, cloud-enhanced, AI-optional  
**Existing Folio:** V1 reference product and asset donor only

## Read this first

This package describes a new Folio product built from a clean repository and a clean domain model. It is not a refactor, migration, reskin, extension, or patch of Folio V1.

Folio V1 is useful evidence. It may contain excellent visual work, mascot assets, interaction ideas, components, copy, icons, or flows. Those assets may be reused only after an explicit inventory and approval step. V1's routing, database, state management, feature boundaries, data assumptions, and technical architecture are not inherited by default.

## Product in one sentence

> Folio is a private financial clarity and confidence system that helps people understand where they stand, what changed, what happens next, and how their plans are affected—without acting as a financial adviser.

## The build in one diagram

```text
User-owned local data
        ↓
Deterministic financial truth and forecasting engines
        ↓
Events, timeline, calendar, plans, budgets and visual progress
        ↓
Melo: briefing, explanation, accountability and bounded proposals
        ↓
Optional encrypted cloud, Open Banking and AI conveniences
```

## Required reading order

1. `01_GREENFIELD_AGENT_DIRECTIVE.md`
2. `02_PRODUCT_CONSTITUTION.md`
3. `03_SCOPE_AND_BOUNDARIES.md`
4. `04_EXPERIENCE_BLUEPRINT.md`
5. `05_FIRST_60_SECONDS.md`
6. `06_MELO_SYSTEM.md`
7. `07_PERSONAL_AND_BUSINESS_WORKSPACES.md`
8. `08_FINANCIAL_TRUTH_AND_EVENT_MODEL.md`
9. `09_PLANS_BUDGETS_AND_FORECASTING.md`
10. Remaining architecture and policy documents
11. `agent/SINGLE_AGENT_EXECUTION_PROMPT.md`

## Non-negotiable checks before coding

- A new repository has been created.
- No V1 source folder has been copied into the new repository.
- The local encrypted database opens without an account or network.
- Personal and business workspace separation exists at schema level before business UI is added.
- Money uses integer minor units and ISO 4217 currency codes.
- Deterministic engines can be tested without React Native, a server, or an LLM.
- Melo cannot mutate data directly; he can only submit typed proposals through the command layer.
- Every forecast distinguishes actual, confirmed, expected, inferred and hypothetical values.
- No core feature depends on cloud AI, bank access, push notifications, or background execution.

## Package map

- Product constitution and UX: root markdown files
- Technical architecture: `architecture/`
- Machine-readable contracts: `schemas/`
- Test strategy and vectors: `testing/`
- Store, privacy and release controls: `release/`
- Research source register: `research/`
- Implementation sequence and risks: `backlog/`
- Agent handoff: `agent/`

## Definition of complete

“Complete” here means the destination, domain model, rules, UX behavior, architecture, safety controls and implementation sequence are specified. It does not mean all destination modules must be released in one risky launch. The phases are construction order, not permission to replace the complete product with a thin generic finance dashboard.


## Package scale

This delivery contains **75 files** before ZIP packaging, including:

- a consolidated master plan;
- a greenfield single-agent execution prompt;
- an encrypted local database schema;
- versioned JSON/OpenAPI policies;
- deterministic forecast and import fixtures;
- a 192-task dependency-ordered backlog;
- a 32-risk register;
- research traceability to 51 sources;
- security, privacy, legal, accessibility and store-release gates;
- package validation, manifest and checksums.

Use `VALIDATION_REPORT.md` for final measured totals.
