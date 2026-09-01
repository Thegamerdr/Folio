# Identity and cloud local readiness — 2026-09-01

Status: **all locally implementable scaffolding is complete; production credentials, deployment and
multi-device/provider acceptance remain external.**

## Identity and deletion

- The optional signed-in surface supports Clerk email code, Google SSO, Apple SSO and discoverable
  passkey sign-in. Passkeys are shown only when the device reports support.
- `@clerk/expo-passkeys` is pinned to `1.2.6` and supplied to `ClerkProvider`.
- `EXPO_PUBLIC_CLERK_FRONTEND_API_HOST` is validated as a hostname and, when supplied, configures
  iOS associated domains and an Android verified HTTPS intent filter.
- The public Cloud Vault deletion-readiness route is available at `GET /delete-account`. It reports
  an honest unconfigured state until an owner-provided HTTPS deletion URL exists.
- In-app account deletion remains ordered: remote encrypted-vault purge first, then Clerk identity
  deletion; local-device wipe is a distinct destructive action.

Production use still requires a live Clerk publishable key, frontend API host/domain bindings,
Google/Apple/passkey enablement in Clerk, a deployed Cloud Vault with its Clerk/Worker bindings, an
owner-controlled public deletion URL, and a disposable-account E2E deletion run.

Implementation follows Clerk's current Expo passkey and custom authentication documentation:
<https://clerk.com/docs/reference/expo/passkeys>,
<https://clerk.com/docs/guides/development/custom-flows/authentication/passkeys> and
<https://clerk.com/docs/guides/development/custom-flows/authentication/oauth-connections>.

## Encrypted cloud sync/recovery

- A Durable Object coordinates one authenticated account/workspace and stores only ciphertext
  operations, snapshots and client-wrapped epoch keys.
- The device registry supports explicit enrollment and revocation; revocation advances the key
  epoch and distributes new wrapped keys only to remaining devices.
- Operation writes are idempotent, replay is paginated, acknowledgements are monotonic, snapshots
  carry checksums and compaction waits for both a snapshot checkpoint and the minimum active-device
  acknowledgement.
- The shared sync client and mobile bridge seal operations with AES-GCM using
  workspace/device/sequence/epoch additional authenticated data and a caller-owned epoch key.
- Account purge removes the workspace coordinator state.

Automated unit and type checks cover the server and mobile protocol. Production closure still
requires the deployed Durable Object/KV/Clerk bindings, two physical devices, offline edit/delete/
revoke/recovery drills, and independent cryptography/security/privacy review.
