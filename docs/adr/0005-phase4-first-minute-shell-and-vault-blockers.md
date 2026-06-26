# ADR 0005: Phase 4 First-Minute Shell And Vault Blockers

Date: 2026-06-20

Status: Accepted with explicit blockers

## Context

Phase 4 must let a new user reach truthful first value or a clearly labelled preview in under
60 seconds, without account creation, upfront permissions or fake personalisation. The same phase
also names vault creation and lock/unlock work, but the native key boundary is not proven yet.

T016 native Keychain/Keystore wrapping, T017 recovery wrapping and the lock/re-enrolment path
remain blocked. Implementing simulated vault security in JavaScript would create a false release
claim.

## Decision

Implement Phase 4 as a split shell:

- Put deterministic first-minute choices, demo data, quick-start calculations, privacy-route
  metadata and navigation metadata in pure `@folio/first-minute`.
- Render those models in the Expo development-build shell.
- Keep native vault diagnostics and database proof outside the first-launch value path.
- Treat T061 and T062 as blocked until real native key wrapping, recovery wrapping, app lock,
  timeout, relaunch and re-enrolment evidence exists.
- Treat Android dev-client live preview as UI/runtime evidence, not production security evidence.

## Consequences

Phase 4 can move forward for experience structure, quick-start truthfulness and local-first copy
without overclaiming vault security.

The first-minute code remains testable under pure TypeScript and protected by dependency-boundary
checks. Mobile UI may import `@folio/first-minute`; pure packages may not import React Native,
Expo, SQLite, V1 donor source or app code.

Phase 5 encrypted import staging remains gated by T018 encrypted document-file proof and by the
T061/T062 vault blockers where import UI or accepted-file storage depends on the real vault.

## Evidence

- `packages/first-minute`
- `apps/mobile/src/phase4/firstMinuteFlow.ts`
- `apps/mobile/app/index.tsx`
- `docs/release-evidence/C4-mobile-first-60-seconds.md`
- `docs/release-evidence/android-live-preview-phase4-final.png`
- `docs/release-evidence/android-live-preview-phase4-final-scroll.png`
- `docs/release-evidence/android-live-preview-phase4-final-bottom.png`
- `docs/release-evidence/android-live-preview-phase4-final-gates.png`
- `https://www.figma.com/design/JAVKDl1EBaDWfAKFnkE0n2?node-id=6-3`
