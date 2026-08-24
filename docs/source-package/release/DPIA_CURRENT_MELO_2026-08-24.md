# Melo DPIA — engineering-current package (24 August 2026)

## Decision status

**Engineering complete as a factual release package. Legal/privacy owner approval is required before
public distribution.** This document does not invent a lawful-basis decision, processor contract,
legal entity, support address or public policy URL.

## Product and release scope

- Product: Melo, local-first personal-finance organisation and forecasting.
- Android package / iOS bundle: `com.folio.v2.greenfield` (deliberately retained; not an unresolved
  naming decision).
- Current app version: `0.0.1`; Android versionCode `1`.
- Local core: no account required; encrypted SQLCipher state, encrypted retained statement sources,
  local parsing/OCR and deterministic companion reasoning.
- Optional boundaries: Clerk sign-in, Cloud Vault encrypted backup, store billing and redacted
  Sentry diagnostics. Open Banking is disabled in the current candidate and requires a separately
  approved build.
- AI: raw document/chat transport is retired; the optional future gateway accepts enum-only wording
  envelopes and is not used by the current mobile core.
- Out of scope for this release: payment initiation, money custody, investment/product advice, direct
  HMRC filing, household collaboration and additional jurisdictions.

## Data-flow inventory

| Data | Source/purpose | Location/processor | Retention/deletion | Current engineering control | Approval state |
| --- | --- | --- | --- | --- | --- |
| Money records, forecasts, review state | User entry/import and local calculations | Device encrypted SQLCipher database; no processor by default | Until user export/delete/Start fresh | SQLCipher, secure-store key, review-gated writes, local-only default | Engineering complete; legal sign-off required |
| Statement PDF/image/source bytes | User-selected import/capture | Device encrypted source vault; local extraction/OCR | Until user removes retained source or local wipe | Workspace-bound AES-GCM, picker/cache cleanup, no raw AI egress | Engineering complete; format/device review remains external |
| Sign-in identifier/session | Optional account sign-in | Clerk; publishable key in app, secret server-side | Provider/account lifecycle; deletion route must be tested | Optional sign-in, secure token cache, local core works signed out | Production Clerk environment/E2E external |
| Encrypted backup envelope | Optional backup/recovery | Melo Cloudflare Worker/Workers KV; client ciphertext only | User account deletion purges retained generations | Bearer auth, bounded payload, two-generation rotation, delete endpoint | Production binding/restore and processor review external |
| Bank consent/account/transaction data | Not collected by the current candidate; future explicit Open Banking flow | No provider call in current candidate; future Melo adapter then regulated provider | Future build requires disconnect and provider-side revocation path | Current build flag disables route; future build requires server-side provider secrets, scoped workspace keys and review-only candidates | Future provider/legal/DPIA/store decision external |
| Purchase proof/product ID | Optional Full/Live purchase | Google Play and Melo billing Worker | Store lifecycle and entitlement expiry; no card data to Melo | Product allowlist, server signature, pending/invalid rejection, local grace rules | Play listing/sandbox/production verification external |
| Crash diagnostics | Runtime failure | Sentry | Operational retention per owner/provider policy | Free-text/user/extra/breadcrumb redaction; no screenshots/traces/replay | Processor contract/retention/legal approval external |
| Optional enum-only wording request | Future explicit wording feature | Melo gateway/provider only after route enablement | Operational metadata only; no raw user records | Strict schema, placeholder-only fields, raw routes `410`, local fallback | Future feature/provider approval external |

## Necessity and user control

Account creation is not required for local money organisation. External processing is opt-in and
feature-scoped. Every imported row remains a candidate until review. Manual import/export and local
calculation paths continue through cloud, billing, provider and AI outages. Local wipe is separate
from remote account deletion so users do not lose local records accidentally.

## Principal risks and controls

| Risk | Existing control | Residual action/owner |
| --- | --- | --- |
| Lost/stolen/shared device or coercive access | Encrypted local database, secure-store key, app lock/PIN/biometric path, local wipe | Physical device and independent security review — security owner |
| Recovery failure/data loss | Verified backup generations, fail-closed parsing, portable export/restore evidence | Production/cross-device restore proof — cloud/quality owners |
| Provider or cloud breach | Provider isolation, ciphertext-only vault, server-side credentials, redacted diagnostics | Production processor contracts, pen test and incident review — security/privacy owners |
| Bank consent/stale data | Explicit provider flow, status/stale states, review-only candidates, disconnect boundary | Provider-side revocation and regulated legal review — banking/privacy owners |
| Billing fraud/incorrect entitlement | Play proof verification, signed grants, allowlisted product IDs, pending rejection | Real sandbox/license-test and console review — billing/release owners |
| AI inference or unsafe wording | Raw-data egress retired, enum-only future gateway, deterministic local fallback | Independent security/privacy review before enabling any provider route |
| Inaccurate financial/tax output | Assumptions/provenance, user review, no direct filing/product recommendation | Legal/tax review and release copy approval |
| Vulnerable user or accessibility exclusion | Plain-language copy, local no-account path, reduced-motion/source-level controls | Independent accessibility review and participant evidence |

## Processors and sub-processors to confirm

Clerk (optional auth), Cloudflare Workers/KV (optional encrypted backup and billing verification),
Google Play/Apple App Store (store billing), TrueLayer or the approved regulated provider (only if
the separately approved Open Banking build is enabled), and Sentry (redacted crash diagnostics).
The optional AI provider remains disabled for raw user data; any future provider requires a new
processor review and consent disclosure.

## Retention/deletion package

Engineering routes exist for local wipe, Cloud Vault generation deletion, future Open Banking
adapter-index deletion and fail-closed Clerk identity deletion. Open Banking is disabled in the
current candidate, and a future adapter cannot claim bank-side consent revocation without provider
proof. Public web deletion URL, production provider configuration, legal retention exceptions and
signed disposable-account E2E evidence remain external.

## Consultation and sign-off

- Engineering release controller: package assembled 2026-08-24.
- Internal operations tabletop and safe rotation drills: executed/recorded in
  `docs/release-operations/`.
- Independent security review: **not performed; external sign-off required**.
- Independent accessibility review: **not performed; external sign-off required**.
- Legal/privacy/DPO review: **not performed; owner sign-off required**.
- Tax/regulatory/provider review: **not performed; owner/provider sign-off required**.

## Approval fields

- Legal entity: `OWNER INPUT REQUIRED`
- Privacy/DPO owner: `OWNER INPUT REQUIRED`
- Policy URL/contact route: `OWNER INPUT REQUIRED`
- Decision: `REQUIRES LEGAL/PRIVACY OWNER SIGNATURE`
- Review trigger: any new processor, enabled Open Banking production provider, AI/provider route,
  payment/money-movement capability, jurisdiction or materially changed data flow.
