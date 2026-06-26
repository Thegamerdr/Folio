# AI Architecture, Cost and Limits

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
