# Folio V2 — Greenfield Complete Master Plan

**Plan date:** 20 June 2026  
**Status:** implementation source of truth  
**Build posture:** greenfield, mobile-first, local-first, cloud-enhanced, AI-optional  
**V1 posture:** reference product and approved donor material only

## Executive decision

Folio V2 must be created in a clean repository from a clean domain model. Existing Folio V1 can contribute proven visual assets, Melo work, micro-interactions and isolated components only after a donor audit. It is not the technical foundation.

Folio is a private financial clarity and confidence system. The core product works locally without an account, internet, bank connection or AI. Its mobile experience combines Melo, a useful Today briefing, timeline, money-aware calendar/planner, transactions, optional plans and visible progress. It helps users understand consequences and adapt to reality without acting as a financial adviser.

This master file consolidates the human-readable source of truth. The ZIP also includes machine-readable SQL, JSON, OpenAPI, test vectors, a 192-task implementation backlog, security/release controls and the one-shot execution prompt.

## How to use this file

Read Parts 1–10 before architecture work. Treat the machine-readable files in `schemas/`, `testing/` and `backlog/` as normative contracts. When this prose conflicts with a versioned machine contract, stop, record the conflict and resolve it deliberately rather than silently diverging.

## Consolidated contents

1. **Folio V2 — Greenfield Complete Product and Implementation Plan** — `00_START_HERE.md`
2. **Greenfield Agent Directive** — `01_GREENFIELD_AGENT_DIRECTIVE.md`
3. **Product Constitution** — `02_PRODUCT_CONSTITUTION.md`
4. **Scope, Modules and Boundaries** — `03_SCOPE_AND_BOUNDARIES.md`
5. **Mobile Experience Blueprint** — `04_EXPERIENCE_BLUEPRINT.md`
6. **First 60 Seconds and Progressive Onboarding** — `05_FIRST_60_SECONDS.md`
7. **Melo System** — `06_MELO_SYSTEM.md`
8. **Personal and Business Workspaces** — `07_PERSONAL_AND_BUSINESS_WORKSPACES.md`
9. **Financial Truth, Transactions and Events** — `08_FINANCIAL_TRUTH_AND_EVENT_MODEL.md`
10. **Plans, Budgets, Forecasting and Scenarios** — `09_PLANS_BUDGETS_AND_FORECASTING.md`
11. **Calendar and Planner** — `10_CALENDAR_AND_PLANNER.md`
12. **Import and Indexing Pipeline** — `11_IMPORT_AND_INDEXING_PIPELINE.md`
13. **Search, Archive and Memory** — `12_SEARCH_ARCHIVE_AND_MEMORY.md`
14. **Local-First, Cloud Sync, Backup and Recovery** — `13_LOCAL_FIRST_SYNC_BACKUP_RECOVERY.md`
15. **Security, Privacy and Threat Model** — `14_SECURITY_PRIVACY_AND_THREAT_MODEL.md`
16. **AI Architecture, Cost and Limits** — `15_AI_ARCHITECTURE_COST_AND_LIMITS.md`
17. **Open Banking and Permission Architecture** — `16_OPEN_BANKING_AND_PERMISSIONS.md`
18. **Documents, OCR and Voice** — `17_DOCUMENTS_OCR_AND_VOICE.md`
19. **Business, Tax and Compliance Architecture** — `18_BUSINESS_TAX_AND_COMPLIANCE.md`
20. **Gamification, Retention and Notifications** — `19_GAMIFICATION_RETENTION_AND_NOTIFICATIONS.md`
21. **Accessibility, Internationalisation and Vulnerable Users** — `20_ACCESSIBILITY_INTERNATIONALISATION_AND_VULNERABILITY.md`
22. **Technical Architecture** — `21_TECHNICAL_ARCHITECTURE.md`
23. **Data Model and API Contracts** — `22_DATA_MODEL_AND_API_CONTRACTS.md`
24. **Testing, Quality and Observability** — `23_TESTING_QUALITY_AND_OBSERVABILITY.md`
25. **Store Release and Monetisation Architecture** — `24_STORE_RELEASE_AND_MONETISATION.md`
26. **Complete Build Sequence and Acceptance** — `25_COMPLETE_BUILD_SEQUENCE_AND_ACCEPTANCE.md`
27. **Folio V1 Donor Audit Protocol** — `26_V1_DONOR_AUDIT_PROTOCOL.md`
28. **Decision Log and Open Sign-offs** — `27_DECISION_LOG_AND_OPEN_SIGNOFFS.md`
29. **Research Findings and Rationale** — `28_RESEARCH_FINDINGS_AND_RATIONALE.md`
30. **Requirements Traceability** — `29_REQUIREMENTS_TRACEABILITY.md`
31. **Implementation Research Coverage** — `30_IMPLEMENTATION_RESEARCH_COVERAGE.md`
32. **Folio V2 — One-Page Architecture** — `architecture/ONE_PAGE_ARCHITECTURE.md`
33. **Architecture Decision Records** — `architecture/ARCHITECTURE_DECISION_RECORDS.md`
34. **Data Flow and Trust Boundaries** — `architecture/DATA_FLOW_AND_TRUST_BOUNDARIES.md`
35. **First-Minute Prototype** — `examples/FIRST_MINUTE_PROTOTYPE.md`
36. **Melo Conversation Contracts** — `examples/MELO_CONVERSATION_CONTRACTS.md`
37. **Reference Algorithms** — `examples/REFERENCE_ALGORITHMS.md`
38. **Bad-Month Case Study** — `examples/BAD_MONTH_CASE_STUDY.md`
39. **Legal and Regulatory Review Checklist** — `release/LEGAL_AND_REGULATORY_REVIEW_CHECKLIST.md`
40. **Security Test Plan** — `testing/SECURITY_TEST_PLAN.md`
41. **Accessibility Test Plan** — `testing/ACCESSIBILITY_TEST_PLAN.md`
42. **Single-Agent Execution Prompt — Folio V2 Greenfield** — `agent/SINGLE_AGENT_EXECUTION_PROMPT.md`

---


# Part 1: Folio V2 — Greenfield Complete Product and Implementation Plan

_Source: `00_START_HERE.md`_

## Folio V2 — Greenfield Complete Product and Implementation Plan

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

---


# Part 2: Greenfield Agent Directive

_Source: `01_GREENFIELD_AGENT_DIRECTIVE.md`_

## Greenfield Agent Directive

## Absolute instruction

Create Folio V2 in a new repository named `folio-v2-greenfield` or an equivalent explicitly new location. Do not begin by opening Folio V1 and editing it. Do not “preserve compatibility” with V1 unless an approved asset or contract requires it.

## V1's permitted role

Folio V1 is a reference library. The agent must first produce a donor audit with four lists:

1. **Reuse unchanged** — assets or isolated components with no domain coupling.
2. **Adapt deliberately** — valuable work that needs a clean V2 implementation.
3. **Reference only** — useful design lessons that should not be copied.
4. **Reject** — architecture, UI or logic that conflicts with this plan.

Likely donor candidates include Melo artwork, poses, animation state ideas, icons, typography, spacing, visual details, successful micro-interactions and polished screens. This is not pre-approval. Each item needs evidence.

## Forbidden agent behavior

- Renaming V1 and calling it V2.
- Adding the new finance logic behind the old data model.
- Keeping an old dashboard because it already exists.
- Creating one giant “finance context” JSON object controlled by an LLM.
- Treating chat history as the financial record.
- Mixing personal and business data behind a filter.
- Using floating-point numbers for money.
- Letting AI calculate, write to the database or decide which financial action is best.
- Requiring sign-up before local use.
- Requiring Open Banking before first value.
- Sending financial data to analytics, crash reporting or model providers by default.
- Implementing a daily guilt streak, public leaderboard, shame copy or fabricated health score.

## Required architectural boundaries

```text
UI
↓ typed commands / queries
Application services
↓
Pure domain engines
↓
Repositories
↓
Encrypted local database

Optional adapters:
cloud vault | AI | bank data | OCR | calendar | notifications | billing
```

The domain layer cannot import React Native, Expo, database drivers, cloud SDKs, model SDKs or UI components.

## Evidence required at every milestone

Each milestone must include:

- changed files;
- tests and their results;
- screenshots or recordings for user-visible work;
- offline behavior evidence;
- accessibility checks;
- data migration or schema notes;
- open risks and decisions;
- confirmation that no unapproved V1 coupling was introduced.

## Ambiguity rule

Do not silently invent a new product direction. Use the constitution, decision log and machine-readable policies. When a genuine implementation choice remains, select the option that best preserves local ownership, clarity, reversibility and deterministic behavior, then record it in `DECISION_LOG.md`.

---


# Part 3: Product Constitution

_Source: `02_PRODUCT_CONSTITUTION.md`_

## Product Constitution

## Mission

Build financial confidence through clarity, understanding and consistent progress.

## Core promise

> Know where you stand. Understand what changed. See what happens next.

Folio does not promise wealth, perfect forecasting, freedom from hardship or a universally “best” decision. It promises a truthful, understandable view of the user's current information and the consequences of changes under explicit assumptions.

## Emotional outcome

Folio should help move a person through this progression:

```text
avoidance or uncertainty
→ safe engagement
→ clarity
→ visible progress
→ confidence
→ freedom to make money-related decisions without losing sight of the rest
```

## Product identity

Folio is:

- a financial clarity system;
- a financial memory and progress system;
- a money-aware calendar and planner;
- a private local-first record;
- a simulator and explainer;
- a friendly accountability environment led by Melo.

Folio is not:

- a financial adviser;
- an accountant or final tax authority;
- a lender, broker or product recommender;
- a dashboard-first budgeting spreadsheet;
- a chatbot that needs endless context;
- a bank-feed viewer;
- a generic life operating system;
- a game that trivialises hardship.

## The user remains the decision-maker

Folio may say:

> If you make this £200 payment on Friday, your projected balance before payday falls to £314 and all currently known obligations remain covered.

Folio must not say:

> You should make this payment; it is the best choice for you.

All consequential actions are reviewed and accepted by the user.

## Product principles

### 1. Facing reality must feel safe

Never hide bad information. Never weaponise it. Present truth, context, what remains stable and the path forward.

### 2. Complexity stays under the surface

The engine may be sophisticated; the user experience must be simple. A user should not maintain a giant financial file just to receive value.

### 3. Use creates setup

Do not conduct an onboarding interrogation. Data and preferences accumulate naturally while solving a real problem, importing records or responding to meaningful events.

### 4. Actual facts outrank expectations

A posted transaction is what happened. A recurring amount is an expectation. Neither silently overwrites the other.

### 5. Explain every conclusion

Any number such as “available before payday” must expose its inputs, assumptions and uncertainty in plain language.

### 6. Local-first is a product promise

The useful app works without an account, internet, bank feed or model. Cloud adds sync, recovery and convenience.

### 7. The user owns the data

Folio provides services. It does not claim ownership of financial history, train models on it by default or trap it behind a subscription.

### 8. Personal and business are different worlds

They may share engines, but not user-facing context, reports, calendars, tax records or Melo memory.

### 9. Plans adapt; people do not fail

A missed target triggers a re-evaluation of reality and an updated path. Folio does not issue failure verdicts.

### 10. Reward real progress

Celebrate awareness, recovery, consistency and meaningful outcomes. Do not create artificial guilt loops.

### 11. Confidence is not certainty

Every future-facing conclusion indicates what is known, expected, inferred or hypothetical.

### 12. Quiet is a valid success state

When nothing requires attention, Folio becomes calmer. It does not manufacture notifications to inflate engagement.

## Constitutional violations

A release must be blocked if it:

- gives a personal recommendation presented as the right financial action;
- mixes personal and business tax data;
- requires cloud access for core calculations;
- cannot show why a forecast changed;
- sends raw financial data to telemetry without explicit informed consent;
- shames a user for debt, income, missed goals or inactivity;
- makes Melo's proposal irreversible or silently accepted;
- represents an estimate as an actual fact;
- loses data during app upgrade, sync or import;
- makes common tasks inaccessible with screen readers or larger text.

---


# Part 4: Scope, Modules and Boundaries

_Source: `03_SCOPE_AND_BOUNDARIES.md`_

## Scope, Modules and Boundaries

## Universal personal core

The personal workspace must ultimately support:

- accounts and balances;
- posted and pending transactions;
- manual, file and bank-feed imports;
- income and payday patterns;
- bills, subscriptions and other obligations;
- debts and user-selected repayment simulations;
- savings, reserves and protected floors;
- optional budgets;
- optional plans;
- dated cash-flow forecasts and scenarios;
- timeline and event memory;
- calendar, tasks and reminders;
- global search;
- simple document capture and linking;
- Melo briefings, explanations and typed proposals;
- encrypted export, backup and optional sync.

## Business workspace destination

Business is architected from the foundation but can be activated later in the delivery sequence. When enabled it includes:

- separate business accounts and transactions;
- clients and invoices;
- receipts and business documents;
- business income, costs, cash flow and runway;
- business calendar and planner;
- tax categories, periods, deadlines and preparation exports;
- mileage and other jurisdiction-specific records where required;
- a business-specific Melo context;
- future accountant or team collaboration.

Direct tax submission is not part of the initial core. It is a later regulated/compliance integration behind a dedicated adapter and approval programme.

## Medium-scope planner

The planner supports:

- dated events;
- tasks and checklists;
- reminders;
- light time blocks;
- recurring routines;
- notes;
- links to transactions, plans, documents and forecasts.

It does not initially support complex project dependencies, team project management, document canvases, database pages or generic workspace building.

## Optional plans

A user can use Folio without a formal plan. A plan becomes available when it helps turn an intention into visible progress and accountability. Examples include clearing a debt, building a reserve, funding a purchase, preparing for an annual cost or building a business tax pot.

## Advice boundary

Folio supports:

- arithmetic;
- record organisation;
- factual summaries;
- forecasts under stated assumptions;
- side-by-side simulations;
- user-authored rules;
- neutral descriptions of standard strategies;
- official guidance links.

Folio does not support without a separately authorised service:

- personal recommendations about a regulated investment, credit or insurance product;
- statements that an option is best or suitable for the user;
- debt counselling that directs liquidation of debts as a personal recommendation;
- guaranteed tax positions;
- legal conclusions;
- automatic movement of money.

## Launch jurisdiction

The implementation should be UK-first and international-ready. Jurisdictional rules, priority-bill guidance, tax categories, retention periods and official support links are versioned policy packs, not hardcoded universal truths.

## Initial audience

The first product focus is adults experiencing debt or month-to-month pressure, because the need is acute and the founder has deep lived understanding. The domain cannot hardcode debt as the only life stage. Savings, reserves and future plans use the same engines.

The initial public release should be positioned for adults. A dedicated under-18 experience requires a separate privacy, safeguarding and product review rather than accidental access to an adult financial system.

## Deferred but architecturally allowed

- household/shared personal finance;
- business collaboration and accountant access;
- multiple businesses;
- payment initiation;
- direct HMRC submission;
- investment analysis;
- desktop/web companion;
- deep planner/project management;
- youth mode.

---


# Part 5: Mobile Experience Blueprint

_Source: `04_EXPERIENCE_BLUEPRINT.md`_

## Mobile Experience Blueprint

## Interaction model

Folio is a hybrid of:

- Melo and today's briefing;
- a human-readable timeline/feed;
- a money-aware calendar/planner;
- clear visual position and progress;
- normal browseable screens for detail;
- search and quick simulation.

Melo is mandatory as a product personality and interpretation layer, not as a compulsory chat box. A user can navigate, import, inspect and edit everything without holding a conversation.

## Primary mobile navigation

Recommended personal workspace navigation:

1. **Today** — Melo briefing, current position, next important event, progress and timeline.
2. **Calendar** — today/week/month, planner tasks, financial and life events.
3. **Money** — accounts, transactions, bills, budgets, debt and documents.
4. **Plans** — optional goals, milestones, rules and scenarios.
5. **Melo entry point** — persistent, accessible action from every tab rather than a fifth data silo.

Global search and workspace switch remain available from the top-level shell.

## Today screen

The Today screen is a flowing briefing, not a grid of dashboard widgets.

Suggested order:

1. Melo greeting and one-sentence state.
2. The most important current number, such as available money before the next anchor date.
3. Next important event and date.
4. “What changed” since the last meaningful review.
5. Budget or plan progress, only when configured.
6. Today’s tasks and calendar strip.
7. Timeline items.
8. One bounded suggested action or question.

