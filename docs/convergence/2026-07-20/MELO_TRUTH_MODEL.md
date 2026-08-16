# Melo Truth Model

Status: canonical terminology for consequential outputs. Features must not invent competing confidence words.

## Rule

Every consequential number, recommendation, forecast, alert, scenario, and companion explanation must carry a truth class, source, freshness, assumptions, and correction path. The LLM may explain truth classes but must not upgrade them.

## Truth classes

| Class | Meaning | Allowed sources | UI treatment | Engine treatment | Safe Range influence | Confidence/freshness | Correction/audit | Decisive Melo speech |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Verified | Cryptographically, provider, statement, or system-verified fact with matching source metadata. | Approved bank feed, parsed statement after review, signed native import, confirmed account balance with source. | Strong source badge, exact timestamp, "verified". | Highest weight; eligible for floor/current position. | Yes. | Expires by source type; stale after provider/import threshold. | Immutable source record plus correction overlay. | Yes, with source. |
| User confirmed | User explicitly reviewed and accepted the fact. | Manual entry, review queue confirmation, edit sheet confirmation, Melo tool confirm. | Confirmed badge, user-editable source line. | High weight; eligible for commitments/current position. | Yes. | Fresh until recurrence/account ageing rules mark stale. | Correction creates new version, keeps prior audit. | Yes, if not stale. |
| Observed | Detected from local behaviour or file parsing but not confirmed. | Parser candidates, recurring pattern detection, local schedule observation. | "Found, not added yet"; never displayed as settled truth. | Can queue review or affect provisional warnings only. | No, except as missing-information pressure indicator. | Short expiry; must be reviewed. | Discard/confirm/edit path required. | No. |
| Inferred | Derived from confirmed/verified facts by deterministic rules. | Forecast engine, recurring schedule derivation, category memory. | "Melo thinks this because" with source breakdown. | Can influence forecasts with explainable dependency graph. | Yes if inputs qualify and uncertainty is shown. | Inherits weakest input freshness. | Correct the underlying fact or rule. | Qualified yes. |
| Estimated | User or engine approximation, not exact. | Quick estimate, rounded manual amount, estimated bill. | Approx marker and range, not exact formatting alone. | Allowed with conservative padding. | Yes only as estimated range input. | Expires sooner than confirmed facts. | Replace with confirmed/verified fact when available. | Only with "about/estimated". |
| Predicted | Future projection from known facts. | Forecast, scenario, payday route, expected recurring date. | Horizon, assumptions, confidence, "expected". | Never stored as historical fact. | Yes as upper/lower range component. | Recomputed on source changes; expires at horizon or stale input. | Forecast-version audit, error after actual. | No exact certainty. |
| Assumed | Placeholder the user has not confirmed but the engine needs. | Onboarding defaults, "usual payday", temporary cadence guess. | Visible assumption chip, one-tap edit. | Conservative only; cannot masquerade as fact. | Yes only with low-confidence display. | Very short expiry; must prompt. | Confirm/edit/delete assumption. | No; must say assumed. |
| Missing | Material information absent. | Null source, unconnected account, absent income/commitment data. | Missing info callout; affected answers dimmed or provisional. | Blocks decisive answers where material. | No; should reduce reliance flag. | N/A. | Ask smallest next question. | No. |
| Stale | Previously known fact past freshness threshold. | Old balance, old provider sync, outdated statement. | Stale badge and last seen time. | Can be used only with stale penalty and conservative boundary. | Limited; must lower confidence. | Threshold defined per fact type. | Refresh, confirm still true, or exclude. | No decisive claim without stale caveat. |
| Contradicted | Two or more material facts conflict. | Balance mismatch, duplicate candidate disagreement, schedule conflict. | Conflict panel with competing sources. | Blocks or splits answer until resolved. | No for decisive Safe Range. | Urgent review state. | User/provider resolution creates audit. | No. |
| Sample/demo | Demonstration data not belonging to the user. | Explicit demo reset only. | Demo watermark and isolated workspace. | Never enters production user truth. | No. | N/A. | Clear demo state. | No. |

## Canonical provenance model

Minimum fields for any material fact:

```ts
type MeloTruthClass =
  | 'verified'
  | 'user_confirmed'
  | 'observed'
  | 'inferred'
  | 'estimated'
  | 'predicted'
  | 'assumed'
  | 'missing'
  | 'stale'
  | 'contradicted'
  | 'sample_demo';

type MeloProvenance = {
  factId: string;
  workspaceId: 'personal' | `business.${string}`;
  truthClass: MeloTruthClass;
  sourceType: string;
  sourceRef: string | null;
  capturedAt: string | null;
  confirmedAt: string | null;
  expiresAt: string | null;
  confidence: 'high' | 'medium' | 'low' | 'blocked';
  assumptions: string[];
  derivedFrom: string[];
  correctionOf: string | null;
};
```

## Current implementation anchors

- Review-before-truth exists in `apps/mobile/src/folio/screens/ReviewScreen.tsx`, `apps/mobile/src/folio/store.ts`, and import candidate flows.
- Melo tool proposals require explicit confirmation in `apps/mobile/src/folio/sheets/MeloChatSheet.tsx`.
- Current state has partial provenance fields (`source`, statement import metadata, account balance timestamps) but no complete Truth Model object. The convergence phase must introduce it without a giant rewrite.
