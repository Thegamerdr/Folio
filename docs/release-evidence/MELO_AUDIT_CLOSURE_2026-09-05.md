# Melo audit closure map — 2026-09-05

This is a concise disposition of A01–A21 from
`plans/AUDIT_UI_UX_AND_RELEASE_2026-09-05.md`, using the delivery/checkpoint record in
`plans/123-deliver-reviewed-melo-product.md`, current candidate source at `516ee6b4ede45c1edca565314c77f577032ba1f8`, and the preceding
source integrations `c8573217796f35dcc73009d9324f63a862bbb95d` (sync) and `9be203458deba66fbf81fc0d41a05237c992dc75` (journal guard). “Implemented” means the
current source/checkpoint addresses the cited behavior; it is not physical verification. No item
is labelled VERIFIED from unit tests. “Proof pending” includes unrun local/device checks as well as
external provider checks; it does not mean that secrets alone will finish the product.

| ID | Outcome | Current source/checkpoint evidence | Remaining concrete proof or gap |
| --- | --- | --- | --- |
| A01 | IMPLEMENTED — proof pending | `OnboardingSheet.tsx`, `store.ts`, Plan/Account routes preserve populated workspaces while separating first-run cleanup from returning edits/skips. | Exercise save, cancel, and skip on a populated isolated workspace, including a second workspace. |
| A02 | IMPLEMENTED — proof pending | `moneyPath.ts` payday selector and `PlanScreen.tsx` now align the tight narrative with the payday window; the full calendar remains separate. | Populated weekly/fortnightly scenarios with events before, on, and after payday. |
| A03 | IMPLEMENTED — proof pending | Backup checkpoint `025ee05` adds SQLite authority, generation preconditions, recovery-first behavior, retained old-key anchor, and Business-safe restore staging. | Deploy the migration and perform clean-device recovery, including missing local key and Business partition cases. |
| A04 | IMPLEMENTED — proof pending | `c8573217796f35dcc73009d9324f63a862bbb95d` plus controller checkpoint serialize coordinator mutations; workerd/SQLite synthetic concurrent-cursor exercise passed. | Deploy and exercise two real devices with retry/lost-response behavior; these new service versions have not been deployed. |
| A05 | IMPLEMENTED — proof pending | Sync requests are bound to verified device keys, signed route/body/freshness, and replay-safe coordinator state. | Real enrollment, revocation, stale-session and impersonation attempts against deployed service. |
| A06 | IMPLEMENTED — proof pending | `apps/mobile/src/folio/lib/cloudSyncNative.ts` provides the shipping replay/outbox/conflict runner; `apps/mobile/src/folio/sheets/CloudSyncSheet.tsx` provides enrollment, key lifecycle, enable/pause/sync, device approval/revocation and conflict actions; `apps/mobile/src/folio/store.ts` stages normal-save changes with native CAS metadata; `apps/mobile/src/folio/shell/FolioShell.tsx` mounts the foreground/local-save lifecycle. | Deploy the coordinator and exercise enrollment, offline edits, restart/replay, conflict resolution and revocation across two real devices. |
| A07 | IMPLEMENTED — proof pending | `c25640e` and the bank-delivery runtime check cover encrypted staging/replay, revision acknowledgement, pagination, disconnect and deletion fences. | Real provider authorization, deployed service and physical response-loss/restart proof remain open. |
| A08 | IMPLEMENTED — proof pending | Billing issuer/verifier now use canonical expiry precision; focused grant/lifecycle coverage includes fractional expiry boundaries. | Verify a real backend-signed grant through the installed app, including grace/renewal boundaries. |
| A09 | IMPLEMENTED — proof pending | `iap.ts` retains eligible store metadata and passes the selected Android subscription offer token. | Licensed Play tester purchase against a signed candidate; no real purchase was made. |
| A10 | IMPLEMENTED — proof pending | Billing lifecycle is mounted for startup/foreground refresh, persistent pending updates, verification-before-finish, restore and retry. | Store renewal, pending-to-purchased, cancellation, offline grace and restore journeys. |
| A11 | IMPLEMENTED — proof pending | `apps/mobile/src/folio/lib/billing/iap.ts` supports iOS product discovery, purchase, restore, pending updates and finish; `apps/mobile/src/folio/lib/billing/billingVerification.ts` routes iOS proofs to `/v1/apple/verify`; `services/billing-entitlements/src/apple.ts` verifies signed StoreKit transactions and active subscription chains with bounded transport. | Apple credentials, App Store account state, sandbox/production configuration and an iOS device purchase/restore lifecycle remain unproven; no iOS runtime claim is made. |
| A12 | IMPLEMENTED — proof pending | `app.config.ts` uses a fingerprint runtime boundary; `400aa4b` fixes stale Expo metadata. The final APK/AAB contains the verified fingerprint and the exact APK is installed and launches on S9. | Final identity/launch is verified in the candidate record. No OTA was published; iOS runtime evidence remains separate. |
| A13 | IMPLEMENTED — proof pending | Backup checkpoint `025ee05` adds encrypted workspace catalog/discovery and safe Personal/Business activation constraints. | Deployed migration plus physical clean-device Personal-then-Business and Business-only recovery. |
| A14 | IMPLEMENTED — proof pending | Current `apps/mobile/src/folio/screens/PlanScreen.tsx` handlers mount Debts, transfer, refund and subscription destinations. `apps/mobile/src/folio/screens/MoreScreen.tsx` routes Search Melo to `apps/mobile/src/folio/screens/MoreSearchScreen.tsx`, whose local result model searches current pots/subscriptions/debts and actions and opens their real screen/sheet targets. | Final S9 Search opens Transfer/Refund prerequisite sheets with keyboard dismissal. Populated commit/undo/error flows and every destination are not certified by that smoke check. |
| A15 | IMPLEMENTED — proof pending | Current screens use non-overlapping safe-area viewports; companion ownership suppresses duplicate/floating birds, including Account’s inline 32px bird target. | Corrected 360dp light/dark emulator compositions checked; S9 Today/Plan/Review/More opened. Final-candidate and larger-text/Business coverage remain distinct. |
| A16 | IMPLEMENTED — proof pending | `Sheet.tsx`/`MeloChatSheet.tsx` use explicit panel/keyboard height and retain visible header, composer and 44px controls. | S9 chat composer/Send remained visible above the keyboard and hardware Back dismissed it. Scrollable onboarding needed an additional shrink fix, verified below the status bar on the final candidate with keyboard open; large-text coverage remains open. |
| A17 | IMPLEMENTED — proof pending | More notifications is an explicit switch with enabled/disabled, permission and failure feedback rather than a silent chevron toggle. | Device permission-denied/granted and persisted-toggle behavior. |
| A18 | IMPLEMENTED — proof pending | Intake/Review copy describes the actual picker/review contract; no-source Review is distinct from all-reviewed state. | Capture empty/no-source and first-use flows with the real document picker/provider-off state. |
| A19 | IMPLEMENTED — proof pending | Today, Plan and Calendar use the shared day clock with foreground/day-rollover refresh and cleanup. | Background across midnight, timezone change and payday-boundary device checks. |
| A20 | IMPLEMENTED — proof pending | `iap.ts`/`PaywallScreen.tsx` gate each SKU independently and display the exact returned localized product/period/offer. | Play catalog, regional price and licensed purchase/restore proof; no store transaction was made. |
| A21 | IMPLEMENTED — proof pending | Voice permission failures unwind to a retryable state; current hook and chat retain typed fallback. | Deliberate spoken phrase, transcript review, cancel/retry and background interruption on a real device. |

## Current acceptance boundary

Lovable supplied one review batch containing 15 corrections; those corrections are applied in the
current source. The latest root report is a four-file focused/no-emit pass with 27 tests, which is
source regression evidence only. The follow-up in `516ee6b` fixes Calendar jump coordinates,
scrollable sheet shrinking and searchable transfer/refund actions; nine targeted cases and mobile
no-emit passed. The final signed arm64 APK/AAB is built and the exact APK is installed/launching on S9,
with parity capture and Sentry upload disabled.
The earlier missing-fingerprint candidate was rejected, replaced in place and successfully launched;
final artifact/device evidence is recorded separately.

The new cloud, banking and billing service revisions are not deployed; older endpoints already exist. Credentials, real Play purchases, bank/provider authorization,
native backup recovery, iOS runtime evidence, and any external security/accessibility/store sign-off
remain open. This record therefore does not claim release readiness, production proof, or completion
of the OPEN items.