When the user is stable, the screen is calm and short. When the month is difficult, it expands into a recovery explanation without overwhelming the user.

## Detail screens

Detailed financial views can contain tables, charts and filters, but each view begins with a plain-language conclusion and exposes the underlying evidence. Charts never become the only way to understand a state.

## Visual language

The dominant metaphor is **journey + timeline + companion**.

- Time flows visibly from past facts to upcoming events and future milestones.
- Melo changes state according to context: welcoming, observing, focused, celebrating, checking, calm, concerned and recovering.
- Progress animation is tied to actual changes.
- Personal and business spaces use explicit labels, icons and structural differences; never color alone.
- Red is not used as punishment. Risk states include text and explanation.

## Bad-month experience

A bad month screen follows this sequence:

1. **What changed** — factual event.
2. **Immediate impact** — amounts and dates.
3. **What remains covered or unchanged** — prevents catastrophising.
4. **Which plans or budgets move** — transparent cascade.
5. **Updated path** — new dates or shortfall.
6. **Review choices** — user decides what to change.

Melo says, in effect: “Okay. Something changed. Let’s work from where things are now.”

## Fun without trivialisation

- real milestones;
- small mascot reactions;
- optional micro-challenges that teach or reveal something useful;
- satisfying plan movement;
- historical “look how far you came” moments;
- optional reflective mini-games using fictional money, never the user's real funds as a gambling mechanic.

Disable playful pressure during severe shortfall, arrears, vulnerability or explicit user preference.

## Accessibility baseline

Common tasks must work with VoiceOver and TalkBack, large text, voice control/switch access where applicable, reduced motion and without color. Touch targets, focus order, custom controls and mascot interactions require explicit accessibility semantics. Target WCAG 2.2 AA principles for the mobile product and validate Apple's Accessibility Nutrition Labels honestly.

---


# Part 6: First 60 Seconds and Progressive Onboarding

_Source: `05_FIRST_60_SECONDS.md`_

## First 60 Seconds and Progressive Onboarding

## Objective

Before Folio has personal data, it must earn enough interest and trust for the user to bring data in. It must not pretend to know the user or start an interview.

## Zero-data first launch

### 0–8 seconds: human welcome

Melo appears with a short, animated introduction:

> I help you see what is happening with your money, what is coming next, and how changes affect your plans. Your information stays on this device unless you choose otherwise.

No account prompt. No bank permission. No multi-page carousel.

### 8–20 seconds: three clear paths

- **Bring in a statement** — file, photo or supported financial export.
- **Tell Melo one thing** — opens a purposeful interaction such as “I just got paid” or “I need to know if I’m okay until Friday.”
- **See a 20-second example** — local fictional data, clearly labelled as a demo.

These are interaction paths, not identity or goal segmentation.

### 20–45 seconds: demonstrate the mechanism

The demo shows a fictional but relatable timeline:

- money available;
- payday;
- rent or another obligation;
- a small hypothetical purchase;
- the resulting timeline change.

The user sees the core idea: Folio explains the consequences, not just the transaction.

### 20–60 seconds: import path

If a user chooses a supported CSV, OFX/QFX or structured statement:

1. Copy the selected file into an encrypted staging area.
2. Detect account, period, currency and rows locally.
3. Display progressive, truthful stages rather than a generic spinner.
4. Surface partial facts as soon as they are reliable: date range, transaction count, opening/closing balance, likely repeating payments.
5. Ask only the smallest review question needed to create the first position.

Target first real value after selecting a well-formed supported file: show an initial position and next important dates within roughly one minute on a representative mid-range device. PDF and image processing may take longer; keep the user informed and never invent partial results.

## Minimal manual value path

A user who does not import can receive a temporary projection from three facts gathered in context:

- money available now;
- next income date and expected amount;
- next important obligation.

This state is clearly marked incomplete. It is useful without becoming a mandatory setup form.

## Permission timing

- Files: system picker only when import is chosen.
- Camera: only when scan is chosen.
- Microphone: only when voice input is tapped.
- Notifications: after the user creates or accepts a reminder.
- Calendar write: when adding an item to the system calendar.
- Calendar read: only after explicit calendar import/sync selection.
- Open Banking: only after the user selects live bank connection.
- Account/cloud: only after sync, backup, recovery or paid cloud functionality is selected.

Every request explains the immediate benefit and the fallback if refused.

## First real magic moment

The user should receive a statement such as:

> I found your likely payday, six repeating payments and the next thirty days. Three items need a quick check before the forecast is reliable.

After review:

> Based on what is confirmed, rent and your other known bills are covered before payday. Here is the amount that remains and exactly how it was calculated.

## Onboarding completion

There is no ceremonial “setup complete.” The product gradually becomes more accurate as facts are imported, confirmed and corrected. The Today screen always indicates data freshness and remaining uncertainty without nagging the user to complete a profile percentage.

---


# Part 7: Melo System

_Source: `06_MELO_SYSTEM.md`_

## Melo System

## Role

Melo is Folio's friendly financial accountability companion, interpreter and guide. He turns system facts into a human briefing, asks bounded questions when meaning is unclear, and proposes reversible actions.

Melo is not a financial adviser, accountant, therapist, debt counsellor, bank representative or omniscient agent.

## Mandatory presence, optional conversation

Melo appears in today's briefing, event explanations, plan reviews and recovery moments. The user can complete all core tasks through normal controls. Conversation is a convenience and emotional layer, not a gate.

## Personality

Default Melo is:

- warm and calm;
- observant rather than intrusive;
- concise first, detailed on request;
- playful when appropriate;
- honest about uncertainty;
- supportive without fake positivity;
- comfortable saying “I do not have enough information.”

Melo never:

- shames or moralises;
- uses fear to drive engagement;
- celebrates wealth as personal worth;
- pretends an estimate is certain;
- keeps questioning without a defined task;
- says a regulated financial action is best or suitable.

## User-selectable accountability style

- **Gentle** — softer prompts, fewer interventions, reassurance before detail.
- **Balanced** — default; direct facts with warm explanation.
- **Accountability** — firmer reminders and explicit commitments, still respectful and non-shaming.

Separate controls govern humour, celebration intensity, notification frequency, memory depth and quiet hours. Personality never changes financial logic.

## Bounded conversation protocol

Every conversation has:

- a declared intent;
- required information slots;
- a maximum question count;
- a stop condition;
- a structured result or graceful fallback.

Default maximum: three clarification questions. High-risk or complex tasks may stop earlier and route to manual review or official support. Melo asks one question at a time and explains why it matters when not obvious.

Example:

```text
Intent: classify a higher-than-usual rent payment
Known: merchant/reference, actual amount, previous expected amount
Question 1: Was this a new regular amount, a one-off charge, or something else?
Stop: once one option or a custom explanation is supplied
Result: proposed recurring-rule update or one-off annotation
```

## Proposal, review, commit

Melo never writes directly to domain tables.

```text
Observe/query
→ produce typed proposal
→ deterministic validation
→ user review/edit/accept/reject
→ command handler commits atomically
→ affected projections recalculate
→ Melo explains the change
```

Proposal types include:

- create or amend an event;
- create, rebase or pause a plan;
- create a reminder or task;
- classify or split a transaction;
- update a recurring expectation;
- add a document link;
- run a scenario;
- save a bounded memory preference.

## Proactive behavior

Melo scores candidate interventions by severity, immediacy, confidence, novelty and user preference. He surfaces only the most useful items.

Default caps:

- no more than three non-urgent proactive items on the Today screen;
- no more than one unsolicited push in a quiet period;
- no repeated prompt after dismissal unless the underlying risk materially changes;
- urgent legal/payment deadlines may override frequency but not quiet-hour emergency rules selected by the user.

## Rituals

- **Today briefing:** changes, next important date, current plan/budget state.
- **Payday review:** what arrived, what is already committed, what changed.
- **Weekly reflection:** progress and one useful observation.
- **Month close:** real movement, difficult moments handled and upcoming shifts.

Rituals are optional and personalised. Folio does not treat daily app opening as a moral obligation.

## Bad-month mode

When a shortfall, income loss or large unexpected cost is detected:

- reduce playful output;
- increase clarity and pacing;
- identify confirmed facts;
- show what is still covered;
- show affected dates/plans;
- offer a review of assumptions and user-controlled changes;
- show official help where relevant.

## Memory

Melo memory is explicit, inspectable and deletable.

- **Minimal:** current conversation and essential saved preferences.
- **Normal:** recurring patterns, plans, corrections and selected events.
- **Deep:** user-approved habits, historical context and richer reflections.

Financial records remain in the domain database; memory stores compact contextual facts and preferences, not a duplicate unstructured financial history.

## AI independence

Offline Melo uses deterministic templates, event rules, search and optional on-device classifiers. Platform or cloud models may improve natural-language parsing and wording, but the same structured proposal and validation path applies. No model receives the complete database by default.

---


# Part 8: Personal and Business Workspaces

_Source: `07_PERSONAL_AND_BUSINESS_WORKSPACES.md`_

## Personal and Business Workspaces

## Core rule

> Same underlying engines, different user-facing worlds.

A user must never wonder whether a transaction, plan, calendar item, report, document or Melo statement belongs to personal life or a business.

## Personal workspace

Personal includes:

- paydays and personal income;
- rent/mortgage and bills;
- personal debt;
- budgets, savings and reserves;
- life events and plans;
- personal calendar and tasks;
- personal documents;
- personal Melo memory and briefings.

## Business workspace

Each business workspace has a legal/trading identity and separate:

- accounts;
- transaction categories;
- clients and invoices;
- receipts and documents;
- cash-flow forecast;
- plans and budgets;
- calendar/tasks;
- tax periods, categories, estimates and exports;
- Melo context;
- encryption subkey and future membership policy.

A business workspace is optional. It must not appear as an onboarding interrogation for users who only need personal Folio.

## Structural separation

Every domain record carries a non-null `workspace_id`. Repositories require workspace scope. Cross-workspace queries are prohibited except approved transfer, account overview or export orchestration services.

An account belongs to one workspace. A movement between personal and business is represented as two linked records, preserving each workspace's classification and audit trail.

## Visual separation

Workspace switching changes:

- explicit title and icon;
- navigation labels;
- Today briefing context;
- calendar source;
- category set;
- reports and search scope;
- Melo memory scope.

Do not rely on color alone. A persistent text label such as `Personal` or the business name appears on every top-level screen and review sheet.

## Tax integrity

Business tax exports include only business-scoped records that meet the selected period and classification criteria. Personal data cannot leak into the export through shared category IDs, global search, document links or transfers.

All tax outputs show:

- source records;
- inclusion/exclusion rules;
- unresolved items;
- jurisdiction and policy-pack version;
- generated timestamp;
- clear statement that the output is preparation information, not a guaranteed final tax position.

## Future shared access

The schema anticipates workspace members and roles, but collaboration is not enabled until encrypted key sharing, audit, permission and conflict behavior are independently tested. Household/shared personal finance is a separate product module, not automatic reuse of business collaboration.

---


# Part 9: Financial Truth, Transactions and Events

_Source: `08_FINANCIAL_TRUTH_AND_EVENT_MODEL.md`_

## Financial Truth, Transactions and Events

## Three distinct concepts

### Transaction

A financial fact or bank-reported pending item: amount, date, account, counterparty and provenance.

### Event

The human meaning or consequence attached to a date: payday received, rent paid, insurance renewal, debt cleared, invoice due, plan changed.

### Expectation

A rule or prediction about the future: recurring rent, expected wage, likely subscription, planned contribution.

They can be linked but must never be collapsed into one ambiguous object.

## Truth hierarchy

1. Confirmed posted transaction.
2. User-confirmed event or correction.
3. User-entered recurring rule or scheduled item.
4. Provider/import metadata not yet confirmed.
5. System-inferred pattern.
6. Estimate or hypothetical scenario.

Higher-priority truth does not erase lower-priority history. It supersedes it for current calculations and leaves provenance.

## Example: rent changed

```text
Recurring expectation: £735 on the 10th
Actual posted transaction: £738 with recognised rent reference
```

The actual transaction becomes the spent amount. Folio creates a variance event and Melo asks a bounded question:

> Rent was £3 higher than the amount we expected. Is £738 the new regular amount, a one-off fee, or something else?

The answer updates the future expectation or annotates the one-off event. It never edits the historical transaction to match the old plan.

## Transaction invariants

- Amount is an integer in currency minor units.
- Currency uses ISO 4217 code and stored minor-unit metadata.
- Posted transaction history is append-only from the audit perspective.
- Corrections create a new revision/reversal link.
- Transfers create linked debit/credit records and are neutral in consolidated cash flow.
- Pending transactions are matched to posted transactions and retired, not double-counted.
- Every imported record has source, import job, raw row hash and confidence/provenance.
- Splits sum exactly to the parent transaction.
- Duplicate detection never silently deletes; it groups candidates for deterministic or user-confirmed resolution.

## Event certainty

- `actual` — occurred and evidenced.
- `confirmed` — user/provider-confirmed future item.
- `expected` — accepted recurring expectation.
- `inferred` — detected pattern not yet accepted.
- `hypothetical` — scenario only.

## Event status

- proposed;
- accepted;
- scheduled;
- occurred;
- superseded;
- cancelled;
- dismissed.

## Event generation

Events may originate from:

- a transaction;
- a recurring rule occurrence;
- a plan milestone;
- a user-created calendar item;
- a business invoice/tax deadline;
- a document;
- a scenario;
- a deterministic detector;
- a Melo proposal accepted by the user.

## Corrections and learning

A user correction records both the old interpretation and the accepted interpretation. Local categorisation and recurring-pattern rules learn from confirmed corrections. AI output is never labelled user-confirmed until accepted.

## Reconciliation

For structured statements, Folio attempts:

```text
opening balance + signed transactions = closing balance
```

Pending items, fees, foreign-exchange entries and missing rows are accounted for explicitly. A mismatch marks the import as unreconciled and blocks claims of completeness; it does not block the user from viewing provisional results.

---


# Part 10: Plans, Budgets, Forecasting and Scenarios

_Source: `09_PLANS_BUDGETS_AND_FORECASTING.md`_

## Plans, Budgets, Forecasting and Scenarios

## Plans are optional

A plan is something the user is trying to make true. It is not required to use Folio and it is not a score of the person's worth.

Plan examples:

- clear a debt;
- build a £1,000 reserve;
- fund a holiday or major purchase;
- prepare for an annual bill;
- get one pay cycle ahead;
- build a business tax pot.

## Plan configuration

A plan can define:

- target amount or target state;
- optional target date;
- linked accounts/debts/categories;
- priority;
- minimum/maximum contribution;
- protected balance floor;
- funding frequency;
- dependencies or parent plan, if the user enables hierarchy;
- pause/recovery rules;
- missed-contribution behavior;
- Melo accountability style;
- celebration/milestone preferences.

Flat plans are the default. Hierarchy is optional, not imposed.

## Plan proposals

Melo can draft a plan after gathering only the facts needed for that plan. The draft shows assumptions, feasibility and the first scheduled actions. The user accepts or edits it. Once accepted, all plan changes are versioned.

## Plans do not fail

When actual events make a plan infeasible:

- retain the original history;
- create a rebased version;
- show what changed;
- calculate the new target date or gap;
- let the user keep, alter, pause or remove rules.

Use words such as `needs review`, `off the previous path` or `rebased`, not `failed`.

## Budgets

Budgets are optional control tools, not the product identity. Support:

- one flexible spending amount for a period;
- category allocations;
- bill/obligation reserves;
- rollover policy;
- personal or business workspace scope;
- user-selected weekly, payday or monthly periods.

Budget remaining is:

```text
accepted allocation
- posted spending
- user-selected reserved scheduled spending
± explicit rollovers/adjustments
```

The calculation exposes included transactions and exclusions.

## Forecast engine

The engine builds a dated ledger from:

- current confirmed account balances;
- pending and posted transactions;
- confirmed scheduled items;
- accepted recurring expectations;
- user-approved plan contributions;
- optional inferred occurrences;
- scenario changes.

Each occurrence is sorted by effective date and deterministic tie-break rules, then applied to account and consolidated balances.

### Forecast views

- **Known:** actual and confirmed items only.
- **Expected:** known items plus user-accepted recurring expectations.
- **Scenario:** an isolated hypothetical change.
- **Range:** optional uncertainty band when amount/date varies.

The UI defaults to the most useful expected view while making known/uncertain components inspectable.

## “Available before payday” calculation

