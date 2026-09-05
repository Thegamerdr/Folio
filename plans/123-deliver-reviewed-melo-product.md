# Plan 123: Deliver the audited Melo fixes with Luna workers

Planned at `2effcd73`, 2026-09-05. Controller: current primary agent. Executors: `gpt-5.6-luna`, high reasoning. User explicitly requested implementation, orchestration, controller review, and economical verification. This is an execution plan, not another audit or redesign.

## Outcome

Deliver reviewed source changes, a new signed Android tester candidate and AAB where existing signing permits, an update installation on S9 preserving its data, and a truthful closure record for audit A01–A21. Do not claim provider purchases, banking, independent reviews or iOS runtime passed without actual evidence. No hidden stubs accepted as complete functionality.

Repository: `C:/dev/melo-native-today-batch1-2026-08-24`. Audit: [21 findings](C:/dev/melo-native-today-batch1-2026-08-24/plans/AUDIT_UI_UX_AND_RELEASE_2026-09-05.md). Preserve package `com.folio.v2.greenfield`, current owner-approved Full/Live model, local SQLCipher authority, review-before-financial-write, visual identity, and all unrelated dirty files.

## Execution contract

- Target three Luna workers, no nested workers and no workers reviewing workers. The app currently retains two completed audit-agent slots and refuses new workers after one Luna dispatch; until capacity changes, the same Luna executes lanes sequentially. Do not substitute a more expensive model. The controller reads every diff and its callers, tests the integration, and checks the actual S9 build.
- Use the existing checkout and installed dependencies with exclusive file ownership. This avoids rebuilding dependency environments; no overlapping edits without controller approval. Never revert another worker's changes. Source is clean at the starting SHA; existing dirty design evidence, OPEN_BANKING_PLAN.md and plans/README.md belong to the owner.
- Read before editing; use `rg` and `apply_patch`; reuse existing domain/store/native patterns. No new framework, generic abstraction layer, mass refactor, dependency upgrade or visual redesign.
- Never print or commit secrets. No production account deletion, real charges, release upload, service deployment, credential rotation or S9 clear/uninstall. Use synthetic fixtures and non-destructive device checks. Stop and ask the controller for genuinely missing authority.
- Target a small number of regression cases at the actual failure boundaries. Do not generate thousands of tests or repeatedly run the whole suite. Each worker runs only named affected tests and a relevant typecheck. Controller runs one combined focused acceptance pass and build/device checks; no full-suite churn.
- Test shape: existing Vitest `.test.ts` files. Prefer the real production function/handler in tests, not a copy of its logic. No weakening assertions, skipping failures or editing historical evidence to make gates green.
- Report completed behavior, exact changed files, commands/results and remaining gaps. A new helper with no shipping caller is not delivered. No commit/push by workers until controller review; controller owns coherent integration commits and final status.

## Lane M — money safety, then native UI

Initial exclusive ownership: OnboardingSheet.tsx, PlanScreen.tsx, planModel.ts and its tests, TodayScreen.tsx, CalendarScreen.tsx; small new onboarding/day-clock helpers/tests. Do not edit store.ts, FolioShell.tsx, billing, cloud or banking files initially. Ask for any necessary expanded ownership.

1. A01: `done()` and `skipForNow()` unconditionally call `resetToEmpty`. Separate first-run sample cleanup from editing real/returning data. Reopening payday/income must update only intended setup fields; skipping must preserve existing records. Preserve other income sources/pots, not only transactions. Test actual shared production mutation function with populated and first-run fixtures. Do not reproduce the test bug by copying the handler logic.
2. A02: `buildPlanUpcoming` currently collects all 35-day outgoing events while the total says to payday. Align total/count/tight point and caption to a single period; keep a longer calendar separate. Cover before/on/after payday and weekly cadence. Reuse existing calendar/route engines.
3. A19: introduce one small day/clock hook for mounted Today/Plan/Calendar; refresh on active/day rollover and clean up listeners/timers. Do not change the device clock.
4. Return first checkpoint for controller review. Later UI wave owns Plan/More/Review/Intake, chat/Sheet/companion and voice hook as assigned: wire dead actions and real local search, explicit notification state, safe insets, no overlapping/duplicate companion, usable keyboard composer/Send target, correct native copy and first-use action, caught voice-permission failures. Retain existing theme tokens and navigation architecture.

