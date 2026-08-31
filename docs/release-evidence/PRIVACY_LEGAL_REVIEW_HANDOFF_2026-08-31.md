# Melo privacy and legal review handoff — 31 August 2026

## Decision boundary

Engineering has reconciled the current data-flow package. Legal/privacy approval has not been
performed and is not claimed. This handoff gives the reviewer one current scope and identifies the
few values only the owner or qualified counsel can supply.

## Current release scope

- Local-first personal-finance organisation, budgeting and deterministic forecasts.
- Encrypted SQLCipher state and encrypted retained statement sources remain local by default.
- Optional Clerk sign-in and client-encrypted Cloud Vault backup.
- Optional store purchases using `folio.full`, `folio.live.monthly` and `folio.live.yearly`;
  legacy Plus/Pro IDs are restore-only.
- Redacted Sentry diagnostics; no screenshots, replay, tracing, user fields or financial content.
- Open Banking is disabled in the current Android candidate and has no data flow in this release.
- Raw document/chat/transaction AI egress is retired; the enum-only gateway is future-gated.
- No payment initiation, money custody, investment/product recommendation, direct HMRC filing,
  household collaboration or additional jurisdiction launch.

## Processor and data-flow inventory

| Boundary           | Data leaving device                                 | Trigger/control                              | Deletion/retention truth                                                             |
| ------------------ | --------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Clerk              | Sign-in identifier and session data                 | User chooses sign-in                         | Production identity deletion and provider contract remain external                   |
| Cloud Vault        | Client-encrypted envelope plus operational metadata | User chooses backup after sign-in            | Remote purge is required before identity deletion; production proof remains external |
| Google/Apple store | Product ID and purchase proof                       | User initiates purchase/restore              | Store lifecycle; card details are not sent to Melo                                   |
| Sentry             | Redacted exception/technical context                | Runtime failure                              | Provider retention/contract requires owner/legal confirmation                        |
| TrueLayer          | None in this candidate                              | Future approved build only, explicit consent | Future provider revocation, deletion and regulated review required                   |
| AI provider        | None from current mobile core                       | Future enum-only route only                  | Raw data route is retired; future processor review required                          |

## Engineering controls available for review

- Local encryption and secure-store key boundary; fail-closed writes and recoverable generations.
- Review-gated import candidates; retained sources are encrypted and workspace-bound.
- Cloud service receives ciphertext rather than plaintext money records.
- Remote deletion fails closed until configured purge operations succeed.
- Diagnostics sanitize free-text, user/request/extra/breadcrumb fields.
- Optional provider routes are authenticated, bounded, rate-limited and feature-gated.
- Local/manual/export paths remain available during optional-service outages.

## Owner/counsel inputs still required

1. Legal entity and privacy/DPO owner.
2. Existing owned public privacy URL, support route and security disclosure route.
3. Lawful basis, retention periods and international-transfer/processor-contract decisions.
4. Approval of the financial/tax/advice perimeter and vulnerable-user wording.
5. Approval of any future TrueLayer/AI route before enabling it.

Source package: `docs/source-package/release/DPIA_CURRENT_MELO_2026-08-24.md`,
`PRIVACY_POLICY.md`, `docs/privacy-security/telemetry-and-samples.md` and
`docs/source-package/release/LEGAL_AND_REGULATORY_REVIEW_CHECKLIST.md`.
