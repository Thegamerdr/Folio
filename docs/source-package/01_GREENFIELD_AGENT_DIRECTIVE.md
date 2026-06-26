# Greenfield Agent Directive

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