Verification: `pnpm exec vitest run <named affected .test.ts files> --reporter=dot` must pass; use existing onboardingComplete.test.ts and planModel.test.ts as patterns, not immutable expected behavior. Mobile check once after the lane checkpoint: `pnpm --filter @folio/mobile exec tsc --noEmit --incremental false --composite false`. Controller validates S9 layout after final native build.

## Lane B — billing and release runtime

Exclusive ownership: `services/billing-entitlements/**`, `apps/mobile/src/folio/lib/billing/**`, `apps/mobile/src/folio/screens/PaywallScreen.tsx` and its tests, `apps/mobile/app.config.ts`; new billing lifecycle hook/component. Do not edit shared shell/app layout until controller assigns the small mount seam.

1. A08: issuer floors JWT exp but verifier expects exact milliseconds. Canonicalize grant timestamps consistently without extending expiry. Test actual signed backend output through mobile verification, including fractional provider expiry.
2. A09/A20: retain queried product/eligible offer metadata, use the selected Android subscription offer token, show store-localized price/period, gate each SKU independently. Do not make products available because one unrelated SKU exists. Preserve Full one-time, Live monthly/yearly and crisis-selling suppression.
3. A10: implement idempotent startup/foreground and scheduled grant-refresh reconciliation plus later pending-purchase completion. Verify before unlock/acknowledgment. Restore, expiry, cancellation and offline grace must use the same authority. Provide the small lifecycle mount to controller, not an uncalled export.
4. A11: implement Apple verification/purchase/restore if safely specifiable using official current Apple/expo-iap documentation and existing dependencies; do not silently remove iOS scope. Report the design/credential contract before adding a new dependency. A truthful temporary iOS purchase gate prevents a broken CTA but alone does not close iOS completion.
5. A12: give the next native candidate a compatible runtime identity that cannot target old binaries; prefer fingerprint or explicit native-runtime policy consistent with current Expo setup. Preserve public package/version decisions unless policy authorizes a bump. Do not publish OTA.

Verification: only affected billing/grant/paywall tests, service typecheck `pnpm --filter @melo/billing-entitlements typecheck`, and one mobile no-emit check after implementation. Consult installed expo-iap 4.3.6 source and official docs; no test purchases with a real payment method.

## Lane C — safe cloud protocol and recovery

Exclusive ownership initially: `services/cloud-vault/**`, `packages/sync/**`, `apps/mobile/src/folio/lib/cloudBackup*.ts`, `cloudSync*.ts`, CloudBackupSheet.tsx, and directly related new helpers/tests. Do not edit store.ts/persist.ts/shared shell without approved ownership.

1. A04: serialize coordinator state transitions and make accepted operation/idempotency/state durability atomic. Existing `fetch` reads state before awaits, both devices get cursor 1. Fix production behavior, not only test mock. Use clone-on-read/write storage and a small concurrent-upload/retry regression. Prefer existing Durable Object storage; do not invent a separate queue service. Verify current Cloudflare concurrency/transaction docs.
2. A05: account JWT alone plus caller `x-melo-device` cannot authorize device operations. Design a request-bound signature/proof contract with body/path/method/freshness, authenticated enrollment and replay handling. Never let a revoked device impersonate an active one. Keep account boundary and ciphertext confidentiality intact. Send controller the concise protocol contract early, then implement.
3. A03: existing remote backup + no local key must default to recovery, not replacing with newly generated key/empty local data. Add explicit replacement authorization and generation preconditions; expose safe prior-generation recovery where necessary.
4. A13: clean-device Business recovery needs an account-scoped encrypted workspace discovery/recovery route. A Personal backup may recover the Business ID but cannot activate its absent partition. Prepare exact safe activation integration requirements for controller; no fabricating a new ID over the old backup.
5. Return first checkpoint. A06 mobile sync integration is a dependent next wave: durable outbox/replay, device/key lifecycle, offline edits/restarts, error state and revocation. No whole-store last-write-wins replacement or silent conflict data loss accepted; build on existing `@folio/sync` domain contracts. A helper-only implementation does not close A06.

