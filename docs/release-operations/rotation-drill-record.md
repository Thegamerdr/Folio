# Melo safe rotation drills — executed/simulated 2026-08-24

## Result

**CLOSED — rotation drill evidence complete for the safe internal scope.** No production secret,
owner-only credential, Play Console key, Clerk secret or bank-provider credential was rotated.
Production rotation remains an owner/provider operation and is not claimed here.

The drills used the checked-in configuration contracts and disposable values in process memory only.
No secret value is recorded in this file.

| Secret/config class           | Truthful mode        | Procedure and observed result                                                                                                                                                                          | Rollback / exposure check                                                                                                      |
| ----------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Open Banking provider key     | **Executed dry-run** | Verified the app has no provider credential and the Worker reads provider credentials from bindings; a missing binding keeps the adapter in `provider_not_configured` and preserves local/manual paths | Restore the prior test binding in the staging dashboard; no value entered the app, logs or repo                                |
| Billing verification key      | **Executed dry-run** | Verified the app validates the signed entitlement issuer/audience/key-id/public key and rejects missing or invalid grants; the Worker keeps the signing private key server-side                        | Keep the current public key until a paired Worker/app rollout is prepared; no private key was read or printed                  |
| AI/provider configuration     | **Executed dry-run** | Verified the mobile product has no raw prompt/document transport and the gateway's retired raw routes remain disabled; enum-only route can be disabled without affecting local Melo                    | Re-enable only after policy/schema tests and independent review; no provider request was sent                                  |
| Cloud Vault/Clerk credential  | **Simulated**        | Production Clerk/Worker credentials were not available in this environment. The deletion/backup contract requires a valid Clerk bearer token and fails closed without one                              | Rotate through the provider dashboard with a disposable test account, then rerun deletion/restore; no production token touched |
| Sentry/provider configuration | **Executed dry-run** | Verified Sentry initialisation is privacy-tuned and resolves the public DSN from build config; user fields, screenshots, traces and breadcrumbs are disabled                                           | Roll back DSN/config at build time; no event containing user data was emitted                                                  |
| Device/session/recovery route | **Executed dry-run** | Verified the product's revoke/delete boundaries and local-first fallback: cloud purge and provider-index deletion must complete before identity deletion; local wipe is separate                       | Retry is fail-closed when a remote purge fails; no account or local data was deleted                                           |

## Commands/evidence

- `pnpm release:status`, `pnpm store:status`, `pnpm operations:status` executed on 2026-08-24.
- Source/config inspection covered `apps/mobile/app.config.ts`, the billing, cloud-vault,
  open-banking and AI gateway contracts, and the current store package.
- No `adb` executable is available on this Windows environment (`adb devices -l` could not run),
  so no physical-device rotation or install claim is made.

## Closure and remaining action

The safe internal drill is closed. Before a public release, the owner/provider operator must rotate
real production credentials using the provider's audited dashboard and attach before/after access
validation without recording secret material. That action remains in `OWNER_ACTION_PACK.md` and is
classified as external/owner action in the release register.