Do not rely on a static subtraction formula. Simulate the period and find the maximum discretionary outflow that preserves the protections selected by the user:

- required bills/obligations remain funded on due dates;
- minimum debt payments selected as protected remain funded;
- designated account floors remain intact;
- already reserved plan/budget amounts are treated according to user rules.

Use monotonic search against the deterministic forecast to calculate the boundary. Present it as a projection with assumptions, not permission or advice.

## Scenario engine

A scenario clones the current projection, inserts one or more hypothetical changes and returns a diff:

- lowest projected balance and date;
- obligations affected;
- plan dates moved;
- budget remaining changed;
- debt payoff projection changed;
- certainty/assumptions.

No hypothetical writes to actual records until the user explicitly converts it into an accepted event, task or plan change.

## Debt simulations

Folio may neutrally model:

- contractual minimums;
- fixed extra amount;
- highest-rate-first;
- lowest-balance-first;
- user-defined order;
- pause/rebase scenarios.

The user selects the rule. The output compares dates, total modeled interest and cash-flow effects. Folio does not label a strategy “best for you.”

## Calculation precision

- integer minor units for money;
- decimal/rational math for rates;
- explicit rounding policy per product/currency;
- dates interpreted in workspace time zone;
- recurrence based on RFC 5545-compatible rules;
- deterministic versioned engine outputs.

---


# Part 11: Calendar and Planner

_Source: `10_CALENDAR_AND_PLANNER.md`_

## Calendar and Planner

## Product role

The calendar is a core experience and daily return surface. It connects time, money, plans and life. It is not merely a view of transactions and it is not intended to replace a full project-management platform.

## Internal calendar first

Folio maintains its own calendar so it remains fully functional offline and without device-calendar permission.

Views:

- Today;
- Week;
- Month;
- Timeline;
- Plan-specific schedule;
- Business-specific calendar when in a business workspace.

## Calendar item types

- financial event;
- life event;
- business event;
- task;
- reminder;
- time block;
- milestone;
- recurring routine.

A non-financial event can exist without an amount. If it later affects money, the user or Melo can link an estimated/actual cost, plan or transaction.

## Example connections

```text
Holiday event
↔ holiday funding plan
↔ flight/hotel transactions
↔ tasks and reminders
↔ forecast impact
```

```text
Work shift
↔ expected income occurrence
↔ payday event
```

## Planner scope

The first complete planner supports:

- title, notes, dates/times and duration;
- recurrence;
- checklist;
- priority and status;
- reminders;
- linked financial entities/documents;
- lightweight day planning and drag/reschedule;
- search and archive.

It does not initially support Gantt charts, complex dependencies, team boards or arbitrary database views.

## Recurrence

Use RFC 5545-style `RRULE`, `RDATE` and `EXDATE` semantics. Store the original time zone for local-time events. Generate occurrences on demand plus a bounded materialised window. Handle daylight-saving transitions explicitly.

## External calendar integration

Progressive permission model:

1. Internal calendar requires no permission.
2. “Add to Apple/Google calendar” uses the system handoff or write-only capability where available.
3. Full calendar read/sync is requested only when the user explicitly chooses import or two-way integration.

Imported external events carry source identifiers and are not treated as financial facts. Folio asks before attaching financial meaning.

## Dynamic cascading

When a linked event date or amount changes:

- future recurrence instances regenerate;
- affected reminders reschedule;
- forecasts recompute;
- budgets and plans update;
- Melo creates one concise change explanation;
- accepted historical occurrences remain unchanged.

## Reminder reliability

Important reminders are scheduled locally in advance when the underlying data changes. The app never assumes iOS or Android will execute background work at an exact time. On app open, Folio reconciles missed/background changes and refreshes the briefing.

---


# Part 12: Import and Indexing Pipeline

_Source: `11_IMPORT_AND_INDEXING_PIPELINE.md`_

## Import and Indexing Pipeline

## Purpose

The fastest path to real value is to turn records the user already has into a trustworthy local financial model. Import is therefore a core product experience, not a settings utility.

The pipeline must be:

- local-first;
- resumable;
- explainable;
- idempotent;
- reviewable;
- tolerant of messy bank exports;
- incapable of silently changing the user's facts.

## Supported acquisition paths

### Launch paths

1. **Manual quick start** — current available balance, next income date, next important outgoing.
2. **CSV import** — bank, card, loan, savings and payment-service exports.
3. **OFX/QFX import** — use the official OFX structure when supplied.
4. **QIF import** — legacy best-effort adapter with explicit limitations.
5. **PDF/image statement import** — on-device text/table extraction followed by review.
6. **Receipt/document capture** — attach and extract candidate data.

### Optional cloud path

7. **Open Banking adapter** — explicit consent, selected accounts and provider-scoped permissions.

No path is required for the others to work.

## Import state machine

```text
selected
→ copied into encrypted app storage
→ fingerprinted
→ format detected
→ parsed
→ normalised
→ candidate records produced
→ reconciled
→ exceptions/questions produced
→ user review
→ atomic commit
→ index/event/forecast rebuild
→ source retained or deleted according to user choice
```

Every stage is restartable. An interrupted import must never leave half-committed domain records.

## Provenance is mandatory

Every imported fact stores:

- import job ID;
- source document/file ID;
- source row/page reference;
- parser and parser version;
- original text/amount/date;
- normalised value;
- confidence;
- review status;
- timestamp;
- any later correction.

The original source is never overwritten by a cleaned representation.

## Money and date normalisation

- Store monetary amounts as signed integer minor units.
- Preserve source currency.
- Never infer exchange rates silently.
- Preserve source timezone/date text and the normalised instant/local date separately.
- Detect debit/credit conventions per source.
- Never use binary floating point for money.
- Locale detection is proposed, then confirmed if ambiguous.

## Deduplication and pending-to-posted matching

Use a layered identity strategy:

1. provider transaction ID when stable;
2. source file + source row hash;
3. account + amount + date + normalised description + running balance;
4. pending-to-posted matcher using amount/date/merchant tolerance;
5. user-confirmed merge.

A possible duplicate remains visible until resolved. Do not drop rows merely because they look similar.

## Reconciliation

Where a source provides balances:

```text
opening balance
+ signed imported movements
= expected closing balance
```

The import reports exact match, explained mismatch, or unresolved mismatch. A mismatch never blocks a user from reviewing the data, but it prevents the import from being labelled fully reconciled.

Transfers are linked as two movements and excluded from income/spending totals after confirmation. They remain transactions because cash location matters.

## Classification

Classification order:

1. user-created rule;
2. known counterparty mapping;
3. deterministic bundled rule;
4. optional on-device classifier;
5. optional cloud model;
6. unresolved.

The system may propose category, counterparty, recurring status, workspace and event meaning. It never commits uncertain business/personal classification without review when tax reporting could be affected.

## Questions with an end goal

Import questions are grouped and prioritised. Melo should ask only questions that materially improve the current result.

Examples:

- “These two rows look like the same card payment. Keep both or merge them?”
- “This payment uses your usual rent reference but is £18 higher. One-off charge, new regular amount or something else?”
- “This appears to be a transfer between your accounts. Link them?”

Default conversational cap: three questions in one sequence. Remaining issues move to a Review queue that can be completed later.

## Privacy behavior

Before the picker opens, state plainly:

> Folio will process the files you select on this device. Nothing is uploaded unless you later choose a cloud feature that says so.

The user chooses whether the original file is retained, retained until verified, or deleted after extraction. Business documents default to retained because evidence may be needed later.

## Performance targets

On a representative mid-range supported phone:

- first import feedback within 2 seconds;
- stream progress for large files;
- 10,000 CSV rows parsed without blocking the UI thread;
- cancellation leaves no committed partial import;
- repeated import of the same file is idempotent;
- search and Today briefing usable while background indexing continues.

## Acceptance gates

- A supplied import test corpus produces deterministic normalised rows.
- Duplicate and transfer tests do not inflate totals.
- Every imported record can trace back to source.
- User correction changes future suggestions without rewriting source history.
- A failed parser cannot expose file content in logs.

---


# Part 13: Search, Archive and Memory

_Source: `12_SEARCH_ARCHIVE_AND_MEMORY.md`_

## Search, Archive and Memory

## Product role

Folio becomes more valuable as it remembers what happened, what changed, how the user responded and how far they have come. The archive is not a passive dump; it is a private, searchable financial memory.

## Universal search

Search spans the active workspace only by default:

- transactions;
- events;
- accounts and counterparties;
- plans and milestones;
- calendar items and tasks;
- documents and extracted text;
- invoices and business records;
- Melo summaries and accepted memories.

Personal and business results never appear together unless the user deliberately chooses “All spaces,” which must carry a visible mixed-context warning and must never be available inside tax exports.

## Search forms

### Direct search

- merchant/reference;
- date/range;
- amount/range;
- category;
- account;
- event type;
- plan;
- document text;
- business tax period.

### Natural-language search

Examples:

- “When did I clear Klarna?”
- “Show every insurance payment last year.”
- “Find the March invoice from Acme.”
- “What changed after my overtime stopped?”

Natural language is translated into a typed query. The query is shown and editable. A model is optional; deterministic parsing covers common patterns.

## Local index

Use SQLite FTS5 for text and normal indices for structured filters. Index only decrypted local content while the vault is open. Do not upload the search index.

The FTS index is rebuildable from authoritative domain tables and document extractions. It is not itself a source of truth.

## Archive lifecycle

Records move through:

```text
active → completed/settled → archived → optionally purged
```

Archiving changes visibility, not truth. It must not alter historical forecasts or reports.

Retention controls:

- keep indefinitely;
- keep by record type;
- auto-archive completed plans;
- purge extracted OCR while retaining the original;
- delete original document after extraction;
- destroy selected memories while preserving financial records;
- full workspace export and deletion.

Business retention guidance is jurisdiction-specific and must be displayed as guidance with a verification date, not silently enforced.

## Melo memory model

Melo memory is not an unbounded chat transcript. It contains compact, typed, inspectable facts:

- preference;
- recurring pattern;
- user correction;
- accountability style;
- important event summary;
- plan commitment;
- user-approved personal context.

Each memory has:

- scope: personal/business/global preference;
- provenance;
- reason it is useful;
- sensitivity;
- expiry/review date;
- user visibility;
- delete control.

Memory levels:

- **Minimal:** current task and essential interface preferences.
- **Normal:** recurring patterns, corrections, plans and selected events.
- **Deep:** richer user-approved history and reflection.

No memory level permits hidden profiling for advertising, credit scoring or model training.

## Corrections and learning

A correction creates a durable rule or counterexample only when the user accepts it.

Example:

```text
Melo inferred “salary”
user says “refund”
→ transaction corrected
→ correction record stored
→ equivalent future inference down-weighted
```

The system retains both the original inference and correction for auditability.

## Long-term reflection

Folio may generate local, reviewable retrospective views:

- first month versus current month;
- debts cleared;
- difficult periods recovered from;
- income or obligation changes;
- plan changes and milestones;
- decisions explored and actual outcomes.

The narrative must be grounded in records and never invent causality.

## Archive scale targets

Design and test for:

- 10 years of daily use;
- 250,000 transactions/events combined;
- 20,000 documents or extracted items;
- sub-300 ms common structured search on a representative device;
- progressive/streamed rendering for large result sets;
- resumable index rebuild.

## Acceptance gates

- Search respects workspace boundaries.
- Every natural-language result displays its applied filters.
- Deleting Melo memory does not delete financial truth unless explicitly selected.
- Export includes provenance and human-readable formats.
- Search works fully offline.

---


# Part 14: Local-First, Cloud Sync, Backup and Recovery

_Source: `13_LOCAL_FIRST_SYNC_BACKUP_RECOVERY.md`_

## Local-First, Cloud Sync, Backup and Recovery

## Ownership model

> The user owns the data. Folio provides optional services.

The local encrypted vault is authoritative. An account, internet connection or cloud subscription is not required to use the personal core.

## Three operating modes

### 1. Local-only

- no Folio account;
- no server-held financial payload;
- manual encrypted export and device backup options;
- all core functions available.

### 2. Local + encrypted backup

- account authenticates the person to the backup service;
- server stores opaque encrypted vault snapshots and minimal routing metadata;
- restore requires a vault recovery method, not merely account login.

### 3. Local + encrypted multi-device sync

- each device has a local vault;
- encrypted operation envelopes sync through the service;
- deterministic merge/conflict policy;
- single-user multi-device at launch;
- household/accountant collaboration deferred.

## Authentication is not decryption

Apple/Google/passkey sign-in proves account access. It must not be the sole encryption-key recovery path.

Recommended key hierarchy:

```text
random 256-bit vault master key
├── personal workspace subkey
├── each business workspace subkey
├── document subkey(s)
└── sync envelope key
```

The master key is wrapped locally by a platform-protected key in Keychain/Android Keystore. Optional recovery uses a separate recovery secret/passphrase hardened with Argon2id and/or a printed recovery code.

The server does not receive an unwrapped vault key.

## Recovery options

During cloud enablement the user chooses at least one:

- device-to-device transfer;
- recovery code;
- recovery passphrase;
- trusted recovery device.

Explain the trade-off plainly: a zero-knowledge service cannot restore data without a valid recovery method.

Recovery flow must be tested before Folio claims a backup is protected. A periodic, optional “verify recovery” ritual can confirm that the user still has access without exposing the secret.

## Sync model

Every local mutation creates:

- domain command result;
- append-only operation record;
- monotonically ordered local sequence;
- entity version/HLC timestamp;
- encrypted outbox envelope.

The service stores and relays opaque envelopes. Devices apply operations idempotently.

### Conflict policy

- Posted transactions: preserve both; use explicit duplicate/reversal workflow.
- User edits to descriptive metadata: field-level last accepted version, preserving conflict history.
- Plans: merge non-overlapping fields; otherwise ask the user.
- Calendar/task completion: monotonic completed state unless reopened explicitly.
- Recurring rules: conflicting schedule/amount edits require review.
- Deletes: tombstone, grace period, then compaction.
- Workspace assignment: never auto-merge across personal/business.

Do not use “last write wins” as a universal policy.

## Snapshot and compaction

- Periodic encrypted snapshots shorten restore time.
- Operation history is compacted only after all registered active devices acknowledge a safe point.
- Old inactive devices are revoked through an explicit device manager.
- Revocation rotates sync keys for future envelopes.

## Cloud metadata minimisation

Permitted service metadata:

- account ID;
- device ID/public key;
- encrypted blob IDs;
- sequence and size;
- creation/expiry timestamps;
- entitlement and consent state;
- coarse operational metrics.

Avoid merchant names, amounts, categories, plan titles, document text and calendar details outside encrypted payloads.

## Backup behavior

- Atomic snapshot before schema migration.
- Validate backup hash and decryptability locally before marking successful.
- Keep at least two generations for corruption recovery.
- User can export an encrypted portable backup independent of Folio cloud.
- Never rely solely on iOS/Android automatic app backup because platform limits and key-restoration behavior vary.

## Account deletion

Account deletion is available in-app and through the required web path where applicable. The user chooses:

- delete cloud account and ciphertext but keep local vault;
- export then delete everything;
- delete a single device registration;
- delete a business workspace only.

Deletion is confirmed, queued with a short reversible grace period where lawful, then cryptographically and physically purged according to the published schedule.

## Failure behavior

If sync fails:

- local work continues;
- Today briefing shows a quiet sync state, not an alarm unless backup risk grows;
- retry uses exponential backoff;
- the app never blocks on cloud;
- no silent rollback to older cloud state.

## Acceptance gates

- Fresh install restores from snapshot + operations without plaintext server access.
- Loss of account session alone cannot decrypt a vault.
- Loss of one device does not prevent recovery when the selected recovery method exists.
- Simultaneous offline edits produce deterministic, reviewable outcomes.
- Cloud outage does not affect core calculations.

---


# Part 15: Security, Privacy and Threat Model

_Source: `14_SECURITY_PRIVACY_AND_THREAT_MODEL.md`_

## Security, Privacy and Threat Model

## Security objective

Protect a high-sensitivity financial record without making the user surrender ownership or live permanently online.

The security programme should target OWASP MASVS controls for storage, cryptography, authentication, network, platform, code and privacy, with a documented threat model and independent review before public launch.

## Assets

Highest sensitivity:

- transaction and balance history;
- debts, income and obligations;
- personal/business documents;
- tax records and invoices;
- account and Open Banking tokens;
- vault and recovery keys;
- Melo memory and conversation content;
- notification text.

## Threat actors and failures