Verification: selected cloud-vault/sync/backup tests only, `pnpm --filter @melo/cloud-vault typecheck`; before Workers work read installed cloudflare/workers-best-practices/durable-objects skills and retrieve current primary docs. Do not deploy or enable production endpoints.

## Dependent banking wave — next free worker

A07 ownership: `services/open-banking/**`, `packages/open-banking/**`, mobile openBanking helpers and BankConnectionSheet.tsx. Implement a retryable batch receipt/ack protocol so provider cursor can advance only with a recoverable durable batch. Phone stages before acknowledging; reviewing is separate from accepting into financial truth. Preserve pagination, account mappings, pending rows and deduplication. Closing the sheet, restarting the phone, response loss and repeated refresh must not discard unseen history. Encrypt sensitive temporary batch data, bound retention and purge it on disconnect/deletion. Test 3–5 actual delivery failure scenarios, not a mass mock matrix. TrueLayer remains the provider; secrets/live provider proof stay accurately gated.

## Controller-owned integration and acceptance

Controller reserves shared app/shell mounts, release control files, build tooling and device access. Workers request edits to these seams; controller assigns a single writer. Read all diffs and exact boundary cases before accepting. Send concrete revisions to the owning Luna worker. Check no helper-only delivery, permissive auth fallback, hidden data replacement, swallowed failures or fabricated PASS evidence.

Build once after reviewed lanes integrate using existing signed-release scripts and signing material without printing it. Preserve original S9 install data with update install; verify signature compatibility before install. Use emulator/disposable fixtures for destructive recovery tests. Verify Today/Plan/Review/More, deep actions/search, keyboard, safe area, empty/populated states, hardware Back and no fatal crash. Voice transcript requires a deliberate user phrase; idle screenshots do not count.

Reconcile audit IDs as VERIFIED, IMPLEMENTED-EXTERNAL-PROOF-REQUIRED, IN-PROGRESS or BLOCKED with precise reason. Update release truth to reopen any local gaps not genuinely closed. Final delivery includes exact artifact paths/hashes, source revision, what worked on S9 and one short list of real owner/provider/signoff actions. No blanket “100%” based on test counts.

## Live status

| Work | Status | Acceptance |
| --- | --- | --- |
| Money safety and dates | SOURCE REVIEWED — corrections applied | Included in controller's 34 passing focused cases; candidate/device checks pending |
| Android/Apple billing/runtime | SOURCE REVIEWED — `de18d8da`, `7309b3f` | Lifecycle, exact store terms, verified Apple API/JWS and bounded transport. Local Worker/packaging pass; real store/iOS evidence open |
| Cloud protocol A04/A05 | SOURCE REVIEWED — controller corrections integrated | Atomic coordinator and real native-signature integration checks pass; no deployment or shipping sync claim |
| Backup/Business recovery A03/A13 | SOURCE REVIEWED — `025ee05` | Actual SQLite authority plus 6 named native/migration/activation cases pass; deployment/device recovery proof remains open |
| Banking durable delivery | LUNA REVISING AFTER CONTROLLER REVIEW | Durable inbox committed `3572a36`; routed service/retry/pagination acceptance pending |
| Mobile UI/voice and financial actions | SOURCE REVIEWED — `2ab349cf`, `80f03835` | Real transfer/refund routes, metadata persistence, safe Undo and manual-money parsing; S9 checks pending |
| Shipping sync wiring | QUEUED | After protocol/recovery checkpoint |
| Integration, candidate, S9 | QUEUED | After reviewed code |

The controller maintains this file; workers do not change the index. The broader audit is not repeated. Scope changes require an explicit controller decision with the reason recorded.

