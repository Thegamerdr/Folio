# Melo release review handoff — 31 August 2026

This index is the current engineering handoff for independent security, accessibility and
privacy/legal review. It is not an approval record. Reviewers must assess the exact candidate and
return their own decision; no internal test or role-card exercise is substituted for independent
sign-off.

## Candidate under review

| Field                         | Value                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Product                       | Melo                                                                               |
| Android package / iOS bundle  | `com.folio.v2.greenfield`                                                          |
| Version / Android versionCode | `0.0.1` / `1`                                                                      |
| Android candidate             | `release-artifacts/melo-0.0.1-2026-08-24/melo-0.0.1-1-production.aab`              |
| Android candidate SHA-256     | `6023B1A455907739B5EB6D7ABEA26B19212ADABF308170510ED2A50EB3E2A999`                 |
| Upload certificate SHA-256    | `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488`                 |
| Current Open Banking exposure | Disabled in this candidate; no bank data is sent                                   |
| Current AI exposure           | Local deterministic core; raw-data routes retired; enum-only route is future-gated |

The binary identity and runtime evidence are documented in
`docs/release-evidence/MELO_ANDROID_RELEASE_CANDIDATE_2026-08-24.md`. If a new binary is produced,
replace the hash and re-run the declaration, security and accessibility match before submission.

## Review packages

- Security: `INDEPENDENT_SECURITY_REVIEW_PACKAGE.md`
- Accessibility: `INDEPENDENT_ACCESSIBILITY_REVIEW_PACKAGE.md`
- Privacy/DPIA: `docs/source-package/release/DPIA_CURRENT_MELO_2026-08-24.md`
- Legal/regulatory perimeter: `docs/source-package/release/LEGAL_AND_REGULATORY_REVIEW_CHECKLIST.md`
- Store declarations: `docs/release-store/CURRENT_STORE_SUBMISSION_PACKAGE_2026-08-24.md`
- Operations: `docs/release-operations/README.md`

## Engineering evidence re-run on 31 August

The focused release review suite passed: 12 files, 117 tests. It covers persistence recovery and
ENOSPC handling, cloud/account deletion contracts, error redaction, native security boundaries,
AI egress rejection, Open Banking transport/configuration boundaries, accessibility tokens/sheets
and registry coverage.

Command:

```text
pnpm exec vitest run packages/ui/test/tokens.test.ts apps/mobile/src/folio/ui/Toast.test.ts apps/mobile/src/folio/lib/persistRecovery.test.ts apps/mobile/src/folio/shell/registryCoverage.test.ts apps/mobile/src/folio/sheets/appearanceSheet.test.ts apps/mobile/src/folio/lib/errorReporting.test.ts apps/mobile/src/local/nativeLocalSecurity.test.ts apps/mobile/src/folio/lib/cloudBackup.test.ts apps/mobile/src/folio/lib/remoteAccountDeletion.test.ts services/ai-gateway/src/index.test.ts services/open-banking/src/index.test.ts services/open-banking/src/truelayer.test.ts
```

The repository-wide suite and typechecks are recorded by the release controller. The current
authoritative status commands remain intentionally blocked because they require external console,
device, credential or independent-review evidence; a blocked status is not converted into a local
pass by this handoff.

## Exact unresolved external inputs

- Independent security/MASVS and penetration review of the candidate, including the cloud/provider
  boundaries and native key/recovery path.
- Independent accessibility review on Android and iOS, including complete TalkBack/VoiceOver,
  focus-order, large-text, reduced-motion and cognitive checks.
- Legal/privacy owner supplies the legal entity, public policy URL, support/security contact and
  signs the current DPIA/privacy package.
- Google Play developer verification, declaration review and billing test products; Apple/EAS
  iOS signing/build and App Store Connect review if iOS is released.
- Disposable production-configured account deletion and cloud/provider purge evidence.

No contact address, public URL, legal entity, provider approval or reviewer identity is invented in
this document.