- lost or stolen unlocked/locked device;
- malicious app or clipboard/screenshot leakage;
- compromised cloud account;
- backend breach;
- rogue administrator;
- compromised dependency/build pipeline;
- rooted/jailbroken device;
- insecure backups/logging;
- import file attacks;
- prompt injection in imported documents;
- model/provider data leakage;
- accidental personal/business mixing;
- destructive sync conflict;
- social-engineering recovery attempt.

## Local encryption

- SQLCipher-encrypted SQLite database.
- Separate encrypted document files; never store large source files as unencrypted blobs.
- Random vault key; no hardcoded keys.
- Platform Keychain/Keystore protects wrapping keys.
- Biometric/app PIN can gate unwrapping, but biometrics are not the vault key.
- Sensitive data excluded from app switcher previews where practical.
- Clipboard export is explicit and time-limited where supported.

A native crypto module should use platform primitives rather than JavaScript cryptography for root key handling.

## App lock

User-selectable:

- immediate;
- after short timeout;
- after device lock;
- never (with clear warning).

Offer biometric unlock with device credential fallback. Do not lock a user out of data solely because biometric enrollment changed; use a recovery route.

## Network security

- TLS only;
- strict certificate validation;
- short-lived service tokens;
- server-side cloud AI keys;
- no secrets in the mobile bundle;
- request signing or DPoP-style proof considered for high-risk endpoints;
- rate limiting, replay protection and idempotency keys;
- explicit egress allow-list for sensitive modules.

Certificate pinning is a threat-model decision, not a default checkbox, because operational failure can strand users. Document the choice.

## Import and document sandboxing

- Copy selected files into private app storage.
- Enforce MIME/content sniffing, size/page limits and decompression limits.
- Parse in isolated worker/native boundary where feasible.
- Reject executable content and unsafe embedded links.
- Treat document text as untrusted data, never model/system instructions.
- No automatic action derived from document content.

## AI privacy

- Deterministic/local route first.
- Send only the minimum structured context needed for the selected task.
- Never send the full vault by default.
- No provider training on user data by product policy.
- Redact identifiers when they are not required.
- Show cloud badge/consent before first cloud AI use.
- Cloud request/response retention is configurable and documented.
- Model output cannot bypass typed proposal validation.

## Telemetry

Default telemetry contains no amounts, merchant text, plan names, notes, document content or conversation text.

Use:

- OS/App Store aggregate diagnostics;
- local performance counters;
- explicit opt-in sanitised diagnostic bundle;
- event names with coarse, non-financial properties.

A support export must show exactly what will be shared.

## Privacy programme

Before launch:

- complete a UK GDPR DPIA;
- maintain a record of processing activities;
- define controller/processor roles for every cloud provider;
- execute DPAs and international-transfer assessment where relevant;
- publish plain-language privacy controls;
- maintain Apple privacy details and Google Data Safety declarations;
- implement access/export/deletion requests;
- test consent withdrawal.

Initial product scope should be adults. A youth/child version requires a separate age-appropriate design and legal review.

## Workspace isolation

Every domain query and mutation requires workspace scope. Business tax exports query only business workspace IDs. Personal and business document encryption keys are separate subkeys. Cross-workspace moves are explicit, audited and reversible.

## Security release gates

- Mobile threat model reviewed.
- MASVS checklist completed at agreed level.
- Dependency and secret scanning clean.
- Static/dynamic mobile security tests complete.
- Database migration and restore drills pass.
- Penetration test for auth/sync/cloud gateway.
- Cryptographic design reviewed by a qualified specialist.
- No high/critical finding open.
- Incident response and key-rotation runbook exercised.

---


# Part 16: AI Architecture, Cost and Limits

_Source: `15_AI_ARCHITECTURE_COST_AND_LIMITS.md`_

## AI Architecture, Cost and Limits

## Principle

AI is a language and convenience layer over a deterministic financial system. It is not the source of financial truth and does not choose for the user.

```text
local facts
→ deterministic engines
→ typed result/proposal
→ optional model for language or extraction
→ schema validation
→ user review
→ domain command
```

## Route ladder

1. **No model:** templates, rules, typed search and deterministic parsing.
2. **On-device platform model:** when available, supported and permitted.
3. **Small cloud model:** natural-language intent, summarisation and low-risk extraction.
4. **Stronger cloud model:** rare complex document/explanation task with explicit consent.
5. **Manual fallback:** user completes the structured flow.

The model registry is server-configurable and versioned. Never hard-code a preview model as a permanent architectural dependency.

## Supported AI tasks

- parse a user question into a typed intent;
- produce a friendly explanation from a typed calculation;
- propose merchant/category cleanup;
- map unfamiliar CSV columns;
- extract candidate fields from documents;
- summarise confirmed changes;
- answer grounded search questions;
- vary Melo's wording/personality within policy.

## Forbidden AI tasks

- calculate balances, interest or forecasts without deterministic verification;
- decide that a financial product/action is suitable or best;
- file tax submissions without a dedicated verified workflow;
- write directly to financial tables;
- conceal assumptions;
- train on user financial data by default;
- infer sensitive traits for advertising or pricing;
- continue asking questions without an active intent and stop condition.

## Structured tool boundary

Every model route receives a narrow JSON schema and returns a typed object. Examples:

- `ParseQuestionResult`
- `TransactionClassificationProposal`
- `ImportColumnMappingProposal`
- `MeloExplanationDraft`
- `DocumentExtractionProposal`

Unknown or invalid output is rejected. The model does not receive SQL or arbitrary tool execution.

## Conversation controls

Default per task:

- maximum three clarification questions;
- one question at a time;
- state the purpose when not obvious;
- stop when enough data exists;
- offer “review manually” at every stage;
- do not charge a second quota unit for a retry caused by system failure.

## Context minimisation

Use retrieval to select only:

- current workspace;
- relevant dates/events;
- the typed deterministic result;
- user-selected tone preference;
- minimum prior conversational state.

Do not send full account history. Replace names with local aliases unless the task requires them.

## Cloud cost model for 1,000 users

Illustrative baseline using a low-cost cloud text model at $0.25 per million input tokens and $1.50 per million output tokens (prices are volatile and must be read from the provider registry at deployment):

| Usage | Assumption per call | Monthly tokens | Approx. model cost |
|---|---:|---:|---:|
| Light | 30 calls/user, 600 in + 180 out | 18M in + 5.4M out | $12.60 |
| Regular | 100 calls/user, 600 in + 180 out | 60M in + 18M out | $42.00 |
| Heavy | 300 calls/user, 600 in + 180 out | 180M in + 54M out | $126.00 |

Add 20–30% operating headroom for retries, moderation and routing. Images, audio, long documents, grounding and stronger fallback models are separately metered.

The model is unlikely to be the main cost if most core answers use deterministic templates.

## Quotas

Rate-limit only cloud convenience, never the financial core.

Possible policy:

- templates/rules: unlimited;
- on-device AI: device-limited, not subscription-limited;
- cloud text: daily/monthly fair-use units;
- document extraction: separate weighted units;
- strong model: rare explicit action;
- abuse protection by account/device/IP risk signals without financial profiling.

Quotas and pricing remain configuration, not domain logic.

## Quality evaluation

Maintain a versioned evaluation set covering:

- intent parsing;
- explanation faithfulness;
- advice-boundary language;
- import mapping;
- transaction classification;
- no-shame tone;
- workspace isolation;
- bad-month responses;
- hallucination/unsupported claim detection;
- prompt injection from documents.

A model change cannot ship merely because it sounds better. It must pass schema validity, factual consistency and safety thresholds.

## Availability behavior

If no model is available:

- Melo still briefs through templates;
- calculations and plans work;
- natural-language input offers structured controls;
- queued cloud requests never block a user action;
- the app says what is unavailable without implying the finances are unavailable.

---


# Part 17: Open Banking and Permission Architecture

_Source: `16_OPEN_BANKING_AND_PERMISSIONS.md`_

## Open Banking and Permission Architecture

## Product position

Open Banking is an optional automation adapter, not the foundation of Folio. A user can receive core value through manual quick start and imports.

## Regulatory delivery model

For initial UK launch, integrate through a regulated Account Information Service provider rather than attempting direct authorisation before product-market fit. Encapsulate the provider behind `BankDataProvider` so Folio can replace or add providers without rewriting the domain.

A direct AISP path is a later company/regulatory programme, not an engineering shortcut.

## Consent principles

- Request only the data permissions needed for the feature the user selected.
- Explain why, what data, which accounts and how long.
- Let the user choose eligible accounts at the bank/provider journey.
- Do not promise arbitrary “pot-only” access if the bank/provider permission model does not expose it.
- Show an in-app consent dashboard with provider, accounts, scopes, expiry/reconfirmation and revoke control.
- Revocation stops future access; locally retained data is separately controlled.

## Permission timing

No Open Banking prompt on first launch. Prompt only after the user chooses “connect a bank” and sees the privacy explanation.

Likewise:

- camera permission only when capturing a document;
- microphone only when using voice;
- notification permission after the user creates a useful reminder or sees the value;
- calendar access only when enabling system calendar integration;
- biometric access only when enabling app lock.

## Data flow

```text
user selects connect bank
→ Folio creates consent request with provider
→ provider/bank authentication and account selection
→ callback/token held by secure backend adapter
→ provider data normalised to canonical import records
→ encrypted/minimised delivery to device
→ local reconciliation/review
→ local domain commit
```

Long-lived bank tokens must not live in the JavaScript bundle or ordinary local preferences. Server components store provider tokens encrypted with tightly controlled access and retrieve only for the user-authorised service.

## Refresh and gaps

- Track consent expiry/reconfirmation.
- Detect missing date ranges and provider outages.
- Mark delayed data clearly.
- Do not assume bank feed equals real-time final truth; pending/posted state matters.
- Reconcile provider transaction IDs and pending replacements.
- Allow CSV/manual gap filling without duplicates.

## User controls

- pause connection;
- revoke consent;
- remove one account;
- stop future sync while retaining imported history;
- delete imported history from Folio;
- reconnect through another provider;
- see last successful update and current data scope.

## Provider selection criteria

Evaluate:

- regulated status and UK coverage;
- account and transaction scope;
- consent UX and refresh behavior;
- pending/posted quality;
- webhook/reliability guarantees;
- sandbox quality;
- pricing at 1k/10k/100k connected accounts;
- data residency and processor terms;
- token security and incident history;
- business/SME account support;
- exportability and vendor lock-in.

Do not select solely on the cheapest headline price.

## Acceptance gates

- Manual/import-only mode remains complete.
- A revoked consent produces no further provider access.
- Account selection is faithfully represented.
- Personal and business bank accounts cannot silently enter the wrong workspace.
- Provider outage does not corrupt forecasts; stale state is visible.
- No raw provider token appears in client logs or database exports.

---


# Part 18: Documents, OCR and Voice

_Source: `17_DOCUMENTS_OCR_AND_VOICE.md`_

## Documents, OCR and Voice

## Documents are optional context

A user can attach a photo or file in the simplest possible way. Folio extracts useful candidates, but the document remains evidence and the user remains in control.

Common document types:

- bank/card statements;
- receipts and invoices;
- payslips;
- bills and renewal notices;
- loan statements;
- contracts;
- tax evidence;
- letters related to unexpected changes.

## Storage

- Encrypted files live outside SQLite in app-private storage.
- SQLite stores metadata, hashes, links, extraction status and text index references.
- Use content-addressed deduplication within a workspace where safe.
- Personal and business documents use separate workspace keys.
- User controls original-file retention.

## Capture flow

```text
capture/select
→ local preview
→ crop/rotate/page selection
→ encrypted save
→ on-device OCR/table extraction
→ candidate fields highlighted
→ user review
→ link to transaction/event/plan/invoice
→ optional delete extracted text/original
```

The user sees progress immediately. OCR can continue in a background task when the platform permits, but the app must resume cleanly if suspended.

## OCR adapters

- iOS: Vision/VisionKit document scanning and text recognition.
- Android: ML Kit on-device text recognition/document scanner where available.
- Fallback: manual entry and optional cloud OCR with explicit consent.

Some Android models may download on first use; the UI must state when an “on-device” component is not yet installed and offer to continue later.

## Extraction rules

Candidate extraction may identify:

- date;
- total;
- currency;
- merchant/supplier;
- invoice number;
- tax amount;
- account/reference;
- period;
- line items where reliable.

Every candidate carries bounding/source reference and confidence. No extracted value becomes a tax or financial fact without review or deterministic reconciliation.

## Prompt-injection defense

Document text is untrusted content. Strings such as “ignore previous instructions” are evidence text, not instructions. Models receive document content in a clearly delimited data field and cannot invoke domain tools.

## Voice input

Voice is a fast alternative to typing, not passive surveillance.

- microphone starts only after an explicit tap;
- recording state is unmistakable;
- transcript appears before action;
- on-device speech recognition is preferred and capability-checked;
- cloud speech requires one-time and per-use clarity;
- no continuous background listening;
- user can delete audio immediately; default is not to retain raw audio.

Examples:

- “My car broke down and it will cost about £420 next Thursday.”
- “Mark that invoice paid.”
- “Move the holiday target to September.”

The transcript is parsed into a typed proposal and reviewed.

## Accessibility

Document and voice flows require non-camera/non-voice alternatives. OCR results must be readable by screen readers, and bounding-box-only interaction cannot be the sole way to correct data.

## Acceptance gates

- Documents never leave the device without explicit cloud-route consent.
- Extraction remains a proposal until accepted.
- A malicious document cannot alter prompts or records.
- Voice can be used and discarded without transcript history if selected.
- Search can find user-approved extracted text offline.

---


# Part 19: Business, Tax and Compliance Architecture

_Source: `18_BUSINESS_TAX_AND_COMPLIANCE.md`_

## Business, Tax and Compliance Architecture

## Product position

Business is a first-class optional workspace, not a filter over personal finances. It is represented in the data architecture from the start, while the full business UI may ship after the personal debt-focused launch.

Folio helps a user organise records, understand business cash flow, estimate and prepare. It is not an accountant or final tax authority.

## Workspace boundary

A business workspace has its own:

- accounts and transactions;
- categories and tax mappings;
- clients/suppliers;
- invoices and receipts;
- calendar/tasks;
- plans/budgets/forecasts;
- documents;
- Melo memory and briefing;
- reports and exports;
- encryption subkey.

There is no combined tax ledger. Transfers between personal and business are linked cross-workspace movements with explicit owner-draw/contribution meaning, not merged transactions.

## Business core

- income and expenses;
- invoice lifecycle;
- receipt capture;
- cash-flow forecast;
- outstanding receivables;
- recurring business commitments;
- tax-period organisation;
- mileage records;
- export for accountant/software;
- deadline calendar.

Inventory, payroll, double-entry general ledger, multi-entity consolidation and direct tax filing are later modules unless a launch segment requires them.

## Tax records

Each tax-relevant record stores:

- jurisdiction;
- tax year/period;
- business entity/workspace;
- category and mapping version;
- source evidence;
- review status;
- user/accountant adjustment;
- export history.

Tax rules are versioned jurisdictional policy packs with effective dates. A rule pack is never silently retroactive.

## UK launch considerations

The architecture should be ready for:

- Self Assessment record organisation;
- VAT record fields where applicable;
- Making Tax Digital digital-record requirements;
- quarterly update periods;
- authorised software/API integration later.

Thresholds and dates are volatile. Folio displays a “verified on” date and links to official guidance. Eligibility is never inferred as final legal status from incomplete data.

Direct HMRC filing requires a dedicated compliance programme:

- HMRC developer registration;
- production credentials;
- fraud-prevention headers;
- conformance/sandbox tests;
- user authorisation;
- immutable submission receipts;
- error/correction flow;
- legal review and support process.

It must not be smuggled into the normal export feature.

## Invoices

Invoice lifecycle:

```text
draft → issued → viewed/unknown → part-paid → paid → overdue → void/credited
```

Invoices generate events, expected cash-flow items, reminders and document artifacts. A payment match is proposed, not silently applied when ambiguous.

## Estimates and tax pots

Folio may show consequence-based estimates:

> Based on records currently marked taxable and the assumptions shown, the estimated amount to reserve is £X.

It must not say:

> Your final tax bill is £X.

The user can configure a reserve percentage or official rule pack. Estimates display exclusions and uncertainty.

## Exports

- human-readable PDF summary;
- CSV/JSON data export;
- accountant package with evidence links;
- tax-period audit trail;
- invoice register;
- optional standard/API formats later.