Backup checkpoint `025ee05`: controller corrected deletion resurrection, lost-response rotation,
old-generation key preview, missing native streaming support, missing scoped Business migration,
discarded legacy previous generations and registry loss during Personal restore. New backup head,
catalog and generations are one account-scoped SQLite authority. Migration adopts both existing
generations atomically. Explicit key replacement retains an old-key anchor; ordinary updates do not
evict it. Phone uploads verify that its active/pending code opens the observed current ciphertext,
save new material before upload, and keep the rotation intent through failed responses. The real
Miniflare/SQLite check passed concurrent CAS, chunking, replay, anchor, migration and deletion fences.
Six named native/route/persistence cases passed, including Business failure after manifest commit;
service/mobile no-emit passed. This is not proof of a deployed migration or physical clean restore.

The first A07 worker return was rejected: new receipt replay used an object/string mismatch, old KV
secrets were not migrated/purged, pagination over 500 rows could never finish, callbacks lacked a
revision check and a new empty-array selector could loop rendering. Controller sent concrete fixes;
subsequent review identified partial-page job identity and multi-account starvation. Existing legacy
tests passing do not close the new authority path. One actual local Worker delivery exercise is required.

### Bounded shipping sync implementation contract (A06)

Do not build a new CRDT/framework or claim typed audit hashes are replayable data. Reuse the existing
signed coordinator, SQLCipher adapter, crypto primitives, store and sheet patterns. The controller
will review the worker's short concrete data/flow proposal before edits to this lane.

- Opt-in UI in the signed-in Account surface: enable/disable, Sync now, actual pending/error state,
  device approval, device revocation and conflict review. Mount the real foreground/local-save
  lifecycle in the Clerk-configured shell. No fabricated connection, sample sync or silent success.
  Account/workspace binding and current entitlement govern network work, never offline local access.
- Add device-local sync metadata/outbox to the SAME workspace SQLCipher transaction that saves the
  exact financial state and canonical projection. Compare the last committed shareable projection
  with the new one; do not enqueue render-only changes or restored billing claims. Persist operation
  identity/sequence/plaintext delta before network, then persist its exact sealed upload before sending
  so response-loss retries reuse ciphertext. Outbox entries survive restart and edits made in flight.
- Use atomic compare-and-swap patch groups over changed owned entities/fields. A field/collection-level
  compare-and-swap with visible conservative conflicts is acceptable; silent whole-vault last-write-
  wins is not. All legs/balances of a financial action stay in one group. Replay is deterministic in
  server cursor order, and overlapping edits retain both alternatives as durable reviewable conflicts.
  Explicit conflict resolution emits another checked operation; it must not erase later local edits.
- Persist replay baseline, partial group inbox, conflicts and local outbox together with the resulting
  exact state before acknowledging the cursor. Check the local generation/store snapshot before
  publishing a replay so concurrent UI edits cannot be overwritten. A workspace/account switch stops
  stale UI application. Duplicate replay/ack is harmless. Invalid shape, ownership or decryption fails
  closed with actionable retry/recovery text, never an empty reset.
- First enrollment must really use the server's empty-registry rule; a nonempty registry requires an
  already trusted device to approve the new device's public identity. A public approval code contains
  the workspace ref/device ID/Ed25519 public key; display/compare its fingerprint. It contains no secret.
  Wrap epoch keys to each verified recipient using installed Noble Ed25519→X25519 conversion,
  ephemeral X25519/HKDF/AES-GCM with workspace/recipient/epoch/version-bound AAD. Do not distribute a
  future-key derivation root to a device that can later be revoked. Save key material before network.
- On revoke, generate a genuinely fresh key and wrap it only to remaining devices, as the existing
  server requires. Retain prior-key access for legitimate backlog/new-device replay without letting
  the revoked device derive future keys. A small signed opaque key-transition endpoint can store each
  old key sealed under its successor; new approved devices unwrap backwards from their current key.
  This avoids unbounded keyrings stuffed into device metadata and needs no new secret provider.
- Initial bootstrap and large atomic patches may require bounded encrypted chunks/groups within the
  existing operation size limit. Never acknowledge/apply an incomplete group. Do not enable automatic
  compaction until an exact replay-baseline checkpoint exists and all active devices acknowledge it.
  This shipping lane may retain the replay log; it must reject an incompatible compacted history with
  explicit recovery guidance rather than pretending to initialize a new empty cloud workspace.
