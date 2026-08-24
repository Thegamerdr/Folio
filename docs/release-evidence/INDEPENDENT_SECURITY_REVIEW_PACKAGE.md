# Melo independent security review handoff

Status: engineering evidence prepared; independent security review is not self-approved.

Android review target: `melo-0.0.1-1-production.aab`, SHA-256
`5120F437F7C004F323576DEBEF32CD9C17203A4E7E376E6ACED1248D074ED14F`; upload certificate SHA-256
`547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488`.

## Review target and architecture

The Android/iOS client is a local-first React Native/Expo app. Durable workspace state is written
through the native persistence boundary as SQLCipher-backed generations plus authenticated AES-256-GCM
file generations during migration. The SQLCipher key is generated/read through `expo-secure-store`
with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; workspace keys are derived from the device master and an
opaque workspace binding. App lock uses `expo-local-authentication` when device authentication is
available. Signed-out local-only use remains available.

Optional remote boundaries are separate Workers: Clerk JWT authentication fronts cloud vault and
Open Banking; cloud vault stores only an encrypted client envelope; Open Banking seals provider
connection material server-side and returns provider-neutral staged candidates; billing verifies
Google Play purchases server-side and signs short-lived grants; AI is an enum-only abstract phrasing
gateway and must never receive raw transactions, documents, names or exact amounts. Sentry is crash
diagnostics only, with PII, request, breadcrumbs, screenshots and tracing disabled.

## Threat boundary and hardening evidence

- Provider base URLs are HTTPS-only and reject embedded URL credentials before network I/O.
- AI upstream base URLs are HTTPS-only and reject embedded URL credentials; the allow-listed envelope,
  body limits, model allow-list and provider response limits remain enforced.
- State writes stage before replacement, retain a verified rollback generation, park unreadable bytes,
  classify storage/key failures, retry after ENOSPC and surface an accessible save notice.
- Restore validates the workspace envelope before replacement; cloud backup binds ciphertext to an
  opaque workspace and verifies size/checksum; account deletion purges remote stores before identity
  deletion when the provider path confirms success.
- `errorReporting.sanitizeErrorEvent` removes user/request/extra/breadcrumb payloads and replaces
  free-text diagnostic messages and exception values. Native root/screen boundaries log only a generic
  event marker; no exception object or component stack is printed to device logs.

## SDK/provider inventory

Expo 56 / React Native 0.85, Expo Router, Clerk Expo, Secure Store, Local Authentication, SQLCipher
via OP-SQLite, Sentry React Native, Expo IAP, Document Picker, Image Picker, Sharing, Notifications,
Web Browser, and TrueLayer Data API v3 (server-side Worker only). AI provider access is server-side
OpenRouter through the enum-only Worker. No provider secret or Google Play service credential is in
the mobile bundle.

## Test evidence

Run from repository root:

```text
pnpm exec vitest run apps/mobile/src/folio/lib/persist.test.ts apps/mobile/src/folio/lib/persistRecovery.test.ts apps/mobile/src/folio/lib/restore.test.ts apps/mobile/src/folio/lib/errorReporting.test.ts apps/mobile/src/local/nativeLocalSecurity.test.ts apps/mobile/src/folio/lib/cloudBackup.test.ts apps/mobile/src/folio/lib/remoteAccountDeletion.test.ts services/open-banking/src/index.test.ts services/open-banking/src/truelayer.test.ts services/ai-gateway/src/index.test.ts
```

The persistence suite covers corrupt main/backup/staged generations, interrupted writes and
migrations, ENOSPC retry, malformed state, orphan cleanup, SQLCipher fallback, and workspace
isolation. Provider suites cover malformed responses, unauthorized access, checksum/size bounds,
workspace binding, raw-AI rejection, response limits and the HTTPS-only transport boundary.

## Reproduction instructions for the reviewer

1. Run the command above and inspect the named tests.
2. In `services/open-banking/src/truelayer.test.ts`, change either provider URL to `http://...` or
   add URL credentials; verify `configured === false` and no `fetch` occurs.
3. In `services/ai-gateway/src/index.test.ts`, set `OPENROUTER_BASE_URL` to HTTP; verify a 503 and
   no upstream fetch.
4. Inspect `apps/mobile/app/_layout.tsx` and `apps/mobile/src/folio/shell/FolioShell.tsx` crash
   boundaries; induce a test render error and confirm logs contain only the generic marker.
5. Review `docs/release-evidence/MELO_ANDROID_RELEASE_CANDIDATE_2026-08-24.md` and repeat its
   Android release smoke/accessibility scenarios on a disposable device or emulator. Do not use
   real financial data.

## Known risks requiring independent review

Physical-device keystore loss, production account deletion E2E, cloud cross-device restore and
provider console configuration need external/runtime evidence. The upload-signed Android AAB,
manifest, ABI and hash are now verified internally. A reviewer should
also inspect dependency provenance, generated native manifests, release artifact/source-map handling,
Clerk/JWKS rotation, billing grant replay/expiry, and the candidate identity above. These are review
inputs, not claims of independent signoff.