Every export identifies workspace, period, currency basis, generated time, rule-pack version and unresolved items.

## Acceptance gates

- Personal data cannot enter a business tax export.
- Workspace moves are audited and reversible.
- Every tax figure traces to records and policy assumptions.
- Direct filing is disabled until all compliance gates pass.
- Business mode can be omitted from an early UI build without changing the core schema.

---


# Part 20: Gamification, Retention and Notifications

_Source: `19_GAMIFICATION_RETENTION_AND_NOTIFICATIONS.md`_

## Gamification, Retention and Notifications

## Retention purpose

Retention is not the goal by itself. Folio earns return visits by preserving clarity, progress, memory and the relationship with Melo.

The desired loop is:

```text
understand → act or observe → see progress → learn → return when useful
```

## Bespoke motivation

Different users return for different reasons:

- debt progress;
- remaining budget/payday position;
- savings or future plan;
- calendar/planner;
- business cash flow;
- upcoming obligations;
- personal reflection.

Folio observes accepted behavior and asks permission before adapting the visible motivation. Users can choose, edit or reset what Melo emphasises.

## Momentum, not guilt streaks

Momentum may be earned by real actions:

- reviewing a changed position;
- confirming or correcting an event;
- completing a bill/payment task;
- making an accepted plan contribution;
- recovering after disruption;
- completing a weekly or payday review;
- keeping records current enough to forecast.

There is no public leaderboard and no financial comparison with other users. Missing a day does not erase progress.

## Fun layer

Fun can include:

- expressive Melo animations;
- plan journeys and visual landmarks;
- milestone reveals;
- compact optional financial-learning games;
- playful import progress;
- seasonal themes controlled by the user;
- satisfying “handled” moments.

The fun layer pauses or softens in bad-month mode and never trivialises eviction, arrears, insolvency, bereavement or hardship.

## Celebration policy

Celebrate:

- facing the numbers;
- correcting incomplete data;
- covering an important obligation;
- progress relative to the user's own plan;
- recovery and re-planning;
- first useful import;
- document organisation;
- debt or plan milestones.

Do not celebrate:

- high income as moral success;
- spending less than other people;
- taking a particular financial product;
- perfect adherence at the expense of wellbeing;
- a model-generated score.

## Notification philosophy

> Quiet by default. Useful when it speaks.

Notification classes:

1. **Critical user-chosen deadline** — bill/tax/important reminder.
2. **Meaningful change** — payment missing, expected income changed, plan materially affected.
3. **Ritual** — payday, weekly reflection, month close, only if enabled.
4. **Progress** — milestone, only if enabled.
5. **Marketing** — off by default and never mixed with financial warnings.

Rules:

- local notifications preferred for local events;
- no sensitive amount/merchant text on lock screen unless user opts in;
- quiet hours and per-class frequency controls;
- no repeated dismissal loop;
- no “your streak is dying” language;
- maximum one unsolicited non-critical push in the user-defined quiet period;
- no push merely to increase daily active users.

## Proactive Melo selection

Candidate items are scored by:

```text
severity × immediacy × confidence × novelty × user relevance
− fatigue cost − uncertainty penalty
```

Only the top items appear. “Nothing needs attention” is a valid briefing.

## Experiments and ethics

A/B tests cannot manipulate:

- advice-boundary language;
- bad-month safety tone;
- privacy choices;
- consent prominence;
- account deletion;
- financial truth;
- notification urgency.

Retention experiments require a pre-registered user-benefit hypothesis and guardrail metrics such as notification opt-out, anxiety feedback, correction rate and support complaints.

## Acceptance gates

- The app remains valuable with all game/ritual features disabled.
- A bad month suppresses inappropriate celebration.
- Notification previews respect privacy settings.
- Momentum survives absence and recovery.
- Personalisation is inspectable and resettable.

---


# Part 21: Accessibility, Internationalisation and Vulnerable Users

_Source: `20_ACCESSIBILITY_INTERNATIONALISATION_AND_VULNERABILITY.md`_

## Accessibility, Internationalisation and Vulnerable Users

## Accessibility is a release requirement

Target WCAG 2.2 AA principles adapted to native mobile, Apple accessibility guidance and Android accessibility testing.

Core requirements:

- complete VoiceOver and TalkBack paths;
- logical focus order and clear control names;
- Dynamic Type / large-font support without clipped money values;
- colour-independent status meaning;
- reduced-motion mode;
- sufficient contrast;
- minimum touch targets;
- keyboard/switch access where supported;
- accessible charts with textual summaries;
- no timeout that loses financial input;
- plain language and expandable detail.

Every critical flow must be tested without vision, colour, audio, animation and precise gestures.

## Cognitive and emotional accessibility

- one important question at a time;
- concise first, detail on request;
- avoid jargon and unexplained acronyms;
- never use red as the only signal;
- preserve context after interruption;
- allow “not now” without punishment;
- show progress during long imports;
- offer calm mode with fewer animations and prompts;
- bad-month mode prioritises facts and pacing.

## Vulnerable circumstances

Folio may encounter users facing job loss, arrears, bereavement, coercive control, disability or crisis. Product behavior must not exploit vulnerability.

- Provide official support links by jurisdiction when relevant.
- Do not claim emergency/legal help.
- Hide sensitive notifications on lock screen by default.
- Add quick app lock and discreet display options.
- Avoid shared-device assumptions.
- Consider an optional safe-exit pattern after specialist review.
- Never infer vulnerability for marketing or pricing.

## International architecture

UK English/GBP is the first policy pack, not a hard-coded world model.

Separate:

- display locale;
- base/reporting currency;
- account currency;
- jurisdiction;
- tax policy;
- banking provider;
- week start/date format;
- language.

Use ISO 4217 currency codes, BCP 47 locales, RFC 3339 instants and IANA time-zone identifiers. Store money in native minor units, including currencies with zero or three decimal minor units.

## Multi-currency

Launch may limit consolidated reporting, but the schema must preserve original currency. Currency conversion requires:

- rate source;
- timestamp;
- direction;
- user override;
- original and converted amount;
- clear estimated status.

Never silently sum different currencies.

## Localisation

Melo personality and advice-boundary wording require human review, not literal machine translation. Legal/help content is a versioned jurisdiction pack.

## Age scope

Initial public version is designed for adults. If the app is knowingly offered to children, perform a separate age-appropriate design review, consent model, privacy assessment, store classification and safeguarding programme.

## Acceptance gates

- Screen-reader users can complete first value, import review, plan update, calendar task and export.
- 200% text size remains usable.
- Currency/date tests cover non-GBP and non-UK locales even before market launch.
- No translated text weakens the “not advice” boundary.

---


# Part 22: Technical Architecture

_Source: `21_TECHNICAL_ARCHITECTURE.md`_

## Technical Architecture

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

---


# Part 23: Data Model and API Contracts

_Source: `22_DATA_MODEL_AND_API_CONTRACTS.md`_

## Data Model and API Contracts

## Modelling rules

- IDs are globally unique, opaque and generated locally.
- All workspace-bound rows include `workspace_id`.
- Money is signed integer minor units plus ISO currency.
- Dates distinguish instant, local date, timezone and source text.
- Records carry creation/update versions and provenance.
- Soft deletion uses tombstones where sync requires it.
- Facts, expectations and hypothetical scenario changes are separate entities.
- Derived rows name their input version/hash.

## Principal aggregates

### Workspace

Personal or business context, encryption subkey, preferences and policy jurisdiction.

### Account and balance

Where money/debt is held. A balance observation has date, source and reconciliation state; it is not overwritten by a transaction total.

### Transaction

An actual or pending movement. Stores source, status, signed amount, counterparty/reference, account and splits. A transfer links transactions.

### Recurring expectation / obligation / income stream

A rule that predicts future events. An actual transaction may fulfil, differ from or miss an expectation.

### Event

Human meaning over facts or expected occurrences: payday, bill due/paid, debt cleared, unexpected cost, plan milestone, invoice paid and so on.

### Plan

Optional user-defined intended outcome with target, rules, priority, schedule, milestones and versions.

### Budget

A user-selected allocation or spending boundary over a period. Budgets do not masquerade as bank balances.

### Scenario and forecast

A scenario contains hypothetical changes. A forecast snapshot is a deterministic projection from a named data version and assumption set.

### Calendar item/task/reminder

Time-aware user or system item, optionally linked to a financial event or plan.

### Document

Encrypted file metadata, provenance, extraction candidates and links.

### Melo proposal/memory

Reviewable suggested command and compact approved contextual memory. Chat is not a financial record.

### Business entities

Client, invoice, tax period/category, mileage and business profile, always business-workspace scoped.

## Command examples

```ts
recordTransaction(input)
confirmImportRows(input)
linkTransfer(input)
updateRecurringExpectation(input)
createEvent(input)
createPlan(input)
rebasePlan(input)
runScenario(input)
acceptMeloProposal(input)
moveRecordBetweenWorkspaces(input)
archiveRecord(input)
```

Every command returns:

```ts
{
  result,
  changedEntityIds,
  invalidatedProjectionKinds,
  auditEntryId,
  outboxSequence
}
```

## Query examples

```ts
getTodayBriefing(workspaceId, at)
getPositionBeforeDate(workspaceId, date, scenarioId?)
getTimeline(range, filters)
searchWorkspace(query)
getPlanProgress(planId, at)
getCalendarRange(workspaceId, range)
getImportReview(importJobId)
getBusinessTaxPeriod(workspaceId, periodId)
```

Queries never silently cross workspace boundaries.

## API principle

Most app/domain APIs are local in-process contracts. Network APIs are narrow adapters for optional services.

### Cloud vault API

- register/revoke device;
- upload/download encrypted envelope;
- upload/download encrypted snapshot;
- list sequence metadata;
- manage recovery metadata;
- delete account/cloud data.

The service cannot query financial domain fields.

### AI gateway API

- submit typed task with redacted structured context;
- return typed draft/proposal;
- report usage/quota;
- never receive a database credential.

### Open Banking adapter API

- start consent;
- receive callback;
- list consent/account state;
- fetch canonical provider rows;
- revoke/refresh consent.

## Schema migration

- Ordered SQL migrations with checksums.
- Pre-migration encrypted snapshot.
- Transactional migration where SQLite permits.
- Post-migration integrity and semantic checks.
- No destructive migration without verified reversible export.
- Migration fixtures from every released schema version.

## Audit log

Audit records include:

- command type;
- actor: user/Melo/import/sync/system;
- workspace;
- affected IDs;
- before/after field hashes or structured delta;
- source/proposal;
- timestamp/device;
- rollback/reversal link.

Do not duplicate full sensitive rows in logs.

## Data minimisation

Do not add a field “because it may be useful later.” Every sensitive field must state:

- purpose;
- visibility;
- retention;
- sync behavior;
- deletion behavior;
- whether AI may receive it.

## Acceptance gates

- The SQL schema compiles and constraints reject cross-workspace errors.
- JSON/OpenAPI contracts validate example payloads.
- All financial totals use minor-unit arithmetic.
- Every projection can name its facts and assumptions.
- Schema migration tests cover crash and rollback.

---


# Part 24: Testing, Quality and Observability

_Source: `23_TESTING_QUALITY_AND_OBSERVABILITY.md`_

## Testing, Quality and Observability

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

---


# Part 25: Store Release and Monetisation Architecture

_Source: `24_STORE_RELEASE_AND_MONETISATION.md`_

## Store Release and Monetisation Architecture

## Store positioning

Folio is a financial record, forecasting and planning application. It must accurately declare financial features, sensitive data handling and any Open Banking/tax integration in each target store.

Initial public scope:

- adults;
- UK-first policy pack;
- personal workspace and debt-focused clarity;
- local-only use without login;
- optional account/cloud features;
- business architecture present, business UI phased.

## App account rules

- Do not require sign-in for local core.
- If account creation is enabled, offer in-app account deletion.
- Provide the external deletion path required by Google Play.
- If third-party login is offered on iOS, meet Sign in with Apple equivalence requirements.
- Account deletion and cloud-data deletion are not hidden behind support.

## Privacy declarations

Maintain one data inventory that generates/checks:

- privacy policy;
- Apple App Privacy answers;
- privacy manifests/required-reason APIs;
- Google Data Safety form;
- Google Financial Features declaration;
- processor list;
- in-app privacy centre.

Any SDK change triggers a declaration review.

## Financial/store compliance

- Register the appropriate organisation developer account where store policy requires it for financial services/features.
- Provide review notes explaining that Folio does not execute investments, lend, broker or provide personal financial recommendations.
- Provide a review account/demo mode without exposing real financial data.
- Keep Open Banking provider authorisation evidence and consent UX available to reviewers.
- Complete age/content rating accurately.

## Monetisation is an adapter

The business model is intentionally undecided. Do not bind core data or calculations to a price tier.

Implement entitlement capabilities such as:

```text
local_core
cloud_backup
multi_device_sync
cloud_ai_units
advanced_imports
business_workspace
business_exports
open_banking_connection_count
```

Map products/prices to capabilities later.

## Likely sustainable shape (not a locked price)

- **Free/local:** personal local core, manual/import path, basic Melo/templates, calendar/plans, export.
- **Cloud/Pro:** encrypted backup/sync, larger cloud AI quota, richer automation.
- **Business:** separated business workspace, invoices/receipts/tax preparation/exports.

Do not paywall access to a user's existing records or a basic full export. Core financial truth should continue during subscription lapse.

## Store billing

Digital subscriptions/features use StoreKit 2 and Google Play Billing where required. The backend verifies purchases and issues signed entitlements; the app caches an offline entitlement with a reasonable grace period.

Rules:

- no permanent lockout during temporary store outage;
- restore purchases;
- clear renewal/pricing terms;
- downgrade does not delete data;
- business records remain exportable after expiry;
- AI quota displayed before use;
- no surprise document charges.

## Release tracks

1. internal security/engine build;
2. staff/dev dogfood with synthetic data;
3. private alpha with local-only mode;
4. TestFlight/closed Play beta;
5. limited UK release;
6. staged rollout;
7. business module beta;
8. Open Banking controlled rollout.

## Review demo mode

Include an entirely synthetic, labelled demo vault that shows:

- Today briefing;
- timeline/calendar;
- debt plan;
- unexpected event recovery;
- business workspace preview if submitted;
- privacy/cloud controls.

Demo data never mixes with the user's vault.

## Acceptance gates

- Store declarations match actual data flows.
- Local core launches without account.
- Account deletion is tested end-to-end.
- Subscription outage does not remove local access.
- Reviewers can exercise functionality safely.
- Legal review covers advice boundary, privacy, Open Banking and business/tax claims.

---


# Part 26: Complete Build Sequence and Acceptance

_Source: `25_COMPLETE_BUILD_SEQUENCE_AND_ACCEPTANCE.md`_

## Complete Build Sequence and Acceptance

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

---


# Part 27: Folio V1 Donor Audit Protocol

_Source: `26_V1_DONOR_AUDIT_PROTOCOL.md`_

## Folio V1 Donor Audit Protocol

## Non-negotiable framing

Folio V1 is a donor/reference product. Folio V2 is not a refactor, migration branch, redesign layer or feature expansion of V1.

The V2 agent must first create and pass the greenfield architecture. Only then may it inspect V1 to identify reusable assets.

## What may be donated

Potential donor categories:

- mascot illustrations, poses and animation concepts;
- validated visual tokens;
- polished accessible components;
- icons and brand assets;
- useful copy/personality fragments;
- test fixtures;
- calendar/planner interaction ideas;
- existing finance domain logic that independently passes V2 contracts;
- export/import format samples.

## What cannot be inherited without re-derivation

- database schema;
- navigation/information architecture;
- dashboard assumptions;
- onboarding flow;
- AI prompts/agent logic;
- auth/cloud coupling;
- personal/business mixing;
- unverified calculations;
- state-management shortcuts;
- insecure storage;
- V1 naming that contradicts V2 concepts.

## Audit workflow

1. Freeze V1 and record commit/deployment.
2. Build inventory without copying.
3. Classify each item:
   - reuse unchanged;
   - adapt behind V2 contract;
   - reference only;
   - reject.
4. Record dependencies, licence/provenance, accessibility, tests and security concerns.
5. Recreate or copy only after its target V2 module exists.
6. Require visual/behavioral regression review.
7. Delete any donor code that forces V1 architecture into V2.

## Donor acceptance questions