- Cloud account deletion must fence future registration/operations, not only enumerate an eventually
  consistent KV marker list. Use the account backup authority's durable inventory/admission fence plus
  a permanent deleted state in each registered sync coordinator. Delete/admit races must be resolved
  durably. Backup recovery and live-sync revocation are distinct: revocation cannot erase already
  downloaded data or make an old backup code unknown to a lost device; copy must say this honestly.
- Four to six focused integration cases: durable local commit/outbox, crossed two-device edits and
  explicit resolution, lost upload response/restart/replay, key approval/revocation, and deletion race.
  Test actual adapters/core execution functions, not another readiness-assessment model. Relevant
  service/mobile no-emit only; no build/device/deploy until controller review.

Financial-action checkpoint: controller reviewed Luna's implementation and corrected reentrant
confirmation, penny arithmetic, refund edits exceeding their original, false successful Undo,
refund history cashflow and unbounded refund selection rendering. Internal transfers update both
owned cash accounts together, retain structural links through the canonical/SQLite round trip, and
stay out of income/spend inference. Refund pairing changes no balances and now has a real Unpair
action. The final named financial/structural checks passed 10 cases; mobile no-emit passed. Two small
manual-money parser cases cover formatted GBP and malformed/non-finite input; prefills retain pennies.
Metro now resolves reviewed local calendar/finance/sync/today packages to source instead of stale dist.

Apple checkpoint `7309b3f`: official SDK 3.1.0 dynamically loads inside requests; production roots
match Apple PKI byte-for-byte. Controller fixed StoreKit proof length, current signed-chain selection,
Sandbox test labeling, grace expiry, iOS product/period gating, incomplete-response cancellation,
oversized-response limits and Worker-incompatible redirect mode. Five named files passed 21 cases;
after redirect correction the two transport cases passed. Service no-emit and Wrangler 4.105.0 local
packaging dry run passed (177.75 KiB gzip; no deployment). The real local Worker starts and verifies
Apple's synthetic signed certificate/JWS fixture using the actual SDK and aliased transport. This
does not claim online OCSP/App Store account or iOS device evidence. Worker mobile no-emit passed;
controller's later check found only in-flight backup helper names, so combined mobile acceptance
waits for that lane. The owner must provide Apple's In-App Purchase key, not a general Connect key.

Bank deletion boundary `da91eda`: a disabled connection flag no longer fabricates deletion success.
Native account deletion requires a real server receipt; the authenticated server route remains usable
when new connections are disabled or provider configuration is absent. Two named client/handler cases
and banking service no-emit passed. Race-safe account tombstones remain part of the A07 work.

Controller review, 5 September: the first M checkpoint was not accepted blindly. Existing `isRealUser`
already protects extra/business state missed by a new record-list classifier; that existing boundary
must authorize any legacy sample reset. Today must use the same local-day engine anchor as Plan and
Calendar. Returning income settings now retain cadence/amount/anchor and skip unrelated setup pages.
The UI worker temporarily owns `types.ts` and `shell/FolioShell.tsx` for real search/debt mounts and
companion composition only; controller will not overlap those edits. The release tracker now has an
explicit open local-engineering gate instead of representing the audit as external credentials work.

Second checkpoint: Luna's M/UI pass reported 28 tests and mobile no-emit passing. Controller then
fixed uncached array snapshots in Search (React external-store render loop), notification permission
refresh/serialized toggles/failed preference writes, new-screen viewport insets, explicit chat panel
height, stale voice-permission rejection handling and Review's no-source copy. The controller ran
five named test files (onboarding, Plan model, day clock, search model, notification preferences):
34 cases passed. This is source/focused-test evidence, not S9 evidence. Billing is now exclusively
owned by Luna; shared shell and reviewed UI are released to the controller. Transfer/refund still
need the separate structural financial-action implementation.

Prepared integration constraints for later Luna lanes:

- `typedCommandBridge.ts` receipts contain command metadata and compact audit hashes, not replayable
  mutations. Do not misrepresent them as a shipping sync outbox. The exact state, canonical mirror
  and receipts commit together in `persistCurrentStateNow` → `saveNativeWorkspaceStateGeneration`;
  a durable sync outbox must join that boundary, preserve in-flight edits and survive restart.
