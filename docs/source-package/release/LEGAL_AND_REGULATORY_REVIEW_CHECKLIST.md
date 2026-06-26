# Legal and Regulatory Review Checklist

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