- Does it fit the V2 constitution?
- Is it less expensive/safer to reuse than recreate?
- Can it operate offline?
- Does it respect workspace isolation?
- Is it accessible?
- Is its dependency tree maintained?
- Does it have tests or can tests be added first?
- Does it introduce dashboard/advice/setup-heavy behavior?
- Can it be removed later without domain damage?

## Agent language

Forbidden implementation language:

- “upgrade the existing dashboard”;
- “add the new engine to the current schema”;
- “keep the existing flow for speed”;
- “reuse most of V1 and patch gaps.”

Required language:

- “implement V2 contract in the greenfield repository”;
- “evaluate V1 artifact as a donor after the contract passes”;
- “replace donor code if it conflicts with V2 invariants.”

## Migration of existing users

If V1 has real users/data, migration is a separate import adapter:

```text
export V1
→ stage as an external source
→ validate/map/reconcile
→ user review
→ import to V2
```

Never point V2 at the V1 database and mutate it in place.

---


# Part 28: Decision Log and Open Sign-offs

_Source: `27_DECISION_LOG_AND_OPEN_SIGNOFFS.md`_

## Decision Log and Open Sign-offs

## Locked product decisions

- Greenfield V2; V1 is donor material only.
- Mobile-first.
- Personal workspace default; business workspace distinctly separated and architected from the start.
- Debt-focused first segment; broader personal/business use grows from the same engines.
- Local-first, cloud-enhanced; local vault is authoritative.
- User owns data; Folio provides optional services.
- No mandatory account, Open Banking, cloud AI or internet for core.
- Hybrid Today briefing, Melo, timeline, calendar/planner and visual progress.
- Melo is a mandatory personality/presence, not mandatory chat.
- Melo proactivity target 6–8/10 with user controls and bounded questions.
- Actual posted transaction is truth; expectations remain separate.
- Plans are optional, configurable and dynamically rebased.
- Calendar/planner has medium scope and may include non-financial life events.
- Business records/tax/calendar/Melo context never mix with personal presentation.
- No financial advice; consequence simulation and explanation only.
- No fake universal score, shame, guilt streak or dashboard-first experience.
- Fun/retention follows real progress, confidence and user-specific motivation.
- Bad months receive truth, context and path forward.
- AI is optional and cannot write domain records directly.

## Locked implementation direction

- Expo/React Native TypeScript mobile stack with development builds.
- Encrypted SQLite + FTS5 behind an abstraction, proven by spike.
- Pure deterministic engines.
- Typed command/proposal architecture.
- Local internal calendar and notifications.
- On-device OCR where possible.
- Provider abstractions for AI, Open Banking, cloud storage and database.
- Separate authentication and vault-key recovery.
- Store opaque encrypted cloud payloads where practical.
- Business/tax direct filing is a later compliance programme.

## Deliberately not locked

These require evidence or founder decision, not agent invention:

- final brand/tagline;
- exact navigation labels and visual style beyond the experience principles;
- exact pricing/business model;
- which regulated Open Banking provider;
- which cloud infrastructure vendor;
- exact AI provider/model at launch;
- launch countries after UK;
- whether/when business mode ships in the first public binary;
- precise free/paid entitlement mapping;
- full planner/project-management expansion;
- household collaboration model;
- direct HMRC filing timing.

## Required founder sign-offs before build commitment

1. Approve the product constitution and advice boundary.
2. Approve first-60-second experience prototypes.
3. Approve Today navigation/home hierarchy.
4. Approve Melo tone modes and intervention examples.
5. Approve personal/business visual separation.
6. Approve local-only versus cloud copy and recovery trade-off.
7. Approve the database/crypto spike result.
8. Approve the beta scope and business module timing.
9. Approve the monetisation experiment when evidence exists.

## Research/revalidation triggers

Re-run targeted research when:

- store policies change;
- a new SDK/database/model is selected;
- UK regulatory/tax scope changes;
- Open Banking provider changes;
- adding investments, credit recommendations, payments or lending;
- adding children/households/collaboration;
- entering a new jurisdiction;
- cloud provider begins using data for model/product training;
- encrypted sync design changes.

## Rule for agents

An unresolved sign-off does not permit silent invention. Implement an interface/configuration seam, use a clearly marked development default and record the decision required.

---


# Part 29: Research Findings and Rationale

_Source: `28_RESEARCH_FINDINGS_AND_RATIONALE.md`_

## Research Findings and Rationale

## Research approach

Research completed on 20 June 2026 prioritised primary sources: platform documentation, UK regulators/government, Open Banking standards, security standards, official software documentation and peer-reviewed behavioral research.

Volatile versions, prices, tax thresholds and store policies must be re-checked immediately before implementation/release.

## Findings translated into design

### Financial outcome

Consumer financial well-being research consistently frames the outcome as day-to-day control, ability to absorb shocks, being on track and freedom of choice. Folio therefore optimises for clarity/confidence rather than a synthetic “health score.”

### Guidance/advice boundary

UK FCA material shows that personalised opinions guiding action, including advice on liquidating consumer-credit debts, can cross regulated boundaries. Folio uses neutral simulation, factual comparison and user-selected rules. Legal review is still required; wording alone is not a complete compliance strategy.

### Local-first

Local-first architecture allows reads/writes without another computer being available. This supports Folio's trust and offline promise. SQLite is appropriate for device-local authoritative state, while sync is an optional layer.

### Security

Financial records and keys require protected local storage, current cryptography, secure network handling and privacy controls. OWASP MASVS provides the mobile verification baseline. Apple Keychain/Secure Enclave and Android Keystore are the appropriate platform roots for key protection.

### Recovery

Platform/account authentication is not equivalent to recovering an end-to-end encrypted vault. Folio therefore separates account authentication from a user-controlled vault recovery mechanism.

### Permissions

Apple/Android guidance favours contextual, just-in-time requests. Folio does not request bank, camera, microphone, notifications or calendar access on first launch.

### Calendar/background execution

Mobile background execution is not exact. Folio stores an internal calendar and schedules local notifications when records change rather than depending on a future precise background wake.

### Open Banking

UK standards group account information into permissions and require explicit, understandable consent. Scope is constrained by bank/provider capabilities. Folio uses a regulated provider adapter initially and exposes consent/revocation state.

### Business/tax

UK MTD requirements began phased mandation in April 2026 and continue to change by threshold/year. Business tax logic must be versioned, sourced and separate. Direct filing requires dedicated HMRC integration/compliance.

### AI

On-device language models are increasingly available but not universal; cloud model pricing and lifecycles change quickly. A provider registry plus deterministic fallback prevents lock-in. Low-cost cloud text at modest usage can remain inexpensive, but documents/audio/grounding require separate budgeting.

### Gamification

Self-determination research supports motivation when experiences strengthen autonomy and competence. Folio rewards real understanding/progress and lets users control the tone; it avoids loss-aversion/guilt mechanics.

### Accessibility/privacy

Mobile platform and WCAG guidance support accessible native controls, large text, screen-reader paths and reduced motion. ICO guidance requires privacy by design and a DPIA where processing is likely high risk. Folio keeps sensitive telemetry local/minimised and makes cloud processing explicit.

### App stores

Apple and Google require accurate privacy/financial declarations and account deletion when accounts exist. Local core without login aligns with user trust and reduces unnecessary collection.

## Chosen architecture versus alternatives

### Chosen: encrypted SQLite authoritative locally

Rejected as default:

- cloud database authoritative: breaks offline/trust promise;
- browser storage: weaker mobile durability/security and not native-first;
- unencrypted local JSON: unsuitable sensitivity/scale;
- model-generated state: non-deterministic and unsafe.

### Chosen: event/fact/expectation separation

Rejected:

- treating recurring bills as transactions before they happen;
- one mutable row that changes from prediction to actual;
- dashboard aggregates without provenance.

### Chosen: typed proposal/review

Rejected:

- agent writes directly to database;
- chat transcript as application state;
- silent auto-categorisation of tax-relevant records.

### Chosen: separate business workspace

Rejected:

- business filter over a mixed ledger;
- combined tax/reporting views;
- shared Melo memory without scope.

### Chosen: optional plans

Rejected:

- compulsory goals/personality questionnaires;
- fixed one-size-fits-all debt journey;
- “failed plan” verdicts.

## Known uncertainties

- Native database/Expo compatibility must be proven by spike.
- Exact cloud sync implementation deserves cryptographic review.
- Advice boundary and business/tax claims require UK legal counsel.
- First-minute entertainment/value needs usability testing, not desk research alone.
- Retention/personalisation must be validated without coercion.
- Open Banking provider quality/cost requires procurement testing.
- Business scope should follow demand while preserving architecture.

---


# Part 30: Requirements Traceability

_Source: `29_REQUIREMENTS_TRACEABILITY.md`_

## Requirements Traceability

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

---


# Part 31: Implementation Research Coverage

_Source: `30_IMPLEMENTATION_RESEARCH_COVERAGE.md`_

## Implementation Research Coverage

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

---


# Part 32: Folio V2 — One-Page Architecture

_Source: `architecture/ONE_PAGE_ARCHITECTURE.md`_

## Folio V2 — One-Page Architecture

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

---


# Part 33: Architecture Decision Records

_Source: `architecture/ARCHITECTURE_DECISION_RECORDS.md`_

## Architecture Decision Records

## ADR-001: Greenfield repository

**Decision:** Build V2 in a new repository. V1 is donor material only.  
**Why:** Prevent architectural anchoring and patching.  
**Consequence:** Existing users migrate through an import adapter.

## ADR-002: Local encrypted database is authoritative

**Decision:** Every core read/write goes to the on-device encrypted SQLite vault.  
**Why:** Offline availability, latency, ownership and privacy.  
**Consequence:** Sync is a replicated optional service, not the source of truth.

## ADR-003: Facts, expectations and hypotheticals are separate

**Decision:** Posted transactions never become forecast rules and scenarios never mutate facts.  
**Why:** Explainability and correction safety.  
**Consequence:** Derived views reconcile related entities.

## ADR-004: Typed commands and proposals

**Decision:** All writes use commands; Melo/AI/imports create typed proposals.  
**Why:** Auditability, invariants and no agent direct writes.  
**Consequence:** More initial structure, much lower long-term risk.

## ADR-005: Personal/business workspace isolation

**Decision:** Shared engines, isolated data/context/navigation/reporting/keys.  
**Why:** Tax accuracy and user clarity.  
**Consequence:** Cross-workspace transfers are explicit linked movements.

## ADR-006: AI optional and provider-agnostic

**Decision:** Deterministic templates first; on-device/cloud models through registry.  
**Why:** Offline promise, cost control and model lifecycle volatility.  
**Consequence:** Every AI task has a manual fallback and evaluation contract.

## ADR-007: Authentication separate from vault recovery

**Decision:** Apple/Google/passkey login cannot be the only decryption recovery path.  
**Why:** Authentication does not recreate a zero-knowledge key.  
**Consequence:** Recovery code/passphrase/device-transfer UX is required.

## ADR-008: Internal calendar first

**Decision:** Folio stores its own calendar; system calendar integration is optional and scoped.  
**Why:** Offline consistency and permission minimisation.  
**Consequence:** Local notification scheduling occurs when facts change.

## ADR-009: Business tax filing is a later compliance module

**Decision:** Launch with preparation/export, not direct HMRC filing.  
**Why:** Filing has separate API, legal and operational obligations.  
**Consequence:** Tax records include provenance and policy-pack versions from day one.

## ADR-010: No dashboard as primary shell

**Decision:** Today briefing/Melo/timeline/calendar form the primary experience.  
**Why:** Users seek answers and progress, not widget interpretation.  
**Consequence:** Analytical dashboards are optional deeper views.

## ADR-011: Mobile background execution is non-authoritative

**Decision:** Correctness never depends on an exact future background wake.  
**Why:** iOS/Android schedule opportunistically.  
**Consequence:** Persist jobs, schedule notifications ahead and refresh on foreground.

## ADR-012: Monetisation is capability-based

**Decision:** Domain records do not know price tiers. Entitlements map products to optional capabilities.  
**Why:** Business model is not yet locked and users must retain access to their data.  
**Consequence:** Subscription lapse reduces service convenience, not ownership.

---


# Part 34: Data Flow and Trust Boundaries

_Source: `architecture/DATA_FLOW_AND_TRUST_BOUNDARIES.md`_

## Data Flow and Trust Boundaries

```text
[User / selected files / optional bank provider]
                    |
                    v
      [staging + provenance on device]
                    |
             user review/command
                    |
                    v
      [encrypted authoritative SQLite]
       |       |        |        |
       v       v        v        v
    events  forecast  search   calendar
       \       |        |       /
        \      v        v      /
          [Today + Melo + views]
                    |
      optional encrypted/limited routes
        /             |               \
[cloud vault]    [AI gateway]    [bank adapter]
opaque blobs     minimal context    regulated token
```

## Trust boundaries

1. **Device vault boundary** — decrypted financial content exists only while the local vault is unlocked.
2. **Native key boundary** — root wrapping key is held by Keychain/Keystore, not JavaScript storage.
3. **Cloud vault boundary** — server stores ciphertext and minimum routing metadata.
4. **AI boundary** — receives a typed, minimised task, never vault access.
5. **Open Banking boundary** — regulated provider tokens stay in the secure backend adapter; canonical rows are staged locally.
6. **Workspace boundary** — personal and each business workspace have explicit scope and separate subkeys.
7. **Document boundary** — file content is untrusted evidence, not executable/model instruction.

## Write authority

Only the local command handler can commit domain changes. Sync, imports and Melo all submit commands/proposals through the same invariants.

---


# Part 35: First-Minute Prototype

_Source: `examples/FIRST_MINUTE_PROTOTYPE.md`_

## First-Minute Prototype

## Objective

Within 60 seconds, a new user should understand what Folio feels like and either receive a truthful small answer or see a clearly labelled interactive preview. No account, permission, bank connection or full setup is required.

## 0–8 seconds: emotional safety

Screen:

```text
Melo
Money can feel like a lot.
We’ll start with only what helps right now.
```

Primary action: **Show me how Folio works**  
Secondary: **I already have something to add**  
Tertiary: **Explore privately**

Persistent trust note: “Your core records stay on this device unless you choose cloud features.”

## 8–25 seconds: choose value path, not user type

### Path A — Interactive preview

A labelled sample Today screen animates through:

- payday arrives;
- rent is reserved;
- one debt payment completes;
- a small unexpected cost changes the plan;
- Melo explains what changed and what remains covered.

The preview uses fictional data, carries a visible “Example” badge and cannot be mistaken for the user’s position.

### Path B — One real question

Prompt: “What do you want clarity on right now?”

Quick choices:

- Until my next payday
- A payment or purchase
- A debt balance
- What is due next
- Something changed

The chosen task asks no more than the minimum required information and produces a partial result with assumptions.

### Path C — Bring data

Choices:

- Bank statement/file
- Photo or PDF
- Add one payment manually
- Open Banking later

Only after selecting a source does Folio explain and request the necessary permission.

## 25–50 seconds: visible progress while importing

Importing should feel alive without fabricating completion:

```text
Reading 326 rows
Found 4 likely income payments
Found 9 repeating payments
3 items need your review
Building your first timeline
```

Melo can reveal one safe insight as soon as confidence is sufficient. The user can continue exploring while the import job runs and resumes after interruption.

## 50–60 seconds: first value

Real-data example:

```text
Here’s what Folio can confirm so far
£585 arrived on Friday
Rent usually appears near the 10th
Two payments repeat monthly

Before I treat those as future commitments, review these 3 items.
```

Minimal-data example:

```text
Based on the £220 you entered and the £95 payment before Friday,
you have £125 before other unlisted spending.
This is a partial view—not your full financial position.
```

## Entertainment principles

- Melo reacts visually to meaningful progress.
- Import steps reveal understandable discoveries.
- One optional tap-through scenario shows the product’s power.
- No fake loading, fake personalised insight, guilt or forced game.
- The user can skip animations and reduced-motion settings are respected.

## First-minute acceptance tests

- no sign-up wall;
- no permissions on launch;
- no compulsory goal/personality/business questionnaire;
- a path to value in two taps;
- example data unmistakably labelled;
- at least one route works fully offline;
- screen-reader and large-text path complete;
- every partial answer states missing scope;
- user can leave and return without losing imported staging progress.

---


# Part 36: Melo Conversation Contracts

_Source: `examples/MELO_CONVERSATION_CONTRACTS.md`_

## Melo Conversation Contracts

These examples define behavior, not final copy. Exact phrasing can evolve, but the purpose, stop conditions, advice boundary and review controls are normative.

## Contract anatomy

