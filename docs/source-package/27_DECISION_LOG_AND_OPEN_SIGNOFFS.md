# Decision Log and Open Sign-offs

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