- Open Banking currently uses KV. A batch in a KV record alone does not serialize competing refresh,
  acknowledgement and disconnect requests. The delivery design must address that race as well as
  ordinary response loss, without keeping provider plaintext in logs or unencrypted temporary data.
- `applyMeloTool` currently encodes refund references and transfer legs in merchant labels. Actual
  Plan actions need structural links and atomic mutations; two unrelated `addTransaction` calls
  and a chat prefill do not meet the acceptance contract. Preserve canonical round-trip authority
  when introducing optional transaction metadata, and exclude internal transfers from spend/income
  inference without hiding them from account history.

Android checkpoint review: controller centralized paywall/restore/native-event proof processing,
serialized Full/Live grant persistence, enforced canonical JWT expiry without fractional extension,
added provider timeout and offline-local refresh before native queries, and mounted the lifecycle.
Play's persistent unfinished/pending queue is the durable source; unused SecureStore markers and
premature in-memory redelivery suppression were removed. The adapter selects a regular eligible
base plan with matching monthly/yearly period and displays that exact localized price. Hard-coded
GBP savings were removed. Four named files passed 23 cases, including six new lifecycle/adapter
cases and a concurrent grant-write regression; mobile no-emit passed. No actual purchase made.
Apple A11 is still implementation work, not an external-credentials-only blocker.

Saved reviewed source checkpoints: `de18d8da` (Android billing/runtime), `a8b6379b` (money/UI and
app-wide billing mount). Neither is a tested native candidate yet.