Each Melo task declares:

- user end goal;
- data already available;
- missing slots that are truly required;
- maximum questions;
- deterministic tool/result used;
- proposal or answer type;
- stop condition;
- allowed and forbidden language.

## 1. First launch with no data

**Melo:** “Let’s make this useful without making you fill in your whole life. Try a quick example, add one important payment, or bring in a statement.”

Choices:

- See a labelled example
- Add what is happening next
- Import a statement
- Explore first

Melo does not ask income, debt, goals and permissions in sequence. A selected path determines the next single question.

## 2. Minimal real answer

**User:** “I need to know if I’m okay until Friday.”

**Known:** no financial data.

**Melo:** “I can work that out with the two numbers that matter most right now. Roughly how much money can you use today?”

**User:** “£220.”

**Melo:** “What important payment or essential spending still has to happen before Friday?”

After answer, Melo calculates a clearly labelled partial view and states what is not included. It stops after two questions.

## 3. Extra debt payment scenario

**User:** “What happens if I pay £200 off the card?”

Melo calls the deterministic scenario engine and returns:

> “With the information currently in Folio, a £200 payment today would move your lowest projected balance to £74 on 26 June. Rent and the card minimum remain covered; the £100 reserve you chose would not. This uses confirmed income only.”

Actions:

- Compare another amount
- Review assumptions
- Save as a plan change
- Close

Forbidden: “You should pay £X” or “£X is the best amount.”

## 4. Higher rent actual

**Melo:** “Rent posted at £738, which is £3 above the £735 you usually expect. What happened?”

Choices:

- New regular amount
- One-off fee or late charge
- Wrong match
- I’m not sure

After selection, Melo updates only the relevant expectation/proposal. It never alters the posted transaction.

## 5. Bad month / unexpected repair

**User:** “My car has cost me £420 unexpectedly.”

Melo captures the event and shows a review card before committing. After acceptance:

> “Okay—your position has changed, but the next rent payment is still covered. Your buffer falls from £500 to £80 and the debt-plan date moves from 18 October to a current range of 8–22 November. I’ve prepared an updated path for you to review.”

Tone: calm, factual, hopeful because there is visibility—not because the situation is minimised.

## 6. Optional plan creation

**User:** “I want £1,000 saved by December.”

Melo asks only the missing information needed to model it, then offers configurable rules:

- flexible or fixed date;
- minimum reserve that cannot be used;
- contribution rhythm;
- priority relative to other plans;
- preferred tone: gentle, balanced, accountability.

The result is a proposal. The user edits and accepts it.

## 7. Plan falls behind

**Melo:** “This plan is £65 behind the previous path because income was lower and the repair was added. The goal is unchanged. Keeping the date would require a higher contribution; keeping the current contribution moves the estimated date by about three weeks. Which version would you like to review?”

No “failed,” red punishment screen or loss of streak.

## 8. Proactive morning briefing

Melo may surface one primary item and a compact secondary summary:

> “Morning. You’re still on track through Friday. Car insurance is the next large payment, and yesterday’s card payment moved the balance below £500.”

If nothing changed:

> “Nothing needs your attention today. Your next planned check is Friday.”

Quiet is a valid outcome.

## 9. Business workspace invoice

**Context:** Business workspace only.

**Melo:** “Invoice 014 is due tomorrow and is still marked unpaid. Has it arrived, should I remind you, or leave it alone?”

It cannot retrieve personal obligations or use personal funds in the answer unless the user initiates an explicit cross-workspace scenario.

## 10. Tax preparation boundary

Allowed:

> “These are the transactions currently tagged for the 2026–27 tax period. Seven still need review, and three lack receipt evidence.”

Forbidden:

> “Your final tax bill is definitely £X” or “You should claim this expense.”

## 11. Memory correction

**User:** “That wasn’t salary; it was a refund.”

Melo responds briefly, creates a correction proposal, and after acceptance re-runs affected projections. It does not defend the previous inference.

## 12. Question limit reached

After the configured question limit:

> “I can give you a partial answer now, or you can review the missing items manually. I won’t keep asking.”

## 13. Tone modes

The same deterministic result can be expressed as:

**Gentle:** “This month became tighter after the repair. Rent is still covered, and we can work from the updated position.”

**Balanced:** “The repair reduces the buffer to £80 and moves the current plan range by around three weeks. Rent remains covered.”

**Accountability:** “The plan changed by three weeks. Review the new contribution/date trade-off today so the plan reflects reality.”

None may shame, exaggerate, alter the numbers or imply certainty beyond the evidence.

---


# Part 37: Reference Algorithms

_Source: `examples/REFERENCE_ALGORITHMS.md`_

## Reference Algorithms

These are normative pseudocode contracts. Production code may use different structures, but it must preserve the behavior and pass the supplied vectors.

## 1. Forecast construction

```text
buildForecast(workspaceId, asOf, horizon, mode):
  assert workspace accessible
  facts = load accepted posted transactions, confirmed balance observations,
          accepted calendar events and explicit user adjustments
  expectations = expand obligations, income streams, recurring rules,
                 debt minimums, budget reservations and accepted plan commitments
  replacements = reconcile pending→posted, reversals, refunds and superseded expectations

  startingPosition = choose latest confirmed balance per included account at/before asOf
  events = normalise facts + surviving expectations + scenario changes
  events = filter by workspace, horizon, account inclusion and certainty mode
  events = sort by:
      effective instant/local-date policy,
      fact precedence,
      protected-outflow precedence,
      stable event id

  position = startingPosition
  for event in events:
      position += signed amount converted only when a confirmed rate exists
      append point(position, event, provenance, certainty)

  calculate protected obligations, lowest projected position, risk dates,
            budget remaining, debt/plan effects and explanatory ledger
  persist only as derived snapshot with input revision hash
  return immutable forecast
```

### Forecast modes

- **Confirmed:** posted/confirmed facts only.
- **Expected:** confirmed plus accepted recurring expectations and conservative income.
- **Planning:** expected plus user-selected plan commitments.
- **Scenario:** planning plus temporary hypothetical changes; never committed by default.

Never blend modes without a visible label.

## 2. Actual-versus-expected reconciliation

```text
reconcileActual(transaction):
  candidates = expectations in same workspace/account/date window
  score candidates by explicit provider reference, user rule, amount proximity,
                      normalized counterparty/reference and recurrence date
  if one high-confidence candidate:
      link transaction to expectation
      mark occurrence satisfied by actual; do not mutate recurring template
      if amount differs materially:
          create bounded clarification proposal:
            one-off | fee/late payment | new recurring amount | wrong match
  else:
      create review candidate; never silently merge tax-relevant/business rows
```

The posted transaction remains the truth even if the user keeps the old recurring expectation for future periods.

## 3. Safe discretionary boundary

“Safe-to-spend” is a calculation label, not permission or advice.

```text
maxDiscretionarySpend(baseForecast, proposedDate, protectedFloor):
  low = 0
  high = liquid funds available under selected account policy
  while high - low > 1 minor unit:
      mid = floor((low + high) / 2)
      trial = insert hypothetical outflow(mid, proposedDate)
      if all protected obligations remain funded and
         minimum projected position >= protectedFloor:
          low = mid
      else:
          high = mid - 1
  return low with binding constraint, date, assumptions and uncertainty
```

It must show which obligation/floor becomes binding. Unconfirmed income does not rescue a conservative result unless the user explicitly selects a scenario containing it.

## 4. Payday allocation preview

```text
previewAllocation(incomeEvent, userRules):
  buckets = ordered by user-approved rules, never product recommendation:
    arrears/negative account risks
    protected obligations before next reliable income
    essential variable allowance
    minimum debt obligations
    chosen reserve floor
    sinking funds/annual obligations
    optional plan contributions
    unallocated remainder
  allocate while preserving account/date constraints
  return comparison and editable proposal
```

The user can change the order or amounts. Melo explains consequences, not a “best” choice.

## 5. Plan rebase

```text
rebasePlan(plan, changedFacts):
  oldVersion = current accepted plan version
  recompute available contributions from the new forecast
  apply user rules: minimum contribution, protected floor, deadline rigidity,
                    priority, pause behavior and accountability tone
  calculate new dates/milestones
  create proposed plan version with diff:
      what changed
      why it changed
      what remains unchanged
      new path/range
  require review for material changes; auto-refresh non-material display projections
  never mark the person as failed
```

## 6. Unexpected event cascade

```text
acceptUnexpectedEvent(event):
  atomic command:
    store event/fact and audit entry
    invalidate affected forecast/budget/plan/calendar/briefing projections
  rebuild in dependency order
  generate recovery briefing:
    fact
    immediate effect
    protected items still covered
    changed dates/amounts
    reviewable options or updated plan proposal
```

## 7. Melo intervention ranking

```text
rankCandidates(candidates, userPreferences, currentContext):
  discard suppressed, stale, duplicate, low-confidence or quiet-hour candidates
  score = urgency + financial consequence + user-requested relevance
          + active-plan relevance + novelty + confidence
          - anxiety cost - repetition - interruption cost
  apply caps per day and per topic
  prefer one clear intervention over a stack of cards
  if no candidate clears threshold: remain quiet
```

Tone preference can change wording and accountability intensity, never calculations or truth.

## 8. Bounded Melo questioning

```text
runIntent(intent):
  define endGoal, requiredSlots, optionalSlots, maxQuestions(default 3)
  use existing confirmed data first
  ask one high-information question only when it unlocks the endGoal
  after maxQuestions or user stop:
      produce best partial result with visible unknowns
      offer structured manual review
  never start an unrelated discovery thread
```

## 9. Import atomicity

```text
importFile(file):
  hash original bytes
  if exact source already committed: show duplicate result
  create staging job
  parse/normalise rows streaming; retain source lineage
  run malicious content guards, locale/date/sign checks, dedupe and reconciliation
  present questions/review summary
  on user commit:
      one atomic transaction writes accepted rows, provenance, audit and outbox
  on crash/cancel:
      authoritative ledger remains unchanged; staging resumes or is discarded
```

## 10. Transfer detection

A transfer proposal requires opposite signs, matching currency/amount (or explicit FX evidence), compatible dates and accounts controlled by the same user/workspace. It is never automatically treated as spending. Auto-link only when provider IDs or an accepted rule make the match deterministic.

## 11. Debt projection

Debt schedules use integer minor units and rate periods with explicit effective dates. Interest, fees, promotional rates, minimum formulas, statement/due dates and payment allocation order are separate inputs. Unknown lender behavior is labelled rather than guessed. The engine compares scenarios; it does not choose a repayment strategy for the user.

## 12. Search answer grounding

```text
answerSearch(query, workspace):
  parse filters locally
  retrieve only workspace-scoped records and snippets
  return records first
  optional Melo summary cites local record IDs/dates/amounts
  if evidence is insufficient, say so and offer filters
```

## 13. Sync conflict policy

- immutable facts coexist unless proven duplicate/replacement;
- scalar preferences use field-level revision rules and preserve conflict history;
- plans/events edited concurrently create reviewable versions;
- deletes are tombstones;
- financial facts are never silently overwritten by last-write-wins;
- projections rebuild locally after merged accepted facts.

## 14. Workspace isolation

Every command/query requires a workspace ID and authorization scope. Repository APIs have no unscoped list method. Export/search/Melo retrieval fail closed when scope is absent. Cross-workspace movement creates a new record or explicit link; it never changes scope invisibly.

---


# Part 38: Bad-Month Case Study

_Source: `examples/BAD_MONTH_CASE_STUDY.md`_

## Bad-Month Case Study

## Starting position

A user is paid weekly, has £620 available, a protected £500 buffer, rent already reserved, and an accepted debt plan estimated to complete on 18 October.

## Unexpected event

The car requires a £420 repair today.

## Incorrect product response

```text
Budget exceeded.
You failed this month.
Cut spending immediately.
```

This is unhelpful, potentially advice-like and emotionally unsafe.

## Correct Folio flow

### 1. Capture naturally

The user can type or say: “My car has cost £420 unexpectedly.”

Melo extracts a proposed event:

```text
Unexpected car repair
£420 outflow
Today
Personal workspace
Possible category: vehicle repair
```

The user confirms/edits it.

### 2. Recalculate deterministically

Folio commits the transaction/event, rebuilds the forecast, budget availability, plan versions, calendar reminders and briefing candidates.

### 3. Present truth in layers

```text
What changed
Your available cash is £420 lower.

What it affects
The protected buffer falls from £500 to £80.
The current debt-plan range moves from 18 October to 8–22 November.

What is still okay
Rent and all confirmed minimum payments before the next payday remain covered.

What happens next
Your next confirmed payday is Friday.
The updated plan can recover the buffer before resuming the old contribution level.
```

The final line describes the current plan logic or user-selected rule, not an unsolicited recommendation.

### 4. Offer scenario controls

- Keep the target date and compare required contributions.
- Keep current contributions and accept the later range.
- Pause the plan for one cycle.
- Edit the event if details are wrong.
- Leave the plan unchanged for now.

Each option shows consequences. The user chooses.

### 5. Melo accountability

In balanced mode:

> “This is a setback, not a verdict. The important payments are still covered, and the new timeline is visible. Review the plan when you’re ready.”

In accountability mode:

> “The repair changed the plan by roughly three weeks. Review the contribution/date trade-off before Friday so the plan reflects reality.”

## Recovery over time

When the user rebuilds the buffer, Folio marks real milestones:

- unexpected event recorded rather than avoided;
- essential obligations remained covered;
- buffer restored;
- plan resumed;
- final goal achieved.

The annual timeline then becomes proof of resilience rather than a list of red numbers.

---


# Part 39: Legal and Regulatory Review Checklist

_Source: `release/LEGAL_AND_REGULATORY_REVIEW_CHECKLIST.md`_

## Legal and Regulatory Review Checklist

This is an implementation gate, not legal advice. Obtain qualified UK legal/compliance review before public release and whenever the product crosses a trigger below.

## 1. Product perimeter

Confirm every user-facing capability is classified as one of:

- factual record/organisation;
- deterministic calculation;
- forecast under stated assumptions;
- neutral scenario comparison;
- general educational guidance;
- regulated/potentially regulated activity.

Block release if copy or logic presents a personalised financial action, debt liquidation method, credit/investment/product choice or tax treatment as the right/best course without the required regulatory basis.

## 2. Advice-language review

Test all static copy, templates, AI prompts, notifications and generated explanations against `schemas/advice_language_policy.json`.

Review especially:

- debt repayment comparisons;
- “safe-to-spend” terminology;
- arrears/default messaging;
- credit products/refinancing;
- investments/pensions/insurance;
- business deductions/tax estimates;
- crisis/vulnerability flows.

Required pattern: fact → assumptions → consequence → user choice.

## 3. Consumer credit/debt

Before shipping debt features:

- document why each flow is tracking/simulation rather than debt counselling;
- review user-selected snowball/avalanche/custom rules;
- ensure Folio does not select a strategy for the user;
- add appropriate signposting for serious debt difficulty;
- create escalation controls for arrears, court action, insolvency and creditor correspondence;
- review whether any human support or model interaction changes the perimeter.

## 4. Open Banking

Before connecting live accounts:

- use an authorised/registered provider or obtain the required status;
- map requested permissions to explicit user value;
- present provider/bank scope accurately;
- record consent, expiry, revocation and last successful refresh;
- stop access promptly on revocation;
- handle stale/gapped feeds visibly;
- complete provider security, incident and data-processing reviews;
- ensure store disclosures match actual access.

## 5. Payments and money movement

Folio V2 initially does not initiate payments or hold client money. Adding either triggers a new programme covering regulatory permissions, strong customer authentication, fraud controls, safeguarding, disputes, refunds and operational resilience.

## 6. Tax/business

Before public tax claims:

- label calculations as estimates/preparation unless verified submission workflow exists;
- version policy packs by jurisdiction/effective date/source;
- retain source and rule version in every calculation/export;
- isolate personal and business data;
- test late/reversal/foreign-currency/partial-payment cases;
- review Making Tax Digital and HMRC API obligations at implementation date;
- block direct filing until dedicated HMRC conformance and legal gates pass.

## 7. Data protection

Complete and approve a DPIA before cloud sync, Open Banking, cloud AI, document extraction or behavioural personalisation.

Verify:

- lawful basis per processing purpose;
- data minimisation and retention;
- processor/subprocessor contracts;
- international transfers;
- privacy notice and just-in-time notices;
- access/export/erasure/correction workflows;
- sensitive inferences and profiling controls;
- children/age strategy;
- breach response and notification process;
- user-controlled memory and cloud deletion.