Controller preparation for Apple A11: installed expo-iap documents `purchaseToken` as StoreKit JWS
on iOS, and has Apple request, restore and finish APIs. The billing Worker already enables
`nodejs_compat`. Prefer Apple's official `@apple/app-store-server-library` for trust-chain and JWS
verification, subject to one local Worker compatibility check; do not invent a certificate verifier.
Controller permits this narrowly scoped service dependency if needed, not unrelated upgrades.
Verify the device JWS against pinned Apple roots, expected bundle/environment/product, then query
current App Store transaction/subscription state before granting. Reject revoked/upgraded/expired
Live proofs; use the latest applicable subscription transaction and explicit grace state, not just
the old device expiry. Production must not auto-fallback to sandbox. Required owner inputs are
App Store Connect issuer/key id/private key, app Apple id and environment/product configuration;
the private key remains server-side. No Apple account or iOS runtime result is implied here.
Primary references checked: [Apple server library](https://github.com/apple/app-store-server-library-node),
[transaction lookup](https://developer.apple.com/documentation/appstoreserverapi/get-transaction-info),
[subscription status](https://developer.apple.com/documentation/appstoreserverapi/get-all-subscription-statuses).

Cloud A04/A05 review: Luna returned 33 selected cases and package/service/mobile checks. Controller
fixed signing before a queued transport (now the entire request signs/sends/consumes inside the
queue), bounded native network/body-read time, preserved a target device's request counter during
reapproval, coalesced backup device-id creation, bound transaction-time authorization to the exact
verified key, hid the service-only purge route and sanitized internal headers. The atomic persisted
request high-water mark alone prevents replay; redundant nonce journals and per-request scans were
removed to keep service state/cost bounded. Nonce, time, body, route and workspace remain signed.
The real native Ed25519 signer now exercises the real coordinator in two integration cases, including
queue ordering, replay and transit tampering. The controller's four-file pass had 34 cases; after the
journal simplification the two directly affected files passed nine cases and service no-emit passed.
A06 still requires actual enrollment, local outbox, conflict/replay and lifecycle UI integration.

Apple compatibility preparation passed in local workerd with the official SDK 3.1.0 and Apple's
public synthetic Sandbox transaction/certificate fixture. The SDK must be dynamically imported
inside the request handler: its dependency initializes random bytes and cannot run in Worker global
scope. `tooling/scripts/check-apple-verifier-runtime.mjs` records this bounded check. Online OCSP,
App Store account state and iOS device behavior remain unproven. The narrowly scoped dependency
install recovered with cached/frozen-lockfile installation; no unrelated package upgrade was made.

A14 first checkpoint is **not accepted yet**. Controller review found hidden transfer-confirm errors,
missing visible undo/busy behavior, refund choices including transfer/already-linked rows, unsafe
undo after absolute account corrections, independently editable transfer legs, and direct history
consumers bypassing the transfer filter. Luna has been sent these exact corrections before resuming
Apple. Three affected files passed 269 existing cases, but those cases did not cover these boundaries;
the revision uses named financial-action cases, not another full store run.

Controller recovery design constraints for A03/A13:

- `VAULTS` is Workers KV, despite `BackupStore`'s R2-shaped interface. A read/check/write over KV
  cannot enforce generation preconditions. Use an account-scoped SQLite Durable Object as the
  authoritative backup head/catalog and atomic generation store; keep existing KV only for a guarded
  legacy migration. No R2 conditional-write assumption and no process-only mutex. Bound each encrypted
  backup to the existing 4 MiB and chunk stored values below platform limits. Validate body/hash before
  the durable transaction. Do not hold `blockConcurrencyWhile` across external I/O or use it for every
  request. A new binding/migration in source is authorized, deployment is not.
- Mutating backup requests must name the observed generation (`If-Match`) or create-only
  (`If-None-Match: *`). Missing/stale preconditions must fail closed. A retry of the exact accepted
  ciphertext is idempotent, not another rotation. Preserve a prior-generation recovery route; when
  explicitly replacing the recovery key, preserve the old recovery anchor until a later explicit
  replacement/deletion, rather than destroying it with the next ordinary backup.
- The account catalog need only list opaque workspace references and generation metadata. Names,
  kind, raw workspace IDs and registry details already live inside the encrypted backup. A clean
  phone can list account-owned opaque references, try the user's workspace recovery code locally,
  verify `workspaceBackupRef(decrypted active/dataWorkspaceId)` matches the returned reference, and
  show the decrypted name/summary. This supplies encrypted workspace discovery without introducing
  another account master secret or uploading plaintext workspace labels.
- Missing local key plus an existing remote head defaults to recovery. Explicit replacement is a
  separate destructive confirmation, bound to the reviewed generation. Persist new recovery material
  before upload; retain old/pending keys across failed upload/response loss. Restoring a previous
  generation must not silently replace the current generation's stored recovery key.
- `persist.ts` already has quiesced workspace transitions and `writePartitionState` for exact
  SQLCipher/canonical staging. Recovery should save current data, validate and stage the recovered
  partition, then commit a merged Personal manifest before activating it. Preserve the other local
  workspace; reject an incompatible second Business ID instead of silently deleting/replacing it.
  A Personal backup that only knows Business metadata must not fabricate an empty Business partition.
- The sync snapshot checksum check must read the new authoritative backup head, and account deletion
  must purge both the new backup DO and legacy ciphertext. Document safe legacy migration/activation
  order; do not infer that local tests prove a deployed migration.

Additional concrete banking review constraints: serialize the connection's refresh/ack/disconnect
state with durable revision/lease checks, not KV last-write-wins. Do provider network I/O outside
the transaction, then publish cursor + encrypted recoverable batch only if the lease/revision still
owns the live connection. A delayed refresh/error/callback must never resurrect a disconnected or
deleted connection. Batch acknowledgement follows read-verified local staging, not React state;
repeated/unacknowledged refresh returns the same batch. Bound retained data and explain expiry
without dropping unreviewed accepted local staging. A disabled feature flag does not prove an
account has no historical bank data: deletion must not fabricate success solely because the current
build hides the banking UI. Keep the existing truthful limitation on bank-side consent revocation.

Controller runtime evidence: `check-sync-coordinator-runtime.mjs` passed a single bounded synthetic
case against the shipping `SyncWorkspaceDurableObject` in local workerd/SQLite storage: two enrolled
devices uploaded concurrently and both durable operations/cursors survived. This is stronger than
the clone-backed unit storage checks but still does not prove deployed JWT configuration or mobile
sync integration. No Cloudflare service was deployed or queried by this check.