## 8. AI and automated processing

- AI is not the financial decision-maker.
- No solely automated legally/significantly impactful decision.
- Model providers may not train on user data without separate explicit opt-in.
- Prompts/context are minimised and scoped.
- AI output is labelled where material and reviewable before writes.
- A deterministic/manual path exists.
- Model/version/policy provenance is recorded.
- Unsafe output incident and rollback procedure exists.

## 9. Consumer protection and marketing

Marketing and in-app claims must not imply:

- guaranteed savings/debt freedom;
- error-free forecasts;
- regulated advice/accounting status;
- complete tax compliance;
- bank-level security without substantiation;
- privacy that the implementation does not deliver;
- “free” features that require hidden data trade-offs.

Pricing, trials, cancellation and feature limits must be clear before purchase.

## 10. Accessibility and vulnerable users

Review whether critical flows are understandable and usable for users under stress, with low literacy/numeracy, disabilities or vulnerability. Provide plain-language recovery and signposting. Never gate urgent record/export access behind engagement or payment mechanics.

## 11. App-store/consumer account obligations

- accurate privacy nutrition/data safety declarations;
- in-app account deletion where required;
- public web deletion route where required;
- subscription cancellation/restore behavior;
- data remains locally accessible/exportable after subscription lapse;
- no forced account for local-only functionality unless justified;
- financial-feature declarations match shipped capabilities.

## 12. Trigger register

Mandatory re-review before adding:

- product recommendations or affiliate financial products;
- debt negotiation/human coaching;
- investments, pensions, insurance or credit scoring;
- payment initiation or money custody;
- direct tax filing;
- household/child accounts;
- employer access;
- sale/licensing of aggregated user data;
- advertising/personalised offers;
- new countries/jurisdictions;
- AI actions without user review.

## Sign-off record

For each release record reviewer, scope, date, evidence, unresolved items, accepted risk and next review trigger. No checkbox substitutes for legal judgment.

---


# Part 40: Security Test Plan

_Source: `testing/SECURITY_TEST_PLAN.md`_

## Security Test Plan

## Scope

Mobile app, local vault, documents, importers, sync/cloud services, AI gateway, Open Banking adapter, account portal and build/release pipeline.

## Required test classes

### Local data protection

- database cannot open without valid key;
- no key/plaintext financial data in app files, logs, screenshots, clipboard or backups;
- document blobs encrypted independently;
- key wrapping uses Keychain/Keystore and invalidation behavior is handled;
- lock on configured inactivity/background state;
- biometric fallback/recovery paths tested;
- rooted/jailbroken device policy documented without falsely promising prevention.

### Cryptography/recovery

- unique random vault keys;
- subkey derivation and rotation;
- recovery secret KDF parameters benchmarked;
- wrong/reused/revoked recovery material fails safely;
- recovery does not reveal keys to server;
- lost-device revocation and new-device restore drill;
- corrupted/partial backup and rollback handling;
- cryptographic design reviewed by qualified specialist.

### Database and files

- SQL injection and malformed query inputs;
- migration interruption;
- WAL/temporary file encryption verification;
- path traversal/zip bombs/oversized imports;
- malicious CSV formula content;
- PDF/image parser hardening;
- FTS index isolation and secure deletion limitations documented.

### Authentication/session

- account optional for local core;
- token theft/replay/rotation;
- device registration and revocation;
- account enumeration and brute-force controls;
- OAuth redirect/deep-link validation;
- session separation from local vault unlock;
- account deletion does not silently destroy unrecovered local data.

### Sync/cloud

- server cannot decrypt test envelope;
- tenant/user/workspace authorization;
- replay, rollback and duplicate envelope handling;
- conflict/tombstone abuse;
- object-store URL expiry;
- metadata minimisation;
- backup integrity/authenticity;
- cross-device clock/revision attacks;
- service compromise tabletop.

### Workspace isolation

- personal/business repository queries fail closed;
- FTS/Melo/AI retrieval scope;
- export/tax/document/calendar isolation;
- cache, notification and analytics isolation;
- explicit audited cross-workspace movement only.

### AI/OCR/import injection

- prompt injection in statements, receipts and documents;
- model output schema bypass;
- tool/SQL command injection;
- sensitive-context overcollection;
- provider retention/training settings;
- no direct writes;
- quota/rate-limit evasion;
- unsafe advice-language red-team set.

### Network/API

- TLS configuration and certificate validation;
- authorization on every endpoint;
- object-level access control;
- rate limits/abuse controls;
- webhook signatures and replay protection;
- Open Banking token storage/rotation/revocation;
- AI gateway key secrecy;
- secure headers and deletion portal testing.

### Supply chain/build

- dependency/lockfile review;
- secrets scan and signed CI artifacts;
- least-privilege CI credentials;
- SBOM and licence register;
- native module provenance;
- OTA compatibility/native-version gate;
- production debug tooling disabled;
- store signing/release key controls.

## Privacy tests

- network capture proves no undeclared financial telemetry;
- crash reports contain synthetic/sanitised context only;
- diagnostic bundle preview/redaction;
- cloud/AI permissions revocable;
- export and deletion completeness;
- retention jobs verified;
- model-provider deletion tested where applicable.

## Test cadence

- automated security checks every CI run;
- dependency/SAST/secret scans continuously;
- threat-model update per major feature;
- independent mobile/API penetration test before public launch and major cloud/Open Banking changes;
- annual or risk-triggered cryptographic review;
- incident tabletop twice yearly.

## Release blockers

Any critical/high issue affecting confidentiality, integrity, workspace isolation, key recovery, data loss or unauthorised financial action blocks release. Medium issues require owner, compensating control and dated remediation.

---


# Part 41: Accessibility Test Plan

_Source: `testing/ACCESSIBILITY_TEST_PLAN.md`_

## Accessibility Test Plan

## Target

Meet current Apple/Android accessibility expectations and WCAG 2.2 AA principles for applicable mobile content. Accessibility is a release property, not a final audit.

## Critical journeys

Test with VoiceOver and TalkBack:

- first launch and labelled preview;
- create/unlock/recover local vault;
- import/review/commit statement;
- read Today briefing and explanation;
- add/edit transaction/event;
- inspect forecast assumptions;
- create/rebase plan;
- use calendar/planner;
- review/accept/reject Melo proposal;
- export/delete data;
- switch personal/business workspace.

## Visual and text

- dynamic type/large font without clipping or hidden actions;
- text reflow and landscape where supported;
- sufficient contrast;
- status never communicated by colour alone;
- charts include textual summaries and data tables;
- currency/date signs read unambiguously;
- content remains usable with bold text and increased contrast.

## Interaction

- minimum touch target sizes;
- logical focus order and focus restoration;
- labelled controls, headings and landmarks;
- no gesture-only action;
- destructive/financial actions require accessible confirmation;
- time limits avoidable/extendable;
- keyboard/switch-control path where platform supports it.

## Motion/audio/haptics

- reduced-motion mode replaces non-essential movement;
- no flashing content;
- haptics never sole signal;
- audio/voice has text alternative;
- Melo animations do not block content or focus;
- mini-games have non-game alternative and no required dexterity.

## Cognitive/numeracy safety

- plain language;
- one primary action per step;
- explain abbreviations and financial terms;
- chunk complex calculations with provenance;
- known/expected/uncertain labels are consistent;
- errors explain recovery, not blame;
- no forced rapid decisions;
- user can review before commit.

## Automation and manual coverage

Use static linting/component tests for labels/roles/contrast where possible, but require real-device assistive technology testing. Include disabled and financially stressed users in usability studies with appropriate safeguarding and compensation.

## Acceptance

No critical journey may depend on sight, colour, precise gesture, hearing, animation or cloud AI. Accessibility regressions block release.

---


# Part 42: Single-Agent Execution Prompt — Folio V2 Greenfield

_Source: `agent/SINGLE_AGENT_EXECUTION_PROMPT.md`_

## Single-Agent Execution Prompt — Folio V2 Greenfield

You are the lead product engineer and implementation orchestrator for Folio V2. Your task is to build the destination specified in this package from a clean repository.

## Absolute greenfield rule

Create a new repository. Do not begin in Folio V1. Do not patch, extend, rename, migrate or “modernise” the V1 application and call it V2.

Folio V1 is donor/reference material only. You may inspect it only through the protocol in `26_V1_DONOR_AUDIT_PROTOCOL.md`, after the new repository, architecture boundaries and baseline tests exist. No V1 runtime dependency, database, route/state architecture or implicit product assumption is allowed into V2 without an approved donor record.

## Read before acting

Read the package in this order:

1. `00_START_HERE.md`
2. `01_GREENFIELD_AGENT_DIRECTIVE.md`
3. `02_PRODUCT_CONSTITUTION.md`
4. `03_SCOPE_AND_BOUNDARIES.md`
5. `04_EXPERIENCE_BLUEPRINT.md`
6. `05_FIRST_60_SECONDS.md`
7. `06_MELO_SYSTEM.md`
8. `07_PERSONAL_AND_BUSINESS_WORKSPACES.md`
9. `08_FINANCIAL_TRUTH_AND_EVENT_MODEL.md`
10. `09_PLANS_BUDGETS_AND_FORECASTING.md`
11. `10_CALENDAR_AND_PLANNER.md`
12. all remaining root documents;
13. `architecture/`, `schemas/`, `testing/`, `release/`, `examples/`;
14. `backlog/implementation_backlog.csv` and `backlog/risk_register.csv`;
15. this prompt again.

State in your first implementation record that you read them. Do not substitute a short summary for the normative files.

## Product to build

Folio is a mobile-first, local-first, cloud-enhanced financial clarity and confidence system. It helps people understand where they stand, what changed, what happens next and how their plans are affected. It does not act as a financial adviser.

The default experience is a human, simple hybrid of:

- Melo and Today’s briefing;
- current position and remaining budget;
- timeline/events/transactions;
- money-aware calendar/planner;
- optional plans and visible real progress;
- search and financial memory.

It is not a dashboard grid, spreadsheet, compulsory chat, onboarding interrogation or AI-controlled finance system.

## Non-negotiable architecture

```text
accessible mobile UI
→ typed application commands/queries
→ pure deterministic domain engines
→ repository interfaces
→ encrypted local SQLite source of truth

optional adapters:
encrypted cloud | AI | Open Banking | OCR/voice | system calendar | notifications | billing
```

Requirements:

- TypeScript strict.
- Money as integer minor units plus currency.
- Dates/instants/time zones modelled explicitly.
- Pure engines import no React Native, Expo, SQLite, AI or provider SDK.
- All writes use typed commands.
- Melo, imports, OCR, AI and sync create proposals or commands; never direct SQL writes.
- Authoritative facts are separate from expectations and derived projections.
- Actual posted transactions outrank expectations without mutating recurring templates.
- Every forecast result contains assumptions, provenance and certainty.
- Personal and business workspace boundaries exist in schema/repositories/keys before business UI.
- Core works with network, account, bank and model disabled.
- Cloud account authentication is separate from vault-key recovery.
- Financial content is excluded from telemetry by default.

Use `schemas/database.sql`, JSON policies and OpenAPI as contracts. When implementation and contract disagree, fix implementation or propose a versioned contract change with an ADR; do not silently diverge.

## Technology direction

Start with the reference stack in `21_TECHNICAL_ARCHITECTURE.md`, but freeze current compatible versions at implementation time. Use an Expo development build, not Expo Go. Run the mandatory database/crypto/FTS native spike before product feature work. If the proposed database driver fails, preserve the `DatabaseDriver` contract and select a maintained alternative based on evidence.

## Build order

Follow `25_COMPLETE_BUILD_SEQUENCE_AND_ACCEPTANCE.md` and the task dependencies in `backlog/implementation_backlog.csv`.

Do not jump to cloud AI, Open Banking, tax filing or business UI because they look impressive. Prove the local deterministic product first.

### Phase discipline

For each phase:

1. select only unblocked tasks;
2. describe the intended slice and risks;
3. implement contracts first;
4. run tests and validation;
5. produce evidence in the format in `agent/AGENT_CHECKPOINTS.md`;
6. update ADR/decision/risk records;
7. do not mark complete with failing release-blocking criteria.

## UX rules

- Home is Today, not a widget dashboard.
- Melo is always present as a character/personality, but users do not have to chat.
- No compulsory goal, financial personality, business or bank questionnaire.
- Use creates setup.
- First launch requests no permission and no account.
- First value or clearly labelled interactive preview within 60 seconds.
- Ask one meaningful question at a time and stop after three by default.
- Questions must have an explicit end goal.
- Every Melo-generated change has review/edit/accept/reject controls.
- Bad months show truth, effect, what remains stable and a path forward.
- Plans rebase; people do not “fail.”
- Tone modes alter wording/accountability, never calculations.
- Quiet is valid; do not manufacture engagement.
- No shame, guilt streaks, leaderboards or fake universal scores.
- Make progress enjoyable through meaningful milestones, animation and optional small experiences with reduced-motion/non-game alternatives.

## Advice and tax boundaries

Use consequence language:

- “If you do X, Y changes under these assumptions.”
- “This option leaves Z covered.”

Do not say:

- “You should do X.”
- “This is the best choice for you.”
- “This is definitely your final tax position.”

Run generated/static content through `schemas/advice_language_policy.json`. Debt, tax, credit, investment, insurance and financial-product features require the gates in `release/LEGAL_AND_REGULATORY_REVIEW_CHECKLIST.md`.

## AI rules

AI is optional. Route in this order:

1. deterministic templates/rules;
2. supported on-device model;
3. low-cost cloud model;
4. stronger explicit cloud route;
5. structured/manual fallback.

All model inputs are minimised and workspace-scoped. All outputs are schema validated. Models never calculate authoritative financial outputs or write records. The app remains complete with AI disabled. Implement quotas only for cloud convenience, not core calculations.

## Data/sync/recovery rules

- Local encrypted database is authoritative.
- Sync uses encrypted envelopes, outbox/inbox and explicit conflict policy.
- Server must not need financial plaintext to sync.
- Account login alone is not the recovery key.
- Test lost-device recovery, revocation, corruption and multi-device conflicts.
- Users can fully export and delete their data.
- Subscription lapse cannot hide local data or export.

## V1 donor use

Before using any V1 item, record:

- path/screenshot/asset;
- category: reuse, adapt, reference, reject;
- why it fits V2;
- domain coupling/licence/provenance;
- approval;
- new V2 destination.

Prefer visual assets and isolated design primitives. Reimplement coupled components cleanly. Never copy the V1 database, navigation or old dashboard merely to save time.

## Test contract

At minimum:

- all JSON/YAML/SQL contracts validate;
- all forecast/import vectors pass;
- property tests cover arithmetic and invariants;
- SQLite migrations/crash/idempotency/FTS pass;
- offline end-to-end flows pass;
- VoiceOver/TalkBack critical paths pass;
- personal/business isolation passes;
- unsafe-advice and AI faithfulness evaluations pass;
- encrypted backup/restore and lost-device drills pass before cloud launch;
- store/privacy declarations match runtime behavior.

A calculation defect becomes a regression vector.

## Decision behavior

Do not ask the founder to decide ordinary reversible engineering choices. Make the choice that best preserves local ownership, determinism, clarity, accessibility and reversibility, then record an ADR.

Do not invent product direction where `27_DECISION_LOG_AND_OPEN_SIGNOFFS.md` says founder sign-off is required. Implement a seam/development default and record the unresolved decision.

## Required outputs during implementation

Maintain in the new repository:

- `STATUS.md` with current phase/tasks, evidence and blockers;
- `docs/adr/`;
- `docs/v1-donor-audit/`;
- `docs/release-evidence/`;
- generated schema/API documentation;
- synthetic demo data only;
- test and coverage reports;
- dependency/licence/SBOM records;
- privacy/security decision records.

## Definition of success

The implementation succeeds when a user can, entirely offline and without an account or AI:

1. open Folio and understand the experience immediately;
2. import or add minimal information without an inquisition;
3. see a truthful Today briefing, timeline and calendar;
4. understand current position, what changed and what happens next;
5. explore a financial consequence with transparent assumptions;
6. create or adapt an optional plan;
7. experience Melo as a calm, useful accountability presence;
8. recover from an unexpected event without shame;
9. search/export/restore their financial memory;
10. trust that personal and business worlds cannot mix.

Begin with Phase 0. Do not code the home screen first. Prove the new repository and architectural boundaries, then execute the backlog in order.

---
